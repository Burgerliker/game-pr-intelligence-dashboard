"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import ApiGuardBanner from "../../../components/ApiGuardBanner";
import PageStatusView from "../../../components/PageStatusView";
import { apiGet } from "../../../lib/api";
import { normalizeBacktestPayload } from "../../../lib/normalizeBacktest";
import {
  buildDiagnosticScope,
  shouldShowEmptyState,
  toRequestErrorState,
} from "../../../lib/pageStatus";

const FIXED_PARAMS = {
  ip: "maplestory",
  date_from: "2025-11-01",
  date_to: "2026-02-10",
  step_hours: "6",
};
const FIXED_CASE = "maple_idle_probability_2026";
const BURST_START = "2026-01-28T00:00:00";
const BURST_END = "2026-01-29T23:59:59";
const DIAG_SCOPE = {
  data: buildDiagnosticScope("NEX-BACKTEST", "DATA"),
};

const SHELL = { minHeight: "100dvh", backgroundColor: "#eef0f3", fontFamily: "'Plus Jakarta Sans','Noto Sans KR','Apple SD Gothic Neo',sans-serif", paddingTop: 16, paddingBottom: 48 };
const CONTAINER = { maxWidth: 1180, margin: "0 auto", padding: "0 16px" };
const PANEL = { borderRadius: 17.6, border: "1px solid rgba(15,23,42,.12)", backgroundColor: "#ffffff" };
const CARD = { borderRadius: 24, border: "1px solid rgba(15,23,42,.1)", backgroundColor: "#ffffff", boxShadow: "0 12px 28px rgba(15,23,42,.06)" };
const NAV_BTN = { display: "inline-flex", alignItems: "center", justifyContent: "center", textDecoration: "none", minHeight: 40, padding: "0 12px", borderRadius: 9999, border: "1px solid rgba(15,23,42,.24)", fontSize: 14, fontWeight: 700, backgroundColor: "transparent", color: "#0f172a", cursor: "pointer" };
const STATUS_CHIP = { display: "inline-flex", alignItems: "center", minHeight: 30, padding: "0 12px", borderRadius: 9999, border: "1px solid #e2e8f0", backgroundColor: "#ffffff", fontSize: 13, fontWeight: 700, whiteSpace: "nowrap" };
const CHIP_ERROR = { display: "inline-flex", alignItems: "center", minHeight: 30, padding: "0 12px", borderRadius: 9999, border: "1px solid #fecaca", backgroundColor: "#fff4f4", color: "#b91c1c", fontSize: 13, fontWeight: 700, whiteSpace: "nowrap" };
const CHIP_WARNING = { display: "inline-flex", alignItems: "center", minHeight: 30, padding: "0 12px", borderRadius: 9999, border: "1px solid #f6d596", backgroundColor: "#fff8eb", color: "#d97706", fontSize: 13, fontWeight: 700, whiteSpace: "nowrap" };
const ALERT_INFO = { display: "flex", alignItems: "flex-start", gap: 8, padding: "10px 14px", borderRadius: 8, border: "1px solid #bfdbfe", backgroundColor: "#eff6ff", color: "#1e3a8a", fontSize: 13, lineHeight: 1.5 };
const ALERT_WARNING = { display: "flex", alignItems: "flex-start", gap: 8, padding: "10px 14px", borderRadius: 8, border: "1px solid #f6d596", backgroundColor: "#fff8eb", color: "#8a5700", fontSize: 13, lineHeight: 1.5 };

function toDriverLabel(code) {
  const key = String(code || "").trim().toUpperCase();
  if (key === "S") return "기사량";
  if (key === "V") return "확산도";
  if (key === "T") return "테마강도";
  if (key === "M") return "변동성";
  return "-";
}

export default function NexonBacktestPage() {
  const chartRef = useRef(null);
  const chartInstRef = useRef(null);
  const resizeObserverRef = useRef(null);
  const resizeHandlerRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [errorCode, setErrorCode] = useState("");
  const [payload, setPayload] = useState(null);
  const [health, setHealth] = useState(null);
  const [reloadSeq, setReloadSeq] = useState(0);
  const [chartReady, setChartReady] = useState(false);

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
      } catch (e) {
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
  const dbLabel = health?.db_file_name || health?.db_path || "-";
  const modeMismatchWarning = health?.mode === "live" ? "현재 백테스트 페이지가 운영 DB를 참조 중입니다." : "";
  const shouldShowBacktestEmpty = shouldShowEmptyState({ loading, error, hasData: hasSeries });
  const detailsByTs = useMemo(() => {
    const out = new Map();
    for (const row of payload?.timeseries || []) {
      const ts = String(row.ts || row.timestamp || "");
      if (!ts) continue;
      out.set(ts, row);
    }
    return out;
  }, [payload?.timeseries]);
  const driverStats = useMemo(() => {
    const rows = payload?.timeseries || [];
    if (!rows.length) {
      return { volume: { latest: 0, peak: 0 }, spread: { latest: 0, peak: 0 }, uncertain: { latest: 0, peak: 0 } };
    }
    const latest = rows[rows.length - 1];
    return {
      volume: {
        latest: Number(latest.article_count_window ?? latest.article_count ?? 0),
        peak: Math.max(...rows.map((r) => Number(r.article_count_window ?? r.article_count ?? 0))),
      },
      spread: {
        latest: Number(latest.spread_ratio ?? 0),
        peak: Math.max(...rows.map((r) => Number(r.spread_ratio ?? 0))),
      },
      uncertain: {
        latest: Number(latest.uncertain_ratio ?? 0),
        peak: Math.max(...rows.map((r) => Number(r.uncertain_ratio ?? 0))),
      },
    };
  }, [payload?.timeseries]);

  useEffect(() => {
    if (!hasSeries || !chartRef.current || chartInstRef.current) return;
    let active = true;
    const mount = async () => {
      const echarts = await import("echarts");
      if (!active || !chartRef.current || chartInstRef.current) return;
      const chart = echarts.init(chartRef.current);
      chartInstRef.current = chart;
      setChartReady(true);
      resizeObserverRef.current = new ResizeObserver(() => { chart.resize(); });
      resizeObserverRef.current.observe(chartRef.current);
      resizeHandlerRef.current = () => chart.resize();
      window.addEventListener("resize", resizeHandlerRef.current);
    };
    mount();
    return () => { active = false; };
  }, [hasSeries]);

  useEffect(() => {
    if (!hasSeries || !chartReady || !chartInstRef.current) return;
    const eventScatter = normalized.events.map((e) => ({ value: [e.ts, e.risk_at_ts], name: e.label, eventType: e.type }));
    const option = {
      animation: false,
      backgroundColor: "#ffffff",
      legend: { top: 6, data: ["위험도", "이벤트", "노출량", "기사량", "확산도", "테마강도", "변동성"] },
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "cross" },
        formatter: (params) => {
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
          params.filter((p) => p.seriesName === "Events").forEach((p) => {
            lines.push(`${p.marker} 이벤트: ${p.data?.name || "EVENT"} (${p.data?.eventType || "event"})`);
          });
          return lines.join("<br/>");
        },
      },
      grid: [
        { left: 64, right: 32, top: 50, height: 260 },
        { left: 64, right: 32, top: 350, height: 120 },
        { left: 64, right: 32, top: 510, height: 190 },
      ],
      xAxis: [
        { type: "category", data: normalized.timestamps, axisLabel: { hideOverlap: true, formatter: (value) => { const s = String(value || ""); return s.length >= 16 ? `${s.slice(5, 10)} ${s.slice(11, 16)}` : s; } } },
        { type: "category", data: normalized.timestamps, gridIndex: 1, axisLabel: { show: false } },
        { type: "category", data: normalized.timestamps, gridIndex: 2, axisLabel: { rotate: 0, hideOverlap: true, formatter: (value) => { const s = String(value || ""); return s.length >= 16 ? `${s.slice(5, 10)} ${s.slice(11, 16)}` : s; } } },
      ],
      yAxis: [
        { type: "value", name: "위험도", min: 0, max: 100 },
        { type: "value", name: "노출량", gridIndex: 1, min: 0 },
        { type: "value", name: "요소 기여도", gridIndex: 2, min: 0, max: 1.2 },
      ],
      dataZoom: [
        { type: "inside", xAxisIndex: [0, 1, 2], filterMode: "none" },
        { type: "slider", xAxisIndex: [0, 1, 2], bottom: 0, height: 20, filterMode: "none" },
      ],
      series: [
        { name: "위험도", type: "line", smooth: true, symbol: "none", sampling: "lttb", progressive: 2500, progressiveThreshold: 3200, data: normalized.risk, lineStyle: { width: 2.5, color: "#113f95" }, markLine: { symbol: ["none", "none"], label: { formatter: "{b}: {c}" }, lineStyle: { type: "dashed" }, data: [{ name: "고위험 기준선", yAxis: normalized.thresholds.p1, lineStyle: { color: "#dc3c4a" } }, { name: "주의 기준선", yAxis: normalized.thresholds.p2, lineStyle: { color: "#e89c1c" } }] }, markArea: { itemStyle: { color: "rgba(220,60,74,0.12)" }, data: [[{ xAxis: BURST_START }, { xAxis: BURST_END }]] } },
        { name: "이벤트", type: "scatter", data: eventScatter, symbolSize: 10, itemStyle: { color: "#d32f2f" }, tooltip: { trigger: "item" } },
        { name: "노출량", type: "bar", xAxisIndex: 1, yAxisIndex: 1, data: normalized.volume, itemStyle: { color: "rgba(17,63,149,0.45)" }, barMaxWidth: 12, large: normalized.volume.length > 240, largeThreshold: 240, progressive: 2500, progressiveThreshold: 3200 },
        ...[
          ["S", "기사량"],
          ["V", "확산도"],
          ["T", "테마강도"],
          ["M", "변동성"],
        ].map(([k, label]) => ({ name: label, type: "line", xAxisIndex: 2, yAxisIndex: 2, stack: "drivers", smooth: true, symbol: "none", sampling: "lttb", progressive: 2500, progressiveThreshold: 3200, areaStyle: { opacity: 0.22 }, data: normalized.svtm[k] })),
      ],
    };
    chartInstRef.current.setOption(option, { notMerge: true, lazyUpdate: true });
  }, [chartReady, detailsByTs, hasSeries, normalized]);

  useEffect(
    () => () => {
      resizeObserverRef.current?.disconnect();
      if (resizeHandlerRef.current) window.removeEventListener("resize", resizeHandlerRef.current);
      chartInstRef.current?.dispose();
      chartInstRef.current = null;
      setChartReady(false);
    },
    []
  );

  return (
    <div style={SHELL}>
      <div style={CONTAINER}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

          {/* Nav bar */}
          <div style={{ ...PANEL, padding: "0 12px", position: "sticky", top: 10, zIndex: 20, backgroundColor: "#f8fafc", borderColor: "#e5e7eb", boxShadow: "0 8px 24px rgba(15,23,42,.04)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, padding: "6px 0" }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                <span style={STATUS_CHIP}>IP: maplestory</span>
                <span style={STATUS_CHIP}>Case: {FIXED_CASE}</span>
                <span style={STATUS_CHIP}>Period: 2025-11-01 ~ 2026-02-10</span>
                <span style={STATUS_CHIP}>Step: 6h</span>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <Link href="/nexon" style={NAV_BTN}>넥슨 대시보드</Link>
                <Link href="/" style={NAV_BTN}>메인</Link>
              </div>
            </div>
          </div>

          <ApiGuardBanner />

          {/* Main card */}
          <div style={{ ...CARD, padding: "16px" }}>
            <h2 style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 800 }}>백테스트 타임라인</h2>
            <p style={{ margin: "0 0 10px", fontSize: 14, color: "#64748b" }}>
              과거 데이터로 "그 시점에 위험도가 어떻게 움직였는지"를 재계산한 결과입니다.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
              <span style={{ ...STATUS_CHIP, fontSize: 12 }}>DB: {dbLabel}</span>
              <span style={{ ...STATUS_CHIP, fontSize: 12 }}>Backend: {health?.ok ? "healthy" : "unknown"}</span>
            </div>
            {modeMismatchWarning ? (
              <div style={{ ...ALERT_WARNING, marginBottom: 12 }}>{modeMismatchWarning}</div>
            ) : null}
            <div style={{ ...ALERT_INFO, marginBottom: 12 }}>
              읽는 순서: 1) 위 칩에서 최대/평균 위험도 확인 → 2) 차트 상단 위험도 선으로 급등 시점 확인 → 3) 하단 노출량/요인선으로 급등 원인 확인
            </div>

            <div style={{ marginTop: 8 }}>
              <PageStatusView
                loading={{ show: loading, title: "백테스트 로딩 중", subtitle: "리스크 타임라인을 계산하고 있습니다." }}
                error={{
                  show: Boolean(error),
                  title: "백테스트 데이터를 불러오지 못했습니다.",
                  details: `${String(error)}\nPR_DB_PATH 및 백엔드 실행 상태를 확인해주세요.`,
                  diagnosticCode: errorCode,
                  actionLabel: "다시 시도",
                  onAction: () => setReloadSeq((prev) => prev + 1),
                }}
              />
            </div>
            <div style={{ marginTop: 8 }}>
              <PageStatusView
                empty={{
                  show: shouldShowBacktestEmpty,
                  title: "백테스트 데이터가 없습니다.",
                  subtitle: "백엔드를 `PR_DB_PATH=backend/data/articles_backtest.db`로 실행했는지 확인하고, /health의 DB 배지를 확인해주세요.",
                }}
              />
            </div>

            {!shouldShowBacktestEmpty && !error && hasSeries ? (
              <>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
                  <span style={CHIP_ERROR}>최대 위험도: {Number(payload?.summary?.max_risk || 0).toFixed(1)}</span>
                  <span style={STATUS_CHIP}>평균 위험도: {Number(payload?.summary?.avg_risk || 0).toFixed(1)}</span>
                  <span style={CHIP_ERROR}>고위험 구간 수: {Number((payload?.summary?.p1_bucket_count ?? payload?.summary?.p1_count) || 0)}</span>
                  <span style={CHIP_WARNING}>주의 구간 수: {Number((payload?.summary?.p2_bucket_count ?? payload?.summary?.p2_count) || 0)}</span>
                  <span style={STATUS_CHIP}>이벤트 수: {Number(payload?.summary?.event_count || 0)}</span>
                  <span style={STATUS_CHIP}>주요 요인: {toDriverLabel(payload?.summary?.dominant_component)}</span>
                </div>
                <p style={{ margin: "8px 0 0", fontSize: 12, color: "#64748b" }}>
                  고위험/주의 구간 수는 위험도가 기준선을 넘었던 시간 구간 개수입니다. 같은 하루에도 여러 번 발생할 수 있습니다.
                </p>
                <div ref={chartRef} style={{ marginTop: 12, width: "100%", height: "clamp(560px, 55vw, 700px)" }} />
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 9.6, marginTop: 12 }}>
                  {[
                    { label: "볼륨 드라이버", latest: driverStats.volume.latest.toLocaleString(), peak: driverStats.volume.peak.toLocaleString() },
                    { label: "확산 드라이버", latest: driverStats.spread.latest.toFixed(3), peak: driverStats.spread.peak.toFixed(3) },
                    { label: "불확실 드라이버", latest: driverStats.uncertain.latest.toFixed(3), peak: driverStats.uncertain.peak.toFixed(3) },
                  ].map((d) => (
                    <div key={d.label} style={{ ...PANEL, padding: "9.6px 12px" }}>
                      <p style={{ margin: "0 0 2px", fontWeight: 700, fontSize: 14 }}>{d.label}</p>
                      <p style={{ margin: 0, color: "#64748b", fontSize: 13 }}>최근 {d.latest} · 최고 {d.peak}</p>
                    </div>
                  ))}
                </div>
                <p style={{ margin: "8px 0 0", fontSize: 12, color: "#64748b" }}>
                  하단 요인선은 위험도 구성요소입니다. 값이 클수록 해당 시점 위험도 상승에 더 크게 기여했다는 뜻입니다.
                </p>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
