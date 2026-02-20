"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { apiGet, getDiagnosticCode } from "../../../lib/api";

const WINDOW_OPTIONS = [
  { value: 24, label: "24시간" },
  { value: 72, label: "3일" },
  { value: 168, label: "7일" },
];

const SENTIMENT_OPTIONS = ["전체", "긍정", "중립", "부정"];

function bySentimentColor(sentiment) {
  if (sentiment === "긍정") return "text-emerald-700 bg-emerald-50 border-emerald-200";
  if (sentiment === "부정") return "text-red-700 bg-red-50 border-red-200";
  return "text-amber-700 bg-amber-50 border-amber-200";
}

function number(v) {
  return Number(v || 0);
}

export default function RebuildComparePage() {
  const [windowHours, setWindowHours] = useState(72);
  const [sentiment, setSentiment] = useState("전체");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);
  const [selectedCompany, setSelectedCompany] = useState("넥슨");

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const query = new URLSearchParams({
          hours: String(windowHours),
          sentiment: sentiment === "전체" ? "all" : sentiment,
          companies: "넥슨,NC소프트,넷마블,크래프톤",
        });
        const payload = await apiGet(`/api/compare-live?${query.toString()}`);
        if (!alive) return;
        setData(payload);
      } catch (e) {
        if (!alive) return;
        setError(`비교 데이터를 불러오지 못했습니다. (${getDiagnosticCode(e, "RB-CMP")})`);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [windowHours, sentiment]);

  const sentimentSummary = data?.sentiment_summary || [];
  const latestArticlesRaw = data?.latest_articles || [];
  const latestArticles = useMemo(() => {
    let rows = latestArticlesRaw;
    if (sentiment !== "전체") rows = rows.filter((r) => r.sentiment === sentiment);
    if (selectedCompany !== "전체") rows = rows.filter((r) => (r.company || "") === selectedCompany);
    return rows.slice(0, 40);
  }, [latestArticlesRaw, sentiment, selectedCompany]);

  const companies = useMemo(() => {
    const set = new Set(["넥슨"]);
    for (const r of sentimentSummary) if (r?.company) set.add(r.company);
    for (const r of latestArticlesRaw) if (r?.company) set.add(r.company);
    return Array.from(set);
  }, [sentimentSummary, latestArticlesRaw]);

  const companyStats = useMemo(() => {
    const map = new Map();
    for (const row of sentimentSummary) {
      const c = row.company || "기타";
      if (!map.has(c)) map.set(c, { company: c, 긍정: 0, 중립: 0, 부정: 0 });
      map.get(c)[row.sentiment] = number(row.ratio);
    }
    const list = Array.from(map.values());
    if (!list.length) return companies.map((c) => ({ company: c, 긍정: 0, 중립: 0, 부정: 0 }));
    return list;
  }, [sentimentSummary, companies]);

  const selectedStat = companyStats.find((r) => r.company === selectedCompany) || companyStats[0] || null;

  return (
    <main className="space-y-5">
      <header className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Competition Monitor</p>
            <h1 className="mt-1 text-3xl font-black tracking-tight">경쟁사 비교</h1>
            <p className="mt-2 text-sm text-slate-600">넥슨 기준으로 경쟁사 대비 보도량/여론 상태를 같은 조건에서 비교합니다.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/rebuild" className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700">메인</Link>
            <Link href="/rebuild/nexon" className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700">실시간 모니터링</Link>
          </div>
        </div>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-slate-500">분석 기간</span>
          {WINDOW_OPTIONS.map((o) => (
            <button key={o.value} onClick={() => setWindowHours(o.value)} className={`rounded-full border px-3 py-1.5 text-sm font-bold ${windowHours === o.value ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 bg-white text-slate-700"}`}>
              {o.label}
            </button>
          ))}
          <span className="ml-3 text-xs font-bold text-slate-500">여론</span>
          {SENTIMENT_OPTIONS.map((s) => (
            <button key={s} onClick={() => setSentiment(s)} className={`rounded-full border px-3 py-1.5 text-sm font-bold ${sentiment === s ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 bg-white text-slate-700"}`}>
              {s}
            </button>
          ))}
        </div>
      </section>

      {error ? <section className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</section> : null}

      <section className="grid grid-cols-1 gap-4 md:grid-cols-4">
        {(companyStats.length ? companyStats : [{ company: "넥슨", 긍정: 0, 중립: 0, 부정: 0 }]).map((row) => {
          const active = selectedCompany === row.company;
          return (
            <button key={row.company} onClick={() => setSelectedCompany(row.company)} className={`rounded-2xl border p-4 text-left shadow-sm transition ${active ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-900"}`}>
              <p className={`text-xs font-bold uppercase tracking-wider ${active ? "text-slate-300" : "text-slate-500"}`}>{row.company}</p>
              <p className="mt-2 text-2xl font-black tabular-nums">{Math.round(number(row.긍정) + number(row.중립) + number(row.부정))}%</p>
              <p className={`mt-1 text-xs ${active ? "text-slate-300" : "text-slate-500"}`}>감성 비중 합계</p>
            </button>
          );
        })}
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
          <h2 className="text-lg font-black">{selectedStat?.company || "-"} 여론 분포</h2>
          <div className="mt-4 space-y-3">
            {["긍정", "중립", "부정"].map((k) => {
              const value = Math.max(0, Math.min(100, number(selectedStat?.[k])));
              const barCls = k === "긍정" ? "bg-emerald-500" : k === "부정" ? "bg-red-500" : "bg-amber-500";
              return (
                <div key={k} className="flex items-center gap-3">
                  <span className="w-10 text-sm font-bold">{k}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                    <div className={`h-full ${barCls}`} style={{ width: `${value}%` }} />
                  </div>
                  <span className="w-12 text-right text-sm font-black tabular-nums">{value.toFixed(1)}%</span>
                </div>
              );
            })}
          </div>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-black">핵심 지표</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex items-center justify-between"><dt className="text-slate-500">총 기사 수</dt><dd className="font-black tabular-nums">{number(data?.meta?.total_articles || 0)}</dd></div>
            <div className="flex items-center justify-between"><dt className="text-slate-500">회사 수</dt><dd className="font-black tabular-nums">{companies.length}</dd></div>
            <div className="flex items-center justify-between"><dt className="text-slate-500">표시 기사</dt><dd className="font-black tabular-nums">{latestArticles.length}</dd></div>
            <div className="flex items-center justify-between"><dt className="text-slate-500">상태</dt><dd className="font-black">{loading ? "집계 중" : "완료"}</dd></div>
          </dl>
        </article>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-black">최근 기사</h2>
          <select value={selectedCompany} onChange={(e) => setSelectedCompany(e.target.value)} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold">
            <option value="전체">전체 회사</option>
            {companies.map((c) => (<option key={c} value={c}>{c}</option>))}
          </select>
        </div>

        <div className="space-y-2">
          {latestArticles.slice(0, 20).map((a, idx) => (
            <article key={`${a.title || "t"}-${idx}`} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full border px-2 py-0.5 text-xs font-bold ${bySentimentColor(a.sentiment || "중립")}`}>{a.sentiment || "중립"}</span>
                <span className="text-xs font-semibold text-slate-500">{a.company || "-"}</span>
                <span className="text-xs text-slate-400">{a.published_at || a.pub_date || "-"}</span>
              </div>
              <p className="mt-1 text-sm font-semibold text-slate-900">{a.title || "제목 없음"}</p>
            </article>
          ))}
          {!latestArticles.length ? <p className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">표시할 기사가 없습니다.</p> : null}
        </div>
      </section>
    </main>
  );
}
