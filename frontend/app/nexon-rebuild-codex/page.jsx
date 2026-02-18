'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ChevronLeft, ChevronRight, RefreshCw, ShieldAlert } from 'lucide-react';
import { apiGet, getErrorMessage } from '../../lib/api';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '../../components/ui/alert';
import { Progress } from '../../components/ui/progress';

const IPS = [
  { id: 'all', name: '전체', kicker: 'NEXON OVERVIEW', color: 'from-[#0b1326] via-[#143a7a] to-[#2f68c0]' },
  { id: 'maplestory', name: '메이플스토리', kicker: 'MAPLESTORY', color: 'from-[#1a1104] via-[#5d3400] to-[#b8864d]' },
  { id: 'dnf', name: '던전앤파이터', kicker: 'DUNGEON&FIGHTER', color: 'from-[#190808] via-[#551111] to-[#a13a3a]' },
  { id: 'bluearchive', name: '블루아카이브', kicker: 'BLUE ARCHIVE', color: 'from-[#071726] via-[#12405d] to-[#2f83b4]' },
  { id: 'arcraiders', name: '아크레이더스', kicker: 'ARC RAIDERS', color: 'from-[#0e1021] via-[#28304f] to-[#596487]' },
  { id: 'fconline', name: 'FC온라인', kicker: 'FC ONLINE', color: 'from-[#061916] via-[#0f4a3f] to-[#2f917c]' },
];

function levelMeta(score) {
  const s = Number(score || 0);
  if (s >= 70) return { label: '높음', tone: 'warning' };
  if (s >= 45) return { label: '주의', tone: 'warning' };
  return { label: '낮음', tone: 'success' };
}

export default function NexonRebuildCodexPage() {
  const [active, setActive] = useState(1);
  const [risk, setRisk] = useState(null);
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState('');

  const activeIp = IPS[active];

  const fetchData = async () => {
    try {
      setLoading(true);
      setError('');
      const [healthRes, riskRes] = await Promise.all([
        apiGet('/api/health'),
        apiGet(`/api/risk-score?ip=${activeIp.id === 'all' ? 'maplestory' : activeIp.id}&window_hours=24`),
      ]);
      setHealth(healthRes);
      setRisk(riskRes);
      setLastUpdated(new Date().toISOString());
    } catch (e) {
      setError(getErrorMessage(e, '데이터를 불러오지 못했습니다.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeIp.id]);

  const meta = useMemo(() => {
    const score = Number(risk?.risk_score || 0);
    const level = levelMeta(score);
    const confidence = Math.round(Number(risk?.confidence || 0) * 100);
    return { score, level, confidence, heat: Number(risk?.issue_heat || 0) };
  }, [risk]);

  return (
    <main className="min-h-screen bg-[#edf2f8] px-4 py-6 text-slate-900 md:px-8">
      <section className="mx-auto flex w-full max-w-[1320px] flex-col gap-4 rounded-2xl border border-line bg-card p-4 shadow-soft md:p-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-extrabold tracking-tight">넥슨 IP 리스크 대시보드 · Codex Rebuild</h1>
          <Link href="/nexon" className="text-sm font-semibold text-blue-700 hover:underline">기존 화면 보기</Link>
        </div>

        <div className={`relative overflow-hidden rounded-2xl border border-white/20 bg-gradient-to-br ${activeIp.color} p-6 text-white md:p-8`}>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_86%_20%,rgba(255,255,255,.26)_0%,rgba(255,255,255,0)_52%)]" />
          <div className="relative z-10 flex flex-col gap-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold tracking-[0.12em] text-white/80">{activeIp.kicker}</p>
                <h2 className="mt-1 text-5xl font-black tracking-tight">{activeIp.name}</h2>
                <p className="mt-2 text-xl text-white/85">실시간 리스크 흐름 · 이슈량 · 수집 상태</p>
              </div>
              <img src="/nexon-logo.png" alt="NEXON" className="h-20 w-20 rounded-xl border border-white/30 bg-white/90 p-2" />
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="rounded-xl border border-white/25 bg-white/10 p-3 backdrop-blur">
                <p className="text-xs text-white/75">현재 위험도</p>
                <p className="text-3xl font-black">{meta.score.toFixed(1)}</p>
              </div>
              <div className="rounded-xl border border-white/25 bg-white/10 p-3 backdrop-blur">
                <p className="text-xs text-white/75">이슈량(Heat)</p>
                <p className="text-3xl font-black">{meta.heat.toFixed(1)}</p>
              </div>
              <div className="rounded-xl border border-white/25 bg-white/10 p-3 backdrop-blur">
                <p className="text-xs text-white/75">신뢰도</p>
                <p className="text-3xl font-black">{meta.confidence}%</p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={() => setActive((p) => (p - 1 + IPS.length) % IPS.length)}><ChevronLeft size={16} />이전</Button>
            <Button variant="secondary" onClick={() => setActive((p) => (p + 1) % IPS.length)}>다음<ChevronRight size={16} /></Button>
            <div className="ml-1 flex items-center gap-1">
              {IPS.map((_, idx) => (
                <span key={idx} className={`h-2.5 w-2.5 rounded-full ${idx === active ? 'bg-blue-600' : 'bg-slate-300'}`} />
              ))}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="h-11 px-4 text-sm"><RefreshCw size={14} className="mr-1" />자동 갱신</Badge>
            <Badge variant="outline" className="h-11 px-4 text-sm">현재: {activeIp.name}</Badge>
            <Badge variant="outline" className="h-11 px-4 text-sm">마지막 갱신: {lastUpdated ? new Date(lastUpdated).toLocaleTimeString('ko-KR', { hour12: false }) : '-'}</Badge>
          </div>
        </div>
      </section>

      <section className="mx-auto mt-6 grid w-full max-w-[1320px] grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>실시간 위험도 모니터</CardTitle>
            <CardDescription>핵심 지표만 먼저 보여주고, 상세는 카드 하단에서 확인합니다.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error ? (
              <Alert variant="destructive">
                <AlertTitle>데이터 조회 실패</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}

            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={meta.level.tone === 'warning' ? 'warning' : 'success'}>{meta.level.label}</Badge>
              <Badge variant="outline">판정 기준: 최신 모델</Badge>
              <Badge variant="outline">식 v2</Badge>
            </div>

            <div className="text-5xl font-black tracking-tight">{loading ? '-' : meta.score.toFixed(1)}</div>
            <Progress value={Math.max(0, Math.min(100, meta.score))} />
            <p className="text-sm text-muted">최근 24시간 기준 · Risk는 부정 강도, Heat는 언급량입니다.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>운영 상태</CardTitle>
            <CardDescription>실서비스 상태 체크</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Badge variant={health?.ok ? 'success' : 'warning'}>{health?.ok ? '정상' : '주의'}</Badge>
            <p className="text-sm text-slate-700">스케줄러: {String(health?.scheduler_running ?? '-')}</p>
            <p className="text-sm text-slate-700">잡 개수: {health?.scheduler_job_count ?? '-'}</p>
            <p className="text-sm text-slate-700">최근 24h 기사: {health?.recent_articles_24h ?? '-'}</p>
            <Button variant="secondary" className="w-full" onClick={fetchData}>지금 새로고침</Button>
          </CardContent>
        </Card>
      </section>

      <section className="mx-auto mt-4 w-full max-w-[1320px]">
        <Alert variant="info">
          <ShieldAlert size={16} className="mb-1" />
          <AlertTitle>비교용 프로토타입</AlertTitle>
          <AlertDescription>
            이 페이지는 기존 `/nexon`을 건드리지 않는 Tailwind/shadcn 리빌드 시안입니다. 최종 선택 후 main 반영합니다.
          </AlertDescription>
        </Alert>
      </section>
    </main>
  );
}
