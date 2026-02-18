"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Box,
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

const SENTIMENTS = ["긍정", "중립", "부정"];
const DEFAULT_COMPANIES = ["넥슨", "NC소프트", "넷마블", "크래프톤"];
const DEFAULT_REFRESH_MS = 60000;
const MIN_REFRESH_MS = 10000;
const REQUEST_DEBOUNCE_MS = 350;
const DEFAULT_WINDOW_HOURS = 72;
const LOW_SAMPLE_THRESHOLD = 5;
const ARTICLE_ROW_HEIGHT = 56;
const ARTICLE_LIST_MAX_HEIGHT = 500;
const ARTICLE_LIST_MIN_HEIGHT = 112;
const WINDOW_HOURS_OPTIONS = [
  { hours: 24, label: "하루" },
  { hours: 72, label: "3일" },
  { hours: 168, label: "일주일" },
];

function getVolumeState(count) {
  const safeCount = Number(count || 0);
  if (safeCount <= 0) {
    return {
      label: "0건",
      chipColor: "warning",
      helper: "수집 기사 없음",
      barColor: "#e2e8f0",
    };
  }
  if (safeCount < LOW_SAMPLE_THRESHOLD) {
    return {
      label: "저건수",
      chipColor: "warning",
      helper: `표본 ${LOW_SAMPLE_THRESHOLD}건 미만`,
      barColor: "#f59e0b",
    };
  }
  return {
    label: "정상",
    chipColor: "success",
    helper: "표본 안정 구간",
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
  const sentimentRows = data?.sentiment_summary ?? [];
  const keywordsMap = data?.keywords ?? {};
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
          fallback: "경쟁사 조회에 실패했습니다.",
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

  const trendSeries = useMemo(() => {
    if (!trendRows.length || !companiesForView.length) return [];
    const recent = trendRows.slice(-14);
    return companiesForView.map((company) => {
      const points = recent.map((row) => ({ date: row.date, value: Number(row[company] || 0) }));
      const max = Math.max(...points.map((p) => p.value), 0);
      const hasData = points.some((p) => p.value > 0);
      return { company, points, max, hasData };
    });
  }, [companiesForView, trendRows]);

  const hasAnyTrendData = useMemo(
    () => trendSeries.some((series) => series.hasData),
    [trendSeries]
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
    <Box sx={{ minHeight: "100dvh", bgcolor: "#eef0f3", py: { xs: 2, md: 5 } }}>
      <Container maxWidth="xl" sx={{ maxWidth: "1180px !important" }}>
        <Stack spacing={2}>
          <Paper
            sx={{
              borderRadius: 3,
              border: "1px solid #e5e7eb",
              bgcolor: "#f8fafc",
              px: { xs: 2, md: 3 },
              py: 1.2,
              boxShadow: "0 8px 24px rgba(15,23,42,.04)",
            }}
          >
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
                <Chip size="small" variant="outlined" label={`최근 갱신: ${formatKstTimestamp(lastUpdatedAt)}`} />
                <Chip size="small" variant="outlined" label={`자동 갱신: ${Math.round(refreshMs / 1000)}초`} />
                <Chip size="small" color="primary" variant="outlined" label="조회 전용" />
              </Stack>
            </Stack>
          </Paper>

          <Stack direction="row" spacing={1} sx={{ justifyContent: "flex-end" }}>
            <Chip component={Link} href="/" clickable variant="outlined" label="메인" />
            <Chip component={Link} href="/nexon" clickable variant="outlined" label="넥슨 IP 리스크" />
          </Stack>

          <ApiGuardBanner />

          <Card
            variant="outlined"
            sx={{ borderRadius: 3, borderColor: "rgba(15,23,42,.1)", boxShadow: "0 12px 28px rgba(15,23,42,.06)" }}
          >
            <CardContent>
              <Stack spacing={1.3}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                  조회 대상 회사
                </Typography>
                <Alert severity="info" sx={{ borderRadius: 2 }}>
                  최근 {windowHours}시간 수집 기준입니다.
                </Alert>
                <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                  {DEFAULT_COMPANIES.map((name) => (
                    <Chip
                      key={name}
                      label={name}
                      onClick={() => toggleSelectedCompany(name)}
                      color={selectedCompanies.includes(name) ? "primary" : "default"}
                      variant={selectedCompanies.includes(name) ? "filled" : "outlined"}
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
                    />
                  ))}
                </Stack>
                {retryAfterSec ? (
                  <Alert severity="warning" sx={{ borderRadius: 2 }}>
                    호출 제한(HTTP 429): 요청량이 많습니다.
                    {` ${retryAfterSec}초 후 자동 재시도 예정 (${formatRetryAt(retryAfterSec)} KST)`}
                    {errorCode ? ` · 호출 제한 중 (${errorCode})` : ""}
                  </Alert>
                ) : null}
                <PageStatusView
                  spacing={1}
                  error={{
                    show: hasBlockingError,
                    title: "조회 실패",
                    details: error,
                    diagnosticCode: errorCode,
                  }}
                  loading={{
                    show: loading,
                    title: "경쟁사 비교 데이터 조회 중",
                    subtitle: "최신 기사와 지표를 갱신하고 있습니다.",
                  }}
                />
              </Stack>
            </CardContent>
          </Card>

          <PageStatusView
            empty={{
              show: shouldShowCompareEmpty,
              title: "표시할 비교 데이터가 없습니다.",
              subtitle: "잠시 후 자동으로 다시 조회합니다.",
            }}
          />

          {data ? (
            <>
              <Grid container spacing={1.4}>
                {companyCards.map(({ company, count, state }) => (
                  <Grid item xs={6} md={4} key={company}>
                    <Card
                      variant="outlined"
                      sx={{ borderRadius: 2.4, borderColor: "rgba(15,23,42,.1)" }}
                    >
                      <CardContent>
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
                          <Chip size="small" color={state.chipColor} variant="outlined" label={state.label} />
                        </Stack>
                        <Typography variant="caption" sx={{ color: "#64748b", display: "block", mt: 0.4 }}>
                          {state.helper}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
                <Grid item xs={6} md={4}>
                  <Card
                    variant="outlined"
                    sx={{ borderRadius: 2.4, borderColor: "rgba(15,23,42,.1)" }}
                  >
                    <CardContent>
                      <Typography variant="body2" color="text.secondary">
                        총합
                      </Typography>
                      <Typography variant="h4" sx={{ fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>
                        {Number(total).toLocaleString()}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        전체 기사
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
              <Stack direction="row" spacing={0.8} useFlexGap flexWrap="wrap" sx={{ mt: 0.2 }}>
                <Chip size="small" label="0건: 수집 없음" color="warning" variant="outlined" />
                <Chip size="small" label={`저건수: ${LOW_SAMPLE_THRESHOLD}건 미만`} color="warning" variant="outlined" />
                <Chip size="small" label="정상: 표본 안정 구간" color="success" variant="outlined" />
              </Stack>

              <Grid container spacing={1.4}>
                <Grid item xs={12} md={6}>
                  <Card
                    variant="outlined"
                    sx={{
                      borderRadius: 2.4,
                      borderColor: "rgba(15,23,42,.1)",
                      height: "100%",
                    }}
                  >
                    <CardContent>
                      <Typography variant="h6" sx={{ fontWeight: 800, mb: 0.4 }}>
                        일별 보도량 추이 (최근 14일)
                      </Typography>
                      <Typography variant="caption" sx={{ color: "#64748b", display: "block", mb: 1.2 }}>
                        파랑=정상, 황색=저건수, 회색=0건
                      </Typography>
                      {!trendSeries.length ? (
                        <EmptyState title="추이 데이터가 없습니다." subtitle="선택한 조건에서 시계열 데이터가 아직 생성되지 않았습니다." compact />
                      ) : !hasAnyTrendData ? (
                        <EmptyState title="모든 회사가 0건입니다." subtitle="수집 주기 이후 자동 갱신에서 다시 확인됩니다." tone="warning" compact />
                      ) : (
                        <Stack spacing={1.2}>
                          {trendSeries.map((series) => (
                            <Box key={series.company}>
                              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.6 }}>
                                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                                  {series.company}
                                </Typography>
                                <Chip
                                  size="small"
                                  variant="outlined"
                                  color={getVolumeState(series.max).chipColor}
                                  label={`${getVolumeState(series.max).label} (최대 ${series.max}건)`}
                                />
                              </Stack>
                              {series.hasData ? (
                                <Stack
                                  direction="row"
                                  spacing={0.3}
                                  sx={{ mt: 0.8, height: 56, alignItems: "end" }}
                                >
                                  {series.points.map((p) => {
                                    const pointState = getVolumeState(p.value);
                                    return (
                                      <Box key={`${series.company}-${p.date}`} title={`${p.date}: ${p.value}건`} sx={{ flex: 1 }}>
                                        {p.value > 0 ? (
                                          <Box
                                            sx={{
                                              width: "100%",
                                              height: `${(p.value / series.max) * 100}%`,
                                              minHeight: 2,
                                              borderRadius: 0.5,
                                              bgcolor: pointState.barColor,
                                            }}
                                          />
                                        ) : (
                                          <Box
                                            sx={{
                                              width: "100%",
                                              height: 6,
                                              borderRadius: 0.5,
                                              bgcolor: pointState.barColor,
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
                                  subtitle="해당 기간 보도량 없음"
                                  tone="warning"
                                  compact
                                />
                              )}
                            </Box>
                          ))}
                        </Stack>
                      )}
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12} md={6}>
                  <Card
                    variant="outlined"
                    sx={{
                      borderRadius: 2.4,
                      borderColor: "rgba(15,23,42,.1)",
                      height: "100%",
                    }}
                  >
                    <CardContent>
                      <Typography variant="h6" sx={{ fontWeight: 800, mb: 0.4 }}>
                        감성 분석
                      </Typography>
                      <Typography variant="caption" sx={{ color: "#64748b", display: "block", mb: 1.2 }}>
                        표본 0건은 비율 대신 상태 안내만 표시됩니다.
                      </Typography>
                      <Stack spacing={1.4}>
                        {companiesForView.map((company) => {
                          const row = sentimentByCompany[company] || { 긍정: 0, 중립: 0, 부정: 0 };
                          const sampleCount = Number(companyCounts?.[company] || row.total || 0);
                          const sampleState = getVolumeState(sampleCount);
                          return (
                            <Box key={company}>
                              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.8 }}>
                                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                                  {company}
                                </Typography>
                                <Chip
                                  size="small"
                                  color={sampleState.chipColor}
                                  variant="outlined"
                                  label={`${sampleState.label} · ${sampleCount}건`}
                                />
                              </Stack>
                              {sampleCount <= 0 ? (
                                <EmptyState
                                  compact
                                  tone="warning"
                                  title="표본 없음"
                                  subtitle="감성 비율을 계산할 수 없습니다."
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
                                  <Typography variant="caption" sx={{ width: 30 }}>
                                    {s}
                                  </Typography>
                                  <LinearProgress
                                    variant="determinate"
                                    value={Math.max(0, Math.min(100, Number(row[s] || 0)))}
                                    sx={{ flex: 1, height: 8, borderRadius: 99, bgcolor: "#edf2fb" }}
                                  />
                                  <Typography variant="caption" sx={{ width: 48, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
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
                sx={{ borderRadius: 2.4, borderColor: "rgba(15,23,42,.1)" }}
              >
                <CardContent>
                  <Typography variant="h6" sx={{ fontWeight: 800, mb: 1.2 }}>
                    회사별 키워드
                  </Typography>
                  <Grid container spacing={1.1}>
                    {keywordCards.map((card) => (
                      <Grid item xs={12} md={6} key={card.company}>
                        <Paper variant="outlined" sx={{ p: 1.2, borderRadius: 2 }}>
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
                sx={{ borderRadius: 2.4, borderColor: "rgba(15,23,42,.1)" }}
              >
                <CardContent>
                  <Typography variant="h6" sx={{ fontWeight: 800, mb: 1.2 }}>
                    핵심 인사이트
                  </Typography>
                  <Grid container spacing={1.1}>
                    <Grid item xs={12} md={6}>
                      <Paper variant="outlined" sx={{ p: 1.2, borderRadius: 2, height: "100%" }}>
                        <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.8 }}>
                          Top 5 이슈
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
                    <Grid item xs={12} md={6}>
                      <Paper variant="outlined" sx={{ p: 1.2, borderRadius: 2, height: "100%" }}>
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
                sx={{ borderRadius: 2.4, borderColor: "rgba(15,23,42,.1)" }}
              >
                <CardContent>
                  <Stack
                    direction={{ xs: "column", md: "row" }}
                    justifyContent="space-between"
                    spacing={1.2}
                    sx={{ mb: 1.2 }}
                  >
                    <Typography variant="h6" sx={{ fontWeight: 800 }}>
                      최신 기사 목록
                    </Typography>
                    <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                        <Chip
                        size="small"
                        label={`회사: ${filterCompany}`}
                        variant="outlined"
                        onClick={() => setFilterCompany((prev) => cycleListValue(articleCompanyFilters, prev))}
                      />
                      <Chip
                        size="small"
                        label={`감성: ${filterSentiment}`}
                        variant="outlined"
                        onClick={() =>
                          setFilterSentiment(filterSentiment === "전체" ? "부정" : "전체")
                        }
                      />
                      <Chip
                        size="small"
                        label={`필터 결과: ${displayedArticles.length}`}
                        variant="outlined"
                      />
                    </Stack>
                  </Stack>

                  <Box sx={{ overflowX: "auto" }}>
                    <Box
                      sx={{
                        display: "grid",
                        gridTemplateColumns: "120px minmax(320px,1fr) 92px 140px",
                        gap: 1,
                        px: 1.2,
                        pb: 0.8,
                        color: "text.secondary",
                        fontSize: 12,
                        fontWeight: 700,
                      }}
                    >
                      <Box>회사</Box>
                      <Box>제목</Box>
                      <Box>감성</Box>
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
                                gridTemplateColumns: "120px minmax(320px,1fr) 92px 140px",
                                gap: 1,
                                alignItems: "center",
                                borderTop: "1px solid",
                                borderColor: "rgba(15,23,42,.08)",
                                px: 1.2,
                                fontSize: 13,
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
            포트폴리오 비교 화면 · compare는 조회 전용이며 자동 갱신으로 최신 상태를 유지합니다.
          </Typography>
        </Stack>
      </Container>
    </Box>
  );
}
