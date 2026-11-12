# Despliegue Kubernetes de CoffeeFast

Revisado el 11 de noviembre de 2026 contra los workflows y manifiestos locales. La última inspección documentada del clúster conserva su fecha. Ver [estado observado](../estado-actual.md).

## Entrega de una versión de main

1. Ejecutar **CD Docker** en `main` con la publicación habilitada. El workflow exige los cuatro CI y publica un manifiesto `release.json` con el SHA y los digests de los tres microservicios.
2. Ejecutar **CD Kubernetes** para el mismo SHA con el ID del run exitoso y la autorización del workflow. El validador comprueba el manifiesto antes de acceder al clúster y el workflow actualiza las imágenes por digest.
3. Conservar el SHA, el manifiesto, el resultado del rollout y el `imageID` de los Pods listos como evidencia de trazabilidad. Consultar los pasos y comandos en [CI/CD](../../calidad/ci-cd/CI-CD.md#revisar-errores-y-reconocer-el-commit-desplegado).

## Antes de publicar

1. Acordar el commit final, revisar working tree y ejecutar pruebas/builds de esa versión.
2. Verificar acceso al contexto y namespace student-cdarwitg; consultar quota y HPA.
3. Verificar credenciales y funciones de Supabase por canales autorizados. No aplicar todos los fixes/seeds ni plantillas de Secret.
4. Elegir y registrar imágenes definitivas. Los scripts restaurados usan por defecto v1.0.0 para cafeterías/menús y v1.0.3 para pedidos, igual que los Deployments. La coincidencia del tag no demuestra que la imagen publicada corresponda a este checkout.
5. El contexto Docker es Microservices/, con Dockerfile por servicio. Gateway usa nginx:1.27-alpine y ConfigMap, no una imagen propia construida por esos scripts.
6. No mezclar los tags :local de Compose con las imágenes cdarwitg2024 utilizadas en Kubernetes.

Los comandos vuelven a estar separados: `comandos-build.ps1` construye, `comandos-push.ps1` publica y `comandos-fortio.ps1` ejecuta carga sobre el Pod existente. Los dos primeros aceptan `-Registry`, `-TagCatalogo` y `-TagPedidos`; cambiar esos parámetros exige coordinar las imágenes declaradas en los Deployments. No se ejecutan al consultar esta guía. La antigua guía combinada `comandos.ps1` se retiró para evitar duplicación.

Revisión local de manifiestos: los valores operativos de Deployment/Service/HPA/Ingress/Fortio se conservaron respecto de HEAD; se corrigieron comentarios. El archivo Nginx y el contenido del ConfigMap se mantienen idénticos. Ninguna de estas ediciones aplica cambios al clúster.

## Mantenimiento de manifiestos

Usar estos comandos para cambios de manifiesto autorizados. Antes de aplicar un Deployment, comparar su imagen con la imagen efectiva para evitar reemplazar un digest del CD con el tag histórico del archivo. Los HPA gobiernan las réplicas durante las mediciones de carga.

~~~powershell
kubectl apply -f k8s-next/ms-cafeterias/deployment.yaml
kubectl -n student-cdarwitg rollout status deployment/ms-cafeterias
kubectl apply -f k8s-next/ms-menus/deployment.yaml
kubectl -n student-cdarwitg rollout status deployment/ms-menus
kubectl apply -f k8s-next/ms-pedidos/deployment.yaml
kubectl -n student-cdarwitg rollout status deployment/ms-pedidos
~~~

Si Services/HPA ya existen, comparar primero y aplicar solo los archivos que corresponda actualizar. Gateway depende de su Service, ConfigMap y Deployment; un cambio del ConfigMap no demuestra que los procesos Nginx hayan recargado la configuración. Revisar y realizar el rollout correspondiente cuando esté autorizado. Ingress se define en ingress-api.yaml.

Nunca usar apply recursivo sobre todo el árbol ni aplicar ejemplos de Secrets. No se necesita crear un Pod curl para una inspección rutinaria; las consultas de estado son de solo lectura.

## Verificación

~~~powershell
kubectl -n student-cdarwitg get deploy,pods,svc,ingress,hpa -o wide
kubectl -n student-cdarwitg get endpointslices
kubectl -n student-cdarwitg get events --sort-by=.metadata.creationTimestamp
~~~

Comprobar además API pública con TLS válido y flujo real autenticado. Running no implica Ready; Ready del proceso no prueba que las RPC estén correctamente desplegadas.

## Rollback

Ante un problema, registrar primero imagen/digest y configuración efectivos. Un rollout undo autorizado revierte la revisión del Deployment, pero no revierte SQL, Secrets, ConfigMap ni Edge Functions. La estrategia RollingUpdate tiene maxSurge=0 y maxUnavailable=1: con una sola réplica puede haber una interrupción durante el rollout.

El 1 de noviembre se activó el SQL de stock de compra/cancelación y promociones en Cloud, con respaldo y verificaciones reversibles. Esto no modifica las imágenes ni despliega Kubernetes. La trazabilidad de ese cambio está en database/fixes/activar_stock_promociones_cloud.sql.
