\set ON_ERROR_STOP on
BEGIN;
DO $$ BEGIN
 IF current_user <> 'link_runtime' THEN RAISE EXCEPTION 'must connect as runtime'; END IF;
 IF NOT link_api.health() THEN RAISE EXCEPTION 'health failed'; END IF;
 PERFORM link_api.create_link('Runtime1','https://example.org',NULL);
 IF (SELECT count(*) FROM link_api.resolve_link('Runtime1')) <> 1 THEN RAISE EXCEPTION 'resolve failed'; END IF;
 BEGIN PERFORM * FROM link_data.links; RAISE EXCEPTION 'SELECT permitted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN INSERT INTO link_data.links(short_code,url) VALUES ('Bad00001','https://example.org'); RAISE EXCEPTION 'INSERT permitted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN UPDATE link_data.links SET url='https://example.com'; RAISE EXCEPTION 'UPDATE permitted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN DELETE FROM link_data.links; RAISE EXCEPTION 'DELETE permitted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN CREATE TEMP TABLE forbidden(id integer); RAISE EXCEPTION 'TEMP permitted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN CREATE TABLE public.forbidden(id integer); RAISE EXCEPTION 'DDL permitted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM link_api.disable_link(gen_random_uuid()); RAISE EXCEPTION 'disable permitted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM link_api.delete_link(gen_random_uuid()); RAISE EXCEPTION 'delete permitted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM link_api.purge_expired_links(1); RAISE EXCEPTION 'purge permitted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN EXECUTE 'SET ROLE link_owner'; RAISE EXCEPTION 'owner escalation permitted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
ROLLBACK;
