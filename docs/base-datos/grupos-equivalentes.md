# S3-T6 / CAM-228 — grupos equivalentes

Implementación publicada en `develop` de `db_CoffeeFaster`, migración
`20261117184822_crear_grupos_equivalentes.sql`, posterior a V06:
[commit 668533b](https://github.com/Diego24Vas/db_CoffeeFaster/commit/668533b4e3ea64a43cf63a29bb62f574c8fdc03c).
No se duplica el SQL en las aplicaciones. La revisión de Camilo está pendiente;
no se aplicó SQL a Cloud.

## Modelo y contrato

`public.grupos_equivalentes` contiene únicamente:

| Campo | Regla |
|---|---|
| `id` | `bigint`, identidad generada, clave primaria |
| `tipo` | Código ASCII canónico de hasta 80 caracteres; inicia con letra minúscula y admite letras, números y palabras separadas por `_` |
| `presentacion` | Código ASCII canónico de hasta 80 caracteres; letras minúsculas, números y palabras separadas por `_` |

La combinación `(tipo, presentacion)` es única y ambos campos son obligatorios.
Se rechazan espacios, mayúsculas, acentos y separadores repetidos. Son claves
controladas por el backend, no etiquetas libres que el cliente deba normalizar.
Una presentación debe identificar cantidad y unidad cuando corresponda. Por
ejemplo, `cafe_americano` / `vaso_250_ml` es una combinación ilustrativa; no se
inserta mediante la migración ni constituye un catálogo inicial aprobado.

`public.productos.grupo_equivalente_id` es una clave foránea nullable, sin
default. `NULL` significa producto aún no clasificado, válido en el flujo previo.
El tipo y la presentación se obtienen desde el grupo; no se duplican en productos.
No se infiere equivalencia a partir del nombre, la categoría ni `unidad`.

Dos productos de cafeterías distintas son comparables por este modelo solo si
comparten un `grupo_equivalente_id` no nulo. Para consultar equivalentes se usa
igualdad sobre ese ID; no se agrupan productos con NULL. La disponibilidad y el
precio efectivo siguen siendo condiciones adicionales de la consulta de A15.

La referencia usa `ON UPDATE RESTRICT` y `ON DELETE RESTRICT`. No se borra ni se
renumera un grupo referenciado. Un índice parcial sobre grupos no nulos prepara
el filtrado y la comprobación de la clave foránea sin indexar productos sin grupo.
No se alteran nombres, precios, stock ni asignaciones previas.

## Permisos

| Actor | Catálogo de grupos | Clasificación de productos |
|---|---|---|
| `anon` | Sin acceso | Conserva sus permisos previos; no obtiene escritura |
| `authenticated` con UID | Lectura global del catálogo compartido | Conserva la RLS existente de productos |
| `authenticated` sin UID | Sin filas visibles del catálogo | No se amplían sus permisos |
| Dueño/empleado | Sin altas, ediciones ni borrados del catálogo | Sus permisos previos permiten operar productos de cafeterías asignadas |
| Estudiante | Lectura del catálogo | No modifica productos |
| Backend `service_role` | SELECT e INSERT; sin UPDATE, DELETE o TRUNCATE | Conserva su alcance técnico existente |

El catálogo es global y no contiene datos privados de una cafetería. Por eso la
lectura no se filtra por dueño. El catálogo se administra desde el backend; la
credencial `service_role` nunca debe enviarse a Mobile o Desktop. Los permisos
por defecto se revocan expresamente tanto en tabla como en secuencia.

No se agregan políticas nuevas a productos ni funciones o triggers adicionales.
Los controles actuales de pertenencia a cafetería siguen aplicándose a las
altas y modificaciones de productos, incluida la nueva referencia.

## Validación y tareas posteriores

La prueba de migraciones verifica estructura y permisos con propietario sin
superusuario. La validación funcional se ejecutó con el esquema histórico real,
datos ficticios solo en PostgreSQL desechable y roles SQL de dueño, empleado,
estudiante, `anon` y backend. Se adaptan únicamente los servicios de Auth.

Resultado del 17 de noviembre de 2026: **50/50 casos funcionales aprobados**
en PostgreSQL 17.12 con Node 22.23.5 y reconstrucción completa de migraciones
aprobada con propietario sin superusuario.

Las entradas, SQL y salidas observadas se conservan en el archivo independiente
`validacion/S3-T6-Registro-entradas-salidas.md`. Puede eliminarse sin afectar
la implementación. No se añadieron runners funcionales ni seeds a los repositorios.

S3-T7/S3-T8 incorporan los controles y la persistencia desde escritorio. A15
implementa la consulta backend de ofertas equivalentes. S3-T6 define el modelo
que deben consumir; no incorpora esas pantallas ni endpoints.

Antes de cerrar CAM-228, Camilo debe revisar la migración y acordar el vocabulario
de tipos, presentaciones y unidades. C02 figura completada en Linear, pero su
documento actual cubre afiliaciones y no define este catálogo: este contrato
explicita la propuesta de S3-T6 sin atribuir una aprobación aún no realizada.
