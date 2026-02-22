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
  Collapse,
  Container,
  Divider,
  Grid,
  IconButton,
  List,
  ListItem,
  ListItemText,
  LinearProgress,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import { AlertTriangle, ChevronLeft, ChevronRight, Info, RefreshCw } from "lucide-react";
import { List as WindowList } from "react-window";
import PageStatusView from "../../components/PageStatusView";
import ApiGuardBanner from "../../components/ApiGuardBanner";
import LabelWithTip from "../../components/LabelWithTip";
import { apiGet, getDiagnosticCode } from "../../lib/api";
import { buildDiagnosticScope, toRequestErrorState } from "../../lib/pageStatus";
import {
  createEmptyCluster,
  createEmptyRisk,
  normalizeNexonDashboard,
} from "../../lib/normalizeNexon";
import {
  contentCardSx,
  filterChipSx,
  MUI_SPEC,
  metricCardSx,
  metricValueSx,
  navButtonSx,
  pageContainerSx,
  pageShellCleanSx,
  panelPaperSx,
  riskAccent,
  sectionCardSx,
  sectionTitleSx,
  specTypeSx,
  statusChipSx,
  subPanelSx,
} from "../../lib/uiTokens";

const USE_MOCK_FALLBACK = process.env.NEXT_PUBLIC_USE_MOCK_FALLBACK === "true";
const ARTICLE_PAGE_SIZE = 20;
const ARTICLE_ROW_HEIGHT = 122;
const ARTICLE_LIST_MAX_HEIGHT = 640;
const ARTICLE_LIST_MIN_HEIGHT = 244;
const DIAG_SCOPE = {
  health: buildDiagnosticScope("NEX", "HEALTH"),
  dashboard: buildDiagnosticScope("NEX", "DASH"),
  article: buildDiagnosticScope("NEX", "ART"),
};
const IP_BANNER_STYLE = {
  all: {
    kicker: "NEXON OVERVIEW",
    accent: "#8fb6ff",
    bg: "linear-gradient(135deg,#0f172a 0%,#111827 55%,#1f2937 100%)",
    glow: "radial-gradient(circle at 84% 14%, rgba(143,182,255,.20) 0%, rgba(143,182,255,0) 60%)",
  },
  maplestory: { kicker: "MAPLESTORY", accent: "#f5c16c", bg: "linear-gradient(135deg,#0f172a 0%,#1f2937 52%,#334155 100%)", glow: "radial-gradient(circle at 84% 14%, rgba(245,193,108,.18) 0%, rgba(245,193,108,0) 60%)" },
  dnf: { kicker: "DNF", accent: "#ff9db0", bg: "linear-gradient(135deg,#111827 0%,#1f2937 55%,#334155 100%)", glow: "radial-gradient(circle at 84% 14%, rgba(255,157,176,.18) 0%, rgba(255,157,176,0) 60%)" },
  arcraiders: { kicker: "ARC RAIDERS", accent: "#8de5ff", bg: "linear-gradient(135deg,#0f172a 0%,#1f2937 55%,#374151 100%)", glow: "radial-gradient(circle at 84% 14%, rgba(141,229,255,.18) 0%, rgba(141,229,255,0) 60%)" },
  bluearchive: { kicker: "BLUE ARCHIVE", accent: "#a6bcff", bg: "linear-gradient(135deg,#0f172a 0%,#1e293b 55%,#334155 100%)", glow: "radial-gradient(circle at 84% 14%, rgba(166,188,255,.18) 0%, rgba(166,188,255,0) 60%)" },
  fconline: { kicker: "FC ONLINE", accent: "#9fe8c2", bg: "linear-gradient(135deg,#0f172a 0%,#1f2937 55%,#334155 100%)", glow: "radial-gradient(circle at 84% 14%, rgba(159,232,194,.18) 0%, rgba(159,232,194,0) 60%)" },
};
const ICON_TOKEN = Object.freeze({ size: 16, strokeWidth: 2, color: "currentColor" });
const iconProps = (overrides) => ({ ...ICON_TOKEN, ...overrides });
const inlineIconSx = { display: "inline-flex", verticalAlign: "middle", marginRight: "6px" };

const getDailyExposure = (row) =>
  Number(row?.total_mentions ?? row?.mention_count ?? row?.exposure_count ?? row?.exposure ?? row?.total_exposure ?? row?.article_count ?? 0);
const getDailyArticleCount = (row) => Number(row?.article_count ?? 0);

const bannerPagerBtnSx = {
  minWidth: 0,
  width: 38,
  height: 38,
  borderRadius: 1.3,
  border: "1px solid rgba(15,23,42,.15)",
  color: "#0f172a",
  bgcolor: "rgba(255,255,255,.88)",
  transition: "all .16s ease",
  "&:hover": {
    bgcolor: "#fff",
    transform: "translateY(-1px)",
    boxShadow: "0 9px 16px rgba(15,23,42,.14)",
  },
  "&.Mui-disabled": {
    color: "#94a3b8",
    borderColor: "rgba(148,163,184,.35)",
    bgcolor: "rgba(248,250,252,.9)",
    boxShadow: "none",
  },
};

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
  const [burstStatus, setBurstStatus] = useState(null);
  const [burstEvents, setBurstEvents] = useState([]);
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
  const [showMetricDetails, setShowMetricDetails] = useState(false);
  const [showBurstEventList, setShowBurstEventList] = useState(false);
  const [burstRange, setBurstRange] = useState("24h");
  const [burstVisibleCount, setBurstVisibleCount] = useState(10);
  const articleReqSeqRef = useRef(0);
  const articleAbortRef = useRef(null);
  const swipeStartXRef = useRef(null);
  const ipCacheRef = useRef(new Map());
  const requestSeqRef = useRef(0);
  const trendChartRef = useRef(null);
  const outletChartRef = useRef(null);
  const themeChartRef = useRef(null);
  const keywordChartRef = useRef(null);
  const riskHeatChartRef = useRef(null);
  const trendChartInstRef = useRef(null);
  const outletChartInstRef = useRef(null);
  const themeChartInstRef = useRef(null);
  const keywordChartInstRef = useRef(null);
  const riskHeatChartInstRef = useRef(null);
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
  const tipMap = {
    burst: "단기간에 기사가 급증한 이벤트 기록입니다.",
    cluster: "비슷한 키워드의 기사를 묶은 이슈 분류 수입니다.",
    alert: "위기 지수 수준에 따른 대응 우선순위입니다.",
  };

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
      setBurstStatus(cache.burstStatus);
      setBurstEvents(cache.burstEvents);
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
      const [riskPayload, clusterPayload, riskScorePayload, riskTimeseriesPayload, burstStatusPayload, burstEventsPayload, healthState] = await Promise.all([
        apiGet(`/api/risk-dashboard?${base.toString()}`),
        apiGet(`/api/ip-clusters?${base.toString()}&limit=6`),
        apiGet(`/api/risk-score?ip=${targetIp}`).catch(() => null),
        apiGet(`/api/risk-timeseries?ip=${targetIp}&hours=168&limit=600`).catch(() => null),
        apiGet("/api/burst-status").catch(() => null),
        apiGet("/api/burst-events?limit=50").catch(() => null),
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
      setBurstStatus(burstStatusPayload || null);
      setBurstEvents((burstEventsPayload?.items || []).slice(0, 50));
      setHealth(healthState.data || null);
      setHealthDiagCode(getHealthDiagnosticCode(healthState.error));
      setNotice(resolvedNotice);
      setLastUpdatedAt(refreshedAt);

      ipCacheRef.current.set(targetIp, {
        riskData: resolvedRisk,
        clusterData: resolvedCluster,
        riskScore: riskScorePayload || null,
        riskTimeseries: riskTimeseriesPayload?.items || [],
        burstStatus: burstStatusPayload || null,
        burstEvents: (burstEventsPayload?.items || []).slice(0, 50),
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
        const [rs, rt, bs, healthState] = await Promise.all([
          apiGet(`/api/risk-score?ip=${ip}`).catch(() => null),
          apiGet(`/api/risk-timeseries?ip=${ip}&hours=168&limit=600`).catch(() => null),
          apiGet("/api/burst-status").catch(() => null),
          apiGet("/api/health")
            .then((data) => ({ data, error: null }))
            .catch((error) => ({ data: null, error })),
        ]);
        if (rs) setRiskScore(rs);
        if (rt?.items) setRiskTimeseries(rt.items);
        if (bs) setBurstStatus(bs);
        if (healthState.data) setHealth(healthState.data);
        setHealthDiagCode(getHealthDiagnosticCode(healthState.error));
        if (rs || bs || healthState.data) setLastUpdatedAt(formatUpdatedAt());
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
  const topRisk = useMemo(() => {
    if (!Array.isArray(themes) || themes.length === 0) return null;
    const prioritized = themes
      .filter((row) => String(row?.theme || "") !== "신작/성과")
      .filter((row) => Number(row?.negative_ratio || 0) >= 5);
    const source = prioritized.length ? prioritized : themes;
    return [...source].sort((a, b) => {
      const diffNeg = Number(b?.negative_ratio || 0) - Number(a?.negative_ratio || 0);
      if (diffNeg !== 0) return diffNeg;
      const diffCount = Number(b?.article_count || 0) - Number(a?.article_count || 0);
      if (diffCount !== 0) return diffCount;
      return Number(b?.risk_score || 0) - Number(a?.risk_score || 0);
    })[0] || null;
  }, [themes]);
  const topRiskThemeScore = topRisk ? Math.round(Number(topRisk?.risk_score || 0) * 1000) / 10 : null;
  const selectedBurstStatus = useMemo(() => {
    const items = burstStatus?.items || [];
    return items.find((x) => x.ip_id === ip) || items.find((x) => x.ip_id === "all") || items[0] || null;
  }, [burstStatus, ip]);
  const recentBurstCount = useMemo(() => {
    const now = Date.now();
    return (burstEvents || [])
      .filter((evt) => (ip === "all" ? true : evt.ip_name === ip))
      .filter((evt) => now - new Date(String(evt.occurred_at).replace(" ", "T")).getTime() <= 30 * 60 * 1000)
      .length;
  }, [burstEvents, ip]);
  const filteredBurstEvents = useMemo(
    () => (burstEvents || []).filter((evt) => (ip === "all" ? true : evt.ip_name === ip)),
    [burstEvents, ip]
  );
  const burstRangeHours = burstRange === "7d" ? 24 * 7 : 24;
  const rangedBurstEvents = useMemo(() => {
    const now = Date.now();
    const windowMs = burstRangeHours * 60 * 60 * 1000;
    return filteredBurstEvents
      .filter((evt) => {
        const ts = new Date(String(evt.occurred_at || "").replace(" ", "T")).getTime();
        return Number.isFinite(ts) && now - ts <= windowMs;
      })
      .sort((a, b) => {
        const ta = new Date(String(a.occurred_at || "").replace(" ", "T")).getTime();
        const tb = new Date(String(b.occurred_at || "").replace(" ", "T")).getTime();
        return tb - ta;
      });
  }, [burstRangeHours, filteredBurstEvents]);
  const burstSummaryCount = rangedBurstEvents.length;
  const burstSummaryLastOccurredAt = useMemo(() => {
    if (!rangedBurstEvents.length) return "-";
    const raw = String(rangedBurstEvents[0]?.occurred_at || "").replace(" ", "T");
    const dt = new Date(raw);
    if (Number.isNaN(dt.getTime())) return String(rangedBurstEvents[0]?.occurred_at || "-");
    return dt.toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });
  }, [rangedBurstEvents]);
  const burstStatusLabel = burstSummaryCount > 0 ? "감지됨" : "없음";
  const visibleBurstEvents = rangedBurstEvents.slice(0, burstVisibleCount);
  const canLoadMoreBurstEvents = visibleBurstEvents.length < rangedBurstEvents.length;

  useEffect(() => {
    setBurstVisibleCount(10);
  }, [burstRange, ip]);
  const articleListHeight = useMemo(() => {
    const estimated = articleItems.length * ARTICLE_ROW_HEIGHT;
    if (!estimated) return ARTICLE_LIST_MIN_HEIGHT;
    return Math.max(ARTICLE_LIST_MIN_HEIGHT, Math.min(ARTICLE_LIST_MAX_HEIGHT, estimated));
  }, [articleItems.length]);
  const handleArticleRowsRendered = (visibleRows) => {
    if (!articleHasMore || articleLoading) return;
    if (visibleRows.stopIndex >= articleItems.length - 5) {
      loadMoreArticles(ip, false);
    }
  };
  const riskValue = Number(riskScore?.risk_score || 0);
  const riskFormulaVersion = riskScore?.risk_formula_version ? String(riskScore.risk_formula_version) : "";
  const hasHeatValue = riskScore && riskScore.issue_heat != null;
  const heatValue = hasHeatValue ? Number(riskScore?.issue_heat || 0) : null;
  const alertLevel = String(riskScore?.alert_level || "P3").toUpperCase();
  const alertInfo =
    alertLevel === "P1"
      ? { label: "심각", desc: "위기 지수 70 이상", color: "error" }
      : alertLevel === "P2"
        ? { label: "주의", desc: "위기 지수 45~69", color: "warning" }
        : { label: "관심", desc: "위기 지수 0~44", color: "success" };
  const riskGaugeColor = riskValue >= 70 ? "#dc3c4a" : riskValue >= 45 ? "#e89c1c" : "#11a36a";
  const riskMeaning = useMemo(() => {
    if (riskValue >= 70) return { label: "심각", color: "error" };
    if (riskValue >= 45) return { label: "높음", color: "warning" };
    if (riskValue >= 20) return { label: "주의", color: "info" };
    return { label: "낮음", color: "success" };
  }, [riskValue]);
  const recent24hArticles = Number(riskScore?.article_count_window ?? riskScore?.exposure_count_window ?? 0);
  const totalArticleSum = useMemo(
    () => (dailyRows || []).reduce((acc, row) => acc + getDailyArticleCount(row), 0),
    [dailyRows]
  );
  const recentWeekRows = useMemo(() => (dailyRows || []).slice(-7), [dailyRows]);
  const weeklyBaselineAvg = useMemo(() => {
    if (!recentWeekRows.length) return 0;
    return recentWeekRows.reduce((acc, row) => acc + getDailyArticleCount(row), 0) / recentWeekRows.length;
  }, [recentWeekRows]);
  const weeklyBaselineMin = useMemo(() => {
    if (!recentWeekRows.length) return 0;
    return Math.min(...recentWeekRows.map((row) => getDailyArticleCount(row)));
  }, [recentWeekRows]);
  const weeklyBaselineMax = useMemo(() => {
    if (!recentWeekRows.length) return 0;
    return Math.max(...recentWeekRows.map((row) => getDailyArticleCount(row)));
  }, [recentWeekRows]);
  const baselineRatio = weeklyBaselineAvg > 0 ? recent24hArticles / weeklyBaselineAvg : 0;
  const spreadValue = Number(riskScore?.spread_ratio || 0);
  const uncertaintyValue = Number(riskScore?.uncertain_ratio || 0);
  const volumeHint = useMemo(() => {
    if (recent24hArticles >= 20) return "충분";
    if (recent24hArticles >= 5) return "보통";
    return "부족";
  }, [recent24hArticles]);
  const spreadHint = useMemo(() => {
    if (spreadValue >= 1.8) return "같은 이슈가 여러 기사로 재확산되는 구간";
    if (spreadValue >= 1.2) return "유사 이슈가 반복 보도되는 구간";
    return "개별 이슈 위주(재확산 낮음)";
  }, [spreadValue]);
  const uncertaintyHint = useMemo(() => {
    if (uncertaintyValue >= 0.5) return "여론 판정 불확실 기사 비중이 높음";
    if (uncertaintyValue >= 0.2) return "불확실 기사 비중이 일부 존재";
    return "여론 판정 안정";
  }, [uncertaintyValue]);
  const liveInterpretation = useMemo(() => {
    if (recent24hArticles < 5) return "보도량이 매우 적어 단기 변동성이 큽니다.";
    if (riskValue >= 70) return "보도량 급증과 고위험 이슈 집중으로 위기 지수가 심각 단계입니다.";
    if (riskValue >= 45) return "위기 지수가 높은 상태입니다. 확산도와 여론 변화를 밀착 모니터링하세요.";
    if (baselineRatio >= 1.2 || spreadValue >= 1.2) return "위기 지수는 낮지만 보도량 또는 확산도가 평균보다 상승 중입니다.";
    return "보도량과 확산도가 안정적이라 현재 위기 지수는 낮은 상태입니다.";
  }, [baselineRatio, recent24hArticles, riskValue, spreadValue]);
  const quickSummary = useMemo(() => {
    if (recent24hArticles < 5) return "보도량이 적어 현재 점수는 참고용입니다.";
    if (riskValue >= 45) return "즉시 모니터링이 필요한 구간입니다.";
    return "현재는 위기 신호가 크지 않습니다.";
  }, [recent24hArticles, riskValue]);
  const outletRisk = useMemo(() => {
    if (!outletRows.length) return null;
    return [...outletRows]
      .map((x) => ({ ...x, score: Math.round((Number(x.article_count || 0) * Number(x.negative_ratio || 0)) / 100) }))
      .sort((a, b) => b.score - a.score)[0];
  }, [outletRows]);
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
      if (riskHeatChartRef.current && !riskHeatChartInstRef.current) riskHeatChartInstRef.current = echarts.init(riskHeatChartRef.current);
      setChartsReady(true);
      onResize = () => {
        trendChartInstRef.current?.resize();
        outletChartInstRef.current?.resize();
        themeChartInstRef.current?.resize();
        keywordChartInstRef.current?.resize();
        riskHeatChartInstRef.current?.resize();
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
      riskHeatChartInstRef.current?.dispose();
      trendChartInstRef.current = null;
      outletChartInstRef.current = null;
      themeChartInstRef.current = null;
      keywordChartInstRef.current = null;
      riskHeatChartInstRef.current = null;
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
            color: "#64748b",
          },
        },
        yAxis: [
          {
            type: "value",
            name: "보도량(건)",
            axisLabel: {
              color: "#64748b",
              formatter: (v) => Number(v || 0).toLocaleString(),
            },
          },
          {
            type: "value",
            name: "부정 비율(%)",
            min: 0,
            max: 100,
            axisLabel: { color: "#64748b", formatter: "{value}%" },
          },
        ],
        series: [
          {
            name: "보도량",
            type: "bar",
            yAxisIndex: 0,
            data: dailyRows.map((r) => getDailyArticleCount(r)),
            itemStyle: { color: "#2f67d8", borderRadius: [4, 4, 0, 0] },
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
            lineStyle: { color: "#dc3c4a", width: 2 },
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
        xAxis: { type: "value", axisLabel: { color: "#64748b" } },
        yAxis: {
          type: "category",
          data: displayedOutlets.map((r) => r.outlet),
          axisLabel: {
            color: "#64748b",
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
            itemStyle: { color: "#11a36a" },
          },
          {
            name: "중립",
            type: "bar",
            stack: "sent",
            data: displayedOutlets.map((r) => Number(r.neutral_ratio || 0)),
            itemStyle: { color: "#f2b248" },
          },
          {
            name: "부정",
            type: "bar",
            stack: "sent",
            data: displayedOutlets.map((r) => Number(r.negative_ratio || 0)),
            itemStyle: { color: "#dc3c4a" },
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
        xAxis: { type: "value", axisLabel: { color: "#64748b" } },
        yAxis: {
          type: "category",
          data: themes.map((t) => t.theme),
          axisLabel: {
            color: "#64748b",
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
            itemStyle: { color: "#7b61ff", borderRadius: [0, 4, 4, 0] },
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
              color: "#fff",
            },
            upperLabel: { show: false },
            itemStyle: {
              borderColor: "#fff",
              borderWidth: 1,
              gapWidth: 1,
            },
            levels: [
              {
                color: ["#2f67d8", "#11a36a", "#e89c1c", "#dc3c4a", "#4a63d9", "#00a5c4"],
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

  useEffect(() => {
    if (!chartsReady || !riskHeatChartInstRef.current) return;
    const rows = (riskTimeseries || []).slice(-168);
    const x = rows.map((r) => String(r.ts || "").slice(5, 16));
    riskHeatChartInstRef.current.setOption(
      {
        animation: false,
        grid: { left: 38, right: 20, top: 26, bottom: 42 },
        tooltip: { trigger: "axis" },
        legend: { top: 0, data: ["위기 지수", "이슈량"] },
        xAxis: { type: "category", data: x, axisLabel: { color: "#64748b", hideOverlap: true } },
        yAxis: { type: "value", min: 0, max: 100, axisLabel: { color: "#64748b", formatter: "{value}" } },
        series: [
          {
            name: "위기 지수",
            type: "line",
            data: rows.map((r) => Number(r.risk_score || 0)),
            smooth: true,
            symbol: "none",
            lineStyle: { width: 2, color: "#dc3c4a" },
          },
          {
            name: "이슈량",
            type: "line",
            data: rows.map((r) => Number(r.issue_heat || 0)),
            smooth: true,
            symbol: "none",
            lineStyle: { width: 2, color: "#2f67d8" },
          },
        ],
      },
      { notMerge: true, lazyUpdate: true }
    );
  }, [chartsReady, riskTimeseries]);

  return (
    <Box sx={{ ...pageShellCleanSx, py: { xs: 2, sm: 2.5, md: 4.5 } }}>
    <Container maxWidth="xl" sx={pageContainerSx}>
      <Stack spacing={{ xs: 1.7, md: 2.4 }}>
        <Paper sx={{ ...panelPaperSx, bgcolor: "#f8fafc", boxShadow: "0 8px 24px rgba(15,23,42,.04)" }}>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            alignItems={{ xs: "flex-start", sm: "center" }}
            justifyContent="space-between"
            spacing={1.2}
            sx={{ px: { xs: 2, md: 3 }, py: 1.5 }}
          >
            <Stack direction="row" alignItems="center" spacing={1.2}>
              <Box sx={{ width: 22, height: 22, borderRadius: 1.2, background: "linear-gradient(140deg,#0f3b66 0 58%,#9acb19 58% 100%)" }} />
              <Box sx={{ py: 0.2 }}>
                <Typography
                  sx={{
                    ...specTypeSx.h6,
                    fontSize: { xs: 20, md: 22 },
                    color: "#0f172a",
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
          <CardContent>
            <Stack spacing={1.1}>
              <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems={{ xs: "flex-start", md: "center" }} spacing={0.7}>
                <Typography variant="body2" color="text.secondary">
                  집중 모니터링
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {Math.max(currentBannerIndex + 1, 1)} / {bannerItems.length}
                </Typography>
              </Stack>

              {currentBanner ? (
                <Paper
                  onTouchStart={handleBannerTouchStart}
                  onTouchEnd={handleBannerTouchEnd}
                  sx={{
                    width: "100%",
                    minHeight: { xs: 260, md: 288 },
                    p: 0,
                    borderRadius: 2.3,
                    color: "#f1f5f9",
                    position: "relative",
                    overflow: "hidden",
                    border: "1px solid rgba(148,163,184,.2)",
                    boxShadow: "0 12px 24px rgba(15,23,42,.14)",
                  }}
                >
                  <Grid container sx={{ minHeight: { xs: 260, md: 288 } }}>
                    <Grid item xs={12} md={8}>
                      <Box
                        sx={{
                          height: "100%",
                          p: { xs: 2, md: 2.4 },
                          background: currentBanner.visual.bg,
                          position: "relative",
                        }}
                      >
                        <Box sx={{ position: "absolute", inset: 0, background: currentBanner.visual.glow, opacity: 0.9 }} />
                        <Stack sx={{ position: "relative", zIndex: 1, height: "100%" }} justifyContent="space-between">
                          <Stack spacing={0.8}>
                            <Typography sx={{ fontSize: 11, letterSpacing: ".16em", color: currentBanner.visual.accent, fontWeight: 800 }}>
                              {currentBanner.visual.kicker}
                            </Typography>
                            <Typography sx={{ ...specTypeSx.h4, fontSize: { xs: 32, md: 44 }, lineHeight: 1.03 }}>
                              {currentBanner.name}
                            </Typography>
                            <Typography sx={{ fontSize: 13, color: "rgba(226,232,240,.95)" }}>
                              {currentBanner.id === "all" ? "전체 리스크를 한 번에 감시" : "선택 IP 단일 집중 모드"}
                            </Typography>
                          </Stack>
                          <Grid container spacing={1}>
                            {[
                              { k: "Risk", v: riskValue.toFixed(1) },
                              { k: "Alert", v: alertLevel },
                              { k: "24h", v: recent24hArticles.toLocaleString() },
                              { k: "Cluster", v: String(Number(clusterData?.meta?.cluster_count || 0)) },
                            ].map((metric) => (
                              <Grid item xs={6} sm={3} key={metric.k}>
                                <Paper
                                  variant="outlined"
                                  sx={{
                                    p: .9,
                                    borderRadius: 1.3,
                                    bgcolor: "rgba(15,23,42,.28)",
                                    borderColor: "rgba(241,245,249,.2)",
                                  }}
                                >
                                  <Typography sx={{ fontSize: 10, color: "rgba(226,232,240,.86)", letterSpacing: ".08em" }}>{metric.k}</Typography>
                                  <Typography sx={{ fontSize: 18, fontWeight: 800, lineHeight: 1.1 }}>{metric.v}</Typography>
                                </Paper>
                              </Grid>
                            ))}
                          </Grid>
                        </Stack>
                      </Box>
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <Box sx={{ p: { xs: 1.4, md: 1.6 }, height: "100%", bgcolor: "#f8fafc", borderLeft: { md: "1px solid rgba(148,163,184,.2)" } }}>
                        <Stack spacing={0.7}>
                          <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: ".08em", color: "#64748b" }}>
                            IP PICKER
                          </Typography>
                          {(bannerItems || []).map((item, idx) => {
                            const active = idx === Math.max(currentBannerIndex, 0);
                            return (
                              <Button
                                key={`banner-picker-${item.id}-${idx}`}
                                onClick={() => setIp(item.id)}
                                sx={{
                                  justifyContent: "space-between",
                                  borderRadius: 1.2,
                                  px: 1.2,
                                  py: 0.95,
                                  textTransform: "none",
                                  border: "1px solid",
                                  borderColor: active ? "rgba(37,99,235,.45)" : "rgba(148,163,184,.32)",
                                  bgcolor: active ? "rgba(37,99,235,.08)" : "#fff",
                                  color: active ? "#1d4ed8" : "#0f172a",
                                  fontWeight: active ? 800 : 600,
                                }}
                              >
                                <span>{item.name}</span>
                                {active ? <span>●</span> : null}
                              </Button>
                            );
                          })}
                        </Stack>
                      </Box>
                    </Grid>
                  </Grid>
                </Paper>
              ) : null}

              <Stack
                direction={{ xs: "column", lg: "row" }}
                justifyContent="space-between"
                alignItems={{ xs: "stretch", lg: "center" }}
                spacing={1}
              >
                <Stack direction="row" spacing={0.7} alignItems="center" sx={{ minHeight: 40 }}>
                  <Button
                    aria-label="이전 게임"
                    sx={bannerPagerBtnSx}
                    onClick={goPrevBanner}
                    disabled={currentBannerIndex <= 0}
                  >
                    <ChevronLeft {...iconProps({ size: 18 })} />
                  </Button>
                  <Button
                    aria-label="다음 게임"
                    sx={bannerPagerBtnSx}
                    onClick={goNextBanner}
                    disabled={currentBannerIndex >= bannerItems.length - 1}
                  >
                    <ChevronRight {...iconProps({ size: 18 })} />
                  </Button>
                </Stack>
                <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ justifyContent: { xs: "flex-start", md: "flex-end" } }}>
                  <Chip variant="outlined" label={<span><RefreshCw {...iconProps()} style={inlineIconSx} />{loading ? "업데이트 중" : "자동 업데이트"}</span>} sx={statusChipSx} />
                  <Chip variant="outlined" label={`현재: ${(riskData?.meta?.ip || "-")}`} sx={statusChipSx} />
                  <Chip variant="outlined" label={`갱신: ${lastUpdatedAt || "-"}`} sx={statusChipSx} />
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

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "1fr",
              sm: "repeat(2, minmax(0, 1fr))",
              lg: "repeat(5, minmax(0, 1fr))",
            },
            gap: { xs: 1, sm: 1.2, md: 1.5 },
          }}
        >
          {[
            {
              k: "위기 점수",
              v: riskValue.toFixed(1),
              s: `${alertInfo.label} · 0~100`,
              barColor: riskValue >= 70 ? riskAccent.critical.color : riskValue >= 45 ? riskAccent.high.color : riskValue >= 20 ? riskAccent.caution.color : riskAccent.safe.color,
              valueType: "number",
            },
            {
              k: "선택 게임",
              v: riskData?.meta?.ip || "-",
              s: `${riskData?.meta?.date_from} ~ ${riskData?.meta?.date_to}`,
              barColor: riskAccent.neutral.color,
              valueType: "label",
            },
            {
              k: "총 기사 수(일자 합계)",
              v: totalArticleSum.toLocaleString(),
              s: "필터 기간 합계",
              barColor: riskAccent.neutral.color,
              valueType: "number",
            },
            {
              k: "핵심 위험 이슈",
              v: topRisk?.theme || "-",
              s: topRisk ? `부정 ${topRisk?.negative_ratio ?? 0}% · 이슈 점수 ${topRiskThemeScore}점` : "-",
              barColor: riskAccent.neutral.color,
              valueType: "label",
            },
            {
              k: "이슈 분류 수",
              v: Number(clusterData?.meta?.cluster_count || 0),
              s: "유사 기사 그룹",
              tip: tipMap.cluster,
              barColor: riskAccent.neutral.color,
              valueType: "number",
            },
          ].map((item) => (
            <Box key={item.k} sx={{ display: "flex", minWidth: 0 }}>
              <Box sx={{ ...metricCardSx, width: "100%", height: "100%", display: "flex", flexDirection: "column" }}>
                <Box sx={{ height: 3, bgcolor: item.barColor, flexShrink: 0 }} />
                <Box
                  sx={{
                    p: { xs: 2, sm: 2.25, md: 2.5 },
                    flex: 1,
                    width: "100%",
                    minWidth: 0,
                    display: "grid",
                    gridTemplateRows: "32px minmax(76px,1fr)",
                    alignItems: "start",
                    rowGap: 0.8,
                  }}
                >
                  <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", minWidth: 0 }}>
                    <Typography
                      variant="body2"
                      sx={{
                        fontWeight: 700,
                        color: "#334155",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {item.k}
                    </Typography>
                    <Box sx={{ width: 18, height: 18, display: "inline-flex", alignItems: "center", justifyContent: "center", color: "#64748b", flexShrink: 0 }}>
                      {item.tip ? <Info {...iconProps({ size: 16 })} title={item.tip} /> : null}
                    </Box>
                  </Box>
                  <Typography
                    variant="h5"
                    sx={{
                      ...metricValueSx,
                      fontSize: item.valueType === "number" ? { xs: 44, sm: 50, md: MUI_SPEC.type.h3 } : { xs: 28, sm: 34, md: MUI_SPEC.type.h4 },
                      lineHeight: item.valueType === "number" ? 1.02 : 1.1,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      letterSpacing: item.valueType === "number" ? "-.02em" : "-.01em",
                    }}
                  >
                    {item.v}
                  </Typography>
                </Box>
              </Box>
            </Box>
          ))}
        </Box>
        <Typography variant="caption" color="text.secondary" sx={{ px: 0.2, display: "block" }}>
          총 기사 수는 일자별 기사 수(article_count) 합계입니다. 이슈 분류는 유사 기사 그룹 수입니다.
        </Typography>

        {false ? (
        <Card variant="outlined" sx={sectionCardSx}>
          <CardContent sx={contentCardSx}>
            <Typography variant="h6" sx={{ ...sectionTitleSx, mb: 1.8, borderLeft: `4px solid ${riskValue >= 70 ? riskAccent.critical.color : riskValue >= 45 ? riskAccent.high.color : riskValue >= 20 ? riskAccent.caution.color : riskAccent.safe.color}` }}>
              현재 위기 상태
            </Typography>
            {riskScore ? (
              <Box sx={{ maxWidth: 1060, mx: "auto", width: "100%" }}>
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: { xs: "1fr", md: "1fr", lg: "1.2fr .8fr" },
                    gap: { xs: 1.2, sm: 1.6, md: 1.9, lg: 2.2 },
                    alignItems: "start",
                  }}
                >
                  <Stack spacing={{ xs: 1.1, sm: 1.4, md: 1.6 }}>
                    <Paper variant="outlined" sx={subPanelSx}>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>위기 지수</Typography>
                      <Stack direction="row" spacing={0.8} useFlexGap flexWrap="wrap" sx={{ mt: 0.6 }}>
                        <Chip size="small" variant="outlined" label={riskFormulaVersion ? "최신 분석 기준 적용 중" : "기본 분석 기준 적용 중"} sx={controlChipSx} />
                      </Stack>
                      <Typography
                        variant="h4"
                        sx={{ mt: 0.3, ...metricValueSx }}
                      >
                        {riskValue.toFixed(1)}
                      </Typography>
                      <Chip
                        label={riskMeaning.label}
                        size="small"
                        color={riskMeaning.color}
                        variant="outlined"
                        sx={{ ...controlChipSx, mt: 0.5 }}
                      />
                      <LinearProgress
                        variant="determinate"
                        value={Math.max(0, Math.min(100, riskValue))}
                        sx={{
                          mt: 0.9,
                          height: 10,
                          borderRadius: 999,
                          bgcolor: "#edf2fb",
                          "& .MuiLinearProgress-bar": { bgcolor: riskGaugeColor },
                        }}
                      />
                      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.6 }}>
                        최근 {Number(riskScore?.meta?.window_hours || 24)}시간 보도량 기준 · 이슈량 {hasHeatValue ? heatValue.toFixed(1) : "미제공"}
                      </Typography>
                      <Typography variant="body2" sx={{ mt: 0.55, fontWeight: 600 }}>
                        {quickSummary}
                      </Typography>
                    </Paper>
                    <Paper variant="outlined" sx={subPanelSx}>
                      <Typography variant="body2" sx={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                        오늘 보도량: {recent24hArticles.toLocaleString()}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ display: "block", mt: 0.2, fontVariantNumeric: "tabular-nums" }}>
                        지난 7일 평균: {weeklyBaselineMin.toLocaleString()}–{weeklyBaselineMax.toLocaleString()}건
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ display: "block", fontVariantNumeric: "tabular-nums" }}>
                        평균 대비 {baselineRatio > 0 ? `${baselineRatio.toFixed(1)}배` : "0.0배"}
                      </Typography>
                    </Paper>
                    <Paper variant="outlined" sx={subPanelSx}>
                      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.3 }}>
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>위기 지수 해석</Typography>
                        <IconButton size="small" onClick={() => setShowMetricDetails((prev) => !prev)} aria-label="상세 지표 보기">
                          <Info {...iconProps({ size: 15 })} />
                        </IconButton>
                      </Stack>
                      <Typography variant="body2" color="text.secondary">
                        보도량: {recent24hArticles.toLocaleString()}건 ({volumeHint}) · 확산도: {spreadValue.toFixed(2)} · 여론 불명확: {Math.round(uncertaintyValue * 100)}%
                      </Typography>
                      <Typography variant="body2" sx={{ mt: 0.6, lineHeight: 1.45 }}>
                        {liveInterpretation}
                      </Typography>
                      <Collapse in={showMetricDetails}>
                        <Box sx={{ mt: 0.8, pt: 0.8, borderTop: "1px dashed", borderColor: "divider" }}>
                          <Typography variant="caption" color="text.secondary" sx={{ display: "block", fontWeight: 700 }}>
                            상세 설명
                          </Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.2 }}>
                            보도량은 최근 24시간 기준 기사 수입니다. 표본이 적은 구간은 추세 중심으로 해석하세요.
                          </Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.45 }}>
                            확산도는 같은 이슈가 반복 보도되는 정도입니다. {spreadHint}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.45 }}>
                            여론 불명확은 긍/부정 판단이 어려운 기사 비율입니다. {uncertaintyHint}
                          </Typography>
                        </Box>
                      </Collapse>
                    </Paper>
                  </Stack>

                  <Stack spacing={{ xs: 1.1, sm: 1.4, md: 1.6 }}>
                    <Paper variant="outlined" sx={subPanelSx}>
                      <LabelWithTip label="대응 우선순위" tip={tipMap.alert} />
                      <Chip
                        size="small"
                        label={`${alertInfo.label} (${alertLevel})`}
                        color={alertInfo.color}
                        sx={{ mt: 0.55, fontWeight: 700, minHeight: 30 }}
                      />
                      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.6, fontVariantNumeric: "tabular-nums" }}>
                        {alertInfo.desc}
                      </Typography>
                    </Paper>
                    <Paper variant="outlined" sx={subPanelSx}>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>모니터링 현황</Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.7, lineHeight: 1.45, fontVariantNumeric: "tabular-nums" }}>
                        {selectedBurstStatus?.mode === "burst" ? "집중 모니터링 중" : "정상 모니터링"} · 갱신 주기 {selectedBurstStatus?.interval_seconds || 600}초
                        {selectedBurstStatus?.burst_remaining ? ` · 남은 시간 ${selectedBurstStatus.burst_remaining}초` : ""} · 최근 30분 급등 {recentBurstCount}건
                      </Typography>
                    </Paper>
                    <Paper variant="outlined" sx={subPanelSx}>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>위기 지수 vs 이슈량</Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.6 }}>
                        위기 지수(Risk)는 부정 여론 강도, 이슈량(Heat)은 언급 빈도입니다. 언급이 많아도 부정이 적으면 위기 지수는 낮을 수 있습니다.
                      </Typography>
                      <Box ref={riskHeatChartRef} sx={{ mt: 0.8, width: "100%", height: { xs: 180, sm: 200 } }} />
                    </Paper>
                  </Stack>
                </Box>

                <Box sx={{ mt: 1 }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="caption" color="text.secondary">위기 지수 구성 요소</Typography>
                    <Button size="small" onClick={() => setShowMetricDetails((prev) => !prev)}>
                      {showMetricDetails ? "접기" : "보기"}
                    </Button>
                  </Stack>
                  <Collapse in={showMetricDetails}>
                    <Grid container spacing={{ xs: 1, md: 1.2 }} sx={{ mt: 0.4 }}>
                      {["S", "V", "T", "M"].map((k) => {
                        const value = Math.max(0, Math.min(1, Number(riskScore?.components?.[k] || 0)));
                        const signalLabel = k === "S" ? "감성 신호" : k === "V" ? "보도량 신호" : k === "T" ? "테마 신호" : "매체 신호";
                        return (
                          <Grid item xs={6} md={3} key={k}>
                            <Paper variant="outlined" sx={{ ...panelPaperSx, p: { xs: 1, sm: 1.1 } }}>
                              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.6 }}>
                                <Typography variant="caption" sx={{ fontWeight: 700 }}>{signalLabel}</Typography>
                                <Typography variant="caption" color="text.secondary" sx={{ fontVariantNumeric: "tabular-nums" }}>
                                  {value.toFixed(2)}
                                </Typography>
                              </Stack>
                              <LinearProgress
                                variant="determinate"
                                value={value * 100}
                                sx={{ height: 8, borderRadius: 999, bgcolor: "#edf2fb" }}
                              />
                            </Paper>
                          </Grid>
                        );
                      })}
                    </Grid>
                  </Collapse>
                </Box>

                <Paper variant="outlined" sx={{ ...panelPaperSx, mt: 1.6, p: { xs: 1, sm: 1.2, md: 1.4 } }}>
                  <Box sx={{ px: 1.2, pt: 0.6 }}>
                    <LabelWithTip label="급등 이벤트" tip={tipMap.burst} />
                  </Box>
                  <Stack
                    direction={{ xs: "column", sm: "row" }}
                    spacing={1}
                    sx={{ px: 1.2, pb: 0.8, pt: 0.8, alignItems: { xs: "stretch", sm: "center" }, justifyContent: "space-between" }}
                  >
                    <Stack direction={{ xs: "column", sm: "row" }} spacing={0.8} useFlexGap flexWrap="wrap" sx={{ minWidth: 0 }}>
                      <Chip size="small" variant="outlined" label={`최근 ${burstRange === "24h" ? "24시간" : "7일"} 급등 ${burstSummaryCount}건`} sx={statusChipSx} />
                      <Chip size="small" variant="outlined" label={`마지막 급등 ${burstSummaryLastOccurredAt}`} sx={statusChipSx} />
                      <Chip
                        size="small"
                        label={burstStatusLabel}
                        color={burstSummaryCount > 0 ? "warning" : "success"}
                        variant={burstSummaryCount > 0 ? "filled" : "outlined"}
                        sx={{ fontWeight: 700, minHeight: 30 }}
                      />
                    </Stack>
                    <Stack direction="row" spacing={0.6} sx={{ justifyContent: { xs: "flex-start", sm: "flex-end" }, flexWrap: "wrap" }}>
                      <Button
                        size="small"
                        variant={burstRange === "24h" ? "contained" : "outlined"}
                        onClick={() => setBurstRange("24h")}
                      >
                        24시간
                      </Button>
                      <Button
                        size="small"
                        variant={burstRange === "7d" ? "contained" : "outlined"}
                        onClick={() => setBurstRange("7d")}
                      >
                        7일
                      </Button>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => {
                          setShowBurstEventList((prev) => {
                            const next = !prev;
                            if (next) setBurstVisibleCount(10);
                            return next;
                          });
                        }}
                      >
                        {showBurstEventList ? "접기" : "목록 보기"}
                      </Button>
                    </Stack>
                  </Stack>

                  <Collapse in={showBurstEventList}>
                    <List dense disablePadding>
                      {visibleBurstEvents.length ? (
                        visibleBurstEvents.map((evt, idx) => (
                          <ListItem key={`${evt.occurred_at}-${idx}`} divider>
                            <ListItemText
                              primary={`${String(evt.occurred_at).slice(5, 16)} · ${evt.ip_name} · ${String(evt.event_type).toUpperCase()}`}
                              secondary={evt.trigger_reason}
                              primaryTypographyProps={{ variant: "body2" }}
                              secondaryTypographyProps={{ variant: "caption" }}
                            />
                          </ListItem>
                        ))
                      ) : (
                        <Box sx={{ p: 1 }}>
                          <PageStatusView
                            empty={{
                              show: true,
                              title: "급등 이벤트 없음",
                              subtitle: "선택 기간에 기사 급증 이벤트가 없습니다.",
                              compact: true,
                            }}
                          />
                        </Box>
                      )}
                    </List>
                    {canLoadMoreBurstEvents ? (
                      <Box sx={{ px: 1.2, pb: 1, pt: 0.6, display: "flex", justifyContent: "center" }}>
                        <Button size="small" variant="outlined" onClick={() => setBurstVisibleCount((prev) => prev + 10)}>
                          더보기 (+10)
                        </Button>
                      </Box>
                    ) : null}
                  </Collapse>
                </Paper>
              </Box>
            ) : (
              <PageStatusView
                empty={{
                  show: true,
                  title: "위기 지수 데이터를 불러오는 중입니다.",
                  subtitle: !filteredBurstEvents.length ? "급등 이벤트 기록이 없습니다." : "",
                  tone: "warning",
                }}
              />
            )}
          </CardContent>
        </Card>
        ) : null}

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
