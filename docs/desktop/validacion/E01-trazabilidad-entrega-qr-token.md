<!-- Traza el recorrido real de entrega por QR y token desde el KDS de Desktop hasta la transición listo → entregado, separando hechos del repositorio de lo no verificable sin el entorno desplegado. -->

# E01 · Trazar entrega por QR y token (CAM-241)

**Rama:** `ecaranza2024/cam-241-e01-trazar-entrega-por-qr-y-token` (PR #60)
**Fecha:** 2026-11-13; revisión de comentarios: 2026-11-15
**Commit de referencia:** `7b8cf77` (commit del documento) sobre `31f2521` (`develop`). La cobertura, los números de línea y las consultas de §12 se contrastaron contra ese árbol; la revisión del 2026-11-15 no cambió código.
**Alcance:** documental. No se modifica código ni SQL versionado.
**Entorno de referencia:** repositorio local en `develop`, verificación de solo lectura sobre Supabase local (§12) y una validación de **integración parcial** con RPC temporal sobre esa misma base local (§13). No se ejecutó el KDS desplegado, el gateway nginx ni Supabase Cloud; §13 no es un despliegue.

> Convención: **Hecho** = verificable en el repositorio citado, en la verificación local de solo lectura (§12) o en la validación de integración parcial con RPC temporal (§13). **No verificable** = depende de Supabase Cloud, del cuerpo real de la RPC en Cloud o de un entorno desplegado que no estaba disponible.

---

## 1. Criterios de aceptación de CAM-241 y respuesta directa

| # | Criterio | Respuesta | Evidencia |
|---|---|---|---|
| 1 | Punto de confirmación identificado para ambos recorridos, o documentado qué recorrido aún no entrega | **Ambos recorridos convergen en el mismo punto de validación** ([EscanearQrDialog.jsx](../../../app-desktop/src/components/EscanearQrDialog.jsx), `validar()`, líneas 198-281). El QR y el token manual no tienen caminos separados. La transición `listo → entregado` **no la ejecuta Desktop**: en la vía `ms-pedidos` la delega en `log_qr_validation` (contrato ejercitado solo con la RPC del fixture, §13) y en el fallback la ejecuta con un `UPDATE` directo a Supabase. | `validar()` (L198), `backendApi.validarQr` (L234), `validarQrEntrega` (L238, L250), `updateEstado` en [pedidosService.js](../../../app-desktop/src/services/pedidosService.js) (L371-430) |
| 2 | Si el token no registra la entrega, identificar el bloqueo y escalarlo al inicio de la primera semana | **No se puede afirmar que el token no registre la entrega.** Lo que sí está bloqueado/indeterminado es la **vía `ms-pedidos`**: delega toda la operación en una RPC ausente del repositorio. El bloqueo verificable es de trazabilidad/atomicidad, no de "token no entrega". Se documenta en §8 y se consume en CAM-261. | `validarQr` en [pedidos.service.js de ms-pedidos](../../../Microservices/ms-pedidos/src/modules/pedidos/pedidos.service.js) (L745-750); búsqueda SQL sin `CREATE FUNCTION` (§8.1) |
| 3 | El documento indica la decisión o hallazgo, el caso que lo justifica y la tarea que lo consume | Cada hallazgo de §8 tiene fila propia en la matriz de §10 con caso justificante y tarea/decisión consumidora (CAM-261, CAM-242, CAM-255, CAM-178). | §8 y §10 |

---

## 2. Entrada del KDS

**Hecho.** El escaneo no es una ruta independiente: es un diálogo montado sobre el tablero de comandas.

1. [KdsTopBar.jsx](../../../app-desktop/src/components/KdsTopBar.jsx) (L55, L127-131) expone el botón de escaneo mediante la prop `onEscanear`.
2. [Comandas.jsx](../../../app-desktop/src/pages/empleado/Comandas.jsx) (L273) conecta `onEscanear={() => setEscaneando(true)}`.
3. El diálogo se monta permanentemente y solo se abre con `open={escaneando}` (L357-362), recibiendo:
   - `cafeteriaId={cafeteriaIdEmpleado}` (derivado del perfil del empleado, L62-68),
   - `usuarioId` como `String(currentUser.id)`,
   - `onClose`.
4. `handleCambiarEstado` (L203-244) **no participa** de la entrega por QR: solo mueve estados del Kanban vía `pedidosService.updateEstado`.

**Consecuencia:** cualquier comportamiento de entrega depende por completo de `EscanearQrDialog`; no hay segundo punto de entrada en Desktop.

---

## 3. Recorrido QR por cámara e imagen

### 3.1 Cámara

**Hecho.** [EscanearQrDialog.jsx](../../../app-desktop/src/components/EscanearQrDialog.jsx):

- `getUserMedia` con resolución ideal 1280×720 y `facingMode: environment` (L299-306); si falla, reintenta con `video: true` (L309-312).
- Bucle `requestAnimationFrame` con muestreo cada ~140 ms (L358-398).
- El frame se dibuja en un canvas oculto escalado a un máximo de 1000 px (L375-380) y se decodifica con `jsQR(imgData.data, w, h, { inversionAttempts: 'attemptBoth' })` (L382-386).
- Un QR con datos no vacíos llama `validar(qr.data.trim())` (L388-390).
- Errores de cámara se traducen a mensajes por `err.name` (`NotAllowedError`, `NotFoundError`, etc., L32-48 y L399-408) y se ofrece reintentar o subir imagen.

### 3.2 Imagen

**Hecho.** `procesarImagenSubida` (L426-462):

- `FileReader` → `Image` → canvas escalado a máximo 800 px (L435-437).
- Dos intentos: `jsQR(..., { inversionAttempts: 'dontInvert' })` y, si falla, `attemptBoth` (L444-446).
- Sin QR en la imagen: resultado visual de rechazo (L451-455).

### 3.3 Normalización

**Hecho.** `validar()` aplica `normalizarTokenQR` (L214), que es `extraerCredenciales(texto)[0]` ([pedidosService.js](../../../app-desktop/src/services/pedidosService.js) L110-112).

`extraerCredenciales` (L70-108):

- Acepta JSON de QR con claves `qr_token`, `token`, `codigo_retiro_diario`, `codigo_pedido`, `pedido_id`, `id` (L8, L84-92).
- Acepta URL de retiro tomando el último segmento (L95-101).
- Si el texto no es JSON ni URL, lo usa tal cual (L105).
- Devuelve la lista completa de candidatas, pero **el diálogo conserva solo la primera**: `normalizarTokenQR` (L110-112) reduce esa lista a `[0]` y ese único valor se pasa tanto a `backendApi.validarQr` (L234) como a `validarQrEntrega` (L238 y L250).

**Consecuencia (hecho).** Si el JSON del QR trae un `qr_token` inválido y además un `codigo_retiro_diario` válido, el diálogo descarta la segunda credencial antes de llamar al servicio. El bucle de `validarQrEntrega` (L450-458) podría recorrer varias candidatas si recibiera el JSON crudo, pero recibe una lista de un solo elemento: **el KDS no intenta automáticamente un segundo token dentro del mismo JSON**. Cada intento manual o nuevo escaneo vuelve a empezar por la primera credencial disponible.

Si la normalización devuelve cadena vacía, el diálogo rechaza sin llamar al backend: "Código QR no reconocido..." (L217-227).

### 3.4 Llamada al backend

**Hecho.** `backendApi.validarQr(token)` ([backendApi.js](../../../app-desktop/src/services/backendApi.js) L54-72):

- Exige sesión de Supabase; sin `access_token` lanza "No hay sesión activa..." (L55-58).
- `POST ${BASE_BACKEND}/api/pedidos/validar-qr` con `Authorization: Bearer <access_token>` y cuerpo `{ qr_token: String(token) }` (L59-64).
- Si el cuerpo trae `valido`, lo devuelve tal cual, incluso para HTTP no-2xx (L69); 401 se convierte en error de sesión (L66-68).

En `ms-pedidos`, la ruta es `router.post('/validar-qr', auth.exigirAuth, validarQr)` ([pedidos.routes.js](../../../Microservices/ms-pedidos/src/modules/pedidos/pedidos.routes.js) L30). `exigirAuth` ([auth.js](../../../Microservices/shared/src/auth.js) L74-107) valida el Bearer contra Supabase Auth y responde 401 sin token o con token inválido. El controlador solo reenvía (`pedidos.controller.js` L82-88) y el servicio delega en la RPC (L745-750, §8.1).

### 3.5 Resultado visual

**Hecho.** Un único objeto `resultado` controla tres estados (L677-814):

| Estado | Condición | Presentación |
|---|---|---|
| Éxito | `resultado.valido === true` | Fondo verde, `CheckCircleIcon`, "¡Entrega Validada Exitosamente!", mensaje del backend o "El pedido fue marcado como entregado", bloque con `Pedido #id` y "Estado actual: Entregado" (L680-734). |
| Rechazo comercial | `resultado.valido === false` | Fondo ámbar, `WarningAmberIcon`, "Validación Rechazada", `razon` y, si hay pedido, `Pedido #id · Estado: <estado>` (L737-788). |
| Error de conexión | excepción en `validar()` | `Alert` rojo "Error de Conexión" con `errorConexion` (L801-814). |

Además: tono ascendente y vibración en éxito, tono grave en rechazo (L53-117, L267-272). El texto "Estado actual: Entregado" (L715) es **estático**: no se lee del pedido devuelto.

---

## 4. Recorrido de token manual y convergencia

**Hecho.** El modo token es una pestaña del mismo diálogo (L493-494). No hay endpoint ni servicio distinto:

1. `TextField` "Código / Token", `autoFocus`, con `Enter` → `validar(tokenInput)` (L644-664).
2. Botón "Validar Token" → `validar(tokenInput)` (L665-673).
3. `validar()` (L198) aplica el mismo `normalizarTokenQR` (L214) y la misma cadena `backendApi.validarQr` → fallback `pedidosService.validarQrEntrega` (L233-258).
4. El mismo `resultado` alimenta la misma UI de éxito/rechazo.

**Convergencia real:** la única diferencia entre QR y token es el origen del texto (cámara, imagen o teclado). A partir de `normalizarTokenQR` el flujo es idéntico.

**Diferencia de credencial (hecho):** el QR puede contener un JSON con varias claves; el token tecleado es texto plano y produce una sola candidata. En ambos casos el diálogo conserva **solo la primera** credencial (§3.3) y esa credencial se compara contra `qr_token`, `codigo_retiro_diario` y `codigo_pedido` ([pedidosService.js](../../../app-desktop/src/services/pedidosService.js) L352-357). El pedido se resuelve si esa primera credencial coincide con alguna de las tres columnas; una segunda credencial del mismo JSON no se prueba.

---

## 5. Enrutamiento y configuración efectiva

**Hecho.**

| Pieza | Valor en el repositorio | Evidencia |
|---|---|---|
| Base del backend en Desktop | `import.meta.env.VITE_BACKEND \|\| 'http://localhost:3000'` | [backendApi.js](../../../app-desktop/src/services/backendApi.js) L1-2 |
| Variables de entorno | `VITE_BACKEND` **no está definida** en `.env` ni en `app-desktop/.env`; sí lo están `VITE_CAFETERIA_ID`, `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` (valores no reproducidos) | `.env`, `app-desktop/.env` |
| Vite | `envDir` apunta a la raíz del repositorio | [vite.config.js](../../../app-desktop/vite.config.js) L10 |
| Gateway local | nginx publica `/api/pedidos` → `http://ms-pedidos:3005` | [gateway/nginx.conf](../../../Microservices/gateway/nginx.conf) L41-47 |
| Gateway en Compose | publica `${GATEWAY_PORT:-8080}:80` | [docker-compose.yml](../../../Microservices/docker-compose.yml) L21 |
| `ms-pedidos` | `PORT: 3005`; publica `${MS_PEDIDOS_PORT:-3005}` | [docker-compose.yml](../../../Microservices/docker-compose.yml) L96, L101-102 |
| Gateway en Kubernetes | mismo `location /api/pedidos` | [k8s-next/gateway/nginx.conf](../../../k8s-next/gateway/nginx.conf) L60 |
| Contrato documentado | `POST /api/pedidos/validar-qr` → `ms-pedidos` | [README de microservicios](../../microservicios/operacion/README.md) L104 |

**Consecuencia verificable:** con los `.env` actuales, si nadie exporta `VITE_BACKEND`, Desktop apunta por defecto a `http://localhost:3000`, que es el puerto de **backend-node legacy** ([server.js](../../../backend-node/server.js) L4), no el gateway (`8080`) ni `ms-pedidos` (`3005`). La documentación vigente afirma que Desktop usa el gateway ([estado-actual.md](../../estado-actual.md) L7), así que la configuración efectiva depende de un valor externo no versionado.

### 5.1 backend-node legacy es un escenario distinto

**Hecho.** El backend legacy también expone `POST /api/pedidos/validar-qr` ([rutas](../../../backend-node/src/modules/pedidos/pedidos.routes.js) L22; [controlador](../../../backend-node/src/modules/pedidos/pedidos.controller.js) L180-205), pero:

- Espera `req.body.token`, no `qr_token` (L183-186). Desktop envía `{ qr_token }`, así que contra legacy la petición responde 400 "Debe proporcionar el token o código QR a validar".
- Resuelve la entrega en Node: busca el pedido, exige estado "Listo", registra auditoría y llama `updateEstado(..., 'Retirado')`, que marca `qr_usado = true` ([pedidos.service.js](../../../backend-node/src/modules/pedidos/pedidos.service.js) L600-728, L535).
- Rechaza explícitamente el `id` numérico como credencial (L625-633).
- Tiene pruebas de un solo uso y rechazo por estado no listo ([qr.test.js](../../../backend-node/tests/qr.test.js) L112-155).

Por tanto, los resultados de legacy **no describen** el camino `ms-pedidos` ni el fallback de Desktop.

---

## 6. Punto de confirmación de negocio `listo → entregado` y rechazos observables

**Hecho en Desktop (fallback).** `validarQrEntrega` es el único punto que verifica la regla de negocio y ejecuta la transición ([pedidosService.js](../../../app-desktop/src/services/pedidosService.js) L442-506):

| Verificación | Línea | Resultado observable |
|---|---|---|
| Credencial vacía | L443-446 | `valido: false`, "QR vacío o ilegible…" |
| Pedido no encontrado | L461-464 | "QR no reconocido…" |
| Cafetería distinta | L465-470 | "El pedido #N no pertenece a esta cafetería." |
| Ya entregado | L471-475 | "El pedido #N ya fue entregado." |
| Estado distinto de `listo` | L476-480 | "El pedido #N aún no está listo para retiro (estado: X)." |
| No se pudo marcar entregado | L482-487 | "El pedido #N no pudo marcarse como entregado." |
| Éxito | L482, L495-500 | `valido: true`, pedido actualizado y `credencialUsada` |

La transición válida `listo → entregado` está declarada en `TRANSICIONES_VALIDAS` (L281-285).

**Hecho en `ms-pedidos`.** El `PATCH /api/pedidos/:id/estado` **no puede** producir la entrega: responde 409 "La entrega del pedido requiere validacion QR" para `entregado` ([pedidos.service.js](../../../Microservices/ms-pedidos/src/modules/pedidos/pedidos.service.js) L637-642). La única vía prevista es la RPC de `validar-qr`, cuyo interior se desconoce (§8.1).

**No verificable en Cloud:** si la RPC real cambia estado, marca `qr_usado`, sella `entregado_en`, valida cafetería/rol o rechaza el segundo uso. Nada de eso está en Node: `validarQr` no consulta el pedido ni comprueba estado antes de llamar a la RPC (L745-750). La validación con fixture (§13) sí comprobó esos efectos con una RPC que los implementa, pero no el cuerpo real de Cloud.

**Rechazos observables en UI (hecho):** la `razon` del backend o del fallback se pinta en el panel ámbar; los errores de red en el `Alert` rojo. Los `status` HTTP no se muestran como código, solo como mensaje.

---

## 7. Fallback actual de Desktop hacia `pedidosService.validarQrEntrega` y Supabase

**Hecho.** [EscanearQrDialog.jsx](../../../app-desktop/src/components/EscanearQrDialog.jsx) L229-258 tiene **dos** entradas al fallback:

1. **Backend no disponible o error:** captura la excepción de `backendApi.validarQr` y llama `validarQrEntrega(token, usuarioIdRef.current)` (L236-239).
2. **Backend respondió `valido: false`:** si la razón no contiene "ya fue entregado" ni "no está listo", reintenta en Supabase y, si Supabase acepta, sustituye el rechazo del backend (L242-258). Es una segunda opinión local sobre una decisión ya tomada por el servicio.

`validarQrEntrega` entonces:

- Busca el pedido con `getByQrToken`, que consulta Supabase directamente (L337-369).
- Registra cada intento en `logs_validacion_qr` (`_registrarLogValidacion`, L508-537).
- Ejecuta `updateEstado(pedido, 'entregado')` (L482). `updateEstado` intenta primero `PATCH` a `ms-pedidos` (L381-402) y, ante el 409 de "requiere validacion QR" (mensaje sin `status`), **no lo propaga**: cae al `UPDATE` directo en Supabase con `{ estado, entregado_en }` (L404-429).

**Consecuencia verificable:** el fallback no es una operación atómica ni demuestra autorización de servidor. Es un `UPDATE` de cliente cuyo único filtro es la lectura previa del estado: en el Supabase local, `public.pedidos` tiene **RLS desactivada** (§12) y los `GRANT` de tabla alcanzan a `anon` y `authenticated`, así que ninguna política restringe esa escritura; en Cloud no se verificó. Además **no escribe `qr_usado`** (solo `entregado_en`, L409-416); la unicidad del token depende únicamente de que el estado ya sea `entregado`.

---

## 8. Hallazgos y bloqueos verificables

### 8.1 RPC `log_qr_validation` no versionada (bloqueo principal)

**Hecho.** `ms-pedidos` llama `supabase.obtenerCliente().rpc('log_qr_validation', { p_qr_token: body?.qr_token })` y devuelve `data` sin reinterpretarlo ([pedidos.service.js](../../../Microservices/ms-pedidos/src/modules/pedidos/pedidos.service.js) L745-750).

**Hecho.** No existe `CREATE FUNCTION` / `CREATE OR REPLACE FUNCTION public.log_qr_validation` en ningún `.sql` versionado del repositorio (búsqueda sobre `database/`, `supabase/`, `app-mobile/`). El análisis previo llega a la misma conclusión en [D4 §5](../../base-datos/D4_validacion_qr_entrega.md) y en [dependencias SQL](../../base-datos/dependencias-sql-ms-pedidos.md) (fila `log_qr_validation`: "EXTERNA / NO ENCONTRADA").

**Hecho en Supabase local (solo lectura, §12):** `public.log_qr_validation` no aparece en `pg_proc` y `POST /rest/v1/rpc/log_qr_validation` responde `404` con `PGRST202` ("Could not find the function ... in the schema cache"). La única función relacionada observada es `validar_transicion_estado()`, usada por un trigger, que no demuestra autorización, atomicidad, consumo ni auditoría de entrega.

**No verificable:** la forma real en Supabase Cloud, su firma, cuerpo, permisos `EXECUTE`, tablas que escribe, si valida rol/cafetería/estado, si marca `qr_usado`/`entregado_en` o si bloquea concurrencia. **No se inventa comportamiento.**

**Hecho en la validación con fixture (§13):** el contrato esperado se ejercitó creando una RPC temporal `log_qr_validation` con `FOR UPDATE`, que se eliminó al restaurar el respaldo. Ese PASS describe la RPC del fixture, **no** el cuerpo real de Cloud, que sigue sin conocerse.

**Riesgo:** el endpoint `ms-pedidos` puede responder éxito sin que exista transición real, o fallar con 503 (`HttpError(503, error.message)`) si la RPC no existe en el proyecto remoto. La ausencia está confirmada solo en local; en Cloud sigue pendiente de comparar.

### 8.2 `cafeteriaIdValidacion` no se envía desde `EscanearQrDialog`

**Hecho.** Las dos llamadas del diálogo pasan solo token y `usuarioId`: `validarQrEntrega(token, usuarioIdRef.current)` (L238 y L250). `cafeteriaIdValidacion` queda `null`.

**Hecho.** `validarQrEntrega` cae entonces en `CAFETERIA_ID` ([backendApi.js](../../../app-desktop/src/services/backendApi.js) L4-5) o en `null` (L465). Si `VITE_CAFETERIA_ID` no está definido, `cidVal` no es finito y **se omite la comprobación de cafetería** (L466).

**Riesgo:** aunque el diálogo recibe `cafeteriaId`, el fallback puede entregar un pedido de otra cafetería si conoce la credencial. La comprobación existe pero no recibe el dato que la UI ya tiene.

### 8.3 `getByQrToken` acepta el `id` numérico como credencial

**Hecho.** Si el texto es solo dígitos, agrega `id.eq.<texto>` al filtro `.or()` ([pedidosService.js](../../../app-desktop/src/services/pedidosService.js) L357). De ahí que la UI anuncie "Acepta token del QR, código de contingencia o ID del pedido" (L820).

**Contraste (hecho).** El backend legacy rechaza explícitamente el `id` como token por ser correlativo y visible ([pedidos.service.js](../../../backend-node/src/modules/pedidos/pedidos.service.js) L625-633). `ms-pedidos` no revela esta decisión porque delega en la RPC.

**Riesgo:** en el fallback, conocer el número de pedido basta para intentar retirarlo, sujeto solo a la comprobación de cafetería —que puede estar desactivada (§8.2)— y al estado `listo`.

### 8.4 El fallback directo no demuestra atomicidad ni actualiza `qr_usado`

**Hecho.** `validarQrEntrega` lee el pedido, comprueba `estado === 'listo'` y después actualiza (L452-482). No hay condición atómica sobre el estado ni filas afectadas: dos escaneos simultáneos pueden leer `listo` y ambos ejecutar el `UPDATE`. `updateEstado` escribe `estado` y `entregado_en`, pero **no** `qr_usado` (L409-416).

**Contraste (hecho en el repositorio).** El legacy sí marca `qr_usado = true` al entregar (L535). El DDL versionado declara `qr_usado` ([activar_stock_promociones_cloud.sql](../../../database/fixes/activar_stock_promociones_cloud.sql) L182; `CAMPOS_PEDIDO_PUBLICOS` en `ms-pedidos` L119), pero la tabla `pedidos` del Supabase local **no tiene esa columna** (§12), igual que no tiene expiración de credenciales. El fallback de Desktop tampoco la escribe. La validación con fixture la añadió de forma temporal y la eliminó al restaurar (§13).

**Hecho en Supabase local (verificado el 2026-11-15, §12).** `public.pedidos` tiene `relrowsecurity = false` y `GRANT` de tabla para `anon`, `authenticated` y `service_role`; ninguna política restringe el `UPDATE` del cliente. El trigger `validar_transicion_estado` permite `viejo_estado = nuevo_estado`, por lo que tampoco bloquea una segunda escritura `entregado → entregado`. Ambas cosas son del entorno local; en Cloud no se verificaron.

**Riesgo:** la unicidad del retiro en el fallback depende solo del estado previo leído en el cliente. Un segundo escaneo concurrente puede leer `listo`, volver a escribir `entregado_en` y duplicar el log de entrega sin consumir el token, y en local no hay RLS que lo impida.

### 8.5 El fallback puede revertir un rechazo del backend

**Hecho.** Si `ms-pedidos` responde `valido: false` por una razón distinta de "ya fue entregado" o "no está listo", Desktop consulta Supabase y **reemplaza el rechazo** si el fallback acepta (L242-258).

**Riesgo:** la autoridad del servicio queda subordinada al cliente; un rechazo por una regla nueva del backend (por ejemplo cafetería o un solo uso) no se respeta.

### 8.6 Auditoría con columnas no versionadas

**Hecho.** Desktop inserta en `logs_validacion_qr` las columnas `qr_token_leido` y `motivo_rechazo` (L524-531). El DDL versionado define `qr_token`, `resultado`, `detalle`, `validado_en` y **no** define `qr_token_leido` ni `motivo_rechazo` ([crear_logs_validacion_qr.sql](../../../database/fixes/crear_logs_validacion_qr.sql) L17-26). El legacy inserta además `detalle` y `creado_en` (L730-745).

**Hecho en Supabase local (solo lectura, §12).** La tabla real tiene 8 columnas: `id`, `pedido_id`, `cafeteria_id`, `usuario_id`, `qr_token`, `resultado`, `detalle`, `validado_en`. Faltan `qr_token_leido`, `motivo_rechazo` y `creado_en`, que sí usan Desktop y legacy. El `insert` de Desktop falla silenciosamente en este esquema.

**No verificable:** si Supabase Cloud coincide con el esquema local o con el DDL versionado. **No se inventa el esquema remoto.**

**Riesgo:** auditoría incompleta o silenciosamente perdida, justo en el flujo que necesita evidencia.

### 8.7 Cobertura automatizada

**Hecho (árbol `31f2521`, documento en `7b8cf77`).** No hay pruebas de `EscanearQrDialog`, `validarQrEntrega`, `getByQrToken` ni del endpoint `validarQr` de `ms-pedidos`. `app-desktop/tests/` contiene solo [panel-dueno.test.cjs](../../../app-desktop/tests/panel-dueno.test.cjs); `ms-pedidos/tests/` contiene `auth.test.js`, `pedidos.test.js` y `setup.js`, sin `validar-qr` ni `log_qr_validation`. `backend-node/tests/qr.test.js` cubre el flujo legacy, que es otro recorrido (§5.1).

**Alcance de esta afirmación:** vale para el commit citado. `develop` incorpora suites de otras tareas de forma continua; si se revisa después, hay que repetir la búsqueda sobre el nuevo `HEAD` antes de reutilizar esta fila.

---

## 9. Logs y evidencia disponible

**Hecho.**

| Fuente | Qué deja | Ubicación |
|---|---|---|
| Desktop, diálogo | `console.log('[KDS Escáner] Procesando lectura de QR:', textoLimpio)` (L211); `console.warn` para QR sin formato, caída a Supabase y rechazo cruzado (L218, L237, L252); `console.error` de error de validación (L274); `console.error` de cámara (L401) | [EscanearQrDialog.jsx](../../../app-desktop/src/components/EscanearQrDialog.jsx) |
| Desktop, servicio | `console.warn('validarQrEntrega:', err)` (L502), `console.warn` de transición inválida (L376), `console.warn` del fallback (L401), `console.warn` del log fallido (L533) | [pedidosService.js](../../../app-desktop/src/services/pedidosService.js) |
| Supabase | `INSERT` en `logs_validacion_qr` con resultado `rechazado` / `entregado` / `error` | `_registrarLogValidacion` (L508-537) |
| Legacy | `POST /validar-qr` actualiza `pedidos` y escribe `logs_validacion_qr`; probado en `backend-node/tests` | [pedidos.service.js](../../../backend-node/src/modules/pedidos/pedidos.service.js) L600-760; [qr.test.js](../../../backend-node/tests/qr.test.js) |
| `ms-pedidos` | No registra nada propio: ni `console` de negocio ni tabla directa. Solo devuelve `data` o un `HttpError(503)` | [pedidos.service.js](../../../Microservices/ms-pedidos/src/modules/pedidos/pedidos.service.js) L745-750 |
| RPC | Sin evidencia en el repositorio: no hay cuerpo, migración ni prueba | §8.1 |

**Evidencia documental previa (histórica, no estado actual):** [D4](../../base-datos/D4_validacion_qr_entrega.md) describe el contrato objetivo y advierte que Node "todavía NO está implementado"; hoy sí existe el endpoint delegado, pero el cuerpo de la RPC sigue sin versionarse. [estado-actual.md](../../estado-actual.md) L25 mantiene pendiente "Escaneo, entrega y rechazo del segundo uso en el entorno final".

**Evidencia ejecutada en este documento:** (a) solo lectura contra Supabase local (§12): consultas a catálogo y conteos, y un `POST` a la RPC con token ficticio que devolvió 404 sin alterar datos; (b) validación de integración parcial con fixture temporal (§13): sí se ejecutaron entregas contra datos temporales `900xxx` a través de la RPC temporal y del endpoint `ms-pedidos` en el puerto `3905`, se comprobó el estado resultante y después se restauró el respaldo. No se abrió el KDS, no se usó nginx/gateway, no se consultó Supabase Cloud y ningún dato previo del entorno local quedó modificado. Ningún token, JWT, clave de API ni valor de `.env` se reproduce en este documento: los comandos usan marcadores como `$JWT`.

---

## 10. Matriz de decisión / resultado

| Hallazgo | Verificado en código | No confirmable sin entorno desplegado | Consume |
|---|---|---|---|
| QR y token convergen en `validar()` | Sí: ambos modos llaman la misma función (L198, L654, L670) | — | CAM-242 (mismos casos para ambos recorridos) |
| Un intento usa una sola credencial | Sí: `normalizarTokenQR` toma `[0]` (L110-112) y ese valor es el que reciben `validarQr` y `validarQrEntrega` (L234, L238, L250) | Si la RPC acepta otras credenciales del mismo JSON | CAM-242 (casos de prueba de QR y token) |
| La entrega `ms-pedidos` depende de la RPC | Sí: `rpc('log_qr_validation')` sin lógica en Node (L745-750); ausente en Supabase local (`pg_proc` vacío y REST 404/`PGRST202`, §12) | Firma, permisos y efectos en Supabase Cloud | CAM-261 (corregir causa en flujo existente) y decisión de versionar la RPC |
| `PATCH` no puede entregar | Sí: 409 explícito (L637-642) | — | — |
| Fallback directo de Desktop | Sí: `updateEstado` cae a `UPDATE` de Supabase (L381-429); en local `pedidos` no tiene RLS activa y el trigger permite `X → X` (§8.4, §12) | RLS y trigger de Cloud; concurrencia real del KDS desplegado | CAM-178 (revisión de integración backend/KDS y concurrencia) |
| `qr_usado` no se actualiza en fallback | Sí: solo `estado` y `entregado_en` (L409-416); la columna no existe en `pedidos` local (§12) | La RPC del fixture sí lo hace (§13); el cuerpo real de Cloud y la presencia de la columna siguen sin confirmarse | CAM-255 (segunda validación) |
| `cafeteriaIdValidacion` no se envía | Sí: L238 y L250 pasan solo dos argumentos | Valor efectivo de `VITE_CAFETERIA_ID` desplegado | CAM-261 |
| `id` numérico aceptado | Sí: L357; UI lo anuncia (L820) | Si la RPC también lo acepta | CAM-261 (decisión de credencial válida) |
| Rechazo del backend revertido por Supabase | Sí: L242-258 | — | CAM-261 |
| Columnas de auditoría no versionadas | Sí: L524-531 frente a DDL L17-26; confirmado en local: 8 columnas y faltan `qr_token_leido`, `motivo_rechazo`, `creado_en` (§12) | Esquema real de `logs_validacion_qr` en Cloud | Decisión de BD (versionar DDL o ajustar el insert) |
| Sin cobertura automatizada | Sí: no hay tests del flujo | Comportamiento real en el KDS desplegado | CAM-242 y CAM-255 (pruebas de regresión) |
| `VITE_BACKEND` sin definir | Sí: ausente en ambos `.env`; default `localhost:3000` | Valor inyectado en build/despliegue | Decisión de configuración (apuntar al gateway `8080`/servicio) |

### Decisión propuesta (derivada de los hechos)

1. **No afirmar que QR o token "no entregan"**: ambos llegan al mismo punto; lo indeterminado es el efecto de la RPC en `ms-pedidos` (§8.1).
2. **Tratar el fallback de Desktop como no autoritativo**: no demuestra atomicidad, no consume `qr_usado` y puede revertir un rechazo (§8.2-8.5). Cualquier prueba de entrega debe registrar qué vía se usó.
3. **Escalar al inicio de la primera semana** la ausencia de la RPC versionada y el desajuste de columnas de auditoría, por ser bloqueos de verificación, no de UI.
4. **No modificar código en esta tarea**: los consumidores son CAM-261 (corrección), CAM-242 (verificación), CAM-255 (segunda validación) y CAM-178 (concurrencia).

### Clasificación del estado de la evidencia

- **Verificado localmente (solo lectura):** Supabase local accesible; `log_qr_validation` ausente en `pg_proc` y REST devuelve 404/`PGRST202`; esquema local de `logs_validacion_qr` y `pedidos`; datos de prueba existentes. Detalle en §12.
- **Ejecutado con integración parcial (§13):** hubo entregas, consumo de credenciales y transiciones de estado a través de la RPC temporal y del endpoint `ms-pedidos`, únicamente sobre datos `900xxx` con respaldo previo y restauración verificada. No se ejecutó el KDS, ni el gateway, ni la RPC de Cloud. Ningún dato previo del entorno local quedó alterado.
- **Pendiente de comparar con Supabase Cloud:** existencia y cuerpo real de la RPC, permisos, RLS, concurrencia, esquema real de `logs_validacion_qr`/`pedidos` y comportamiento del KDS desplegado.

**Conclusión acotada:** la ausencia de `log_qr_validation` y el desajuste de columnas están confirmados en el entorno local, no en Cloud. La validación con fixture demuestra que el contrato `listo → entregado` es ejecutable y verificable cuando existe una RPC que lo implementa (§13), pero no prueba el cuerpo real de Cloud ni el flujo desplegado. En reposo, el código actual sigue sin demostrar autorización, atomicidad, consumo ni auditoría de entrega en la vía `ms-pedidos`.

---

## 11. Comprobaciones de esta tarea

Comandos y resultados de la revisión del 2026-11-15 sobre el árbol `7b8cf77` (las consultas de solo lectura se repitieron; no se volvió a ejecutar el fixture).

| Comprobación | Comando | Resultado observado |
|---|---|---|
| Espacios en blanco y marcadores de conflicto | `git diff --check` | Sin salida: 0 errores |
| Archivos de la tarea | `git status --porcelain` | Solo el documento aparece como cambio de la tarea; `.agents/`, `.playwright-mcp/`, `database/pendientes/` y `docs_local/` siguen sin versionar y sin modificar |
| Enlaces relativos | extracción de `](...)` y `test -e` sobre cada ruta | 24 rutas distintas, todas existentes (46 apariciones), 0 roto |
| RPC en el catálogo local | `docker exec supabase_db_taller-integracion-3 psql -U postgres -d postgres -tAc "select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='log_qr_validation'"` | `0` |
| Columnas de auditoría | `\d public.logs_validacion_qr` | 8 columnas; faltan `qr_token_leido`, `motivo_rechazo` y `creado_en` |
| Columnas de `pedidos` | `\d public.pedidos` | Sin `qr_usado` ni expiración de credenciales; `qr_token` único; `entregado_en` presente |
| RLS y permisos | `\dp public.pedidos` y `select relrowsecurity from pg_class where relname in ('pedidos','logs_validacion_qr')` | `pedidos`: `relrowsecurity=false`; `anon`, `authenticated` y `service_role` con `arwdDxtm`. `logs_validacion_qr`: RLS activa con 2 políticas (`INSERT` empleado, `SELECT` dueño) |
| Conteos y estado | `select count(*) from public.pedidos`, `from public.logs_validacion_qr` y conteo por `estado` | 3 pedidos, 4 logs, 1 pedido en `listo`, 0 en `entregado` |
| Logs históricos | `select l.id, l.resultado, p.estado from logs_validacion_qr l join pedidos p on p.id=l.pedido_id` | 2 logs `entregado` sobre pedidos que no están en `entregado` |

**Validación con fixture (§13):** no se re-ejecutó en esta revisión. Los pasos y los resultados observados en la ejecución del 2026-11-13 se detallan en §13.2. No se ejecutaron suites nuevas ni se modificaron archivos versionados; el cambio final es exclusivamente documental.

---

## 12. Verificación de Supabase local (solo lectura)

Verificación realizada con los contenedores locales activos (`supabase_db_taller-integracion-3` y `supabase_kong_taller-integracion-3`). No se usaron credenciales en claro ni se reproducen valores sensibles. Las consultas de catálogo, esquema, RLS y conteos se repitieron el 2026-11-15 con idéntico resultado; el `POST` REST de la fila correspondiente se ejecutó el 2026-11-13 y no se repitió.

| Comprobación | Resultado |
|---|---|
| Acceso por Docker/CLI | **Sí.** Contenedores de Supabase local activos; Postgres en `127.0.0.1:54322` y API en `127.0.0.1:54321`. |
| `public.log_qr_validation` en `pg_proc` | **No existe.** El conteo sobre `pg_proc` para ese nombre en el esquema `public` es 0. |
| `POST /rest/v1/rpc/log_qr_validation` | **404** con código `PGRST202`: la función `public.log_qr_validation(p_qr_token)` no está en la caché de esquema. |
| Única función relacionada observada | `validar_transicion_estado()`, usada por el trigger `trg_validar_transicion_estado` sobre `pedidos`. No demuestra autorización, atomicidad, consumo ni auditoría de entrega. |
| Esquema de `logs_validacion_qr` | **8 columnas:** `id`, `pedido_id`, `cafeteria_id`, `usuario_id`, `qr_token`, `resultado`, `detalle`, `validado_en`. Faltan `qr_token_leido`, `motivo_rechazo` y `creado_en`, usadas por Desktop y legacy. |
| Esquema de `pedidos` | Tiene `qr_token`, `codigo_retiro_diario`, `estado` y `entregado_en`; **no** tiene `qr_usado` ni columnas de expiración de credenciales. |
| Datos locales | Hay datos de prueba: 3 pedidos y 4 logs. Incluye 1 pedido en estado `listo` con `qr_token` y `codigo_retiro_diario` presentes. En la fase de solo lectura no se consumió la credencial ni se ejecutó una entrega; las entregas posteriores usaron solo datos temporales y se restauraron (§13). |
| Llamada con token ficticio | Solo confirmó el 404 de la RPC. Los conteos de `pedidos` y `logs_validacion_qr` quedaron iguales antes y después de la llamada. |
| Logs históricos | Hay 2 logs con `resultado = 'entregado'` cuyo pedido asociado no está en estado `entregado`. El log no demuestra la transición. |
| RLS y permisos de tabla | `public.pedidos`: `relrowsecurity = false` y `GRANT arwdDxtm` a `postgres`, `anon`, `authenticated` y `service_role`; no hay políticas. `public.logs_validacion_qr`: `relrowsecurity = true` con 2 políticas (`INSERT` para empleado, `SELECT` para dueño). |
| Respaldo y restauración | `pg_dump` previo al fixture y restauración final. Verificado el 2026-11-15: no existen la columna `qr_usado`, la tabla `cafeteria_usuarios` ni la función `log_qr_validation`; los conteos son 3 pedidos y 4 logs. |
| Permisos restaurados | Los `GRANT` de ambas tablas corresponden al juego estándar de Supabase (`postgres`, `anon`, `authenticated`, `service_role`) y `logs_validacion_qr` conserva sus 2 políticas. |
| Permisos no verificables | No se guardó copia de las ACL/RLS anteriores al fixture, así que la restauración no es demostrable byte a byte; tampoco consta si `pedidos` ya tenía RLS desactivada antes. En Cloud no se revisó RLS, `GRANT` ni políticas. |

**Límites de esta verificación:** la tabla describe el estado antes del fixture y después de restaurarlo. No se comparó con Supabase Cloud, no se inspeccionó el cuerpo de la RPC real —inexistente en local— y en esta fase de solo lectura no se probó concurrencia ni el KDS desplegado. La concurrencia y la autorización de la RPC sí se ejercitaron después con el fixture temporal (§13), sobre la RPC temporal y sin cubrir Cloud ni la RLS del entorno desplegado.

---

## 13. Validación de integración parcial con fixture temporal

Esta sección sustituye cualquier afirmación anterior de este documento que dijera que no se ejecutaron entregas. Sí se ejecutaron, **solo contra datos temporales en Supabase local**, con una RPC temporal y con `ms-pedidos` levantado desde una copia en el puerto `3905`, y con restauración final verificada. No se tocó Supabase Cloud.

**Qué cubre y qué no.** Es una **integración parcial**: Postgres local real, una RPC temporal que implementa el contrato esperado y el endpoint HTTP de `ms-pedidos`. **No** se ejecutó el diálogo del KDS, ni el gateway nginx, ni Supabase Cloud, ni el cuerpo de la RPC real. Los PASS de §13.3 describen el contrato y el endpoint, no un despliegue ni el comportamiento del KDS desplegado.

### 13.1 Fixture y respaldo

- **Respaldo previo:** `pg_dump` de la base local antes de crear el fixture.
- **Ámbito:** solo Supabase local. No se aplicó SQL en Cloud ni se modificaron archivos versionados.
- **Elementos del fixture, todos temporales:**
  - columna `qr_usado` en `pedidos`;
  - tabla `cafeteria_usuarios` para resolver cafetería y rol (no existe en la base local, §12);
  - RPC `log_qr_validation` con `FOR UPDATE`, autorización de cafetería/rol, consumo de QR, transición a `entregado` y auditoría; la identidad se pasaba como parámetro en la invocación directa;
  - pedidos en estado `listo` con `qr_token` y `codigo_retiro_diario`;
  - datos identificados con el prefijo `900xxx`.
- **El fixture no está versionado.** Su SQL no se conservó como archivo ni se adjuntó a este documento; §13.2 describe los objetos y comandos necesarios para repetirlo.
- **Restauración final:** verificación por conteos, esquema y RLS; detalle de lo restaurado y de lo no verificable en §12.
- **ms-pedidos:** se ejecutó desde una copia temporal en el puerto `3905`, sin tocar el código versionado.

### 13.2 Pasos de reproducción y resultados observados

Ejecución del 2026-11-13 sobre Supabase local. Los comandos se escriben con marcadores (`$JWT`, `<id>`): no se reproducen tokens, JWT, claves ni valores de `.env`. Esta secuencia **no se re-ejecutó** en la revisión del 2026-11-15.

1. **Respaldo previo.**
   `docker exec supabase_db_taller-integracion-3 pg_dump -U postgres -d postgres > respaldo_pre_fixture.sql`
   Observado: respaldo creado. La comparación final se hizo por conteos y esquema porque cada `pg_dump` imprime un token aleatorio distinto.
2. **Fixture en la base local.** `ALTER TABLE public.pedidos ADD COLUMN qr_usado boolean NOT NULL DEFAULT false`; `CREATE TABLE public.cafeteria_usuarios (...)`; `CREATE FUNCTION public.log_qr_validation(p_qr_token text)` con `SELECT ... FOR UPDATE` sobre `pedidos`, autorización por cafetería/rol, marca de `qr_usado`, transición a `entregado` e `INSERT` en `logs_validacion_qr`; alta de pedidos `900xxx` en `listo`.
   Observado: los objetos existieron durante la prueba y ya no existen tras la restauración (§12).
3. **Servicio `ms-pedidos` desde copia temporal** en `http://127.0.0.1:3905`, apuntando a la base local mediante variables de entorno.
   Observado: servicio respondiendo, sin cambios en archivos versionados.
4. **Sesión de empleado.** JWT de un usuario empleado de Supabase Auth local guardado en `$JWT`, sin imprimirlo.
   Observado: `POST` con `Authorization: Bearer $JWT` no devolvió 401.
5. **Caso 1, QR válido.**
   `curl -s -X POST http://127.0.0.1:3905/api/pedidos/validar-qr -H "Authorization: Bearer $JWT" -H 'Content-Type: application/json' -d '{"qr_token":"<qr_token del pedido 900xxx>"}'`
   Verificación: `select estado, qr_usado, entregado_en from public.pedidos where id = <id>;` y `select resultado from public.logs_validacion_qr where pedido_id = <id> order by id desc limit 1;`
   Observado: pedido en `entregado`, `qr_usado = true`, `entregado_en` no nulo y log con resultado `entregado`.
6. **Caso 2, token manual.** El mismo `POST` con el `codigo_retiro_diario` de otro pedido `900xxx` en `listo`.
   Observado: mismo resultado que el caso 1.
7. **Casos 3 y 4, segundo uso.** Repetir los `POST` de los casos 1 y 2 con las mismas credenciales.
   Observado: rechazo; el pedido permaneció en `entregado`.
8. **Caso 5, estado distinto de `listo`.** `POST` con la credencial de un pedido `900xxx` en un estado previo, por ejemplo `en_preparacion`.
   Observado: rechazo, sin transición de estado.
9. **Caso 6, concurrencia.** Dos `POST` simultáneos sobre el mismo pedido `listo` (`curl ... & curl ... & wait`).
   Observado: una respuesta de éxito y una de rechazo; el pedido quedó en `entregado` con `qr_usado = true`.
10. **Caso 7, estado final.** Consultas de `entregado_en`, `qr_usado` y del log del pedido.
    Observado: los tres valores persistidos y coherentes con una sola entrega.
11. **Casos 8 y 9, cafetería y rol.** Sin HTTP, porque el endpoint no propaga identidad (§13.5): se invocó la RPC temporal directamente con la identidad del empleado como parámetro, con un pedido de otra cafetería y con un `cafeteria_usuarios` que asigna rol no empleado.
    Observado: rechazo en ambos casos.
12. **Restauración.** Baja de la función, la tabla y la columna temporales, borrado de las filas `900xxx` y recarga del respaldo.
    Observado: 3 pedidos y 4 logs, sin `qr_usado`, sin `cafeteria_usuarios`, sin `log_qr_validation` y con los `GRANT` estándar de Supabase (§12).

### 13.3 Matriz de casos y resultado

Los casos 1 a 7 pasaron por el endpoint `ms-pedidos`, que ejecuta la **RPC temporal**. Los casos 8 y 9 se ejecutaron llamando esa RPC directamente. Ningún caso usó el diálogo del KDS ni el gateway.

| # | Caso | Vía | Resultado |
|---|---|---|---|
| 1 | QR válido, pedido `listo` → `entregado` | RPC temporal y endpoint `ms-pedidos` | **PASS** |
| 2 | Token manual válido | RPC temporal y endpoint `ms-pedidos` | **PASS** |
| 3 | Segundo uso del mismo QR | RPC temporal y endpoint `ms-pedidos` | **PASS** (rechazado) |
| 4 | Segundo uso del mismo token | RPC temporal y endpoint `ms-pedidos` | **PASS** (rechazado) |
| 5 | Pedido en estado distinto de `listo` | RPC temporal y endpoint `ms-pedidos` | **PASS** (rechazado) |
| 6 | Concurrencia: 2 solicitudes simultáneas | RPC temporal y endpoint `ms-pedidos` | **PASS**: 1 éxito y 1 rechazo |
| 7 | Estado final: `entregado_en`, `qr_usado` y auditoría | RPC temporal y endpoint `ms-pedidos` | **PASS** |
| 8 | Cafetería distinta | Solo RPC temporal | **PASS** (rechazado) |
| 9 | Rol no empleado | Solo RPC temporal | **PASS** (rechazado) |
| 10 | Cafetería/rol por HTTP | Endpoint `ms-pedidos` | **BLOQUEADO** |
| 11 | Gateway nginx real | nginx | **BLOQUEADO** |

No hubo **FAIL** en los casos ejecutables. Los PASS acreditan que el contrato es implementable y observable con una RPC que lo cumple y con el endpoint actual; no acreditan el KDS, el gateway ni la RPC de Cloud.

### 13.4 Limitaciones

- **Cafetería y rol por HTTP no son ejecutables hoy.** El endpoint `ms-pedidos` no propaga identidad a la RPC, así que esa autorización no corre en la vía HTTP. Los casos 8 y 9 solo se pudieron probar llamando la RPC directamente.
- **Sin gateway real.** nginx/gateway no estaba disponible; la validación usó `ms-pedidos` desde una copia temporal en el puerto `3905`.
- **Sin Cloud.** No se tocó Supabase Cloud; el cuerpo real de la RPC, su RLS y sus permisos siguen sin verificarse.
- **RPC del fixture.** La RPC probada es la del fixture, no una función versionada ni la de Cloud. El PASS demuestra que el contrato es implementable y observable, no que Cloud ya lo cumpla.
- **Sin KDS.** No se abrió el diálogo ni se escaneó con cámara o imagen: los casos prueban el contrato del servicio, no la UI. En particular, la vía de §13 no ejercita el envío de una sola credencial (§3.3) ni el fallback a Supabase de Desktop (§7).
- **Concurrencia solo en la RPC.** El caso 6 pasó por la RPC temporal, que usa `FOR UPDATE`. Ese resultado no se traslada al fallback de Desktop (§8.4), que actualiza sin condición atómica, ni al cuerpo real de Cloud.
- **Resultados registrados, no re-ejecutados.** Las salidas crudas de la ejecución del 2026-11-13 no se conservaron como archivo; los resultados de §13.3 son los anotados en esa ejecución y no se repitieron en la revisión del 2026-11-15.
- **Restauración no byte a byte.** No se guardó copia de las ACL/RLS previas; la restauración se verificó por conteos, esquema y `GRANT` (§12).
- **Sin cambios versionados.** No se modificaron archivos del repositorio; esta validación solo se refleja en este documento.

**Alcance de la conclusión:** la validación cubre el contrato y el endpoint local hasta donde permite el entorno actual. Los criterios que dependen de identidad propagada por HTTP, gateway real, KDS desplegado o Supabase Cloud permanecen bloqueados o no verificables, no fallidos.

### 13.5 Por qué no se completaron las dos últimas fases

Los casos 10 y 11 de §13.3 figuran como **BLOQUEADO** por una razón concreta, no por un resultado adverso del flujo probado.

1. **Fase de cafetería/rol mediante HTTP (caso 10).** El endpoint actual de `ms-pedidos` sí recibe el JWT en el middleware `auth.exigirAuth` ([pedidos.routes.js](../../../Microservices/ms-pedidos/src/modules/pedidos/pedidos.routes.js) L30; [auth.js](../../../Microservices/shared/src/auth.js) L74-107), pero al llamar la RPC solo envía `p_qr_token` y no propaga la identidad del empleado ([pedidos.service.js](../../../Microservices/ms-pedidos/src/modules/pedidos/pedidos.service.js) L745-750). Por eso la RPC temporal solo pudo validar cafetería y rol cuando se invocó directamente, con la identidad como parámetro. **No se puede afirmar que el endpoint HTTP autorice correctamente** con el contrato actual: la autorización existe en la RPC del fixture, no en la vía HTTP.
2. **Fase de gateway nginx real (caso 11).** El gateway local no estaba disponible para esta ejecución y el puerto `8080` estaba ocupado por otro proyecto. Por seguridad no se detuvo ni se reemplazó ese servicio ajeno. En su lugar se ejecutó `ms-pedidos` desde una copia temporal en el puerto `3905`, lo que valida el servicio y su contrato, pero **no el enrutamiento nginx** ni la publicación de `/api/pedidos`.

Ambas fases **requieren corregir o configurar el entorno antes de repetirlas**: propagar la identidad del empleado hasta la RPC y disponer del gateway con el puerto libre o en un puerto alterno controlado. No son fallos del caso de negocio probado —entrega por QR/token, segundo uso, estado y concurrencia— sino limitaciones del entorno de ejecución y del contrato actual entre `ms-pedidos` y la RPC. La matriz de §13.3 se mantiene coherente con esta lectura: los casos ejecutables son **PASS** y los dos restantes **BLOQUEADO**, sin ningún **FAIL**.
