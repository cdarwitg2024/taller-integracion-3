# Instrucciones para agentes en CoffeeFast

## Antes de editar

1. Lee [el README del repositorio](README.md) y [el estado funcional](docs/estado-actual.md) para ubicar el flujo afectado.
2. Usa [el índice de documentación](docs/README.md) para encontrar la guía del componente. Lee solo los documentos relacionados con la tarea.
3. Contrasta los contratos y comandos con el código, los manifiestos y los workflows. Los informes históricos documentan un entorno y una fecha. Si encuentras una discrepancia relevante, indica qué verificaste y actualiza la guía afectada cuando corresponda.

## Rutas del proyecto

| Componente | Código | Punto de entrada documental |
|---|---|---|
| Móvil | `app-mobile/` | [Guía móvil](docs/mobile/guias/react-native.md) |
| Escritorio y KDS | `app-desktop/` | [Documentación de escritorio](docs/README.md#escritorio) |
| Gateway y microservicios | `Microservices/` | [Entorno local](docs/microservicios/operacion/README.md) y [flujo de pedidos](docs/microservicios/operacion/puesta_en_marcha_flujo_pedidos.md) |
| Backend legacy | `backend-node/` | [Alcance del backend legacy](docs/backend-node/guias/README.md) |
| Bot de Telegram | `BotTelegramCoffeFaster/` | [Guía del bot](docs/bot-telegram/integracion/README.md) |
| PostgreSQL y Supabase | `database/fixes/`, `app-mobile/tabla_mobile/`, `supabase/` | [Documentación de base de datos](docs/README.md#base-de-datos) |
| CI/CD y Kubernetes | `.github/workflows/`, `k8s-next/` | [CI/CD](docs/calidad/ci-cd/CI-CD.md) y [despliegue](docs/kubernetes/operacion/DESPLIEGUE.md) |

## Contratos que conviene preservar

- La compra móvil entra por el gateway y `ms-pedidos`. El servicio consulta los precios de `ms-menus` y ejecuta `procesar_pago` con la sesión del comprador. `backend-node` conserva funciones legacy.
- La cancelación y el reembolso se realizan mediante `cancelar_pedido`. La reposición depende de `stock_descontado`. Los pedidos históricos pueden tener esa marca en `false`.
- El UUID de Supabase Auth se vincula al ID interno de `usuarios`. Comprueba el alcance por usuario o cafetería en los cambios de acceso. Las credenciales de retiro se leen de los valores persistidos.
- Usa los entornos locales o desechables para las pruebas. La publicación de imágenes, el despliegue en Kubernetes y la aplicación de SQL en Cloud requieren autorización para esa operación. Mantén credenciales y archivos `.env` fuera de los cambios y de los registros.

## Comprobaciones por cambio

Usa Node.js 22 para reproducir CI. Con las dependencias instaladas, ejecuta desde la raíz las comprobaciones que correspondan al alcance:

- Móvil: `npm test --prefix app-mobile -- --ci --runInBand`.
- Escritorio: `npm test --prefix app-desktop`. Para cambios que afecten la compilación, ejecuta también `npm run build --prefix app-desktop`. La instalación de CI usa `npm ci --legacy-peer-deps`.
- Microservicios: `npm test --prefix Microservices/<servicio> -- --ci`. Sigue `ci-microservices.yml` para resolver las dependencias de `shared` y reproducir las comprobaciones de Docker.
- Backend legacy: `npm test --prefix backend-node -- --ci --runInBand`.
- Telegram: `python -m pytest -q` desde `BotTelegramCoffeFaster`. `ci-functional.yml` describe la preparación del PostgreSQL de prueba y también ejecuta catálogo y transacciones SQL.
- Documentación: comprueba los enlaces relativos y ejecuta `git diff --check`.

Registra qué comprobaste y en qué entorno. Usa el [registro de validación](docs/calidad/validacion/revision-pruebas.md) como referencia para distinguir pruebas automatizadas, pruebas manuales y casos pendientes. Para acreditar un despliegue, relaciona el SHA, el manifiesto de publicación y la imagen de los Pods listos.
