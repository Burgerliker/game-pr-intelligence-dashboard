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
  LinearProgress,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import { AlertTriangle, Info, RefreshCw } from "lucide-react";
import { List } from "react-window";
import {
  apiGet,
  getRetryAfterSeconds,
} from "../../../lib/api";
import ApiGuardBanner from "../../../components/ApiGuardBanner";
import EmptyState from "../../../components/EmptyState";
import PageStatusView from "../../../components/PageStatusView";
import {
  buildDiagnosticScope,
  shouldShowEmptyState,
  toRequestErrorState,
} from "../../../lib/pageStatus";
import {
  filterChipSx,
  metricCardSx,
  navButtonSx,
  pageContainerSx,
  pageShellCleanSx,
  panelPaperSx,
  sectionCardSx,
  statusChipSx,
} from "../../../lib/uiTokens";

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
const INTERACTIVE_CHIP_SX = filterChipSx;
const ICON_TOKEN = Object.freeze({ size: 16, strokeWidth: 2, color: "currentColor" });
const iconProps = (overrides) => ({ ...ICON_TOKEN, ...overrides });
const inlineIconSx = { display: "inline-flex", verticalAlign: "middle", marginRight: "6px" };

function getVolumeState(count) {
  const safeCount = Number(count || 0);
  if (safeCount <= 0) {
    return {
      label: "0건",
      chipColor: "warning",
      helper: "기사 없음",
      barColor: "#e2e8f0",
    };
  }
  if (safeCount < LOW_SAMPLE_THRESHOLD) {
    return {
      label: "소량",
      chipColor: "warning",
      helper: `${LOW_SAMPLE_THRESHOLD}건 미만`,
      barColor: "#f59e0b",
    };
  }
  return {
    label: "충분",
    chipColor: "success",
    helper: "분석 가능",
    barColor: "#2f67d8",
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

  const inFlightRef = useRef(false);
  const compareReqSeqRef = useRef(0);
  const compareAbortRef = useRef(null);
  const pollTimerRef = useRef(null);
  const debounceTimerRef = useRef(null);
  const retryAfterRef = useRef(0);

  const total = data?.meta?.total_articles ?? 0;
  const companyCounts = data?.company_counts ?? {};
  const insights = data?.insights ?? {};
  const trendRows = data?.trend ?? [];
  const trendMetricRows = data?.trend_metrics ?? [];
  const hasTrendMetricRows = Array.isArray(trendMetricRows) && trendMetricRows.length > 0;
  const sentimentRows = data?.sentiment_summary ?? [];
  const keywordsMap = data?.keywords ?? {};
  const lowSampleThreshold = Number(data?.meta?.low_sample_threshold || LOW_SAMPLE_THRESHOLD);
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
        limit: "40",
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

  const trendSeries = useMemo(() => {
    if (!companiesForView.length) return [];
    const dateOrder = trendRows.slice(-14).map((row) => String(row.date));
    const fallbackDateOrder = Array.from(new Set((trendMetricRows || []).map((row) => String(row.date)))).slice(-14);
    const dates = dateOrder.length ? dateOrder : fallbackDateOrder;
    if (!dates.length) return [];

    const trendCountMap = new Map();
    for (const row of trendRows) {
      const day = String(row?.date || "");
      if (!day) continue;
      for (const company of companiesForView) {
        trendCountMap.set(`${company}::${day}`, Number(row?.[company] || 0));
      }
    }

    return companiesForView.map((company) => {
      const rows = (trendMetricRows || []).filter((row) => row.company === company);
      const byDate = new Map(rows.map((row) => [String(row.date), row]));
      const points = dates.map((date) => {
        const row = byDate.get(date);
        const countValue = Number(
          row?.count ??
            trendCountMap.get(`${company}::${date}`) ??
            0
        );
        const value = trendMetric === "risk"
          ? (hasTrendMetricRows ? Number(row?.risk_score || 0) : countValue)
          : trendMetric === "heat"
            ? (hasTrendMetricRows ? Number(row?.heat_score || 0) : countValue)
            : countValue;
        return {
          date,
          value,
          sampleSize: Number(row?.sample_size || countValue || 0),
          qualityFlag: String(row?.quality_flag || (countValue < lowSampleThreshold ? "LOW_SAMPLE" : "OK")),
        };
      });
      const max = Math.max(...points.map((p) => p.value), 0);
      const hasData = points.some((p) => p.value > 0);
      const hasLowSample = points.some((p) => p.qualityFlag === "LOW_SAMPLE");
      return { company, points, max, hasData, hasLowSample };
    });
  }, [companiesForView, hasTrendMetricRows, lowSampleThreshold, trendMetric, trendMetricRows, trendRows]);

  const hasAnyTrendData = useMemo(
    () => trendSeries.some((series) => series.hasData),
    [trendSeries]
  );
  const hasTrendLowSample = useMemo(
    () => trendMetric !== "count" && trendSeries.some((series) => series.hasLowSample),
    [trendMetric, trendSeries]
  );
  const trendDateRangeLabel = useMemo(() => {
    const base = trendSeries[0]?.points || [];
    if (!base.length) return "";
    const first = String(base[0]?.date || "");
    const last = String(base[base.length - 1]?.date || "");
    if (!first || !last) return "";
    return first === last ? first : `${first} ~ ${last}`;
  }, [trendSeries]);

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

  return (
    <Box sx={{ ...pageShellCleanSx, py: { xs: 2, md: 5 } }}>
      <Container maxWidth="xl" sx={pageContainerSx}>
        <Stack spacing={2.3}>
          <Paper sx={{ ...panelPaperSx, bgcolor: "#f8fafc", px: { xs: 2, md: 3 }, py: 1.2, boxShadow: "0 8px 24px rgba(15,23,42,.04)" }}>
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
                      "linear-gradient(140deg,#0f3b66 0 58%,#9acb19 58% 100%)",
                  }}
                />
                <Typography
                  sx={{
                    fontSize: 20,
                    fontWeight: 800,
                    color: "#0f172a",
                    letterSpacing: "-.01em",
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
                <Button component={Link} href="/rebuild" variant="outlined" size="small" sx={navButtonSx}>메인</Button>
                <Button component={Link} href="/rebuild/nexon" variant="outlined" size="small" sx={navButtonSx}>넥슨 IP 리스크</Button>
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
            </Stack>
          </Paper>

          <ApiGuardBanner />

          <Card
            variant="outlined"
            sx={sectionCardSx}
          >
            <CardContent>
              <Stack spacing={1.3}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                  비교할 게임사
                </Typography>
                <Alert severity="info" icon={false} sx={{ borderRadius: 2 }}>
                  <span><Info {...iconProps()} style={inlineIconSx} />최근 {windowHours}시간 기사 기준입니다.</span>
                </Alert>
                <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                  {DEFAULT_COMPANIES.map((name) => (
                    <Chip
                      key={name}
                      label={name}
                      onClick={() => toggleSelectedCompany(name)}
                      color={selectedCompanies.includes(name) ? "primary" : "default"}
                      variant={selectedCompanies.includes(name) ? "filled" : "outlined"}
                      sx={INTERACTIVE_CHIP_SX}
                    />
                  ))}
                </Stack>
                <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                  {WINDOW_HOURS_OPTIONS.map(({ hours, label }) => (
                    <Chip
                      key={hours}
                      label={label}
                      onClick={() => setSelectedWindowHours(hours)}
                      color={windowHours === hours ? "primary" : "default"}
                      variant={windowHours === hours ? "filled" : "outlined"}
                      sx={INTERACTIVE_CHIP_SX}
                    />
                  ))}
                </Stack>
                {retryAfterSec ? (
                  <Alert severity="warning" icon={false} sx={{ borderRadius: 2 }}>
                    <span><AlertTriangle {...iconProps()} style={inlineIconSx} />호출 제한(HTTP 429): 요청량이 많습니다.</span>
                    {` ${retryAfterSec}초 후 자동 재시도 예정 (${formatRetryAt(retryAfterSec)} KST)`}
                    {errorCode ? ` · 호출 제한 중 (${errorCode})` : ""}
                  </Alert>
                ) : null}
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
                    subtitle: "최신 기사와 지표를 업데이트하고 있습니다.",
                  }}
                />
              </Stack>
            </CardContent>
          </Card>

          <PageStatusView
            empty={{
              show: shouldShowCompareEmpty,
              title: "표시할 비교 데이터가 없습니다.",
              subtitle: "잠시 후 자동으로 다시 확인합니다.",
            }}
          />

          {data ? (
            <>
              <Grid container spacing={{ xs: 1.1, md: 1.6 }}>
                {companyCards.map(({ company, count, state }) => (
                  <Grid item xs={6} md={4} xl={2} key={company} sx={{ display: "flex", minWidth: 0 }}>
                    <Box sx={{ ...metricCardSx, height: "100%", width: "100%", display: "flex", flexDirection: "column" }}>
                      <Box sx={{ height: 3, bgcolor: state.barColor, flexShrink: 0 }} />
                      <Box sx={{ p: { xs: 1.6, md: 2 }, flex: 1, minWidth: 0 }}>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 0.4 }}>
                          {company}
                        </Typography>
                        <Typography variant="h4" sx={{ fontWeight: 800, lineHeight: 1.12, fontVariantNumeric: "tabular-nums" }}>
                          {Number(count).toLocaleString()}
                        </Typography>
                        <Stack direction="row" spacing={0.8} alignItems="center" sx={{ mt: 0.6 }}>
                          <Typography variant="caption" sx={{ color: "#64748b" }}>
                            보도 건수
                          </Typography>
                          <Chip size="small" color={state.chipColor} variant="outlined" label={state.label} sx={INTERACTIVE_CHIP_SX} />
                        </Stack>
                        <Typography variant="caption" sx={{ color: "#64748b", display: "block", mt: 0.4 }}>
                          {state.helper}
                        </Typography>
                      </Box>
                    </Box>
                  </Grid>
                ))}
                <Grid item xs={6} md={4} xl={2} sx={{ display: "flex", minWidth: 0 }}>
                  <Box sx={{ ...metricCardSx, height: "100%", width: "100%", display: "flex", flexDirection: "column" }}>
                    <Box sx={{ height: 3, bgcolor: "#0f3b66", flexShrink: 0 }} />
                    <Box sx={{ p: { xs: 1.6, md: 2 }, flex: 1, minWidth: 0 }}>
                      <Typography variant="body2" color="text.secondary">
                        총합
                      </Typography>
                      <Typography variant="h4" sx={{ fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>
                        {Number(total).toLocaleString()}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        전체 기사
                      </Typography>
                    </Box>
                  </Box>
                </Grid>
              </Grid>
              <Stack direction="row" spacing={0.9} useFlexGap flexWrap="wrap" sx={{ mt: 0.8, mb: 0.4 }}>
                <Chip label="0건: 기사 없음" color="warning" variant="outlined" sx={INTERACTIVE_CHIP_SX} />
                <Chip label={`소량: ${LOW_SAMPLE_THRESHOLD}건 미만`} color="warning" variant="outlined" sx={INTERACTIVE_CHIP_SX} />
                <Chip label="충분: 분석 가능" color="success" variant="outlined" sx={INTERACTIVE_CHIP_SX} />
              </Stack>

              <Grid container spacing={{ xs: 1.2, md: 1.6 }}>
                <Grid item xs={12} md={6} sx={{ display: "flex", minWidth: 0 }}>
                  <Card
                    variant="outlined"
                    sx={{ ...sectionCardSx, width: "100%" }}
                  >
                    <CardContent sx={{ p: { xs: 1.35, md: 1.6 } }}>
                      <Typography variant="h6" sx={{ fontWeight: 800, mb: 0.4, lineHeight: 1.3, borderLeft: "3px solid #0f3b66", pl: 1.5 }}>
                        보도 추이 (최근 14일)
                      </Typography>
                      <Typography variant="body2" sx={{ color: "#64748b", display: "block", mb: 1.2 }}>
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
                      {hasTrendLowSample ? (
                        <Alert severity="warning" icon={false} sx={{ mb: 1.1, borderRadius: 1.5 }}>
                          <span><AlertTriangle {...iconProps()} style={inlineIconSx} />기사 수가 적은 구간이 포함되어 있어 정확도가 낮을 수 있습니다.</span>
                        </Alert>
                      ) : null}
                      {!trendSeries.length ? (
                        <EmptyState title="추이 데이터가 없습니다." subtitle="일자별 집계 데이터가 아직 생성되지 않았습니다." compact />
                      ) : !hasAnyTrendData ? (
                        <EmptyState title="모든 게임사가 0건입니다." subtitle="현재 기간에는 기사가 없어 추이를 표시할 수 없습니다." tone="warning" compact />
                      ) : (
                        <Stack spacing={1.45}>
                          {trendSeries.map((series) => (
                            <Box key={series.company}>
                              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.6 }}>
                                <Typography variant="body1" sx={{ fontWeight: 700 }}>
                                  {series.company}
                                </Typography>
                                <Chip
                                  variant="outlined"
                                  color={series.hasLowSample && trendMetric !== "count" ? "warning" : getVolumeState(series.max).chipColor}
                                  label={
                                    trendMetric === "count"
                                      ? `${getVolumeState(series.max).label} (최대 ${series.max}건)`
                                      : trendMetric === "risk"
                                        ? `위기 지수 최대 ${series.max.toFixed(1)}`
                                        : `이슈량 최대 ${series.max.toFixed(1)}`
                                  }
                                  sx={INTERACTIVE_CHIP_SX}
                                />
                              </Stack>
                              {series.hasData ? (
                                <Stack
                                  direction="row"
                                  spacing={0.3}
                                  sx={{ mt: 0.8, height: 72, alignItems: "end" }}
                                >
                                  {series.points.map((p) => {
                                    const pointState = getVolumeState(p.sampleSize);
                                    const barColor = p.qualityFlag === "LOW_SAMPLE" && trendMetric !== "count"
                                      ? "#f59e0b"
                                      : trendMetric === "risk"
                                        ? "#dc3c4a"
                                        : trendMetric === "heat"
                                          ? "#2f67d8"
                                          : pointState.barColor;
                                    return (
                                      <Box
                                        key={`${series.company}-${p.date}`}
                                        title={`${p.date}: ${p.value}${trendMetric === "count" ? "건" : trendMetric === "risk" ? " 위기 지수" : " 이슈량"}${p.qualityFlag === "LOW_SAMPLE" && trendMetric !== "count" ? " (기사 부족)" : ""}`}
                                        sx={{ flex: 1 }}
                                      >
                                        {p.value > 0 ? (
                                          <Box
                                            sx={{
                                              width: "100%",
                                              height: `${(p.value / series.max) * 100}%`,
                                              borderRadius: 0.5,
                                              bgcolor: barColor,
                                            }}
                                          />
                                        ) : (
                                          <Box
                                            sx={{
                                              width: "100%",
                                              height: 6,
                                              borderRadius: 0.5,
                                              bgcolor: barColor,
                                            }}
                                          />
                                        )}
                                      </Box>
                                    );
                                  })}
                                </Stack>
                              ) : (
                                <EmptyState
                                  title={`${series.company} · 0건`}
                                  subtitle="해당 기간 기사가 없어 추이를 표시할 수 없습니다."
                                  tone="warning"
                                  compact
                                />
                              )}
                            </Box>
                          ))}
                        </Stack>
                      )}
                      {trendDateRangeLabel ? (
                        <Typography variant="body2" sx={{ color: "#64748b", mt: 1.2 }}>
                          기준 일자: {trendDateRangeLabel} · 단위: {
                            trendMetric === "count" || !hasTrendMetricRows
                              ? "기사 건수"
                              : "지수(0~100)"
                          }
                        </Typography>
                      ) : null}
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12} md={6} sx={{ display: "flex", minWidth: 0 }}>
                  <Card
                    variant="outlined"
                    sx={{ ...sectionCardSx, width: "100%" }}
                  >
                    <CardContent sx={{ p: { xs: 1.35, md: 1.6 } }}>
                      <Typography variant="h6" sx={{ fontWeight: 800, mb: 0.4, borderLeft: "3px solid #0f3b66", pl: 1.5 }}>
                        여론 분포
                      </Typography>
                      <Typography variant="body2" sx={{ color: "#64748b", display: "block", mb: 1.2 }}>
                        기사가 없으면 여론 비율을 계산할 수 없습니다.
                      </Typography>
                      <Stack spacing={1.4}>
                        {companiesForView.map((company) => {
                          const row = sentimentByCompany[company] || { 긍정: 0, 중립: 0, 부정: 0 };
                          const sampleCount = Number(companyCounts?.[company] || row.total || 0);
                          const sampleState = getVolumeState(sampleCount);
                          return (
                            <Box key={company}>
                              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.8 }}>
                                <Typography variant="body1" sx={{ fontWeight: 700 }}>
                                  {company}
                                </Typography>
                                <Chip
                                  color={sampleState.chipColor}
                                  variant="outlined"
                                  label={`${sampleState.label} · ${sampleCount}건`}
                                  sx={INTERACTIVE_CHIP_SX}
                                />
                              </Stack>
                              {sampleCount <= 0 ? (
                                <EmptyState
                                  compact
                                  tone="warning"
                                  title="기사 없음"
                                  subtitle="여론 비율을 계산할 수 없습니다."
                                />
                              ) : null}
                              {SENTIMENTS.map((s) => (
                                <Stack
                                  key={`${company}-${s}`}
                                  direction="row"
                                  spacing={1}
                                  alignItems="center"
                                  sx={{ mb: 0.5, display: sampleCount <= 0 ? "none" : "flex" }}
                                >
                                  <Typography variant="body2" sx={{ width: 36 }}>
                                    {s}
                                  </Typography>
                                  <LinearProgress
                                    variant="determinate"
                                    value={Math.max(0, Math.min(100, Number(row[s] || 0)))}
                                    sx={{ flex: 1, height: 8, borderRadius: 99, bgcolor: "#edf2fb" }}
                                  />
                                  <Typography variant="body2" sx={{ width: 52, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                                    {Number(row[s] || 0).toFixed(1)}%
                                  </Typography>
                                </Stack>
                              ))}
                            </Box>
                          );
                        })}
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>

              <Card
                variant="outlined"
                sx={sectionCardSx}
              >
                <CardContent sx={{ p: { xs: 1.35, md: 1.55 } }}>
                  <Typography variant="h6" sx={{ fontWeight: 800, mb: 1.2 }}>
                    게임사별 주요 키워드
                  </Typography>
                  <Grid container spacing={1.1}>
                    {keywordCards.map((card) => (
                      <Grid item xs={12} md={6} key={card.company} sx={{ display: "flex", minWidth: 0 }}>
                        <Paper variant="outlined" sx={{ ...panelPaperSx, p: 1.2, width: "100%", height: "100%" }}>
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
                </CardContent>
              </Card>

              <Card
                variant="outlined"
                sx={sectionCardSx}
              >
                <CardContent sx={{ p: { xs: 1.35, md: 1.55 } }}>
                  <Typography variant="h6" sx={{ fontWeight: 800, mb: 1.2 }}>
                    대응 인사이트
                  </Typography>
                  <Grid container spacing={1.1}>
                    <Grid item xs={12} md={6} sx={{ display: "flex", minWidth: 0 }}>
                      <Paper variant="outlined" sx={{ ...panelPaperSx, p: 1.2, height: "100%", width: "100%" }}>
                        <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.8 }}>
                          주목 이슈 TOP 5
                        </Typography>
                        <Stack spacing={0.8}>
                          {(insights.top_issues || []).map((item, idx) => (
                            <Typography
                              key={`${item.company}-${item.keyword}-${idx}`}
                              variant="caption"
                              color="text.secondary"
                            >
                              <b>{item.company}</b> · {item.keyword} ({item.count}건, {item.share_pct}%)
                            </Typography>
                          ))}
                        </Stack>
                      </Paper>
                    </Grid>
                    <Grid item xs={12} md={6} sx={{ display: "flex", minWidth: 0 }}>
                      <Paper variant="outlined" sx={{ ...panelPaperSx, p: 1.2, height: "100%", width: "100%" }}>
                        <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.8 }}>
                          실행 제안
                        </Typography>
                        <Stack spacing={0.8}>
                          {(insights.actions || []).map((item) => (
                            <Typography
                              key={`${item.company}-${item.priority}`}
                              variant="caption"
                              color="text.secondary"
                            >
                              <b>{item.company}</b> ({item.priority}) {item.action}
                            </Typography>
                          ))}
                        </Stack>
                      </Paper>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>

              <Card
                variant="outlined"
                sx={sectionCardSx}
              >
                <CardContent sx={{ p: { xs: 1.35, md: 1.55 } }}>
                  <Stack
                    direction={{ xs: "column", md: "row" }}
                    justifyContent="space-between"
                    spacing={1.2}
                    sx={{ mb: 1.2 }}
                  >
                    <Typography variant="h6" sx={{ fontWeight: 800 }}>
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
                        gridTemplateColumns: { xs: "92px minmax(220px,1fr) 78px 108px", sm: "108px minmax(280px,1fr) 84px 124px", md: "120px minmax(320px,1fr) 92px 140px" },
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
                                gridTemplateColumns: { xs: "92px minmax(220px,1fr) 78px 108px", sm: "108px minmax(280px,1fr) 84px 124px", md: "120px minmax(320px,1fr) 92px 140px" },
                                gap: 1,
                                alignItems: "center",
                                borderTop: "1px solid",
                                borderColor: "rgba(15,23,42,.08)",
                                px: 1.2,
                                fontSize: 14,
                                "&:hover": { bgcolor: "rgba(15,59,102,.04)" },
                              }}
                            >
                              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                                {a.company || "-"}
                              </Typography>
                              <Typography
                                component={a.url ? "a" : "span"}
                                href={a.url || undefined}
                                target={a.url ? "_blank" : undefined}
                                rel={a.url ? "noreferrer" : undefined}
                                sx={{
                                  minWidth: 0,
                                  color: "#0f3b66",
                                  textDecoration: "none",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                  "&:hover": { textDecoration: a.url ? "underline" : "none" },
                                }}
                              >
                                {a.title || "(제목 없음)"}
                              </Typography>
                              <Typography variant="body2">{a.sentiment || "-"}</Typography>
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
              </Card>
            </>
          ) : null}

          <Divider sx={{ my: 1 }} />
          <Typography variant="caption" color="text.secondary" align="center">
            실시간으로 자동 업데이트됩니다.
          </Typography>
        </Stack>
      </Container>
    </Box>
  );
}
