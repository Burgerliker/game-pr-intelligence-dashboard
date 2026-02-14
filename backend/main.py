from __future__ import annotations

import random
from datetime import datetime, timedelta
from pathlib import Path

import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

import sys

ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.append(str(ROOT_DIR))

from services.naver_api import COMPANIES, fetch_company_news, get_daily_counts, get_last_api_error
from utils.keywords import get_keyword_data
from utils.sentiment import add_sentiment_column, get_model_id, get_sentiment_summary


class AnalyzeRequest(BaseModel):
    companies: list[str] = Field(default_factory=lambda: list(COMPANIES.keys()))
    articles_per_company: int = Field(default=40, ge=10, le=100)


app = FastAPI(title="NEXON PR API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _to_records(df: pd.DataFrame) -> list[dict]:
    if df.empty:
        return []
    out = df.copy()
    for col in out.columns:
        if pd.api.types.is_datetime64_any_dtype(out[col]):
            out[col] = out[col].dt.strftime("%Y-%m-%d %H:%M:%S")
    return out.to_dict(orient="records")


def _generate_demo_data() -> pd.DataFrame:
    rows = []
    now = datetime.now()
    samples = {
        "넥슨": ["넥슨 신작 글로벌 흥행", "넥슨 업데이트 호평", "넥슨 운영 논란 재점화"],
        "NC소프트": ["NC소프트 신작 기대감", "엔씨소프트 실적 개선", "NC소프트 비용 구조조정"],
        "넷마블": ["넷마블 신작 매출 상승", "넷마블 해외 성과 확대", "넷마블 투자 전략 발표"],
        "크래프톤": ["크래프톤 배그 이용자 증가", "크래프톤 신작 공개", "크래프톤 실적 변동성"],
    }
    for company in COMPANIES.keys():
        for _ in range(36):
            d = now - timedelta(days=random.randint(0, 29))
            title = random.choice(samples[company])
            rows.append(
                {
                    "title_clean": title,
                    "description_clean": f"{title} 관련 상세 기사입니다.",
                    "originallink": "https://news.example.com",
                    "link": "https://news.example.com",
                    "pubDate_parsed": d,
                    "date": d.strftime("%Y-%m-%d"),
                    "company": company,
                }
            )
    return pd.DataFrame(rows)


def _build_payload(df: pd.DataFrame, selected: list[str]) -> dict:
    company_counts = df.groupby("company").size().to_dict()
    total = int(len(df))

    trend = get_daily_counts(df)
    trend_rows = []
    if not trend.empty:
        trend = trend.reset_index()
        trend_rows = trend.to_dict(orient="records")

    sentiment = get_sentiment_summary(df)
    keyword_map = {company: get_keyword_data(df, company=company, top_n=20) for company in selected}

    latest = (
        df.sort_values("pubDate_parsed", ascending=False)
        .loc[:, ["company", "title_clean", "sentiment", "date", "originallink"]]
        .rename(columns={"title_clean": "title", "originallink": "url"})
        .head(200)
    )

    return {
        "meta": {
            "model_id": get_model_id(),
            "generated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "total_articles": total,
            "selected_companies": selected,
        },
        "company_counts": company_counts,
        "trend": trend_rows,
        "sentiment_summary": _to_records(sentiment),
        "keywords": keyword_map,
        "latest_articles": _to_records(latest),
    }


@app.get("/health")
def health() -> dict:
    return {"ok": True}


@app.get("/api/config")
def config() -> dict:
    return {
        "companies": COMPANIES,
        "model_id": get_model_id(),
        "limits": {"articles_per_company_min": 10, "articles_per_company_max": 100},
    }


@app.post("/api/analyze")
def analyze(req: AnalyzeRequest) -> dict:
    selected = [c for c in req.companies if c in COMPANIES]
    if not selected:
        raise HTTPException(status_code=400, detail="최소 1개 이상의 회사를 선택해 주세요.")

    frames = []
    for company in selected:
        part = fetch_company_news(company, total=req.articles_per_company)
        if not part.empty:
            frames.append(part)

    if not frames:
        raise HTTPException(status_code=502, detail=get_last_api_error() or "뉴스를 수집하지 못했습니다.")

    merged = pd.concat(frames, ignore_index=True)
    merged = merged.drop_duplicates(subset=["company", "originallink", "title_clean"], keep="first").reset_index(
        drop=True
    )
    try:
        merged = add_sentiment_column(merged)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"감성 분석 실패: {exc}") from exc

    return _build_payload(merged, selected)


@app.post("/api/demo")
def demo() -> dict:
    df = _generate_demo_data()
    try:
        df = add_sentiment_column(df)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"감성 분석 실패: {exc}") from exc
    return _build_payload(df, list(COMPANIES.keys()))

