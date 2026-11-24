# D15 · Evidencia del checkout

Verificado con Node.js 22.19.0, PostgreSQL 15.20 desechable y
`db_CoffeeFaster` en `d074ed56aaf3e9c3992b8852a052f9f76d86f5cc`.
El runner [de C12, D14 y D15](../../../database/tests/prueba_limitar_beneficio_por_comprador_y_codigo.cjs)
crea la base y prepara las identidades ficticias. Usa el estudiante **11**
con el rol `authenticated`, la cafetería **1**, el producto **401** de
$1.000 CLP y el código `CAFE-11`. El saldo inicial es $100.000 CLP.
La sesión SQL usa el usuario de prueba del fixture mediante `SET ROLE`
y el UUID sintético terminado en `000000000011`.

## Compra, reintento y cancelación

| Paso | Resultado esperado | Resultado observado |
|---|---|---|
| Confirmar el carrito por $850 con la clave `c12-previo-sin-codigo`. | Un pedido con $150 de descuento y un débito de $850. | Pedido `#1`, una fila de compra de −$850, Wallet de $100.000 a $99.150. |
| Repetir la confirmación con la misma clave y los mismos datos. | Recuperar el mismo ID y conservar el débito único. | La RPC devolvió el pedido `#1`, con una sola fila de compra y saldo de $99.150. |
| Tras el caso intermedio de la suite con `ALTER-11`, cancelar el pedido `#1` antes de preparación. | Cancelarlo y abonar una vez el importe cobrado. | Pedido `#1` en estado `cancelado`, un reembolso de +$850, Wallet de $98.300 a $99.150. El saldo previo incluye el débito de $850 de la compra intermedia con el otro código. |
| Repetir la cancelación del pedido `#1`. | Rechazo `ya_cancelado` y ningún abono adicional. | La RPC devolvió `ya_cancelado`. Wallet siguió en $99.150 y quedó una sola fila de reembolso vinculada al pedido `#1`. |

Cotejar las dos líneas `D15` de la salida por ID. El runner verifica las filas
de `movimientos_wallet` mediante `pedido_id` y `tipo`, y compara
`wallets.saldo_actual` antes y después de cada paso.

## Reproducción

Desde la raíz, usar Docker y un checkout local de `db_CoffeeFaster` en el
commit indicado. El contenedor es exclusivo de esta prueba. Los datos y
las identidades se crean al ejecutar el runner.

~~~powershell
$env:DB_COFFEEFASTER_DIR = (Resolve-Path ../db_CoffeeFaster).Path
$env:TEST_POSTGRES_CONTAINER = 'cf-d15-' + [guid]::NewGuid().ToString('N').Substring(0, 8)
docker run --rm -d --name $env:TEST_POSTGRES_CONTAINER -e POSTGRES_HOST_AUTH_METHOD=trust postgres:15
if ($LASTEXITCODE -ne 0) { throw 'No se pudo iniciar PostgreSQL' }
try {
    for ($intento = 0; $intento -lt 30; $intento++) {
        docker exec $env:TEST_POSTGRES_CONTAINER pg_isready -h 127.0.0.1 -U postgres
        if ($LASTEXITCODE -eq 0) { break }
        Start-Sleep -Seconds 1
    }
    docker exec $env:TEST_POSTGRES_CONTAINER psql -U postgres -v ON_ERROR_STOP=1 -c 'CREATE ROLE authenticated NOLOGIN;'
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo preparar el rol de prueba' }
    node database/tests/prueba_limitar_beneficio_por_comprador_y_codigo.cjs
    if ($LASTEXITCODE -ne 0) { throw 'Falló la prueba D15' }
} finally {
    docker stop $env:TEST_POSTGRES_CONTAINER
}
~~~

## Evidencias relacionadas

- [D10](D10-Wallet-al-cancelar.md) verifica el saldo visible en Wallet al cancelar y ante rechazo, con transporte simulado.
- [D13](D13-Verificar-compra-sin-codigo.md) verifica la compra sin código y tras retirarlo, además de la recuperación en el historial.
- [D14](D14-Primera-compra-y-recurrente.md) verifica los pedidos SQL `#2` y `#3` del estudiante 10 en la misma cafetería.
- El job `database` de [CI Functional](../../../.github/workflows/ci-functional.yml) ejecuta el mismo runner. El cotejo D15 se hizo mediante las RPC en PostgreSQL local, sin dispositivo ni operaciones en Cloud.
