"use client";

import Link from "next/link";
import { Box, Button, Container, Divider, Paper, Stack, Typography } from "@mui/material";
import {
  actionButtonSx,
  navButtonSx,
  pageContainerSx,
  pageShellSx,
  sectionCardSx,
} from "../../lib/uiTokens";

const sections = [
  {
    title: "문제 정의",
    body: "게임 PR 운영에서는 기사량이 급증할 때 이슈가 실제 위기로 전환되는지 빠르게 판단하기 어렵습니다. 단순 모니터링만으로는 대응 우선순위를 정하기 어렵고, 사후 보고도 정량 근거가 약해지는 문제가 있습니다.",
  },
  {
    title: "해결 접근",
    body: "네이버 뉴스 수집 파이프라인과 IP별 위험도 산식(S/V/T/M)을 결합해 리스크 점수를 산출했습니다. 실시간 모드에서는 스케줄러 기반 자동 수집, 백테스트 모드에서는 과거 구간 재현으로 모델 반응을 검증하도록 설계했습니다.",
  },
  {
    title: "실무 활용 가치",
    body: "위험도 점수를 기사량, 테마, 확산 신호로 분해해 표시함으로써 PR 담당자가 '왜 위험한지'를 즉시 해석할 수 있습니다. 또한 경쟁사 비교/백테스트/실시간 모니터링을 분리해 보고 목적에 맞는 의사결정을 지원합니다.",
  },
];

export default function ProjectPage() {
  return (
    <Box sx={{ ...pageShellSx, py: { xs: 2, md: 4 } }}>
      <Container maxWidth="md" sx={{ ...pageContainerSx, maxWidth: "980px !important" }}>
        <Paper sx={{ ...sectionCardSx, bgcolor: "#f8fafc", px: { xs: 2.5, md: 5 }, py: { xs: 3, md: 5 }, boxShadow: "0 14px 38px rgba(15,23,42,.06)" }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
            <Typography sx={{ fontSize: { xs: 24, md: 30 }, fontWeight: 800, color: "#0f172a", letterSpacing: "-.02em" }}>
              프로젝트 소개
            </Typography>
            <Button component={Link} href="/" variant="outlined" sx={navButtonSx}>
              메인으로
            </Button>
          </Stack>

          <Typography sx={{ fontSize: { xs: 16, md: 18 }, color: "#64748b", lineHeight: 1.7, mb: 4 }}>
            게임 PR 실무 의사결정에 바로 연결되는 분석 구조를 목표로 설계한 포트폴리오입니다.
          </Typography>

          <Stack spacing={3.5}>
            {sections.map((section) => (
              <Box key={section.title}>
                <Typography sx={{ fontSize: 22, fontWeight: 700, color: "#111827", mb: 1 }}>{section.title}</Typography>
                <Typography sx={{ color: "#475569", lineHeight: 1.85, fontSize: 16 }}>{section.body}</Typography>
              </Box>
            ))}
          </Stack>

          <Divider sx={{ my: 4 }} />

          <Stack spacing={1}>
            <Typography sx={{ fontSize: 22, fontWeight: 700, color: "#111827" }}>핵심 구성</Typography>
            <Typography sx={{ color: "#475569", fontSize: 16, lineHeight: 1.75 }}>
              1. 실시간 수집: IP별 스케줄링 + 중복 제거 + 운영 로그
              <br />
              2. 분석 엔진: 감성/볼륨/테마/매체 신호 결합 리스크 산식
              <br />
              3. 검증 체계: 백테스트 타임라인으로 임계치 반응 검증
              <br />
              4. 대시보드: 실시간 모니터링 + 설명 가능한 지표 표시
            </Typography>
          </Stack>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.2} sx={{ mt: 4 }}>
            <Button component={Link} href="/nexon" variant="contained" sx={actionButtonSx.primary}>
              넥슨 IP 리스크 보기
            </Button>
            <Button component={Link} href="/nexon/backtest" variant="outlined" sx={actionButtonSx.secondary}>
              백테스트 보기
            </Button>
          </Stack>
        </Paper>
      </Container>
    </Box>
  );
}
