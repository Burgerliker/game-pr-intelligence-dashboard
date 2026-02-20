"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { apiGet, getDiagnosticCode } from "../../lib/api";

function riskBand(score) {
  const n = Number(score || 0);
  if (n >= 70) return { label: "위기", color: "var(--rb-danger)", bg: "#fef2f2", border: "#fecaca" };
  if (n >= 45) return { label: "경고", color: "var(--rb-warning)", bg: "#fff7ed", border: "#fed7aa" };
  if (n >= 20) return { label: "주의", color: "var(--rb-caution)", bg: "#fef9c3", border: "#fde68a" };
  return { label: "정상", color: "var(--rb-good)", bg: "#ecfdf3", border: "#bbf7d0" };
}

export default function RebuildHomePage() {
  const [health, setHealth] = useState(null);
  const [risk, setRisk] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const [h, r] = await Promise.all([
          apiGet("/api/health").catch(() => null),
          apiGet("/api/risk-score?ip=maplestory").catch(() => null),
        ]);
        if (!active) return;
        setHealth(h);
        setRisk(r);
      } catch (e) {
        if (!active) return;
        setError(`홈 데이터를 불러오지 못했습니다. (${getDiagnosticCode(e, "RB-HOME")})`);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const riskScore = Number(risk?.risk_score || 0);
  const band = useMemo(() => riskBand(riskScore), [riskScore]);

  return (
    <main style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <section className="rb-card" style={{ padding: 22 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 800, letterSpacing: ".18em", textTransform: "uppercase", color: "#60708b" }}>
              PR Intelligence Rebuild
            </p>
            <h1 style={{ margin: "6px 0 0", fontSize: "clamp(28px,5vw,40px)", lineHeight: 1.1, letterSpacing: "-.02em" }}>
              홍보팀 의사결정 대시보드
            </h1>
            <p style={{ margin: "8px 0 0", fontSize: 14, color: "#5f6b7f" }}>1초 내 상황 판단, 보고용 캡처, 즉시 대응 가이드를 목표로 구성했습니다.</p>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <Link className="rb-btn rb-btn-primary" href="/rebuild/nexon">실시간 모니터링</Link>
            <Link className="rb-btn" href="/rebuild/compare">경쟁사 비교</Link>
            <Link className="rb-btn" href="/rebuild/nexon/backtest">과거 분석</Link>
            <Link className="rb-btn" href="/rebuild/project">프로젝트 소개</Link>
          </div>
        </div>
      </section>

      {error ? (
        <section className="rb-card" style={{ padding: 14, borderColor: "#fecaca", background: "#fff1f2", color: "#b91c1c", fontWeight: 700 }}>
          {error}
        </section>
      ) : null}

      <section className="rb-grid-4">
        <article className="rb-card" style={{ padding: 16 }}>
          <p style={{ margin: 0, fontSize: 12, fontWeight: 800, color: "#5f6b7f" }}>현재 상태</p>
          <span className="rb-chip" style={{ marginTop: 10, background: band.bg, borderColor: band.border, color: band.color }}>{band.label}</span>
          <p style={{ margin: "10px 0 0", fontSize: 40, fontWeight: 900, lineHeight: 1 }}>{riskScore.toFixed(1)}</p>
          <p style={{ margin: "6px 0 0", fontSize: 12, color: "#6b778c" }}>위기 지수</p>
        </article>

        <article className="rb-card" style={{ padding: 16 }}>
          <p style={{ margin: 0, fontSize: 12, fontWeight: 800, color: "#5f6b7f" }}>최근 24시간 보도량</p>
          <p style={{ margin: "12px 0 0", fontSize: 40, fontWeight: 900, lineHeight: 1 }}>{Number(health?.recent_articles_24h || 0)}</p>
          <p style={{ margin: "6px 0 0", fontSize: 12, color: "#6b778c" }}>실시간 집계 기준</p>
        </article>

        <article className="rb-card" style={{ padding: 16 }}>
          <p style={{ margin: 0, fontSize: 12, fontWeight: 800, color: "#5f6b7f" }}>수집 상태</p>
          <p style={{ margin: "12px 0 0", fontSize: 24, fontWeight: 900 }}>{health?.scheduler_running ? "정상" : "확인 필요"}</p>
          <p style={{ margin: "6px 0 0", fontSize: 12, color: "#6b778c" }}>스케줄러 {Number(health?.scheduler_job_count || 0)}개</p>
        </article>

        <article className="rb-card" style={{ padding: 16 }}>
          <p style={{ margin: 0, fontSize: 12, fontWeight: 800, color: "#5f6b7f" }}>데이터 모드</p>
          <p style={{ margin: "12px 0 0", fontSize: 24, fontWeight: 900 }}>{health?.mode || "-"}</p>
          <p style={{ margin: "6px 0 0", fontSize: 12, color: "#6b778c" }}>{loading ? "로딩 중" : "API 확인 완료"}</p>
        </article>
      </section>
    </main>
  );
}
