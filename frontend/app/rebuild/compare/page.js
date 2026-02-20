"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { apiGet, getDiagnosticCode } from "../../../lib/api";

const WINDOWS = [
  { v: 24, l: "24시간" },
  { v: 72, l: "3일" },
  { v: 168, l: "7일" },
];
const SENTIMENTS = ["전체", "긍정", "중립", "부정"];

const ratio = (v) => Number(v || 0);

export default function RebuildComparePage() {
  const [windowHours, setWindowHours] = useState(72);
  const [sentiment, setSentiment] = useState("전체");
  const [selectedCompany, setSelectedCompany] = useState("넥슨");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const q = new URLSearchParams({
          hours: String(windowHours),
          sentiment: sentiment === "전체" ? "all" : sentiment,
          companies: "넥슨,NC소프트,넷마블,크래프톤",
        });
        const payload = await apiGet(`/api/compare-live?${q.toString()}`);
        if (!active) return;
        setData(payload);
      } catch (e) {
        if (!active) return;
        setError(`비교 데이터를 불러오지 못했습니다. (${getDiagnosticCode(e, "RB-CMP")})`);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [windowHours, sentiment]);

  const summaryRows = data?.sentiment_summary || [];
  const articleRows = data?.latest_articles || [];

  const companies = useMemo(() => {
    const set = new Set(["넥슨"]);
    for (const r of summaryRows) if (r?.company) set.add(r.company);
    for (const r of articleRows) if (r?.company) set.add(r.company);
    return Array.from(set);
  }, [summaryRows, articleRows]);

  const matrix = useMemo(() => {
    const m = {};
    for (const c of companies) m[c] = { 긍정: 0, 중립: 0, 부정: 0 };
    for (const r of summaryRows) {
      if (!m[r.company]) m[r.company] = { 긍정: 0, 중립: 0, 부정: 0 };
      m[r.company][r.sentiment] = ratio(r.ratio);
    }
    return m;
  }, [companies, summaryRows]);

  const visibleArticles = useMemo(() => {
    return articleRows
      .filter((r) => (selectedCompany === "전체" ? true : r.company === selectedCompany))
      .filter((r) => (sentiment === "전체" ? true : r.sentiment === sentiment))
      .slice(0, 24);
  }, [articleRows, selectedCompany, sentiment]);

  return (
    <main style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <section className="rb-card" style={{ padding: 22 }}>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <div>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 800, letterSpacing: ".18em", textTransform: "uppercase", color: "#60708b" }}>Competition Monitor</p>
            <h1 style={{ margin: "6px 0 0", fontSize: "clamp(26px,4.2vw,36px)", lineHeight: 1.1 }}>경쟁사 비교</h1>
            <p style={{ margin: "8px 0 0", fontSize: 14, color: "#5f6b7f" }}>동일 기간에서 우리 위치를 빠르게 판단하는 비교 화면입니다.</p>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <Link className="rb-btn" href="/rebuild">메인</Link>
            <Link className="rb-btn" href="/rebuild/nexon">실시간 모니터링</Link>
          </div>
        </div>
      </section>

      <section className="rb-card" style={{ padding: 14 }}>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 800, color: "#60708b" }}>분석 기간</span>
          {WINDOWS.map((w) => (
            <button key={w.v} onClick={() => setWindowHours(w.v)} className="rb-btn" style={windowHours === w.v ? { background: "#0f172a", color: "#fff", borderColor: "#0f172a" } : undefined}>{w.l}</button>
          ))}
          <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 800, color: "#60708b" }}>기사 성향</span>
          {SENTIMENTS.map((s) => (
            <button key={s} onClick={() => setSentiment(s)} className="rb-btn" style={sentiment === s ? { background: "#0f172a", color: "#fff", borderColor: "#0f172a" } : undefined}>{s}</button>
          ))}
        </div>
      </section>

      {error ? <section className="rb-card" style={{ padding: 14, borderColor: "#fecaca", background: "#fff1f2", color: "#b91c1c", fontWeight: 700 }}>{error}</section> : null}

      <section className="rb-grid-4">
        {(companies.length ? companies : ["넥슨"]).map((c) => {
          const row = matrix[c] || { 긍정: 0, 중립: 0, 부정: 0 };
          const active = selectedCompany === c;
          const total = ratio(row.긍정) + ratio(row.중립) + ratio(row.부정);
          return (
            <button key={c} className="rb-card" style={{ padding: 14, textAlign: "left", borderColor: active ? "#10233f" : "#dbe3ef", background: active ? "#0f172a" : "#fff", color: active ? "#fff" : "#10233f" }} onClick={() => setSelectedCompany(c)}>
              <p style={{ margin: 0, fontSize: 12, fontWeight: 800, opacity: 0.75 }}>회사</p>
              <p style={{ margin: "4px 0 0", fontSize: 22, fontWeight: 900 }}>{c}</p>
              <p style={{ margin: "8px 0 0", fontSize: 30, fontWeight: 900, lineHeight: 1 }}>{Math.round(total)}%</p>
              <p style={{ margin: "4px 0 0", fontSize: 12, opacity: 0.8 }}>감성 비중 합계</p>
            </button>
          );
        })}
      </section>

      <section className="rb-grid-2">
        <article className="rb-card" style={{ padding: 16 }}>
          <h2 style={{ margin: 0, fontSize: 20 }}>여론 분포</h2>
          <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
            {["긍정", "중립", "부정"].map((k) => {
              const v = ratio(matrix[selectedCompany]?.[k]);
              const color = k === "긍정" ? "#13a86d" : k === "중립" ? "#e6a700" : "#d43838";
              return (
                <div key={k} style={{ display: "grid", gridTemplateColumns: "44px 1fr 54px", gap: 8, alignItems: "center" }}>
                  <span style={{ fontSize: 13, fontWeight: 800 }}>{k}</span>
                  <div style={{ height: 8, background: "#e8edf7", borderRadius: 999, overflow: "hidden" }}><div style={{ width: `${Math.max(0, Math.min(100, v))}%`, height: "100%", background: color }} /></div>
                  <span style={{ textAlign: "right", fontSize: 13, fontWeight: 900 }}>{v.toFixed(1)}%</span>
                </div>
              );
            })}
          </div>
        </article>

        <article className="rb-card" style={{ padding: 16 }}>
          <h2 style={{ margin: 0, fontSize: 20 }}>요약</h2>
          <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}><span style={{ color: "#60708b" }}>총 기사 수</span><strong>{Number(data?.meta?.total_articles || 0)}</strong></div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}><span style={{ color: "#60708b" }}>표시 회사</span><strong>{companies.length}</strong></div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}><span style={{ color: "#60708b" }}>표시 기사</span><strong>{visibleArticles.length}</strong></div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}><span style={{ color: "#60708b" }}>상태</span><strong>{loading ? "집계 중" : "정상"}</strong></div>
          </div>
        </article>
      </section>

      <section className="rb-card" style={{ padding: 16 }}>
        <h2 style={{ margin: 0, fontSize: 20 }}>최근 기사</h2>
        <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
          {visibleArticles.map((a, i) => (
            <article key={`${a.title || "t"}-${i}`} style={{ border: "1px solid #dbe3ef", borderRadius: 12, background: "#f7faff", padding: 10 }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                <span className="rb-chip">{a.company || "-"}</span>
                <span className="rb-chip">{a.sentiment || "중립"}</span>
                <span style={{ fontSize: 12, color: "#7b8798" }}>{a.published_at || a.pub_date || "-"}</span>
              </div>
              <p style={{ margin: "6px 0 0", fontSize: 14, fontWeight: 700 }}>{a.title || "제목 없음"}</p>
            </article>
          ))}
          {!visibleArticles.length ? <p style={{ margin: 0, fontSize: 13, color: "#60708b" }}>표시할 기사가 없습니다.</p> : null}
        </div>
      </section>
    </main>
  );
}
