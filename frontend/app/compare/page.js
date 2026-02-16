"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { apiGet, apiPost } from "../../lib/api";

const NEXON_LOGO = "/nexon-logo.png";
const PAGE_SIZE = 40;
const COMPARE_COLLECTION_DISABLED = true;

const SENTIMENTS = ["긍정", "중립", "부정"];

function ratioToWidth(v) {
  const n = Number(v || 0);
  return `${Math.max(0, Math.min(100, n))}%`;
}

export default function Page() {
  const [companies, setCompanies] = useState(["넥슨", "NC소프트", "넷마블", "크래프톤"]);
  const [articleCount, setArticleCount] = useState(40);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);
  const [filterCompany, setFilterCompany] = useState("전체");
  const [filterSentiment, setFilterSentiment] = useState("전체");
  const [dataSource, setDataSource] = useState("live");
  const [articleRows, setArticleRows] = useState([]);
  const [articleOffset, setArticleOffset] = useState(0);
  const [articleTotal, setArticleTotal] = useState(0);
  const [articleHasMore, setArticleHasMore] = useState(false);
  const [articleLoading, setArticleLoading] = useState(false);
  const sentinelRef = useRef(null);

  const total = data?.meta?.total_articles ?? 0;
  const companyCounts = data?.company_counts ?? {};
  const insights = data?.insights ?? {};
  const trendRows = data?.trend ?? [];
  const sentimentRows = data?.sentiment_summary ?? [];
  const keywordsMap = data?.keywords ?? {};
  const selectedFromData = data?.meta?.selected_companies ?? [];

  const loadArticles = async ({ reset = false, companyOverride, sentimentOverride } = {}) => {
    const companyVal = companyOverride ?? filterCompany;
    const sentimentVal = sentimentOverride ?? filterSentiment;
    const nextOffset = reset ? 0 : articleOffset;
    const query = new URLSearchParams({
      company: companyVal,
      sentiment: sentimentVal,
      limit: String(PAGE_SIZE),
      offset: String(nextOffset),
    });

    setArticleLoading(true);
    try {
      const payload = await apiGet(`/api/articles?${query.toString()}`);
      setArticleRows((prev) => (reset ? payload.items : [...prev, ...payload.items]));
      setArticleOffset((reset ? 0 : nextOffset) + payload.items.length);
      setArticleTotal(payload.total || 0);
      setArticleHasMore(Boolean(payload.has_more));
    } catch (e) {
      setError(String(e));
    } finally {
      setArticleLoading(false);
    }
  };

  const runAnalyze = async () => {
    if (COMPARE_COLLECTION_DISABLED) {
      setError("경쟁사 비교 수집 기능은 현재 비활성화되어 있습니다.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const payload = await apiPost("/api/analyze", {
        companies,
        articles_per_company: articleCount,
      });
      setData(payload);
      setDataSource("live");
      setFilterCompany("전체");
      setFilterSentiment("전체");
      await loadArticles({ reset: true, companyOverride: "전체", sentimentOverride: "전체" });
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
      setDataSource("demo");
      setArticleRows([]);
      setArticleOffset(0);
      setArticleTotal(0);
      setArticleHasMore(false);
      setFilterCompany("전체");
      setFilterSentiment("전체");
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  const toggleCompany = (name) => {
    setCompanies((prev) => (prev.includes(name) ? prev.filter((v) => v !== name) : [...prev, name]));
  };

  const trendSeries = useMemo(() => {
    if (!trendRows.length || !selectedFromData.length) return [];
    const recent = trendRows.slice(-14);
    return selectedFromData.map((company) => {
      const points = recent.map((row) => ({
        date: row.date,
        value: Number(row[company] || 0),
      }));
      const max = Math.max(...points.map((p) => p.value), 1);
      return { company, points, max };
    });
  }, [trendRows, selectedFromData]);

  const sentimentByCompany = useMemo(() => {
    const map = {};
    for (const row of sentimentRows) {
      if (!map[row.company]) {
        map[row.company] = { 긍정: 0, 중립: 0, 부정: 0, total: 0 };
      }
      map[row.company][row.sentiment] = Number(row.ratio || 0);
      map[row.company].total += Number(row.count || 0);
    }
    return map;
  }, [sentimentRows]);

  const keywordCards = useMemo(() => {
    return selectedFromData.map((company) => {
      const raw = keywordsMap[company] || [];
      const items = raw.slice(0, 10).map((it) => ({ keyword: it[0], count: it[1] }));
      return { company, items };
    });
  }, [selectedFromData, keywordsMap]);

  const filteredDemoArticles = useMemo(() => {
    let rows = (data?.latest_articles || []).slice();
    if (filterCompany !== "전체") rows = rows.filter((r) => r.company === filterCompany);
    if (filterSentiment !== "전체") rows = rows.filter((r) => r.sentiment === filterSentiment);
    return rows.slice(0, 100);
  }, [data, filterCompany, filterSentiment]);

  const displayedArticles = dataSource === "live" ? articleRows : filteredDemoArticles;
  const displayedCount = dataSource === "live" ? articleRows.length : filteredDemoArticles.length;
  const totalCount = dataSource === "live" ? articleTotal : filteredDemoArticles.length;

  useEffect(() => {
    if (!data || dataSource !== "live") return;
    loadArticles({ reset: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterCompany, filterSentiment, dataSource]);

  useEffect(() => {
    if (dataSource !== "live") return;
    const node = sentinelRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting && articleHasMore && !articleLoading) {
          loadArticles();
        }
      },
      { rootMargin: "120px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [articleHasMore, articleLoading, dataSource]);

  return (
    <main className="page comparePage">
      <header className="compareHeader">
        <div className="compareBrand">
          <img src={NEXON_LOGO} alt="NEXON" />
          <div>
            <p>경쟁사 비교</p>
            <h1>PR Intelligence</h1>
          </div>
        </div>
        <Link href="/" className="compareHomeLink">
          메인
        </Link>
      </header>

      <section className="controls compareControls">
        {COMPARE_COLLECTION_DISABLED ? (
          <p className="error">보호 모드: 경쟁사 비교 API 수집은 현재 잠금 상태입니다.</p>
        ) : null}
        <div className="row">
          {["넥슨", "NC소프트", "넷마블", "크래프톤"].map((name) => (
            <button key={name} className={companies.includes(name) ? "chip active" : "chip"} onClick={() => toggleCompany(name)}>
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
          <button className="primary" onClick={runAnalyze} disabled={COMPARE_COLLECTION_DISABLED || loading || companies.length === 0}>
            {COMPARE_COLLECTION_DISABLED ? "수집 잠금" : loading ? "분석 중..." : "수집 시작"}
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
            <h3>일별 보도량 추이 (최근 14일)</h3>
            <div className="trendGrid">
              {trendSeries.map((series) => (
                <article key={series.company} className="trendCard">
                  <h4>{series.company}</h4>
                  <div className="sparkline">
                    {series.points.map((p) => (
                      <div key={`${series.company}-${p.date}`} className="barWrap" title={`${p.date}: ${p.value}건`}>
                        <div className="bar" style={{ height: `${(p.value / series.max) * 100}%` }} />
                      </div>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="panel">
            <h3>감성 분석</h3>
            <div className="sentimentGrid">
              {selectedFromData.map((company) => {
                const row = sentimentByCompany[company] || { 긍정: 0, 중립: 0, 부정: 0 };
                return (
                  <article key={company} className="sentimentCard">
                    <h4>{company}</h4>
                    {SENTIMENTS.map((s) => (
                      <div key={`${company}-${s}`} className="sentRow">
                        <span>{s}</span>
                        <div className="sentTrack">
                          <div className={`sentFill ${s}`} style={{ width: ratioToWidth(row[s]) }} />
                        </div>
                        <strong>{Number(row[s] || 0).toFixed(1)}%</strong>
                      </div>
                    ))}
                  </article>
                );
              })}
            </div>
          </section>

          <section className="panel">
            <h3>회사별 키워드</h3>
            <div className="keywordGrid">
              {keywordCards.map((card) => (
                <article key={card.company} className="keywordCard">
                  <h4>{card.company}</h4>
                  <div className="keywordList">
                    {card.items.map((it) => (
                      <span key={`${card.company}-${it.keyword}`} className="keywordPill">
                        {it.keyword} · {it.count}
                      </span>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="panel">
            <h3>핵심 인사이트</h3>
            <div className="insightGrid">
              <article className="insightCard">
                <h4>Top 5 이슈</h4>
                <ul>
                  {(insights.top_issues || []).map((item, idx) => (
                    <li key={`${item.company}-${item.keyword}-${idx}`}>
                      <strong>{item.company}</strong> · {item.keyword} ({item.count}건, {item.share_pct}%)
                      <br />
                      <span>{item.example_title}</span>
                    </li>
                  ))}
                </ul>
              </article>

              <article className="insightCard">
                <h4>경쟁사 대비 변화(최근 7일 vs 이전 7일)</h4>
                <ul>
                  {(insights.competitive_changes || []).map((item) => (
                    <li key={item.company}>
                      <strong>{item.company}</strong> · 보도량 {item.article_change_pct}% / 부정비중 {item.negative_ratio_change_pp}%p
                    </li>
                  ))}
                </ul>
              </article>

              <article className="insightCard">
                <h4>리스크 알림</h4>
                {(insights.risk_alerts || []).length === 0 ? (
                  <p className="muted">현재 규칙 기준 고위험 신호는 없습니다.</p>
                ) : (
                  <ul>
                    {insights.risk_alerts.map((item, idx) => (
                      <li key={`${item.company}-${idx}`}>
                        <strong>{item.company}</strong> [{item.level.toUpperCase()}] {item.reason}
                      </li>
                    ))}
                  </ul>
                )}
              </article>

              <article className="insightCard">
                <h4>실행 제안</h4>
                <ul>
                  {(insights.actions || []).map((item) => (
                    <li key={`${item.company}-${item.priority}`}>
                      <strong>{item.company}</strong> ({item.priority}) {item.action}
                    </li>
                  ))}
                </ul>
              </article>
            </div>
          </section>

          <section className="panel">
            <h3>최신 기사 목록</h3>
            <div className="filters">
              <label>
                회사
                <select value={filterCompany} onChange={(e) => setFilterCompany(e.target.value)}>
                  <option value="전체">전체</option>
                  {selectedFromData.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                감성
                <select value={filterSentiment} onChange={(e) => setFilterSentiment(e.target.value)}>
                  <option value="전체">전체</option>
                  {SENTIMENTS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
              <span className="resultCount">
                {dataSource === "live" ? `불러온 기사: ${displayedCount} / ${totalCount}` : `필터 결과: ${displayedCount}건`}
              </span>
            </div>
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
                {displayedArticles.map((a, idx) => (
                  <tr key={`${a.url}-${idx}`}>
                    <td>{a.company}</td>
                    <td>{a.url ? <a href={a.url} target="_blank" rel="noreferrer">{a.title}</a> : a.title}</td>
                    <td>{a.sentiment}</td>
                    <td>{a.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {dataSource === "live" ? (
              <div ref={sentinelRef} className="articleSentinel">
                {articleLoading ? "기사 불러오는 중..." : articleHasMore ? "아래로 스크롤하면 계속 불러옵니다." : "마지막 기사입니다."}
              </div>
            ) : null}
          </section>
        </>
      )}
    </main>
  );
}
