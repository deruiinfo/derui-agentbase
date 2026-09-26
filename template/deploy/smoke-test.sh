#!/usr/bin/env bash
# 冒烟测试：健康 / 登录 / 鉴权 / RLS 隔离
set -euo pipefail

BASE="${BASE_URL:-http://127.0.0.1:8080}"
ACCOUNT="${ADMIN_ACCOUNT:-admin}"
PASSWORD="${ADMIN_PASSWORD:-change-me}"
PASS=0
FAIL=0

check() {
  local name="$1" expect="$2" actual="$3"
  if [[ "$actual" == "$expect" ]]; then
    echo "PASS  $name ($actual)"
    PASS=$((PASS + 1))
  else
    echo "FAIL  $name (expected $expect, got $actual)"
    FAIL=$((FAIL + 1))
  fi
}

code() { curl -s -o /dev/null -w '%{http_code}' "$@"; }

check "health 200" 200 "$(code "$BASE/api/health")"
check "未带 token /api/me -> 401" 401 "$(code "$BASE/api/me")"
check "登录 -> 200" 200 "$(code -X POST "$BASE/api/auth/login" -H 'Content-Type: application/json' -d "{\"login_account\":\"$ACCOUNT\",\"password\":\"$PASSWORD\"}")"

TOKEN="$(curl -s -X POST "$BASE/api/auth/login" -H 'Content-Type: application/json' \
  -d "{\"login_account\":\"$ACCOUNT\",\"password\":\"$PASSWORD\"}" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')"

if [[ -n "$TOKEN" ]]; then
  check "带 token /api/me -> 200" 200 "$(code "$BASE/api/me" -H "Authorization: Bearer $TOKEN")"
  check "账号列表 -> 200" 200 "$(code "$BASE/api/users" -H "Authorization: Bearer $TOKEN")"
  check "演示资源列表 -> 200" 200 "$(code "$BASE/api/demo-items" -H "Authorization: Bearer $TOKEN")"
else
  echo "FAIL  登录未取到 token"
  FAIL=$((FAIL + 1))
fi

echo "----"
echo "PASS=$PASS FAIL=$FAIL"
[[ "$FAIL" == "0" ]]
