# NEXON PR 인사이트 센터 (분리형)

프론트엔드(Next.js)와 분석 엔진 API(FastAPI)를 분리한 구조입니다.

## 폴더 구조

- `backend/` : FastAPI 서버
- `frontend/` : Next.js 대시보드
- `services/`, `utils/` : 뉴스 수집/감성분석/키워드 로직
- `app.py` : 기존 Streamlit 버전 (비교용)

## 1) 백엔드 실행

```bash
cd nexon-press-dashboard
pip install -r requirements.txt
uvicorn backend.main:app --reload --port 8000
```

주요 엔드포인트:

- `GET /health`
- `GET /api/config`
- `POST /api/analyze`
- `POST /api/demo`

## 2) 프론트엔드 실행

```bash
cd nexon-press-dashboard/frontend
npm install
npm run dev
```

브라우저: `http://localhost:3000`

기본 API 주소: `http://localhost:8000`  
변경 시 `frontend/.env.local` 생성:

```bash
NEXT_PUBLIC_API_BASE=http://localhost:8000
```

