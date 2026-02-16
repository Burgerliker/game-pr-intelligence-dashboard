#!/usr/bin/env bash
set -euo pipefail

MODE=""
BASE=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --mode)
      MODE="${2:-}"
      shift 2
      ;;
    --base)
      BASE="${2:-}"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

if [[ -z "$MODE" || -z "$BASE" ]]; then
  echo "Usage: bash scripts/smoke_test.sh --mode <live|backtest> --base <http://host:port>" >&2
  exit 1
fi

if [[ "$MODE" != "live" && "$MODE" != "backtest" ]]; then
  echo "mode must be live or backtest" >&2
  exit 1
fi

fetch_json() {
  local url="$1"
  local out
  out="$(curl -fsS "$url")" || {
    echo "Request failed: $url" >&2
    exit 1
  }
  echo "$out"
}

assert_json() {
  local payload="$1"
  local python_expr="$2"
  python3 - <<PY
import json
obj = json.loads('''$payload''')
assert ($python_expr), "assertion failed: $python_expr"
PY
}

echo "[1/4] health check"
HEALTH="$(fetch_json "$BASE/api/health")"
assert_json "$HEALTH" "obj.get('ok') is True"
assert_json "$HEALTH" "obj.get('mode') == '$MODE'"

echo "[2/4] scheduler-status check"
SCHED="$(fetch_json "$BASE/api/scheduler-status")"
assert_json "$SCHED" "obj.get('running') is True"
assert_json "$SCHED" "isinstance(obj.get('jobs'), list) and len(obj.get('jobs')) > 0"

echo "[3/4] risk-score check"
RISK="$(fetch_json "$BASE/api/risk-score?ip=maplestory")"
assert_json "$RISK" "'risk_score' in obj and 'raw_risk' in obj and 'article_count_window' in obj and 'spread_ratio' in obj"

if [[ "$MODE" == "backtest" ]]; then
  echo "[4/4] backtest check"
  BT="$(fetch_json "$BASE/api/backtest?ip=maplestory&date_from=2025-11-01&date_to=2026-02-10&step_hours=6")"
  assert_json "$BT" "'summary' in obj and isinstance(obj['summary'], dict) and obj['summary'].get('max_risk') is not None"
else
  echo "[4/4] backtest check skipped in live mode"
fi

echo "Smoke test passed: mode=$MODE base=$BASE"
