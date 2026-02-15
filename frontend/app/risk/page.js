"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";
const NEXON_LOGO = "/nexon-logo.png";

const IP_STEPS = [
  { id: "maplestory", name: "메이플스토리", note: "확률형/BM 이슈 민감도" },
  { id: "dnf", name: "던전앤파이터", note: "업데이트/운영 안정성" },
  { id: "fconline", name: "FC온라인", note: "경쟁/이벤트 시즌 이슈" },
  { id: "bluearchive", name: "블루아카이브", note: "커뮤니티 여론 변동" },
  { id: "all", name: "전체", note: "전사 통합 리스크 뷰" },
];

const MOCK = {
  maplestory: {
    meta: { ip: "메이플스토리", total_articles: 4320 },
    risk_themes: [
      { theme: "확률형/BM", article_count: 680, negative_ratio: 51.2, risk_score: 0.92 },
      { theme: "보상/환불", article_count: 390, negative_ratio: 44.3, risk_score: 0.75 },
      { theme: "운영/장애", article_count: 355, negative_ratio: 37.1, risk_score: 0.66 },
    ],
    outlets: [{ outlet: "inven.co.kr", article_count: 310, negative_ratio: 32.5 }],
  },
  dnf: {
    meta: { ip: "던전앤파이터", total_articles: 2620 },
    risk_themes: [
      { theme: "운영/장애", article_count: 420, negative_ratio: 35.7, risk_score: 0.81 },
      { theme: "여론/논란", article_count: 288, negative_ratio: 30.1, risk_score: 0.63 },
      { theme: "신작/성과", article_count: 412, negative_ratio: 17.2, risk_score: 0.58 },
    ],
    outlets: [{ outlet: "thisisgame.com", article_count: 230, negative_ratio: 29.2 }],
  },
  fconline: {
    meta: { ip: "FC온라인", total_articles: 1810 },
    risk_themes: [
      { theme: "운영/장애", article_count: 298, negative_ratio: 33.9, risk_score: 0.78 },
      { theme: "보상/환불", article_count: 240, negative_ratio: 28.5, risk_score: 0.66 },
      { theme: "여론/논란", article_count: 210, negative_ratio: 24.4, risk_score: 0.61 },
    ],
    outlets: [{ outlet: "mk.co.kr", article_count: 180, negative_ratio: 27.7 }],
  },
  bluearchive: {
    meta: { ip: "블루아카이브", total_articles: 1290 },
    risk_themes: [
      { theme: "여론/논란", article_count: 280, negative_ratio: 38.4, risk_score: 0.79 },
      { theme: "운영/장애", article_count: 172, negative_ratio: 31.3, risk_score: 0.63 },
      { theme: "신작/성과", article_count: 210, negative_ratio: 18.2, risk_score: 0.55 },
    ],
    outlets: [{ outlet: "etnews.com", article_count: 120, negative_ratio: 25.5 }],
  },
  all: {
    meta: { ip: "전체", total_articles: 10040 },
    risk_themes: [
      { theme: "확률형/BM", article_count: 1230, negative_ratio: 46.1, risk_score: 0.91 },
      { theme: "운영/장애", article_count: 942, negative_ratio: 38.3, risk_score: 0.74 },
      { theme: "규제/법적", article_count: 819, negative_ratio: 43.5, risk_score: 0.76 },
    ],
    outlets: [{ outlet: "unknown", article_count: 133, negative_ratio: 4.5 }],
  },
};

async function apiGet(path) {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

function pct(v) {
  return `${Math.max(0, Math.min(100, Number(v || 0)))}%`;
}

export default function RiskStoryPage() {
  const stepRefs = useRef([]);
  const cacheRef = useRef({});
  const [activeIndex, setActiveIndex] = useState(0);
  const [data, setData] = useState(MOCK.maplestory);

  const activeIp = IP_STEPS[activeIndex]?.id || "maplestory";

  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const idx = Number(entry.target.getAttribute("data-step-index") || 0);
            setActiveIndex(idx);
          }
        });
      },
      { threshold: 0.65 }
    );

    stepRefs.current.forEach((el) => el && obs.observe(el));
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    let closed = false;
    const load = async () => {
      if (cacheRef.current[activeIp]) {
        setData(cacheRef.current[activeIp]);
        return;
      }
      try {
        const q = new URLSearchParams({ ip: activeIp, date_from: "2024-01-01", date_to: "2026-12-31" });
        const payload = await apiGet(`/api/risk-dashboard?${q.toString()}`);
        const next = payload?.meta?.total_articles ? payload : MOCK[activeIp] || MOCK.maplestory;
        cacheRef.current[activeIp] = next;
        if (!closed) setData(next);
      } catch {
        const next = MOCK[activeIp] || MOCK.maplestory;
        cacheRef.current[activeIp] = next;
        if (!closed) setData(next);
      }
    };
    load();
    return () => {
      closed = true;
    };
  }, [activeIp]);

  const topThemes = useMemo(() => (data?.risk_themes || []).slice(0, 3), [data]);
  const topOutlet = data?.outlets?.[0];

  return (
    <main className="riskStoryPage">
      <header className="compareHeader riskStoryHeader">
        <div className="compareBrand">
          <img src={NEXON_LOGO} alt="NEXON" />
          <div>
            <p>스크롤 기반 IP 리스크</p>
            <h1>IP Risk Storyboard</h1>
          </div>
        </div>
        <div className="nexonHeaderActions">
          <Link href="/" className="compareHomeLink">메인</Link>
          <Link href="/nexon" className="compareHomeLink">넥슨 전체</Link>
          <Link href={`/risk/${activeIp}`} className="compareHomeLink">상세 보기</Link>
        </div>
      </header>

      <section className="riskStoryWrap">
        <div className="riskStickyStage" data-ip={activeIp}>
          <div className="riskStageCard">
            <p className="riskStageKicker">현재 포커스</p>
            <h2>{data?.meta?.ip || "메이플스토리"}</h2>
            <div className="riskStageKpis">
              <article>
                <span>기사 수</span>
                <strong>{Number(data?.meta?.total_articles || 0).toLocaleString()}</strong>
              </article>
              <article>
                <span>핵심 매체</span>
                <strong>{topOutlet?.outlet || "-"}</strong>
              </article>
              <article>
                <span>부정 비율</span>
                <strong>{topOutlet?.negative_ratio ?? "-"}%</strong>
              </article>
            </div>
            <div className="riskThemeStack">
              {topThemes.map((t) => (
                <div key={t.theme} className="riskThemeRow">
                  <div className="riskThemeLabel">{t.theme}</div>
                  <div className="riskThemeBar"><i style={{ width: pct(Number(t.risk_score) * 100) }} /></div>
                  <div className="riskThemeMeta">{t.article_count}건 · 부정 {t.negative_ratio}%</div>
                </div>
              ))}
            </div>
          </div>
          <div className="riskStepDots">
            {IP_STEPS.map((step, i) => (
              <span key={step.id} className={i === activeIndex ? "on" : ""}>{step.name}</span>
            ))}
          </div>
        </div>

        <div className="riskStorySteps">
          {IP_STEPS.map((step, i) => (
            <article
              key={step.id}
              data-step-index={i}
              ref={(el) => {
                stepRefs.current[i] = el;
              }}
              className="riskStep"
            >
              <p>STEP {String(i + 1).padStart(2, "0")}</p>
              <h3>{step.name}</h3>
              <span>{step.note}</span>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
