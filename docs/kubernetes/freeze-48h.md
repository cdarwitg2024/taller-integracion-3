# Freeze de main, evidencia y ensayo HPA

Plan revisado el 1 de noviembre de 2026; no ejecuta cambios. La presentación está confirmada para el miércoles 4 de noviembre, con hora pendiente. El límite de 48 horas será el lunes 2 a esa hora; confirmar con el profesor. No interpretar el martes como 48 horas antes del miércoles.

## Secuencia de cierre

- [ ] Terminar/revisar cambios en la rama de trabajo; no incluir novedades ajenas al alcance.
- [ ] Ejecutar pruebas y build de la versión que se pretende entregar.
- [ ] Commit/push revisados y PR hacia develop; validar resultado integrado.
- [ ] Integrar develop a main antes del límite; registrar SHA completo.
- [ ] Construir desde ese SHA limpio, etiquetar por SHA, registrar digest y revisión OCI.
- [ ] Publicar/desplegar con autorización antes del freeze; comprobar Ready, endpoints y TLS.
- [ ] Verificar también RPC/RLS, voz y las configuraciones externas que use la demostración.
- [ ] Guardar evidencia, ensayar y no depender de cambios posteriores al freeze.

En la auditoría, main/origin/main estaban en df5742b576561781d4c7d4c03f7a09b175702383 y develop en 40d43fe1367d27e50ff0f2bc65c8a7ce5aee0b11 (164 commits por integrar). Son observaciones históricas, NO el SHA final congelado. Volver a consultar tras los merges.

## Guion de lectura (1–2 minutos)

~~~powershell
git rev-parse main
git log -1 --oneline main
git status --short
kubectl -n student-cdarwitg get deploy -o custom-columns='NOMBRE:.metadata.name,IMAGEN:.spec.template.spec.containers[*].image,READY:.status.readyReplicas'
kubectl -n student-cdarwitg get rs
kubectl -n student-cdarwitg get pods -o custom-columns='POD:.metadata.name,OWNER:.metadata.ownerReferences[0].name,IMAGEN:.spec.containers[*].image,IMAGE_ID:.status.containerStatuses[*].imageID,READY:.status.containerStatuses[*].ready'
~~~

No hacer checkout/pull durante la explicación. Presentar el registro de construcción que vincule SHA, revisión OCI y digest; comparar digest con imageID. La cadena Pod → ReplicaSet → Deployment se comprueba en ownerReferences. El tag por sí solo no demuestra origen. Enseñar además la configuración versionada del gateway, porque está montada fuera de la imagen.

## Ensayo 1 → 2 réplicas: propuesta, no ejecutada

Usar ms-menus: GET de catálogo sin escritura. El endpoint consulta Supabase; coordinar la carga para no saturar la BD compartida.

1. Consultar HPA, Pods, metrics y quota. No iniciar si hay Pending, errores o métricas desconocidas.
2. Si ya hay una réplica y el HPA permite 1–2, no cambiar nada. El máximo actual es 3: para una demostración estrictamente 1→2, acordar un ajuste temporal a máximo 2 y registrar los valores originales. No escalar manualmente contra un HPA activo; coordinar la línea base y esperar estabilización.
3. En terminales separadas observar: get hpa ms-menus -w; get pods -l app=ms-menus -w; get events --watch. Registrar todo con timestamps y conservar eventos SuccessfulRescale, creationTimestamp y transición Ready.
4. Con autorización, ejecutar comandos-fortio.ps1 primero a 10 QPS/5 s/2 conexiones; si es estable, subir de forma gradual y medir. Los valores sugeridos en el script no garantizan escalado. No usar creación de pedidos ni pagos como carga.
5. T0: inicio efectivo de Fortio. T1: evento de escalado o lastScaleTime nuevo del HPA (distinguir tiempo del evento y momento observado). T2: transición Ready del nuevo Pod. Reportar T1−T0, T2−T1 y T2−T0; no presentar polling como precisión exacta del controlador.
6. Usar duración finita; Ctrl+C permite interrumpir. No borrar el Pod Fortio compartido sin acuerdo ni dejar procesos de carga en segundo plano.
7. Verificar descenso tras ventana scaleDown de 300 s más los tiempos de reconciliación; restaurar ajustes temporales autorizados y comprobar HPA, Ready y errores.
8. Ensayar antes del freeze, no improvisar modificaciones en la presentación. La estrategia de freeze debe permitir expresamente el ensayo de carga y escalado sin alterar imágenes/configuración congeladas.

La readiness indica que el Pod puede entrar en los endpoints del Service; no certifica todas las dependencias de negocio. El HPA decide según CPU respecto de requests (objetivo local: 70 % de 50m), no por el número de pedidos.
