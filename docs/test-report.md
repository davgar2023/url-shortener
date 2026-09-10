# Reporte de verificación

## Gate 1 — verificado

Fecha: 2026-09-08. Entorno inicial: macOS 13.7.8 x86_64, Node.js 20.19.6. Node.js 24.6.0 también disponible para las siguientes fases.

* `npm install`: dependencias instaladas. Advertencia inicial de engine porque el shell usaba Node 20; el proyecto requiere Node >=22.
* `npm run typecheck`: aprobado.
* `npm run test:contracts`: 3 pruebas aprobadas, cero fallos y cero omitidas. El primer intento fue bloqueado por el sandbox al crear el socket de tsx; repetido con autorización fuera del sandbox y aprobado.

Estos resultados solo verifican estructura y contratos, no un backend funcional.

## Gate 2 — verificado

PostgreSQL 17.10 real en `127.0.0.1:55432`, binario temporal de `@embedded-postgres/darwin-x64@17.10.0-beta.17`; cliente psql 16.0 ya instalado con pgAdmin. No se empleó una simulación de PostgreSQL.

* `scripts/db-bootstrap.sh`: roles creados con contraseñas generadas, sin imprimirlas.
* `scripts/db-migrate.sh`: primera y segunda ejecución aprobadas.
* `tests/database/constraints.sql`: aprobado, incluyendo unicidad, formato, esquema URL, longitud, nulos, expiración, deshabilitación, eliminación y purga limitada.
* `tests/database/catalog.sql`: aprobado, propietarios, search_path seguro y privilegios públicos.
* `tests/database/runtime.sql`: aprobado conectado como link_runtime; accesos directos SELECT/INSERT/UPDATE/DELETE, TEMP, DDL, mutaciones administrativas y escalada de rol rechazados por PostgreSQL con insufficient_privilege.
* `tests/database/maintenance.sql`: aprobado con rol separado.

La primera creación de base falló por falta de disco durante la descarga de Colima. Se eliminó únicamente la imagen incompleta creada en esta tarea; se repitió el gate entero con `set -eu` y pasó. Docker/Colima/Compose están instalados pero el despliegue de contenedores sigue pendiente de espacio. No se declara verificada la infraestructura.

### Concurrencia e índices medidos

`tests/database/concurrency.sh`: doce conexiones runtime intentaron crear simultáneamente el mismo código. Resultado comprobado: una creación y once errores SQLSTATE 23505. El fixture creado se retiró mediante `link_api.delete_link`, usando mantenimiento.

`tests/database/explain.sql`, ejecutado con psql contra PostgreSQL 17.10: fixture de 100.000 enlaces, ANALYZE, dos EXPLAIN (ANALYZE, BUFFERS), ROLLBACK. Salida íntegra en [explain-results.txt](explain-results.txt).

| Consulta | Plan observado | Tiempo de ejecución de esta muestra |
|---|---|---|
| Código exacto y vigencia | Index Scan links_short_code_key, 4 buffers hit | 0,041 ms |
| Purga de 100 expirados | links_expiration_idx + links_pkey, 701 buffers hit | 0,881 ms |

Son muestras locales con buffers calientes y no incluyen red ni HTTP. No constituyen una medición de QPS de la aplicación ni un compromiso de producción.
