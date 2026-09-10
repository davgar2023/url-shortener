#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
if [ -e .env ]; then
  echo '.env already exists; preserved.'
  exit 0
fi
umask 077
while IFS= read -r line; do
  case "$line" in
    POSTGRES_PASSWORD=|DB_RUNTIME_PASSWORD=|DB_MIGRATOR_PASSWORD=|DB_MAINTENANCE_PASSWORD=|REDIS_PASSWORD=|RATE_LIMIT_SECRET=)
      printf '%s%s\n' "$line" "$(openssl rand -hex 32)" ;;
    *) printf '%s\n' "$line" ;;
  esac
done < .env.example > .env
echo 'Created private .env with generated secrets. Do not commit it.'
