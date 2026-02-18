"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Box, Button, Chip, Container, Divider, Paper, Stack, Typography } from "@mui/material";
import { apiGet, getDiagnosticCode } from "../lib/api";
import ApiGuardBanner from "../components/ApiGuardBanner";
import PageStatusView from "../components/PageStatusView";
import {
  actionButtonSx,
  navButtonSx,
  pageContainerSx,
  pageShellSx,
  panelPaperSx,
  sectionCardSx,
  statusChipSx,
} from "../lib/uiTokens";
import {
  buildDiagnosticScope,
  shouldShowEmptyState,
  toRequestErrorState,
} from "../lib/pageStatus";

const DIAG_SCOPE = {
  init: buildDiagnosticScope("HOME", "INIT"),
  health: buildDiagnosticScope("HOME", "HEALTH"),
};

function formatTime(value) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleTimeString("ko-KR", { hour12: false });
}

function riskLevel(score) {
  const n = Number(score || 0);
  if (n >= 70) return "심각";
  if (n >= 45) return "높음";
  if (n >= 20) return "주의";
  return "낮음";
}

function riskTone(score) {
  const n = Number(score || 0);
  if (n >= 70) return { bg: "#fee2e2", border: "#fecaca", color: "#b91c1c" };
  if (n >= 45) return { bg: "#fff7ed", border: "#fed7aa", color: "#c2410c" };
  if (n >= 20) return { bg: "#fef9c3", border: "#fde68a", color: "#a16207" };
  return { bg: "#ecfdf3", border: "#bbf7d0", color: "#166534" };
}

function connectionTone(connected) {
  if (connected) return { bg: "#ecfdf3", border: "#bbf7d0", color: "#166534", text: "데이터 연동 정상" };
  return { bg: "#fef2f2", border: "#fecaca", color: "#b91c1c", text: "연동 확인 필요" };
}

function modeTone(mode) {
  if (mode === "live") return { bg: "#eff6ff", border: "#bfdbfe", color: "#1d4ed8", text: "운영 데이터" };
  if (mode === "backtest") return { bg: "#faf5ff", border: "#e9d5ff", color: "#7e22ce", text: "백테스트 데이터" };
  return { bg: "#f8fafc", border: "#e2e8f0", color: "#475569", text: "모드 미확인" };
}

export default function HomePage() {
  const [health, setHealth] = useState(null);
  const [risk, setRisk] = useState(null);
  const [lastUpdated, setLastUpdated] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [errorCode, setErrorCode] = useState("");
  const [healthDiagCode, setHealthDiagCode] = useState("");
  const [hoveredCard, setHoveredCard] = useState(null);

  useEffect(() => {
    let active = true;
    const run = async () => {
      setLoading(true);
      setError("");
      setErrorCode("");
      setHealthDiagCode("");
      try {
        const [healthState, riskRes] = await Promise.all([
          apiGet("/api/health")
            .then((data) => ({ data, error: null }))
            .catch((error) => ({ data: null, error })),
          apiGet("/api/risk-score?ip=maplestory").catch(() => null),
        ]);
        if (!active) return;
        setHealth(healthState.data);
        setRisk(riskRes);
        if (healthState.error) {
          setHealthDiagCode(getDiagnosticCode(healthState.error, DIAG_SCOPE.health));
        }
        if (healthState.data || riskRes) {
          setLastUpdated(new Date().toISOString());
        } else {
          setLastUpdated("");
          setError("초기 상태 데이터를 가져오지 못했습니다. API 연결을 확인해주세요.");
        }
      } catch (e) {
        if (!active) return;
        const nextError = toRequestErrorState(e, {
          scope: DIAG_SCOPE.init,
          fallback: "초기 상태 데이터를 가져오지 못했습니다.",
        });
        setError(nextError.message);
        setErrorCode(nextError.code);
      } finally {
        if (active) setLoading(false);
      }
    };
    run();
    return () => {
      active = false;
    };
  }, []);

  const cards = [
    {
      key: "compare",
      title: "경쟁사 비교",
      points: ["보도량 증감", "감성 분포", "상위 키워드"],
      href: "/compare",
      accent: "#9acb19",
      hoverBg: "#f4f8e7",
      hoverText: "#0f172a",
      hoverBody: "#4b5563",
      hoverBorder: "#d3e6a7",
      hoverOverlay: "linear-gradient(100deg, rgba(171,223,56,.22) 0%, rgba(231,246,188,.28) 45%, rgba(255,255,255,0) 82%)",
    },
    {
      key: "risk",
      title: "넥슨 IP 리스크",
      points: ["실시간 위험도", "위험 테마 랭킹", "최신 기사 흐름"],
      href: "/nexon",
      accent: "#0f3b66",
      hoverBg: "#0f3b66",
      hoverText: "#f8fafc",
      hoverBody: "rgba(248,250,252,.9)",
      hoverBorder: "#0f3b66",
      hoverOverlay: "linear-gradient(100deg, rgba(151,196,255,.22) 0%, rgba(15,59,102,.12) 45%, rgba(15,59,102,0) 82%)",
    },
  ];

  const stats = useMemo(() => {
    const riskValue = Number(risk?.risk_score || 0);
    return {
      recent: Number(health?.recent_articles_24h || 0).toLocaleString(),
      riskText: `${riskValue.toFixed(1)} (${riskLevel(riskValue)})`,
      riskValue,
      modeText: health?.mode === "live" ? "운영 데이터" : "연결 확인 필요",
    };
  }, [health, risk]);

  const riskStyle = riskTone(stats.riskValue);
  const connStyle = connectionTone(Boolean(health || risk));
  const modeStyle = modeTone(health?.mode);
  const shouldShowHomeEmpty = shouldShowEmptyState({
    loading,
    error,
    hasData: Boolean(health || risk),
  });

  return (
    <Box sx={{ ...pageShellSx, py: { xs: 2, md: 6 }, fontFamily: "'Plus Jakarta Sans','Noto Sans KR',sans-serif" }}>
      <Container maxWidth="xl" sx={pageContainerSx}>
        <Stack spacing={{ xs: 2.5, md: 3.5 }}
        >
          <Paper sx={{ ...panelPaperSx, bgcolor: "#f8fafc", boxShadow: "0 8px 24px rgba(15,23,42,.04)" }}>
            <Stack
              direction="row"
              alignItems="center"
              justifyContent="space-between"
              sx={{ px: { xs: 2, md: 3 }, py: 1.2 }}
            >
              <Stack direction="row" spacing={1} alignItems="center">
                <Box
                  sx={{
                    width: 22,
                    height: 22,
                    borderRadius: 1.2,
                    background: "linear-gradient(140deg, #0f3b66 0 58%, #9acb19 58% 100%)",
                    boxShadow: "inset 0 0 0 1px rgba(255,255,255,.25)",
                  }}
                />
                <Typography sx={{ fontSize: 20, fontWeight: 800, color: "#0f172a", letterSpacing: "-.01em" }}>
                  PR Portfolio
                </Typography>
              </Stack>
              <Button
                component={Link}
                href="/project"
                variant="contained"
                sx={actionButtonSx.primary}
              >
                프로젝트 소개
              </Button>
            </Stack>
          </Paper>

          <Stack alignItems="center" spacing={1.2} sx={{ textAlign: "center", pt: { xs: 1.5, md: 2 } }}>
            <Chip
              label="실시간 모니터링"
              size="small"
              sx={{
                ...statusChipSx,
                bgcolor: "#eef2ff",
                border: "1px solid #c7d2fe",
                color: "#1e3a8a",
                letterSpacing: ".02em",
              }}
            />
            <Typography sx={{ fontSize: { xs: 36, md: 52 }, fontWeight: 800, lineHeight: 1.08, color: "#111827", letterSpacing: "-.02em" }}>
              PR 실시간 이슈 현황판
            </Typography>
            <Typography sx={{ mt: 1, fontSize: { xs: 17, md: 22 }, color: "#6b7280", letterSpacing: "-.01em" }}>
              리스크 분석 포트폴리오
            </Typography>
            <Stack direction="row" spacing={1} justifyContent="center" useFlexGap flexWrap="wrap" sx={{ mt: 2 }}>
              <Chip size="small" label={`최근 갱신 ${formatTime(lastUpdated)}`} variant="outlined" sx={statusChipSx} />
              <Chip size="small" label={connStyle.text} variant="outlined" sx={{ ...statusChipSx, bgcolor: connStyle.bg, borderColor: connStyle.border, color: connStyle.color }} />
              <Chip size="small" label={modeStyle.text} variant="outlined" sx={{ ...statusChipSx, bgcolor: modeStyle.bg, borderColor: modeStyle.border, color: modeStyle.color }} />
            </Stack>
            <ApiGuardBanner />
            {healthDiagCode ? (
              <PageStatusView
                error={{
                  show: true,
                  title: "실시간 상태를 일시적으로 확인하지 못했습니다.",
                  details: "서비스는 계속 사용할 수 있습니다.",
                  diagnosticCode: healthDiagCode,
                }}
              />
            ) : null}
            <PageStatusView
              loading={{
                show: loading,
                title: "상태 데이터 동기화 중",
                subtitle: "운영 연동 상태를 확인하고 있습니다.",
              }}
              error={{
                show: Boolean(error),
                title: "초기 데이터 로드 실패",
                details: error,
                diagnosticCode: errorCode,
              }}
              empty={{
                show: shouldShowHomeEmpty,
                title: "표시할 상태 데이터가 없습니다.",
                subtitle: "잠시 후 다시 확인해주세요.",
              }}
            />
          </Stack>

          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
              gap: 3,
              maxWidth: 900,
              mx: "auto",
              width: "100%",
            }}
          >
            {cards.map((card) => {
              const active = hoveredCard === card.key;
              return (
                <Paper
                  key={card.key}
                  onMouseEnter={() => setHoveredCard(card.key)}
                  onMouseLeave={() => setHoveredCard(null)}
                  sx={{
                    ...sectionCardSx,
                    p: 3,
                    textAlign: "left",
                    minHeight: 285,
                    position: "relative",
                    overflow: "hidden",
                    border: `1px solid ${active ? card.hoverBorder : "#e5e7eb"}`,
                    bgcolor: active ? card.hoverBg : "#ffffff",
                    color: active ? card.hoverText : "#111827",
                    boxShadow: active ? "0 16px 30px rgba(15,23,42,.12)" : "0 8px 18px rgba(15,23,42,.04)",
                    transition:
                      "transform .75s cubic-bezier(.22,.61,.36,1), box-shadow .75s cubic-bezier(.22,.61,.36,1), border-color .75s cubic-bezier(.22,.61,.36,1), background-color .75s cubic-bezier(.22,.61,.36,1), color .75s cubic-bezier(.22,.61,.36,1)",
                    transform: active ? "translateY(-6px)" : "translateY(0)",
                    "&::before": {
                      content: '""',
                      position: "absolute",
                      inset: 0,
                      background: card.hoverOverlay,
                      opacity: active ? 1 : 0,
                      transform: active ? "translateX(0)" : "translateX(-8%)",
                      transition:
                        "opacity .9s cubic-bezier(.2,.65,.2,1), transform .9s cubic-bezier(.2,.65,.2,1)",
                    },
                  }}
                >
                  <Box
                    sx={{
                      width: 50,
                      height: 50,
                      borderRadius: "999px",
                      bgcolor: active ? "rgba(255,255,255,.9)" : `${card.accent}1A`,
                      color: active ? "#0f172a" : card.accent,
                      fontWeight: 900,
                      fontSize: 22,
                      display: "grid",
                      placeItems: "center",
                      position: "relative",
                      zIndex: 1,
                      transition:
                        "transform .75s cubic-bezier(.22,.61,.36,1), background-color .75s cubic-bezier(.22,.61,.36,1), color .75s cubic-bezier(.22,.61,.36,1)",
                      transform: active ? "scale(1.03)" : "scale(1)",
                    }}
                  >
                    →
                  </Box>

                  <Typography sx={{ mt: 2, fontSize: { xs: 32, md: 38 }, fontWeight: 800, lineHeight: 1.12, letterSpacing: "-.015em", wordBreak: "keep-all", position: "relative", zIndex: 1 }}>
                    {card.title}
                  </Typography>
                  <Stack spacing={0.8} sx={{ mt: 1.5, position: "relative", zIndex: 1 }}>
                    {card.points.map((point) => (
                      <Typography
                        key={point}
                        sx={{
                          fontSize: { xs: 17, md: 17 },
                          color: active ? card.hoverBody : "#6b7280",
                          letterSpacing: "-.01em",
                        }}
                      >
                        · {point}
                      </Typography>
                    ))}
                  </Stack>

                  <Button
                    component={Link}
                    href={card.href}
                    sx={{
                      ...navButtonSx,
                      mt: 2.2,
                      px: active ? 2.2 : 1.2,
                      py: 0.75,
                      minWidth: active ? 126 : 44,
                      textTransform: "none",
                      fontWeight: 600,
                      bgcolor: active ? "#ffffff" : `${card.accent}14`,
                      color: active ? "#0f3b66" : card.accent,
                      border: "1px solid",
                      borderColor: active ? "#dbe7f2" : `${card.accent}66`,
                      position: "relative",
                      zIndex: 1,
                      transition:
                        "transform .65s cubic-bezier(.22,.61,.36,1), background-color .65s cubic-bezier(.22,.61,.36,1), color .65s cubic-bezier(.22,.61,.36,1), border-color .65s cubic-bezier(.22,.61,.36,1)",
                      "&:hover": {
                        bgcolor: active ? "#f4f8ff" : "#f3f4f6",
                        transform: "translateY(-1px)",
                      },
                    }}
                  >
                    {active ? "자세히 보기 →" : "→"}
                  </Button>
                </Paper>
              );
            })}
          </Box>

          <Divider sx={{ my: 1, borderColor: "#e5e7eb" }} />

          <Stack direction={{ xs: "column", md: "row" }} justifyContent="center" spacing={1.2}>
            <Chip label={`최근 24시간 기사: ${stats.recent}`} variant="outlined" sx={{ ...statusChipSx, borderColor: "#d1d5db" }} />
            <Chip
              label={`현재 위험도: ${stats.riskText}`}
              variant="outlined"
              sx={{
                ...statusChipSx,
                bgcolor: riskStyle.bg,
                borderColor: riskStyle.border,
                color: riskStyle.color,
              }}
            />
            <Chip label={`데이터 상태: ${stats.modeText}`} variant="outlined" sx={{ ...statusChipSx, bgcolor: modeStyle.bg, borderColor: modeStyle.border, color: modeStyle.color }} />
          </Stack>
        </Stack>
      </Container>
    </Box>
  );
}
