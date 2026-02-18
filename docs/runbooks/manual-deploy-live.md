# Live Manual Deploy Runbook (EC2/Docker)

목적: `backend-live` 수동 배포를 고정된 명령 순서로 수행한다.  
원칙: 배포 전 preflight 실패 시 즉시 중단, 배포/재시작은 승인된 작업 윈도우에서만 실행.

## 0) 사전 조건
- SSH 접속 가능
- 서버 경로: `~/game-pr-intelligence-dashboard` (또는 운영 지정 경로)
- 서버에 `.env.live` 존재 (운영값 반영 완료)

## 1) 서버 접속 및 경로 이동
```bash
ssh ubuntu@<EC2_HOST>
cd ~/game-pr-intelligence-dashboard
```

## 2) 코드 동기화
```bash
git fetch origin
git checkout main
git pull --ff-only origin main
```

## 3) 배포 전 고정 점검 (반드시 통과)
```bash
test -f .env.live
bash scripts/preflight_deploy_live.sh --env-file .env.live --profile live
```

## 4) 배포 실행
```bash
docker compose --profile live up -d --build backend-live
```

## 5) 배포 직후 검증
```bash
curl -fsS http://127.0.0.1:8000/api/health
curl -fsS http://127.0.0.1:8000/api/scheduler-status
docker compose --profile live logs --tail=200 backend-live
```

## 6) QA 트리거 (고정)
```bash
bash scripts/smoke_test.sh --mode live --base http://127.0.0.1:8000
```

## 7) 실패 시 즉시 복구
```bash
# 1) 직전 안정 커밋으로 롤백
git log --oneline -n 5
git checkout <LAST_GOOD_COMMIT_SHA>

# 2) 재배포
docker compose --profile live up -d --build backend-live

# 3) 상태 확인
curl -fsS http://127.0.0.1:8000/api/health
```

## 8) 금지사항
- 서버에서 Git 트래킹 파일(`docker-compose.yml`, `backend/**`, `services/**`, `utils/**`, `.github/workflows/**`) 임의 수정 금지
- 수동 배포 절차와 자동배포 절차 혼용 금지 (동일 윈도우 내 동시 실행 금지)
- preflight 미통과 상태에서 `docker compose up` 실행 금지

## 9) 완료 기준
- `/api/health` 응답 `ok=true`
- `/api/scheduler-status` 응답 `running=true`
- `scripts/smoke_test.sh` 성공
- `backend-live` 로그에 반복 에러 없음
