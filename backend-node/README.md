# Backend legacy de CoffeeFast

Este servidor no es el destino de la app Mobile actual. La configuración local de Mobile apunta al gateway de `Microservices/`; una variable de entorno diferente puede cambiar ese destino.

## Código retirado por sustitución

- `src/modules/catalogo/`: cafeterías y productos duplicados. Los recursos vigentes son `GET /api/cafeterias` en ms-cafeterias y `GET /api/menus` en ms-menus; Mobile también lee productos directamente en Supabase.
- `src/utils/cafeteriasMock.js` y `productosMock.js`: solo dependía de ellos ese catálogo legacy.
- `src/modules/pagos/`: el endpoint `/api/pagos` solo devolvía `ok:false`, «wallet no implementada aún». El pago actual entra por `POST /api/pedidos` en ms-pedidos y llama a la RPC `procesar_pago` con la sesión del comprador.

Esas rutas ya no se montan en `src/app.js`; este servidor devuelve 404 para ellas. No se agregan redirecciones automáticas entre contratos distintos. El archivo histórico `tests/cafeterias.http` describe endpoints retirados y no debe usarse como prueba del catálogo actual.

## Código que todavía se conserva

| Módulo | Motivo |
|---|---|
| notificaciones | FCM y registro de dispositivos aún no migrados al flujo actual |
| auth | Lo necesitan notificaciones, QR y tiempos del servidor legacy |
| pedidos y clients/inventario.client.js | Conservan integración legacy de inventario y disparo de FCM; no retirarlos como si toda su funcionalidad estuviera migrada |
| qr | Endpoints legacy de imágenes y tokens; la app actual dibuja el QR persistido de Supabase |
| tiempos | Estimación/colas legacy sin sustituto completo en los tres microservicios |

Conservar código no significa que esos flujos estén activos en Mobile ni que sus mocks históricos sean datos productivos válidos. La integración push de Mobile continúa pendiente.

Las pruebas existentes de este servidor utilizan un transporte Supabase de prueba. No se modifican para ocultar regresiones. El retiro funcional de inventario y la activación del SQL nuevo en Cloud siguen pendientes.

Ver [arquitectura actual](../docs/estado-actual.md) y [entorno de microservicios](../Microservices/README.md).
