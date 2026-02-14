"use client";

import { useMemo, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

async function apiGet(path) {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function apiPost(path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body || {}),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export default function Page() {
  const [companies, setCompanies] = useState(["넥슨", "NC소프트", "넷마블", "크래프톤"]);
  const [articleCount, setArticleCount] = useState(40);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);

  const total = data?.meta?.total_articles ?? 0;
  const companyCounts = data?.company_counts ?? {};

  const sortedArticles = useMemo(() => {
    return (data?.latest_articles || []).slice(0, 20);
  }, [data]);

  const runAnalyze = async () => {
    setLoading(true);
    setError("");
    try {
      const payload = await apiPost("/api/analyze", {
        companies,
        articles_per_company: articleCount,
      });
      setData(payload);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  const loadDemo = async () => {
    setLoading(true);
    setError("");
    try {
      const payload = await apiPost("/api/demo");
      setData(payload);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  const toggleCompany = (name) => {
    setCompanies((prev) => (prev.includes(name) ? prev.filter((v) => v !== name) : [...prev, name]));
  };

  return (
    <main className="page">
      <header className="topbar">
        <span>메뉴</span>
        <h1>NEXON</h1>
        <span>회원가입 / 로그인</span>
      </header>

      <section className="hero">
        <div>
          <p className="heroBadge">NEXON GAME PR INTELLIGENCE</p>
          <h2>PR 인사이트 센터</h2>
          <p>여론 흐름과 감성 변화를 기반으로 메시지 전략과 리스크 대응 우선순위를 빠르게 결정합니다.</p>
        </div>
      </section>

      <section className="controls">
        <div className="row">
          {["넥슨", "NC소프트", "넷마블", "크래프톤"].map((name) => (
            <button
              key={name}
              className={companies.includes(name) ? "chip active" : "chip"}
              onClick={() => toggleCompany(name)}
            >
              {name}
            </button>
          ))}
        </div>
        <div className="row">
          <label>
            회사당 기사 수
            <input
              type="range"
              min="10"
              max="100"
              step="10"
              value={articleCount}
              onChange={(e) => setArticleCount(Number(e.target.value))}
            />
            <strong>{articleCount}</strong>
          </label>
          <button className="primary" onClick={runAnalyze} disabled={loading || companies.length === 0}>
            {loading ? "분석 중..." : "데이터 수집 시작"}
          </button>
          <button className="ghost" onClick={loadDemo} disabled={loading}>
            데모 데이터
          </button>
        </div>
        {error ? <p className="error">{error}</p> : null}
      </section>

      {!data ? (
        <section className="empty">데이터를 수집하면 분석 결과가 표시됩니다.</section>
      ) : (
        <>
          <section className="cards">
            {Object.keys(companyCounts).map((c) => (
              <article key={c} className="card">
                <h3>{c}</h3>
                <strong>{companyCounts[c]}</strong>
                <span>보도 건수</span>
              </article>
            ))}
            <article className="card">
              <h3>총합</h3>
              <strong>{total}</strong>
              <span>전체 기사</span>
            </article>
          </section>

          <section className="panel">
            <h3>최신 기사</h3>
            <table>
              <thead>
                <tr>
                  <th>회사</th>
                  <th>제목</th>
                  <th>감성</th>
                  <th>날짜</th>
                </tr>
              </thead>
              <tbody>
                {sortedArticles.map((a, idx) => (
                  <tr key={`${a.url}-${idx}`}>
                    <td>{a.company}</td>
                    <td>{a.title}</td>
                    <td>{a.sentiment}</td>
                    <td>{a.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}
    </main>
  );
}

