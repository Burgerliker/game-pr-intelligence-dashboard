"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";
const NEXON_LOGO = "/nexon-logo.png";

const MOCK = {
  meta: {
    company: "넥슨",
    date_from: "2024-01-01",
    date_to: "2026-12-31",
    total_articles: 12840,
  },
  daily: Array.from({ length: 24 }).map((_, i) => ({
    date: `2026-01-${String(i + 1).padStart(2, "0")}`,
    article_count: 60 + Math.round(Math.sin(i / 2) * 22) + (i % 7 === 0 ? 35 : 0),
    negative_ratio: 16 + (i % 5) * 4,
  })),
  outlets: [
    { outlet: "newsis.com", article_count: 640, positive_ratio: 44.2, neutral_ratio: 38.6, negative_ratio: 17.2 },
    { outlet: "mk.co.kr", article_count: 592, positive_ratio: 32.9, neutral_ratio: 39.5, negative_ratio: 27.6 },
    { outlet: "sedaily.com", article_count: 511, positive_ratio: 40.4, neutral_ratio: 35.2, negative_ratio: 24.4 },
    { outlet: "donga.com", article_count: 404, positive_ratio: 28.9, neutral_ratio: 42.1, negative_ratio: 29.0 },
    { outlet: "etnews.com", article_count: 377, positive_ratio: 46.0, neutral_ratio: 33.0, negative_ratio: 21.0 },
    { outlet: "chosun.com", article_count: 349, positive_ratio: 27.2, neutral_ratio: 40.4, negative_ratio: 32.4 },
  ],
  risk_themes: [
    { theme: "확률형/BM", article_count: 1230, negative_ratio: 46.1, risk_score: 0.91 },
    { theme: "규제/법적", article_count: 819, negative_ratio: 43.5, risk_score: 0.76 },
    { theme: "운영/장애", article_count: 942, negative_ratio: 38.3, risk_score: 0.74 },
    { theme: "보상/환불", article_count: 702, negative_ratio: 35.7, risk_score: 0.64 },
    { theme: "여론/논란", article_count: 1108, negative_ratio: 28.2, risk_score: 0.62 },
    { theme: "신작/성과", article_count: 1487, negative_ratio: 14.2, risk_score: 0.49 },
  ],
};

async function apiGet(path) {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

function pct(v) {
  return `${Math.max(0, Math.min(100, Number(v || 0)))}%`;
}

export default function NexonPage() {
  const [dateFrom, setDateFrom] = useState("2024-01-01");
  const [dateTo, setDateTo] = useState("2026-12-31");
  const [data, setData] = useState(MOCK);
  const [usingMock, setUsingMock] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadDashboard = async () => {
    setLoading(true);
    setError("");
    try {
      const query = new URLSearchParams({ date_from: dateFrom, date_to: dateTo });
      const payload = await apiGet(`/api/nexon-dashboard?${query.toString()}`);
      if (!payload?.meta?.total_articles) {
        setData({ ...MOCK, meta: { ...MOCK.meta, date_from: dateFrom, date_to: dateTo } });
        setUsingMock(true);
      } else {
        setData(payload);
        setUsingMock(false);
      }
    } catch (e) {
      setData({ ...MOCK, meta: { ...MOCK.meta, date_from: dateFrom, date_to: dateTo } });
      setUsingMock(true);
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dailyRows = data?.daily || [];
  const outletRows = data?.outlets || [];
  const themes = data?.risk_themes || [];
  const maxDaily = useMemo(() => Math.max(...dailyRows.map((r) => Number(r.article_count || 0)), 1), [dailyRows]);
  const topRisk = themes[0];

  return (
    <main className="page nexonPage">
      <header className="compareHeader">
        <div className="compareBrand">
          <img src={NEXON_LOGO} alt="NEXON" />
          <div>
            <p>넥슨 군집 분석</p>
            <h1>NEXON Insight Dashboard</h1>
          </div>
        </div>
        <div className="nexonHeaderActions">
          <Link href="/" className="compareHomeLink">
            메인
          </Link>
          <Link href="/compare" className="compareHomeLink">
            경쟁사 비교
          </Link>
        </div>
      </header>

      <section className="controls compareControls nexonFilter">
        <div className="row">
          <label>
            시작일
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </label>
          <label>
            종료일
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </label>
          <button className="primary" onClick={loadDashboard} disabled={loading}>
            {loading ? "불러오는 중..." : "대시보드 갱신"}
          </button>
          {usingMock ? <span className="nexonMockTag">샘플 데이터 표시 중</span> : null}
        </div>
        {error ? <p className="error">{error}</p> : null}
      </section>

      <section className="nexonKpiGrid">
        <article className="card">
          <h3>총 기사 수</h3>
          <strong>{Number(data?.meta?.total_articles || 0).toLocaleString()}</strong>
          <span>{data?.meta?.date_from} ~ {data?.meta?.date_to}</span>
        </article>
        <article className="card">
          <h3>추적 언론사</h3>
          <strong>{outletRows.length}</strong>
          <span>기사 2건 이상 매체 기준</span>
        </article>
        <article className="card">
          <h3>최고 위험 테마</h3>
          <strong>{topRisk?.theme || "-"}</strong>
          <span>Risk {topRisk?.risk_score ?? "-"}</span>
        </article>
        <article className="card">
          <h3>위험 테마 수</h3>
          <strong>{themes.length}</strong>
          <span>자동 분류 기준</span>
        </article>
      </section>

      <section className="panel">
        <h3>날짜별 기사 흐름 (2024~2026 필터 기반)</h3>
        <div className="nexonTimeline">
          {dailyRows.length === 0 ? (
            <p className="muted">표시할 데이터가 없습니다.</p>
          ) : (
            dailyRows.map((row) => (
              <div key={row.date} className="nexonBarWrap" title={`${row.date} | ${row.article_count}건 | 부정 ${row.negative_ratio}%`}>
                <div className="nexonBarTrack">
                  <div
                    className="nexonBar"
                    style={{
                      height: `${(Number(row.article_count || 0) / maxDaily) * 100}%`,
                      background: `linear-gradient(180deg, rgba(18,114,255,0.95), rgba(9,56,149,0.95)), linear-gradient(180deg, rgba(230,57,70,${Number(row.negative_ratio || 0) / 100}), rgba(230,57,70,${Number(row.negative_ratio || 0) / 100}))`,
                    }}
                  />
                </div>
                <span>{row.date.slice(5)}</span>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="nexonDualGrid">
        <section className="panel">
          <h3>언론사별 기사 수/감성 분포</h3>
          <div className="nexonOutletList">
            {outletRows.map((r) => (
              <article key={r.outlet} className="nexonOutletItem">
                <div className="nexonOutletHead">
                  <strong>{r.outlet}</strong>
                  <span>{r.article_count}건</span>
                </div>
                <div className="nexonStackedBar">
                  <div className="pos" style={{ width: pct(r.positive_ratio) }} />
                  <div className="neu" style={{ width: pct(r.neutral_ratio) }} />
                  <div className="neg" style={{ width: pct(r.negative_ratio) }} />
                </div>
                <p>긍정 {r.positive_ratio}% · 중립 {r.neutral_ratio}% · 부정 {r.negative_ratio}%</p>
              </article>
            ))}
          </div>
        </section>

        <section className="panel">
          <h3>위험 기사 테마</h3>
          <div className="nexonThemeGrid">
            {themes.map((t) => (
              <article key={t.theme} className="nexonThemeCard">
                <h4>{t.theme}</h4>
                <p>기사 {t.article_count}건 · 부정 {t.negative_ratio}%</p>
                <div className="nexonRiskTrack">
                  <div className="nexonRiskFill" style={{ width: pct(Number(t.risk_score) * 100) }} />
                </div>
                <span>Risk Score {t.risk_score}</span>
              </article>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}
