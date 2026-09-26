#!/usr/bin/env bash
# ============================================================================
# 端到端验收：迁移 → 启动 API → 权限/RLS/审计 矩阵
# 需要：一个可达的 PostgreSQL + 目标库（建议独立空库）。
#
# 用法：
#   export DATABASE_URL_ADMIN='postgres://postgres:pw@127.0.0.1:5432/scaffold_e2e'
#   export DATABASE_URL_APP='postgres://app_user:app_user_pw@127.0.0.1:5432/scaffold_e2e'
#   bash deploy/e2e.sh
#
# 前置（若库不存在）：
#   createdb scaffold_e2e
# ============================================================================
set -uo pipefail

: "${DATABASE_URL_ADMIN:?需要 DATABASE_URL_ADMIN}"
: "${DATABASE_URL_APP:?需要 DATABASE_URL_APP}"

API_PORT="${API_PORT:-3101}"
export APP_DB_ROLE="${APP_DB_ROLE:-app_user}"
export APP_DB_PASSWORD="${APP_DB_PASSWORD:-app_user_pw}"
export APP_JWT_SECRET="${APP_JWT_SECRET:-e2e-secret-please-change}"
export ADMIN_ACCOUNT="${ADMIN_ACCOUNT:-admin}"
export ADMIN_PASSWORD="${ADMIN_PASSWORD:-change-me}"
export MIGRATIONS_DIR="../db/migrations"

BASE="http://127.0.0.1:${API_PORT}"
PASS=0
FAIL=0
log() { printf '%s\n' "$*"; }
ok()  { PASS=$((PASS+1)); log "PASS  $1"; }
bad() { FAIL=$((FAIL+1)); log "FAIL  $1 (expected=$2 got=$3)"; }
chk() { [[ "$2" == "$3" ]] && ok "$1" || bad "$1" "$2" "$3"; }

# 从 JSON 取第一个字符串字段值（避免依赖 jq）
pick() { sed -n "s/.*\"$2\":\"\([^\"]*\)\".*/\1/p" <<<"$1" | head -n1; }

cd "$(dirname "$0")/../api"

log "== migrate =="
npx tsx src/migrate.ts || { log "migrate failed"; exit 1; }

log "== start api =="
PORT="$API_PORT" npx tsx src/server.ts >/tmp/admin-e2e-api.log 2>&1 &
API_PID=$!
trap 'kill "$API_PID" 2>/dev/null || true' EXIT

for _ in $(seq 1 40); do
  curl -sf "$BASE/api/health" >/dev/null 2>&1 && break
  sleep 1
done

code() { curl -s -o /dev/null -w '%{http_code}' "$@"; }
body() { curl -s "$@"; }

log "== health & auth =="
chk "health 200" 200 "$(code "$BASE/api/health")"
chk "no-token /api/me -> 401" 401 "$(code "$BASE/api/me")"
chk "wrong password -> 401" 401 "$(code -X POST "$BASE/api/auth/login" -H 'Content-Type: application/json' -d "{\"login_account\":\"$ADMIN_ACCOUNT\",\"password\":\"wrong\"}")"

ADMIN_LOGIN="$(body -X POST "$BASE/api/auth/login" -H 'Content-Type: application/json' -d "{\"login_account\":\"$ADMIN_ACCOUNT\",\"password\":\"$ADMIN_PASSWORD\"}")"
ADMIN_TOKEN="$(pick "$ADMIN_LOGIN" token)"
chk "admin login has token" "yes" "$([[ -n "$ADMIN_TOKEN" ]] && echo yes || echo no)"
AUTH="Authorization: Bearer $ADMIN_TOKEN"
chk "admin /api/me -> 200" 200 "$(code "$BASE/api/me" -H "$AUTH")"
chk "admin /api/users -> 200" 200 "$(code "$BASE/api/users" -H "$AUTH")"

log "== admin 建演示项 & 成员 =="
ADMIN_ITEM="$(body -X POST "$BASE/api/demo-items" -H "$AUTH" -H 'Content-Type: application/json' -d '{"title":"AdminItem"}')"
ADMIN_ITEM_ID="$(pick "$ADMIN_ITEM" id)"
chk "admin create demo-item -> 200" 200 "$(code -X POST "$BASE/api/demo-items" -H "$AUTH" -H 'Content-Type: application/json' -d '{"title":"AdminItem2"}')"

MEMBER_ACCOUNT="member$RANDOM"
CREATE_MEMBER="$(body -X POST "$BASE/api/users" -H "$AUTH" -H 'Content-Type: application/json' \
  -d "{\"user_name\":\"M\",\"login_account\":\"$MEMBER_ACCOUNT\",\"password\":\"Test-12345\",\"role_type\":\"member\"}")"
chk "admin create member -> 200" 200 "$(pick "$CREATE_MEMBER" role_type | grep -q member && echo 200 || echo 0)"

MEMBER_LOGIN="$(body -X POST "$BASE/api/auth/login" -H 'Content-Type: application/json' -d "{\"login_account\":\"$MEMBER_ACCOUNT\",\"password\":\"Test-12345\"}")"
MEMBER_TOKEN="$(pick "$MEMBER_LOGIN" token)"
MAUTH="Authorization: Bearer $MEMBER_TOKEN"
chk "member login has token" "yes" "$([[ -n "$MEMBER_TOKEN" ]] && echo yes || echo no)"

log "== RBAC =="
chk "member /api/users -> 403" 403 "$(code "$BASE/api/users" -H "$MAUTH")"
chk "member /api/operation-logs -> 403" 403 "$(code "$BASE/api/operation-logs" -H "$MAUTH")"
chk "admin /api/operation-logs -> 200" 200 "$(code "$BASE/api/operation-logs" -H "$AUTH")"

log "== RLS 行级 =="
chk "member can list demo-items -> 200" 200 "$(code "$BASE/api/demo-items" -H "$MAUTH")"
chk "member update admin's item -> 404" 404 "$(code -X PATCH "$BASE/api/demo-items/$ADMIN_ITEM_ID" -H "$MAUTH" -H 'Content-Type: application/json' -d '{"status":"published"}')"

MEMBER_ITEM="$(body -X POST "$BASE/api/demo-items" -H "$MAUTH" -H 'Content-Type: application/json' -d '{"title":"MemberItem"}')"
MEMBER_ITEM_ID="$(pick "$MEMBER_ITEM" id)"
chk "member create own item -> 200" "yes" "$([[ -n "$MEMBER_ITEM_ID" ]] && echo yes || echo no)"
chk "member update own item -> 200" 200 "$(code -X PATCH "$BASE/api/demo-items/$MEMBER_ITEM_ID" -H "$MAUTH" -H 'Content-Type: application/json' -d '{"status":"published"}')"

log "== 字段级 =="
chk "member inject tenant_id -> 403" 403 "$(code -X POST "$BASE/api/demo-items" -H "$MAUTH" -H 'Content-Type: application/json' -d '{"title":"x","tenant_id":"00000000-0000-0000-0000-000000000000"}')"

log "----"
log "PASS=$PASS FAIL=$FAIL"
[[ "$FAIL" == "0" ]]
