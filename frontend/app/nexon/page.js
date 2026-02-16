"use client";

import dynamic from "next/dynamic";
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
const NEXON_LOGO = "/nexon-logo.png";
const D3WordCloud = dynamic(() => import("react-d3-cloud"), { ssr: false });
const IP_BANNER_STYLE = {
  all: {
    kicker: "NEXON OVERVIEW",
    accent: "#8ba2ff",
    bg: "linear-gradient(150deg,#101934 0%,#1b3f98 48%,#4d74e2 100%)",
    glow: "radial-gradient(circle at 82% 18%, rgba(154,188,255,.36) 0%, rgba(154,188,255,0) 52%)",
  },
  maplestory: { kicker: "MAPLESTORY", accent: "#ffb347", bg: "linear-gradient(145deg,#2f1c10 0%,#6f3f12 52%,#f09a42 100%)" },
  dnf: { kicker: "DNF", accent: "#ff7a7a", bg: "linear-gradient(145deg,#2a0d12 0%,#5f1823 52%,#c63d48 100%)" },
  arcraiders: { kicker: "ARC RAIDERS", accent: "#88f0d3", bg: "linear-gradient(145deg,#0d2432 0%,#1f5668 52%,#42a5a8 100%)" },
  bluearchive: { kicker: "BLUE ARCHIVE", accent: "#9ec6ff", bg: "linear-gradient(145deg,#121f47 0%,#1f4f99 55%,#4d8ddf 100%)" },
  fconline: { kicker: "FC ONLINE", accent: "#9ff58a", bg: "linear-gradient(145deg,#092315 0%,#0d5733 52%,#2cae63 100%)" },
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

function WordCloudChart({ items }) {
  const wrapRef = useRef(null);
  const [size, setSize] = useState({ width: 980, height: 320 });
  const words = useMemo(
    () => (items || []).slice(0, 120).map((w) => ({ text: w.word, value: Math.max(8, Number(w.count || 0)) })),
    [items]
  );

  useEffect(() => {
    if (!wrapRef.current) return;
    const update = () => {
      if (!wrapRef.current) return;
      const nextWidth = Math.max(320, Math.floor(wrapRef.current.clientWidth - 2));
      setSize({ width: nextWidth, height: 320 });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  return (
    <Box
      ref={wrapRef}
      sx={{
        width: "100%",
        minHeight: 320,
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 2,
        bgcolor: "#f8fbff",
        overflow: "hidden",
        p: 1,
      }}
    >
      {words.length === 0 ? (
        <Typography color="text.secondary">표시할 키워드가 없습니다.</Typography>
      ) : (
        <D3WordCloud
          data={words}
          width={size.width}
          height={size.height}
          font="'Noto Sans KR'"
          fontWeight="700"
          fontStyle="normal"
          spiral="archimedean"
          rotate={(word) => (word.value % 3 === 0 ? 90 : 0)}
          fontSize={(word) => Math.max(14, Math.min(56, 10 + word.value * 1.7))}
          random={() => 0.5}
          padding={2}
        />
      )}
    </Box>
  );
}

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
  const swipeStartXRef = useRef(null);
  const ipCacheRef = useRef(new Map());
  const requestSeqRef = useRef(0);
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
  const maxDaily = useMemo(() => Math.max(...dailyRows.map((r) => Number(r.article_count || 0)), 1), [dailyRows]);
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
  const burstPeriods = useMemo(() => {
    if (!burstEvents.length) return [];
    const sorted = [...burstEvents]
      .filter((e) => (ip === "all" ? true : e.ip_name === ip))
      .sort((a, b) => String(a.occurred_at).localeCompare(String(b.occurred_at)));
    const periods = [];
    let opened = null;
    for (const evt of sorted) {
      if (evt.event_type === "enter") {
        opened = { start: evt.occurred_at, ip: evt.ip_name };
      } else if (evt.event_type === "exit" && opened) {
        periods.push({ ...opened, end: evt.occurred_at });
        opened = null;
      }
    }
    if (opened) periods.push({ ...opened, end: null });
    return periods;
  }, [burstEvents, ip]);
  const isBurstDate = (day) => {
    if (!day) return false;
    const base = new Date(`${day}T00:00:00`);
    const dayStart = base.getTime();
    const dayEnd = dayStart + 24 * 60 * 60 * 1000 - 1;
    return burstPeriods.some((p) => {
      const s = new Date(String(p.start).replace(" ", "T")).getTime();
      const e = p.end ? new Date(String(p.end).replace(" ", "T")).getTime() : Date.now();
      return !(e < dayStart || s > dayEnd);
    });
  };
  const riskValue = Number(riskScore?.risk_score || 0);
  const alertLevel = String(riskScore?.alert_level || "P3").toUpperCase();
  const riskGaugeColor = riskValue >= 70 ? "#dc3c4a" : riskValue >= 45 ? "#e89c1c" : "#11a36a";
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
  const modeMismatchWarning = health?.mode === "backtest" ? "Live dashboard is using backtest DB" : "";

  return (
    <Container maxWidth="xl" sx={{ py: 2 }}>
      <Stack spacing={2}>
        <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
            <Stack direction="row" alignItems="center" spacing={1.2}>
              <Box component="img" src={NEXON_LOGO} alt="NEXON" sx={{ height: 28, width: "auto" }} />
              <Box>
                <Typography variant="caption" color="text.secondary">넥슨 군집 분석</Typography>
                <Typography variant="h5" sx={{ fontWeight: 800 }}>IP Cluster Dashboard</Typography>
              </Box>
            </Stack>
            <Stack direction="row" spacing={1}>
              <Button component={Link} href="/" variant="outlined" size="small">메인</Button>
              <Button component={Link} href="/compare" variant="outlined" size="small">경쟁사 비교</Button>
              <Button component={Link} href="/nexon/backtest" variant="contained" size="small">Backtest 보기</Button>
            </Stack>
          </Stack>
        </Paper>

        <Card variant="outlined">
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
                    height: { xs: 260, md: 320 },
                    p: { xs: 2, md: 2.4 },
                    borderRadius: 3,
                    color: "#eef4ff",
                    position: "relative",
                    overflow: "hidden",
                    border: "2px solid #8ab4ff",
                    background: currentBanner.visual.bg,
                    boxShadow: "0 14px 30px rgba(20,52,122,0.34)",
                    transition: "all .2s ease",
                  }}
                >
                  <IconButton
                    onClick={goPrevBanner}
                    disabled={currentBannerIndex <= 0}
                    sx={{
                      position: "absolute",
                      left: 10,
                      top: "50%",
                      transform: "translateY(-50%)",
                      bgcolor: "rgba(5,12,31,.4)",
                      color: "#fff",
                      border: "1px solid rgba(255,255,255,.28)",
                      "&:hover": { bgcolor: "rgba(5,12,31,.62)" },
                      "&.Mui-disabled": { color: "rgba(255,255,255,.35)" },
                    }}
                  >
                    {"<"}
                  </IconButton>
                  <IconButton
                    onClick={goNextBanner}
                    disabled={currentBannerIndex >= bannerItems.length - 1}
                    sx={{
                      position: "absolute",
                      right: 10,
                      top: "50%",
                      transform: "translateY(-50%)",
                      bgcolor: "rgba(5,12,31,.4)",
                      color: "#fff",
                      border: "1px solid rgba(255,255,255,.28)",
                      "&:hover": { bgcolor: "rgba(5,12,31,.62)" },
                      "&.Mui-disabled": { color: "rgba(255,255,255,.35)" },
                    }}
                  >
                    {">"}
                  </IconButton>
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
                      opacity: 0.9,
                      filter: "grayscale(100%) brightness(2.1)",
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
                  <Typography sx={{ mt: 1, pr: 8, fontSize: 13, color: "rgba(237,245,255,.84)" }}>
                    {currentBanner.id === "all" ? "넥슨 전체보기 · 통합 리스크/테마 흐름" : "해당 IP 리스크 흐름 · 군집 · 버스트 모니터"}
                  </Typography>
                  <Chip
                    label="배너 좌우 화살표 또는 스와이프"
                    size="small"
                    sx={{
                      mt: 2,
                      bgcolor: "rgba(255,255,255,.15)",
                      color: "#fff",
                      border: "1px solid rgba(255,255,255,.28)",
                    }}
                  />
                </Paper>
              ) : null}

              <Stack direction="row" spacing={1}>
                <Chip variant="outlined" label={loading ? "자동 갱신 중" : "자동 갱신"} />
                <Chip variant="outlined" label={`현재: ${(riskData?.meta?.ip || "-")}`} />
                <Chip variant="outlined" label={`Last updated: ${lastUpdatedAt || "-"}`} />
                <Chip component={Link} href="/nexon/backtest" clickable label="Backtest 보기" color="primary" variant="outlined" />
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
              <Card variant="outlined"><CardContent>
                <Typography variant="body2" color="text.secondary">{item.k}</Typography>
                <Typography variant="h5" sx={{ mt: 0.8, fontWeight: 800 }}>{item.v}</Typography>
                <Typography variant="caption" color="text.secondary">{item.s}</Typography>
              </CardContent></Card>
            </Grid>
          ))}
        </Grid>

        <Card variant="outlined" className="riskLiveSection">
          <CardContent>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
              실시간 위험도 모니터
            </Typography>
            {riskScore ? (
              <>
                <div className="riskScoreCard">
                  <Paper variant="outlined" sx={{ p: 1.2 }}>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>Risk 점수</Typography>
                    <Typography variant="h4" sx={{ mt: 0.4, fontWeight: 800 }}>{riskValue.toFixed(1)}</Typography>
                    <div className="riskGauge">
                      <div className="riskGaugeFill" style={{ width: `${Math.max(0, Math.min(100, riskValue))}%`, background: riskGaugeColor }} />
                    </div>
                  </Paper>
                  <Paper variant="outlined" sx={{ p: 1.2 }}>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>Alert</Typography>
                    <div className={`alertBadge ${alertLevel.toLowerCase()}`}>{alertLevel}</div>
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.8 }}>
                      uncertain {Math.round(Number(riskScore?.uncertain_ratio || 0) * 100)}%
                    </Typography>
                  </Paper>
                  <Paper variant="outlined" sx={{ p: 1.2 }}>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>수집 모드</Typography>
                    <div className="burstIndicator" style={{ marginTop: 8 }}>
                      <span className={`burstDot ${selectedBurstStatus?.mode === "burst" ? "active" : "idle"}`} />
                      {selectedBurstStatus?.mode === "burst" ? "BURST 모드" : "정상 수집"}
                    </div>
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.8 }}>
                      주기 {selectedBurstStatus?.interval_seconds || 600}s
                      {selectedBurstStatus?.burst_remaining ? ` · 남은 ${selectedBurstStatus.burst_remaining}s` : ""}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                      최근 30분 이벤트 {recentBurstCount}건
                    </Typography>
                  </Paper>
                  <Paper variant="outlined" sx={{ p: 1.2 }}>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>컴포넌트</Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.8 }}>
                      S {Number(riskScore?.components?.S || 0).toFixed(2)} · V {Number(riskScore?.components?.V || 0).toFixed(2)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                      T {Number(riskScore?.components?.T || 0).toFixed(2)} · M {Number(riskScore?.components?.M || 0).toFixed(2)}
                    </Typography>
                  </Paper>
                </div>

                <div className="componentBars">
                  {["S", "V", "T", "M"].map((k) => {
                    const value = Math.max(0, Math.min(1, Number(riskScore?.components?.[k] || 0)));
                    return (
                      <div className="componentBar" key={k}>
                        <label>
                          <span>{k}</span>
                          <div className="riskGauge">
                            <div className="riskGaugeFill" style={{ width: `${value * 100}%`, background: "#0f3f95" }} />
                          </div>
                          <strong>{value.toFixed(2)}</strong>
                        </label>
                      </div>
                    );
                  })}
                </div>

                <ul className="burstLog">
                  {filteredBurstEvents.length ? (
                    filteredBurstEvents.slice(0, 5).map((evt, idx) => (
                      <li key={`${evt.occurred_at}-${idx}`}>
                        {evt.event_type === "enter" ? "🔴" : "🟢"} {String(evt.occurred_at).slice(5, 16)} {evt.ip_name} {String(evt.event_type).toUpperCase()} ({evt.trigger_reason})
                      </li>
                    ))
                  ) : (
                    <li>No burst events yet (waiting for live signals)</li>
                  )}
                </ul>
              </>
            ) : (
              <Stack spacing={0.5}>
                <Typography variant="body2" color="text.secondary">
                  위험도 데이터가 아직 없습니다.
                </Typography>
                {!filteredBurstEvents.length ? (
                  <Typography variant="caption" color="text.secondary">
                    No burst events yet (waiting for live signals)
                  </Typography>
                ) : null}
              </Stack>
            )}
          </CardContent>
        </Card>

        <Card variant="outlined">
          <CardContent>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>날짜별 기사 흐름</Typography>
            <Box sx={{ display: "grid", gridTemplateColumns: `repeat(${Math.max(dailyRows.length, 1)}, minmax(14px, 1fr))`, gap: 0.5, alignItems: "end", minHeight: 180 }}>
              {dailyRows.map((row) => (
                <Box key={row.date} title={`${row.date} | ${row.article_count}건 | 부정 ${row.negative_ratio}%`}>
                  <Box
                    sx={{
                      height: 150,
                      border: "1px solid",
                      borderColor: "divider",
                      borderRadius: 1,
                      p: "2px",
                      display: "flex",
                      alignItems: "flex-end",
                      bgcolor: isBurstDate(row.date) ? "rgba(220,60,74,0.12)" : "#f7faff",
                    }}
                  >
                    <Box sx={{ width: "100%", height: `${(Number(row.article_count || 0) / maxDaily) * 100}%`, minHeight: 2, borderRadius: 1, bgcolor: "primary.main", opacity: Math.max(0.35, Number(row.negative_ratio || 0) / 100) }} />
                  </Box>
                  <Typography variant="caption" color="text.secondary" sx={{ display: "block", textAlign: "center", mt: 0.4 }}>{row.date.slice(5)}</Typography>
                </Box>
              ))}
            </Box>
          </CardContent>
        </Card>

        <Grid container spacing={1.5}>
          <Grid item xs={12} lg={7}>
            <Card variant="outlined"><CardContent>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>언론사별 기사 수/감성 분포</Typography>
              <Stack spacing={1}>
                {outletRows.map((r) => (
                  <Box key={r.outlet} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 1.5, p: 1 }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Typography sx={{ fontWeight: 700 }}>{r.outlet}</Typography>
                      <Typography variant="caption" color="text.secondary">{r.article_count}건</Typography>
                    </Stack>
                    <Stack direction="row" sx={{ mt: 1, height: 10, borderRadius: 999, overflow: "hidden", bgcolor: "#edf2fb" }}>
                      <Box sx={{ width: `${r.positive_ratio}%`, bgcolor: "success.main" }} />
                      <Box sx={{ width: `${r.neutral_ratio}%`, bgcolor: "warning.main" }} />
                      <Box sx={{ width: `${r.negative_ratio}%`, bgcolor: "error.main" }} />
                    </Stack>
                    <Typography variant="caption" color="text.secondary">긍정 {r.positive_ratio}% · 중립 {r.neutral_ratio}% · 부정 {r.negative_ratio}%</Typography>
                  </Box>
                ))}
              </Stack>
            </CardContent></Card>
          </Grid>
          <Grid item xs={12} lg={5}>
            <Card variant="outlined"><CardContent>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>위험 기사 테마</Typography>
              <Stack spacing={1}>
                {themes.map((t) => (
                  <Box key={t.theme} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 1.5, p: 1 }}>
                    <Typography sx={{ fontWeight: 700 }}>{t.theme}</Typography>
                    <Typography variant="caption" color="text.secondary">기사 {t.article_count}건 · 부정 {t.negative_ratio}%</Typography>
                    <LinearProgress
                      variant="determinate"
                      value={Math.round(Number(t.risk_score || 0) * 100)}
                      sx={{ mt: 1, height: 8, borderRadius: 999, bgcolor: "#edf2fb" }}
                    />
                  </Box>
                ))}
              </Stack>
            </CardContent></Card>
          </Grid>
        </Grid>

        <Card variant="outlined"><CardContent>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>키워드 워드클라우드</Typography>
          <WordCloudChart items={keywordCloud} />
        </CardContent></Card>

        <Card variant="outlined"><CardContent>
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

        <Card variant="outlined"><CardContent>
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
      </Stack>
    </Container>
  );
}
