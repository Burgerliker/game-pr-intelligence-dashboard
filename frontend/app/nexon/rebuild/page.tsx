"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ApiGuardBanner from "../../../components/ApiGuardBanner";
import PageStatusView from "../../../components/PageStatusView";
import { apiGet, getDiagnosticCode } from "../../../lib/api";
import { buildDiagnosticScope, toRequestErrorState } from "../../../lib/pageStatus";
import { createEmptyCluster, createEmptyRisk, normalizeNexonDashboard } from "../../../lib/normalizeNexon";

const USE_MOCK_FALLBACK = process.env.NEXT_PUBLIC_USE_MOCK_FALLBACK === "true";
const SHOW_BACKTEST = process.env.NEXT_PUBLIC_SHOW_BACKTEST === "true";
const ARTICLE_PAGE_SIZE = 20;
const DIAG_SCOPE = {
  health: buildDiagnosticScope("NEX", "HEALTH"),
  dashboard: buildDiagnosticScope("NEX", "DASH"),
  article: buildDiagnosticScope("NEX", "ART"),
};

const MOCK_RISK: any = {
  meta: { company: "넥슨", ip: "메이플스토리", ip_id: "maplestory", date_from: "2024-01-01", date_to: "2026-12-31", total_articles: 4320 },
  daily: Array.from({ length: 24 }).map((_, i) => ({
    date: `2026-01-${String(i + 1).padStart(2, "0")}`,
    article_count: 45 + Math.round(Math.sin(i / 2) * 18) + (i % 7 === 0 ? 16 : 0),
    negative_ratio: 16 + (i % 5) * 5,
  })),
  outlets: [
    { outlet: "inven.co.kr", article_count: 640, positive_ratio: 28.2, neutral_ratio: 38.6, negative_ratio: 33.2 },
    { outlet: "mk.co.kr", article_count: 592, positive_ratio: 32.9, neutral_ratio: 39.5, negative_ratio: 27.6 },
    { outlet: "sedaily.com", article_count: 511, positive_ratio: 30.4, neutral_ratio: 41.2, negative_ratio: 28.4 },
  ],
  risk_themes: [
    { theme: "확률형/BM", article_count: 1230, negative_ratio: 46.1, risk_score: 0.91 },
    { theme: "규제/법적", article_count: 819, negative_ratio: 43.5, risk_score: 0.76 },
    { theme: "운영/장애", article_count: 942, negative_ratio: 38.3, risk_score: 0.74 },
    { theme: "보상/환불", article_count: 702, negative_ratio: 35.7, risk_score: 0.64 },
  ],
  ip_catalog: [
    { id: "all", name: "넥슨 (전체보기)" },
    { id: "maplestory", name: "메이플스토리" },
    { id: "dnf", name: "던전앤파이터" },
    { id: "arcraiders", name: "아크레이더스" },
    { id: "fconline", name: "FC온라인" },
    { id: "bluearchive", name: "블루아카이브" },
  ],
};

const MOCK_CLUSTER: any = {
  meta: { cluster_count: 4, total_articles: 4320 },
  keyword_cloud: [
    { word: "확률", count: 120, weight: 1.0 },
    { word: "보상", count: 96, weight: 0.8 },
    { word: "업데이트", count: 88, weight: 0.73 },
  ],
  clusters: [
    { cluster: "확률형/BM", article_count: 680, negative_ratio: 51.2, keywords: ["확률", "과금", "보상"] },
    { cluster: "보상/환불", article_count: 390, negative_ratio: 44.3, keywords: ["환불", "보상", "피해"] },
  ],
};

function fmtTime(date: Date | string = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleTimeString("ko-KR", { hour12: false });
}

function metricColor(score: number) {
  if (score >= 70) return "text-rose-600";
  if (score >= 45) return "text-amber-600";
  return "text-emerald-600";
}

export default function NexonRebuildPage() {
  const [ip, setIp] = useState("maplestory");
  const [riskData, setRiskData] = useState<any>(() => createEmptyRisk("maplestory"));
  const [clusterData, setClusterData] = useState<any>(() => createEmptyCluster("maplestory"));
  const [riskScore, setRiskScore] = useState<any>(null);
  const [burstStatus, setBurstStatus] = useState<any>(null);
  const [burstEvents, setBurstEvents] = useState<any[]>([]);
  const [health, setHealth] = useState<any>(null);
  const [usingMock, setUsingMock] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [errorCode, setErrorCode] = useState("");
  const [notice, setNotice] = useState("");
  const [lastUpdatedAt, setLastUpdatedAt] = useState("");
  const [articleItems, setArticleItems] = useState<any[]>([]);
  const [articleTotal, setArticleTotal] = useState(0);
  const [articleOffset, setArticleOffset] = useState(0);
  const [articleHasMore, setArticleHasMore] = useState(false);
  const [articleLoading, setArticleLoading] = useState(false);
  const [articleError, setArticleError] = useState("");
  const [articleErrorCode, setArticleErrorCode] = useState("");
  const [healthDiagCode, setHealthDiagCode] = useState("");

  const ipCacheRef = useRef<Map<string, any>>(new Map());
  const requestSeqRef = useRef(0);
  const articleReqSeqRef = useRef(0);
  const articleAbortRef = useRef<AbortController | null>(null);
  const trendRef = useRef<HTMLDivElement | null>(null);
  const outletRef = useRef<HTMLDivElement | null>(null);
  const themeRef = useRef<HTMLDivElement | null>(null);
  const keywordRef = useRef<HTMLDivElement | null>(null);
  const chartInst = useRef<any>({});

  const getHealthDiagnosticCode = useCallback((healthError: any) => {
    return healthError ? getDiagnosticCode(healthError, DIAG_SCOPE.health) : "";
  }, []);

  const loadDashboard = useCallback(async (targetIp = ip) => {
    const requestSeq = ++requestSeqRef.current;
    const baseCatalog = riskData?.ip_catalog || MOCK_RISK.ip_catalog;
    setRiskData(createEmptyRisk(targetIp, baseCatalog));
    setClusterData(createEmptyCluster(targetIp));
    setRiskScore(null);
    setError("");
    setErrorCode("");
    setNotice("");
    setLoading(true);

    const cached = ipCacheRef.current.get(targetIp);
    if (cached) {
      if (requestSeq !== requestSeqRef.current) return;
      setRiskData(cached.riskData);
      setClusterData(cached.clusterData);
      setRiskScore(cached.riskScore);
      setBurstStatus(cached.burstStatus);
      setBurstEvents(cached.burstEvents);
      setHealth(cached.health || null);
      setHealthDiagCode(cached.healthDiagCode || "");
      setUsingMock(Boolean(cached.usingMock));
      setNotice(cached.notice || "");
      setLastUpdatedAt(cached.lastUpdatedAt || fmtTime());
      setLoading(false);
      return;
    }

    try {
      const qs = new URLSearchParams({ ip: targetIp });
      const [riskPayload, clusterPayload, riskScorePayload, burstStatusPayload, burstEventsPayload, healthState] = await Promise.all([
        apiGet(`/api/risk-dashboard?${qs.toString()}`),
        apiGet(`/api/ip-clusters?${qs.toString()}&limit=6`),
        apiGet(`/api/risk-score?ip=${targetIp}`).catch(() => null),
        apiGet("/api/burst-status").catch(() => null),
        apiGet("/api/burst-events?limit=50").catch(() => null),
        apiGet("/api/health").then((data) => ({ data, error: null })).catch((e) => ({ data: null, error: e })),
      ]);

      const normalized = normalizeNexonDashboard({
        targetIp,
        riskPayload,
        clusterPayload,
        useMockFallback: USE_MOCK_FALLBACK,
        mockRisk: MOCK_RISK,
        mockCluster: MOCK_CLUSTER,
        baseCatalog,
      });

      const cachedValue = {
        riskData: normalized.riskData,
        clusterData: normalized.clusterData,
        riskScore: riskScorePayload || null,
        burstStatus: burstStatusPayload || null,
        burstEvents: (burstEventsPayload?.items || []).slice(0, 50),
        health: healthState.data || null,
        healthDiagCode: getHealthDiagnosticCode(healthState.error),
        usingMock: normalized.usingMock,
        notice: normalized.notice,
        lastUpdatedAt: fmtTime(),
      };

      if (requestSeq !== requestSeqRef.current) return;
      setRiskData(cachedValue.riskData);
      setClusterData(cachedValue.clusterData);
      setRiskScore(cachedValue.riskScore);
      setBurstStatus(cachedValue.burstStatus);
      setBurstEvents(cachedValue.burstEvents);
      setHealth(cachedValue.health);
      setHealthDiagCode(cachedValue.healthDiagCode);
      setUsingMock(cachedValue.usingMock);
      setNotice(cachedValue.notice);
      setLastUpdatedAt(cachedValue.lastUpdatedAt);
      ipCacheRef.current.set(targetIp, cachedValue);
    } catch (e) {
      if (requestSeq !== requestSeqRef.current) return;
      if (USE_MOCK_FALLBACK) {
        const ipName = MOCK_RISK.ip_catalog.find((x: any) => x.id === targetIp)?.name || targetIp;
        setRiskData({ ...MOCK_RISK, meta: { ...MOCK_RISK.meta, ip_id: targetIp, ip: ipName, total_articles: 0 } });
        setClusterData(MOCK_CLUSTER);
        setUsingMock(true);
        setNotice("실데이터 호출 실패로 샘플 데이터를 표시 중입니다.");
      } else {
        setRiskData(createEmptyRisk(targetIp, baseCatalog));
        setClusterData(createEmptyCluster(targetIp));
        setUsingMock(false);
        setNotice("실데이터 호출에 실패했습니다. 백엔드 주소/API 상태를 확인해주세요.");
      }
      setLastUpdatedAt("-");
      const nextError = toRequestErrorState(e, {
        scope: DIAG_SCOPE.dashboard,
        fallback: "대시보드 API 요청에 실패했습니다.",
      });
      setError(nextError.message);
      setErrorCode(nextError.code);
    } finally {
      if (requestSeq === requestSeqRef.current) setLoading(false);
    }
  }, [getHealthDiagnosticCode, ip, riskData?.ip_catalog]);

  const loadMoreArticles = useCallback(async (targetIp = ip, reset = false) => {
    if (!reset && (articleLoading || !articleHasMore)) return;
    const reqSeq = ++articleReqSeqRef.current;
    const nextOffset = reset ? 0 : articleOffset;
    articleAbortRef.current?.abort();
    const controller = new AbortController();
    articleAbortRef.current = controller;
    if (reset) {
      setArticleError("");
      setArticleErrorCode("");
    }

    setArticleLoading(true);
    try {
      const payload: any = await apiGet(
        `/api/nexon-articles?ip=${encodeURIComponent(targetIp)}&limit=${ARTICLE_PAGE_SIZE}&offset=${nextOffset}`,
        { signal: controller.signal }
      );
      if (reqSeq !== articleReqSeqRef.current) return;
      const nextItems = Array.isArray(payload?.items) ? payload.items : [];
      setArticleItems((prev) => (reset ? nextItems : [...prev, ...nextItems]));
      setArticleTotal(Number(payload?.total || 0));
      setArticleOffset(nextOffset + nextItems.length);
      setArticleHasMore(Boolean(payload?.has_more));
    } catch (e: any) {
      if (e?.name === "AbortError") return;
      if (reqSeq !== articleReqSeqRef.current) return;
      const nextError = toRequestErrorState(e, {
        scope: DIAG_SCOPE.article,
        fallback: "기사 목록 API 호출에 실패했습니다.",
      });
      setArticleError(nextError.message);
      setArticleErrorCode(nextError.code);
      if (reset) {
        setArticleItems([]);
        setArticleTotal(0);
        setArticleOffset(0);
        setArticleHasMore(false);
      }
    } finally {
      if (reqSeq === articleReqSeqRef.current) setArticleLoading(false);
    }
  }, [articleHasMore, articleLoading, articleOffset, ip]);

  useEffect(() => {
    loadDashboard(ip);
  }, [ip, loadDashboard]);

  useEffect(() => {
    articleReqSeqRef.current += 1;
    articleAbortRef.current?.abort();
    setArticleItems([]);
    setArticleTotal(0);
    setArticleOffset(0);
    setArticleHasMore(true);
    setArticleLoading(false);
    setArticleError("");
    setArticleErrorCode("");
    loadMoreArticles(ip, true);
  }, [ip, loadMoreArticles]);

  useEffect(() => () => articleAbortRef.current?.abort(), []);

  useEffect(() => {
    const timer = setInterval(async () => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      try {
        const [rs, bs, healthState] = await Promise.all([
          apiGet(`/api/risk-score?ip=${ip}`).catch(() => null),
          apiGet("/api/burst-status").catch(() => null),
          apiGet("/api/health").then((data) => ({ data, error: null })).catch((e) => ({ data: null, error: e })),
        ]);
        if (rs) setRiskScore(rs);
        if (bs) setBurstStatus(bs);
        if (healthState.data) setHealth(healthState.data);
        setHealthDiagCode(getHealthDiagnosticCode(healthState.error));
        if (rs || bs || healthState.data) setLastUpdatedAt(fmtTime());
      } catch {
        // noop
      }
    }, 60000);
    return () => clearInterval(timer);
  }, [getHealthDiagnosticCode, ip]);

  const dailyRows = riskData?.daily || [];
  const outletRows = riskData?.outlets || [];
  const themes = riskData?.risk_themes || [];
  const keywordCloud = clusterData?.keyword_cloud || [];
  const clusters = clusterData?.clusters || [];
  const riskValue = Number(riskScore?.risk_score || 0);
  const selectedBurstStatus = (burstStatus?.items || []).find((x: any) => x.ip_id === ip) || (burstStatus?.items || [])[0] || null;
  const filteredBurstEvents = (burstEvents || []).filter((evt: any) => (ip === "all" ? true : evt.ip_name === ip));

  useEffect(() => {
    let mounted = true;
    let onResize: (() => void) | null = null;
    const mount = async () => {
      const echarts = await import("echarts");
      if (!mounted) return;
      const init = (key: string, el: HTMLDivElement | null) => {
        if (!el || chartInst.current[key]) return;
        chartInst.current[key] = echarts.init(el);
      };
      init("trend", trendRef.current);
      init("outlet", outletRef.current);
      init("theme", themeRef.current);
      init("keyword", keywordRef.current);
      onResize = () => Object.values(chartInst.current).forEach((c: any) => c?.resize());
      window.addEventListener("resize", onResize);
    };
    mount();
    return () => {
      mounted = false;
      if (onResize) window.removeEventListener("resize", onResize);
      Object.values(chartInst.current).forEach((c: any) => c?.dispose?.());
      chartInst.current = {};
    };
  }, []);

  useEffect(() => {
    if (!chartInst.current.trend) return;
    chartInst.current.trend.setOption({
      animation: false,
      tooltip: { trigger: "axis" },
      grid: { left: 36, right: 20, top: 20, bottom: 34 },
      xAxis: { type: "category", data: dailyRows.map((r: any) => r.date), axisLabel: { color: "#64748b", formatter: (v: string) => String(v || "").slice(5) } },
      yAxis: { type: "value", axisLabel: { color: "#64748b" } },
      series: [
        { name: "기사 수", type: "bar", data: dailyRows.map((r: any) => Number(r.article_count || 0)), itemStyle: { color: "#2563eb" }, barMaxWidth: 16 },
        { name: "부정 비율", type: "line", smooth: true, symbol: "none", data: dailyRows.map((r: any) => Number(r.negative_ratio || 0)), lineStyle: { color: "#dc2626", width: 2 } },
      ],
    }, { notMerge: true, lazyUpdate: true });
  }, [dailyRows]);

  useEffect(() => {
    if (!chartInst.current.outlet) return;
    const rows = outletRows.slice(0, 12);
    chartInst.current.outlet.setOption({
      animation: false,
      tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
      grid: { left: 80, right: 16, top: 20, bottom: 20 },
      xAxis: { type: "value" },
      yAxis: { type: "category", data: rows.map((r: any) => r.outlet), axisLabel: { color: "#64748b" } },
      series: [
        { name: "긍정", type: "bar", stack: "s", data: rows.map((r: any) => Number(r.positive_ratio || 0)), itemStyle: { color: "#16a34a" } },
        { name: "중립", type: "bar", stack: "s", data: rows.map((r: any) => Number(r.neutral_ratio || 0)), itemStyle: { color: "#f59e0b" } },
        { name: "부정", type: "bar", stack: "s", data: rows.map((r: any) => Number(r.negative_ratio || 0)), itemStyle: { color: "#dc2626" } },
      ],
    }, { notMerge: true, lazyUpdate: true });
  }, [outletRows]);

  useEffect(() => {
    if (!chartInst.current.theme) return;
    chartInst.current.theme.setOption({
      animation: false,
      tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
      grid: { left: 80, right: 16, top: 20, bottom: 20 },
      xAxis: { type: "value" },
      yAxis: { type: "category", data: themes.map((t: any) => t.theme), axisLabel: { color: "#64748b" } },
      series: [{ name: "위험 점수", type: "bar", data: themes.map((t: any) => Math.round(Number(t.risk_score || 0) * 100)), itemStyle: { color: "#7c3aed" } }],
    }, { notMerge: true, lazyUpdate: true });
  }, [themes]);

  useEffect(() => {
    if (!chartInst.current.keyword) return;
    chartInst.current.keyword.setOption({
      animation: false,
      tooltip: { show: true },
      series: [{
        type: "treemap",
        roam: false,
        breadcrumb: { show: false },
        label: { show: true, formatter: "{b}", color: "#fff" },
        data: keywordCloud.slice(0, 80).map((w: any) => ({ name: String(w.word || ""), value: Math.max(1, Number(w.count || 0)) })),
        levels: [{ color: ["#2563eb", "#16a34a", "#f59e0b", "#dc2626", "#0ea5e9", "#8b5cf6"], colorMappingBy: "value" }],
      }],
    }, { notMerge: true, lazyUpdate: true });
  }, [keywordCloud]);

  const ipCatalog = riskData?.ip_catalog || MOCK_RISK.ip_catalog;

  return (
    <main className="min-h-screen bg-slate-100 px-3 py-4 md:px-6 md:py-8">
      <div className="mx-auto max-w-[1320px] space-y-4">
        <section className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-semibold tracking-[0.16em] text-slate-500">NEXON REBUILD</p>
              <h1 className="text-2xl font-black tracking-tight text-slate-900">넥슨 IP 리스크 대시보드</h1>
            </div>
            <div className="flex flex-wrap gap-2 text-sm">
              <Link href="/" className="rounded-full border border-slate-300 px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-50">메인</Link>
              <Link href="/compare" className="rounded-full border border-slate-300 px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-50">경쟁사 비교</Link>
              {SHOW_BACKTEST ? <Link href="/nexon/rebuild/backtest" className="rounded-full border border-slate-300 px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-50">Backtest 보기</Link> : null}
            </div>
          </div>
        </section>

        <ApiGuardBanner />

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            {ipCatalog.map((item: any) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setIp(item.id)}
                className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${ip === item.id ? "border-blue-600 bg-blue-600 text-white" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"}`}
              >
                {item.name}
              </button>
            ))}
            <span className="ml-auto rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-500">마지막 갱신 {lastUpdatedAt || "-"}</span>
          </div>

          <PageStatusView
            loading={{ show: loading, title: "IP 데이터 동기화 중", subtitle: "리스크/이슈/아티클 데이터를 갱신하고 있습니다." }}
            error={{ show: false }}
            empty={{ show: false }}
          />
          {notice ? <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">{notice}</p> : null}
          {healthDiagCode ? <p className="mt-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-700">실시간 상태 일부 누락 (진단코드: {healthDiagCode})</p> : null}
          <PageStatusView
            loading={{ show: false }}
            error={{
              show: Boolean(error),
              title: "대시보드 데이터를 불러오지 못했습니다.",
              details: error,
              diagnosticCode: errorCode,
              actionLabel: "재시도",
              onAction: () => loadDashboard(ip),
            }}
            empty={{ show: false }}
          />

          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3"><p className="text-xs text-slate-500">선택 IP</p><p className="text-lg font-bold text-slate-900">{riskData?.meta?.ip || "-"}</p></div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3"><p className="text-xs text-slate-500">총 기사 수</p><p className="text-lg font-bold text-slate-900">{Number(riskData?.meta?.total_articles || 0).toLocaleString()}</p></div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3"><p className="text-xs text-slate-500">이슈 묶음 수</p><p className="text-lg font-bold text-slate-900">{Number(clusterData?.meta?.cluster_count || 0)}</p></div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3"><p className="text-xs text-slate-500">현재 위험도</p><p className={`text-lg font-black ${metricColor(riskValue)}`}>{riskValue.toFixed(1)}</p></div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-3">
            <div className="rounded-xl border border-slate-200 p-3 lg:col-span-2">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-sm font-bold text-slate-800">실시간 위험도</h2>
                <span className="text-xs text-slate-500">alert: {String(riskScore?.alert_level || "P3").toUpperCase()}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                <div className={`h-full ${riskValue >= 70 ? "bg-rose-600" : riskValue >= 45 ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${Math.max(0, Math.min(100, riskValue))}%` }} />
              </div>
              <p className="mt-2 text-sm text-slate-600">
                최근 {Number(riskScore?.meta?.window_hours || 24)}시간 기사 {Number(riskScore?.article_count_window || 0).toLocaleString()}건 · 확산 {Number(riskScore?.spread_ratio || 0).toFixed(2)} · 불확실 {Math.round(Number(riskScore?.uncertain_ratio || 0) * 100)}%
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
                {(["S", "V", "T", "M"] as const).map((k) => {
                  const v = Math.max(0, Math.min(1, Number(riskScore?.components?.[k] || 0)));
                  return (
                    <div key={k} className="rounded-lg border border-slate-200 p-2">
                      <p className="text-xs font-semibold text-slate-600">{k} 구성요소</p>
                      <p className="text-sm font-bold text-slate-900">{v.toFixed(2)}</p>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-200"><div className="h-full bg-blue-600" style={{ width: `${v * 100}%` }} /></div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 p-3">
              <h2 className="text-sm font-bold text-slate-800">수집 상태</h2>
              <p className="mt-2 text-sm text-slate-600">
                {selectedBurstStatus?.mode === "burst" ? "BURST" : "NORMAL"} · 주기 {selectedBurstStatus?.interval_seconds || 600}s
              </p>
              <p className="mt-1 text-sm text-slate-600">최근 이벤트 {filteredBurstEvents.length}건</p>
              <p className="mt-1 text-xs text-slate-500">DB 모드: {health?.mode || "unknown"}</p>
              {usingMock ? <p className="mt-2 rounded-md bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700">샘플 데이터 사용 중</p> : null}
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          <article className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm lg:col-span-2">
            <h3 className="mb-2 text-sm font-bold text-slate-800">일자별 기사/부정 추이</h3>
            <div ref={trendRef} className="h-[260px] w-full" />
          </article>
          <article className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
            <h3 className="mb-2 text-sm font-bold text-slate-800">위험 테마 점수</h3>
            <div ref={themeRef} className="h-[260px] w-full" />
          </article>
        </section>

        <section className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <article className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
            <h3 className="mb-2 text-sm font-bold text-slate-800">언론사 감성 분포</h3>
            <div ref={outletRef} className="h-[340px] w-full" />
          </article>
          <article className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
            <h3 className="mb-2 text-sm font-bold text-slate-800">키워드 중요도 맵</h3>
            <div ref={keywordRef} className="h-[340px] w-full rounded-lg border border-slate-100" />
          </article>
        </section>

        <section className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <article className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
            <h3 className="mb-2 text-sm font-bold text-slate-800">이슈 클러스터</h3>
            <div className="space-y-2">
              {clusters.length ? clusters.slice(0, 8).map((c: any, idx: number) => (
                <div key={`${c.cluster}-${idx}`} className="rounded-lg border border-slate-200 p-2">
                  <p className="text-sm font-semibold text-slate-900">{c.cluster}</p>
                  <p className="text-xs text-slate-500">기사 {Number(c.article_count || 0).toLocaleString()}건 · 부정 {Number(c.negative_ratio || 0).toFixed(1)}%</p>
                  <p className="mt-1 text-xs text-slate-600">{(c.keywords || []).join(", ")}</p>
                </div>
              )) : <p className="text-sm text-slate-500">클러스터 데이터가 없습니다.</p>}
            </div>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800">기사 목록</h3>
              <p className="text-xs text-slate-500">{articleItems.length.toLocaleString()} / {articleTotal.toLocaleString()}</p>
            </div>
            <div className="max-h-[420px] space-y-2 overflow-auto pr-1">
              {articleItems.map((item: any, idx: number) => (
                <div key={`${item.url || item.title || "article"}-${idx}`} className="rounded-lg border border-slate-200 p-2">
                  <p className="line-clamp-2 text-sm font-semibold text-slate-900">{item.title || "(제목 없음)"}</p>
                  <p className="mt-1 text-xs text-slate-500">{item.outlet || "-"} · {String(item.published_at || "").replace("T", " ").slice(0, 16)}</p>
                  {item.url ? <a href={item.url} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs font-semibold text-blue-600 hover:underline">원문 보기</a> : null}
                </div>
              ))}
            </div>
            <div className="mt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={() => loadMoreArticles(ip, false)}
                disabled={!articleHasMore || articleLoading}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {articleLoading ? "불러오는 중..." : articleHasMore ? "더 불러오기" : "마지막 페이지"}
              </button>
              <button
                type="button"
                onClick={() => loadMoreArticles(ip, true)}
                disabled={articleLoading}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                새로고침
              </button>
            </div>
            <PageStatusView
              loading={{ show: false }}
              error={{
                show: Boolean(articleError),
                title: "기사 목록 로딩 실패",
                details: articleError,
                diagnosticCode: articleErrorCode,
              }}
              empty={{ show: false }}
            />
          </article>
        </section>
      </div>
    </main>
  );
}
