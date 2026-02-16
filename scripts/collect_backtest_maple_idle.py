#!/usr/bin/env python3
from __future__ import annotations

import argparse
import os
from pathlib import Path
import sys

import pandas as pd

ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.append(str(ROOT_DIR))

from backend.storage import init_db, save_articles
from services.naver_api import fetch_maple_idle_backtest_news, get_last_api_error


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="메이플키우기 백테스트용 과거 기사 수집 스크립트")
    parser.add_argument("--date-from", default="2025-11-01")
    parser.add_argument("--date-to", default="2026-02-10")
    parser.add_argument("--date-pages", type=int, default=10, help="쿼리당 sort=date 페이지 수")
    parser.add_argument("--sim-pages", type=int, default=5, help="쿼리당 sort=sim 페이지 수")
    parser.add_argument("--page-size", type=int, default=100, help="호출당 기사 수(최대 100)")
    parser.add_argument("--max-calls", type=int, default=1000, help="최대 API 호출 수")
    parser.add_argument("--db-path", default="", help="백테스트 DB 경로(예: backend/data/articles_backtest.db)")
    parser.add_argument("--csv-out", default="backend/data/exports/maple_idle_backtest_raw.csv")
    parser.add_argument("--dry-run", action="store_true", help="DB 저장 없이 수집/필터 결과만 확인")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    if args.db_path:
        os.environ["PR_DB_PATH"] = args.db_path

    init_db()
    df, stats = fetch_maple_idle_backtest_news(
        date_from=args.date_from,
        date_to=args.date_to,
        date_pages=args.date_pages,
        sim_pages=args.sim_pages,
        page_size=args.page_size,
        max_calls=args.max_calls,
    )

    exports_dir = Path(args.csv_out).resolve().parent
    exports_dir.mkdir(parents=True, exist_ok=True)
    out_csv = Path(args.csv_out).resolve()
    if df.empty:
        print("[warn] 수집 결과가 비어 있습니다.")
        api_error = get_last_api_error()
        if api_error:
            print(f"[warn] last_api_error: {api_error}")
        print(f"[stats] {stats}")
        return 0

    # 참고용 원본 CSV 저장
    csv_df = df.copy()
    if "pubDate_parsed" in csv_df.columns:
        csv_df["pubDate_parsed"] = pd.to_datetime(csv_df["pubDate_parsed"], errors="coerce").dt.strftime("%Y-%m-%d %H:%M:%S")
    csv_df.to_csv(out_csv, index=False, encoding="utf-8-sig")

    print(f"[ok] filtered_rows: {len(df)}")
    print(f"[ok] raw_csv: {out_csv}")
    print(f"[stats] calls={stats.get('calls')} raw_items={stats.get('raw_items')} filtered_items={stats.get('filtered_items')}")
    print(f"[stats] period_hints={', '.join(stats.get('period_hints', []))}")

    if args.dry_run:
        print("[ok] dry-run 모드라 DB 저장은 생략했습니다.")
        return 0

    saved = save_articles(df)
    print(f"[ok] db_inserted: {saved}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

