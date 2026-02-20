"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { apiGet, getDiagnosticCode } from "../../../lib/api";
import { BlockTitle, RebuildNav, StatusPill } from "../_components/ui";

const WINDOWS = [
  { value: 24, label: "24시간" },
  { value: 72, label: "3일" },
  { value: 168, label: "7일" },
];
const SENTIMENTS = ["전체", "긍정", "중립", "부정"];
const num = (v) => Number(v || 0);

export default function RebuildComparePage() {
  const [windowHours, setWindowHours] = useState(72);
  const [sentiment, setSentiment] = useState("전체");
  const [selectedCompany, setSelectedCompany] = useState("넥슨");
  const [reloadToken, setReloadToken] = useState(0);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const qs = new URLSearchParams({
          hours: String(windowHours),
          sentiment: sentiment === "전체" ? "all" : sentiment,
          companies: "넥슨,NC소프트,넷마블,크래프톤",
        });
        const payload = await apiGet(`/api/compare-live?${qs.toString()}`);
        if (!active) return;
        setData(payload);
      } catch (e) {
        if (!active) return;
        setError(`비교 데이터 조회 실패 (${getDiagnosticCode(e, "RB-CMP")})`);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [windowHours, sentiment, reloadToken]);

  const summaryRows = data?.sentiment_summary || [];
  const articleRows = data?.latest_articles || [];

  const companies = useMemo(() => {
    const set = new Set(["넥슨"]);
    for (const r of summaryRows) if (r?.company) set.add(r.company);
    for (const r of articleRows) if (r?.company) set.add(r.company);
    return Array.from(set);
  }, [summaryRows, articleRows]);

  const matrix = useMemo(() => {
    const out = {};
    for (const c of companies) out[c] = { 긍정: 0, 중립: 0, 부정: 0 };
    for (const row of summaryRows) {
      if (!out[row.company]) out[row.company] = { 긍정: 0, 중립: 0, 부정: 0 };
      out[row.company][row.sentiment] = num(row.ratio);
    }
    return out;
  }, [companies, summaryRows]);

  const visibleArticles = useMemo(() => {
    return articleRows
      .filter((r) => (selectedCompany === "전체" ? true : r.company === selectedCompany))
      .filter((r) => (sentiment === "전체" ? true : r.sentiment === sentiment))
      .slice(0, 20);
  }, [articleRows, selectedCompany, sentiment]);

  return (
    <main className="space-y-4">
      <RebuildNav
        title="경쟁사 비교"
        subtitle="동일 기간에서 넥슨의 여론 위치와 기사량 맥락을 빠르게 판단합니다."
        actions={[
          { label: "메인", href: "/rebuild" },
          { label: "실시간 모니터링", href: "/rebuild/nexon" },
          { label: loading ? "집계 중" : "새로고침", onClick: () => setReloadToken((v) => v + 1) },
        ]}
      />

      <section className="rb-card p-4 md:p-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-black text-slate-500">분석 기간</span>
          {WINDOWS.map((w) => (
            <button key={w.value} type="button" className="rb-btn" style={windowHours === w.value ? { background: "#0f172a", borderColor: "#0f172a", color: "#fff" } : undefined} onClick={() => setWindowHours(w.value)}>
              {w.label}
            </button>
          ))}
          <span className="ml-2 text-xs font-black text-slate-500">기사 성향</span>
          {SENTIMENTS.map((s) => (
            <button key={s} type="button" className="rb-btn" style={sentiment === s ? { background: "#0f172a", borderColor: "#0f172a", color: "#fff" } : undefined} onClick={() => setSentiment(s)}>
              {s}
            </button>
          ))}
        </div>
      </section>

      {error ? <section className="rb-card border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">{error}</section> : null}

      <section className="rb-grid-4">
        {(companies.length ? companies : ["넥슨"]).map((c) => {
          const active = selectedCompany === c;
          const sum = num(matrix[c]?.긍정) + num(matrix[c]?.중립) + num(matrix[c]?.부정);
          return (
            <button
              key={c}
              type="button"
              className="rb-card p-4 text-left"
              style={active ? { background: "#0f172a", color: "#fff", borderColor: "#0f172a" } : undefined}
              onClick={() => setSelectedCompany(c)}
            >
              <p className="text-xs font-black opacity-80">회사</p>
              <p className="mt-1 text-xl font-black">{c}</p>
              <p className="mt-2 text-3xl font-black leading-none tabular-nums">{Math.round(sum)}%</p>
              <p className="mt-1 text-xs opacity-80">감성 비중 합계</p>
            </button>
          );
        })}
      </section>

      <section className="rb-grid-2">
        <article className="rb-card p-4 md:p-5">
          <BlockTitle title="여론 분포" sub={`${selectedCompany} 기준`} />
          <div className="space-y-3">
            {["긍정", "중립", "부정"].map((k) => {
              const value = num(matrix[selectedCompany]?.[k]);
              const bar = k === "긍정" ? "#13a86d" : k === "중립" ? "#e6a700" : "#d43838";
              return (
                <div key={k} className="grid grid-cols-[48px_1fr_56px] items-center gap-2">
                  <span className="text-sm font-black">{k}</span>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full" style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: bar }} />
                  </div>
                  <span className="text-right text-sm font-black tabular-nums">{value.toFixed(1)}%</span>
                </div>
              );
            })}
          </div>
        </article>

        <article className="rb-card p-4 md:p-5">
          <BlockTitle title="요약" sub="집계 상태" />
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between"><span className="text-slate-500">총 기사 수</span><strong>{num(data?.meta?.total_articles)}</strong></div>
            <div className="flex items-center justify-between"><span className="text-slate-500">표시 회사</span><strong>{companies.length}</strong></div>
            <div className="flex items-center justify-between"><span className="text-slate-500">표시 기사</span><strong>{visibleArticles.length}</strong></div>
            <div className="flex items-center justify-between"><span className="text-slate-500">상태</span><StatusPill label={loading ? "집계 중" : "정상"} tone={loading ? "caution" : "normal"} /></div>
          </div>
        </article>
      </section>

      <section className="rb-card p-4 md:p-5">
        <BlockTitle title="최근 기사" sub="최대 20건" />
        <div className="space-y-2">
          {visibleArticles.map((a, idx) => (
            <article key={`${a.title || "t"}-${idx}`} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <span className="rb-chip">{a.company || "-"}</span>
                <span className="rb-chip">{a.sentiment || "중립"}</span>
                <span>{a.published_at || a.pub_date || "-"}</span>
              </div>
              <p className="mt-1 text-sm font-bold text-slate-900">{a.title || "제목 없음"}</p>
            </article>
          ))}
          {!visibleArticles.length ? <p className="text-sm text-slate-500">표시할 기사가 없습니다.</p> : null}
        </div>
      </section>
    </main>
  );
}
