# Secret Management Policy (Repository Secrets vs Server `.env.live`)

## 단일 원칙
- 운영 비밀값의 런타임 단일 소스는 서버의 `.env.live`다.
- 수동 운영 시 GitHub Repository Secrets는 접속/자동화(SSH, 경로, 실행 트리거) 용도로만 사용한다.
- 앱 런타임 비밀값은 Repository Secrets와 정책을 분리해 `.env.live`에서만 관리한다.

## 운영 규칙
1. `.env.live`는 서버에서만 생성/수정한다. 저장소 커밋 금지.
2. `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET` 등 앱 비밀값은 `.env.live`에만 둔다.
3. Workflow는 `.env.live`를 덮어쓰지 않는다. 존재 확인 후 preflight만 수행한다.
4. Secret 변경 시 순서: 서버 `.env.live` 갱신 -> preflight -> 수동 배포.
5. 유출 의심 시 즉시 키 폐기/재발급 후 `.env.live` 교체, 이전 키 무효화 확인.

## Repository Secrets 최소 범위
- `EC2_HOST`, `EC2_USER`, `EC2_SSH_KEY`, `EC2_PORT`, `EC2_APP_DIR`
- 앱 런타임 비밀값은 Repository Secrets에 저장하지 않는다.

## 감사/검증
- 배포 전: `bash scripts/preflight_deploy_live.sh --env-file .env.live --profile live`
- 배포 후: `curl -fsS http://127.0.0.1:8000/api/health`
