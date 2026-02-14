"""네이버 검색 API를 통한 뉴스 데이터 수집 서비스"""

import os
import re
from datetime import datetime

import pandas as pd
import requests
from dotenv import load_dotenv

load_dotenv()

NAVER_CLIENT_ID = os.getenv("NAVER_CLIENT_ID", "")
NAVER_CLIENT_SECRET = os.getenv("NAVER_CLIENT_SECRET", "")
NAVER_NEWS_URL = "https://openapi.naver.com/v1/search/news.json"
LAST_API_ERROR = ""

# 비교 대상 회사 설정
COMPANIES = {
    "넥슨": {"query": "넥슨", "color": "#0066FF"},
    "NC소프트": {"query": "NC소프트 OR 엔씨소프트", "color": "#FF6B35"},
    "넷마블": {"query": "넷마블", "color": "#28A745"},
    "크래프톤": {"query": "크래프톤", "color": "#9B59B6"},
}


def _clean_html(text: str) -> str:
    """HTML 태그 및 특수문자 제거"""
    text = re.sub(r"<[^>]+>", "", text)
    text = re.sub(r"&[a-zA-Z]+;", " ", text)
    return text.strip()


def _parse_date(date_str: str) -> datetime:
    """네이버 API 날짜 형식 파싱 (RFC 822)"""
    try:
        return datetime.strptime(date_str, "%a, %d %b %Y %H:%M:%S %z")
    except ValueError:
        return datetime.now()


def get_last_api_error() -> str:
    """마지막 API 실패 메시지 반환"""
    return LAST_API_ERROR


def search_news(query: str, display: int = 100, start: int = 1, sort: str = "date") -> list[dict]:
    """네이버 뉴스 검색 API 호출

    Args:
        query: 검색어
        display: 결과 개수 (최대 100)
        start: 시작 위치
        sort: 정렬 기준 (date: 날짜순, sim: 정확도순)

    Returns:
        뉴스 기사 리스트
    """
    global LAST_API_ERROR

    if not NAVER_CLIENT_ID or not NAVER_CLIENT_SECRET:
        LAST_API_ERROR = "NAVER_CLIENT_ID 또는 NAVER_CLIENT_SECRET이 설정되지 않았습니다."
        return []

    if start < 1 or start > 1000:
        LAST_API_ERROR = "네이버 뉴스 API start 파라미터는 1~1000 범위여야 합니다."
        return []

    headers = {
        "X-Naver-Client-Id": NAVER_CLIENT_ID,
        "X-Naver-Client-Secret": NAVER_CLIENT_SECRET,
    }
    params = {
        "query": query,
        "display": min(display, 100),
        "start": start,
        "sort": sort,
    }

    try:
        resp = requests.get(NAVER_NEWS_URL, headers=headers, params=params, timeout=10)
        resp.raise_for_status()
        data = resp.json()
        LAST_API_ERROR = ""
        return data.get("items", [])
    except requests.HTTPError as exc:
        status_code = exc.response.status_code if exc.response is not None else "unknown"
        LAST_API_ERROR = f"네이버 API HTTP 오류(status={status_code})"
        return []
    except requests.RequestException as exc:
        LAST_API_ERROR = f"네이버 API 요청 실패({exc.__class__.__name__})"
        return []


def fetch_company_news(company: str, total: int = 100) -> pd.DataFrame:
    """특정 회사의 뉴스를 수집하여 DataFrame으로 반환

    네이버 API는 한 번에 최대 100건이므로 필요 시 페이징 처리
    """
    config = COMPANIES.get(company)
    if not config:
        return pd.DataFrame()

    all_items = []
    fetched = 0
    start = 1

    while fetched < total:
        batch_size = min(100, total - fetched)
        items = search_news(config["query"], display=batch_size, start=start)
        if not items:
            break
        all_items.extend(items)
        fetched += len(items)
        start += len(items)
        if len(items) < batch_size:
            break

    if not all_items:
        return pd.DataFrame()

    df = pd.DataFrame(all_items)
    df["title_clean"] = df["title"].apply(_clean_html)
    df["description_clean"] = df["description"].apply(_clean_html)
    df["pubDate_parsed"] = df["pubDate"].apply(_parse_date)
    df["date"] = df["pubDate_parsed"].dt.strftime("%Y-%m-%d")
    df["company"] = company

    df["unique_key"] = (
        df["originallink"].fillna("")
        .where(df["originallink"].fillna("") != "", df["link"].fillna(""))
        .where(df["originallink"].fillna("") != "", df["title_clean"] + "|" + df["date"])
    )
    df = (
        df.sort_values("pubDate_parsed", ascending=False)
        .drop_duplicates(subset=["unique_key"], keep="first")
        .drop(columns=["unique_key"])
        .reset_index(drop=True)
    )

    return df[["title_clean", "description_clean", "originallink", "link", "pubDate_parsed", "date", "company"]]


def fetch_all_companies(total_per_company: int = 100) -> pd.DataFrame:
    """모든 회사의 뉴스를 수집하여 통합 DataFrame 반환"""
    frames = []
    for company in COMPANIES:
        df = fetch_company_news(company, total=total_per_company)
        if not df.empty:
            frames.append(df)

    if not frames:
        return pd.DataFrame()

    return pd.concat(frames, ignore_index=True)


def get_daily_counts(df: pd.DataFrame) -> pd.DataFrame:
    """회사별 일별 보도 건수 집계"""
    if df.empty:
        return pd.DataFrame()

    counts = df.groupby(["date", "company"]).size().reset_index(name="count")
    pivot = counts.pivot(index="date", columns="company", values="count").fillna(0).astype(int)
    pivot = pivot.sort_index()
    return pivot
