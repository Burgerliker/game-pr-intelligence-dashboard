"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";
const NEXON_LOGO = "/nexon-logo.png";

const MOCK_RISK = {
  meta: { company: "넥슨", ip: "메이플스토리", ip_id: "maplestory", date_from: "2024-01-01", date_to: "2026-12-31", total_articles: 4320 },
  daily: Array.from({ length: 24 }).map((_, i) => ({
    date: `2026-01-${String(i + 1).padStart(2, "0")}`,
    article_count: 45 + Math.round(Math.sin(i / 2) * 18) + (i % 7 === 0 ? 16 : 0),
    negative_ratio: 16 + (i % 5) * 5,
  })),
  outlets: [
    { outlet: "inven.co.kr", article_count: 640, positive_ratio: 28.2, neutral_ratio: 38.6, negative_ratio: 33.2 },
    { outlet: "mk.co.kr", article_count: 592, positive_ratio: 32.9, neutral_ratio: 39.5, negative_ratio: 27.6 },
    { outlet: "sedaily.com", article_count: 511, positive_ratio: 30.4, neutral_ratio: 41.2, negative_ratio: 28.4 },
  ],
  risk_themes: [
    { theme: "확률형/BM", article_count: 1230, negative_ratio: 46.1, risk_score: 0.91 },
    { theme: "규제/법적", article_count: 819, negative_ratio: 43.5, risk_score: 0.76 },
    { theme: "운영/장애", article_count: 942, negative_ratio: 38.3, risk_score: 0.74 },
    { theme: "보상/환불", article_count: 702, negative_ratio: 35.7, risk_score: 0.64 },
  ],
  ip_catalog: [
    { id: "all", name: "전체" },
    { id: "maplestory", name: "메이플스토리" },
    { id: "dnf", name: "던전앤파이터" },
    { id: "kartrider", name: "카트라이더" },
    { id: "fconline", name: "FC온라인" },
    { id: "bluearchive", name: "블루아카이브" },
  ],
};

const MOCK_CLUSTER = {
  meta: { cluster_count: 4, total_articles: 4320 },
  top_outlets: [
    { outlet: "inven.co.kr", article_count: 320 },
    { outlet: "thisisgame.com", article_count: 260 },
    { outlet: "newsis.com", article_count: 180 },
  ],
  keyword_cloud: [
    { word: "확률", count: 120, weight: 1.0 },
    { word: "보상", count: 96, weight: 0.8 },
    { word: "업데이트", count: 88, weight: 0.73 },
    { word: "환불", count: 74, weight: 0.62 },
    { word: "점검", count: 66, weight: 0.55 },
    { word: "이벤트", count: 62, weight: 0.52 },
  ],
  clusters: [
    {
      cluster: "확률형/BM",
      article_count: 680,
      negative_ratio: 51.2,
      sentiment: { positive: 17.4, neutral: 31.4, negative: 51.2 },
      keywords: ["확률", "과금", "보상", "논란"],
      samples: ["메이플 확률형 아이템 관련 공지"],
    },
    {
      cluster: "보상/환불",
      article_count: 390,
      negative_ratio: 44.3,
      sentiment: { positive: 23.8, neutral: 31.9, negative: 44.3 },
      keywords: ["환불", "보상", "피해", "기준"],
      samples: ["넥슨 보상안 발표"],
    },
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

const D3WordCloud = dynamic(() => import("react-d3-cloud"), { ssr: false });

function WordCloudChart({ items }) {
  const wrapRef = useRef(null);
  const [size, setSize] = useState({ width: 980, height: 320 });
  const words = useMemo(
    () => (items || []).slice(0, 120).map((w) => ({ text: w.word, value: Math.max(8, Number(w.count || 0)) })),
    [items]
  );

  useEffect(() => {
    if (!wrapRef.current) return;
    const update = () => {
      if (!wrapRef.current) return;
      const nextWidth = Math.max(320, Math.floor(wrapRef.current.clientWidth - 2));
      setSize({ width: nextWidth, height: 320 });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(wrapRef.current);
    return () => {
      ro.disconnect();
    };
  }, []);

  if (words.length === 0) {
    return (
      <div className="keywordCloud">
        <p className="muted">표시할 키워드가 없습니다.</p>
      </div>
    );
  }

  return (
    <div ref={wrapRef} className="keywordCloud">
      <D3WordCloud
        data={words}
        width={size.width}
        height={size.height}
        font="'Noto Sans KR'"
        fontWeight="700"
        fontStyle="normal"
        spiral="archimedean"
        rotate={(word) => (word.value % 3 === 0 ? 90 : 0)}
        fontSize={(word) => Math.max(14, Math.min(56, 10 + word.value * 1.7))}
        random={() => 0.5}
        padding={2}
      />
    </div>
  );
}

export default function NexonPage() {
  const [ip, setIp] = useState("maplestory");
  const [dateFrom, setDateFrom] = useState("2024-01-01");
  const [dateTo, setDateTo] = useState("2026-12-31");
  const [riskData, setRiskData] = useState(MOCK_RISK);
  const [clusterData, setClusterData] = useState(MOCK_CLUSTER);
  const [usingMock, setUsingMock] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadDashboard = async (targetIp = ip) => {
    setLoading(true);
    setError("");
    try {
      const base = new URLSearchParams({ ip: targetIp, date_from: dateFrom, date_to: dateTo });
      const [riskPayload, clusterPayload] = await Promise.all([
        apiGet(`/api/risk-dashboard?${base.toString()}`),
        apiGet(`/api/ip-clusters?${base.toString()}&limit=6`),
      ]);

      const okRisk = Number(riskPayload?.meta?.total_articles || 0) > 0;
      const okCluster = Number(clusterPayload?.meta?.cluster_count || 0) > 0;

      if (okRisk) {
        setRiskData(riskPayload);
      } else {
        setRiskData({ ...MOCK_RISK, meta: { ...MOCK_RISK.meta, ip_id: targetIp, date_from: dateFrom, date_to: dateTo } });
      }
      if (okCluster) {
        setClusterData(clusterPayload);
      } else {
        setClusterData(MOCK_CLUSTER);
      }
      setUsingMock(!(okRisk && okCluster));
    } catch (e) {
      setRiskData({ ...MOCK_RISK, meta: { ...MOCK_RISK.meta, ip_id: targetIp, date_from: dateFrom, date_to: dateTo } });
      setClusterData(MOCK_CLUSTER);
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

  const dailyRows = riskData?.daily || [];
  const outletRows = riskData?.outlets || [];
  const themes = riskData?.risk_themes || [];
  const clusters = clusterData?.clusters || [];
  const keywordCloud = clusterData?.keyword_cloud || [];
  const maxDaily = useMemo(() => Math.max(...dailyRows.map((r) => Number(r.article_count || 0)), 1), [dailyRows]);
  const topRisk = themes[0];
  const topNegativeCluster = useMemo(() => {
    const sorted = [...clusters].sort((a, b) => Number(b.negative_ratio || 0) - Number(a.negative_ratio || 0));
    return sorted[0];
  }, [clusters]);
  const topOutletShare = useMemo(() => {
    const total = Number(riskData?.meta?.total_articles || 0);
    const top = Number(clusterData?.top_outlets?.[0]?.article_count || 0);
    if (!total) return 0;
    return Math.round((top / total) * 1000) / 10;
  }, [clusterData?.top_outlets, riskData?.meta?.total_articles]);

  return (
    <main className="page nexonPage">
      <header className="compareHeader">
        <div className="compareBrand">
          <img src={NEXON_LOGO} alt="NEXON" />
          <div>
            <p>넥슨 군집 분석</p>
            <h1>IP Cluster Dashboard</h1>
          </div>
        </div>
        <div className="nexonHeaderActions">
          <Link href="/" className="compareHomeLink">메인</Link>
          <Link href="/compare" className="compareHomeLink">경쟁사 비교</Link>
        </div>
      </header>

      <section className="controls compareControls nexonFilter">
        <div className="row">
          <label>
            IP
            <select className="riskIpSelect" value={ip} onChange={(e) => setIp(e.target.value)}>
              {(riskData?.ip_catalog || MOCK_RISK.ip_catalog).map((item) => (
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
          <button className="primary" onClick={() => loadDashboard(ip)} disabled={loading}>
            {loading ? "불러오는 중..." : "분석 갱신"}
          </button>
          {usingMock ? <span className="nexonMockTag">샘플 데이터 표시 중</span> : null}
        </div>
        {error ? <p className="error">{error}</p> : null}
      </section>

      <section className="nexonKpiGrid">
        <article className="card">
          <h3>선택 IP</h3>
          <strong>{riskData?.meta?.ip || "-"}</strong>
          <span>{riskData?.meta?.date_from} ~ {riskData?.meta?.date_to}</span>
        </article>
        <article className="card">
          <h3>총 기사 수</h3>
          <strong>{Number(riskData?.meta?.total_articles || 0).toLocaleString()}</strong>
          <span>필터 기준</span>
        </article>
        <article className="card">
          <h3>최고 위험 테마</h3>
          <strong>{topRisk?.theme || "-"}</strong>
          <span>Risk {topRisk?.risk_score ?? "-"}</span>
        </article>
        <article className="card">
          <h3>군집 수</h3>
          <strong>{Number(clusterData?.meta?.cluster_count || 0)}</strong>
          <span>상위 6개</span>
        </article>
      </section>

      <section className="panel">
        <h3>날짜별 기사 흐름</h3>
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

      <section className="panel">
        <h3>키워드 워드클라우드</h3>
        <WordCloudChart items={keywordCloud} />
      </section>

      <section className="panel">
        <h3>추가 인사이트</h3>
        <div className="insightGrid">
          <article className="insightCard">
            <h4>부정 상위 군집</h4>
            <p>
              {topNegativeCluster?.cluster || "-"} · 부정 {topNegativeCluster?.negative_ratio ?? "-"}%
            </p>
          </article>
          <article className="insightCard">
            <h4>매체 편중도</h4>
            <p>
              상위 매체 비중 {topOutletShare}% ({clusterData?.top_outlets?.[0]?.outlet || "-"})
            </p>
          </article>
          <article className="insightCard">
            <h4>리스크 집중도</h4>
            <p>
              1위 테마 {topRisk?.theme || "-"} · Risk {topRisk?.risk_score ?? "-"}
            </p>
          </article>
          <article className="insightCard">
            <h4>군집 분산도</h4>
            <p>
              총 {clusters.length}개 군집 기준, 상위 군집 기사 {clusters[0]?.article_count || 0}건
            </p>
          </article>
        </div>
      </section>

      <section className="panel">
        <h3>IP 군집 결과</h3>
        <div className="keywordList" style={{ marginBottom: "10px" }}>
          {(clusterData?.top_outlets || []).map((o) => (
            <span key={o.outlet} className="keywordPill">{o.outlet} {o.article_count}건</span>
          ))}
        </div>
        <div className="nexonThemeGrid">
          {clusters.map((c) => (
            <article key={c.cluster} className="nexonThemeCard">
              <h4>{c.cluster}</h4>
              <p>기사 {c.article_count}건 · 부정 {c.negative_ratio}%</p>
              <div className="nexonStackedBar">
                <div className="pos" style={{ width: pct(c.sentiment?.positive) }} />
                <div className="neu" style={{ width: pct(c.sentiment?.neutral) }} />
                <div className="neg" style={{ width: pct(c.sentiment?.negative) }} />
              </div>
              <p>키워드: {(c.keywords || []).join(", ")}</p>
              <p>대표 기사: {(c.samples || []).slice(0, 1).join("") || "-"}</p>
            </article>
          ))}
          {clusters.length === 0 ? <p className="muted">군집 결과가 없습니다.</p> : null}
        </div>
      </section>
    </main>
  );
}
