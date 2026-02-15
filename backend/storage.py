from __future__ import annotations

import hashlib
import re
import sqlite3
from collections import Counter
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
IP_RULES: dict[str, dict[str, Any]] = {
    "전체": {"slug": "all", "keywords": []},
    "메이플스토리": {"slug": "maplestory", "keywords": ["메이플스토리", "메이플", "maplestory"]},
    "던전앤파이터": {"slug": "dnf", "keywords": ["던전앤파이터", "던파", "dnf"]},
    "카트라이더": {"slug": "kartrider", "keywords": ["카트라이더", "카트", "kartrider", "아크라이더"]},
    "FC온라인": {
        "slug": "fconline",
        "keywords": ["fc온라인", "fc online", "fconline", "피파온라인", "fifa온라인", "ea sports fc online"],
    },
    "블루아카이브": {"slug": "bluearchive", "keywords": ["블루아카이브", "블루 아카이브", "블루아카", "blue archive"]},
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
            SELECT date, title_clean, description_clean, sentiment,
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

    for r in rows:
        text = f"{r['title_clean'] or ''} {r['description_clean'] or ''}"
        detected_ip = _detect_ip(text)
        if ip_name != "전체" and detected_ip != ip_name:
            continue

        total += 1
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

    return {
        "meta": {
            "company": "넥슨",
            "ip": ip_name,
            "ip_id": (ip or "").strip().lower(),
            "date_from": date_from,
            "date_to": date_to,
            "total_articles": int(total),
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
            SELECT date,
                   title_clean,
                   description_clean,
                   sentiment,
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

    return {
        "meta": {
            "company": "넥슨",
            "ip": ip_name,
            "ip_id": (ip or "all").strip().lower(),
            "date_from": date_from,
            "date_to": date_to,
            "total_articles": int(total),
        },
        "daily": daily,
        "outlets": outlets,
        "risk_themes": themed,
        "ip_breakdown": ip_breakdown,
        "ip_catalog": get_risk_ip_catalog(),
    }


def get_nexon_dashboard(date_from: str = "2024-01-01", date_to: str = "2026-12-31") -> dict[str, Any]:
    return get_risk_dashboard(date_from=date_from, date_to=date_to, ip="all")
