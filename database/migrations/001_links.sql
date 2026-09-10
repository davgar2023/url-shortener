CREATE SCHEMA link_data AUTHORIZATION link_owner;
CREATE SCHEMA link_api AUTHORIZATION link_owner;
REVOKE ALL ON SCHEMA link_data, link_api FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE link_owner REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
CREATE TABLE link_data.links (
 id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
 short_code varchar(8) NOT NULL UNIQUE CHECK (short_code ~ '^[A-Za-z0-9]{8}$'),
 url text NOT NULL CHECK (char_length(url) BETWEEN 1 AND 2048 AND url ~ '^https?://[^[:space:]]+$' AND url !~ '[[:cntrl:]]'),
 created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
 expires_at timestamptz CHECK (expires_at IS NULL OR expires_at > created_at),
 disabled_at timestamptz CHECK (disabled_at IS NULL OR disabled_at >= created_at)
);
CREATE INDEX links_expiration_idx ON link_data.links (expires_at, id) WHERE expires_at IS NOT NULL;
\ir ../functions/001_link_api.sql
\ir ../roles/grants.sql
