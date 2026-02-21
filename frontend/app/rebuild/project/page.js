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
  sectionCardSx,
  specTypeSx,
  statusChipSx,
} from "../../../lib/uiTokens";

/* ─────────── 데이터 ─────────── */

const PROBLEMS = [
  {
    icon: "❓",
    title: "위기 여부 판단 기준 없음",
    body: "기사량이 급증해도 '이게 진짜 위기인지 일시적 관심인지' 즉시 판단할 수 있는 기준이 없었습니다.",
  },
  {
    icon: "📉",
    title: "보고서에 수치 근거 부족",
    body: "이슈 심각도를 보고할 때 정량적 근거가 없어 대응이 항상 사후적이고 감으로 결정되는 문제가 있었습니다.",
  },
  {
    icon: "🔍",
    title: "업계 맥락 없는 단독 모니터링",
    body: "자사 게임만 보다 보니 경쟁사와 비교했을 때 지금 이슈가 크게 튀는 건지 아닌지 알 수가 없었습니다.",
  },
];

const SIGNALS = [
  {
    key: "감성 반응",
    eng: "Sentiment",
    weight: "50%",
    color: "#3b82f6",
    bg: "#eff6ff",
    border: "#bfdbfe",
    question: "기사 논조가 얼마나 부정적인가?",
    body: "수집된 기사를 AI 모델로 분류해 부정 감성이 얼마나 강하게 나타나는지 측정합니다. 단순히 부정 기사 개수가 아니라 모델이 판단한 확신도까지 반영해 가중 평균을 냅니다.",
  },
  {
    key: "기사량 급증",
    eng: "Volume spike",
    weight: "25%",
    color: "#f59e0b",
    bg: "#fffbeb",
    border: "#fde68a",
    question: "평소 대비 갑자기 기사가 쏟아지고 있는가?",
    body: "최근 1시간 기사 수를 과거 7일 같은 요일·같은 시간대 평균과 비교해 얼마나 이탈했는지 계산합니다. '2배 많다'가 아니라 '통계적으로 얼마나 비정상인가'를 측정합니다.",
  },
  {
    key: "위험 주제",
    eng: "Theme risk",
    weight: "15%",
    color: "#8b5cf6",
    bg: "#f5f3ff",
    border: "#ddd6fe",
    question: "기사가 다루는 주제가 얼마나 민감한가?",
    body: "확률형/BM 논란·규제·환불·운영 장애·여론 악화 등 PR 관점에서 위험한 주제일수록 높은 가중치를 줍니다. 단순 '신작 출시' 기사는 위험 주제로 보지 않습니다.",
  },
  {
    key: "보도 채널",
    eng: "Media reach",
    weight: "10%",
    color: "#10b981",
    bg: "#ecfdf5",
    border: "#a7f3d0",
    question: "어느 매체가 다루고 있는가?",
    body: "연합뉴스·조선일보·KBS 같은 주요 매체가 다루면 더 높은 가중치를 적용합니다. 게임 전문 매체와 일반 블로그는 등급이 다릅니다.",
  },
];

const THEMES = [
  { name: "확률형/BM 논란", w: 1.0, color: "#dc2626", desc: "가챠·과금 이슈" },
  { name: "규제·법적 이슈",  w: 0.9, color: "#ea580c", desc: "공정위·소송·과징금" },
  { name: "보상·환불 요구",  w: 0.8, color: "#d97706", desc: "환불·배상 민원" },
  { name: "운영·장애",       w: 0.7, color: "#ca8a04", desc: "서버 오류·점검 불만" },
  { name: "여론·커뮤니티",   w: 0.7, color: "#65a30d", desc: "비판·시위·집단 불만" },
  { name: "신작·성과",       w: 0.4, color: "#0891b2", desc: "출시·흥행·매출 (저위험)" },
];

const ALERT_LEVELS = [
  { label: "심각",  range: "70 이상", color: "#dc2626", bg: "#fef2f2", desc: "즉각 대응 필요, 보고 라인 가동" },
  { label: "높음",  range: "45–69",  color: "#ea580c", bg: "#fff7ed", desc: "당일 모니터링 강화, 대응안 준비" },
  { label: "주의",  range: "20–44",  color: "#ca8a04", bg: "#fefce8", desc: "관찰 유지, 추이 기록" },
  { label: "낮음",  range: "20 미만", color: "#16a34a", bg: "#f0fdf4", desc: "정상 범위" },
];

const PIPELINE = [
  { n: "01", title: "뉴스 자동 수집",    body: "게임 IP별 키워드(메이플스토리, 던파 등)로 네이버 뉴스를 주기적으로 수집합니다. 중복 URL은 자동으로 걸러냅니다." },
  { n: "02", title: "AI 감성 분류",     body: "수집된 기사를 AI 모델에 통과시켜 긍정·중립·부정으로 분류하고, 분류 확신도도 함께 저장합니다." },
  { n: "03", title: "위험도 점수 산출", body: "감성·기사량·위험 주제·보도 채널 4가지 신호를 가중 합산해 0~100점의 위험도 점수를 만듭니다. 점수가 튀는 것을 막기 위해 직전 점수와 평균(EMA)도 반영합니다." },
  { n: "04", title: "알림 등급 판정",   body: "점수에 따라 낮음·주의·높음·심각 4단계로 분류해 대시보드에 표시합니다. PR 담당자가 한눈에 현황을 파악할 수 있습니다." },
];

const FEATURES = [
  { icon: "📡", title: "실시간 모니터링",     body: "스케줄러가 IP별로 뉴스를 자동 수집하고 위험도를 재계산합니다. 직접 검색하지 않아도 현황이 계속 갱신됩니다." },
  { icon: "🔎", title: "점수 근거 설명",      body: "'왜 위험한가'를 4가지 신호 값으로 분해해 표시합니다. 숫자 하나만 보여주는 게 아니라 원인까지 바로 읽을 수 있습니다." },
  { icon: "🔁", title: "과거 구간 재현",      body: "특정 기간을 다시 돌려보며 당시 위험도가 어떻게 변했는지 확인합니다. 가중치를 바꿔 '그 때 이 공식이 작동했을까'도 검증할 수 있습니다." },
  { icon: "📊", title: "경쟁사 비교",         body: "넥슨 IP와 경쟁사 타이틀의 기사량·감성·위험 주제를 나란히 비교합니다. 업계 맥락 안에서 현재 위험 수준을 판단할 수 있습니다." },
];

const IPS = [
  { name: "메이플스토리", eng: "MapleStory" },
  { name: "던전앤파이터",  eng: "Dungeon & Fighter" },
  { name: "아크레이더스",  eng: "ARC Raiders" },
  { name: "FC온라인",      eng: "EA Sports FC Online" },
  { name: "블루아카이브",  eng: "Blue Archive" },
];

const STACK = [
  { group: "프론트엔드",    items: ["Next.js 14", "React 18", "MUI v7", "ECharts 6", "Tailwind CSS", "TypeScript"] },
  { group: "백엔드 / 데이터", items: ["FastAPI (Python)", "SQLite", "pandas", "APScheduler", "네이버 뉴스 API", "AI 감성 모델"] },
  { group: "인프라",        items: ["Docker", "Docker Compose", "AWS EC2", "Jenkins"] },
];

/* ─────────── 서브 컴포넌트 ─────────── */

function SectionHeader({ icon, title, sub }) {
  return (
    <Box sx={{ mb: 3 }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
        <Typography sx={{ fontSize: 20 }}>{icon}</Typography>
        <Typography sx={{ ...specTypeSx.h5, color: "#0f172a" }}>{title}</Typography>
      </Stack>
      {sub && (
        <Typography sx={{ ...specTypeSx.body1, color: "#64748b", lineHeight: 1.75 }}>
          {sub}
        </Typography>
      )}
    </Box>
  );
}

function StackBadge({ name }) {
  return (
    <Box
      component="span"
      sx={{
        display: "inline-block",
        px: 1.5,
        py: 0.5,
        borderRadius: 1.5,
        fontSize: 13,
        fontWeight: 600,
        border: "1px solid rgba(15,23,42,.14)",
        bgcolor: "#f8fafc",
        color: "#334155",
        whiteSpace: "nowrap",
      }}
    >
      {name}
    </Box>
  );
}

/* ─────────── 메인 페이지 ─────────── */

export default function ProjectPage() {
  return (
    <Box sx={{ ...pageShellCleanSx, py: { xs: 2, md: 5 } }}>
      <Container maxWidth="xl" sx={{ ...pageContainerSx, maxWidth: "1000px !important" }}>
        <Stack spacing={3}>

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
          <Paper
            sx={{
              ...sectionCardSx,
              background: "linear-gradient(135deg, #0f3b66 0%, #1a5598 60%, #0a2d52 100%)",
              p: { xs: 3, md: 5 },
              overflow: "hidden",
              position: "relative",
            }}
          >
            {/* 배경 장식 */}
            <Box sx={{ position: "absolute", top: -60, right: -60, width: 280, height: 280, borderRadius: "50%", background: "radial-gradient(circle,rgba(154,203,25,.18) 0%,transparent 70%)", pointerEvents: "none" }} />

            <Stack spacing={2.5} sx={{ position: "relative", zIndex: 1 }}>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Chip label="포트폴리오 프로젝트" size="small" sx={{ ...statusChipSx, bgcolor: "rgba(255,255,255,.15)", color: "#e2e8f0", border: "1px solid rgba(255,255,255,.2)" }} />
                <Chip label="PR 실시간 이슈 현황판" size="small" sx={{ ...statusChipSx, bgcolor: "rgba(154,203,25,.25)", color: "#d4f55a", border: "1px solid rgba(154,203,25,.4)" }} />
              </Stack>

              <Box>
                <Typography sx={{ ...specTypeSx.h3, color: "#fff", fontSize: { xs: 28, md: 40 }, lineHeight: 1.1, mb: 1.5 }}>
                  게임 PR 실시간<br />이슈 인텔리전스 대시보드
                </Typography>
                <Typography sx={{ ...specTypeSx.body1, color: "rgba(255,255,255,.75)", maxWidth: 600, lineHeight: 1.8 }}>
                  네이버 뉴스를 자동 수집해 기사의 논조·급증 여부·위험 주제·보도 채널을 종합 분석,
                  넥슨 게임 IP의 PR 위험 신호를 0–100점으로 실시간 정량화하는 풀스택 포트폴리오입니다.
                </Typography>
              </Box>

              {/* 개발자 카드 */}
              <Stack
                direction="row"
                spacing={2}
                alignItems="center"
                sx={{
                  display: "inline-flex",
                  bgcolor: "rgba(255,255,255,.1)",
                  border: "1px solid rgba(255,255,255,.18)",
                  borderRadius: 2.5,
                  px: 2.5,
                  py: 1.5,
                  backdropFilter: "blur(8px)",
                }}
              >
                <Box sx={{ width: 44, height: 44, borderRadius: "50%", background: "linear-gradient(135deg,#9acb19,#6fa012)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 18, color: "#fff", flexShrink: 0 }}>
                  문
                </Box>
                <Box>
                  <Typography sx={{ fontWeight: 800, fontSize: 16, color: "#fff" }}>문종원</Typography>
                  <Typography sx={{ fontSize: 13, color: "rgba(255,255,255,.7)", mt: 0.3 }}>
                    PR 실시간 이슈 현황판 설계 / 풀스택 개발
                  </Typography>
                  <Typography sx={{ fontSize: 12, color: "rgba(255,255,255,.5)", mt: 0.2 }}>
                    rmrmfwhddnjs@gmail.com
                  </Typography>
                </Box>
              </Stack>
            </Stack>
          </Paper>

          {/* 문제 정의 */}
          <Paper sx={{ ...sectionCardSx, p: { xs: 2.5, md: 4 } }}>
            <SectionHeader
              icon="🎯"
              title="어떤 문제를 해결하나요?"
              sub="게임 PR 현장에서 반복적으로 마주치는 세 가지 한계에서 출발했습니다."
            />
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(3,1fr)" }, gap: 2 }}>
              {PROBLEMS.map((p) => (
                <Box key={p.title} sx={{ p: 2.5, borderRadius: 2, bgcolor: "#f8fafc", border: "1px solid rgba(15,23,42,.08)" }}>
                  <Typography sx={{ fontSize: 22, mb: 1 }}>{p.icon}</Typography>
                  <Typography sx={{ fontWeight: 700, fontSize: 15, color: "#0f172a", mb: 0.75 }}>{p.title}</Typography>
                  <Typography sx={{ fontSize: 14, color: "#475569", lineHeight: 1.7 }}>{p.body}</Typography>
                </Box>
              ))}
            </Box>
          </Paper>

          {/* 위험도 계산 방식 — PR 친화적 설명 */}
          <Paper sx={{ ...sectionCardSx, p: { xs: 2.5, md: 4 } }}>
            <SectionHeader
              icon="🧭"
              title="위험도, 어떻게 계산하나요?"
              sub="기사 하나하나를 4가지 질문으로 바라봅니다. 그 답을 가중 합산해 0~100점의 위험도 점수를 만듭니다."
            />

            {/* 4가지 신호 카드 */}
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2,1fr)" }, gap: 2, mb: 3 }}>
              {SIGNALS.map((s) => (
                <Box
                  key={s.key}
                  sx={{ p: 2.5, borderRadius: 2, bgcolor: s.bg, border: `1.5px solid ${s.border}` }}
                >
                  <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Box sx={{ width: 32, height: 32, borderRadius: 1.5, bgcolor: s.color, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Typography sx={{ fontWeight: 900, fontSize: 13, color: "#fff" }}>{s.eng[0]}</Typography>
                      </Box>
                      <Box>
                        <Typography sx={{ fontWeight: 800, fontSize: 14, color: "#0f172a" }}>{s.key}</Typography>
                        <Typography sx={{ fontSize: 11, color: "#64748b" }}>{s.eng}</Typography>
                      </Box>
                    </Stack>
                    <Chip label={s.weight} size="small" sx={{ bgcolor: s.color, color: "#fff", fontWeight: 800, fontSize: 12, height: 24 }} />
                  </Stack>
                  <Typography sx={{ fontSize: 13, fontWeight: 700, color: s.color, mb: 0.75 }}>
                    "{s.question}"
                  </Typography>
                  <Typography sx={{ fontSize: 13, color: "#475569", lineHeight: 1.7 }}>{s.body}</Typography>
                </Box>
              ))}
            </Box>

            {/* 위험 주제 가중치 */}
            <Box sx={{ p: 2.5, borderRadius: 2, bgcolor: "#f8fafc", border: "1px solid rgba(15,23,42,.08)", mb: 2 }}>
              <Typography sx={{ fontWeight: 700, fontSize: 14, color: "#0f172a", mb: 2 }}>
                위험 주제별 심각도 가중치 — 어떤 주제를 다루느냐에 따라 점수가 달라집니다
              </Typography>
              <Stack spacing={1.25}>
                {THEMES.map((t) => (
                  <Stack key={t.name} direction="row" alignItems="center" spacing={1.5}>
                    <Typography sx={{ minWidth: 130, fontSize: 13, fontWeight: 700, color: t.color }}>{t.name}</Typography>
                    <Box sx={{ flex: 1, height: 7, borderRadius: 99, bgcolor: "#e5e7eb", overflow: "hidden" }}>
                      <Box sx={{ width: `${t.w * 100}%`, height: "100%", bgcolor: t.color, borderRadius: 99 }} />
                    </Box>
                    <Typography sx={{ minWidth: 28, fontSize: 13, fontWeight: 700, color: "#475569" }}>{t.w.toFixed(1)}</Typography>
                    <Typography sx={{ fontSize: 12, color: "#94a3b8", display: { xs: "none", sm: "block" } }}>{t.desc}</Typography>
                  </Stack>
                ))}
              </Stack>
            </Box>

            {/* 알림 등급 */}
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2,1fr)", md: "repeat(4,1fr)" }, gap: 1.5, mb: 3 }}>
              {ALERT_LEVELS.map((a) => (
                <Box key={a.label} sx={{ p: 2, borderRadius: 2, bgcolor: a.bg, border: `1px solid ${a.color}33`, textAlign: "center" }}>
                  <Typography sx={{ fontWeight: 800, fontSize: 18, color: a.color }}>{a.label}</Typography>
                  <Typography sx={{ fontSize: 12, fontWeight: 700, color: a.color, mb: 0.5 }}>{a.range}점</Typography>
                  <Typography sx={{ fontSize: 12, color: "#475569", lineHeight: 1.5 }}>{a.desc}</Typography>
                </Box>
              ))}
            </Box>

            {/* 기술 상세 — 접을 수 있는 보조 설명 */}
            <Box sx={{ p: 2, borderRadius: 2, bgcolor: "#0f172a", border: "1px solid rgba(255,255,255,.06)" }}>
              <Typography sx={{ fontSize: 11, fontWeight: 700, color: "#64748b", letterSpacing: ".08em", textTransform: "uppercase", mb: 1 }}>
                기술 참고 — 실제 산식
              </Typography>
              <Box sx={{ fontFamily: "'JetBrains Mono','Fira Code',monospace", fontSize: { xs: 12, md: 13 }, lineHeight: 2 }}>
                <Box><Box component="span" sx={{ color: "#9acb19", fontWeight: 700 }}>위험도</Box><Box component="span" sx={{ color: "#94a3b8" }}> = 100 × (</Box><Box component="span" sx={{ color: "#93c5fd" }}>0.50 × 감성</Box><Box component="span" sx={{ color: "#94a3b8" }}> + </Box><Box component="span" sx={{ color: "#fcd34d" }}>0.25 × 급증</Box><Box component="span" sx={{ color: "#94a3b8" }}> + </Box><Box component="span" sx={{ color: "#c4b5fd" }}>0.15 × 위험주제</Box><Box component="span" sx={{ color: "#94a3b8" }}> + </Box><Box component="span" sx={{ color: "#6ee7b7" }}>0.10 × 채널×부정비율</Box><Box component="span" sx={{ color: "#94a3b8" }}>)</Box></Box>
                <Box><Box component="span" sx={{ color: "#fb923c", fontWeight: 700 }}>이슈열기</Box><Box component="span" sx={{ color: "#94a3b8" }}> = 100 × (</Box><Box component="span" sx={{ color: "#fcd34d" }}>0.45 × 급증</Box><Box component="span" sx={{ color: "#94a3b8" }}> + </Box><Box component="span" sx={{ color: "#c4b5fd" }}>0.35 × 위험주제</Box><Box component="span" sx={{ color: "#94a3b8" }}> + </Box><Box component="span" sx={{ color: "#6ee7b7" }}>0.20 × 채널</Box><Box component="span" sx={{ color: "#94a3b8" }}>)   ← 확산 속도 신호</Box></Box>
                <Box><Box component="span" sx={{ color: "#f9a8d4", fontWeight: 700 }}>최종점수</Box><Box component="span" sx={{ color: "#94a3b8" }}> = EMA 평활화 (α 0.1~1.0 동적 조정, 노이즈 제거)</Box></Box>
              </Box>
            </Box>
          </Paper>

          {/* 데이터 파이프라인 */}
          <Paper sx={{ ...sectionCardSx, p: { xs: 2.5, md: 4 } }}>
            <SectionHeader
              icon="🔄"
              title="데이터가 흐르는 방식"
              sub="뉴스 수집부터 대시보드 표시까지 자동으로 처리됩니다."
            />
            <Stack spacing={1.5} sx={{ mb: 3 }}>
              {PIPELINE.map((p, i) => (
                <Stack key={p.n} direction="row" spacing={2} alignItems="flex-start">
                  <Box sx={{ minWidth: 36, height: 36, borderRadius: "50%", bgcolor: "#0f3b66", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, flexShrink: 0 }}>
                    {p.n}
                  </Box>
                  <Box sx={{ p: 2, flex: 1, borderRadius: 2, bgcolor: i % 2 === 0 ? "#f8fafc" : "#fff", border: "1px solid rgba(15,23,42,.08)" }}>
                    <Typography sx={{ fontWeight: 700, fontSize: 14, color: "#0f172a", mb: 0.5 }}>{p.title}</Typography>
                    <Typography sx={{ fontSize: 13, color: "#475569", lineHeight: 1.7 }}>{p.body}</Typography>
                  </Box>
                </Stack>
              ))}
            </Stack>

            {/* 수집 대상 IP */}
            <Box sx={{ p: 2, borderRadius: 2, bgcolor: "rgba(154,203,25,.07)", border: "1px solid rgba(154,203,25,.3)" }}>
              <Typography sx={{ fontSize: 13, fontWeight: 700, color: "#3d6b00", mb: 1.25 }}>수집 대상 넥슨 IP 5종</Typography>
              <Stack direction="row" flexWrap="wrap" spacing={1} useFlexGap>
                {IPS.map((ip) => (
                  <Box key={ip.name} sx={{ px: 1.75, py: 0.5, borderRadius: 99, bgcolor: "#fff", border: "1px solid rgba(154,203,25,.5)", fontSize: 13, fontWeight: 600, color: "#1a3d00", display: "flex", alignItems: "center", gap: 0.75 }}>
                    {ip.name}
                    <Box component="span" sx={{ fontSize: 11, color: "#64748b", fontWeight: 400 }}>{ip.eng}</Box>
                  </Box>
                ))}
              </Stack>
            </Box>
          </Paper>

          {/* 주요 기능 */}
          <Paper sx={{ ...sectionCardSx, p: { xs: 2.5, md: 4 } }}>
            <SectionHeader
              icon="✨"
              title="주요 기능"
              sub="리스크 탐지·원인 설명·과거 검증·경쟁 비교, PR 의사결정 흐름에 맞춰 설계했습니다."
            />
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2,1fr)" }, gap: 2 }}>
              {FEATURES.map((f) => (
                <Box key={f.title} sx={{ p: 2.5, borderRadius: 2, bgcolor: "#f8fafc", border: "1px solid rgba(15,23,42,.08)" }}>
                  <Typography sx={{ fontSize: 24, mb: 1 }}>{f.icon}</Typography>
                  <Typography sx={{ fontWeight: 700, fontSize: 15, color: "#0f172a", mb: 0.75 }}>{f.title}</Typography>
                  <Typography sx={{ fontSize: 14, color: "#475569", lineHeight: 1.7 }}>{f.body}</Typography>
                </Box>
              ))}
            </Box>
          </Paper>

          {/* 기술 스택 */}
          <Paper sx={{ ...sectionCardSx, p: { xs: 2.5, md: 4 } }}>
            <SectionHeader
              icon="🛠"
              title="기술 스택"
              sub="프론트엔드·백엔드·인프라를 직접 설계하고 구현한 풀스택 프로젝트입니다."
            />
            <Stack spacing={2.5}>
              {STACK.map((g) => (
                <Box key={g.group}>
                  <Typography sx={{ fontSize: 11, fontWeight: 800, color: "#94a3b8", letterSpacing: ".08em", textTransform: "uppercase", mb: 1 }}>
                    {g.group}
                  </Typography>
                  <Stack direction="row" flexWrap="wrap" spacing={1} useFlexGap>
                    {g.items.map((name) => <StackBadge key={name} name={name} />)}
                  </Stack>
                </Box>
              ))}
            </Stack>
          </Paper>

          {/* 개발자 카드 */}
          <Paper sx={{ ...sectionCardSx, p: { xs: 2.5, md: 4 } }}>
            <Stack direction={{ xs: "column", sm: "row" }} alignItems={{ sm: "center" }} justifyContent="space-between" spacing={2.5}>
              <Stack direction="row" spacing={2.5} alignItems="center">
                <Box sx={{ width: 60, height: 60, borderRadius: "50%", background: "linear-gradient(135deg,#0f3b66,#9acb19)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 24, color: "#fff", flexShrink: 0 }}>
                  문
                </Box>
                <Box>
                  <Typography sx={{ ...specTypeSx.h5, color: "#0f172a", mb: 0.5 }}>문종원</Typography>
                  <Typography sx={{ fontSize: 14, color: "#64748b", mb: 1 }}>PR 실시간 이슈 현황판 설계 / 풀스택 개발</Typography>
                  <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                    <Chip label="PR Analytics" size="small" sx={{ ...statusChipSx, bgcolor: "#eff6ff", color: "#1d4ed8", border: "1px solid #bfdbfe" }} />
                    <Chip label="Full-Stack Dev" size="small" sx={{ ...statusChipSx, bgcolor: "#f0fdf4", color: "#16a34a", border: "1px solid #bbf7d0" }} />
                    <Chip label="Data Pipeline" size="small" sx={{ ...statusChipSx, bgcolor: "#faf5ff", color: "#7e22ce", border: "1px solid #ddd6fe" }} />
                  </Stack>
                </Box>
              </Stack>
              <Button
                component="a"
                href="mailto:rmrmfwhddnjs@gmail.com"
                variant="outlined"
                sx={{ ...actionButtonSx.secondary, whiteSpace: "nowrap" }}
              >
                📧 rmrmfwhddnjs@gmail.com
              </Button>
            </Stack>
          </Paper>

          {/* 하단 CTA */}
          <Paper sx={{ ...sectionCardSx, p: { xs: 2.5, md: 3.5 }, bgcolor: "#f8fafc" }}>
            <Stack direction={{ xs: "column", sm: "row" }} alignItems={{ sm: "center" }} justifyContent="space-between" spacing={2}>
              <Box>
                <Typography sx={{ fontWeight: 800, fontSize: 17, color: "#0f172a" }}>직접 확인해보세요</Typography>
                <Typography sx={{ fontSize: 14, color: "#64748b", mt: 0.5 }}>
                  실시간 모니터링·과거 분석·경쟁사 비교 모든 기능이 작동 중입니다.
                </Typography>
              </Box>
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
            </Stack>
          </Paper>

        </Stack>
      </Container>
    </Box>
  );
}
