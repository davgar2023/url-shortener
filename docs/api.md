# API y dominio

`createApp` recibe DatabasePort, CachePort, RateLimiterPort, configuración y logger; no abre conexiones. Controller valida entrada y delega al servicio. El servicio usa exclusivamente el puerto Database. `server.ts` crea un Database y un Redis por proceso; comparte Redis entre caché y limitador. SIGTERM/SIGINT dejan de aceptar conexiones, drenan HTTP y después cierran PostgreSQL/Redis; un límite de 10 segundos fuerza terminación si el drenaje se bloquea.

POST `/shorten` aplica rate limiting antes de parsear JSON (máximo 4096 bytes), por lo que Redis caído produce 503 incluso con JSON malformado. Valida URL y expiración con security. Genera 8 caracteres Base62 mediante `crypto.randomInt(62)` independiente por carácter; reintenta únicamente CollisionError, máximo cinco intentos, después 503. Devuelve 201 con shortCode y shortUrl basada en BASE_URL.

GET `/:code` valida el código y devuelve 302 sin body, Location y Cache-Control: no-store. Aunque exista un hit Redis, consulta PostgreSQL y usa su resultado. Ausente, expirado o deshabilitado devuelve 404 uniforme e invalida caché. La lectura SQL define el punto de consistencia; una mutación posterior a esa lectura puede preceder físicamente al envío HTTP. La caché no evita consultas SQL en esta versión. Disable/delete del servicio invalidan después de la operación SQL; no hay endpoints HTTP administrativos.

`/health` precede la ruta dinámica y verifica proceso; `/ready` consulta PostgreSQL y Redis, con 503 si PostgreSQL no está listo y 200/cache degraded si solo Redis falla. Se confía únicamente en el peer exacto TRUST_PROXY_IP (incluida su representación IPv4-mapped); Host y X-Forwarded-For de clientes directos no cambian BASE_URL ni IP. No se registran requests, cuerpos, URLs ni IPs. Responses incluyen CSP restrictiva, nosniff, DENY y no-referrer. Errores se normalizan al contrato sin stack ni texto interno; 429 incluye Retry-After.

## Evidencia de Gate 4

`node --import tsx --test tests/api.test.ts`: 5/5 pasan, incluido HTTP real en puerto efímero 127.0.0.1. Cubre formato Base62, colisiones y agotamiento, prevalencia SQL, expiración/revocación, invalidación de mantenimiento, creación/redirección, headers, Host no confiable, XFF ignorado, JSON malformado, tamaño 413, rate-before-parse, 429 y readiness degradada. `npx tsc --noEmit`: pasa. Las dependencias SQL/Redis están sustituidas por puertos inyectados en esta suite; resiliencia real, dos instancias y shutdown bajo carga requieren Gate 5/E2E y no quedan demostrados por estos tests.
