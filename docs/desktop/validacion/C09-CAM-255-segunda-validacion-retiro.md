# C09 / CAM-255 — Segunda validación de retiro afiliado

Validación local del 23 de noviembre de 2026 (Santiago) sobre `48e3af9`. La prueba SQL usa PostgreSQL 15.20 desechable, las migraciones V11 y V12 de `db_CoffeeFaster` y el pedido ficticio 201. Se pausa la campaña antes de entregar para comprobar que se conserva la comisión histórica. [C09 en Linear](https://linear.app/camilodarwitg/issue/CAM-255)

| Paso | Esperado | Observado en PostgreSQL |
| --- | --- | --- |
| Consultar antes de entregar. | Pedido listo y comisión de $1.000 CLP pendiente. | `listo`, `qr_usado=false`, fecha vacía y una comisión pendiente. Saldo del afiliado: $1.500 pendientes, $0 disponibles y $0 retirados. |
| Validar el QR. | Entregar y habilitar una vez la comisión histórica. | Una fila devuelta. `entregado`, `qr_usado=true`, fecha registrada y la misma comisión disponible. Saldo: $500 pendientes, $1.000 disponibles y $0 retirados. |
| Repetir el QR y luego usar el token del mismo pedido. | Rechazar ambos intentos y conservar pedido, fecha, comisión y saldo. | Cero filas devueltas en cada intento. Pedido, fecha, comisión y saldo idénticos a los registrados tras la entrega. |

En Windows con Node.js 24.13.0 pasaron 14 pruebas HTTP y 162 pruebas de Desktop. La suite HTTP ejecuta Express con Supabase simulado. Comprueba que el primer intento devuelve HTTP 200 con `valido: true` y que el segundo devuelve HTTP 200 con `valido: false` y `motivo: ya_entregado`, tanto al repetir la credencial como al alternarla.

## Validación integrada en KDS

El 23 de noviembre de 2026 se probó manualmente el pedido afiliado **#50** de Café Central con la app móvil, KDS, el gateway local y Supabase Cloud. Para desbloquear la prueba se ajustó la apertura del detalle móvil y se configuró la clave de servidor de `ms-pedidos` en el entorno local.

| Paso | Esperado | Observado |
| --- | --- | --- |
| Consultar antes de entregar. | Pedido listo y comisión pendiente. | Cloud registraba el pedido pagado y `listo`, `qr_usado=false` y una comisión pendiente de $3.150 CLP. |
| Validar el QR desde KDS. | Entregar el pedido y acreditar $3.150 CLP una vez. | KDS confirmó el retiro y la app del comprador mostró `entregado`. La app del afiliado mostró $3.150 CLP disponibles. |
| Repetir el QR y usar el token del mismo pedido. | Mostrar «Este pedido ya fue entregado» en ambos intentos y conservar el saldo. | KDS mostró ese mensaje con ambas credenciales. La lectura posterior de Cloud confirmó `entregado`, `qr_usado=true`, `entregado_en` del 23 de noviembre a las 16:25:38 de Santiago y una única comisión disponible de $3.150 CLP. El saldo seguía en $3.150 disponibles, con $0 pendientes y $0 retirados. |

La evidencia combina la observación manual de KDS y ambas cuentas móviles con lecturas de solo consulta en Cloud. La prueba SQL automatizada de la sección anterior compara también la fecha de entrega inmediatamente después de cada intento.

## Por comandos

Desde la raíz de CoffeeFast, con dependencias instaladas, Node.js 22 recomendado, Docker iniciado y `db_CoffeeFaster` clonado al lado. Si está en otra ubicación, definir `COFFEEFAST_DB_REPO` con su ruta. El runner crea su base temporal y comprueba las cuatro lecturas, sin imprimir credenciales.

```powershell
npm test --prefix Microservices/ms-pedidos -- --ci --runTestsByPath tests/validar-qr.test.js
if ($LASTEXITCODE -ne 0) { throw 'Fallaron las pruebas HTTP de C09' }

$testContainer = 'coffeefast-c09-' + [guid]::NewGuid().ToString('N').Substring(0, 8)
docker run -d --rm --network none --name $testContainer `
  -e POSTGRES_HOST_AUTH_METHOD=trust postgres:15
if ($LASTEXITCODE -ne 0) { throw 'No se pudo iniciar PostgreSQL' }
try {
  for ($attempt = 0; $attempt -lt 25; $attempt++) {
    docker exec $testContainer pg_isready -h 127.0.0.1 -U postgres
    if ($LASTEXITCODE -eq 0) { break }
    Start-Sleep -Seconds 1
  }
  if ($LASTEXITCODE -ne 0) { throw 'PostgreSQL no quedó listo' }
  $env:TEST_POSTGRES_CONTAINER = $testContainer
  node .github/scripts/test-segunda-validacion-retiro-c09.cjs
  if ($LASTEXITCODE -ne 0) { throw 'Falló la validación C09' }
} finally {
  Remove-Item Env:TEST_POSTGRES_CONTAINER -ErrorAction SilentlyContinue
  docker stop $testContainer | Out-Null
}
```

## Desde KDS

1. Levantar Supabase local con V11 y V12 y el gateway de Compose siguiendo la [guía del flujo de pedidos](../../microservicios/operacion/puesta_en_marcha_flujo_pedidos.md). Configurar `VITE_BACKEND` con el gateway local, habitualmente `http://localhost:8080`, y `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` con el Supabase local. Iniciar Desktop con `npm run electron:dev --prefix app-desktop`.
2. En el entorno de prueba, confirmar una compra con código afiliado. Con el empleado de esa cafetería, llevar el pedido a **Listo** en **Comandas**. Registrar la comisión del pedido y el saldo disponible del afiliado en **Perfil → Mis afiliaciones → Ganancias**.
3. Validar el QR o ingresar el token de contingencia en KDS. Confirmar el mensaje de éxito y el nuevo saldo disponible. Si se usa la vista web de Desktop, revisar que la red muestre `POST /api/pedidos/validar-qr` hacia el gateway.
4. Abrir el diálogo nuevamente y repetir la misma credencial. Debe aparecer «Este pedido ya fue entregado». Volver a comprobar que el saldo, la comisión y la fecha de entrega son idénticos a los observados tras el primer intento. Registrar los resultados sin copiar credenciales.

Para ver el estado, la fecha y las comisiones del pedido en el SQL Editor local, sustituir `201` por el ID del pedido de prueba antes de cada lectura.

```sql
SELECT p.id, p.estado, p.qr_usado, p.entregado_en,
       m.id AS comision_id, m.estado AS estado_comision, m.monto_clp
FROM public.pedidos AS p
LEFT JOIN public.movimientos_comision AS m ON m.pedido_id = p.id
WHERE p.id = 201
ORDER BY m.id;
```
