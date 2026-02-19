# AGENTS.md

## 목적
- 이 문서는 `game-pr-intelligence-dashboard`에서 다중 에이전트 협업 규칙을 고정한다.
- 목표는 충돌 없는 병렬 작업, 운영 안정성, 검증 가능한 배포다.

## 공통 원칙
- 작업 언어: 한국어
- 배포 원칙: 사용자 요청 시에만 배포/재시작/푸시
- 최종 판정: 원격(운영) 기준 QA 결과를 우선한다.
- 모든 변경 보고는 아래 4개를 포함한다.
  - 변경 파일 + 핵심 라인
  - 실행한 검증 명령 + 결과
  - 회귀 위험/주의사항
  - 롤백 한 줄

## 역할
- `BE-Core`: 백엔드 API/계약/운영 가드레일
- `BE-DataPipe`: 수집 파이프라인/데이터 정합성/품질 지표
- `FE-Core`: 주요 화면 로직/상태 처리/인터랙션
- `FE-DashboardUX`: 시각화/가독성/컴포넌트 UX
- `Ops-Deploy`: 배포 절차/런북/워크플로
- `Data-QC`: 운영 DB 일일 품질 리포트(P1/P2/P3)
- `QA-Gate`: 원격 기준 Go/No-Go 최종 판정

## 충돌 방지 규칙
- 같은 파일 동시 수정 금지
- 시작 전 수정 대상 파일을 먼저 선언
- 선언 파일 외 수정 금지
- 공용 파일 수정(예: `README.md`, `docker-compose.yml`, `.github/workflows/*`)은 사전 승인 필요
- 겹치면 먼저 선언한 담당 우선

## 파일 소유권 기본값
- 백엔드
  - `BE-Core`: `backend/main.py` 중심
  - `BE-DataPipe`: `services/*`, `backend/storage.py`, 데이터 검증 스크립트
- 프론트
  - `FE-Core`: `frontend/app/*` 페이지 로직
  - `FE-DashboardUX`: `frontend/components/*`, `frontend/lib/*`, 시각화 UX
- 운영
  - `Ops-Deploy`: `.github/workflows/*`, `docs/runbooks/*`, 배포 스크립트

## 배포 규칙
- 현재 운영은 수동 배포 기준
- 서버 비밀값은 EC2 `.env.live`에서만 관리
- `.env.live`는 커밋/푸시 금지
- 배포 전 `preflight` 실패 시 즉시 중단

## QA 규칙
- 1차 로컬 검증 후 2차 원격 검증
- 최종 Go/No-Go는 원격 결과만으로 결정
- P1 하나라도 있으면 No-Go

## 데이터 품질 판정
- 기준 지표:
  - `recent_24h_ingested`
  - `zero_insert_streak`
  - `low_sample_ratio_24h`
  - `risk_dup_keys_total`
- 등급:
  - P1: 치명, 즉시 대응
  - P2: 중요, 당일 대응
  - P3: 정상/모니터링

## 금지사항
- 검증 없이 대규모 묶음 커밋 금지
- 운영 트래킹 파일 임의 수정 후 방치 금지
- 수동 배포와 자동 배포 혼용 금지(전환 시 명시적 공지 필수)

## 다음 세션 인수인계 (2026-02-19)
- 사용자 요청으로 `/nexon-rebuild-codex` 실험 라우트는 제거됨.
- 현재 목적:
  - 기존 운영 페이지(`/nexon`, `/compare`) 안정성 유지
  - 리빌드는 새 세션에서 별도 브랜치로 다시 시작
- 필수 원칙:
  - 기능 로직 변경 없이 UI/레이아웃만 단계적으로 개선
  - 변경 단위는 작게(페이지 1개 또는 컴포넌트 묶음 1개)
  - 매 단계 `npm --prefix frontend run build` 통과 후 커밋
- 우선순위 작업:
  1. 버튼/칩/카드 토큰 통일(높이, 라운드, 타이포)
  2. `/nexon` 상단 배너 재디자인(그라데이션 금지, 정보 구조 단순화)
  3. 위험도 설명 UI 간소화(기본 1줄 + 상세는 접기)
  4. `/compare` 차트 0값/저표본 표현 오인 제거 유지 점검
- 검증 체크:
  - 데스크톱 + 모바일(390x844) 레이아웃 깨짐 없음
  - 429 카운트다운/자동갱신 동작 회귀 없음
  - `/api/health`, `/api/scheduler-status` 계약 필드 영향 없음
