"use client";

import { useEffect, useMemo, useState } from "react";
import { apiGet, getDiagnosticCode } from "../../lib/api";
import { MetricCard, RebuildNav, StatusPill } from "./_components/ui";

function toTone(score) {
  const n = Number(score || 0);
  if (n >= 70) return { label: "위기", tone: "critical" };
  if (n >= 45) return { label: "경고", tone: "warning" };
  if (n >= 20) return { label: "주의", tone: "caution" };
  return { label: "정상", tone: "normal" };
}

export default function RebuildHomePage() {
  const [health, setHealth] = useState(null);
  const [risk, setRisk] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

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
        setError(`초기 상태 조회 실패 (${getDiagnosticCode(e, "RB-HOME")})`);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const score = Number(risk?.risk_score || 0);
  const state = useMemo(() => toTone(score), [score]);

  return (
    <main className="space-y-4">
      <RebuildNav
        title="홍보팀 의사결정 대시보드"
        subtitle="1초 상황 파악 → 보고서 캡처 → 즉시 대응까지 한 화면에서 처리합니다."
        actions={[
          { label: "실시간 모니터링", href: "/rebuild/nexon", primary: true },
          { label: "경쟁사 비교", href: "/rebuild/compare" },
          { label: "과거 분석", href: "/rebuild/nexon/backtest" },
          { label: "프로젝트 소개", href: "/rebuild/project" },
        ]}
      />

      {error ? <section className="rb-card border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">{error}</section> : null}

      <section className="rb-card p-4 md:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <StatusPill tone={state.tone} label={`현재 상태: ${state.label}`} />
          <p className="text-xs text-slate-500">{loading ? "로딩 중" : "실시간 상태 반영"}</p>
        </div>
      </section>

      <section className="rb-grid-4">
        <MetricCard label="위기 지수" value={score.toFixed(1)} sub="0~100" />
        <MetricCard label="최근 24시간 보도량" value={Number(health?.recent_articles_24h || 0)} sub="실시간 집계" />
        <MetricCard label="수집 상태" value={health?.scheduler_running ? "정상" : "확인 필요"} sub={`job ${Number(health?.scheduler_job_count || 0)}개`} />
        <MetricCard label="운영 모드" value={health?.mode || "-"} sub="API health 기준" />
      </section>
    </main>
  );
}
