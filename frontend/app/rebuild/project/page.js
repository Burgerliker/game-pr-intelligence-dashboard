"use client";

import Link from "next/link";

const cards = [
  {
    title: "왜 이 대시보드가 필요한가",
    body: "홍보팀은 매일 '지금 이슈가 위험 단계인지'를 빠르게 판단해야 합니다. 단순 기사 나열만으로는 보고/대응 우선순위를 정하기 어렵습니다.",
  },
  {
    title: "핵심 가치",
    body: "실시간 모니터링, 경쟁사 비교, 과거 분석을 한 체계로 연결해 오늘 판단과 보고 자료를 동시에 준비할 수 있게 설계했습니다.",
  },
  {
    title: "운영 기준",
    body: "운영 API 상태와 수집 스케줄러 상태를 함께 노출해 '숫자가 왜 이렇게 보이는지'까지 설명 가능한 화면을 목표로 합니다.",
  },
];

export default function RebuildProjectPage() {
  return (
    <main style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <section className="rb-card" style={{ padding: 22 }}>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <div>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 800, letterSpacing: ".18em", textTransform: "uppercase", color: "#60708b" }}>Project Story</p>
            <h1 style={{ margin: "6px 0 0", fontSize: "clamp(26px,4.4vw,38px)", lineHeight: 1.1 }}>Game PR Intelligence Dashboard</h1>
            <p style={{ margin: "8px 0 0", fontSize: 14, color: "#5f6b7f" }}>개발자 도구가 아니라 홍보 실무 의사결정 도구로 바꾸는 리빌드입니다.</p>
          </div>
          <Link className="rb-btn" href="/rebuild">메인</Link>
        </div>
      </section>

      <section className="rb-grid-3">
        {cards.map((c) => (
          <article key={c.title} className="rb-card" style={{ padding: 16 }}>
            <h2 style={{ margin: 0, fontSize: 20 }}>{c.title}</h2>
            <p style={{ margin: "10px 0 0", fontSize: 14, color: "#5f6b7f", lineHeight: 1.75 }}>{c.body}</p>
          </article>
        ))}
      </section>

      <section className="rb-card" style={{ padding: 16 }}>
        <h2 style={{ margin: 0, fontSize: 20 }}>바로 확인 가능한 화면</h2>
        <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 8 }}>
          <Link className="rb-btn rb-btn-primary" href="/rebuild/nexon">실시간 모니터링</Link>
          <Link className="rb-btn" href="/rebuild/compare">경쟁사 비교</Link>
          <Link className="rb-btn" href="/rebuild/nexon/backtest">과거 분석</Link>
        </div>
      </section>
    </main>
  );
}
