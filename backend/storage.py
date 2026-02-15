from __future__ import annotations

import hashlib
import sqlite3
from difflib import SequenceMatcher
from datetime import datetime
from pathlib import Path
from typing import Any
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

import pandas as pd

ROOT_DIR = Path(__file__).resolve().parents[1]
DB_DIR = ROOT_DIR / "backend" / "data"
DB_PATH = DB_DIR / "articles.db"
RISK_THEME_RULES: dict[str, list[str]] = {
    "확률형/BM": ["확률", "확률형", "가챠", "과금", "bm", "뽑기"],
    "운영/장애": ["점검", "장애", "오류", "버그", "접속", "서버", "롤백"],
    "보상/환불": ["보상", "환불", "배상", "보상안", "환급"],
    "규제/법적": ["공정위", "소송", "제재", "법원", "과징금", "규제"],
    "여론/논란": ["논란", "비판", "불만", "시위", "잡음"],
    "신작/성과": ["신작", "출시", "흥행", "매출", "사전예약", "수상"],
}


def _connect() -> sqlite3.Connection:
    DB_DIR.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
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
                content_hash TEXT NOT NULL UNIQUE,
                created_at TEXT NOT NULL
            )
            """
        )
        cols = {r["name"] for r in conn.execute("PRAGMA table_info(articles)").fetchall()}
        if "outlet" not in cols:
            conn.execute("ALTER TABLE articles ADD COLUMN outlet TEXT")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_articles_company ON articles(company)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_articles_sentiment ON articles(sentiment)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_articles_pub_date ON articles(pub_date)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_articles_outlet ON articles(outlet)")
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


def _is_near_duplicate(conn: sqlite3.Connection, company: str, title: str, date: str) -> bool:
    """동일 회사/일자 내 유사 제목 중복 제거."""
    title_norm = _normalize_title(title)
    if not title_norm:
        return False
    rows = conn.execute(
        """
        SELECT title_clean
        FROM articles
        WHERE company = ? AND date = ?
        ORDER BY id DESC
        LIMIT 200
        """,
        (company, date),
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
            sentiment = str(row.get("sentiment", "") or "")
            outlet = _extract_outlet(originallink, link)
            content_hash = _to_hash(company, originallink, link, title, date)

            if content_hash in seen_hashes:
                continue
            seen_hashes.add(content_hash)

            if _is_near_duplicate(conn, company, title, date):
                continue

            conn.execute(
                """
                INSERT OR IGNORE INTO articles (
                    company, title_clean, description_clean, originallink, link, outlet, pub_date, date, sentiment, content_hash, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (company, title, desc, originallink, link, outlet, pub_date, date, sentiment, content_hash, now),
            )
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


def get_nexon_dashboard(date_from: str = "2024-01-01", date_to: str = "2026-12-31") -> dict[str, Any]:
    params = ["넥슨", date_from, date_to]
    conn = _connect()
    try:
        total = conn.execute(
            """
            SELECT COUNT(1) AS cnt
            FROM articles
            WHERE company = ? AND date BETWEEN ? AND ?
            """,
            params,
        ).fetchone()["cnt"]

        daily_rows = conn.execute(
            """
            SELECT date,
                   COUNT(1) AS article_count,
                   ROUND(100.0 * SUM(CASE WHEN sentiment = '부정' THEN 1 ELSE 0 END) / COUNT(1), 1) AS negative_ratio
            FROM articles
            WHERE company = ? AND date BETWEEN ? AND ?
            GROUP BY date
            ORDER BY date
            """,
            params,
        ).fetchall()

        outlet_rows = conn.execute(
            """
            SELECT COALESCE(NULLIF(outlet, ''), 'unknown') AS outlet,
                   COUNT(1) AS article_count,
                   ROUND(100.0 * SUM(CASE WHEN sentiment = '긍정' THEN 1 ELSE 0 END) / COUNT(1), 1) AS positive_ratio,
                   ROUND(100.0 * SUM(CASE WHEN sentiment = '중립' THEN 1 ELSE 0 END) / COUNT(1), 1) AS neutral_ratio,
                   ROUND(100.0 * SUM(CASE WHEN sentiment = '부정' THEN 1 ELSE 0 END) / COUNT(1), 1) AS negative_ratio
            FROM articles
            WHERE company = ? AND date BETWEEN ? AND ?
            GROUP BY outlet
            HAVING COUNT(1) >= 2
            ORDER BY article_count DESC
            LIMIT 40
            """,
            params,
        ).fetchall()

        theme_source = conn.execute(
            """
            SELECT title_clean, description_clean, sentiment
            FROM articles
            WHERE company = ? AND date BETWEEN ? AND ?
            """,
            params,
        ).fetchall()
    finally:
        conn.close()

    daily = [dict(r) for r in daily_rows]
    outlets = [dict(r) for r in outlet_rows]

    theme_counts: dict[str, dict[str, float]] = {
        k: {"article_count": 0, "negative_count": 0, "negative_ratio": 0.0, "risk_score": 0.0}
        for k in RISK_THEME_RULES
    }
    for r in theme_source:
        text = f"{r['title_clean'] or ''} {r['description_clean'] or ''}".lower()
        sentiment = str(r["sentiment"] or "")
        for theme, kws in RISK_THEME_RULES.items():
            if any(k.lower() in text for k in kws):
                theme_counts[theme]["article_count"] += 1
                if sentiment == "부정":
                    theme_counts[theme]["negative_count"] += 1

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

    return {
        "meta": {
            "company": "넥슨",
            "date_from": date_from,
            "date_to": date_to,
            "total_articles": int(total),
        },
        "daily": daily,
        "outlets": outlets,
        "risk_themes": themed,
    }
