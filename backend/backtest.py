from __future__ import annotations

import math
import sqlite3
from collections import Counter
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any

import pandas as pd

from backend.storage import IP_RULES, OUTLET_GAME_MEDIA, OUTLET_TIER1
from utils.sentiment import analyze_sentiment_rule_v1


def _connect() -> sqlite3.Connection:
    # storage 모듈과 동일한 DB 선택 규칙 사용
    from backend.storage import _connect as storage_connect  # type: ignore

    return storage_connect()


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


def _parse_article_dt(pub_date: str, date_only: str) -> datetime | None:
    dt = pd.to_datetime(pub_date or "", errors="coerce")
    if pd.isna(dt):
        dt = pd.to_datetime(date_only or "", errors="coerce")
    if pd.isna(dt):
        return None
    return dt.to_pydatetime().replace(tzinfo=None)


def _sigmoid(x: float) -> float:
    x = max(-12.0, min(12.0, float(x)))
    return 1.0 / (1.0 + math.exp(-x))


def _alert_level(score: float) -> str:
    if score >= 70:
        return "P1"
    if score >= 45:
        return "P2"
    return "P3"


def _outlet_weight(outlet: str) -> float:
    host = str(outlet or "unknown").strip().lower()
    if host in OUTLET_TIER1:
        return 1.0
    if host in OUTLET_GAME_MEDIA:
        return 0.7
    return 0.4


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


@dataclass
class Mention:
    article_id: int
    dt: datetime
    text: str
    outlet: str
    group_id: str


def _normalize_weights(weights: dict[str, float] | None) -> dict[str, float]:
    default = {"S": 0.45, "V": 0.25, "T": 0.20, "M": 0.10}
    if not weights:
        return default
    merged = {
        "S": float(weights.get("S", default["S"])),
        "V": float(weights.get("V", default["V"])),
        "T": float(weights.get("T", default["T"])),
        "M": float(weights.get("M", default["M"])),
    }
    total = sum(max(0.0, v) for v in merged.values())
    if total <= 0:
        return default
    return {k: max(0.0, v) / total for k, v in merged.items()}


def _ensure_group_sentiments(conn: sqlite3.Connection, mentions: list[Mention]) -> dict[str, dict[str, float | str]]:
    group_to_mention: dict[str, Mention] = {}
    for m in mentions:
        if m.group_id.startswith("legacy:"):
            continue
        group_to_mention.setdefault(m.group_id, m)

    sentiment_by_group: dict[str, dict[str, float | str]] = {}
    if not group_to_mention:
        return sentiment_by_group

    group_ids = sorted(group_to_mention.keys())
    placeholders = ",".join(["?"] * len(group_ids))
    rows = conn.execute(
        f"""
        SELECT source_group_id, sentiment_score, sentiment_label, confidence, analyzed_at
        FROM sentiment_results
        WHERE source_group_id IN ({placeholders})
        ORDER BY analyzed_at DESC, id DESC
        """,
        group_ids,
    ).fetchall()
    for r in rows:
        gid = str(r["source_group_id"] or "")
        if gid in sentiment_by_group:
            continue
        sentiment_by_group[gid] = {
            "score": float(r["sentiment_score"] or 0.0),
            "label": str(r["sentiment_label"] or "uncertain"),
            "confidence": float(r["confidence"] or 0.0),
        }

    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    inserts = []
    for gid, m in group_to_mention.items():
        if gid in sentiment_by_group:
            continue
        analyzed = analyze_sentiment_rule_v1(m.text, "")
        sentiment_by_group[gid] = {
            "score": float(analyzed["sentiment_score"]),
            "label": str(analyzed["sentiment_label"]),
            "confidence": float(analyzed["confidence"]),
        }
        inserts.append(
            (
                int(m.article_id),
                gid,
                float(analyzed["sentiment_score"]),
                str(analyzed["sentiment_label"]),
                float(analyzed["confidence"]),
                str(analyzed["method"]),
                now,
            )
        )

    if inserts:
        conn.executemany(
            """
            INSERT INTO sentiment_results (
                article_id, source_group_id, sentiment_score, sentiment_label, confidence, method, analyzed_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            inserts,
        )
        conn.commit()

    return sentiment_by_group


def _calc_summary(timeseries: list[dict[str, Any]], weights: dict[str, float]) -> dict[str, Any]:
    if not timeseries:
        return {
            "max_risk": 0.0,
            "max_risk_at": None,
            "avg_risk": 0.0,
            "p1_count": 0,
            "p1_total_hours": 0,
            "p2_count": 0,
            "dominant_component": "S",
        }

    max_row = max(timeseries, key=lambda x: float(x.get("risk_score", 0.0)))
    avg_risk = sum(float(x.get("risk_score", 0.0)) for x in timeseries) / max(len(timeseries), 1)
    p1_hours = sum(1 for x in timeseries if x.get("alert_level") == "P1")

    comp_acc = {"S": 0.0, "V": 0.0, "T": 0.0, "M": 0.0}
    for row in timeseries:
        comp = row.get("components", {})
        for k in comp_acc:
            comp_acc[k] += float(comp.get(k, 0.0)) * float(weights[k])
    dominant_component = max(comp_acc.items(), key=lambda kv: kv[1])[0]

    return {
        "max_risk": round(float(max_row.get("risk_score", 0.0)), 1),
        "max_risk_at": max_row.get("timestamp"),
        "avg_risk": round(float(avg_risk), 1),
        "p1_count": int(sum(1 for x in timeseries if x.get("alert_level") == "P1")),
        "p1_total_hours": int(p1_hours),
        "p2_count": int(sum(1 for x in timeseries if x.get("alert_level") == "P2")),
        "dominant_component": dominant_component,
    }


def _detect_events(timeseries: list[dict[str, Any]]) -> list[dict[str, Any]]:
    events: list[dict[str, Any]] = []
    prev = "P3"
    for row in timeseries:
        level = str(row.get("alert_level", "P3"))
        ts = str(row.get("timestamp", ""))
        score = float(row.get("risk_score", 0.0))
        if level != prev:
            if level in ("P1", "P2"):
                events.append({"timestamp": ts, "event": f"{level}_enter", "risk_score": round(score, 1), "trigger": "risk_threshold"})
            if prev in ("P1", "P2") and level not in (prev,):
                events.append({"timestamp": ts, "event": f"{prev}_exit", "risk_score": round(score, 1), "trigger": "risk_recovery"})
        prev = level
    return events


def run_backtest(
    ip_name: str,
    date_from: str,
    date_to: str,
    window_hours: int = 24,
    step_hours: int = 1,
    weights: dict[str, float] | None = None,
) -> dict[str, Any]:
    ip_resolved = _resolve_ip_name(ip_name)
    if not ip_resolved:
        raise ValueError("지원하지 않는 IP입니다.")
    if step_hours < 1 or step_hours > 24:
        raise ValueError("step_hours는 1~24 범위여야 합니다.")

    start = datetime.strptime(date_from, "%Y-%m-%d")
    end = datetime.strptime(date_to, "%Y-%m-%d") + timedelta(hours=23, minutes=59, seconds=59)
    if start > end:
        raise ValueError("date_from은 date_to보다 이전이어야 합니다.")

    norm_w = _normalize_weights(weights)
    baseline_start = start - timedelta(days=7)

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
            WHERE company = ? AND date BETWEEN ? AND ?
            ORDER BY COALESCE(pub_date, date, created_at) ASC, id ASC
            """,
            ("넥슨", baseline_start.strftime("%Y-%m-%d"), end.strftime("%Y-%m-%d")),
        ).fetchall()

        scoped: list[Mention] = []
        for r in rows:
            text = f"{r['title_clean'] or ''} {r['description_clean'] or ''}"
            if ip_resolved != "전체" and _detect_ip(text) != ip_resolved:
                continue
            dt = _parse_article_dt(str(r["pub_date"] or ""), str(r["date"] or ""))
            if not dt:
                continue
            gid = str(r["source_group_id"] or "") or f"legacy:{int(r['id'])}"
            scoped.append(
                Mention(
                    article_id=int(r["id"]),
                    dt=dt,
                    text=text.lower(),
                    outlet=str(r["outlet"] or "unknown"),
                    group_id=gid,
                )
            )

        sentiment_by_group = _ensure_group_sentiments(conn, scoped)
    finally:
        conn.close()

    prev_risk: float | None = None
    timeseries: list[dict[str, Any]] = []
    step = timedelta(hours=int(step_hours))
    window_delta = timedelta(hours=max(1, int(window_hours)))

    current = start
    while current <= end:
        window_start = current - window_delta
        window_mentions = [m for m in scoped if window_start <= m.dt <= current]
        mention_count = len(window_mentions)

        if mention_count == 0:
            raw = 0.0
            score = float(prev_risk * 0.9) if prev_risk is not None else 0.0
            components = {"S": 0.0, "V": 0.0, "T": 0.0, "M": 0.0}
            uncertain_ratio = 0.0
            dominant = "S"
        else:
            group_map: dict[str, Mention] = {}
            for m in window_mentions:
                group_map.setdefault(m.group_id, m)
            group_mentions = list(group_map.values())
            group_count = len(group_mentions)

            weighted_scores: list[float] = []
            uncertain_count = 0
            for m in group_mentions:
                entry = sentiment_by_group.get(
                    m.group_id,
                    {"score": 0.0, "label": "uncertain", "confidence": 0.0},
                )
                label = str(entry["label"])
                confidence = float(entry["confidence"])
                weight = confidence if label != "uncertain" else 0.3
                negative_value = max(0.0, -float(entry["score"]))
                weighted_scores.append(negative_value * weight)
                if label == "uncertain":
                    uncertain_count += 1
            S_t = float(sum(weighted_scores) / max(group_count, 1))
            uncertain_ratio = float(uncertain_count / max(group_count, 1))

            one_hour_start = current - timedelta(hours=1)
            count_1h = sum(1 for m in scoped if one_hour_start <= m.dt <= current)
            baseline_mentions = [m for m in scoped if (current - timedelta(days=7)) <= m.dt < current]
            hourly_counter: Counter[str] = Counter(m.dt.strftime("%Y-%m-%d %H") for m in baseline_mentions)
            same_hour_values = []
            for key, value in hourly_counter.items():
                dt_key = datetime.strptime(key, "%Y-%m-%d %H")
                if dt_key.hour == current.hour:
                    same_hour_values.append(value)
            baseline_values = same_hour_values if len(same_hour_values) >= 3 else list(hourly_counter.values())
            baseline_mean = float(sum(baseline_values) / max(len(baseline_values), 1))
            baseline_std = float(pd.Series(baseline_values).std(ddof=0)) if baseline_values else 0.0
            z_score = (float(count_1h) - baseline_mean) / max(baseline_std, 1.0)
            V_t = float(_sigmoid(z_score))

            theme_counter: Counter[str] = Counter()
            for m in group_mentions:
                for theme, keywords in RISK_THEME_RULES.items():
                    if any(k.lower() in m.text for k in keywords):
                        theme_counter[theme] += 1
                        break
            T_t = 0.0
            for theme, cnt in theme_counter.items():
                share = float(cnt) / max(group_count, 1)
                T_t += share * float(THEME_WEIGHTS.get(theme, 0.4))

            outlet_counter: Counter[str] = Counter(m.outlet for m in window_mentions)
            M_t = 0.0
            for outlet, cnt in outlet_counter.items():
                share = float(cnt) / max(mention_count, 1)
                M_t += share * _outlet_weight(outlet)

            raw = 100.0 * (
                norm_w["S"] * S_t
                + norm_w["V"] * V_t
                + norm_w["T"] * T_t
                + norm_w["M"] * M_t
            )

            if prev_risk is None:
                score = raw
            elif mention_count < 10:
                score = 0.9 * prev_risk + 0.1 * raw
            else:
                score = 0.7 * prev_risk + 0.3 * raw

            components = {
                "S": round(float(S_t), 3),
                "V": round(float(V_t), 3),
                "T": round(float(T_t), 3),
                "M": round(float(M_t), 3),
            }
            dominant = max(
                [("S", norm_w["S"] * S_t), ("V", norm_w["V"] * V_t), ("T", norm_w["T"] * T_t), ("M", norm_w["M"] * M_t)],
                key=lambda x: x[1],
            )[0]

        score = float(max(0.0, min(100.0, score)))
        alert = _alert_level(score)
        row = {
            "timestamp": current.strftime("%Y-%m-%dT%H:%M:%S"),
            "risk_score": round(float(score), 1),
            "raw_risk": round(float(raw), 1),
            "alert_level": alert,
            "components": components,
            "article_count": int(mention_count),
            "uncertain_ratio": round(float(uncertain_ratio), 3),
            "dominant_component": dominant,
        }
        timeseries.append(row)
        prev_risk = score
        current += step

    events = _detect_events(timeseries)
    summary = _calc_summary(timeseries, norm_w)
    period_mentions = [m for m in scoped if start <= m.dt <= end]
    unique_groups = {m.group_id for m in period_mentions}

    return {
        "meta": {
            "ip": ip_resolved,
            "ip_id": (ip_name or "").strip().lower(),
            "date_from": date_from,
            "date_to": date_to,
            "window_hours": int(window_hours),
            "step_hours": int(step_hours),
            "total_articles": int(len(period_mentions)),
            "unique_articles": int(len(unique_groups)),
            "total_steps": int(len(timeseries)),
            "weights": {k: round(float(v), 4) for k, v in norm_w.items()},
        },
        "timeseries": timeseries,
        "events": events,
        "summary": summary,
    }

