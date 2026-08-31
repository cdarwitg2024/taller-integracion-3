# Seguridad de Base de Datos — Políticas Row Level Security (RLS)

## CoffeeFaster

---

## 1. Contexto

Este documento define la lógica de las políticas **Row Level Security (RLS)** para el esquema `public` de la base de datos CoffeeFaster. Actualmente **no existen políticas RLS habilitadas**, lo que significa que cualquier cliente con credenciales `anon` o `authenticated` puede acceder a todas las filas de todas las tablas. Este documento establece el diseño de dichas políticas **antes de su implementación en SQL**.

---

## 2. Roles del sistema

### 2.1 Roles de aplicación (almacenados en `USUARIOS.rol`)

| Rol            | Descripción                                             | Alcance                                                                   |
| -------------- | -------------------------------------------------------- | ------------------------------------------------------------------------- |
| `estudiante` | Usuario final que realiza pedidos                        | Propios datos y pedidos                                                   |
| `empleado`   | Empleado de cafetería con permisos operativos parciales | Datos de su cafetería asignada, según permisos de`CAFETERIA_USUARIOS` |
| `dueño`     | Dueño de cafetería con permisos completos              | Control total sobre su(s) cafetería(s) asignada(s)                       |
| `superadmin` | Administrador global del sistema                         | Fuera del alcance de este documento; se gestiona vía`service_role`     |

### 2.2 Roles de Postgres (nivel infraestructura)

| Rol Postgres      | Uso en RLS                                                              |
| ----------------- | ----------------------------------------------------------------------- |
| `anon`          | Solo lectura de catálogos públicos (categorías, cafeterías activas) |
| `authenticated` | Rol destino de todas las políticas RLS documentadas aquí              |
| `service_role`  | Backoffice / server-side; bypass completo de RLS                        |

---

## 3. Funciones auxiliares requeridas

Antes de aplicar las políticas, se requieren dos funciones helper que serán consultadas por cada política:

| Función                      | Parámetros | Retorna          | Descripción                                                                                   |
| ----------------------------- | ----------- | ---------------- | ---------------------------------------------------------------------------------------------- |
| `auth.uid()`                | Ninguno     | `bigint`       | ID del usuario actual extraído del JWT (claim`sub`)                                         |
| `current_user_rol()`        | Ninguno     | `varchar`      | Rol del usuario actual (`estudiante`, `empleado`, `dueño`) consultando `USUARIOS.rol` |
| `current_user_cafeterias()` | Ninguno     | `SETOF bigint` | IDs de cafeterías asociadas al usuario actual vía`CAFETERIA_USUARIOS`                      |

---

## 4. Políticas RLS por tabla

Para cada tabla se indica:

- Qué operaciones puede realizar cada rol
- El alcance de acceso (qué filas puede ver o modificar)
- La condición que determina si una fila es accesible

---

### 4.1 `UNIVERSIDADES`

| Operación | Estudiante      | Empleado        | Dueño          |
| ---------- | --------------- | --------------- | --------------- |
| SELECT     | Todas las filas | Todas las filas | Todas las filas |
| INSERT     | No permitido    | No permitido    | No permitido    |
| UPDATE     | No permitido    | No permitido    | No permitido    |
| DELETE     | No permitido    | No permitido    | No permitido    |

**Condición de acceso (SELECT):** Sin restricción. Todos los usuarios autenticados pueden leer todas las universidades.

**Justificación:** Catálogo público compartido. Solo `superadmin` gestiona estas filas vía `service_role`.

---

### 4.2 `CAMPUS_SEDES`

| Operación | Estudiante      | Empleado        | Dueño          |
| ---------- | --------------- | --------------- | --------------- |
| SELECT     | Todas las filas | Todas las filas | Todas las filas |
| INSERT     | No permitido    | No permitido    | No permitido    |
| UPDATE     | No permitido    | No permitido    | No permitido    |
| DELETE     | No permitido    | No permitido    | No permitido    |

**Condición de acceso (SELECT):** Sin restricción. Todos los usuarios autenticados pueden leer todas las sedes.

**Justificación:** Catálogo público. Sedes visibles para todos.

---

### 4.3 `CAFETERIAS`

| Operación | Estudiante                        | Empleado                                          | Dueño                                            |
| ---------- | --------------------------------- | ------------------------------------------------- | ------------------------------------------------- |
| SELECT     | Solo filas donde`activa = true` | Solo filas asignadas (vía`CAFETERIA_USUARIOS`) | Solo filas asignadas (vía`CAFETERIA_USUARIOS`) |
| INSERT     | No permitido                      | No permitido                                      | No permitido                                      |
| UPDATE     | No permitido                      | Solo filas asignadas, campos parciales            | Todas las filas asignadas                         |
| DELETE     | No permitido                      | No permitido                                      | No permitido                                      |

**Condiciones de acceso:**

| Rol        | SELECT — Condición                          | UPDATE — Condición                          |
| ---------- | --------------------------------------------- | --------------------------------------------- |
| Estudiante | `activa = true`                             | No aplica                                     |
| Empleado   | `id` está en `current_user_cafeterias()` | No aplica (sin permiso de edición)           |
| Dueño     | `id` está en `current_user_cafeterias()` | `id` está en `current_user_cafeterias()` |

**Nota sobre UPDATE:** El empleado no tiene permiso de edición sobre cafeterías. Solo el dueño puede modificar información de su cafetería (nombre, horarios, teléfono, etc.).

---

### 4.4 `USUARIOS`

| Operación | Estudiante                                    | Empleado                | Dueño                  |
| ---------- | --------------------------------------------- | ----------------------- | ----------------------- |
| SELECT     | Solo su propio registro (`id = auth.uid()`) | Solo su propio registro | Solo su propio registro |
| INSERT     | No permitido                                  | No permitido            | No permitido            |
| UPDATE     | Solo su propio registro, campos limitados     | Solo su propio registro | Solo su propio registro |
| DELETE     | No permitido                                  | No permitido            | No permitido            |

**Condiciones de acceso:**

| Rol   | SELECT — Condición | UPDATE — Condición |
| ----- | -------------------- | -------------------- |
| Todos | `id = auth.uid()`  | `id = auth.uid()`  |

**Restricción adicional (UPDATE):** El campo `rol` NO debe ser actualizable por el usuario. Se recomienda crear una función `actualizar_perfil()` que acepte solo `nombre`, `apellido`, `telefono` y `foto_url`, excluyendo `rol` de los campos modificables.

---

### 4.5 `CAFETERIA_USUARIOS`

| Operación | Estudiante   | Empleado                                                    | Dueño                                           |
| ---------- | ------------ | ----------------------------------------------------------- | ------------------------------------------------ |
| SELECT     | No permitido | Solo sus propias asignaciones (`usuario_id = auth.uid()`) | Asignaciones de sus cafeterías + la suya propia |
| INSERT     | No permitido | No permitido                                                | Solo en cafeterías asignadas                    |
| UPDATE     | No permitido | No permitido                                                | Solo en cafeterías asignadas                    |
| DELETE     | No permitido | No permitido                                                | Solo en cafeterías asignadas                    |

**Condiciones de acceso:**

| Rol        | SELECT — Condición                                                                            | INSERT/UPDATE/DELETE — Condición                      |
| ---------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| Estudiante | No aplica                                                                                       | No aplica                                               |
| Empleado   | `usuario_id = auth.uid()`                                                                     | No aplica                                               |
| Dueño     | `cafeteria_id` está en `current_user_cafeterias()` **o** `usuario_id = auth.uid()` | `cafeteria_id` está en `current_user_cafeterias()` |

---

### 4.6 `CATEGORIAS`

| Operación | Estudiante      | Empleado        | Dueño          |
| ---------- | --------------- | --------------- | --------------- |
| SELECT     | Todas las filas | Todas las filas | Todas las filas |
| INSERT     | No permitido    | No permitido    | No permitido    |
| UPDATE     | No permitido    | No permitido    | No permitido    |
| DELETE     | No permitido    | No permitido    | No permitido    |

**Condición de acceso (SELECT):** Sin restricción. Catálogo público compartido.

---

### 4.7 `PRODUCTOS`

| Operación | Estudiante                                                         | Empleado                                                                         | Dueño                                                                 |
| ---------- | ------------------------------------------------------------------ | -------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| SELECT     | Solo productos activos (`activo = true`) de cualquier cafetería | Solo productos activos de sus cafeterías asignadas                              | Todos los productos (activos e inactivos) de sus cafeterías asignadas |
| INSERT     | No permitido                                                       | Solo si tiene permiso`gestiona_productos = true` en la cafetería del producto | Todas las filas de sus cafeterías                                     |
| UPDATE     | No permitido                                                       | Solo si tiene permiso`gestiona_productos = true` en la cafetería del producto | Todas las filas de sus cafeterías                                     |
| DELETE     | No permitido                                                       | No permitido (soft delete:`activo = false`)                                    | Todas las filas de sus cafeterías                                     |

**Condiciones de acceso:**

| Rol        | SELECT — Condición                                                            | INSERT — Condición                                                | UPDATE — Condición                                                | DELETE — Condición                              |
| ---------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------- |
| Estudiante | `activo = true`                                                               | No aplica                                                           | No aplica                                                           | No aplica                                         |
| Empleado   | `cafeteria_id` en `current_user_cafeterias()` **y** `activo = true` | `cafeteria_id` en cafeterías donde `gestiona_productos = true` | `cafeteria_id` en cafeterías donde `gestiona_productos = true` | No aplica                                         |
| Dueño     | `cafeteria_id` en `current_user_cafeterias()`                               | `cafeteria_id` en `current_user_cafeterias()`                   | `cafeteria_id` en `current_user_cafeterias()`                   | `cafeteria_id` en `current_user_cafeterias()` |

---

### 4.8 `MOVIMIENTOS_INVENTARIO`

| Operación | Estudiante   | Empleado                                                                                      | Dueño                                                |
| ---------- | ------------ | --------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| SELECT     | No permitido | Movimientos propios**o** movimientos de productos de sus cafeterías                    | Todos los movimientos de productos de sus cafeterías |
| INSERT     | No permitido | Solo si tiene permiso`gestiona_inventario = true` y el producto pertenece a sus cafeterías | Solo en productos de sus cafeterías                  |
| UPDATE     | No permitido | No permitido (tabla de auditoría inmutable)                                                  | No permitido (tabla de auditoría inmutable)          |
| DELETE     | No permitido | No permitido (tabla de auditoría inmutable)                                                  | No permitido (tabla de auditoría inmutable)          |

**Condiciones de acceso:**

| Rol        | SELECT — Condición                                                                                                   | INSERT — Condición                                                                                        |
| ---------- | ---------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Estudiante | No aplica                                                                                                              | No aplica                                                                                                   |
| Empleado   | `usuario_id = auth.uid()` **o** el `producto_id` pertenece a una cafetería de `current_user_cafeterias()` | `usuario_id = auth.uid()` **y** `producto_id` en cafeterías donde `gestiona_inventario = true` |
| Dueño     | `producto_id` pertenece a una cafetería de `current_user_cafeterias()`                                            | `usuario_id = auth.uid()` **y** `producto_id` en `current_user_cafeterias()`                    |

**Nota:** Esta tabla es de auditoría. No se permite UPDATE ni DELETE bajo ninguna circunstancia.

---

### 4.9 `PEDIDOS`

| Operación | Estudiante                                                            | Empleado                                                                         | Dueño                                    |
| ---------- | --------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ----------------------------------------- |
| SELECT     | Solo sus propios pedidos                                              | Solo pedidos de sus cafeterías asignadas                                        | Solo pedidos de sus cafeterías asignadas |
| INSERT     | Solo puede crear pedidos donde`usuario_id = auth.uid()`             | No permitido                                                                     | No permitido                              |
| UPDATE     | Solo puede cancelar su propio pedido (si no está en estado terminal) | Solo pedidos de sus cafeterías, si tiene permiso`gestiona_pedidos_kds = true` | Todos los pedidos de sus cafeterías      |
| DELETE     | No permitido                                                          | No permitido                                                                     | No permitido                              |

**Condiciones de acceso:**

| Rol        | SELECT — Condición                              | INSERT — Condición        | UPDATE — Condición                                                                                                                  |
| ---------- | ------------------------------------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Estudiante | `usuario_id = auth.uid()`                       | `usuario_id = auth.uid()` | `usuario_id = auth.uid()` **y** `estado` no es `entregado` ni `cancelado`, **y** el nuevo estado es `cancelado` |
| Empleado   | `cafeteria_id` en `current_user_cafeterias()` | No aplica                   | `cafeteria_id` en cafeterías donde `gestiona_pedidos_kds = true`                                                                 |
| Dueño     | `cafeteria_id` en `current_user_cafeterias()` | No aplica                   | `cafeteria_id` en `current_user_cafeterias()`                                                                                     |

**Nota:** La transición válida de estados se valida en la función stored `cambiar_estado_pedido()`, no en RLS. RLS solo controla el acceso a filas.

---

### 4.10 `DETALLES_PEDIDO`

| Operación | Estudiante                                              | Empleado                                    | Dueño                                      |
| ---------- | ------------------------------------------------------- | ------------------------------------------- | ------------------------------------------- |
| SELECT     | Solo detalles de sus propios pedidos                    | Solo detalles de pedidos de sus cafeterías | Solo detalles de pedidos de sus cafeterías |
| INSERT     | Solo en pedidos propios con estado`pendiente`         | No permitido                                | No permitido                                |
| UPDATE     | No permitido (el pedido se modifica o cancela completo) | No permitido                                | No permitido                                |
| DELETE     | No permitido                                            | No permitido                                | No permitido                                |

**Condiciones de acceso:**

| Rol        | SELECT — Condición                                                                   | INSERT — Condición                                                                                  |
| ---------- | -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Estudiante | `pedido_id` está en pedidos donde `usuario_id = auth.uid()`                       | `pedido_id` está en pedidos donde `usuario_id = auth.uid()` **y** `estado = 'pendiente'` |
| Empleado   | `pedido_id` está en pedidos donde `cafeteria_id` en `current_user_cafeterias()` | No aplica                                                                                             |
| Dueño     | `pedido_id` está en pedidos donde `cafeteria_id` en `current_user_cafeterias()` | No aplica                                                                                             |

---

### 4.11 `PAGOS`

| Operación | Estudiante                                                 | Empleado                                 | Dueño                                   |
| ---------- | ---------------------------------------------------------- | ---------------------------------------- | ---------------------------------------- |
| SELECT     | Solo pagos de sus propios pedidos                          | Solo pagos de pedidos de sus cafeterías | Solo pagos de pedidos de sus cafeterías |
| INSERT     | No permitido (gestionado server-side vía`service_role`) | No permitido                             | No permitido                             |
| UPDATE     | No permitido (gestionado server-side vía`service_role`) | No permitido                             | No permitido                             |
| DELETE     | No permitido                                               | No permitido                             | No permitido                             |

**Condiciones de acceso:**

| Rol        | SELECT — Condición                                                                   |
| ---------- | -------------------------------------------------------------------------------------- |
| Estudiante | `pedido_id` está en pedidos donde `usuario_id = auth.uid()`                       |
| Empleado   | `pedido_id` está en pedidos donde `cafeteria_id` en `current_user_cafeterias()` |
| Dueño     | `pedido_id` está en pedidos donde `cafeteria_id` en `current_user_cafeterias()` |

**Nota:** Los pagos se procesan exclusivamente vía `service_role` (backend/webhook de pasarela de pago).

---

### 4.12 `DISPOSITIVOS`

| Operación | Estudiante                    | Empleado                      | Dueño                        |
| ---------- | ----------------------------- | ----------------------------- | ----------------------------- |
| SELECT     | Solo sus propios dispositivos | Solo sus propios dispositivos | Solo sus propios dispositivos |
| INSERT     | Solo sus propios dispositivos | Solo sus propios dispositivos | Solo sus propios dispositivos |
| UPDATE     | Solo sus propios dispositivos | Solo sus propios dispositivos | Solo sus propios dispositivos |
| DELETE     | Solo sus propios dispositivos | Solo sus propios dispositivos | Solo sus propios dispositivos |

**Condición de acceso (todas las operaciones):** `usuario_id = auth.uid()`. Misma política para todos los roles.

---

### 4.13 `vista_ventas_dia` (vista)

| Operación | Estudiante   | Empleado                             | Dueño                               |
| ---------- | ------------ | ------------------------------------ | ------------------------------------ |
| SELECT     | No permitido | Solo datos de su cafetería asignada | Solo datos de su cafetería asignada |

**Condición de acceso:**

| Rol        | Condición                                        |
| ---------- | ------------------------------------------------- |
| Estudiante | No aplica                                         |
| Empleado   | `cafeteria_id` en `current_user_cafeterias()` |
| Dueño     | `cafeteria_id` en `current_user_cafeterias()` |

---

## 5. Matriz resumen de permisos

### 5.1 Lectura (SELECT)

| Tabla                      | Estudiante                     | Empleado                    | Dueño                      |
| -------------------------- | ------------------------------ | --------------------------- | --------------------------- |
| `UNIVERSIDADES`          | Todas                          | Todas                       | Todas                       |
| `CAMPUS_SEDES`           | Todas                          | Todas                       | Todas                       |
| `CAFETERIAS`             | Solo activas                   | Asignadas                   | Asignadas                   |
| `USUARIOS`               | Solo propio                    | Solo propio                 | Solo propio                 |
| `CAFETERIA_USUARIOS`     | No tiene acceso                | Propios                     | De su cafetería + propio   |
| `CATEGORIAS`             | Todas                          | Todas                       | Todas                       |
| `PRODUCTOS`              | Activos (cualquier cafetería) | Activos (su cafetería)     | Todos (su cafetería)       |
| `MOVIMIENTOS_INVENTARIO` | No tiene acceso                | Propios + su cafetería     | Su cafetería               |
| `PEDIDOS`                | Propios                        | De su cafetería            | De su cafetería            |
| `DETALLES_PEDIDO`        | De sus pedidos                 | De pedidos de su cafetería | De pedidos de su cafetería |
| `PAGOS`                  | Propios                        | De su cafetería            | De su cafetería            |
| `DISPOSITIVOS`           | Propios                        | Propios                     | Propios                     |
| `vista_ventas_dia`       | No tiene acceso                | Su cafetería               | Su cafetería               |

### 5.2 Escritura (INSERT / UPDATE / DELETE)

| Tabla                      | Estudiante                               | Empleado                                   | Dueño                                   |
| -------------------------- | ---------------------------------------- | ------------------------------------------ | ---------------------------------------- |
| `UNIVERSIDADES`          | Ninguna                                  | Ninguna                                    | Ninguna                                  |
| `CAMPUS_SEDES`           | Ninguna                                  | Ninguna                                    | Ninguna                                  |
| `CAFETERIAS`             | Ninguna                                  | Ninguna                                    | UPDATE (asignadas)                       |
| `USUARIOS`               | UPDATE (propios, sin campo`rol`)       | UPDATE (propios)                           | UPDATE (propios)                         |
| `CAFETERIA_USUARIOS`     | Ninguna                                  | Ninguna                                    | INSERT / UPDATE / DELETE (su cafetería) |
| `CATEGORIAS`             | Ninguna                                  | Ninguna                                    | Ninguna                                  |
| `PRODUCTOS`              | Ninguna                                  | INSERT / UPDATE (si`gestiona_productos`) | INSERT / UPDATE / DELETE (su cafetería) |
| `MOVIMIENTOS_INVENTARIO` | Ninguna                                  | INSERT (si`gestiona_inventario`)         | INSERT (su cafetería)                   |
| `PEDIDOS`                | INSERT (propio) + UPDATE (solo cancelar) | UPDATE (KDS, si`gestiona_pedidos_kds`)   | UPDATE (KDS, su cafetería)              |
| `DETALLES_PEDIDO`        | INSERT (en pedido propio`pendiente`)   | Ninguna                                    | Ninguna                                  |
| `PAGOS`                  | Ninguna (server-side)                    | Ninguna                                    | Ninguna                                  |
| `DISPOSITIVOS`           | CRUD (propios)                           | CRUD (propios)                             | CRUD (propios)                           |

---

## 6. Habilitación de RLS

### 6.1 Comandos necesarios (por cada tabla)

| Acción                       | Descripción                                                                                                          |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `ENABLE ROW LEVEL SECURITY` | Activa RLS para la tabla. Las políticas solo se aplican a roles distintos del owner.                                 |
| `FORCE ROW LEVEL SECURITY`  | Extiende la aplicación de RLS al owner de la tabla (necesario para que`authenticated` no tenga acceso implícito). |

### 6.2 Orden recomendado de habilitación

| Paso | Tabla / Objeto                                                       | Justificación                                          |
| ---- | -------------------------------------------------------------------- | ------------------------------------------------------- |
| 1    | Funciones helper (`current_user_rol`, `current_user_cafeterias`) | Requeridas por todas las demás políticas              |
| 2    | `USUARIOS`                                                         | Depende de`auth.uid()`                                |
| 3    | `CAFETERIA_USUARIOS`                                               | Usada por`current_user_cafeterias()`                  |
| 4    | `CAFETERIAS`                                                       | Referenciada por políticas de productos, pedidos, etc. |
| 5    | `PRODUCTOS`                                                        | Depende de`CAFETERIAS`                                |
| 6    | `PEDIDOS`                                                          | Depende de`CAFETERIAS`                                |
| 7    | `DETALLES_PEDIDO`                                                  | Depende de`PEDIDOS`                                   |
| 8    | `PAGOS`                                                            | Depende de`PEDIDOS`                                   |
| 9    | `MOVIMIENTOS_INVENTARIO`                                           | Depende de`PRODUCTOS`                                 |
| 10   | `DISPOSITIVOS`                                                     | Independiente                                           |
| 11   | `UNIVERSIDADES`                                                    | Catálogo público                                      |
| 12   | `CAMPUS_SEDES`                                                     | Catálogo público                                      |
| 13   | `CATEGORIAS`                                                       | Catálogo público                                      |
| 14   | `vista_ventas_dia`                                                 | Vista derivada                                          |

---

## 7. Consideraciones de seguridad

### 7.1 JWT Claims

El JWT generado durante el login debe incluir los siguientes claims:

| Claim   | Tipo        | Descripción                                               |
| ------- | ----------- | ---------------------------------------------------------- |
| `sub` | `bigint`  | Corresponde a`USUARIOS.id`; usado por `auth.uid()`     |
| `rol` | `varchar` | Corresponde a`USUARIOS.rol`; para validación redundante |

### 7.2 Bypass de RLS

El rol `service_role` opera **fuera** de RLS. Las siguientes operaciones se realizan exclusivamente vía `service_role`:

| Operación                                       | Tabla afectada                                      |
| ------------------------------------------------ | --------------------------------------------------- |
| CRUD completo de usuarios y asignación de roles | `USUARIOS`                                        |
| Gestión de catálogos maestros                  | `UNIVERSIDADES`, `CAMPUS_SEDES`, `CATEGORIAS` |
| Procesamiento de pagos                           | `PAGOS`                                           |
| Migraciones y seed data                          | Todas las tablas                                    |

### 7.3 Protección del campo `rol`

El campo `USUARIOS.rol` no debe ser actualizable por el usuario. Se recomienda implementar una función stored `actualizar_perfil()` que acepte solo los campos `nombre`, `apellido`, `telefono` y `foto_url`, excluyendo `rol` de los campos modificables.

### 7.4 Tablas de auditoría inmutables

`MOVIMIENTOS_INVENTARIO` es una tabla de auditoría. Las políticas RLS no permiten UPDATE ni DELETE. Solo se permite INSERT.

### 7.5 Índices recomendados para performance

Las funciones `current_user_rol()` y `current_user_cafeterias()` están declaradas `STABLE`, lo que permite caching por transacción. Para tablas con alto volumen de filas, se recomiendan índices en:

| Tabla                  | Columna(s)       | Justificación                          |
| ---------------------- | ---------------- | --------------------------------------- |
| `PEDIDOS`            | `usuario_id`   | Filtro por estudiante                   |
| `PEDIDOS`            | `cafeteria_id` | Filtro por cafetería (empleado/dueño) |
| `PRODUCTOS`          | `cafeteria_id` | Filtro por cafetería                   |
| `CAFETERIA_USUARIOS` | `usuario_id`   | Resolución de cafeterías del usuario  |
