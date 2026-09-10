\set ON_ERROR_STOP on
\getenv runtime_password DB_RUNTIME_PASSWORD
\getenv maintenance_password DB_MAINTENANCE_PASSWORD
\getenv migrator_password DB_MIGRATOR_PASSWORD
BEGIN;
DO $$ BEGIN
 IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='link_owner') THEN CREATE ROLE link_owner NOLOGIN; END IF;
 IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='link_migrator') THEN CREATE ROLE link_migrator LOGIN NOINHERIT; END IF;
 IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='link_runtime') THEN CREATE ROLE link_runtime LOGIN; END IF;
 IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='link_maintenance') THEN CREATE ROLE link_maintenance LOGIN; END IF;
END $$;
ALTER ROLE link_owner NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
ALTER ROLE link_migrator LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD :'migrator_password';
ALTER ROLE link_runtime LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD :'runtime_password';
ALTER ROLE link_maintenance LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD :'maintenance_password';
GRANT link_owner TO link_migrator;
SELECT format('REVOKE ALL ON DATABASE %I FROM PUBLIC', current_database()) \gexec
SELECT format('GRANT CONNECT ON DATABASE %I TO link_migrator, link_runtime, link_maintenance', current_database()) \gexec
SELECT format('GRANT CREATE ON DATABASE %I TO link_owner', current_database()) \gexec
REVOKE ALL ON SCHEMA public FROM PUBLIC;
COMMIT;
