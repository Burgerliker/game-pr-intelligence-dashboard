# AGENTS.md

## 목적
- 이 문서는 `game-pr-intelligence-dashboard`에서 다중 에이전트 협업 규칙을 고정한다.
- 목표는 충돌 없는 병렬 작업, 운영 안정성, 검증 가능한 배포다.

## 공통 원칙
- 작업 언어: 한국어
- 배포 원칙: 사용자 요청 시에만 배포/재시작/푸시
- 실행 게이트: 사용자가 명시적으로 `실행`이라고 지시하기 전까지는 계획 모드로만 동작한다.
  - 계획 모드에서는 코드 수정/명령 실행/커밋/푸시를 하지 않는다.
  - 계획 확정 후 `실행` 지시가 들어오면 그때 구현/검증/배포 단계를 진행한다.
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

## 운영 DB 점검 표준
- 운영 SQL은 쉘에 직접 입력하지 말고 `sqlite3` 세션(또는 heredoc)으로만 실행한다.
- 운영 DB 기본 경로: 컨테이너 내부 `/app/backend/data/articles.db`
- 기본 점검은 아래 3개를 우선 실행한다.

### 1) 30일 초과 live 기사 삭제 대상
```bash
docker exec -i game-pr-intelligence-dashboard-backend-live-1 sqlite3 /app/backend/data/articles.db <<'SQL'
SELECT COUNT(*) AS old_live_rows
FROM articles
WHERE is_test=0
  AND datetime(COALESCE(NULLIF(pub_date,''), NULLIF(created_at,''), date||' 00:00:00'))
      < datetime('now','-30 day');
SQL
```

### 2) 최근 14일 날짜 분포
```bash
docker exec -i game-pr-intelligence-dashboard-backend-live-1 sqlite3 /app/backend/data/articles.db <<'SQL'
SELECT date(datetime(COALESCE(NULLIF(pub_date,''), NULLIF(created_at,''), date||' 00:00:00'))) AS d,
       COUNT(*) AS n
FROM articles
WHERE is_test=0
GROUP BY d
ORDER BY d DESC
LIMIT 14;
SQL
```

### 3) maintenance-cleanup 실행 로그
```bash
docker exec -i game-pr-intelligence-dashboard-backend-live-1 sqlite3 /app/backend/data/articles.db <<'SQL'
SELECT id, job_id, run_time, status, error_message
FROM scheduler_logs
WHERE job_id='maintenance-cleanup'
ORDER BY id DESC
LIMIT 10;
SQL
```

### 주의
- `deleted_live_articles`, `cleanup_last_updated_at`는 스케줄러 잡(`maintenance-cleanup`) 실행 시점 기준으로 갱신된다.
- 수동 파이썬 호출로 삭제해도 `/api/health`의 cleanup 상태 필드는 즉시 반영되지 않을 수 있다.
