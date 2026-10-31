# S2-T16 — Dependencias SQL del flujo de pedidos

Auditoría local: 31-10-2026. Rama: `S2-T16-Camilodg-Inventariar_dependencias_SQ_Ldel_flujo_de_pedidos`.
Base inspeccionada: `72f534de2ca42537831588bbd50a69d7938f3513`. No se consultó Supabase.

## A. Resumen y alcance

**No se puede reconstruir el flujo completo en una Supabase vacía usando solamente este repositorio.** Hay cuerpos SQL de pago y cancelación, pero faltan tablas base, un helper de identidad y la RPC de validación QR. La existencia o versión desplegada de estos objetos no se demuestra con esta auditoría.

Se parte de `Microservices/ms-pedidos`, incluyendo `shared` y la cotización de `ms-menus`. No se mezcla la implementación legacy de `backend-node` con este flujo.

| Categoría | Cantidad y alcance |
|---|---|
| Tablas del núcleo | 9 tablas consumidas directamente por Node/SQL disponible; más 1 soporte referencial: cafeterias. Roles pertenece al helper auxiliar es_dueno; logs_validacion_qr es candidata QR, sin consumo demostrado por la RPC ausente |
| Tablas auxiliares | 3: roles, logs_auditoria y anuncios_pedido; más 1 candidata QR: logs_validacion_qr. Total inventariado: 14 tablas públicas, más auth.users de plataforma |
| RPC del núcleo | 3: 2 con cuerpo SQL versionado y 1 externa |
| Helpers de aplicación SQL | 2 principales: mi_usuario_id y get_current_user_id; 2 auxiliares: mi_wallet_id y es_dueno; más 1 referido documentalmente: mis_cafeterias_ids. Total 5 nombres: 3 con cuerpo versionado; los otros 2 sin definición, con consumo actual indeterminado para mis_cafeterias_ids |
| Triggers vinculados documentalmente | 3: `on_auth_user_created`, `trg_pedidos_codigo`, `handle_wallet_updated_at` (nombre descrito como trigger en documentación; identidad exacta indeterminada). Ninguno tiene definición completa reproducible |
| Policies con CREATE en archivos SQL | 4: 2 QR, 1 historial, 1 avisos; ninguna constituye por sí sola las policies de las tablas base |
| Otros grupos | 1 publicación Realtime referenciada; 1 secuencia implícita de identidad y 4 constraints explícitas de logs QR; primitivas de plataforma. Anuncios agrega otra identidad, PK, UNIQUE, 3 FK y 1 índice |

Las cantidades son del alcance descrito, no del catálogo remoto. `on_auth_user_deleted` y `borrar_usuario_al_eliminar` aparecen como propuesta documental, no como requisito del flujo ni despliegue confirmado. No se identificaron enums, vistas ni secuencias explícitas definidas para el núcleo.

Convención de evidencia: `S` = `Microservices/ms-pedidos/src/modules/pedidos/pedidos.service.js`; `R` = `pedidos.routes.js` en esa misma carpeta; `C` = `pedidos.controller.js`; `P` = `app-mobile/tabla_mobile/rpc_qr.sql`; `X` = `app-mobile/tabla_mobile/rpc_cancelar_pedido.sql`; `H` = `database/fixes/politica_logs_auditoria_por_usuario.sql`; `Q` = `database/fixes/crear_logs_validacion_qr.sql`. Los números son líneas de los archivos inspeccionados.

## B. Tablas y operaciones reales

`EXTERNA` significa definición de tabla no encontrada; un seed, ALTER o consulta no define el esquema. `PARCIAL` indica fragmentos DDL insuficientes. Una tabla VERSIONADA puede tener dependencias externas.

| Tabla | Operaciones | Flujo y finalidad | Evidencia | Definición / clasificación |
|---|---|---|---|---|
| `usuarios` | SELECT | Identidad interna, rol, propiedad, contingencia | S:227,453,708; H:46 | Sin CREATE TABLE; seed/ALTER RLS no bastan: EXTERNA |
| `cafeteria_usuarios` | SELECT | Pertenencia del operador a cafetería; consultas, KDS, contingencia | S:486,506,718 | Sin DDL: EXTERNA |
| `productos` | SELECT | Precios reales, activo y borrado lógico | P:77; `Microservices/ms-menus/src/modules/menus/menus.service.js`:169 | Sin CREATE TABLE; seed no basta: EXTERNA |
| `wallets` | SELECT FOR UPDATE, UPDATE | Consultar, bloquear, descontar o devolver saldo | P:114,139; X:106,122 | EXTERNA |
| `pedidos` | INSERT, SELECT, SELECT FOR UPDATE, UPDATE | Alta, QR persistido, lecturas, estado KDS, cancelación | P:144,158; X:65,137; S:316,355,399,428,582,633,672,703 | EXTERNA |
| `detalles_pedido` | INSERT | Cantidad, precio unitario y subtotal por producto | P:163 | EXTERNA |
| `metodos_pago` | SELECT | Resolver id con `codigo='WALLET'` | P:174 | EXTERNA |
| `pagos` | INSERT | Registrar monto aprobado, referencia y método | P:177 | Sin CREATE TABLE; ALTER RLS no basta: EXTERNA |
| `movimientos_wallet` | INSERT | Ledger negativo de compra y positivo de reembolso | P:185; X:128 | EXTERNA |
| `cafeterias` | Referencia FK; id enviado a RPC | Contexto del pedido y FK de logs; no SELECT directo en el núcleo | S:218,267,282; Q:20 | PARCIAL: solo ALTER `direccion`/`rut` en `database/fixes/agregar_direccion_rut_cafeterias.sql`:13 |
| `roles` (auxiliar) | SELECT auxiliar; valores de rol en Node | Autorización por `usuarios.rol_id`; helper `es_dueno` | H:66; S:440,441 | EXTERNA; seed de nombres no asegura ids 1/2/3 |
| `logs_validacion_qr` (candidata QR) | INSERT esperado, SELECT de auditoría; no demostrados dentro de RPC | Registro de validación | Q:17; S:738 solo llama RPC | VERSIONADA como objeto; no prueba que `log_qr_validation` la escriba |
| `logs_auditoria` (auxiliar) | SELECT por policy | Historial de perfil, no escritura probada por pago | H:92,111 | PARCIAL: RLS/policy, sin CREATE TABLE |
| `anuncios_pedido` (auxiliar) | Sin operación desde ms-pedidos; soporte voz KDS | Avisos posteriores al pedido | `database/fixes/crear_anuncios_pedido.sql`:24 | VERSIONADA como objeto, FK externas |
| `auth.users` (plataforma) | Auth API; trigger de alta citado | Cuenta Supabase y UUID enlazado por `usuarios.auth_user_id` | `Microservices/shared/src/auth.js`:88,140; `docs/pruebas_flujo_catalogo.md`:99 | EXTERNA administrada por plataforma; no DDL local |

No hay DELETE/UPSERT productivo en estos cinco flujos. No se descuenta ni repone stock: S:249 deja explícito que inventario salió del stack. `categorias` aparece en fixes/seed, pero no es consultada por este camino; sus posibles FK base no están disponibles y no se inventan.

## C. RPC

| RPC | Llamada / parámetros | Flujo y finalidad | Definición SQL | Estado |
|---|---|---|---|---|
| `procesar_pago` | S:281; `p_cafeteria_id`, `p_items`, `p_franja_retiro` | Pago + pedido + detalles + QR + ledger | P:21; `(BIGINT, JSONB, TEXT DEFAULT NULL) RETURNS JSONB` | VERSIONADA (cuerpo y permisos); cierre transitivo incompleto |
| `cancelar_pedido` | S:168; `p_pedido_id` | Cancelar y devolver total | X:33; `(BIGINT) RETURNS JSONB` | VERSIONADA (cuerpo y permisos); tablas base externas |
| `log_qr_validation` | S:738; `p_qr_token: body?.qr_token` | Validación delegada; resultado retornado sin reinterpretación | No encontrada | EXTERNA / NO ENCONTRADA; existencia remota indeterminada |

Búsqueda global `.rpc(`: además aparece `recargar_saldo` en `app-mobile/src/screens/WalletScreen.tsx`:307. Es recarga de wallet fuera del flujo auditado, no una cuarta RPC de ms-pedidos; tampoco se encontró su CREATE FUNCTION. Los resultados en documentación son referencias, no llamadas ejecutables.

Clasificar las dos primeras como VERSIONADAS describe sus definiciones, **no** significa que toda su cadena pueda instalarse ni que sean las versiones efectivamente desplegadas.

## D. Helpers, constraints y demás objetos

| Objeto | Tipo / utilizado por | Definición | Estado |
|---|---|---|---|
| `mi_usuario_id()` | Helper SQL, cancelación e historial | H:39; SELECT `usuarios.id WHERE auth_user_id=auth.uid()` | VERSIONADA; depende de usuarios y Auth |
| `mis_cafeterias_ids()` | Helper referido por policy staff en D2.1:355,358,376 | Sin CREATE FUNCTION | EXTERNA como definición; consumo actual INDETERMINADO |
| `get_current_user_id()` | Helper de identidad de pago | P:49 lo llama; no CREATE encontrado | EXTERNA; no sustituirlo por `mi_usuario_id` por semejanza |
| `mi_wallet_id()` | Helper auxiliar wallet | H:74; JOIN wallets/usuarios/Auth | VERSIONADA, no invocada por P actual pese al comentario H:72 |
| `es_dueno()` | Helper auxiliar de policy historial | H:56; JOIN usuarios/roles | VERSIONADA; no autoriza cancelación |
| `auth.uid()` | Función de plataforma para JWT | H:47, X la usa vía helper | EXTERNA de Supabase; no helper propio faltante |
| `gen_random_uuid()` | Primitiva PostgreSQL usada al generar QR | P:154 | Plataforma; disponibilidad/versiones no fijadas aquí; no se infiere obligación de instalar pgcrypto |
| JSONB, round, trunc, lower, lpad, CURRENT_TIMESTAMP | Primitivas SQL/PLpgSQL | P y X | Plataforma; no funciones propias por versionar |
| PK identidad de logs QR, FK a pedidos/cafeterias/usuarios | Constraints, secuencia implícita | Q:18-21 | VERSIONADAS; destino FK externo; nombre físico de secuencia no fijado explícitamente |
| PK identidad, UNIQUE pedido, 3 FK, índice cafetería/fecha de anuncios | Objetos auxiliares KDS | `database/fixes/crear_anuncios_pedido.sql`:25-29,53 | VERSIONADOS; tablas destino externas |
| Defaults/PK/FK/índices/uniqueness de tablas base | Requeridos para ids, integridad y contratos | INSERT omite ids en P:144,163,177,185 | EXTERNOS / diseño exacto INDETERMINADO; no asumir serial, UUID o nombres de constraints |
| `supabase_realtime` | Publicación existente, ADD TABLE pedidos | `database/fixes/habilitar_realtime.sql`:12 | PARCIAL: membership versionada, publicación/plataforma externa; soporte de UI, no requisito de transacción HTTP |
| `trg_pedidos_codigo` | Trigger de códigos descrito en D4 | `docs/base-datos/D4_validacion_qr_entrega.md`:127 | INDETERMINADO: referencia documental, sin CREATE ni función destino |
| `handle_wallet_updated_at` | Trigger/helper de timestamp descrito en D2.1 | `docs/base-datos/D2.1_cancelacion_reembolso.md`:143 | INDETERMINADO; falta definición, nombre del trigger/función inequívoco |
| `on_auth_user_created` → `handle_new_auth_user()` | Trigger de aprovisionamiento de usuario/wallet | `docs/pruebas_flujo_catalogo.md`:99 contiene CREATE TRIGGER, pero no cuerpo de función | PARCIAL; no reproducible integralmente |
| `on_auth_user_deleted` → `borrar_usuario_al_eliminar()` | Propuesta de limpieza, fuera del flujo | Mismo documento:115,125, bajo “Corrección propuesta (no aplicada)” | Fragmento SQL versionado documentalmente; NO evidencia de objeto usado/desplegado |

### Policies y permisos

| Objeto | Evidencia | Estado y alcance |
|---|---|---|
| `logs_validacion_qr_insert_empleado` | Q:40 | VERSIONADA: WITH CHECK rol 2/3; no comprueba pertenencia a cafetería |
| `logs_validacion_qr_select_dueno` | Q:54 | VERSIONADA: SELECT rol 3 |
| `logs_auditoria_select_dueno` | H:111 | VERSIONADA: dueño o id interno/UUID propio; tabla externa |
| `anuncios_pedido_select_empleado` | `database/fixes/crear_anuncios_pedido.sql`:76 | VERSIONADA: rol 2, sin restricción por cafetería |
| `pedidos_update_cancelar_own` | X:170 DROP POLICY | PARCIAL: solo eliminación; no definición positiva; RPC reemplaza cancelación directa |
| `pedidos_update_staff` | X:165; D2.1:355,358,376 | PARCIAL documental: expresiones USING/WITH CHECK sin CREATE POLICY; vigencia remota INDETERMINADA |
| Policies de usuarios/pagos y demás tablas base | `database/fixes/bloquear_anon_sensibles.sql`:19-31 elimina policies por nombre | PARCIAL para configuración RLS; no hay conjunto reproducible que habilite todo el flujo |
| EXECUTE de pago/cancelación | P:207-208; X:154-155 | VERSIONADO: REVOKE PUBLIC y GRANT authenticated; rol lo provee Supabase |
| GRANT/REVOKE tablas QR/anuncios | Q:32-36; script anuncios:48-57 | VERSIONADOS, no permisos completos de tablas base |

**Conflicto real entre scripts:** `fix_rls_recursion.sql`:22-31 deshabilita RLS en diez tablas; `bloquear_anon_sensibles.sql`:34-36 la habilita en usuarios/pagos/logs QR y elimina sus policies; Q vuelve a crear dos policies QR. El resultado depende del orden manual y no hay migración canónica. Aplicar el bloqueo de usuarios sin policy alternativa impediría el SELECT autenticado de creación (S:227). No se propone aplicar ninguno.

El cliente compartido prioriza `SUPABASE_SERVICE_KEY`, después publishable/key/anon (`Microservices/shared/src/supabase.js`:25-29). Por ello el uso efectivo o bypass de RLS depende del entorno; no se afirma que todas las llamadas tengan service_role. Creación, listado general y cancelación crean cliente con JWT del usuario; otras lecturas/KDS/validar QR usan compartido. En validación, `getUser(token)` valida la sesión HTTP pero **no instala ese JWT en el cliente compartido de la RPC**.

## E. Trazabilidad de los cinco flujos

Prefijo HTTP `/api/pedidos`: `Microservices/ms-pedidos/src/app.js`:25. Todas las rutas de negocio ejecutan `auth.exigirAuth` (R:22-30) → `shared/src/auth.js`:74 → `auth.getUser(token)` → `req.user`/`req.accessToken`. Eso usa Auth API, no una RPC de aplicación.

### Creación

`POST /api/pedidos` → R:22 → C:6 → S:`crearPedido` (208) → cliente con JWT → SELECT usuarios → HTTP `POST http://ms-menus:3003/api/menus/precios` → controller/service de menús → SELECT productos → validar que todos pertenecen a la cafetería → RPC `procesar_pago` → pedido/detalles/pago/movimiento/QR → HTTP 201 `{ok:true,pedido:rpcData}`.

Node exige items, cafetería entera positiva y franja no vacía; ms-menus valida ids/cantidades, máximo 100 items y 999 unidades/item. No crea pedido por INSERT directo. SQL devuelve errores de negocio con `ok:false`; S:286-292 solo revisa `rpcError` y no inspecciona `rpcData.ok`, por lo que puede envolver una denegación como HTTP 201 con `ok:true` exterior. Hallazgo documentado, sin corregir.

### Pago

Mismo POST; no hay endpoint de pago independiente. Node cotiza/valida cafetería, pero SQL es autoridad monetaria:

1. P:49 llama a `get_current_user_id()` (ausente).
2. P:65-111 recorre items, lee precio de productos activos/no eliminados, calcula precio×cantidad, redondea cada subtotal a INTEGER y suma; rechaza faltantes/total no positivo.
3. P:114-142 bloquea wallet FOR UPDATE, comprueba saldo suficiente y descuenta.
4. P:144 crea pedido `pendiente`, `pago_estado='pagado'`, método textual `wallet`.
5. P:154-161 genera UUID y código `CF-` usando lpad(id::TEXT,4, caracteres cero): ancho exacto cuatro, que trunca ids más largos; los persiste en pedidos.
6. P:163 inserta detalles; P:174 resuelve método `WALLET`; P:177 inserta pago `aprobado`, no simulado; P:185 registra movimiento `compra` negativo.
7. Devuelve ids, total, saldo, estado, franja y credenciales QR. La invocación participa en la transacción de la llamada, sin COMMIT independiente; un error SQL no capturado revierte sus escrituras.

La RPC no repite la validación de pertenencia del producto a cafetería que hace Node. El seed no proporciona el método WALLET ni wallet financiada/autenticación completa. No se supone validación de stock ni pasarela externa.

### Cancelación

`PATCH /api/pedidos/:id/estado` con estado normalizado cancelado → R:27 → C:55 → S:555,574 → `cancelarPedido` → cliente JWT → X:`cancelar_pedido`.

X resuelve usuario con `mi_usuario_id`, bloquea pedido, exige propietario (no valida explícitamente rol estudiante en SQL), solo admite pendiente o legacy pagado, valida total positivo/entero, bloquea wallet, comprueba overflow y devuelve saldo. Cambia `pedidos.estado='cancelado'`, `cancelado_en=CURRENT_TIMESTAMP`. Node mapea motivos a 403/404/409/422/503. No hace UPDATE directo para cancelar; no cambia `pagos.estado`, `pago_estado`, stock o QR. El comentario “estudiante” describe uso previsto; la condición SQL es propiedad, no rol.

### Reembolso

Es parte inseparable de la cancelación; no existe endpoint/RPC separada de reembolso en ms-pedidos. X:93 toma `pedidos.total` original, no recalcula precios. X:122 acredita wallet, X:128 inserta movimiento positivo `reembolso`, X:137 cancela el pedido dentro de la misma transacción. Los locks y comprobación del estado previenen doble reembolso. Participan pedidos, wallets, movimientos_wallet y usuarios vía helper; no modifica pagos ni crea tabla de reembolsos. Cuerpo versionado; tablas externas.

### QR y contingencia

Generación/persistencia: P:154-161 dentro del pago; UUID `qr_token` y texto `codigo_retiro_diario`. No genera imagen en backend.

Lectura: `GET /api/pedidos/:id/qr` → R:28 → C:64 → S:659 → SELECT usuarios (rol 1) → SELECT pedidos → propiedad y estado pendiente/en_preparacion/listo → `{qr_token}`. No RPC en esta lectura. El comentario S:656 de endpoint “único” debe matizarse: la respuesta de pago P:201 también devuelve el token. No se corrige código.

Validación: `POST /api/pedidos/validar-qr` → R:30 → C:82 → S:736 → cliente compartido → `log_qr_validation(p_qr_token)` → respuesta sin transformación. Node no comprueba rol, cafetería, token no vacío, estado ni un solo uso. **No puede demostrarse** que la RPC marque entregado, establezca `qr_usado`/`entregado_en`, escriba logs o bloquee concurrencia: falta su cuerpo. La tabla logs QR existente en SQL no demuestra esas operaciones. PATCH genérico bloquea la transición a entregado (S:619).

Contingencia: `GET /:id/token-contingencia` → C:73 → S:700; SELECT pedidos/usuarios/cafeteria_usuarios y propiedad o pertenencia. La proyección S:703 omite `qr_token`, aunque S:733 intenta leerlo: devuelve el literal `token-contingencia`. No devuelve el código SQL `CF-...` y no hay validación alternativa demostrada. Se registra el problema, sin modificarlo.

## F. Matriz completa de versionado frente a externo

Las matrices B-D enumeran cada objeto y sus fuentes. Resumen consolidado de todas las dependencias del núcleo y del SQL auxiliar encontrado:

| Dependencia | Tipo | Consumo | Definición en repo | Clasificación |
|---|---|---|---|---|
| usuarios, cafeteria_usuarios, productos | Tablas | Node y helpers/pago | Consultas/seed/RLS, sin CREATE | EXTERNA |
| wallets, pedidos, detalles_pedido | Tablas | Pago/cancelación/QR | SQL consumidor, sin CREATE | EXTERNA |
| pagos, metodos_pago, movimientos_wallet | Tablas | Pago/ledger | Sin CREATE | EXTERNA |
| cafeterias | Tabla | Contexto/FK | ALTER de dos columnas | PARCIAL |
| roles | Tabla | Rol/helper auxiliar | Seed, sin CREATE | EXTERNA |
| logs_validacion_qr | Tabla | Destino esperado QR | Q:17 | VERSIONADA; enlace con RPC indeterminado |
| logs_auditoria | Tabla auxiliar | Policy de historial | Solo ALTER/policy | PARCIAL |
| anuncios_pedido | Tabla auxiliar | Voz KDS | CREATE TABLE | VERSIONADA |
| procesar_pago, cancelar_pedido | RPC | S:281,168 | P:21, X:33 | VERSIONADA; dependencias incompletas |
| log_qr_validation | RPC | S:738 | Ausente | EXTERNA |
| mis_cafeterias_ids | Helper documental | Policy staff transcrita en D2.1 | Sin CREATE FUNCTION | EXTERNA como definición; uso actual INDETERMINADO |
| get_current_user_id | Helper | P:49 | Ausente | EXTERNA |
| mi_usuario_id, mi_wallet_id, es_dueno | Helpers | Cancelación/policies; wallet auxiliar | H:39,74,56 | VERSIONADA |
| 4 policies positivas de D | Policies | QR/historial/avisos | CREATE POLICY | VERSIONADA; configuración global incompleta |
| Policies base y grants base | Seguridad | Clientes JWT requieren acceso | DROPs/ALTER, sin conjunto completo | PARCIAL |
| pedidos_update_staff | Policy referida | X:165; D2.1:355,358 | Fragmentos documentales sin CREATE POLICY | PARCIAL; vigencia INDETERMINADA |
| pedidos_update_cancelar_own | Policy retirada | X:170 | Solo DROP | PARCIAL |
| PK/FK/identidad QR y anuncios, índice anuncios | Integridad | Tablas auxiliares | CREATE explícito/implícito | VERSIONADA |
| PK/defaults/FK/enums/checks de base | Integridad | INSERT/UPDATE y estados | Ausente | EXTERNA; forma exacta INDETERMINADA |
| on_auth_user_created/handle_new_auth_user | Trigger/helper alta | Aprovisionamiento documentado | Trigger en Markdown, helper ausente | PARCIAL |
| trg_pedidos_codigo, handle_wallet_updated_at | Trigger/helper referido | Documentación histórica | Sin definición | INDETERMINADA |
| Auth, auth.users, auth.uid, rol authenticated | Plataforma | Sesión/identidad/EXECUTE | Sin definición local | EXTERNA de Supabase |
| gen_random_uuid, lenguaje plpgsql y primitivas SQL | Plataforma PostgreSQL | P/X/H | Provistas por motor, sin versión fijada | EXTERNA de plataforma |
| supabase_realtime/membresía pedidos | Publicación | UI posterior al pedido | Solo ALTER PUBLICATION | PARCIAL |
| Seeds operativos | Datos | Usuarios/roles/productos/método/wallet | Seed básico incompleto | PARCIAL |

No se puede conocer qué triggers/policies adicionales tenga Cloud ni afirmar que un objeto esté allí solo porque el código lo espera.

## G. Orden lógico para reconstruir dependencias

Es un grafo conceptual, **no un procedimiento ejecutable**: faltan definiciones y no hay orden total de migraciones confiable.

1. Plataforma Supabase/PostgreSQL: Auth/JWT, `auth.uid()`, roles de acceso, PL/pgSQL y generación UUID disponible.
2. Recuperar DDL base real: roles y usuarios (enlace UUID Auth); cafeterías/productos y asociaciones usuario-cafetería; wallets por usuario; métodos de pago. La ordenación exacta entre cafeterías/usuarios y otras referencias no visibles necesita sus FK reales.
3. Pedidos referenciando identidad/cafetería; después detalles por pedido/producto, pagos por pedido/método y movimientos por wallet/pedido. Estas relaciones de uso son demostrables; su DDL/FK exacta no está versionada.
4. Logs QR y anuncios solo después de pedidos/cafeterías/usuarios: sus tres FK sí son explícitas. Logs auditoría debe recuperarse antes de ejecutar H completo.
5. Helpers: `mi_usuario_id` después de usuarios/Auth; `get_current_user_id` recuperado antes de pago; auxiliares `es_dueno` después de roles/usuarios y `mi_wallet_id` después de wallets/usuarios. El trigger de alta requiere recuperar su función y tablas, si se usa aprovisionamiento automático.
6. RPC `procesar_pago` y `cancelar_pedido`, luego sus permisos EXECUTE; recuperar primero firma/cuerpo/dependencias de `log_qr_validation` para ubicarla correctamente. No puede ordenarse su interior desconocido.
7. Resolver contratos de triggers de códigos y timestamps antes de habilitarlos: posible interacción con generación QR dentro del pago. No asumir que son necesarios ni duplicarlos sin DDL.
8. Conciliar RLS/grants/policies por actor sobre tablas/helpers existentes; elegir una configuración coherente, porque los fixes actuales se contradicen. Después añadir membresía Realtime si se necesita la UI.
9. Datos mínimos antes de ejercer el flujo: roles con ids coherentes con Node; cuenta Auth enlazada a usuarios; operador asociado; cafetería y productos; método WALLET; wallet válida con saldo. El seed actual no alcanza para esto.

No hay enum propio encontrado que deba ponerse artificialmente al comienzo. No se ejecutó este orden.

## H. Dependencias necesarias pero no versionadas

| Nombre / tipo | Uso y evidencia | Qué falta | Impacto al reconstruir |
|---|---|---|---|
| 9 tablas consumidoras externas de B | `.from` de S y DML P/X | CREATE con columnas, tipos, PK, defaults, relaciones y restricciones | Ni consultas ni transacciones funcionan |
| cafeterias/roles y enlace Auth | Q:19-21, H:66; ids en S:440 | Esquema base y datos coherentes | Fallan FK, identidad y autorización |
| `get_current_user_id()` / helper | P:49 | Firma/cuerpo, privilegios e identidad derivada | Pago no reproducible |
| `log_qr_validation` / RPC | S:738 | Firma SQL exacta, cuerpo, permisos, tablas y helpers internos | Entrega/un solo uso/auditoría no demostrables |
| Accesos usuarios/pedidos y tablas base / policies-grants | Clientes JWT en S:224,168,308 | Conjunto canónico de RLS, policies y grants compatible con operaciones | Flujo puede quedar bloqueado o sobreexpuesto |
| Aprovisionamiento Auth → usuario/wallet | Trigger en documentación | `handle_new_auth_user()` y esquema/restricciones necesarios | Registrar Auth no garantiza cuenta interna ni saldo |
| Defaults de ids/código y estados de pedidos | INSERT P:144 sin id/codigo_pedido; proyección S:96 | Defaults/secuencias/triggers/enums/checks reales | Alta/códigos pueden fallar; no inferir mecanismo |
| Triggers códigos/timestamps referidos | D4:127 y D2.1:143 | DDL y funciones exactas; confirmar vigencia | Paridad remota indeterminada, posibles interacciones |
| Métodos/roles/wallet/usuario de prueba válidos | P:175 y H, Node | Seed WALLET, usuario Auth enlazado, wallet financiada y roles estables | No hay compra de extremo a extremo con seed actual |
| `logs_auditoria` auxiliar | H:92 | CREATE TABLE | H completo no puede ejecutarse en vacío aunque contenga mi_usuario_id |

Recuperar estos contratos sería una tarea futura con acceso autorizado a esquema/exportación; no se inventaron implementaciones ni se consultó Cloud para llenar huecos.

## I. Archivos modificados

Solo `docs/base-datos/dependencias-sql-ms-pedidos.md` (este documento). Se usa la carpeta que ya contiene las auditorías D2.1 y D4. No se modifica README, lógica, SQL ni configuración.

## J. Método y validación local

Búsquedas realizadas desde raíz, incluyendo revisión de archivos ocultos y excluyendo `.git`/`node_modules` en búsqueda exhaustiva:

- `git status --short --branch`, `git rev-parse HEAD`, `git ls-files '*AGENTS.md' '*.sql'`.
- `rg --files -g '*.sql' -g '*migration*' -g '*schema*' -g '*seed*'` y listado oculto por nombres migration/schema/seed/setup/supabase.
- `rg -n '\.rpc\('` global; inspección completa del servicio, rutas, controllers, Auth, cliente Supabase y servicio de precios.
- Búsqueda global de CREATE TABLE/FUNCTION/TRIGGER/POLICY/TYPE/VIEW/SEQUENCE, ALTER TABLE, RLS, GRANT y REFERENCES; también definiciones embebidas en Markdown/código.
- Revisión de los diez `.sql` versionados: ocho fixes y dos RPC. No se encontró `supabase/migrations` ni esquema base reproducible. `supabase/config.toml` y Edge Function voz no constituyen DDL.
- Tests Jest considerados únicamente contratos secundarios; no prueban esquema ni despliegue. No se ejecutan tests productivos por cambio exclusivamente documental.

Contradicciones documentales: D4:106 llama no versionado a `mi_usuario_id`, pero H:39 sí contiene su definición actual. H:72 dice que `mi_wallet_id` se usa en rpc_qr, pero P actual usa `get_current_user_id` y consulta wallets directamente. El script anuncios comenta ausencia de cafeteria_usuarios; el código actual la necesita y el seed la referencia, sin demostrar su existencia remota. Se priorizan SQL y código actuales.

Resultado: único archivo nuevo no rastreado, sin cambios en archivos existentes. `git diff --check` y la revisión equivalente del archivo nuevo no reportaron errores de espacios; solo aviso de conversión LF/CRLF de Git. Se revisó también el contenido completo como diff no-index. Validación final: `git status`, `git diff --stat`, `git diff --name-status`, `git diff --check`, `git diff`. Como el informe es nuevo/no rastreado, se revisa además con `git diff --no-index -- /dev/null <archivo>` (en Windows, ruta vacía temporal equivalente). Un diff no-index con diferencias devuelve 1; no representa fallo de contenido. `git diff` normal no incluye archivos no rastreados. No se añade al índice para alterar esa condición.

## K. Seguridad

- Supabase Cloud NO modificado; SQL remoto NO ejecutado; migraciones Cloud NO ejecutadas; RLS remoto NO modificado; RPC remotas NO creadas/eliminadas.
- Secretos NO expuestos en el informe; no se leyó configuración de credenciales reales ni se utilizó service_role para operar Cloud.
- Kubernetes NO modificado; docker push NO ejecutado; commit NO realizado; push NO realizado.

## L. Criterios de aceptación

- [PASS] Tablas utilizadas identificadas, separando consumo demostrado de referencias auxiliares.
- [PASS] RPC utilizadas identificadas y contrastadas con CREATE FUNCTION.
- [PASS] Helpers SQL relevantes identificados y dependencias transitivas señaladas.
- [PASS] Versionado, parcial, externo e indeterminado diferenciados.
- [PASS] Orden lógico documentado con límites de reconstrucción.
- [PASS] Referencias faltantes señaladas sin inventar SQL.
- [PASS] Supabase remoto sin modificaciones.

## M. Preparación para defensa

1. **¿Qué tablas necesita ms-pedidos?** Usuarios, cafeteria_usuarios, productos, wallets, pedidos, detalles_pedido, metodos_pago, pagos y movimientos_wallet; cafeterias/roles como soporte. Logs_validacion_qr es destino esperado, no verificable dentro de la RPC ausente. Auth aporta cuentas; historial/avisos son auxiliares.
2. **¿Qué RPC utiliza?** procesar_pago, cancelar_pedido y log_qr_validation.
3. **¿Consumir vs. versionar?** `.rpc(nombre)` demuestra contrato cliente; CREATE FUNCTION con cuerpo y permisos permite reproducir el objeto, sujeto a sus dependencias.
4. **¿Qué SQL está dentro?** Dos cuerpos RPC, tres helpers, logs QR y anuncios con constraints/policies, policy de historial y fixes parciales de RLS/cafeterías/Realtime/seed. No hay esquema base completo.
5. **¿Qué depende de Supabase externo?** Tablas base, Auth, helper get_current_user_id, RPC QR y configuración efectiva de acceso; triggers/documentos no fijan estado remoto.
6. **¿Cómo se paga?** Node valida/cotiza; SQL vuelve a leer precios, calcula, bloquea wallet, descuenta y registra pedido, QR, detalles, pago y ledger en una transacción.
7. **¿Cómo se reembolsa?** cancelar_pedido devuelve pedidos.total a wallet y añade movimiento positivo bajo locks; no existe reembolso independiente.
8. **¿SQL de cancelación?** cancelar_pedido → mi_usuario_id → usuarios/auth.uid, y pedidos/wallets/movimientos_wallet; permisos authenticated.
9. **¿Dependencias QR?** Generación en pago con gen_random_uuid y columnas pedidos; lectura con usuarios; validación log_qr_validation externa; logs QR tiene DDL pero no demuestra consumo interno.
10. **¿Supabase vacía solo con repo?** No.
11. **¿Qué falta?** DDL base y restricciones/defaults, get_current_user_id, log_qr_validation, permisos/RLS coherentes y datos mínimos Auth/wallet/WALLET; contratos de aprovisionamiento y triggers referidos.
12. **¿Orden?** Plataforma → tablas base/relaciones → tablas dependientes → helpers → RPC/permisos → triggers reconciliados → RLS/Realtime → datos operativos, con faltantes de G resueltos antes.
13. **¿Por qué mocks no prueban RPC real?** Jest puede devolver respuestas prefijadas sin contactar PostgreSQL ni crear funciones; comprueba comportamiento cliente, no existencia o cuerpo desplegado.

## N. Segunda revisión crítica (31-10-2026)

### Dictamen sobre las conclusiones originales

| Conclusión | Dictamen | Resultado del contraste |
|---|---|---|
| 12 tablas del núcleo | [CORREGIDA] | Mezclaba consumo comprobado, soporte, auxiliar y candidato. Se separan 9 tablas consumidoras, 1 soporte referencial cafeterias, 3 auxiliares (roles/historial/avisos) y 1 candidata QR: 14 públicas inventariadas más Auth. No se demuestran 12 tablas ejecutadas por el núcleo |
| 3 RPC del núcleo | [CONFIRMADA] | S:168,281,738; recargar_saldo es recarga móvil fuera de este flujo |
| 4 helpers propios | [AMPLIADA] | Cuatro del inventario inicial más mis_cafeterias_ids, referido en documentación de pedidos_update_staff. No se eleva a dependencia ejecutada demostrada |
| Pago/cancelación versionados | [CONFIRMADA] | P:21-208 y X:33-170: cuerpos, RETURNS JSONB, SECURITY DEFINER y permisos; tablas externas |
| log_qr_validation/get_current_user_id sin definición | [CONFIRMADA] | Búsqueda global insensible a mayúsculas/multilínea, sin CREATE encontrado; tabla logs y referencias no sustituyen cuerpos |
| Once tablas base sin CREATE TABLE | [CONFIRMADA] | usuarios, cafeteria_usuarios, productos, wallets, pedidos, detalles_pedido, metodos_pago, pagos, movimientos_wallet, cafeterias y roles. Solo dos CREATE TABLE del proyecto: logs QR y anuncios |
| Triggers documentales | [AMPLIADA] | Separación de referencia, fragmento y propuesta en tabla inferior; no son objetos desplegados demostrados |
| JWT/RLS/permisos | [AMPLIADA] | Separar SELECT directo de ejecución SECURITY DEFINER; propietario/privilegios por defecto no disponibles |
| QR separado del código de retiro | [CONFIRMADA] | UUID qr_token y texto codigo_retiro_diario son distintos; contingencia Node no devuelve ese código |
| Código con padding | [CORREGIDA] | P:155 usa lpad con ancho exacto de cuatro: trunca ids largos. No garantiza unicidad; no existe DDL UNIQUE disponible para ese campo |
| Imposibilidad de reproducir | [CONFIRMADA] | DDL base, helper de pago y RPC QR ausentes |
| Orden de reconstrucción | [AMPLIADA] | G sigue conceptual. mis_cafeterias_ids debe preceder a policy staff solo si se recupera/confirma ese contrato; roles es dependencia de es_dueno, no consulta de cancelar_pedido |
| Cifra mezclada como número ejecutado | [ELIMINADA] | El total inventariado no prueba cantidad de tablas ejecutadas por el núcleo |

### Columnas esenciales omitidas en la primera pasada

Son contratos leídos/escritos, no DDL recuperado. Los tipos de variables/casts no prueban tipos exactos o nullability de columnas remotas.

| Tabla | Columnas esenciales | Evidencia |
|---|---|---|
| usuarios | id, auth_user_id; rol_id para autorización Node | S:227,453; H:46-47 |
| cafeteria_usuarios | id, usuario_id, cafeteria_id | S:486,506,718 |
| productos | id, precio, activo, eliminado_en; cafeteria_id y nombre para cotización Node | P:77-79; servicio menús:24,169-174 |
| wallets | id, usuario_id, saldo_actual | P:114-142; X:106-125 |
| pedidos (pago) | id, usuario_id, cafeteria_id, total, estado, pago_estado, metodo_pago, franja_retiro, qr_token, codigo_retiro_diario | P:144-161 |
| pedidos (cancelación) | id, usuario_id, estado, total, cancelado_en | X:65-69,137-140 |
| pedidos (lecturas) | id, usuario_id, estado, qr_token; todas las de CAMPOS_PEDIDO_PUBLICOS, incluido qr_usado/entregado_en | S:96-115,672-674; no hay SQL disponible que demuestre escritura de qr_usado/entregado_en por validación |
| detalles_pedido | pedido_id, producto_id, cantidad, precio_unitario, subtotal | P:163-172 |
| metodos_pago | id, codigo | P:174-175 |
| pagos | pedido_id, metodo_pago_id, monto, estado, es_simulado, referencia_transaccion | P:177-183 |
| movimientos_wallet | wallet_id, pedido_id, tipo, monto, descripcion | P:185-191; X:128-134 |
| cafeterias / roles | cafeterias.id; roles.id, nombre para helper auxiliar | Q:20; H:66-68 |
| logs_validacion_qr (definida) | id, pedido_id, cafeteria_id, usuario_id, qr_token, resultado, detalle, validado_en | Q:18-25; no prueba consumo por RPC |

Los ids omitidos en INSERT requieren una estrategia compatible si el esquema los exige; no se deduce cuál. No hay DDL de NOT NULL/UNIQUE en wallets.usuario_id, métodos.codigo, QR o código de retiro. Pago compara saldo<total y cancelación comprueba overflow, pero ninguno rechaza saldo NULL explícitamente. Las garantías monetarias también requieren datos/constraints no recuperados. X usa variable NUMERIC(10,2) para total y luego valida entero/rango INTEGER; no fija el tipo de pedidos.total. Literales pendiente/pagado/cancelado, compra/reembolso, wallet/WALLET y aprobado necesitan tipos/checks compatibles; no demuestran enums.

### Grafos transitivos revalidados

`procesar_pago [VERSIONADA]` → `get_current_user_id [EXTERNA, interior desconocido]`; → productos SELECT; → wallets SELECT FOR UPDATE/UPDATE; → pedidos INSERT/RETURNING/UPDATE QR; → detalles_pedido INSERT; → metodos_pago SELECT WALLET; → pagos INSERT; → movimientos_wallet INSERT. Son siete tablas EXTERNAS en el cuerpo P. Usuarios se consulta antes en Node: no puede atribuirse al interior desconocido del helper. Cafetería llega como parámetro; su FK base no está disponible. Columnas/defaults/checks/índices base no están definidos. Primitivas: jsonb_array_length, jsonb_array_elements, jsonb_build_object, jsonb_build_array, operadores JSONB/concatenación, round, lpad, casts BIGINT/INTEGER/NUMERIC/TEXT y gen_random_uuid; no son helpers propios ausentes. Seleccionar WALLET con LIMIT 1 no valida existencia/unicidad: si falta puede insertar método NULL, sujeto al DDL desconocido. Generar UUID no prueba constraint UNIQUE.

`cancelar_pedido [VERSIONADA]` → `mi_usuario_id [VERSIONADA]` → usuarios [EXTERNA] + auth.uid [plataforma]; → pedidos SELECT FOR UPDATE (propietario, estado, total); → wallets SELECT FOR UPDATE/UPDATE; → movimientos_wallet INSERT positivo; → pedidos UPDATE cancelado/cancelado_en. No llama otro helper propio. Primitivas: lower, trunc, jsonb_build_object, casts, CURRENT_TIMESTAMP. No consulta pago previo ni pago_estado: autoriza por identidad, propiedad, estado y total. Los locks y el cambio de estado previenen doble cancelación concurrente de una fila bajo ese contrato; integridad wallet/ledger depende además del esquema. RETURN ok:false es salida normal, no rollback automático; las salidas de negocio de estos cuerpos anteceden las escrituras. Los errores SQL no capturados abortan la llamada. No hay transacción autónoma ni COMMIT dentro de la función.

### JWT, RLS y permisos: precisión adicional

P/X usan SECURITY DEFINER y search_path=public; los tres helpers H también son SECURITY DEFINER, STABLE, lenguaje SQL. No declaran SECURITY INVOKER. GRANT EXECUTE habilita invocación, mientras las operaciones internas usan privilegios del propietario de la función: no se requieren necesariamente las mismas policies de escritura que para acceso directo. El bypass de RLS depende de propietario, privilegios y FORCE RLS, datos no versionados aquí. auth.uid lee el contexto JWT, no la identidad del propietario SQL. H no define GRANT/REVOKE explícitos de sus helpers; el acceso depende de permisos existentes/defaults y del esquema. Los GRANT de P/X tampoco demuestran ausencia de grants anteriores a otros roles.

Node necesita acceso directo JWT a usuarios antes del pago y a pedidos al leer; SECURITY DEFINER no arregla esas consultas. getUser(token) no instala la sesión en el cliente compartido usado para validar QR. El cuerpo desconocido de get_current_user_id impide verificar su identidad derivada. El informe no debe presentar policies de escritura de wallet/pago como requisito idéntico para toda llamada RPC.

### Procedencia: SQL ejecutable frente a documentación

| Entidad | Clase de evidencia | Resultado |
|---|---|---|
| trg_pedidos_codigo | C. Referencia histórica D2.1:134 / D4:127 | Sin CREATE TRIGGER ni función destino; no reproducible |
| handle_wallet_updated_at | C. Referencia histórica D2.1:143 | Nombre de trigger/función ambiguo; sin definición |
| on_auth_user_created | B. Fragmento documental, pruebas_flujo_catalogo:99 | CREATE TRIGGER depende de función ausente; no esquema de alta reproducible |
| handle_new_auth_user | B/C. Descripción documental; autenticacion/flujo_confirmacion_cuenta_s2_t2.md:52 | Sin CREATE FUNCTION; aprovisionamiento no reconstruible |
| on_auth_user_deleted | D. Propuesta no aplicada, pruebas_flujo_catalogo:125 | No objeto activo demostrado |
| borrar_usuario_al_eliminar | D. Cuerpo SQL propuesto en mismo documento:115 | Texto ejecutable bajo precondiciones, pero propuesta; no esquema productivo reproducible |

Conteos: **0 CREATE TRIGGER en los diez archivos SQL**; 3 nombres históricos vinculados a alta/códigos/timestamp (uno ambiguo) y 1 trigger propuesto de baja. Las 2 funciones de trigger de alta/baja se separan de los 5 helpers inventariados; el destino de trg_pedidos_codigo sigue sin nombre. Hay 4 CREATE POLICY, 2 tablas con DDL y 5 CREATE FUNCTION en archivos SQL (2 RPC + 3 helpers). Otros objetos: 2 identidades implícitas, 1 índice explícito, 9 constraints PK/UNIQUE/FK (4 logs y 5 anuncios; conteo excluye NOT NULL/defaults, también versionados en esas tablas), 1 ALTER PUBLICATION y 0 CREATE PUBLICATION. No se inventa cantidad de constraints base.

D2.1:473 documenta que pago cambió de mi_usuario_id a get_current_user_id; es evidencia histórica de reconciliación, no igualdad semántica. D2.1:355,358,376 transcribe mis_cafeterias_ids en USING/WITH CHECK de pedidos_update_staff, sin cuerpo del helper. `notificar_stock_bajo()` tiene SQL embebido en BotTelegramCoffeFaster/README.md:228, pero no lo llaman P/X ni hay control de stock Node actual; no se añade al núcleo ni demuestra un trigger instalado. `database/fixes/crear_rpc_pagos.sql`, referenciado en puesta en marcha, no existe; los cuerpos actuales están en app-mobile/tabla_mobile.

### Prueba estricta de reproducibilidad

**NO.** La ausencia de pedidos por sí sola refuta el flujo completo; no se necesita consultar Cloud. Los contratos mínimos por recuperar para los caminos comprobados son: DDL de las nueve tablas consumidoras con las columnas anteriores y defaults/restricciones compatibles, cuerpo de get_current_user_id y cuerpo/firma/permisos/dependencias de log_qr_validation. Crear logs QR con su DDL disponible requiere además cafeterias y claves destino de sus FK. Se necesitan acceso directo JWT a usuarios/pedidos y datos operativos Auth/usuario, productos, método WALLET y wallet válida. No se pueden enumerar las dependencias internas desconocidas de la RPC QR. Roles, historial, anuncios, Realtime y triggers históricos no se presentan como bloqueadores mínimos demostrados de las transacciones: son auxiliares, aprovisionamiento opcional o paridad remota pendiente.

### Verificación de la segunda revisión

Se repitieron búsquedas insensibles a mayúsculas/multilínea con rg --hidden --no-ignore, inventario SQL/schema/dump/migration/setup/seed y git ls-files. Se leyeron completos P/X/H y DDL QR/avisos. La exploración inicial incluyó archivos locales ignorados: coincidencias de librerías .venv y SDK compilado dist no son DDL de CoffeeFast. Las búsquedas posteriores excluyen esos artefactos, node_modules, .git y .env, conservando fuentes de todo el proyecto. No apareció DDL base adicional ni definiciones de log_qr_validation, get_current_user_id o mis_cafeterias_ids. Ausencia local no demuestra existencia remota.

Solo se modifica este Markdown, aún no rastreado; no git add. Se ejecutan los cinco comandos solicitados y revisión no-index adicional para cubrir este archivo nuevo. Supabase no consultado ni modificado; SQL remoto, cambios RLS/Kubernetes, docker push, commit y push no realizados; no se imprimieron secretos de credenciales.
