# D.4 — Validación QR y entrega de pedido (traspaso a Base de Datos)

> **Documento de traspaso.** La base de datos y Supabase son responsabilidad de
> otro integrante del equipo. Este documento describe **cómo es hoy** el flujo QR
> (lo verificado en el repositorio) y **qué debe revisar/confirmar** el responsable
> de Base de Datos antes de que implementemos el flujo definitivo.
>
> ### Estado: ANÁLISIS / PENDIENTE DE VALIDACIÓN E IMPLEMENTACIÓN EN SUPABASE
>
> - **NO se ha ejecutado ningún SQL** contra Supabase (ni remoto ni local).
> - **NO hay cambios aplicados** en la base de datos.
> - **NO se crearon** funciones, tablas, policies ni triggers.
> - Ningún SQL de este documento ha sido aplicado automáticamente.
> - Este documento es **análisis y contrato a confirmar**, no una migración.
> - El lado Node/Express (`ms-pedidos`) **todavía NO está implementado** para D.4.

---

## 1. Objetivo y alcance

Definir el flujo definitivo de **entrega de pedido por validación de QR**, de modo
que la transición `listo → entregado` sea producida **únicamente** por un endpoint
dedicado, ejecutado por un **empleado autorizado** de la cafetería del pedido.

Alcance de este documento:

- Flujo de negocio objetivo.
- Cómo se autoriza al empleado (mecanismo ya usado por D.3).
- Credenciales QR encontradas en el repositorio (estado actual).
- El problema de la RPC `log_qr_validation` (no versionada).
- Operación atómica objetivo y concurrencia.
- Discrepancias en `logs_validacion_qr`.
- Consultas **READ-ONLY** para que el responsable de BD confirme el esquema real.
- Checklist de información que necesitamos de vuelta.
- Responsabilidades por rol.
- Deudas relacionadas que **NO** se corrigen en esta etapa.

Fuera de alcance: implementación en Node, cambios de UI (Mobile/Desktop),
Orquestador, inventario, y **toda** operación de escritura en Supabase.

---

## 2. Objetivo de negocio (flujo objetivo)

```
pedido pagado
    → pendiente
    → en_preparacion
    → listo
    → empleado escanea QR
    → validar credencial
    → entregado
```

Reglas:

- La transición **`listo → entregado`** **NO** puede realizarse mediante el
  `PATCH` genérico de estado. D.3 ya reserva esa transición exclusivamente para el
  flujo QR (el `PATCH` responde `409` con el mensaje
  *"La entrega del pedido requiere validacion QR"*).
- `entregado` es un **estado terminal**.
- La máquina de estados de dominio (`pedidos.maquina-estados.js`) **ya contempla**
  `listo → entregado`; lo que falta es el camino autorizado que la produzca.
- La credencial (QR) es de **un solo uso** y su consumo debe ser **atómico**.

---

## 3. Autorización del empleado

El endpoint de validación (en `ms-pedidos`) utilizará el **mismo mecanismo ya
implementado en D.3** para el KDS:

```
JWT (Bearer)
  → Supabase Auth.getUser()
  → usuarios.auth_user_id
  → usuario interno (usuarios.id, usuarios.rol_id)
  → rol_id = 2 (empleado)
  → cafeteria_usuarios (pertenencia)
  → pedido.cafeteria_id
```

Regla objetivo:

> **Solo un empleado** (`rol_id = 2`) **que pertenezca a la cafetería del pedido**
> (`cafeteria_usuarios`) puede iniciar la validación de entrega.

La cafetería autoritativa es **`pedido.cafeteria_id`**, no un valor enviado por el
cliente.

**La base de datos NO debe confiar en valores enviados por el cliente:**

- `usuario_id` enviado por el cliente → **ignorar**;
- `cafeteria_id` enviado por el cliente → **ignorar**;
- `rol` enviado por el cliente → **ignorar**.

La identidad y el rol se resuelven **siempre** desde la sesión JWT y desde la BD.
Si la entrega se implementa como RPC `SECURITY DEFINER`, la autorización de negocio
del empleado puede quedar **en `ms-pedidos` (Node)** antes de invocar la RPC, o
**dentro** de la RPC si ésta resuelve la sesión. **Punto a decidir con el
responsable de BD** (ver secciones 6 y 10).

> Nota: `ms-pedidos` opera con cliente **server-side** (`service_role`), que
> **bypasea RLS**. Por eso la autorización de negocio se hace en Node. Si la RPC
> resuelve la identidad por sí misma, deberá hacerlo con una función de sesión
> (p. ej. `get_current_user_id()` / `mi_usuario_id()`), **hoy no versionadas**.

---

## 4. Credenciales encontradas

Credenciales vigentes en el repositorio:

| Credencial | Origen versionado | Notas |
| --- | --- | --- |
| `qr_token` | `app-mobile/tabla_mobile/rpc_qr.sql` (`procesar_pago`) | `gen_random_uuid()` |
| `codigo_retiro_diario` | `rpc_qr.sql` (`procesar_pago`) | `'CF-' \|\| lpad(id, 4, '0')` |

Estado actual conocido (**HECHO VERIFICADO EN REPO**):

- `rpc_qr.sql` genera `qr_token` con `gen_random_uuid()` y
  `codigo_retiro_diario` como `'CF-' || lpad(<id>, 4, '0')`, dentro de la
  transacción de pago `procesar_pago`.
- El `backend-node` legacy genera **formatos distintos**: `qr_token = 'CF-' + 20`
  caracteres y `codigo_retiro_diario` = token de 8 caracteres (app móvil/desktop
  legacy).
- La documentación de D.2.1 menciona un **trigger real**
  (`trg_pedidos_codigo` BEFORE INSERT, *"genera códigos"*) que **no está
  versionado** en el repositorio.

**NO se decide todavía un nuevo formato.** El responsable de BD debe **confirmar
cuál es la autoridad real** que genera y escribe estas columnas en la base
desplegada (RPC, trigger, o ambos).

Distinción importante:

- **Credencial QR** = `qr_token` / `codigo_retiro_diario` (lo que se valida).
- **Imagen QR** = representación visual; hoy la genera `backend-node` con `qrcode`
  (base64) o el Mobile localmente. **La imagen no es la credencial.**

> **`qr_expira_en`:** NO se encontró ninguna referencia en el repositorio
> (ni columna, ni chequeo). Está **por confirmar** si existe en la BD real.

---

## 5. Problema: RPC `log_qr_validation` (no versionada)

Actualmente, el endpoint `POST /api/pedidos/validar-qr` de `ms-pedidos` **delega
toda la lógica** en una RPC:

```js
// Microservices/ms-pedidos/src/modules/pedidos/pedidos.service.js:478
const { data, error } = await supabase.obtenerCliente()
  .rpc('log_qr_validation', { p_qr_token: body?.qr_token });
```

Pero **su definición NO está versionada** en el repositorio: es la **única**
aparición de `log_qr_validation` en todo el repo, y **no existe**
`CREATE FUNCTION` / `CREATE OR REPLACE FUNCTION public.log_qr_validation` en ningún
`.sql`, `.js`, `.ts` o `.md`.

**Necesitamos determinar (NO asumir comportamiento):**

- [ ] ¿Existe `public.log_qr_validation` actualmente en Supabase?
- [ ] ¿Cuáles son sus **parámetros** reales (¿solo `p_qr_token`? ¿más?)?
- [ ] ¿Es `SECURITY DEFINER` o `SECURITY INVOKER`?
- [ ] ¿Qué **tablas** toca (lee/escribe)?
- [ ] ¿**Valida el estado** del pedido (exige `listo`)?
- [ ] ¿**Valida `qr_usado`** (un solo uso)?
- [ ] ¿**Marca el pedido como `entregado`**? ¿O solo registra un log?
- [ ] ¿Actualiza **`entregado_en`**?
- [ ] ¿Registra **auditoría** en `logs_validacion_qr`?
- [ ] ¿Qué **devuelve** exactamente (estructura/campos)?
- [ ] ¿Cómo maneja errores/rechazos?

> **No confundir** `log_qr_validation` (RPC, comportamiento desconocido) con la
> tabla `public.logs_validacion_qr` (versionada) ni con la función
> `registrarLogValidacion` del `backend-node` legacy (que inserta directo en esa
> tabla). Son **tres** mecanismos distintos.

**Riesgo:** hasta no conocer su definición, no se puede afirmar que el
`validar-qr` actual entrega de forma segura ni que respeta rol/cafetería.

---

## 6. Operación atómica objetivo

La **entrega definitiva debe ser atómica**. Conceptual­mente debe cumplir, **en una
sola transacción**:

1. Localizar el pedido por `qr_token` **o** `codigo_retiro_diario`.
2. **Garantizar exclusión concurrente** (bloqueo de fila o `UPDATE` condicional).
3. Verificar que **`estado = 'listo'`**.
4. Verificar que **`qr_usado = false`**.
5. Validar la **autorización** necesaria (empleado + cafetería; ver sección 3).
6. `estado = 'entregado'`.
7. `qr_usado = true`.
8. `entregado_en = CURRENT_TIMESTAMP`.
9. Registrar **auditoría** (resultado aprobado/rechazado + motivo).
10. Devolver el **resultado**.

> **IMPORTANTE:** la implementación concreta de la transacción/RPC corresponde al
> **responsable de BD**. **No se afirma** que deba llamarse `validar_entrega`
> hasta revisar la `log_qr_validation` existente. Si `log_qr_validation` **ya** es
> la autoridad de entrega, podría **extenderse/reutilizarse** en lugar de crear una
> nueva función. **Decisión del responsable de BD.**

---

## 7. Concurrencia

**Problema:** dos empleados podrían escanear **simultáneamente** el mismo QR. Sin
protección, ambos podrían leer `estado = 'listo'` y ambos "entregar", produciendo
**doble entrega**.

La solución de BD debe garantizar que **solo una** validación pueda **consumir** la
credencial. Alternativas **conceptuales** (a decidir y ejecutar por el responsable
de BD; aquí **NO** se ejecuta ni se impone SQL definitivo):

- **Bloqueo explícito:** `SELECT ... FOR UPDATE` sobre la fila del pedido antes de
  evaluar `estado`/`qr_usado`.
- **`UPDATE` condicional equivalente:** actualizar solo si
  `estado = 'listo' AND qr_usado = false` y comprobar el número de filas afectadas
  (la segunda petición afecta 0 filas → rechazo idempotente).

En ambos casos, la segunda petición concurrente debe recibir un **rechazo**
(`conflicto` / *ya entregado*) y **NO** debe volver a marcar ni loguear como éxito.

---

## 8. Logs: `logs_validacion_qr`

**Discrepancia encontrada (HECHO VERIFICADO EN REPO):**

El SQL **versionado** (`database/fixes/crear_logs_validacion_qr.sql`) define:

```
id
pedido_id
cafeteria_id
usuario_id
qr_token
resultado
detalle
validado_en
```

Pero el **código legacy y el Desktop** referencian **columnas adicionales** que
**no están** en ese SQL versionado:

```
qr_token_leido
motivo_rechazo
creado_en
```

El responsable de BD debe **confirmar el esquema REAL** de `logs_validacion_qr`.

Además, debe **aclararse semánticamente**:

> El campo `usuario_id` del log debe representar al **empleado que realizó la
> validación**, **no** al estudiante dueño del pedido. Hoy el `backend-node` legacy
> guarda el `usuario_id` del **estudiante**.

**NO modificar la tabla en esta etapa.** Solo se documenta para confirmación.

---

## 9. Consultas READ-ONLY para el responsable de BD

> **Solo lectura.** Ninguna de estas consultas modifica datos. **NO** se han
> ejecutado desde este equipo. El responsable de BD puede ejecutarlas para
> confirmar el estado real.

### A) Columnas QR reales de `pedidos`

```sql
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'pedidos'
  AND column_name IN (
    'qr_token', 'qr_usado', 'qr_expira_en', 'codigo_retiro_diario',
    'entregado_en', 'listo_en', 'inicio_preparacion_en', 'cancelado_en',
    'completado_en', 'estado', 'cafeteria_id', 'usuario_id'
  )
ORDER BY column_name;
```

### B) Definición real de funciones

```sql
SELECT p.proname,
       pg_get_function_identity_arguments(p.oid) AS argumentos,
       p.prosecdef AS security_definer,
       pg_get_functiondef(p.oid) AS definicion
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'log_qr_validation',
    'generar_token_retiro',
    'get_current_user_id',
    'mi_usuario_id',
    'procesar_pago',
    'cancelar_pedido'
  )
ORDER BY p.proname;
```

### C) Columnas reales de `logs_validacion_qr`

```sql
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'logs_validacion_qr'
ORDER BY ordinal_position;
```

### D) Triggers reales de `pedidos`

```sql
SELECT t.tgname,
       pg_get_triggerdef(t.oid) AS definicion
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname = 'pedidos'
  AND NOT t.tgisinternal
ORDER BY t.tgname;
```

### E) Policies RLS de `pedidos` y `logs_validacion_qr`

```sql
SELECT tablename, policyname, cmd,
       qual::text        AS using_expression,
       with_check::text  AS check_expression
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('pedidos', 'logs_validacion_qr')
ORDER BY tablename, policyname;
```

### F) Estado de RLS

```sql
SELECT relname, relrowsecurity, relforcerowsecurity
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND relname IN ('pedidos', 'logs_validacion_qr', 'usuarios', 'cafeteria_usuarios')
ORDER BY relname;
```

---

## 10. Checklist: información que debe devolver el responsable de BD

- [ ] Columnas QR reales de `pedidos` (A).
- [ ] Definición de `log_qr_validation` (B) — existe / no existe, y su cuerpo.
- [ ] Definición de funciones relacionadas (B): `generar_token_retiro`,
      `get_current_user_id`, `mi_usuario_id`, `procesar_pago`, `cancelar_pedido`.
- [ ] Columnas reales de `logs_validacion_qr` (C).
- [ ] Triggers reales de `pedidos` (D) — especialmente `trg_pedidos_codigo`.
- [ ] Policies RLS de `pedidos` y `logs_validacion_qr` (E).
- [ ] Estado RLS de `pedidos`, `logs_validacion_qr`, `usuarios`,
      `cafeteria_usuarios` (F).
- [ ] Confirmar el **formato real** de `qr_token` (¿UUID? ¿`CF-`+20? ¿otro?).
- [ ] Confirmar la **generación de `codigo_retiro_diario`** (¿RPC? ¿trigger? ¿formato?).
- [ ] Confirmar si existe **`qr_expira_en`** (y si hay expiración de credencial).
- [ ] Confirmar **qué función/RPC** debe ser la **autoridad de entrega**
      (`log_qr_validation` extendida vs. una nueva).
- [ ] Confirmar si la **autorización del empleado** se resuelve en Node o en la RPC.

---

## 11. Responsabilidades

### `ms-pedidos` / nuestro equipo

- **Autenticación HTTP** (JWT, `auth.exigirAuth`).
- **Normalización de la credencial** (aceptar texto plano o JSON del QR; extraer
  `qr_token` / `codigo_retiro_diario`).
- **Validación inicial** de entrada (presente/no vacío → 400).
- **Autorización de negocio**: empleado (`rol_id = 2`) + `cafeteria_usuarios`
  contra `pedido.cafeteria_id` (mecanismo D.3).
- **Invocar** la RPC/función de entrega (la que defina BD).
- **Mapear errores** a HTTP (400/401/403/404/409/503).
- **Tests** (feliz + roles + cafetería + estados + concurrencia + idempotencia).

### Base de Datos

- **Confirmar el esquema real** (secciones 4, 5, 8, 9).
- **Definir/versionar** la RPC transaccional de entrega (autoridad de entrega).
- **Garantizar la concurrencia** (sección 7): exclusión de doble consumo.
- **Actualización atómica** de `estado`, `qr_usado`, `entregado_en`.
- **Auditoría** coherente (`logs_validacion_qr`, `usuario_id` = empleado).
- **RLS / policies** de `pedidos` y `logs_validacion_qr`.
- **Triggers** de generación de códigos.
- **Funciones SQL** (`get_current_user_id`, `mi_usuario_id`, etc.): versionarlas.

### Mobile

- **Mostrar** el QR (credencial) al estudiante.
- (Posterior) alinear el contrato de imagen con el endpoint definitivo.

### Desktop

- **Escanear** el QR.
- (Posterior) **migrar al contrato definitivo** y dejar de hacer `UPDATE` directo a
  Supabase.

---

## 12. Deudas relacionadas (documentadas, NO se corrigen en D.4-B)

> Estas deudas fueron halladas en la auditoría D.4-A. Se documentan aquí **sin
> corregirlas**.

- **`GET /:id/qr` (ms-pedidos)** expone `qr_token` **sin autorización de negocio**
  (cualquier usuario autenticado, de cualquier estado).
- **`GET /:id/token-contingencia` (ms-pedidos)** devuelve actualmente el literal
  `'token-contingencia'` (el `SELECT` no incluye `qr_token`, por lo que el valor
  siempre es el fallback). **Bug verificado.**
- **Desktop** usa el contrato `{ token }` mientras **ms-pedidos espera**
  `{ qr_token }`.
- **Desktop** todavía puede hacer **fallback directo a Supabase**
  (`estado = 'entregado'` + `entregado_en`, sin `qr_usado`).
- **Mobile** espera un **contrato de imagen QR** distinto (`{success, data:{qr_image}}`)
  que el que hoy devuelve ms-pedidos.
- **Gateway:** `/api/pedidos/*` se enruta a **ms-pedidos**, pero Desktop apunta a
  **backend-node** → contratos e implementaciones inconsistentes.

---

## 13. Validación final de esta etapa

Al terminar D.4-B, la verificación esperada es:

```bash
git status          # working tree limpio salvo el nuevo .md
git diff --stat     # debe listar SOLO docs/base-datos/D4_validacion_qr_entrega.md
```

> Los archivos de **D.3** ya fueron commiteados y pusheados antes de esta etapa
> (`19ccb44 [REFACTOR]: Restringir cambios de estado según rol y cafetería`,
> working tree limpio). Si aparecen `pedidos.service.js` o `pedidos.test.js`
> modificados, **detenerse y reportarlo**.

---

## Anexo — Referencias en el repositorio (auditoría D.4-A)

| Archivo | Rol |
| --- | --- |
| `Microservices/ms-pedidos/src/modules/pedidos/pedidos.service.js` | `validarQr`, `obtenerQr`, `obtenerTokenContingencia`; autorización KDS D.3. |
| `Microservices/ms-pedidos/src/modules/pedidos/pedidos.routes.js` | Rutas QR (`/:id/qr`, `/:id/token-contingencia`, `/validar-qr`). |
| `Microservices/ms-pedidos/src/modules/pedidos/pedidos.maquina-estados.js` | Máquina canónica (`listo → entregado` existe). |
| `app-mobile/tabla_mobile/rpc_qr.sql` | `procesar_pago` genera `qr_token` (UUID) y `codigo_retiro_diario`. |
| `database/fixes/crear_logs_validacion_qr.sql` | Tabla `logs_validacion_qr` (esquema versionado). |
| `database/fixes/politica_logs_auditoria_por_usuario.sql` | `mi_usuario_id()` / `mi_wallet_id()` / `es_dueno()`. |
| `backend-node/src/modules/pedidos/pedidos.service.js` | `validarEntrega` legacy (referencia histórica; no copiar ciego). |
| `app-desktop/src/services/pedidosService.js` | Fallback directo a Supabase (a migrar). |
| `k8s-next/gateway/nginx.conf` | `/api/pedidos` → `ms-pedidos:3005`. |
