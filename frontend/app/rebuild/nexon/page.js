"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { apiGet, getDiagnosticCode } from "../../../lib/api";

const PAGE_SIZE = 20;
const n = (v) => Number(v || 0);

function statusFromRisk(score) {
  const v = n(score);
  if (v >= 70) return { label: "위기", color: "#b91c1c", bg: "#fef2f2", border: "#fecaca" };
  if (v >= 45) return { label: "경고", color: "#c2410c", bg: "#fff7ed", border: "#fed7aa" };
  if (v >= 20) return { label: "주의", color: "#a16207", bg: "#fef9c3", border: "#fde68a" };
  return { label: "정상", color: "#166534", bg: "#ecfdf3", border: "#bbf7d0" };
}

function hoursAgo(ts) {
  const t = new Date(ts || "").getTime();
  if (!Number.isFinite(t)) return Number.POSITIVE_INFINITY;
  return (Date.now() - t) / 3600000;
}

export default function RebuildNexonPage() {
  const [ip, setIp] = useState("maplestory");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [riskData, setRiskData] = useState({ meta: {}, daily: [], outlets: [], risk_themes: [], ip_catalog: [] });
  const [clusters, setClusters] = useState({ clusters: [] });
  const [riskScore, setRiskScore] = useState(null);
  const [riskTimeseries, setRiskTimeseries] = useState([]);
  const [burstStatus, setBurstStatus] = useState(null);
  const [burstEvents, setBurstEvents] = useState([]);
  const [health, setHealth] = useState(null);
  const [lastUpdated, setLastUpdated] = useState("");

  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [articleLoading, setArticleLoading] = useState(false);

  const [showEvents, setShowEvents] = useState(false);
  const [eventWindow, setEventWindow] = useState("24h");
  const [eventVisible, setEventVisible] = useState(10);

  const fetchDashboard = useCallback(async (targetIp) => {
    setLoading(true);
    setError("");
    try {
      const base = new URLSearchParams({ ip: targetIp });
      const [rd, cl, rs, rt, bs, be, h] = await Promise.all([
        apiGet(`/api/risk-dashboard?${base.toString()}`),
        apiGet(`/api/ip-clusters?${base.toString()}&limit=6`),
        apiGet(`/api/risk-score?ip=${targetIp}`).catch(() => null),
        apiGet(`/api/risk-timeseries?ip=${targetIp}&hours=168&limit=600`).catch(() => null),
        apiGet("/api/burst-status").catch(() => null),
        apiGet("/api/burst-events?limit=50").catch(() => null),
        apiGet("/api/health").catch(() => null),
      ]);
      setRiskData(rd || { meta: {}, daily: [], outlets: [], risk_themes: [], ip_catalog: [] });
      setClusters(cl || { clusters: [] });
      setRiskScore(rs);
      setRiskTimeseries(rt?.items || []);
      setBurstStatus(bs);
      setBurstEvents((be?.items || []).slice(0, 50));
      setHealth(h);
      setLastUpdated(new Date().toLocaleString("ko-KR", { hour12: false }));
    } catch (e) {
      setError(`대시보드를 불러오지 못했습니다. (${getDiagnosticCode(e, "RB-NEX")})`);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchArticles = useCallback(async (targetIp, reset) => {
    const next = reset ? 0 : offset;
    if (reset) {
      setItems([]);
      setOffset(0);
      setHasMore(false);
      setTotal(0);
    }
    setArticleLoading(true);
    try {
      const p = await apiGet(`/api/nexon-articles?ip=${encodeURIComponent(targetIp)}&limit=${PAGE_SIZE}&offset=${next}`);
      const nextItems = p?.items || [];
      setItems((prev) => (reset ? nextItems : [...prev, ...nextItems]));
      setTotal(n(p?.total));
      setOffset(next + nextItems.length);
      setHasMore(Boolean(p?.has_more));
    } finally {
      setArticleLoading(false);
    }
  }, [offset]);

  useEffect(() => {
    fetchDashboard(ip);
    fetchArticles(ip, true);
    setShowEvents(false);
    setEventVisible(10);
  }, [ip, fetchDashboard, fetchArticles]);

  const catalog = riskData?.ip_catalog?.length
    ? riskData.ip_catalog
    : [
        { id: "all", name: "넥슨 전체" },
        { id: "maplestory", name: "메이플스토리" },
        { id: "dnf", name: "던전앤파이터" },
        { id: "arcraiders", name: "아크 레이더스" },
        { id: "bluearchive", name: "블루 아카이브" },
        { id: "fconline", name: "FC온라인" },
      ];

  const score = n(riskScore?.risk_score);
  const status = statusFromRisk(score);
  const recentExposure = n(riskScore?.exposure_count_window ?? riskScore?.article_count_window);
  const totalExposure = n(riskData?.meta?.total_mentions ?? riskData?.meta?.total_articles);
  const negative = n(riskScore?.negative_ratio_window);

  const daily = (riskData?.daily || []).slice(-14);
  const dailyMax = Math.max(1, ...daily.map((r) => n(r.total_mentions ?? r.mention_count ?? r.article_count)));

  const heatRows = (riskTimeseries || []).slice(-18).map((r) => ({
    ts: r.ts || r.timestamp,
    risk: n(r.risk_score ?? r.risk),
    heat: n(r.heat ?? r.total_mentions ?? r.article_count),
  }));

  const filteredEvents = useMemo(() => {
    const h = eventWindow === "24h" ? 24 : 168;
    return burstEvents.filter((e) => hoursAgo(e.ts || e.created_at) <= h);
  }, [burstEvents, eventWindow]);

  const visibleEvents = filteredEvents.slice(0, eventVisible);

  return (
    <main style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <section className="rb-card" style={{ padding: 22 }}>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <div>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 800, letterSpacing: ".18em", textTransform: "uppercase", color: "#60708b" }}>Realtime Monitor</p>
            <h1 style={{ margin: "6px 0 0", fontSize: "clamp(26px,4.6vw,36px)", lineHeight: 1.1 }}>IP 여론 모니터</h1>
            <p style={{ margin: "8px 0 0", fontSize: 14, color: "#5f6b7f" }}>현재 위험 상태, 확산량, 이슈 묶음, 기사 원문을 한 번에 확인합니다.</p>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <Link className="rb-btn" href="/rebuild">메인</Link>
            <Link className="rb-btn" href="/rebuild/compare">경쟁사 비교</Link>
            <Link className="rb-btn rb-btn-primary" href="/rebuild/nexon/backtest">과거 분석</Link>
            <button className="rb-btn" onClick={() => fetchDashboard(ip)}>새로고침</button>
          </div>
        </div>

        <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 8 }}>
          {catalog.map((c) => (
            <button key={c.id} className="rb-btn" style={ip === c.id ? { background: "#0f172a", color: "#fff", borderColor: "#0f172a" } : undefined} onClick={() => setIp(c.id)}>
              {c.name || c.id}
            </button>
          ))}
        </div>
      </section>

      {error ? <section className="rb-card" style={{ padding: 14, borderColor: "#fecaca", background: "#fff1f2", color: "#b91c1c", fontWeight: 700 }}>{error}</section> : null}

      <section className="rb-card" style={{ padding: 16 }}>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <span className="rb-chip" style={{ background: status.bg, borderColor: status.border, color: status.color }}>현재 상태: {status.label}</span>
          <span style={{ fontSize: 12, color: "#60708b" }}>마지막 갱신: {lastUpdated || "-"}</span>
        </div>
        <div className="rb-grid-4" style={{ marginTop: 10 }}>
          <article style={{ border: "1px solid #dbe3ef", borderRadius: 14, background: "#f7faff", padding: 12 }}><p style={{ margin: 0, fontSize: 12, color: "#60708b", fontWeight: 800 }}>위기 지수</p><p style={{ margin: "8px 0 0", fontSize: 34, fontWeight: 900 }}>{score.toFixed(1)}</p></article>
          <article style={{ border: "1px solid #dbe3ef", borderRadius: 14, background: "#f7faff", padding: 12 }}><p style={{ margin: 0, fontSize: 12, color: "#60708b", fontWeight: 800 }}>최근 24h 노출량</p><p style={{ margin: "8px 0 0", fontSize: 34, fontWeight: 900 }}>{recentExposure}</p></article>
          <article style={{ border: "1px solid #dbe3ef", borderRadius: 14, background: "#f7faff", padding: 12 }}><p style={{ margin: 0, fontSize: 12, color: "#60708b", fontWeight: 800 }}>부정 비율</p><p style={{ margin: "8px 0 0", fontSize: 34, fontWeight: 900 }}>{negative.toFixed(1)}%</p></article>
          <article style={{ border: "1px solid #dbe3ef", borderRadius: 14, background: "#f7faff", padding: 12 }}><p style={{ margin: 0, fontSize: 12, color: "#60708b", fontWeight: 800 }}>총 노출량(재배포 포함)</p><p style={{ margin: "8px 0 0", fontSize: 34, fontWeight: 900 }}>{totalExposure}</p></article>
        </div>
      </section>

      <section className="rb-grid-2">
        <article className="rb-card" style={{ padding: 16 }}>
          <h2 style={{ margin: 0, fontSize: 20 }}>일자별 노출량/부정 추이</h2>
          <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 7 }}>
            {daily.map((d) => {
              const exposure = n(d.total_mentions ?? d.mention_count ?? d.article_count);
              const neg = n(d.negative_ratio);
              return (
                <div key={d.date} style={{ display: "grid", gridTemplateColumns: "88px 1fr 72px 76px", gap: 8, alignItems: "center" }}>
                  <span style={{ fontSize: 12, color: "#6f7b90" }}>{d.date}</span>
                  <div style={{ height: 8, borderRadius: 999, overflow: "hidden", background: "#e5ecf6" }}><div style={{ width: `${(exposure / dailyMax) * 100}%`, height: "100%", background: "#0f3b66" }} /></div>
                  <span style={{ textAlign: "right", fontSize: 12, fontWeight: 900 }}>{exposure}건</span>
                  <span style={{ textAlign: "right", fontSize: 12, color: "#60708b" }}>부정 {neg.toFixed(1)}%</span>
                </div>
              );
            })}
            {!daily.length ? <p style={{ margin: 0, fontSize: 13, color: "#60708b" }}>데이터가 없습니다.</p> : null}
          </div>
        </article>

        <article className="rb-card" style={{ padding: 16 }}>
          <h2 style={{ margin: 0, fontSize: 20 }}>Risk vs Heat</h2>
          <p style={{ margin: "6px 0 0", fontSize: 12, color: "#60708b" }}>Risk는 부정 신호 강도, Heat는 언급량/관심도입니다.</p>
          <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
            {heatRows.map((r, i) => (
              <article key={`${r.ts || i}-${i}`} style={{ border: "1px solid #dbe3ef", borderRadius: 12, background: "#f7faff", padding: 9 }}>
                <p style={{ margin: 0, fontSize: 12, color: "#6f7b90" }}>{String(r.ts || "").slice(5, 16)}</p>
                <p style={{ margin: "4px 0 0", fontSize: 13, fontWeight: 800 }}>Risk {r.risk.toFixed(1)} / Heat {r.heat}</p>
              </article>
            ))}
            {!heatRows.length ? <p style={{ margin: 0, fontSize: 13, color: "#60708b" }}>시계열 데이터 없음</p> : null}
          </div>
        </article>
      </section>

      <section className="rb-grid-2">
        <article className="rb-card" style={{ padding: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <h2 style={{ margin: 0, fontSize: 20 }}>급등 감지 이벤트</h2>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="rb-btn" onClick={() => { setEventWindow("24h"); setEventVisible(10); }} style={eventWindow === "24h" ? { background: "#0f172a", color: "#fff", borderColor: "#0f172a" } : undefined}>24h</button>
              <button className="rb-btn" onClick={() => { setEventWindow("7d"); setEventVisible(10); }} style={eventWindow === "7d" ? { background: "#0f172a", color: "#fff", borderColor: "#0f172a" } : undefined}>7d</button>
            </div>
          </div>
          <p style={{ margin: "6px 0 0", fontSize: 13, color: "#60708b" }}>최근 {eventWindow === "24h" ? "24시간" : "7일"} 이벤트 {filteredEvents.length}건 / 최근 30분 {n(burstStatus?.recent_count_30m)}건</p>
          <div style={{ marginTop: 8 }}>
            <button className="rb-btn" onClick={() => { const next = !showEvents; setShowEvents(next); if (next) setEventVisible(10); }}>{showEvents ? "이벤트 숨기기" : "이벤트 보기"}</button>
          </div>
          {showEvents ? (
            <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
              {visibleEvents.map((e, i) => (
                <article key={`${e.ts || e.created_at || i}-${i}`} style={{ border: "1px solid #dbe3ef", borderRadius: 12, background: "#f7faff", padding: 10 }}>
                  <p style={{ margin: 0, fontSize: 12, color: "#6f7b90" }}>{e.ts || e.created_at || "-"}</p>
                  <p style={{ margin: "4px 0 0", fontSize: 13, fontWeight: 800 }}>{e.ip || "-"} · score {n(e.risk_score ?? e.score).toFixed(1)}</p>
                </article>
              ))}
              {!visibleEvents.length ? <p style={{ margin: 0, fontSize: 13, color: "#60708b" }}>표시할 이벤트 없음</p> : null}
              {eventVisible < filteredEvents.length ? <button className="rb-btn" onClick={() => setEventVisible((v) => v + 10)}>더보기 +10</button> : null}
            </div>
          ) : null}
        </article>

        <article className="rb-card" style={{ padding: 16 }}>
          <h2 style={{ margin: 0, fontSize: 20 }}>이슈 묶음</h2>
          <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
            {(clusters?.clusters || []).slice(0, 10).map((c, i) => (
              <article key={`${c.keyword || c.cluster_key || i}-${i}`} style={{ border: "1px solid #dbe3ef", borderRadius: 12, background: "#f7faff", padding: 10 }}>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 800 }}>{c.keyword || c.cluster_key || "테마"}</p>
                <p style={{ margin: "4px 0 0", fontSize: 12, color: "#60708b" }}>기사 {n(c.article_count)}건 / 부정 {n(c.negative_ratio).toFixed(1)}%</p>
              </article>
            ))}
            {!clusters?.clusters?.length ? <p style={{ margin: 0, fontSize: 13, color: "#60708b" }}>이슈 묶음 없음</p> : null}
          </div>
        </article>
      </section>

      <section className="rb-card" style={{ padding: 16 }}>
        <h2 style={{ margin: 0, fontSize: 20 }}>최신 기사</h2>
        <p style={{ margin: "6px 0 0", fontSize: 12, color: "#60708b" }}>총 {total}건</p>
        <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
          {items.map((a, i) => (
            <article key={`${a.id || a.url || i}-${i}`} style={{ border: "1px solid #dbe3ef", borderRadius: 12, background: "#f7faff", padding: 10 }}>
              <p style={{ margin: 0, fontSize: 12, color: "#6f7b90" }}>{a.pub_date || a.created_at || "-"} · {a.outlet || a.media || "-"}</p>
              <p style={{ margin: "5px 0 0", fontSize: 14, fontWeight: 800 }}>{a.title || "제목 없음"}</p>
            </article>
          ))}
          {!items.length && !articleLoading ? <p style={{ margin: 0, fontSize: 13, color: "#60708b" }}>기사 없음</p> : null}
        </div>
        <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {hasMore ? <button className="rb-btn" disabled={articleLoading} onClick={() => fetchArticles(ip, false)}>{articleLoading ? "불러오는 중..." : "기사 더보기"}</button> : null}
          {loading ? <span style={{ fontSize: 12, color: "#60708b" }}>대시보드 갱신 중</span> : null}
          {health?.scheduler_running === false ? <span style={{ fontSize: 12, color: "#b91c1c", fontWeight: 700 }}>수집 상태 확인 필요</span> : null}
        </div>
      </section>
    </main>
  );
}
