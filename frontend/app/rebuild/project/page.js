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
} from "../../../lib/uiTokens";

/* ─────────── 데이터 ─────────── */

const INSIGHTS = [
  {
    title: "기사량 증가 ≠ 위기",
    body: "신작 출시나 대규모 업데이트 때 기사가 쏟아져도 내용이 긍정적이면 위기가 아닙니다. 반대로 기사 수가 적어도 확률형 논란이나 규제 이슈라면 빠르게 대응해야 합니다. '얼마나 많은가'보다 '어떤 기사인가'가 핵심입니다.",
  },
  {
    title: "주요 매체 노출이 리스크를 키운다",
    body: "같은 내용의 부정 기사라도 인벤·게임메카 같은 게임 전문 매체에 그치는 것과 조선·연합뉴스 같은 종합 매체로 번지는 것은 파급력이 다릅니다. 보도 채널을 함께 봐야 실제 위기 수준을 가늠할 수 있습니다.",
  },
  {
    title: "'왜 위험한지'를 설명할 수 있어야 한다",
    body: "위험도 점수 하나만 내놓으면 현장에서 신뢰받기 어렵습니다. 감성 논조·기사량 변화·위험 주제·보도 채널 4가지 신호를 분해해서 보여줘야 PR 담당자가 즉시 상황을 해석하고 보고할 수 있습니다.",
  },
];

const SIGNALS = [
  {
    label: "감성 논조",
    weight: "50%",
    question: "기사 내용이 얼마나 부정적인가?",
    body: "부정어·긍정어 키워드 사전으로 기사마다 점수를 매기고, 판단 확신도를 반영해 평균을 냅니다. 단순 부정 기사 수 집계와 달리 논조의 강도를 측정합니다.",
  },
  {
    label: "기사량 급증",
    weight: "25%",
    question: "평소 대비 갑자기 기사가 쏟아지고 있는가?",
    body: "최근 1시간 기사 수를 과거 7일 같은 시간대 평균과 비교합니다. '2배 많다'가 아니라 통계적으로 얼마나 비정상인지를 측정해 노이즈를 줄입니다.",
  },
  {
    label: "위험 주제",
    weight: "15%",
    question: "어떤 주제의 기사인가?",
    body: "확률형·규제·환불·운영 장애·여론 악화 등 PR 위기 유형별로 가중치를 달리 줍니다. 같은 부정 기사여도 '소송' 기사와 '점검 불만' 기사의 심각도는 다릅니다.",
  },
  {
    label: "보도 채널",
    weight: "10%",
    question: "어느 매체가 다루고 있는가?",
    body: "조선·연합·KBS 등 종합 매체 보도일수록 높은 가중치를 줍니다. 게임 전문 매체와 일반 블로그는 파급력이 다르기 때문입니다.",
  },
];

const THEMES = [
  { name: "확률형/BM 논란", w: 1.0, desc: "가챠·과금 이슈" },
  { name: "규제·법적 이슈",  w: 0.9, desc: "공정위·소송·과징금" },
  { name: "보상·환불 요구",  w: 0.8, desc: "환불·배상 민원" },
  { name: "운영·장애",       w: 0.7, desc: "서버 오류·점검 불만" },
  { name: "여론·커뮤니티",   w: 0.7, desc: "비판·시위·집단 불만" },
  { name: "신작·성과",       w: 0.4, desc: "출시·흥행·매출 (저위험)" },
];

const ALERT_LEVELS = [
  { label: "심각",  range: "70 이상", accent: riskAccent.critical, desc: "즉각 대응, 보고 라인 가동" },
  { label: "높음",  range: "45–69",  accent: riskAccent.high,     desc: "당일 모니터링 강화, 대응안 준비" },
  { label: "주의",  range: "20–44",  accent: riskAccent.caution,  desc: "관찰 유지, 추이 기록" },
  { label: "낮음",  range: "20 미만", accent: riskAccent.safe,     desc: "정상 범위" },
];

const USE_CASES = [
  {
    title: "일일 리스크 브리핑 자동화",
    body: "매일 아침 리스크 점수와 위험 주제 현황을 확인해 팀장 보고 자료를 빠르게 구성할 수 있습니다. 감으로 '오늘 좀 위험한 것 같아요' 대신 수치로 설명할 수 있습니다.",
  },
  {
    title: "이슈 확산 전 선제 감지",
    body: "기사량 급증 신호(통계적 이상치)가 감지되면 아직 여론이 확대되기 전 단계에서 모니터링 강도를 높이고 대응 시나리오를 준비할 수 있습니다.",
  },
  {
    title: "경쟁사 비교로 맥락 파악",
    body: "자사 위험도가 높아 보여도 경쟁사 전체가 비슷한 수준이면 업계 이슈일 수 있습니다. 나란히 비교해 자사만의 문제인지 판단합니다.",
  },
  {
    title: "과거 이슈 회고와 가설 검증",
    body: "특정 시점으로 돌아가 '그 때 이 공식이 제대로 경고했는가'를 확인합니다. 대응 보고서 작성이나 위기 관리 체계 개선에 근거 데이터를 제공합니다.",
  },
];

const IPS = ["메이플스토리", "던전앤파이터", "아크레이더스", "FC온라인", "블루아카이브"];

const STACK = [
  { group: "프론트엔드",       items: ["Next.js 14", "React 18", "MUI v7", "ECharts 6", "Tailwind CSS"] },
  { group: "백엔드 / 데이터", items: ["FastAPI (Python)", "SQLite", "pandas", "APScheduler", "네이버 뉴스 API", "규칙 기반 감성 분석"] },
  { group: "인프라",           items: ["Docker", "AWS EC2", "Jenkins"] },
];

/* ─────────── 서브 컴포넌트 ─────────── */

function SectionTitle({ children }) {
  return <Typography sx={{ ...sectionTitleSx, mb: 0.5, fontSize: 18 }}>{children}</Typography>;
}

function SectionSub({ children }) {
  return <Typography sx={{ ...specTypeSx.body1, color: "#64748b", lineHeight: 1.75, mb: 2.5 }}>{children}</Typography>;
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
        <Stack spacing={2.5}>

          {/* 네비 바 */}
          <Paper sx={{ ...panelPaperSx, bgcolor: "#f8fafc" }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 3, py: 1.5 }}>
              <Stack direction="row" spacing={1} alignItems="center">
                <Box sx={{ width: 20, height: 20, borderRadius: 1, background: "linear-gradient(140deg,#0f3b66 0 58%,#9acb19 58% 100%)" }} />
                <Typography sx={{ ...specTypeSx.h6, color: "#0f172a" }}>PR Portfolio</Typography>
              </Stack>
              <Button component={Link} href="/rebuild" variant="outlined" size="small" sx={navButtonSx}>
                ← 메인으로
              </Button>
            </Stack>
          </Paper>

          {/* 히어로 */}
          <Paper sx={{ ...sectionCardSx, background: "linear-gradient(135deg,#0f172a 0%,#111827 55%,#1f2937 100%)", p: { xs: 3, md: 5 } }}>
            <Stack spacing={2}>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Chip label="PR 포트폴리오" size="small" sx={{ ...statusChipSx, bgcolor: "rgba(255,255,255,.08)", color: "#94a3b8", border: "1px solid rgba(255,255,255,.12)" }} />
                <Chip label="게임 IP 리스크 모니터링" size="small" sx={{ ...statusChipSx, bgcolor: "rgba(154,203,25,.15)", color: "#9acb19", border: "1px solid rgba(154,203,25,.3)" }} />
              </Stack>

              <Box>
                <Typography sx={{ ...specTypeSx.h3, color: "#f8fafc", fontSize: { xs: 26, md: 38 }, lineHeight: 1.12, mb: 1.5 }}>
                  PR 실시간 이슈 현황판
                </Typography>
                <Typography sx={{ ...specTypeSx.body1, color: "#94a3b8", maxWidth: 600, lineHeight: 1.85 }}>
                  게임 PR 현장에서 '이게 위기인가 아닌가'를 빠르게 판단하기 위해 직접 만든 모니터링 도구입니다.
                  넥슨 주요 IP 5종의 뉴스를 자동 수집해 감성 논조·기사량 변화·위험 주제·보도 채널을 종합한
                  위험도 점수를 실시간으로 산출합니다.
                </Typography>
              </Box>

              <Stack direction="row" spacing={2} alignItems="center" sx={{ pt: 0.5 }}>
                <Box sx={{ width: 40, height: 40, borderRadius: "50%", background: "linear-gradient(135deg,#1e3a5f,#2d5a1e)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 16, color: "#e2e8f0", flexShrink: 0, border: "1px solid rgba(255,255,255,.12)" }}>
                  문
                </Box>
                <Box>
                  <Typography sx={{ fontWeight: 700, fontSize: 14, color: "#e2e8f0" }}>문종원</Typography>
                  <Typography sx={{ fontSize: 13, color: "#64748b", mt: 0.2 }}>
                    기획·설계·개발 전 과정 직접 수행 · rmrmfwhddnjs@gmail.com
                  </Typography>
                </Box>
              </Stack>
            </Stack>
          </Paper>

          {/* PR 인사이트 — 왜 만들었나 */}
          <Paper sx={{ ...sectionCardSx, p: { xs: 2.5, md: 4 } }}>
            <SectionTitle>이 도구를 만들게 된 PR 현장의 문제</SectionTitle>
            <SectionSub>단순히 '기사를 모아보는 것'을 넘어서기 위해, 게임 PR 운영에서 반복되는 판단 오류를 먼저 정리했습니다.</SectionSub>
            <Stack spacing={1.5}>
              {INSIGHTS.map((item) => (
                <Box key={item.title} sx={{ p: 2.5, borderRadius: 1.5, bgcolor: "#f8fafc", border: "1px solid rgba(15,23,42,.07)" }}>
                  <Typography sx={{ fontWeight: 700, fontSize: 14, color: "#0f172a", mb: 0.75 }}>{item.title}</Typography>
                  <Typography sx={{ fontSize: 14, color: "#475569", lineHeight: 1.75 }}>{item.body}</Typography>
                </Box>
              ))}
            </Stack>
          </Paper>

          {/* 위험도 계산 방식 */}
          <Paper sx={{ ...sectionCardSx, p: { xs: 2.5, md: 4 } }}>
            <SectionTitle>위험도는 어떻게 계산하나요?</SectionTitle>
            <SectionSub>기사를 4가지 질문으로 바라보고, 각 답을 가중 합산해 0–100점의 위험도 점수를 만듭니다.</SectionSub>

            {/* 4가지 신호 */}
            <Stack spacing={1.5} sx={{ mb: 3 }}>
              {SIGNALS.map((s) => (
                <Box key={s.label} sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "190px 1fr" }, borderRadius: 1.5, border: "1px solid rgba(15,23,42,.07)", overflow: "hidden" }}>
                  <Box sx={{ p: 2, bgcolor: "#f8fafc", borderRight: { sm: "1px solid rgba(15,23,42,.07)" } }}>
                    <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 0.5 }}>
                      <Typography sx={{ fontWeight: 800, fontSize: 14, color: "#0f172a" }}>{s.label}</Typography>
                      <Chip label={s.weight} size="small" sx={{ ...statusChipSx, height: 22, fontSize: 11, fontWeight: 800, bgcolor: "#e2e8f0", color: "#475569" }} />
                    </Stack>
                    <Typography sx={{ fontSize: 12, color: "#64748b", lineHeight: 1.5 }}>"{s.question}"</Typography>
                  </Box>
                  <Box sx={{ p: 2 }}>
                    <Typography sx={{ fontSize: 14, color: "#475569", lineHeight: 1.7 }}>{s.body}</Typography>
                  </Box>
                </Box>
              ))}
            </Stack>

            {/* 감성 키워드 사전 */}
            <Box sx={{ mb: 3 }}>
              <Typography sx={{ fontWeight: 700, fontSize: 13, color: "#64748b", letterSpacing: ".04em", textTransform: "uppercase", mb: 1.5 }}>
                감성 분석 키워드 사전 (rule_v2)
              </Typography>
              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(3,1fr)" }, gap: 1.5 }}>
                <Box sx={{ p: 2, borderRadius: 1.5, bgcolor: "#fef2f2", border: "1px solid #fecaca" }}>
                  <Typography sx={{ fontSize: 12, fontWeight: 700, color: "#dc2626", mb: 1 }}>부정 키워드</Typography>
                  <Stack direction="row" flexWrap="wrap" spacing={0.75} useFlexGap>
                    {[
                      ["먹튀", 1.0], ["소송", 1.0], ["사기", 1.0], ["집단소송", 1.0], ["개인정보유출", 1.0],
                      ["보이콧", 0.9],
                      ["논란", 0.8], ["환불", 0.8], ["분노", 0.8],
                      ["악재", 0.7], ["장애", 0.7], ["버그", 0.7], ["오류", 0.7], ["항의", 0.7],
                      ["불만", 0.5], ["우려", 0.5], ["하락", 0.5], ["감소", 0.5],
                    ].map(([kw, w]) => (
                      <Box key={kw} component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.4, px: 1, py: 0.25, borderRadius: 1, bgcolor: "#fff", border: "1px solid #fecaca", fontSize: 12 }}>
                        <Box component="span" sx={{ color: "#dc2626", fontWeight: 600 }}>{kw}</Box>
                        <Box component="span" sx={{ color: "#94a3b8", fontSize: 11 }}>{w}</Box>
                      </Box>
                    ))}
                  </Stack>
                </Box>
                <Box sx={{ p: 2, borderRadius: 1.5, bgcolor: "#f0fdf4", border: "1px solid #bbf7d0" }}>
                  <Typography sx={{ fontSize: 12, fontWeight: 700, color: "#16a34a", mb: 1 }}>긍정 키워드</Typography>
                  <Stack direction="row" flexWrap="wrap" spacing={0.75} useFlexGap>
                    {[
                      ["역대급", 1.0], ["글로벌1위", 1.0],
                      ["흥행", 0.8], ["수상", 0.8], ["신기록", 0.8], ["호평", 0.8], ["대박", 0.8],
                      ["이용자 증가", 0.7], ["복구 완료", 0.7],
                      ["성장", 0.5], ["기대", 0.5],
                      ["증가", 0.4], ["관심", 0.4],
                    ].map(([kw, w]) => (
                      <Box key={kw} component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.4, px: 1, py: 0.25, borderRadius: 1, bgcolor: "#fff", border: "1px solid #bbf7d0", fontSize: 12 }}>
                        <Box component="span" sx={{ color: "#16a34a", fontWeight: 600 }}>{kw}</Box>
                        <Box component="span" sx={{ color: "#94a3b8", fontSize: 11 }}>{w}</Box>
                      </Box>
                    ))}
                  </Stack>
                </Box>
                <Box sx={{ p: 2, borderRadius: 1.5, bgcolor: "#f8fafc", border: "1px solid rgba(15,23,42,.08)" }}>
                  <Typography sx={{ fontSize: 12, fontWeight: 700, color: "#475569", mb: 1 }}>완화 키워드 <Box component="span" sx={{ fontWeight: 400, color: "#94a3b8" }}>(부정 점수 ×0.75)</Box></Typography>
                  <Stack direction="row" flexWrap="wrap" spacing={0.75} useFlexGap>
                    {["개선", "해결", "대응", "조치", "보상안", "재발방지", "정상화", "복구"].map((kw) => (
                      <Box key={kw} component="span" sx={{ px: 1, py: 0.25, borderRadius: 1, bgcolor: "#fff", border: "1px solid rgba(15,23,42,.12)", fontSize: 12, color: "#475569", fontWeight: 600 }}>
                        {kw}
                      </Box>
                    ))}
                  </Stack>
                  <Typography sx={{ fontSize: 12, color: "#94a3b8", mt: 1.25, lineHeight: 1.6 }}>
                    '논란 + 대응' 기사처럼 부정어와 완화어가 함께 나오면 부정 점수를 낮춰 과대평가를 방지합니다.
                  </Typography>
                </Box>
              </Box>
            </Box>

            {/* 위험 주제 가중치 */}
            <Box sx={{ mb: 3 }}>
              <Typography sx={{ fontWeight: 700, fontSize: 13, color: "#64748b", letterSpacing: ".04em", textTransform: "uppercase", mb: 1.5 }}>
                위험 주제별 심각도 가중치
              </Typography>
              <Stack spacing={1}>
                {THEMES.map((t) => (
                  <Stack key={t.name} direction="row" alignItems="center" spacing={1.5}>
                    <Typography sx={{ minWidth: 130, fontSize: 13, fontWeight: 600, color: "#334155" }}>{t.name}</Typography>
                    <Box sx={{ flex: 1, height: 6, borderRadius: 99, bgcolor: "#e5e7eb" }}>
                      <Box sx={{ width: `${t.w * 100}%`, height: "100%", bgcolor: "#0f3b66", borderRadius: 99, opacity: 0.3 + t.w * 0.7 }} />
                    </Box>
                    <Typography sx={{ minWidth: 24, fontSize: 13, fontWeight: 700, color: "#475569" }}>{t.w.toFixed(1)}</Typography>
                    <Typography sx={{ fontSize: 12, color: "#94a3b8", minWidth: 110, display: { xs: "none", md: "block" } }}>{t.desc}</Typography>
                  </Stack>
                ))}
              </Stack>
            </Box>

            {/* 알림 등급 */}
            <Box sx={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 1.5, mb: 3 }}>
              {ALERT_LEVELS.map((a) => (
                <Box key={a.label} sx={{ p: 1.75, borderRadius: 1.5, bgcolor: a.accent.bg, border: `1px solid ${a.accent.border}`, textAlign: "center" }}>
                  <Typography sx={{ fontWeight: 800, fontSize: 16, color: a.accent.color }}>{a.label}</Typography>
                  <Typography sx={{ fontSize: 11, fontWeight: 600, color: a.accent.color, mb: 0.5 }}>{a.range}점</Typography>
                  <Typography sx={{ fontSize: 12, color: "#475569", lineHeight: 1.5 }}>{a.desc}</Typography>
                </Box>
              ))}
            </Box>

            {/* 산식 참고 */}
            <Box sx={{ p: 2, borderRadius: 1.5, bgcolor: "#0f172a" }}>
              <Typography sx={{ fontSize: 11, fontWeight: 700, color: "#475569", letterSpacing: ".06em", textTransform: "uppercase", mb: 1 }}>
                기술 참고 — 실제 산식
              </Typography>
              <Box sx={{ fontFamily: "'JetBrains Mono','Fira Code',monospace", fontSize: { xs: 11, md: 13 }, lineHeight: 2, color: "#94a3b8" }}>
                <Box><Box component="span" sx={{ color: "#9acb19" }}>위험도</Box>{" = 100 × ( 0.50×감성 + 0.25×급증 + 0.15×위험주제 + 0.10×(채널×부정비율) )"}</Box>
                <Box><Box component="span" sx={{ color: "#8fb6ff" }}>이슈열기</Box>{" = 100 × ( 0.45×급증 + 0.35×위험주제 + 0.20×채널 )"}</Box>
                <Box><Box component="span" sx={{ color: "#64748b" }}>최종점수</Box>{" = EMA 평활화  ( α 0.1–1.0 동적 조정, 단기 노이즈 제거 )"}</Box>
              </Box>
            </Box>
          </Paper>

          {/* PR 실무 활용 */}
          <Paper sx={{ ...sectionCardSx, p: { xs: 2.5, md: 4 } }}>
            <SectionTitle>PR 실무에서 어떻게 쓰이나요?</SectionTitle>
            <SectionSub>위험도 점수가 높은 게 목적이 아닙니다. PR 담당자가 더 빠르고 명확한 판단을 내릴 수 있도록 돕는 것이 목적입니다.</SectionSub>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2,1fr)" }, gap: 2 }}>
              {USE_CASES.map((f) => (
                <Box key={f.title} sx={{ p: 2.5, borderRadius: 1.5, bgcolor: "#f8fafc", border: "1px solid rgba(15,23,42,.07)" }}>
                  <Typography sx={{ fontWeight: 700, fontSize: 14, color: "#0f172a", mb: 0.75 }}>{f.title}</Typography>
                  <Typography sx={{ fontSize: 14, color: "#475569", lineHeight: 1.7 }}>{f.body}</Typography>
                </Box>
              ))}
            </Box>

            <Box sx={{ mt: 2, p: 2, borderRadius: 1.5, bgcolor: "#f8fafc", border: "1px solid rgba(15,23,42,.07)" }}>
              <Typography sx={{ fontSize: 13, fontWeight: 700, color: "#64748b", mb: 1 }}>수집 대상 넥슨 IP 5종</Typography>
              <Stack direction="row" flexWrap="wrap" spacing={1} useFlexGap>
                {IPS.map((name) => (
                  <Chip key={name} label={name} size="small" sx={{ ...statusChipSx, height: 26, fontSize: 12, fontWeight: 600, bgcolor: "#fff", border: "1px solid rgba(15,23,42,.12)", color: "#334155" }} />
                ))}
              </Stack>
            </Box>
          </Paper>

          {/* 운영 안정화 */}
          <Paper sx={{ ...sectionCardSx, p: { xs: 2.5, md: 4 } }}>
            <SectionTitle>운영 안정화 / 신뢰성</SectionTitle>
            <SectionSub>데이터가 쌓일수록 DB가 무거워지는 문제, 이슈 급등 시 수집 공백, 배포 후 즉시 검증 등 운영 현실에서 마주한 문제를 직접 해결했습니다.</SectionSub>

            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(3,1fr)" }, gap: 2, mb: 3 }}>
              {/* TTL 정책 */}
              <Box sx={{ p: 2.5, borderRadius: 1.5, bgcolor: "#f8fafc", border: "1px solid rgba(15,23,42,.07)" }}>
                <Typography sx={{ fontWeight: 700, fontSize: 14, color: "#0f172a", mb: 1.25 }}>TTL 데이터 보존 정책</Typography>
                <Stack spacing={1}>
                  {[
                    { label: "운영 기사",      value: "30일",  note: "LIVE_ARTICLE_RETENTION_DAYS" },
                    { label: "리스크 타임시리즈", value: "90일",  note: "RISK_TIMESERIES_RETENTION_DAYS" },
                    { label: "스케줄러 로그",   value: "7일",   note: "SCHEDULER_LOG_TTL_DAYS" },
                    { label: "테스트 기사",     value: "24시간", note: "TEST_ARTICLE_TTL_HOURS" },
                  ].map((r) => (
                    <Stack key={r.label} direction="row" alignItems="center" justifyContent="space-between">
                      <Typography sx={{ fontSize: 13, color: "#475569" }}>{r.label}</Typography>
                      <Chip label={r.value} size="small" sx={{ ...statusChipSx, height: 22, fontSize: 12, fontWeight: 700, bgcolor: "#e2e8f0", color: "#334155" }} />
                    </Stack>
                  ))}
                </Stack>
                <Typography sx={{ fontSize: 12, color: "#94a3b8", mt: 1.5, lineHeight: 1.6 }}>매일 새벽 4시 maintenance-cleanup 잡이 자동 실행해 기간 초과 데이터를 삭제합니다.</Typography>
              </Box>

              {/* 스케줄러 / 버스트 */}
              <Box sx={{ p: 2.5, borderRadius: 1.5, bgcolor: "#f8fafc", border: "1px solid rgba(15,23,42,.07)" }}>
                <Typography sx={{ fontWeight: 700, fontSize: 14, color: "#0f172a", mb: 1.25 }}>적응형 수집 스케줄러</Typography>
                <Stack spacing={1}>
                  {[
                    { label: "기본 수집 주기",    value: "10분" },
                    { label: "경쟁사 수집 주기",  value: "1시간" },
                    { label: "버스트 모드 주기",   value: "2분" },
                    { label: "버스트 최대 유지",   value: "2시간" },
                  ].map((r) => (
                    <Stack key={r.label} direction="row" alignItems="center" justifyContent="space-between">
                      <Typography sx={{ fontSize: 13, color: "#475569" }}>{r.label}</Typography>
                      <Chip label={r.value} size="small" sx={{ ...statusChipSx, height: 22, fontSize: 12, fontWeight: 700, bgcolor: "#e2e8f0", color: "#334155" }} />
                    </Stack>
                  ))}
                </Stack>
                <Typography sx={{ fontSize: 12, color: "#94a3b8", mt: 1.5, lineHeight: 1.6 }}>위험도 70점 이상 또는 볼륨 급증 감지 시 수집 주기를 10분→2분으로 자동 전환. 30분간 55점 미만 유지 시 조기 복귀.</Typography>
              </Box>

              {/* 헬스체크 / 스모크 */}
              <Box sx={{ p: 2.5, borderRadius: 1.5, bgcolor: "#f8fafc", border: "1px solid rgba(15,23,42,.07)" }}>
                <Typography sx={{ fontWeight: 700, fontSize: 14, color: "#0f172a", mb: 1.25 }}>헬스체크 / 스모크 테스트</Typography>
                <Stack spacing={0.75}>
                  {[
                    "/api/health — 내부 상태 확인",
                    "smoke_test.sh — 로컬 엔드포인트 검증",
                    "ops_external_smoke.sh — 운영 도메인 외부 검증",
                    "preflight_deploy_live.sh — 배포 전 필수 점검",
                  ].map((item) => (
                    <Typography key={item} sx={{ fontSize: 13, color: "#475569", lineHeight: 1.6 }}>· {item}</Typography>
                  ))}
                </Stack>
                <Typography sx={{ fontSize: 12, color: "#94a3b8", mt: 1.5, lineHeight: 1.6 }}>배포 전 preflight 실패 시 즉시 중단. 외부 스모크는 두 시점 결과를 비교해 회귀 여부를 판단합니다.</Typography>
              </Box>
            </Box>

            {/* 최근 안정화 포인트 */}
            <Box>
              <Typography sx={{ fontWeight: 700, fontSize: 13, color: "#64748b", letterSpacing: ".04em", textTransform: "uppercase", mb: 1.5 }}>
                최근 반영된 안정화 포인트
              </Typography>
              <Stack spacing={1.25}>
                {[
                  {
                    title: "IP 편향 버그 제거",
                    body: "뉴스 수집·리스크 필터에서 여러 IP를 동시에 처리할 때 첫 번째 IP에만 결과가 몰리던 first-match 편향을 제거해 IP별 점수 독립성을 확보했습니다.",
                  },
                  {
                    title: "EMA 동적 α로 노이즈 제거",
                    body: "위험도 점수 급등락을 막기 위해 지수 이동평균(EMA) 평활화를 도입했습니다. 급등 구간에서는 α를 낮춰(0.1) 노이즈를 흡수하고, 초기값에는 α=1.0을 적용해 첫 점수를 정확히 반영합니다.",
                  },
                  {
                    title: "버스트 모드 자동 복귀 조건 추가",
                    body: "이전에는 버스트 모드 진입 후 최대 시간(2시간)이 지나야만 복귀했습니다. 이제 30분간 위험도 55점 미만이 유지되면 조기 복귀해 불필요한 수집 빈도를 줄입니다.",
                  },
                ].map((item) => (
                  <Box key={item.title} sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "160px 1fr" }, borderRadius: 1.5, border: "1px solid rgba(15,23,42,.07)", overflow: "hidden" }}>
                    <Box sx={{ p: 2, bgcolor: "#f8fafc", borderRight: { sm: "1px solid rgba(15,23,42,.07)" } }}>
                      <Typography sx={{ fontWeight: 700, fontSize: 13, color: "#0f172a" }}>{item.title}</Typography>
                    </Box>
                    <Box sx={{ p: 2 }}>
                      <Typography sx={{ fontSize: 13, color: "#475569", lineHeight: 1.7 }}>{item.body}</Typography>
                    </Box>
                  </Box>
                ))}
              </Stack>
            </Box>
          </Paper>

          {/* 한계와 개선 계획 */}
          <Paper sx={{ ...sectionCardSx, p: { xs: 2.5, md: 4 } }}>
            <SectionTitle>한계와 개선 계획</SectionTitle>
            <SectionSub>현재 구조의 한계를 명확히 인식하고, 다음 단계를 구체적으로 정의해뒀습니다.</SectionSub>

            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 2 }}>
              {/* 현재 한계 */}
              <Box>
                <Typography sx={{ fontWeight: 700, fontSize: 13, color: "#64748b", letterSpacing: ".04em", textTransform: "uppercase", mb: 1.5 }}>
                  현재 한계
                </Typography>
                <Stack spacing={1.25}>
                  {[
                    {
                      title: "수집 채널이 네이버 뉴스 단일",
                      body: "커뮤니티(DC인사이드, 에펨코리아), SNS, 유튜브 댓글 등 여론 형성 공간이 분석에 포함되지 않아 실제 유저 반응을 완전히 반영하지 못합니다.",
                    },
                    {
                      title: "규칙 기반 감성 분석의 문맥 한계",
                      body: "'복구 완료' 같은 완화어를 반영하지만, 반어적 표현이나 신조어·줄임말은 오분류됩니다. 정밀한 문맥 이해는 현재 방식의 구조적 한계입니다.",
                    },
                    {
                      title: "키워드 매칭 기반 IP 분류",
                      body: "IP명 키워드가 다른 문맥(동명이인, 중의어)에서 등장할 경우 오탐이 발생할 수 있습니다. 현재는 수동 키워드 튜닝으로 보정 중입니다.",
                    },
                  ].map((item) => (
                    <Box key={item.title} sx={{ p: 2, borderRadius: 1.5, bgcolor: "#fef2f2", border: "1px solid #fecaca" }}>
                      <Typography sx={{ fontWeight: 700, fontSize: 13, color: "#991b1b", mb: 0.5 }}>{item.title}</Typography>
                      <Typography sx={{ fontSize: 13, color: "#475569", lineHeight: 1.7 }}>{item.body}</Typography>
                    </Box>
                  ))}
                </Stack>
              </Box>

              {/* 다음 개선 */}
              <Box>
                <Typography sx={{ fontWeight: 700, fontSize: 13, color: "#64748b", letterSpacing: ".04em", textTransform: "uppercase", mb: 1.5 }}>
                  다음 개선 로드맵
                </Typography>
                <Stack spacing={1.25}>
                  {[
                    {
                      tag: "감성 분석",
                      title: "ML 모델로 전환",
                      body: "KLUE-RoBERTa 또는 게임 도메인 특화 감성 모델을 도입해 문맥 이해·신조어·반어 표현 오분류를 줄입니다.",
                    },
                    {
                      tag: "수집 확대",
                      title: "커뮤니티·SNS 채널 추가",
                      body: "에펨코리아·디시인사이드 등 게임 커뮤니티와 X(트위터) 언급량을 수집해 뉴스 이전 단계의 여론 신호를 감지합니다.",
                    },
                    {
                      tag: "알림 자동화",
                      title: "임계치 초과 시 즉시 알림",
                      body: "위험도가 특정 임계치를 넘으면 슬랙 또는 이메일로 자동 알림을 발송해 PR 담당자가 대시보드를 직접 확인하지 않아도 대응할 수 있게 합니다.",
                    },
                  ].map((item) => (
                    <Box key={item.title} sx={{ p: 2, borderRadius: 1.5, bgcolor: "#f0fdf4", border: "1px solid #bbf7d0" }}>
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                        <Chip label={item.tag} size="small" sx={{ ...statusChipSx, height: 20, fontSize: 11, fontWeight: 700, bgcolor: "#dcfce7", color: "#15803d", border: "1px solid #bbf7d0" }} />
                        <Typography sx={{ fontWeight: 700, fontSize: 13, color: "#14532d" }}>{item.title}</Typography>
                      </Stack>
                      <Typography sx={{ fontSize: 13, color: "#475569", lineHeight: 1.7 }}>{item.body}</Typography>
                    </Box>
                  ))}
                </Stack>
              </Box>
            </Box>
          </Paper>

          {/* 기술 스택 — 하단, 간략하게 */}
          <Paper sx={{ ...sectionCardSx, p: { xs: 2.5, md: 4 } }}>
            <SectionTitle>구현 스택</SectionTitle>
            <SectionSub>기획·설계·개발·배포 전 과정을 직접 수행했습니다.</SectionSub>
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

          {/* 개발자 + CTA */}
          <Paper sx={{ ...sectionCardSx, p: { xs: 2.5, md: 4 } }}>
            <Stack direction={{ xs: "column", md: "row" }} alignItems={{ md: "center" }} justifyContent="space-between" spacing={2} sx={{ mb: 3 }}>
              <Stack direction="row" spacing={2} alignItems="center">
                <Box sx={{ width: 52, height: 52, borderRadius: "50%", background: "linear-gradient(135deg,#0f3b66,#1a5598)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 20, color: "#e2e8f0", flexShrink: 0 }}>
                  문
                </Box>
                <Box>
                  <Typography sx={{ fontWeight: 800, fontSize: 17, color: "#0f172a" }}>문종원</Typography>
                  <Typography sx={{ fontSize: 14, color: "#64748b", mt: 0.25 }}>PR 실시간 이슈 현황판 기획 · 설계 · 개발</Typography>
                  <Typography component="a" href="mailto:rmrmfwhddnjs@gmail.com" sx={{ fontSize: 13, color: "#0f3b66", mt: 0.25, display: "block", textDecoration: "none", "&:hover": { textDecoration: "underline" } }}>
                    rmrmfwhddnjs@gmail.com
                  </Typography>
                </Box>
              </Stack>
            </Stack>

            <Box sx={{ pt: 3, borderTop: "1px solid rgba(15,23,42,.07)" }}>
              <Typography sx={{ fontWeight: 700, fontSize: 15, color: "#0f172a", mb: 0.5 }}>직접 확인해보세요</Typography>
              <Typography sx={{ fontSize: 14, color: "#64748b", mb: 2 }}>실시간 모니터링·과거 분석·경쟁사 비교 모든 기능이 작동 중입니다.</Typography>
              <Stack direction="row" spacing={1.25} flexWrap="wrap" useFlexGap>
                <Button component={Link} href="/rebuild/nexon" variant="contained" sx={actionButtonSx.primary}>
                  넥슨 IP 리스크 →
                </Button>
                <Button component={Link} href="/rebuild/nexon/backtest" variant="outlined" sx={actionButtonSx.secondary}>
                  과거 분석 →
                </Button>
                <Button component={Link} href="/rebuild/compare" variant="outlined" sx={actionButtonSx.secondary}>
                  경쟁사 비교 →
                </Button>
              </Stack>
            </Box>
          </Paper>

        </Stack>
      </Container>
    </Box>
  );
}
