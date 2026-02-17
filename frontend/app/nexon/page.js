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
import LoadingState from "../../components/LoadingState";
import ErrorState from "../../components/ErrorState";
import { apiGet } from "../../lib/api";
import {
  createEmptyCluster,
  createEmptyRisk,
  normalizeNexonDashboard,
} from "../../lib/normalizeNexon";

const USE_MOCK_FALLBACK = process.env.NEXT_PUBLIC_USE_MOCK_FALLBACK === "true";
const SHOW_BACKTEST = process.env.NEXT_PUBLIC_SHOW_BACKTEST === "true";
const NEXON_LOGO = "/nexon-logo.png";
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
  const [notice, setNotice] = useState("");
  const [lastUpdatedAt, setLastUpdatedAt] = useState("");
  const [articleItems, setArticleItems] = useState([]);
  const [articleTotal, setArticleTotal] = useState(0);
  const [articleOffset, setArticleOffset] = useState(0);
  const [articleHasMore, setArticleHasMore] = useState(false);
  const [articleLoading, setArticleLoading] = useState(false);
  const articleReqSeqRef = useRef(0);
  const articleSentinelRef = useRef(null);
  const ARTICLE_PAGE_SIZE = 20;
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
  const formatUpdatedAt = (date = new Date()) => {
    const d = date instanceof Date ? date : new Date(date);
    if (Number.isNaN(d.getTime())) return "-";
    return d.toLocaleTimeString("ko-KR", { hour12: false });
  };

  const loadDashboard = async (targetIp = ip) => {
    const requestSeq = ++requestSeqRef.current;
    const baseCatalog = riskData?.ip_catalog || MOCK_RISK.ip_catalog;
    setRiskData(createEmptyRisk(targetIp, baseCatalog));
    setClusterData(createEmptyCluster(targetIp));
    setRiskScore(null);
    setError("");
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
      setUsingMock(Boolean(cache.usingMock));
      setNotice(cache.notice || "");
      setLastUpdatedAt(cache.lastUpdatedAt || formatUpdatedAt());
      setLoading(false);
      return;
    }

    try {
      const base = new URLSearchParams({ ip: targetIp });
      const [riskPayload, clusterPayload, riskScorePayload, burstStatusPayload, burstEventsPayload, healthPayload] = await Promise.all([
        apiGet(`/api/risk-dashboard?${base.toString()}`),
        apiGet(`/api/ip-clusters?${base.toString()}&limit=6`),
        apiGet(`/api/risk-score?ip=${targetIp}`).catch(() => null),
        apiGet("/api/burst-status").catch(() => null),
        apiGet("/api/burst-events?limit=50").catch(() => null),
        apiGet("/api/health").catch(() => null),
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
      setHealth(healthPayload || null);
      setNotice(resolvedNotice);
      setLastUpdatedAt(refreshedAt);

      ipCacheRef.current.set(targetIp, {
        riskData: resolvedRisk,
        clusterData: resolvedCluster,
        riskScore: riskScorePayload || null,
        burstStatus: burstStatusPayload || null,
        burstEvents: (burstEventsPayload?.items || []).slice(0, 50),
        health: healthPayload || null,
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
      setError(String(e));
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
    setArticleLoading(true);
    try {
      const payload = await apiGet(
        `/api/nexon-articles?ip=${encodeURIComponent(targetIp)}&limit=${ARTICLE_PAGE_SIZE}&offset=${nextOffset}`
      );
      if (reqSeq !== articleReqSeqRef.current) return;
      const nextItems = Array.isArray(payload?.items) ? payload.items : [];
      setArticleItems((prev) => (reset ? nextItems : [...prev, ...nextItems]));
      setArticleTotal(Number(payload?.total || 0));
      setArticleOffset(nextOffset + nextItems.length);
      setArticleHasMore(Boolean(payload?.has_more));
    } catch {
      if (reqSeq !== articleReqSeqRef.current) return;
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
    setArticleItems([]);
    setArticleTotal(0);
    setArticleOffset(0);
    setArticleHasMore(true);
    setArticleLoading(false);
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
  }, [ip, articleHasMore, articleLoading, articleOffset]);

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
      try {
        const [rs, bs, hs] = await Promise.all([
          apiGet(`/api/risk-score?ip=${ip}`).catch(() => null),
          apiGet("/api/burst-status").catch(() => null),
          apiGet("/api/health").catch(() => null),
        ]);
        if (rs) setRiskScore(rs);
        if (bs) setBurstStatus(bs);
        if (hs) setHealth(hs);
        if (rs || bs || hs) setLastUpdatedAt(formatUpdatedAt());
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
  const riskValue = Number(riskScore?.risk_score || 0);
  const alertLevel = String(riskScore?.alert_level || "P3").toUpperCase();
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
  };

  useEffect(() => {
    let active = true;
    const cleanups = [];

    const mount = async () => {
      const echarts = await import("echarts");
      if (!active) return;

      const trendEl = trendChartRef.current;
      if (trendEl) {
        const chart = echarts.init(trendEl);
        trendChartInstRef.current = chart;
        const x = dailyRows.map((r) => r.date);
        chart.setOption(
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
              },
              {
                name: "부정 비율(%)",
                type: "line",
                yAxisIndex: 0,
                smooth: true,
                symbol: "none",
                data: dailyRows.map((r) => Number(r.negative_ratio || 0)),
                lineStyle: { color: "#dc3c4a", width: 2 },
              },
            ],
          },
          true
        );
      }

      const displayedOutlets = outletRows.slice(0, 12);
      const outletEl = outletChartRef.current;
      if (outletEl) {
        const chart = echarts.init(outletEl);
        outletChartInstRef.current = chart;
        chart.setOption(
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
          true
        );
      }

      const themeEl = themeChartRef.current;
      if (themeEl) {
        const chart = echarts.init(themeEl);
        themeChartInstRef.current = chart;
        chart.setOption(
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
          true
        );
      }

      const keywordEl = keywordChartRef.current;
      if (keywordEl) {
        const chart = echarts.init(keywordEl);
        keywordChartInstRef.current = chart;
        const words = (keywordCloud || []).slice(0, 50).map((w) => ({
          name: String(w.word || ""),
          value: Math.max(1, Number(w.count || 0)),
        }));
        chart.setOption(
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
          true
        );
      }

      const onResize = () => {
        trendChartInstRef.current?.resize();
        outletChartInstRef.current?.resize();
        themeChartInstRef.current?.resize();
        keywordChartInstRef.current?.resize();
      };
      window.addEventListener("resize", onResize);
      cleanups.push(() => window.removeEventListener("resize", onResize));
    };

    mount();

    return () => {
      active = false;
      cleanups.forEach((fn) => fn());
      trendChartInstRef.current?.dispose();
      outletChartInstRef.current?.dispose();
      themeChartInstRef.current?.dispose();
      keywordChartInstRef.current?.dispose();
      trendChartInstRef.current = null;
      outletChartInstRef.current = null;
      themeChartInstRef.current = null;
      keywordChartInstRef.current = null;
    };
  }, [dailyRows, outletRows, themes, keywordCloud]);

  return (
    <Box sx={{ minHeight: "100dvh", bgcolor: "#eef0f3", py: { xs: 2, md: 4 } }}>
    <Container maxWidth="xl" sx={{ maxWidth: "1180px !important" }}>
      <Stack spacing={2}>
        <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 3, borderColor: "#e5e7eb", bgcolor: "#f8fafc", boxShadow: "0 8px 24px rgba(15,23,42,.04)" }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
            <Stack direction="row" alignItems="center" spacing={1.2}>
              <Box sx={{ width: 22, height: 22, borderRadius: 1.2, background: "linear-gradient(140deg,#0f3b66 0 58%,#9acb19 58% 100%)" }} />
              <Box>
                <Typography variant="caption" color="text.secondary">실시간 모니터링</Typography>
                <Typography sx={{ fontSize: { xs: 24, md: 28 }, fontWeight: 800, color: "#0f172a", letterSpacing: "-.02em" }}>넥슨 IP 리스크 대시보드</Typography>
              </Box>
            </Stack>
            <Stack direction="row" spacing={1}>
              <Button component={Link} href="/" variant="outlined" size="small">메인</Button>
              <Button component={Link} href="/compare" variant="outlined" size="small">경쟁사 비교</Button>
              {SHOW_BACKTEST ? <Button component={Link} href="/nexon/backtest" variant="contained" size="small">Backtest 보기</Button> : null}
            </Stack>
          </Stack>
        </Paper>

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
                    height: { xs: 250, md: 300 },
                    p: { xs: 2.2, md: 2.8 },
                    borderRadius: 3,
                    color: "#eef4ff",
                    position: "relative",
                    overflow: "hidden",
                    border: "1px solid rgba(255,255,255,0.2)",
                    background: currentBanner.visual.bg,
                    boxShadow: "0 20px 34px rgba(15,23,42,0.30)",
                    transition: "all .2s ease",
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
                    sx={{
                      position: "absolute",
                      right: 18,
                      top: 16,
                      width: 64,
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
                  <Typography sx={{ mt: 1, pr: 8, fontSize: { xs: 30, md: 38 }, fontWeight: 900, lineHeight: 1.04 }}>
                    {currentBanner.name}
                  </Typography>
                  <Typography sx={{ mt: 1, pr: 8, fontSize: 13, color: "rgba(237,245,255,.82)" }}>
                    {currentBanner.id === "all" ? "넥슨 전체보기 · 통합 리스크/테마 흐름" : "해당 IP 리스크 흐름 · 군집 · 버스트 모니터"}
                  </Typography>
                </Paper>
              ) : null}

              <Stack direction="row" spacing={1} alignItems="center" useFlexGap flexWrap="wrap">
                <Button
                  size="small"
                  variant="outlined"
                  onClick={goPrevBanner}
                  disabled={currentBannerIndex <= 0}
                  sx={{
                    minWidth: 64,
                    borderColor: "rgba(15,23,42,.2)",
                    color: "#334155",
                    bgcolor: "#fff",
                    "&:hover": { borderColor: "rgba(15,23,42,.35)", bgcolor: "#f8fafc" },
                  }}
                >
                  이전
                </Button>
                <Stack direction="row" spacing={0.6} alignItems="center">
                  {bannerItems.map((item, idx) => (
                    <Box
                      key={`dot-${item.id}`}
                      sx={{
                        width: idx === currentBannerIndex ? 18 : 8,
                        height: 8,
                        borderRadius: 99,
                        bgcolor: idx === currentBannerIndex ? "#0f3b66" : "rgba(15,23,42,.22)",
                        transition: "all .2s ease",
                      }}
                    />
                  ))}
                </Stack>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={goNextBanner}
                  disabled={currentBannerIndex >= bannerItems.length - 1}
                  sx={{
                    minWidth: 64,
                    borderColor: "rgba(15,23,42,.2)",
                    color: "#334155",
                    bgcolor: "#fff",
                    "&:hover": { borderColor: "rgba(15,23,42,.35)", bgcolor: "#f8fafc" },
                  }}
                >
                  다음
                </Button>
                <Chip variant="outlined" label={loading ? "자동 갱신 중" : "자동 갱신"} />
                <Chip variant="outlined" label={`현재: ${(riskData?.meta?.ip || "-")}`} />
                <Chip variant="outlined" label={`마지막 갱신: ${lastUpdatedAt || "-"}`} />
                {SHOW_BACKTEST ? <Chip component={Link} href="/nexon/backtest" clickable label="Backtest 보기" color="primary" variant="outlined" /> : null}
              </Stack>
              {usingMock ? <Chip color="warning" variant="outlined" label="샘플 데이터" /> : null}
            </Stack>
            {loading ? (
              <Box sx={{ mt: 1.5 }}>
                <LoadingState title="IP 데이터를 동기화하는 중" subtitle="리스크/군집/버스트 상태를 갱신하고 있습니다." />
              </Box>
            ) : null}
            {notice ? <Alert severity={usingMock ? "warning" : "info"} sx={{ mt: 1.5 }}>{notice}</Alert> : null}
            {modeMismatchWarning ? <Alert severity="warning" sx={{ mt: 1.5 }}>{modeMismatchWarning}</Alert> : null}
            {error ? (
              <Box sx={{ mt: 1.5 }}>
                <ErrorState title="대시보드 데이터를 불러오지 못했습니다." details={error} actionLabel="재시도" onAction={() => loadDashboard(ip)} />
              </Box>
            ) : null}
          </CardContent>
        </Card>

        <Grid container spacing={1.5}>
          {[
            { k: "선택 IP", v: riskData?.meta?.ip || "-", s: `${riskData?.meta?.date_from} ~ ${riskData?.meta?.date_to}` },
            { k: "총 기사 수", v: Number(riskData?.meta?.total_articles || 0).toLocaleString(), s: "필터 기준" },
            { k: "최고 위험 테마", v: topRisk?.theme || "-", s: `Risk ${topRisk?.risk_score ?? "-"}` },
            { k: "군집 수", v: Number(clusterData?.meta?.cluster_count || 0), s: "상위 6개" },
          ].map((item) => (
            <Grid item xs={12} sm={6} md={3} key={item.k}>
              <Card variant="outlined" sx={sectionCardSx}><CardContent>
                <Typography variant="body2" color="text.secondary">{item.k}</Typography>
                <Typography variant="h5" sx={{ mt: 0.8, fontWeight: 800 }}>{item.v}</Typography>
                <Typography variant="caption" color="text.secondary">{item.s}</Typography>
              </CardContent></Card>
            </Grid>
          ))}
        </Grid>

        <Card variant="outlined" sx={sectionCardSx}>
          <CardContent>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
              실시간 위험도 모니터
            </Typography>
            {riskScore ? (
              <>
                <Grid container spacing={1.8}>
                  <Grid item xs={12} md={6}>
                    <Paper variant="outlined" sx={{ p: 1.2, height: "100%" }}>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>위험도 점수</Typography>
                      <Typography variant="h4" sx={{ mt: 0.4, fontWeight: 800 }}>{riskValue.toFixed(1)}</Typography>
                      <Chip
                        label={riskMeaning.label}
                        size="small"
                        color={riskMeaning.color}
                        variant="outlined"
                        sx={{ mt: 0.7 }}
                      />
                      <LinearProgress
                        variant="determinate"
                        value={Math.max(0, Math.min(100, riskValue))}
                        sx={{
                          mt: 1.2,
                          height: 10,
                          borderRadius: 999,
                          bgcolor: "#edf2fb",
                          "& .MuiLinearProgress-bar": { bgcolor: riskGaugeColor },
                        }}
                      />
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.8 }}>
                      최근 {Number(riskScore?.meta?.window_hours || 24)}시간 롤링 윈도우 기준
                    </Typography>
                    </Paper>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Paper variant="outlined" sx={{ p: 1.2, height: "100%" }}>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>경보 등급</Typography>
                      <Chip
                        label={alertLevel}
                        color={alertLevel === "P1" ? "error" : alertLevel === "P2" ? "warning" : "success"}
                        sx={{ mt: 0.7, fontWeight: 700 }}
                      />
                      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.8 }}>
                        불확실 비율 {Math.round(Number(riskScore?.uncertain_ratio || 0) * 100)}%
                      </Typography>
                    </Paper>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Paper variant="outlined" sx={{ p: 1.2, height: "100%" }}>
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
                      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.8 }}>
                        주기 {selectedBurstStatus?.interval_seconds || 600}s
                        {selectedBurstStatus?.burst_remaining ? ` · 남은 ${selectedBurstStatus.burst_remaining}s` : ""}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                        최근 30분 이벤트 {recentBurstCount}건
                      </Typography>
                    </Paper>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Paper variant="outlined" sx={{ p: 1.2, height: "100%" }}>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>위험도 구성요소</Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.8 }}>
                        S {Number(riskScore?.components?.S || 0).toFixed(2)} · V {Number(riskScore?.components?.V || 0).toFixed(2)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                        T {Number(riskScore?.components?.T || 0).toFixed(2)} · M {Number(riskScore?.components?.M || 0).toFixed(2)}
                      </Typography>
                    </Paper>
                  </Grid>
                </Grid>

                <Paper variant="outlined" sx={{ p: 1.2, mt: 1.2 }}>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>
                    최근 24시간 기사 수: {recent24hArticles.toLocaleString()}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                    최근 7일 기준선: {weeklyBaselineMin.toLocaleString()}–{weeklyBaselineMax.toLocaleString()}건
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                    기준선 대비 {baselineRatio > 0 ? `${baselineRatio.toFixed(1)}배` : "0.0배"}
                  </Typography>
                </Paper>

                <Grid container spacing={1} sx={{ mt: 0.1 }}>
                  {["S", "V", "T", "M"].map((k) => {
                    const value = Math.max(0, Math.min(1, Number(riskScore?.components?.[k] || 0)));
                    return (
                      <Grid item xs={12} md={6} key={k}>
                        <Paper variant="outlined" sx={{ p: 1 }}>
                          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.7 }}>
                            <Typography variant="caption" sx={{ fontWeight: 700 }}>
                              {k === "S" ? "감성(S)" : k === "V" ? "볼륨(V)" : k === "T" ? "테마(T)" : "매체(M)"}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">{value.toFixed(2)}</Typography>
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

                <Paper variant="outlined" sx={{ p: 1.2, mt: 1 }}>
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
                  <Typography variant="body2" sx={{ mt: 0.8 }}>
                    {liveInterpretation}
                  </Typography>
                </Paper>

                <Paper variant="outlined" sx={{ mt: 1, p: 0.5 }}>
                  <List dense disablePadding>
                    {filteredBurstEvents.length ? (
                      filteredBurstEvents.slice(0, 5).map((evt, idx) => (
                        <ListItem key={`${evt.occurred_at}-${idx}`} divider>
                          <ListItemText
                            primary={`${String(evt.occurred_at).slice(5, 16)} · ${evt.ip_name} · ${String(evt.event_type).toUpperCase()}`}
                            secondary={evt.trigger_reason}
                          />
                        </ListItem>
                      ))
                    ) : (
                      <ListItem>
                        <ListItemText primary="아직 버스트 이벤트가 없습니다. (실시간 신호 대기 중)" />
                      </ListItem>
                    )}
                  </List>
                </Paper>
              </>
            ) : (
              <Stack spacing={0.5}>
                <Typography variant="body2" color="text.secondary">
                  위험도 데이터가 아직 없습니다.
                </Typography>
                {!filteredBurstEvents.length ? (
                  <Typography variant="caption" color="text.secondary">
                    아직 버스트 이벤트가 없습니다. (실시간 신호 대기 중)
                  </Typography>
                ) : null}
              </Stack>
            )}
          </CardContent>
        </Card>

        <Card variant="outlined" sx={sectionCardSx}>
          <CardContent>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>일자별 기사/부정 추이</Typography>
            <Box ref={trendChartRef} sx={{ width: "100%", height: 290 }} />
          </CardContent>
        </Card>

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", lg: "1.4fr 1fr" },
            gap: 1.5,
          }}
        >
          <Card variant="outlined" sx={sectionCardSx}><CardContent>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 1, lineHeight: 1.25 }}>
                언론사별<br />감성 분포
              </Typography>
              <Box ref={outletChartRef} sx={{ width: "100%", height: 420 }} />
            </CardContent></Card>
          <Card variant="outlined" sx={sectionCardSx}><CardContent>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 1, lineHeight: 1.25 }}>
                위험 테마<br />점수
              </Typography>
              <Box ref={themeChartRef} sx={{ width: "100%", height: 420 }} />
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
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>IP 군집 결과</Typography>
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
              {articleItems.map((a) => (
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
            <Box ref={articleSentinelRef} sx={{ height: 1 }} />
            {articleLoading ? (
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1.2 }}>
                기사 목록을 불러오는 중...
              </Typography>
            ) : null}
            {!articleLoading && !articleHasMore && articleItems.length > 0 ? (
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1.2 }}>
                마지막 기사까지 모두 불러왔습니다.
              </Typography>
            ) : null}
            {!articleLoading && articleItems.length === 0 ? (
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1.2 }}>
                아직 표시할 수집 기사가 없습니다.
              </Typography>
            ) : null}
          </CardContent>
        </Card>
      </Stack>
    </Container>
    </Box>
  );
}
