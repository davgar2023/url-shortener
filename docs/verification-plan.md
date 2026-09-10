# Plan de verificación

Los gates se ejecutan en orden. Las pruebas documentales no sustituyen las pruebas de comportamiento. Los resultados medidos se registrarán en `test-report.md` con comandos, fecha y limitaciones.

| Gate | Evidencia requerida | Casos negativos |
|---|---|---|
| 1 — contrato | Estructura y contratos HTTP/SQL, diagramas, typecheck | Capacidad marcada como hipótesis |
| 2 — PostgreSQL | Migración desde cero y segunda ejecución; funciones y restricciones en servidor real | Runtime sin acceso a tablas, secuencias, DDL ni operaciones administrativas; colisión, URL inválida, expiración inválida |
| 3 — adaptadores | Database parametrizada, cierre del pool, errores sanitizados; caché y configuración probadas | Timeout, desconexión, error SQL; expiración de TTL; JSON Redis inválido |
| 4 — aplicación | Controller → service → Database, creación y redirect; seguridad y rate limiting | Cinco colisiones, entradas inválidas, body excesivo, error Redis; invalidación fallida con enlace deshabilitado |
| 5 — infraestructura | Dos instancias, TLS Nginx, persistencia y Redis real | X-Forwarded-For falsificado; rate limiting cruzado; Redis detenido y restaurado; expiración y revocación |
| 6 — aceptación | Lint, typecheck, suite completa, arquitectura, EXPLAIN y carga | No SQL de tablas ni import pg fuera de Database; errores y latencia medidos sin inventar cifras |

## Política de pruebas de seguridad

Probar URLs con protocolos prohibidos, credenciales, caracteres de control, localhost, nombres sin dominio público, sufijos internos, IPv4 privada/loopback/link-local/multicast/reservada, IPv6 no global y formas IPv4 codificadas que normaliza WHATWG URL. No se consulta la URL de destino; bloquear dominios que resuelvan a direcciones privadas requeriría una política DNS adicional y no se promete protección contra rebinding en el navegador del visitante.

Verificar que los errores de PostgreSQL, Redis y JSON no incluyen el cuerpo, destino ni contraseñas. Los logs de acceso deben contener exclusivamente metadatos permitidos. Nginx sobrescribe los headers de proxy y ninguna API publica su puerto al host.

## Integridad de los resultados

Las pruebas deben fallar si faltan sus dependencias, salvo una suite explícitamente separada y documentada; no contar pruebas omitidas como aprobadas. Las herramientas de carga no siguen el redirect: evitan tráfico a destinos externos. Los fixtures de EXPLAIN se crean dentro de una transacción que termina con ROLLBACK. La prueba de caída de Redis restaura el servicio incluso cuando una aserción falla.
