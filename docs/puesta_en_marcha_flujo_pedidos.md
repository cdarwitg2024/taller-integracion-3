# Puesta en Marcha — Flujo de Pedidos (pago → preparación → retiro por QR)

Documento de referencia para levantar el flujo completo en local y para entender
**por qué** el flujo estaba roto y qué se corrigió. Todo lo descrito aquí está
verificado contra la base local y la suite de pruebas del backend.

---

## 1. Requisitos

| Herramienta | Versión | Notas |
| --- | --- | --- |
| Node.js | 18+ | `node -v` |
| Docker Desktop | cualquiera | Levanta Supabase local |
| Supabase CLI | cualquiera | Opcional, solo para `supabase start/stop` |

Servicios locales esperados:

| Servicio | URL |
| --- | --- |
| Supabase API (PostgREST + GoTrue) | `http://127.0.0.1:54321` |
| Supabase Studio | `http://127.0.0.1:54323` |
| PostgreSQL | `postgresql://postgres:postgres@127.0.0.1:54322/postgres` |
| Backend Node | `http://localhost:3000` |
| App escritorio (Vite) | `http://localhost:5173` |
| App móvil (Expo) | `http://localhost:8081` (emulador) o IP de la PC (físico) |

### Variables de entorno

| Archivo | Para qué | Clave que usa |
| --- | --- | --- |
| `.env` (raíz) | `backend-node` | `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` |
| `app-desktop/.env` | Escritorio | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` |
| `app-mobile/.env` | Móvil | `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` |

- `backend-node` usa la **service_role**, que se salta RLS. Nunca va en las
  apps: esas usan la clave publishable y dependen de RLS.
- Sin `SUPABASE_SERVICE_KEY` el backend igual arranca (cae a las variables
  `VITE_*`), pero las escrituras fallan por RLS. Si eso pasa, copiar la
  service_role local desde `services/.env`.
- La service_role local también sale de `supabase status`.

---

## 2. Levantar el entorno

```bash
# 1) Base de datos
supabase start

# 2) Backend
cd backend-node
npm install
npm start            # puerto 3000

# 3) Escritorio
cd app-desktop
npm install
npm run dev          # puerto 5173

# 4) Móvil
cd app-mobile
npm install
npx expo start
```

En un **teléfono físico**, `127.0.0.1` no sirve: dentro del teléfono es el propio
teléfono. Hay que usar la IP de la PC en la red local:

- `app-mobile/.env` → `EXPO_PUBLIC_SUPABASE_URL=http://<IP_PC>:54321`
- `app-mobile/.env` → `EXPO_PUBLIC_API_URL=http://<IP_PC>:3000`
- En emulador de Android: `http://10.0.2.2:<puerto>`
- El firewall de Windows debe dejar pasar los puertos `54321` y `3000`.

---

## 3. Migraciones: orden de aplicación

**El orden importa.** `crear_rpc_pagos.sql` es la versión canónica de
`procesar_pago` y define la columna, la función de tokens y los índices.
`agregar_franja_retiro.sql` quedó obsoleta: aplicarla después deshace las
correcciones.

| # | Archivo | Qué hace |
| --- | --- | --- |
| 1 | `database/fixes/crear_wallet_tables.sql` | Tablas de wallet (`wallets`, `movimientos_wallet`) y sus políticas RLS |
| 2 | `database/fixes/seed_datos_basicos.sql` | Cafeterías, roles y usuarios base |
| 3 | `database/fixes/seed_menu_realista.sql` | Productos del menú |
| 4 | `database/fixes/setup_movil_completo.sql` | Columnas que usa el móvil en `pedidos` (`metodo_pago`, `ubicacion_entrega`, `notas_estudiante`, `completado_en`) y políticas de `usuarios` |
| 5 | `database/fixes/crear_rpc_pagos.sql` | **RPC `procesar_pago` (canónica)**: columna `franja_retiro`, tokens, índices |
| 6 | `database/fixes/crear_logs_validacion_qr.sql` | Tabla de auditoría y sus políticas |
| 7 | `database/fixes/bloquear_anon_sensibles.sql` | Revoca el acceso anónimo a datos sensibles (deja RLS habilitado) |
| 8 | `database/fixes/habilitar_realtime.sql` | `pedidos` en la publicación Realtime |
| 9 | `database/fixes/sincronizar_logs_validacion_qr.sql` | Agrega las columnas que faltaban en `logs_validacion_qr` (`qr_token`, `detalle`, `validado_en`). Sin ellas el backend registra cada validación con `PGRST204` y el panel del Dueño queda vacío |

### Archivos que NO se aplican

| Archivo | Por qué |
| --- | --- |
| `database/fixes/agregar_franja_retiro.sql` | Obsoleto. Su encabezado explica el conflicto con la RPC canónica. |
| `database/fixes/fix_rls_recursion.sql` | Obsoleto y **neutralizado**: desactivaba RLS en 10 tablas, incluida `pedidos`. Correrlo abriría los pedidos y las billeteras de todos los estudiantes a la clave anónima. |
| `database/fixes/fix_acentos.sql` | Solo si aparecen caracteres rotos por codificación. No es parte del flujo. |

Todos los scripts son idempotentes: se pueden volver a correr sin error.


### 3.1 Aplicar una migración

Desde el Supabase Studio → SQL Editor, pegando el contenido del archivo. O por
línea de comandos, sin resetear la base (conserva los datos):

```bash
# Windows, con el contenedor de Supabase levantado
type database\fixes\crear_rpc_pagos.sql | docker exec -i supabase_db_db_CoffeeFaster psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f -
```

Después de cambiar la firma de una función, **hay que recargar el schema cache de
PostgREST** o la API seguirá devolviendo `PGRST202`:

```bash
docker restart supabase_rest_db_CoffeeFaster
```

---

## 4. Cuentas de prueba

Hay dos ambientes y **no comparten cuentas**. Cada una se creó en su propia
base de datos.

### Local (Supabase en Docker) — es el ambiente por defecto

| Rol | Email | Contraseña | Dónde entra |
| --- | --- | --- | --- |
| Estudiante | `cliente.prueba@ejemplo.cl` | `123456` | App escritorio |
| Estudiante | `otro.prueba@ejemplo.cl` | `123456` | App escritorio |
| Estudiante (móvil) | `camilo.pago@alu.uct.cl` | `123456` | App móvil |
| Empleado / KDS | `empleado.prueba@ejemplo.cl` | `123456` | App escritorio |
| Empleado / KDS | `empleado@coffeefaster.cl` | `123456` | App escritorio |
| Dueño | `dueno@coffeefaster.cl` | `123456` | App escritorio |

- La app móvil **exige dominio institucional** en el registro (`@alu.uct.cl`),
  ver `RegisterScreen.tsx`. Por eso la cuenta móvil es `camilo.pago@alu.uct.cl`
  y no un `@ejemplo.cl`.
- `camilo.pago@alu.uct.cl` tiene saldo (`wallets.saldo_actual = 50000`) para
  poder probar el pago completo. `cliente.prueba@ejemplo.cl` trae 30000 de
  salida; los demás en 0.
- Los empleados necesitan fila en `cafeteria_usuarios` con
  `gestiona_pedidos_kds = true`, o `cambiar_estado_pedido` los rechaza aunque el
  login funcione. Los dos empleados locales lo tienen en la cafetería 1.
- Los `usuarios.id` locales son 1..6 y los roles 1=estudiante, 2=empleado,
  3=dueño.

### Nube (`yvkpmqcynpygqjvaoiwn`) — para la entrega

| Rol | Email | Contraseña | Dónde entra |
| --- | --- | --- | --- |
| Estudiante | `camilo@uct.cl` | `123456` | App móvil |
| Empleado / KDS | `empleado@coffeefaster.cl` | `123456` | App escritorio |
| Dueño | `dueno@coffeefaster.cl` | `123456` | App escritorio |

- Ahí los roles son 5=estudiante, 4=empleado, 6=dueño.
- Para trabajar en la nube hay que cambiar los `.env` a la URL y claves del
  proyecto remoto. La app móvil queda apuntando a `10.0.2.2` solo en local.

### Reglas que aplican a ambos ambientes

- Los roles se leen de `usuarios.rol_id` → `roles.nombre`.
- Las cuentas están vinculadas en Supabase Auth **y** en la tabla `usuarios`
  con el mismo `auth_user_id`. El login es estricto contra Auth
  (`signInWithPassword`) y no tiene modo de respaldo: sin `auth_user_id`
  coincidente devuelve "No se encontró el perfil de usuario registrado".
- Ojo al crear cuentas desde el Dashboard: el trigger que inserta la fila en
  `usuarios` asigna siempre el rol de estudiante. Para dueño o empleado hay
  que corregir `usuarios.rol_id` a mano (local: dueño = 3, empleado = 2; nube:
  dueño = 6, empleado = 4).

---

## 5. El flujo, paso a paso

```
Pago (móvil)                Base de datos               KDS (escritorio)
──────────────────────       ───────────────────────     ─────────────────────
procesar_pago()
  · recalcula el total        pedidos.estado = 'pendiente'
  · descuenta la wallet       pedidos.franja_retiro
  · genera 2 tokens           pedidos.qr_token
                               pedidos.codigo_retiro_diario
                                        │
                                        │  Realtime
                                        └──────────────►  columna "Pendiente"
                                                             · PATCH /api/pedidos/:id/estado
                                                               → en_preparacion
                                                             · PATCH .../estado
                                                               → listo
                                                             · Escanea QR o dicta
                                                               el código
                                                                     │
                                                    pedidos.estado = 'entregado'
                                                              │
                                        ◄─────────────────────┘
                                   Realtime: desaparece del KDS
                                   logs_validacion_qr: queda el registro
```

### 5.1 Los dos tokens de retiro

| Token | Formato | Dónde vive | Para qué |
| --- | --- | --- | --- |
| `qr_token` | `CF-` + 20 caracteres | `pedidos.qr_token` | Vai dentro del QR |
| `codigo_retiro_diario` | 8 caracteres | `pedidos.codigo_retiro_diario` | Contingencia: se dicta si el QR no se puede escanear |

El alfabeto de ambos excluye **I, L, O y U** para que no haya ambigüedad al
dictarlos. Los dos se generan **en la misma transacción que el pago**, para que
todo pedido pagado sea siempre retirable.

El contenido del QR no es texto plano, es un JSON:

```json
{
  "pedido_id": 38,
  "qr_token": "CF-7MN2EVJDSS9A93SBYJB7",
  "franja_retiro": "14:00 - 14:15",
  "tipo": "RETIRO_COFFEEFAST",
  "created_at": "..."
}
```

Quien escanea tiene que extraer el `qr_token` de ese JSON. Tanto el backend como
el escritorio lo hacen con un normalizador que también acepta texto plano, por
compatibilidad con pedidos antiguos.

### 5.2 Estados: dos vocabularios

La base de datos guarda **slugs en minúsculas**; la API expone **etiquetas
legibles**. La traducción vive en `ESTADO_DB` / `ETIQUETA_ESTADO`
(`backend-node/src/modules/pedidos/pedidos.maquina-estados.js`).

| Slug en BD | Etiqueta en API |
| --- | --- |
| `pendiente` | `Pagado` |
| `en_preparacion` | `En preparación` |
| `listo` | `Listo` |
| `entregado` | `Retirado` |
| `cancelado` | `Cancelado` |

**El KDS y el móvil filtran contra los slugs.** Guardar la etiqueta en la base
hace que un pedido pagado no aparezca en ninguna columna.

---

## 6. Endpoints del backend

Base: `http://localhost:3000` · Health check: `GET /health`

### Pedidos

| Método | Ruta | Para qué |
| --- | --- | --- |
| `POST` | `/api/pedidos` | Crear pedido (API; la vía del móvil es la RPC) |
| `GET` | `/api/pedidos` | Listar |
| `GET` | `/api/pedidos/:id` | Obtener uno |
| `GET` | `/api/pedidos/cafeteria/:cafeteriaId` | Listar por cafetería |
| `GET` | `/api/pedidos/usuario/:usuarioId` | Listar por usuario |
| `GET` | `/api/pedidos/:id/qr` | **QR en base64** → `data.qr_image` |
| `GET` | `/api/pedidos/:id/token-contingencia` | Código de 8 caracteres |
| `POST` | `/api/pedidos/validar-qr` | Validar retiro (QR o código) |
| `PATCH` | `/api/pedidos/:id/estado` | Avanzar estado |

Otros grupos: `/api/qr`, `/api/pagos`, `/api/tiempos`, `/api/notificaciones`,
`/auth`, `/cafeterias`.

Validar un retiro:

```bash
curl -X POST http://localhost:3000/api/pedidos/validar-qr \
  -H "Content-Type: application/json" \
  -d '{"token":"H15FR5DR"}'
```

Acepta el código de contingencia, el `qr_token` en texto plano o el JSON
completo del QR. Responde con `valido`, `metodo_validacion` (`qr` o
`contingencia`) y el pedido actualizado.

---

## 7. Qué estaba roto y cómo se corrigió

### 7.1 `PGRST202`: la firma de la RPC no coincidía

El móvil llamaba `procesar_pago` con tres argumentos
(`p_cafeteria_id`, `p_items`, `p_franja_retiro`) pero la base solo tenía la
firma de dos. PostgREST devolvía `PGRST202` y **no se podía pagar**.

Había además **dos** definiciones de la misma función en el repo con firmas
distintas, y aplicarlas en el orden equivocado dejaba la base en un estado u
otro.

> Consolidado en `database/fixes/crear_rpc_pagos.sql`: hace `DROP` de la firma
> vieja antes del `CREATE` y deja una sola, con `p_franja_retiro TEXT DEFAULT NULL`.

### 7.2 El pedido se guardaba como `'Pagado'`, no como `'pendiente'`

La RPC insertaba la etiqueta `'Pagado'` en `pedidos.estado`. El KDS y el móvil
comparan contra `'pendiente'`, así que **el pedido pagado no aparecía en
ninguna columna** y parecía que el pago se perdía.

> La RPC ahora inserta el slug `'pendiente'`, y el backend traduce etiqueta ↔
> slug al leer y al escribir.

### 7.3 El QR no existía

`crear_rpc_pagos.sql` y `agregar_franja_retiro.sql` no generaban `qr_token` ni
`codigo_retiro_diario`. El KDS se quedaba sin código válido con el que validar
el retiro.

> Se agrega `generar_token_retiro()` y ambos tokens se crean dentro de la
> transacción del pago. Además, un **índice único parcial** sobre
> `codigo_retiro_diario`: el bucle de colisiones de la RPC es una comprobación,
> no una garantía, y dos pagos simultáneos podían sacar el mismo código de 8
> caracteres (el KDS validaría el pedido equivocado).

### 7.4 El token de contingencia se perdía

`pedidos.token_contingencia` **no existe en el esquema**. El backend lo generaba
y lo guardaba solo en memoria, así que al reiniciar el servidor ningún pedido
antiguo quedaba retirable, y `codigo_legible` era un `#CF-1234` decorativo que
el KDS nunca podía validar.

> La columna real es `codigo_retiro_diario`. Ahora el token se persiste ahí, la
> verificación de colisión consulta la base en vez de la memoria, y
> `codigo_legible` es el token real.

### 7.5 La validación por token siempre fallaba

`validarEntrega` buscaba con un único `.or()` que interpolaba el token en tres
columnas, una de ellas `id` (BIGINT). PostgREST rechazaba el filtro entero
(`PGRST100`) y la búsqueda devolvía "no encontrado" **aunque el código existiera**
en la base.

> Se reemplazó por consultas separadas: `qr_token`, luego
> `codigo_retiro_diario`, y `id` solo si el token es numérico.

### 7.6 El QR en JSON no se podía validar

El QR que genera el backend es un JSON, no texto plano. El escritorio comparaba
el JSON entero contra `qr_token` y no encontraba el pedido.

> `normalizarTokenQR` (escritorio) y `validarEntrega` (backend) extraen el
> `qr_token` del JSON. Ambos aceptan las dos formas.

### 7.7 Las validaciones no quedaban auditadas

Solo se registraba en `logs_validacion_qr` desde el *fallback* de Supabase del
escritorio. Como el KDS consulta primero al backend, **un retiro validado
exitosamente no dejaba ningún rastro**.

> El backend registra cada validación —aprobada o rechazada— con
> `resultado` y `motivo_rechazo`. Un fallo de auditoría no impide la entrega: se
> avisa por consola y se sigue.

### 7.8 El móvil dibujaba el QR local, sin franja ni contingencia

`PedidosScreen` generaba el QR en el teléfono con el token crudo, no mostraba la
franja de retiro ni el código de contingencia, y su `.env` decía que la app
"todavía no llama" al backend.

> Ahora pide el QR a `GET /api/pedidos/:id/qr` y muestra franja, QR y código de
> contingencia. Si el backend no responde (teléfono sin red contra la PC, API
> apagada) cae al QR local con el token crudo, que el KDS también acepta.

### 7.9 La franja de retiro no se guardaba

El backend insertaba en `pedidos` sin la columna `franja_retiro`, así que un
pedido creado por la API llegaba al barra sin ventana de retiro.

> El `INSERT` del backend incluye `franja_retiro` y el slug del estado. La RPC
> además **rechaza el pago sin franja**, devolviendo
> `{"ok": false, "motivo": "franja_requerida"}`.

La columna sigue siendo nullable a propósito: hay pedidos históricos anteriores
a la franja y volverla `NOT NULL` los dejaría huérfanos.

### 7.10 La recarga de la wallet no sumaba nada (y no daba error)

La app hacía la recarga con un `UPDATE` directo sobre `wallets`. Pero
`crear_rpc_pagos.sql` **elimina la política `wallets_update_own` a propósito**,
para que ningún estudiante se ponga un saldo arbitrario desde la app.

El detalle importante es que **eso no lanzaba ningún error**: con RLS, el
`UPDATE` no encontraba filas y PostgREST respondía `204` como si hubiera
funcionado. La app sumaba el monto en pantalla, el `Alert` no aparecía, y al
refrescar el saldo volvía a su valor viejo. Un fallo silencioso.

> La recarga ahora pasa por la RPC `recargar_saldo(p_monto)`, que suma el saldo,
> inserta el movimiento y devuelve **el saldo leído de la base** (no uno
> calculado en el cliente). Mantiene la intención de seguridad: el saldo solo
> cambia por RPC, nunca con un `UPDATE` abierto.

> **Ojo, es una recarga simulada.** No hay pasarela de pago detrás: cualquier
> estudiante autenticado puede recargarse a sí mismo. Por eso la RPC acota el
> monto ($100.000 por operación, $200.000 por día) y toma `FOR UPDATE` sobre la
> fila para que dos recargas simultáneas no se pisen. **En producción hay que
> invocarla solo después de confirmar el pago con la pasarela.**

### 7.11 Los pedidos del móvil salían como mockups

Dos errores encadenados en `PedidosScreen.js`:

1. La consulta filtraba por `pedidos.auth_user_id`, **una columna que no existe
   en el esquema**. PostgREST respondía `400 column pedidos.auth_user_id does
   not exist` y el `catch` caía a los datos de ejemplo.
2. `pedidos.usuario_id` es **BIGINT** (el id interno de `usuarios`), pero se le
   pasaba el **UUID de Supabase Auth**. Aun con la columna correcta, la
   comparación no podía funcionar.

El mismo error estaba en el filtro de **Realtime**, así que el móvil tampoco
recibía en vivo las actualizaciones de sus pedidos.

> Ahora se resuelve el id interno por `usuarios.auth_user_id` —igual que ya
> hacía `WalletScreen`— y se filtra por `usuario_id` con ese entero. Los mockups
> quedaron solo para el **modo invitado**: un usuario autenticado sin pedidos ve
> la lista vacía, no datos falsos que lo hacen creer que sus compras se perdieron.

---

### 7.12 La local devolvía HTTP 500 en casi todo (`42P17`)

Las políticas `usuarios_select_dueno`, `usuarios_insert_dueno` y
`usuarios_delete_dueno` tenían su `EXISTS` escrito a mano, y como leía de
`usuarios` desde una política sobre `usuarios`, Postgres la abortaba con
`infinite recursion detected in policy`. Una sola política inválida tiraba
abajo **todas** las consultas con la clave anon o authenticated: por eso no
cargaban ni `cafeterias` ni `productos`.

No se resolvió borrando las políticas (con RLS activo y sin política SELECT el
login deja de poder leer su propio perfil), sino replacing el `EXISTS` por
`es_dueno()`, que es `SECURITY DEFINER` y por lo tanto no dispara RLS.
Está en `database/fixes/fix_rls_recursion_usuarios.sql`.

### 7.13 El dueño solo veía su propia fila (`es_dueno()` siempre false)

Al aplicar el script de arriba por PowerShell hacia el contenedor, la `ñ` de
`IN ('dueño', 'dueno')` se corrompió a `IN ('due??o', 'dueno')`. Como el rol real
es `dueño`, `es_dueno()` devolvía `false` para todos y las políticas del dueño
degeneraban en "ve solo su propio usuario".

Dos detalles que hacen fácil que vuelva a pasar:

- El archivo en el repo estaba bien en UTF-8; la corrupción fue en el tránsito.
  Por eso ahora `es_dueno()` no escribe el literal: usa el regex ASCII
  `'^due.o$'`, que matchea `dueño` y `dueno` indistinto del encoding con que
  llegue.
- `is_dueno()` (sin prefijo `es_`) nunca estuvo rota: comparaba dentro de
  plpgsql, donde el `dueño` sí llegó bien. Que dos funciones con el mismo nombre
  y distinto comportamiento den bugs distintos es la trampa.

Para verificar rápido:

```sql
select proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and pg_get_functiondef(p.oid) like '%??%';
-- no debe salir nada
```

---

### 7.14 La wallet del móvil reventaba al abrirla (`mov.id.startsWith is not a function`)

`movimientos_wallet.id` es **BIGINT**, así que PostgREST lo devuelve como número
JSON (`7`), no como string. La interfaz TypeScript de la app lo declaraba
`id: string` y `MovimientoItem` hacía:

```ts
const esNuevo = mov.id.startsWith('temp-');   // (7).startsWith -> undefined
```

En JSC el error queda como `(it is undefined)`, que no dice "es un número" y
hace pensar en un campo faltante. El movimiento optimista que se inserta en
cliente al recargar sí usa un string (`temp-<ms>`), así que conviven los dos
tipos: por eso el tipo ahora es `number | string` y la comparación va con
`String(mov.id)`.

El error salía **al entrar** a la wallet, no al recargar: cualquier movimiento
con `id` numérico ya lo dispara.

### 7.15 El saldo no se actualizaba solo (Realtime)

`movimientos_wallet` no estaba en la publicación `supabase_realtime`. El canal
de `WalletScreen` se suscribe a `wallets` **y** a `movimientos_wallet`; al
suscribirse a una tabla que no está publicada, el canal entero queda con error
y **tampoco** llegan los eventos de `wallets`. Es decir, la falta de una tabla
rompía el balance en vivo de la otra.

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.movimientos_wallet;
```

Para revisar qué tablas escuchan en vivo:

```sql
SELECT tablename FROM pg_publication_tables
WHERE pubname = 'supabase_realtime' ORDER BY tablename;
```

---

## 8. Verificación

### 8.1 Pruebas del backend

```bash
cd backend-node
npm test

# Ojo: las 4 suites pegan a la MISMA base local y, en paralelo, se pisan entre
# ellas. Con el timeout por defecto de Jest (5000 ms) aparecen fallos
# intermitentes del tipo "Exceeded timeout of 5000 ms for a test" y el número
# de tests que falla cambia en cada corrida (2, luego 1, luego ninguno).
# No es lógica rota: es contención. En serie pasa todo.
npm test -- --runInBand
```

**51/51 pruebas en 4 suites** (`maquina-estados`, `notificaciones`, `pedidos`,
`qr`).

Dos expectativas se actualizaron al contrato nuevo: el `qr_token` ya no es un
UUID sino `CF-` + 20 caracteres, y `codigo_legible` ya no es un `#CF-####`
decorativo sino el token real de 8 caracteres. Los dos formatos anteriores
estaban codificados en los tests, no en la base.

### 8.2 Build de las apps

```bash
cd app-desktop
npm run build

cd ../app-mobile
npx expo export --platform android --output-dir .expo-export-check
```

Ambos compilan sin errores (el aviso de chunk >500 kB en el escritorio es de
Vite, no un fallo).

> En `app-desktop`, `npm install` a secas falla con un conflicto de peer
> dependency de `react-qr-reader@3.0.0-beta-1`. Instalar con
> `npm install --legacy-peer-deps`.

### 8.3 Prueba manual del flujo completo

1. Móvil: entrar como `camilo.pago@alu.uct.cl` (local), elegir cafeteria,
   productos y **franja de retiro**, pagar con la wallet.
2. Verificar que el saldo baja y que el detalle del pedido muestra franja, QR y
   código de contingencia.
3. Escritorio: el KDS muestra la comanda en "Pendiente" sin recargar (Realtime).
4. Avanzar a "En Preparación" y luego a "Listos para Retiro".
5. Escanear el QR (o dictar el código de contingencia) → la validación pasa.
6. El pedido desaparece del KDS y queda una fila en `logs_validacion_qr`.
7. Repetir el paso 5 con el mismo token → debe rechazarse (*token de un solo uso*).

### 8.4 Consulta rápida de auditoría

```sql
SELECT id, pedido_id, resultado, qr_token_leido, motivo_rechazo, creado_en
FROM public.logs_validacion_qr
ORDER BY id DESC
LIMIT 20;
```

### 8.5 Aislamiento (RLS)

Vale la pena comprobarlo: la clave anónima no debe ver nada, y un estudiante
autenticado solo debe ver lo suyo.

```sql
-- RLS habilitado en todas las tablas del flujo
SELECT relname, relrowsecurity
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND relname IN ('pedidos','wallets','usuarios','detalles_pedido','logs_validacion_qr')
ORDER BY relname;
```

Estado verificado: `relrowsecurity = true` en las cinco tablas. Con la clave
anónima, `pedidos`, `wallets` y `usuarios` devuelven **0 filas** y
`logs_validacion_qr` responde **401**. Autenticado como estudiante, devuelve
solo sus propios pedidos y su propia wallet.

> `fix_rls_recursion.sql` desactivaba RLS en esas diez tablas y su cuerpo quedó
> neutralizado. Correrlo sería una regresión de seguridad.

---

## 9. Problemas frecuentes

| Síntoma | Causa | Solución |
| --- | --- | --- |
| `PGRST202` al pagar | La RPC en la base no es la de `crear_rpc_pagos.sql` | Aplicar el archivo y reiniciar PostgREST |
| La recarga no suma y no da error | El `UPDATE` de `wallets` no tiene política RLS: 0 filas, `204` | Se usa la RPC `recargar_saldo` |
| Los pedidos salen como datos de ejemplo | Filtro por `auth_user_id` (no existe) y UUID contra un BIGINT | Resolver `usuarios.id` y filtrar por `usuario_id` |
| El KDS no muestra el pedido | `estado` guardado como etiqueta (`'Pagado'`) en vez de slug | Normalizar con los `UPDATE` del encabezado de `agregar_franja_retiro.sql` |
| `PGRST100` al validar un código | Búsqueda con `.or()` sobre columna BIGINT | Ya corregido en `pedidos.service.js` |
| El QR sale en blanco o no carga | El móvil no alcanza al backend | Revisar `EXPO_PUBLIC_API_URL` con la IP de la PC y el firewall |
| El backend ignera los cambios | Proceso antiguo en memoria | Reiniciar `npm start` |
| "Código QR o Token no encontrado" | QR con JSON malformado, o QR de otra cafetería | Verificar el contenido del QR y `CAFETERIA_ID` |
| Todo responde HTTP 500 en local | Política RLS recursiva sobre `usuarios` (42P17) | Aplicar `database/fixes/fix_rls_recursion_usuarios.sql` |
| El backend arranca pero no escribe | Sin `SUPABASE_SERVICE_KEY`, cae a la clave anon y RLS bloquea | Copiar la service_role local de `services/.env` al `.env` raíz |
| El dueño solo ve su propia fila | `es_dueno()` con la `ñ` corrompida (`'due??o'`) | Reaplicar `fix_rls_recursion_usuarios.sql`; el regex `'^due.o$'` es a prueba de encoding |
| `Cannot find module 'dotenv'` al arrancar | `backend-node` sin dependencias instaladas | `cd backend-node && npm install` |
| La wallet del móvil revienta al abrirla | `movimientos_wallet.id` es BIGINT (número) y la app lo trataba como string | Ya corregido en `MovimientoItem.tsx` con `String(mov.id)` |
| El saldo no se actualiza solo en el móvil | `movimientos_wallet` fuera de la publicación `supabase_realtime` | `ALTER PUBLICATION supabase_realtime ADD TABLE public.movimientos_wallet` |

---

## 10. Pendientes conocidos

- ~~**Dueño sin cuenta en Auth.**~~ Resuelto: `dueno@coffeefaster.cl` ya está
  creada en Auth y vinculada con `rol_id = 6` (`dueño`) en la nube, y con
  `rol_id = 3` en la local. Entra en producción igual que en desarrollo.
- ~~**Acentos rotos al aplicar SQL por consola.**~~ Resuelto: `es_dueno()`
  compara con el regex ASCII `'^due.o$'`, así que ya no depende del encoding con
  que el archivo llegue a la base.
- **Recarga sin pasarela.** `recargar_saldo` suma saldo de verdad, pero no hay
  cobro detrás: es una recarga simulada con topes. Integrar la pasarela es el
  paso pendiente antes de producción.
- **Emulator / teléfono físico.** El flujo completo con QR real se validó contra
  la API local y el backend; falta confirmarlo escaneando con el lector del
  escritorio en un dispositivo físico.
- **Clave FCM.** Hay que rotarla antes de desplegar: la que está en el repo
  corresponde al trabajo paralelo de notificaciones y se coordina aparte.
- **Backfill de pedidos antiguos.** 5 pedidos históricos no tienen
  `franja_retiro`. No se tocan para no alterar datos de prueba del equipo, pero
  conviene decidir si se rellenan o se descartan.
- **`npx tsc --noEmit` en `app-mobile`** falla por errores preexistentes en
  `__tests__/App.test.tsx` (faltan `react-test-renderer` y los tipos del test
  runner). No está relacionado con este flujo.
