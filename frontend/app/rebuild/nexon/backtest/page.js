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

export default function RebuildBacktestPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [payload, setPayload] = useState(null);
  const [health, setHealth] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const qs = new URLSearchParams(FIXED_PARAMS);
        const [bt, h] = await Promise.all([
          apiGet(`/api/backtest?${qs.toString()}`),
          apiGet("/api/backtest-health").catch(() => null),
        ]);
        if (!alive) return;
        setPayload(bt);
        setHealth(h);
      } catch (e) {
        if (!alive) return;
        setError(`과거 분석 데이터를 불러오지 못했습니다. (${getDiagnosticCode(e, "RB-BACK")})`);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const normalized = useMemo(() => normalizeBacktestPayload(payload), [payload]);
  const rows = payload?.timeseries || [];
  const events = payload?.events || [];
  const maxRisk = Number(payload?.summary?.max_risk || 0);
  const avgRisk = Number(payload?.summary?.avg_risk || 0);
  const p1 = Number(payload?.summary?.p1_buckets || 0);
  const p2 = Number(payload?.summary?.p2_buckets || 0);

  return (
    <main className="space-y-5">
      <header className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Backtest Replay</p>
            <h1 className="mt-1 text-3xl font-black tracking-tight">메이플 키우기 이슈 과거 분석</h1>
            <p className="mt-2 text-sm text-slate-600">실시간 탐지 로직과 동일한 기준으로 과거 구간 반응을 재생해, 대응 타이밍을 검증합니다.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/rebuild/nexon" className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700">넥슨 모니터</Link>
            <Link href="/rebuild" className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700">메인</Link>
          </div>
        </div>
      </header>

      {error ? <section className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</section> : null}

      <section className="grid grid-cols-2 gap-3 md:grid-cols-6">
        <article className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm md:col-span-2"><p className="text-xs font-bold text-slate-500">시나리오</p><p className="mt-1 text-sm font-black">메이플 키우기 확률형 이슈</p></article>
        <article className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm"><p className="text-xs font-bold text-slate-500">최대 위험도</p><p className="mt-1 text-2xl font-black tabular-nums text-red-600">{maxRisk.toFixed(1)}</p></article>
        <article className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm"><p className="text-xs font-bold text-slate-500">평균 위험도</p><p className="mt-1 text-2xl font-black tabular-nums">{avgRisk.toFixed(1)}</p></article>
        <article className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm"><p className="text-xs font-bold text-slate-500">고위험 구간</p><p className="mt-1 text-2xl font-black tabular-nums">{p1}</p></article>
        <article className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm"><p className="text-xs font-bold text-slate-500">주의 구간</p><p className="mt-1 text-2xl font-black tabular-nums">{p2}</p></article>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-2">
          <h2 className="text-lg font-black">타임라인 (최근 36포인트)</h2>
          <p className="mt-1 text-xs text-slate-500">상단은 위험도, 하단은 노출량입니다.</p>
          <div className="mt-4 space-y-2">
            {rows.slice(-36).map((r, idx) => {
              const risk = Number(r.risk_score || 0);
              const vol = Number(r.total_mentions ?? r.mention_count ?? r.article_count ?? 0);
              return (
                <div key={`${r.ts || idx}-${idx}`} className="grid grid-cols-[92px_1fr_70px_70px] items-center gap-2">
                  <span className="text-xs text-slate-500">{String(r.ts || "").slice(5, 16)}</span>
                  <div className="h-2 rounded-full bg-slate-100">
                    <div className={`h-full rounded-full ${risk >= 70 ? "bg-red-500" : risk >= 45 ? "bg-orange-500" : risk >= 20 ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${Math.max(0, Math.min(100, risk))}%` }} />
                  </div>
                  <span className="text-right text-xs font-black tabular-nums">R {risk.toFixed(1)}</span>
                  <span className="text-right text-xs font-semibold tabular-nums text-slate-500">H {vol}</span>
                </div>
              );
            })}
            {!rows.length ? <p className="text-sm text-slate-500">시계열 데이터가 없습니다.</p> : null}
          </div>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-black">분석 환경</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex items-center justify-between"><dt className="text-slate-500">모드</dt><dd className="font-black">{health?.mode || "-"}</dd></div>
            <div className="flex items-center justify-between"><dt className="text-slate-500">DB 파일</dt><dd className="max-w-[210px] truncate text-right font-black" title={health?.db_file_name || health?.db_path || "-"}>{health?.db_file_name || health?.db_path || "-"}</dd></div>
            <div className="flex items-center justify-between"><dt className="text-slate-500">데이터 포인트</dt><dd className="font-black tabular-nums">{normalized.timestamps.length}</dd></div>
            <div className="flex items-center justify-between"><dt className="text-slate-500">이벤트 수</dt><dd className="font-black tabular-nums">{events.length}</dd></div>
          </dl>
        </article>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-black">주요 이벤트</h2>
        <div className="mt-3 space-y-2">
          {events.slice(0, 20).map((e, idx) => (
            <article key={`${e.ts || idx}-${idx}`} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs text-slate-500">{e.ts || "-"}</p>
              <p className="text-sm font-bold">{e.type || "event"}</p>
              <p className="text-xs text-slate-500">위험도 {Number(e.risk_score || 0).toFixed(1)}</p>
            </article>
          ))}
          {!events.length ? <p className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">이벤트가 없습니다.</p> : null}
        </div>
        {loading ? <p className="mt-3 text-xs text-slate-500">데이터 로딩 중...</p> : null}
      </section>
    </main>
  );
}
