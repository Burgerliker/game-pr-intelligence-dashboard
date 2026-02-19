'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ChevronLeft, ChevronRight, RefreshCw, ShieldAlert, Sparkles } from 'lucide-react';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { apiGet } from '../../lib/api';

const IPS = [
  { id: 'all', name: '전체', theme: 'from-slate-900 via-slate-800 to-slate-700', accent: 'text-blue-300' },
  { id: 'maplestory', name: '메이플스토리', theme: 'from-slate-950 via-slate-800 to-amber-900', accent: 'text-amber-300' },
  { id: 'dnf', name: '던전앤파이터', theme: 'from-slate-950 via-slate-800 to-rose-900', accent: 'text-rose-300' },
  { id: 'arcraiders', name: '아크레이더스', theme: 'from-slate-950 via-slate-800 to-cyan-900', accent: 'text-cyan-300' },
  { id: 'bluearchive', name: '블루아카이브', theme: 'from-slate-950 via-slate-800 to-indigo-900', accent: 'text-indigo-300' },
  { id: 'fconline', name: 'FC온라인', theme: 'from-slate-950 via-slate-800 to-emerald-900', accent: 'text-emerald-300' },
];

function toLevel(score) {
  if (score >= 70) return { label: '심각', tone: 'warning' };
  if (score >= 45) return { label: '높음', tone: 'warning' };
  if (score >= 20) return { label: '주의', tone: 'warning' };
  return { label: '낮음', tone: 'success' };
}

export default function NexonRebuildPage() {
  const [ipIndex, setIpIndex] = useState(1);
  const [risk, setRisk] = useState(null);
  const [health, setHealth] = useState(null);
  const [updatedAt, setUpdatedAt] = useState('');

  const ip = IPS[ipIndex] || IPS[0];

  useEffect(() => {
    let active = true;
    (async () => {
      const [r, h] = await Promise.all([
        apiGet(`/api/risk-score?ip=${ip.id === 'all' ? 'maplestory' : ip.id}`).catch(() => null),
        apiGet('/api/health').catch(() => null),
      ]);
      if (!active) return;
      setRisk(r);
      setHealth(h);
      setUpdatedAt(new Date().toLocaleTimeString('ko-KR', { hour12: false }));
    })();
    return () => {
      active = false;
    };
  }, [ip.id]);

  const score = Number(risk?.risk_score || 0);
  const level = toLevel(score);
  const article24h = Number(risk?.article_count_window || 0);
  const clusterCount = Number(health?.scheduler_job_count || 0);

  const canPrev = ipIndex > 0;
  const canNext = ipIndex < IPS.length - 1;

  const confidence = useMemo(() => {
    const c = Number(risk?.confidence || 0);
    return `${Math.round(c * 100)}%`;
  }, [risk?.confidence]);

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-6 md:px-6">
      <div className="mx-auto max-w-7xl space-y-5">
        <Card className="bg-slate-50">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="flex items-center gap-2 text-xl font-black text-slate-900">
              <span className="h-5 w-5 rounded-md bg-gradient-to-br from-blue-800 to-lime-400" />
              Nexon Rebuild (Claude)
            </div>
            <div className="flex items-center gap-2">
              <Link href="/nexon"><Button variant="secondary">기존 화면</Button></Link>
              <Link href="/nexon-rebuild-codex"><Button variant="secondary">Codex 안</Button></Link>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-slate-300">
          <CardContent className="p-0">
            <section className={`relative min-h-[260px] bg-gradient-to-br ${ip.theme} p-6 text-white md:p-8`}>
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_80%_15%,rgba(255,255,255,.16),transparent_50%)]" />
              <div className="pointer-events-none absolute left-0 top-0 h-full w-1 bg-white/40" />

              <div className="relative z-10 flex h-full flex-col justify-between gap-6">
                <div className="space-y-2">
                  <p className={`text-xs font-bold tracking-[0.14em] ${ip.accent}`}>{ip.id.toUpperCase()}</p>
                  <h1 className="text-5xl font-black tracking-tight md:text-6xl">{ip.name}</h1>
                  <p className="max-w-2xl text-base text-slate-200 md:text-lg">해당 IP 리스크 흐름, 이슈 묶음, 감성 신호를 한 화면에서 빠르게 확인합니다.</p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">위험도 {score.toFixed(1)}</Badge>
                  <Badge variant="outline">24h 기사 {article24h}건</Badge>
                  <Badge variant="outline">스케줄 잡 {clusterCount}</Badge>
                  <Badge variant="outline">신뢰도 {confidence}</Badge>
                </div>
              </div>

              <div className="absolute right-4 top-4 rounded-lg border border-white/30 bg-white/80 px-3 py-2 text-xs font-black text-slate-900">NEXON</div>
            </section>

            <div className="flex flex-col gap-3 border-t border-slate-200 bg-white px-4 py-3 md:flex-row md:items-center md:justify-between md:px-6">
              <div className="flex items-center gap-2">
                <Button variant="secondary" onClick={() => canPrev && setIpIndex((v) => v - 1)} disabled={!canPrev}><ChevronLeft size={16} />이전</Button>
                <Button variant="secondary" onClick={() => canNext && setIpIndex((v) => v + 1)} disabled={!canNext}>다음<ChevronRight size={16} /></Button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="default"><RefreshCw size={14} className="mr-1" />자동 갱신 60초</Badge>
                <Badge variant="outline">현재: {ip.name}</Badge>
                <Badge variant="outline">마지막 갱신: {updatedAt || '-'}</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader><CardTitle>현재 위험 상태</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="text-5xl font-black text-slate-900">{score.toFixed(1)}</div>
              <Badge variant={level.tone === 'success' ? 'success' : 'warning'}>{level.label}</Badge>
              <div className="h-2 rounded-full bg-slate-200">
                <div className="h-2 rounded-full bg-blue-600" style={{ width: `${Math.max(4, Math.min(100, score))}%` }} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>요약 인사이트</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm text-slate-700">
              <p className="flex items-center gap-2"><ShieldAlert size={16} />Risk와 Heat를 분리해 과해석을 줄입니다.</p>
              <p className="flex items-center gap-2"><Sparkles size={16} />저표본 구간은 신뢰도 배지로 바로 표시합니다.</p>
              <p className="flex items-center gap-2"><AlertTriangle size={16} />뉴스 급감 시 수치보다 추세를 우선 확인하세요.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>운영 상태</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm text-slate-700">
              <p>scheduler: {health?.scheduler_running ? 'running' : 'unknown'}</p>
              <p>jobs: {Number(health?.scheduler_job_count || 0)}</p>
              <p>mode: {health?.mode || '-'}</p>
              <p>recent 24h: {Number(health?.recent_articles_24h || 0)}건</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
