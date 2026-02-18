#!/usr/bin/env bash
set -euo pipefail

ENV_FILE=".env.live"
APP_ENV_OVERRIDE=""
HEALTH_URL_OVERRIDE=""
FRONTEND_ORIGIN=""
TIMEOUT_SEC=6

usage() {
  echo "Usage: bash scripts/preflight_ops_check.sh [--env-file <path>] [--app-env <dev|prod>] [--health-url <url>] [--frontend-origin <origin>] [--timeout-sec <n>]" >&2
}

fail() {
  local code="$1"
  local msg="$2"
  echo "[$code] $msg" >&2
  exit 1
}

warn() {
  local code="$1"
  local msg="$2"
  echo "[${code}] $msg"
}

trim() {
  local s="$1"
  s="$(printf '%s' "$s" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')"
  printf '%s' "$s"
}

parse_env_value() {
  local key="$1"
  local file="$2"
  local line
  line="$(awk -v key="$key" '
    /^[[:space:]]*#/ { next }
    /^[[:space:]]*$/ { next }
    {
      raw=$0
      gsub(/^[[:space:]]+/, "", raw)
      if (index(raw, key "=") != 1) next
      sub(/^[^=]*=/, "", raw)
      print raw
      exit
    }
  ' "$file")"
  line="$(trim "$line")"
  if [[ "$line" == \"*\" && "$line" == *\" ]]; then
    line="${line#\"}"
    line="${line%\"}"
  elif [[ "$line" == \'*\' ]]; then
    line="${line#\'}"
    line="${line%\'}"
  fi
  printf '%s' "$line"
}

is_local_host() {
  local host="$1"
  [[ "$host" =~ ^localhost$|^127\.[0-9]+\.[0-9]+\.[0-9]+$|^0\.0\.0\.0$ ]]
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --env-file)
      ENV_FILE="${2:-}"
      shift 2
      ;;
    --app-env)
      APP_ENV_OVERRIDE="${2:-}"
      shift 2
      ;;
    --health-url)
      HEALTH_URL_OVERRIDE="${2:-}"
      shift 2
      ;;
    --frontend-origin)
      FRONTEND_ORIGIN="${2:-}"
      shift 2
      ;;
    --timeout-sec)
      TIMEOUT_SEC="${2:-}"
      shift 2
      ;;
    *)
      usage
      fail "OPS-E000" "unknown argument: $1"
      ;;
  esac
done

[[ -f "$ENV_FILE" ]] || fail "OPS-E001" "env file not found: $ENV_FILE"

NEXT_PUBLIC_API_BASE_URL="$(parse_env_value "NEXT_PUBLIC_API_BASE_URL" "$ENV_FILE")"
APP_ENV_FROM_FILE="$(parse_env_value "APP_ENV" "$ENV_FILE")"
CORS_ALLOW_ORIGINS="$(parse_env_value "CORS_ALLOW_ORIGINS" "$ENV_FILE")"
CORS_ALLOW_CREDENTIALS="$(parse_env_value "CORS_ALLOW_CREDENTIALS" "$ENV_FILE")"

APP_ENV="$(printf '%s' "${APP_ENV_OVERRIDE:-${APP_ENV_FROM_FILE:-dev}}" | tr '[:upper:]' '[:lower:]')"
[[ -n "$NEXT_PUBLIC_API_BASE_URL" ]] || fail "OPS-E002" "NEXT_PUBLIC_API_BASE_URL is empty"

if ! parsed_api="$(python3 -c 'import sys, urllib.parse as u; p=u.urlparse(sys.argv[1]); 
print((p.scheme or "")+"|"+(p.hostname or ""))' "$NEXT_PUBLIC_API_BASE_URL" 2>/dev/null)"; then
  fail "OPS-E003" "NEXT_PUBLIC_API_BASE_URL is not a valid URL: $NEXT_PUBLIC_API_BASE_URL"
fi
API_SCHEME="${parsed_api%%|*}"
API_HOST="${parsed_api##*|}"
[[ -n "$API_SCHEME" && -n "$API_HOST" ]] || fail "OPS-E003" "NEXT_PUBLIC_API_BASE_URL is not a valid URL: $NEXT_PUBLIC_API_BASE_URL"

if [[ "$APP_ENV" == "prod" ]] && is_local_host "$API_HOST"; then
  fail "OPS-E004" "APP_ENV=prod forbids localhost API base URL: $NEXT_PUBLIC_API_BASE_URL"
fi

if [[ "$APP_ENV" == "prod" && "$API_SCHEME" != "https" ]]; then
  warn "OPS-W101" "APP_ENV=prod recommends https API base URL (current: $NEXT_PUBLIC_API_BASE_URL)"
fi

HEALTH_URL="$HEALTH_URL_OVERRIDE"
if [[ -z "$HEALTH_URL" ]]; then
  HEALTH_URL="${NEXT_PUBLIC_API_BASE_URL%/}/api/health"
fi

HEALTH_BODY_FILE="$(mktemp)"
HTTP_CODE="$(curl -sS -m "$TIMEOUT_SEC" -o "$HEALTH_BODY_FILE" -w "%{http_code}" "$HEALTH_URL" || true)"
if [[ "$HTTP_CODE" == "000" ]]; then
  rm -f "$HEALTH_BODY_FILE"
  fail "OPS-E005" "health endpoint unreachable: $HEALTH_URL"
fi
if [[ "$HTTP_CODE" != "200" ]]; then
  body_preview="$(head -c 240 "$HEALTH_BODY_FILE" || true)"
  rm -f "$HEALTH_BODY_FILE"
  fail "OPS-E006" "health endpoint returned HTTP $HTTP_CODE: ${body_preview:-<empty>}"
fi

if ! python3 - "$HEALTH_BODY_FILE" <<'PY' >/dev/null
import json, sys
p = sys.argv[1]
with open(p, "r", encoding="utf-8") as f:
    raw = f.read().strip()
if not raw:
    raise SystemExit(2)
obj = json.loads(raw)
ok = obj.get("ok", None)
if ok is False:
    raise SystemExit(3)
PY
then
  rm -f "$HEALTH_BODY_FILE"
  fail "OPS-E007" "health payload is invalid or reports unhealthy state"
fi
rm -f "$HEALTH_BODY_FILE"

echo "[CHECKLIST] CORS preflight"
echo "1) CORS_ALLOW_ORIGINS includes deployed frontend origin(s)"
echo "2) CORS_ALLOW_CREDENTIALS=1이면 wildcard(*) 금지"
echo "3) prod에서는 localhost origin 미사용"

[[ -n "$CORS_ALLOW_ORIGINS" ]] || fail "OPS-E008" "CORS_ALLOW_ORIGINS is empty in $ENV_FILE"
CORS_ALLOW_CREDENTIALS="${CORS_ALLOW_CREDENTIALS:-1}"
if [[ "$CORS_ALLOW_CREDENTIALS" == "1" && "$CORS_ALLOW_ORIGINS" == *"*"* ]]; then
  fail "OPS-E009" "CORS_ALLOW_CREDENTIALS=1 cannot be used with wildcard origin"
fi

IFS=',' read -r -a ORIGIN_ITEMS <<< "$CORS_ALLOW_ORIGINS"
FOUND_FRONTEND_ORIGIN=0
for raw_origin in "${ORIGIN_ITEMS[@]}"; do
  origin="$(trim "$raw_origin")"
  [[ -n "$origin" ]] || fail "OPS-E010" "CORS_ALLOW_ORIGINS contains empty item"
  [[ "$origin" == "*" || "$origin" =~ ^https?:// ]] || fail "OPS-E010" "invalid CORS origin format: $origin"
  if [[ "$APP_ENV" == "prod" ]] && [[ "$origin" =~ localhost|127\.0\.0\.1|0\.0\.0\.0 ]]; then
    fail "OPS-E011" "prod CORS cannot include local origin: $origin"
  fi
  if [[ -n "$FRONTEND_ORIGIN" && "$origin" == "$FRONTEND_ORIGIN" ]]; then
    FOUND_FRONTEND_ORIGIN=1
  fi
done

if [[ -n "$FRONTEND_ORIGIN" && "$FOUND_FRONTEND_ORIGIN" != "1" ]]; then
  fail "OPS-E012" "frontend origin not found in CORS_ALLOW_ORIGINS: $FRONTEND_ORIGIN"
fi

echo "OPS preflight passed: env=$ENV_FILE app_env=$APP_ENV health=$HEALTH_URL"
