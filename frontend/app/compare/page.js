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
  Divider,
  Grid,
  Paper,
  Stack,
  Tab,
  Tabs,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import {
  AlertTriangle,
  ExternalLink,
  Info,
  Layers,
  MessageSquare,
  RefreshCw,
  TrendingUp,
} from "lucide-react";
import { List } from "react-window";
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
  navButtonSx,
  pageContainerSx,
  pageShellCleanSx,
  panelPaperSx,
  sectionCardSx,
  sectionTitleSx,
  shadows,
  specTypeSx,
  statusChipSx,
  subPanelSx,
} from "../../lib/uiTokens";

const SENTIMENTS = ["긍정", "중립", "부정"];
const DEFAULT_COMPANIES = ["넥슨", "NC소프트", "넷마블", "크래프톤"];
const DEFAULT_REFRESH_MS = 60000;
const MIN_REFRESH_MS = 10000;
const REQUEST_DEBOUNCE_MS = 350;
const DEFAULT_WINDOW_HOURS = 72;
const LOW_SAMPLE_THRESHOLD = 5;
const ARTICLE_ROW_HEIGHT = 62;
const ARTICLE_LIST_MAX_HEIGHT = 500;
const ARTICLE_LIST_MIN_HEIGHT = 112;
const ARTICLE_GRID_COLUMNS = {
  xs: "92px minmax(220px,1fr) 78px 108px",
  sm: "108px minmax(280px,1fr) 84px 124px",
  md: "120px minmax(320px,1fr) 92px 140px",
};
const WINDOW_HOURS_OPTIONS = [
  { hours: 24, label: "하루" },
  { hours: 72, label: "3일" },
  { hours: 168, label: "일주일" },
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
const INTERACTIVE_CHIP_SX = filterChipSx;
const ICON_TOKEN = Object.freeze({ size: 16, strokeWidth: 2, color: "currentColor" });
const iconProps = (overrides) => ({ ...ICON_TOKEN, ...overrides });
const inlineIconSx = { display: "inline-flex", verticalAlign: "middle", marginRight: "6px" };
const COMPANY_COLORS = {
  넥슨: "#2563eb",
  "NC소프트": "#7c3aed",
  넷마블: "#059669",
  크래프톤: "#d97706",
};
const SENTIMENT_COLORS = { 긍정: "#10b981", 중립: "#94a3b8", 부정: "#ef4444" };

function getVolumeState(count) {
  const safeCount = Number(count || 0);
  if (safeCount <= 0) {
    return {
      label: "0건",
      chipColor: "warning",
      helper: "기사 없음",
      barColor: colors.slate[200],
    };
  }
  if (safeCount < LOW_SAMPLE_THRESHOLD) {
    return {
      label: "소량",
      chipColor: "warning",
      helper: `${LOW_SAMPLE_THRESHOLD}건 미만`,
      barColor: colors.status.warning.main,
    };
  }
  return {
    label: "충분",
    chipColor: "success",
    helper: "분석 가능",
    barColor: colors.chart.blue,
  };
}
const DIAG_SCOPE = {
  rateLimit: buildDiagnosticScope("CMP", "RATE"),
  live: buildDiagnosticScope("CMP", "LIVE"),
};

function getRefreshIntervalMs() {
  const configured = Number(process.env.NEXT_PUBLIC_COMPARE_REFRESH_MS || "");
  if (Number.isFinite(configured) && configured >= MIN_REFRESH_MS) {
    return Math.floor(configured);
  }
  return DEFAULT_REFRESH_MS;
}

function formatKstTimestamp(value) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toLocaleString("ko-KR", {
    hour12: false,
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function clampRetrySeconds(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.max(1, Math.ceil(n));
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

function cycleListValue(items, current) {
  if (!items.length) return "전체";
  const index = items.indexOf(current);
  if (index < 0) return items[0];
  return items[(index + 1) % items.length];
}

function formatRelativeUpdate(value) {
  if (!value) return "갱신 정보 없음";
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return "방금 갱신";
  const diffSec = Math.max(0, Math.floor((Date.now() - dt.getTime()) / 1000));
  if (diffSec < 60) return "방금 갱신";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}분 전`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}시간 전`;
  return `${Math.floor(diffHour / 24)}일 전`;
}

function resolvePriorityTone(priorityRaw) {
  const p = String(priorityRaw || "").trim().toUpperCase();
  if (p === "P1" || p === "높음" || p === "HIGH") {
    return { label: p || "P1", bg: "rgba(239,68,68,.12)", color: "#b91c1c" };
  }
  if (p === "P2" || p === "중간" || p === "MEDIUM") {
    return { label: p || "P2", bg: "rgba(245,158,11,.14)", color: "#b45309" };
  }
  return { label: p || "P3", bg: "rgba(148,163,184,.14)", color: "#475569" };
}

function companyColor(name) {
  return COMPANY_COLORS[name] || "#2563eb";
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
    <Box
      sx={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        height: 3,
        bgcolor: accentColor,
        borderRadius: "12px 12px 0 0",
      }}
    />
    <Typography
      variant="caption"
      sx={{
        color: "text.secondary",
        fontWeight: 600,
        letterSpacing: ".02em",
        textTransform: "uppercase",
        fontSize: 11,
      }}
    >
      {label}
    </Typography>
    <Typography
      variant="h4"
      sx={{
        fontWeight: 800,
        mt: 0.5,
        fontVariantNumeric: "tabular-nums",
        fontSize: { xs: 30, md: 34 },
        lineHeight: 1.1,
        color: "#0f172a",
      }}
    >
      {value}
    </Typography>
    <Stack direction="row" spacing={0.6} alignItems="center" sx={{ mt: 0.8 }}>
      <Typography variant="caption" sx={{ color: "text.secondary" }}>
        {sub}
      </Typography>
      {volumeState ? (
        <Box
          component="span"
          sx={{
            fontSize: 10,
            fontWeight: 700,
            px: 0.8,
            py: 0.15,
            borderRadius: 1,
            bgcolor: volumeState.chipColor === "success" ? "rgba(16,185,129,.1)" : "rgba(245,158,11,.1)",
            color: volumeState.chipColor === "success" ? "#059669" : "#d97706",
          }}
        >
          {volumeState.label}
        </Box>
      ) : null}
    </Stack>
  </Box>
);

export default function ComparePage() {
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
  const insights = data?.insights ?? {};
  const trendRows = data?.trend ?? [];
  const trendMetricRows = data?.trend_metrics ?? [];
  const hasTrendMetricRows = Array.isArray(trendMetricRows) && trendMetricRows.length > 0;
  const sentimentRows = data?.sentiment_summary ?? [];
  const keywordsMap = data?.keywords ?? {};
  const fetchLimitPerCompany = Number(data?.meta?.fetch_limit_per_company || 0);
  const dataSource = String(data?.meta?.source || "").toLowerCase();
  const isDbSource = dataSource === "db";
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

  const companyCards = useMemo(
    () =>
      selectedCompanies.map((name) => ({
        company: name,
        count: Number(companyCounts?.[name] || 0),
        state: getVolumeState(companyCounts?.[name] || 0),
      })),
    [companyCounts, selectedCompanies]
  );
  const lowSampleCompanyCount = useMemo(
    () => companyCards.filter((item) => item.state.label === "소량" || item.state.label === "0건").length,
    [companyCards]
  );
  const liveStatusTone = lowSampleCompanyCount > 0
    ? { bg: colors.status.warning.light, color: colors.status.warning.text, label: "표본 주의" }
    : { bg: colors.status.success.light, color: colors.status.success.text, label: "표본 안정" };

  const scheduleFetch = useCallback(
    (delayMs = REQUEST_DEBOUNCE_MS, { force = false, allowDuringRateLimit = false } = {}) => {
      if (!force && typeof document !== "undefined" && document.hidden) return;
      if (!allowDuringRateLimit && retryAfterRef.current > 0) return;
      clearScheduledFetch();
      debounceTimerRef.current = setTimeout(() => {
        fetchCompare();
      }, delayMs);
    },
    [clearScheduledFetch, fetchCompare]
  );

  const startPolling = useCallback(() => {
    stopPolling();
    if (typeof document !== "undefined" && document.hidden) return;
    if (retryAfterRef.current > 0) return;
    pollTimerRef.current = setInterval(() => {
      scheduleFetch(0);
    }, refreshMs);
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
    const dateOrder = trendRows.slice(-14).map((row) => String(row.date));
    const fallbackDateOrder = Array.from(new Set((trendMetricRows || []).map((row) => String(row.date)))).slice(-14);
    return dateOrder.length ? dateOrder : fallbackDateOrder;
  }, [trendRows, trendMetricRows]);

  const trendMatrix = useMemo(() => {
    const map = new Map();
    for (const row of trendMetricRows || []) {
      map.set(`${row.company}::${String(row.date)}`, row);
    }
    return map;
  }, [trendMetricRows]);

  const trendSeries = useMemo(() => (
    companiesForView.map((company) => {
      const values = trendDates.map((date) => {
        const metric = trendMatrix.get(`${company}::${date}`);
        const countFallback = Number((trendRows.find((row) => String(row.date) === date)?.[company]) || 0);
        const countValue = Number(metric?.count ?? countFallback ?? 0);
        if (trendMetric === "risk") return hasTrendMetricRows ? Number(metric?.risk_score || 0) : countValue;
        if (trendMetric === "heat") return hasTrendMetricRows ? Number(metric?.heat_score || 0) : countValue;
        return countValue;
      });
      return {
        name: company,
        type: "bar",
        data: values,
        itemStyle: { color: companyColor(company), borderRadius: [4, 4, 0, 0] },
      };
    })
  ), [companiesForView, hasTrendMetricRows, trendDates, trendMatrix, trendMetric, trendRows]);

  const trendDateRangeLabel = useMemo(() => {
    if (!trendDates.length) return "";
    const first = trendDates[0];
    const last = trendDates[trendDates.length - 1];
    return first === last ? first : `${first} ~ ${last}`;
  }, [trendDates]);

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
  const articleListHeight = useMemo(() => {
    const estimated = displayedArticles.length * ARTICLE_ROW_HEIGHT;
    if (!estimated) return ARTICLE_LIST_MIN_HEIGHT;
    return Math.max(ARTICLE_LIST_MIN_HEIGHT, Math.min(ARTICLE_LIST_MAX_HEIGHT, estimated));
  }, [displayedArticles.length]);

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
      const queryCompany = params.get("company");
      const querySentiment = params.get("sentiment");
      if (queryCompany && (queryCompany === "전체" || companiesForView.includes(queryCompany))) {
        setFilterCompany((prev) => (prev === queryCompany ? prev : queryCompany));
      }
      if (querySentiment && (querySentiment === "전체" || SENTIMENTS.includes(querySentiment))) {
        setFilterSentiment((prev) => (prev === querySentiment ? prev : querySentiment));
      }
      if (!queryCompany) setFilterCompany("전체");
      if (!querySentiment) setFilterSentiment("전체");
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
    const nextQuery = params.toString();
    const nextPath = nextQuery ? `${window.location.pathname}?${nextQuery}` : window.location.pathname;
    const currentPath = `${window.location.pathname}${window.location.search}`;
    if (nextPath !== currentPath) {
      window.history.replaceState({}, "", nextPath);
    }
  }, [filterCompany, filterSentiment]);

  useEffect(() => {
    const onVisibilityChange = () => {
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
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
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

  useEffect(() => {
    if (activeTab !== "trend") {
      trendChartRef.current?.dispose();
      trendChartRef.current = null;
      return undefined;
    }

    let disposed = false;
    (async () => {
      if (!trendRef.current || !trendDates.length) return;
      const echarts = await import("echarts");
      if (disposed || !trendRef.current) return;

      if (trendChartRef.current && trendChartRef.current.getDom() !== trendRef.current) {
        trendChartRef.current.dispose();
        trendChartRef.current = null;
      }
      if (!trendChartRef.current) {
        trendChartRef.current = echarts.init(trendRef.current);
      }

      trendChartRef.current.setOption({
        animation: true,
        tooltip: { trigger: "axis" },
        legend: { top: 4 },
        grid: { left: 32, right: 16, bottom: 24, top: 36, containLabel: true },
        xAxis: { type: "category", data: trendDates, axisLabel: { color: "#64748b" } },
        yAxis: { type: "value", axisLabel: { color: "#64748b" } },
        series: trendSeries,
      }, true);
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
    if (activeTab !== "sentiment") {
      sentimentChartRef.current?.dispose();
      sentimentChartRef.current = null;
      return undefined;
    }

    let disposed = false;
    (async () => {
      if (!sentimentRef.current) return;
      const echarts = await import("echarts");
      if (disposed || !sentimentRef.current) return;

      if (sentimentChartRef.current && sentimentChartRef.current.getDom() !== sentimentRef.current) {
        sentimentChartRef.current.dispose();
        sentimentChartRef.current = null;
      }
      if (!sentimentChartRef.current) {
        sentimentChartRef.current = echarts.init(sentimentRef.current);
      }

      sentimentChartRef.current.setOption({
        animation: true,
        tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
        legend: { top: 4 },
        grid: { left: 48, right: 20, bottom: 24, top: 36, containLabel: true },
        xAxis: { type: "value", max: 100, axisLabel: { color: "#64748b", formatter: "{value}%" } },
        yAxis: { type: "category", data: sentimentChartData.map((d) => d.company), axisLabel: { color: "#334155" } },
        series: SENTIMENTS.map((sentiment) => ({
          name: sentiment,
          type: "bar",
          stack: "sentiment",
          data: sentimentChartData.map((d) => d[sentiment]),
          itemStyle: { color: SENTIMENT_COLORS[sentiment] },
        })),
      }, true);
      sentimentChartRef.current.resize();
    })();

    const onResize = () => sentimentChartRef.current?.resize();
    window.addEventListener("resize", onResize);
    return () => {
      disposed = true;
      window.removeEventListener("resize", onResize);
    };
  }, [activeTab, sentimentChartData]);

  useEffect(() => () => {
    trendChartRef.current?.dispose();
    sentimentChartRef.current?.dispose();
  }, []);

  return (
    <Box sx={{ ...pageShellCleanSx, py: { xs: 2.5, md: 6 } }}>
      <Container maxWidth="xl" sx={pageContainerSx}>
        <Stack spacing={2.5}>
          <Paper sx={{ ...panelPaperSx, bgcolor: "#f8fafc", px: { xs: 2, md: 3 }, py: 1.4, boxShadow: "0 8px 24px rgba(15,23,42,.04)" }}>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              alignItems={{ xs: "flex-start", sm: "center" }}
              justifyContent="space-between"
              spacing={1.2}
            >
              <Stack direction="row" spacing={1} alignItems="center">
                <Box
                  sx={{
                    width: 22,
                    height: 22,
                    borderRadius: 1.2,
                    background:
                      `linear-gradient(140deg,${colors.brand.nexon.primary} 0 58%,${colors.status.success.main} 58% 100%)`,
                  }}
                />
                <Typography
                  sx={{
                    ...specTypeSx.h6,
                    fontSize: { xs: 20, md: 22 },
                    color: colors.slate[900],
                  }}
                >
                  경쟁사 비교 현황판
                </Typography>
              </Stack>
              <Stack
                direction="row"
                spacing={1}
                sx={{ width: { xs: "100%", sm: "auto" }, justifyContent: { xs: "flex-end", sm: "flex-start" } }}
              >
                <Button component={Link} href="/" variant="outlined" size="small" sx={navButtonSx}>메인</Button>
                <Button component={Link} href="/nexon" variant="outlined" size="small" sx={navButtonSx}>넥슨 IP 리스크</Button>
              </Stack>
            </Stack>
            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mt: 1 }}>
              <Chip size="small" variant="outlined" label={`최근 갱신: ${formatKstTimestamp(lastUpdatedAt)}`} sx={statusChipSx} />
              <Chip
                size="small"
                variant="outlined"
                label={<span><RefreshCw {...iconProps()} style={inlineIconSx} />{Math.round(refreshMs / 1000)}초마다 자동 업데이트</span>}
                sx={statusChipSx}
              />
              <Chip
                size="small"
                label={liveStatusTone.label}
                sx={{
                  ...statusChipSx,
                  bgcolor: liveStatusTone.bg,
                  color: liveStatusTone.color,
                  border: "none",
                  fontWeight: 700,
                }}
              />
              <Chip
                size="small"
                variant="outlined"
                label={isDbSource ? "DB 기반 집계" : "실시간 집계"}
                sx={statusChipSx}
              />
            </Stack>
          </Paper>

          <ApiGuardBanner />

          <Paper
            variant="outlined"
            sx={{
              ...subPanelSx,
              bgcolor: "#ffffff",
              borderColor: colors.slate[200],
              py: 1.2,
              px: { xs: 1.5, md: 2 },
            }}
          >
            <Stack direction={{ xs: "column", md: "row" }} spacing={0.9} justifyContent="space-between">
              <Stack direction="row" spacing={0.8} useFlexGap flexWrap="wrap">
                <Chip size="small" variant="outlined" label={`선택 게임사 ${selectedCompanies.length}개`} sx={INTERACTIVE_CHIP_SX} />
                <Chip size="small" variant="outlined" label={`최근 ${windowHours}시간`} sx={INTERACTIVE_CHIP_SX} />
                <Chip size="small" variant="outlined" label={`총 기사 ${Number(total || 0).toLocaleString()}건`} sx={INTERACTIVE_CHIP_SX} />
                <Chip size="small" variant="outlined" label={`저표본 ${lowSampleCompanyCount}개`} sx={INTERACTIVE_CHIP_SX} />
              </Stack>
              <Typography variant="caption" sx={{ color: colors.slate[500], alignSelf: { xs: "flex-start", md: "center" } }}>
                상태: {formatRelativeUpdate(lastUpdatedAt)} · 비교 지표는 서버 산출값 기준
              </Typography>
            </Stack>
          </Paper>

          <GlassCard sx={{ px: { xs: 2, md: 2.5 }, py: 2 }}>
            <Typography
              variant="subtitle2"
              sx={{ fontWeight: 700, mb: 1.5, fontSize: 13, color: "#475569" }}
            >
              비교 설정
            </Typography>
            <Stack spacing={1.8}>
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
                  onChange={(_, value) => {
                    if (value !== null) setSelectedWindowHours(value);
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
              <Stack direction="row" spacing={1.5} sx={{ color: "text.secondary", fontSize: 12 }}>
                <Typography variant="caption">
                  {isDbSource
                    ? "DB 기간 집계"
                    : fetchLimitPerCompany > 0
                      ? `회사별 최대 ${fetchLimitPerCompany}건 집계`
                      : "기간 집계"}
                </Typography>
                <Typography variant="caption">
                  자동 갱신 {Math.round(refreshMs / 1000)}초
                </Typography>
              </Stack>
            </Stack>
          </GlassCard>

          <PageStatusView
            spacing={1}
            error={{
              show: hasBlockingError,
              title: "분석 실패",
              details: error,
              diagnosticCode: errorCode,
            }}
            loading={{
              show: loading,
              title: "경쟁사 비교 데이터 확인 중",
              subtitle: isDbSource
                ? "DB에 적재된 최신 기사와 지표를 불러오고 있습니다."
                : "최신 기사와 지표를 업데이트하고 있습니다.",
            }}
          />

          <PageStatusView
            empty={{
              show: shouldShowCompareEmpty,
              title: "표시할 비교 데이터가 없습니다.",
              subtitle: isDbSource
                ? "아직 DB 적재 데이터가 부족합니다. 수집 주기 후 다시 확인합니다."
                : "잠시 후 자동으로 다시 확인합니다.",
            }}
          />

          {data ? (
            <>
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

              <GlassCard sx={{ ...sectionCardSx, boxShadow: shadows.lg, overflow: "hidden" }}>
                <Tabs
                  value={activeTab}
                  onChange={(_, value) => setActiveTab(value)}
                  variant="scrollable"
                  scrollButtons="auto"
                  sx={{
                    borderBottom: `1px solid ${colors.slate[200]}`,
                    px: { xs: 0.5, md: 1.2 },
                    "& .MuiTab-root": {
                      textTransform: "none",
                      fontWeight: 700,
                      fontSize: 13,
                      minHeight: 52,
                      gap: 0.7,
                    },
                    "& .Mui-selected": { color: colors.brand.nexon.primary },
                    "& .MuiTabs-indicator": {
                      bgcolor: colors.brand.nexon.primary,
                      height: 2.5,
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

                <CardContent sx={contentCardSx}>
                  {activeTab === "trend" ? (
                    <>
                      <Typography variant="h6" sx={{ ...sectionTitleSx, mb: 0.4, lineHeight: 1.3 }}>
                        보도 추이 (최근 14일)
                      </Typography>
                      <Typography variant="body2" sx={{ color: colors.slate[500], display: "block", mb: 1.2 }}>
                        지표는 시스템 산출값입니다.
                      </Typography>
                      <Stack direction="row" spacing={0.8} useFlexGap flexWrap="wrap" sx={{ mb: 1 }}>
                        {TREND_METRIC_OPTIONS.map((option) => (
                          <Chip
                            key={option.key}
                            clickable
                            label={option.label}
                            onClick={() => setTrendMetric(option.key)}
                            color={trendMetric === option.key ? "primary" : "default"}
                            variant={trendMetric === option.key ? "filled" : "outlined"}
                            sx={INTERACTIVE_CHIP_SX}
                          />
                        ))}
                      </Stack>
                      {!hasTrendMetricRows && trendMetric !== "count" ? (
                        <Alert severity="info" icon={false} sx={{ mb: 1.1, borderRadius: 1.5 }}>
                          <span><Info {...iconProps()} style={inlineIconSx} />위기 지수 추이 데이터가 없어 보도량 추이로 표시합니다.</span>
                        </Alert>
                      ) : null}
                      {!trendDates.length ? (
                        <EmptyState title="추이 데이터가 없습니다." subtitle="일자별 집계 데이터가 아직 생성되지 않았습니다." compact />
                      ) : (
                        <Box ref={trendRef} sx={{ width: "100%", height: 340 }} />
                      )}
                      {trendDateRangeLabel ? (
                        <Typography variant="body2" sx={{ color: colors.slate[500], mt: 1.2 }}>
                          기준 일자: {trendDateRangeLabel} · 단위: {
                            trendMetric === "count" || !hasTrendMetricRows
                              ? "기사 건수"
                              : "지수(0~100)"
                          }
                        </Typography>
                      ) : null}
                    </>
                  ) : null}

                  {activeTab === "sentiment" ? (
                    <>
                      <Typography variant="h6" sx={{ ...sectionTitleSx, mb: 0.4 }}>
                        여론 분포
                      </Typography>
                      <Typography variant="body2" sx={{ color: colors.slate[500], display: "block", mb: 1.2 }}>
                        기사가 없으면 여론 비율을 계산할 수 없습니다.
                      </Typography>
                      {sentimentChartData.length ? (
                        <Box ref={sentimentRef} sx={{ width: "100%", height: 340 }} />
                      ) : (
                        <EmptyState title="여론 데이터가 없습니다." compact />
                      )}
                    </>
                  ) : null}

                  {activeTab === "keywords" ? (
                    <>
                      <Typography variant="h6" sx={{ ...sectionTitleSx, mb: 1.2 }}>
                        게임사별 주요 키워드
                      </Typography>
                      <Grid container spacing={1.1}>
                        {keywordCards.map((card) => (
                          <Grid item xs={12} md={6} key={card.company} sx={{ display: "flex", minWidth: 0 }}>
                            <Paper variant="outlined" sx={{ ...subPanelSx, width: "100%", height: "100%" }}>
                              <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.8 }}>
                                {card.company}
                              </Typography>
                              <Stack direction="row" spacing={0.8} useFlexGap flexWrap="wrap">
                                {card.items.map((it) => (
                                  <Chip
                                    key={`${card.company}-${it.keyword}`}
                                    size="small"
                                    variant="outlined"
                                    label={`${it.keyword} · ${it.count}`}
                                    sx={INTERACTIVE_CHIP_SX}
                                  />
                                ))}
                              </Stack>
                            </Paper>
                          </Grid>
                        ))}
                      </Grid>
                    </>
                  ) : null}
                </CardContent>
              </GlassCard>

              <GlassCard sx={{ ...sectionCardSx, boxShadow: shadows.md }}>
                <CardContent sx={contentCardSx}>
                  <Typography variant="h6" sx={{ ...sectionTitleSx, mb: 1.2 }}>
                    대응 인사이트
                  </Typography>
                  <Grid container spacing={1.1}>
                    <Grid item xs={12} md={6} sx={{ display: "flex", minWidth: 0 }}>
                      <Paper variant="outlined" sx={{ ...subPanelSx, height: "100%", width: "100%" }}>
                        <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.8 }}>
                          주목 이슈 TOP 5
                        </Typography>
                        <Stack spacing={0.8}>
                          {(insights.top_issues || []).map((item, idx) => (
                            <Typography
                              key={`${item.company}-${item.keyword}-${idx}`}
                              variant="body2"
                              sx={{ color: colors.slate[600], lineHeight: 1.55 }}
                            >
                              <b>{item.company}</b> · {item.keyword} ({item.count}건, {item.share_pct}%)
                            </Typography>
                          ))}
                        </Stack>
                      </Paper>
                    </Grid>
                    <Grid item xs={12} md={6} sx={{ display: "flex", minWidth: 0 }}>
                      <Paper variant="outlined" sx={{ ...subPanelSx, height: "100%", width: "100%" }}>
                        <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.8 }}>
                          실행 제안
                        </Typography>
                        <Stack spacing={0.8}>
                          {(insights.actions || []).map((item) => (
                            (() => {
                              const tone = resolvePriorityTone(item.priority);
                              return (
                                <Stack
                                  key={`${item.company}-${item.priority}`}
                                  direction="row"
                                  spacing={0.7}
                                  alignItems="baseline"
                                >
                                  <Box
                                    component="span"
                                    sx={{
                                      fontSize: 11,
                                      fontWeight: 700,
                                      px: 0.7,
                                      py: 0.15,
                                      borderRadius: 0.9,
                                      bgcolor: tone.bg,
                                      color: tone.color,
                                      whiteSpace: "nowrap",
                                      flexShrink: 0,
                                    }}
                                  >
                                    {tone.label}
                                  </Box>
                                  <Typography variant="body2" sx={{ color: colors.slate[600], lineHeight: 1.55 }}>
                                    <b>{item.company}</b> {item.action}
                                  </Typography>
                                </Stack>
                              );
                            })()
                          ))}
                        </Stack>
                      </Paper>
                    </Grid>
                  </Grid>
                </CardContent>
              </GlassCard>

              <GlassCard sx={sectionCardSx}>
                <CardContent sx={contentCardSx}>
                  <Stack
                    direction={{ xs: "column", md: "row" }}
                    justifyContent="space-between"
                    spacing={1.2}
                    sx={{ mb: 1.2 }}
                  >
                    <Typography variant="h6" sx={sectionTitleSx}>
                      최신 기사
                    </Typography>
                    <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                      <Chip
                        size="small"
                        label={`게임사: ${filterCompany}`}
                        variant="outlined"
                        onClick={() => setFilterCompany((prev) => cycleListValue(articleCompanyFilters, prev))}
                        sx={INTERACTIVE_CHIP_SX}
                      />
                      <Chip
                        size="small"
                        label={`여론: ${filterSentiment}`}
                        variant="outlined"
                        onClick={() => setFilterSentiment((prev) => cycleListValue(SENTIMENT_FILTER_OPTIONS, prev))}
                        sx={INTERACTIVE_CHIP_SX}
                      />
                      <Chip
                        size="small"
                        label={`표시 중: ${displayedArticles.length}건`}
                        variant="outlined"
                        sx={INTERACTIVE_CHIP_SX}
                      />
                    </Stack>
                  </Stack>

                  <Box sx={{ overflowX: "auto" }}>
                    <Box
                      sx={{
                        display: "grid",
                        gridTemplateColumns: ARTICLE_GRID_COLUMNS,
                        gap: 1,
                        px: 1.2,
                        pb: 0.8,
                        color: "text.secondary",
                        fontSize: 14,
                        fontWeight: 700,
                      }}
                    >
                      <Box>게임사</Box>
                      <Box>제목</Box>
                      <Box>여론</Box>
                      <Box>날짜</Box>
                    </Box>
                    {displayedArticles.length ? (
                      <List
                        rowCount={displayedArticles.length}
                        rowHeight={ARTICLE_ROW_HEIGHT}
                        overscanCount={6}
                        defaultHeight={ARTICLE_LIST_MIN_HEIGHT}
                        style={{ height: articleListHeight, width: "100%" }}
                        rowProps={{ items: displayedArticles }}
                        rowComponent={({ index, style, items }) => {
                          const a = items[index];
                          return (
                            <Box
                              style={style}
                              sx={{
                                display: "grid",
                                gridTemplateColumns: ARTICLE_GRID_COLUMNS,
                                gap: 1,
                                alignItems: "center",
                                borderTop: "1px solid",
                                borderColor: colors.slate[200],
                                px: 1.2,
                                fontSize: 14,
                                "&:hover": { bgcolor: colors.primary[50] },
                              }}
                            >
                              <Stack direction="row" spacing={0.5} alignItems="center">
                                <Box
                                  sx={{
                                    width: 7,
                                    height: 7,
                                    borderRadius: "50%",
                                    bgcolor: companyColor(a.company),
                                    flexShrink: 0,
                                  }}
                                />
                                <Typography variant="body2" sx={{ fontWeight: 700 }}>
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
                                  color: colors.brand.nexon.primary,
                                  textDecoration: "none",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                  "&:hover": { textDecoration: a.url ? "underline" : "none" },
                                }}
                              >
                                {a.title || "(제목 없음)"}
                                {a.url ? (
                                  <ExternalLink
                                    size={11}
                                    style={{ marginLeft: 4, verticalAlign: "middle", opacity: 0.45 }}
                                  />
                                ) : null}
                              </Typography>
                              <Typography
                                variant="body2"
                                sx={{
                                  fontSize: 12,
                                  fontWeight: 700,
                                  color:
                                    a.sentiment === "긍정"
                                      ? "#059669"
                                      : a.sentiment === "부정"
                                        ? "#dc2626"
                                        : "#64748b",
                                }}
                              >
                                {a.sentiment || "-"}
                              </Typography>
                              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                                {a.date || "-"}
                              </Typography>
                            </Box>
                          );
                        }}
                      />
                    ) : (
                      <Box sx={{ py: 2, px: 1.2, color: "text.secondary" }}>
                        조건에 맞는 기사가 없습니다.
                      </Box>
                    )}
                  </Box>
                </CardContent>
              </GlassCard>
            </>
          ) : null}

          <Divider sx={{ my: 1 }} />
          <Typography variant="caption" color="text.secondary" align="center">
            {isDbSource
              ? "DB 적재 기사 기준으로 자동 업데이트됩니다."
              : "실시간으로 자동 업데이트됩니다."}
          </Typography>
        </Stack>
      </Container>
    </Box>
  );
}
