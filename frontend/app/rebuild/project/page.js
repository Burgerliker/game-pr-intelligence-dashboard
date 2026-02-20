"use client";

import Link from "next/link";

const SHELL = { minHeight: "100dvh", backgroundColor: "#eef0f3", fontFamily: "'Plus Jakarta Sans','Noto Sans KR','Apple SD Gothic Neo',sans-serif", paddingTop: 16, paddingBottom: 48 };
const CONTAINER = { maxWidth: 1180, margin: "0 auto", padding: "0 16px" };
const SECTION_CARD = { borderRadius: 24, border: "1px solid rgba(15,23,42,.1)", backgroundColor: "#ffffff", boxShadow: "0 12px 28px rgba(15,23,42,.06)" };
const NAV_BTN = { display: "inline-flex", alignItems: "center", justifyContent: "center", textDecoration: "none", minHeight: 40, padding: "0 16px", borderRadius: 9999, border: "1px solid rgba(15,23,42,.24)", fontSize: 14, fontWeight: 700, backgroundColor: "transparent", color: "#0f172a", cursor: "pointer" };
const ACTION_PRIMARY = { display: "inline-flex", alignItems: "center", justifyContent: "center", textDecoration: "none", minHeight: 40, padding: "0 16px", borderRadius: 8, border: "none", fontSize: 14, fontWeight: 700, backgroundColor: "#111827", color: "#ffffff", cursor: "pointer" };
const ACTION_SECONDARY = { display: "inline-flex", alignItems: "center", justifyContent: "center", textDecoration: "none", minHeight: 40, padding: "0 16px", borderRadius: 8, border: "1px solid rgba(15,23,42,.24)", fontSize: 14, fontWeight: 700, backgroundColor: "transparent", color: "#0f172a", cursor: "pointer" };

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
    <div style={SHELL}>
      <div style={{ ...CONTAINER, maxWidth: 980 }}>
        <div style={{ ...SECTION_CARD, backgroundColor: "#f8fafc", padding: "40px 48px", boxShadow: "0 14px 38px rgba(15,23,42,.06)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
            <h1 style={{ margin: 0, fontSize: "clamp(24px,3vw,30px)", fontWeight: 800, color: "#0f172a", letterSpacing: "-.02em" }}>
              프로젝트 소개
            </h1>
            <Link href="/rebuild" style={NAV_BTN}>메인으로</Link>
          </div>

          <p style={{ margin: "0 0 32px", fontSize: "clamp(16px,2vw,18px)", color: "#64748b", lineHeight: 1.7 }}>
            게임 PR 실무 의사결정에 바로 연결되는 분석 구조를 목표로 설계한 포트폴리오입니다.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
            {sections.map((section) => (
              <div key={section.title}>
                <h2 style={{ margin: "0 0 8px", fontSize: 22, fontWeight: 700, color: "#111827" }}>{section.title}</h2>
                <p style={{ margin: 0, color: "#475569", lineHeight: 1.85, fontSize: 16 }}>{section.body}</p>
              </div>
            ))}
          </div>

          <hr style={{ margin: "32px 0", borderColor: "#e5e7eb", borderTop: "1px solid #e5e7eb" }} />

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <h2 style={{ margin: "0 0 4px", fontSize: 22, fontWeight: 700, color: "#111827" }}>핵심 구성</h2>
            <p style={{ margin: 0, color: "#475569", fontSize: 16, lineHeight: 1.75 }}>
              1. 실시간 수집: IP별 스케줄링 + 중복 제거 + 운영 로그
              <br />
              2. 분석 엔진: 감성/볼륨/테마/매체 신호 결합 리스크 산식
              <br />
              3. 검증 체계: 백테스트 타임라인으로 임계치 반응 검증
              <br />
              4. 대시보드: 실시간 모니터링 + 설명 가능한 지표 표시
            </p>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 9.6, marginTop: 32 }}>
            <Link href="/rebuild/nexon" style={ACTION_PRIMARY}>넥슨 IP 리스크 보기</Link>
            <Link href="/rebuild/nexon/backtest" style={ACTION_SECONDARY}>백테스트 보기</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
