\set ON_ERROR_STOP on
BEGIN;
SET LOCAL ROLE link_owner;
INSERT INTO link_data.links(short_code,url,created_at,expires_at)
SELECT 'X'||lpad(n::text,7,'0'), 'https://example.org/'||n, now()-interval '2 days',
 CASE WHEN n % 10 = 0 THEN now()-interval '1 day' ELSE NULL END
FROM generate_series(1,100000) n;
ANALYZE link_data.links;
EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM link_data.links WHERE short_code='X0050001' AND disabled_at IS NULL AND (expires_at IS NULL OR expires_at > statement_timestamp());
EXPLAIN (ANALYZE, BUFFERS) WITH batch AS (SELECT id FROM link_data.links WHERE expires_at <= statement_timestamp() ORDER BY expires_at,id LIMIT 100 FOR UPDATE SKIP LOCKED)
DELETE FROM link_data.links l USING batch b WHERE l.id=b.id;
ROLLBACK;
