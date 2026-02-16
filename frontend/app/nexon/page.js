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
  FormControl,
  Grid,
  InputLabel,
  LinearProgress,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";
const NEXON_LOGO = "/nexon-logo.png";
const D3WordCloud = dynamic(() => import("react-d3-cloud"), { ssr: false });

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
    { id: "all", name: "전체" },
    { id: "maplestory", name: "메이플스토리" },
    { id: "dnf", name: "던전앤파이터" },
    { id: "kartrider", name: "카트라이더" },
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

async function apiGet(path) {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

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
  const [dateFrom, setDateFrom] = useState("2024-01-01");
  const [dateTo, setDateTo] = useState("2026-12-31");
  const [riskData, setRiskData] = useState(MOCK_RISK);
  const [clusterData, setClusterData] = useState(MOCK_CLUSTER);
  const [riskScore, setRiskScore] = useState(null);
  const [burstStatus, setBurstStatus] = useState(null);
  const [burstEvents, setBurstEvents] = useState([]);
  const [usingMock, setUsingMock] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadDashboard = async (targetIp = ip) => {
    setLoading(true);
    setError("");
    try {
      const base = new URLSearchParams({ ip: targetIp, date_from: dateFrom, date_to: dateTo });
      const [riskPayload, clusterPayload, riskScorePayload, burstStatusPayload, burstEventsPayload] = await Promise.all([
        apiGet(`/api/risk-dashboard?${base.toString()}`),
        apiGet(`/api/ip-clusters?${base.toString()}&limit=6`),
        apiGet(`/api/risk-score?ip=${targetIp}`).catch(() => null),
        apiGet("/api/burst-status").catch(() => null),
        apiGet("/api/burst-events?limit=10").catch(() => null),
      ]);

      const okRisk = Number(riskPayload?.meta?.total_articles || 0) > 0;
      const okCluster = Number(clusterPayload?.meta?.cluster_count || 0) > 0;
      setRiskData(okRisk ? riskPayload : { ...MOCK_RISK, meta: { ...MOCK_RISK.meta, ip_id: targetIp, date_from: dateFrom, date_to: dateTo } });
      setClusterData(okCluster ? clusterPayload : MOCK_CLUSTER);
      setUsingMock(!(okRisk && okCluster));
      setRiskScore(riskScorePayload || null);
      setBurstStatus(burstStatusPayload || null);
      setBurstEvents((burstEventsPayload?.items || []).slice(0, 10));
    } catch (e) {
      setRiskData({ ...MOCK_RISK, meta: { ...MOCK_RISK.meta, ip_id: targetIp, date_from: dateFrom, date_to: dateTo } });
      setClusterData(MOCK_CLUSTER);
      setUsingMock(true);
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const timer = setInterval(async () => {
      try {
        const [rs, bs] = await Promise.all([
          apiGet(`/api/risk-score?ip=${ip}`).catch(() => null),
          apiGet("/api/burst-status").catch(() => null),
        ]);
        if (rs) setRiskScore(rs);
        if (bs) setBurstStatus(bs);
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
            </Stack>
          </Stack>
        </Paper>

        <Card variant="outlined">
          <CardContent>
            <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} alignItems={{ xs: "stretch", md: "flex-end" }}>
              <FormControl size="small" sx={{ minWidth: 180 }}>
                <InputLabel id="ip-select-label">IP</InputLabel>
                <Select labelId="ip-select-label" label="IP" value={ip} onChange={(e) => setIp(e.target.value)}>
                  {(riskData?.ip_catalog || MOCK_RISK.ip_catalog).map((item) => (
                    <MenuItem key={item.id} value={item.id}>{item.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField size="small" label="시작일" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} InputLabelProps={{ shrink: true }} />
              <TextField size="small" label="종료일" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} InputLabelProps={{ shrink: true }} />
              <Button variant="contained" onClick={() => loadDashboard(ip)} disabled={loading}>{loading ? "불러오는 중" : "분석 갱신"}</Button>
              {usingMock ? <Chip color="warning" variant="outlined" label="샘플 데이터" /> : null}
            </Stack>
            {loading ? <LinearProgress sx={{ mt: 1.5 }} /> : null}
            {error ? <Alert severity="error" sx={{ mt: 1.5 }}>{error}</Alert> : null}
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
                  {(burstEvents || []).slice(0, 5).map((evt, idx) => (
                    <li key={`${evt.occurred_at}-${idx}`}>
                      {evt.event_type === "enter" ? "🔴" : "🟢"} {String(evt.occurred_at).slice(5, 16)} {evt.ip_name} {String(evt.event_type).toUpperCase()} ({evt.trigger_reason})
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <Typography variant="body2" color="text.secondary">
                위험도 데이터가 아직 없습니다.
              </Typography>
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
