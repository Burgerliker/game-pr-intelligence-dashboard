"use client";

import Link from "next/link";
import {
  Box,
  Button,
  Chip,
  Container,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import {
  actionButtonSx,
  navButtonSx,
  pageContainerSx,
  pageShellCleanSx,
  panelPaperSx,
  riskAccent,
  sectionCardSx,
  sectionTitleSx,
  specTypeSx,
  statusChipSx,
} from "../../lib/uiTokens";

/* ─────────── 데이터 ─────────── */

const SIGNALS = [
  {
    label: "감성 논조",
    weight: "50%",
    body: "부정어·긍정어 키워드 사전으로 기사마다 점수를 매기고, 얼마나 확실하게 부정인지를 가중해 평균을 냅니다. 단순 부정 기사 수 집계와 달리 논조의 강도를 측정합니다.",
  },
  {
    label: "기사량 급증",
    weight: "25%",
    body: "최근 1시간 기사 수를 과거 7일 같은 시간대 평균과 비교합니다. Z-score 방식으로 편차를 수치화해 노이즈를 줄입니다.",
  },
  {
    label: "위험 주제",
    weight: "15%",
    body: "확률형·규제·환불·운영 장애·여론 악화 등 PR 위기 유형별로 가중치를 달리 줍니다. 같은 부정 기사여도 '소송' 기사와 '점검 불만' 기사의 심각도는 다르기 때문입니다.",
  },
  {
    label: "보도 채널",
    weight: "10%",
    body: "조선·연합·KBS 등 종합 매체 보도일수록 높은 가중치를 줍니다. 파급력이 다르기 때문입니다.",
  },
];

const THEMES = [
  { name: "확률형/BM 논란", w: 1.0, desc: "가챠·과금 이슈" },
  { name: "규제·법적 이슈", w: 0.9, desc: "공정위·소송·과징금" },
  { name: "보상·환불 요구", w: 0.8, desc: "환불·배상 민원" },
  { name: "운영·장애",      w: 0.7, desc: "서버 오류·점검 불만" },
  { name: "여론·커뮤니티",  w: 0.7, desc: "비판·시위·집단 불만" },
  { name: "신작·성과",      w: 0.4, desc: "출시·흥행·매출 (저위험)" },
];

const ALERT_LEVELS = [
  { label: "심각",  range: "70+",   accent: riskAccent.critical, desc: "즉각 대응" },
  { label: "높음",  range: "45–69", accent: riskAccent.high,     desc: "당일 모니터링" },
  { label: "주의",  range: "20–44", accent: riskAccent.caution,  desc: "추이 관찰" },
  { label: "낮음",  range: "~20",   accent: riskAccent.safe,     desc: "정상 범위" },
];

const IPS = ["메이플스토리", "던전앤파이터", "아크레이더스", "FC온라인", "블루아카이브"];

const STACK = [
  { group: "프론트엔드",       items: ["Next.js 14", "React 18", "MUI v7", "ECharts 6", "Tailwind CSS"] },
  { group: "백엔드 / 데이터", items: ["FastAPI (Python)", "SQLite", "pandas", "APScheduler", "네이버 뉴스 API", "규칙 기반 감성 분석"] },
  { group: "인프라",           items: ["Docker", "AWS EC2", "GitHub Actions"] },
];

/* ─────────── 서브 컴포넌트 ─────────── */

function Label({ children }) {
  return (
    <Typography sx={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", letterSpacing: ".07em", textTransform: "uppercase", mb: 1.5 }}>
      {children}
    </Typography>
  );
}

function StackBadge({ name }) {
  return (
    <Box component="span" sx={{ display: "inline-block", px: 1.5, py: 0.5, borderRadius: 1.5, fontSize: 13, fontWeight: 600, border: "1px solid rgba(15,23,42,.14)", bgcolor: "#f8fafc", color: "#334155" }}>
      {name}
    </Box>
  );
}

/* ─────────── 메인 페이지 ─────────── */

export default function ProjectPage() {
  return (
    <Box sx={{ ...pageShellCleanSx, py: { xs: 2, md: 5 } }}>
      <Container maxWidth="xl" sx={{ ...pageContainerSx, maxWidth: "1000px !important" }}>
        <Stack spacing={2}>

          {/* ── 네비 ── */}
          <Paper sx={{ ...panelPaperSx, bgcolor: "#f8fafc" }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 3, py: 1.5 }}>
              <Stack direction="row" spacing={1} alignItems="center">
                <Box sx={{ width: 20, height: 20, borderRadius: 1, background: "linear-gradient(140deg,#0f3b66 0 58%,#9acb19 58% 100%)" }} />
                <Typography sx={{ ...specTypeSx.h6, color: "#0f172a" }}>PR Portfolio</Typography>
              </Stack>
              <Button component={Link} href="/" variant="outlined" size="small" sx={navButtonSx}>
                ← 메인으로
              </Button>
            </Stack>
          </Paper>

          {/* ── 히어로 — 결론 먼저 ── */}
          <Paper sx={{ ...sectionCardSx, background: "linear-gradient(135deg,#0f172a 0%,#111827 55%,#1f2937 100%)", p: { xs: 3, md: 5 } }}>
            <Stack spacing={3}>
              {/* 태그 */}
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Chip label="PR 포트폴리오" size="small" sx={{ ...statusChipSx, bgcolor: "rgba(255,255,255,.08)", color: "#94a3b8", border: "1px solid rgba(255,255,255,.12)" }} />
                <Chip label="게임 IP 리스크 모니터링" size="small" sx={{ ...statusChipSx, bgcolor: "rgba(154,203,25,.15)", color: "#9acb19", border: "1px solid rgba(154,203,25,.3)" }} />
              </Stack>

              {/* 핵심 메시지 */}
              <Box>
                <Typography sx={{ ...specTypeSx.h3, color: "#f8fafc", fontSize: { xs: 26, md: 40 }, lineHeight: 1.1, mb: 1.5 }}>
                  게임 PR 위기를<br />숫자로 판단한다
                </Typography>
                <Typography sx={{ ...specTypeSx.body1, color: "#94a3b8", maxWidth: 560, lineHeight: 1.85, fontSize: 15 }}>
                  넥슨 주요 IP 5종의 뉴스를 자동 수집해<br />
                  감성·기사량·위험주제·채널을 가중 합산한<br />
                  <Box component="span" sx={{ color: "#e2e8f0", fontWeight: 600 }}>0–100점 위험도 점수</Box>를 실시간 산출합니다.
                </Typography>
              </Box>

              {/* 핵심 지표 3개 */}
              <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 1.5 }}>
                {[
                  { num: "5종", label: "넥슨 IP 모니터링" },
                  { num: "10분", label: "기본 수집 주기" },
                  { num: "4가지", label: "리스크 신호 분석" },
                ].map((m) => (
                  <Box key={m.label} sx={{ p: 2, borderRadius: 1.5, bgcolor: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.08)", textAlign: "center" }}>
                    <Typography sx={{ fontSize: 22, fontWeight: 800, color: "#9acb19", lineHeight: 1 }}>{m.num}</Typography>
                    <Typography sx={{ fontSize: 12, color: "#64748b", mt: 0.5, lineHeight: 1.4 }}>{m.label}</Typography>
                  </Box>
                ))}
              </Box>

              {/* CTA 버튼 — 히어로 안에 */}
              <Stack direction="row" spacing={1.25} flexWrap="wrap" useFlexGap>
                <Button component={Link} href="/nexon" variant="contained" sx={actionButtonSx.primary}>
                  넥슨 IP 리스크 →
                </Button>
                <Button component={Link} href="/nexon/backtest" variant="outlined" sx={actionButtonSx.secondary}>
                  과거 분석 →
                </Button>
                <Button component={Link} href="/compare" variant="outlined" sx={actionButtonSx.secondary}>
                  경쟁사 비교 →
                </Button>
              </Stack>

              {/* 작성자 */}
              <Stack direction="row" spacing={1.5} alignItems="center" sx={{ pt: 0.5, borderTop: "1px solid rgba(255,255,255,.07)" }}>
                <Box sx={{ width: 36, height: 36, borderRadius: "50%", background: "linear-gradient(135deg,#1e3a5f,#2d5a1e)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 14, color: "#e2e8f0", flexShrink: 0, border: "1px solid rgba(255,255,255,.12)" }}>
                  문
                </Box>
                <Box>
                  <Typography sx={{ fontWeight: 700, fontSize: 13, color: "#e2e8f0" }}>문종원 · 기획·설계·개발 직접 수행</Typography>
                  <Typography sx={{ fontSize: 12, color: "#475569" }}>rmrmfwhddnjs@gmail.com</Typography>
                </Box>
              </Stack>
            </Stack>
          </Paper>

          {/* ── 왜 만들었나 — 3줄 요약 ── */}
          <Paper sx={{ ...sectionCardSx, p: { xs: 2.5, md: 4 } }}>
            <Label>만든 이유</Label>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(3,1fr)" }, gap: 2 }}>
              {[
                { icon: "📈", title: "기사량 증가 ≠ 위기", body: "신작 출시 때 쏟아지는 기사를 고려해 가중치를 조절했습니다." },
                { icon: "📡", title: "매체가 파급력을 결정한다", body: "게임 전문지와 조선·연합뉴스 보도는 파급력이 다릅니다." },
                { icon: "📋", title: "설명할 수 있어야 한다", body: "4가지 신호를 분리해 수치 근거를 바로 보고할 수 있습니다." },
              ].map((item) => (
                <Box key={item.title} sx={{ p: 2.5, borderRadius: 1.5, bgcolor: "#f8fafc", border: "1px solid rgba(15,23,42,.07)" }}>
                  <Typography sx={{ fontSize: 20, mb: 1 }}>{item.icon}</Typography>
                  <Typography sx={{ fontWeight: 700, fontSize: 14, color: "#0f172a", mb: 0.5 }}>{item.title}</Typography>
                  <Typography sx={{ fontSize: 13, color: "#64748b", lineHeight: 1.7 }}>{item.body}</Typography>
                </Box>
              ))}
            </Box>
          </Paper>

          {/* ── 위험도 계산 ── */}
          <Paper sx={{ ...sectionCardSx, p: { xs: 2.5, md: 4 } }}>
            <Label>위험도 계산 방식</Label>
            <Typography sx={{ fontWeight: 800, fontSize: 18, color: "#0f172a", mb: 3 }}>
              4가지 신호를 가중 합산해 0–100점을 만든다
            </Typography>

            {/* 4가지 신호 */}
            <Stack spacing={1.25} sx={{ mb: 3 }}>
              {SIGNALS.map((s) => (
                <Box key={s.label} sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "180px 1fr" }, borderRadius: 1.5, border: "1px solid rgba(15,23,42,.07)", overflow: "hidden" }}>
                  <Box sx={{ p: 2, bgcolor: "#f8fafc", borderRight: { sm: "1px solid rgba(15,23,42,.07)" } }}>
                    <Stack direction="row" alignItems="center" justifyContent="space-between">
                      <Typography sx={{ fontWeight: 800, fontSize: 14, color: "#0f172a" }}>{s.label}</Typography>
                      <Chip label={s.weight} size="small" sx={{ ...statusChipSx, height: 20, fontSize: 11, fontWeight: 800, bgcolor: "#e2e8f0", color: "#475569" }} />
                    </Stack>
                  </Box>
                  <Box sx={{ p: 2 }}>
                    <Typography sx={{ fontSize: 13, color: "#475569", lineHeight: 1.7 }}>{s.body}</Typography>
                  </Box>
                </Box>
              ))}
            </Stack>

            {/* 산식 */}
            <Box sx={{ p: 2, borderRadius: 1.5, bgcolor: "#0f172a", mb: 3 }}>
              <Label>실제 산식</Label>
              <Box sx={{ fontFamily: "'JetBrains Mono','Fira Code',monospace", fontSize: { xs: 11, md: 13 }, lineHeight: 2, color: "#94a3b8" }}>
                <Box><Box component="span" sx={{ color: "#9acb19" }}>위험도</Box>{" = 100 × ( 0.50×감성 + 0.25×급증 + 0.15×위험주제 + 0.10×채널 )"}</Box>
                <Box><Box component="span" sx={{ color: "#8fb6ff" }}>이슈열기</Box>{" = 100 × ( 0.45×급증 + 0.35×위험주제 + 0.20×채널 )"}</Box>
                <Box><Box component="span" sx={{ color: "#64748b" }}>최종점수</Box>{" = EMA 평활화  ( α 0.1–1.0 동적 조정 )"}</Box>
              </Box>
            </Box>

            {/* 알림 등급 + 위험 주제 — 나란히 */}
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 2 }}>
              {/* 알림 등급 */}
              <Box>
                <Label>알림 등급</Label>
                <Stack spacing={1}>
                  {ALERT_LEVELS.map((a) => (
                    <Stack key={a.label} direction="row" alignItems="center" spacing={1.5} sx={{ p: 1.5, borderRadius: 1.5, bgcolor: a.accent.bg, border: `1px solid ${a.accent.border}` }}>
                      <Typography sx={{ fontWeight: 800, fontSize: 14, color: a.accent.color, minWidth: 36 }}>{a.label}</Typography>
                      <Typography sx={{ fontSize: 12, fontWeight: 600, color: a.accent.color, minWidth: 52 }}>{a.range}점</Typography>
                      <Typography sx={{ fontSize: 13, color: "#475569" }}>{a.desc}</Typography>
                    </Stack>
                  ))}
                </Stack>
              </Box>

              {/* 위험 주제 가중치 */}
              <Box>
                <Label>위험 주제 가중치</Label>
                <Stack spacing={1.25}>
                  {THEMES.map((t) => (
                    <Stack key={t.name} direction="row" alignItems="center" spacing={1.5}>
                      <Typography sx={{ minWidth: 125, fontSize: 13, fontWeight: 600, color: "#334155" }}>{t.name}</Typography>
                      <Box sx={{ flex: 1, height: 5, borderRadius: 99, bgcolor: "#e5e7eb" }}>
                        <Box sx={{ width: `${t.w * 100}%`, height: "100%", bgcolor: "#0f3b66", borderRadius: 99, opacity: 0.3 + t.w * 0.7 }} />
                      </Box>
                      <Typography sx={{ minWidth: 24, fontSize: 13, fontWeight: 700, color: "#475569" }}>{t.w.toFixed(1)}</Typography>
                    </Stack>
                  ))}
                </Stack>
              </Box>
            </Box>
          </Paper>

          {/* ── 감성 키워드 사전 — 접이식 느낌으로 별도 섹션 ── */}
          <Paper sx={{ ...sectionCardSx, p: { xs: 2.5, md: 4 } }}>
            <Label>감성 분석 키워드 사전</Label>
            <Typography sx={{ fontWeight: 800, fontSize: 16, color: "#0f172a", mb: 2 }}>
              부정·긍정·완화 세 레이어로 나눠 점수를 상쇄·보정한다
            </Typography>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(3,1fr)" }, gap: 1.5 }}>
              {/* 부정 */}
              <Box sx={{ p: 2, borderRadius: 1.5, bgcolor: "#fef2f2", border: "1px solid #fecaca" }}>
                <Typography sx={{ fontSize: 12, fontWeight: 700, color: "#dc2626", mb: 1.25 }}>부정 키워드</Typography>
                <Stack direction="row" flexWrap="wrap" spacing={0.75} useFlexGap>
                  {[["먹튀",1.0],["소송",1.0],["사기",1.0],["집단소송",1.0],["개인정보유출",1.0],["보이콧",0.9],["논란",0.8],["환불",0.8],["분노",0.8],["악재",0.7],["장애",0.7],["버그",0.7],["오류",0.7],["항의",0.7],["불만",0.5],["우려",0.5],["하락",0.5],["감소",0.5]].map(([kw, w]) => (
                    <Box key={kw} component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.4, px: 1, py: 0.25, borderRadius: 1, bgcolor: "#fff", border: "1px solid #fecaca", fontSize: 12 }}>
                      <Box component="span" sx={{ color: "#dc2626", fontWeight: 600 }}>{kw}</Box>
                      <Box component="span" sx={{ color: "#94a3b8", fontSize: 11 }}>{w}</Box>
                    </Box>
                  ))}
                </Stack>
              </Box>
              {/* 긍정 */}
              <Box sx={{ p: 2, borderRadius: 1.5, bgcolor: "#f0fdf4", border: "1px solid #bbf7d0" }}>
                <Typography sx={{ fontSize: 12, fontWeight: 700, color: "#16a34a", mb: 1.25 }}>긍정 키워드</Typography>
                <Stack direction="row" flexWrap="wrap" spacing={0.75} useFlexGap>
                  {[["역대급",1.0],["글로벌1위",1.0],["흥행",0.8],["수상",0.8],["신기록",0.8],["호평",0.8],["대박",0.8],["이용자 증가",0.7],["복구 완료",0.7],["성장",0.5],["기대",0.5],["증가",0.4],["관심",0.4]].map(([kw, w]) => (
                    <Box key={kw} component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.4, px: 1, py: 0.25, borderRadius: 1, bgcolor: "#fff", border: "1px solid #bbf7d0", fontSize: 12 }}>
                      <Box component="span" sx={{ color: "#16a34a", fontWeight: 600 }}>{kw}</Box>
                      <Box component="span" sx={{ color: "#94a3b8", fontSize: 11 }}>{w}</Box>
                    </Box>
                  ))}
                </Stack>
              </Box>
              {/* 완화 */}
              <Box sx={{ p: 2, borderRadius: 1.5, bgcolor: "#f8fafc", border: "1px solid rgba(15,23,42,.08)" }}>
                <Typography sx={{ fontSize: 12, fontWeight: 700, color: "#475569", mb: 1.25 }}>
                  완화 키워드 <Box component="span" sx={{ fontWeight: 400, color: "#94a3b8" }}>(부정 점수 ×0.75)</Box>
                </Typography>
                <Stack direction="row" flexWrap="wrap" spacing={0.75} useFlexGap>
                  {["개선","해결","대응","조치","보상안","재발방지","정상화","복구"].map((kw) => (
                    <Box key={kw} component="span" sx={{ px: 1, py: 0.25, borderRadius: 1, bgcolor: "#fff", border: "1px solid rgba(15,23,42,.12)", fontSize: 12, color: "#475569", fontWeight: 600 }}>
                      {kw}
                    </Box>
                  ))}
                </Stack>
                <Typography sx={{ fontSize: 12, color: "#94a3b8", mt: 1.5, lineHeight: 1.6 }}>
                  '논란 + 대응' 기사처럼 부정어와 완화어가 함께 나오면 부정 점수를 낮춰 과대평가를 방지합니다.
                </Typography>
              </Box>
            </Box>
          </Paper>

          {/* ── 운영 안정화 ── */}
          <Paper sx={{ ...sectionCardSx, p: { xs: 2.5, md: 4 } }}>
            <Label>운영 안정화</Label>
            <Typography sx={{ fontWeight: 800, fontSize: 16, color: "#0f172a", mb: 2 }}>
              실제 운영에서 마주한 문제를 직접 해결했다
            </Typography>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(3,1fr)" }, gap: 2, mb: 2.5 }}>
              {/* TTL */}
              <Box sx={{ p: 2.5, borderRadius: 1.5, bgcolor: "#f8fafc", border: "1px solid rgba(15,23,42,.07)" }}>
                <Typography sx={{ fontWeight: 700, fontSize: 14, color: "#0f172a", mb: 1.25 }}>TTL 데이터 보존 정책</Typography>
                <Stack spacing={0.75}>
                  {[["운영 기사","30일"],["리스크 타임시리즈","90일"],["스케줄러 로그","7일"],["테스트 기사","24시간"]].map(([l,v]) => (
                    <Stack key={l} direction="row" alignItems="center" justifyContent="space-between">
                      <Typography sx={{ fontSize: 13, color: "#475569" }}>{l}</Typography>
                      <Chip label={v} size="small" sx={{ ...statusChipSx, height: 20, fontSize: 11, fontWeight: 700, bgcolor: "#e2e8f0", color: "#334155" }} />
                    </Stack>
                  ))}
                </Stack>
                <Typography sx={{ fontSize: 12, color: "#94a3b8", mt: 1.5, lineHeight: 1.6 }}>매일 새벽 4시 자동 cleanup</Typography>
              </Box>
              {/* 버스트 */}
              <Box sx={{ p: 2.5, borderRadius: 1.5, bgcolor: "#f8fafc", border: "1px solid rgba(15,23,42,.07)" }}>
                <Typography sx={{ fontWeight: 700, fontSize: 14, color: "#0f172a", mb: 1.25 }}>적응형 수집 스케줄러</Typography>
                <Stack spacing={0.75}>
                  {[["기본 수집 주기","10분"],["버스트 모드 주기","2분"],["버스트 최대 유지","2시간"],["경쟁사 수집 주기","1시간"]].map(([l,v]) => (
                    <Stack key={l} direction="row" alignItems="center" justifyContent="space-between">
                      <Typography sx={{ fontSize: 13, color: "#475569" }}>{l}</Typography>
                      <Chip label={v} size="small" sx={{ ...statusChipSx, height: 20, fontSize: 11, fontWeight: 700, bgcolor: "#e2e8f0", color: "#334155" }} />
                    </Stack>
                  ))}
                </Stack>
                <Typography sx={{ fontSize: 12, color: "#94a3b8", mt: 1.5, lineHeight: 1.6 }}>위험도 70점 이상 감지 시 10분→2분 자동 전환</Typography>
              </Box>
              {/* 헬스체크 */}
              <Box sx={{ p: 2.5, borderRadius: 1.5, bgcolor: "#f8fafc", border: "1px solid rgba(15,23,42,.07)" }}>
                <Typography sx={{ fontWeight: 700, fontSize: 14, color: "#0f172a", mb: 1.25 }}>헬스체크 / 스모크 테스트</Typography>
                <Stack spacing={0.75}>
                  {["/api/health — 내부 상태 확인","smoke_test.sh — 로컬 검증","ops_external_smoke.sh — 운영 외부 검증","preflight_deploy_live.sh — 배포 전 점검"].map((item) => (
                    <Typography key={item} sx={{ fontSize: 13, color: "#475569", lineHeight: 1.6 }}>· {item}</Typography>
                  ))}
                </Stack>
                <Typography sx={{ fontSize: 12, color: "#94a3b8", mt: 1.5, lineHeight: 1.6 }}>preflight 실패 시 배포 즉시 중단</Typography>
              </Box>
            </Box>

            {/* 안정화 포인트 */}
            <Stack spacing={1}>
              {[
                { title: "IP 편향 버그 제거", body: "여러 IP 동시 처리 시 첫 번째 IP에만 결과가 몰리던 first-match 편향을 제거해 IP별 점수 독립성을 확보했습니다." },
                { title: "EMA 동적 α 평활화", body: "평활 계수(α)를 동적으로 조절해 급등 구간에서는 α를 낮춰(0.1) 노이즈를 흡수하고, 초기값에는 α=1.0을 적용해 첫 점수를 정확히 반영합니다." },
                { title: "버스트 조기 복귀 조건 추가", body: "30분간 위험도 55점 미만이 유지되면 조기 복귀해 불필요한 수집 빈도를 줄입니다." },
              ].map((item) => (
                <Box key={item.title} sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "150px 1fr" }, borderRadius: 1.5, border: "1px solid rgba(15,23,42,.07)", overflow: "hidden" }}>
                  <Box sx={{ p: 2, bgcolor: "#f8fafc", borderRight: { sm: "1px solid rgba(15,23,42,.07)" } }}>
                    <Typography sx={{ fontWeight: 700, fontSize: 13, color: "#0f172a" }}>{item.title}</Typography>
                  </Box>
                  <Box sx={{ p: 2 }}>
                    <Typography sx={{ fontSize: 13, color: "#475569", lineHeight: 1.7 }}>{item.body}</Typography>
                  </Box>
                </Box>
              ))}
            </Stack>
          </Paper>

          {/* ── 한계 + 로드맵 ── */}
          <Paper sx={{ ...sectionCardSx, p: { xs: 2.5, md: 4 } }}>
            <Label>한계 & 개선 계획</Label>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 2 }}>
              <Box>
                <Typography sx={{ fontWeight: 700, fontSize: 13, color: "#64748b", mb: 1.5 }}>현재 한계</Typography>
                <Stack spacing={1}>
                  {[
                    { title: "수집이 네이버 뉴스 단일", body: "실제 유저 반응은 커뮤니티와 SNS에서 먼저 형성되는데, 이를 반영하지 못해 여론 흐름을 늦게 감지할 수 있습니다." },
                    { title: "규칙 기반 감성의 문맥 한계", body: "반어·비꼬기·신조어처럼 문맥이 필요한 표현은 오분류되어 위험도 점수가 부정확해질 수 있습니다." },
                    { title: "키워드 매칭 기반 IP 분류", body: "동명이인이나 중의어가 섞이면 관계없는 기사가 해당 IP로 집계되어 점수가 왜곡될 수 있습니다." },
                  ].map((item) => (
                    <Box key={item.title} sx={{ p: 2, borderRadius: 1.5, bgcolor: "#fef2f2", border: "1px solid #fecaca" }}>
                      <Typography sx={{ fontWeight: 700, fontSize: 13, color: "#991b1b", mb: 0.5 }}>{item.title}</Typography>
                      <Typography sx={{ fontSize: 13, color: "#475569", lineHeight: 1.6 }}>{item.body}</Typography>
                    </Box>
                  ))}
                </Stack>
              </Box>
              <Box>
                <Typography sx={{ fontWeight: 700, fontSize: 13, color: "#64748b", mb: 1.5 }}>다음 개선 로드맵</Typography>
                <Stack spacing={1}>
                  {[
                    { tag: "감성 분석", title: "ML 모델로 전환", body: "KLUE-RoBERTa 도입으로 문맥·신조어 오분류를 줄입니다." },
                    { tag: "수집 확대", title: "커뮤니티·SNS 채널 추가", body: "에펨코리아·디시·X 언급량으로 뉴스 이전 단계 여론을 감지합니다." },
                    { tag: "알림 자동화", title: "임계치 초과 시 즉시 알림", body: "슬랙·이메일 자동 알림으로 대시보드 미확인 상황에서도 대응합니다." },
                  ].map((item) => (
                    <Box key={item.title} sx={{ p: 2, borderRadius: 1.5, bgcolor: "#f0fdf4", border: "1px solid #bbf7d0" }}>
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                        <Chip label={item.tag} size="small" sx={{ ...statusChipSx, height: 20, fontSize: 11, fontWeight: 700, bgcolor: "#dcfce7", color: "#15803d", border: "1px solid #bbf7d0" }} />
                        <Typography sx={{ fontWeight: 700, fontSize: 13, color: "#14532d" }}>{item.title}</Typography>
                      </Stack>
                      <Typography sx={{ fontSize: 13, color: "#475569", lineHeight: 1.6 }}>{item.body}</Typography>
                    </Box>
                  ))}
                </Stack>
              </Box>
            </Box>
          </Paper>

          {/* ── 구현 스택 ── */}
          <Paper sx={{ ...sectionCardSx, p: { xs: 2.5, md: 4 } }}>
            <Label>구현 스택</Label>
            <Stack spacing={2}>
              {STACK.map((g) => (
                <Box key={g.group}>
                  <Typography sx={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", letterSpacing: ".06em", textTransform: "uppercase", mb: 1 }}>
                    {g.group}
                  </Typography>
                  <Stack direction="row" flexWrap="wrap" spacing={1} useFlexGap>
                    {g.items.map((name) => <StackBadge key={name} name={name} />)}
                  </Stack>
                </Box>
              ))}
            </Stack>
          </Paper>

          {/* ── 수집 대상 IP + 재확인 CTA ── */}
          <Paper sx={{ ...sectionCardSx, p: { xs: 2.5, md: 4 } }}>
            <Stack direction={{ xs: "column", md: "row" }} alignItems={{ md: "center" }} justifyContent="space-between" spacing={2}>
              <Box>
                <Label>수집 대상 넥슨 IP 5종</Label>
                <Stack direction="row" flexWrap="wrap" spacing={1} useFlexGap>
                  {IPS.map((name) => (
                    <Chip key={name} label={name} size="small" sx={{ ...statusChipSx, height: 26, fontSize: 12, fontWeight: 600, bgcolor: "#fff", border: "1px solid rgba(15,23,42,.12)", color: "#334155" }} />
                  ))}
                </Stack>
              </Box>
              <Stack direction="row" spacing={1.25} flexWrap="wrap" useFlexGap sx={{ flexShrink: 0 }}>
                <Button component={Link} href="/nexon" variant="contained" sx={actionButtonSx.primary}>넥슨 IP 리스크 →</Button>
                <Button component={Link} href="/nexon/backtest" variant="outlined" sx={actionButtonSx.secondary}>과거 분석 →</Button>
                <Button component={Link} href="/compare" variant="outlined" sx={actionButtonSx.secondary}>경쟁사 비교 →</Button>
              </Stack>
            </Stack>
          </Paper>

        </Stack>
      </Container>
    </Box>
  );
}
