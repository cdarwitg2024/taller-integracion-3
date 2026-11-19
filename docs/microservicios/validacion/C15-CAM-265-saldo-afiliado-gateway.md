# C15 / CAM-265 — Consulta de saldo del afiliado por gateway

El 19 de noviembre de 2026 se validó la consulta de saldo con sesiones reales de Supabase Auth en un entorno local desechable. **La consulta pasó.** El retiro simulado con comprobante e idempotencia queda pendiente de V13 y V14. [C15 en Linear](https://linear.app/camilodarwitg/issue/CAM-265/c15-integrar-saldo-y-retiro-por-el-gateway)

## Entorno

- Windows, Node.js 24.13.0 y Docker Desktop. Se ejecutó `ms-pedidos` con los cambios locales de C15 sobre `ed8d0e3`.
- Nginx temporal en `127.0.0.1:56808` y `ms-pedidos` en el puerto `56305`. Se reutilizó la configuración del gateway con los destinos ajustados para la prueba.
- Supabase desechable `coffeefaster_c15_v12`, con API en `127.0.0.1:56321`, Auth y PostgREST. Se aplicaron las migraciones de la copia del commit [884f256 de db_CoffeeFaster](https://github.com/Diego24Vas/db_CoffeeFaster/commit/884f25698e76df7d50a08b8a0d0a81a1059733e9), incluida `20261118211348_consulta_saldo_afiliado.sql`.

## Pasos y resultados

1. Crear dos cuentas confirmadas en Auth y vincularlas a usuarios activos con rol `estudiante`.
2. Cargar para el primer estudiante dos comisiones de prueba, una pendiente por $500 y otra disponible por $1.000, más un retiro histórico de $300 insertado como dato de prueba. Mantener al segundo estudiante sin movimientos de afiliación.
3. Consultar `GET /api/afiliados/saldo` por Nginx sin sesión y con el JWT de cada estudiante. Para cada sesión, comparar los campos con `POST /rest/v1/rpc/consultar_saldo_afiliado` usando ese mismo JWT.
4. Repetir la consulta autenticada con `?estudiante_id=2` y comprobar el rechazo. Verificar `Cache-Control: no-store` en las respuestas exitosas.

| Caso | Esperado | Observado |
|---|---|---|
| Estudiante con movimientos | `200`, pendiente $500, disponible $700 y retirado $300 | `200`, `{"pendiente_clp":500,"disponible_clp":700,"retirado_clp":300}`. Coincidió con la RPC. |
| Estudiante sin movimientos | `200` con los tres importes en cero | `200`, `{"pendiente_clp":0,"disponible_clp":0,"retirado_clp":0}`. Coincidió con la RPC. |
| Sin sesión | `401` | `401`. |
| Sesión válida con ID de estudiante en la URL | `400` | `400` con ambas sesiones. |
| Respuesta exitosa | `Cache-Control: no-store` | Cabecera verificada para ambas cuentas. |

## Comprobaciones complementarias

- `npm test --prefix Microservices/ms-pedidos -- --ci --silent` pasó 191 pruebas en Node.js 24. La suite [saldo-afiliado.test.js](../../../Microservices/ms-pedidos/tests/saldo-afiliado.test.js) usa Supabase simulado.
- La prueba SQL oficial `tests/saldo_afiliado.cjs` de V12 pasó en PostgreSQL 17.11 desechable. El gateway con Auth y PostgREST se comprobó en la corrida local descrita arriba.

## Pendiente para cerrar C15

Integrar la operación de retiro simulado por gateway y comprobar que devuelve monto, estado y referencia. Al repetir la misma solicitud con la misma clave, verificar que devuelve la referencia original y que el saldo se descuenta una sola vez. Los $300 de esta corrida eran datos preparados para consultar saldo. [V13](https://linear.app/camilodarwitg/issue/CAM-182/v13-registrar-retiro-simulado-en-supabase) · [V14](https://linear.app/camilodarwitg/issue/CAM-249/v14-guardar-y-recuperar-comprobante-de-retiro)
