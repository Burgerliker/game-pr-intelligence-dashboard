"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";
const NEXON_LOGO = "/nexon-logo.png";

const MOCK_BY_IP = {
  maplestory: {
    meta: { company: "넥슨", ip: "메이플스토리", ip_id: "maplestory", date_from: "2024-01-01", date_to: "2026-12-31", total_articles: 4320 },
    daily: Array.from({ length: 20 }).map((_, i) => ({
      date: `2026-01-${String(i + 1).padStart(2, "0")}`,
      article_count: 38 + Math.round(Math.sin(i / 2) * 12) + (i % 6 === 0 ? 18 : 0),
      negative_ratio: 18 + (i % 5) * 5,
    })),
    outlets: [
      { outlet: "inven.co.kr", article_count: 310, positive_ratio: 25.1, neutral_ratio: 42.4, negative_ratio: 32.5 },
      { outlet: "thisisgame.com", article_count: 273, positive_ratio: 23.3, neutral_ratio: 45.6, negative_ratio: 31.1 },
      { outlet: "newsis.com", article_count: 190, positive_ratio: 31.2, neutral_ratio: 44.0, negative_ratio: 24.8 },
    ],
    risk_themes: [
      { theme: "확률형/BM", article_count: 680, negative_ratio: 51.2, risk_score: 0.92 },
      { theme: "보상/환불", article_count: 390, negative_ratio: 44.3, risk_score: 0.75 },
      { theme: "운영/장애", article_count: 355, negative_ratio: 37.1, risk_score: 0.66 },
      { theme: "여론/논란", article_count: 410, negative_ratio: 33.8, risk_score: 0.65 },
    ],
    ip_catalog: [
      { id: "all", name: "전체" },
      { id: "maplestory", name: "메이플스토리" },
      { id: "dnf", name: "던전앤파이터" },
      { id: "fconline", name: "FC온라인" },
      { id: "bluearchive", name: "블루아카이브" },
    ],
    ip_breakdown: [
      { ip: "메이플스토리", article_count: 4320 },
      { ip: "던전앤파이터", article_count: 2620 },
      { ip: "FC온라인", article_count: 1810 },
      { ip: "블루아카이브", article_count: 1290 },
    ],
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

export default function RiskIpPage() {
  const params = useParams();
  const ip = (params?.ip || "maplestory").toString().toLowerCase();

  const [dateFrom, setDateFrom] = useState("2024-01-01");
  const [dateTo, setDateTo] = useState("2026-12-31");
  const [data, setData] = useState(MOCK_BY_IP.maplestory);
  const [loading, setLoading] = useState(false);
  const [usingMock, setUsingMock] = useState(true);
  const [error, setError] = useState("");

  const loadDashboard = async () => {
    setLoading(true);
    setError("");
    try {
      const query = new URLSearchParams({ ip, date_from: dateFrom, date_to: dateTo });
      const payload = await apiGet(`/api/risk-dashboard?${query.toString()}`);
      if (!payload?.meta?.total_articles) {
        setData({ ...MOCK_BY_IP.maplestory, meta: { ...MOCK_BY_IP.maplestory.meta, date_from: dateFrom, date_to: dateTo } });
        setUsingMock(true);
      } else {
        setData(payload);
        setUsingMock(false);
      }
    } catch (e) {
      setData({ ...MOCK_BY_IP.maplestory, meta: { ...MOCK_BY_IP.maplestory.meta, date_from: dateFrom, date_to: dateTo } });
      setUsingMock(true);
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ip]);

  const dailyRows = data?.daily || [];
  const outletRows = data?.outlets || [];
  const themes = data?.risk_themes || [];
  const ipCatalog = data?.ip_catalog || [];
  const maxDaily = useMemo(() => Math.max(...dailyRows.map((r) => Number(r.article_count || 0)), 1), [dailyRows]);
  const topRisk = themes[0];

  return (
    <main className="page nexonPage">
      <header className="compareHeader">
        <div className="compareBrand">
          <img src={NEXON_LOGO} alt="NEXON" />
          <div>
            <p>IP별 위험 분석</p>
            <h1>{data?.meta?.ip || "메이플스토리"} Risk Dashboard</h1>
          </div>
        </div>
        <div className="nexonHeaderActions">
          <Link href="/" className="compareHomeLink">메인</Link>
          <Link href="/nexon" className="compareHomeLink">넥슨 전체</Link>
        </div>
      </header>

      <section className="controls compareControls nexonFilter">
        <div className="row">
          <label>
            IP
            <select
              className="riskIpSelect"
              value={ip}
              onChange={(e) => {
                window.location.href = `/risk/${e.target.value}`;
              }}
            >
              {ipCatalog.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
          </label>
          <label>
            시작일
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </label>
          <label>
            종료일
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </label>
          <button className="primary" onClick={loadDashboard} disabled={loading}>{loading ? "불러오는 중..." : "갱신"}</button>
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
          <h3>상위 위험 테마</h3>
          <strong>{topRisk?.theme || "-"}</strong>
          <span>Risk {topRisk?.risk_score ?? "-"}</span>
        </article>
        <article className="card">
          <h3>추적 언론사</h3>
          <strong>{outletRows.length}</strong>
          <span>기사 2건 이상</span>
        </article>
        <article className="card">
          <h3>IP 분포 Top</h3>
          <strong>{data?.ip_breakdown?.[0]?.ip || "-"}</strong>
          <span>{Number(data?.ip_breakdown?.[0]?.article_count || 0).toLocaleString()}건</span>
        </article>
      </section>

      <section className="panel">
        <h3>날짜별 기사/부정 추이</h3>
        <div className="nexonTimeline">
          {dailyRows.length === 0 ? <p className="muted">표시할 데이터가 없습니다.</p> : dailyRows.map((row) => (
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
          ))}
        </div>
      </section>

      <section className="nexonDualGrid">
        <section className="panel">
          <h3>언론사별 감성 분포</h3>
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
          <h3>위험 테마</h3>
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
