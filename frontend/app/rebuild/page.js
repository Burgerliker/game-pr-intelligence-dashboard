"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { apiGet, getDiagnosticCode } from "../../lib/api";

function toneByRisk(score) {
  const n = Number(score || 0);
  if (n >= 70) return { label: "위기", cls: "bg-red-50 text-red-700 border-red-200" };
  if (n >= 45) return { label: "경고", cls: "bg-orange-50 text-orange-700 border-orange-200" };
  if (n >= 20) return { label: "주의", cls: "bg-amber-50 text-amber-700 border-amber-200" };
  return { label: "정상", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" };
}

export default function RebuildHomePage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [health, setHealth] = useState(null);
  const [risk, setRisk] = useState(null);
  const [updatedAt, setUpdatedAt] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const [h, r] = await Promise.all([
          apiGet("/api/health").catch(() => null),
          apiGet("/api/risk-score?ip=maplestory").catch(() => null),
        ]);
        if (!alive) return;
        setHealth(h);
        setRisk(r);
        setUpdatedAt(new Date().toLocaleString("ko-KR", { hour12: false }));
      } catch (e) {
        if (!alive) return;
        setError(`홈 데이터를 불러오지 못했습니다. (${getDiagnosticCode(e, "RB-HOME")})`);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const riskScore = Number(risk?.risk_score || 0);
  const tone = useMemo(() => toneByRisk(riskScore), [riskScore]);
  const recent = Number(health?.recent_articles_24h || 0);

  return (
    <main className="space-y-5">
      <header className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-7">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">PR Intelligence Rebuild</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight md:text-4xl">홍보팀 의사결정 대시보드</h1>
            <p className="mt-2 text-sm text-slate-600">지금 상태를 1초 안에 파악하고, 바로 대응 방향을 정하는 화면입니다.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/rebuild/nexon" className="rounded-full bg-slate-900 px-4 py-2 text-sm font-bold text-white">실시간 모니터링</Link>
            <Link href="/rebuild/compare" className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700">경쟁사 비교</Link>
            <Link href="/rebuild/nexon/backtest" className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700">과거 분석</Link>
            <Link href="/rebuild/project" className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700">프로젝트 소개</Link>
          </div>
        </div>
      </header>

      {error ? <section className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</section> : null}

      <section className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">현재 상태</p>
          <p className={`mt-3 inline-flex rounded-full border px-3 py-1 text-sm font-bold ${tone.cls}`}>{tone.label}</p>
          <p className="mt-3 text-4xl font-black tabular-nums">{riskScore.toFixed(1)}</p>
          <p className="mt-1 text-xs text-slate-500">위기 지수</p>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">최근 24시간 보도량</p>
          <p className="mt-3 text-4xl font-black tabular-nums">{recent}</p>
          <p className="mt-1 text-xs text-slate-500">기사/노출 반영</p>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">스케줄러</p>
          <p className="mt-3 text-2xl font-black">{health?.scheduler_running ? "정상 동작" : "확인 필요"}</p>
          <p className="mt-1 text-xs text-slate-500">job {Number(health?.scheduler_job_count || 0)}개</p>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">마지막 갱신</p>
          <p className="mt-3 text-lg font-black">{updatedAt || "-"}</p>
          <p className="mt-1 text-xs text-slate-500">{loading ? "로딩 중" : "실시간 반영"}</p>
        </article>
      </section>
    </main>
  );
}
