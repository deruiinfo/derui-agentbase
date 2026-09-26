#!/usr/bin/env bash
# ============================================================================
# Docker 环境端到端验收（在运行 docker compose 的主机上执行）
# 覆盖：登录 / RBAC / RLS 行级(API+DB) / 字段级 / 审计
#
# 用法：
#   BASE_URL=http://127.0.0.1:8090 ADMIN_ACCOUNT=admin ADMIN_PASSWORD=change-me \
#   bash deploy/e2e-docker.sh
#
# 说明：DB 层「超级用户可见全部」仅断言 >0（库可能非空）；「app_user 无上下文=0」为 RLS 关键证明。
# ============================================================================
set -uo pipefail
cd "$(dirname "$0")/.." || exit 1
BASE=${BASE_URL:-http://127.0.0.1:8090}
ACC=${ADMIN_ACCOUNT:-admin}
PW=${ADMIN_PASSWORD:-change-me}
PASS=0; FAIL=0
ok(){ PASS=$((PASS+1)); echo "PASS  $1"; }
bad(){ FAIL=$((FAIL+1)); echo "FAIL  $1 (exp=$2 got=$3)"; }
chk(){ [ "$2" = "$3" ] && ok "$1" || bad "$1" "$2" "$3"; }
code(){ curl -s -o /dev/null -w '%{http_code}' "$@"; }
pick(){ sed -n "s/.*\"$2\":\"\([^\"]*\)\".*/\1/p" <<<"$1" | head -n1; }

LOGIN=$(curl -s -X POST "$BASE/api/auth/login" -H 'Content-Type: application/json' -d "{\"login_account\":\"$ACC\",\"password\":\"$PW\"}")
AT=$(pick "$LOGIN" token); AUTH="Authorization: Bearer $AT"
chk "admin /api/me -> 200" 200 "$(code "$BASE/api/me" -H "$AUTH")"
chk "admin /api/users -> 200" 200 "$(code "$BASE/api/users" -H "$AUTH")"
chk "wrong password -> 401" 401 "$(code -X POST "$BASE/api/auth/login" -H 'Content-Type: application/json' -d "{\"login_account\":\"$ACC\",\"password\":\"nope\"}")"

ITEM=$(curl -s -X POST "$BASE/api/demo-items" -H "$AUTH" -H 'Content-Type: application/json' -d '{"title":"AdminItem"}')
AID=$(pick "$ITEM" id)

MACC="member$RANDOM"
curl -s -X POST "$BASE/api/users" -H "$AUTH" -H 'Content-Type: application/json' -d "{\"user_name\":\"M\",\"login_account\":\"$MACC\",\"password\":\"Test-12345\",\"role_type\":\"member\"}" >/dev/null
MT=$(pick "$(curl -s -X POST "$BASE/api/auth/login" -H 'Content-Type: application/json' -d "{\"login_account\":\"$MACC\",\"password\":\"Test-12345\"}")" token)
MAUTH="Authorization: Bearer $MT"
chk "member login has token" "yes" "$([ -n "$MT" ] && echo yes || echo no)"

chk "RBAC member /api/users -> 403" 403 "$(code "$BASE/api/users" -H "$MAUTH")"
chk "RBAC member /api/operation-logs -> 403" 403 "$(code "$BASE/api/operation-logs" -H "$MAUTH")"
chk "audit admin /api/operation-logs -> 200" 200 "$(code "$BASE/api/operation-logs" -H "$AUTH")"

chk "RLS member list demo-items -> 200" 200 "$(code "$BASE/api/demo-items" -H "$MAUTH")"
chk "RLS member update admin item -> 404" 404 "$(code -X PATCH "$BASE/api/demo-items/$AID" -H "$MAUTH" -H 'Content-Type: application/json' -d '{"status":"published"}')"
MID=$(pick "$(curl -s -X POST "$BASE/api/demo-items" -H "$MAUTH" -H 'Content-Type: application/json' -d '{"title":"MemberItem"}')" id)
chk "RLS member create own item" "yes" "$([ -n "$MID" ] && echo yes || echo no)"
chk "RLS member update own item -> 200" 200 "$(code -X PATCH "$BASE/api/demo-items/$MID" -H "$MAUTH" -H 'Content-Type: application/json' -d '{"status":"published"}')"

chk "字段级 member inject tenant_id -> 403" 403 "$(code -X POST "$BASE/api/demo-items" -H "$MAUTH" -H 'Content-Type: application/json' -d '{"title":"x","tenant_id":"00000000-0000-0000-0000-000000000000"}')"

APP_DB_PASSWORD=$(grep -m1 '^APP_DB_PASSWORD=' ./.env | cut -d= -f2-)
POSTGRES_PASSWORD=$(grep -m1 '^POSTGRES_PASSWORD=' ./.env | cut -d= -f2-)
NOCTX=$(docker compose exec -T -e PGPASSWORD="$APP_DB_PASSWORD" db psql -U app_user -d app -tAc "select count(*) from public.demo_item" 2>/dev/null | tr -d '[:space:]')
ALLN=$(docker compose exec -T -e PGPASSWORD="$POSTGRES_PASSWORD" db psql -U postgres -d app -tAc "select count(*) from public.demo_item" 2>/dev/null | tr -d '[:space:]')
chk "DB RLS app_user 无上下文 = 0" 0 "$NOCTX"
chk "DB 超级用户可见全部(>0)" "yes" "$([ "${ALLN:-0}" -gt 0 ] && echo yes || echo no)"

echo "----"
echo "PASS=$PASS FAIL=$FAIL"
[ "$FAIL" = "0" ]
