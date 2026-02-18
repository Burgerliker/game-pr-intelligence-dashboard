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
  List,
  ListItem,
  ListItemText,
  LinearProgress,
  MobileStepper,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
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

const USE_MOCK_FALLBACK = process.env.NEXT_PUBLIC_USE_MOCK_FALLBACK === "true";
const SHOW_BACKTEST = process.env.NEXT_PUBLIC_SHOW_BACKTEST === "true";
const NEXON_LOGO = "/nexon-logo.png";
const ARTICLE_PAGE_SIZE = 20;
const ARTICLE_RENDER_STEP = 40;
const DIAG_SCOPE = {
  health: buildDiagnosticScope("NEX", "HEALTH"),
  dashboard: buildDiagnosticScope("NEX", "DASH"),
  article: buildDiagnosticScope("NEX", "ART"),
};
const IP_BANNER_STYLE = {
  all: {
    kicker: "NEXON OVERVIEW",
    accent: "#7db0ff",
    bg: "linear-gradient(135deg,#0b1220 0%,#102445 48%,#16396b 100%)",
    glow: "radial-gradient(circle at 82% 18%, rgba(125,176,255,.28) 0%, rgba(125,176,255,0) 56%)",
  },
  maplestory: { kicker: "MAPLESTORY", accent: "#ffcb7d", bg: "linear-gradient(135deg,#1a1205 0%,#3d2506 45%,#7f4a0a 100%)" },
  dnf: { kicker: "DNF", accent: "#ff9aa8", bg: "linear-gradient(135deg,#1b0b10 0%,#41111f 45%,#7d1934 100%)" },
  arcraiders: { kicker: "ARC RAIDERS", accent: "#7de5ff", bg: "linear-gradient(135deg,#071419 0%,#0e2d36 45%,#1c5461 100%)" },
  bluearchive: { kicker: "BLUE ARCHIVE", accent: "#98b9ff", bg: "linear-gradient(135deg,#0a1122 0%,#132b5a 45%,#214f9b 100%)" },
  fconline: { kicker: "FC ONLINE", accent: "#93e7b2", bg: "linear-gradient(135deg,#08160f 0%,#123724 45%,#1c6f45 100%)" },
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
  const [articleRenderCount, setArticleRenderCount] = useState(ARTICLE_RENDER_STEP);
  const [articleError, setArticleError] = useState("");
  const [articleErrorCode, setArticleErrorCode] = useState("");
  const [healthDiagCode, setHealthDiagCode] = useState("");
  const articleReqSeqRef = useRef(0);
  const articleAbortRef = useRef(null);
  const articleSentinelRef = useRef(null);
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
  const tipMap = {
    burst: "최근 임계치 이벤트 발생 로그입니다.",
    svtm: "S/V/T/M은 감성·볼륨·테마·매체 신호입니다.",
    cluster: "유사 기사 키워드로 묶은 이슈 그룹 수입니다.",
    alert: "위험도 구간별 대응 우선순위 등급입니다.",
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
      const [riskPayload, clusterPayload, riskScorePayload, burstStatusPayload, burstEventsPayload, healthState] = await Promise.all([
        apiGet(`/api/risk-dashboard?${base.toString()}`),
        apiGet(`/api/ip-clusters?${base.toString()}&limit=6`),
        apiGet(`/api/risk-score?ip=${targetIp}`).catch(() => null),
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
        setNotice("실데이터 호출 실패로 샘플 데이터를 표시 중입니다.");
      } else {
        setRiskData(createEmptyRisk(targetIp, baseCatalog));
        setClusterData(createEmptyCluster(targetIp));
        setUsingMock(false);
        setNotice("실데이터 호출에 실패했습니다. 백엔드 주소/API 상태를 확인해주세요.");
      }
      setLastUpdatedAt("-");
      const nextError = toRequestErrorState(e, {
        scope: DIAG_SCOPE.dashboard,
        fallback: "대시보드 API 요청에 실패했습니다.",
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
        fallback: "기사 목록 API 호출에 실패했습니다.",
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
    setArticleRenderCount(ARTICLE_RENDER_STEP);
    loadMoreArticles(ip, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ip]);

  useEffect(() => {
    const target = articleSentinelRef.current;
    if (!target) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (!first?.isIntersecting) return;
        loadMoreArticles(ip, false);
      },
      { rootMargin: "280px 0px 280px 0px", threshold: 0 }
    );
    observer.observe(target);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ip, articleHasMore, articleLoading]);

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
        const [rs, bs, healthState] = await Promise.all([
          apiGet(`/api/risk-score?ip=${ip}`).catch(() => null),
          apiGet("/api/burst-status").catch(() => null),
          apiGet("/api/health")
            .then((data) => ({ data, error: null }))
            .catch((error) => ({ data: null, error })),
        ]);
        if (rs) setRiskScore(rs);
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
  const topRisk = themes[0];
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
  const visibleArticleItems = useMemo(
    () => articleItems.slice(0, articleRenderCount),
    [articleItems, articleRenderCount]
  );
  const riskValue = Number(riskScore?.risk_score || 0);
  const alertLevel = String(riskScore?.alert_level || "P3").toUpperCase();
  const alertInfo =
    alertLevel === "P1"
      ? { label: "심각", desc: "위험도 70 이상", color: "error" }
      : alertLevel === "P2"
        ? { label: "주의", desc: "위험도 45~69", color: "warning" }
        : { label: "관심", desc: "위험도 0~44", color: "success" };
  const riskGaugeColor = riskValue >= 70 ? "#dc3c4a" : riskValue >= 45 ? "#e89c1c" : "#11a36a";
  const riskMeaning = useMemo(() => {
    if (riskValue >= 70) return { label: "심각", color: "error" };
    if (riskValue >= 45) return { label: "높음", color: "warning" };
    if (riskValue >= 20) return { label: "주의", color: "info" };
    return { label: "낮음", color: "success" };
  }, [riskValue]);
  const recent24hArticles = Number(riskScore?.article_count_window || 0);
  const recentWeekRows = useMemo(() => (dailyRows || []).slice(-7), [dailyRows]);
  const weeklyBaselineAvg = useMemo(() => {
    if (!recentWeekRows.length) return 0;
    return recentWeekRows.reduce((acc, row) => acc + Number(row.article_count || 0), 0) / recentWeekRows.length;
  }, [recentWeekRows]);
  const weeklyBaselineMin = useMemo(() => {
    if (!recentWeekRows.length) return 0;
    return Math.min(...recentWeekRows.map((row) => Number(row.article_count || 0)));
  }, [recentWeekRows]);
  const weeklyBaselineMax = useMemo(() => {
    if (!recentWeekRows.length) return 0;
    return Math.max(...recentWeekRows.map((row) => Number(row.article_count || 0)));
  }, [recentWeekRows]);
  const baselineRatio = weeklyBaselineAvg > 0 ? recent24hArticles / weeklyBaselineAvg : 0;
  const spreadValue = Number(riskScore?.spread_ratio || 0);
  const uncertaintyValue = Number(riskScore?.uncertain_ratio || 0);
  const liveInterpretation = useMemo(() => {
    if (recent24hArticles < 5) return "기사량이 매우 적어 위험도 신뢰도가 낮을 수 있습니다.";
    if (riskValue >= 70) return "기사량 급증과 고위험 테마 집중으로 위험도가 심각 단계입니다.";
    if (riskValue >= 45) return "위험도가 높은 상태입니다. 확산도와 감성 변화를 밀착 모니터링하세요.";
    if (baselineRatio >= 1.2 || spreadValue >= 1.2) return "위험도는 낮지만 기사량 또는 확산도가 기준선보다 상승 중입니다.";
    return "기사량과 확산도가 안정적이라 현재 위험도는 낮은 상태입니다.";
  }, [baselineRatio, recent24hArticles, riskValue, spreadValue]);
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
  const modeMismatchWarning = health?.mode === "backtest" ? "현재 운영 페이지가 백테스트 DB를 참조 중입니다." : "";
  const sectionCardSx = {
    borderRadius: 3,
    borderColor: "rgba(15,23,42,0.10)",
    boxShadow: "0 12px 28px rgba(15,23,42,0.06)",
    bgcolor: "#fff",
    transition: "transform .24s ease, box-shadow .24s ease, border-color .24s ease",
    "&:hover": {
      transform: "translateY(-2px)",
      boxShadow: "0 18px 32px rgba(15,23,42,0.10)",
      borderColor: "rgba(15,59,102,.22)",
    },
  };
  const panelSx = {
    borderRadius: 2.2,
    borderColor: "rgba(15,23,42,.12)",
    transition: "transform .2s ease, box-shadow .2s ease, border-color .2s ease, background-color .2s ease",
    "&:hover": {
      transform: "translateY(-1px)",
      boxShadow: "0 8px 18px rgba(15,23,42,.08)",
      borderColor: "rgba(15,59,102,.24)",
      bgcolor: "#fbfdff",
    },
  };
  const metricValueSx = {
    fontWeight: 800,
    fontVariantNumeric: "tabular-nums",
    letterSpacing: "-.01em",
    lineHeight: 1.08,
  };

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
        tooltip: { trigger: "axis" },
        xAxis: {
          type: "category",
          data: x,
          axisLabel: {
            formatter: (v) => String(v || "").slice(5),
            color: "#64748b",
          },
        },
        yAxis: { type: "value", axisLabel: { color: "#64748b" } },
        series: [
          {
            name: "기사 수",
            type: "bar",
            data: dailyRows.map((r) => Number(r.article_count || 0)),
            itemStyle: { color: "#2f67d8", borderRadius: [4, 4, 0, 0] },
            barMaxWidth: 18,
            large: dailyRows.length > 220,
            largeThreshold: 220,
            progressive: 2000,
            progressiveThreshold: 3000,
          },
          {
            name: "부정 비율(%)",
            type: "line",
            yAxisIndex: 0,
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
            name: "위험 점수(%)",
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
              fontSize: 12,
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

  return (
    <Box sx={{ minHeight: "100dvh", bgcolor: "#eef0f3", py: { xs: 1.5, sm: 2, md: 4 } }}>
    <Container maxWidth="xl" sx={{ maxWidth: "1180px !important", px: { xs: 1.2, sm: 2, md: 3 } }}>
      <Stack spacing={{ xs: 1.4, md: 2 }}>
        <Paper
          sx={{
            borderRadius: 3,
            border: "1px solid #e5e7eb",
            bgcolor: "#f8fafc",
            boxShadow: "0 8px 24px rgba(15,23,42,.04)",
          }}
        >
          <Stack
            direction={{ xs: "column", sm: "row" }}
            alignItems={{ xs: "flex-start", sm: "center" }}
            justifyContent="space-between"
            spacing={1.2}
            sx={{ px: { xs: 2, md: 3 }, py: 1.2 }}
          >
            <Stack direction="row" alignItems="center" spacing={1.2}>
              <Box sx={{ width: 22, height: 22, borderRadius: 1.2, background: "linear-gradient(140deg,#0f3b66 0 58%,#9acb19 58% 100%)" }} />
              <Box sx={{ py: 0.2 }}>
                <Typography
                  sx={{
                    fontSize: { xs: 20, md: 20 },
                    fontWeight: 800,
                    color: "#0f172a",
                    letterSpacing: "-.01em",
                    lineHeight: 1.1,
                    wordBreak: "keep-all",
                  }}
                >
                  넥슨 IP 리스크 대시보드
                </Typography>
              </Box>
            </Stack>
            <Stack direction="row" spacing={1} sx={{ width: { xs: "100%", sm: "auto" }, justifyContent: { xs: "flex-end", sm: "flex-start" } }}>
              <Button component={Link} href="/" variant="outlined" size="small">메인</Button>
              <Button component={Link} href="/compare" variant="outlined" size="small">경쟁사 비교</Button>
              {SHOW_BACKTEST ? <Button component={Link} href="/nexon/backtest" variant="contained" size="small">Backtest 보기</Button> : null}
            </Stack>
          </Stack>
        </Paper>
        <ApiGuardBanner />

        <Card variant="outlined" sx={sectionCardSx}>
          <CardContent>
            <Stack spacing={1.2}>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography variant="body2" color="text.secondary">
                  모니터링 IP
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
                    height: { xs: 210, sm: 240, md: 300 },
                    p: { xs: 1.5, sm: 2.2, md: 2.8 },
                    borderRadius: 3,
                    color: "#eef4ff",
                    position: "relative",
                    overflow: "hidden",
                    border: "1px solid rgba(255,255,255,0.2)",
                    background: currentBanner.visual.bg,
                    boxShadow: "0 20px 34px rgba(15,23,42,0.30)",
                    transition: "transform .2s ease, box-shadow .2s ease, border-color .2s ease",
                  }}
                >
                  <Box
                    sx={{
                      position: "absolute",
                      inset: 0,
                      background: currentBanner.visual.glow || "radial-gradient(circle at 82% 18%, rgba(255,255,255,.28) 0%, rgba(255,255,255,0) 52%)",
                      pointerEvents: "none",
                    }}
                  />
                  <Box
                    component="img"
                    src={NEXON_LOGO}
                    alt="NEXON"
                    width={64}
                    height={64}
                    sx={{
                      position: "absolute",
                      right: { xs: 10, sm: 14, md: 18 },
                      top: { xs: 8, sm: 10, md: 16 },
                      width: { xs: 42, sm: 54, md: 64 },
                      opacity: 0.75,
                      filter: "grayscale(100%) brightness(2.6)",
                    }}
                  />
                  <Typography
                    sx={{
                      position: "absolute",
                      right: 18,
                      bottom: 10,
                      fontSize: 64,
                      fontWeight: 900,
                      lineHeight: 0.9,
                      letterSpacing: "-.02em",
                      color: "rgba(255,255,255,.08)",
                      userSelect: "none",
                      pointerEvents: "none",
                    }}
                  >
                    {currentBanner.visual.kicker.split(" ")[0]}
                  </Typography>
                  <Typography sx={{ fontSize: 12, letterSpacing: ".08em", color: currentBanner.visual.accent, fontWeight: 800 }}>
                    {currentBanner.visual.kicker}
                  </Typography>
                  <Typography sx={{ mt: 0.8, pr: { xs: 5, sm: 7, md: 8 }, fontSize: { xs: 28, sm: 34, md: 38 }, fontWeight: 900, lineHeight: 1.04 }}>
                    {currentBanner.name}
                  </Typography>
                  <Typography sx={{ mt: 0.6, pr: { xs: 5, sm: 7, md: 8 }, fontSize: { xs: 12, md: 13 }, color: "rgba(237,245,255,.82)" }}>
                    {currentBanner.id === "all" ? "넥슨 전체보기 · 통합 리스크/테마 흐름" : "해당 IP 리스크 흐름 · 이슈 묶음 · 집중 수집 모니터"}
                  </Typography>
                </Paper>
              ) : null}

              <Stack direction="row" spacing={1} alignItems="center" useFlexGap flexWrap="wrap" sx={{ rowGap: 0.8 }}>
                <Paper
                  variant="outlined"
                  sx={{
                    borderRadius: 99,
                    overflow: "hidden",
                    borderColor: "rgba(15,23,42,.16)",
                    bgcolor: "#fff",
                  }}
                >
                  <MobileStepper
                    variant="dots"
                    steps={Math.max(bannerItems.length, 1)}
                    position="static"
                    activeStep={Math.max(currentBannerIndex, 0)}
                    sx={{
                      bgcolor: "transparent",
                      py: 0.25,
                      px: 0.6,
                      minHeight: 40,
                      "& .MuiMobileStepper-dot": { mx: 0.35 },
                    }}
                    nextButton={
                      <Button size="small" onClick={goNextBanner} disabled={currentBannerIndex >= bannerItems.length - 1}>
                        다음
                      </Button>
                    }
                    backButton={
                      <Button size="small" onClick={goPrevBanner} disabled={currentBannerIndex <= 0}>
                        이전
                      </Button>
                    }
                  />
                </Paper>
                <Chip variant="outlined" label={loading ? "자동 갱신 중" : "자동 갱신"} />
                <Chip variant="outlined" label={`현재: ${(riskData?.meta?.ip || "-")}`} />
                <Chip variant="outlined" label={`마지막 갱신: ${lastUpdatedAt || "-"}`} />
                {SHOW_BACKTEST ? <Chip component={Link} href="/nexon/backtest" clickable label="Backtest 보기" color="primary" variant="outlined" /> : null}
              </Stack>
              {usingMock ? <Chip color="warning" variant="outlined" label="샘플 데이터" /> : null}
            </Stack>
            <Box sx={{ mt: 1.5 }}>
              <PageStatusView
                loading={{
                  show: loading,
                  title: "IP 데이터를 동기화하는 중",
                  subtitle: "리스크/이슈 묶음/집중 수집 상태를 갱신하고 있습니다.",
                }}
              />
            </Box>
            {notice ? <Alert severity={usingMock ? "warning" : "info"} sx={{ mt: 1.5 }}>{notice}</Alert> : null}
            {modeMismatchWarning ? <Alert severity="warning" sx={{ mt: 1.5 }}>{modeMismatchWarning}</Alert> : null}
            {healthDiagCode ? (
              <Alert severity="info" sx={{ mt: 1.5 }}>
                실시간 상태 정보가 일시적으로 누락되었습니다. 진단코드: {healthDiagCode}
              </Alert>
            ) : null}
            <Box sx={{ mt: 1.5 }}>
              <PageStatusView
                error={{
                  show: Boolean(error),
                  title: "대시보드 데이터를 불러오지 못했습니다.",
                  details: error,
                  diagnosticCode: errorCode,
                  actionLabel: "재시도",
                  onAction: () => loadDashboard(ip),
                }}
              />
            </Box>
          </CardContent>
        </Card>

        <Grid container spacing={{ xs: 1, sm: 1.2, md: 1.5 }}>
          {[
            { k: "선택 IP", v: riskData?.meta?.ip || "-", s: `${riskData?.meta?.date_from} ~ ${riskData?.meta?.date_to}` },
            { k: "총 기사 수", v: Number(riskData?.meta?.total_articles || 0).toLocaleString(), s: "필터 기준" },
            { k: "최고 위험 테마", v: topRisk?.theme || "-", s: `Risk ${topRisk?.risk_score ?? "-"}` },
            { k: "이슈 묶음 수", v: Number(clusterData?.meta?.cluster_count || 0), s: "유사 기사 주제 묶음", tip: tipMap.cluster },
          ].map((item) => (
            <Grid item xs={12} sm={6} md={3} key={item.k}>
              <Card variant="outlined" sx={sectionCardSx}><CardContent sx={{ p: { xs: 1.3, sm: 1.6, md: 2 } }}>
                {item.tip ? (
                  <LabelWithTip label={item.k} tip={item.tip} variant="body2" fontWeight={500} />
                ) : (
                  <Typography variant="body2" color="text.secondary">{item.k}</Typography>
                )}
                <Typography variant="h5" sx={{ mt: 0.8, ...metricValueSx }}>{item.v}</Typography>
                <Typography variant="caption" color="text.secondary">{item.s}</Typography>
              </CardContent></Card>
            </Grid>
          ))}
        </Grid>

        <Card variant="outlined" sx={sectionCardSx}>
          <CardContent sx={{ p: { xs: 1.5, sm: 2, md: 2.3 } }}>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 1.8 }}>
              실시간 위험도 모니터
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
                    <Paper variant="outlined" sx={{ ...panelSx, p: { xs: 1.35, sm: 1.55, md: 1.7 } }}>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>위험도 점수</Typography>
                      <Typography variant="h4" sx={{ mt: 0.3, ...metricValueSx }}>{riskValue.toFixed(1)}</Typography>
                      <Chip
                        label={riskMeaning.label}
                        size="small"
                        color={riskMeaning.color}
                        variant="outlined"
                        sx={{ mt: 0.5 }}
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
                        최근 {Number(riskScore?.meta?.window_hours || 24)}시간 롤링 윈도우 기준
                      </Typography>
                    </Paper>
                    <Paper variant="outlined" sx={{ ...panelSx, p: { xs: 1.35, sm: 1.55, md: 1.7 } }}>
                      <Typography variant="body2" sx={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                        최근 24시간 기사 수: {recent24hArticles.toLocaleString()}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.2, fontVariantNumeric: "tabular-nums" }}>
                        최근 7일 기준선: {weeklyBaselineMin.toLocaleString()}–{weeklyBaselineMax.toLocaleString()}건
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ display: "block", fontVariantNumeric: "tabular-nums" }}>
                        기준선 대비 {baselineRatio > 0 ? `${baselineRatio.toFixed(1)}배` : "0.0배"}
                      </Typography>
                    </Paper>
                    <Paper variant="outlined" sx={{ ...panelSx, p: { xs: 1.35, sm: 1.55, md: 1.7 } }}>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>지표 해석</Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
                        볼륨(Volume): {recent24hArticles.toLocaleString()}건
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                        확산도(Spread): {spreadValue.toFixed(2)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                        불확실도(Uncertainty): {uncertaintyValue.toFixed(2)}
                      </Typography>
                      <Typography variant="body2" sx={{ mt: 0.7, lineHeight: 1.45 }}>
                        {liveInterpretation}
                      </Typography>
                    </Paper>
                  </Stack>

                  <Stack spacing={{ xs: 1.1, sm: 1.4, md: 1.6 }}>
                    <Paper variant="outlined" sx={{ ...panelSx, p: { xs: 1.35, sm: 1.55, md: 1.7 } }}>
                      <LabelWithTip label="경보 등급" tip={tipMap.alert} />
                      <Chip
                        label={`${alertInfo.label} (${alertLevel})`}
                        color={alertInfo.color}
                        sx={{ mt: 0.55, fontWeight: 700 }}
                      />
                      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.6, fontVariantNumeric: "tabular-nums" }}>
                        {alertInfo.desc} · 저신뢰 비율 {Math.round(Number(riskScore?.uncertain_ratio || 0) * 100)}%
                      </Typography>
                    </Paper>
                    <Paper variant="outlined" sx={{ ...panelSx, p: { xs: 1.35, sm: 1.55, md: 1.7 } }}>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>수집 모드</Typography>
                      <Stack direction="row" alignItems="center" spacing={0.8} sx={{ mt: 0.8 }}>
                        <Box
                          sx={{
                            width: 8,
                            height: 8,
                            borderRadius: "50%",
                            bgcolor: selectedBurstStatus?.mode === "burst" ? "error.main" : "success.main",
                          }}
                        />
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>
                          {selectedBurstStatus?.mode === "burst" ? "BURST 모드" : "정상 수집"}
                        </Typography>
                      </Stack>
                      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.6, fontVariantNumeric: "tabular-nums" }}>
                        주기 {selectedBurstStatus?.interval_seconds || 600}s
                        {selectedBurstStatus?.burst_remaining ? ` · 남은 ${selectedBurstStatus.burst_remaining}s` : ""}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ display: "block", fontVariantNumeric: "tabular-nums" }}>
                        최근 30분 이벤트 {recentBurstCount}건
                      </Typography>
                    </Paper>
                    <Paper variant="outlined" sx={{ ...panelSx, p: { xs: 1.35, sm: 1.55, md: 1.7 } }}>
                      <LabelWithTip label="위험도 구성요소" tip={tipMap.svtm} />
                      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.6, fontVariantNumeric: "tabular-nums" }}>
                        감성 {Number(riskScore?.components?.S || 0).toFixed(2)} · 기사량 {Number(riskScore?.components?.V || 0).toFixed(2)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ display: "block", fontVariantNumeric: "tabular-nums" }}>
                        테마 {Number(riskScore?.components?.T || 0).toFixed(2)} · 매체 {Number(riskScore?.components?.M || 0).toFixed(2)}
                      </Typography>
                    </Paper>
                  </Stack>
                </Box>

                <Grid container spacing={{ xs: 1, md: 1.5 }} sx={{ mt: 1 }}>
                  {["S", "V", "T", "M"].map((k) => {
                    const value = Math.max(0, Math.min(1, Number(riskScore?.components?.[k] || 0)));
                    const signalLabel = k === "S" ? "감성 신호" : k === "V" ? "기사량 신호" : k === "T" ? "테마 신호" : "매체 신호";
                    return (
                      <Grid item xs={12} sm={6} md={3} key={k}>
                        <Paper variant="outlined" sx={{ ...panelSx, p: { xs: 1, sm: 1.15, md: 1.25 } }}>
                          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.7 }}>
                            <LabelWithTip label={signalLabel} tip={tipMap.svtm} variant="caption" />
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

                <Paper variant="outlined" sx={{ ...panelSx, mt: 1.6, p: { xs: 0.2, sm: 0.6, md: 0.8 } }}>
                  <Box sx={{ px: 1.2, pt: 0.6 }}>
                    <LabelWithTip label="버스트 이벤트" tip={tipMap.burst} />
                  </Box>
                  <List dense disablePadding>
                    {filteredBurstEvents.length ? (
                      filteredBurstEvents.slice(0, 5).map((evt, idx) => (
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
                            title: "버스트 이벤트 없음",
                            subtitle: "아직 집중 수집 전환 기록이 없습니다. (실시간 신호 대기 중)",
                            compact: true,
                          }}
                        />
                      </Box>
                    )}
                  </List>
                </Paper>
              </Box>
            ) : (
              <PageStatusView
                empty={{
                  show: true,
                  title: "위험도 데이터가 아직 없습니다.",
                  subtitle: !filteredBurstEvents.length ? "아직 집중 수집 전환 기록이 없습니다. (실시간 신호 대기 중)" : "",
                  tone: "warning",
                }}
              />
            )}
          </CardContent>
        </Card>

        <Card variant="outlined" sx={sectionCardSx}>
          <CardContent>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>일자별 기사/부정 추이</Typography>
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
          <Card variant="outlined" sx={sectionCardSx}><CardContent>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 1, lineHeight: 1.25 }}>
                언론사별<br />감성 분포
              </Typography>
              <Box ref={outletChartRef} sx={{ width: "100%", height: { xs: 300, md: 420 } }} />
            </CardContent></Card>
          <Card variant="outlined" sx={sectionCardSx}><CardContent>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 1, lineHeight: 1.25 }}>
                위험 테마<br />점수
              </Typography>
              <Box ref={themeChartRef} sx={{ width: "100%", height: { xs: 300, md: 420 } }} />
            </CardContent></Card>
        </Box>

        <Card variant="outlined" sx={sectionCardSx}><CardContent>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>키워드 중요도 맵</Typography>
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

        <Card variant="outlined" sx={sectionCardSx}><CardContent>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>실행 인사이트</Typography>
          <Grid container spacing={1.2}>
            <Grid item xs={12} md={4}>
              <Paper variant="outlined" sx={{ p: 1.2 }}>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>최우선 위험 테마</Typography>
                <Typography variant="h6" sx={{ mt: 1 }}>{topRisk?.theme || "-"}</Typography>
                <Typography variant="caption" color="text.secondary">
                  위험점수 {topRisk?.risk_score ?? "-"} · 부정 {topRisk?.negative_ratio ?? "-"}%
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} md={4}>
              <Paper variant="outlined" sx={{ p: 1.2 }}>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>고위험 노출 매체</Typography>
                <Typography variant="h6" sx={{ mt: 1 }}>{outletRisk?.outlet || "-"}</Typography>
                <Typography variant="caption" color="text.secondary">
                  기사 {outletRisk?.article_count || 0}건 · 부정 {outletRisk?.negative_ratio || 0}% · 노출점수 {outletRisk?.score || 0}
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} md={4}>
              <Paper variant="outlined" sx={{ p: 1.2 }}>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>대응 권고</Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
                  {recommendedAction}
                </Typography>
              </Paper>
            </Grid>
          </Grid>
        </CardContent></Card>

        <Card variant="outlined" sx={sectionCardSx}><CardContent>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>이슈 묶음 분석</Typography>
          <Stack direction="row" spacing={1} sx={{ mb: 1, flexWrap: "wrap", rowGap: 1 }}>
            {(clusterData?.top_outlets || []).map((o) => (
              <Chip key={o.outlet} label={`${o.outlet} ${o.article_count}건`} size="small" variant="outlined" />
            ))}
          </Stack>
          <Divider sx={{ mb: 1 }} />
          <Grid container spacing={1.2}>
            {clusters.map((c) => (
              <Grid item xs={12} md={6} key={c.cluster}>
                <Paper variant="outlined" sx={{ p: 1.2 }}>
                  <Typography sx={{ fontWeight: 700 }}>{c.cluster}</Typography>
                  <Typography variant="caption" color="text.secondary">기사 {c.article_count}건 · 부정 {c.negative_ratio}%</Typography>
                  <Stack direction="row" sx={{ mt: 1, height: 8, borderRadius: 999, overflow: "hidden", bgcolor: "#edf2fb" }}>
                    <Box sx={{ width: `${c.sentiment?.positive || 0}%`, bgcolor: "success.main" }} />
                    <Box sx={{ width: `${c.sentiment?.neutral || 0}%`, bgcolor: "warning.main" }} />
                    <Box sx={{ width: `${c.sentiment?.negative || 0}%`, bgcolor: "error.main" }} />
                  </Stack>
                  <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
                    키워드: {(c.keywords || []).join(", ")}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                    대표 기사: {(c.samples || [])[0] || "-"}
                  </Typography>
                </Paper>
              </Grid>
            ))}
          </Grid>
        </CardContent></Card>

        <Card variant="outlined" sx={sectionCardSx}>
          <CardContent>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>수집 기사 목록</Typography>
              <Typography variant="caption" color="text.secondary">
                {articleItems.length.toLocaleString()} / {articleTotal.toLocaleString()}
              </Typography>
            </Stack>
            <Stack spacing={1}>
              {visibleArticleItems.map((a) => (
                <Paper key={`${a.id}-${a.url}`} variant="outlined" sx={{ p: 1.2, borderRadius: 2 }}>
                  <Stack direction="row" justifyContent="space-between" spacing={1}>
                    <Typography
                      component={a.url ? "a" : "span"}
                      href={a.url || undefined}
                      target={a.url ? "_blank" : undefined}
                      rel={a.url ? "noreferrer" : undefined}
                      sx={{
                        fontWeight: 700,
                        color: "#10284a",
                        textDecoration: "none",
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
                    />
                  </Stack>
                  <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.6 }}>
                    {a.date || "-"} · {a.outlet || "unknown"}
                  </Typography>
                  {a.description ? (
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.6 }}>
                      {a.description}
                    </Typography>
                  ) : null}
                </Paper>
              ))}
            </Stack>
            {articleItems.length > visibleArticleItems.length ? (
              <Stack direction="row" justifyContent="center" sx={{ mt: 1.1 }}>
                <Chip
                  clickable
                  variant="outlined"
                  label={`기사 더 보기 (${visibleArticleItems.length}/${articleItems.length})`}
                  onClick={() =>
                    setArticleRenderCount((prev) =>
                      Math.min(prev + ARTICLE_RENDER_STEP, articleItems.length)
                    )
                  }
                />
              </Stack>
            ) : null}
            {articleRenderCount >= articleItems.length ? <Box ref={articleSentinelRef} sx={{ height: 1 }} /> : null}
            {articleLoading ? (
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1.2 }}>
                기사 목록을 불러오는 중…
              </Typography>
            ) : null}
            {!articleLoading && !articleHasMore && articleItems.length > 0 ? (
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1.2 }}>
                마지막 기사까지 모두 불러왔습니다.
              </Typography>
            ) : null}
            {!articleLoading && articleItems.length === 0 ? (
              <Box sx={{ mt: 1.2 }}>
                <PageStatusView
                  empty={{
                    show: true,
                    title: "수집 기사 없음",
                    subtitle: "현재 조건에서 표시할 기사가 없습니다.",
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
