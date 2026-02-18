#!/usr/bin/env bash
set -euo pipefail

ENV_FILE=".env.live"
COMPOSE_FILE="docker-compose.yml"
PROFILE="live"

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
    --profile)
      PROFILE="${2:-}"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1" >&2
      echo "Usage: bash scripts/preflight_deploy_live.sh [--env-file <path>] [--compose-file <path>] [--profile <name>]" >&2
      exit 1
      ;;
  esac
done

echo "[1/4] policy preflight"
bash scripts/preflight_env_check.sh --env-file "$ENV_FILE"

echo "[2/4] env drift check"
bash scripts/check_env_drift.sh --env-file "$ENV_FILE" --compose-file "$COMPOSE_FILE"

echo "[3/4] compose validation"
docker compose --env-file "$ENV_FILE" --profile "$PROFILE" -f "$COMPOSE_FILE" config >/dev/null

echo "[4/4] deployment smoke script syntax"
bash -n scripts/smoke_test.sh

echo "Preflight deploy check passed: env=$ENV_FILE compose=$COMPOSE_FILE profile=$PROFILE"
