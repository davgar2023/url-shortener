# URL Shortener

URL shortener seguro en TypeScript, Node.js, Express, PostgreSQL y Redis. PostgreSQL es la fuente de verdad: Node solo invoca funciones del schema `link_api` mediante la clase `Database`; el runtime no tiene permisos directos sobre tablas.

## Verificación local

Requiere Node.js >=22. Con el PostgreSQL temporal del gate:

```sh
export PATH="$HOME/.nvm/versions/node/v24.6.0/bin:$PATH"
npm install
npm run typecheck
node --import tsx --test tests/*.test.ts
```

La suite completa contiene 21 pruebas aprobadas: contratos, adaptadores, API HTTP, seguridad, rate limiting simulado, arquitectura y pruebas PostgreSQL reales documentadas en `docs/test-report.md`. Para crear la base y roles, copia `.env.example` a `.env`, genera secretos con `sh scripts/setup-env.sh` y ejecuta `scripts/db-bootstrap.sh` con un superusuario; después `scripts/db-migrate.sh` con el rol migrador.

## API

`POST /shorten` recibe `{ "url": "https://example.org" }` y devuelve `201` con `shortCode` y `shortUrl`. `GET /:code` devuelve `302` hacia el destino vigente. `GET /health` y `/ready` exponen salud de proceso y base de datos sin secretos.

La arquitectura, los flujos, el modelo 3FN, permisos, límites, caché, seguridad y supuestos de capacidad están en `docs/`. Las mediciones reales de `EXPLAIN (ANALYZE, BUFFERS)` están en `docs/explain-results.txt`.

## Estado de infraestructura

La aplicación y los gates de código y PostgreSQL están verificados. El despliegue Docker Compose/Nginx requiere completar la imagen Linux de Colima en el entorno local; no se presenta como probado hasta ejecutar ese gate.
