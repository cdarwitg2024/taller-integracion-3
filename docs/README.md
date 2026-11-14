# Índice de documentación de CoffeeFast

[Estado funcional del proyecto](estado-actual.md) · [Estado de Kubernetes](kubernetes/estado-actual.md)

Las guías de operación, investigaciones y evidencias de validación se agrupan por componente. Los informes de tareas anteriores registran el resultado de su entorno y fecha. Las propuestas de arquitectura retirada se conservan como referencia histórica.

## Escritorio

### Investigación

- [Investigación de tecnologías para React y Electron](desktop/investigacion/investigacion_escaner_dashboard.md)
- [Investigación: Vite + React + MUI + Electron](desktop/investigacion/investigacion_react_electron.md)

### Notificaciones

- [Notificaciones de voz en el KDS con ElevenLabs (TTS)](desktop/notificaciones/notificaciones_voz_elevenlabs.md)

### Validación

- [V01 / CAM-223 — Acceso Afiliados del dueño](desktop/validacion/V01-CAM-223-Acceso-Afiliados.md)
- [E03 / CAM-290 — Vista principal de campañas del dueño](desktop/validacion/E03-CAM-290-Vista-Campanas.md)
- [S2-T15 - Validación flujo integrado y recuperación del KDS](desktop/validacion/S2-T15-Validacion-Flujo-Integrado-KDS.md)
- [S2-T17 - Validación flujo completo del KDS](desktop/validacion/S2-T17-Validacion-Flujo-Completo-KDS.md)
- [S2-T18 — Validación integrada del panel administrativo](desktop/validacion/S2-T18_validacion_panel_administrativo.md)

## Móvil

### Autenticación y perfil

- [Auditoría y Corrección de Confirmación de Correo y Redirección en Supabase Auth](mobile/autenticacion/auditoria_confirmacion_correo.md)
- [Implementación y Verificación del Flujo de Confirmación de Cuenta (S2-T2)](mobile/autenticacion/flujo_confirmacion_cuenta_s2_t2.md)
- [Documentación Técnica: Persistencia Real al Editar Perfil (S2-T15)](mobile/autenticacion/persistencia_edicion_perfil_s2_t15.md)
- [Validación y Resolución de Incidencias de Cuenta (S2-T18)](mobile/autenticacion/resolucion_incidencias_cuenta_s2_t18.md)
- [Documentación Técnica: Validación Integrada de Perfil, Wallet y Cancelación (S2-T17)](mobile/autenticacion/validacion_integrada_perfil_wallet_cancelacion_s2_t17.md)

### Guías

- [Guía de la app móvil](mobile/guias/react-native.md)

### Incidencias

- [S2-T19 - Incidencias Mobile encontradas en pruebas integradas](mobile/incidencias/S2-T19-Incidencias-Mobile.md)

### Investigación

- [Investigación de Kotlin para Android Studio](mobile/investigacion/investigacion_Kotlin.md)

### Seguridad

- [Integración de Consulta Segura de Movimientos y Aislamiento por Wallet (S2-T12)](mobile/seguridad/consulta_segura_movimientos_s2_t12.md)

### Validación

- [S2-T17 - Validar flujo Mobile de disponibilidad y carrito](mobile/validacion/S2-T17-Validacion-Flujo-Mobile-Disponibilidad-y-Carrito.md)

## Backend Node

### Guías

- [Backend legacy de CoffeeFast](backend-node/guias/README.md)

### Investigación

- [Investigación: Node.js con Express](backend-node/investigacion/investigacion_Nodejs.md)

## Microservicios

### Operación

- [Microservicios de CoffeeFast — entorno local](microservicios/operacion/README.md)
- [S2-T14: identidad y version de ms-pedidos](microservicios/operacion/ms-pedidos-entornos-s2-t14.md)
- [Puesta en marcha — apps, gateway y Supabase](microservicios/operacion/puesta_en_marcha_flujo_pedidos.md)

### Seguridad

- [Alineación de Consulta QR Mobile con ms-pedidos (S2-T14)](microservicios/seguridad/consulta_qr_ms_pedidos_s2_t14.md)

### Validación

- [Prueba del flujo de catálogo — T11](microservicios/validacion/pruebas_flujo_catalogo.md)

## Bot de Telegram

### Integración

- [🤖 Integración del Bot de Alertas de Stock Bajo (Supabase + Python)](bot-telegram/integracion/README.md)

## Pruebas y CI/CD

### CI/CD

- [CI/CD de CoffeeFast](calidad/ci-cd/CI-CD.md)

### Validación

- [Revisión de pruebas para CI/CD](calidad/validacion/revision-pruebas.md)

## Afiliados

- [C01 · Reglas del piloto de afiliados](reglas-piloto-afiliados.md)
- [C02 · Contratos de integración de afiliados](contratos-integracion-afiliados.md)

## Base de datos

- [D.2.1 — Cancelación de pedido con reembolso a Wallet (traspaso a Base de Datos)](base-datos/D2.1_cancelacion_reembolso.md)
- [D.4 — Validación QR y entrega de pedido (traspaso a Base de Datos)](base-datos/D4_validacion_qr_entrega.md)
- [S2-T16 — Dependencias SQL del flujo de pedidos](base-datos/dependencias-sql-ms-pedidos.md)
- [Promociones y configuración del dueño](base-datos/promociones-configuracion-dueno.md)

### Investigación

- [Investigación: Supabase](base-datos/investigacion/investigacion_supabase.md)

## Kubernetes

- [Configuración de Fortio para pruebas de carga](kubernetes/configuracion-fortio-carga.md)
- [Configuración de Horizontal Pod Autoscaler en CoffeeFast](kubernetes/configuracion-hpa-microservicios.md)
- [Diagnóstico de Pods Pending en ms-menus](kubernetes/diagnostico-pods-pending-ms-menus.md)
- [Kubernetes — referencia vigente](kubernetes/estado-actual.md)
- [Freeze de main, evidencia y ensayo HPA](kubernetes/freeze-48h.md)
- [Preparación de ms-menus para Horizontal Pod Autoscaler](kubernetes/preparacion-autoscaling-ms-menus.md)
- [Retiro de ms-inventario legado](kubernetes/retiro-ms-inventario-legado.md)
- [Verificación de Autoscaling bajo carga](kubernetes/verificacion-autoscaling-bajo-carga.md)
- [Verificación de Metrics API para Autoscaling](kubernetes/verificacion-metrics-api-autoscaling.md)
- [Verificación de múltiples réplicas de ms-menus](kubernetes/verificacion-multiples-replicas-ms-menus.md)

### Operación

- [Despliegue Kubernetes de CoffeeFast](kubernetes/operacion/DESPLIEGUE.md)
- [Gateway Nginx](kubernetes/operacion/gateway.md)

## Documentación histórica de arquitectura retirada

- [Arquitectura de Microservicios — CoffeeFast](obsoleto/arquitectura-microservicios.md)
- [Guía y Registro de Despliegue en Kubernetes (K8s)](obsoleto/despliegue_kubernetes_backend.md)
- [Flujo de Integración y Conexión de Apps](obsoleto/flujo_integracion_conexion_apps.md)

## Recursos compartidos

- [Logo CoffeeFast](figma/LogoCoffeeFast.png)
- [Plantilla de Secret de Supabase](secrets/supabase-secret.example.yaml)
