"""네이버 검색 API를 통한 뉴스 데이터 수집 서비스."""

import os
import re
from datetime import datetime
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

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
    "NC소프트": {"query": "NC소프트 OR 엔씨소프트 OR NCSOFT OR 리니지 OR 쓰론 앤 리버티", "color": "#FF6B35"},
    "넷마블": {"query": "넷마블", "color": "#28A745"},
    "크래프톤": {"query": "크래프톤", "color": "#9B59B6"},
}

# 넥슨 군집 분석용 쿼리 그룹(다양한 이슈를 확보하기 위한 확장형 쿼리)
NEXON_CLUSTER_QUERIES = [
    "넥슨",
    "NEXON OR 넥슨",
    "넥슨 AND 신작",
    "넥슨 AND 업데이트",
    "넥슨 AND 실적",
    "넥슨 AND 이벤트",
    "넥슨 AND 글로벌",
    "넥슨 AND 이용자",
    "넥슨 AND 운영",
    "넥슨 AND 논란",
    "넥슨 AND 확률형",
    "넥슨 AND 보상",
]

BACKTEST_MAPLE_IDLE_QUERIES = [
    "메이플키우기",
    "메이플 키우기",
    "AFK 메이플",
    "메이플키우기 확률",
    "메이플키우기 환불",
    "메이플키우기 조작",
    "메이플키우기 공정위",
    "메이플키우기 논란",
    "메이플키우기 버그",
    "메이플키우기 넥슨",
    "넥슨 확률 조작",
    "넥슨 전액환불",
    "넥슨 공정위 현장조사",
]

BACKTEST_PERIOD_HINTS = [
    ("2025-11-01", "2025-11-30", "2025년 11월"),
    ("2025-12-01", "2025-12-31", "2025년 12월"),
    ("2026-01-01", "2026-01-15", "2026년 1월 초"),
    ("2026-01-16", "2026-01-31", "2026년 1월 하순"),
    ("2026-02-01", "2026-02-10", "2026년 2월"),
]


def _clean_html(text: str) -> str:
    """HTML 태그 및 특수문자 제거"""
    text = re.sub(r"<[^>]+>", "", text)
    text = re.sub(r"&[a-zA-Z]+;", " ", text)
    return text.strip()


def _normalize_title(text: str) -> str:
    """중복 판별용 제목 정규화."""
    t = _clean_html(text or "").lower()
    t = re.sub(r"\[[^\]]*\]|\([^)]+\)", " ", t)
    t = re.sub(r"[^0-9a-z가-힣]+", " ", t)
    t = re.sub(r"\s+", " ", t).strip()
    return t


def _normalize_url(url: str) -> str:
    """추적 파라미터를 제거해 URL을 정규화."""
    raw = (url or "").strip()
    if not raw:
        return ""
    try:
        p = urlparse(raw)
    except Exception:
        return raw

    host = (p.netloc or "").lower()
    path = p.path or ""
    if host.startswith("www."):
        host = host[4:]

    drop_prefixes = ("utm_", "fbclid", "gclid", "ref", "source")
    keep = []
    for k, v in parse_qsl(p.query, keep_blank_values=False):
        lk = k.lower()
        if lk.startswith(drop_prefixes):
            continue
        keep.append((k, v))
    keep.sort()

    return urlunparse(("https", host, path, "", urlencode(keep), ""))


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


def _to_company_dataframe(items: list[dict], company: str) -> pd.DataFrame:
    if not items:
        return pd.DataFrame()

    df = pd.DataFrame(items)
    if df.empty:
        return pd.DataFrame()

    df["title_clean"] = df["title"].apply(_clean_html)
    df["description_clean"] = df["description"].apply(_clean_html)
    df["pubDate_parsed"] = df["pubDate"].apply(_parse_date)
    df["date"] = df["pubDate_parsed"].dt.strftime("%Y-%m-%d")
    df["company"] = company
    return df[["title_clean", "description_clean", "originallink", "link", "pubDate_parsed", "date", "company"]]


def _dedupe_news(df: pd.DataFrame) -> pd.DataFrame:
    if df.empty:
        return df

    out = df.copy()
    out["originallink_norm"] = out["originallink"].fillna("").apply(_normalize_url)
    out["link_norm"] = out["link"].fillna("").apply(_normalize_url)
    out["title_norm"] = out["title_clean"].apply(_normalize_title)
    out["unique_key"] = (
        out["originallink_norm"]
        .where(out["originallink_norm"] != "", out["link_norm"])
        .where(out["link_norm"] != "", out["title_norm"] + "|" + out["date"])
    )
    out = (
        out.sort_values("pubDate_parsed", ascending=False)
        .drop_duplicates(subset=["unique_key"], keep="first")
        .drop(columns=["unique_key", "originallink_norm", "link_norm", "title_norm"])
        .reset_index(drop=True)
    )
    return out


def fetch_company_news(company: str, total: int = 100) -> pd.DataFrame:
    """기존 호환용: 회사 비교 수집 로직을 사용."""
    return fetch_company_news_compare(company=company, total=total)


def fetch_company_news_compare(company: str, total: int = 100) -> pd.DataFrame:
    """회사 비교용 수집 로직(최신순/안정적)."""
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

    df = _to_company_dataframe(all_items, company=company)
    df = _dedupe_news(df)
    return df


def fetch_nexon_cluster_news(total: int = 300) -> pd.DataFrame:
    """넥슨 군집 분석용 수집 로직(다양한 이슈 쿼리 + date/sim 혼합)."""
    query_plan = list(NEXON_CLUSTER_QUERIES)
    if total <= 0:
        return pd.DataFrame()

    # 쿼리별 최소 확보량을 두고, 전체 총량 내에서 균등 배분
    per_query = max(10, total // max(len(query_plan), 1))
    all_frames: list[pd.DataFrame] = []

    for query in query_plan:
        # 최신 이슈 수집
        date_items = search_news(query, display=min(50, per_query), start=1, sort="date")
        df_date = _to_company_dataframe(date_items, company="넥슨")
        if not df_date.empty:
            all_frames.append(df_date)

        # 대표성 기사 보완(sim)
        sim_items = search_news(query, display=min(25, max(10, per_query // 2)), start=1, sort="sim")
        df_sim = _to_company_dataframe(sim_items, company="넥슨")
        if not df_sim.empty:
            all_frames.append(df_sim)

    if not all_frames:
        return pd.DataFrame()

    merged = pd.concat(all_frames, ignore_index=True)
    merged = _dedupe_news(merged)
    return merged.head(total).reset_index(drop=True)


def fetch_nexon_bulk_news(
    *,
    target_articles: int = 20000,
    max_calls: int = 1200,
    date_from: str = "2024-01-01",
    date_to: str = "2026-12-31",
) -> tuple[pd.DataFrame, dict]:
    """넥슨 분석 프로젝트용 대량 수집 로직.

    - 비교/군집 실시간 호출과 분리된 배치 수집 전용 경로
    - 다중 쿼리 + date/sim 조합을 순환하며 수집
    - 최종 단계에서 날짜 필터 및 중복 제거 수행
    """
    start_date = pd.to_datetime(date_from, errors="coerce")
    end_date = pd.to_datetime(date_to, errors="coerce")
    if pd.isna(start_date) or pd.isna(end_date):
        raise ValueError("date_from/date_to 형식이 올바르지 않습니다. (YYYY-MM-DD)")
    if start_date > end_date:
        raise ValueError("date_from은 date_to보다 이전이어야 합니다.")

    streams: list[dict] = []
    for query in NEXON_CLUSTER_QUERIES:
        streams.append({"query": query, "sort": "date", "start": 1, "exhausted": False})
        streams.append({"query": query, "sort": "sim", "start": 1, "exhausted": False})

    all_frames: list[pd.DataFrame] = []
    calls = 0
    empty_rounds = 0
    stream_idx = 0
    raw_items = 0

    while calls < max_calls and any(not s["exhausted"] for s in streams):
        stream = streams[stream_idx % len(streams)]
        stream_idx += 1
        if stream["exhausted"]:
            continue

        items = search_news(stream["query"], display=100, start=stream["start"], sort=stream["sort"])
        calls += 1
        if not items:
            stream["exhausted"] = True
            empty_rounds += 1
            if empty_rounds >= len(streams):
                break
            continue
        empty_rounds = 0

        raw_items += len(items)
        stream["start"] += len(items)
        if len(items) < 100 or stream["start"] > 1000:
            stream["exhausted"] = True

        frame = _to_company_dataframe(items, company="넥슨")
        if not frame.empty:
            all_frames.append(frame)

        # 중복을 고려해 목표치의 3배 원천 데이터까지 수집 후 정리
        if raw_items >= target_articles * 3:
            break

    if not all_frames:
        return pd.DataFrame(), {"calls": calls, "raw_items": 0, "filtered_items": 0}

    merged = pd.concat(all_frames, ignore_index=True)
    merged["pubDate_parsed"] = pd.to_datetime(merged["pubDate_parsed"], errors="coerce", utc=True).dt.tz_convert(None)
    merged = merged.dropna(subset=["pubDate_parsed"]).reset_index(drop=True)
    merged = merged[
        (merged["pubDate_parsed"] >= start_date.to_pydatetime())
        & (merged["pubDate_parsed"] <= (end_date + pd.Timedelta(days=1) - pd.Timedelta(seconds=1)).to_pydatetime())
    ].reset_index(drop=True)
    merged = _dedupe_news(merged).head(target_articles).reset_index(drop=True)

    return merged, {"calls": calls, "raw_items": raw_items, "filtered_items": int(len(merged))}


def fetch_maple_idle_backtest_news(
    *,
    date_from: str = "2025-11-01",
    date_to: str = "2026-02-10",
    date_pages: int = 10,
    sim_pages: int = 5,
    page_size: int = 100,
    max_calls: int = 1000,
) -> tuple[pd.DataFrame, dict]:
    """메이플키우기 백테스트용 과거 기사 수집.

    네이버 API 날짜 필터 부재를 보완하기 위해:
    - sort=date: 기본 쿼리 확장 수집
    - sort=sim: 기간 힌트 쿼리 병행 수집
    - 최종적으로 pubDate 기준 기간 필터 적용
    """
    start_date = pd.to_datetime(date_from, errors="coerce")
    end_date = pd.to_datetime(date_to, errors="coerce")
    if pd.isna(start_date) or pd.isna(end_date):
        raise ValueError("date_from/date_to 형식이 올바르지 않습니다. (YYYY-MM-DD)")
    if start_date > end_date:
        raise ValueError("date_from은 date_to보다 이전이어야 합니다.")

    period_hints = [hint for s, e, hint in BACKTEST_PERIOD_HINTS if not (pd.Timestamp(e) < start_date or pd.Timestamp(s) > end_date)]
    if not period_hints:
        period_hints = [f"{start_date.year}년", f"{end_date.year}년"]

    frames: list[pd.DataFrame] = []
    calls = 0
    raw_items = 0
    exhausted_streams = 0
    total_streams = len(BACKTEST_MAPLE_IDLE_QUERIES) * 2

    for base_query in BACKTEST_MAPLE_IDLE_QUERIES:
        if calls >= max_calls:
            break

        # 최신순 수집 (최근 기사 우선)
        start = 1
        for _ in range(max(1, int(date_pages))):
            if calls >= max_calls or start > 1000:
                break
            items = search_news(base_query, display=min(max(10, int(page_size)), 100), start=start, sort="date")
            calls += 1
            if not items:
                break
            raw_items += len(items)
            frame = _to_company_dataframe(items, company="넥슨")
            if not frame.empty:
                frames.append(frame)
            if len(items) < min(max(10, int(page_size)), 100):
                break
            start += len(items)
        else:
            exhausted_streams += 1

        # 정확도순 수집 (기간 힌트 포함)
        sim_query_cycle = [base_query] + [f"{base_query} {hint}" for hint in period_hints]
        start = 1
        for idx in range(max(1, int(sim_pages))):
            if calls >= max_calls or start > 1000:
                break
            sim_query = sim_query_cycle[idx % len(sim_query_cycle)]
            items = search_news(sim_query, display=min(max(10, int(page_size)), 100), start=start, sort="sim")
            calls += 1
            if not items:
                break
            raw_items += len(items)
            frame = _to_company_dataframe(items, company="넥슨")
            if not frame.empty:
                frames.append(frame)
            if len(items) < min(max(10, int(page_size)), 100):
                break
            start += len(items)
        else:
            exhausted_streams += 1

    if not frames:
        return pd.DataFrame(), {"calls": calls, "raw_items": 0, "filtered_items": 0, "queries": len(BACKTEST_MAPLE_IDLE_QUERIES)}

    merged = pd.concat(frames, ignore_index=True)
    merged["pubDate_parsed"] = pd.to_datetime(merged["pubDate_parsed"], errors="coerce", utc=True).dt.tz_convert(None)
    merged = merged.dropna(subset=["pubDate_parsed"]).reset_index(drop=True)

    start_dt = start_date.to_pydatetime()
    end_dt = (end_date + pd.Timedelta(days=1) - pd.Timedelta(seconds=1)).to_pydatetime()
    merged = merged[(merged["pubDate_parsed"] >= start_dt) & (merged["pubDate_parsed"] <= end_dt)].reset_index(drop=True)
    merged = _dedupe_news(merged)

    stats = {
        "calls": int(calls),
        "raw_items": int(raw_items),
        "filtered_items": int(len(merged)),
        "queries": int(len(BACKTEST_MAPLE_IDLE_QUERIES)),
        "period_hints": period_hints,
        "exhausted_streams": int(exhausted_streams),
        "max_calls": int(max_calls),
    }
    return merged, stats


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
