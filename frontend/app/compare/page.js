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
  Paper,
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
  ChevronRight,
  ExternalLink,
  Globe,
  Info,
  Layers,
  MessageSquare,
  RefreshCw,
  Settings2,
  TrendingUp,
  Zap,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  Legend,
} from "recharts";
import {
  apiGet,
  getRetryAfterSeconds,
} from "../../lib/api";
import ApiGuardBanner from "../../components/ApiGuardBanner";
import EmptyState from "../../components/EmptyState";
import PageStatusView from "../../components/PageStatusView";
import {
  buildDiagnosticScope,
  shouldShowEmptyState,
  toRequestErrorState,
} from "../../lib/pageStatus";
import {
  colors,
  contentCardSx,
  filterChipSx,
  MUI_SPEC,
  metricCardSx,
  navButtonSx,
  pageContainerSx,
  pageShellCleanSx,
  panelPaperSx,
  progressBarSx,
  sectionCardSx,
  sectionTitleSx,
  shadows,
  specTypeSx,
  statusChipSx,
  subPanelSx,
} from "../../lib/uiTokens";

/* ═══════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════ */
const SENTIMENTS = ["긍정", "중립", "부정"];
const DEFAULT_COMPANIES = ["넥슨", "NC소프트", "넷마블", "크래프톤"];
const DEFAULT_REFRESH_MS = 60000;
const MIN_REFRESH_MS = 10000;
const REQUEST_DEBOUNCE_MS = 350;
const DEFAULT_WINDOW_HOURS = 72;
const COMPARE_FETCH_LIMIT = 100;
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

/* ═══════════════════════════════════════════════
   PALETTE — company & sentiment color maps
   ═══════════════════════════════════════════════ */
const COMPANY_COLORS = {
  넥슨: "#2563eb",
  "NC소프트": "#7c3aed",
  넷마블: "#059669",
  크래프톤: "#d97706",
};
const SENTIMENT_COLORS = { 긍정: "#10b981", 중립: "#94a3b8", 부정: "#ef4444" };
const CHART_BG = "#fafbfc";

const DIAG_SCOPE = {
  rateLimit: buildDiagnosticScope("CMP", "RATE"),
  live: buildDiagnosticScope("CMP", "LIVE"),
};

/* ═══════════════════════════════════════════════
   HELPER FUNCTIONS
   ═══════════════════════════════════════════════ */
function getRefreshIntervalMs() {
  const c = Number(process.env.NEXT_PUBLIC_COMPARE_REFRESH_MS || "");
  return Number.isFinite(c) && c >= MIN_REFRESH_MS ? Math.floor(c) : DEFAULT_REFRESH_MS;
}

function formatKstShort(value) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString("ko-KR", {
    hour12: false,
    timeZone: "Asia/Seoul",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function clampRetrySeconds(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.max(1, Math.ceil(n)) : null;
}

function formatRetryAt(seconds) {
  const sec = clampRetrySeconds(seconds);
  if (!sec) return "-";
  return new Date(Date.now() + sec * 1000).toLocaleTimeString("ko-KR", {
    hour12: false,
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
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

function companyColor(name) {
  return COMPANY_COLORS[name] || "#2563eb";
}

/* ═══════════════════════════════════════════════
   MICRO COMPONENTS
   ═══════════════════════════════════════════════ */

/** Glass-effect card wrapper */
const GlassCard = ({ children, sx, ...props }) => (
  <Card
    variant="outlined"
    sx={{
      borderRadius: 3,
      border: "1px solid rgba(148,163,184,.18)",
      bgcolor: "#fff",
      boxShadow: "0 1px 3px rgba(15,23,42,.04), 0 8px 24px rgba(15,23,42,.03)",
      overflow: "visible",
      ...sx,
    }}
    {...props}
  >
    {children}
  </Card>
);

/** Single metric card with accent top-line */
const MetricBox = ({ label, value, sub, accentColor, volumeState }) => (
  <Box
    sx={{
      position: "relative",
      p: { xs: 2, md: 2.5 },
      borderRadius: 2.5,
      bgcolor: "#fff",
      border: "1px solid rgba(148,163,184,.15)",
      boxShadow: "0 1px 3px rgba(15,23,42,.03)",
      overflow: "hidden",
      transition: "box-shadow .2s, transform .2s",
      "&:hover": { boxShadow: "0 4px 16px rgba(15,23,42,.08)", transform: "translateY(-1px)" },
    }}
  >
    <Box sx={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, bgcolor: accentColor, borderRadius: "12px 12px 0 0" }} />
    <Typography
      variant="caption"
      sx={{ color: "text.secondary", fontWeight: 600, letterSpacing: ".02em", textTransform: "uppercase", fontSize: 11 }}
    >
      {label}
    </Typography>
    <Typography
      variant="h4"
      sx={{ fontWeight: 800, mt: 0.5, fontVariantNumeric: "tabular-nums", fontSize: { xs: 30, md: 34 }, lineHeight: 1.1, color: "#0f172a" }}
    >
      {value}
    </Typography>
    <Stack direction="row" spacing={0.6} alignItems="center" sx={{ mt: 0.8 }}>
      <Typography variant="caption" sx={{ color: "text.secondary" }}>{sub}</Typography>
      {volumeState && (
        <Box
          component="span"
          sx={{
            fontSize: 10,
            fontWeight: 700,
            px: 0.8,
            py: 0.15,
            borderRadius: 1,
            bgcolor: volumeState.tone === "success" ? "rgba(16,185,129,.1)" : "rgba(245,158,11,.1)",
            color: volumeState.tone === "success" ? "#059669" : "#d97706",
          }}
        >
          {volumeState.label}
        </Box>
      )}
    </Stack>
  </Box>
);

/** Section header with optional right-side action */
const SectionHeader = ({ title, subtitle, action }) => (
  <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 2 }}>
    <Box>
      <Typography variant="h6" sx={{ fontWeight: 800, fontSize: 17, color: "#1e293b" }}>{title}</Typography>
      {subtitle && <Typography variant="caption" sx={{ color: "text.secondary", mt: 0.2, display: "block" }}>{subtitle}</Typography>}
    </Box>
    {action}
  </Stack>
);

/** Custom Recharts tooltip */
const ChartTooltipContent = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <Paper
      sx={{
        p: 1.2,
        borderRadius: 2,
        boxShadow: "0 4px 16px rgba(0,0,0,.12)",
        border: "1px solid rgba(148,163,184,.15)",
      }}
    >
      <Typography variant="caption" sx={{ fontWeight: 700, mb: 0.4, display: "block" }}>{label}</Typography>
      {payload.map((entry) => (
        <Stack key={entry.dataKey} direction="row" spacing={0.8} alignItems="center" sx={{ py: 0.15 }}>
          <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: entry.color, flexShrink: 0 }} />
          <Typography variant="caption">
            {entry.name}: <b>{typeof entry.value === "number" ? entry.value.toLocaleString() : entry.value}</b>
          </Typography>
        </Stack>
      ))}
    </Paper>
  );
};

/* ═══════════════════════════════════════════════
   MAIN PAGE COMPONENT
   ═══════════════════════════════════════════════ */
export default function ComparePage() {
  const refreshMs = getRefreshIntervalMs();

  /* ── state ── */
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
  const [settingsOpen, setSettingsOpen] = useState(false);

  /* ── refs ── */
  const inFlightRef = useRef(false);
  const compareReqSeqRef = useRef(0);
  const compareAbortRef = useRef(null);
  const pollTimerRef = useRef(null);
  const debounceTimerRef = useRef(null);
  const retryAfterRef = useRef(0);

  /* ── derived from data ── */
  const total = data?.meta?.total_articles ?? 0;
  const companyCounts = data?.company_counts ?? {};
  const insights = data?.insights ?? {};
  const trendRows = data?.trend ?? [];
  const trendMetricRows = data?.trend_metrics ?? [];
  const hasTrendMetricRows = Array.isArray(trendMetricRows) && trendMetricRows.length > 0;
  const sentimentRows = data?.sentiment_summary ?? [];
  const keywordsMap = data?.keywords ?? {};
  const fetchLimitPerCompany = Number(data?.meta?.fetch_limit_per_company || COMPARE_FETCH_LIMIT);
  const timedOutCompanies = Array.isArray(data?.meta?.timed_out_companies) ? data.meta.timed_out_companies : [];
  const failedCompanies = Array.isArray(data?.meta?.failed_companies) ? data.meta.failed_companies : [];
  const partialFetch = Boolean(data?.meta?.partial_fetch) || timedOutCompanies.length > 0 || failedCompanies.length > 0;
  const companiesForView = selectedCompanies;
  const windowHours = Number(selectedWindowHours || DEFAULT_WINDOW_HOURS) || DEFAULT_WINDOW_HOURS;

  /* ═══════════════ POLLING / FETCH LOGIC ═══════════════ */
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
        limit: String(COMPARE_FETCH_LIMIT),
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
        const waitLabel = retrySeconds ? ` (약 ${retrySeconds}초 후 재시도)` : "";
        setError(`요청이 많아 잠시 후 다시 시도${waitLabel}`);
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
    [clearScheduledFetch, fetchCompare],
  );

  const startPolling = useCallback(() => {
    stopPolling();
    if (typeof document !== "undefined" && document.hidden) return;
    if (retryAfterRef.current > 0) return;
    pollTimerRef.current = setInterval(() => scheduleFetch(0), refreshMs);
  }, [refreshMs, scheduleFetch, stopPolling]);

  const toggleSelectedCompany = (name) => {
    setSelectedCompanies((prev) => {
      if (prev.includes(name)) {
        if (prev.length === 1) return prev;
        return prev.filter((v) => v !== name);
      }
      return [...prev, name];
    });
  };

  /* ═══════════════ DERIVED DATA ═══════════════ */
  const companyCards = useMemo(
    () =>
      selectedCompanies.map((name) => ({
        company: name,
        count: Number(companyCounts?.[name] || 0),
        state: getVolumeState(companyCounts?.[name] || 0),
      })),
    [companyCounts, selectedCompanies],
  );

  const sentimentByCompany = useMemo(() => {
    const map = {};
    for (const row of sentimentRows) {
      if (!map[row.company]) map[row.company] = { 긍정: 0, 중립: 0, 부정: 0, total: 0 };
      map[row.company][row.sentiment] = Number(row.ratio || 0);
      map[row.company].total += Number(row.count || 0);
    }
    return map;
  }, [sentimentRows]);

  /** Recharts-ready trend data: [{ date, 넥슨: n, NC소프트: n, ... }] */
  const rechartsData = useMemo(() => {
    const dateOrder = trendRows.slice(-14).map((r) => String(r.date));
    const fallback = Array.from(
      new Set((trendMetricRows || []).map((r) => String(r.date))),
    ).slice(-14);
    const dates = dateOrder.length ? dateOrder : fallback;
    if (!dates.length) return [];

    const trendCountMap = new Map();
    for (const row of trendRows) {
      const day = String(row?.date || "");
      if (!day) continue;
      for (const c of companiesForView) {
        trendCountMap.set(`${c}::${day}`, Number(row?.[c] || 0));
      }
    }

    return dates.map((date) => {
      const entry = { date };
      for (const company of companiesForView) {
        const metricRow = (trendMetricRows || []).find(
          (r) => r.company === company && String(r.date) === date,
        );
        const countVal = Number(
          metricRow?.count ?? trendCountMap.get(`${company}::${date}`) ?? 0,
        );
        entry[company] =
          trendMetric === "risk"
            ? hasTrendMetricRows
              ? Number(metricRow?.risk_score || 0)
              : countVal
            : trendMetric === "heat"
              ? hasTrendMetricRows
                ? Number(metricRow?.heat_score || 0)
                : countVal
              : countVal;
      }
      return entry;
    });
  }, [companiesForView, hasTrendMetricRows, trendMetric, trendMetricRows, trendRows]);

  /** Sentiment stacked bar data */
  const sentimentChartData = useMemo(
    () =>
      companiesForView.map((company) => {
        const row = sentimentByCompany[company] || { 긍정: 0, 중립: 0, 부정: 0, total: 0 };
        const count = Number(companyCounts?.[company] || row.total || 0);
        return { company, 긍정: row.긍정, 중립: row.중립, 부정: row.부정, count };
      }),
    [companiesForView, companyCounts, sentimentByCompany],
  );

  const keywordCards = useMemo(
    () =>
      companiesForView.map((company) => ({
        company,
        items: (keywordsMap[company] || [])
          .slice(0, 10)
          .map((it) => ({ keyword: it[0], count: it[1] })),
      })),
    [companiesForView, keywordsMap],
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

  /* ═══════════════ EFFECTS ═══════════════ */
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
    if (filterCompany !== "전체" && !companiesForView.includes(filterCompany)) {
      setFilterCompany("전체");
    }
  }, [companiesForView, filterCompany]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const syncFromUrl = () => {
      const params = new URLSearchParams(window.location.search);
      const qc = params.get("company");
      const qs = params.get("sentiment");
      if (qc && (qc === "전체" || companiesForView.includes(qc)))
        setFilterCompany((p) => (p === qc ? p : qc));
      if (qs && (qs === "전체" || SENTIMENTS.includes(qs)))
        setFilterSentiment((p) => (p === qs ? p : qs));
      if (!qc) setFilterCompany("전체");
      if (!qs) setFilterSentiment("전체");
    };
    syncFromUrl();
    window.addEventListener("popstate", syncFromUrl);
    return () => window.removeEventListener("popstate", syncFromUrl);
  }, [companiesForView]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (filterCompany === "전체") params.delete("company");
    else params.set("company", filterCompany);
    if (filterSentiment === "전체") params.delete("sentiment");
    else params.set("sentiment", filterSentiment);
    const next = params.toString();
    const nextPath = next
      ? `${window.location.pathname}?${next}`
      : window.location.pathname;
    if (nextPath !== `${window.location.pathname}${window.location.search}`) {
      window.history.replaceState({}, "", nextPath);
    }
  }, [filterCompany, filterSentiment]);

  useEffect(() => {
    const handler = () => {
      if (document.hidden) {
        stopPolling();
        clearScheduledFetch();
        compareAbortRef.current?.abort();
        return;
      }
      if (retryAfterRef.current > 0) return;
      scheduleFetch(0, { force: true });
      startPolling();
    };
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, [clearScheduledFetch, scheduleFetch, startPolling, stopPolling]);

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

  /* ═══════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════ */
  return (
    <Box sx={{ ...pageShellCleanSx, bgcolor: "#f8fafc", minHeight: "100vh", py: { xs: 2, md: 5 } }}>
      <Container maxWidth="xl" sx={pageContainerSx}>
        <Stack spacing={2.5}>
          {/* ───────── HEADER ───────── */}
          <Box
            sx={{
              display: "flex",
              flexDirection: { xs: "column", sm: "row" },
              justifyContent: "space-between",
              alignItems: { sm: "center" },
              gap: 1.5,
            }}
          >
            <Stack direction="row" spacing={1.2} alignItems="center">
              <Box
                sx={{
                  width: 32,
                  height: 32,
                  borderRadius: 2,
                  background: "linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#fff",
                  flexShrink: 0,
                }}
              >
                <BarChart3 size={18} />
              </Box>
              <Box>
                <Typography
                  variant="h5"
                  sx={{
                    fontWeight: 800,
                    fontSize: { xs: 20, md: 22 },
                    color: "#0f172a",
                    lineHeight: 1.2,
                  }}
                >
                  경쟁사 비교 현황판
                </Typography>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.2 }}>
                  <Typography variant="caption" sx={{ color: "text.secondary" }}>
                    {formatRelativeUpdate(lastUpdatedAt)} 갱신
                  </Typography>
                  {loading && (
                    <Box
                      sx={{
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        bgcolor: "#2563eb",
                        animation: "cmp-pulse 1.5s infinite",
                        "@keyframes cmp-pulse": {
                          "0%, 100%": { opacity: 1 },
                          "50%": { opacity: 0.3 },
                        },
                      }}
                    />
                  )}
                </Stack>
              </Box>
            </Stack>

            <Stack direction="row" spacing={0.8}>
              <Button
                component={Link}
                href="/"
                variant="outlined"
                size="small"
                sx={{ ...navButtonSx, borderRadius: 2 }}
              >
                메인
              </Button>
              <Button
                component={Link}
                href="/nexon"
                variant="outlined"
                size="small"
                sx={{ ...navButtonSx, borderRadius: 2 }}
              >
                넥슨 IP 리스크
              </Button>
              <Tooltip title="설정">
                <IconButton
                  size="small"
                  onClick={() => setSettingsOpen((p) => !p)}
                  sx={{
                    border: "1px solid",
                    borderColor: "divider",
                    borderRadius: 2,
                  }}
                >
                  <Settings2 size={16} />
                </IconButton>
              </Tooltip>
            </Stack>
          </Box>

          <ApiGuardBanner />

          {/* ───────── COLLAPSIBLE SETTINGS PANEL ───────── */}
          {settingsOpen && (
            <GlassCard sx={{ px: { xs: 2, md: 2.5 }, py: 2 }}>
              <Typography
                variant="subtitle2"
                sx={{ fontWeight: 700, mb: 1.5, fontSize: 13, color: "#475569" }}
              >
                비교 설정
              </Typography>
              <Stack spacing={1.8}>
                {/* company select */}
                <Box>
                  <Typography
                    variant="caption"
                    sx={{ color: "text.secondary", fontWeight: 600, mb: 0.6, display: "block" }}
                  >
                    게임사 선택
                  </Typography>
                  <Stack direction="row" spacing={0.6} useFlexGap flexWrap="wrap">
                    {DEFAULT_COMPANIES.map((name) => (
                      <Chip
                        key={name}
                        label={name}
                        size="small"
                        onClick={() => toggleSelectedCompany(name)}
                        sx={{
                          fontWeight: 600,
                          fontSize: 12,
                          borderRadius: 1.5,
                          bgcolor: selectedCompanies.includes(name) ? companyColor(name) : "transparent",
                          color: selectedCompanies.includes(name) ? "#fff" : "#475569",
                          border: "1px solid",
                          borderColor: selectedCompanies.includes(name) ? companyColor(name) : "#cbd5e1",
                          "&:hover": { opacity: 0.85 },
                        }}
                      />
                    ))}
                  </Stack>
                </Box>
                {/* window select */}
                <Box>
                  <Typography
                    variant="caption"
                    sx={{ color: "text.secondary", fontWeight: 600, mb: 0.6, display: "block" }}
                  >
                    기간
                  </Typography>
                  <ToggleButtonGroup
                    size="small"
                    exclusive
                    value={windowHours}
                    onChange={(_, v) => {
                      if (v !== null) setSelectedWindowHours(v);
                    }}
                    sx={{
                      "& .MuiToggleButton-root": {
                        borderRadius: 1.5,
                        fontSize: 12,
                        fontWeight: 600,
                        px: 1.5,
                        textTransform: "none",
                      },
                    }}
                  >
                    {WINDOW_HOURS_OPTIONS.map(({ hours, label }) => (
                      <ToggleButton key={hours} value={hours}>
                        {label}
                      </ToggleButton>
                    ))}
                  </ToggleButtonGroup>
                </Box>
                {/* meta info */}
                <Stack direction="row" spacing={1.5} sx={{ color: "text.secondary", fontSize: 12 }}>
                  <Typography variant="caption">회사별 최대 {fetchLimitPerCompany}건 집계</Typography>
                  <Typography variant="caption">
                    자동 갱신 {Math.round(refreshMs / 1000)}초
                  </Typography>
                </Stack>
              </Stack>
            </GlassCard>
          )}

          {/* ───────── CONSOLIDATED ALERTS ───────── */}
          {retryAfterSec ? (
            <Alert
              severity="warning"
              icon={<AlertTriangle size={16} />}
              sx={{ borderRadius: 2.5, "& .MuiAlert-message": { fontSize: 13 } }}
            >
              호출 제한(HTTP 429) — {retryAfterSec}초 후 자동 재시도 (
              {formatRetryAt(retryAfterSec)} KST)
              {errorCode ? ` · ${errorCode}` : ""}
            </Alert>
          ) : null}
          {partialFetch && !retryAfterSec ? (
            <Alert
              severity="warning"
              icon={<AlertTriangle size={16} />}
              sx={{ borderRadius: 2.5, "& .MuiAlert-message": { fontSize: 13 } }}
            >
              일부 회사 데이터 수집 지연
              {timedOutCompanies.length ? ` · 타임아웃: ${timedOutCompanies.join(", ")}` : ""}
              {failedCompanies.length ? ` · 실패: ${failedCompanies.join(", ")}` : ""}
            </Alert>
          ) : null}

          {/* ───────── STATUS VIEW ───────── */}
          <PageStatusView
            spacing={1}
            error={{
              show: hasBlockingError,
              title: "분석 실패",
              details: error,
              diagnosticCode: errorCode,
            }}
            loading={{
              show: loading && !data,
              title: "경쟁사 비교 데이터 확인 중",
              subtitle: "최신 기사와 지표를 업데이트하고 있습니다.",
            }}
            empty={{
              show: shouldShowCompareEmpty,
              title: "표시할 비교 데이터가 없습니다.",
              subtitle: "잠시 후 자동으로 다시 확인합니다.",
            }}
          />

          {/* ═══════════════ DATA SECTIONS ═══════════════ */}
          {data ? (
            <>
              {/* ───────── METRIC CARDS ───────── */}
              <Grid container spacing={{ xs: 1.2, md: 1.5 }}>
                {companyCards.map(({ company, count, state }) => (
                  <Grid item xs={6} md={3} key={company}>
                    <MetricBox
                      label={company}
                      value={Number(count).toLocaleString()}
                      sub="보도 건수"
                      accentColor={companyColor(company)}
                      volumeState={state}
                    />
                  </Grid>
                ))}
              </Grid>

              {/* ───────── TABBED ANALYSIS ───────── */}
              <GlassCard>
                <Tabs
                  value={activeTab}
                  onChange={(_, v) => setActiveTab(v)}
                  variant="scrollable"
                  scrollButtons="auto"
                  sx={{
                    borderBottom: "1px solid",
                    borderColor: "divider",
                    "& .MuiTab-root": {
                      textTransform: "none",
                      fontWeight: 700,
                      fontSize: 13,
                      minHeight: 48,
                      gap: 0.6,
                    },
                    "& .Mui-selected": { color: "#2563eb" },
                    "& .MuiTabs-indicator": {
                      bgcolor: "#2563eb",
                      height: 2.5,
                      borderRadius: 2,
                    },
                  }}
                >
                  {ANALYSIS_TABS.map((tab) => (
                    <Tab
                      key={tab.key}
                      value={tab.key}
                      icon={tab.icon}
                      iconPosition="start"
                      label={tab.label}
                    />
                  ))}
                </Tabs>

                <CardContent sx={{ p: { xs: 2, md: 3 } }}>
                  {/* ──── TREND TAB ──── */}
                  {activeTab === "trend" && (
                    <>
                      <SectionHeader
                        title="보도 추이 (최근 14일)"
                        subtitle={
                          !hasTrendMetricRows && trendMetric !== "count"
                            ? "위기 지수 데이터가 없어 보도량 기준으로 표시합니다."
                            : "일자별 보도량 및 지표 변화"
                        }
                        action={
                          <ToggleButtonGroup
                            size="small"
                            exclusive
                            value={trendMetric}
                            onChange={(_, v) => {
                              if (v !== null) setTrendMetric(v);
                            }}
                            sx={{
                              "& .MuiToggleButton-root": {
                                borderRadius: 1.5,
                                fontSize: 11,
                                fontWeight: 600,
                                px: 1.2,
                                textTransform: "none",
                              },
                            }}
                          >
                            {TREND_METRIC_OPTIONS.map((o) => (
                              <ToggleButton key={o.key} value={o.key}>
                                {o.label}
                              </ToggleButton>
                            ))}
                          </ToggleButtonGroup>
                        }
                      />

                      {rechartsData.length > 0 ? (
                        <Box
                          sx={{
                            bgcolor: CHART_BG,
                            borderRadius: 2.5,
                            p: { xs: 1, md: 2 },
                            border: "1px solid rgba(148,163,184,.1)",
                          }}
                        >
                          <ResponsiveContainer width="100%" height={320}>
                            <BarChart data={rechartsData} barCategoryGap="18%">
                              <CartesianGrid
                                strokeDasharray="3 3"
                                stroke="#e2e8f0"
                                vertical={false}
                              />
                              <XAxis
                                dataKey="date"
                                tick={{ fontSize: 11, fill: "#94a3b8" }}
                                axisLine={false}
                                tickLine={false}
                              />
                              <YAxis
                                tick={{ fontSize: 11, fill: "#94a3b8" }}
                                axisLine={false}
                                tickLine={false}
                                width={36}
                              />
                              <RechartsTooltip content={<ChartTooltipContent />} />
                              <Legend
                                wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
                                formatter={(value) => (
                                  <span style={{ color: "#475569", fontWeight: 600 }}>
                                    {value}
                                  </span>
                                )}
                              />
                              {companiesForView.map((company) => (
                                <Bar
                                  key={company}
                                  dataKey={company}
                                  fill={companyColor(company)}
                                  radius={[3, 3, 0, 0]}
                                  maxBarSize={28}
                                />
                              ))}
                            </BarChart>
                          </ResponsiveContainer>
                        </Box>
                      ) : (
                        <EmptyState
                          title="추이 데이터가 없습니다."
                          subtitle="일자별 집계 데이터가 아직 생성되지 않았습니다."
                          compact
                        />
                      )}
                    </>
                  )}

                  {/* ──── SENTIMENT TAB ──── */}
                  {activeTab === "sentiment" && (
                    <>
                      <SectionHeader title="여론 분포" subtitle="기사 감성 분석 비율" />

                      {sentimentChartData.length > 0 ? (
                        <Box
                          sx={{
                            bgcolor: CHART_BG,
                            borderRadius: 2.5,
                            p: { xs: 1, md: 2 },
                            border: "1px solid rgba(148,163,184,.1)",
                          }}
                        >
                          <ResponsiveContainer
                            width="100%"
                            height={Math.max(200, sentimentChartData.length * 56 + 60)}
                          >
                            <BarChart data={sentimentChartData} layout="vertical" barSize={24}>
                              <CartesianGrid
                                strokeDasharray="3 3"
                                stroke="#e2e8f0"
                                horizontal={false}
                              />
                              <XAxis
                                type="number"
                                domain={[0, 100]}
                                tick={{ fontSize: 11, fill: "#94a3b8" }}
                                axisLine={false}
                                tickLine={false}
                                unit="%"
                              />
                              <YAxis
                                type="category"
                                dataKey="company"
                                width={72}
                                tick={{ fontSize: 12, fill: "#334155", fontWeight: 700 }}
                                axisLine={false}
                                tickLine={false}
                              />
                              <RechartsTooltip
                                content={<ChartTooltipContent />}
                                formatter={(value) => `${Number(value).toFixed(1)}%`}
                              />
                              <Legend
                                wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
                                formatter={(value) => (
                                  <span
                                    style={{
                                      color: SENTIMENT_COLORS[value] || "#475569",
                                      fontWeight: 600,
                                    }}
                                  >
                                    {value}
                                  </span>
                                )}
                              />
                              {SENTIMENTS.map((s) => (
                                <Bar
                                  key={s}
                                  dataKey={s}
                                  stackId="sentiment"
                                  fill={SENTIMENT_COLORS[s]}
                                  radius={0}
                                />
                              ))}
                            </BarChart>
                          </ResponsiveContainer>
                        </Box>
                      ) : (
                        <EmptyState title="여론 데이터가 없습니다." compact />
                      )}

                      {/* sample counts */}
                      <Stack
                        direction="row"
                        spacing={1}
                        useFlexGap
                        flexWrap="wrap"
                        sx={{ mt: 1.5 }}
                      >
                        {sentimentChartData.map((d) => {
                          const vs = getVolumeState(d.count);
                          return (
                            <Stack
                              key={d.company}
                              direction="row"
                              spacing={0.4}
                              alignItems="center"
                            >
                              <Box
                                sx={{
                                  width: 8,
                                  height: 8,
                                  borderRadius: "50%",
                                  bgcolor: companyColor(d.company),
                                  flexShrink: 0,
                                }}
                              />
                              <Typography
                                variant="caption"
                                sx={{ fontWeight: 600, color: "#334155" }}
                              >
                                {d.company}
                              </Typography>
                              <Typography variant="caption" sx={{ color: "text.secondary" }}>
                                {d.count}건
                              </Typography>
                              {vs.tone === "warning" && (
                                <Box
                                  component="span"
                                  sx={{ fontSize: 10, color: "#d97706", fontWeight: 700 }}
                                >
                                  ({vs.label})
                                </Box>
                              )}
                            </Stack>
                          );
                        })}
                      </Stack>
                    </>
                  )}

                  {/* ──── KEYWORDS TAB ──── */}
                  {activeTab === "keywords" && (
                    <>
                      <SectionHeader title="게임사별 주요 키워드" subtitle="빈도 기반 상위 키워드" />
                      <Grid container spacing={1.5}>
                        {keywordCards.map((card) => (
                          <Grid item xs={12} md={6} key={card.company}>
                            <Box
                              sx={{
                                p: 2,
                                borderRadius: 2.5,
                                border: "1px solid rgba(148,163,184,.15)",
                                bgcolor: "#fafbfc",
                              }}
                            >
                              <Stack
                                direction="row"
                                spacing={0.6}
                                alignItems="center"
                                sx={{ mb: 1.2 }}
                              >
                                <Box
                                  sx={{
                                    width: 10,
                                    height: 10,
                                    borderRadius: "50%",
                                    bgcolor: companyColor(card.company),
                                    flexShrink: 0,
                                  }}
                                />
                                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                                  {card.company}
                                </Typography>
                              </Stack>
                              <Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap">
                                {card.items.length > 0 ? (
                                  card.items.map((it) => (
                                    <Box
                                      key={`${card.company}-${it.keyword}`}
                                      sx={{
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: 0.4,
                                        px: 1,
                                        py: 0.3,
                                        borderRadius: 1.5,
                                        bgcolor: "#fff",
                                        border: "1px solid #e2e8f0",
                                        fontSize: 12,
                                        color: "#334155",
                                        transition: "all .15s",
                                        "&:hover": {
                                          borderColor: companyColor(card.company),
                                          color: companyColor(card.company),
                                        },
                                      }}
                                    >
                                      <span style={{ fontWeight: 600 }}>{it.keyword}</span>
                                      <span style={{ color: "#94a3b8", fontSize: 11 }}>
                                        {it.count}
                                      </span>
                                    </Box>
                                  ))
                                ) : (
                                  <Typography variant="caption" sx={{ color: "text.secondary" }}>
                                    키워드 없음
                                  </Typography>
                                )}
                              </Stack>
                            </Box>
                          </Grid>
                        ))}
                      </Grid>
                    </>
                  )}
                </CardContent>
              </GlassCard>

              {/* ───────── INSIGHTS ───────── */}
              <Grid container spacing={1.5}>
                <Grid item xs={12} md={6}>
                  <GlassCard sx={{ height: "100%" }}>
                    <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
                      <Stack
                        direction="row"
                        spacing={0.6}
                        alignItems="center"
                        sx={{ mb: 1.5 }}
                      >
                        <Zap size={15} color="#d97706" />
                        <Typography variant="subtitle2" sx={{ fontWeight: 800, fontSize: 14 }}>
                          주목 이슈 TOP 5
                        </Typography>
                      </Stack>
                      <Stack spacing={0.8}>
                        {(insights.top_issues || []).map((item, idx) => (
                          <Stack
                            key={`${item.company}-${item.keyword}-${idx}`}
                            direction="row"
                            spacing={1}
                            alignItems="baseline"
                          >
                            <Box
                              sx={{
                                width: 20,
                                height: 20,
                                borderRadius: 1,
                                bgcolor: "#f1f5f9",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: 11,
                                fontWeight: 800,
                                color: "#64748b",
                                flexShrink: 0,
                              }}
                            >
                              {idx + 1}
                            </Box>
                            <Typography
                              variant="body2"
                              sx={{ lineHeight: 1.5, color: "#334155" }}
                            >
                              <b style={{ color: companyColor(item.company) }}>
                                {item.company}
                              </b>{" "}
                              {item.keyword}
                              <span
                                style={{ color: "#94a3b8", marginLeft: 4, fontSize: 12 }}
                              >
                                {item.count}건 · {item.share_pct}%
                              </span>
                            </Typography>
                          </Stack>
                        ))}
                        {!(insights.top_issues || []).length && (
                          <Typography variant="caption" sx={{ color: "text.secondary" }}>
                            이슈 데이터 없음
                          </Typography>
                        )}
                      </Stack>
                    </CardContent>
                  </GlassCard>
                </Grid>

                <Grid item xs={12} md={6}>
                  <GlassCard sx={{ height: "100%" }}>
                    <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
                      <Stack
                        direction="row"
                        spacing={0.6}
                        alignItems="center"
                        sx={{ mb: 1.5 }}
                      >
                        <Globe size={15} color="#2563eb" />
                        <Typography variant="subtitle2" sx={{ fontWeight: 800, fontSize: 14 }}>
                          실행 제안
                        </Typography>
                      </Stack>
                      <Stack spacing={0.8}>
                        {(insights.actions || []).map((item) => (
                          <Stack
                            key={`${item.company}-${item.priority}`}
                            direction="row"
                            spacing={1}
                            alignItems="baseline"
                          >
                            <Box
                              sx={{
                                fontSize: 10,
                                fontWeight: 700,
                                px: 0.6,
                                py: 0.15,
                                borderRadius: 0.8,
                                bgcolor:
                                  item.priority === "높음"
                                    ? "rgba(239,68,68,.08)"
                                    : item.priority === "중간"
                                      ? "rgba(245,158,11,.08)"
                                      : "rgba(148,163,184,.08)",
                                color:
                                  item.priority === "높음"
                                    ? "#dc2626"
                                    : item.priority === "중간"
                                      ? "#d97706"
                                      : "#64748b",
                                flexShrink: 0,
                                whiteSpace: "nowrap",
                              }}
                            >
                              {item.priority}
                            </Box>
                            <Typography
                              variant="body2"
                              sx={{ lineHeight: 1.5, color: "#334155" }}
                            >
                              <b>{item.company}</b> {item.action}
                            </Typography>
                          </Stack>
                        ))}
                        {!(insights.actions || []).length && (
                          <Typography variant="caption" sx={{ color: "text.secondary" }}>
                            제안 데이터 없음
                          </Typography>
                        )}
                      </Stack>
                    </CardContent>
                  </GlassCard>
                </Grid>
              </Grid>

              {/* ───────── ARTICLE TABLE ───────── */}
              <GlassCard>
                <CardContent sx={{ p: { xs: 2, md: 3 } }}>
                  <Stack
                    direction={{ xs: "column", md: "row" }}
                    justifyContent="space-between"
                    alignItems={{ md: "center" }}
                    spacing={1}
                    sx={{ mb: 2 }}
                  >
                    <Box>
                      <Typography
                        variant="h6"
                        sx={{ fontWeight: 800, fontSize: 17, color: "#1e293b" }}
                      >
                        최신 기사
                      </Typography>
                      <Typography
                        variant="caption"
                        sx={{ color: "text.secondary" }}
                      >
                        {displayedArticles.length}건 표시 중
                      </Typography>
                    </Box>
                    <Stack direction="row" spacing={0.6}>
                      <Box
                        component="select"
                        value={filterCompany}
                        onChange={(e) => setFilterCompany(e.target.value)}
                        sx={{
                          appearance: "none",
                          border: "1px solid #e2e8f0",
                          borderRadius: 1.5,
                          px: 1.2,
                          py: 0.5,
                          fontSize: 12,
                          fontWeight: 600,
                          color: "#334155",
                          bgcolor: "#fff",
                          cursor: "pointer",
                          outline: "none",
                          "&:focus": { borderColor: "#2563eb" },
                        }}
                      >
                        {articleCompanyFilters.map((c) => (
                          <option key={c} value={c}>
                            {c === "전체" ? "전체 게임사" : c}
                          </option>
                        ))}
                      </Box>
                      <Box
                        component="select"
                        value={filterSentiment}
                        onChange={(e) => setFilterSentiment(e.target.value)}
                        sx={{
                          appearance: "none",
                          border: "1px solid #e2e8f0",
                          borderRadius: 1.5,
                          px: 1.2,
                          py: 0.5,
                          fontSize: 12,
                          fontWeight: 600,
                          color: "#334155",
                          bgcolor: "#fff",
                          cursor: "pointer",
                          outline: "none",
                          "&:focus": { borderColor: "#2563eb" },
                        }}
                      >
                        {SENTIMENT_FILTER_OPTIONS.map((s) => (
                          <option key={s} value={s}>
                            {s === "전체" ? "전체 여론" : s}
                          </option>
                        ))}
                      </Box>
                    </Stack>
                  </Stack>

                  {/* table header */}
                  <Box
                    sx={{
                      display: "grid",
                      gridTemplateColumns: {
                        xs: "80px 1fr 60px 90px",
                        md: "110px 1fr 80px 130px",
                      },
                      gap: 1.5,
                      px: 1.5,
                      py: 0.8,
                      bgcolor: "#f8fafc",
                      borderRadius: 1.5,
                      color: "#64748b",
                      fontSize: 11,
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: ".03em",
                    }}
                  >
                    <Box>게임사</Box>
                    <Box>제목</Box>
                    <Box>여론</Box>
                    <Box>날짜</Box>
                  </Box>

                  {/* table rows */}
                  <Box sx={{ maxHeight: 480, overflowY: "auto", mt: 0.5 }}>
                    {displayedArticles.length > 0 ? (
                      displayedArticles.map((a, idx) => (
                        <Box
                          key={`article-${idx}-${a.title}`}
                          sx={{
                            display: "grid",
                            gridTemplateColumns: {
                              xs: "80px 1fr 60px 90px",
                              md: "110px 1fr 80px 130px",
                            },
                            gap: 1.5,
                            px: 1.5,
                            py: 1,
                            alignItems: "center",
                            borderBottom: "1px solid #f1f5f9",
                            fontSize: 13,
                            transition: "background .1s",
                            "&:hover": { bgcolor: "#f8fafc" },
                          }}
                        >
                          <Stack direction="row" spacing={0.5} alignItems="center">
                            <Box
                              sx={{
                                width: 6,
                                height: 6,
                                borderRadius: "50%",
                                bgcolor: companyColor(a.company),
                                flexShrink: 0,
                              }}
                            />
                            <Typography
                              variant="body2"
                              sx={{ fontWeight: 600, fontSize: 12, color: "#334155" }}
                            >
                              {a.company || "-"}
                            </Typography>
                          </Stack>
                          <Typography
                            component={a.url ? "a" : "span"}
                            href={a.url || undefined}
                            target={a.url ? "_blank" : undefined}
                            rel={a.url ? "noreferrer" : undefined}
                            sx={{
                              minWidth: 0,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              color: "#1e293b",
                              textDecoration: "none",
                              fontSize: 13,
                              "&:hover": {
                                color: "#2563eb",
                                textDecoration: a.url ? "underline" : "none",
                              },
                            }}
                          >
                            {a.title || "(제목 없음)"}
                            {a.url && (
                              <ExternalLink
                                size={11}
                                style={{
                                  marginLeft: 4,
                                  verticalAlign: "middle",
                                  opacity: 0.4,
                                }}
                              />
                            )}
                          </Typography>
                          <Box
                            component="span"
                            sx={{
                              display: "inline-block",
                              fontSize: 11,
                              fontWeight: 700,
                              px: 0.6,
                              py: 0.15,
                              borderRadius: 1,
                              bgcolor:
                                a.sentiment === "긍정"
                                  ? "rgba(16,185,129,.08)"
                                  : a.sentiment === "부정"
                                    ? "rgba(239,68,68,.08)"
                                    : "rgba(148,163,184,.08)",
                              color: SENTIMENT_COLORS[a.sentiment] || "#64748b",
                              textAlign: "center",
                            }}
                          >
                            {a.sentiment || "-"}
                          </Box>
                          <Typography
                            variant="body2"
                            sx={{ color: "text.secondary", fontSize: 12 }}
                          >
                            {a.date || "-"}
                          </Typography>
                        </Box>
                      ))
                    ) : (
                      <Box
                        sx={{
                          py: 4,
                          textAlign: "center",
                          color: "text.secondary",
                          fontSize: 13,
                        }}
                      >
                        조건에 맞는 기사가 없습니다.
                      </Box>
                    )}
                  </Box>
                </CardContent>
              </GlassCard>
            </>
          ) : null}

          {/* ───────── FOOTER ───────── */}
          <Typography
            variant="caption"
            color="text.secondary"
            align="center"
            sx={{ py: 1 }}
          >
            실시간으로 자동 업데이트됩니다 · 최근 {windowHours}시간 기준
          </Typography>
        </Stack>
      </Container>
    </Box>
  );
}
