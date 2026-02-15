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
                pub_date TEXT,
                date TEXT,
                sentiment TEXT,
                content_hash TEXT NOT NULL UNIQUE,
                created_at TEXT NOT NULL
            )
            """
        )
        conn.execute("CREATE INDEX IF NOT EXISTS idx_articles_company ON articles(company)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_articles_sentiment ON articles(sentiment)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_articles_pub_date ON articles(pub_date)")
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
            content_hash = _to_hash(company, originallink, link, title, date)

            if content_hash in seen_hashes:
                continue
            seen_hashes.add(content_hash)

            if _is_near_duplicate(conn, company, title, date):
                continue

            conn.execute(
                """
                INSERT OR IGNORE INTO articles (
                    company, title_clean, description_clean, originallink, link, pub_date, date, sentiment, content_hash, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (company, title, desc, originallink, link, pub_date, date, sentiment, content_hash, now),
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
