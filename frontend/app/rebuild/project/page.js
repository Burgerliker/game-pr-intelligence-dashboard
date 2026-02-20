"use client";

import Link from "next/link";

const principles = [
  "1초 안에 상태를 판단할 수 있어야 합니다.",
  "경영진 보고서에 바로 붙일 수 있는 카드 구조여야 합니다.",
  "숫자만 보여주지 않고, 행동 방향을 함께 제시해야 합니다.",
  "실시간 모니터링·경쟁사 비교·과거 분석을 같은 맥락으로 연결해야 합니다.",
];

const deliverables = [
  "실시간 모니터링: 위험 상태, 노출량, 부정 비율, 급등 이벤트를 한 화면에서 확인",
  "경쟁사 비교: 동일 시간대 조건으로 회사별 여론 분포와 기사 흐름 비교",
  "과거 분석: 실제 사건 구간에 탐지 로직을 재적용해 대응 타이밍 검증",
  "운영 가드레일: API 헬스, 스케줄러 상태, 데이터 모드 확인 경로 제공",
];

export default function RebuildProjectPage() {
  return (
    <main className="space-y-5">
      <header className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Project Brief</p>
            <h1 className="mt-1 text-3xl font-black tracking-tight">Game PR Intelligence Dashboard</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-600">개발자용 지표 화면이 아니라, 홍보팀이 당장 쓰는 의사결정 도구로 바꾸는 것이 목표입니다.</p>
          </div>
          <Link href="/rebuild" className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700">메인</Link>
        </div>
      </header>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-black">핵심 원칙</h2>
          <ul className="mt-3 space-y-2 text-sm text-slate-700">
            {principles.map((p) => (
              <li key={p} className="rounded-xl border border-slate-200 bg-slate-50 p-3">{p}</li>
            ))}
          </ul>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-black">구현 범위</h2>
          <ul className="mt-3 space-y-2 text-sm text-slate-700">
            {deliverables.map((d) => (
              <li key={d} className="rounded-xl border border-slate-200 bg-slate-50 p-3">{d}</li>
            ))}
          </ul>
        </article>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-black">바로 확인</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link href="/rebuild/nexon" className="rounded-full bg-slate-900 px-4 py-2 text-sm font-bold text-white">실시간 모니터링</Link>
          <Link href="/rebuild/compare" className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700">경쟁사 비교</Link>
          <Link href="/rebuild/nexon/backtest" className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700">과거 분석</Link>
        </div>
      </section>
    </main>
  );
}
