#!/usr/bin/env bash
set -euo pipefail

API_BASE="https://api.game-pr-dashboard.cloud"
FRONTEND_ORIGIN="https://www.game-pr-dashboard.cloud"
OUT_FILE=""
COMPARE_FILE=""

usage() {
  cat <<'EOF'
Usage:
  bash scripts/ops_external_smoke.sh [--api-base <url>] [--frontend-origin <origin>] [--out <file>] [--compare <file>]

Examples:
  bash scripts/ops_external_smoke.sh --out /tmp/smoke_t10.json
  bash scripts/ops_external_smoke.sh --out /tmp/smoke_t30.json --compare /tmp/smoke_t10.json
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --api-base)
      API_BASE="${2:-}"
      shift 2
      ;;
    --frontend-origin)
      FRONTEND_ORIGIN="${2:-}"
      shift 2
      ;;
    --out)
      OUT_FILE="${2:-}"
      shift 2
      ;;
    --compare)
      COMPARE_FILE="${2:-}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "Missing required command: $1" >&2
    exit 1
  }
}

need_cmd curl
need_cmd jq
need_cmd python3

UTC_NOW="$(date -u '+%Y-%m-%d %H:%M:%S')"
KST_NOW="$(TZ=Asia/Seoul date '+%Y-%m-%d %H:%M:%S')"

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

HEALTH_BODY="$TMP_DIR/health.json"
SCHED_BODY="$TMP_DIR/scheduler.json"
CORS_HEAD="$TMP_DIR/cors_head.txt"

HEALTH_CODE="$(curl -sS -m 20 -o "$HEALTH_BODY" -w "%{http_code}" "$API_BASE/api/health" || true)"
SCHED_CODE="$(curl -sS -m 20 -o "$SCHED_BODY" -w "%{http_code}" "$API_BASE/api/scheduler-status" || true)"
curl -i -sS -m 20 -X OPTIONS "$API_BASE/api/health" \
  -H "Origin: $FRONTEND_ORIGIN" \
  -H 'Access-Control-Request-Method: GET' \
  -H 'Access-Control-Request-Headers: content-type' > "$CORS_HEAD" || true

if [[ "$HEALTH_CODE" != "200" ]]; then
  HEALTH_PASS=false
else
  HEALTH_PASS="$(
    jq -r '
      (has("ok") and has("mode") and has("scheduler_running") and has("scheduler_job_count") and has("scheduler_log_fallback_count")) and
      ((.ok|type)=="boolean") and ((.mode|type)=="string") and
      ((.scheduler_running|type)=="boolean") and ((.scheduler_job_count|type)=="number") and ((.scheduler_log_fallback_count|type)=="number")
    ' "$HEALTH_BODY" 2>/dev/null || echo false
  )"
fi

if [[ "$SCHED_CODE" != "200" ]]; then
  SCHED_PASS=false
else
  SCHED_PASS="$(
    jq -r '
      (has("running") and has("job_count") and has("jobs")) and
      ((.running|type)=="boolean") and ((.job_count|type)=="number") and ((.jobs|type)=="array") and
      ((.jobs|length) > 0) and
      (
        (.jobs[0] | has("id") and has("ip_id") and has("next_run_time") and has("last_run_time") and has("last_status") and has("error_message") and has("last_error") and has("last_collect_count") and has("last_group_count") and has("last_collect_duration_ms"))
      )
    ' "$SCHED_BODY" 2>/dev/null || echo false
  )"
fi

CORS_STATUS="$(awk 'NR==1 {print $2}' "$CORS_HEAD")"
CORS_ALLOW_ORIGIN="$(awk -F': ' 'tolower($1)=="access-control-allow-origin"{gsub("\r","",$2); print $2}' "$CORS_HEAD" | head -n1)"
CORS_ALLOW_CREDENTIALS="$(awk -F': ' 'tolower($1)=="access-control-allow-credentials"{gsub("\r","",$2); print $2}' "$CORS_HEAD" | head -n1)"
if [[ "${CORS_STATUS:-}" == "200" && "${CORS_ALLOW_ORIGIN:-}" == "$FRONTEND_ORIGIN" && "${CORS_ALLOW_CREDENTIALS:-}" == "true" ]]; then
  CORS_PASS=true
else
  CORS_PASS=false
fi

OVERALL="Go"
P1_LIST=()
if [[ "$HEALTH_PASS" != "true" ]]; then
  OVERALL="No-Go"
  P1_LIST+=("health 계약 실패(code=${HEALTH_CODE})")
fi
if [[ "$SCHED_PASS" != "true" ]]; then
  OVERALL="No-Go"
  P1_LIST+=("scheduler 계약 실패(code=${SCHED_CODE})")
fi
if [[ "$CORS_PASS" != "true" ]]; then
  OVERALL="No-Go"
  P1_LIST+=("CORS 실패(status=${CORS_STATUS:-NA}, allow_origin=${CORS_ALLOW_ORIGIN:-NA})")
fi

RESULT_JSON="$TMP_DIR/result.json"
jq -n \
  --arg utc "$UTC_NOW" \
  --arg kst "$KST_NOW" \
  --arg api_base "$API_BASE" \
  --arg frontend_origin "$FRONTEND_ORIGIN" \
  --argjson health_pass "$HEALTH_PASS" \
  --argjson scheduler_pass "$SCHED_PASS" \
  --argjson cors_pass "$CORS_PASS" \
  --arg health_code "$HEALTH_CODE" \
  --arg sched_code "$SCHED_CODE" \
  --arg cors_status "${CORS_STATUS:-}" \
  --arg cors_allow_origin "${CORS_ALLOW_ORIGIN:-}" \
  --arg cors_allow_credentials "${CORS_ALLOW_CREDENTIALS:-}" \
  --arg overall "$OVERALL" \
  --argjson p1 "$(printf '%s\n' "${P1_LIST[@]:-}" | jq -R -s 'split("\n") | map(select(length>0))')" \
  --slurpfile health "$HEALTH_BODY" \
  --slurpfile sched "$SCHED_BODY" \
  '{
    timestamp_utc: $utc,
    timestamp_kst: $kst,
    api_base: $api_base,
    frontend_origin: $frontend_origin,
    checks: {
      health: { pass: $health_pass, http_code: ($health_code|tonumber) },
      scheduler: { pass: $scheduler_pass, http_code: ($sched_code|tonumber) },
      cors: {
        pass: $cors_pass,
        status: ($cors_status|tonumber),
        allow_origin: $cors_allow_origin,
        allow_credentials: $cors_allow_credentials
      }
    },
    health_payload: ($health[0] // {}),
    scheduler_payload: ($sched[0] // {}),
    issues: { p1: $p1, p2: [], p3: [] },
    verdict: $overall
  }' > "$RESULT_JSON"

echo "기준 시각:"
echo "- UTC $UTC_NOW"
echo "- KST $KST_NOW"
echo
echo "항목별 Pass/Fail:"
echo "- health: $([[ "$HEALTH_PASS" == "true" ]] && echo Pass || echo Fail)"
echo "- scheduler: $([[ "$SCHED_PASS" == "true" ]] && echo Pass || echo Fail)"
echo "- cors: $([[ "$CORS_PASS" == "true" ]] && echo Pass || echo Fail)"
echo
echo "P1/P2/P3:"
jq -r '.issues | "- P1: " + (if (.p1|length)==0 then "없음" else (.p1|join("; ")) end) + "\n- P2: 없음\n- P3: 없음"' "$RESULT_JSON"
echo
echo "최종 Go/No-Go: $OVERALL"

if [[ -n "$COMPARE_FILE" ]]; then
  if [[ ! -f "$COMPARE_FILE" ]]; then
    echo "compare file not found: $COMPARE_FILE" >&2
    exit 1
  fi
  echo
  echo "T+재검증 차이:"
  python3 - "$COMPARE_FILE" "$RESULT_JSON" <<'PY'
import json
import sys

prev = json.load(open(sys.argv[1], "r", encoding="utf-8"))
curr = json.load(open(sys.argv[2], "r", encoding="utf-8"))

keys = [
    ("health.scheduler_running", prev.get("health_payload", {}).get("scheduler_running"), curr.get("health_payload", {}).get("scheduler_running")),
    ("health.scheduler_job_count", prev.get("health_payload", {}).get("scheduler_job_count"), curr.get("health_payload", {}).get("scheduler_job_count")),
    ("health.cors_allow_origins", prev.get("health_payload", {}).get("cors_allow_origins"), curr.get("health_payload", {}).get("cors_allow_origins")),
    ("scheduler.running", prev.get("scheduler_payload", {}).get("running"), curr.get("scheduler_payload", {}).get("running")),
    ("scheduler.job_count", prev.get("scheduler_payload", {}).get("job_count"), curr.get("scheduler_payload", {}).get("job_count")),
    ("scheduler.jobs.length", len(prev.get("scheduler_payload", {}).get("jobs", [])), len(curr.get("scheduler_payload", {}).get("jobs", []))),
    ("cors.allow_origin", prev.get("checks", {}).get("cors", {}).get("allow_origin"), curr.get("checks", {}).get("cors", {}).get("allow_origin")),
]

changed = False
for name, p, c in keys:
    if p != c:
        changed = True
        print(f"- CHANGED {name}: {p!r} -> {c!r}")
if not changed:
    print("- 변경 없음 (필드/상태/오리진 동일)")
PY
fi

if [[ -n "$OUT_FILE" ]]; then
  cp "$RESULT_JSON" "$OUT_FILE"
  echo
  echo "실행 로그(JSON) 저장: $OUT_FILE"
fi

