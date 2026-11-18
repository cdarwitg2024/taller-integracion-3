# V06 / CAM-288 — estructura y cotización del carrito

La implementación pertenece a `db_CoffeeFaster`, migración
`20261117175958_cotizar_carrito_afiliado.sql`. No se duplica el SQL en las
aplicaciones. Las reglas se contrastaron con C01/C02 de `origin/develop`
(`111c892`).

La implementación SQL está publicada en `develop` de `db_CoffeeFaster`: [commit ce34bad](https://github.com/Diego24Vas/db_CoffeeFaster/commit/ce34bad1c3dbbecf1b56662afec648d0b108decb). Ese commit contiene la migración, los permisos, la comprobación estructural y las instrucciones de publicación.

## Estructura y funciones necesarias

- `campanas.tasa_descuento_oferta` y restricciones de rango y relación con la
  tasa normal. La columna es nullable y no se rellenan condiciones históricas.
- `precio_promocional`: cálculo compartido de precios con la mayor promoción
  vigente, sin acumulación y con redondeo por unidad a CLP.
- `afiliados_privado.cotizar_carrito`: cálculo de solo lectura con identidad
  desde el JWT, precios de base y validación de elegibilidad.
- `public.cotizar_carrito_afiliado`: punto de entrada de la cotización sin
  privilegios elevados. Delega en el núcleo privado, que valida la identidad.
- Permisos explícitos: ejecución para usuarios autenticados con cuenta y
  rol activos; sin ejecución para `anon` o `service_role`.

La migración no inserta datos de ejemplo ni incorpora triggers nuevos de
administración de campañas. Las protecciones de condiciones corresponden a los
mecanismos existentes de C03/V05. El esquema `afiliados_privado` debe mantenerse
fuera de los esquemas expuestos por la Data API.

## Contrato SQL

`public.cotizar_carrito_afiliado(p_cafeteria_id bigint, p_items jsonb,
p_codigo text DEFAULT NULL)` recibe una cafetería y productos con
`producto_id` y `cantidad` enteros positivos. Admite 1–100 líneas y hasta 1000
unidades acumuladas por producto. El comprador procede de la sesión; los
precios enviados por el cliente no se usan.

Devuelve una fila con `subtotal`, `descuento_afiliado`, `total`, `comision`
y `motivo`. Los importes son enteros CLP. El descuento se redondea por grupo
normal/oferta y la comisión sobre el total descontado. Usar el código propio
mantiene el descuento y produce comisión cero.

`motivo=NULL` indica código elegible; `sin_codigo` conserva el precio vigente
sin beneficio. Los demás motivos son `codigo_invalido`, `codigo_desactivado`,
`campana_no_iniciada`, `campana_pausada`, `campana_finalizada`,
`campana_no_activa`, `campana_no_aceptada`, `condiciones_incompletas` y
`beneficio_usado`. Un código inelegible produce descuento y comisión cero.
Entradas inválidas: SQLSTATE `22023`. Acceso inválido: `42501`.

Las afiliaciones pendientes o rechazadas no tienen código canjeable por las
restricciones de V04. La campaña debe estar vigente y aceptada, con ambas tasas
definidas. El beneficio usado se consulta globalmente por comprador en las
atribuciones de comisión no revertidas, incluidas las de monto cero.

## Comprobación y alcance

La comprobación estructural se conserva en
`db_CoffeeFaster/tests/migraciones.cjs`: reconstrucción de migraciones y
verificación de permisos, sin fixtures de cotización en el repositorio.

La validación funcional de esta versión se ejecutó en PostgreSQL 17.12 aislado,
con Node 22.23.5, el 17 de noviembre de 2026. Se registraron entradas, salidas
esperadas y salidas observadas para los ejemplos de C01 y los estados exigidos
por V06. Se verificó además que la cotización no cambia datos de negocio.

La evidencia completa se conserva exclusivamente en el archivo opcional
`V06-Registro-entradas-salidas.md`, ubicado en este directorio. Se puede eliminar
sin afectar la migración ni sus comprobaciones estructurales. Los datos
ficticios existieron solo en una base desechable; no se incorporaron seeds ni
runners funcionales al proyecto.

La regla «cualquier usuario» de C01 se aplica al comprador: estudiantes, dueños
y empleados con cuenta y rol activos pueden cotizar usando su propia sesión.
La identidad nunca se recibe como parámetro de la función. Un rol o una cuenta
inactivos, una sesión ausente y los roles técnicos `anon`/`service_role` no
pueden ejecutar la cotización. Esto no amplía los permisos de administración
ni cambia los requisitos de aprobación del afiliado.

La cotización no modifica pedidos, stock, Wallet, afiliaciones ni movimientos.
C07 debe conectar la RPC al endpoint y mapear los motivos al contrato HTTP.
V07/V08 deben serializar, revalidar y registrar el consumo del beneficio junto
con el pago. No se aplicó SQL en Cloud.
