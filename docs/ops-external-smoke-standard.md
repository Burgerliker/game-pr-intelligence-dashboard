# 운영 외부 관측 스모크/판정 표준

운영 QA는 **외부 관측(공개 API + 공개 프론트 응답)**만으로 판정한다.  
컨테이너 내부 접근/DB 직접 조회는 기본 범위에서 제외한다.

## 1) 외부 관측 스모크 체크리스트 (health/scheduler/CORS)

### A. Health 계약 체크
- 입력: `GET https://api.game-pr-dashboard.cloud/api/health`
- 기대:
  - HTTP `200`
  - 필수 필드 존재: `ok`, `mode`, `scheduler_running`, `scheduler_job_count`, `scheduler_log_fallback_count`
  - 타입:
    - `ok`: boolean
    - `mode`: string
    - `scheduler_running`: boolean
    - `scheduler_job_count`: number
    - `scheduler_log_fallback_count`: number

### B. Scheduler 계약 체크
- 입력: `GET https://api.game-pr-dashboard.cloud/api/scheduler-status`
- 기대:
  - HTTP `200`
  - 필수 필드 존재: `running`, `job_count`, `jobs[]`
  - 타입:
    - `running`: boolean
    - `job_count`: number
    - `jobs`: array
  - `jobs[0]` 필드 존재:
    - `id`, `ip_id`, `next_run_time`, `last_run_time`, `last_status`, `error_message`, `last_error`, `last_collect_count`, `last_group_count`, `last_collect_duration_ms`

### C. CORS 체크 (프론트 오리진 기준)
- 입력: `OPTIONS https://api.game-pr-dashboard.cloud/api/health`
- 헤더:
  - `Origin: https://www.game-pr-dashboard.cloud`
  - `Access-Control-Request-Method: GET`
  - `Access-Control-Request-Headers: content-type`
- 기대:
  - HTTP `200`
  - `access-control-allow-origin: https://www.game-pr-dashboard.cloud`
  - `access-control-allow-credentials: true` (현재 운영 정책 기준)

## 2) Go/No-Go 판정 기준표 (P1 우선)

| 등급 | 조건 | 판정 |
|---|---|---|
| P1 | API 계약 누락/타입 불일치, CORS 차단(브라우저 호출 실패), 5xx 지속 | **No-Go** |
| P2 | 비핵심 지표 경고(예: zero streak 증가, 성능 저하 징후), 우회 가능 UX 이슈 | 조건부 Go 가능(릴리즈 노트에 리스크 명시) |
| P3 | 문구/표기/비기능 경미 이슈 | Go |

### 고정 규칙
- **P1 1건 이상이면 무조건 No-Go**
- **Go 전환 조건은 P1=0**

## 3) 수동 배포 후 재검증 시나리오 (10분/30분)

### T+10분 (배포 직후 안정화 체크)
1. Health 계약 체크 1회
2. Scheduler 계약 체크 1회
3. CORS 체크 1회 (`Origin: https://www.game-pr-dashboard.cloud`)
4. 실패 시 즉시 No-Go 유지 및 롤백/핫픽스 트랙 전환

### T+30분 (지속 안정성 체크)
1. Health 계약 체크 1회 재실행
2. Scheduler 계약 체크 1회 재실행
3. CORS 체크 1회 재실행
4. 10분 대비 비교:
   - `scheduler_running=true` 유지
   - `job_count` 비정상 감소 없음
   - CORS 응답 일관성 유지
5. 이상 없으면 Go 유지 확정

## 4) 오늘 기준 재현 명령 (2026-02-18)

```bash
# 기준 시각
date -u '+UTC %Y-%m-%d %H:%M:%S'
TZ=Asia/Seoul date '+KST %Y-%m-%d %H:%M:%S'

# 1) health 계약
curl -fsS https://api.game-pr-dashboard.cloud/api/health | jq -c '{
  ok, mode, cors_validation_status,
  has_scheduler_running: has("scheduler_running"),
  has_scheduler_job_count: has("scheduler_job_count"),
  has_scheduler_log_fallback_count: has("scheduler_log_fallback_count"),
  scheduler_running, scheduler_job_count, scheduler_log_fallback_count
}'

# 2) scheduler-status 계약
curl -fsS https://api.game-pr-dashboard.cloud/api/scheduler-status | jq -c '{
  has_running: has("running"),
  has_job_count: has("job_count"),
  has_jobs: has("jobs"),
  running, job_count, jobs_count: (.jobs|length),
  sample_job: (.jobs[0] // null)
}'

# 3) CORS (www 오리진)
curl -i -sS -X OPTIONS 'https://api.game-pr-dashboard.cloud/api/health' \
  -H 'Origin: https://www.game-pr-dashboard.cloud' \
  -H 'Access-Control-Request-Method: GET' \
  -H 'Access-Control-Request-Headers: content-type' | sed -n '1,40p'
```

### 자동 판정 실행 (권장)

```bash
# T+10
bash scripts/ops_external_smoke.sh \
  --out /Users/daniel/Documents/game-pr-intelligence-dashboard/ops_smoke_t10.json

# T+30 (동일 명령 재실행 + 차이 비교)
bash scripts/ops_external_smoke.sh \
  --out /Users/daniel/Documents/game-pr-intelligence-dashboard/ops_smoke_t30.json \
  --compare /Users/daniel/Documents/game-pr-intelligence-dashboard/ops_smoke_t10.json
```

## 5) 다음 배포부터 사용할 Pass/Fail 표준

### Pass
- health/scheduler 계약 필드와 타입이 모두 기준 충족
- CORS preflight가 프론트 실오리진에서 200
- P1 이슈 0건

### Fail
- 필수 계약 필드 누락 또는 타입 불일치 1건 이상
- 프론트 실오리진 CORS 실패(400/403 또는 allow-origin 불일치)
- P1 1건 이상
