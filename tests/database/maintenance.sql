\set ON_ERROR_STOP on
BEGIN;
DO $$ BEGIN
 IF current_user <> 'link_maintenance' THEN RAISE EXCEPTION 'must connect as maintenance'; END IF;
 PERFORM link_api.health();
 PERFORM link_api.disable_link(gen_random_uuid());
 PERFORM link_api.delete_link(gen_random_uuid());
 PERFORM link_api.purge_expired_links(1);
 BEGIN PERFORM * FROM link_data.links; RAISE EXCEPTION 'SELECT permitted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM link_api.create_link('Bad00002','https://example.org',NULL); RAISE EXCEPTION 'create permitted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
ROLLBACK;
