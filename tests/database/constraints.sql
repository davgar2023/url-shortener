\set ON_ERROR_STOP on
BEGIN;
SET LOCAL ROLE link_owner;
DO $$
DECLARE v_id uuid; v_count integer;
BEGIN
 INSERT INTO link_data.links(short_code,url) VALUES ('Test0001','https://example.org') RETURNING id INTO v_id;
 BEGIN INSERT INTO link_data.links(short_code,url) VALUES ('Test0001','https://example.org'); RAISE EXCEPTION 'unique not enforced'; EXCEPTION WHEN unique_violation THEN NULL; END;
 BEGIN INSERT INTO link_data.links(short_code,url) VALUES ('bad','https://example.org'); RAISE EXCEPTION 'code not enforced'; EXCEPTION WHEN check_violation THEN NULL; END;
 BEGIN INSERT INTO link_data.links(short_code,url) VALUES ('Test0002','ftp://example.org'); RAISE EXCEPTION 'scheme not enforced'; EXCEPTION WHEN check_violation THEN NULL; END;
 BEGIN INSERT INTO link_data.links(short_code,url) VALUES ('Test0002','https://' || repeat('a',2041)); RAISE EXCEPTION 'length not enforced'; EXCEPTION WHEN check_violation THEN NULL; END;
 BEGIN INSERT INTO link_data.links(short_code,url) VALUES ('Test0002',NULL); RAISE EXCEPTION 'null not enforced'; EXCEPTION WHEN not_null_violation THEN NULL; END;
 BEGIN INSERT INTO link_data.links(short_code,url,expires_at) VALUES ('Test0002','https://example.org',now()-interval '1 hour'); RAISE EXCEPTION 'expiry not enforced'; EXCEPTION WHEN check_violation THEN NULL; END;
 IF (SELECT count(*) FROM link_api.resolve_link('Test0001')) <> 1 THEN RAISE EXCEPTION 'resolve failed'; END IF;
 PERFORM link_api.disable_link(v_id);
 PERFORM link_api.disable_link(v_id);
 IF EXISTS (SELECT FROM link_api.resolve_link('Test0001')) THEN RAISE EXCEPTION 'disabled resolved'; END IF;
 IF (SELECT count(*) FROM link_api.delete_link(v_id)) <> 1 THEN RAISE EXCEPTION 'delete failed'; END IF;
 IF EXISTS (SELECT FROM link_api.delete_link(v_id)) THEN RAISE EXCEPTION 'delete missing returned row'; END IF;
 INSERT INTO link_data.links(short_code,url,created_at,expires_at) VALUES ('Expired1','https://example.org',now()-interval '2 days',now()-interval '1 day'),('Expired2','https://example.org',now()-interval '2 days',now()-interval '1 day');
 IF EXISTS (SELECT FROM link_api.resolve_link('Expired1')) THEN RAISE EXCEPTION 'expired resolved'; END IF;
 v_count := link_api.purge_expired_links(1);
 IF v_count <> 1 THEN RAISE EXCEPTION 'purge failed'; END IF;
 BEGIN PERFORM link_api.purge_expired_links(0); RAISE EXCEPTION 'batch not checked'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
END $$;
ROLLBACK;
