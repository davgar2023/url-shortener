REVOKE ALL ON ALL TABLES IN SCHEMA link_data FROM PUBLIC, link_runtime, link_maintenance;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA link_api FROM PUBLIC, link_runtime, link_maintenance;
GRANT USAGE ON SCHEMA link_api TO link_runtime, link_maintenance;
GRANT EXECUTE ON FUNCTION link_api.create_link(text,text,timestamptz), link_api.resolve_link(text), link_api.health() TO link_runtime;
GRANT EXECUTE ON FUNCTION link_api.disable_link(uuid), link_api.delete_link(uuid), link_api.purge_expired_links(integer), link_api.health() TO link_maintenance;
