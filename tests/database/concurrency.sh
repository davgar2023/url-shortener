#!/bin/sh
set -eu
: "${DB_RUNTIME_PASSWORD:?required}" "${DB_MAINTENANCE_PASSWORD:?required}"
race_dir=$(mktemp -d)
cleanup() {
  for result in "$race_dir"/*.out; do
    [ -s "$result" ] || continue
    link_id=$(cat "$result")
    PGUSER=link_maintenance PGPASSWORD="$DB_MAINTENANCE_PASSWORD" psql -X -qAt -v ON_ERROR_STOP=1 -v link_id="$link_id" <<'SQL' >/dev/null
SELECT id FROM link_api.delete_link(:'link_id'::uuid);
SQL
  done
  rm -rf "$race_dir"
}
trap cleanup EXIT
code=$(openssl rand -hex 4)
i=1
while [ "$i" -le 12 ]; do
  (
    if PGUSER=link_runtime PGPASSWORD="$DB_RUNTIME_PASSWORD" psql -X -qAt -v ON_ERROR_STOP=1 -v VERBOSITY=sqlstate -v code="$code" >"$race_dir/$i.out" 2>"$race_dir/$i.err" <<'SQL'
SELECT id FROM link_api.create_link(:'code','https://example.org',NULL);
SQL
    then
      echo ok > "$race_dir/$i.status"
    else
      if ! grep -q '23505' "$race_dir/$i.err"; then
        echo unexpected > "$race_dir/$i.status"
      else
        echo collision > "$race_dir/$i.status"
      fi
    fi
  ) &
  i=$((i + 1))
done
wait
successes=$(grep -l '^ok$' "$race_dir"/*.status | wc -l | tr -d ' ')
collisions=$(grep -l '^collision$' "$race_dir"/*.status | wc -l | tr -d ' ')
[ "$successes" = 1 ] && [ "$collisions" = 11 ] || { echo 'Concurrent uniqueness test failed'; exit 1; }
echo 'Concurrent uniqueness passed: one commit and eleven SQLSTATE 23505 collisions.'
