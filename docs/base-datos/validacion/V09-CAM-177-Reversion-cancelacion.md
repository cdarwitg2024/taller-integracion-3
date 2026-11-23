# V09 / CAM-177 — reversión de comisión en cancelación

Implementación local del 21 de noviembre de 2026. No aplicada en Supabase Cloud.

## Fuente SQL y repositorios

La migración nueva pertenece a [db_CoffeeFaster](https://github.com/Diego24Vas/db_CoffeeFaster):
`supabase/migrations/20261121200029_revertir_comision_cancelacion.sql`.
Se aplica después de V08 y sus dependencias; no hay tablas nuevas ni datos de ejemplo.

`public.cancelar_pedido(bigint)` mantiene firma, JSON y motivos de rechazo. Delega
a un núcleo privado autenticado. Reembolsa `pedidos.total`, repone solo el stock
marcado como descontado y, si existe comisión pendiente, la marca revertida e
inserta una compensación vinculada al movimiento original. Conserva base, tasa,
afiliación y pedido históricos; el importe compensatorio es el negativo original.
Todo es atómico. La segunda cancelación devuelve `ya_cancelado` sin otras escrituras.

Una campaña pausada o un código desactivado no impiden revertir. Sin afiliación
se conserva el flujo de cancelación. La comisión cero conserva trazabilidad.
Un pedido cancelable con comisión disponible/revertida se rechaza como inconsistente;
no se permite cancelar después de comenzar la preparación. Se conservan pagos y QR.

## Compatibilidad en taller-integracion-3

- `ms-pedidos` sigue invocando la RPC con JWT del estudiante. No hay cambios de API,
  pantallas ni lógica JavaScript de cancelación.
- [El instalador SQL anterior](../../../app-mobile/tabla_mobile/rpc_cancelar_pedido.sql)
  conserva la definición previa a V09 y no debe reaplicarse después de instalarla.
  Para actualizar V09 se utilizan exclusivamente las migraciones de `db_CoffeeFaster`.
  Este PR contiene documentación; la implementación funcional está en ese repositorio.
- `database/fixes/activar_stock_promociones_cloud.sql` ya contiene una precondición
  que rechaza una base donde existe `cancelar_pedido`; su copia SQL es histórica.

## Validación local

Node 22.21.1 y PostgreSQL 16.15 desechable en `/tmp`, con Auth simulado:

- `npm test` en `db_CoffeeFaster`: historial completo de migraciones y nueve suites,
  incluida `npm run test:cancelacion-afiliada`.
- `npm test --prefix Microservices/ms-pedidos -- --ci`: 4 suites y 178 pruebas
  aprobadas. Dependencias de `shared` resueltas mediante el enlace usado por CI.
- V09: compra V08 seguida de cancelación; reembolso real; movimiento original y
  compensación vinculados; stock; repetición; código desactivado/campaña pausada;
  precio cambiado; pedido sin comisión; comisión cero; pedido histórico; rechazo
  por propiedad, estado, falta de Wallet, overflow o comisión inconsistente.
- Fallo provocado al insertar la compensación: se revierten stock, Wallet, pedido
  y ambos movimientos de comisión. Fallo DDL: se conserva la RPC anterior.
- Dos conexiones reales: la segunda espera el bloqueo del pedido y devuelve
  `ya_cancelado`; queda un reembolso y una compensación.
- Los 8 escenarios SQL anteriores de compra y los 8 de cancelación en
  `app-mobile/tabla_mobile/tests/` pasan con PostgreSQL local.

La validación no acredita instalación en Cloud, despliegue del gateway ni prueba
visual en dispositivo. La publicación SQL es una operación posterior.
