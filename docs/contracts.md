# Contratos de integración — fase 1

Este contrato es la referencia de las siguientes fases. Los tests de esta fase verifican su presencia y consistencia documental; las siguientes fases verifican el comportamiento real.

## HTTP

* `POST /shorten`: JSON `{ "url": "https://example.org/path", "expiresAt": "2030-01-01T00:00:00.000Z" }`. `expiresAt` es opcional; si se proporciona debe ser fecha ISO válida y futura. Éxito: `201` con `{ "shortCode": "Ab12Cd34", "shortUrl": "https://short.example/Ab12Cd34" }`. La URL corta se deriva de `BASE_URL`, nunca del Host recibido.
* `GET /:code`: código exactamente de 8 caracteres Base62 (`^[A-Za-z0-9]{8}$`). Éxito: `302`, `Location` con el destino original y `Cache-Control: no-store`. Desconocido, expirado o deshabilitado: `404` sin revelar cuál fue la causa. Código inválido: `400`.
* `GET /health`: disponibilidad del proceso. `GET /ready`: disponibilidad de PostgreSQL; Redis degradado se informa sin impedir los GET. No exponer credenciales, URLs ni detalles de infraestructura.
* Error uniforme: `{ "error": { "code": "INVALID_INPUT", "message": "Invalid input" } }`. Códigos: `INVALID_INPUT` (400), `NOT_FOUND` (404), `PAYLOAD_TOO_LARGE` (413), `RATE_LIMITED` (429), `INTERNAL_ERROR` (500), `UNAVAILABLE` (503). Las respuestas 429 incluyen `Retry-After` en segundos. JSON malformado es 400.
* URL máxima: 2048 caracteres; body máximo: 4096 bytes. Solo HTTP/HTTPS; rechazar credenciales, espacios de control y destinos privados/locales según política de seguridad. La aplicación no visita el destino.

## Dominio y base de datos

```typescript
interface Link {
  id: string; // UUID
  shortCode: string;
  url: string;
  createdAt: Date;
  expiresAt: Date | null;
  disabledAt: Date | null;
}
interface CreateLinkInput {
  shortCode: string;
  url: string;
  expiresAt: Date | null;
}
interface DatabasePort {
  createLink(input: CreateLinkInput): Promise<Link>;
  resolveLink(code: string): Promise<Link | null>;
  disableLink(id: string): Promise<Link | null>;
  deleteLink(id: string): Promise<Link | null>;
  purgeExpiredLinks(batchSize: number): Promise<number>;
  health(): Promise<boolean>;
  close(): Promise<void>;
}
```

`resolveLink` devuelve null si está ausente, expirado (`expires_at <= statement_timestamp()`) o deshabilitado. PostgreSQL decide vigencia y unicidad. `disableLink` y `deleteLink` retornan el registro afectado para invalidar su código; ausente devuelve null. Deshabilitar es idempotente. Purga admite de 1 a 10000 registros por lote.

La clase `Database` es el único importador de `pg` y el único propietario de un pool por proceso. No publica query arbitraria. Cada método invoca exclusivamente su función parametrizada del schema `link_api`: `create_link`, `resolve_link`, `disable_link`, `delete_link`, `purge_expired_links`, `health`. `close` cierra el pool. El runtime puede ejecutar solo create/resolve/health; mantenimiento usa la misma clase con credenciales de un rol separado para mutaciones y purga. Una violación de unicidad (`23505`) se traduce a un error de colisión tipado y permite hasta cinco intentos de creación; agotarlos produce 503. Otros errores de SQL nunca llegan al cliente.

## Caché y límites

Cache-aside: clave `link:<code>`, valor Link serializado (fechas ISO), TTL configurado y acotado por la expiración. TTL no positivo impide escritura. Nunca cachear resultados negativos. En cada hit se llama igualmente `Database.resolveLink` para validar estado vigente; si devuelve null se elimina la entrada y se responde 404. Esto evita usar datos obsoletos tras una deshabilitación incluso si Redis o la invalidación fallan. El resultado de PostgreSQL prevalece. El punto de consistencia es la lectura SQL; una mutación concurrente posterior puede ocurrir antes de entregar el redirect.

Los métodos de mantenimiento del servicio invalidan después de deshabilitar/eliminar; la purga física no sustituye las comprobaciones lógicas de expiración. Registrar contadores de hit/miss/error sin URLs. El coste explícito es una lectura PostgreSQL por GET, también con hit: esta versión prioriza revocación correcta sobre ahorro de QPS SQL.

Rate limiting por IP y tipo de operación con Redis y ejecución atómica: creación (10/minuto), redirección (120/minuto), global por IP (200/minuto), todos configurables. Un rechazo devuelve 429 y Retry-After. Redis inaccesible: POST responde 503 y GET consulta PostgreSQL; Nginx mantiene protección básica local. No usar contadores locales Express como sustituto distribuido. Nginx sobrescribe X-Forwarded-For y Express confía solo en la red/peer del proxy configurado; API, PostgreSQL y Redis sin puertos públicos.

## Responsabilidades y gates

`apps/api` contiene controller → LinksService → Database. `packages/database` implementa SQL publicado y pool; `cache` adaptación Redis; `security` validación y headers; `rate-limit` contadores distribuidos; `config` valida entorno al iniciar; `logger` escribe metadatos seguros. Errores compartidos podrán alojarse en `config` o un package `errors` explícito. SQL vive en `database/{migrations,functions,roles}`. Compose y proxy viven en `infra`.

1. **Gate 1:** estructura, contratos, diseño y tests documentales pasan antes de implementar.
2. **Gate 2:** migraciones aplicadas en PostgreSQL real; restricciones, funciones, roles y permission denied comprobados.
3. **Gate 3:** clase Database y packages compartidos tipados, pool y adaptadores probados.
4. **Gate 4:** dominio, API, seguridad y caché integrados; tests de colisiones, expiración, validación, invalidación y degradación.
5. **Gate 5:** Compose con dos instancias, pruebas E2E, balanceo, rate limiting distribuido y resiliencia real.
6. **Gate 6:** lint, typecheck, arquitectura, suite completa, EXPLAIN y carga medidos; README y reporte alineados con resultados. Nunca declarar terminado un gate no ejecutado.
