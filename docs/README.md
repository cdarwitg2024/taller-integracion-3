# Índice de documentación de CoffeeFast

Revisado el 1 de noviembre de 2026. **Código local, versión desplegada y evidencia histórica son estados diferentes.** La ausencia de un cambio en Cloud no se resuelve cambiando este índice.

- **VIGENTE:** guía contrastada con el código/configuración en esta revisión; sus pendientes se indican expresamente.
- **INTEGRACIÓN:** describe implementación actual y límites; conservar separadas sus propuestas y pruebas antiguas.
- **REFERENCIA / HISTÓRICO:** resultados de una tarea o entorno; no certifican el despliegue actual.
- **INVESTIGACIÓN:** material conceptual; no es un procedimiento operativo ni una garantía de versiones actuales.
- **OBSOLETO:** arquitectura retirada; no usar como receta.

## Guías vigentes

- [estado-actual.md](estado-actual.md)
- [puesta_en_marcha_flujo_pedidos.md](puesta_en_marcha_flujo_pedidos.md)
- [kubernetes/estado-actual.md](kubernetes/estado-actual.md)
- [kubernetes/freeze-48h.md](kubernetes/freeze-48h.md)

## Integraciones

- [notificaciones_voz_elevenlabs.md](notificaciones_voz_elevenlabs.md)
- [notificaciones_push_fcm.md](notificaciones_push_fcm.md)

## Referencia técnica y evidencias

- [base-datos/D2.1_cancelacion_reembolso.md](base-datos/D2.1_cancelacion_reembolso.md)
- [base-datos/D4_validacion_qr_entrega.md](base-datos/D4_validacion_qr_entrega.md)
- [base-datos/dependencias-sql-ms-pedidos.md](base-datos/dependencias-sql-ms-pedidos.md)
- [seguridad/consulta_qr_ms_pedidos_s2_t14.md](seguridad/consulta_qr_ms_pedidos_s2_t14.md)
- [seguridad/consulta_segura_movimientos_s2_t12.md](seguridad/consulta_segura_movimientos_s2_t12.md)
- [seguridad/ms-pedidos-entornos-s2-t14.md](seguridad/ms-pedidos-entornos-s2-t14.md)
- [autenticacion/auditoria_confirmacion_correo.md](autenticacion/auditoria_confirmacion_correo.md)
- [autenticacion/flujo_confirmacion_cuenta_s2_t2.md](autenticacion/flujo_confirmacion_cuenta_s2_t2.md)
- [autenticacion/persistencia_edicion_perfil_s2_t15.md](autenticacion/persistencia_edicion_perfil_s2_t15.md)
- [autenticacion/resolucion_incidencias_cuenta_s2_t18.md](autenticacion/resolucion_incidencias_cuenta_s2_t18.md)
- [autenticacion/validacion_integrada_perfil_wallet_cancelacion_s2_t17.md](autenticacion/validacion_integrada_perfil_wallet_cancelacion_s2_t17.md)
- [local/S2-T19-Incidencias-Mobile.md](local/S2-T19-Incidencias-Mobile.md)

## Informes de Kubernetes

- [kubernetes/configuracion-fortio-carga.md](kubernetes/configuracion-fortio-carga.md)
- [kubernetes/configuracion-hpa-microservicios.md](kubernetes/configuracion-hpa-microservicios.md)
- [kubernetes/diagnostico-pods-pending-ms-menus.md](kubernetes/diagnostico-pods-pending-ms-menus.md)
- [kubernetes/preparacion-autoscaling-ms-menus.md](kubernetes/preparacion-autoscaling-ms-menus.md)
- [kubernetes/retiro-ms-inventario-legado.md](kubernetes/retiro-ms-inventario-legado.md)
- [kubernetes/verificacion-autoscaling-bajo-carga.md](kubernetes/verificacion-autoscaling-bajo-carga.md)
- [kubernetes/verificacion-metrics-api-autoscaling.md](kubernetes/verificacion-metrics-api-autoscaling.md)
- [kubernetes/verificacion-multiples-replicas-ms-menus.md](kubernetes/verificacion-multiples-replicas-ms-menus.md)

## Investigaciones

- [investigacion_escaner_dashboard.md](investigacion_escaner_dashboard.md)
- [investigacion_Kotlin.md](investigacion_Kotlin.md)
- [investigacion_Nodejs.md](investigacion_Nodejs.md)
- [investigacion_supabase.md](investigacion_supabase.md)
- [investigación_ react_electron.md](investigación_%20react_electron.md)

## Informes de validación

- [S2-T18_validacion_panel_administrativo.md](S2-T18_validacion_panel_administrativo.md)
- [pruebas_flujo_catalogo.md](pruebas_flujo_catalogo.md)

## Arquitectura retirada

- [obsoleto/arquitectura-microservicios.md](obsoleto/arquitectura-microservicios.md)
- [obsoleto/despliegue_kubernetes_backend.md](obsoleto/despliegue_kubernetes_backend.md)
- [obsoleto/flujo_integracion_conexion_apps.md](obsoleto/flujo_integracion_conexion_apps.md)

## Manifiestos y validaciones de Desktop

- [Despliegue Kubernetes](../k8s-next/DESPLIEGUE.md).
- [Configuración del gateway](../k8s-next/gateway/README.md).
- [Validación KDS T15](../app-desktop/docs/S2-T15-Validacion-Flujo-Integrado-KDS.md) y [T17](../app-desktop/docs/S2-T17-Validacion-Flujo-Completo-KDS.md): evidencias históricas.
- [Plantilla de Secret](secrets/supabase-secret.example.yaml): referencia con placeholders; nunca aplicar como Secret real.

No hay un orquestador NestJS /api/v1 implementado. La arquitectura actual usa gateway Nginx y tres microservicios. Las propuestas archivadas no son requisitos automáticamente pendientes. backend-node sigue presente como legacy parcialmente consumido; su retiro no está completado.
