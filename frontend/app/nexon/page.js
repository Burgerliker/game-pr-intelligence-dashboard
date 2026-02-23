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
  IconButton,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import { AlertTriangle, ChevronLeft, ChevronRight, FileText, Info, Newspaper, RefreshCw, Tag, TrendingDown, TrendingUp } from "lucide-react";
import { List as WindowList } from "react-window";
import PageStatusView from "../../components/PageStatusView";
import ApiGuardBanner from "../../components/ApiGuardBanner";
import { apiGet, getDiagnosticCode } from "../../lib/api";
import { buildDiagnosticScope, toRequestErrorState } from "../../lib/pageStatus";
import {
  createEmptyCluster,
  createEmptyRisk,
  normalizeNexonDashboard,
} from "../../lib/normalizeNexon";
import {
  buildStatCards,
  calcArticleListHeight,
  calcCrisisChange,
  resolveOutletRisk,
  resolveTopIssues,
  resolveTopRisk,
} from "./lib/selectors";
import {
  bannerPagerBtnSx,
  borderRadius,
  colors,
  contentCardSx,
  echartsTokens,
  filterChipSx,
  getDeltaTone as getDeltaToneToken,
  gridLayouts,
  IP_BANNER_STYLE,
  MUI_SPEC,
  navButtonSx,
  pageContainerSx,
  pageShellCleanSx,
  panelPaperSx,
  paginationDotSx,
  paginationTrackSx,
  progressBarSx,
  riskProgressGradient,
  sectionCardSx,
  sectionTitleSx,
  shadows,
  specTypeSx,
  statusChipSx,
  subPanelSx,
  topIssueBadgeSx,
  topIssueCardSx,
} from "../../lib/uiTokens";

const USE_MOCK_FALLBACK = process.env.NEXT_PUBLIC_USE_MOCK_FALLBACK === "true";
const ARTICLE_PAGE_SIZE = 20;
const ARTICLE_ROW_HEIGHT = 122;
const ARTICLE_LIST_MAX_HEIGHT = 640;
const ARTICLE_LIST_MIN_HEIGHT = 244;
const NEXON_LOGO_SRC = "/nexon-logo.svg";
const DIAG_SCOPE = {
  health: buildDiagnosticScope("NEX", "HEALTH"),
  dashboard: buildDiagnosticScope("NEX", "DASH"),
  article: buildDiagnosticScope("NEX", "ART"),
};
const ICON_TOKEN = Object.freeze({ size: 16, strokeWidth: 2, color: "currentColor" });
const iconProps = (overrides) => ({ ...ICON_TOKEN, ...overrides });
const inlineIconSx = { display: "inline-flex", verticalAlign: "middle", marginRight: "6px" };
const toSignedText = (value, fractionDigits = 0) => {
  const num = Number(value || 0);
  const fixed = num.toFixed(fractionDigits);
  if (num > 0) return `+${fixed}`;
  return fixed;
};
const DELTA_ICON_MAP = {
  TrendingUp,
  TrendingDown,
};
const STAT_ICON_MAP = {
  newspaper: Newspaper,
  tag: Tag,
  fileText: FileText,
};
const IP_EMOJI_MAP = {
  all: "🧭",
  maplestory: "🍁",
  dnf: "⚔️",
  arcraiders: "🚀",
  fconline: "⚽",
  bluearchive: "📘",
};

const getDailyExposure = (row) =>
  Number(row?.total_mentions ?? row?.mention_count ?? row?.exposure_count ?? row?.exposure ?? row?.total_exposure ?? row?.article_count ?? 0);
const getDailyArticleCount = (row) => Number(row?.article_count ?? 0);

const MOCK_RISK = {
  meta: { company: "넥슨", ip: "메이플스토리", ip_id: "maplestory", date_from: "2024-01-01", date_to: "2026-12-31", total_articles: 4320 },
  daily: Array.from({ length: 24 }).map((_, i) => ({
    date: `2026-01-${String(i + 1).padStart(2, "0")}`,
    article_count: 45 + Math.round(Math.sin(i / 2) * 18) + (i % 7 === 0 ? 16 : 0),
    negative_ratio: 16 + (i % 5) * 5,
  })),
  outlets: [
    { outlet: "inven.co.kr", article_count: 640, positive_ratio: 28.2, neutral_ratio: 38.6, negative_ratio: 33.2 },
    { outlet: "mk.co.kr", article_count: 592, positive_ratio: 32.9, neutral_ratio: 39.5, negative_ratio: 27.6 },
    { outlet: "sedaily.com", article_count: 511, positive_ratio: 30.4, neutral_ratio: 41.2, negative_ratio: 28.4 },
  ],
  risk_themes: [
    { theme: "확률형/BM", article_count: 1230, negative_ratio: 46.1, risk_score: 0.91 },
    { theme: "규제/법적", article_count: 819, negative_ratio: 43.5, risk_score: 0.76 },
    { theme: "운영/장애", article_count: 942, negative_ratio: 38.3, risk_score: 0.74 },
    { theme: "보상/환불", article_count: 702, negative_ratio: 35.7, risk_score: 0.64 },
  ],
  ip_catalog: [
    { id: "all", name: "넥슨 (전체보기)" },
    { id: "maplestory", name: "메이플스토리" },
    { id: "dnf", name: "던전앤파이터" },
    { id: "arcraiders", name: "아크레이더스" },
    { id: "fconline", name: "FC온라인" },
    { id: "bluearchive", name: "블루아카이브" },
  ],
};

const MOCK_CLUSTER = {
  meta: { cluster_count: 4, total_articles: 4320 },
  top_outlets: [
    { outlet: "inven.co.kr", article_count: 320 },
    { outlet: "thisisgame.com", article_count: 260 },
    { outlet: "newsis.com", article_count: 180 },
  ],
  keyword_cloud: [
    { word: "확률", count: 120, weight: 1.0 },
    { word: "보상", count: 96, weight: 0.8 },
    { word: "업데이트", count: 88, weight: 0.73 },
    { word: "환불", count: 74, weight: 0.62 },
    { word: "점검", count: 66, weight: 0.55 },
    { word: "이벤트", count: 62, weight: 0.52 },
  ],
  clusters: [
    {
      cluster: "확률형/BM",
      article_count: 680,
      negative_ratio: 51.2,
      sentiment: { positive: 17.4, neutral: 31.4, negative: 51.2 },
      keywords: ["확률", "과금", "보상", "논란"],
      samples: ["메이플 확률형 아이템 관련 공지"],
    },
    {
      cluster: "보상/환불",
      article_count: 390,
      negative_ratio: 44.3,
      sentiment: { positive: 23.8, neutral: 31.9, negative: 44.3 },
      keywords: ["환불", "보상", "피해", "기준"],
      samples: ["넥슨 보상안 발표"],
    },
  ],
};

export default function NexonPage() {
  const [ip, setIp] = useState("maplestory");
  const [riskData, setRiskData] = useState(() => createEmptyRisk("maplestory"));
  const [clusterData, setClusterData] = useState(() => createEmptyCluster("maplestory"));
  const [riskScore, setRiskScore] = useState(null);
  const [riskTimeseries, setRiskTimeseries] = useState([]);
  const [health, setHealth] = useState(null);
  const [usingMock, setUsingMock] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [errorCode, setErrorCode] = useState("");
  const [notice, setNotice] = useState("");
  const [lastUpdatedAt, setLastUpdatedAt] = useState("");
  const [articleItems, setArticleItems] = useState([]);
  const [articleTotal, setArticleTotal] = useState(0);
  const [articleOffset, setArticleOffset] = useState(0);
  const [articleHasMore, setArticleHasMore] = useState(false);
  const [articleLoading, setArticleLoading] = useState(false);
  const [articleError, setArticleError] = useState("");
  const [articleErrorCode, setArticleErrorCode] = useState("");
  const [healthDiagCode, setHealthDiagCode] = useState("");
  const articleReqSeqRef = useRef(0);
  const articleAbortRef = useRef(null);
  const swipeStartXRef = useRef(null);
  const ipCacheRef = useRef(new Map());
  const requestSeqRef = useRef(0);
  const trendChartRef = useRef(null);
  const outletChartRef = useRef(null);
  const themeChartRef = useRef(null);
  const keywordChartRef = useRef(null);
  const trendChartInstRef = useRef(null);
  const outletChartInstRef = useRef(null);
  const themeChartInstRef = useRef(null);
  const keywordChartInstRef = useRef(null);
  const [chartsReady, setChartsReady] = useState(false);
  const formatUpdatedAt = useCallback((date = new Date()) => {
    const d = date instanceof Date ? date : new Date(date);
    if (Number.isNaN(d.getTime())) return "-";
    return d.toLocaleTimeString("ko-KR", { hour12: false });
  }, []);
  const getHealthDiagnosticCode = useCallback(
    (healthError) => (healthError ? getDiagnosticCode(healthError, DIAG_SCOPE.health) : ""),
    []
  );
  const loadDashboard = async (targetIp = ip) => {
    const requestSeq = ++requestSeqRef.current;
    const baseCatalog = riskData?.ip_catalog || MOCK_RISK.ip_catalog;
    setRiskData(createEmptyRisk(targetIp, baseCatalog));
    setClusterData(createEmptyCluster(targetIp));
    setRiskScore(null);
    setError("");
    setErrorCode("");
    setNotice("");
    setLoading(true);
    const cache = ipCacheRef.current.get(targetIp);
    if (cache) {
      if (requestSeq !== requestSeqRef.current) return;
      setRiskData(cache.riskData);
      setClusterData(cache.clusterData);
      setRiskScore(cache.riskScore);
      setRiskTimeseries(cache.riskTimeseries || []);
      setHealth(cache.health || null);
      setHealthDiagCode(cache.healthDiagCode || "");
      setUsingMock(Boolean(cache.usingMock));
      setNotice(cache.notice || "");
      setLastUpdatedAt(cache.lastUpdatedAt || formatUpdatedAt());
      setLoading(false);
      return;
    }

    try {
      const base = new URLSearchParams({ ip: targetIp });
      const [riskPayload, clusterPayload, riskScorePayload, riskTimeseriesPayload, healthState] = await Promise.all([
        apiGet(`/api/risk-dashboard?${base.toString()}`),
        apiGet(`/api/ip-clusters?${base.toString()}&limit=6`),
        apiGet(`/api/risk-score?ip=${targetIp}`).catch(() => null),
        apiGet(`/api/risk-timeseries?ip=${targetIp}&hours=168&limit=600`).catch(() => null),
        apiGet("/api/health")
          .then((data) => ({ data, error: null }))
          .catch((error) => ({ data: null, error })),
      ]);

      const normalized = normalizeNexonDashboard({
        targetIp,
        riskPayload,
        clusterPayload,
        useMockFallback: USE_MOCK_FALLBACK,
        mockRisk: MOCK_RISK,
        mockCluster: MOCK_CLUSTER,
        baseCatalog,
      });
      const resolvedRisk = normalized.riskData;
      const resolvedCluster = normalized.clusterData;
      const resolvedNotice = normalized.notice;
      const resolvedUsingMock = normalized.usingMock;
      const refreshedAt = formatUpdatedAt();

      if (requestSeq !== requestSeqRef.current) return;
      setRiskData(resolvedRisk);
      setClusterData(resolvedCluster);
      setUsingMock(resolvedUsingMock);
      setRiskScore(riskScorePayload || null);
      setRiskTimeseries(riskTimeseriesPayload?.items || []);
      setHealth(healthState.data || null);
      setHealthDiagCode(getHealthDiagnosticCode(healthState.error));
      setNotice(resolvedNotice);
      setLastUpdatedAt(refreshedAt);

      ipCacheRef.current.set(targetIp, {
        riskData: resolvedRisk,
        clusterData: resolvedCluster,
        riskScore: riskScorePayload || null,
        riskTimeseries: riskTimeseriesPayload?.items || [],
        health: healthState.data || null,
        healthDiagCode: getHealthDiagnosticCode(healthState.error),
        usingMock: resolvedUsingMock,
        notice: resolvedNotice,
        lastUpdatedAt: refreshedAt,
      });
    } catch (e) {
      if (requestSeq !== requestSeqRef.current) return;
      if (USE_MOCK_FALLBACK) {
        const ipName = MOCK_RISK.ip_catalog.find((x) => x.id === targetIp)?.name || targetIp;
        setRiskData({ ...MOCK_RISK, meta: { ...MOCK_RISK.meta, ip_id: targetIp, ip: ipName, total_articles: 0 } });
        setClusterData(MOCK_CLUSTER);
        setUsingMock(true);
        setNotice("실데이터 호출 실패로 예시 데이터를 표시 중입니다.");
      } else {
        setRiskData(createEmptyRisk(targetIp, baseCatalog));
        setClusterData(createEmptyCluster(targetIp));
        setUsingMock(false);
        setNotice("실데이터 호출에 실패했습니다. 시스템 연동 상태를 확인해주세요.");
      }
      setLastUpdatedAt("-");
      const nextError = toRequestErrorState(e, {
        scope: DIAG_SCOPE.dashboard,
        fallback: "대시보드 데이터 요청에 실패했습니다.",
      });
      setError(nextError.message);
      setErrorCode(nextError.code);
    } finally {
      if (requestSeq !== requestSeqRef.current) return;
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard(ip);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ip]);

  const loadMoreArticles = async (targetIp = ip, reset = false) => {
    if (!reset && (articleLoading || !articleHasMore)) return;
    const reqSeq = ++articleReqSeqRef.current;
    const nextOffset = reset ? 0 : articleOffset;
    if (articleAbortRef.current) articleAbortRef.current.abort();
    const controller = new AbortController();
    articleAbortRef.current = controller;
    if (reset) {
      setArticleError("");
      setArticleErrorCode("");
    }
    setArticleLoading(true);
    try {
      const payload = await apiGet(
        `/api/nexon-articles?ip=${encodeURIComponent(targetIp)}&limit=${ARTICLE_PAGE_SIZE}&offset=${nextOffset}`,
        { signal: controller.signal }
      );
      if (reqSeq !== articleReqSeqRef.current) return;
      const nextItems = Array.isArray(payload?.items) ? payload.items : [];
      setArticleItems((prev) => (reset ? nextItems : [...prev, ...nextItems]));
      setArticleTotal(Number(payload?.total || 0));
      setArticleOffset(nextOffset + nextItems.length);
      setArticleHasMore(Boolean(payload?.has_more));
    } catch (e) {
      if (e?.name === "AbortError") return;
      if (reqSeq !== articleReqSeqRef.current) return;
      const nextError = toRequestErrorState(e, {
        scope: DIAG_SCOPE.article,
        fallback: "기사 목록 데이터 연동에 실패했습니다.",
      });
      setArticleError(nextError.message);
      setArticleErrorCode(nextError.code);
      if (reset) {
        setArticleItems([]);
        setArticleTotal(0);
        setArticleOffset(0);
        setArticleHasMore(false);
      }
    } finally {
      if (reqSeq === articleReqSeqRef.current) setArticleLoading(false);
    }
  };

  useEffect(() => {
    articleReqSeqRef.current += 1;
    articleAbortRef.current?.abort();
    setArticleItems([]);
    setArticleTotal(0);
    setArticleOffset(0);
    setArticleHasMore(true);
    setArticleLoading(false);
    setArticleError("");
    setArticleErrorCode("");
    loadMoreArticles(ip, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ip]);

  useEffect(() => () => articleAbortRef.current?.abort(), []);

  const bannerItems = useMemo(
    () =>
      (riskData?.ip_catalog || MOCK_RISK.ip_catalog).map((item) => ({
        ...item,
        visual: IP_BANNER_STYLE[item.id] || IP_BANNER_STYLE.all,
      })),
    [riskData?.ip_catalog]
  );

  const currentBannerIndex = useMemo(() => bannerItems.findIndex((x) => x.id === ip), [bannerItems, ip]);
  const currentBanner = currentBannerIndex >= 0 ? bannerItems[currentBannerIndex] : bannerItems[0];
  const goPrevBanner = () => {
    if (!bannerItems.length) return;
    const nextIndex = currentBannerIndex <= 0 ? 0 : currentBannerIndex - 1;
    const next = bannerItems[nextIndex];
    if (next?.id && next.id !== ip) setIp(next.id);
  };
  const goNextBanner = () => {
    if (!bannerItems.length) return;
    const nextIndex = currentBannerIndex < 0 || currentBannerIndex >= bannerItems.length - 1 ? bannerItems.length - 1 : currentBannerIndex + 1;
    const next = bannerItems[nextIndex];
    if (next?.id && next.id !== ip) setIp(next.id);
  };
  const handleBannerTouchStart = (e) => {
    swipeStartXRef.current = e.touches?.[0]?.clientX ?? null;
  };
  const handleBannerTouchEnd = (e) => {
    const startX = swipeStartXRef.current;
    const endX = e.changedTouches?.[0]?.clientX ?? null;
    swipeStartXRef.current = null;
    if (startX == null || endX == null) return;
    const delta = endX - startX;
    if (Math.abs(delta) < 50) return;
    if (delta > 0) goPrevBanner();
    else goNextBanner();
  };

  useEffect(() => {
    const timer = setInterval(async () => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      try {
        const [rs, rt, healthState] = await Promise.all([
          apiGet(`/api/risk-score?ip=${ip}`).catch(() => null),
          apiGet(`/api/risk-timeseries?ip=${ip}&hours=168&limit=600`).catch(() => null),
          apiGet("/api/health")
            .then((data) => ({ data, error: null }))
            .catch((error) => ({ data: null, error })),
        ]);
        if (rs) setRiskScore(rs);
        if (rt?.items) setRiskTimeseries(rt.items);
        if (healthState.data) setHealth(healthState.data);
        setHealthDiagCode(getHealthDiagnosticCode(healthState.error));
        if (rs || healthState.data) setLastUpdatedAt(formatUpdatedAt());
      } catch {
        // noop
      }
    }, 60000);
    return () => clearInterval(timer);
  }, [ip]);

  const dailyRows = riskData?.daily || [];
  const outletRows = riskData?.outlets || [];
  const themes = riskData?.risk_themes || [];
  const clusters = clusterData?.clusters || [];
  const keywordCloud = clusterData?.keyword_cloud || [];
  const topRisk = useMemo(() => resolveTopRisk(themes), [themes]);
  const topRiskThemeScore = topRisk ? Math.round(Number(topRisk?.risk_score || 0) * 1000) / 10 : null;
  const articleListHeight = useMemo(
    () => calcArticleListHeight(articleItems.length, ARTICLE_ROW_HEIGHT, ARTICLE_LIST_MIN_HEIGHT, ARTICLE_LIST_MAX_HEIGHT),
    [articleItems.length]
  );
  const handleArticleRowsRendered = (visibleRows) => {
    if (!articleHasMore || articleLoading) return;
    if (visibleRows.stopIndex >= articleItems.length - 5) {
      loadMoreArticles(ip, false);
    }
  };
  const riskValue = Number(riskScore?.risk_score || 0);
  const alertLevel = String(riskScore?.alert_level || "P3").toUpperCase();
  const alertInfo =
    alertLevel === "P1"
      ? { label: "심각", desc: "위기 지수 70 이상", color: "error" }
      : alertLevel === "P2"
        ? { label: "주의", desc: "위기 지수 45~69", color: "warning" }
        : { label: "관심", desc: "위기 지수 0~44", color: "success" };
  const sortedDailyRows = useMemo(() => {
    const rows = Array.isArray(dailyRows) ? [...dailyRows] : [];
    rows.sort((a, b) => {
      const aKey = String(a?.date ?? a?.day ?? a?.ts ?? "");
      const bKey = String(b?.date ?? b?.day ?? b?.ts ?? "");
      return aKey.localeCompare(bKey);
    });
    return rows;
  }, [dailyRows]);
  const latestDailyRow = sortedDailyRows.at(-1) || null;
  const prevDailyRow = sortedDailyRows.at(-2) || null;
  const recent24hArticles = Number(riskScore?.article_count_window ?? riskScore?.exposure_count_window ?? getDailyExposure(latestDailyRow));
  const dailyExposureDelta = useMemo(() => {
    if (!latestDailyRow || !prevDailyRow) return 0;
    return getDailyExposure(latestDailyRow) - getDailyExposure(prevDailyRow);
  }, [latestDailyRow, prevDailyRow]);
  const clusterCount = Number(clusterData?.meta?.cluster_count || 0);
  const clusterPrevCount = Number(
    clusterData?.meta?.prev_cluster_count ?? clusterData?.meta?.cluster_count_prev ?? clusterData?.meta?.yesterday_cluster_count ?? clusterCount
  );
  const clusterDelta = clusterCount - clusterPrevCount;
  const totalArticleSum30d = useMemo(
    () => (dailyRows || []).slice(-30).reduce((acc, row) => acc + getDailyArticleCount(row), 0),
    [dailyRows]
  );
  const totalArticleSumPrev30d = useMemo(
    () => (sortedDailyRows || []).slice(-60, -30).reduce((acc, row) => acc + getDailyArticleCount(row), 0),
    [sortedDailyRows]
  );
  const monthlyArticleDelta = totalArticleSum30d - totalArticleSumPrev30d;
  const outletRisk = useMemo(() => resolveOutletRisk(outletRows), [outletRows]);
  const themeActionMap = {
    "확률형/BM": "확률·검증 근거와 산식 설명을 FAQ/공지에 고정",
    "운영/장애": "장애 타임라인과 재발방지 항목을 동일 포맷으로 배포",
    "보상/환불": "보상 대상·기준·예외를 표 형식으로 명확화",
    "규제/법적": "팩트 중심 공식 입장문과 Q&A를 분리 운영",
    "여론/논란": "오해 포인트 정정 메시지를 채널별 동시 배포",
    "신작/성과": "성과 메시지와 리스크 메시지를 분리해 혼선 방지",
  };
  const recommendedAction = themeActionMap[topRisk?.theme] || "핵심 팩트와 대응 일정을 짧고 명확하게 공지";
  const modeMismatchWarning = health?.mode === "backtest" ? "현재 과거 분석 데이터를 참조 중입니다." : "";
  const controlChipSx = filterChipSx;
  const controlButtonSx = navButtonSx;
  const crisisChange = useMemo(() => calcCrisisChange(riskTimeseries), [riskTimeseries]);
  const crisisDeltaTone = getDeltaToneToken(crisisChange);
  const CrisisDeltaIcon = crisisDeltaTone.iconName ? DELTA_ICON_MAP[crisisDeltaTone.iconName] : null;
  const statCards = useMemo(
    () =>
      buildStatCards({
        recent24hArticles,
        dailyExposureDelta,
        clusterCount,
        clusterDelta,
        totalArticleSum30d,
        monthlyArticleDelta,
      }),
    [clusterCount, clusterDelta, dailyExposureDelta, monthlyArticleDelta, recent24hArticles, totalArticleSum30d]
  );
  const topIssues = useMemo(() => resolveTopIssues(themes), [themes]);

  useEffect(() => {
    let active = true;
    let onResize;

    const mount = async () => {
      const echarts = await import("echarts");
      if (!active) return;
      if (trendChartRef.current && !trendChartInstRef.current) trendChartInstRef.current = echarts.init(trendChartRef.current);
      if (outletChartRef.current && !outletChartInstRef.current) outletChartInstRef.current = echarts.init(outletChartRef.current);
      if (themeChartRef.current && !themeChartInstRef.current) themeChartInstRef.current = echarts.init(themeChartRef.current);
      if (keywordChartRef.current && !keywordChartInstRef.current) keywordChartInstRef.current = echarts.init(keywordChartRef.current);
      setChartsReady(true);
      onResize = () => {
        trendChartInstRef.current?.resize();
        outletChartInstRef.current?.resize();
        themeChartInstRef.current?.resize();
        keywordChartInstRef.current?.resize();
      };
      window.addEventListener("resize", onResize);
    };

    mount();
    return () => {
      active = false;
      setChartsReady(false);
      if (onResize) window.removeEventListener("resize", onResize);
      trendChartInstRef.current?.dispose();
      outletChartInstRef.current?.dispose();
      themeChartInstRef.current?.dispose();
      keywordChartInstRef.current?.dispose();
      trendChartInstRef.current = null;
      outletChartInstRef.current = null;
      themeChartInstRef.current = null;
      keywordChartInstRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!chartsReady || !trendChartInstRef.current) return;
    const x = dailyRows.map((r) => r.date);
    trendChartInstRef.current.setOption(
      {
        animation: false,
        grid: { left: 38, right: 20, top: 26, bottom: 38 },
        tooltip: {
          trigger: "axis",
          formatter: (params) => {
            if (!Array.isArray(params) || !params.length) return "";
            const title = String(params[0]?.axisValue || "-");
            const lines = [title];
            params.forEach((item) => {
              const name = String(item?.seriesName || "");
              const raw = Number(item?.value || 0);
              const valueText = name === "부정 여론 비율" ? `${raw.toFixed(1)}%` : `${raw.toLocaleString()}건`;
              lines.push(`${item?.marker || ""}${name}: ${valueText}`);
            });
            return lines.join("<br/>");
          },
        },
        xAxis: {
          type: "category",
          data: x,
          axisLabel: {
            formatter: (v) => String(v || "").slice(5),
            color: echartsTokens.axisLabel.color,
          },
        },
        yAxis: [
          {
            type: "value",
            name: "보도량(건)",
            axisLabel: {
              color: echartsTokens.axisLabel.color,
              formatter: (v) => Number(v || 0).toLocaleString(),
            },
          },
          {
            type: "value",
            name: "부정 비율(%)",
            min: 0,
            max: 100,
            axisLabel: { color: echartsTokens.axisLabel.color, formatter: "{value}%" },
          },
        ],
        series: [
          {
            name: "보도량",
            type: "bar",
            yAxisIndex: 0,
            data: dailyRows.map((r) => getDailyArticleCount(r)),
            itemStyle: { color: echartsTokens.series.bar, borderRadius: echartsTokens.series.barRadius },
            barMaxWidth: 18,
            large: dailyRows.length > 220,
            largeThreshold: 220,
            progressive: 2000,
            progressiveThreshold: 3000,
          },
          {
            name: "부정 여론 비율",
            type: "line",
            yAxisIndex: 1,
            smooth: true,
            symbol: "none",
            sampling: "lttb",
            progressive: 2000,
            progressiveThreshold: 3000,
            data: dailyRows.map((r) => Number(r.negative_ratio || 0)),
            lineStyle: { color: echartsTokens.series.line, width: 2 },
          },
        ],
      },
      { notMerge: true, lazyUpdate: true }
    );
  }, [chartsReady, dailyRows]);

  useEffect(() => {
    if (!chartsReady || !outletChartInstRef.current) return;
    const displayedOutlets = outletRows.slice(0, 12);
    outletChartInstRef.current.setOption(
      {
        animation: false,
        grid: { left: 90, right: 20, top: 26, bottom: 24 },
        tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
        xAxis: { type: "value", axisLabel: { color: echartsTokens.axisLabel.color } },
        yAxis: {
          type: "category",
          data: displayedOutlets.map((r) => r.outlet),
          axisLabel: {
            color: echartsTokens.axisLabel.color,
            width: 120,
            interval: 0,
            formatter: (value) => {
              const v = String(value || "");
              if (v.length <= 10) return v;
              const dot = v.indexOf(".");
              if (dot > 3 && dot < v.length - 3) return `${v.slice(0, dot)}\n${v.slice(dot + 1)}`;
              return `${v.slice(0, 10)}\n${v.slice(10)}`;
            },
          },
        },
        series: [
          {
            name: "긍정",
            type: "bar",
            stack: "sent",
            data: displayedOutlets.map((r) => Number(r.positive_ratio || 0)),
            itemStyle: { color: echartsTokens.series.positive },
          },
          {
            name: "중립",
            type: "bar",
            stack: "sent",
            data: displayedOutlets.map((r) => Number(r.neutral_ratio || 0)),
            itemStyle: { color: echartsTokens.series.neutral },
          },
          {
            name: "부정",
            type: "bar",
            stack: "sent",
            data: displayedOutlets.map((r) => Number(r.negative_ratio || 0)),
            itemStyle: { color: echartsTokens.series.negative },
          },
        ],
      },
      { notMerge: true, lazyUpdate: true }
    );
  }, [chartsReady, outletRows]);

  useEffect(() => {
    if (!chartsReady || !themeChartInstRef.current) return;
    themeChartInstRef.current.setOption(
      {
        animation: false,
        grid: { left: 90, right: 20, top: 26, bottom: 24 },
        tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
        xAxis: { type: "value", axisLabel: { color: echartsTokens.axisLabel.color } },
        yAxis: {
          type: "category",
          data: themes.map((t) => t.theme),
          axisLabel: {
            color: echartsTokens.axisLabel.color,
            width: 96,
            interval: 0,
            formatter: (value) => {
              const v = String(value || "");
              if (v.length <= 6) return v;
              return `${v.slice(0, 6)}\n${v.slice(6)}`;
            },
          },
        },
        series: [
          {
            name: "위험도(%)",
            type: "bar",
            data: themes.map((t) => Math.round(Number(t.risk_score || 0) * 100)),
            itemStyle: { color: colors.chart.purple, borderRadius: [0, 4, 4, 0] },
            barMaxWidth: 20,
          },
        ],
      },
      { notMerge: true, lazyUpdate: true }
    );
  }, [chartsReady, themes]);

  useEffect(() => {
    if (!chartsReady || !keywordChartInstRef.current) return;
    const words = (keywordCloud || []).slice(0, 80).map((w) => ({
      name: String(w.word || ""),
      value: Math.max(1, Number(w.count || 0)),
    }));
    keywordChartInstRef.current.setOption(
      {
        animation: false,
        tooltip: {
          show: true,
          formatter: (params) => `${params?.name || "-"}: ${Number(params?.value || 0).toLocaleString()}`,
        },
        series: [
          {
            type: "treemap",
            roam: false,
            nodeClick: false,
            breadcrumb: { show: false },
            label: {
              show: true,
              formatter: "{b}",
              fontSize: 13,
              color: colors.background.card,
            },
            upperLabel: { show: false },
            itemStyle: {
              borderColor: colors.background.card,
              borderWidth: 1,
              gapWidth: 1,
            },
            levels: [
              {
                color: echartsTokens.treemapPalette,
                colorMappingBy: "value",
              },
            ],
            data: words,
          },
        ],
      },
      { notMerge: true, lazyUpdate: true }
    );
  }, [chartsReady, keywordCloud]);

  return (
    <Box sx={{ ...pageShellCleanSx, py: { xs: 2, sm: 2.5, md: 4.5 } }}>
    <Container maxWidth="xl" sx={pageContainerSx}>
      <Stack spacing={{ xs: 1.7, md: 2.4 }}>
        <Paper sx={{ ...panelPaperSx, bgcolor: colors.background.muted, boxShadow: shadows.xl }}>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            alignItems={{ xs: "flex-start", sm: "center" }}
            justifyContent="space-between"
            spacing={1.2}
            sx={{ px: { xs: 2, md: 3 }, py: 1.5 }}
          >
            <Stack direction="row" alignItems="center" spacing={1.2}>
              <Box sx={{ width: 22, height: 22, borderRadius: 1.2, backgroundColor: colors.brand.nexon.primary }} />
              <Box sx={{ py: 0.2 }}>
                <Typography
                  sx={{
                    ...specTypeSx.h6,
                    fontSize: { xs: 20, md: 22 },
                    color: colors.slate[900],
                    wordBreak: "keep-all",
                  }}
                >
                  넥슨 IP 리스크 대시보드
                </Typography>
              </Box>
            </Stack>
            <Stack direction="row" spacing={1} sx={{ width: { xs: "100%", sm: "auto" }, justifyContent: { xs: "flex-end", sm: "flex-start" } }}>
              <Button component={Link} href="/" variant="outlined" size="small" sx={controlButtonSx}>메인</Button>
              <Button component={Link} href="/compare" variant="outlined" size="small" sx={controlButtonSx}>경쟁사 비교</Button>
              <Button component={Link} href="/nexon/backtest" variant="outlined" size="small" sx={controlButtonSx}>과거 분석</Button>
            </Stack>
          </Stack>
        </Paper>
        <ApiGuardBanner />

        <Card variant="outlined" sx={sectionCardSx}>
          <CardContent sx={contentCardSx}>
            <Stack spacing={2}>
              <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems={{ xs: "flex-start", md: "center" }} spacing={1.2}>
                <Box>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.6 }}>
                    <Box
                      component="img"
                      src={NEXON_LOGO_SRC}
                      alt="NEXON"
                      sx={{
                        height: 20,
                        width: "auto",
                        objectFit: "contain",
                        display: "block",
                      }}
                    />
                    <Typography variant="body2" color="text.secondary">Game PR Risk Analytics</Typography>
                  </Stack>
                  <Stack direction="row" alignItems="center" spacing={1.2} useFlexGap flexWrap="wrap">
                    <Typography sx={{ ...specTypeSx.h4, fontSize: { xs: 34, md: 40 }, lineHeight: 1.08 }}>
                      {(IP_EMOJI_MAP[currentBanner?.id] || "🎮")} {currentBanner?.name || riskData?.meta?.ip || "메이플스토리"}
                    </Typography>
                  </Stack>
                </Box>
                <Stack spacing={0.8} alignItems={{ xs: "flex-start", md: "flex-end" }}>
                  <Chip variant="outlined" label={`최근 갱신: ${lastUpdatedAt || "-"}`} sx={statusChipSx} />
                </Stack>
              </Stack>

              <Box sx={{ ...gridLayouts.statsGrid }}>
                <Paper
                  variant="outlined"
                  sx={{
                    p: { xs: 2.2, md: 2.5 },
                    borderRadius: 2.5,
                    borderColor: colors.slate[200],
                    boxShadow: shadows.lg,
                  }}
                >
                  <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 700, color: colors.slate[600] }}>위기 지수</Typography>
                      <Typography variant="caption" color="text.secondary">Crisis Score</Typography>
                    </Box>
                    <Chip
                      size="small"
                      label={<span><AlertTriangle {...iconProps({ size: 14 })} style={inlineIconSx} />{alertInfo.label}</span>}
                      sx={{
                        bgcolor: alertLevel === "P1" ? colors.status.error.light : alertLevel === "P2" ? colors.status.warning.light : colors.status.success.light,
                        color: alertLevel === "P1" ? colors.status.error.text : alertLevel === "P2" ? colors.status.warning.text : colors.status.success.text,
                        border: "none",
                        fontWeight: 700,
                      }}
                    />
                  </Stack>
                  <Box sx={{ mt: 2 }}>
                    <Stack direction="row" spacing={0.7} alignItems="flex-end">
                      <Typography sx={{ fontSize: { xs: 44, md: 52 }, lineHeight: 1, fontWeight: 800, color: alertLevel === "P1" ? colors.status.error.main : alertLevel === "P2" ? colors.status.warning.main : colors.status.success.main }}>
                        {riskValue.toFixed(1)}
                      </Typography>
                      <Typography sx={{ fontSize: 18, color: colors.slate[400], pb: 0.6 }}>/100</Typography>
                    </Stack>
                    <Stack direction="row" spacing={0.8} alignItems="center" sx={{ mt: 1 }}>
                      <Chip
                        size="small"
                        label={
                          <span>
                            {CrisisDeltaIcon ? <CrisisDeltaIcon {...iconProps({ size: 13 })} style={inlineIconSx} /> : null}
                            {toSignedText(crisisChange, 1)}
                          </span>
                        }
                        sx={{ bgcolor: crisisDeltaTone.bg, color: crisisDeltaTone.color, border: "none", fontWeight: 700 }}
                      />
                      <Typography variant="caption" color="text.secondary">전일 대비</Typography>
                    </Stack>
                    <Box sx={{ mt: 1.4 }}>
                      <Box sx={{ ...progressBarSx, borderRadius: borderRadius.full }}>
                        <Box
                          sx={{
                            width: `${Math.max(0, Math.min(100, riskValue))}%`,
                            height: "100%",
                            borderRadius: "inherit",
                            transition: "width 360ms cubic-bezier(0.22, 1, 0.36, 1)",
                            background:
                              alertLevel === "P1"
                                ? "linear-gradient(90deg, #f87171 0%, #dc2626 100%)"
                                : alertLevel === "P2"
                                  ? "linear-gradient(90deg, #fbbf24 0%, #f59e0b 100%)"
                                  : "linear-gradient(90deg, #34d399 0%, #10b981 100%)",
                          }}
                        />
                      </Box>
                      <Stack direction="row" justifyContent="space-between" sx={{ mt: 0.7 }}>
                        <Typography sx={{ fontSize: 11, color: colors.status.success.main, fontWeight: 600 }}>안전</Typography>
                        <Typography sx={{ fontSize: 11, color: colors.status.warning.main, fontWeight: 600 }}>주의</Typography>
                        <Typography sx={{ fontSize: 11, color: colors.status.error.main, fontWeight: 600 }}>위험</Typography>
                      </Stack>
                    </Box>
                  </Box>
                </Paper>

                {statCards.map((stat) => {
                  const tone = getDeltaToneToken(stat.delta, stat.deltaMode);
                  const StatDeltaIcon = tone.iconName ? DELTA_ICON_MAP[tone.iconName] : null;
                  const StatIcon = STAT_ICON_MAP[stat.iconKey] || FileText;
                  return (
                  <Paper
                    key={stat.key}
                    variant="outlined"
                    sx={{
                      p: { xs: 2, md: 2.2 },
                      borderRadius: 2.5,
                      borderColor: colors.slate[200],
                    }}
                  >
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Typography variant="body2" sx={{ fontWeight: 700, color: colors.slate[600] }}>{stat.label}</Typography>
                      <Box sx={{ width: 34, height: 34, borderRadius: 1.2, bgcolor: stat.bgColor, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <StatIcon {...iconProps({ size: 18, color: stat.color })} />
                      </Box>
                    </Stack>
                    <Box sx={{ mt: 1.5 }}>
                      <Stack direction="row" spacing={0.5} alignItems="baseline">
                        <Typography sx={{ fontSize: { xs: 30, md: 34 }, fontWeight: 800, lineHeight: 1, color: colors.slate[800] }}>{stat.value}</Typography>
                        <Typography sx={{ fontSize: 15, color: colors.slate[400] }}>{stat.unit}</Typography>
                      </Stack>
                      <Stack direction="row" spacing={0.8} alignItems="center" sx={{ mt: 1 }}>
                        <Chip
                          size="small"
                          label={
                            <span>
                              {StatDeltaIcon ? <StatDeltaIcon {...iconProps({ size: 13 })} style={inlineIconSx} /> : null}
                              {toSignedText(stat.delta, stat.deltaDigits)}
                            </span>
                          }
                          sx={{ bgcolor: tone.bg, color: tone.color, border: "none", fontWeight: 700 }}
                        />
                      </Stack>
                    </Box>
                  </Paper>
                  );
                })}
              </Box>

              <Paper variant="outlined" sx={{ p: { xs: 1.8, md: 2 }, borderRadius: 2.5, borderColor: colors.slate[200] }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.1 }}>
                  <Typography variant="body2" sx={{ fontWeight: 700, color: colors.slate[600] }}>핵심 이슈 TOP 3</Typography>
                </Stack>
                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(3, minmax(0, 1fr))" }, gap: 1 }}>
                  {topIssues.map((issue, idx) => (
                    <Paper
                      key={`${issue.name}-${idx}`}
                      variant="outlined"
                      sx={topIssueCardSx(issue.severity === "high")}
                    >
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
                          <Box sx={topIssueBadgeSx(issue.severity === "high")}>
                            {idx + 1}
                          </Box>
                          <Typography sx={{ fontSize: 14, fontWeight: 700, color: colors.slate[800], whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {issue.name}
                          </Typography>
                        </Stack>
                        <Typography sx={{ fontSize: 13, fontWeight: 700, color: issue.severity === "high" ? colors.status.error.dark : colors.slate[500] }}>
                          {issue.count}건
                        </Typography>
                      </Stack>
                    </Paper>
                  ))}
                </Box>
              </Paper>

              <Stack direction={{ xs: "column", lg: "row" }} justifyContent="space-between" alignItems={{ xs: "stretch", lg: "center" }} spacing={1}>
                <Stack direction="row" alignItems="center" spacing={1.1} sx={{ minHeight: 42 }}>
                  <IconButton
                    size="small"
                    aria-label="이전 게임"
                    sx={bannerPagerBtnSx}
                    onClick={goPrevBanner}
                    disabled={currentBannerIndex <= 0}
                  >
                    <ChevronLeft {...iconProps({ size: 20 })} />
                  </IconButton>
                  <Paper variant="outlined" sx={paginationTrackSx}>
                    <Stack direction="row" spacing={0.8} alignItems="center">
                      {Array.from({ length: Math.max(bannerItems.length, 1) }).map((_, idx) => {
                        const active = idx === Math.max(currentBannerIndex, 0);
                        return (
                          <Box
                            key={`banner-dot-${idx}`}
                            sx={paginationDotSx(active)}
                          />
                        );
                      })}
                    </Stack>
                  </Paper>
                  <IconButton
                    size="small"
                    aria-label="다음 게임"
                    sx={bannerPagerBtnSx}
                    onClick={goNextBanner}
                    disabled={currentBannerIndex >= bannerItems.length - 1}
                  >
                    <ChevronRight {...iconProps({ size: 20 })} />
                  </IconButton>
                </Stack>
                <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ justifyContent: { xs: "flex-start", md: "flex-end" } }}>
                  <Chip variant="outlined" label={<span><RefreshCw {...iconProps()} style={inlineIconSx} />{loading ? "업데이트 중" : "자동 업데이트"}</span>} sx={statusChipSx} />
                  <Chip variant="outlined" label={`현재: ${(riskData?.meta?.ip || "-")}`} sx={statusChipSx} />
                  <Chip variant="outlined" label={`마지막 갱신: ${lastUpdatedAt || "-"}`} sx={statusChipSx} />
                </Stack>
              </Stack>
              {usingMock ? <Chip color="warning" variant="outlined" label="예시 데이터" /> : null}
            </Stack>
            <Box sx={{ mt: 1.5 }}>
              <PageStatusView
                loading={{
                  show: loading,
                  title: "데이터를 불러오는 중",
                  subtitle: "위기 지수와 이슈 분류를 업데이트하고 있습니다.",
                }}
              />
            </Box>
            {notice ? <Alert severity={usingMock ? "warning" : "info"} icon={false} sx={{ mt: 1.5 }}><span>{usingMock ? <AlertTriangle {...iconProps()} style={inlineIconSx} /> : <Info {...iconProps()} style={inlineIconSx} />}{notice}</span></Alert> : null}
            {modeMismatchWarning ? <Alert severity="warning" icon={false} sx={{ mt: 1.5 }}><span><AlertTriangle {...iconProps()} style={inlineIconSx} />{modeMismatchWarning}</span></Alert> : null}
            {healthDiagCode ? (
              <Alert severity="info" icon={false} sx={{ mt: 1.5 }}>
                <span><Info {...iconProps()} style={inlineIconSx} />실시간 상태 정보가 일시적으로 누락되었습니다. 진단코드: {healthDiagCode}</span>
              </Alert>
            ) : null}
            <Box sx={{ mt: 1.5 }}>
              <PageStatusView
                error={{
                  show: Boolean(error),
                  title: "데이터를 불러오지 못했습니다.",
                  details: error,
                  diagnosticCode: errorCode,
                  actionLabel: "다시 시도",
                  onAction: () => loadDashboard(ip),
                }}
              />
            </Box>
          </CardContent>
        </Card>

        <Card variant="outlined" sx={sectionCardSx}>
          <CardContent sx={contentCardSx}>
            <Typography variant="h6" sx={sectionTitleSx}>일별 보도량 및 부정 비율 추이</Typography>
            <Box ref={trendChartRef} sx={{ width: "100%", height: { xs: 220, sm: 260, md: 290 } }} />
          </CardContent>
        </Card>

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", lg: "1.4fr 1fr" },
            gap: { xs: 1, md: 1.5 },
          }}
        >
          <Card variant="outlined" sx={sectionCardSx}><CardContent sx={contentCardSx}>
              <Typography variant="h6" sx={{ ...sectionTitleSx, lineHeight: 1.25 }}>
                언론사별<br />여론 분포
              </Typography>
              <Box ref={outletChartRef} sx={{ width: "100%", height: { xs: 300, md: 420 } }} />
            </CardContent></Card>
          <Card variant="outlined" sx={sectionCardSx}><CardContent sx={contentCardSx}>
              <Typography variant="h6" sx={{ ...sectionTitleSx, lineHeight: 1.25 }}>
                위험 이슈<br />점수
              </Typography>
              <Box ref={themeChartRef} sx={{ width: "100%", height: { xs: 300, md: 420 } }} />
            </CardContent></Card>
        </Box>

        <Card variant="outlined" sx={sectionCardSx}><CardContent sx={contentCardSx}>
          <Typography variant="h6" sx={sectionTitleSx}>주요 키워드</Typography>
          <Box
            ref={keywordChartRef}
            sx={{
              width: "100%",
              minHeight: 320,
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 2,
              bgcolor: "#f8fbff",
            }}
          />
        </CardContent></Card>

        <Card variant="outlined" sx={sectionCardSx}><CardContent sx={contentCardSx}>
          <Typography variant="h6" sx={sectionTitleSx}>대응 인사이트</Typography>
          <Grid container spacing={1.2}>
            <Grid item xs={12} md={4}>
              <Paper variant="outlined" sx={subPanelSx}>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>핵심 위험 이슈</Typography>
                <Typography variant="h6" sx={{ mt: 1 }}>{topRisk?.theme || "-"}</Typography>
                <Typography variant="caption" color="text.secondary">
                  이슈 점수 {topRiskThemeScore ?? "-"}점 · 부정 {topRisk?.negative_ratio ?? "-"}%
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} md={4}>
              <Paper variant="outlined" sx={subPanelSx}>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>주목할 언론사</Typography>
                <Typography variant="h6" sx={{ mt: 1 }}>{outletRisk?.outlet || "-"}</Typography>
                <Typography variant="caption" color="text.secondary">
                  기사 {outletRisk?.article_count || 0}건 · 부정 {outletRisk?.negative_ratio || 0}% · 위험 점수 {outletRisk?.score || 0}
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} md={4}>
              <Paper variant="outlined" sx={subPanelSx}>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>대응 권고</Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
                  {recommendedAction}
                </Typography>
              </Paper>
            </Grid>
          </Grid>
        </CardContent></Card>

        <Card variant="outlined" sx={sectionCardSx}><CardContent sx={contentCardSx}>
          <Typography variant="h6" sx={sectionTitleSx}>이슈 유형 분석</Typography>
          <Stack direction="row" spacing={1} sx={{ mb: 1, flexWrap: "wrap", rowGap: 1 }}>
            {(clusterData?.top_outlets || []).map((o) => (
              <Chip key={o.outlet} label={`${o.outlet} ${o.article_count}건`} size="small" variant="outlined" sx={controlChipSx} />
            ))}
          </Stack>
          <Divider sx={{ mb: 1 }} />
          <Grid container spacing={1.2}>
            {clusters.map((c) => (
              <Grid item xs={12} md={6} key={c.cluster}>
                <Paper variant="outlined" sx={subPanelSx}>
                  <Typography sx={{ fontWeight: 700 }}>{c.cluster}</Typography>
                  <Typography variant="caption" color="text.secondary">{c.article_count}건 · 부정 {c.negative_ratio}%</Typography>
                  <Stack direction="row" sx={{ mt: 1, height: 8, borderRadius: 999, overflow: "hidden", bgcolor: "#edf2fb" }}>
                    <Box sx={{ width: `${c.sentiment?.positive || 0}%`, bgcolor: "success.main" }} />
                    <Box sx={{ width: `${c.sentiment?.neutral || 0}%`, bgcolor: "warning.main" }} />
                    <Box sx={{ width: `${c.sentiment?.negative || 0}%`, bgcolor: "error.main" }} />
                  </Stack>
                  <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
                    관련 키워드: {(c.keywords || []).join(", ")}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                    주요 기사: {(c.samples || [])[0] || "-"}
                  </Typography>
                </Paper>
              </Grid>
            ))}
          </Grid>
        </CardContent></Card>

        <Card variant="outlined" sx={sectionCardSx}>
          <CardContent sx={contentCardSx}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
              <Typography variant="h6" sx={sectionTitleSx}>최신 기사</Typography>
              <Typography variant="caption" color="text.secondary">
                {articleItems.length.toLocaleString()} / {articleTotal.toLocaleString()}
              </Typography>
            </Stack>
            <Stack spacing={1}>
              {articleItems.length ? (
                <WindowList
                  rowCount={articleItems.length}
                  rowHeight={ARTICLE_ROW_HEIGHT}
                  overscanCount={6}
                  defaultHeight={ARTICLE_LIST_MIN_HEIGHT}
                  style={{ height: articleListHeight, width: "100%" }}
                  rowProps={{ items: articleItems }}
                  onRowsRendered={handleArticleRowsRendered}
                  rowComponent={({ index, style, items, ariaAttributes }) => {
                    const a = items[index];
                    return (
                      <Box style={style} sx={{ px: 0.2, py: 0.45 }} {...ariaAttributes}>
                        <Paper variant="outlined" sx={{ p: 1.2, borderRadius: 2 }}>
                          <Stack direction="row" justifyContent="space-between" spacing={1}>
                            <Typography
                              component={a.url ? "a" : "span"}
                              href={a.url || undefined}
                              target={a.url ? "_blank" : undefined}
                              rel={a.url ? "noreferrer" : undefined}
                              sx={{
                                minWidth: 0,
                                fontWeight: 700,
                                color: "#10284a",
                                textDecoration: "none",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                                "&:hover": { textDecoration: a.url ? "underline" : "none" },
                              }}
                            >
                              {a.title || "(제목 없음)"}
                            </Typography>
                            <Chip
                              size="small"
                              label={a.sentiment || "중립"}
                              color={a.sentiment === "부정" ? "error" : a.sentiment === "긍정" ? "success" : "default"}
                              variant="outlined"
                              sx={controlChipSx}
                            />
                          </Stack>
                          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.6 }}>
                            {a.date || "-"} · {a.outlet || "unknown"}
                          </Typography>
                          {a.description ? (
                            <Typography
                              variant="body2"
                              color="text.secondary"
                              sx={{
                                mt: 0.6,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {a.description}
                            </Typography>
                          ) : null}
                        </Paper>
                      </Box>
                    );
                  }}
                />
              ) : null}
            </Stack>
            {articleLoading ? (
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1.2 }}>
                기사를 불러오는 중…
              </Typography>
            ) : null}
            {!articleLoading && !articleHasMore && articleItems.length > 0 ? (
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1.2 }}>
                전체 기사를 불러왔습니다.
              </Typography>
            ) : null}
            {!articleLoading && articleItems.length === 0 ? (
              <Box sx={{ mt: 1.2 }}>
                <PageStatusView
                  empty={{
                    show: true,
                    title: "기사 없음",
                    subtitle: "해당 조건의 기사가 없습니다.",
                    compact: true,
                  }}
                />
              </Box>
            ) : null}
            {articleError ? (
              <Box sx={{ mt: 1 }}>
                <PageStatusView
                  error={{
                    show: true,
                    title: "기사 목록을 불러오지 못했습니다.",
                    details: articleError,
                    diagnosticCode: articleErrorCode,
                    actionLabel: "다시 시도",
                    onAction: () => loadMoreArticles(ip, true),
                  }}
                />
              </Box>
            ) : null}
          </CardContent>
        </Card>
      </Stack>
    </Container>
    </Box>
  );
}
