"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { apiGet, getDiagnosticCode } from "../../../lib/api";

const ARTICLE_PAGE_SIZE = 20;

function asNumber(v) {
  return Number(v || 0);
}

function riskStatus(score) {
  const n = asNumber(score);
  if (n >= 70) return { label: "위기", cls: "bg-red-50 text-red-700 border-red-200" };
  if (n >= 45) return { label: "경고", cls: "bg-orange-50 text-orange-700 border-orange-200" };
  if (n >= 20) return { label: "주의", cls: "bg-amber-50 text-amber-700 border-amber-200" };
  return { label: "정상", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" };
}

function timeInHours(ts) {
  const t = new Date(ts).getTime();
  if (!Number.isFinite(t)) return Number.POSITIVE_INFINITY;
  return (Date.now() - t) / 3600000;
}

export default function RebuildNexonPage() {
  const [ip, setIp] = useState("maplestory");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [riskData, setRiskData] = useState({ meta: {}, daily: [], outlets: [], risk_themes: [], ip_catalog: [] });
  const [clusterData, setClusterData] = useState({ clusters: [] });
  const [riskScore, setRiskScore] = useState(null);
  const [riskTimeseries, setRiskTimeseries] = useState([]);
  const [burstStatus, setBurstStatus] = useState(null);
  const [burstEvents, setBurstEvents] = useState([]);
  const [health, setHealth] = useState(null);
  const [updatedAt, setUpdatedAt] = useState("");

  const [articleItems, setArticleItems] = useState([]);
  const [articleTotal, setArticleTotal] = useState(0);
  const [articleOffset, setArticleOffset] = useState(0);
  const [articleHasMore, setArticleHasMore] = useState(false);
  const [articleLoading, setArticleLoading] = useState(false);

  const [burstRange, setBurstRange] = useState("24h");
  const [showBurstList, setShowBurstList] = useState(false);
  const [burstVisibleCount, setBurstVisibleCount] = useState(10);

  const fetchArticles = useCallback(async (targetIp, reset) => {
    const nextOffset = reset ? 0 : articleOffset;
    if (reset) {
      setArticleItems([]);
      setArticleOffset(0);
      setArticleHasMore(false);
      setArticleTotal(0);
    }
    setArticleLoading(true);
    try {
      const payload = await apiGet(`/api/nexon-articles?ip=${encodeURIComponent(targetIp)}&limit=${ARTICLE_PAGE_SIZE}&offset=${nextOffset}`);
      const nextItems = payload?.items || [];
      setArticleItems((prev) => (reset ? nextItems : [...prev, ...nextItems]));
      setArticleTotal(asNumber(payload?.total));
      setArticleOffset(nextOffset + nextItems.length);
      setArticleHasMore(Boolean(payload?.has_more));
    } finally {
      setArticleLoading(false);
    }
  }, [articleOffset]);

  const fetchCore = useCallback(async (targetIp) => {
    setLoading(true);
    setError("");
    try {
      const base = new URLSearchParams({ ip: targetIp });
      const [rd, cl, rs, rt, bs, be, h] = await Promise.all([
        apiGet(`/api/risk-dashboard?${base.toString()}`),
        apiGet(`/api/ip-clusters?${base.toString()}&limit=6`),
        apiGet(`/api/risk-score?ip=${targetIp}`).catch(() => null),
        apiGet(`/api/risk-timeseries?ip=${targetIp}&hours=168&limit=600`).catch(() => null),
        apiGet("/api/burst-status").catch(() => null),
        apiGet("/api/burst-events?limit=50").catch(() => null),
        apiGet("/api/health").catch(() => null),
      ]);
      setRiskData(rd || { meta: {}, daily: [], outlets: [], risk_themes: [], ip_catalog: [] });
      setClusterData(cl || { clusters: [] });
      setRiskScore(rs);
      setRiskTimeseries(rt?.items || []);
      setBurstStatus(bs);
      setBurstEvents((be?.items || []).slice(0, 50));
      setHealth(h);
      setUpdatedAt(new Date().toLocaleString("ko-KR", { hour12: false }));
    } catch (e) {
      setError(`대시보드 데이터를 불러오지 못했습니다. (${getDiagnosticCode(e, "RB-NEX")})`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCore(ip);
    fetchArticles(ip, true);
    setShowBurstList(false);
    setBurstVisibleCount(10);
  }, [ip, fetchCore, fetchArticles]);

  const catalog = riskData?.ip_catalog?.length ? riskData.ip_catalog : [
    { id: "all", name: "전체" },
    { id: "maplestory", name: "메이플스토리" },
    { id: "dnf", name: "던전앤파이터" },
    { id: "arcraiders", name: "아크 레이더스" },
    { id: "bluearchive", name: "블루 아카이브" },
    { id: "fconline", name: "FC온라인" },
  ];

  const totalExposure = asNumber(riskData?.meta?.total_mentions ?? riskData?.meta?.total_articles);
  const recentExposure = asNumber(riskScore?.exposure_count_window ?? riskScore?.article_count_window);
  const negativeRatio = asNumber(riskScore?.negative_ratio_window);
  const score = asNumber(riskScore?.risk_score);
  const status = riskStatus(score);

  const dailyRows = (riskData?.daily || []).slice(-14);
  const dailyMax = Math.max(1, ...dailyRows.map((r) => asNumber(r.total_mentions ?? r.mention_count ?? r.article_count)));

  const nowFilteredBurst = useMemo(() => {
    const hour = burstRange === "24h" ? 24 : 168;
    return burstEvents.filter((e) => timeInHours(e?.ts || e?.created_at) <= hour);
  }, [burstEvents, burstRange]);

  const visibleBurst = nowFilteredBurst.slice(0, burstVisibleCount);

  const riskVsHeat = (riskTimeseries || []).slice(-24).map((r) => ({
    ts: r.ts || r.timestamp,
    risk: asNumber(r.risk_score ?? r.risk),
    heat: asNumber(r.heat ?? r.total_mentions ?? r.article_count),
  }));

  return (
    <main className="space-y-5">
      <header className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Real-time Monitoring</p>
            <h1 className="mt-1 text-3xl font-black tracking-tight">IP 여론 모니터</h1>
            <p className="mt-2 text-sm text-slate-600">현재 리스크 상태와 기사 확산 흐름을 한 화면에서 확인합니다.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/rebuild" className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700">메인</Link>
            <Link href="/rebuild/compare" className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700">경쟁사 비교</Link>
            <Link href="/rebuild/nexon/backtest" className="rounded-full bg-slate-900 px-4 py-2 text-sm font-bold text-white">과거 분석</Link>
            <button onClick={() => fetchCore(ip)} className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700">새로고침</button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {catalog.map((c) => (
            <button key={c.id} onClick={() => setIp(c.id)} className={`rounded-full border px-3 py-1.5 text-sm font-bold ${ip === c.id ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 bg-white text-slate-700"}`}>
              {c.name || c.id}
            </button>
          ))}
        </div>
      </header>

      {error ? <section className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</section> : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className={`rounded-full border px-4 py-2 text-sm font-black ${status.cls}`}>현재 상태: {status.label}</div>
          <div className="text-xs text-slate-500">마지막 갱신: {updatedAt || "-"}</div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          <article className="rounded-xl border border-slate-200 bg-slate-50 p-3"><p className="text-xs font-bold text-slate-500">위기 지수</p><p className="mt-1 text-3xl font-black tabular-nums">{score.toFixed(1)}</p></article>
          <article className="rounded-xl border border-slate-200 bg-slate-50 p-3"><p className="text-xs font-bold text-slate-500">최근 24h 노출량</p><p className="mt-1 text-3xl font-black tabular-nums">{recentExposure}</p></article>
          <article className="rounded-xl border border-slate-200 bg-slate-50 p-3"><p className="text-xs font-bold text-slate-500">부정 비율</p><p className="mt-1 text-3xl font-black tabular-nums">{negativeRatio.toFixed(1)}%</p></article>
          <article className="rounded-xl border border-slate-200 bg-slate-50 p-3"><p className="text-xs font-bold text-slate-500">총 노출량(재배포 포함)</p><p className="mt-1 text-3xl font-black tabular-nums">{totalExposure}</p></article>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-2">
          <h2 className="text-lg font-black">일자별 노출량/부정 추이 (최근 14일)</h2>
          <div className="mt-4 space-y-2">
            {dailyRows.map((r) => {
              const exposure = asNumber(r.total_mentions ?? r.mention_count ?? r.article_count);
              const neg = asNumber(r.negative_ratio);
              return (
                <div key={r.date} className="grid grid-cols-[86px_1fr_90px_70px] items-center gap-2">
                  <span className="text-xs font-semibold text-slate-500">{r.date}</span>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-slate-900" style={{ width: `${(exposure / dailyMax) * 100}%` }} /></div>
                  <span className="text-right text-sm font-black tabular-nums">{exposure}건</span>
                  <span className="text-right text-xs font-semibold text-slate-500">부정 {neg.toFixed(1)}%</span>
                </div>
              );
            })}
            {!dailyRows.length ? <p className="text-sm text-slate-500">집계 데이터가 없습니다.</p> : null}
          </div>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-black">Risk vs Heat</h2>
          <p className="mt-1 text-xs text-slate-500">Risk(부정 신호)와 Heat(언급량)를 최근 24포인트로 비교합니다.</p>
          <div className="mt-3 space-y-2">
            {riskVsHeat.slice(-8).map((r, idx) => (
              <div key={`${r.ts}-${idx}`} className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                <p className="text-[11px] text-slate-500">{String(r.ts || "").slice(5, 16)}</p>
                <p className="text-sm font-bold">Risk {r.risk.toFixed(1)} · Heat {r.heat}</p>
              </div>
            ))}
            {!riskVsHeat.length ? <p className="text-sm text-slate-500">시계열 데이터가 없습니다.</p> : null}
          </div>
        </article>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-black">급등 감지 이벤트</h2>
            <div className="flex gap-2">
              <button onClick={() => { setBurstRange("24h"); setBurstVisibleCount(10); }} className={`rounded-full border px-3 py-1 text-xs font-bold ${burstRange === "24h" ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300"}`}>24h</button>
              <button onClick={() => { setBurstRange("7d"); setBurstVisibleCount(10); }} className={`rounded-full border px-3 py-1 text-xs font-bold ${burstRange === "7d" ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300"}`}>7d</button>
            </div>
          </div>
          <p className="mt-1 text-sm text-slate-600">최근 {burstRange === "24h" ? "24시간" : "7일"} 이벤트 {nowFilteredBurst.length}건</p>
          <p className="mt-1 text-xs text-slate-500">최근 30분 이벤트 {asNumber(burstStatus?.recent_count_30m)}건</p>
          <div className="mt-3">
            <button onClick={() => { const next = !showBurstList; setShowBurstList(next); if (next) setBurstVisibleCount(10); }} className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700">
              {showBurstList ? "이벤트 숨기기" : "이벤트 보기"}
            </button>
          </div>
          {showBurstList ? (
            <div className="mt-3 space-y-2">
              {visibleBurst.map((e, idx) => (
                <article key={`${e.ts || e.created_at || idx}-${idx}`} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">{e.ts || e.created_at || "-"}</p>
                  <p className="text-sm font-semibold">{e.ip || "-"} · score {asNumber(e.risk_score ?? e.score).toFixed(1)}</p>
                </article>
              ))}
              {!visibleBurst.length ? <p className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">표시할 이벤트가 없습니다.</p> : null}
              {showBurstList && burstVisibleCount < nowFilteredBurst.length ? (
                <button onClick={() => setBurstVisibleCount((v) => v + 10)} className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700">더보기 +10</button>
              ) : null}
            </div>
          ) : null}
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-black">이슈 묶음</h2>
          <div className="mt-3 space-y-2">
            {(clusterData?.clusters || []).slice(0, 8).map((c, idx) => (
              <div key={`${c.keyword || c.cluster_key || idx}-${idx}`} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-sm font-bold">{c.keyword || c.cluster_key || "테마"}</p>
                <p className="mt-1 text-xs text-slate-500">기사 {asNumber(c.article_count)}건 · 부정 {asNumber(c.negative_ratio).toFixed(1)}%</p>
              </div>
            ))}
            {!clusterData?.clusters?.length ? <p className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">이슈 묶음이 없습니다.</p> : null}
          </div>
        </article>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-black">최신 기사</h2>
          <p className="text-xs text-slate-500">총 {articleTotal}건</p>
        </div>
        <div className="space-y-2">
          {articleItems.map((a, idx) => (
            <article key={`${a.id || a.url || idx}-${idx}`} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs text-slate-500">{a.pub_date || a.created_at || "-"} · {a.outlet || a.media || "-"}</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{a.title || "제목 없음"}</p>
            </article>
          ))}
          {!articleItems.length && !articleLoading ? <p className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">표시할 기사가 없습니다.</p> : null}
        </div>
        <div className="mt-3 flex items-center gap-2">
          {articleHasMore ? (
            <button onClick={() => fetchArticles(ip, false)} disabled={articleLoading} className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 disabled:opacity-50">
              {articleLoading ? "불러오는 중..." : "기사 더보기"}
            </button>
          ) : null}
          {loading ? <span className="text-xs text-slate-500">대시보드 집계 중...</span> : null}
          {health?.scheduler_running === false ? <span className="text-xs font-semibold text-red-600">수집 스케줄러 상태 확인 필요</span> : null}
        </div>
      </section>
    </main>
  );
}
