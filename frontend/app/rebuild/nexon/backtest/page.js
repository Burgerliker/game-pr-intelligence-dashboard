"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import ApiGuardBanner from "../../../../components/ApiGuardBanner";
import PageStatusView from "../../../../components/PageStatusView";
import { apiGet } from "../../../../lib/api";
import { normalizeBacktestPayload } from "../../../../lib/normalizeBacktest";
import {
  buildDiagnosticScope,
  shouldShowEmptyState,
  toRequestErrorState,
} from "../../../../lib/pageStatus";
import {
  navButtonSx,
  pageContainerSx,
  pageShellSx,
  panelPaperSx,
  sectionCardSx,
  statusChipSx,
} from "../../../../lib/uiTokens";

const FIXED_PARAMS = {
  ip: "maplestory",
  date_from: "2025-11-01",
  date_to: "2026-02-10",
  step_hours: "6",
};
const FIXED_CASE = "메이플 키우기 확률형 이슈";
const BURST_START = "2026-01-28T00:00:00";
const BURST_END = "2026-01-29T23:59:59";
const DIAG_SCOPE = {
  data: buildDiagnosticScope("NEX-BACKTEST", "DATA"),
};

function toDriverLabel(code) {
  const key = String(code || "").trim().toUpperCase();
  if (key === "S") return "기사량";
  if (key === "V") return "확산도";
  if (key === "T") return "테마강도";
  if (key === "M") return "변동성";
  return "-";
}

function toEventLabel(code) {
  const key = String(code || "").trim().toLowerCase();
  if (key === "p1_enter") return "고위험 진입";
  if (key === "p1_exit") return "고위험 해제";
  if (key === "p2_enter") return "주의 진입";
  if (key === "p2_exit") return "주의 해제";
  return "이벤트";
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
          fallback: "과거 분석 데이터를 불러오지 못했습니다.",
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
  const modeMismatchWarning = health?.mode === "live" ? "현재 과거 분석 데이터를 참조 중입니다." : "";
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
      legend: { top: 6, data: ["위기 지수", "관측 이벤트", "보도량", "기사량", "확산도", "테마강도", "변동성"] },
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "cross" },
        formatter: (params) => {
          if (!Array.isArray(params) || !params.length) return "";
          const ts = params[0].axisValue;
          const d = detailsByTs.get(String(ts));
          const lines = [`<strong>${ts}</strong>`];
          if (d) {
            lines.push(`위기 지수: ${Number(d.risk_score || 0).toFixed(1)}`);
            lines.push(`즉시 반응 점수: ${Number(d.raw_risk || 0).toFixed(1)}`);
            lines.push(`완화 반영 점수: ${Number(d.risk_score_ema || d.risk_score || 0).toFixed(1)}`);
            lines.push(`해당 구간 기사 수: ${Number(d.article_count_window || d.article_count || 0).toLocaleString()}건`);
            lines.push(`확산 강도: ${Number(d.spread_ratio || 0).toFixed(2)}`);
            lines.push(`신호 불확실도: ${Number(d.uncertain_ratio || 0).toFixed(2)}`);
          }
          params.filter((p) => p.seriesName === "관측 이벤트").forEach((p) => {
            lines.push(`${p.marker} ${p.data?.name || "이벤트 발생"}`);
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
        { type: "value", name: "위기 지수", min: 0, max: 100 },
        { type: "value", name: "보도량", gridIndex: 1, min: 0 },
        { type: "value", name: "영향도", gridIndex: 2, min: 0, max: 1.2 },
      ],
      dataZoom: [
        { type: "inside", xAxisIndex: [0, 1, 2], filterMode: "none" },
        { type: "slider", xAxisIndex: [0, 1, 2], bottom: 0, height: 20, filterMode: "none" },
      ],
      series: [
        { name: "위기 지수", type: "line", smooth: true, symbol: "none", sampling: "lttb", progressive: 2500, progressiveThreshold: 3200, data: normalized.risk, lineStyle: { width: 2.5, color: "#113f95" }, markLine: { symbol: ["none", "none"], label: { formatter: "{b}: {c}" }, lineStyle: { type: "dashed" }, data: [{ name: "경보선(높음)", yAxis: normalized.thresholds.p1, lineStyle: { color: "#dc3c4a" } }, { name: "경보선(주의)", yAxis: normalized.thresholds.p2, lineStyle: { color: "#e89c1c" } }] }, markArea: { itemStyle: { color: "rgba(220,60,74,0.12)" }, data: [[{ xAxis: BURST_START }, { xAxis: BURST_END }]] } },
        { name: "관측 이벤트", type: "scatter", data: eventScatter.map((e) => ({ ...e, name: toEventLabel(e.eventType) })), symbolSize: 10, itemStyle: { color: "#d32f2f" }, tooltip: { trigger: "item" } },
        { name: "보도량", type: "bar", xAxisIndex: 1, yAxisIndex: 1, data: normalized.volume, itemStyle: { color: "rgba(17,63,149,0.45)" }, barMaxWidth: 12, large: normalized.volume.length > 240, largeThreshold: 240, progressive: 2500, progressiveThreshold: 3200 },
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
    <Box sx={{ ...pageShellSx, py: { xs: 2, md: 3 } }}>
      <Container maxWidth="xl" sx={pageContainerSx}>
        <Stack spacing={1.5}>

          {/* Nav bar */}
          <Paper
            sx={{
              ...panelPaperSx,
              bgcolor: "#f8fafc",
              borderColor: "#e5e7eb",
              boxShadow: "0 8px 24px rgba(15,23,42,.04)",
              position: "sticky",
              top: 10,
              zIndex: 20,
            }}
          >
            <Stack
              direction={{ xs: "column", sm: "row" }}
              justifyContent="space-between"
              alignItems={{ xs: "flex-start", sm: "center" }}
              flexWrap="wrap"
              spacing={1}
              sx={{ px: 1.5, py: 0.75 }}
            >
              <Stack direction="row" flexWrap="wrap" spacing={1} useFlexGap>
                <Chip size="small" variant="outlined" label="대상 게임: 메이플스토리" sx={statusChipSx} />
                <Chip size="small" variant="outlined" label={`시나리오: ${FIXED_CASE}`} sx={statusChipSx} />
                <Chip size="small" variant="outlined" label="분석 기간: 2025-11-01 ~ 2026-02-10" sx={statusChipSx} />
                <Chip size="small" variant="outlined" label="집계 단위: 6시간" sx={statusChipSx} />
              </Stack>
              <Stack direction="row" spacing={1}>
                <Button component={Link} href="/rebuild/nexon" variant="outlined" size="small" sx={navButtonSx}>넥슨 대시보드</Button>
                <Button component={Link} href="/rebuild" variant="outlined" size="small" sx={navButtonSx}>메인</Button>
              </Stack>
            </Stack>
          </Paper>

          <ApiGuardBanner />

          {/* Main card */}
          <Card variant="outlined" sx={sectionCardSx}>
            <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
              <Typography variant="h6" sx={{ fontWeight: 800, mb: 0.5 }}>
                과거 분석 타임라인
              </Typography>
              <Typography variant="body2" sx={{ mb: 1.5, color: "#64748b" }}>
                메이플 키우기 이슈 기간에 위기 지수가 어떻게 변화했는지 재현한 화면입니다.
              </Typography>

              <Stack direction="row" flexWrap="wrap" spacing={1} useFlexGap sx={{ mb: 1.5 }}>
                <Chip size="small" variant="outlined" label={`DB: ${dbLabel}`} sx={{ ...statusChipSx, fontSize: 12 }} />
                <Chip size="small" variant="outlined" label={`Backend: ${health?.ok ? "healthy" : "unknown"}`} sx={{ ...statusChipSx, fontSize: 12 }} />
              </Stack>

              {modeMismatchWarning ? (
                <Alert severity="warning" icon={false} sx={{ mb: 1.5, borderRadius: 2 }}>{modeMismatchWarning}</Alert>
              ) : null}

              <Alert severity="info" icon={false} sx={{ mb: 1.5, borderRadius: 2 }}>
                읽는 순서: 1) 최대·평균 위기 지수 확인 2) 상단 선 그래프로 급등 시점 확인 3) 아래 보도량/영향도 그래프로 원인 파악
              </Alert>

              <PageStatusView
                loading={{ show: loading, title: "과거 분석 데이터를 불러오는 중", subtitle: "위기 지수 타임라인을 계산하고 있습니다." }}
                error={{
                  show: Boolean(error),
                  title: "과거 분석 데이터를 불러오지 못했습니다.",
                  details: `${String(error)}\n시스템 연동 상태를 확인해주세요.`,
                  diagnosticCode: errorCode,
                  actionLabel: "다시 시도",
                  onAction: () => setReloadSeq((prev) => prev + 1),
                }}
              />

              <PageStatusView
                empty={{
                  show: shouldShowBacktestEmpty,
                  title: "과거 분석 데이터가 없습니다.",
                  subtitle: "분석 데이터가 아직 없습니다. 잠시 후 다시 확인해주세요.",
                }}
              />

              {!shouldShowBacktestEmpty && !error && hasSeries ? (
                <>
                  <Stack direction="row" flexWrap="wrap" spacing={1} useFlexGap sx={{ mt: 1.5 }}>
                    <Chip
                      label={`최대 위기 지수: ${Number(payload?.summary?.max_risk || 0).toFixed(1)}`}
                      color="error"
                      variant="outlined"
                      sx={statusChipSx}
                    />
                    <Chip
                      label={`평균 위기 지수: ${Number(payload?.summary?.avg_risk || 0).toFixed(1)}`}
                      variant="outlined"
                      sx={statusChipSx}
                    />
                    <Chip
                      label={`고위험 구간 수: ${Number((payload?.summary?.p1_bucket_count ?? payload?.summary?.p1_count) || 0)}`}
                      color="error"
                      variant="outlined"
                      sx={statusChipSx}
                    />
                    <Chip
                      label={`주의 구간 수: ${Number((payload?.summary?.p2_bucket_count ?? payload?.summary?.p2_count) || 0)}`}
                      color="warning"
                      variant="outlined"
                      sx={statusChipSx}
                    />
                    <Chip
                      label={`이벤트 수: ${Number(payload?.summary?.event_count || 0)}`}
                      variant="outlined"
                      sx={statusChipSx}
                    />
                    <Chip
                      label={`주요 요인: ${toDriverLabel(payload?.summary?.dominant_component)}`}
                      variant="outlined"
                      sx={statusChipSx}
                    />
                  </Stack>
                  <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
                    고위험/주의 구간 수는 각 기준선을 넘긴 시간대의 횟수입니다. 하루에 여러 번 발생할 수 있습니다.
                  </Typography>
                  <Box ref={chartRef} sx={{ mt: 1.5, width: "100%", height: "clamp(560px, 55vw, 700px)" }} />
                  <Stack
                    direction={{ xs: "column", sm: "row" }}
                    spacing={1.2}
                    useFlexGap
                    flexWrap="wrap"
                    sx={{ mt: 1.5 }}
                  >
                    {[
                      { label: "기사량 영향", latest: driverStats.volume.latest.toLocaleString(), peak: driverStats.volume.peak.toLocaleString() },
                      { label: "확산 영향", latest: driverStats.spread.latest.toFixed(3), peak: driverStats.spread.peak.toFixed(3) },
                      { label: "불확실 신호 영향", latest: driverStats.uncertain.latest.toFixed(3), peak: driverStats.uncertain.peak.toFixed(3) },
                    ].map((d) => (
                      <Paper key={d.label} variant="outlined" sx={{ ...panelPaperSx, p: 1.2, flex: "1 1 180px", minWidth: 0 }}>
                        <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.25 }}>{d.label}</Typography>
                        <Typography variant="caption" color="text.secondary">최근 {d.latest} · 최고 {d.peak}</Typography>
                      </Paper>
                    ))}
                  </Stack>
                  <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
                    하단 영향도 선은 위기 지수 변동의 원인 비중을 보여줍니다. 값이 클수록 해당 요인의 영향이 큽니다.
                  </Typography>
                </>
              ) : null}
            </CardContent>
          </Card>
        </Stack>
      </Container>
    </Box>
  );
}
