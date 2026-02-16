from __future__ import annotations

from datetime import datetime
from typing import Any

import pandas as pd

from backend.storage import get_ip_clusters, get_risk_dashboard

CORE_IPS = ["maplestory", "dnf", "arcraiders", "bluearchive", "fconline"]
THEME_ACTION_MAP = {
    "확률형/BM": "확률·검증·산식 근거를 표준 포맷으로 공개하고 FAQ를 동시 업데이트",
    "운영/장애": "장애 타임라인(발생-조치-복구)과 재발방지 조치를 공지에 고정",
    "보상/환불": "보상 대상·기준·예외를 표로 명확히 공지하고 후속 질의 대응",
    "규제/법적": "팩트 중심 공식 입장문과 법적 쟁점 Q&A를 분리 배포",
    "여론/논란": "오해 포인트 정정 카드와 채널별 동일 메시지 배포",
    "신작/성과": "성과 메시지와 리스크 메시지를 분리해 커뮤니케이션",
}


def build_project_snapshot(
    *,
    date_from: str = "2024-01-01",
    date_to: str = "2026-12-31",
    ips: list[str] | None = None,
) -> dict[str, Any]:
    target_ips = ips or CORE_IPS

    overall = get_risk_dashboard(date_from=date_from, date_to=date_to, ip="all")
    ip_summaries: list[dict[str, Any]] = []

    for ip in target_ips:
        risk = get_risk_dashboard(date_from=date_from, date_to=date_to, ip=ip)
        clusters = get_ip_clusters(date_from=date_from, date_to=date_to, ip=ip, limit=6)
        top_theme = (risk.get("risk_themes") or [{}])[0]
        ip_summaries.append(
            {
                "ip_id": ip,
                "ip_name": risk.get("meta", {}).get("ip", ip),
                "total_articles": int(risk.get("meta", {}).get("total_articles", 0)),
                "top_risk_theme": top_theme.get("theme", "-"),
                "top_risk_score": float(top_theme.get("risk_score", 0)),
                "cluster_count": int(clusters.get("meta", {}).get("cluster_count", 0)),
                "top_cluster": ((clusters.get("clusters") or [{}])[0]).get("cluster", "-"),
            }
        )

    ip_summaries.sort(key=lambda x: (x["top_risk_score"], x["total_articles"]), reverse=True)

    daily = overall.get("daily") or []
    daily_df = pd.DataFrame(daily) if daily else pd.DataFrame(columns=["date", "article_count", "negative_ratio"])
    if not daily_df.empty:
        daily_df["article_count"] = pd.to_numeric(daily_df["article_count"], errors="coerce").fillna(0)
        daily_df["negative_ratio"] = pd.to_numeric(daily_df["negative_ratio"], errors="coerce").fillna(0)
        peak_idx = int(daily_df["article_count"].idxmax())
        peak_row = daily_df.iloc[peak_idx].to_dict()
    else:
        peak_row = {"date": "-", "article_count": 0, "negative_ratio": 0}

    snapshot = {
        "meta": {
            "generated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "date_from": date_from,
            "date_to": date_to,
            "scope": "nexon_only",
            "total_articles": int(overall.get("meta", {}).get("total_articles", 0)),
        },
        "overall": {
            "peak_day": peak_row,
            "top_risk_themes": overall.get("risk_themes", [])[:5],
            "top_outlets": overall.get("outlets", [])[:10],
        },
        "ip_summaries": ip_summaries,
        "recommended_actions": [
            {
                "theme": item.get("theme", "-"),
                "risk_score": item.get("risk_score", 0),
                "action": THEME_ACTION_MAP.get(item.get("theme", ""), "핵심 팩트와 대응 일정을 명확히 공지"),
            }
            for item in (overall.get("risk_themes") or [])[:3]
        ],
    }
    return snapshot
