"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { apiGet, getDiagnosticCode } from "../lib/api";
import ApiGuardBanner from "../components/ApiGuardBanner";
import PageStatusView from "../components/PageStatusView";
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

/* ── 전환 상수 ────────────────────────────────────────── */
const CARD_TRANSITION =
  "transform .75s cubic-bezier(.22,.61,.36,1), box-shadow .75s cubic-bezier(.22,.61,.36,1), border-color .75s cubic-bezier(.22,.61,.36,1), background-color .75s cubic-bezier(.22,.61,.36,1), color .75s cubic-bezier(.22,.61,.36,1)";
const OVERLAY_TRANSITION =
  "opacity .9s cubic-bezier(.2,.65,.2,1), transform .9s cubic-bezier(.2,.65,.2,1)";
const BTN_TRANSITION =
  "transform .65s cubic-bezier(.22,.61,.36,1), background-color .65s cubic-bezier(.22,.61,.36,1), color .65s cubic-bezier(.22,.61,.36,1), border-color .65s cubic-bezier(.22,.61,.36,1), min-width .65s cubic-bezier(.22,.61,.36,1), padding .65s cubic-bezier(.22,.61,.36,1)";

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
    <div
      style={{
        minHeight: "100dvh",
        backgroundColor: "#f1f5f9",
        padding: "16px 12px 48px",
        fontFamily: "'Plus Jakarta Sans','Noto Sans KR',sans-serif",
      }}
    >
      <div style={{ maxWidth: 1180, margin: "0 auto", display: "flex", flexDirection: "column", gap: 28 }}>

        {/* ── 상단 내비게이션 바 ── */}
        <div
          style={{
            backgroundColor: "#f8fafc",
            borderRadius: 12,
            border: "1px solid rgba(15,23,42,.12)",
            boxShadow: "0 8px 24px rgba(15,23,42,.04)",
            padding: "0 20px",
            height: 52,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div
              style={{
                width: 22,
                height: 22,
                borderRadius: 5,
                background: "linear-gradient(140deg, #0f3b66 0 58%, #9acb19 58% 100%)",
                boxShadow: "inset 0 0 0 1px rgba(255,255,255,.25)",
              }}
            />
            <span style={{ fontSize: 20, fontWeight: 800, color: "#0f172a", letterSpacing: "-.01em" }}>
              PR Portfolio
            </span>
          </div>
          <Link
            href="/project"
            style={{
              display: "inline-flex",
              alignItems: "center",
              padding: "6px 16px",
              borderRadius: 8,
              backgroundColor: "#111827",
              color: "#ffffff",
              fontSize: 14,
              fontWeight: 700,
              textDecoration: "none",
              letterSpacing: "-.01em",
            }}
          >
            프로젝트 소개
          </Link>
        </div>

        {/* ── 히어로 섹션 ── */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, textAlign: "center", paddingTop: 8 }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              borderRadius: 999,
              padding: "5px 14px",
              fontSize: 13,
              fontWeight: 700,
              backgroundColor: "#eef2ff",
              border: "1px solid #c7d2fe",
              color: "#1e3a8a",
              letterSpacing: ".02em",
            }}
          >
            실시간 모니터링
          </span>

          <h1
            style={{
              margin: 0,
              fontSize: "clamp(36px, 7vw, 52px)",
              fontWeight: 800,
              lineHeight: 1.08,
              color: "#111827",
              letterSpacing: "-.02em",
            }}
          >
            PR 실시간 이슈 현황판
          </h1>

          <p style={{ margin: 0, fontSize: "clamp(17px, 2.5vw, 22px)", color: "#6b7280", letterSpacing: "-.01em" }}>
            리스크 분석 포트폴리오
          </p>

          {/* 상태 칩 */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", marginTop: 8 }}>
            {[
              { label: `최근 갱신 ${formatTime(lastUpdated)}`, style: { backgroundColor: "#ffffff", borderColor: "#d1d5db", color: "#374151" } },
              { label: connStyle.text, style: { backgroundColor: connStyle.bg, borderColor: connStyle.border, color: connStyle.color } },
              { label: modeStyle.text, style: { backgroundColor: modeStyle.bg, borderColor: modeStyle.border, color: modeStyle.color } },
            ].map((chip) => (
              <span
                key={chip.label}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  borderRadius: 999,
                  border: "1px solid",
                  padding: "5px 14px",
                  fontSize: 13,
                  fontWeight: 700,
                  minHeight: 30,
                  ...chip.style,
                }}
              >
                {chip.label}
              </span>
            ))}
          </div>

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
        </div>

        {/* ── 기능 카드 그리드 ── */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
            gap: 24,
            maxWidth: 900,
            margin: "0 auto",
            width: "100%",
          }}
        >
          {cards.map((card) => {
            const active = hoveredCard === card.key;
            return (
              <div
                key={card.key}
                onMouseEnter={() => setHoveredCard(card.key)}
                onMouseLeave={() => setHoveredCard(null)}
                style={{
                  position: "relative",
                  overflow: "hidden",
                  borderRadius: 16,
                  padding: 24,
                  minHeight: 285,
                  textAlign: "left",
                  border: `1px solid ${active ? card.hoverBorder : "#e5e7eb"}`,
                  backgroundColor: active ? card.hoverBg : "#ffffff",
                  color: active ? card.hoverText : "#111827",
                  boxShadow: active
                    ? "0 16px 30px rgba(15,23,42,.12)"
                    : "0 8px 18px rgba(15,23,42,.04)",
                  transform: active ? "translateY(-6px)" : "translateY(0)",
                  transition: CARD_TRANSITION,
                  cursor: "default",
                }}
              >
                {/* 그라디언트 오버레이 */}
                <div
                  aria-hidden="true"
                  style={{
                    position: "absolute",
                    inset: 0,
                    background: card.hoverOverlay,
                    opacity: active ? 1 : 0,
                    transform: active ? "translateX(0)" : "translateX(-8%)",
                    transition: OVERLAY_TRANSITION,
                    pointerEvents: "none",
                  }}
                />

                {/* 아이콘 원 */}
                <div
                  style={{
                    width: 50,
                    height: 50,
                    borderRadius: "50%",
                    backgroundColor: active ? "rgba(255,255,255,.9)" : `${card.accent}1A`,
                    color: active ? "#0f172a" : card.accent,
                    fontWeight: 900,
                    fontSize: 22,
                    display: "grid",
                    placeItems: "center",
                    position: "relative",
                    zIndex: 1,
                    transform: active ? "scale(1.03)" : "scale(1)",
                    transition: "transform .75s cubic-bezier(.22,.61,.36,1), background-color .75s cubic-bezier(.22,.61,.36,1), color .75s cubic-bezier(.22,.61,.36,1)",
                  }}
                >
                  →
                </div>

                {/* 카드 제목 */}
                <h2
                  style={{
                    margin: "16px 0 0",
                    fontSize: "clamp(30px, 5vw, 38px)",
                    fontWeight: 800,
                    lineHeight: 1.12,
                    letterSpacing: "-.015em",
                    wordBreak: "keep-all",
                    position: "relative",
                    zIndex: 1,
                  }}
                >
                  {card.title}
                </h2>

                {/* 포인트 목록 */}
                <div style={{ marginTop: 12, position: "relative", zIndex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                  {card.points.map((point) => (
                    <p
                      key={point}
                      style={{
                        margin: 0,
                        fontSize: 17,
                        color: active ? card.hoverBody : "#6b7280",
                        letterSpacing: "-.01em",
                      }}
                    >
                      · {point}
                    </p>
                  ))}
                </div>

                {/* CTA 버튼 */}
                <Link
                  href={card.href}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginTop: 18,
                    padding: active ? "6px 18px" : "6px 10px",
                    minWidth: active ? 126 : 44,
                    minHeight: 40,
                    borderRadius: 999,
                    border: "1px solid",
                    borderColor: active ? "#dbe7f2" : `${card.accent}66`,
                    backgroundColor: active ? "#ffffff" : `${card.accent}14`,
                    color: active ? "#0f3b66" : card.accent,
                    fontSize: 14,
                    fontWeight: 600,
                    textDecoration: "none",
                    position: "relative",
                    zIndex: 1,
                    transition: BTN_TRANSITION,
                    letterSpacing: "-.01em",
                  }}
                >
                  {active ? "자세히 보기 →" : "→"}
                </Link>
              </div>
            );
          })}
        </div>

        {/* ── 구분선 ── */}
        <hr style={{ border: "none", borderTop: "1px solid #e5e7eb", margin: "4px 0" }} />

        {/* ── 하단 상태 칩 ── */}
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 10 }}>
          {[
            { label: `최근 24시간 기사: ${stats.recent}`, style: { borderColor: "#d1d5db", backgroundColor: "#ffffff", color: "#374151" } },
            { label: `현재 위험도: ${stats.riskText}`, style: { backgroundColor: riskStyle.bg, borderColor: riskStyle.border, color: riskStyle.color } },
            { label: `데이터 상태: ${stats.modeText}`, style: { backgroundColor: modeStyle.bg, borderColor: modeStyle.border, color: modeStyle.color } },
          ].map((chip) => (
            <span
              key={chip.label}
              style={{
                display: "inline-flex",
                alignItems: "center",
                borderRadius: 999,
                border: "1px solid",
                padding: "5px 14px",
                fontSize: 13,
                fontWeight: 700,
                minHeight: 30,
                ...chip.style,
              }}
            >
              {chip.label}
            </span>
          ))}
        </div>

      </div>
    </div>
  );
}
