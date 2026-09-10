\set ON_ERROR_STOP on
BEGIN;
DO $$ BEGIN
 IF EXISTS (SELECT FROM pg_roles WHERE rolname IN ('link_owner','link_runtime','link_maintenance','link_migrator') AND (rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls)) THEN RAISE EXCEPTION 'unsafe role attributes'; END IF;
 IF (SELECT rolcanlogin FROM pg_roles WHERE rolname='link_owner') THEN RAISE EXCEPTION 'owner login permitted'; END IF;
 IF EXISTS (SELECT FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='link_api' AND (NOT p.prosecdef OR pg_get_userbyid(p.proowner) <> 'link_owner' OR NOT ('search_path=pg_catalog, pg_temp' = ANY(p.proconfig)))) THEN RAISE EXCEPTION 'unsafe function definition'; END IF;
 IF EXISTS (SELECT FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace CROSS JOIN LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a WHERE n.nspname='link_api' AND a.grantee=0 AND a.privilege_type='EXECUTE') THEN RAISE EXCEPTION 'public function execution permitted'; END IF;
 IF has_database_privilege('link_runtime',current_database(),'TEMP') OR has_database_privilege('link_runtime',current_database(),'CREATE') THEN RAISE EXCEPTION 'runtime database privileges too broad'; END IF;
 IF has_schema_privilege('link_runtime','link_data','USAGE') THEN RAISE EXCEPTION 'private schema usage permitted'; END IF;
END $$;
ROLLBACK;
