# C05 — Solicitud y resolución de afiliación

El estudiante puede solicitar afiliación a una campaña vigente y consultar sus solicitudes. El dueño puede listar y resolver las solicitudes de una campaña de su cafetería. Los reintentos de creación conservan la solicitud original. V05 genera o valida el código al aprobar y conserva su desactivación en los reintentos.

Las rutas se documentan en el [contrato C02](../../contratos-integracion-afiliados.md) y la [guía de operación](../operacion/README.md). El [SQL de C05](../../../database/fixes/exponer_solicitudes_afiliacion.sql) usa las migraciones `0020`, `0021`, `0023` y `0024` del [repositorio de base de datos](https://github.com/Diego24Vas/db_CoffeeFaster).

## Reproducir la validación

Desde la raíz, con Node.js 22, Docker y las dependencias de `ms-pedidos` instaladas, ejecuta:

```powershell
node .github/scripts/test-afiliados-auth-integration.cjs --c05
```

El runner busca las migraciones en `../db_CoffeeFaster/supabase/migrations`. Si el repositorio de BD está en otra ruta, define `COFFEEFAST_DB_MIGRATIONS` con la carpeta de migraciones. El runner levanta Auth, PostgREST, PostgreSQL y nginx desechables y utiliza JWT emitidos por Auth local.

| Escenario | Resultado esperado |
|---|---|
| Solicitudes concurrentes del estudiante para la misma campaña | Una creación `201` y reintentos `200` con el mismo ID |
| Dueño de otra cafetería o solicitud de otra campaña | `403` |
| Aprobación y reintento | Mismo ID y código, visibles en el perfil |
| Desactivación y rechazo | La desactivación se conserva y el rechazo queda sin código |
| Sesión ausente o inválida | `401` |
| Tres solicitudes por listado con PostgREST limitado a dos filas | Dos filas y cursor en la primera página, una fila en la segunda y ninguna al consultar antes de la última. Un cursor inválido devuelve `400` |

## Resultado

En Windows con Node.js 22.23.5 pasaron los seis escenarios de integración y las 178 pruebas de Jest de `ms-pedidos`. La integración usó exclusivamente contenedores locales y datos de prueba. La validación en Cloud queda pendiente.
