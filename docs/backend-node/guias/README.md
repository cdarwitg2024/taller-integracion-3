# Backend legacy de CoffeeFast

Revisado el 11 de noviembre de 2026.

Este servidor no es el destino de la app Mobile actual. La configuración local de Mobile apunta al gateway de `Microservices/`; una variable de entorno diferente puede cambiar ese destino.

## Código retirado por sustitución

- `src/modules/catalogo/`: cafeterías y productos duplicados. Los recursos vigentes son `GET /api/cafeterias` en ms-cafeterias y `GET /api/menus` en ms-menus; Mobile también lee productos directamente en Supabase.
- `src/utils/cafeteriasMock.js` y `productosMock.js`: solo dependía de ellos ese catálogo legacy.
- `src/modules/pagos/`: el endpoint `/api/pagos` solo devolvía `ok:false`, «wallet no implementada aún». El pago actual entra por `POST /api/pedidos` en ms-pedidos y llama a la RPC `procesar_pago` con la sesión del comprador.

Esas rutas ya no se montan en `src/app.js`; este servidor devuelve 404 para ellas. No se agregan redirecciones automáticas entre contratos distintos. El archivo histórico `tests/cafeterias.http` describe endpoints retirados y no debe usarse como prueba del catálogo actual.

## Código que todavía se conserva

| Módulo | Motivo |
|---|---|
| auth | Autenticación de las rutas protegidas del servidor legacy |
| pedidos y clients/inventario.client.js | Conservan la integración legacy de inventario |
| qr | Endpoints legacy de imágenes y tokens; la app actual dibuja el QR persistido de Supabase |


Las pruebas de este servidor utilizan un transporte Supabase de prueba. CI Functional ejecuta la suite y comprueba que detecte un estado inicial de pedido incorrecto introducido en una copia temporal. El código legacy de inventario permanece en el repositorio. La activación Cloud del SQL de compra y cancelación de Mobile está registrada en [promociones y configuración](../../base-datos/promociones-configuracion-dueno.md).

Ver [arquitectura actual](../../estado-actual.md) y [entorno de microservicios](../../microservicios/operacion/README.md).
