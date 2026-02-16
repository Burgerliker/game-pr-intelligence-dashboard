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

## 실행
### 1) 백엔드
```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn backend.main:app --reload --port 8000
```

### 2) 프론트엔드
```bash
cd frontend
npm install
npm run dev
```

접속:
- 메인: `http://localhost:3000`
- 경쟁사 비교: `http://localhost:3000/compare`
- 넥슨 군집/리스크: `http://localhost:3000/nexon`

## 주요 API
- `POST /api/analyze`: 경쟁사 비교 수집/분석
- `POST /api/nexon-cluster-source`: 넥슨 군집용 수집/분석
- `GET /api/risk-dashboard`: 날짜/IP 기반 리스크 지표
- `GET /api/ip-clusters`: 날짜/IP 기반 군집 요약
- `GET /api/project-snapshot`: 외부 API 호출 없이 DB 데이터만으로 분석 스냅샷 생성

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

## 기사 수 가이드(분석 신뢰도 기준)
실무에서 의미 있는 위험/군집 분석을 위해 권장하는 최소 데이터량:
- MVP: `3,000 ~ 5,000건`
- 권장: `8,000 ~ 15,000건`
- 고도화(이벤트/연도/언론사 세부 분석): `20,000건+`

## Jenkins(선택)
Jenkinsfile과 Docker 구성 파일이 포함되어 있어 로컬 CI 실습이 가능합니다.
다만 이 프로젝트의 1순위는 배포보다 `분석 파이프라인 재현성`입니다.
