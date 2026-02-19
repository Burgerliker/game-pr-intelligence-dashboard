"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import ApiGuardBanner from "../../../../components/ApiGuardBanner";
import PageStatusView from "../../../../components/PageStatusView";
import { apiGet } from "../../../../lib/api";
import { normalizeBacktestPayload } from "../../../../lib/normalizeBacktest";
import { buildDiagnosticScope, shouldShowEmptyState, toRequestErrorState } from "../../../../lib/pageStatus";

const FIXED_PARAMS = {
  ip: "maplestory",
  date_from: "2025-11-01",
  date_to: "2026-02-10",
  step_hours: "6",
};
const FIXED_CASE = "maple_idle_probability_2026";
const BURST_START = "2026-01-28T00:00:00";
const BURST_END = "2026-01-29T23:59:59";
const SHOW_BACKTEST = process.env.NEXT_PUBLIC_SHOW_BACKTEST === "true";
const DIAG_SCOPE = {
  data: buildDiagnosticScope("NEX-BACKTEST", "DATA"),
};
const ACTION_LINK =
  "inline-flex min-h-11 touch-manipulation items-center rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2";

export default function NexonRebuildBacktestPage() {
  const chartRef = useRef<HTMLDivElement | null>(null);
  const chartInstRef = useRef<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [errorCode, setErrorCode] = useState("");
  const [payload, setPayload] = useState<any>(null);
  const [health, setHealth] = useState<any>(null);
  const [reloadSeq, setReloadSeq] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const run = async () => {
      setLoading(true);
      setError("");
      setErrorCode("");
      try {
        const qs = new URLSearchParams(FIXED_PARAMS);
        const [backtest, healthRes] = await Promise.all([
          apiGet(`/api/backtest?${qs.toString()}`, { signal: controller.signal }),
          apiGet("/api/backtest-health", { signal: controller.signal }).catch(() => null),
        ]);
        if (controller.signal.aborted) return;
        setPayload(backtest);
        setHealth(healthRes);
      } catch (e: any) {
        if (e?.name === "AbortError") return;
        const nextError = toRequestErrorState(e, {
          scope: DIAG_SCOPE.data,
          fallback: "백테스트 데이터를 불러오지 못했습니다.",
        });
        setError(nextError.message);
        setErrorCode(nextError.code);
      } finally {
        setLoading(false);
      }
    };
    run();
    return () => controller.abort();
  }, [reloadSeq]);

  const normalized = useMemo(() => normalizeBacktestPayload(payload), [payload]);
  const hasSeries = normalized.timestamps.length > 0;
  const shouldShowBacktestEmpty = shouldShowEmptyState({ loading, error, hasData: hasSeries });
  const dbLabel = health?.db_file_name || health?.db_path || "-";
  const modeMismatchWarning = health?.mode === "live" ? "현재 백테스트 페이지가 운영 DB를 참조 중입니다." : "";

  const detailsByTs = useMemo(() => {
    const out = new Map<string, any>();
    for (const row of payload?.timeseries || []) {
      const ts = String(row.ts || row.timestamp || "");
      if (!ts) continue;
      out.set(ts, row);
    }
    return out;
  }, [payload?.timeseries]);

  useEffect(() => {
    if (!hasSeries || !chartRef.current || chartInstRef.current) return;
    let active = true;
    let resizeHandler: (() => void) | null = null;

    const mount = async () => {
      const echarts = await import("echarts");
      if (!active || !chartRef.current || chartInstRef.current) return;
      const chart = echarts.init(chartRef.current);
      chartInstRef.current = chart;
      resizeHandler = () => chart.resize();
      window.addEventListener("resize", resizeHandler);
    };

    mount();
    return () => {
      active = false;
      if (resizeHandler) window.removeEventListener("resize", resizeHandler);
    };
  }, [hasSeries]);

  useEffect(() => {
    if (!hasSeries || !chartInstRef.current) return;

    const eventScatter = normalized.events.map((e) => ({ value: [e.ts, e.risk_at_ts], name: e.label, eventType: e.type }));
    chartInstRef.current.setOption(
      {
        animation: false,
        legend: { top: 6, data: ["Risk", "Events", "Volume", "S", "V", "T", "M"] },
        tooltip: {
          trigger: "axis",
          axisPointer: { type: "cross" },
          formatter: (params: any[]) => {
            if (!Array.isArray(params) || !params.length) return "";
            const ts = params[0].axisValue;
            const d = detailsByTs.get(String(ts));
            const lines = [`<strong>${ts}</strong>`];
            if (d) {
              lines.push(`위험도: ${Number(d.risk_score || 0).toFixed(1)}`);
              lines.push(`원시 점수(raw): ${Number(d.raw_risk || 0).toFixed(1)}`);
              lines.push(`EMA 적용값: ${Number(d.risk_score_ema || d.risk_score || 0).toFixed(1)}`);
              lines.push(`기사 수: ${Number(d.article_count_window || d.article_count || 0).toLocaleString()}건`);
              lines.push(`확산도: ${Number(d.spread_ratio || 0).toFixed(2)}`);
              lines.push(`불확실도: ${Number(d.uncertain_ratio || 0).toFixed(2)}`);
            }
            params.filter((p: any) => p.seriesName === "Events").forEach((p: any) => {
              lines.push(`${p.marker} 이벤트: ${p.data?.name || "EVENT"} (${p.data?.eventType || "event"})`);
            });
            return lines.join("<br/>");
          },
        },
        grid: [
          { left: 64, right: 28, top: 48, height: 240 },
          { left: 64, right: 28, top: 328, height: 110 },
          { left: 64, right: 28, top: 474, height: 170 },
        ],
        xAxis: [
          { type: "category", data: normalized.timestamps, axisLabel: { hideOverlap: true, formatter: (v: string) => String(v || "").slice(5, 16) } },
          { type: "category", data: normalized.timestamps, gridIndex: 1, axisLabel: { show: false } },
          { type: "category", data: normalized.timestamps, gridIndex: 2, axisLabel: { hideOverlap: true, formatter: (v: string) => String(v || "").slice(5, 16) } },
        ],
        yAxis: [
          { type: "value", name: "Risk", min: 0, max: 100 },
          { type: "value", name: "Volume", gridIndex: 1, min: 0 },
          { type: "value", name: "요소 기여도", gridIndex: 2, min: 0, max: 1.2 },
        ],
        dataZoom: [
          { type: "inside", xAxisIndex: [0, 1, 2], filterMode: "none" },
          { type: "slider", xAxisIndex: [0, 1, 2], bottom: 0, height: 18, filterMode: "none" },
        ],
        series: [
          {
            name: "Risk",
            type: "line",
            smooth: true,
            symbol: "none",
            data: normalized.risk,
            lineStyle: { width: 2.5, color: "#1d4ed8" },
            markLine: {
              symbol: ["none", "none"],
              lineStyle: { type: "dashed" },
              data: [
                { name: "P1", yAxis: normalized.thresholds.p1, lineStyle: { color: "#dc2626" } },
                { name: "P2", yAxis: normalized.thresholds.p2, lineStyle: { color: "#f59e0b" } },
              ],
            },
            markArea: { itemStyle: { color: "rgba(220,38,38,0.12)" }, data: [[{ xAxis: BURST_START }, { xAxis: BURST_END }]] },
          },
          { name: "Events", type: "scatter", data: eventScatter, symbolSize: 10, itemStyle: { color: "#dc2626" } },
          { name: "Volume", type: "bar", xAxisIndex: 1, yAxisIndex: 1, data: normalized.volume, itemStyle: { color: "rgba(37,99,235,0.45)" }, barMaxWidth: 12 },
          ...(["S", "V", "T", "M"] as const).map((k) => ({ name: k, type: "line", xAxisIndex: 2, yAxisIndex: 2, stack: "svtm", smooth: true, symbol: "none", areaStyle: { opacity: 0.2 }, data: normalized.svtm[k] })),
        ],
      },
      { notMerge: true, lazyUpdate: true }
    );
  }, [detailsByTs, hasSeries, normalized]);

  useEffect(
    () => () => {
      chartInstRef.current?.dispose?.();
      chartInstRef.current = null;
    },
    []
  );

  if (!SHOW_BACKTEST) {
    return (
      <main className="min-h-screen bg-slate-100 px-3 py-8 md:px-6 [font-family:'Plus_Jakarta_Sans','Pretendard','Noto_Sans_KR',sans-serif]">
        <div className="mx-auto max-w-[1200px] rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">
          운영 모드에서는 Backtest 페이지를 비활성화했습니다.
        </div>
      </main>
    );
  }

  return (
    <main
      className="relative min-h-screen overflow-hidden bg-[#f4f8ff] px-3 py-4 md:px-6 md:py-8 [font-family:'Plus_Jakarta_Sans','Pretendard','Noto_Sans_KR',sans-serif]"
      style={{ WebkitTapHighlightColor: "transparent" }}
    >
      <div className="pointer-events-none absolute inset-0 opacity-60" aria-hidden="true">
        <div className="absolute -left-24 -top-24 h-80 w-80 rounded-full bg-cyan-200/40 blur-3xl" />
        <div className="absolute right-0 top-1/3 h-96 w-96 rounded-full bg-amber-200/30 blur-3xl" />
      </div>
      <div className="relative mx-auto max-w-[1280px] space-y-4">
        <a
          href="#rebuild-backtest-main"
          className="sr-only rounded-md bg-white px-3 py-2 text-sm font-semibold text-slate-900 focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50"
        >
          메인 콘텐츠로 이동
        </a>
        <section className="rounded-3xl border border-slate-200/80 bg-white/90 p-4 shadow-[0_24px_56px_-28px_rgba(15,23,42,0.35)] backdrop-blur">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-semibold tracking-[0.16em] text-slate-500">NEXON REBUILD BACKTEST</p>
              <h1 className="text-4xl [font-family:'Sora','SUIT','Noto_Sans_KR',sans-serif] font-black leading-none tracking-tight text-slate-900 md:text-5xl">백테스트 타임라인</h1>
              <p className="mt-1 text-sm text-slate-500">maplestory 내부 이슈(case: {FIXED_CASE}) 기준 리스크 반응</p>
            </div>
            <div className="flex flex-wrap gap-2 text-sm">
              <Link href="/nexon/rebuild" className={ACTION_LINK}>넥슨 대시보드</Link>
              <Link href="/" className={ACTION_LINK}>메인</Link>
            </div>
          </div>
        </section>

        <ApiGuardBanner />

        <section id="rebuild-backtest-main" className="rounded-3xl border border-slate-200 bg-white p-4 shadow-[0_20px_40px_-24px_rgba(15,23,42,0.45)]">
          <div className="mb-3 flex flex-wrap gap-2 text-xs font-semibold tabular-nums text-slate-600">
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1">IP: maplestory</span>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1">Case: {FIXED_CASE}</span>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1">Period: 2025-11-01 ~ 2026-02-10</span>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1">Step: 6h</span>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1">DB: {dbLabel}</span>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1">Backend: {health?.ok ? "healthy" : "unknown"}</span>
          </div>

          {modeMismatchWarning ? <p className="mb-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">{modeMismatchWarning}</p> : null}
          <p className="mb-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-700">
            백테스트는 임계치 기반 이벤트(히스테리시스 없음)로 계산합니다. 실시간 모드는 집중 수집 전환 로직을 사용합니다.
          </p>

          <PageStatusView
            loading={{ show: loading, title: "백테스트 로딩 중", subtitle: "리스크 타임라인을 계산하고 있습니다." }}
            error={{
              show: Boolean(error),
              title: "백테스트 데이터를 불러오지 못했습니다.",
              details: `${String(error)}\nPR_DB_PATH 및 백엔드 실행 상태를 확인해주세요.`,
              diagnosticCode: errorCode,
              actionLabel: "재시도",
              onAction: () => setReloadSeq((x) => x + 1),
            }}
            empty={{
              show: shouldShowBacktestEmpty,
              title: "백테스트 데이터가 없습니다.",
              subtitle: "선택된 구간에 타임라인 데이터가 존재하지 않습니다.",
            }}
          />

          {hasSeries ? <div ref={chartRef} className="mt-3 h-[680px] w-full rounded-xl border border-slate-200 bg-white" style={{ contentVisibility: "auto", containIntrinsicSize: "680px" }} /> : null}
        </section>
      </div>
    </main>
  );
}
