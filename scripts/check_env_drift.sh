#!/usr/bin/env bash
set -euo pipefail

ENV_FILE=".env.live"
COMPOSE_FILE="docker-compose.yml"
BASELINE_ENV_FILE=".env.example"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --env-file)
      ENV_FILE="${2:-}"
      shift 2
      ;;
    --compose-file)
      COMPOSE_FILE="${2:-}"
      shift 2
      ;;
    --baseline-env-file)
      BASELINE_ENV_FILE="${2:-}"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1" >&2
      echo "Usage: bash scripts/check_env_drift.sh [--env-file <path>] [--compose-file <path>] [--baseline-env-file <path>]" >&2
      exit 1
      ;;
  esac
done

if [[ ! -f "$ENV_FILE" ]]; then
  echo "env file not found: $ENV_FILE" >&2
  exit 1
fi
if [[ ! -f "$COMPOSE_FILE" ]]; then
  echo "compose file not found: $COMPOSE_FILE" >&2
  exit 1
fi
if [[ -n "${BASELINE_ENV_FILE:-}" && ! -f "$BASELINE_ENV_FILE" ]]; then
  echo "baseline env file not found: $BASELINE_ENV_FILE" >&2
  exit 1
fi

extract_env_keys() {
  grep -E '^[A-Z0-9_]+=' "$1" | cut -d= -f1 | sort -u
}

extract_compose_keys() {
  { grep -Eo '\$\{[A-Z0-9_]+(:-[^}]*)?\}' "$1" || true; } \
    | sed -E 's/^\$\{([A-Z0-9_]+).*/\1/' \
    | sort -u
}

extract_compose_keys_without_default() {
  { grep -Eo '\$\{[A-Z0-9_]+\}' "$1" || true; } \
    | sed -E 's/^\$\{([A-Z0-9_]+)\}$/\1/' \
    | sort -u
}

extract_runtime_keys_python() {
  { rg -n 'os\.getenv\("[A-Z0-9_]+"' backend services utils || true; } \
    | sed -E 's/.*os\.getenv\("([A-Z0-9_]+)".*/\1/' \
    | sort -u
}

extract_runtime_keys_frontend() {
  { rg -n 'process\.env\.[A-Z0-9_]+' frontend || true; } \
    | sed -E 's/.*process\.env\.([A-Z0-9_]+).*/\1/' \
    | sort -u
}

ENV_KEYS="$(mktemp)"
COMPOSE_KEYS="$(mktemp)"
COMPOSE_REQUIRED_KEYS="$(mktemp)"
RUNTIME_KEYS="$(mktemp)"
TMP_A="$(mktemp)"
TMP_B="$(mktemp)"
trap 'rm -f "$ENV_KEYS" "$COMPOSE_KEYS" "$COMPOSE_REQUIRED_KEYS" "$RUNTIME_KEYS" "$TMP_A" "$TMP_B"' EXIT

{
  extract_env_keys "$ENV_FILE"
  if [[ -n "${BASELINE_ENV_FILE:-}" ]]; then
    extract_env_keys "$BASELINE_ENV_FILE"
  fi
} | sort -u > "$ENV_KEYS"
extract_compose_keys "$COMPOSE_FILE" > "$COMPOSE_KEYS"
extract_compose_keys_without_default "$COMPOSE_FILE" > "$COMPOSE_REQUIRED_KEYS"
{
  extract_runtime_keys_python
  extract_runtime_keys_frontend
} | sort -u > "$RUNTIME_KEYS"

errors=0
warnings=0

MISSING_REQUIRED_COMPOSE="$(comm -23 "$COMPOSE_REQUIRED_KEYS" "$ENV_KEYS" || true)"
if [[ -n "$MISSING_REQUIRED_COMPOSE" ]]; then
  echo "[ERROR] required by compose (no default), missing in $ENV_FILE:" >&2
  echo "$MISSING_REQUIRED_COMPOSE" | sed 's/^/  - /' >&2
  errors=$((errors + 1))
fi

MISSING_RUNTIME="$(comm -23 "$RUNTIME_KEYS" "$ENV_KEYS" || true)"
if [[ -n "$MISSING_RUNTIME" ]]; then
  echo "[WARN] runtime env keys not declared in $ENV_FILE:" >&2
  echo "$MISSING_RUNTIME" | sed 's/^/  - /' >&2
  warnings=$((warnings + 1))
fi

UNUSED_ENV="$(comm -23 "$ENV_KEYS" <(sort -u "$COMPOSE_KEYS" "$RUNTIME_KEYS") || true)"
if [[ -n "$UNUSED_ENV" ]]; then
  echo "[WARN] keys in $ENV_FILE not referenced by compose/runtime:" >&2
  echo "$UNUSED_ENV" | sed 's/^/  - /' >&2
  warnings=$((warnings + 1))
fi

echo "Env drift summary: env_file=$ENV_FILE baseline_env_file=${BASELINE_ENV_FILE:-none} compose_file=$COMPOSE_FILE errors=$errors warnings=$warnings"

if [[ $errors -gt 0 ]]; then
  exit 1
fi
