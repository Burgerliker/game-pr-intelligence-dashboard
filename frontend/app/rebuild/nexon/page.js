"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiGet, getDiagnosticCode } from "../../../lib/api";
import { BlockTitle, RebuildNav, StatusPill } from "../_components/ui";

const PAGE_SIZE = 20;
const n = (v) => Number(v || 0);

function statusFromRisk(score) {
  const v = n(score);
  if (v >= 70) return { label: "위기", tone: "critical", color: "#b91c1c", bg: "#fff1f2", border: "#fecdd3" };
  if (v >= 45) return { label: "경고", tone: "warning", color: "#c2410c", bg: "#fff7ed", border: "#fed7aa" };
  if (v >= 20) return { label: "주의", tone: "caution", color: "#a16207", bg: "#fefce8", border: "#fde68a" };
  return { label: "정상", tone: "normal", color: "#166534", bg: "#ecfdf5", border: "#bbf7d0" };
}

function hoursAgo(ts) {
  const t = new Date(ts || "").getTime();
  if (!Number.isFinite(t)) return Number.POSITIVE_INFINITY;
  return (Date.now() - t) / 3600000;
}

function toRelativeTime(ts) {
  const h = hoursAgo(ts);
  if (!Number.isFinite(h)) return "시간 미상";
  if (h < 1) return "1시간 이내";
  if (h < 24) return `${Math.floor(h)}시간 전`;
  return `${Math.floor(h / 24)}일 전`;
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

  const fetchArticles = useCallback(
    async (targetIp, reset) => {
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
    },
    [offset]
  );

  useEffect(() => {
    fetchDashboard(ip);
    fetchArticles(ip, true);
    setShowEvents(false);
    setEventVisible(10);
  }, [ip, fetchDashboard, fetchArticles]);

  const catalog =
    riskData?.ip_catalog?.length > 0
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
  const issueBundles = n(clusters?.clusters?.length);

  const daily = (riskData?.daily || []).slice(-14);
  const dailyMax = Math.max(1, ...daily.map((r) => n(r.total_mentions ?? r.mention_count ?? r.article_count)));
  const heatRows = (riskTimeseries || []).slice(-14).map((r) => ({
    ts: r.ts || r.timestamp,
    risk: n(r.risk_score ?? r.risk),
    heat: n(r.total_mentions ?? r.mention_count ?? r.article_count ?? r.heat),
  }));
  const heatMax = Math.max(1, ...heatRows.map((x) => x.heat));

  const filteredEvents = useMemo(() => {
    const h = eventWindow === "24h" ? 24 : 168;
    return burstEvents.filter((e) => hoursAgo(e.ts || e.created_at) <= h);
  }, [burstEvents, eventWindow]);
  const visibleEvents = filteredEvents.slice(0, eventVisible);

  const latestEventAt = filteredEvents[0]?.ts || filteredEvents[0]?.created_at;
  const eventBadge = filteredEvents.length > 0 ? "이벤트 있음" : "이벤트 없음";

  const actionGuide = useMemo(() => {
    if (score >= 70 || negative >= 35) return "비판 기사와 이슈 묶음 상위 3개를 즉시 확인하고, 담당자 공유를 권장합니다.";
    if (score >= 45 || filteredEvents.length >= 3) return "급등 구간 기사 제목/매체를 우선 검토하고 오늘 공지 일정과 충돌 여부를 점검하세요.";
    if (score >= 20) return "현재는 모니터링 강화 구간입니다. 2시간 단위로 이벤트 탭을 확인하세요.";
    return "현재는 안정 구간입니다. 자동 수집 상태 유지하며 일일 브리핑용 캡처만 준비하면 됩니다.";
  }, [score, negative, filteredEvents.length]);

  return (
    <main className="space-y-4">
      <RebuildNav
        title={ip === "maplestory" ? "메이플스토리 실시간 여론 모니터" : "IP 실시간 여론 모니터"}
        subtitle="현재 상태, 노출량, 급등 이벤트, 근거 기사까지 한 화면에서 바로 확인합니다."
        actions={[
          { label: "메인", href: "/rebuild" },
          { label: "경쟁사 비교", href: "/rebuild/compare" },
          { label: "과거 분석", href: "/rebuild/nexon/backtest", primary: true },
          { label: loading ? "갱신 중" : "새로고침", onClick: () => fetchDashboard(ip) },
        ]}
      />

      <section className="rb-card p-4 md:p-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-black text-slate-500">모니터링 IP</span>
          {catalog.map((c) => (
            <button
              key={c.id}
              type="button"
              className="rb-btn"
              style={ip === c.id ? { background: "#0f172a", color: "#fff", borderColor: "#0f172a" } : undefined}
              onClick={() => setIp(c.id)}
            >
              {c.name || c.id}
            </button>
          ))}
        </div>
      </section>

      {error ? <section className="rb-card border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">{error}</section> : null}

      <section className="rb-card p-4 md:p-5" style={{ background: status.bg, borderColor: status.border }}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <StatusPill tone={status.tone} label={`현재 상태: ${status.label}`} />
          <p className="text-xs text-slate-500">마지막 갱신: {lastUpdated || "-"}</p>
        </div>
        <p className="mt-3 text-sm font-bold" style={{ color: status.color }}>
          {actionGuide}
        </p>
      </section>

      <section className="rb-grid-4">
        <article className="rb-card p-4">
          <p className="text-xs font-extrabold uppercase tracking-wider text-slate-500">위기 지수</p>
          <p className="mt-2 text-4xl font-black leading-none tabular-nums">{score.toFixed(1)}</p>
          <p className="mt-2 text-xs text-slate-500">0~100 실시간 스코어</p>
        </article>
        <article className="rb-card p-4">
          <p className="text-xs font-extrabold uppercase tracking-wider text-slate-500">최근 24시간 노출량</p>
          <p className="mt-2 text-4xl font-black leading-none tabular-nums">{recentExposure}</p>
          <p className="mt-2 text-xs text-slate-500">위험도 계산 입력값</p>
        </article>
        <article className="rb-card p-4">
          <p className="text-xs font-extrabold uppercase tracking-wider text-slate-500">총 노출량(재배포 포함)</p>
          <p className="mt-2 text-4xl font-black leading-none tabular-nums">{totalExposure}</p>
          <p className="mt-2 text-xs text-slate-500">중복 적재 제외, 확산 포함</p>
        </article>
        <article className="rb-card p-4">
          <p className="text-xs font-extrabold uppercase tracking-wider text-slate-500">부정 비율 / 이슈 묶음</p>
          <p className="mt-2 text-4xl font-black leading-none tabular-nums">{negative.toFixed(1)}%</p>
          <p className="mt-2 text-xs text-slate-500">이슈 묶음 {issueBundles}개</p>
        </article>
      </section>

      <section className="rb-grid-2">
        <article className="rb-card p-4 md:p-5">
          <BlockTitle title="일자별 노출량/부정 추이" sub="막대: 노출량(건), 우측: 부정 비율(%)" />
          <div className="space-y-2">
            {daily.map((d) => {
              const exposure = n(d.total_mentions ?? d.mention_count ?? d.article_count);
              const neg = n(d.negative_ratio);
              return (
                <div key={d.date} className="grid grid-cols-[84px_1fr_64px_64px] items-center gap-2">
                  <span className="text-xs text-slate-500">{d.date}</span>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full bg-[#0f3b66]" style={{ width: `${(exposure / dailyMax) * 100}%` }} />
                  </div>
                  <span className="text-right text-xs font-black tabular-nums">{exposure}</span>
                  <span className="text-right text-xs text-slate-500">{neg.toFixed(1)}%</span>
                </div>
              );
            })}
            {!daily.length ? <p className="text-sm text-slate-500">표시할 일자 데이터가 없습니다.</p> : null}
          </div>
        </article>

        <article className="rb-card p-4 md:p-5">
          <BlockTitle title="Risk vs Heat" sub="Risk=부정 신호 강도, Heat=언급/관심도" />
          <div className="space-y-3">
            {heatRows.map((r, idx) => (
              <article key={`${r.ts || idx}-${idx}`} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs text-slate-500">{String(r.ts || "").slice(5, 16)}</p>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <div>
                    <p className="mb-1 text-[11px] font-black text-slate-500">Risk {r.risk.toFixed(1)}</p>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                      <div className="h-full" style={{ width: `${Math.max(0, Math.min(100, r.risk))}%`, background: "#d43838" }} />
                    </div>
                  </div>
                  <div>
                    <p className="mb-1 text-[11px] font-black text-slate-500">Heat {r.heat}</p>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                      <div className="h-full" style={{ width: `${(r.heat / heatMax) * 100}%`, background: "#0f3b66" }} />
                    </div>
                  </div>
                </div>
              </article>
            ))}
            {!heatRows.length ? <p className="text-sm text-slate-500">시계열 데이터가 없습니다.</p> : null}
          </div>
        </article>
      </section>

      <section className="rb-grid-2">
        <article className="rb-card p-4 md:p-5">
          <BlockTitle title="급등 감지" sub="기본은 요약만 표시, 버튼 클릭 시 리스트 확장" />
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="rb-btn"
              onClick={() => {
                setEventWindow("24h");
                setEventVisible(10);
              }}
              style={eventWindow === "24h" ? { background: "#0f172a", color: "#fff", borderColor: "#0f172a" } : undefined}
            >
              24h
            </button>
            <button
              type="button"
              className="rb-btn"
              onClick={() => {
                setEventWindow("7d");
                setEventVisible(10);
              }}
              style={eventWindow === "7d" ? { background: "#0f172a", color: "#fff", borderColor: "#0f172a" } : undefined}
            >
              7d
            </button>
            <span className="rb-chip">{eventBadge}</span>
          </div>

          <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
            <p className="font-bold">최근 {eventWindow === "24h" ? "24시간" : "7일"} 이벤트 {filteredEvents.length}건</p>
            <p className="mt-1 text-slate-600">마지막 발생: {latestEventAt ? `${latestEventAt} (${toRelativeTime(latestEventAt)})` : "없음"}</p>
            <p className="mt-1 text-slate-600">최근 30분 이벤트: {n(burstStatus?.recent_count_30m)}건</p>
          </div>

          <div className="mt-3">
            <button
              type="button"
              className="rb-btn"
              onClick={() => {
                const next = !showEvents;
                setShowEvents(next);
                if (next) setEventVisible(10);
              }}
            >
              {showEvents ? "이벤트 숨기기" : "이벤트 보기"}
            </button>
          </div>

          {showEvents ? (
            <div className="mt-3 space-y-2">
              {visibleEvents.map((e, i) => (
                <article key={`${e.ts || e.created_at || i}-${i}`} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">{e.ts || e.created_at || "-"}</p>
                  <p className="mt-1 text-sm font-black">{e.ip || "-"} · score {n(e.risk_score ?? e.score).toFixed(1)}</p>
                </article>
              ))}
              {!visibleEvents.length ? <p className="text-sm text-slate-500">표시할 이벤트가 없습니다.</p> : null}
              {eventVisible < filteredEvents.length ? (
                <button type="button" className="rb-btn" onClick={() => setEventVisible((v) => v + 10)}>
                  더보기 +10
                </button>
              ) : null}
            </div>
          ) : null}
        </article>

        <article className="rb-card p-4 md:p-5">
          <BlockTitle title="이슈 묶음" sub="현재 묶음별 기사 수와 부정 비율" />
          <div className="space-y-2">
            {(clusters?.clusters || []).slice(0, 10).map((c, i) => (
              <article key={`${c.keyword || c.cluster_key || i}-${i}`} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-sm font-black">{c.keyword || c.cluster_key || "테마"}</p>
                <p className="mt-1 text-xs text-slate-500">기사 {n(c.article_count)}건 / 부정 {n(c.negative_ratio).toFixed(1)}%</p>
              </article>
            ))}
            {!clusters?.clusters?.length ? <p className="text-sm text-slate-500">이슈 묶음 데이터가 없습니다.</p> : null}
          </div>
        </article>
      </section>

      <section className="rb-card p-4 md:p-5">
        <BlockTitle title="최신 기사" sub={`총 ${total}건`} />
        <div className="space-y-2">
          {items.map((a, i) => (
            <article key={`${a.id || a.url || i}-${i}`} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs text-slate-500">{a.pub_date || a.created_at || "-"} · {a.outlet || a.media || "-"}</p>
              <p className="mt-1 text-sm font-black text-slate-900">{a.title || "제목 없음"}</p>
            </article>
          ))}
          {!items.length && !articleLoading ? <p className="text-sm text-slate-500">기사 데이터가 없습니다.</p> : null}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {hasMore ? (
            <button type="button" className="rb-btn" disabled={articleLoading} onClick={() => fetchArticles(ip, false)}>
              {articleLoading ? "불러오는 중..." : "기사 더보기"}
            </button>
          ) : null}
          {loading ? <span className="text-xs text-slate-500">대시보드 갱신 중</span> : null}
          {health?.scheduler_running === false ? <span className="text-xs font-bold text-red-700">수집 상태 확인 필요</span> : null}
        </div>
      </section>
    </main>
  );
}
