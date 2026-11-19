# C08 / CAM-242 — Verificar entrega por QR y token desde KDS

**Resultado.** El QR por imagen y el token manual se probaron en dos corridas desde el KDS. Los cuatro pedidos quedaron entregados, el diálogo mostró éxito y `qr_usado` quedó en `false`. En la segunda corrida, la traza completa confirmó que Desktop persistió la entrega por escritura directa tras dos errores del servicio.

## Entorno y referencia

Validación del 18 de noviembre de 2026 (hora de Santiago) sobre `446127f`, en la rama `S3-T8-Camilodg_Verificar_entrega_por_QR_y_token_desde_KDS`. Se automatizó la interacción con la pantalla real del KDS en Edge en modo headless. Vite sirvió Desktop en `127.0.0.1:5198`, con `ms-pedidos` de la misma revisión en `127.0.0.1:3905`, Supabase local `db_CoffeeFaster` y Node.js 22.23.5. Se usó un PNG para el QR y el ingreso manual para el token. Cámara física, Electron, gateway y Cloud quedaron fuera de esta prueba.

[E01](E01-trazabilidad-entrega-qr-token.md) describe la convergencia de ambos recorridos en el mismo endpoint, la ruta alternativa de Desktop y una prueba HTTP anterior con una RPC temporal. C08 confirmó en pantalla el recorrido de ambos métodos sobre la implementación vigente y registró la ruta que persistió la entrega en este entorno.

La corrida de C08 usó una instancia local ya aprovisionada que tenía `pedidos.qr_usado`. E01 §12 inspeccionó otra instancia local donde faltaba esa columna. Una instancia preparada desde `develop` puede presentar esa misma diferencia. El procedimiento de abajo permite ejecutar la prueba con ambos esquemas.

Antes de iniciar, comprobar que la cuenta de prueba funciona en Supabase Auth, está vinculada por `usuarios.auth_user_id` a un empleado activo (`rol_id=2`) y tiene una asignación en `cafeteria_usuarios` para la cafetería de ambos pedidos. Verificar que Comandas muestre los dos pedidos en la columna de listos antes de intentar el retiro. Si falla esa preparación, registrar el bloqueo del entorno antes de evaluar el QR o el token. [Configuración local](../../microservicios/operacion/puesta_en_marcha_flujo_pedidos.md) · [Preparación de cuentas y cafeterías de prueba](../../base-datos/E02-cuentas-cafeterias-prueba.md)

## Pasos para reproducir

1. Con las dependencias instaladas y Supabase local activo, iniciar `node src/server.js` desde `Microservices/ms-pedidos` con `PORT=3905`, `SUPABASE_URL=http://127.0.0.1:54321` y las claves locales en `SUPABASE_SERVICE_KEY` y `SUPABASE_PUBLISHABLE_KEY`. Confirmar que `/health` responde.
2. Iniciar `npm run dev -- --host 127.0.0.1 --port 5198` desde `app-desktop`. Configurar `VITE_BACKEND=http://127.0.0.1:3905`, `VITE_SUPABASE_URL=http://127.0.0.1:54321` y la clave pública local en `VITE_SUPABASE_ANON_KEY`. Dejar vacío `VITE_CAFETERIA_ID` para trabajar con la cafetería de la cuenta de prueba.
3. Preparar dos pedidos de prueba pagados en estado `listo` para una misma cafetería, con credenciales persistidas distintas y `entregado_en=null`. Si existe `qr_usado`, inicializarlo en `false`; si falta, omitirlo al preparar los pedidos. Iniciar sesión en **Comandas** con el empleado de prueba. Ejecutar la consulta del paso 6 como línea base y abrir la pestaña **Red** del navegador para registrar método, ruta y estado HTTP. Excluir encabezados de autenticación y credenciales del registro.
4. Abrir **Escanear QR** y usar **Cargar imagen QR** con un PNG que codifique el `qr_token` del primer pedido como texto plano. Anotar el mensaje del diálogo y las respuestas HTTP.
5. Abrir **Ingresar Token**, escribir el `codigo_retiro_diario` del segundo pedido y presionar **Validar Token**. Registrar los mismos datos.
6. Usar esta consulta en Supabase local antes y después de los dos retiros, sustituyendo los IDs por los de los pedidos preparados. Si el campo falta, registrar `columna ausente` como resultado y conservar la evidencia de estado, fecha y respuestas HTTP. Eliminar los datos temporales al terminar.

```sql
SELECT p.id,
       p.estado,
       CASE WHEN to_jsonb(p) ? 'qr_usado'
            THEN COALESCE(to_jsonb(p) ->> 'qr_usado', 'null')
            ELSE 'columna ausente'
       END AS qr_usado,
       p.entregado_en
FROM public.pedidos AS p
WHERE p.id IN (95, 96)
ORDER BY p.id;
```

Para repetir también la medición de `qr_usado` en una base local desechable que carezca de la columna, ejecutar antes de crear los pedidos `ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS qr_usado boolean NOT NULL DEFAULT false;`. Este ajuste de prueba es opcional y no se ejecutó en la corrida registrada. Mantener las RPC tal como estén en la instancia y registrar la traza observada. La secuencia `503 → 409 → 200` de este informe corresponde a la configuración probada, incluidas sus políticas locales.

## Resultado esperado y observado

En ambos recorridos, se espera que la validación de la credencial autorizada confirme el paso de `listo` a `entregado`, con confirmación visible y fecha de entrega persistida. Cuando existe `qr_usado`, se espera que el retiro quede marcado como consumido. El resultado observado cumplió el cambio de estado y la confirmación visible. Fallaron la validación por el servicio y el consumo de la credencial.

| Recorrido | Pedido | Estado antes → después | `qr_usado` antes → después | `entregado_en` antes → después (UTC) | Respuesta en KDS |
| --- | ---: | --- | --- | --- | --- |
| QR por imagen | 95 | `listo → entregado` | `false → false` | `null → 2026-11-19T00:04:31.059Z` | «¡Entrega Validada Exitosamente!» y «Estado actual: Entregado» |
| Código de contingencia manual | 96 | `listo → entregado` | `false → false` | `null → 2026-11-19T00:04:32.601Z` | «¡Entrega Validada Exitosamente!» y «Estado actual: Entregado» |

En ambos casos, la traza del navegador registró el mismo recorrido:

| Orden | Petición | Respuesta observada |
| --- | --- | --- |
| 1 | `POST /api/pedidos/validar-qr` | `503`, «Servicio no disponible» |
| 2 | `PATCH /api/pedidos/:id/estado` | `409`, «La entrega del pedido requiere validacion QR» |
| 3 | `PATCH /rest/v1/pedidos` | `200`, escritura directa de la entrega desde Desktop |

Una primera corrida con los pedidos 93 y 94 obtuvo los mismos estados, sin consumo de las credenciales. Tras ambas corridas se comprobó que esos cuatro pedidos y las cafeterías y cuentas Auth temporales fueron eliminados.

## Comprobación de los criterios de C08

| Criterio | Evidencia |
| --- | --- |
| Verificar ambos recorridos | Dos corridas en la pantalla del KDS confirmaron una entrega visible y persistida por cada método. La traza identifica el respaldo que hizo la escritura. |
| Documentar estados y respuestas | La tabla de pedidos registra `estado`, `qr_usado`, `entregado_en` y el mensaje visible. La tabla HTTP registra las tres respuestas para ambos recorridos. |
| Dejar pasos, resultado esperado y observado con referencias | El procedimiento usa pedidos distintos y una consulta de solo lectura. Las referencias a E01 y al código permiten contrastar el recorrido y repetirlo sobre otra revisión. |

## Evidencia para las tareas dependientes

Los dos recorridos conservan el resultado visible de entrega en este entorno, pero la validación del servicio falla y la entrega se persiste por el respaldo directo de Desktop. `backendApi.request` conserva `err.status` solo para `401`. Por eso el `409` llega sin el estado que `pedidosService.updateEstado` usa para bloquear el respaldo. La escritura directa cambia el estado y la fecha, y deja `qr_usado=false`.

La firma `public.log_qr_validation(bigint,bigint,bigint,character varying,text)` se observó únicamente en el catálogo de la instancia local usada en C08. Su definición carece de DDL versionado en este repositorio y la prueba no la instaló. La [validación de ms-pedidos](../../../Microservices/ms-pedidos/src/modules/pedidos/pedidos.service.js#L719) invoca `log_qr_validation(p_qr_token)`. E01 §12 registró la ausencia de la función y E01 §13 probó por separado una RPC temporal de un parámetro. La respuesta HTTP pública de C08 fue el `503` genérico. [Evidencia de E01](E01-trazabilidad-entrega-qr-token.md)

Para C06, repetir ambos recorridos y comprobar que la primera validación persiste `entregado`, `qr_usado=true` y `entregado_en` por la operación de entrega del servicio. La traza de red permite comprobar si Desktop sigue escribiendo directamente. [C06](https://linear.app/camilodarwitg/issue/CAM-261/c06-corregir-fallos-de-entrega-por-qr-y-token)

Para C09, usar los mismos puntos de observación y agregar una lectura del saldo tras la primera y la segunda validación de un pedido afiliado elegible. C08 comprende los primeros retiros con pedidos de prueba. El segundo uso y la comisión quedan por verificar en C09. [C09](https://linear.app/camilodarwitg/issue/CAM-255/c09-probar-segunda-validacion-de-retiro)

Referencias de Desktop para la traza HTTP. [Diálogo de escaneo](../../../app-desktop/src/components/EscanearQrDialog.jsx#L234) · [Manejo de errores del cliente HTTP](../../../app-desktop/src/services/backendApi.js#L29-L38) · [Actualización de respaldo](../../../app-desktop/src/services/pedidosService.js#L371)
