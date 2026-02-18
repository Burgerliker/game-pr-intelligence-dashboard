#!/usr/bin/env python3
from __future__ import annotations

from datetime import UTC, datetime, timedelta
from pathlib import Path
import sys

import pandas as pd

ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.append(str(ROOT_DIR))

from backend.main import _build_payload


def _build_fixture_df() -> pd.DataFrame:
    now = datetime.now(UTC)
    return pd.DataFrame(
        [
            {
                "company": "넥슨",
                "title_clean": "메이플 업데이트 호평",
                "description_clean": "이용자 반응 긍정",
                "originallink": "https://example.com/1",
                "pubDate_parsed": (now - timedelta(hours=2)).isoformat(),
                "date": (now - timedelta(hours=2)).strftime("%Y-%m-%d"),
                "sentiment": "긍정",
            },
            {
                "company": "넥슨",
                "title_clean": "서비스 점검 안내",
                "description_clean": "장애 복구 완료",
                "originallink": "https://example.com/2",
                "pubDate_parsed": (now - timedelta(hours=1)).isoformat(),
                "date": (now - timedelta(hours=1)).strftime("%Y-%m-%d"),
                "sentiment": "불확실",
            },
            {
                "company": "넷마블",
                "title_clean": "신작 출시 예고",
                "description_clean": "관심 증가",
                "originallink": "https://example.com/3",
                "pubDate_parsed": (now - timedelta(hours=3)).isoformat(),
                "date": (now - timedelta(hours=3)).strftime("%Y-%m-%d"),
                "sentiment": "중립",
            },
        ]
    )


def _frontend_sentiment_map(sentiment_rows: list[dict]) -> dict[str, dict[str, float]]:
    out: dict[str, dict[str, float]] = {}
    for row in sentiment_rows:
        company = str(row.get("company", ""))
        if company not in out:
            out[company] = {"긍정": 0.0, "중립": 0.0, "부정": 0.0, "total": 0.0}
        sentiment = str(row.get("sentiment", ""))
        out[company][sentiment] = float(row.get("ratio", 0.0) or 0.0)
        out[company]["total"] += float(row.get("count", 0) or 0)
    return out


def main() -> None:
    selected = ["넥슨", "NC소프트", "넷마블", "크래프톤"]
    payload = _build_payload(_build_fixture_df(), selected)

    counts = payload["company_counts"]
    assert counts["NC소프트"] == 0
    assert counts["크래프톤"] == 0
    assert payload["meta"]["total_articles"] == 3
    assert sum(int(v) for v in counts.values()) == payload["meta"]["total_articles"]

    sentiment_rows = payload["sentiment_summary"]
    rows_by_company: dict[str, list[dict]] = {c: [] for c in selected}
    for row in sentiment_rows:
        company = str(row.get("company", ""))
        if company in rows_by_company:
            rows_by_company[company].append(row)

    for company in selected:
        rows = rows_by_company[company]
        assert len(rows) == 3, f"expected 3 sentiment rows: {company}"
        labels = {str(r.get("sentiment")) for r in rows}
        assert labels == {"긍정", "중립", "부정"}, f"unexpected labels: {company} -> {labels}"
        count_sum = sum(int(r.get("count", 0) or 0) for r in rows)
        assert count_sum == int(counts[company]), f"count mismatch: {company}"
        if int(counts[company]) == 0:
            assert all(float(r.get("ratio", 0.0) or 0.0) == 0.0 for r in rows), f"ratio must be 0: {company}"

    # Frontend reducer compatibility check for NC소프트(0건)
    sentiment_map = _frontend_sentiment_map(sentiment_rows)
    nc_row = sentiment_map.get("NC소프트") or {"긍정": 0.0, "중립": 0.0, "부정": 0.0}
    assert nc_row["긍정"] == 0.0 and nc_row["중립"] == 0.0 and nc_row["부정"] == 0.0

    print("PASS: compare-live 0건 회사 정합성 검증 완료")


if __name__ == "__main__":
    main()
