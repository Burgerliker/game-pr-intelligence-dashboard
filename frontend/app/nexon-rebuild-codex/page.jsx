'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  RefreshCw,
  ShieldAlert,
  TriangleAlert,
} from 'lucide-react';
import { apiGet, getDiagnosticCode, getErrorMessage } from '../../lib/api';
import { createEmptyCluster, createEmptyRisk, normalizeNexonDashboard } from '../../lib/normalizeNexon';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '../../components/ui/alert';
import { Progress } from '../../components/ui/progress';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../../components/ui/collapsible';

const USE_MOCK_FALLBACK = process.env.NEXT_PUBLIC_USE_MOCK_FALLBACK === 'true';
const SHOW_BACKTEST = process.env.NEXT_PUBLIC_SHOW_BACKTEST === 'true';
const NEXON_LOGO = '/nexon-logo.png';
const REFRESH_MS = 60_000;
const ARTICLE_PAGE_SIZE = 20;

const IP_BANNER_STYLE = {
  all: { kicker: 'NEXON OVERVIEW', accent: '#8fb6ff', bg: '#0f172a' },
  maplestory: { kicker: 'MAPLESTORY', accent: '#f5c16c', bg: '#2d1b05' },
  dnf: { kicker: 'DNF', accent: '#ff9db0', bg: '#2b1111' },
  arcraiders: { kicker: 'ARC RAIDERS', accent: '#8de5ff', bg: '#18242d' },
  bluearchive: { kicker: 'BLUE ARCHIVE', accent: '#a6bcff', bg: '#1b2442' },
  fconline: { kicker: 'FC ONLINE', accent: '#9fe8c2', bg: '#0f2f27' },
};

const MOCK_RISK = {
  meta: { company: '넥슨', ip: '메이플스토리', ip_id: 'maplestory', date_from: '2024-01-01', date_to: '2026-12-31', total_articles: 0 },
  daily: [
    { date: '2026-02-17', article_count: 5, negative_ratio: 20 },
    { date: '2026-02-18', article_count: 8, negative_ratio: 25 },
    { date: '2026-02-19', article_count: 6, negative_ratio: 18 },
  ],
  outlets: [
    { outlet: 'inven.co.kr', article_count: 5, negative_ratio: 20 },
    { outlet: 'thisisgame.com', article_count: 4, negative_ratio: 15 },
    { outlet: 'newsis.com', article_count: 3, negative_ratio: 34 },
  ],
  risk_themes: [
    { theme: '확률형/BM', article_count: 7, negative_ratio: 31, risk_score: 0.88 },
    { theme: '운영/장애', article_count: 4, negative_ratio: 18, risk_score: 0.43 },
    { theme: '보상/환불', article_count: 3, negative_ratio: 14, risk_score: 0.29 },
  ],
  ip_catalog: [
    { id: 'all', name: '넥슨 (전체보기)' },
    { id: 'maplestory', name: '메이플스토리' },
    { id: 'dnf', name: '던전앤파이터' },
    { id: 'arcraiders', name: '아크레이더스' },
    { id: 'fconline', name: 'FC온라인' },
    { id: 'bluearchive', name: '블루아카이브' },
  ],
};

const MOCK_CLUSTER = {
  meta: { cluster_count: 3, total_articles: 12 },
  keyword_cloud: [
    { word: '업데이트', count: 10 },
    { word: '확률', count: 8 },
    { word: '보상', count: 7 },
    { word: '이벤트', count: 5 },
  ],
  clusters: [
    { cluster: '확률형/BM', article_count: 7, negative_ratio: 31, keywords: ['확률', '과금', 'BM'], samples: ['확률형 공지 업데이트'] },
    { cluster: '운영/장애', article_count: 3, negative_ratio: 20, keywords: ['점검', '장애'], samples: ['긴급 점검 공지'] },
    { cluster: '보상/환불', article_count: 2, negative_ratio: 12, keywords: ['보상', '환불'], samples: ['보상 지급 안내'] },
  ],
};

function toneByScore(score) {
  const value = Number(score || 0);
  if (value >= 70) return { label: '심각', badge: 'warning' };
  if (value >= 45) return { label: '높음', badge: 'warning' };
  if (value >= 20) return { label: '주의', badge: 'default' };
  return { label: '낮음', badge: 'success' };
}

function shortTime(input) {
  if (!input) return '-';
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleTimeString('ko-KR', { hour12: false });
}

function cx(...parts) {
  return parts.filter(Boolean).join(' ');
}

export default function NexonRebuildCodexPage() {
  const [ip, setIp] = useState('maplestory');
  const [riskData, setRiskData] = useState(() => createEmptyRisk('maplestory'));
  const [clusterData, setClusterData] = useState(() => createEmptyCluster('maplestory'));
  const [riskScore, setRiskScore] = useState(null);
  const [health, setHealth] = useState(null);
  const [burstStatus, setBurstStatus] = useState(null);
  const [burstEvents, setBurstEvents] = useState([]);
  const [articleItems, setArticleItems] = useState([]);
  const [articleOffset, setArticleOffset] = useState(0);
  const [articleHasMore, setArticleHasMore] = useState(false);
  const [articleLoading, setArticleLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [usingMock, setUsingMock] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [errorCode, setErrorCode] = useState('');
  const [healthDiagCode, setHealthDiagCode] = useState('');
  const [showDetail, setShowDetail] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState('');
  const reqSeqRef = useRef(0);

  const catalog = riskData?.ip_catalog?.length ? riskData.ip_catalog : MOCK_RISK.ip_catalog;
  const currentIndex = Math.max(0, catalog.findIndex((x) => x.id === ip));
  const currentBanner = catalog[currentIndex] || { id: ip, name: ip };
  const bannerVisual = IP_BANNER_STYLE[currentBanner.id] || IP_BANNER_STYLE.all;

  const loadArticles = useCallback(
    async (targetIp, offset = 0) => {
      setArticleLoading(true);
      try {
        const payload = await apiGet(`/api/articles?ip=${targetIp}&limit=${ARTICLE_PAGE_SIZE}&offset=${offset}`);
        setArticleItems((prev) => (offset === 0 ? payload?.items || [] : [...prev, ...(payload?.items || [])]));
        setArticleOffset(offset);
        const total = Number(payload?.total || 0);
        setArticleHasMore(offset + ARTICLE_PAGE_SIZE < total);
      } catch (e) {
        if (offset === 0) setArticleItems([]);
      } finally {
        setArticleLoading(false);
      }
    },
    []
  );

  const loadDashboard = useCallback(
    async (targetIp) => {
      const seq = ++reqSeqRef.current;
      setLoading(true);
      setError('');
      setErrorCode('');
      try {
        const qs = new URLSearchParams({ ip: targetIp });
        const [riskPayload, clusterPayload, riskScorePayload, burstStatusPayload, burstEventsPayload, healthState] = await Promise.all([
          apiGet(`/api/risk-dashboard?${qs.toString()}`),
          apiGet(`/api/ip-clusters?${qs.toString()}&limit=6`),
          apiGet(`/api/risk-score?ip=${targetIp}`).catch(() => null),
          apiGet('/api/burst-status').catch(() => null),
          apiGet('/api/burst-events?limit=50').catch(() => null),
          apiGet('/api/health').then((data) => ({ data, error: null })).catch((err) => ({ data: null, error: err })),
        ]);

        if (seq !== reqSeqRef.current) return;

        const normalized = normalizeNexonDashboard({
          targetIp,
          riskPayload,
          clusterPayload,
          useMockFallback: USE_MOCK_FALLBACK,
          mockRisk: MOCK_RISK,
          mockCluster: MOCK_CLUSTER,
          baseCatalog: catalog,
        });

        setRiskData(normalized.riskData);
        setClusterData(normalized.clusterData);
        setUsingMock(normalized.usingMock);
        setNotice(normalized.notice || '');
        setRiskScore(riskScorePayload || null);
        setBurstStatus(burstStatusPayload || null);
        setBurstEvents((burstEventsPayload?.items || []).slice(0, 50));
        setHealth(healthState.data || null);
        setHealthDiagCode(healthState.error ? getDiagnosticCode(healthState.error, 'NEX-HEALTH') : '');
        setLastUpdatedAt(shortTime(new Date()));

        await loadArticles(targetIp, 0);
      } catch (e) {
        if (seq !== reqSeqRef.current) return;
        setRiskData(createEmptyRisk(targetIp, catalog));
        setClusterData(createEmptyCluster(targetIp));
        setRiskScore(null);
        setBurstStatus(null);
        setBurstEvents([]);
        setError(getErrorMessage(e, '대시보드 데이터를 불러오지 못했습니다.'));
        setErrorCode(getDiagnosticCode(e, 'NEX-DASH'));
      } finally {
        if (seq === reqSeqRef.current) setLoading(false);
      }
    },
    [catalog, loadArticles]
  );

  useEffect(() => {
    loadDashboard(ip);
  }, [ip, loadDashboard]);

  useEffect(() => {
    const timer = setInterval(() => {
      loadDashboard(ip);
    }, REFRESH_MS);
    return () => clearInterval(timer);
  }, [ip, loadDashboard]);

  const riskValue = Number(riskScore?.risk_score || 0);
  const issueHeat = Number(riskScore?.issue_heat || 0);
  const confidence = Math.round(Number(riskScore?.confidence || 0) * 100);
  const tone = toneByScore(riskValue);
  const recent24h = Number(riskScore?.article_count_window || 0);
  const spread = Number(riskScore?.spread_ratio || 0);
  const uncertain = Math.round(Number(riskScore?.uncertain_ratio || 0) * 100);
  const topRisk = (riskData?.risk_themes || []).slice().sort((a, b) => Number(b.risk_score || 0) - Number(a.risk_score || 0))[0];
  const sortedOutlets = (riskData?.outlets || []).slice().sort((a, b) => Number(b.article_count || 0) - Number(a.article_count || 0));
  const sortedClusters = (clusterData?.clusters || []).slice().sort((a, b) => Number(b.article_count || 0) - Number(a.article_count || 0));

  return (
    <main className="min-h-screen bg-[#edf2f8] px-4 py-6 text-slate-900 md:px-8">
      <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-4">
        <Card className="rounded-2xl border border-[#d4dbe8] bg-white">
          <CardContent className="p-4 md:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="inline-block h-5 w-5 rounded-md bg-[conic-gradient(from_140deg,#0f3b66_0_58%,#9acb19_58%_100%)]" />
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">NEXON PR MONITOR</div>
                  <h1 className="text-2xl font-black tracking-tight">넥슨 리빌드 시안 (Codex)</h1>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button asChild variant="secondary"><Link href="/">메인</Link></Button>
                <Button asChild variant="secondary"><Link href="/compare">경쟁사 비교</Link></Button>
                {SHOW_BACKTEST ? <Button asChild variant="secondary"><Link href="/nexon/backtest">Backtest</Link></Button> : null}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden rounded-2xl border border-[#c9d3e3]">
          <CardContent className="p-0">
            <section className="relative px-6 pb-5 pt-6 text-white md:px-8" style={{ backgroundColor: bannerVisual.bg }}>
              <div className="absolute left-0 top-0 h-full w-1" style={{ backgroundColor: bannerVisual.accent }} />
              <img src={NEXON_LOGO} width={56} height={56} alt="NEXON" className="absolute right-4 top-4 h-14 w-14 rounded-lg border border-white/30 bg-white/90 p-1" />
              <p className="text-xs font-bold tracking-[0.16em]" style={{ color: bannerVisual.accent }}>{bannerVisual.kicker}</p>
              <h2 className="mt-2 text-5xl font-black tracking-tight md:text-6xl">{currentBanner.name}</h2>
              <p className="mt-2 max-w-2xl text-base text-slate-100 md:text-lg">해당 IP 리스크 흐름 · 이슈 묶음 · 집중 수집 모니터</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Badge variant="outline" className="bg-white/10 text-slate-100 tabular-nums">위험도 {riskValue.toFixed(1)}</Badge>
                <Badge variant="outline" className="bg-white/10 text-slate-100 tabular-nums">24h 기사 {recent24h}건</Badge>
                <Badge variant="outline" className="bg-white/10 text-slate-100 tabular-nums">이슈 묶음 {Number(clusterData?.meta?.cluster_count || 0)}</Badge>
              </div>
            </section>

            <div className="flex flex-col gap-3 border-t border-[#dde5f1] bg-white px-4 py-3 md:flex-row md:items-center md:justify-between md:px-6">
              <div className="flex items-center gap-2">
                <Button variant="secondary" disabled={currentIndex <= 0} onClick={() => setIp(catalog[Math.max(currentIndex - 1, 0)]?.id || ip)}><ChevronLeft aria-hidden="true" size={16} />이전</Button>
                <Button variant="secondary" disabled={currentIndex >= catalog.length - 1} onClick={() => setIp(catalog[Math.min(currentIndex + 1, catalog.length - 1)]?.id || ip)}>다음<ChevronRight aria-hidden="true" size={16} /></Button>
                <div className="ml-1 flex items-center gap-1">
                  {catalog.map((_, idx) => <span key={idx} className={cx('h-2.5 w-2.5 rounded-full', idx === currentIndex ? 'bg-blue-600' : 'bg-slate-300')} />)}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="default"><RefreshCw aria-hidden="true" size={14} className="mr-1" />{loading ? '자동 갱신 중' : '자동 갱신'}</Badge>
                <Badge variant="outline">현재: {riskData?.meta?.ip || '-'}</Badge>
                <Badge variant="outline" className="tabular-nums">마지막 갱신: {lastUpdatedAt || '-'}</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {notice ? (
          <Alert variant={usingMock ? 'warning' : 'info'}>
            <AlertTitle>{usingMock ? '샘플 데이터 표시 중' : '안내'}</AlertTitle>
            <AlertDescription>{notice}</AlertDescription>
          </Alert>
        ) : null}
        {healthDiagCode ? (
          <Alert variant="warning">
            <AlertDescription>헬스 정보 일시 누락. 진단코드: {healthDiagCode}</AlertDescription>
          </Alert>
        ) : null}
        {error ? (
          <Alert variant="destructive">
            <AlertTitle>데이터 로드 실패</AlertTitle>
            <AlertDescription>{error} {errorCode ? `(진단코드 ${errorCode})` : ''}</AlertDescription>
          </Alert>
        ) : null}

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Card><CardContent className="p-4"><p className="text-sm text-slate-500">선택 IP</p><p className="mt-1 text-3xl font-black">{riskData?.meta?.ip || '-'}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-sm text-slate-500">총 기사 수</p><p className="mt-1 text-3xl font-black">{Number(riskData?.meta?.total_articles || 0).toLocaleString()}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-sm text-slate-500">최고 위험 테마</p><p className="mt-1 text-3xl font-black">{topRisk?.theme || '-'}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-sm text-slate-500">이슈 묶음 수</p><p className="mt-1 text-3xl font-black">{Number(clusterData?.meta?.cluster_count || 0)}</p></CardContent></Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.35fr_.85fr]">
          <Card>
            <CardHeader>
              <CardTitle>실시간 위험도 모니터</CardTitle>
              <CardDescription>Risk와 Heat를 분리해 보여줍니다.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={tone.badge === 'success' ? 'success' : 'warning'}>{tone.label}</Badge>
                <Badge variant="outline">식 {riskScore?.risk_formula_version || 'v2'}</Badge>
                <Badge variant="outline">신뢰도 {confidence}%</Badge>
              </div>
              <div className="text-6xl font-black tracking-tight tabular-nums">{riskValue.toFixed(1)}</div>
              <Progress value={Math.max(0, Math.min(100, riskValue))} />
              <div className="grid gap-2 text-sm text-slate-700 md:grid-cols-2">
                <p>이슈량(Heat): <b>{issueHeat.toFixed(1)}</b></p>
                <p>최근 24h 기사: <b>{recent24h}</b></p>
                <p>확산도: <b>{spread.toFixed(2)}</b></p>
                <p>불확실도: <b>{uncertain}%</b></p>
              </div>

              <Collapsible open={showDetail} onOpenChange={setShowDetail}>
                <CollapsibleTrigger asChild>
                  <Button variant="secondary" className="w-full justify-between">상세 구성요소(S/V/T/M) <CircleHelp aria-hidden="true" size={16} /></Button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
                    {['S', 'V', 'T', 'M'].map((k) => {
                      const v = Math.max(0, Math.min(1, Number(riskScore?.components?.[k] || 0)));
                      return (
                        <Card key={k}><CardContent className="p-3"><div className="mb-2 flex items-center justify-between text-xs"><span>{k}</span><b>{v.toFixed(2)}</b></div><Progress value={v * 100} /></CardContent></Card>
                      );
                    })}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card>
              <CardHeader><CardTitle>경보 등급</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                <Badge variant={riskScore?.alert_level === 'P1' ? 'warning' : 'success'}>{riskScore?.alert_level || 'P3'}</Badge>
                <p className="text-sm text-slate-600">위험도 0~44 구간은 기본 관찰 대상으로 처리합니다.</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>수집 상태</CardTitle></CardHeader>
              <CardContent>
                <p className="text-sm text-slate-700">
                  {burstStatus?.status === 'burst' ? (
                    <span className="inline-flex items-center gap-1 text-amber-700"><TriangleAlert aria-hidden="true" size={14} />집중 수집(BURST)</span>
                  ) : (
                    '정상 수집'
                  )}
                  {' · '}주기 {Number(health?.collect_zero_streak_threshold ? 600 : 600)}s
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Risk vs Heat</CardTitle></CardHeader>
              <CardContent>
                <p className="text-sm text-slate-700">Risk는 부정 강도, Heat는 언급량입니다. 언급이 많아도 부정 신호가 낮으면 Risk는 낮게 유지됩니다.</p>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>일자별 추이</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {(riskData?.daily || []).slice(-14).map((d) => {
                const count = Number(d.article_count || 0);
                const ratio = Number(d.negative_ratio || 0);
                return (
                  <div key={d.date} className="rounded-xl border border-slate-200 p-3">
                    <div className="mb-2 flex items-center justify-between text-sm"><b>{d.date}</b><span className="text-slate-600">기사 {count} · 부정 {ratio.toFixed(1)}%</span></div>
                    <div className="h-2 rounded-full bg-slate-200"><div className="h-2 rounded-full bg-blue-600" style={{ width: `${Math.min(100, count * 5)}%` }} /></div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>버스트 이벤트</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {burstEvents.length ? burstEvents.slice(0, 6).map((evt, idx) => (
                <div key={`${evt.occurred_at}-${idx}`} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
                  <div className="font-semibold">{String(evt.occurred_at || '').slice(5, 16)} · {evt.ip_name || '-'}</div>
                  <div className="text-slate-600">{evt.trigger_reason || '-'}</div>
                </div>
              )) : <div className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">버스트 이벤트 없음</div>}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 xl:grid-cols-3">
          <Card className="xl:col-span-2">
            <CardHeader><CardTitle>수집 기사 목록</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {articleItems.length ? articleItems.map((a) => (
                <a key={a.id || a.url} href={a.url || '#'} target="_blank" rel="noreferrer" className="block rounded-xl border border-slate-200 p-3 hover:bg-slate-50">
                  <p className="font-semibold text-slate-900">{a.title || '-'}</p>
                  <p className="mt-1 text-sm text-slate-600">{a.source || '-'} · {a.date || '-'}</p>
                </a>
              )) : <div className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">기사가 없습니다.</div>}
              <div className="pt-2">
                <Button variant="secondary" disabled={!articleHasMore || articleLoading} onClick={() => loadArticles(ip, articleOffset + ARTICLE_PAGE_SIZE)}>
                  {articleLoading ? '불러오는 중...' : articleHasMore ? '기사 더 보기' : '마지막 페이지'}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>테마/매체 TOP</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">위험 테마</p>
                <div className="space-y-2">
                  {(riskData?.risk_themes || []).slice(0, 5).map((t) => (
                    <div key={t.theme} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
                      <div className="font-semibold">{t.theme}</div>
                      <div className="text-slate-600">Risk {Number(t.risk_score || 0).toFixed(3)} · 기사 {Number(t.article_count || 0)}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">매체 상위</p>
                <div className="space-y-2">
                  {sortedOutlets.slice(0, 5).map((o) => (
                    <div key={o.outlet} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
                      <div className="font-semibold">{o.outlet}</div>
                      <div className="text-slate-600">기사 {Number(o.article_count || 0)} · 부정 {Number(o.negative_ratio || 0).toFixed(1)}%</div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader><CardTitle>이슈 클러스터</CardTitle><CardDescription>유사 키워드 기준 주제 묶음</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            {sortedClusters.length ? sortedClusters.map((c, idx) => (
              <div key={`${c.cluster}-${idx}`} className="rounded-xl border border-slate-200 p-3">
                <div className="mb-1 flex items-center justify-between"><b>{c.cluster}</b><span className="text-sm text-slate-600">기사 {Number(c.article_count || 0)}</span></div>
                <p className="text-sm text-slate-600">키워드: {(c.keywords || []).join(', ') || '-'}</p>
                <p className="text-sm text-slate-500">예시: {(c.samples || [])[0] || '-'}</p>
              </div>
            )) : <div className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">클러스터 데이터 없음</div>}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
