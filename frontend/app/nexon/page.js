"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";
const NEXON_LOGO = "/nexon-logo.png";

const MOCK = {
  meta: {
    company: "넥슨",
    ip: "메이플스토리",
    ip_id: "maplestory",
    date_from: "2024-01-01",
    date_to: "2026-12-31",
    total_articles: 4320,
    cluster_count: 4,
  },
  ip_catalog: [
    { id: "maplestory", name: "메이플스토리" },
    { id: "dnf", name: "던전앤파이터" },
    { id: "fconline", name: "FC온라인" },
    { id: "bluearchive", name: "블루아카이브" },
    { id: "all", name: "전체" },
  ],
  top_outlets: [
    { outlet: "inven.co.kr", article_count: 320 },
    { outlet: "thisisgame.com", article_count: 260 },
  ],
  clusters: [
    {
      cluster: "확률형/BM",
      article_count: 680,
      negative_ratio: 51.2,
      sentiment: { positive: 17.4, neutral: 31.4, negative: 51.2 },
      keywords: ["확률", "과금", "보상", "논란"],
      samples: ["메이플 확률형 아이템 관련 공지", "확률 정보 공개 확대", "유저 반발 지속"],
    },
    {
      cluster: "보상/환불",
      article_count: 390,
      negative_ratio: 44.3,
      sentiment: { positive: 23.8, neutral: 31.9, negative: 44.3 },
      keywords: ["환불", "보상", "피해", "기준"],
      samples: ["넥슨 보상안 발표", "환불 기준 안내", "유저 대응 논의"],
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

export default function NexonPage() {
  const [ip, setIp] = useState("maplestory");
  const [dateFrom, setDateFrom] = useState("2024-01-01");
  const [dateTo, setDateTo] = useState("2026-12-31");
  const [data, setData] = useState(MOCK);
  const [usingMock, setUsingMock] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadClusters = async (targetIp = ip) => {
    setLoading(true);
    setError("");
    try {
      const query = new URLSearchParams({ ip: targetIp, date_from: dateFrom, date_to: dateTo, limit: "6" });
      const payload = await apiGet(`/api/ip-clusters?${query.toString()}`);
      if (!payload?.meta?.cluster_count) {
        setData({ ...MOCK, meta: { ...MOCK.meta, ip_id: targetIp, date_from: dateFrom, date_to: dateTo } });
        setUsingMock(true);
      } else {
        setData(payload);
        setUsingMock(false);
      }
    } catch (e) {
      setData({ ...MOCK, meta: { ...MOCK.meta, ip_id: targetIp, date_from: dateFrom, date_to: dateTo } });
      setUsingMock(true);
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadClusters();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="page nexonPage">
      <header className="compareHeader">
        <div className="compareBrand">
          <img src={NEXON_LOGO} alt="NEXON" />
          <div>
            <p>넥슨 군집 분석</p>
            <h1>IP Cluster Analysis</h1>
          </div>
        </div>
        <div className="nexonHeaderActions">
          <Link href="/" className="compareHomeLink">메인</Link>
          <Link href="/compare" className="compareHomeLink">경쟁사 비교</Link>
          <Link href="/risk" className="compareHomeLink">스크롤 뷰</Link>
        </div>
      </header>

      <section className="controls compareControls nexonFilter">
        <div className="row">
          <label>
            IP
            <select className="riskIpSelect" value={ip} onChange={(e) => setIp(e.target.value)}>
              {(data?.ip_catalog || MOCK.ip_catalog).map((item) => (
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
          <button className="primary" onClick={() => loadClusters(ip)} disabled={loading}>
            {loading ? "불러오는 중..." : "군집 분석"}
          </button>
          {usingMock ? <span className="nexonMockTag">샘플 데이터 표시 중</span> : null}
        </div>
        {error ? <p className="error">{error}</p> : null}
      </section>

      <section className="nexonKpiGrid">
        <article className="card">
          <h3>선택 IP</h3>
          <strong>{data?.meta?.ip || "-"}</strong>
          <span>{data?.meta?.date_from} ~ {data?.meta?.date_to}</span>
        </article>
        <article className="card">
          <h3>기사 수</h3>
          <strong>{Number(data?.meta?.total_articles || 0).toLocaleString()}</strong>
          <span>필터 기간 기준</span>
        </article>
        <article className="card">
          <h3>군집 수</h3>
          <strong>{Number(data?.meta?.cluster_count || 0)}</strong>
          <span>상위 6개</span>
        </article>
        <article className="card">
          <h3>주요 언론사</h3>
          <strong>{data?.top_outlets?.[0]?.outlet || "-"}</strong>
          <span>{Number(data?.top_outlets?.[0]?.article_count || 0).toLocaleString()}건</span>
        </article>
      </section>

      <section className="panel">
        <h3>군집 결과</h3>
        <div className="nexonThemeGrid">
          {(data?.clusters || []).map((c) => (
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
          {(data?.clusters || []).length === 0 ? <p className="muted">군집 결과가 없습니다.</p> : null}
        </div>
      </section>
    </main>
  );
}
