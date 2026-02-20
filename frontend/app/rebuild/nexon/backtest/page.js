"use client";

import { useEffect, useMemo, useState } from "react";
import { apiGet, getDiagnosticCode } from "../../../../lib/api";
import { normalizeBacktestPayload } from "../../../../lib/normalizeBacktest";
import { BlockTitle, MetricCard, RebuildNav } from "../../_components/ui";

const FIXED = {
  ip: "maplestory",
  date_from: "2025-11-01",
  date_to: "2026-02-10",
  step_hours: "6",
};

const num = (v) => Number(v || 0);

function riskTone(v) {
  if (v >= 70) return "#b91c1c";
  if (v >= 45) return "#c2410c";
  if (v >= 20) return "#a16207";
  return "#166534";
}

export default function RebuildBacktestPage() {
  const [payload, setPayload] = useState(null);
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const qs = new URLSearchParams(FIXED);
        const [bt, h] = await Promise.all([
          apiGet(`/api/backtest?${qs.toString()}`),
          apiGet("/api/backtest-health").catch(() => null),
        ]);
        if (!active) return;
        setPayload(bt);
        setHealth(h);
      } catch (e) {
        if (!active) return;
        setError(`과거 분석 조회 실패 (${getDiagnosticCode(e, "RB-BACK")})`);
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
  const maxHeat = Math.max(1, ...rows.map((r) => num(r.total_mentions ?? r.mention_count ?? r.article_count)));

  return (
    <main className="space-y-4">
      <RebuildNav
        title="메이플 키우기 이슈 과거 분석"
        subtitle="실시간 탐지 로직과 같은 기준으로 과거 반응을 재생해, 대응 타이밍을 검증합니다."
        actions={[
          { label: "실시간 모니터링", href: "/rebuild/nexon" },
          { label: "메인", href: "/rebuild" },
        ]}
      />

      {error ? <section className="rb-card border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">{error}</section> : null}

      <section className="rb-grid-4">
        <MetricCard label="최대 위험도" value={maxRisk.toFixed(1)} sub="P1 임계 확인" />
        <MetricCard label="평균 위험도" value={avgRisk.toFixed(1)} sub="구간 평균" />
        <MetricCard label="이벤트 수" value={events.length} sub="진입/해제 포함" />
        <MetricCard label="포인트 수" value={normalized.timestamps.length} sub={loading ? "로딩 중" : "집계 완료"} />
      </section>

      <section className="rb-card p-4 md:p-5">
        <BlockTitle title="위험도 + 노출량 타임라인" sub="최근 48 포인트" />
        <div className="space-y-2">
          {rows.slice(-48).map((r, idx) => {
            const risk = num(r.risk_score);
            const heat = num(r.total_mentions ?? r.mention_count ?? r.article_count);
            return (
              <div key={`${r.ts || idx}-${idx}`} className="grid grid-cols-[90px_1fr_64px_58px] items-center gap-2">
                <span className="text-xs text-slate-500">{String(r.ts || "").slice(5, 16)}</span>
                <div className="grid grid-cols-2 gap-2">
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full" style={{ width: `${Math.max(0, Math.min(100, risk))}%`, background: riskTone(risk) }} /></div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-slate-900" style={{ width: `${(heat / maxHeat) * 100}%` }} /></div>
                </div>
                <span className="text-right text-xs font-black tabular-nums">R {risk.toFixed(1)}</span>
                <span className="text-right text-xs font-semibold tabular-nums text-slate-500">H {heat}</span>
              </div>
            );
          })}
          {!rows.length ? <p className="text-sm text-slate-500">시계열 데이터가 없습니다.</p> : null}
        </div>
      </section>

      <section className="rb-grid-2">
        <article className="rb-card p-4 md:p-5">
          <BlockTitle title="주요 이벤트" sub="최대 20건" />
          <div className="space-y-2">
            {events.slice(0, 20).map((e, idx) => (
              <article key={`${e.ts || idx}-${idx}`} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs text-slate-500">{e.ts || "-"}</p>
                <p className="text-sm font-black">{e.type || "event"}</p>
                <p className="text-xs text-slate-500">위험도 {num(e.risk_score).toFixed(1)}</p>
              </article>
            ))}
            {!events.length ? <p className="text-sm text-slate-500">이벤트가 없습니다.</p> : null}
          </div>
        </article>

        <article className="rb-card p-4 md:p-5">
          <BlockTitle title="분석 환경" sub="백테스트 연결 상태" />
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between"><span className="text-slate-500">mode</span><strong>{health?.mode || "-"}</strong></div>
            <div className="flex items-center justify-between"><span className="text-slate-500">db</span><strong>{health?.db_file_name || "-"}</strong></div>
            <div className="flex items-center justify-between"><span className="text-slate-500">path</span><strong className="max-w-[180px] truncate" title={health?.db_path || "-"}>{health?.db_path || "-"}</strong></div>
          </div>
        </article>
      </section>
    </main>
  );
}
