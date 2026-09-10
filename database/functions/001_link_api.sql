CREATE FUNCTION link_api.create_link(p_short_code text, p_url text, p_expires_at timestamptz DEFAULT NULL)
RETURNS SETOF link_data.links LANGUAGE sql SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $$
 INSERT INTO link_data.links(short_code,url,expires_at) VALUES(p_short_code,p_url,p_expires_at) RETURNING *;
$$;
CREATE FUNCTION link_api.resolve_link(p_code text)
RETURNS SETOF link_data.links LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $$
 SELECT * FROM link_data.links WHERE short_code=p_code AND disabled_at IS NULL AND (expires_at IS NULL OR expires_at > statement_timestamp());
$$;
CREATE FUNCTION link_api.disable_link(p_id uuid)
RETURNS SETOF link_data.links LANGUAGE sql SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $$
 UPDATE link_data.links SET disabled_at=coalesce(disabled_at, statement_timestamp()) WHERE id=p_id RETURNING *;
$$;
CREATE FUNCTION link_api.delete_link(p_id uuid)
RETURNS SETOF link_data.links LANGUAGE sql SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $$
 DELETE FROM link_data.links WHERE id=p_id RETURNING *;
$$;
CREATE FUNCTION link_api.purge_expired_links(p_batch_size integer)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $$
DECLARE affected integer;
BEGIN
 IF p_batch_size IS NULL OR p_batch_size < 1 OR p_batch_size > 10000 THEN RAISE EXCEPTION 'Invalid batch size' USING ERRCODE='22023'; END IF;
 WITH batch AS (SELECT id FROM link_data.links WHERE expires_at <= statement_timestamp() ORDER BY expires_at, id LIMIT p_batch_size FOR UPDATE SKIP LOCKED)
 DELETE FROM link_data.links l USING batch b WHERE l.id=b.id;
 GET DIAGNOSTICS affected = ROW_COUNT;
 RETURN affected;
END $$;
CREATE FUNCTION link_api.health() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $$ SELECT true; $$;
