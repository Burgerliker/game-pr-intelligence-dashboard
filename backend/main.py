from __future__ import annotations

import random
import re
import sys
from datetime import datetime, timedelta
from pathlib import Path

import pandas as pd
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.append(str(ROOT_DIR))

from backend.storage import get_articles, init_db, save_articles
from services.naver_api import (
    COMPANIES,
    fetch_company_news_compare,
    fetch_nexon_cluster_news,
    get_daily_counts,
    get_last_api_error,
)
from utils.keywords import get_keyword_data
from utils.sentiment import add_sentiment_column, get_model_id, get_sentiment_summary


class AnalyzeRequest(BaseModel):
    companies: list[str] = Field(default_factory=lambda: list(COMPANIES.keys()))
    articles_per_company: int = Field(default=40, ge=10, le=100)


class NexonClusterRequest(BaseModel):
    total_articles: int = Field(default=300, ge=50, le=1000)


app = FastAPI(title="NEXON PR API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup() -> None:
    init_db()


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


def _extract_tokens(text: str) -> list[str]:
    words = re.findall(r"[가-힣]{2,6}", text or "")
    stop = {
        "있다",
        "하는",
        "되는",
        "이번",
        "대한",
        "이후",
        "통해",
        "위해",
        "하고",
        "에서",
        "으로",
        "까지",
        "부터",
        "라고",
        "했다",
        "된다",
        "한다",
        "것으로",
        "이라고",
        "밝혔다",
        "전했다",
        "말했다",
        "보도",
        "기자",
        "뉴스",
        "관련",
        "지난",
        "올해",
        "내년",
        "최근",
        "현재",
        "오늘",
        "어제",
        "내일",
        "것이",
        "수도",
        "등을",
        "것을",
        "하며",
        "또한",
        "있는",
        "없는",
        "같은",
        "따른",
        "관한",
        "의한",
        "넥슨",
        "엔씨소프트",
        "NC소프트",
        "넷마블",
        "크래프톤",
    }
    return [w for w in words if w not in stop]


def _negative_ratio(df: pd.DataFrame) -> float:
    if df.empty:
        return 0.0
    return round(float((df["sentiment"] == "부정").mean() * 100), 1)


def _issue_candidates(df_company: pd.DataFrame, company: str) -> list[dict]:
    if df_company.empty:
        return []

    text_series = df_company["title_clean"].fillna("") + " " + df_company["description_clean"].fillna("")
    counts: dict[str, int] = {}
    for text in text_series:
        for token in _extract_tokens(text):
            counts[token] = counts.get(token, 0) + 1

    ranked = sorted(counts.items(), key=lambda x: x[1], reverse=True)[:3]
    out: list[dict] = []
    total = len(df_company)
    for keyword, count in ranked:
        match_rows = df_company[df_company["title_clean"].fillna("").str.contains(keyword, na=False)].head(1)
        example = match_rows["title_clean"].iloc[0] if not match_rows.empty else (df_company["title_clean"].iloc[0] or "")
        out.append(
            {
                "company": company,
                "keyword": keyword,
                "count": int(count),
                "share_pct": round(count / max(total, 1) * 100, 1),
                "example_title": example,
            }
        )
    return out


def _build_interview_insights(df: pd.DataFrame, selected: list[str]) -> dict:
    now = datetime.now()
    cur_start = now - timedelta(days=7)
    prev_start = now - timedelta(days=14)

    top_issues: list[dict] = []
    competitive_changes: list[dict] = []
    risk_alerts: list[dict] = []
    actions: list[dict] = []

    for company in selected:
        cdf = df[df["company"] == company].copy()
        if cdf.empty:
            continue

        cdf["pub_dt"] = pd.to_datetime(cdf["pubDate_parsed"], errors="coerce", utc=True).dt.tz_convert(None)
        cdf = cdf.dropna(subset=["pub_dt"]).reset_index(drop=True)
        if cdf.empty:
            continue

        top_issues.extend(_issue_candidates(cdf, company))

        cur = cdf[(cdf["pub_dt"] >= cur_start) & (cdf["pub_dt"] <= now)]
        prev = cdf[(cdf["pub_dt"] >= prev_start) & (cdf["pub_dt"] < cur_start)]

        cur_cnt = int(len(cur))
        prev_cnt = int(len(prev))
        change_pct = round(((cur_cnt - prev_cnt) / max(prev_cnt, 1)) * 100, 1)
        cur_neg = _negative_ratio(cur)
        prev_neg = _negative_ratio(prev)
        neg_change = round(cur_neg - prev_neg, 1)

        competitive_changes.append(
            {
                "company": company,
                "current_articles": cur_cnt,
                "previous_articles": prev_cnt,
                "article_change_pct": change_pct,
                "current_negative_ratio": cur_neg,
                "previous_negative_ratio": prev_neg,
                "negative_ratio_change_pp": neg_change,
            }
        )

        risk_reasons = []
        if cur_cnt >= 8 and change_pct >= 35:
            risk_reasons.append(f"보도량 전주 대비 +{change_pct}%")
        if cur_cnt >= 8 and cur_neg >= 45 and neg_change >= 8:
            risk_reasons.append(f"부정 비중 {cur_neg}% (전주 대비 +{neg_change}%p)")

        level = "high" if len(risk_reasons) >= 2 else ("medium" if len(risk_reasons) == 1 else "low")
        if level != "low":
            risk_alerts.append({"company": company, "level": level, "reason": " / ".join(risk_reasons)})

        top_keyword = _issue_candidates(cur if not cur.empty else cdf, company)
        lead_kw = top_keyword[0]["keyword"] if top_keyword else "핵심 이슈"
        if level == "high":
            msg = f"{lead_kw} 이슈 중심으로 공식 입장문과 FAQ를 24시간 내 동시 배포해 부정 확산을 차단하세요."
            priority = "P1"
        elif level == "medium":
            msg = f"{lead_kw} 관련 메시지를 선제 정리하고 커뮤니티 Q&A 대응 문안을 준비하세요."
            priority = "P2"
        else:
            msg = f"{lead_kw} 성과 포인트를 활용해 긍정 기사 증폭용 후속 콘텐츠를 배포하세요."
            priority = "P3"
        actions.append({"company": company, "priority": priority, "action": msg})

    top_issues = sorted(top_issues, key=lambda x: x["count"], reverse=True)[:5]
    competitive_changes = sorted(competitive_changes, key=lambda x: x["article_change_pct"], reverse=True)
    actions = sorted(actions, key=lambda x: x["priority"])

    return {
        "top_issues": top_issues,
        "competitive_changes": competitive_changes,
        "risk_alerts": risk_alerts,
        "actions": actions,
    }


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
        "insights": _build_interview_insights(df, selected),
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


@app.get("/api/articles")
def articles(
    company: str | None = Query(default=None),
    sentiment: str | None = Query(default=None),
    limit: int = Query(default=50, ge=10, le=200),
    offset: int = Query(default=0, ge=0),
) -> dict:
    return get_articles(company=company, sentiment=sentiment, limit=limit, offset=offset)


@app.post("/api/analyze")
def analyze(req: AnalyzeRequest) -> dict:
    selected = [c for c in req.companies if c in COMPANIES]
    if not selected:
        raise HTTPException(status_code=400, detail="최소 1개 이상의 회사를 선택해 주세요.")

    frames = []
    for company in selected:
        part = fetch_company_news_compare(company, total=req.articles_per_company)
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
    save_articles(merged)

    return _build_payload(merged, selected)


@app.post("/api/nexon-cluster-source")
def nexon_cluster_source(req: NexonClusterRequest) -> dict:
    """넥슨 군집분석용 데이터 소스 수집(비교 수집과 분리된 호출 전략)."""
    df = fetch_nexon_cluster_news(total=req.total_articles)
    if df.empty:
        raise HTTPException(status_code=502, detail=get_last_api_error() or "넥슨 군집용 뉴스를 수집하지 못했습니다.")

    try:
        df = add_sentiment_column(df)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"감성 분석 실패: {exc}") from exc
    save_articles(df)

    keywords = get_keyword_data(df, company="넥슨", top_n=40)
    latest = (
        df.sort_values("pubDate_parsed", ascending=False)
        .loc[:, ["company", "title_clean", "sentiment", "date", "originallink"]]
        .rename(columns={"title_clean": "title", "originallink": "url"})
        .head(300)
    )

    return {
        "meta": {
            "source": "nexon_cluster",
            "generated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "total_articles": int(len(df)),
            "selected_companies": ["넥슨"],
            "model_id": get_model_id(),
        },
        "keywords": {"넥슨": keywords},
        "latest_articles": _to_records(latest),
    }


@app.post("/api/demo")
def demo() -> dict:
    df = _generate_demo_data()
    try:
        df = add_sentiment_column(df)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"감성 분석 실패: {exc}") from exc
    return _build_payload(df, list(COMPANIES.keys()))
