# 📚 Índice y clasificación de la documentación

Estado de los documentos de `docs/` tras la limpieza del repositorio.

**Leyenda**

- **ACTUAL** — describe el estado vigente del proyecto.
- **ACTUALIZAR** — correcto en lo general, pero tiene partes desactualizadas.
- **OBSOLETO** — describe arquitecturas que ya no existen; se conserva solo como
  referencia histórica. **No usar como guía.**

| Documento | Estado | Notas |
|---|---|---|
| [`puesta_en_marcha_flujo_pedidos.md`](./puesta_en_marcha_flujo_pedidos.md) | **ACTUAL** | Guía principal: levantar el entorno, migraciones, cuentas de prueba y el flujo pago → preparación → retiro por QR. |
| [`notificaciones_voz_elevenlabs.md`](./notificaciones_voz_elevenlabs.md) | **ACTUAL** | Aviso de voz del KDS (Edge Function `voz-pedido`). Las referencias a `scrips_database/` se corrigieron a `database/`. |
| [`pruebas_flujo_catalogo.md`](./pruebas_flujo_catalogo.md) | **ACTUALIZAR** | Prueba del flujo de catálogo (T11); revisar contra el estado actual. |
| [`notificaciones_push_fcm.md`](./notificaciones_push_fcm.md) | **ACTUALIZAR** | FCM backend listo; el lado móvil quedó pendiente. Revisar. |
| [`investigacion_supabase.md`](./investigacion_supabase.md) | **ACTUAL** | Investigación de referencia. |
| [`investigacion_Nodejs.md`](./investigacion_Nodejs.md) | **ACTUAL** | Investigación de referencia. |
| [`investigacion_Kotlin.md`](./investigacion_Kotlin.md) | **ACTUAL** | Investigación de referencia. |
| [`investigacion_escaner_dashboard.md`](./investigacion_escaner_dashboard.md) | **ACTUAL** | Investigación de referencia. |
| [`investigación_ react_electron.md`](./investigación_%20react_electron.md) | **ACTUAL** | Investigación de referencia (el nombre del archivo contiene un espacio). |
| [`secrets/supabase-secret.example.yaml`](./secrets/supabase-secret.example.yaml) | **ACTUAL** | Plantilla con placeholders; no contiene secretos reales. |
| [`obsoleto/arquitectura-microservicios.md`](./obsoleto/arquitectura-microservicios.md) | **OBSOLETO** | Arquitectura previa: `backend-node` + `inventario-service` desplegada con el extinto `k8s/`. El diseño vigente son 3 microservicios de negocio + gateway, bajo `Microservices/` y `k8s-next/`. |
| [`obsoleto/despliegue_kubernetes_backend.md`](./obsoleto/despliegue_kubernetes_backend.md) | **OBSOLETO** | Despliegue del backend legacy sobre el extinto `k8s/`. Se conserva por la advertencia de seguridad sobre `kubectl apply -R`, que sigue vigente. |
| [`obsoleto/flujo_integracion_conexion_apps.md`](./obsoleto/flujo_integracion_conexion_apps.md) | **OBSOLETO** | Propone un **Orquestador NestJS** (`POST /api/v1/...`) que **no existe implementado**. Es una propuesta de diseño, no la arquitectura real. |

> **Archivo histórico:** los 3 documentos **OBSOLETOS** se movieron a `docs/obsoleto/`
> y se conservan solo como referencia histórica. El árbol de manifiestos legacy `k8s/`
> (`backend-node` + `inventario-service`) fue **eliminado** del repositorio.

> **Pendiente (aún no implementado):** el diseño de un **orquestador backend** que
> coordine los 3 microservicios se hará más adelante; todavía no se ha decidido la
> tecnología (Node/Express, NestJS, Go u otra). Nada de esto está construido.
