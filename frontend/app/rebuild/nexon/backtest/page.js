"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { apiGet, getDiagnosticCode } from "../../../../lib/api";
import { normalizeBacktestPayload } from "../../../../lib/normalizeBacktest";

const FIXED_PARAMS = {
  ip: "maplestory",
  date_from: "2025-11-01",
  date_to: "2026-02-10",
  step_hours: "6",
};

const num = (v) => Number(v || 0);

function riskColor(v) {
  if (v >= 70) return "#b91c1c";
  if (v >= 45) return "#c2410c";
  if (v >= 20) return "#a16207";
  return "#166534";
}

export default function RebuildBacktestPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [payload, setPayload] = useState(null);
  const [health, setHealth] = useState(null);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const qs = new URLSearchParams(FIXED_PARAMS);
        const [bt, h] = await Promise.all([
          apiGet(`/api/backtest?${qs.toString()}`),
          apiGet("/api/backtest-health").catch(() => null),
        ]);
        if (!active) return;
        setPayload(bt);
        setHealth(h);
      } catch (e) {
        if (!active) return;
        setError(`과거 분석 데이터를 불러오지 못했습니다. (${getDiagnosticCode(e, "RB-BACK")})`);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const normalized = useMemo(() => normalizeBacktestPayload(payload), [payload]);
  const rows = payload?.timeseries || [];
  const events = payload?.events || [];
  const maxRisk = num(payload?.summary?.max_risk);
  const avgRisk = num(payload?.summary?.avg_risk);
  const maxVolume = Math.max(1, ...rows.map((r) => num(r.total_mentions ?? r.mention_count ?? r.article_count)));

  return (
    <main style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <section className="rb-card" style={{ padding: 22 }}>
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
          <div>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 800, letterSpacing: ".18em", textTransform: "uppercase", color: "#60708b" }}>Backtest Replay</p>
            <h1 style={{ margin: "6px 0 0", fontSize: "clamp(26px,4vw,36px)", lineHeight: 1.1 }}>메이플 키우기 이슈 과거 분석</h1>
            <p style={{ margin: "8px 0 0", fontSize: 14, color: "#5f6b7f" }}>실시간 탐지 로직과 같은 기준으로 과거 구간 반응을 재현합니다.</p>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <Link className="rb-btn" href="/rebuild/nexon">실시간 모니터링</Link>
            <Link className="rb-btn" href="/rebuild">메인</Link>
          </div>
        </div>
      </section>

      {error ? <section className="rb-card" style={{ padding: 14, borderColor: "#fecaca", background: "#fff1f2", color: "#b91c1c", fontWeight: 700 }}>{error}</section> : null}

      <section className="rb-grid-4">
        <article className="rb-card" style={{ padding: 14 }}><p style={{ margin: 0, fontSize: 12, fontWeight: 800, color: "#60708b" }}>최대 위험도</p><p style={{ margin: "8px 0 0", fontSize: 34, fontWeight: 900, color: riskColor(maxRisk) }}>{maxRisk.toFixed(1)}</p></article>
        <article className="rb-card" style={{ padding: 14 }}><p style={{ margin: 0, fontSize: 12, fontWeight: 800, color: "#60708b" }}>평균 위험도</p><p style={{ margin: "8px 0 0", fontSize: 34, fontWeight: 900 }}>{avgRisk.toFixed(1)}</p></article>
        <article className="rb-card" style={{ padding: 14 }}><p style={{ margin: 0, fontSize: 12, fontWeight: 800, color: "#60708b" }}>이벤트 수</p><p style={{ margin: "8px 0 0", fontSize: 34, fontWeight: 900 }}>{events.length}</p></article>
        <article className="rb-card" style={{ padding: 14 }}><p style={{ margin: 0, fontSize: 12, fontWeight: 800, color: "#60708b" }}>포인트 수</p><p style={{ margin: "8px 0 0", fontSize: 34, fontWeight: 900 }}>{normalized.timestamps.length}</p></article>
      </section>

      <section className="rb-card" style={{ padding: 16 }}>
        <h2 style={{ margin: 0, fontSize: 20 }}>타임라인</h2>
        <p style={{ margin: "6px 0 0", fontSize: 13, color: "#60708b" }}>위험도(선) + 노출량(막대) 요약입니다. 최근 48포인트만 표시합니다.</p>
        <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 7 }}>
          {rows.slice(-48).map((r, idx) => {
            const risk = num(r.risk_score);
            const volume = num(r.total_mentions ?? r.mention_count ?? r.article_count);
            return (
              <div key={`${r.ts || idx}-${idx}`} style={{ display: "grid", gridTemplateColumns: "90px 1fr 64px 58px", gap: 8, alignItems: "center" }}>
                <span style={{ fontSize: 12, color: "#75849a" }}>{String(r.ts || "").slice(5, 16)}</span>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                  <div style={{ height: 8, background: "#e5ecf6", borderRadius: 999, overflow: "hidden" }}><div style={{ width: `${Math.max(0, Math.min(100, risk))}%`, height: "100%", background: riskColor(risk) }} /></div>
                  <div style={{ height: 8, background: "#e5ecf6", borderRadius: 999, overflow: "hidden" }}><div style={{ width: `${(volume / maxVolume) * 100}%`, height: "100%", background: "#0f3b66" }} /></div>
                </div>
                <span style={{ textAlign: "right", fontSize: 12, fontWeight: 800 }}>R {risk.toFixed(1)}</span>
                <span style={{ textAlign: "right", fontSize: 12, color: "#60708b", fontWeight: 700 }}>H {volume}</span>
              </div>
            );
          })}
          {!rows.length ? <p style={{ margin: 0, fontSize: 13, color: "#60708b" }}>시계열 데이터가 없습니다.</p> : null}
        </div>
      </section>

      <section className="rb-grid-2">
        <article className="rb-card" style={{ padding: 16 }}>
          <h2 style={{ margin: 0, fontSize: 20 }}>주요 이벤트</h2>
          <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
            {events.slice(0, 20).map((e, idx) => (
              <article key={`${e.ts || idx}-${idx}`} style={{ border: "1px solid #dbe3ef", borderRadius: 12, background: "#f7faff", padding: 10 }}>
                <p style={{ margin: 0, fontSize: 12, color: "#75849a" }}>{e.ts || "-"}</p>
                <p style={{ margin: "4px 0 0", fontSize: 14, fontWeight: 800 }}>{e.type || "event"}</p>
                <p style={{ margin: "4px 0 0", fontSize: 12, color: "#5f6b7f" }}>위험도 {num(e.risk_score).toFixed(1)}</p>
              </article>
            ))}
            {!events.length ? <p style={{ margin: 0, fontSize: 13, color: "#60708b" }}>이벤트 없음</p> : null}
          </div>
        </article>

        <article className="rb-card" style={{ padding: 16 }}>
          <h2 style={{ margin: 0, fontSize: 20 }}>분석 환경</h2>
          <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}><span style={{ color: "#60708b" }}>mode</span><strong>{health?.mode || "-"}</strong></div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}><span style={{ color: "#60708b" }}>db</span><strong>{health?.db_file_name || "-"}</strong></div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}><span style={{ color: "#60708b" }}>path</span><strong style={{ maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{health?.db_path || "-"}</strong></div>
            <div style={{ fontSize: 12, color: "#60708b" }}>{loading ? "불러오는 중..." : "검증 완료"}</div>
          </div>
        </article>
      </section>
    </main>
  );
}
