from __future__ import annotations

import hashlib
import math
import os
import re
import sqlite3
from collections import Counter
from difflib import SequenceMatcher
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

import pandas as pd
from utils.sentiment import analyze_sentiment_rule_v1

ROOT_DIR = Path(__file__).resolve().parents[1]
DEFAULT_DB_PATH = ROOT_DIR / "backend" / "data" / "articles.db"
RISK_THEME_RULES: dict[str, list[str]] = {
    "확률형/BM": ["확률", "확률형", "가챠", "과금", "bm", "뽑기"],
    "운영/장애": ["점검", "장애", "오류", "버그", "접속", "서버", "롤백"],
    "보상/환불": ["보상", "환불", "배상", "보상안", "환급"],
    "규제/법적": ["공정위", "소송", "제재", "법원", "과징금", "규제"],
    "여론/논란": ["논란", "비판", "불만", "시위", "잡음"],
    "신작/성과": ["신작", "출시", "흥행", "매출", "사전예약", "수상"],
}
THEME_WEIGHTS: dict[str, float] = {
    "확률형/BM": 1.0,
    "규제/법적": 0.9,
    "보상/환불": 0.8,
    "운영/장애": 0.7,
    "여론/논란": 0.7,
    "신작/성과": 0.4,
}
IP_RULES: dict[str, dict[str, Any]] = {
    "전체": {"slug": "all", "keywords": []},
    "메이플스토리": {"slug": "maplestory", "keywords": ["메이플스토리", "메이플", "maplestory"]},
    "던전앤파이터": {"slug": "dnf", "keywords": ["던전앤파이터", "던파", "dnf"]},
    "아크레이더스": {"slug": "arcraiders", "keywords": ["아크레이더스", "아크 레이더스", "arc raiders", "arcraiders"]},
    "FC온라인": {
        "slug": "fconline",
        "keywords": ["fc온라인", "fc online", "fconline", "피파온라인", "fifa온라인", "ea sports fc online"],
    },
    "블루아카이브": {"slug": "bluearchive", "keywords": ["블루아카이브", "블루 아카이브", "블루아카", "blue archive"]},
}
OUTLET_TIER1 = {
    "chosun.com",
    "joins.com",
    "donga.com",
    "hani.co.kr",
    "khan.co.kr",
    "yna.co.kr",
    "yonhapnews.co.kr",
    "kbs.co.kr",
    "imbc.com",
    "sbs.co.kr",
}
OUTLET_GAME_MEDIA = {
    "inven.co.kr",
    "thisisgame.com",
    "gamemeca.com",
}


def _resolve_db_path() -> Path:
    raw = os.getenv("PR_DB_PATH", "").strip()
    db_path = Path(raw) if raw else DEFAULT_DB_PATH
    if not db_path.is_absolute():
        db_path = ROOT_DIR / db_path
    return db_path


def get_active_db_path() -> Path:
    return _resolve_db_path()


def _connect() -> sqlite3.Connection:
    db_path = _resolve_db_path()
    db_path.parent.mkdir(parents=True, exist_ok=True)

    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db() -> None:
    conn = _connect()
    try:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS articles (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                company TEXT NOT NULL,
                title_clean TEXT NOT NULL,
                description_clean TEXT,
                originallink TEXT,
                link TEXT,
                outlet TEXT,
                pub_date TEXT,
                date TEXT,
                sentiment TEXT,
                is_test INTEGER NOT NULL DEFAULT 0,
                content_hash TEXT NOT NULL UNIQUE,
                created_at TEXT NOT NULL
            )
            """
        )
        cols = {r["name"] for r in conn.execute("PRAGMA table_info(articles)").fetchall()}
        if "outlet" not in cols:
            conn.execute("ALTER TABLE articles ADD COLUMN outlet TEXT")
        if "source_group_id" not in cols:
            conn.execute("ALTER TABLE articles ADD COLUMN source_group_id TEXT")
        if "is_test" not in cols:
            conn.execute("ALTER TABLE articles ADD COLUMN is_test INTEGER NOT NULL DEFAULT 0")

        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS source_groups (
                group_id TEXT PRIMARY KEY,
                canonical_article_id INTEGER,
                repost_count INTEGER NOT NULL DEFAULT 1,
                first_seen_at TEXT NOT NULL,
                last_seen_at TEXT NOT NULL,
                FOREIGN KEY(canonical_article_id) REFERENCES articles(id) ON DELETE SET NULL
            )
            """
        )

        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS sentiment_results (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                article_id INTEGER NOT NULL,
                source_group_id TEXT,
                sentiment_score REAL NOT NULL,
                sentiment_label TEXT NOT NULL,
                confidence REAL NOT NULL,
                method TEXT NOT NULL,
                analyzed_at TEXT NOT NULL,
                FOREIGN KEY(article_id) REFERENCES articles(id) ON DELETE CASCADE,
                FOREIGN KEY(source_group_id) REFERENCES source_groups(group_id) ON DELETE SET NULL
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS risk_timeseries (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                ip_id TEXT NOT NULL,
                ts TEXT NOT NULL,
                risk_raw REAL NOT NULL,
                risk_score REAL NOT NULL,
                s_comp REAL NOT NULL,
                v_comp REAL NOT NULL,
                t_comp REAL NOT NULL,
                m_comp REAL NOT NULL,
                alert_level TEXT NOT NULL,
                sample_size INTEGER NOT NULL,
                uncertain_ratio REAL NOT NULL
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS burst_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                ip_name TEXT NOT NULL,
                event_type TEXT NOT NULL,
                trigger_reason TEXT NOT NULL,
                risk_at_event REAL NOT NULL,
                occurred_at TEXT NOT NULL
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS scheduler_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                job_id TEXT NOT NULL,
                run_time TEXT NOT NULL,
                status TEXT NOT NULL,
                error_message TEXT
            )
            """
        )

        sentiment_cols = {r["name"] for r in conn.execute("PRAGMA table_info(sentiment_results)").fetchall()}
        if "source_group_id" not in sentiment_cols:
            conn.execute("ALTER TABLE sentiment_results ADD COLUMN source_group_id TEXT")

        conn.execute("CREATE INDEX IF NOT EXISTS idx_articles_company ON articles(company)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_articles_sentiment ON articles(sentiment)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_articles_pub_date ON articles(pub_date)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_articles_outlet ON articles(outlet)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_articles_source_group ON articles(source_group_id)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_source_groups_canonical ON source_groups(canonical_article_id)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_source_groups_last_seen ON source_groups(last_seen_at)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_sentiment_article ON sentiment_results(article_id)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_sentiment_group ON sentiment_results(source_group_id)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_sentiment_method ON sentiment_results(method)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_sentiment_analyzed_at ON sentiment_results(analyzed_at)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_risk_ip_ts ON risk_timeseries(ip_id, ts)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_burst_ip_time ON burst_events(ip_name, occurred_at)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_scheduler_job_time ON scheduler_logs(job_id, run_time)")
        conn.commit()
    finally:
        conn.close()


def _normalize_title(text: str) -> str:
    t = (text or "").lower()
    t = " ".join(t.split())
    return "".join(ch for ch in t if ch.isalnum() or ch.isspace())


def _normalize_url(url: str) -> str:
    raw = (url or "").strip()
    if not raw:
        return ""
    try:
        p = urlparse(raw)
    except Exception:
        return raw

    host = (p.netloc or "").lower()
    if host.startswith("www."):
        host = host[4:]
    path = p.path or ""
    drop_prefixes = ("utm_", "fbclid", "gclid", "ref", "source")
    keep = []
    for k, v in parse_qsl(p.query, keep_blank_values=False):
        lk = k.lower()
        if lk.startswith(drop_prefixes):
            continue
        keep.append((k, v))
    keep.sort()
    return urlunparse(("https", host, path, "", urlencode(keep), ""))


def _to_hash(company: str, originallink: str, link: str, title: str, date: str) -> str:
    normalized_url = _normalize_url(originallink) or _normalize_url(link)
    normalized_title = _normalize_title(title)
    if normalized_url:
        key = "|".join([company or "", normalized_url])
    else:
        key = "|".join([company or "", normalized_title, date or ""])
    return hashlib.sha1(key.encode("utf-8")).hexdigest()


def _to_source_group_id(originallink: str, link: str, title: str, date: str) -> str:
    normalized_url = _normalize_url(originallink) or _normalize_url(link)
    if normalized_url:
        parsed = urlparse(normalized_url)
        key = f"{parsed.netloc.lower()}{parsed.path}"
    else:
        key = f"{_normalize_title(title)}|{date or ''}"
    return hashlib.sha1(key.encode("utf-8")).hexdigest()


def _extract_outlet(originallink: str, link: str) -> str:
    chosen = _normalize_url(originallink) or _normalize_url(link)
    if not chosen:
        return "unknown"
    try:
        host = (urlparse(chosen).netloc or "").lower()
    except Exception:
        return "unknown"
    if host.startswith("www."):
        host = host[4:]
    return host or "unknown"


def _is_near_duplicate(conn: sqlite3.Connection, company: str, title: str, date: str, source_group_id: str) -> bool:
    """동일 회사/일자/소스그룹 내 유사 제목 중복 제거."""
    title_norm = _normalize_title(title)
    if not title_norm:
        return False
    rows = conn.execute(
        """
        SELECT title_clean
        FROM articles
        WHERE company = ? AND date = ? AND COALESCE(source_group_id, '') = COALESCE(?, '')
        ORDER BY id DESC
        LIMIT 200
        """,
        (company, date, source_group_id),
    ).fetchall()
    for r in rows:
        existing = _normalize_title(r["title_clean"])
        if not existing:
            continue
        if title_norm == existing:
            return True
        if SequenceMatcher(None, title_norm, existing).ratio() >= 0.96:
            return True
    return False


def _resolve_syndicated_group_id(
    conn: sqlite3.Connection,
    company: str,
    title: str,
    date: str,
    source_group_id: str,
) -> str:
    """재배포 가능성이 높은 기사의 소스 그룹을 기존 그룹으로 정규화."""
    if not source_group_id:
        return source_group_id

    exists = conn.execute("SELECT 1 FROM source_groups WHERE group_id = ? LIMIT 1", (source_group_id,)).fetchone()
    if exists is not None:
        return source_group_id

    title_norm = _normalize_title(title)
    if not title_norm or not date:
        return source_group_id

    try:
        base_date = datetime.strptime(date, "%Y-%m-%d")
    except ValueError:
        return source_group_id

    start_date = (base_date - timedelta(days=1)).strftime("%Y-%m-%d")
    end_date = (base_date + timedelta(days=1)).strftime("%Y-%m-%d")
    rows = conn.execute(
        """
        SELECT COALESCE(source_group_id, '') AS source_group_id, title_clean
        FROM articles
        WHERE company = ?
          AND date BETWEEN ? AND ?
          AND COALESCE(source_group_id, '') != ''
        ORDER BY id DESC
        LIMIT 500
        """,
        (company, start_date, end_date),
    ).fetchall()

    best_gid = source_group_id
    best_ratio = 0.0
    for r in rows:
        gid = str(r["source_group_id"] or "")
        if not gid:
            continue
        existing_norm = _normalize_title(str(r["title_clean"] or ""))
        if not existing_norm:
            continue
        if existing_norm == title_norm:
            return gid
        ratio = SequenceMatcher(None, title_norm, existing_norm).ratio()
        if ratio >= 0.985 and ratio > best_ratio:
            best_ratio = ratio
            best_gid = gid
    return best_gid


def _increment_group_repost(conn: sqlite3.Connection, source_group_id: str, now: str) -> None:
    if not source_group_id:
        return
    row = conn.execute(
        "SELECT repost_count FROM source_groups WHERE group_id = ?",
        (source_group_id,),
    ).fetchone()
    if row is None:
        existing_mentions = conn.execute(
            "SELECT COUNT(1) AS cnt FROM articles WHERE COALESCE(source_group_id, '') = COALESCE(?, '')",
            (source_group_id,),
        ).fetchone()
        base_count = int(existing_mentions["cnt"] or 0)
        conn.execute(
            """
            INSERT INTO source_groups (group_id, canonical_article_id, repost_count, first_seen_at, last_seen_at)
            VALUES (?, NULL, ?, ?, ?)
            """,
            (source_group_id, max(2, base_count + 1), now, now),
        )
        return
    conn.execute(
        """
        UPDATE source_groups
        SET repost_count = COALESCE(repost_count, 0) + 1,
            last_seen_at = ?
        WHERE group_id = ?
        """,
        (now, source_group_id),
    )


def _compute_group_volume(conn: sqlite3.Connection, group_ids: set[str]) -> dict[str, float | int]:
    effective_groups = {g for g in group_ids if g and not g.startswith("legacy:")}
    unique_articles = int(len(group_ids))
    if not effective_groups:
        return {
            "unique_articles": unique_articles,
            "total_mentions": unique_articles,
            "repost_multiplier": round(float(unique_articles) / max(unique_articles, 1), 3),
        }

    placeholders = ",".join(["?"] * len(effective_groups))
    rows = conn.execute(
        f"""
        SELECT group_id, repost_count
        FROM source_groups
        WHERE group_id IN ({placeholders})
        """,
        sorted(effective_groups),
    ).fetchall()
    repost_by_group = {str(r["group_id"]): max(1, int(r["repost_count"] or 1)) for r in rows}
    total_mentions = 0
    for gid in group_ids:
        if not gid:
            continue
        if gid.startswith("legacy:"):
            total_mentions += 1
            continue
        total_mentions += repost_by_group.get(gid, 1)

    total_mentions = int(total_mentions)
    return {
        "unique_articles": unique_articles,
        "total_mentions": total_mentions,
        "repost_multiplier": round(float(total_mentions) / max(unique_articles, 1), 3),
    }


def save_articles(df: pd.DataFrame) -> int:
    if df.empty:
        return 0

    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    conn = _connect()
    try:
        before = conn.execute("SELECT COUNT(1) AS cnt FROM articles").fetchone()["cnt"]
        seen_hashes: set[str] = set()
        for _, row in df.iterrows():
            company = str(row.get("company", "") or "")
            title = str(row.get("title_clean", "") or "")
            desc = str(row.get("description_clean", "") or "")
            originallink = str(row.get("originallink", "") or "")
            link = str(row.get("link", "") or "")
            pub_raw = row.get("pubDate_parsed")
            pub_date = ""
            if pd.notna(pub_raw):
                try:
                    pub_date = pd.to_datetime(pub_raw).strftime("%Y-%m-%d %H:%M:%S")
                except Exception:
                    pub_date = ""
            date = str(row.get("date", "") or "")
            analyzed = analyze_sentiment_rule_v1(title, desc)
            sentiment = str(row.get("sentiment", "") or "") or analyzed["sentiment_kr"]
            is_test = 1 if int(row.get("is_test", 0) or 0) else 0
            outlet = _extract_outlet(originallink, link)
            content_hash = _to_hash(company, originallink, link, title, date)
            source_group_id = _to_source_group_id(originallink, link, title, date)
            source_group_id = _resolve_syndicated_group_id(conn, company, title, date, source_group_id)

            if content_hash in seen_hashes:
                continue
            seen_hashes.add(content_hash)

            cur = conn.execute(
                """
                INSERT OR IGNORE INTO articles (
                    company, title_clean, description_clean, originallink, link, outlet, pub_date, date, sentiment, is_test, content_hash, created_at, source_group_id
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (company, title, desc, originallink, link, outlet, pub_date, date, sentiment, is_test, content_hash, now, source_group_id),
            )

            if cur.rowcount == 0:
                continue

            article_id = int(cur.lastrowid)
            existing_group = conn.execute(
                "SELECT canonical_article_id, repost_count FROM source_groups WHERE group_id = ?",
                (source_group_id,),
            ).fetchone()
            if existing_group is None:
                conn.execute(
                    """
                    INSERT INTO source_groups (group_id, canonical_article_id, repost_count, first_seen_at, last_seen_at)
                    VALUES (?, ?, 1, ?, ?)
                    """,
                    (source_group_id, article_id, now, now),
                )
                conn.execute(
                    """
                    INSERT INTO sentiment_results (
                        article_id, source_group_id, sentiment_score, sentiment_label, confidence, method, analyzed_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        article_id,
                        source_group_id,
                        float(analyzed["sentiment_score"]),
                        str(analyzed["sentiment_label"]),
                        float(analyzed["confidence"]),
                        str(analyzed["method"]),
                        now,
                    ),
                )
            else:
                _increment_group_repost(conn, source_group_id, now)
        conn.commit()
        after = conn.execute("SELECT COUNT(1) AS cnt FROM articles").fetchone()["cnt"]
        return int(after) - int(before)
    finally:
        conn.close()


def get_articles(
    *,
    company: str | None = None,
    sentiment: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> dict[str, Any]:
    company_val = (company or "").strip()
    sentiment_val = (sentiment or "").strip()

    where: list[str] = []
    params: list[Any] = []

    if company_val and company_val != "전체":
        where.append("company = ?")
        params.append(company_val)

    if sentiment_val and sentiment_val != "전체":
        where.append("sentiment = ?")
        params.append(sentiment_val)

    where_sql = f"WHERE {' AND '.join(where)}" if where else ""

    conn = _connect()
    try:
        total = conn.execute(f"SELECT COUNT(1) AS cnt FROM articles {where_sql}", params).fetchone()["cnt"]
        rows = conn.execute(
            f"""
            SELECT company, title_clean AS title, sentiment, date,
                   outlet,
                   CASE WHEN originallink IS NOT NULL AND originallink != '' THEN originallink ELSE link END AS url
            FROM articles
            {where_sql}
            ORDER BY COALESCE(pub_date, date, created_at) DESC, id DESC
            LIMIT ? OFFSET ?
            """,
            [*params, int(limit), int(offset)],
        ).fetchall()

        items = [dict(r) for r in rows]
        return {
            "items": items,
            "total": int(total),
            "offset": int(offset),
            "limit": int(limit),
            "has_more": int(offset) + len(items) < int(total),
        }
    finally:
        conn.close()


def clear_articles(company: str | None = None) -> int:
    conn = _connect()
    try:
        if company:
            before = conn.execute("SELECT COUNT(1) AS cnt FROM articles WHERE company = ?", (company,)).fetchone()["cnt"]
            conn.execute("DELETE FROM articles WHERE company = ?", (company,))
            conn.commit()
            after = conn.execute("SELECT COUNT(1) AS cnt FROM articles WHERE company = ?", (company,)).fetchone()["cnt"]
            return int(before) - int(after)
        before = conn.execute("SELECT COUNT(1) AS cnt FROM articles").fetchone()["cnt"]
        conn.execute("DELETE FROM articles")
        conn.commit()
        return int(before)
    finally:
        conn.close()


def get_risk_ip_catalog() -> list[dict[str, str]]:
    return [{"id": v["slug"], "name": k} for k, v in IP_RULES.items()]


def _resolve_ip_name(ip: str) -> str:
    ip_val = (ip or "all").strip().lower()
    for name, meta in IP_RULES.items():
        if meta["slug"] == ip_val:
            return name
    return ""


def _detect_ip(text: str) -> str:
    low = (text or "").lower()
    for name, meta in IP_RULES.items():
        if meta["slug"] == "all":
            continue
        if any(k.lower() in low for k in meta["keywords"]):
            return name
    return "기타"


def _extract_cluster_tokens(text: str, ip_name: str) -> list[str]:
    words = re.findall(r"[가-힣a-zA-Z0-9]{2,12}", text or "")
    stop = {
        "넥슨",
        "nexon",
        "관련",
        "기자",
        "보도",
        "뉴스",
        "이번",
        "대한",
        "위해",
        "했다",
        "한다",
        "있는",
        "없는",
        "에서",
        "으로",
        "까지",
        "그리고",
        "통해",
        "the",
        "and",
    }
    if ip_name in IP_RULES:
        stop.update({k.lower() for k in IP_RULES[ip_name]["keywords"]})
    out = []
    for w in words:
        lw = w.lower()
        if lw in stop:
            continue
        if len(lw) < 2:
            continue
        out.append(lw)
    return out


def get_ip_clusters(
    *,
    date_from: str = "2024-01-01",
    date_to: str = "2026-12-31",
    ip: str = "maplestory",
    limit: int = 6,
) -> dict[str, Any]:
    ip_name = _resolve_ip_name(ip)
    if not ip_name:
        raise ValueError("지원하지 않는 IP입니다.")

    params = ["넥슨", date_from, date_to]
    conn = _connect()
    try:
        rows = conn.execute(
            """
            SELECT id, date, title_clean, description_clean, sentiment,
                   COALESCE(source_group_id, '') AS source_group_id,
                   COALESCE(NULLIF(outlet, ''), 'unknown') AS outlet
            FROM articles
            WHERE company = ? AND date BETWEEN ? AND ?
            ORDER BY date DESC, id DESC
            """,
            params,
        ).fetchall()
    finally:
        conn.close()

    buckets: dict[str, dict[str, Any]] = {}
    overall_keywords = Counter()
    total = 0
    outlets = Counter()
    group_ids: set[str] = set()

    for r in rows:
        text = f"{r['title_clean'] or ''} {r['description_clean'] or ''}"
        detected_ip = _detect_ip(text)
        if ip_name != "전체" and detected_ip != ip_name:
            continue

        total += 1
        gid = str(r["source_group_id"] or "") or f"legacy:{int(r['id'])}"
        group_ids.add(gid)
        sentiment = str(r["sentiment"] or "")
        outlets[str(r["outlet"] or "unknown")] += 1

        cluster_label = "기타 이슈"
        for theme, kws in RISK_THEME_RULES.items():
            if any(k.lower() in text.lower() for k in kws):
                cluster_label = theme
                break

        if cluster_label not in buckets:
            buckets[cluster_label] = {
                "cluster": cluster_label,
                "article_count": 0,
                "negative_count": 0,
                "sentiments": {"긍정": 0, "중립": 0, "부정": 0},
                "keywords": Counter(),
                "samples": [],
            }

        bucket = buckets[cluster_label]
        bucket["article_count"] += 1
        if sentiment == "부정":
            bucket["negative_count"] += 1
        if sentiment in bucket["sentiments"]:
            bucket["sentiments"][sentiment] += 1
        tokens = _extract_cluster_tokens(text, ip_name)
        bucket["keywords"].update(tokens)
        overall_keywords.update(tokens)
        if len(bucket["samples"]) < 3 and r["title_clean"]:
            bucket["samples"].append(str(r["title_clean"]))

    clusters = []
    for bucket in buckets.values():
        cnt = int(bucket["article_count"])
        neg_ratio = round(100.0 * int(bucket["negative_count"]) / max(cnt, 1), 1)
        clusters.append(
            {
                "cluster": bucket["cluster"],
                "article_count": cnt,
                "negative_ratio": neg_ratio,
                "sentiment": {
                    "positive": round(100.0 * bucket["sentiments"]["긍정"] / max(cnt, 1), 1),
                    "neutral": round(100.0 * bucket["sentiments"]["중립"] / max(cnt, 1), 1),
                    "negative": round(100.0 * bucket["sentiments"]["부정"] / max(cnt, 1), 1),
                },
                "keywords": [k for k, _ in bucket["keywords"].most_common(6)],
                "samples": bucket["samples"],
            }
        )

    clusters.sort(key=lambda x: (x["article_count"], x["negative_ratio"]), reverse=True)
    clusters = clusters[: max(1, min(int(limit), 12))]
    top_keyword_counts = overall_keywords.most_common(40)
    max_keyword_count = max([count for _, count in top_keyword_counts] + [1])
    keyword_cloud = [
        {
            "word": word,
            "count": int(count),
            "weight": round(float(count) / float(max_keyword_count), 3),
        }
        for word, count in top_keyword_counts
    ]

    conn = _connect()
    try:
        volume = _compute_group_volume(conn, group_ids)
    finally:
        conn.close()

    return {
        "meta": {
            "company": "넥슨",
            "ip": ip_name,
            "ip_id": (ip or "").strip().lower(),
            "date_from": date_from,
            "date_to": date_to,
            "total_articles": int(volume["total_mentions"]),
            "unique_articles": int(volume["unique_articles"]),
            "total_mentions": int(volume["total_mentions"]),
            "repost_multiplier": float(volume["repost_multiplier"]),
            "raw_rows": int(total),
            "cluster_count": int(len(clusters)),
        },
        "ip_catalog": get_risk_ip_catalog(),
        "top_outlets": [{"outlet": k, "article_count": int(v)} for k, v in outlets.most_common(5)],
        "keyword_cloud": keyword_cloud,
        "clusters": clusters,
    }


def get_risk_dashboard(date_from: str = "2024-01-01", date_to: str = "2026-12-31", ip: str = "all") -> dict[str, Any]:
    ip_name = _resolve_ip_name(ip)
    if not ip_name:
        raise ValueError("지원하지 않는 IP입니다.")

    params = ["넥슨", date_from, date_to]
    conn = _connect()
    try:
        rows = conn.execute(
            """
            SELECT id, date,
                   title_clean,
                   description_clean,
                   sentiment,
                   COALESCE(source_group_id, '') AS source_group_id,
                   COALESCE(NULLIF(outlet, ''), 'unknown') AS outlet
            FROM articles
            WHERE company = ? AND date BETWEEN ? AND ?
            """,
            params,
        ).fetchall()
    finally:
        conn.close()

    daily_acc: dict[str, dict[str, int]] = {}
    outlet_acc: dict[str, dict[str, int]] = {}
    ip_breakdown_acc: dict[str, int] = {}
    theme_counts: dict[str, dict[str, float]] = {
        k: {"article_count": 0, "negative_count": 0, "negative_ratio": 0.0, "risk_score": 0.0}
        for k in RISK_THEME_RULES
    }
    group_ids: set[str] = set()

    total = 0
    for r in rows:
        date = str(r["date"] or "")
        text = f"{r['title_clean'] or ''} {r['description_clean'] or ''}".lower()
        sentiment = str(r["sentiment"] or "")
        outlet = str(r["outlet"] or "unknown")
        detected_ip = _detect_ip(text)
        ip_breakdown_acc[detected_ip] = ip_breakdown_acc.get(detected_ip, 0) + 1

        if ip_name != "전체" and detected_ip != ip_name:
            continue

        total += 1
        gid = str(r["source_group_id"] or "") or f"legacy:{int(r['id'])}"
        group_ids.add(gid)
        if date not in daily_acc:
            daily_acc[date] = {"article_count": 0, "negative_count": 0}
        daily_acc[date]["article_count"] += 1
        if sentiment == "부정":
            daily_acc[date]["negative_count"] += 1

        if outlet not in outlet_acc:
            outlet_acc[outlet] = {"article_count": 0, "positive": 0, "neutral": 0, "negative": 0}
        outlet_acc[outlet]["article_count"] += 1
        if sentiment == "긍정":
            outlet_acc[outlet]["positive"] += 1
        elif sentiment == "중립":
            outlet_acc[outlet]["neutral"] += 1
        elif sentiment == "부정":
            outlet_acc[outlet]["negative"] += 1

        for theme, kws in RISK_THEME_RULES.items():
            if any(k.lower() in text for k in kws):
                theme_counts[theme]["article_count"] += 1
                if sentiment == "부정":
                    theme_counts[theme]["negative_count"] += 1

    daily = []
    for date in sorted(daily_acc.keys()):
        count = daily_acc[date]["article_count"]
        neg = daily_acc[date]["negative_count"]
        ratio = round(100.0 * neg / max(count, 1), 1)
        daily.append({"date": date, "article_count": count, "negative_ratio": ratio})

    outlets = []
    for outlet, row in sorted(outlet_acc.items(), key=lambda kv: kv[1]["article_count"], reverse=True)[:40]:
        count = int(row["article_count"])
        outlets.append(
            {
                "outlet": outlet,
                "article_count": count,
                "positive_ratio": round(100.0 * row["positive"] / max(count, 1), 1),
                "neutral_ratio": round(100.0 * row["neutral"] / max(count, 1), 1),
                "negative_ratio": round(100.0 * row["negative"] / max(count, 1), 1),
            }
        )

    max_count = max([v["article_count"] for v in theme_counts.values()] + [1])
    themed = []
    for theme, row in theme_counts.items():
        count = int(row["article_count"])
        if count == 0:
            continue
        neg = int(row["negative_count"])
        neg_ratio = round(100.0 * neg / count, 1)
        volume_norm = count / max_count
        risk_score = round(0.6 * volume_norm + 0.4 * (neg_ratio / 100.0), 3)
        themed.append(
            {
                "theme": theme,
                "article_count": count,
                "negative_ratio": neg_ratio,
                "risk_score": risk_score,
            }
        )
    themed.sort(key=lambda x: (x["risk_score"], x["article_count"]), reverse=True)
    ip_breakdown = [
        {"ip": ip_name_key, "article_count": count}
        for ip_name_key, count in sorted(ip_breakdown_acc.items(), key=lambda kv: kv[1], reverse=True)
    ]

    conn = _connect()
    try:
        volume = _compute_group_volume(conn, group_ids)
    finally:
        conn.close()

    return {
        "meta": {
            "company": "넥슨",
            "ip": ip_name,
            "ip_id": (ip or "all").strip().lower(),
            "date_from": date_from,
            "date_to": date_to,
            "total_articles": int(volume["total_mentions"]),
            "unique_articles": int(volume["unique_articles"]),
            "total_mentions": int(volume["total_mentions"]),
            "repost_multiplier": float(volume["repost_multiplier"]),
            "raw_rows": int(total),
        },
        "daily": daily,
        "outlets": outlets,
        "risk_themes": themed,
        "ip_breakdown": ip_breakdown,
        "ip_catalog": get_risk_ip_catalog(),
    }


def get_nexon_dashboard(date_from: str = "2024-01-01", date_to: str = "2026-12-31") -> dict[str, Any]:
    return get_risk_dashboard(date_from=date_from, date_to=date_to, ip="all")


def _sigmoid(x: float) -> float:
    x = max(-12.0, min(12.0, float(x)))
    return 1.0 / (1.0 + math.exp(-x))


def _outlet_weight(outlet: str) -> float:
    host = str(outlet or "unknown").strip().lower()
    if host in OUTLET_TIER1:
        return 1.0
    if host in OUTLET_GAME_MEDIA:
        return 0.7
    return 0.4


def _alert_level(score: float) -> str:
    if score >= 70:
        return "P1"
    if score >= 45:
        return "P2"
    return "P3"


def _parse_article_dt(pub_date: str, date_only: str) -> datetime | None:
    dt = pd.to_datetime(pub_date or "", errors="coerce")
    if pd.isna(dt):
        dt = pd.to_datetime(date_only or "", errors="coerce")
    if pd.isna(dt):
        return None
    return dt.to_pydatetime().replace(tzinfo=None)


def get_live_risk(ip: str = "all", window_hours: int = 24) -> dict[str, Any]:
    ip_name = _resolve_ip_name(ip)
    if not ip_name:
        raise ValueError("지원하지 않는 IP입니다.")

    now = datetime.now()
    start_window = now - timedelta(hours=max(1, int(window_hours)))
    start_baseline = now - timedelta(days=7)
    baseline_date = start_baseline.strftime("%Y-%m-%d")

    conn = _connect()
    try:
        rows = conn.execute(
            """
            SELECT id, title_clean, description_clean,
                   COALESCE(NULLIF(outlet, ''), 'unknown') AS outlet,
                   COALESCE(pub_date, '') AS pub_date,
                   COALESCE(date, '') AS date,
                   COALESCE(source_group_id, '') AS source_group_id
            FROM articles
            WHERE company = ? AND date >= ?
            """,
            ("넥슨", baseline_date),
        ).fetchall()

        scoped = []
        for r in rows:
            text = f"{r['title_clean'] or ''} {r['description_clean'] or ''}"
            if ip_name != "전체" and _detect_ip(text) != ip_name:
                continue
            dt = _parse_article_dt(str(r["pub_date"] or ""), str(r["date"] or ""))
            if not dt:
                continue
            scoped.append(
                {
                    "id": int(r["id"]),
                    "dt": dt,
                    "text": text.lower(),
                    "outlet": str(r["outlet"] or "unknown"),
                    "source_group_id": str(r["source_group_id"] or ""),
                }
            )

        recent = [r for r in scoped if r["dt"] >= start_window]
        recent_group_items: dict[str, dict[str, Any]] = {}
        for r in recent:
            gid = str(r["source_group_id"] or "") or f"legacy:{int(r['id'])}"
            if gid not in recent_group_items:
                recent_group_items[gid] = r
        recent_groups = sorted(recent_group_items.keys())
        recent_real_group_ids = sorted(g for g in recent_groups if not g.startswith("legacy:"))

        sentiment_by_group: dict[str, dict[str, float | str]] = {}
        if recent_real_group_ids:
            placeholders = ",".join(["?"] * len(recent_real_group_ids))
            srows = conn.execute(
                f"""
                SELECT source_group_id, sentiment_score, sentiment_label, confidence, analyzed_at
                FROM sentiment_results
                WHERE source_group_id IN ({placeholders})
                ORDER BY analyzed_at DESC, id DESC
                """,
                recent_real_group_ids,
            ).fetchall()
            for sr in srows:
                gid = str(sr["source_group_id"] or "")
                if gid in sentiment_by_group:
                    continue
                sentiment_by_group[gid] = {
                    "score": float(sr["sentiment_score"] or 0.0),
                    "label": str(sr["sentiment_label"] or "uncertain"),
                    "confidence": float(sr["confidence"] or 0.0),
                }

        weighted_scores = []
        uncertain_count = 0
        for gid in recent_groups:
            entry = sentiment_by_group.get(gid, {"score": 0.0, "label": "uncertain", "confidence": 0.0})
            label = str(entry["label"])
            confidence = float(entry["confidence"])
            weight = confidence if label != "uncertain" else 0.3
            negative_value = max(0.0, -float(entry["score"]))
            weighted_scores.append(negative_value * weight)
            if label == "uncertain":
                uncertain_count += 1
        S_t = float(sum(weighted_scores) / max(len(weighted_scores), 1))
        uncertain_ratio = float(uncertain_count / max(len(recent_groups), 1))

        hour_start = now - timedelta(hours=1)
        count_1h = sum(1 for r in scoped if r["dt"] >= hour_start)
        hourly_counter: Counter[str] = Counter()
        for r in scoped:
            if r["dt"] >= now:
                continue
            bucket = r["dt"].strftime("%Y-%m-%d %H")
            hourly_counter[bucket] += 1
        same_hour_values = []
        current_hour = now.hour
        for key, value in hourly_counter.items():
            dt_key = datetime.strptime(key, "%Y-%m-%d %H")
            if dt_key.hour == current_hour:
                same_hour_values.append(value)
        baseline_values = same_hour_values if len(same_hour_values) >= 3 else list(hourly_counter.values())
        baseline_mean = float(sum(baseline_values) / max(len(baseline_values), 1))
        baseline_std = float(pd.Series(baseline_values).std(ddof=0)) if baseline_values else 0.0
        z_score = (float(count_1h) - baseline_mean) / max(baseline_std, 1.0)
        V_t = float(_sigmoid(z_score))

        theme_counter: Counter[str] = Counter()
        for r in recent_group_items.values():
            for theme, keywords in RISK_THEME_RULES.items():
                if any(k.lower() in r["text"] for k in keywords):
                    theme_counter[theme] += 1
                    break
        T_t = 0.0
        if recent_group_items:
            total_recent = float(len(recent_group_items))
            for theme, cnt in theme_counter.items():
                share = float(cnt) / total_recent
                T_t += share * float(THEME_WEIGHTS.get(theme, 0.4))

        outlet_counter: Counter[str] = Counter(r["outlet"] for r in recent)
        M_t = 0.0
        if recent:
            total_recent = float(len(recent))
            for outlet, cnt in outlet_counter.items():
                share = float(cnt) / total_recent
                M_t += share * _outlet_weight(outlet)

        spread_ratio = float(len(recent) / max(len(recent_groups), 1))

        raw_risk = 100.0 * (0.45 * S_t + 0.25 * V_t + 0.20 * T_t + 0.10 * M_t)
        ip_id = (ip or "all").strip().lower()
        prev = conn.execute(
            """
            SELECT risk_score
            FROM risk_timeseries
            WHERE ip_id = ?
            ORDER BY ts DESC, id DESC
            LIMIT 1
            """,
            (ip_id,),
        ).fetchone()
        prev_risk = float(prev["risk_score"]) if prev else None
        ema_alpha = 0.3
        smoothed = (0.7 * prev_risk + 0.3 * raw_risk) if prev_risk is not None else raw_risk
        if prev_risk is not None and count_1h < 10:
            ema_alpha = 0.1
            smoothed = 0.9 * prev_risk + 0.1 * raw_risk

        score = round(float(max(0.0, min(100.0, smoothed))), 1)
        alert = _alert_level(score)
        ts = now.strftime("%Y-%m-%d %H:%M:%S")
        conn.execute(
            """
            INSERT INTO risk_timeseries (
                ip_id, ts, risk_raw, risk_score, s_comp, v_comp, t_comp, m_comp, alert_level, sample_size, uncertain_ratio
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                ip_id,
                ts,
                float(raw_risk),
                float(score),
                float(S_t),
                float(V_t),
                float(T_t),
                float(M_t),
                alert,
                int(len(recent)),
                float(uncertain_ratio),
            ),
        )
        conn.commit()

        return {
            "meta": {"ip": ip_name, "ip_id": ip_id, "window_hours": int(window_hours), "ts": ts},
            "risk_score": score,
            "raw_risk": round(float(raw_risk), 3),
            "ema_prev": round(float(prev_risk), 3) if prev_risk is not None else None,
            "ema_alpha": float(ema_alpha) if prev_risk is not None else 1.0,
            "components": {
                "S": round(float(S_t), 3),
                "V": round(float(V_t), 3),
                "T": round(float(T_t), 3),
                "M": round(float(M_t), 3),
            },
            "alert_level": alert,
            "alert": alert,
            "sample_size": int(len(recent_groups)),
            "article_count_window": int(len(recent)),
            "group_count_window": int(len(recent_groups)),
            "mention_count_window": int(len(recent)),
            "count_1h": int(count_1h),
            "z_score": round(float(z_score), 3),
            "uncertain_ratio": round(float(uncertain_ratio), 3),
            "spread_ratio": round(float(spread_ratio), 3),
        }
    finally:
        conn.close()


def get_recent_risk_scores(ip_id: str, minutes: int = 30) -> list[float]:
    ip_val = (ip_id or "all").strip().lower()
    since = (datetime.now() - timedelta(minutes=max(1, int(minutes)))).strftime("%Y-%m-%d %H:%M:%S")
    conn = _connect()
    try:
        rows = conn.execute(
            """
            SELECT risk_score
            FROM risk_timeseries
            WHERE ip_id = ? AND ts >= ?
            ORDER BY ts ASC, id ASC
            """,
            (ip_val, since),
        ).fetchall()
        return [float(r["risk_score"] or 0.0) for r in rows]
    finally:
        conn.close()


def record_burst_event(ip_name: str, event_type: str, trigger_reason: str, risk_at_event: float) -> None:
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    conn = _connect()
    try:
        conn.execute(
            """
            INSERT INTO burst_events (ip_name, event_type, trigger_reason, risk_at_event, occurred_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (ip_name, event_type, trigger_reason, float(risk_at_event), now),
        )
        conn.commit()
    finally:
        conn.close()


def get_recent_burst_events(ip_name: str, limit: int = 30) -> list[dict[str, Any]]:
    ip_val = (ip_name or "").strip().lower()
    conn = _connect()
    try:
        if ip_val:
            rows = conn.execute(
                """
                SELECT ip_name, event_type, trigger_reason, risk_at_event, occurred_at
                FROM burst_events
                WHERE ip_name = ?
                ORDER BY occurred_at DESC, id DESC
                LIMIT ?
                """,
                (ip_val, int(limit)),
            ).fetchall()
        else:
            rows = conn.execute(
                """
                SELECT ip_name, event_type, trigger_reason, risk_at_event, occurred_at
                FROM burst_events
                ORDER BY occurred_at DESC, id DESC
                LIMIT ?
                """,
                (int(limit),),
            ).fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


def record_scheduler_log(job_id: str, status: str, error_message: str = "", run_time: str | None = None) -> None:
    ts = run_time or datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    conn = _connect()
    try:
        conn.execute(
            """
            INSERT INTO scheduler_logs (job_id, run_time, status, error_message)
            VALUES (?, ?, ?, ?)
            """,
            (str(job_id), ts, str(status), str(error_message or "")),
        )
        conn.commit()
    finally:
        conn.close()


def get_latest_scheduler_log(job_id: str) -> dict[str, Any] | None:
    conn = _connect()
    try:
        row = conn.execute(
            """
            SELECT job_id, run_time, status, error_message
            FROM scheduler_logs
            WHERE job_id = ?
            ORDER BY run_time DESC, id DESC
            LIMIT 1
            """,
            (str(job_id),),
        ).fetchone()
        return dict(row) if row else None
    finally:
        conn.close()


def force_burst_test_articles(ip: str, multiplier: int = 5, seed_limit: int = 50) -> dict[str, Any]:
    ip_name = _resolve_ip_name(ip)
    if not ip_name:
        raise ValueError("지원하지 않는 IP입니다.")
    if ip_name == "전체":
        raise ValueError("전체 IP에는 강제 버스트를 적용할 수 없습니다.")
    mult = max(1, min(20, int(multiplier)))
    seeds_n = max(1, min(200, int(seed_limit)))

    now = datetime.now()
    since = (now - timedelta(days=30)).strftime("%Y-%m-%d")
    conn = _connect()
    try:
        rows = conn.execute(
            """
            SELECT company, title_clean, description_clean, originallink, link, outlet,
                   COALESCE(pub_date, '') AS pub_date, COALESCE(date, '') AS date
            FROM articles
            WHERE company = ? AND date >= ?
            ORDER BY COALESCE(pub_date, date, created_at) DESC, id DESC
            """,
            ("넥슨", since),
        ).fetchall()
    finally:
        conn.close()

    seeds: list[dict[str, Any]] = []
    for r in rows:
        title = str(r["title_clean"] or "")
        desc = str(r["description_clean"] or "")
        text = f"{title} {desc}"
        if _detect_ip(text) != ip_name:
            continue
        seeds.append(dict(r))
        if len(seeds) >= seeds_n:
            break

    if not seeds:
        raise ValueError(f"{ip_name} 기준 seed 기사가 없습니다.")

    records: list[dict[str, Any]] = []
    idx = 0
    for k in range(mult):
        for seed in seeds:
            idx += 1
            src = str(seed.get("originallink") or seed.get("link") or "https://debug.local/news")
            debug_link = f"{src}{'&' if '?' in src else '?'}debug_force_burst={now.strftime('%Y%m%d%H%M%S')}-{idx}"
            title = f"{seed.get('title_clean', '')} [DEBUG_BURST {idx}]"
            pub_dt = now - timedelta(minutes=(idx % 90))
            records.append(
                {
                    "company": "넥슨",
                    "title_clean": title,
                    "description_clean": str(seed.get("description_clean") or ""),
                    "originallink": debug_link,
                    "link": debug_link,
                    "outlet": str(seed.get("outlet") or ""),
                    "pubDate_parsed": pub_dt,
                    "date": pub_dt.strftime("%Y-%m-%d"),
                    "is_test": 1,
                }
            )

    df = pd.DataFrame(records)
    inserted = save_articles(df)
    return {
        "ip": ip,
        "ip_name": ip_name,
        "seed_count": len(seeds),
        "generated": int(len(records)),
        "inserted": int(inserted),
    }
