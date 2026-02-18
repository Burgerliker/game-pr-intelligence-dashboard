#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys

import pandas as pd

ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.append(str(ROOT_DIR))

from backend.analysis_project import CORE_IPS, build_project_snapshot
from backend.storage import init_db


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="DB 기반 넥슨 분석 스냅샷(JSON/CSV) 생성")
    parser.add_argument("--date-from", default="2024-01-01")
    parser.add_argument("--date-to", default="2026-12-31")
    parser.add_argument("--ips", default=",".join(CORE_IPS), help="쉼표 구분 IP slug")
    parser.add_argument("--out-dir", default="backend/data/exports")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    out_dir = Path(args.out_dir).resolve()
    out_dir.mkdir(parents=True, exist_ok=True)
    ips = [x.strip() for x in args.ips.split(",") if x.strip()]

    init_db()
    snapshot = build_project_snapshot(date_from=args.date_from, date_to=args.date_to, ips=ips)

    json_path = out_dir / "nexon_project_snapshot.json"
    with json_path.open("w", encoding="utf-8") as f:
        json.dump(snapshot, f, ensure_ascii=False, indent=2)

    pd.DataFrame(snapshot.get("ip_summaries", [])).to_csv(
        out_dir / "nexon_ip_summary.csv", index=False, encoding="utf-8-sig"
    )
    pd.DataFrame(snapshot.get("overall", {}).get("top_risk_themes", [])).to_csv(
        out_dir / "nexon_top_risk_themes.csv", index=False, encoding="utf-8-sig"
    )
    pd.DataFrame(snapshot.get("overall", {}).get("top_outlets", [])).to_csv(
        out_dir / "nexon_top_outlets.csv", index=False, encoding="utf-8-sig"
    )

    print(f"[ok] snapshot: {json_path}")
    print(f"[ok] total_articles: {snapshot.get('meta', {}).get('total_articles', 0)}")
    print(f"[ok] ips: {', '.join(ips)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
