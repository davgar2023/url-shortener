\set ON_ERROR_STOP on
BEGIN;
SET LOCAL ROLE link_owner;
SELECT pg_advisory_xact_lock(814783650);
CREATE SCHEMA IF NOT EXISTS link_meta AUTHORIZATION link_owner;
REVOKE ALL ON SCHEMA link_meta FROM PUBLIC;
CREATE TABLE IF NOT EXISTS link_meta.migrations(version integer PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now());
SELECT NOT EXISTS (SELECT FROM link_meta.migrations WHERE version=1) AS apply_001 \gset
\if :apply_001
\ir migrations/001_links.sql
INSERT INTO link_meta.migrations(version) VALUES (1);
\endif
COMMIT;
