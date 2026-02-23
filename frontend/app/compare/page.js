"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  Grid,
  IconButton,
  Stack,
  Tab,
  Tabs,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  AlertTriangle,
  BarChart3,
  ExternalLink,
  Layers,
  MessageSquare,
  Settings2,
  TrendingUp,
} from "lucide-react";
import { apiGet, getRetryAfterSeconds } from "../../lib/api";
import ApiGuardBanner from "../../components/ApiGuardBanner";
import EmptyState from "../../components/EmptyState";
import PageStatusView from "../../components/PageStatusView";
import {
  buildDiagnosticScope,
  shouldShowEmptyState,
  toRequestErrorState,
} from "../../lib/pageStatus";
import {
  navButtonSx,
  pageContainerSx,
  pageShellCleanSx,
} from "../../lib/uiTokens";

const SENTIMENTS = ["긍정", "중립", "부정"];
const DEFAULT_COMPANIES = ["넥슨", "NC소프트", "넷마블", "크래프톤"];
const DEFAULT_REFRESH_MS = 60000;
const MIN_REFRESH_MS = 10000;
const REQUEST_DEBOUNCE_MS = 350;
const DEFAULT_WINDOW_HOURS = 72;
const LOW_SAMPLE_THRESHOLD = 5;

const WINDOW_HOURS_OPTIONS = [
  { hours: 24, label: "24시간" },
  { hours: 72, label: "3일" },
  { hours: 168, label: "7일" },
];
const TREND_METRIC_OPTIONS = [
  { key: "count", label: "보도 건수" },
  { key: "risk", label: "위기 지수" },
  { key: "heat", label: "이슈량" },
];
const SENTIMENT_FILTER_OPTIONS = ["전체", ...SENTIMENTS];
const ANALYSIS_TABS = [
  { key: "trend", label: "보도 추이", icon: <TrendingUp size={15} /> },
  { key: "sentiment", label: "여론 분포", icon: <MessageSquare size={15} /> },
  { key: "keywords", label: "키워드", icon: <Layers size={15} /> },
];

const COMPANY_COLORS = {
  넥슨: "#2563eb",
  "NC소프트": "#7c3aed",
  넷마블: "#059669",
  크래프톤: "#d97706",
};
const SENTIMENT_COLORS = { 긍정: "#10b981", 중립: "#94a3b8", 부정: "#ef4444" };

const DIAG_SCOPE = {
  rateLimit: buildDiagnosticScope("CMP", "RATE"),
  live: buildDiagnosticScope("CMP", "LIVE"),
};

function companyColor(name) {
  return COMPANY_COLORS[name] || "#2563eb";
}

function getRefreshIntervalMs() {
  const c = Number(process.env.NEXT_PUBLIC_COMPARE_REFRESH_MS || "");
  return Number.isFinite(c) && c >= MIN_REFRESH_MS ? Math.floor(c) : DEFAULT_REFRESH_MS;
}

function clampRetrySeconds(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.max(1, Math.ceil(n)) : null;
}

function formatRelativeUpdate(value) {
  if (!value) return "—";
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return "방금";
  const sec = Math.max(0, Math.floor((Date.now() - dt.getTime()) / 1000));
  if (sec < 60) return "방금";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  return `${Math.floor(hr / 24)}일 전`;
}

function getVolumeState(count) {
  const n = Number(count || 0);
  if (n <= 0) return { label: "0건", tone: "warning" };
  if (n < LOW_SAMPLE_THRESHOLD) return { label: "소량", tone: "warning" };
  return { label: "충분", tone: "success" };
}

const GlassCard = ({ children, sx, ...props }) => (
  <Card
    variant="outlined"
    sx={{
      borderRadius: 3,
      border: "1px solid rgba(148,163,184,.18)",
      bgcolor: "#fff",
      boxShadow: "0 1px 3px rgba(15,23,42,.04), 0 8px 24px rgba(15,23,42,.03)",
      ...sx,
    }}
    {...props}
  >
    {children}
  </Card>
);

export default function CompareRebuildPage() {
  const refreshMs = getRefreshIntervalMs();

  const [selectedCompanies, setSelectedCompanies] = useState(DEFAULT_COMPANIES);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [errorCode, setErrorCode] = useState("");
  const [data, setData] = useState(null);
  const [filterCompany, setFilterCompany] = useState("전체");
  const [filterSentiment, setFilterSentiment] = useState("전체");
  const [trendMetric, setTrendMetric] = useState("count");
  const [lastUpdatedAt, setLastUpdatedAt] = useState("");
  const [retryAfterSec, setRetryAfterSec] = useState(null);
  const [selectedWindowHours, setSelectedWindowHours] = useState(DEFAULT_WINDOW_HOURS);
  const [activeTab, setActiveTab] = useState("trend");
  const [settingsOpen, setSettingsOpen] = useState(true);

  const inFlightRef = useRef(false);
  const compareReqSeqRef = useRef(0);
  const compareAbortRef = useRef(null);
  const pollTimerRef = useRef(null);
  const debounceTimerRef = useRef(null);
  const retryAfterRef = useRef(0);

  const trendRef = useRef(null);
  const trendChartRef = useRef(null);
  const sentimentRef = useRef(null);
  const sentimentChartRef = useRef(null);

  const total = data?.meta?.total_articles ?? 0;
  const companyCounts = data?.company_counts ?? {};
  const trendRows = data?.trend ?? [];
  const trendMetricRows = data?.trend_metrics ?? [];
  const hasTrendMetricRows = Array.isArray(trendMetricRows) && trendMetricRows.length > 0;
  const sentimentRows = data?.sentiment_summary ?? [];
  const keywordsMap = data?.keywords ?? {};
  const insights = data?.insights ?? {};
  const companiesForView = selectedCompanies;
  const windowHours = Number(selectedWindowHours || DEFAULT_WINDOW_HOURS) || DEFAULT_WINDOW_HOURS;

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  const clearScheduledFetch = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
  }, []);

  const fetchCompare = useCallback(async () => {
    if (!selectedCompanies.length || inFlightRef.current) return;
    if (typeof document !== "undefined" && document.hidden) return;
    inFlightRef.current = true;

    const reqSeq = ++compareReqSeqRef.current;
    compareAbortRef.current?.abort();
    const controller = new AbortController();
    compareAbortRef.current = controller;
    setLoading(true);

    try {
      const query = new URLSearchParams({
        companies: selectedCompanies.join(","),
        window_hours: String(windowHours),
      });
      const payload = await apiGet(`/api/compare-live?${query.toString()}`, {
        signal: controller.signal,
      });
      if (reqSeq !== compareReqSeqRef.current) return;
      setData(payload);
      setError("");
      setErrorCode("");
      setRetryAfterSec(null);
      setLastUpdatedAt(payload?.meta?.generated_at || new Date().toISOString());
    } catch (e) {
      if (e?.name === "AbortError") return;
      if (reqSeq !== compareReqSeqRef.current) return;

      const isRateLimit = Number(e?.status) === 429;
      const retrySeconds = clampRetrySeconds(getRetryAfterSeconds(e));
      if (isRateLimit) {
        setError("요청이 많아 잠시 후 다시 시도");
        setRetryAfterSec(retrySeconds);
        retryAfterRef.current = Number(retrySeconds || 0);
        stopPolling();
        clearScheduledFetch();
        setErrorCode(toRequestErrorState(e, { scope: DIAG_SCOPE.rateLimit, fallback: "" }).code);
      } else {
        const nextError = toRequestErrorState(e, {
          scope: DIAG_SCOPE.live,
          fallback: "경쟁사 분석에 실패했습니다.",
        });
        setError(nextError.message);
        setRetryAfterSec(null);
        retryAfterRef.current = 0;
        setErrorCode(nextError.code);
      }
    } finally {
      if (reqSeq === compareReqSeqRef.current) {
        inFlightRef.current = false;
        setLoading(false);
      }
    }
  }, [clearScheduledFetch, selectedCompanies, stopPolling, windowHours]);

  const scheduleFetch = useCallback(
    (delayMs = REQUEST_DEBOUNCE_MS, { force = false, allowDuringRateLimit = false } = {}) => {
      if (!force && typeof document !== "undefined" && document.hidden) return;
      if (!allowDuringRateLimit && retryAfterRef.current > 0) return;
      clearScheduledFetch();
      debounceTimerRef.current = setTimeout(() => fetchCompare(), delayMs);
    },
    [clearScheduledFetch, fetchCompare]
  );

  const startPolling = useCallback(() => {
    stopPolling();
    if (typeof document !== "undefined" && document.hidden) return;
    if (retryAfterRef.current > 0) return;
    pollTimerRef.current = setInterval(() => scheduleFetch(0), refreshMs);
  }, [refreshMs, scheduleFetch, stopPolling]);

  const sentimentByCompany = useMemo(() => {
    const map = {};
    for (const row of sentimentRows) {
      if (!map[row.company]) map[row.company] = { 긍정: 0, 중립: 0, 부정: 0, total: 0 };
      map[row.company][row.sentiment] = Number(row.ratio || 0);
      map[row.company].total += Number(row.count || 0);
    }
    return map;
  }, [sentimentRows]);

  const trendDates = useMemo(() => {
    const dateOrder = trendRows.slice(-14).map((r) => String(r.date));
    const fallback = Array.from(new Set((trendMetricRows || []).map((r) => String(r.date)))).slice(-14);
    return dateOrder.length ? dateOrder : fallback;
  }, [trendRows, trendMetricRows]);

  const trendMatrix = useMemo(() => {
    const map = new Map();
    for (const row of trendMetricRows || []) {
      map.set(`${row.company}::${String(row.date)}`, row);
    }
    return map;
  }, [trendMetricRows]);

  const trendSeries = useMemo(() => {
    return companiesForView.map((company) => {
      const values = trendDates.map((date) => {
        const metric = trendMatrix.get(`${company}::${date}`);
        const countFallback = Number((trendRows.find((r) => String(r.date) === date)?.[company]) || 0);
        const countVal = Number(metric?.count ?? countFallback ?? 0);
        if (trendMetric === "risk") return hasTrendMetricRows ? Number(metric?.risk_score || 0) : countVal;
        if (trendMetric === "heat") return hasTrendMetricRows ? Number(metric?.heat_score || 0) : countVal;
        return countVal;
      });
      return { name: company, type: "bar", data: values, itemStyle: { color: companyColor(company), borderRadius: [4, 4, 0, 0] } };
    });
  }, [companiesForView, hasTrendMetricRows, trendDates, trendMatrix, trendMetric, trendRows]);

  const sentimentChartData = useMemo(
    () =>
      companiesForView.map((company) => {
        const row = sentimentByCompany[company] || { 긍정: 0, 중립: 0, 부정: 0, total: 0 };
        return {
          company,
          긍정: Number(row.긍정 || 0),
          중립: Number(row.중립 || 0),
          부정: Number(row.부정 || 0),
        };
      }),
    [companiesForView, sentimentByCompany]
  );

  const keywordCards = useMemo(
    () =>
      companiesForView.map((company) => ({
        company,
        items: (keywordsMap[company] || []).slice(0, 10).map((it) => ({ keyword: it[0], count: it[1] })),
      })),
    [companiesForView, keywordsMap]
  );

  const articleCompanyFilters = useMemo(() => ["전체", ...companiesForView], [companiesForView]);
  const hasBlockingError = Boolean(error) && Number(retryAfterSec || 0) === 0;
  const shouldShowCompareEmpty = shouldShowEmptyState({
    loading,
    error: hasBlockingError ? error : "",
    hasData: Boolean(data),
  });

  const displayedArticles = useMemo(() => {
    let rows = (data?.latest_articles || []).slice();
    if (filterCompany !== "전체") rows = rows.filter((r) => r.company === filterCompany);
    if (filterSentiment !== "전체") rows = rows.filter((r) => r.sentiment === filterSentiment);
    return rows;
  }, [data, filterCompany, filterSentiment]);

  useEffect(() => {
    scheduleFetch(0, { force: true });
    startPolling();
    return () => {
      stopPolling();
      clearScheduledFetch();
      compareAbortRef.current?.abort();
    };
  }, [clearScheduledFetch, scheduleFetch, startPolling, stopPolling]);

  useEffect(() => {
    scheduleFetch();
    startPolling();
  }, [selectedCompanies, scheduleFetch, startPolling]);

  useEffect(() => {
    if (filterCompany !== "전체" && !companiesForView.includes(filterCompany)) setFilterCompany("전체");
  }, [companiesForView, filterCompany]);

  useEffect(() => {
    retryAfterRef.current = Number(retryAfterSec || 0);
  }, [retryAfterSec]);

  useEffect(() => {
    if (!retryAfterSec || retryAfterSec <= 0) return undefined;
    const timer = setInterval(() => {
      setRetryAfterSec((prev) => {
        if (!prev || prev <= 1) {
          retryAfterRef.current = 0;
          scheduleFetch(0, { force: true, allowDuringRateLimit: true });
          startPolling();
          return null;
        }
        retryAfterRef.current = prev - 1;
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [retryAfterSec, scheduleFetch, startPolling]);

  useEffect(() => {
    let disposed = false;
    (async () => {
      if (!trendRef.current || !trendDates.length || activeTab !== "trend") return;
      const echarts = await import("echarts");
      if (disposed || !trendRef.current) return;
      if (!trendChartRef.current) trendChartRef.current = echarts.init(trendRef.current);
      trendChartRef.current.setOption({
        animation: true,
        tooltip: { trigger: "axis" },
        legend: { top: 4 },
        grid: { left: 32, right: 16, bottom: 24, top: 36, containLabel: true },
        xAxis: { type: "category", data: trendDates, axisLabel: { color: "#64748b" } },
        yAxis: { type: "value", axisLabel: { color: "#64748b" } },
        series: trendSeries,
      });
      trendChartRef.current.resize();
    })();

    const onResize = () => trendChartRef.current?.resize();
    window.addEventListener("resize", onResize);
    return () => {
      disposed = true;
      window.removeEventListener("resize", onResize);
    };
  }, [activeTab, trendDates, trendSeries]);

  useEffect(() => {
    let disposed = false;
    (async () => {
      if (!sentimentRef.current || activeTab !== "sentiment") return;
      const echarts = await import("echarts");
      if (disposed || !sentimentRef.current) return;
      if (!sentimentChartRef.current) sentimentChartRef.current = echarts.init(sentimentRef.current);
      sentimentChartRef.current.setOption({
        animation: true,
        tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
        legend: { top: 4 },
        grid: { left: 48, right: 20, bottom: 24, top: 36, containLabel: true },
        xAxis: { type: "value", max: 100, axisLabel: { color: "#64748b", formatter: "{value}%" } },
        yAxis: { type: "category", data: sentimentChartData.map((d) => d.company), axisLabel: { color: "#334155" } },
        series: SENTIMENTS.map((s) => ({
          name: s,
          type: "bar",
          stack: "sentiment",
          data: sentimentChartData.map((d) => d[s]),
          itemStyle: { color: SENTIMENT_COLORS[s] },
        })),
      });
      sentimentChartRef.current.resize();
    })();

    const onResize = () => sentimentChartRef.current?.resize();
    window.addEventListener("resize", onResize);
    return () => {
      disposed = true;
      window.removeEventListener("resize", onResize);
    };
  }, [activeTab, sentimentChartData]);

  const toggleSelectedCompany = (name) => {
    setSelectedCompanies((prev) => (prev.includes(name) ? (prev.length === 1 ? prev : prev.filter((v) => v !== name)) : [...prev, name]));
  };

  return (
    <Box sx={{ ...pageShellCleanSx, bgcolor: "#f8fafc", minHeight: "100vh", py: { xs: 2, md: 5 } }}>
      <Container maxWidth="xl" sx={pageContainerSx}>
        <Stack spacing={2.5}>
          <Box sx={{ display: "flex", flexDirection: { xs: "column", sm: "row" }, justifyContent: "space-between", alignItems: { sm: "center" }, gap: 1.5 }}>
            <Stack direction="row" spacing={1.2} alignItems="center">
              <Box sx={{ width: 32, height: 32, borderRadius: 2, background: "linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}>
                <BarChart3 size={18} />
              </Box>
              <Box>
                <Typography variant="h5" sx={{ fontWeight: 800, fontSize: { xs: 20, md: 22 }, color: "#0f172a" }}>경쟁사 비교 현황판 (Rebuild)</Typography>
                <Typography variant="caption" sx={{ color: "text.secondary" }}>{formatRelativeUpdate(lastUpdatedAt)} 갱신</Typography>
              </Box>
            </Stack>
            <Stack direction="row" spacing={0.8}>
              <Button component={Link} href="/compare" variant="outlined" size="small" sx={{ ...navButtonSx, borderRadius: 2 }}>기존 Compare</Button>
              <Button component={Link} href="/nexon" variant="outlined" size="small" sx={{ ...navButtonSx, borderRadius: 2 }}>넥슨 IP 리스크</Button>
              <Tooltip title="설정">
                <IconButton size="small" onClick={() => setSettingsOpen((p) => !p)} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2 }}>
                  <Settings2 size={16} />
                </IconButton>
              </Tooltip>
            </Stack>
          </Box>

          <ApiGuardBanner />

          {settingsOpen ? (
            <GlassCard sx={{ px: { xs: 2, md: 2.5 }, py: 2 }}>
              <Stack spacing={1.2}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>비교 설정</Typography>
                <Stack direction="row" spacing={0.6} useFlexGap flexWrap="wrap">
                  {DEFAULT_COMPANIES.map((name) => (
                    <Chip key={name} label={name} size="small" onClick={() => toggleSelectedCompany(name)} sx={{ fontWeight: 600, borderRadius: 1.5, bgcolor: selectedCompanies.includes(name) ? companyColor(name) : "transparent", color: selectedCompanies.includes(name) ? "#fff" : "#475569", border: "1px solid", borderColor: selectedCompanies.includes(name) ? companyColor(name) : "#cbd5e1" }} />
                  ))}
                </Stack>
                <ToggleButtonGroup size="small" exclusive value={windowHours} onChange={(_, v) => v !== null && setSelectedWindowHours(v)}>
                  {WINDOW_HOURS_OPTIONS.map(({ hours, label }) => <ToggleButton key={hours} value={hours}>{label}</ToggleButton>)}
                </ToggleButtonGroup>
              </Stack>
            </GlassCard>
          ) : null}

          {retryAfterSec ? (
            <Alert severity="warning" icon={<AlertTriangle size={16} />} sx={{ borderRadius: 2.5 }}>
              호출 제한(HTTP 429) {retryAfterSec}초 후 자동 재시도 {errorCode ? `· ${errorCode}` : ""}
            </Alert>
          ) : null}

          <PageStatusView
            spacing={1}
            error={{ show: hasBlockingError, title: "분석 실패", details: error, diagnosticCode: errorCode }}
            loading={{ show: loading && !data, title: "경쟁사 비교 데이터 확인 중", subtitle: "최신 기사와 지표를 업데이트하고 있습니다." }}
            empty={{ show: shouldShowCompareEmpty, title: "표시할 비교 데이터가 없습니다.", subtitle: "잠시 후 자동으로 다시 확인합니다." }}
          />

          {data ? (
            <>
              <Grid container spacing={{ xs: 1.2, md: 1.5 }}>
                {selectedCompanies.map((company) => {
                  const count = Number(companyCounts?.[company] || 0);
                  const state = getVolumeState(count);
                  return (
                    <Grid item xs={6} md={3} key={company}>
                      <Box sx={{ p: 2, borderRadius: 2.5, bgcolor: "#fff", border: "1px solid rgba(148,163,184,.15)", position: "relative" }}>
                        <Box sx={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, bgcolor: companyColor(company), borderRadius: "10px 10px 0 0" }} />
                        <Typography variant="caption" sx={{ fontWeight: 700 }}>{company}</Typography>
                        <Typography variant="h4" sx={{ fontWeight: 800 }}>{count.toLocaleString()}</Typography>
                        <Typography variant="caption" sx={{ color: "text.secondary" }}>보도 건수 · {state.label}</Typography>
                      </Box>
                    </Grid>
                  );
                })}
              </Grid>

              <GlassCard>
                <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)} variant="scrollable" scrollButtons="auto" sx={{ borderBottom: "1px solid", borderColor: "divider" }}>
                  {ANALYSIS_TABS.map((tab) => <Tab key={tab.key} value={tab.key} icon={tab.icon} iconPosition="start" label={tab.label} />)}
                </Tabs>
                <CardContent sx={{ p: { xs: 2, md: 3 } }}>
                  {activeTab === "trend" ? (
                    <>
                      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
                        <Typography variant="h6" sx={{ fontWeight: 800 }}>보도 추이 (ECharts)</Typography>
                        <ToggleButtonGroup size="small" exclusive value={trendMetric} onChange={(_, v) => v !== null && setTrendMetric(v)}>
                          {TREND_METRIC_OPTIONS.map((o) => <ToggleButton key={o.key} value={o.key}>{o.label}</ToggleButton>)}
                        </ToggleButtonGroup>
                      </Stack>
                      {trendDates.length ? <Box ref={trendRef} sx={{ width: "100%", height: 340 }} /> : <EmptyState title="추이 데이터가 없습니다." compact />}
                    </>
                  ) : null}

                  {activeTab === "sentiment" ? (
                    <>
                      <Typography variant="h6" sx={{ fontWeight: 800, mb: 1.5 }}>여론 분포 (ECharts)</Typography>
                      {sentimentChartData.length ? <Box ref={sentimentRef} sx={{ width: "100%", height: 340 }} /> : <EmptyState title="여론 데이터가 없습니다." compact />}
                    </>
                  ) : null}

                  {activeTab === "keywords" ? (
                    <Grid container spacing={1.5}>
                      {keywordCards.map((card) => (
                        <Grid item xs={12} md={6} key={card.company}>
                          <Box sx={{ p: 2, borderRadius: 2.5, border: "1px solid rgba(148,163,184,.15)", bgcolor: "#fafbfc" }}>
                            <Typography variant="body2" sx={{ fontWeight: 700, mb: 1 }}>{card.company}</Typography>
                            <Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap">
                              {card.items.length ? card.items.map((it) => <Chip key={`${card.company}-${it.keyword}`} size="small" variant="outlined" label={`${it.keyword} · ${it.count}`} />) : <Typography variant="caption">키워드 없음</Typography>}
                            </Stack>
                          </Box>
                        </Grid>
                      ))}
                    </Grid>
                  ) : null}
                </CardContent>
              </GlassCard>

              <Grid container spacing={1.5}>
                <Grid item xs={12} md={6}>
                  <GlassCard><CardContent><Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1 }}>주목 이슈 TOP 5</Typography><Stack spacing={0.7}>{(insights.top_issues || []).map((item, idx) => <Typography key={`${idx}-${item.company}-${item.keyword}`} variant="body2"><b>{item.company}</b> {item.keyword} ({item.count}건)</Typography>)}</Stack></CardContent></GlassCard>
                </Grid>
                <Grid item xs={12} md={6}>
                  <GlassCard><CardContent><Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1 }}>실행 제안</Typography><Stack spacing={0.7}>{(insights.actions || []).map((item, idx) => <Typography key={`${idx}-${item.company}`} variant="body2"><b>{item.company}</b> {item.action}</Typography>)}</Stack></CardContent></GlassCard>
                </Grid>
              </Grid>

              <GlassCard>
                <CardContent sx={{ p: { xs: 2, md: 3 } }}>
                  <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={1} sx={{ mb: 2 }}>
                    <Typography variant="h6" sx={{ fontWeight: 800 }}>최신 기사</Typography>
                    <Stack direction="row" spacing={0.6}>
                      <Box component="select" value={filterCompany} onChange={(e) => setFilterCompany(e.target.value)} sx={{ border: "1px solid #e2e8f0", borderRadius: 1.5, px: 1.2, py: 0.5, fontSize: 12 }}>
                        {articleCompanyFilters.map((c) => <option key={c} value={c}>{c === "전체" ? "전체 게임사" : c}</option>)}
                      </Box>
                      <Box component="select" value={filterSentiment} onChange={(e) => setFilterSentiment(e.target.value)} sx={{ border: "1px solid #e2e8f0", borderRadius: 1.5, px: 1.2, py: 0.5, fontSize: 12 }}>
                        {SENTIMENT_FILTER_OPTIONS.map((s) => <option key={s} value={s}>{s === "전체" ? "전체 여론" : s}</option>)}
                      </Box>
                    </Stack>
                  </Stack>
                  <Stack spacing={0.5}>
                    {displayedArticles.slice(0, 120).map((a, idx) => (
                      <Box key={`${idx}-${a.title}`} sx={{ display: "grid", gridTemplateColumns: { xs: "80px 1fr 60px 90px", md: "110px 1fr 80px 130px" }, gap: 1.5, px: 1.5, py: 1, borderBottom: "1px solid #f1f5f9", alignItems: "center" }}>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>{a.company || "-"}</Typography>
                        <Typography component={a.url ? "a" : "span"} href={a.url || undefined} target={a.url ? "_blank" : undefined} rel={a.url ? "noreferrer" : undefined} sx={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textDecoration: "none", color: "#1e293b" }}>{a.title || "(제목 없음)"}{a.url ? <ExternalLink size={11} style={{ marginLeft: 4, verticalAlign: "middle", opacity: 0.45 }} /> : null}</Typography>
                        <Typography variant="body2" sx={{ fontSize: 12 }}>{a.sentiment || "-"}</Typography>
                        <Typography variant="body2" sx={{ color: "text.secondary", fontSize: 12 }}>{a.date || "-"}</Typography>
                      </Box>
                    ))}
                    {!displayedArticles.length ? <Box sx={{ py: 3, textAlign: "center", color: "text.secondary" }}>조건에 맞는 기사가 없습니다.</Box> : null}
                  </Stack>
                </CardContent>
              </GlassCard>
            </>
          ) : null}

          <Typography variant="caption" color="text.secondary" align="center" sx={{ py: 1 }}>
            자동 업데이트 · 최근 {windowHours}시간 기준
          </Typography>
        </Stack>
      </Container>
    </Box>
  );
}
