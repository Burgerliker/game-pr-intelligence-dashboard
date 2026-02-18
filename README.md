# Game PR Intelligence Dashboard

넥슨 PR 실무 관점의 데이터 분석 포트폴리오 프로젝트입니다.

핵심 목표는 `데이터 추출 -> 정제/중복제거 -> 위험 테마/군집 분석 -> 대시보드 시각화`를 end-to-end로 보여주는 것입니다.

## 범위
- 기간: `2024-01-01 ~ 2026-12-31`
- 대상 회사: 넥슨 중심 (+ 경쟁사 비교 모듈)
- 핵심 IP: `메이플스토리`, `던전앤파이터`, `아크레이더스`, `블루아카이브`, `FC온라인`

## 기술 스택
- Backend: FastAPI, Pandas, SQLite
- Frontend: Next.js(App Router), React, MUI
- Data Source: Naver Search API(뉴스)

## 실행 (Runbook)
```bash
# LIVE (frontend:3000, backend:8000, DB: articles.db)
docker compose --profile live up --build

# BACKTEST (frontend:3001, backend:8001, DB: articles_backtest.db)
docker compose --profile backtest up --build

# BOTH
docker compose --profile live --profile backtest up --build
```

검증:
```bash
# 배포 전 고정 preflight (정책 + env drift + compose config)
bash scripts/preflight_deploy_live.sh --env-file .env.live --profile live

# 기동 후 스모크 테스트
bash scripts/smoke_test.sh --mode live --base http://localhost:8000
bash scripts/smoke_test.sh --mode backtest --base http://localhost:8001
```

운영 점검 스크립트 사용법:
- `bash scripts/preflight_ops_check.sh --env-file .env.live`
- `--app-env prod`로 운영 규칙(localhost 금지, https 권장) 강제 확인
- `--health-url https://api.example.com/api/health`로 health 대상 지정
- `--frontend-origin https://dashboard.example.com`로 CORS 포함 여부 검증
- 실패 시 `OPS-E###` 코드와 함께 즉시 종료(비정상 1)
- 외부 관측 QA 표준(health/scheduler/CORS, Go/No-Go): `docs/ops-external-smoke-standard.md`

접속:
- Live UI: `http://localhost:3000/nexon`
- Backtest UI: `http://localhost:3001/nexon/backtest`
- Health (live): `http://localhost:8000/api/health`
- Health (backtest): `http://localhost:8001/api/health`

환경파일:
- `.env.live`: live profile 기본값
- `.env.backtest`: backtest profile 기본값
- `.env.example`: 템플릿

운영 보안 권장:
- `CORS_ALLOW_ORIGINS`: 허용 오리진을 쉼표(`,`)로 명시 (와일드카드 `*` 지양)
- `CORS_ALLOW_CREDENTIALS`: `1` 또는 `0` (쿠키/인증 필요 시만 `1`)
- `ENABLE_DEBUG_ENDPOINTS=0`, `ENABLE_MANUAL_COLLECTION=0` 기본 유지
- `COMPARE_LIVE_RATE_LIMIT_PER_MIN`: 경쟁사 실시간 조회 분당 요청 제한(기본 `30`)
- `COMPARE_LIVE_CACHE_TTL_SECONDS`: 경쟁사 실시간 조회 캐시 TTL(기본 `45`)

### 장애 대응 런북(운영 확인 경로)
```bash
# 1) 서비스 상태
curl -fsS http://127.0.0.1:8000/api/health
curl -fsS http://127.0.0.1:8000/api/scheduler-status

# 2) 컨테이너 로그 (최근 200줄)
docker compose --profile live logs --tail=200 backend-live

# 3) 스케줄러 로그 저장상태 확인 (fallback_count가 0인지)
curl -fsS http://127.0.0.1:8000/api/health | jq '.scheduler_log_fallback_count'

# 4) Nginx 경유 배포 시(EC2 표준 경로)
sudo tail -n 200 /var/log/nginx/access.log
sudo tail -n 200 /var/log/nginx/error.log
```

## 주요 API
- `GET /health`: 서버 상태 + 현재 DB 경로/파일명
- `GET /api/compare-live?companies=넥슨,NC소프트,넷마블,크래프톤&window_hours=24&limit=40`: 경쟁사 실시간 조회(캐시+rate limit)
- `POST /api/nexon-cluster-source`: 넥슨 군집용 수집/분석
- `GET /api/risk-dashboard`: 날짜/IP 기반 리스크 지표
- `GET /api/ip-clusters`: 날짜/IP 기반 군집 요약
- `GET /api/project-snapshot`: 외부 API 호출 없이 DB 데이터만으로 분석 스냅샷 생성

### compare-live 운영 규칙
- `window_hours`는 수집된 기사 `pubDate`를 UTC 기준 최근 N시간으로 필터링합니다.
- 동일 파라미터 요청은 TTL 캐시를 우선 사용합니다.
- 외부 API 실패 시 최근 성공 캐시가 있으면 fallback 응답을 반환합니다.
- 분당 제한 초과 시 `429`를 반환하며 응답/헤더의 `retry_after`/`Retry-After`를 따라 재시도하세요.
- `company_counts`는 `selected_companies`의 모든 회사를 항상 포함하며, 0건 회사는 값 `0`으로 반환합니다.
- `sentiment_summary`는 0건 회사도 `긍정/중립/부정` 3개 항목을 `count=0`, `ratio=0.0`으로 반환합니다.
- 프론트 compare 화면은 `24/72/168시간` 토글을 제공하며 기본값은 `72시간`입니다.
- 감성 분류 사전/수식은 `/docs/sentiment-rule-v2.md`를 기준으로 운영합니다.

## DB 기반 분석 산출물(외부 API 미호출)
이미 DB에 적재된 데이터로 포트폴리오용 JSON/CSV를 생성합니다.

```bash
python scripts/export_analysis_snapshot.py \
  --date-from 2024-01-01 \
  --date-to 2026-12-31
```

생성 파일(`backend/data/exports`):
- `nexon_project_snapshot.json`
- `nexon_ip_summary.csv`
- `nexon_top_risk_themes.csv`
- `nexon_top_outlets.csv`

## 백테스트용 과거 기사 수집(메이플키우기)
네이버 API `sort=date/sim` 혼합으로 과거 관련 기사를 최대한 확보한 뒤,
최종적으로 날짜 필터(`2025-11-01~2026-02-10` 기본값)를 적용합니다.

```bash
# 백테스트 전용 DB로 저장
PR_DB_PATH=backend/data/articles_backtest.db \
python scripts/collect_backtest_maple_idle.py \
  --date-from 2025-11-01 \
  --date-to 2026-02-10 \
  --date-pages 10 \
  --sim-pages 5 \
  --max-calls 1000
```

드라이런(저장 없이 호출 통계/필터 결과만 확인):
```bash
python scripts/collect_backtest_maple_idle.py --dry-run
```

## 기사 수 가이드(분석 신뢰도 기준)
실무에서 의미 있는 위험/군집 분석을 위해 권장하는 최소 데이터량:
- MVP: `3,000 ~ 5,000건`
- 권장: `8,000 ~ 15,000건`
- 고도화(이벤트/연도/언론사 세부 분석): `20,000건+`

## Jenkins(선택)
Jenkinsfile과 Docker 구성 파일이 포함되어 있어 로컬 CI 실습이 가능합니다.
다만 이 프로젝트의 1순위는 배포보다 `분석 파이프라인 재현성`입니다.

## GitHub Actions 자동 배포 (EC2)
`main` 브랜치에 push하면 `backend-live`를 EC2에서 자동 재빌드/재기동합니다.

필수 GitHub Secrets:
- `EC2_HOST`: EC2 퍼블릭 IP 또는 도메인
- `EC2_USER`: 예) `ubuntu`
- `EC2_SSH_KEY`: PEM 개인키 전체 내용
- `EC2_PORT`: 기본 `22` (옵션)
- `EC2_APP_DIR`: 서버 레포 경로(옵션, 기본 `~/game-pr-intelligence-dashboard`)
- `NAVER_CLIENT_ID`: 네이버 API ID
- `NAVER_CLIENT_SECRET`: 네이버 API Secret

워크플로 파일:
- `.github/workflows/deploy-live.yml`

## 프론트 배포 정합성 (Vercel 기준)
운영 프론트는 Vercel 기준으로 아래 환경변수 설정을 권장합니다.

- `NEXT_PUBLIC_API_BASE_URL`: 운영 백엔드 API Origin (예: `https://api.example.com`)
- `NEXT_PUBLIC_SHOW_BACKTEST`: 운영은 `false` 권장
- `NEXT_PUBLIC_COMPARE_REFRESH_MS`: compare 자동 갱신 주기(ms), 기본 `60000`

중요:
- `NEXT_PUBLIC_API_BASE_URL` 미설정 시 프론트는 현재 Origin으로 fallback합니다.
- Vercel 배포에서는 `localhost`를 API 주소로 사용하지 않도록 환경변수를 명시하세요.
- `/compare`는 조회 전용 화면입니다(수동 수집 버튼 없음, 진입 시 자동 조회 + 주기 갱신).

## 잠재 리스크 분리 (EC2 Docker 경로)
EC2 자동배포는 `EC2_APP_DIR` 경로 하드코딩/오입력 리스크가 있으므로 Vercel 프론트 배포와 분리해 관리하세요.

- 프론트(Vercel): 환경변수 기반 API Origin만 관리
- 백엔드(EC2 Docker): `EC2_APP_DIR`, `docker compose` 실행 경로, DB 볼륨 마운트 경로를 별도 점검
