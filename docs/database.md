# PostgreSQL: instalación y permisos

PostgreSQL 17 es la autoridad para identidad, unicidad y vigencia. `link_data.links` está en 3FN: todos los atributos dependen de la identidad y no existen dependencias transitivas. Una sola entidad no necesita FK; inventar otra tabla para añadirlas no mejora la integridad.

`id` UUID es PK y `short_code` tiene UNIQUE y CHECK Base62 de ocho caracteres. URL obligatoria, máximo 2048 caracteres, esquema HTTP/HTTPS, sin espacios ni controles. La aplicación añade la validación detallada de destinos. `created_at` es obligatorio; expiración debe ser posterior a creación y deshabilitación no anterior. Se permiten varias filas con el mismo destino. Un índice parcial `(expires_at,id) WHERE expires_at IS NOT NULL` soporta la selección ordenada para purga; UNIQUE soporta lookup por código.

## Credenciales y bootstrap

Generar secretos fuera del repositorio. Exportar `DB_RUNTIME_PASSWORD`, `DB_MIGRATOR_PASSWORD` y `DB_MAINTENANCE_PASSWORD`; bootstrap los importa con `psql \getenv`, sin literales de contraseña en archivos SQL ni argumentos de proceso. No activar shell tracing ni psql echo-all. Usar `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD` estándar (o pgpass) para conexión. Nunca registrar estas variables.

1. Como administrador de la base dedicada ya creada, ejecutar `sh scripts/db-bootstrap.sh`.
2. Conectar como `link_migrator` y ejecutar `sh scripts/db-migrate.sh`.
3. Repetir migración para comprobar que es reejecutable.

El bootstrap requiere administrador porque crea roles y restringe acceso a la base. Es reejecutable y rota las contraseñas con los valores de entorno. No debe ejecutarse en una base compartida: revoca permisos PUBLIC de base y schema public.

`link_owner` es NOLOGIN y posee schemas, tabla y funciones. `link_migrator` es LOGIN NOINHERIT, miembro de owner, y hace SET ROLE explícito en una transacción para DDL. Runtime y mantenimiento no pertenecen a owner. Ninguno de los cuatro tiene SUPERUSER, CREATEDB, CREATEROLE, REPLICATION ni BYPASSRLS.

Runtime tiene CONNECT, USAGE de `link_api` y EXECUTE únicamente en create/resolve/health. Mantenimiento tiene CONNECT, USAGE de `link_api` y EXECUTE en disable/delete/purge/health. No tienen acceso a tablas, schema privado, DDL ni TEMP. Las funciones SECURITY DEFINER pertenecen a owner, fijan `search_path=pg_catalog, pg_temp` y califican tablas. PUBLIC carece de EXECUTE; también se revoca por default para nuevas funciones de owner. SQL no usa construcción dinámica de consultas de entrada.

## Migraciones y funciones

`database/migrate.sql` serializa migradores mediante advisory lock transaccional. Crea tracker `link_meta.migrations`, aplica cada versión una sola vez y confirma tracker junto con DDL. Cualquier error revierte toda la transacción. Las versiones publicadas son inmutables: añadir nuevas versiones para cambios. Este lab no incorpora checksums automáticos ni down migrations; revisar cambios históricos en Git y restaurar backup si se requiere recuperación de datos.

`create_link(text,text,timestamptz)` retorna una fila. `resolve_link(text)` retorna cero o una fila vigente según `statement_timestamp()`. `disable_link(uuid)` es idempotente y retorna la fila afectada; `delete_link(uuid)` retorna la fila borrada. Ambos retornan cero filas si no existe. Los registros tienen `id`, `short_code`, `url`, `created_at`, `expires_at`, `disabled_at` (UUID y timestamptz nativos). La clase Database traduce a camelCase y Date. `health()` retorna boolean. `purge_expired_links(integer)` acepta 1–10000 y retorna cantidad borrada; usa FOR UPDATE SKIP LOCKED para trabajadores concurrentes. No elimina enlaces sin expiración ni sustituye el filtro lógico al resolver.

## Verificación real y planes

Ejecutar con `psql -X -v ON_ERROR_STOP=1 -f <archivo>` usando la conexión indicada:

| Archivo | Login |
| --- | --- |
| tests/database/constraints.sql | link_migrator |
| tests/database/catalog.sql | link_migrator |
| tests/database/runtime.sql | link_runtime |
| tests/database/maintenance.sql | link_maintenance |
| tests/database/explain.sql | link_migrator |

Las pruebas generan excepciones si falta una restricción o permiso; runtime intenta realmente SELECT/INSERT/UPDATE/DELETE, DDL, TEMP, mantenimiento y SET ROLE y exige SQLSTATE insufficient_privilege. No basta inspeccionar GRANTs. Se ejecutan transacciones con rollback para aislar fixtures. `explain.sql` carga 100.000 filas deterministas, ANALYZE, EXPLAIN (ANALYZE, BUFFERS) del lookup y purga de 100 filas, y ROLLBACK. Ejecutarlo en una base de pruebas sin códigos X0000001–X0100000; ANALYZE y el trabajo de I/O afectan temporalmente la instancia. El plan corresponde al SQL interno de las funciones, para observar índices que una llamada SECURITY DEFINER oculta tras Function Scan.

Los scripts preparados no equivalen a resultados aprobados. El reporte del proyecto registra la versión real, resultados y planes cuando se ejecuten.
