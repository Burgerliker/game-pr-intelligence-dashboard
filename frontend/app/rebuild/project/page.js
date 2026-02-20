"use client";

import { RebuildNav } from "../_components/ui";

const cards = [
  {
    title: "문제",
    body: "홍보팀은 매일 기사량 급증과 여론 악화 중 무엇이 실제 위기인지 빠르게 판단해야 합니다. 데이터는 많지만 행동 기준이 부족한 게 핵심 문제입니다.",
  },
  {
    title: "해결",
    body: "실시간 모니터링, 경쟁사 비교, 과거 분석을 같은 구조로 묶어 오늘 판단과 보고 자료를 동시에 준비할 수 있게 설계했습니다.",
  },
  {
    title: "기준",
    body: "상태 신호등, 핵심 지표 3개, 이벤트 목록, 근거 기사로 연결되는 정보 계층을 고정해 PR 실무자가 1~5분 안에 상황을 설명할 수 있도록 했습니다.",
  },
];

export default function RebuildProjectPage() {
  return (
    <main className="space-y-4">
      <RebuildNav
        title="Game PR Intelligence Dashboard"
        subtitle="개발자 지표 화면을 홍보팀 의사결정 도구로 재구성한 리디자인 프로젝트입니다."
        actions={[{ label: "메인", href: "/rebuild" }]}
      />

      <section className="rb-grid-3">
        {cards.map((c) => (
          <article key={c.title} className="rb-card p-4 md:p-5">
            <h2 className="text-xl font-black">{c.title}</h2>
            <p className="mt-2 text-sm leading-7 text-slate-600">{c.body}</p>
          </article>
        ))}
      </section>

      <section className="rb-card p-4 md:p-5">
        <h2 className="text-xl font-black">확인 경로</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <a className="rb-btn rb-btn-primary" href="/rebuild/nexon">실시간 모니터링</a>
          <a className="rb-btn" href="/rebuild/compare">경쟁사 비교</a>
          <a className="rb-btn" href="/rebuild/nexon/backtest">과거 분석</a>
        </div>
      </section>
    </main>
  );
}
