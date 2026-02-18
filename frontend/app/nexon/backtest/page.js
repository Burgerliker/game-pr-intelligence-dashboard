"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Box, Button, Chip, Container, Paper, Stack, Typography } from "@mui/material";
import ApiGuardBanner from "../../../components/ApiGuardBanner";
import LoadingState from "../../../components/LoadingState";
import ErrorState from "../../../components/ErrorState";
import { apiGet, getErrorMessage } from "../../../lib/api";
import { normalizeBacktestPayload } from "../../../lib/normalizeBacktest";

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

export default function NexonBacktestPage() {
  const chartRef = useRef(null);
  const chartInstRef = useRef(null);
  const resizeObserverRef = useRef(null);
  const resizeHandlerRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [payload, setPayload] = useState(null);
  const [health, setHealth] = useState(null);
  const [reloadSeq, setReloadSeq] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const run = async () => {
      setLoading(true);
      setError("");
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
        setError(getErrorMessage(e, "백테스트 데이터를 불러오지 못했습니다."));
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
      return {
        volume: { latest: 0, peak: 0 },
        spread: { latest: 0, peak: 0 },
        uncertain: { latest: 0, peak: 0 },
      };
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
      resizeObserverRef.current = new ResizeObserver(() => {
        chart.resize();
      });
      resizeObserverRef.current.observe(chartRef.current);
      resizeHandlerRef.current = () => chart.resize();
      window.addEventListener("resize", resizeHandlerRef.current);
    };

    mount();
    return () => {
      active = false;
    };
  }, [hasSeries]);

  useEffect(() => {
    if (!hasSeries || !chartInstRef.current) return;
    const eventScatter = normalized.events.map((e) => ({
      value: [e.ts, e.risk_at_ts],
      name: e.label,
      eventType: e.type,
    }));
    const option = {
      animation: false,
      backgroundColor: "#ffffff",
      legend: {
        top: 6,
        data: ["Risk", "Events", "Volume", "S", "V", "T", "M"],
      },
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
          params
            .filter((p) => p.seriesName === "Events")
            .forEach((p) => {
              const name = p.data?.name || "EVENT";
              const evType = p.data?.eventType || "event";
              lines.push(`${p.marker} 이벤트: ${name} (${evType})`);
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
        {
          type: "category",
          data: normalized.timestamps,
          axisLabel: {
            hideOverlap: true,
            formatter: (value) => {
              const s = String(value || "");
              if (s.length >= 16) return `${s.slice(5, 10)} ${s.slice(11, 16)}`;
              return s;
            },
          },
        },
        {
          type: "category",
          data: normalized.timestamps,
          gridIndex: 1,
          axisLabel: { show: false },
        },
        {
          type: "category",
          data: normalized.timestamps,
          gridIndex: 2,
          axisLabel: {
            rotate: 0,
            hideOverlap: true,
            formatter: (value) => {
              const s = String(value || "");
              if (s.length >= 16) return `${s.slice(5, 10)} ${s.slice(11, 16)}`;
              return s;
            },
          },
        },
      ],
      yAxis: [
        {
          type: "value",
          name: "Risk",
          min: 0,
          max: 100,
        },
        {
          type: "value",
          name: "Volume",
          gridIndex: 1,
          min: 0,
        },
        {
          type: "value",
          name: "요소 기여도",
          gridIndex: 2,
          min: 0,
          max: 1.2,
        },
      ],
      dataZoom: [
        { type: "inside", xAxisIndex: [0, 1, 2], filterMode: "none" },
        { type: "slider", xAxisIndex: [0, 1, 2], bottom: 0, height: 20, filterMode: "none" },
      ],
      series: [
        {
          name: "Risk",
          type: "line",
          smooth: true,
          symbol: "none",
          sampling: "lttb",
          progressive: 2500,
          progressiveThreshold: 3200,
          data: normalized.risk,
          lineStyle: { width: 2.5, color: "#113f95" },
          markLine: {
            symbol: ["none", "none"],
            label: { formatter: "{b}: {c}" },
            lineStyle: { type: "dashed" },
            data: [
              { name: "P1", yAxis: normalized.thresholds.p1, lineStyle: { color: "#dc3c4a" } },
              { name: "P2", yAxis: normalized.thresholds.p2, lineStyle: { color: "#e89c1c" } },
            ],
          },
          markArea: {
            itemStyle: { color: "rgba(220,60,74,0.12)" },
            data: [[{ xAxis: BURST_START }, { xAxis: BURST_END }]],
          },
        },
        {
          name: "Events",
          type: "scatter",
          data: eventScatter,
          symbolSize: 10,
          itemStyle: { color: "#d32f2f" },
          tooltip: { trigger: "item" },
        },
        {
          name: "Volume",
          type: "bar",
          xAxisIndex: 1,
          yAxisIndex: 1,
          data: normalized.volume,
          itemStyle: { color: "rgba(17,63,149,0.45)" },
          barMaxWidth: 12,
          large: normalized.volume.length > 240,
          largeThreshold: 240,
          progressive: 2500,
          progressiveThreshold: 3200,
        },
        {
          name: "S",
          type: "line",
          xAxisIndex: 2,
          yAxisIndex: 2,
          stack: "svtm",
          smooth: true,
          symbol: "none",
          sampling: "lttb",
          progressive: 2500,
          progressiveThreshold: 3200,
          areaStyle: { opacity: 0.22 },
          data: normalized.svtm.S,
        },
        {
          name: "V",
          type: "line",
          xAxisIndex: 2,
          yAxisIndex: 2,
          stack: "svtm",
          smooth: true,
          symbol: "none",
          sampling: "lttb",
          progressive: 2500,
          progressiveThreshold: 3200,
          areaStyle: { opacity: 0.22 },
          data: normalized.svtm.V,
        },
        {
          name: "T",
          type: "line",
          xAxisIndex: 2,
          yAxisIndex: 2,
          stack: "svtm",
          smooth: true,
          symbol: "none",
          sampling: "lttb",
          progressive: 2500,
          progressiveThreshold: 3200,
          areaStyle: { opacity: 0.22 },
          data: normalized.svtm.T,
        },
        {
          name: "M",
          type: "line",
          xAxisIndex: 2,
          yAxisIndex: 2,
          stack: "svtm",
          smooth: true,
          symbol: "none",
          sampling: "lttb",
          progressive: 2500,
          progressiveThreshold: 3200,
          areaStyle: { opacity: 0.22 },
          data: normalized.svtm.M,
        },
      ],
    };
    chartInstRef.current.setOption(option, { notMerge: true, lazyUpdate: true });
  }, [detailsByTs, hasSeries, normalized]);

  useEffect(
    () => () => {
      resizeObserverRef.current?.disconnect();
      if (resizeHandlerRef.current) window.removeEventListener("resize", resizeHandlerRef.current);
      chartInstRef.current?.dispose();
      chartInstRef.current = null;
    },
    []
  );

  if (!SHOW_BACKTEST) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Alert severity="info">운영 모드에서는 Backtest 페이지를 비활성화했습니다.</Alert>
      </Container>
    );
  }

  return (
    <Box sx={{ minHeight: "100dvh", bgcolor: "#eef0f3", py: { xs: 2, md: 4 } }}>
    <Container maxWidth="xl" sx={{ maxWidth: "1180px !important" }}>
      <Stack spacing={1.5}>
        <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 3, position: "sticky", top: 10, zIndex: 20, background: "#f8fafc", borderColor: "#e5e7eb", boxShadow: "0 8px 24px rgba(15,23,42,.04)" }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ flexWrap: "wrap", rowGap: 1 }}>
            <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", rowGap: 1 }}>
              <Chip label="IP: maplestory" variant="outlined" />
              <Chip label={`Case: ${FIXED_CASE}`} variant="outlined" />
              <Chip label="Period: 2025-11-01 ~ 2026-02-10" variant="outlined" />
              <Chip label="Step: 6h" variant="outlined" />
            </Stack>
            <Stack direction="row" spacing={1}>
              <Button component={Link} href="/nexon" variant="outlined" size="small">넥슨 대시보드</Button>
              <Button component={Link} href="/" variant="outlined" size="small">메인</Button>
            </Stack>
          </Stack>
        </Paper>
        <ApiGuardBanner />

        <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 3, borderColor: "rgba(15,23,42,.10)", boxShadow: "0 12px 28px rgba(15,23,42,.06)" }}>
          <Typography variant="h6" sx={{ fontWeight: 800 }}>백테스트 타임라인</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            maplestory 내부 이슈(case: maple_idle_probability_2026) 기준 리스크 반응
          </Typography>
          <Stack direction="row" spacing={1} sx={{ mt: 1.2, flexWrap: "wrap", rowGap: 1 }}>
            <Chip label={`DB: ${dbLabel}`} size="small" variant="outlined" />
            <Chip label={`Backend: ${health?.ok ? "healthy" : "unknown"}`} size="small" variant="outlined" />
          </Stack>
          {modeMismatchWarning ? (
            <Alert severity="warning" sx={{ mt: 1.5 }}>
              {modeMismatchWarning}
            </Alert>
          ) : null}
          <Alert severity="info" sx={{ mt: 1.5 }}>
            백테스트는 임계치 기반 이벤트(히스테리시스 없음)로 계산합니다. 실시간 모드는 집중 수집 전환 로직을 사용합니다.
          </Alert>

          {loading ? <Box sx={{ mt: 2 }}><LoadingState title="백테스트 로딩 중" subtitle="리스크 타임라인을 계산하고 있습니다." /></Box> : null}
          {error ? (
            <Box sx={{ mt: 2 }}>
              <ErrorState
                title="백테스트 데이터를 불러오지 못했습니다."
                details={`${String(error)}\nPR_DB_PATH 및 백엔드 실행 상태를 확인해주세요.`}
                actionLabel="다시 시도"
                onAction={() => setReloadSeq((prev) => prev + 1)}
              />
            </Box>
          ) : null}
          {!loading && !error && !hasSeries ? (
            <Alert severity="warning" sx={{ mt: 2 }}>
              백테스트 데이터가 없습니다. 백엔드를 `PR_DB_PATH=backend/data/articles_backtest.db`로 실행했는지 확인하고, `/health`의 DB 배지를 확인해주세요.
            </Alert>
          ) : null}

          {!loading && !error && hasSeries ? (
            <>
              <Stack direction="row" spacing={1} sx={{ mt: 1.5, flexWrap: "wrap", rowGap: 1 }}>
                <Chip label={`Max Risk: ${Number(payload?.summary?.max_risk || 0).toFixed(1)}`} color="error" variant="outlined" />
                <Chip label={`Avg Risk: ${Number(payload?.summary?.avg_risk || 0).toFixed(1)}`} variant="outlined" />
                <Chip
                  label={`P1 Buckets: ${Number((payload?.summary?.p1_bucket_count ?? payload?.summary?.p1_count) || 0)}`}
                  color="error"
                  variant="outlined"
                />
                <Chip
                  label={`P2 Buckets: ${Number((payload?.summary?.p2_bucket_count ?? payload?.summary?.p2_count) || 0)}`}
                  color="warning"
                  variant="outlined"
                />
                <Chip label={`Events: ${Number(payload?.summary?.event_count || 0)}`} variant="outlined" />
                <Chip label={`Dominant: ${payload?.summary?.dominant_component || "-"}`} variant="outlined" />
              </Stack>
              <Box ref={chartRef} sx={{ mt: 1.5, width: "100%", height: 740 }} />
              <Stack direction={{ xs: "column", md: "row" }} spacing={1.2} sx={{ mt: 1.5 }}>
                <Paper variant="outlined" sx={{ p: 1.2, flex: 1 }}>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>볼륨 드라이버</Typography>
                  <Typography variant="caption" color="text.secondary">
                    최근 {driverStats.volume.latest.toLocaleString()} · 최고 {driverStats.volume.peak.toLocaleString()}
                  </Typography>
                </Paper>
                <Paper variant="outlined" sx={{ p: 1.2, flex: 1 }}>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>확산 드라이버</Typography>
                  <Typography variant="caption" color="text.secondary">
                    최근 {driverStats.spread.latest.toFixed(3)} · 최고 {driverStats.spread.peak.toFixed(3)}
                  </Typography>
                </Paper>
                <Paper variant="outlined" sx={{ p: 1.2, flex: 1 }}>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>불확실 드라이버</Typography>
                  <Typography variant="caption" color="text.secondary">
                    최근 {driverStats.uncertain.latest.toFixed(3)} · 최고 {driverStats.uncertain.peak.toFixed(3)}
                  </Typography>
                </Paper>
              </Stack>
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
                급등 구간은 기사량 증가와 고위험 테마 비중이 주도했고, 확산도는 보조적으로 영향을 줍니다.
              </Typography>
            </>
          ) : null}
        </Paper>
      </Stack>
    </Container>
    </Box>
  );
}
