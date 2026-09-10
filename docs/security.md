# Política de seguridad

La creación admite un objeto JSON con `url` y `expiresAt` opcional, sin campos adicionales. La URL original y normalizada deben medir como máximo 2048 caracteres. Solo HTTP/HTTPS con autoridad explícita; se rechazan credenciales, whitespace, controles, backslash y sus escapes de control/backslash. `URL` normaliza esquema, host, puerto por defecto y representaciones IPv4 alternativas antes de aplicar la política de red. Los códigos usan exactamente ocho caracteres Base62.

`ipaddr.js` admite únicamente direcciones clasificadas como unicast público. Rechaza loopback, redes privadas, link-local, multicast, unspecified, CGNAT, documentación y rangos reservados, así como IPv4 mapped IPv6 y rangos de transición. Los nombres DNS requieren al menos dos etiquetas válidas; se rechazan los sufijos localhost, local, internal, lan, home, localdomain, test, invalid, onion y arpa, incluso con punto final. Las fechas usan UTC ISO con segundos y milisegundos opcionales; deben ser futuras y representar una fecha real (sin rollover de calendario).

Esta política es sintáctica. No resuelve DNS ni efectúa solicitudes al destino. No garantiza que un dominio público nunca resuelva a una red privada, ni impide DNS rebinding o redirecciones posteriores del destino. La API entrega un redirect al navegador; no es un proxy HTTP ni un verificador de reputación o phishing.

## Límites distribuidos

Cada petición crea dos claves Redis: global por IP y operación por IP. El identificador es HMAC-SHA256 con el secreto compartido; no almacena la IP original. Cada IP comparte hash tag Redis para permitir la ejecución atómica del script en una misma ranura. No registrar IPs, secretos ni destinos.

Un único script Lua incrementa ambos contadores y establece expiración al primer incremento. Las ventanas son fijas, empiezan al primer acceso a cada contador y pueden admitir ráfagas en sus bordes. Los intentos rechazados cuentan en ambas cuotas, pero no renuevan el TTL. Si cualquiera excede su cuota, responde 429 con Retry-After igual al mayor TTL de las cuotas excedidas, mínimo un segundo. Las dos instancias usan el mismo Redis y secreto: no hay cuotas por proceso.

Redis inaccesible o respuesta inválida produce 503 en creación; redirección continúa y depende de la protección básica del proxy. No se reemplaza Redis con contadores locales. Los errores del backend Redis no se exponen al cliente. El controlador debe obtener la IP del peer y confiar únicamente en el proxy configurado, que sobrescribe X-Forwarded-For.

## Verificación

`tests/security.test.ts` cubre destinos permitidos, normalización, formas IPv4 alternativas, IPv6, rangos privados/reservados, dominios internos, credenciales, controles, esquemas, longitudes, fechas inválidas, códigos, HMAC y claves compartidas, cuotas, Retry-After y caída de Redis. Estos tests usan un Redis simulado; la atomicidad, expiración y distribución deben comprobarse además con Redis real en el gate E2E.
