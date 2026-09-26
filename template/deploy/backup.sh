#!/usr/bin/env bash
# 每日备份：pg_dump + 保留 7 天
set -euo pipefail

cd "$(dirname "$0")/.."

if [[ ! -f .env ]]; then
  echo ".env not found" >&2
  exit 1
fi
# shellcheck disable=SC1091
set -a; source .env; set +a

DIR="./backups"
mkdir -p "$DIR"
STAMP="$(date +%Y%m%d-%H%M%S)"
FILE="$DIR/db-$STAMP.sql.gz"

docker compose exec -T db pg_dump -U postgres "$POSTGRES_DB" | gzip > "$FILE"
echo "backup written: $FILE"

# 保留 7 天
find "$DIR" -name 'db-*.sql.gz' -mtime +7 -delete
