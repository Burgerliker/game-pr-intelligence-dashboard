#!/usr/bin/env bash
set -euo pipefail

ENV_FILE=".env.live"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --env-file)
      ENV_FILE="${2:-}"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1" >&2
      echo "Usage: bash scripts/preflight_env_check.sh [--env-file <path>]" >&2
      exit 1
      ;;
  esac
done

if [[ ! -f "$ENV_FILE" ]]; then
  echo "env file not found: $ENV_FILE" >&2
  exit 1
fi

APP_ENV="${APP_ENV:-dev}"
ENABLE_DEBUG_ENDPOINTS="${ENABLE_DEBUG_ENDPOINTS:-0}"
ENABLE_MANUAL_COLLECTION="${ENABLE_MANUAL_COLLECTION:-0}"
CORS_ALLOW_ORIGINS="${CORS_ALLOW_ORIGINS:-}"
CORS_ALLOW_CREDENTIALS="${CORS_ALLOW_CREDENTIALS:-1}"

errors=()

is_unsafe_value() {
  local value="$1"
  [[ "$value" == *'$('* ]] && return 0
  [[ "$value" == *'`'* ]] && return 0
  [[ "$value" == *';'* ]] && return 0
  [[ "$value" == *'&&'* ]] && return 0
  [[ "$value" == *'||'* ]] && return 0
  [[ "$value" == *'|'* ]] && return 0
  [[ "$value" == *'<('* ]] && return 0
  [[ "$value" == *'>('* ]] && return 0
  return 1
}

line_no=0
while IFS= read -r line || [[ -n "$line" ]]; do
  line_no=$((line_no + 1))
  trimmed="$(printf '%s' "$line" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')"
  [[ -z "$trimmed" ]] && continue
  [[ "$trimmed" == \#* ]] && continue

  if [[ ! "$trimmed" =~ ^[A-Za-z_][A-Za-z0-9_]*= ]]; then
    errors+=("invalid env syntax at line $line_no")
    continue
  fi

  key="${trimmed%%=*}"
  raw_value="${trimmed#*=}"
  value="$(printf '%s' "$raw_value" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')"

  if is_unsafe_value "$value"; then
    errors+=("unsafe env value blocked for key: $key")
    continue
  fi

  if [[ "$value" == \"*\" ]]; then
    if [[ "$value" != *\" ]]; then
      errors+=("unterminated quote for key: $key")
      continue
    fi
    value="${value#\"}"
    value="${value%\"}"
  elif [[ "$value" == \'*\' ]]; then
    value="${value#\'}"
    value="${value%\'}"
  elif [[ "$value" == \"* || "$value" == \'* ]]; then
    errors+=("unterminated quote for key: $key")
    continue
  fi

  case "$key" in
    APP_ENV) APP_ENV="$value" ;;
    ENABLE_DEBUG_ENDPOINTS) ENABLE_DEBUG_ENDPOINTS="$value" ;;
    ENABLE_MANUAL_COLLECTION) ENABLE_MANUAL_COLLECTION="$value" ;;
    CORS_ALLOW_ORIGINS) CORS_ALLOW_ORIGINS="$value" ;;
    CORS_ALLOW_CREDENTIALS) CORS_ALLOW_CREDENTIALS="$value" ;;
    *) ;;
  esac
done < "$ENV_FILE"

APP_ENV_LC="$(printf '%s' "$APP_ENV" | tr '[:upper:]' '[:lower:]')"

if [[ "$ENABLE_DEBUG_ENDPOINTS" != "0" ]]; then
  errors+=("ENABLE_DEBUG_ENDPOINTS must be 0")
fi

if [[ "$ENABLE_MANUAL_COLLECTION" != "0" ]]; then
  errors+=("ENABLE_MANUAL_COLLECTION must be 0")
fi

if [[ -z "$CORS_ALLOW_ORIGINS" ]]; then
  errors+=("CORS_ALLOW_ORIGINS must not be empty")
fi

origins=()
if [[ -n "$CORS_ALLOW_ORIGINS" ]]; then
  IFS=',' read -r -a origins <<< "$CORS_ALLOW_ORIGINS"
fi
has_wildcard=0
for raw_origin in "${origins[@]-}"; do
  [[ -z "$raw_origin" ]] && continue
  origin="$(echo "$raw_origin" | xargs)"
  if [[ -z "$origin" ]]; then
    errors+=("CORS_ALLOW_ORIGINS contains empty origin")
    continue
  fi
  if [[ "$origin" == "*" ]]; then
    has_wildcard=1
    continue
  fi
  if [[ ! "$origin" =~ ^https?:// ]]; then
    errors+=("invalid CORS origin (must start with http:// or https://): $origin")
    continue
  fi
  if [[ "$APP_ENV_LC" == "prod" ]] && [[ "$origin" =~ localhost|127\.0\.0\.1|0\.0\.0\.0 ]]; then
    errors+=("APP_ENV=prod cannot include local CORS origin: $origin")
  fi
done

if [[ "$CORS_ALLOW_CREDENTIALS" == "1" && "$has_wildcard" == "1" ]]; then
  errors+=("CORS wildcard '*' cannot be used when CORS_ALLOW_CREDENTIALS=1")
fi

if (( ${#errors[@]} > 0 )); then
  echo "Preflight check failed: $ENV_FILE" >&2
  for err in "${errors[@]}"; do
    echo "- $err" >&2
  done
  exit 1
fi

echo "Preflight check passed: $ENV_FILE"
