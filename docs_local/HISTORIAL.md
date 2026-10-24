# Historial del KDS CoffeeFast (app-desktop)

> Archivo **local de historial** (docs_local/ → NO se sube al repositorio).
> Mantener actualizado: agregar cada tarea al final al resolverla.

---

## 0. Reglas clave entregadas por el usuario

1. **NUNCA pushear sin verificación y aprobación explícita del usuario.** "Esto nunca más se repite: yo debo asegurarme de que está bien hecho, después lo pusheas." → El flujo correcto es: implementar → verificar → mostrar → el usuario prueba => da OK → commit → el usuario autoriza push.
2. **Solo se trabaja sobre la rama `AppDesktopEliasS1`.** El usuario no crea ramas nuevas. No mezclar con ramas de otros integrantes.
3. **`docs_local/`, `paleta_colores`, `docs_local/schema.sql` y `app-desktop/.env` nunca se commitean ni se suben.** Son locales.
4. **Convención de commits** (mensajes en español, tipo al inicio): `[FEAT]`, `[FIX]`, `[DOCS]`, `[TEST]` + descripción breve.
5. Ante **nuevas instrucciones ambiguas**: preguntar antes de decidir (criterios, alcance, alcance de cambios).
6. No modificar archivos de otros módulos salvo que se pida. Los colores azules de plantilla en sidebar/layout/dashboard quedaron **sin cambiar** (decisión pendiente).
7. La DB local de Supabase vive **fuera del repo** (`~/Documentos/coffefast-local`) para no ensuciar git.

---

## 1. Contexto técnico del proyecto

- App de escritorio KDS: **Electron + React + Vite + Material UI (Material 3)**.
- Carpeta: `app-desktop/`.
- Scripts (`package.json`): `dev` (vite), `build` (vite build), `electron` (electron electron/main.js), `electron:dev` (vite + electron con `VITE_DEV_SERVER_URL=http://localhost:5173`).
- Conecta a Supabase (JS client `@supabase/supabase-js` 2.112.3) vía `src/services/supabaseClient.js`:
  - Sin `.env`: usa por defecto el Supabase **remoto** `https://yrswjmxdpmiyfpclrfmg.supabase.co`.
  - Con `.env` (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY / VITE_CAFETERIA_ID): apunta a la URL indicada. **`isSupabaseConfigured`** = hay URL + key y no es placeholder. Si el fetch/SQL falla → **fallback a mock** (ids estilo `#1264-D`, localStorage `coffeefaster_pedidos_v2`). Ids **numéricos** (`#1`, `#2`...) = usando la BD real.
- Supabase local (CLI + Docker): directorio `~/Documentos/coffefast-local`, salido en `supabase start`:
  - API `http://127.0.0.1:54321`, Postgres `127.0.0.1:54322`, Studio `http://127.0.0.1:54323`.
  - Key lokal "Publishable": `sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH` (aceptada por supabase-js ≥ 2.42).
- Ejecutar SQL sin psql local: **Studio (SQL Editor)** o `docker exec -i supabase_db_coffefast-local psql -U postgres < archivo.sql`.

---

## 2. Metodología / habilidades (skills) usadas

1. **Explorar antes de tocar**: leer el código que se va a modificar (servicios, componentes, cómo se conectan) y buscar en docs si hay especificación (p.ej. FR-XX).
2. **Verificación en 3 capas, sin tocar git**:
   - `npm run build` (compila) — siempre.
   - **Test unitario del código real**: bundle del módulo fuente con `esbuild` (p.ej. `pedidosService.js` → `.mjs` temporal en `/tmp/opencode/frtest/`) e importarlo en Node para probar lógica pura (comparadores, normalización). Se descartó `psql`/pg instalado, se usó cliente `pg` temporal en `/tmp/opencode` (fuera del repo) para conectar a la DB local por TCP.
   - **E2E en Electron headless** (`show:false`): cargar `dist/index.html`, leer el DOM con `executeJavaScript` (`.MuiCard-root` → ids y horas), e insertar filas reales contra la DB local vía REST (`http://127.0.0.1:54321/rest/v1/<TABLA>`) para probar Realtime de verdad (INSERT → aparece sin recargar, sin duplicados, estable tras el poll de 10 s). Los inserts de prueba se limpian al final.
3. **Paleta de colores**: siempre usar los tokens de `paleta_colores` (`:root`): `--bg-app #FAF7F5`, `--mocha-dark #4A3B32`, `--mocha-medium #78665B`, `--cream-accent #C8B2A1`, `--cream-soft #F2ECE7`, `--border #EFEAE6`, `--green-ready #2E7D32`, `--green-bg #E8F5E9`, `--orange-prep #E65100`, `--orange-bg #FFF3E0`. (La tira de swatches del archivo muestra `#388E3C/#F57C00` pero los tokens `:root` mandan.)
4. **Preferencia por orden estructural**: si el usuario pide algo ambiguo (criterio), se pregunta con opciones concretas; se implementa la opción elegida y se re-verifica.

---

## 3. Historial de tareas

### 3.1 Tarjeta de comanda operativa (DONE, pusheado)
- Commit: `4f50770` `[FEAT]: tarjeta de comanda operativa con hora de retiro y datos solo de preparacion`
- Tarjeta individual de cada pedido: muestra solo info de preparación (id, hora retiro, productos con cantidad/mods, estado), sin datos personales ni de pago. Fue verificado en DOM, sin dependencia de package con commits previos.

### 3.2 Datos mock adicionales (DONE, pusheado)
- Commit: `bc15ab1` `[FEAT]: datos mock adicionales para testeo del KDS de comandas`
- 10 pedidos nuevos + 8 productos extras (14 pedidos total). Clave localStorage `coffeefaster_pedidos_v2`. Se corrigió un parse error al agregar un producto al final del mock.

### 3.3 Alineación de colores a la paleta Mocha & Cream (DONE, pusheado)
- Commit: `153e357` `[FIX]: colores del KDS alineados a la paleta Mocha & Cream`
- Se revisó `paleta_colores`, se reemplazaron colores fuera de paleta en `pedidos.jsx` (`#FBE9DB→#FFF3E0`, `#D8CCC4→#C8B2A1`, `#B3A49B→#78665B`) y `ConnectionBadge` (`#4ade80→#2E7D32`).
- Push del rango `3acaf27..153e357` (tarjeta + mock + colores) — **fue el último push aprobado**.

### 3.4 KDS conectado a Supabase Realtime — FR-27 (DONE, pusheado)
- Commit: `291c099` `[FEAT]: KDS conectado a Supabase Realtime (FR-27)`
- Archivos: `src/services/kdsRealtime.js` (canal `kds-pedidos`, `postgres_changes` INSERT en `PEDIDOS` filtrado por `cafeteria_id`, solo estado `pendiente`, deduplicación con `Set`, estados conectado/reconectando/indisponible, `cerrar()`), `ConnectionBadge` y `KdsTopBar` (prop `conexion`/`estado`), `pages/pedidos.jsx` (suscripción + `mergeConSnapshot` + `agregarComandaRealTime` + poll 10 s), `pedidosService.js` (`normalizarPedido`, `formatearHoraRetiro`).
- Esquema local creado en `docs_local/schema.sql` (tables PUBLICAS en **MAYÚSCULAS**: `"PEDIDOS"`, `"DETALLES_PEDIDO"`, `"PRODUCTOS"`, `"USUARIOS"`, `"CAFETERIAS"`, etc.; publicación `supabase_realtime` sobre PEDIDOS + DETALLES_PEDIDO; seed inicial). ⚠️ **No ejecutar contra el Supabase remoto** (tiene `DROP TABLE ... CASCADE`).
- **Nota crítica aprendida**: la app consulta las tablas en MAYÚSCULAS (`.from('PEDIDOS')`); el primer `schema.sql` usaba minúsculas → 404 de PostgREST → fallback a mock silencioso. La señal de que se usa la BD real son ids **numéricos**.
- Push `153e357..291c099` — hecho antes de la regla; el usuario indicó revisar de todos modos.

### 3.5 Ordenamiento de comandas — FR-28 (DONE, pusheado)
- Requisito: obtener hora de retiro, ordenar por prioridad/horario, mantener el orden al llegar pedidos nuevos.
- Cambios:
  - `src/services/pedidosService.js`: helpers de ordenación (`aMinutosDelDia`, `horaRetiroSortable`→`aInstanteRetiro`, `comparadorPrioridad`, `ordenarPedidos` exportado).
  - `src/pages/pedidos.jsx`: `pedidosOrdenados = useMemo(() => ordenarPedidos(pedidos), [pedidos])`; columnas solo filtran (sin `.sort` inline); `agregarComandaRealTime` inserta en posición ordenada.
- **Criterio final (aprobado por el usuario)**: ordenar por **hora del día (0-24)**, usando la hora que muestra la tarjeta (`hora_retiro` formateado "HH:MM AM/PM"). El comparador ignora la fecha (la tarjeta no muestra fecha). Fallback si no hay `hora_retiro`: `creado_en + 15 min` (mismo fallback que muestra la tarjeta). Empate → por `creado_en`.
- **Lección (zona horaria)**: insertar con `current_date + time 'HH:MM'` genera instantes entendidos en UTC → se desplazan al mostrarse (08:00Z = 05:00 Chile, 23:00Z = 20:00 Chile). Para pruebas del KDS usar `now() + interval '20 minutes'` / `'3 hours'` o `timestamptz '... -03'`.
- Estado de verificación: unit 6/6 OK (incluye caso 12:23 AM antes que 09:45 PM, ISO con hora mostrada distinta), `npm run build` OK, E2E Realtime OK (INSERT aparece sin recargar, sin duplicados, estable tras poll). Commit `e27fd5e` pusheado (`291c099..e27fd5e`) con OK del usuario.

---

### 3.7 Análisis metodología de ramas + avance a develop (LOCAL, SIN push)

**Metodología de ramas observada en el repo (los compañeros ya estaban usando esto):**
1. `develop` es la **integradora central** del equipo: ahí confluyen las ramas personales y de tarea vía merges (`Merge remote-tracking branch 'origin/X' into develop`).
2. **Ramas personales por integrante + módulo**: `App<Módulo><Nombre>S1` → `AppDesktopEliasS1` (mía), `AppDesktopDiegoS1`, `AppMovilArielS1`, `AppMovilDiegoS1`, `MicrSLogicCamiloS1`.
3. **Ramas de tarea** `S1-T<n>-<Nombre>-<Desc>` → `S1-T0-Camilo-FixBackend`, `S1-T7-Diegovs` (trabajo puntual de la iteración, normalmente partiendo de `develop`).
4. **Ramas `feature/*`** para documentación/pico → `feature/backend`, `feature/database`, `feature/desktop`, `feature/microservices`, `feature/mobile`. `feature/desktop` quedó **stale** (antigua, no incluye mi KDS).
5. `develop-test` es un area de "merge general" para probar las apps juntas. `main` solo guarda hitos/documentación (no es release activa).
6. Se usa **merge** (no rebase) + mensajes `[TIPO]: descripción` en español.

**Avance realizado (solo local, sin push):**
- `git fetch --all --prune` → aparecieron `S1-T7-Diegovs`, `S1-T0-Camilo-FixBackend` y `develop` avanzó `174b850→b211bb6`.
- `git merge --ff-only origin/develop` en `AppDesktopEliasS1` → como `develop` ya incluía mi `9fefd9e` (merge-base = mi HEAD), fue **fast-forward**: mi rama local quedó en `b211bb6` (45 commits de adelanto). Entró TODO el monorepo: `app-mobile` (Expo/RN + Android/iOS), `backend-node` modularizado, `BotTelegramCoffeFaster`, `supabase/`, `database/fixes`, `datosFicticios`, `docs/`.

**Impacto sobre mi KDS (después del avance):**
- FR-29 (`Nombre × cantidad`) y FR-28 (orden por hora de retiro) **intactos** (mi `ordenarPedidos` ahora se usa desde la página nueva `pages/empleado/Comandas.jsx`; la antigua `pages/pedidos.jsx` quedó como envoltorio).
- Cambios ajenos que conviven: estados `preparando` → `en_preparacion`; la entrega ahora se valida con "Escanear QR" de la barra superior (ya no hay botón "Confirmar Entrega" en el diálogo); se eliminó `pages/scanner-qr.jsx` (reemplazado por `EscanearQrDialog.jsx`); se sumaron páginas dueño/empleado, dashboard, gestor precio/stock, telegram y routing (`react-router-dom`).
- **Dependencias**: el build rompía por `react-qr-reader@3.0.0-beta-1` (pide React ≤17, el proyecto usa React 18). Resuelto localmente con `npm install --legacy-peer-deps` (solo `node_modules`; `package.json`/`package-lock` intactos). `npm run build` OK.
- Worktree limpio. `origin/AppDesktopEliasS1` sigue en `9fefd9e`; la rama local está 45 adelante.

### 3.12 Alternativa al QR: validación por Token (mecanismo de contingencia) — FR-33 (DONE, commit local SIN push)

**Requisito FR-33 (SRS):** el Token es el mecanismo de contingencia cuando falla la conexión/cámara; debe permitir ingresar el token manualmente, buscar el pedido correspondiente, validarlo, rechazar tokens inválidos e impedir la reutilización.

**Estado previo:** la lógica de validación ya existía (FR-32: `pedidosService.validarQrEntrega` normaliza, busca por `getByQrToken`, valida cafetería/estado, rechaza inválidos y bloquea el reuso porque `entregado` es terminal), pero el diálogo `EscanearQrDialog` solo ofrecía cámara (`QrReader`): no había UI para ingresar el token manualmente.

**Cambios (rama `S1-T11-Elias-fr33-token-manual`):**
- `[FEAT]` `EscanearQrDialog.jsx`: ahora tiene **dos pestañas** (`Tabs`): "Escanear QR" (cámara, comportamiento intacto) e "Ingresar Token".
  - Pestaña token: **campo de texto** (`TextField`, Enter valida) + botón "Validar Token"; reutiliza exactamente `validar()` de FR-32 (primero MS Comercio, fallback a `validarQrEntrega`), por lo que **busca, valida, rechaza inválido y evita la reutilización** con la misma lógica probada.
  - El **resultado** (Alert verde/rojo) se muestra en el mismo overlay opaco para ambos modos; botones de acción dinámicos ("Escanear otro"/"Validar otro").
  - `useEffect` al abrir el diálogo resetea el modo (vuelve a cámara) y limpia `tokenInput`/`resultado`/`error`/refs (`procesando`, `ultimoToken`). Cambiar de pestaña también ejecuta `resetear()`.
  - El lector se desmonta en la pestaña token (no pide cámara → útil justo cuando la cámara/conexión falló; al volver a QR se re-monta).

**Verificación:** `npm run build` OK. Diálogo abre con ambas pestañas visibles (tablist "Escanear QR" seleccionada + "Ingresar Token"). **E2E del flujo token verificado** (clic vía DOM en headless, fallback Supabase porque MS :3000 está caído): `QR-TST-0002` (listo) → overlay "Entrega validada exitosamente..." y persistido `entregado` en BD; reuso de `QR-TST-0003` (ya entregado en FR-32) → rechazado "El pedido #0003 ya fue entregado". El clic automatizado normal no funcionó por el lector sin cámara en headless, pero queda: probar en su equipo con cámara el escaneo QR normal (sin regresión).

**Entrega:** commit local en `S1-T11-Elias-fr33-token-manual` **sin push** (pendiente del consentimiento del usuario). Base: `develop` (9efe797, ya incluye FR-31 y FR-32).

### 3.13 Limpieza de consola: migración a `slotProps`/`sx` de MUI v9 (maintenance)

**Motivo:** con MUI **9.4.0** instalado, las props legacy que el usuario vio en consola (`React does not recognize the ... prop on a DOM element`) ya no se consumen y se cuelan al DOM:

- `primaryTypographyProps` → `slotProps={{ primary: {...} }}` en `sidebar.jsx` (2 usos).
- `PaperProps` del `Dialog` → `slotProps={{ paper: { sx } }}` en `EscanearQrDialog.jsx`.
- `InputProps` del `TextField` → `slotProps={{ input: { startAdornment } }}` en `EscanearQrDialog.jsx` (se eliminó el `InputAdornment` envolvente y su import).
- En MUI v9, `Stack` se implementa internamente como `Grid2` y **ya no acepta** `justifyContent`/`alignItems` como props → movidos a `sx` en los 38 `Stack` del repo (`PedidoCard`, `DetallePedidoDialog`, `EscanearQrDialog`, dialogs de productos, `TelegramConfigModal`, páginas dueño).
- `Grid` con `alignItems` → `sx` en `Productos.jsx`, `GestorPrecioStock.jsx`, `Inventario.jsx`.
- `favicon.ico` 404 → `<link rel="icon" href="data:," />` en `index.html`.

**No arreglable (de librería/entorno, NO nuestro código):** source map errors de deps precacheadas por Vite (dev server, no afecta build); aviso `QrReader: Support for defaultProps` de `react-qr-reader` 3.0.0-beta-1; errores `Cross-Origin Request Blocked` a `localhost:3000` porque **MS Comercio está caído** → el `WARNING "MS Comercio no disponible, fallback Supabase"` es el camino intencional que SÍ funciona.

**Verificación:** `npm run build` OK; recarga del KDS → **0 errores** de nuestro código (solo quedan los source-map de deps); diálogo QR con ambas pestañas operativo y flujo token E2E re-verificado (ver §3.12).

### 3.14 Logs de validación QR/Token visibles solo para el Dueño — T12 (DONE, commit local SIN push)

**Pedido del usuario (verificación de 4 criterios sobre FR-32/FR-33 → añadió esta como T12):** con FR-32/FR-33 ya se cumplía (1) marcar el pedido como "Retirado" al validar, (2) que saliera de la lista activa del KDS (filtro `pedidosOperativos` en `Comandas.jsx`) y (3) impedir la revalidación (`entregado` es terminal + guard FR-31). Faltaba (4): **dejar registro de las validaciones en una tabla Logs que solo pueda ver el Dueño**. → se implementó T12.

**Cambios BD (`database/fixes/crear_logs_validacion_qr.sql`, espejo en `scrips_database/fixes/`; aplicado a la DB local):**
- Tabla `public.logs_validacion_qr`: `id`, `pedido_id` (FK pedidos), `cafeteria_id` (FK cafeterias), `usuario_id` (FK usuarios), `qr_token`, `resultado` (`entregado`/`rechazado`/`error`), `detalle`, `validado_en` (default `now()`). No tiene `creado_en` (importante para el servicio).
- **RLS activo**: `REVOKE ALL` a `anon`/`authenticated` + `GRANT SELECT/INSERT/UPDATE/DELETE` a `authenticated`; política `logs_validacion_qr_insert_empleado` (INSERT permitido a rol 2/3, verifica `usuarios.auth_user_id = auth.uid()`) y `logs_validacion_qr_select_dueno` (SELECT **solo rol 3**). Verificado por API: con sesión de **dueño** `SELECT` devuelve las filas; con sesión de **empleado** devuelve **0 filas** (RLS, sin error).

**Cambios código (misma rama `S1-T11-Elias-fr33-token-manual`):**
- `pedidosService.js`: `validarQrEntrega` registra log en cada rama (rechazado/entregado/error) vía `_registrarLogValidacion` (best-effort `try/catch`, resuelve el `usuario_id` con `supabase.auth.getUser()` → `usuarios.auth_user_id`, inserta con `cafeteria_id: CAFETERIA_ID`). No rompe la validación si el log falla.
- Nueva página `pages/dueno/LogsValidacion.jsx`: tabla (Fecha, Pedido, Token, Usuario, Resultado en Chip coloreado, Detalle) + estado vacío/carga/error.
- `app.jsx`: ruta `/dueno/logs` con `ProtectedRoute requiredRole="dueño"` + ítem de menú "Logs Validación" (`HistoryOutlinedIcon`) en el sidebar del dueño.
- `[FIX]` `service/logs_validacion_qr.js`: `getAll/getByCafeteria/getByPedido` ordenaban por `creado_en` (**columna inexistente** → PostgREST 400 → la página mostraba "Aún no hay validaciones" pese a haber filas) → `.order('validado_en', { ascending: false })`.

**Usuarios GoTrue (datos locales):** creado `dueno@cofeefast.cl` / `123456` (Carlos, `usuarios` id 3 rol 3, auth `abc3b246-0d0d-4da7-88da-b080aa5f98cd`). **Lección (ya anotada en §3.8, se repitió):** al insertar filas en `auth.users` manualmente, GoTrue rompe con 500 "converting NULL to string" si los tokens string (`confirmation_token`, `recovery_token`, `email_change`, etc.) quedan en NULL → ponerlos en `''`. Además el login de `empleado@cofeefast.cl` (Juan, auth `b6fa9f95-...`) empezó a dar `invalid_credentials` incluso tras `admin.updateUserById` → se **recreó** el auth user vía API admin (`admin.deleteUser` + `admin.createUser(email_confirm:true)`) y se re-enlazó `usuarios.auth_user_id` (id 2 → `07f69c6b-72eb-4060-b8c7-d220db662cd2`); desde ahí ambos logins funcionan.

**Verificación E2E (Supabase local, MS :3000 abajo → fallback):**
- Validación de `QR-TST-0001` (listo) por pestaña Token → éxito "Entrega validada exitosamente… Pedido #0001 · entregado"; BD `logs_validacion_qr` fila id 1 resultado `entregado`, `usuario_id=2` (RLS INSERT con sesión de empleado OK).
- Reuso del mismo token → "Validación rechazada: El pedido #0001 ya fue entregado"; fila id 2 resultado `rechazado`.
- Página `/dueno/logs` con login `dueno@cofeefast.cl` → **tabla con ambas filas** (Juan / RECHAZADO + ENTREGADO), 0 errores en consola.
- Empleado (`empleado@cofeefast.cl`) intentando `/dueno/logs` → **redirigido** a su KDS por el guard de ruta, y su sesión **no ve filas** (RLS).
- `npm run build` OK.

**Entrega:** commit local en `S1-T11-Elias-fr33-token-manual` **sin push** (pendiente del consentimiento del usuario). Pendiente para su equipo: probar con cámara el escaneo real y, si se desea, activar el push/PR.

### 3.15 Prueba completa del KDS — T13 (DONE, commit local)

**Objetivo (última tarea de la serie T9·T10·T11·T12·T13):** pasar el KDS de punta a punta con la BD local, tal como lo usaría el equipo, y arreglar lo que salga.

**Recorrido probado (E2E headless, MS Comercio `:3000` caído → siempre fallback Supabase):**
1. **Login** `empleado@coffeefast.cl`/123456 → KDS con las 3 columnas correctas desde el seed (0001 pendiente / 0002 en_preparacion / 0003 listo), cada tarjeta con sus productos y hora de retiro.
2. **Realtime:** insertando un pedido por SQL con la pantalla abierta, la comanda apareció en "Pendiente" en segundos y sin recargar (el canal volvió a "Conectado"); al borrar la fila, el tablero volvió a 3. Prueba repetida en 2 pedidos de prueba, luego limpiados.
3. **Transiciones de estado:** botón COMENZAR PREPARACIÓN movió 0001 pendiente→en_preparacion (persistido con `inicio_preparacion_en`); botón MARCAR COMO LISTO lo llevó a listo (persistido con `listo_en`). Al pulsar el botón, la tarjeta de 0002 pasó a Listos primero porque el orden del DOM es por hora de retiro, no por id — el flujo funciona igual, solo el orden de la fila.
4. **Guard de transiciones:** un salto por API listo→en_preparacion y listo→pendiente devolvió `P0001 "Transición inválida de estado"` y no cambió nada en la BD (regla FR-31 respaldada por trigger).
5. **Entrega por token (FR-32/FR-33):** token válido → "Entrega validada exitosamente… Pedido #0001 · entregado" (BD `entregado`); reuso del mismo token → rechazado; token inexistente → "QR no reconocido…". Las tres validaciones quedaron registradas en `logs_validacion_qr` (T12) y se limpiaron al terminar.
6. **Build** y consola: 0 errores de nuestro código en KDS y login.

**Bug encontrado y corregido (lo reporté como parte de T13):** al ingresar un token que no existe, el diálogo decía "No se pudo validar el QR en este momento" en vez de "QR no reconocido", porque `getByQrToken` usaba `.single()` (PostgREST devuelve PGRST116 "cannot coerce to a single JSON object" cuando no hay filas, y ese error caía al catch genérico). Fix: `.maybeSingle()`.

**Mantenimiento detectado en la misma pasada:** los formularios de login (empleado y dueño) y el `DetallePedidoDialog` seguían con `InputProps`/`PaperProps` de MUI v9, así que el warning "React does not recognize the `InputProps` prop" seguía apareciendo en el login (§3.13 no los había tocado). Migrados a `slotProps.input` / `slotProps.paper`. Queda pendiente (fuera del KDS, no se tocó): las páginas de dueño (Productos/Inventario/GestorPrecioStock), TelegramConfigModal y ModificarPrecio/StockDialog.

**Limpieza final:** seed restaurado (0001 pendiente / 0002 en_preparacion / 0003 listo), pedidos y logs de prueba borrados.

**Entrega:** commit local en la rama de la serie (T11→T13), **sin push** hasta el OK del usuario.

### 3.11 Escaneo y validación de QR para la entrega — FR-32 (DONE, mergeado en develop `9efe797` = PR #4)

**Requisito FR-32:** abrir cámara/lector disponible, detectar QR, obtener el identificador, enviarlo al proceso de validación y mostrar éxito/error claramente.

**Estado previo:** el KDS ya tenía el botón "Escanear QR" (`KdsTopBar`) y el diálogo `EscanearQrDialog` con `QrReader` (cámara trasera) que enviaba el texto a `backendApi.validarQr` (MS Comercio). Con el MS abajo mostraba solo error de red. Además se descubrió un **defecto en `getByQrToken`**: el `.or()` incluía `id.eq.<token>` sobre la PK entera → para cualquier token no numérico PostgREST devolvía **HTTP 400** y el cliente caía en silencio al *mock* → la validación leía datos falsos (un pedido ya entregado volvía a "validarse OK").

**Cambios (rama `S1-T9-Elias-fr32-escanear-qr`):**
- `[FIX]` en `getByQrToken` (`pedidosService.js`): el `id.eq` solo se agrega cuando el token es numérico (`/^\d+$/`); se mantienen `qr_token` y `codigo_retiro_diario`. Con esto la consulta real nunca produce HTTP 400.
- `[FEAT]` `normalizarTokenQR(texto)`: limpia el texto del QR (trim, quita comillas, extrae el último segmento si viene una URL) → **obtener el identificador**.
- `[FEAT]` `pedidosService.validarQrEntrega(token)` (**proceso de validación local**): `QR vacío` → rechaza; busca por token (`getByQrToken`); exige que `cafeteria_id === CAFETERIA_ID`; rechaza "ya fue entregado" y "aún no está listo" con razones específicas; si todo OK → `updateEstado(entregado)` (persiste `entregado_en`+`completado_en`, transición `listo→entregado` permitida por la regla FR-31) y verifica que el resultado final sea `entregado` antes de responder éxito.
- `[FEAT]` `EscanearQrDialog`: normaliza el token, intenta **primero MS Comercio** (`validarQr`) y si el MS no responde hace **fallback a `validarQrEntrega`**; se conserva el Alert verde (éxito) / rojo (rechazo) con la razón.

**Verificación E2E (Supabase local, MS :3000 abajo → siempre fallback):**
- `QR-TST-0001` (pendiente) → `valido:false` "aún no está listo para retiro".
- `NO-EXISTE` → "QR no reconocido".
- `https://cofeefast.app/q/QR-TST-0002` (formato URL) → entrega OK → BD `id=2 estado='entregado', entregado_en=19:18:34`.
- Rescaneo del mismo QR → "ya fue entregado" (el bug del mock ya no aplica; antes daba falso éxito).
- `QR-TST-0003` (listo) → entrega OK (`entregado_en=19:20:19`).
- Diálogo abierto desde el KDS: título "Escanear QR de Entrega", zona de cámara, texto guía "El QR debe corresponder a un pedido en estado 'listo' de esta cafetería", Cafetería #1. Errores de consola solo MUI preexistentes (sin cámara en entorno headless). `npm run build` OK. Screenshot: `docs_local/fr32_kds_validacion_qr.png`.

**Bug reportado por el usuario tras el primer escaneo:** con el lector visible, tras validar un QR el botón "Escanear otro" no volvía a capturar, y cerrar/reabrir el diálogo tampoco reactivaba la cámara. **Causa raíz:** el código anterior desmontaba `QrReader` al haber resultado (`{resultado ? resultado : <QrReader/>}`); al reintentar, `getUserMedia` fallaba porque el stream anterior no se había liberado. **Fix (`[FIX]` en `EscanearQrDialog.jsx`):** `QrReader` queda **siempre montado** mientras el diálogo está abierto y el resultado se muestra como overlay opaco sobre la cámara; se agrega `ultimoToken` (ref) para **deduplicar** el mismo QR en los ticks de 400ms (evita re-validar en bucle), `procesando` impide reentradas, y `resetear()` limpiar ambos al volver a escanear; `ViewFinder` solo se dibuja sin resultado. E2E real confirmado por el usuario (escaneó y entregó `QR-TST-0003` en BD) y abierto del diálogo verificado sin errores propios en consola. `npm run build` OK.

**Entrega:** commit local en `S1-T9-Elias-fr32-escanear-qr` **sin push** (pendiente del consentimiento del usuario). Rama baseada en `S1-T8` (FR-31 aún en PR #3); se podrá re-basear sobre `develop` cuando se fusione el PR #3.

**Utilitario de test (no se sube):** `docs_local/scripts/generar_qr_test.mjs` conecta a la BD local (vía REST con las keys del `.env` raíz), lista los pedidos de la cafetería y genera el **PNG del QR** de un pedido real (`docs_local/qr_<token>.png`). Opciones: por defecto el pedido `listo` (caso de éxito), `--id`, `--estado`, `--all`, `--url` (QR como URL para ejercitar `normalizarTokenQR`), `--terminal` (QR ASCII) y `--reset` (restaura el seed 0001 pendiente / 0002 en_preparación / 0003 listo vía `docker exec psql`, deshabilitando el trigger FR-31 para poder repetir el escaneo). Dependencia local: `npm i --prefix docs_local qrcode`.

### 3.10 Segundo cambio de estado "Marcar como listo" + fix "comandas a lo loco" — FR-31 (DONE, pusheado + PR)

**Síntoma reportado por el usuario:** en el KDS aparecían comandas "a lo loco" (más de las 3 de la BD) y cambiaban de estado solas.

**Causa raíz (confirmada en origin/develop):**
1. Los fixes FR-30 (id consistente entre realtime y snapshot) y S1-T14 (datos reales) estaban **sin mergear** → `PR #1` y `PR #2` quedaron OPEN. Se **fusionaron a develop** (commit `5b9bdde` y `6b84da0`) por pedido del usuario.
2. **Bug latente de mezcla:** `mergeConSnapshot` (`Comandas.jsx`) nunca purgaba el mapa `pedidosRealtime` → copias fantasma de comandas ya no presentes reaparecían cada 10s (poll) en loop (flicker que se veía como "cambian solas").
3. `getAll()` del KDS **no filtraba por `cafeteria_id`** (el canal Realtime sí lo hacía) → podía mostrar comandas de otras cafeterías.

**Cambios (rama `S1-T8-Elias-fr31-marcar-listo`):**
- Commit `6933b2a` `[FIX]`: purga del mapa realtime de ids no visibles + `getAll({ cafeteriaId })` con filtro y uso en snapshot/poll del KDS (`Comandas.jsx`, `pedidosService.js`).
- Commit `4bc8a90` `[FEAT] FR-31`: **En preparación → Listo** con regla de flujo: mapa `TRANSICIONES_VALIDAS` + guard en `updateEstado` que **rechaza saltos** (devuelve el estado actual sin escribir); botones usan `rawId` (PK numérica) para `.eq('id', ...)` correcto con cualquier código de retiro (`PedidoCard.jsx`, `DetallePedidoDialog.jsx`, `pedidosService.js`). Además **trigger `trg_validar_transicion_estado`** en la BD local (también en `docs_local/kds_empleado_setup.sql`) que bloquea cualquier PATCH/REST que intente saltarse estados (pendiente→listo, etc.).

**Verificación E2E (browser + REST + psql):** tablero estable con 3 comandas en 2+ polls (sin fantasmas/duplicados); clic "MARCAR COMO LISTO" en `0002` → a "Listos para Retiro" con productos y `listo_en` persistido; `PATCH pendiente→listo` → HTTP 400 "Transición inválida de estado: pendiente -> listo"; `PATCH pendiente→en_preparacion` externo reflejado por Realtime con productos; seed restaurado (con trigger deshabilitado para el reset); `npm run build` OK. Screenshot: `docs_local/fr31_marcar_listo.png`.

**Entrega:** pusheado `S1-T8-Elias-fr31-marcar-listo` (2 commits) → **PR #3 a develop**: https://github.com/cdarwitg2024/taller-integracion-3/pull/3

### 3.9 Acción "Iniciar preparación" — FR-30 (DONE, pusheado + PR)

**Requisito FR-30:** botón táctil, actualización del estado, actualización en Supabase y reflejo del cambio en la comanda al iniciar la preparación.

**Análisis:** el núcleo ya existía en `develop` (commit `3acaf27` "Kanban táctil", `4f50770`): botón `COMENZAR PREPARACIÓN` (fullWidth, `minHeight:56`), `pendiente → en_preparacion` y persistencia en Supabase con `inicio_preparacion_en`. Se detectó y corrigió un defecto real en el **reflejo en tiempo real** (`kdsRealtime.js`).

**Cambios (2 fixes en `app-desktop/src/services/kdsRealtime.js`):**
1. Handler de `UPDATE` pasó de `normalizarPedido(fila)` (fila cruda sin `detalles_pedido`) a `construirComanda(fila)` enriquecido (igual que el INSERT). Antes, un cambio de estado desde otro origen (backend/móvil) dejaba la tarjeta **"Sin productos"**.
2. `construirComanda()` ahora pasa `codigo_retiro_diario` a `normalizarPedido()`. Antes generaba ids distintos (numérico vs `codigo`) según la vía (snapshot vs realtime) → **comandas duplicadas**.

**Verificación E2E (browser + BD local):** botón táctil movió `0001` a En Preparación; Supabase persistió `estado` + `inicio_preparacion_en`; un **UPDATE externo por REST** sobre una comanda mostró el reflejo por Realtime **conservando sus productos** ("Capuchino × 1"); sin duplicados ni "Sin productos" tras el reload; limpieza de filas de prueba + seed restaurado. `npm run build` OK. Screenshot: `docs_local/fr30_iniciar_preparacion.png`.

**Entrega:** commit `8df62b0` `[FIX]` en `S1-T7-Elias-fr30-iniciar-preparacion` (usuario confirmó que el FR-30 es tarea **T7**), pusheado → **PR #2 a develop**: https://github.com/cdarwitg2024/taller-integracion-3/pull/2

### 3.8 KDS Empleado conectado a la BD local — S1-T14 (DONE, pusheado + PR)

**Objetivo:** KDS de empleado funcionando contra la **DB local** (login GoTrue + comandas reales, **sin mocks**). Fuente de verdad = **el código** (no el modelo ER). Solo lo justo y necesario; QR/dueño/backend quedan como tareas futuras.

**Decisión de entorno:** la instancia local se levantó **en el repo** (`supabase/` de `taller-integracion-3`, config del equipo) en vez de `coffefast-local` (que quedó fuera/abandonada). `supabase start` en el repo → contenadores `supabase_db_taller-integracion-3`. La publishable key coincide con `app-desktop/.env` → no hubo que cambiar la key.

**Hallazgo clave de entorno:** `app-desktop/vite.config.js` define `envDir: '../'` → vite lee las variables **desde la raíz del repo** (`.env` en `/taller-integracion-3`), NO desde `app-desktop/.env`. Sin `.env` en la raíz, `isSupabaseConfigured` era `false` y la app ni intentaba conectarse. Se creó `.env` en la raíz (gitignored, nunca se sube) apuntando a `http://127.0.0.1:54321` + key.

**Script local** `docs_local/kds_empleado_setup.sql` (NO se sube): reconstruye la DB con esquema minúsculas real según el código:
- `roles` (estudiante/empleado/dueño), `usuarios` (con `foto_url`, `ultima_conexion`, `actualizado_en`, `auth_user_id` — columnas que consulta el código → "Código = verdad"), `cafeterias`, `productos`, `pedidos` (`codigo_retiro_diario`, `qr_token`, `hora_retiro`, timestamps de estado, `estado` en `pendiente`/`en_preparacion`/`listo`), `detalles_pedido` (`modificaciones`).
- `ALTER PUBLICATION supabase_realtime ADD TABLE public.pedidos;` (sin esto el canal `kds-pedidos` no entrega eventos).
- Usuario GoTrue `empleado@cofeefast.cl` / `123456` (email confirmado, `auth.users` + `auth.identities` + enlace por `auth_user_id` rol empleado). **Lección:** GoTrue requiere los tokens de string en `''` (no NULL) al insertar manualmente, si no da 500 "converting NULL to string".

**Cambio de código (único, en rama `S1-T14-Elias-kds-empleado-db`):**
- `app-desktop/src/services/pedidosService.js` → `getAll()`: con Supabase configurado devuelve los datos reales aunque vengan vacíos (antes `data.length > 0` → mock silencioso). Se conserva el mock solo para el caso sin configuración/error.

**Verificación E2E (browser, dev server `localhost:5173`):**
1. Login GoTrue `empleado@cofeefast.cl/123456` → entra a `/empleado/comandas` (perfil `usuarios` + rol `empleado` encontrado por `auth_user_id`).
2. Tablero con datos reales: Pendiente 1, En Preparación 1, Listos 1 ("Capuchino × 2").
3. Transición "COMENZAR PREPARACIÓN" → persiste en BD: `0001 → en_preparacion` con `inicio_preparacion_en` (el MS backend en `:3000` no corre → fallback directo a Supabase, esperado).
4. Realtime: INSERT de un pedido por REST aparece en "Pendiente" **sin recargar**.
- Limpieza: fila `RT-777` borrada y `0001` restaurado a seed (`pendiente`).
- Consola: warnings MUI preexistentes + fallback "MS Comercio no disponible" (esperado). Sin regresiones.
- Screenshot: `docs_local/kds_empleado_local.png`.

**Estado:** DONE. Commit `479f8e1` `[FIX]`, pusheado a `origin/S1-T14-Elias-kds-empleado-db`, **PR #1 a develop**: https://github.com/cdarwitg2024/taller-integracion-3/pull/1

---

### 3.6 Cantidad de productos en la boleta al hacer clic — FR-29 (DONE, pusheado)
- Commit: `9fefd9e` `[FEAT]: cantidad de productos en la boleta al hacer clic (FR-29)`
- Cambios:
  - `src/components/DetallePedidoDialog.jsx` (`ListItemText.primary`): `"${cantidad}x ${nombre}"` → `"${nombre} × ${cantidad}"`.
  - `src/components/PedidoCard.jsx`: mismo cambio para mantener consistencia en la tarjeta.
  - (No se tocó `src/pages/scanner-qr.jsx` — otro módulo.)
- **Ajuste posterior**: se quitó además el texto secundario de detalle/modificaciones que aparecía debajo de cada ítem en la boleta (p.ej. "Pronto"/"Más tarde", que no aportaban). Hoy cada renglón muestra solo `Nombre × cantidad` (`primary`), sin `secondary`.
- Verificación: `npm run build` OK; E2E en Electron: clic en tarjeta → diálogo → ítems con formato `Nombre × N` (resultado real: `Té Verde × 2`, luego `Café Americano × 1`). Formato confirmado al 100% por el usuario → **commit `9fefd9e` pusheado** (`e27fd5e..9fefd9e`).

### 3.16 · T16 — Avisos de voz del KDS con ElevenLabs (rama `S1-T16-Elias-kds-voz`)

**Qué pidió el usuario**: que el KDS anuncie las comandas nuevas en voz alta, en español, y que los códigos de retiro se lean de dos en dos (727 → "siete veintisiete").

**Estado**: implementada, verificada con la clave real y **sin pushear** (esperando revisión del usuario).

**Commits** (locales, en `S1-T16-Elias-kds-voz`):
- `49022fa` `[FIX]: orden del KDS por hora de retiro` (`pedidosService.js`).
- `e502d8b` `[T16]: avisos de voz del KDS con ElevenLabs`.
- `82d73e4` `[MERGE]: sincronizar con origin/develop` (trae los 33 commits que faltaban, incluidos "Se repara login dueño" y "[FIXES]: Muchos").
- `d19981d` `[FIX]: el login no dependía de que exista la tabla cafeteria_usuarios`.
- `1cffee5` `[T16]: avisos en español y códigos de retiro leídos por parejas`.

**Rama de rescate**: `S1-T11-Elias-fr33-token-manual` en `45d3161`, que deja de estar colgando los cuatro commits de T11-T13.

**Archivos principales**
- `supabase/functions/voz-pedido/index.ts`: valida sesión y rol, arma el texto desde la base, reserva el aviso en `anuncios_pedido` (idempotencia por `pedido_id` UNIQUE) y devuelve el MP3. Nunca expone la clave.
- `supabase/functions/voz-pedido/numeros.ts`: lectura de códigos por parejas (módulo puro, sin Deno, para poder compararlo con el del navegador).
- `app-desktop/src/services/vozKdsService.js`: cola, sesión, MP3, watchdog y fallback.
- `app-desktop/src/services/vozNumeros.js`: espejo del anterior para el navegador.
- `app-desktop/prueba-voz.html`: banco de pruebas (crear comanda, ráfaga, borrar, y texto libre con idioma/velocidad).
- `database/fixes/crear_anuncios_pedido.sql` (+ espejo en `scrips_database/`): tabla de control + RLS.

**Verificación** — las seis pruebas de `docs_local/`, todas en verde: `probar-numeros` (NÚMEROS OK), `probar-sesion` (SESIÓN CORRECTA), `probar-voz` (TODO OK), `probar-cola-viva` (COLA SIEMPRE VIVA), `probar-sin-voces` (FALLBACK HONESTO), `probar-idioma` (IDIOMA OK). Más `npm run build`.

Audio real generado y reproducido entero: "Nueva comanda, número dos noventa y cinco. 1 Café Americano, 2 Capuchino." con `X-Voz-Idioma: es`, `X-Voz-Velocidad: 0.95`, modelo `eleven_flash_v2_5`.

**Lecciones / cosas que costaron**

1. **La cola se trababa en silencio.** `HTMLAudioElement.pause()` no dispara `ended`, así que la promesa de reproducción nunca se resolvía y la cola esperaba hasta el watchdog de 60 s. Se agregó cierre explícito de audio y watchdog propio.
2. **El login de upstream rompía el aviso entero.** El select pedía `cafeteria_usuarios(*)`, tabla que no existe en la base: PostgREST rechazaba la consulta completa y ambos logins respondían siempre "No se encontró el perfil" aunque las credenciales fueran correctas. Como el aviso necesita sesión, sin login no se oía nada. Se movió la cafetería a una consulta aparte tolerante a que la tabla falte (`d19981d`).
3. **Upstream borró `supabase/` y cinco scripts de `database/fixes/` sin moverlos** (commit `a22b7aa` "[FIXES]: Muchos", 1963 líneas). Entre lo borrado estaba `habilitar_realtime.sql`, sin el cual el KDS no recibe pedidos nuevos, y `bloquear_anon_sensibles.sql`. El usuario decidió conservar todo; hay que coordinar con sasi372 por si la limpieza fue a propósito.
4. **No hay voz nativa en español con la clave actual**: `GET /v1/voices` responde `401 missing_permissions`. La salida se fuerza con `language_code: 'es'`, que solo existe en modelos `v2_5` (en `multilingual_v2` daría 422).
5. **Las pruebas NO viven en `/tmp`.** `playwright-core` instalado ahí desapareció al limpiarse, y el import absoluto rompía las seis pruebas de golpe. Va en `docs_local/node_modules` y se importa como `playwright-core`.
6. **Un warning ajeno puede tapar el resultado real.** React cuenta como error de consola el prop `alignItems` que el login de upstream manda a un DOM, y `probar-voz` fallaba por eso con el audio perfecto. Ahora los warnings de props se muestran aparte y no tumban la prueba.
7. **El panel de texto libre compite con el KDS por la reserva del aviso.** Al crear la comanda descartable, el KDS abierto la ve por Realtime y a veces gana, devolviendo `ya_anunciado` sin audio. Reintenta con una comanda nueva en vez de fingir que sonó.
8. **`route.continue()` no devuelve la respuesta** en Playwright; para leer las cabeceras hay que usar `route.fetch()` + `route.fulfill()`. Por eso la función devuelve `X-Voz-Idioma` / `X-Voz-Velocidad`: es la única forma de verificar desde el navegador qué llegó de verdad a ElevenLabs.
9. **Expectativas mal escritas en los tests, no en el código.** "100" son 3 dígitos → `[1, 00]` → "uno cero", igual que "727" → `[7, 27]`. La regla es por posición, no por valor. Tres casos fallaron por expectativas inventadas antes de aceptar la regla.

### 3.17 Apartado Stock para empleado + solicitar reposición — T17 (DONE, en develop)

**Commit:** `3715671` `feat(T17): apartado Stock para empleado + solicitar reposición reutilizando ModificarStockDialog; registra solicitudes en solicitudes_stock; añade ruta /empleado/stock protegida y item en menú`

**Qué hace:** el empleado tiene una página de Stock (`/empleado/stock`, protegida con `requiredRole="empleado"`) donde ve el inventario de su cafetería y puede solicitar reposición reutilizando `ModificarStockDialog` (adaptado para modo "solicitar"). Las solicitudes se registran en la tabla `solicitudes_stock` (no existe aún en la BD local — ver §4 bloqueos).

**Archivos:** `app-desktop/src/pages/empleado/Stock.jsx` (nueva), `service/solicitudes_stock.js` (servicio), `ModificarStockDialog.jsx` (adaptado), `app.jsx` (ruta + menú).

### 3.18 Unificación de layout y legibilidad KDS — T18 (DONE, en develop)

**Commits:** `eb0a144` y `d05db72` `feat(T18): unificar layout y mejorar legibilidad KDS; unificar encabezados en páginas dueno/empleado`

**Qué hace:** todas las páginas dueño/empleado adoptan `AppLayout`; encabezados unificados en `DashboardHeader`; mejoras de legibilidad en el KDS (tipografía, contraste).

### 3.19 Merge de S1-T16 a develop + estado de rama (DONE)

**Situación:** la rama `S1-T16-Elias-kds-voz` fue **mergeada completamente a develop** (0 commits propios pendientes). Commits de la rama que terminaron en develop:
- `49022fa` orden KDS por hora de retiro
- `e502d8b` avisos de voz ElevenLabs
- `82d73e4` merge con develop (trae 33 commits)
- `d19981d` fix login sin `cafeteria_usuarios`
- `1cffee5` avisos en español y códigos por parejas
- `3715671` T17 (Stock empleado)
- `d05db72` / `eb0a144` T18 (unificación layout)

**Rama local `S1-T16-Elias-kds-voz`:** ya no tiene commits exclusivos (0 ahead de develop). Se puede considerar cerrada.

### 3.20 Diagramas de secuencia actualizados — Estudiante / Empleado / Dueño (DONE)

**Qué hizo:** generar/actualizar los 3 diagramas de secuencia de CoffeeFast en Mermaid, sin referencias a tareas internas (T/FR), con la arquitectura real actual (móvil, KDS, microservicios, Supabase).

**Archivos generados:**
- `/home/elias/Documentos/CODIGO DIAGRAMA DE SECUENCIA ACTUALIZADO.txt` — código Mermaid fuente de los 3 diagramas (estudiante, empleado, dueño).
- `/home/elias/Documentos/diagramas_secuencia_mmd/{estudiante,empleado,dueno}.pdf` — PDFs vectoriales exportados con mermaid-cli v12.
- `/home/elias/Documentos/diagramas_secuencia_mmd/{estudiante,empleado,dueno}.mmd` — archivos Mermaid individuales.

**Pitfalls Mermaid v12 aprendidos:**
1. `box rgb(...)` no admite espacios dentro de `rgb()` → usar `rgb(232,245,233)` sin espacios.
2. Paréntesis en el título de un `box` rompen el color del box → no usar `(` ni `)` en títulos.
3. Comillas en `participant X as "..."` se dibujan literalmente → usar alias sin comillas.
4. Validación: `npx --yes @mermaid-js/mermaid-cli` para verificar antes de exportar.

### 3.21 Análisis de develop tras pull masivo (2026-10-19, solo lectura)

**Situación:** se hizo `git checkout develop` + `git pull` → 112 commits nuevos (`192 files changed, 7606 insertions, 15508 deletions`). Rama propia ya mergeada (0 commits exclusivos).

**Cambios principales detectados (por equipo):**

**sasi372 (19 commits) — refactor masivo de microservicios:**
- `services/` renombrado a **`Microservices/`** (gateway nginx + ms-cafeterias :3002 + ms-menus :3003 + ms-pedidos :3005 + shared). `ms-inventario` e `inventario-service/` **eliminados** (retiro documentado en `docs/kubernetes/retiro-ms-inventario-legado.md`).
- `k8s/` **eliminado** → `k8s-next/` con manifests completos (deployment, service, hpa.yaml por MS, fortio.yaml, ingress).
- **Estados canónicos de pedido** en `Microservices/ms-pedidos/src/modules/pedidos/pedidos.maquina-estados.js`: `pendiente → en_preparacion → listo → entregado` (+ `cancelado` terminal). Cancelación solo desde `pendiente`. Aliases legacy (`pagado`, `preparando`, `retirado`) se normalizan automáticamente.
- **`rpc_qr.sql` corregido**: `estado='Pagado'` → **`estado='pendiente'`** (resuelve el desfase que el KDS filtraba `!== 'pendiente'` pero el móvil creaba `'Pagado'`).
- **`procesar_pago` ahora definida en el repo** (`app-mobile/tabla_mobile/rpc_qr.sql:21`), aunque no aplicada a BD local.
- Nueva **`rpc_cancelar_pedido.sql`**: cancelación transaccional con reembolso a Wallet, solo desde `pendiente`, autoría vía `auth.uid()`.
- `backend-node/` reducido: eliminados `cafeteria-usuarios.service.js`, `campus.service.js`, `categorias.service.js`, `universidades.service.js`, `detalles-pedido.service.js`, `logger.js`, `validators.js`.
- Limpieza en `app-desktop`: borrados `TicketImpresion.jsx`, `GestorPrecioStockDialog.jsx`, páginas viejas (`dashboard`, `inventario`, `login`, `pedidos`, `productos` en minúscula), 13 archivos de `service/`. **Cero imports rotos** (verificado con grep).

**Diego24Vas (4 commits) — S2 auth:**
- S2-T1: redirección tras confirmación de correo.
- S2-T2: flujo PKCE en `App.tsx` (soporte `code` en query).
- S2-T3: estado visual "Revisa tu correo" tras registro exitoso (`RegisterScreen.tsx`).
- `emailRedirectTo: coffeefast://auth/callback` en registro.

**Camilo (3 commits) — autoscaling:**
- S2-T5: HPA para los 3 microservicios (`maxReplicas: 2` por ResourceQuota del namespace; requests 50m/64Mi, limits 150m/128Mi).
- Fortio versionado como Pod standalone en `k8s-next/fortio/fortio.yaml` (25m/64Mi requests, 100m/128Mi limits; `restartPolicy: Never`).
- Docs de autoescalado en `docs/kubernetes/`.

**Ariel (5 commits) — pantallas móvil:**
- PedidosScreen: vista activos/historial con boleta sin QR.
- PerfilScreen: historial de movimientos desde `logs_auditoria` (870 líneas nuevas).
- MenuScreen: búsqueda y ordenamiento de productos.
- RegisterScreen: estado "Revisa tu correo" + PKCE.

**Impacto en nuestro trabajo (T16/T17/T18):** archivos `vozKdsService.js`, `kdsRealtime.js`, `pages/empleado/*`, `prueba-voz.html`, `KdsTopBar.jsx`, `Stock.jsx`, `solicitudes_stock.js`, `supabase/functions/voz-pedido/` → **diff vacío** (develop no los tocó). Nuestro trabajo está íntegro.

---

### 3.22 · S2-T1 — Componentes reutilizables + tipografía/espaciados Mobile (DONE local, SIN push)

**Rama:** `S2-T1-Elias-componentes-reutilizables-mobile` (creada desde `develop` `b270f11`, local).
El equipo acordó nombrar las ramas de S2 como `S2-Tn-<Nombre>-<desc>`, así que la regla §0 "solo rama AppDesktopEliasS1" quedó obsoleta.

**Objetivo:** crear/normalizar componentes reutilizables (botones, tarjetas, inputs, títulos, contenedores) y dejar tipografía + espaciados consistentes en la app móvil, con tests. Sin cambios visuales.

**Qué se hizo (valor hex idéntico → cero cambio visual):**
- **`theme/colors.js`**: se agregaron **tokens semánticos aditivos** (no se borró ninguno). Nuevos: `fondoSuave`, `acento`, `verdeStock/naranjaStock/rojoStock/stockTrack`, `textoOscuro/Medio/MedioClaro/Tenue/Marron/MarronOscuro`, `marronMedio`, `textoDeshabilitadoClaro`, `superficieCrema/SuperficieCremaSuave/Hueso`, `cremaBoton`, `chipBg/chipBadgeBg`, `blancoTranslucido/blancoOverlay/blancoHumo/blancoTenue/blancoBordeTranslucido`, `overlayOscuro/overlayModal/overlayNegro/overlayNegroSuave`, `doradoTranslucido`, `bordeSuave/Input/Error/Exito/Dorado`, `deshabilitado`, `textoExito/Error`, `visa/mastercard`, `sombra`.
- **`theme/spacing.js`**: se agregó escala `radius` (`xs 6, sm 8, md 12, lg 16, xl 20, pill 999`). Se conservó `spacing` igual.
- **`theme/typography.ts`**: se agregaron pesos nombrados (`pesoNormal/Medio/Bold/ExtraBold`), `familiaTitulo` (`Georgia` en iOS / `serif`), y un objeto `lineHeight`. Tamaños intactos.
- **`theme/index.js`** (nuevo): re-exporta `colors`, `spacing`, `radius`, `typography`, `lineHeight` desde un solo punto.
- **Componentes nuevos:** `components/Title.js` (título+subtítulo, variantes `display/h1/h2/h3`, `serif`, `align`) y `components/Container.js` (`SafeAreaView` + `KeyboardAvoidingView` + `ScrollView` opcionales).
- **Componentes normalizados:** `Button.js` (variantes `primary/secondary/outline/ghost/danger`, tamaños, `loading`, `fullWidth`), `Card.js` (variantes y paddings), `Input.js` (label+input+error, props paso a paso).
- **`LoginScreen.tsx`** adopta `Container` + `Title` (pantalla de referencia); se eliminaron los `styles.container/keyboardView/title/subtitle` que ahora los aporta el sistema.
- **Normalización de colores hardcodeados → tokens** en `ProductCard`, `CategoryFilter`, `CartItem`, `ProductDetail`, `RegisterScreen`, `LoginScreen`, `ResetPasswordScreen`, `PaymentScreen`, `WalletScreen`, `PedidosScreen`, `PerfilScreen`. Verificado con grep: **0 hex/rgba sueltos** fuera de `theme/` (queda solo el blanco/negro por defecto de `lib/QrCode.js`, intencional).

**Bugs reales corregidos:**
- **`Input.js`**: declaraba `autoCorrect` pero nunca lo pasaba al `TextInput` (se perdía). Ahora se propaga (y se preservan los defaults `autoCapitalize='none'` / `autoCorrect=true`).
- **`Button`**: `PerfilScreen.js` usaba `variant="outline"` que **no existía** → quedaba sin estilos. Se implementó la variante.

**Tipado (JS + `checkJs`):** los componentes JS no tenían PropTypes, así que `tsc` infería props requeridas y rompía ~30 usos en pantallas `.tsx`. Se resolvió con JSDoc `@type {React.FC<{...}>}` (props opcionales + índice para `Input`). **`npx tsc --noEmit` queda en 0 errores** (baseline tenía 1: faltaban `@types/react-test-renderer`, que se agregó).

**Tests / verificación:**
- `package.json`: scripts `test`, `test:watch`, `typecheck`; devDeps `jest ^29.7.0`, `jest-react-renderer` (react-test-renderer 18.3.1), `@types/jest`, `@types/react-test-renderer`.
- `jest.config.js`: preset `react-native` (RN 0.76 no publica `@react-native/jest-preset`, existe recién desde 0.85), `moduleNameMapper` al mock oficial de AsyncStorage, `transformIgnorePatterns` para RN/Expo/Supabase.
- `__tests__/DesignSystem.test.tsx` (**nuevo**, 24 tests): render, variantes, spinner/disabled, regresión `outline`, propagación de `autoCorrect`/props de `Input`, variantes de `Title`, `Container` (scroll/padding/background).
- Resultado: **`npx jest` → 25/25 en verde** (24 nuevos + `App.test.tsx` preexistente que ahora corre). **`npx expo export --platform android` OK** (761 módulos, bundle .hbc generado).
- **Nota:** `npm run lint` no puede correr: el proyecto usa `.eslintrc.js` y `eslint` no está en devDeps (jamás se instaló). No se tocó config de ESLint.

**Nuevos sin trackear (no se suben):** `__tests__/DesignSystem.test.tsx`, `src/components/Container.js`, `src/components/Title.js`, `src/theme/index.js`.
**`node_modules/` recién instalado en `app-mobile`** con `npm install --legacy-peer-deps` (~945 paquetes; primera corrida falló por `@react-native/jest-preset@0.76.9` inexistente y por un ECONNRESET, resuelto con reintentos).

---

## 4. Estado actual del repositorio

- **`develop`** en `b270f11` (= `origin/develop`, 0 commits pendientes). **Rama de trabajo actual: `S2-T1-Elias-componentes-reutilizables-mobile`** (local, SIN push, sin commitear aún).
- **Tarea S2-T1 completada y verificada** (ver §3.22): `jest` 25/25, `tsc --noEmit` 0 errores, `expo export android` OK. **Falta el commit** (a la espera de aprobación explícita del usuario).
- Commits propios en develop: T16 (voz), T17 (stock empleado), T18 (layout unificado) — todos integrados.
- **Build verificado:** `npm run build` en app-desktop OK (10.33s, sin errores).
- Instancia local de Supabase corriendo **en el repo** (`supabase/`). Usuarios GoTrue locales: `empleado@cofeefast.cl`/`123456` (Juan, `usuarios` id 2) y `dueno@cofeefast.cl`/`123456` (Carlos, `usuarios` id 3). `.env` (raíz, gitignored) apunta a `127.0.0.1:54321`.
- **BD local pendiente de aplicar** (SQL versionado en repo pero no ejecutado localmente): `rpc_qr.sql` (procesar_pago + estado pendiente), `rpc_cancelar_pedido.sql`, `crear_wallet_tables.sql` (no existe en repo → buscar fuente), `seed_menu_realista.sql` (idem), `setup_movil_completo.sql` (idem), `crear_rpc_pagos.sql` (idem). Tablas que faltan en BD local: `wallets`, `movimientos_wallet`, `solicitudes_stock`, `cafeteria_usuarios`, `logs_auditoria`.
- `npm install --legacy-peer-deps` requerido en `app-desktop` por `react-qr-reader` (React 18 vs peer ≤17).
- Sin trackear (NO se suben): `docs_local/`, `paleta_colores`, `app-desktop/.env`, `.env` raíz, `.playwright-mcp/`, `supabase/.temp/`.

---

## 5. Checklist para escribir este historial

- [ ] Agregar tarea completada con: contexto, archivos tocados, cómo se verificó, commit/hash si existe, y si fue pusheado.
- [ ] Registrar lecciones aprendidas (bugs, zona horaria, tablas en mayúsculas, mock vs real).
- [ ] Mantener §0 (reglas) y §2 (metodología) si cambian.