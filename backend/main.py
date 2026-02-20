from __future__ import annotations

import random
import re
import sys
import time
import os
import math
import logging
from threading import Lock
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FutureTimeoutError, as_completed
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

import pandas as pd
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger
from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.append(str(ROOT_DIR))

from backend.storage import (
    IP_RULES,
    OUTLET_GAME_MEDIA,
    OUTLET_TIER1,
    RISK_FORMULA_VERSION,
    RISK_THEME_RULES,
    THEME_WEIGHTS_HEAT,
    THEME_WEIGHTS_RISK,
    cleanup_live_articles,
    cleanup_risk_timeseries,
    cleanup_scheduler_logs,
    cleanup_test_articles,
    get_active_db_path,
    get_articles,
    get_observability_counts,
    get_latest_scheduler_log,
    get_ip_clusters,
    get_live_risk_with_options,
    get_nexon_articles,
    get_nexon_dashboard,
    get_recent_burst_events,
    get_recent_risk_scores,
    get_risk_timeseries,
    get_risk_dashboard,
    get_risk_ip_catalog,
    init_db,
    force_burst_test_articles,
    record_burst_event,
    record_scheduler_log,
    get_scheduler_log_fallback_count,
    repair_article_outlets,
    save_articles,
    upsert_risk_daily_summary,
)
from backend.analysis_project import CORE_IPS, build_project_snapshot
from backend.burst_manager import BurstManager
from backend.backtest import get_backtest_db_path, run_backtest
from services.naver_api import (
    COMPANIES,
    fetch_company_news_compare,
    fetch_nexon_cluster_news,
    get_daily_counts,
    get_last_api_error,
    search_news,
)
from utils.keywords import get_keyword_data
from utils.sentiment import add_sentiment_column, get_model_id


class AnalyzeRequest(BaseModel):
    companies: list[str] = Field(default_factory=lambda: list(COMPANIES.keys()))
    articles_per_company: int = Field(default=40, ge=10, le=100)


class NexonClusterRequest(BaseModel):
    total_articles: int = Field(default=300, ge=50, le=1000)


app = FastAPI(title="NEXON PR API", version="1.0.0")
logger = logging.getLogger("backend.main")

MONITOR_IPS = list(CORE_IPS)
BASE_INTERVAL_SECONDS = 600
BURST_INTERVAL_SECONDS = 120
MAX_BURST_SECONDS = 7200
LIVE_COLLECT_INTERVAL_SECONDS = int(os.getenv("LIVE_COLLECT_INTERVAL_SECONDS", "600"))
LIVE_COLLECT_DISPLAY = int(os.getenv("LIVE_COLLECT_DISPLAY", "100"))
LIVE_COLLECT_PAGES = int(os.getenv("LIVE_COLLECT_PAGES", "3"))
LIVE_COLLECT_QUERIES_PER_IP = int(os.getenv("LIVE_COLLECT_QUERIES_PER_IP", "8"))
LIVE_COLLECT_INCLUDE_SIM = os.getenv("LIVE_COLLECT_INCLUDE_SIM", "1") == "1"
COLLECT_ZERO_STREAK_WARN_THRESHOLD = int(os.getenv("COLLECT_ZERO_STREAK_WARN_THRESHOLD", "10"))
COMPARE_LIVE_RATE_LIMIT_PER_MIN = int(os.getenv("COMPARE_LIVE_RATE_LIMIT_PER_MIN", "30"))
COMPARE_LIVE_CACHE_TTL_SECONDS = int(os.getenv("COMPARE_LIVE_CACHE_TTL_SECONDS", "45"))
COMPARE_LIVE_COMPANY_TIMEOUT_SECONDS = int(os.getenv("COMPARE_LIVE_COMPANY_TIMEOUT_SECONDS", "10"))
COMPARE_LIVE_MAX_WORKERS = int(os.getenv("COMPARE_LIVE_MAX_WORKERS", "4"))
ENABLE_COMPETITOR_AUTO_COLLECT = os.getenv("ENABLE_COMPETITOR_AUTO_COLLECT", "1") == "1"
COMPETITOR_COLLECT_INTERVAL_SECONDS = int(os.getenv("COMPETITOR_COLLECT_INTERVAL_SECONDS", "3600"))
COMPETITOR_COLLECT_ARTICLES = int(os.getenv("COMPETITOR_COLLECT_ARTICLES", "30"))
COMPETITOR_AUTO_COMPANIES = [
    c.strip()
    for c in os.getenv("COMPETITOR_AUTO_COMPANIES", "넥슨,NC소프트,넷마블,크래프톤").split(",")
    if c.strip() in COMPANIES
]
BACKFILL_INTERVAL_SECONDS = int(os.getenv("BACKFILL_INTERVAL_SECONDS", "1800"))
BACKFILL_LOW_COUNT_THRESHOLD = int(os.getenv("BACKFILL_LOW_COUNT_THRESHOLD", "8"))
BACKFILL_MAX_IPS_PER_RUN = int(os.getenv("BACKFILL_MAX_IPS_PER_RUN", "2"))
BACKFILL_DISPLAY = int(os.getenv("BACKFILL_DISPLAY", "40"))
BACKFILL_QUERIES: dict[str, list[str]] = {
    "maplestory": [
        "메이플스토리",
        "메이플",
        "maplestory",
        "메이플m",
        "메이플스토리m",
        "maplestory m",
        "메이플 키우기",
        "메이플키우기",
        "메이플 월드",
        "메이플월드",
    ],
    "dnf": [
        "던전앤파이터",
        "던파",
        "dnf",
        "neople",
        "네오플",
        "던파모바일",
        "dnf mobile",
        "퍼스트 버서커 카잔",
        "the first berserker khazan",
    ],
    "arcraiders": ["아크레이더스", "아크 레이더스", "arc raiders", "arcraiders"],
    "bluearchive": ["블루아카이브", "블루 아카이브", "블루아카", "blue archive"],
    "fconline": ["fc온라인", "fc online", "fconline", "피파온라인", "ea sports fc online"],
}
SCHEDULER_LOG_TTL_DAYS = int(os.getenv("SCHEDULER_LOG_TTL_DAYS", "7"))
TEST_ARTICLE_TTL_HOURS = int(os.getenv("TEST_ARTICLE_TTL_HOURS", "24"))
LIVE_ARTICLE_RETENTION_DAYS = int(os.getenv("LIVE_ARTICLE_RETENTION_DAYS", "30"))
RISK_TIMESERIES_RETENTION_DAYS = int(os.getenv("RISK_TIMESERIES_RETENTION_DAYS", "90"))
LIVE_COLLECT_MAX_AGE_DAYS = max(1, int(os.getenv("LIVE_COLLECT_MAX_AGE_DAYS", str(LIVE_ARTICLE_RETENTION_DAYS))))
RISK_DASHBOARD_DEFAULT_LOOKBACK_DAYS = max(7, int(os.getenv("RISK_DASHBOARD_DEFAULT_LOOKBACK_DAYS", "90")))
CLEANUP_DRY_RUN = os.getenv("CLEANUP_DRY_RUN", "0") == "1"
CLEANUP_MAX_DELETE_ROWS = int(os.getenv("CLEANUP_MAX_DELETE_ROWS", "5000"))
ENABLE_DEBUG_ENDPOINTS = os.getenv("ENABLE_DEBUG_ENDPOINTS", "0") == "1"
DISABLE_COMPETITOR_COMPARE = os.getenv("DISABLE_COMPETITOR_COMPARE", "1") == "1"
ENABLE_MANUAL_COLLECTION = os.getenv("ENABLE_MANUAL_COLLECTION", "0") == "1"
CORS_ALLOW_ORIGINS_RAW = os.getenv(
    "CORS_ALLOW_ORIGINS",
    "http://localhost:3000,http://127.0.0.1:3000,http://localhost:3001,http://127.0.0.1:3001",
)
CORS_ALLOW_CREDENTIALS = os.getenv("CORS_ALLOW_CREDENTIALS", "1") == "1"
APP_ENV = os.getenv("APP_ENV", "dev").strip().lower()
REQUIRED_STARTUP_ENV_KEYS = ["LIVE_DB_PATH", "BACKTEST_DB_PATH", "CORS_ALLOW_ORIGINS", "NAVER_CLIENT_ID", "NAVER_CLIENT_SECRET"]

scheduler = BackgroundScheduler(timezone="Asia/Seoul")
burst_managers: dict[str, BurstManager] = {
    ip_id: BurstManager(
        ip_id,
        base_interval=BASE_INTERVAL_SECONDS,
        burst_interval=BURST_INTERVAL_SECONDS,
        max_burst_duration=MAX_BURST_SECONDS,
    )
    for ip_id in MONITOR_IPS
}
last_burst_state: dict[str, dict[str, Any]] = {}
scheduler_job_state: dict[str, dict[str, Any]] = {}
collect_zero_insert_streak: dict[str, int] = {ip_id: 0 for ip_id in MONITOR_IPS}
_last_zero_alert_signature: tuple[str, ...] = ()
compare_live_rate_state: dict[str, list[float]] = {}
compare_live_cache: dict[str, dict[str, Any]] = {}
compare_live_cache_lock = Lock()
compare_live_rate_lock = Lock()
compare_live_metrics = {
    "requests": 0,
    "rate_limited": 0,
    "cache_hits": 0,
    "cache_misses": 0,
    "cache_fallback_hits": 0,
}
cleanup_last_result = {
    "deleted_scheduler_logs": 0,
    "deleted_test_articles": 0,
    "deleted_live_articles": 0,
    "deleted_risk_rows": 0,
    "summary_rows_upserted": 0,
    "updated_at": "",
}
SENTIMENT_BUCKETS = ("긍정", "중립", "부정")


def _parse_csv_env(value: str) -> list[str]:
    return [item.strip() for item in (value or "").split(",") if item.strip()]


def _load_cors_origins() -> list[str]:
    origins = _parse_csv_env(CORS_ALLOW_ORIGINS_RAW)
    if not origins:
        logger.warning("CORS_ALLOW_ORIGINS is empty. Falling back to localhost defaults.")
        return ["http://localhost:3000", "http://127.0.0.1:3000", "http://localhost:3001", "http://127.0.0.1:3001"]
    return origins


def _is_local_origin(origin: str) -> bool:
    low = (origin or "").strip().lower()
    if low == "*":
        return False
    try:
        parsed = urlparse(low)
    except Exception:
        return "localhost" in low or "127.0.0.1" in low or "0.0.0.0" in low
    host = (parsed.hostname or "").lower()
    return host in {"localhost", "127.0.0.1", "0.0.0.0"}


def _validate_cors_config(origins: list[str], allow_credentials: bool, app_env: str) -> tuple[str, list[str]]:
    warnings: list[str] = []
    if allow_credentials and "*" in origins:
        warnings.append("wildcard_origin_with_credentials")
    if app_env == "prod":
        if "*" in origins:
            warnings.append("prod_env_wildcard_origin")
        if any(_is_local_origin(origin) for origin in origins):
            warnings.append("prod_env_localhost_origin")
    return ("warning", warnings) if warnings else ("ok", [])


cors_allow_origins = _load_cors_origins()
cors_allow_credentials = CORS_ALLOW_CREDENTIALS
if cors_allow_credentials and "*" in cors_allow_origins:
    logger.warning("CORS_ALLOW_CREDENTIALS=1 cannot be combined with wildcard origin. Forcing credentials to False.")
    cors_allow_credentials = False
cors_validation_status, cors_validation_warnings = _validate_cors_config(cors_allow_origins, CORS_ALLOW_CREDENTIALS, APP_ENV)
for warning in cors_validation_warnings:
    logger.warning(
        "cors_validation_warning app_env=%s warning=%s origins=%s",
        APP_ENV,
        warning,
        ",".join(cors_allow_origins),
    )

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_allow_origins,
    allow_credentials=cors_allow_credentials,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup() -> None:
    logger.info(
        "startup init: monitor_ips=%s, debug_endpoints=%s, manual_collection=%s, cors_origins=%s",
        MONITOR_IPS,
        ENABLE_DEBUG_ENDPOINTS,
        ENABLE_MANUAL_COLLECTION,
        ",".join(cors_allow_origins),
    )
    if APP_ENV == "prod" and cors_validation_status != "ok":
        logger.warning(
            "startup cors guardrail triggered: app_env=%s status=%s warnings=%s",
            APP_ENV,
            cors_validation_status,
            ",".join(cors_validation_warnings),
        )
    missing_env = [key for key in REQUIRED_STARTUP_ENV_KEYS if not os.getenv(key, "").strip()]
    if missing_env:
        logger.error("startup required env missing: keys=%s", ",".join(missing_env))
        raise RuntimeError(f"missing required env keys: {','.join(missing_env)}")
    init_db()
    repair_article_outlets(remove_placeholder=True)
    _start_monitoring_scheduler()


@app.on_event("shutdown")
def on_shutdown() -> None:
    if scheduler.running:
        scheduler.shutdown(wait=False)
        logger.info("scheduler shutdown requested")


def _job_id(ip_id: str) -> str:
    return f"risk-monitor-{ip_id}"


def _collect_job_id(ip_id: str) -> str:
    return f"collect-news-{ip_id}"


def _get_collect_strategy(ip_id: str) -> dict[str, Any]:
    base_queries = max(1, LIVE_COLLECT_QUERIES_PER_IP)
    base_pages = max(1, LIVE_COLLECT_PAGES)
    base_include_sim = LIVE_COLLECT_INCLUDE_SIM
    streak = int(collect_zero_insert_streak.get(ip_id, 0))
    fallback_active = streak >= COLLECT_ZERO_STREAK_WARN_THRESHOLD
    max_queries = max(1, len(BACKFILL_QUERIES.get(ip_id, []) or []))
    if fallback_active:
        return {
            "queries_per_ip": min(max_queries, base_queries + 1),
            "pages": min(10, base_pages + 2),
            "include_sim": True,
            "fallback_active": True,
            "fallback_reason": f"zero_insert_streak>={COLLECT_ZERO_STREAK_WARN_THRESHOLD}",
        }
    return {
        "queries_per_ip": base_queries,
        "pages": base_pages,
        "include_sim": base_include_sim,
        "fallback_active": False,
        "fallback_reason": "",
    }


def _update_collect_zero_streak(ip_id: str, inserted: int) -> tuple[int, bool]:
    prev = int(collect_zero_insert_streak.get(ip_id, 0))
    current = prev + 1 if int(inserted) == 0 else 0
    collect_zero_insert_streak[ip_id] = current
    alert = current >= COLLECT_ZERO_STREAK_WARN_THRESHOLD
    if alert and prev < COLLECT_ZERO_STREAK_WARN_THRESHOLD:
        logger.warning(
            "collect_zero_streak_alert ip_id=%s streak=%s threshold=%s",
            ip_id,
            current,
            COLLECT_ZERO_STREAK_WARN_THRESHOLD,
        )
    return current, alert


def _parse_companies(companies_raw: str) -> list[str]:
    seen: set[str] = set()
    selected: list[str] = []
    for company in [c.strip() for c in (companies_raw or "").split(",") if c.strip()]:
        if company not in COMPANIES:
            continue
        if company in seen:
            continue
        selected.append(company)
        seen.add(company)
    return selected


def _compare_live_cache_key(selected: list[str], window_hours: int, limit: int) -> str:
    return f"companies={','.join(selected)}|window_hours={int(window_hours)}|limit={int(limit)}"


def _compare_live_client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for", "")
    if forwarded:
        first = forwarded.split(",")[0].strip()
        if first:
            return first
    if request.client and request.client.host:
        return str(request.client.host)
    return "unknown"


def _check_compare_live_rate_limit(client_ip: str) -> int:
    with compare_live_rate_lock:
        compare_live_metrics["requests"] = int(compare_live_metrics.get("requests", 0)) + 1
        now_ts = time.time()
        window_start = now_ts - 60.0
        reqs = [ts for ts in compare_live_rate_state.get(client_ip, []) if ts >= window_start]
        limit = max(1, int(COMPARE_LIVE_RATE_LIMIT_PER_MIN))
        if len(reqs) >= limit:
            oldest = min(reqs) if reqs else now_ts
            retry_after = max(1, int(round(60 - (now_ts - oldest))))
            compare_live_rate_state[client_ip] = reqs
            compare_live_metrics["rate_limited"] = int(compare_live_metrics.get("rate_limited", 0)) + 1
            return retry_after
        reqs.append(now_ts)
        compare_live_rate_state[client_ip] = reqs
        return 0


def _increment_compare_live_metric(metric_key: str) -> None:
    with compare_live_rate_lock:
        compare_live_metrics[metric_key] = int(compare_live_metrics.get(metric_key, 0)) + 1


def _build_compare_live_payload(selected: list[str], limit: int, window_hours: int) -> dict[str, Any]:
    def _fetch_one(company: str) -> tuple[str, pd.DataFrame]:
        return company, fetch_company_news_compare(company, total=int(limit))

    frames: list[pd.DataFrame] = []
    failed_companies: list[str] = []
    timeout_companies: list[str] = []
    empty_companies: list[str] = []
    processed_companies: set[str] = set()

    def _consume_future(company: str, future: Any) -> None:
        try:
            _, part = future.result()
            processed_companies.add(company)
            if part.empty:
                empty_companies.append(company)
                return
            frames.append(part)
        except Exception:  # noqa: BLE001
            failed_companies.append(company)
            processed_companies.add(company)

    max_workers = max(1, min(int(COMPARE_LIVE_MAX_WORKERS), len(selected)))
    per_company_timeout = max(1, int(COMPARE_LIVE_COMPANY_TIMEOUT_SECONDS))
    executor = ThreadPoolExecutor(max_workers=max_workers)
    try:
        futures = {executor.submit(_fetch_one, company): company for company in selected}
        try:
            for future in as_completed(futures, timeout=per_company_timeout):
                company = futures[future]
                _consume_future(company, future)
        except FutureTimeoutError:
            pass
        finally:
            for future, company in futures.items():
                if company in processed_companies:
                    continue
                if future.done():
                    _consume_future(company, future)
                    continue
                timeout_companies.append(company)
                future.cancel()
    finally:
        executor.shutdown(wait=False, cancel_futures=True)

    if timeout_companies:
        logger.warning("compare_live per-company timeout: companies=%s", ",".join(timeout_companies))
    if failed_companies:
        logger.warning("compare_live partial failures: companies=%s", ",".join(failed_companies))
    if empty_companies:
        logger.info("compare_live empty result companies=%s", ",".join(empty_companies))
    if not frames:
        raise RuntimeError(get_last_api_error() or "뉴스를 수집하지 못했습니다.")

    merged = pd.concat(frames, ignore_index=True)
    merged = merged.drop_duplicates(subset=["company", "originallink", "title_clean"], keep="first").reset_index(drop=True)
    parsed = pd.to_datetime(merged.get("pubDate_parsed"), errors="coerce", utc=True).dt.tz_convert(None)
    window_start = datetime.now(UTC).replace(tzinfo=None) - timedelta(hours=max(1, int(window_hours)))
    merged = merged.loc[parsed >= window_start].copy()
    if merged.empty:
        raise RuntimeError(f"window_hours={int(window_hours)} 조건에 해당하는 뉴스가 없습니다.")
    merged = add_sentiment_column(merged)
    save_articles(merged)
    payload = _build_payload(merged, selected)
    meta = dict(payload.get("meta") or {})
    meta["window_hours"] = int(window_hours)
    payload["meta"] = meta
    return payload


def _with_compare_live_meta(payload: dict[str, Any], *, cache_hit: bool, cache_fallback: bool) -> dict[str, Any]:
    out = dict(payload or {})
    meta = dict(out.get("meta") or {})
    meta["cache_hit"] = bool(cache_hit)
    meta["cache_fallback"] = bool(cache_fallback)
    meta["cache_ttl_seconds"] = int(COMPARE_LIVE_CACHE_TTL_SECONDS)
    out["meta"] = meta
    return out


def _run_monitor_tick(ip_id: str) -> None:
    job_id = _job_id(ip_id)
    run_ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    attempts = 2
    last_exc: Exception | None = None
    started = time.time()
    for i in range(attempts):
        try:
            risk = get_live_risk_with_options(ip=ip_id, window_hours=24, include_test=False)
            risk_score = float(risk.get("risk_score", 0.0))
            z_score = float(risk.get("z_score", 0.0))
            history_30m = get_recent_risk_scores(ip_id=ip_id, minutes=30)
            sustained_low = len(history_30m) >= 6 and all(v < 55.0 for v in history_30m[-6:])

            manager = burst_managers[ip_id]
            decision = manager.evaluate(
                current_risk=risk_score,
                is_volume_spike=(z_score >= 2.0),
                sustained_low_30m=sustained_low,
            )

            if decision.changed:
                if scheduler.running:
                    scheduler.reschedule_job(
                        job_id,
                        trigger=IntervalTrigger(seconds=int(decision.interval_seconds)),
                    )
                record_burst_event(
                    ip_name=ip_id,
                    event_type=str(decision.event_type or "unknown"),
                    trigger_reason=str(decision.trigger_reason or "unknown"),
                    risk_at_event=risk_score,
                )
            last_burst_state[ip_id] = {
                "mode": decision.mode,
                "interval_seconds": int(decision.interval_seconds),
                "burst_remaining": decision.burst_remaining,
                "risk_score": risk_score,
                "z_score": z_score,
                "updated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            }
            scheduler_job_state[job_id] = {
                "last_run_time": run_ts,
                "last_status": "success",
                "last_error": "",
                "last_collect_count": int(risk.get("article_count_window", 0)),
                "last_group_count": int(risk.get("group_count_window", 0)),
                "last_collect_duration_ms": int((time.time() - started) * 1000),
            }
            record_scheduler_log(job_id=job_id, status="success", run_time=run_ts)
            return
        except Exception as exc:  # noqa: BLE001
            last_exc = exc
            logger.exception("risk monitor tick failed: ip_id=%s, attempt=%s/%s", ip_id, i + 1, attempts)
            if i < attempts - 1:
                time.sleep(0.5 * (i + 1))
                continue
    scheduler_job_state[job_id] = {
        "last_run_time": run_ts,
        "last_status": "error",
        "last_error": str(last_exc or "unknown error"),
        "last_collect_count": 0,
        "last_group_count": 0,
        "last_collect_duration_ms": int((time.time() - started) * 1000),
    }
    record_scheduler_log(job_id=job_id, status="error", error_message=str(last_exc or "unknown error"), run_time=run_ts)


def _collect_live_for_ip(ip_id: str, strategy: dict[str, Any] | None = None) -> tuple[pd.DataFrame, int]:
    strategy = strategy or _get_collect_strategy(ip_id)
    queries = (BACKFILL_QUERIES.get(ip_id, []) or [])[: int(strategy.get("queries_per_ip", max(1, LIVE_COLLECT_QUERIES_PER_IP)))]
    if not queries:
        return pd.DataFrame(), 0

    calls = 0
    frames: list[pd.DataFrame] = []
    for q in queries:
        for page in range(int(strategy.get("pages", max(1, LIVE_COLLECT_PAGES)))):
            start = 1 + page * 100
            if start > 1000:
                break
            date_items = search_news(q, display=max(10, min(LIVE_COLLECT_DISPLAY, 100)), start=start, sort="date")
            calls += 1
            if not date_items:
                break
            date_frame = _to_nexon_df(date_items)
            if date_frame.empty:
                continue
            date_filtered = date_frame[
                (date_frame["title_clean"].fillna("") + " " + date_frame["description_clean"].fillna(""))
                .apply(lambda x: _detect_ip_slug_local(str(x)) == ip_id)
            ]
            date_recent = _filter_recent_pubdate_rows(date_filtered, LIVE_COLLECT_MAX_AGE_DAYS)
            if not date_recent.empty:
                frames.append(date_recent)

        if bool(strategy.get("include_sim", LIVE_COLLECT_INCLUDE_SIM)):
            for page in range(int(strategy.get("pages", max(1, LIVE_COLLECT_PAGES)))):
                start = 1 + page * 100
                if start > 1000:
                    break
                sim_items = search_news(
                    q,
                    display=max(10, min(max(10, LIVE_COLLECT_DISPLAY // 2), 100)),
                    start=start,
                    sort="sim",
                )
                calls += 1
                if not sim_items:
                    break
                sim_frame = _to_nexon_df(sim_items)
                if sim_frame.empty:
                    continue
                sim_filtered = sim_frame[
                    (sim_frame["title_clean"].fillna("") + " " + sim_frame["description_clean"].fillna(""))
                    .apply(lambda x: _detect_ip_slug_local(str(x)) == ip_id)
                ]
                sim_recent = _filter_recent_pubdate_rows(sim_filtered, LIVE_COLLECT_MAX_AGE_DAYS)
                if not sim_recent.empty:
                    frames.append(sim_recent)

    if not frames:
        return pd.DataFrame(), calls
    merged = pd.concat(frames, ignore_index=True)
    merged = merged.drop_duplicates(subset=["originallink", "title_clean", "date"], keep="first").reset_index(drop=True)
    return merged, calls


def _run_collect_ip_tick(ip_id: str) -> None:
    job_id = _collect_job_id(ip_id)
    run_ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    started = time.time()
    attempts = 2
    last_exc: Exception | None = None
    strategy = _get_collect_strategy(ip_id)
    for i in range(attempts):
        try:
            logger.info(
                "collect strategy ip_id=%s fallback_active=%s base(queries=%s,pages=%s,include_sim=%s) applied(queries=%s,pages=%s,include_sim=%s) reason=%s",
                ip_id,
                bool(strategy.get("fallback_active", False)),
                int(max(1, LIVE_COLLECT_QUERIES_PER_IP)),
                int(max(1, LIVE_COLLECT_PAGES)),
                bool(LIVE_COLLECT_INCLUDE_SIM),
                int(strategy.get("queries_per_ip", 0)),
                int(strategy.get("pages", 0)),
                bool(strategy.get("include_sim", False)),
                str(strategy.get("fallback_reason", "")),
            )
            df, calls = _collect_live_for_ip(ip_id, strategy=strategy)
            if df.empty:
                zero_streak, zero_alert = _update_collect_zero_streak(ip_id, inserted=0)
                scheduler_job_state[job_id] = {
                    "last_run_time": run_ts,
                    "last_status": "success",
                    "last_error": "",
                    "last_collect_count": 0,
                    "last_group_count": 0,
                    "zero_insert_streak": int(zero_streak),
                    "zero_insert_alert": bool(zero_alert),
                    "collect_strategy": strategy,
                    "last_collect_duration_ms": int((time.time() - started) * 1000),
                }
                record_scheduler_log(
                    job_id=job_id,
                    status="success",
                    run_time=run_ts,
                    error_message=f"calls={calls};inserted=0",
                )
                return

            try:
                df = add_sentiment_column(df)
            except Exception:
                pass

            inserted = int(save_articles(df))
            zero_streak, zero_alert = _update_collect_zero_streak(ip_id, inserted=inserted)
            scheduler_job_state[job_id] = {
                "last_run_time": run_ts,
                "last_status": "success",
                "last_error": "",
                "last_collect_count": inserted,
                "last_group_count": int(len(df)),
                "zero_insert_streak": int(zero_streak),
                "zero_insert_alert": bool(zero_alert),
                "collect_strategy": strategy,
                "last_collect_duration_ms": int((time.time() - started) * 1000),
            }
            record_scheduler_log(
                job_id=job_id,
                status="success",
                run_time=run_ts,
                error_message=f"calls={calls};rows={len(df)};inserted={inserted}",
            )
            return
        except Exception as exc:  # noqa: BLE001
            last_exc = exc
            logger.exception("collect tick failed: ip_id=%s, attempt=%s/%s", ip_id, i + 1, attempts)
            if i < attempts - 1:
                time.sleep(0.5 * (i + 1))
                continue
    scheduler_job_state[job_id] = {
        "last_run_time": run_ts,
        "last_status": "error",
        "last_error": str(last_exc or "unknown error"),
        "last_collect_count": 0,
        "last_group_count": 0,
        "zero_insert_streak": int(collect_zero_insert_streak.get(ip_id, 0)),
        "zero_insert_alert": bool(int(collect_zero_insert_streak.get(ip_id, 0)) >= COLLECT_ZERO_STREAK_WARN_THRESHOLD),
        "collect_strategy": strategy,
        "last_collect_duration_ms": int((time.time() - started) * 1000),
    }
    record_scheduler_log(job_id=job_id, status="error", error_message=str(last_exc or "unknown error"), run_time=run_ts)


def _run_maintenance_cleanup() -> None:
    job_id = "maintenance-cleanup"
    run_ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    started = time.time()
    try:
        delete_cap = CLEANUP_MAX_DELETE_ROWS if CLEANUP_MAX_DELETE_ROWS > 0 else None
        deleted_logs = cleanup_scheduler_logs(
            retain_days=SCHEDULER_LOG_TTL_DAYS,
            max_delete_rows=delete_cap,
            dry_run=CLEANUP_DRY_RUN,
        )
        deleted_tests = cleanup_test_articles(
            retain_hours=TEST_ARTICLE_TTL_HOURS,
            max_delete_rows=delete_cap,
            dry_run=CLEANUP_DRY_RUN,
        )
        deleted_live_articles = cleanup_live_articles(
            retain_days=LIVE_ARTICLE_RETENTION_DAYS,
            max_delete_rows=delete_cap,
            dry_run=CLEANUP_DRY_RUN,
        )
        deleted_risk_rows = cleanup_risk_timeseries(
            retain_days=RISK_TIMESERIES_RETENTION_DAYS,
            max_delete_rows=delete_cap,
            dry_run=CLEANUP_DRY_RUN,
        )
        summary_rows_upserted = upsert_risk_daily_summary()
        cleanup_last_result.update(
            {
                "deleted_scheduler_logs": int(deleted_logs),
                "deleted_test_articles": int(deleted_tests),
                "deleted_live_articles": int(deleted_live_articles),
                "deleted_risk_rows": int(deleted_risk_rows),
                "summary_rows_upserted": int(summary_rows_upserted),
                "dry_run": bool(CLEANUP_DRY_RUN),
                "max_delete_rows": int(delete_cap or 0),
                "updated_at": run_ts,
            }
        )
        scheduler_job_state[job_id] = {
            "last_run_time": run_ts,
            "last_status": "success",
            "last_error": "",
            "last_collect_count": int(deleted_logs + deleted_tests + deleted_live_articles + deleted_risk_rows),
            "last_group_count": int(summary_rows_upserted),
            "deleted_live_articles": int(deleted_live_articles),
            "deleted_risk_rows": int(deleted_risk_rows),
            "summary_rows_upserted": int(summary_rows_upserted),
            "last_collect_duration_ms": int((time.time() - started) * 1000),
        }
        record_scheduler_log(
            job_id=job_id,
            status="success",
            run_time=run_ts,
            error_message=(
                f"deleted_logs={deleted_logs},deleted_tests={deleted_tests},"
                f"deleted_live_articles={deleted_live_articles},deleted_risk_rows={deleted_risk_rows},"
                f"summary_rows_upserted={summary_rows_upserted},dry_run={int(CLEANUP_DRY_RUN)},"
                f"max_delete_rows={int(delete_cap or 0)}"
            ),
        )
    except Exception as exc:  # noqa: BLE001
        logger.exception("maintenance cleanup failed")
        scheduler_job_state[job_id] = {
            "last_run_time": run_ts,
            "last_status": "error",
            "last_error": str(exc),
            "last_collect_count": 0,
            "last_group_count": 0,
            "last_collect_duration_ms": int((time.time() - started) * 1000),
        }
        record_scheduler_log(job_id=job_id, status="error", run_time=run_ts, error_message=str(exc))


def _clean_html_local(text: str) -> str:
    t = re.sub(r"<[^>]+>", "", text or "")
    t = re.sub(r"&[a-zA-Z]+;", " ", t)
    return " ".join(t.split())


def _detect_ip_slug_local(text: str) -> str:
    low = (text or "").lower()
    for _, meta in IP_RULES.items():
        slug = str(meta.get("slug", ""))
        if slug in {"", "all"}:
            continue
        keywords = meta.get("keywords", []) or []
        if any(str(k).lower() in low for k in keywords):
            return slug
    return "other"


def _to_nexon_df(items: list[dict[str, Any]]) -> pd.DataFrame:
    if not items:
        return pd.DataFrame()
    rows = []
    for it in items:
        title = _clean_html_local(str(it.get("title", "")))
        desc = _clean_html_local(str(it.get("description", "")))
        pub = pd.to_datetime(str(it.get("pubDate", "")), errors="coerce")
        if pd.isna(pub):
            continue
        dt = pub.tz_convert(None) if getattr(pub, "tzinfo", None) is not None else pub
        rows.append(
            {
                "company": "넥슨",
                "title_clean": title,
                "description_clean": desc,
                "originallink": str(it.get("originallink", "")),
                "link": str(it.get("link", "")),
                "pubDate_parsed": dt,
                "date": dt.strftime("%Y-%m-%d"),
            }
        )
    return pd.DataFrame(rows)


def _filter_recent_pubdate_rows(df: pd.DataFrame, max_age_days: int) -> pd.DataFrame:
    if df.empty or "pubDate_parsed" not in df.columns:
        return df
    parsed = pd.to_datetime(df["pubDate_parsed"], errors="coerce", utc=True).dt.tz_convert(None)
    cutoff = datetime.now(UTC).replace(tzinfo=None) - timedelta(days=max(1, int(max_age_days)))
    return df.loc[parsed >= cutoff].copy()


def _collect_backfill_for_ip(ip_id: str) -> tuple[pd.DataFrame, int]:
    queries = BACKFILL_QUERIES.get(ip_id, [])
    if not queries:
        return pd.DataFrame(), 0
    calls = 0
    frames: list[pd.DataFrame] = []
    for q in queries:
        for sort in ("date", "sim"):
            items = search_news(q, display=max(10, min(BACKFILL_DISPLAY, 100)), start=1, sort=sort)
            calls += 1
            if not items:
                continue
            frame = _to_nexon_df(items)
            if frame.empty:
                continue
            frame = frame[
                (frame["title_clean"].fillna("") + " " + frame["description_clean"].fillna(""))
                .apply(lambda x: _detect_ip_slug_local(str(x)) == ip_id)
            ]
            frame_recent = _filter_recent_pubdate_rows(frame, LIVE_COLLECT_MAX_AGE_DAYS)
            if not frame_recent.empty:
                frames.append(frame_recent)
    if not frames:
        return pd.DataFrame(), calls
    merged = pd.concat(frames, ignore_index=True)
    merged = merged.drop_duplicates(subset=["originallink", "title_clean", "date"], keep="first").reset_index(drop=True)
    return merged, calls


def _run_backfill_tick() -> None:
    job_id = "backfill-collector"
    run_ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    started = time.time()
    try:
        ip_counts: list[tuple[str, int]] = []
        for ip_id in MONITOR_IPS:
            risk = get_live_risk_with_options(ip=ip_id, window_hours=24, include_test=False)
            ip_counts.append((ip_id, int(risk.get("article_count_window", 0))))
        ip_counts.sort(key=lambda x: x[1])
        target_ips = [ip for ip, cnt in ip_counts if cnt < BACKFILL_LOW_COUNT_THRESHOLD][: max(1, BACKFILL_MAX_IPS_PER_RUN)]
        total_calls = 0
        total_inserted = 0
        touched: list[str] = []
        for ip_id in target_ips:
            df, calls = _collect_backfill_for_ip(ip_id)
            total_calls += calls
            if df.empty:
                continue
            try:
                df = add_sentiment_column(df)
            except Exception:
                pass
            inserted = save_articles(df)
            total_inserted += int(inserted)
            if inserted > 0:
                touched.append(ip_id)
        scheduler_job_state[job_id] = {
            "last_run_time": run_ts,
            "last_status": "success",
            "last_error": "",
            "last_collect_count": int(total_inserted),
            "last_group_count": int(len(touched)),
            "last_collect_duration_ms": int((time.time() - started) * 1000),
        }
        record_scheduler_log(
            job_id=job_id,
            status="success",
            run_time=run_ts,
            error_message=f"targets={','.join(target_ips) or '-'};calls={total_calls};inserted={total_inserted}",
        )
    except Exception as exc:  # noqa: BLE001
        logger.exception("backfill tick failed")
        scheduler_job_state[job_id] = {
            "last_run_time": run_ts,
            "last_status": "error",
            "last_error": str(exc),
            "last_collect_count": 0,
            "last_group_count": 0,
            "last_collect_duration_ms": int((time.time() - started) * 1000),
        }
        record_scheduler_log(job_id=job_id, status="error", run_time=run_ts, error_message=str(exc))


def _run_competitor_collect_tick() -> None:
    job_id = "collect-competitors"
    run_ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    started = time.time()
    try:
        companies = COMPETITOR_AUTO_COMPANIES or list(COMPANIES.keys())
        frames: list[pd.DataFrame] = []
        for company in companies:
            part = fetch_company_news_compare(company=company, total=max(10, min(COMPETITOR_COLLECT_ARTICLES, 100)))
            part = _filter_recent_pubdate_rows(part, LIVE_COLLECT_MAX_AGE_DAYS)
            if not part.empty:
                frames.append(part)

        if not frames:
            scheduler_job_state[job_id] = {
                "last_run_time": run_ts,
                "last_status": "success",
                "last_error": "",
                "last_collect_count": 0,
                "last_group_count": 0,
                "last_collect_duration_ms": int((time.time() - started) * 1000),
            }
            record_scheduler_log(job_id=job_id, status="success", run_time=run_ts, error_message="rows=0;inserted=0")
            return

        merged = pd.concat(frames, ignore_index=True)
        merged = merged.drop_duplicates(subset=["company", "originallink", "title_clean"], keep="first").reset_index(
            drop=True
        )
        try:
            merged = add_sentiment_column(merged)
        except Exception:
            pass

        inserted = int(save_articles(merged))
        scheduler_job_state[job_id] = {
            "last_run_time": run_ts,
            "last_status": "success",
            "last_error": "",
            "last_collect_count": inserted,
            "last_group_count": int(len(companies)),
            "last_collect_duration_ms": int((time.time() - started) * 1000),
        }
        record_scheduler_log(
            job_id=job_id,
            status="success",
            run_time=run_ts,
            error_message=f"companies={','.join(companies)};rows={len(merged)};inserted={inserted}",
        )
    except Exception as exc:  # noqa: BLE001
        logger.exception("competitor collect tick failed")
        scheduler_job_state[job_id] = {
            "last_run_time": run_ts,
            "last_status": "error",
            "last_error": str(exc),
            "last_collect_count": 0,
            "last_group_count": 0,
            "last_collect_duration_ms": int((time.time() - started) * 1000),
        }
        record_scheduler_log(job_id=job_id, status="error", run_time=run_ts, error_message=str(exc))


def _start_monitoring_scheduler() -> None:
    if scheduler.running:
        logger.info("scheduler already running")
        return
    for ip_id in MONITOR_IPS:
        scheduler.add_job(
            _run_collect_ip_tick,
            trigger=IntervalTrigger(seconds=LIVE_COLLECT_INTERVAL_SECONDS),
            id=_collect_job_id(ip_id),
            max_instances=1,
            coalesce=True,
            replace_existing=True,
            kwargs={"ip_id": ip_id},
        )
    for ip_id in MONITOR_IPS:
        scheduler.add_job(
            _run_monitor_tick,
            trigger=IntervalTrigger(seconds=BASE_INTERVAL_SECONDS),
            id=_job_id(ip_id),
            max_instances=1,
            coalesce=True,
            replace_existing=True,
            kwargs={"ip_id": ip_id},
        )
    scheduler.add_job(
        _run_maintenance_cleanup,
        trigger=CronTrigger(hour=4, minute=0),
        id="maintenance-cleanup",
        max_instances=1,
        coalesce=True,
        replace_existing=True,
    )
    scheduler.add_job(
        _run_backfill_tick,
        trigger=IntervalTrigger(seconds=BACKFILL_INTERVAL_SECONDS),
        id="backfill-collector",
        max_instances=1,
        coalesce=True,
        replace_existing=True,
    )
    if ENABLE_COMPETITOR_AUTO_COLLECT:
        scheduler.add_job(
            _run_competitor_collect_tick,
            trigger=IntervalTrigger(seconds=COMPETITOR_COLLECT_INTERVAL_SECONDS),
            id="collect-competitors",
            max_instances=1,
            coalesce=True,
            replace_existing=True,
        )
    scheduler.start()
    logger.info("scheduler started: jobs=%s", [job.id for job in scheduler.get_jobs()])
    for ip_id in MONITOR_IPS:
        _run_collect_ip_tick(ip_id)
    for ip_id in MONITOR_IPS:
        _run_monitor_tick(ip_id)
    _run_backfill_tick()
    if ENABLE_COMPETITOR_AUTO_COLLECT:
        _run_competitor_collect_tick()


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


def _compare_sigmoid(x: float) -> float:
    return float(1.0 / (1.0 + math.exp(-x)))


def _compare_outlet_weight(outlet: str) -> float:
    host = outlet.lower().strip()
    if not host:
        return 0.5
    if host in OUTLET_TIER1:
        return 1.0
    if host in OUTLET_GAME_MEDIA:
        return 0.7
    return 0.5


def _build_payload(df: pd.DataFrame, selected: list[str]) -> dict:
    low_sample_threshold = 5
    company_counts_raw = df.groupby("company").size().to_dict()
    company_counts = {company: int(company_counts_raw.get(company, 0)) for company in selected}
    total = int(len(df))

    trend = get_daily_counts(df)
    trend_rows = []
    if not trend.empty:
        trend = trend.reset_index()
        trend_rows = trend.to_dict(orient="records")

    # Compare trend metrics are generated on backend so frontend can render Risk/Heat
    # without any client-side synthetic calculation.
    trend_dates = [str(row.get("date", "")) for row in trend_rows if str(row.get("date", ""))]
    per_day_metrics: list[dict[str, Any]] = []
    if not df.empty and trend_dates:
        metric_work = df[["company", "date", "sentiment", "title_clean", "description_clean", "originallink"]].copy()
        metric_work["date"] = metric_work["date"].astype(str)
        metric_work["sentiment"] = metric_work["sentiment"].apply(
            lambda val: val if str(val or "") in SENTIMENT_BUCKETS else "중립"
        )
        metric_work["text"] = (
            metric_work["title_clean"].fillna("").astype(str)
            + " "
            + metric_work["description_clean"].fillna("").astype(str)
        ).str.lower()
        metric_work["originallink"] = metric_work["originallink"].fillna("").astype(str)
        metric_work["outlet_host"] = metric_work["originallink"].apply(
            lambda u: (urlparse(u).hostname or "").lower().strip()
        )
        day_counts = (
            metric_work.groupby(["company", "date"]).size().reset_index(name="count")
        )
        day_negative = (
            metric_work[metric_work["sentiment"] == "부정"]
            .groupby(["company", "date"])
            .size()
            .reset_index(name="negative_count")
        )
        count_lookup = {
            (str(row["company"]), str(row["date"])): int(row["count"] or 0)
            for _, row in day_counts.iterrows()
        }
        negative_lookup = {
            (str(row["company"]), str(row["date"])): int(row["negative_count"] or 0)
            for _, row in day_negative.iterrows()
        }
        max_count_by_company = {}
        for company in selected:
            max_count_by_company[company] = max(
                [count_lookup.get((company, day), 0) for day in trend_dates] or [0]
            )

        for company in selected:
            company_max = int(max_count_by_company.get(company, 0))
            company_day_counts = [count_lookup.get((company, day), 0) for day in trend_dates]
            baseline_mean = float(sum(company_day_counts) / max(len(company_day_counts), 1))
            baseline_std = float(pd.Series(company_day_counts).std(ddof=0)) if company_day_counts else 0.0
            for day in trend_dates:
                day_df = metric_work.loc[(metric_work["company"] == company) & (metric_work["date"] == day)]
                count = int(count_lookup.get((company, day), 0))
                negative_count = int(negative_lookup.get((company, day), 0))
                negative_ratio = round((negative_count / max(count, 1)) * 100, 1) if count > 0 else 0.0
                negative_ratio_window = float(negative_count / max(count, 1)) if count > 0 else 0.0

                z_score = (float(count) - baseline_mean) / max(baseline_std, 1.0)
                v_heat = float(_compare_sigmoid(z_score))
                if company_max > 0:
                    v_heat = max(v_heat, float(count / max(company_max, 1)))
                v_risk = float(v_heat * negative_ratio_window)

                theme_counter_heat: dict[str, int] = {}
                theme_counter_risk: dict[str, int] = {}
                for text in day_df["text"].tolist():
                    for theme, keywords in RISK_THEME_RULES.items():
                        if any(kw.lower() in text for kw in keywords):
                            theme_counter_heat[theme] = int(theme_counter_heat.get(theme, 0)) + 1
                            if theme in THEME_WEIGHTS_RISK:
                                theme_counter_risk[theme] = int(theme_counter_risk.get(theme, 0)) + 1
                            break

                t_heat = 0.0
                t_risk = 0.0
                if count > 0:
                    for theme, cnt in theme_counter_heat.items():
                        share = float(cnt) / float(count)
                        t_heat += share * float(THEME_WEIGHTS_HEAT.get(theme, 0.4))
                    for theme, cnt in theme_counter_risk.items():
                        share = float(cnt) / float(count)
                        t_risk += share * float(THEME_WEIGHTS_RISK.get(theme, 0.0))

                m_t = 0.0
                if count > 0:
                    outlet_weights = [_compare_outlet_weight(str(host)) for host in day_df["outlet_host"].tolist()]
                    m_t = float(sum(outlet_weights) / max(len(outlet_weights), 1))

                s_t = float(negative_ratio_window)
                raw_issue_heat = 100.0 * (0.45 * v_heat + 0.35 * t_heat + 0.20 * m_t)
                raw_risk = 100.0 * (0.50 * s_t + 0.25 * v_risk + 0.15 * t_risk + 0.10 * (m_t * negative_ratio_window))
                risk_score = round(float(max(0.0, min(100.0, raw_risk))), 1)
                heat_score = round(float(max(0.0, min(100.0, raw_issue_heat))), 1)
                quality_flag = "LOW_SAMPLE" if count < low_sample_threshold else "OK"
                per_day_metrics.append(
                    {
                        "company": company,
                        "date": day,
                        "count": count,
                        "negative_count": negative_count,
                        "negative_ratio": negative_ratio,
                        "risk_score": risk_score,
                        "heat_score": heat_score,
                        "sample_size": count,
                        "quality_flag": quality_flag,
                    }
                )

    sentiment_rows = []
    sentiment_map: dict[tuple[str, str], int] = {}
    if not df.empty:
        sentiment_work = df[["company", "sentiment"]].copy()
        sentiment_work["sentiment"] = sentiment_work["sentiment"].apply(
            lambda val: val if str(val or "") in SENTIMENT_BUCKETS else "중립"
        )
        sentiment_counts = (
            sentiment_work.groupby(["company", "sentiment"]).size().reset_index(name="count")
        )
        for _, row in sentiment_counts.iterrows():
            key = (str(row.get("company", "")), str(row.get("sentiment", "")))
            sentiment_map[key] = int(row.get("count", 0) or 0)
    for company in selected:
        company_total = int(company_counts.get(company, 0))
        for sentiment_label in SENTIMENT_BUCKETS:
            count = int(sentiment_map.get((company, sentiment_label), 0))
            ratio = round(count / max(company_total, 1) * 100, 1) if company_total > 0 else 0.0
            sentiment_rows.append(
                {
                    "company": company,
                    "sentiment": sentiment_label,
                    "count": count,
                    "total": company_total,
                    "ratio": ratio,
                }
            )
    keyword_map = {company: get_keyword_data(df, company=company, top_n=20) for company in selected}

    latest = (
        df.sort_values("pubDate_parsed", ascending=False)
        .loc[:, ["company", "title_clean", "sentiment", "date", "originallink"]]
        .rename(columns={"title_clean": "title", "originallink": "url"})
        .head(200)
    )
    if not latest.empty:
        latest["sentiment"] = latest["sentiment"].apply(
            lambda val: val if str(val or "") in SENTIMENT_BUCKETS else "중립"
        )

    return {
        "meta": {
            "model_id": get_model_id(),
            "generated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "total_articles": total,
            "selected_companies": selected,
            "risk_formula_version": f"compare-{RISK_FORMULA_VERSION}",
            "heat_formula_version": f"compare-{RISK_FORMULA_VERSION}",
            "low_sample_threshold": low_sample_threshold,
        },
        "company_counts": company_counts,
        "trend": trend_rows,
        "trend_metrics": per_day_metrics,
        "sentiment_summary": sentiment_rows,
        "keywords": keyword_map,
        "latest_articles": _to_records(latest),
        "insights": _build_interview_insights(df, selected),
    }


@app.get("/health")
def health() -> dict:
    global _last_zero_alert_signature
    db_path = get_active_db_path()
    db_name = db_path.name.lower()
    mode = "backtest" if "backtest" in db_name else "live"
    counts = get_observability_counts()
    zero_alert_ips = [
        ip_id
        for ip_id, streak in collect_zero_insert_streak.items()
        if int(streak) >= COLLECT_ZERO_STREAK_WARN_THRESHOLD
    ]
    zero_alert_signature = tuple(sorted(zero_alert_ips))
    if zero_alert_signature:
        max_streak = max(int(collect_zero_insert_streak.get(ip_id, 0)) for ip_id in zero_alert_signature)
        logger.warning(
            "health zero_insert_streak_alert threshold=%s max_streak=%s alert_ips=%s",
            COLLECT_ZERO_STREAK_WARN_THRESHOLD,
            max_streak,
            ",".join(zero_alert_signature),
        )
    if zero_alert_signature != _last_zero_alert_signature:
        logger.info(
            "health zero_insert_streak_state_changed threshold=%s previous=%s current=%s",
            COLLECT_ZERO_STREAK_WARN_THRESHOLD,
            ",".join(_last_zero_alert_signature),
            ",".join(zero_alert_signature),
        )
        _last_zero_alert_signature = zero_alert_signature
    return {
        "ok": True,
        "pr_db_path": str(db_path),
        "db_path": str(db_path),
        "db_file_name": db_path.name,
        "mode": mode,
        "scheduler_running": bool(scheduler.running),
        "scheduler_job_count": len(scheduler.get_jobs()) if scheduler.running else 0,
        "scheduler_log_fallback_count": get_scheduler_log_fallback_count(),
        "compare_live_rate_limit_per_min": int(COMPARE_LIVE_RATE_LIMIT_PER_MIN),
        "compare_live_cache_ttl_seconds": int(COMPARE_LIVE_CACHE_TTL_SECONDS),
        "compare_live_cache_entries": int(len(compare_live_cache)),
        "compare_live_cache_hits": int(compare_live_metrics.get("cache_hits", 0)),
        "compare_live_cache_misses": int(compare_live_metrics.get("cache_misses", 0)),
        "compare_live_rate_limited": int(compare_live_metrics.get("rate_limited", 0)),
        "live_article_retention_days": int(LIVE_ARTICLE_RETENTION_DAYS),
        "risk_timeseries_retention_days": int(RISK_TIMESERIES_RETENTION_DAYS),
        "cleanup_dry_run": bool(CLEANUP_DRY_RUN),
        "cleanup_max_delete_rows": int(CLEANUP_MAX_DELETE_ROWS),
        "deleted_live_articles": int(cleanup_last_result.get("deleted_live_articles", 0)),
        "deleted_risk_rows": int(cleanup_last_result.get("deleted_risk_rows", 0)),
        "summary_rows_upserted": int(cleanup_last_result.get("summary_rows_upserted", 0)),
        "cleanup_last_updated_at": str(cleanup_last_result.get("updated_at", "")),
        "collect_zero_streak_threshold": int(COLLECT_ZERO_STREAK_WARN_THRESHOLD),
        "collect_zero_insert_streaks": {ip_id: int(streak) for ip_id, streak in collect_zero_insert_streak.items()},
        "collect_zero_alert_ips": zero_alert_ips,
        "cors_allow_origins": cors_allow_origins,
        "cors_validation_status": cors_validation_status,
        **counts,
    }


@app.get("/api/health")
def api_health() -> dict:
    return health()


@app.get("/api/backtest-health")
def backtest_health() -> dict:
    db_path = Path(get_backtest_db_path())
    db_name = db_path.name.lower()
    mode = "backtest" if "backtest" in db_name else "live"
    return {
        "ok": True,
        "db_path": str(db_path),
        "db_file_name": db_path.name,
        "mode": mode,
    }


@app.get("/api/config")
def config() -> dict:
    return {
        "companies": COMPANIES,
        "model_id": get_model_id(),
        "limits": {"articles_per_company_min": 10, "articles_per_company_max": 100},
        "features": {
            "manual_collection_enabled": ENABLE_MANUAL_COLLECTION,
            "competitor_compare_disabled": DISABLE_COMPETITOR_COMPARE,
            "competitor_auto_collect_enabled": ENABLE_COMPETITOR_AUTO_COLLECT,
        },
    }


@app.get("/api/articles")
def articles(
    company: str | None = Query(default=None),
    sentiment: str | None = Query(default=None),
    limit: int = Query(default=50, ge=10, le=200),
    offset: int = Query(default=0, ge=0),
) -> dict:
    return get_articles(company=company, sentiment=sentiment, limit=limit, offset=offset)


@app.get("/api/nexon-articles")
def nexon_articles(
    ip: str = Query(default="all"),
    limit: int = Query(default=20, ge=10, le=100),
    offset: int = Query(default=0, ge=0),
) -> dict:
    try:
        return get_nexon_articles(ip=ip, limit=limit, offset=offset)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get("/api/nexon-dashboard")
def nexon_dashboard(
    date_from: str = Query(default="2024-01-01"),
    date_to: str = Query(default="2026-12-31"),
) -> dict:
    try:
        start = datetime.strptime(date_from, "%Y-%m-%d")
        end = datetime.strptime(date_to, "%Y-%m-%d")
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="date_from/date_to 형식은 YYYY-MM-DD여야 합니다.") from exc

    if start > end:
        raise HTTPException(status_code=400, detail="date_from은 date_to보다 이전이어야 합니다.")

    return get_nexon_dashboard(date_from=date_from, date_to=date_to)


@app.get("/api/project-snapshot")
def project_snapshot(
    date_from: str = Query(default="2024-01-01"),
    date_to: str = Query(default="2026-12-31"),
    ips: str = Query(default=",".join(CORE_IPS)),
) -> dict:
    try:
        start = datetime.strptime(date_from, "%Y-%m-%d")
        end = datetime.strptime(date_to, "%Y-%m-%d")
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="date_from/date_to 형식은 YYYY-MM-DD여야 합니다.") from exc

    if start > end:
        raise HTTPException(status_code=400, detail="date_from은 date_to보다 이전이어야 합니다.")

    ip_list = [x.strip().lower() for x in ips.split(",") if x.strip()]
    try:
        return build_project_snapshot(date_from=date_from, date_to=date_to, ips=ip_list or CORE_IPS)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get("/api/risk-ips")
def risk_ips() -> dict:
    return {"items": get_risk_ip_catalog()}


@app.get("/api/risk-dashboard")
def risk_dashboard(
    ip: str = Query(default="all"),
    date_from: str | None = Query(default=None),
    date_to: str | None = Query(default=None),
) -> dict:
    resolved_date_to = date_to or datetime.now().strftime("%Y-%m-%d")
    resolved_date_from = date_from or (
        datetime.now() - timedelta(days=RISK_DASHBOARD_DEFAULT_LOOKBACK_DAYS)
    ).strftime("%Y-%m-%d")
    try:
        start = datetime.strptime(resolved_date_from, "%Y-%m-%d")
        end = datetime.strptime(resolved_date_to, "%Y-%m-%d")
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="date_from/date_to 형식은 YYYY-MM-DD여야 합니다.") from exc

    if start > end:
        raise HTTPException(status_code=400, detail="date_from은 date_to보다 이전이어야 합니다.")

    try:
        return get_risk_dashboard(date_from=resolved_date_from, date_to=resolved_date_to, ip=ip)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get("/api/risk-score")
def risk_score(
    ip: str = Query(default="all"),
    window_hours: int = Query(default=24, ge=1, le=72),
    include_test: bool = Query(default=False),
) -> dict:
    try:
        return get_live_risk_with_options(ip=ip, window_hours=window_hours, include_test=bool(include_test))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get("/api/risk-timeseries")
def risk_timeseries(
    ip: str = Query(default="all"),
    hours: int = Query(default=24 * 7, ge=24, le=24 * 30),
    limit: int = Query(default=600, ge=50, le=2000),
) -> dict:
    try:
        return get_risk_timeseries(ip_id=ip, hours=hours, limit=limit)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get("/api/burst-status")
def burst_status(ip: str = Query(default="")) -> dict:
    ip_val = (ip or "").strip().lower()
    if ip_val and ip_val not in burst_managers:
        raise HTTPException(status_code=400, detail="지원하지 않는 IP입니다.")

    if ip_val:
        return {
            "items": [
                {
                    "ip_id": ip_val,
                    **last_burst_state.get(
                        ip_val,
                        {"mode": "base", "interval_seconds": BASE_INTERVAL_SECONDS, "burst_remaining": None},
                    ),
                }
            ]
        }

    items = []
    for key in MONITOR_IPS:
        state = last_burst_state.get(
            key,
            {"mode": "base", "interval_seconds": BASE_INTERVAL_SECONDS, "burst_remaining": None},
        )
        items.append({"ip_id": key, **state})
    return {"items": items}


@app.get("/api/burst-events")
def burst_events(ip: str = Query(default=""), limit: int = Query(default=30, ge=1, le=200)) -> dict:
    ip_val = (ip or "").strip().lower()
    if ip_val and ip_val not in burst_managers:
        raise HTTPException(status_code=400, detail="지원하지 않는 IP입니다.")
    return {"items": get_recent_burst_events(ip_name=ip_val, limit=limit)}


@app.get("/api/scheduler-status")
def scheduler_status() -> dict:
    jobs = []
    aps_jobs = {job.id: job for job in scheduler.get_jobs()} if scheduler.running else {}
    job_ids = (
        [_collect_job_id(ip_id) for ip_id in MONITOR_IPS]
        + [_job_id(ip_id) for ip_id in MONITOR_IPS]
        + ["backfill-collector", "maintenance-cleanup"]
        + (["collect-competitors"] if ENABLE_COMPETITOR_AUTO_COLLECT else [])
    )
    for job_id in job_ids:
        ip_id = job_id.replace("risk-monitor-", "").replace("collect-news-", "")
        is_collect_job = job_id.startswith("collect-news-")
        state = scheduler_job_state.get(job_id, {})
        if not state:
            latest = get_latest_scheduler_log(job_id)
            if latest:
                state = {
                    "last_run_time": latest.get("run_time"),
                    "last_status": latest.get("status"),
                    "last_error": latest.get("error_message", ""),
                }
        job = aps_jobs.get(job_id)
        jobs.append(
            {
                "id": job_id,
                "ip_id": ip_id if (job_id.startswith("risk-monitor-") or job_id.startswith("collect-news-")) else "system",
                "next_run_time": (
                    job.next_run_time.astimezone().strftime("%Y-%m-%d %H:%M:%S")
                    if job and job.next_run_time
                    else None
                ),
                "last_run_time": state.get("last_run_time"),
                "last_status": state.get("last_status", "unknown"),
                "error_message": state.get("last_error", ""),
                "last_error": state.get("last_error", ""),
                "last_collect_count": int(state.get("last_collect_count", 0) or 0),
                "last_group_count": int(state.get("last_group_count", 0) or 0),
                "last_collect_duration_ms": int(state.get("last_collect_duration_ms", 0) or 0),
                "zero_insert_streak": int(
                    state.get("zero_insert_streak", collect_zero_insert_streak.get(ip_id, 0) if is_collect_job else 0) or 0
                ),
                "zero_insert_alert": bool(
                    state.get(
                        "zero_insert_alert",
                        int(collect_zero_insert_streak.get(ip_id, 0)) >= COLLECT_ZERO_STREAK_WARN_THRESHOLD if is_collect_job else False,
                    )
                ),
                "collect_strategy": state.get("collect_strategy", _get_collect_strategy(ip_id) if is_collect_job else None),
            }
        )
    return {
        "running": bool(scheduler.running),
        "job_count": len(jobs),
        "compare_live_rate_limit_per_min": int(COMPARE_LIVE_RATE_LIMIT_PER_MIN),
        "compare_live_cache_ttl_seconds": int(COMPARE_LIVE_CACHE_TTL_SECONDS),
        "jobs": jobs,
    }


@app.post("/api/debug/force-burst")
def debug_force_burst(
    ip: str = Query(default="maplestory"),
    multiplier: int = Query(default=5, ge=1, le=20),
) -> dict:
    if not ENABLE_DEBUG_ENDPOINTS:
        raise HTTPException(status_code=403, detail="debug endpoints are disabled")

    ip_id = (ip or "").strip().lower()
    if ip_id not in burst_managers:
        raise HTTPException(status_code=400, detail="지원하지 않는 IP입니다.")

    try:
        inserted = force_burst_test_articles(ip=ip_id, multiplier=multiplier)
        risk = get_live_risk_with_options(ip=ip_id, window_hours=24, include_test=True)
        risk_score = float(risk.get("risk_score", 0.0))
        z_score = float(risk.get("z_score", 0.0))
        history_30m = get_recent_risk_scores(ip_id=ip_id, minutes=30)
        sustained_low = len(history_30m) >= 6 and all(v < 55.0 for v in history_30m[-6:])
        manager = burst_managers[ip_id]
        decision = manager.evaluate(
            current_risk=risk_score,
            is_volume_spike=(z_score >= 2.0),
            sustained_low_30m=sustained_low,
        )
        if decision.changed:
            if scheduler.running:
                scheduler.reschedule_job(
                    _job_id(ip_id),
                    trigger=IntervalTrigger(seconds=int(decision.interval_seconds)),
                )
            record_burst_event(
                ip_name=ip_id,
                event_type=str(decision.event_type or "unknown"),
                trigger_reason=str(decision.trigger_reason or "unknown"),
                risk_at_event=risk_score,
            )
        last_burst_state[ip_id] = {
            "mode": decision.mode,
            "interval_seconds": int(decision.interval_seconds),
            "burst_remaining": decision.burst_remaining,
            "risk_score": risk_score,
            "z_score": z_score,
            "updated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        }
        burst = last_burst_state.get(
            ip_id,
            {"mode": "base", "interval_seconds": BASE_INTERVAL_SECONDS, "burst_remaining": None},
        )
        events = get_recent_burst_events(ip_name=ip_id, limit=5)
        return {"inserted": inserted, "risk": risk, "burst": {"ip_id": ip_id, **burst}, "recent_events": events}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get("/api/ip-clusters")
def ip_clusters(
    ip: str = Query(default="maplestory"),
    date_from: str = Query(default="2024-01-01"),
    date_to: str = Query(default="2026-12-31"),
    limit: int = Query(default=6, ge=3, le=12),
) -> dict:
    try:
        start = datetime.strptime(date_from, "%Y-%m-%d")
        end = datetime.strptime(date_to, "%Y-%m-%d")
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="date_from/date_to 형식은 YYYY-MM-DD여야 합니다.") from exc

    if start > end:
        raise HTTPException(status_code=400, detail="date_from은 date_to보다 이전이어야 합니다.")

    try:
        return get_ip_clusters(ip=ip, date_from=date_from, date_to=date_to, limit=limit)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get("/api/backtest")
def backtest(
    ip: str = Query(default="maplestory"),
    date_from: str = Query(default="2025-11-01"),
    date_to: str = Query(default="2026-02-10"),
    window_hours: int = Query(default=24, ge=1, le=72),
    step_hours: int = Query(default=1, ge=1, le=24),
    weight_s: float = Query(default=0.45, ge=0.0, le=1.0),
    weight_v: float = Query(default=0.25, ge=0.0, le=1.0),
    weight_t: float = Query(default=0.20, ge=0.0, le=1.0),
    weight_m: float = Query(default=0.10, ge=0.0, le=1.0),
) -> dict:
    try:
        datetime.strptime(date_from, "%Y-%m-%d")
        datetime.strptime(date_to, "%Y-%m-%d")
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="date_from/date_to 형식은 YYYY-MM-DD여야 합니다.") from exc

    weights = {"S": float(weight_s), "V": float(weight_v), "T": float(weight_t), "M": float(weight_m)}
    if sum(weights.values()) <= 0:
        raise HTTPException(status_code=400, detail="가중치 합은 0보다 커야 합니다.")

    try:
        return run_backtest(
            ip_name=ip,
            date_from=date_from,
            date_to=date_to,
            window_hours=window_hours,
            step_hours=step_hours,
            weights=weights,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get("/api/compare-live")
def compare_live(
    request: Request,
    companies: str = Query(default="넥슨,NC소프트,넷마블,크래프톤"),
    window_hours: int = Query(default=24, ge=1, le=168),
    limit: int = Query(default=40, ge=10, le=100),
) -> dict:
    selected = _parse_companies(companies)
    if not selected:
        raise HTTPException(status_code=400, detail="최소 1개 이상의 유효한 회사를 선택해 주세요.")

    client_ip = _compare_live_client_ip(request)
    retry_after = _check_compare_live_rate_limit(client_ip)
    if retry_after > 0:
        raise HTTPException(
            status_code=429,
            detail={"message": "요청이 너무 많습니다. 잠시 후 다시 시도해주세요.", "retry_after": int(retry_after)},
            headers={"Retry-After": str(int(retry_after))},
        )

    key = _compare_live_cache_key(selected, window_hours=window_hours, limit=limit)
    now_ts = time.time()
    with compare_live_cache_lock:
        cached = compare_live_cache.get(key)
        if cached and float(cached.get("expires_at", 0)) > now_ts:
            _increment_compare_live_metric("cache_hits")
            logger.info("compare_live cache hit key=%s", key)
            return _with_compare_live_meta(dict(cached.get("payload") or {}), cache_hit=True, cache_fallback=False)

    _increment_compare_live_metric("cache_misses")
    logger.info("compare_live cache miss key=%s", key)
    try:
        payload = _build_compare_live_payload(selected=selected, limit=limit, window_hours=window_hours)
        payload = _with_compare_live_meta(payload, cache_hit=False, cache_fallback=False)
        with compare_live_cache_lock:
            compare_live_cache[key] = {
                "payload": payload,
                "expires_at": now_ts + max(1, int(COMPARE_LIVE_CACHE_TTL_SECONDS)),
                "last_success_payload": payload,
                "last_success_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            }
        return payload
    except Exception as exc:  # noqa: BLE001
        logger.exception("compare_live fetch failed key=%s", key)
        with compare_live_cache_lock:
            cached = compare_live_cache.get(key)
            fallback = dict(cached.get("last_success_payload") or {}) if cached else {}
        if fallback:
            _increment_compare_live_metric("cache_fallback_hits")
            logger.warning("compare_live fallback cache used key=%s", key)
            return _with_compare_live_meta(fallback, cache_hit=False, cache_fallback=True)
        raise HTTPException(status_code=502, detail=get_last_api_error() or f"비교 라이브 조회 실패: {exc}") from exc


@app.post("/api/analyze")
def analyze(req: AnalyzeRequest) -> dict:
    if APP_ENV == "prod":
        raise HTTPException(status_code=403, detail="운영 환경에서는 /api/compare-live 조회 전용 API만 허용됩니다.")
    if not ENABLE_MANUAL_COLLECTION:
        raise HTTPException(status_code=403, detail="수동 수집 API는 비활성화되어 있습니다.")

    if DISABLE_COMPETITOR_COMPARE:
        raise HTTPException(status_code=403, detail="경쟁사 비교 수집 기능은 현재 비활성화되어 있습니다.")

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
    if not ENABLE_MANUAL_COLLECTION:
        raise HTTPException(status_code=403, detail="수동 수집 API는 비활성화되어 있습니다.")

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
