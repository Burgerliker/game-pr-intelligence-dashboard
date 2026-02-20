# Redesign Execution Tasks

기준 문서: `REDESIGN_INSTRUCTIONS.md` 전체

## 완료 정의
- MUI import/sx 0
- Tailwind + shadcn/ui 단일화
- 데이터 fetch/정규화/계산 로직 변경 없음(표시 파생 계산만 허용)
- 페이지별 IA/용어/상태 시스템 반영
- 모바일(390x844) 깨짐 없음
- `npm --prefix frontend run build` 통과

## Task 1. 공통 컴포넌트 전환
대상 파일
- `frontend/components/PageStatusView.js`
- `frontend/components/LoadingState.js`
- `frontend/components/ErrorState.js`
- `frontend/components/EmptyState.js`
- `frontend/components/ApiGuardBanner.js`
- `frontend/components/LabelWithTip.js`

작업
- MUI 제거
- shadcn(`alert`, `button`, `tooltip`) + Tailwind로 재작성
- 기존 props 계약 유지

검증
- 공통 컴포넌트 import 페이지 렌더 오류 없음

## Task 2. P0 홈 전환
대상 파일
- `frontend/app/page.js`

작업
- 기존 디자인/인터랙션 최대 동일
- MUI 제거 및 Tailwind/shadcn 전환

검증
- 기존 홈 동선 동일, 빌드 통과

## Task 3. P1 넥슨 리디자인
대상 파일
- `frontend/app/nexon/page.js`

작업
- 상태 배지(정상/주의/경고/위기)
- KPI 4개(보도량/부정비율/위기지수/주요매체)
- IA/Bento 구조 반영
- 용어 전환 반영

검증
- API/필터/차트/기사 리스트 회귀 없음

## Task 4. P2 비교 리디자인
대상 파일
- `frontend/app/compare/page.js`

작업
- 기간/감성 필터 실무 용어 반영
- 브랜드 카드/분포 카드/리스트 UX 반영

검증
- 429/자동갱신 회귀 없음

## Task 5. P3 백테스트 리디자인
대상 파일
- `frontend/app/nexon/backtest/page.js`

작업
- 명칭 '과거 분석' 중심 카피 전환
- 타임라인+이벤트 가독성 강화

검증
- backtest API 정상 렌더

## Task 6. P4 프로젝트 소개 리라이트
대상 파일
- `frontend/app/project/page.js`

작업
- 문제-해결-증명 스토리 구조

## Task 7. 스타일 시스템 정리
대상 파일
- `frontend/app/globals.css`
- `frontend/tailwind.config.js`

작업
- 토큰/리셋/레이아웃 유틸만 유지
- 컴포넌트 클래스 제거
- preflight 정책 반영

## Task 8. 최종 검증
명령
- `npm --prefix frontend run build`
- 필요 시 로컬 스크린샷 검증

최종 보고 포맷
1) 변경 파일+핵심 라인
2) 실행 검증+결과
3) 회귀 위험/주의사항
4) 롤백 한 줄
