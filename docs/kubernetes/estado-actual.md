# Kubernetes — referencia vigente

Revisión: 1 de noviembre de 2026. Los datos de ejecución siguientes son una observación de esa fecha, no una garantía permanente ni una prueba de origen Git de las imágenes.

## Arquitectura y observación

Contexto consultado: estudiante-cdarwitg. Namespace de los recursos: student-cdarwitg. No confundir estos dos nombres.

| Deployment | Imagen declarada y observada | Réplicas disponibles observadas |
|---|---|---|
| gateway | nginx:1.27-alpine | 1/1 |
| ms-cafeterias | cdarwitg2024/ms-cafeterias:v1.0.0 | 1/1 |
| ms-menus | cdarwitg2024/ms-menus:v1.0.0 | 1/1 |
| ms-pedidos | cdarwitg2024/ms-pedidos:v1.0.3 | 1/1 |

Los cuatro Pods de aplicación estaban Running/Ready. También se observó el Pod standalone fortio, que no es un quinto Deployment de negocio. Su imagen es fortio/fortio (latest implícito).

Los tres HPA observados: CPU 2 % / objetivo 70 %, mínimo 1, máximo 3, una réplica. Los manifiestos definen requests de 50m CPU/64Mi y límites de 150m/128Mi por contenedor de aplicación. Cuatro réplicas base requieren 200m CPU; Fortio agrega 25m. No usar 250m como total garantizado: contar las réplicas y recursos reales del namespace antes de escalar.

Los HPA tienen scaleUp sin estabilización y ventanas de políticas de 15 s; scaleDown estabiliza 300 s. La sincronización del controlador y disponibilidad de métricas también influyen. Estos valores no prometen un tiempo fijo de escalado.

ms-inventario no está en los manifiestos actuales ni en los recursos consultados de este namespace. Un contenedor Docker local antiguo con ese nombre no demuestra un Deployment Kubernetes vigente. backend-node todavía conserva su cliente HTTP legacy: no se retiró funcionalmente.

## Entrada y configuración

api-cdarwitg.dev.censei.cl → Ingress api-cdarwitg-ingress (clase nginx) → Service gateway:80 → Nginx → Service del microservicio → Pod Ready.

Puertos internos: cafeterías 3002, menús 3003, pedidos 3005. /api/menus/precios está bloqueado públicamente, pero ms-pedidos consulta ese endpoint por la red interna.

El gateway usa gateway-nginx-config. Su fuente versionada es k8s-next/gateway/nginx.conf; el configmap.yaml debe contener la misma configuración. El resolver 10.43.40.162 es específico del clúster: verificarlo al cambiar de entorno, no usarlo como DNS universal. Los upstream incluyen student-cdarwitg.

Los servicios usan coffeesecret-supabase. ms-pedidos necesita SUPABASE_URL, SUPABASE_SERVICE_KEY y SUPABASE_PUBLISHABLE_KEY. No imprimir Secrets, reutilizar plantillas como valores reales ni incluirlos en el repositorio.

Las sondas /health comprueban el proceso, no disponibilidad completa de Supabase/RPC. La última comprobación de HTTPS público detectó certificado autofirmado; no se considera resuelto por un health interno exitoso. No desactivar validación TLS en las apps.

## Consultas de solo lectura

~~~powershell
kubectl config current-context
kubectl -n student-cdarwitg get deploy,pods,svc,ingress,hpa -o wide
kubectl -n student-cdarwitg get rs
kubectl -n student-cdarwitg top pods
kubectl -n student-cdarwitg get resourcequota,limitrange
kubectl -n student-cdarwitg get endpointslices
kubectl -n student-cdarwitg get events --sort-by=.metadata.creationTimestamp
~~~

Si expira la autenticación del contexto, completar el acceso del clúster antes de interpretar un timeout como caída de los Pods.

## Trazabilidad y despliegue

Los tags actuales y imagePullPolicy=IfNotPresent no prueban correspondencia con main. En la recuperación local de los tres scripts se alineó el tag predeterminado de pedidos a v1.0.3, igual que deployment.yaml; cafeterías/menús conservan v1.0.0. No se construyeron ni publicaron imágenes ni se actualizó el clúster por esta corrección.

Recomendación pendiente de implementación: construir desde un commit limpio de main, etiquetar con SHA y label OCI org.opencontainers.image.revision, registrar digest y usar la imagen por digest en Deployment. Versionar además el ConfigMap de gateway; el digest de nginx no representa su configuración montada. SQL, Edge Functions y configuración externa requieren evidencia separada.

Ver [despliegue](operacion/DESPLIEGUE.md) y [freeze/HPA](freeze-48h.md). No se ejecutaron despliegues ni cargas al actualizar esta documentación.

## Revisión local tras recuperar los comentarios

- Los 14 YAML de `k8s-next` conservan los valores operativos de HEAD. La comparación del ConfigMap descarta comentarios y espacios del texto Nginx, sin confundir formato con cambios de proxy.
- ConfigMap y archivo Nginx contienen la misma configuración. `nginx -t` aprobado en contenedor temporal local, sin red, usuario 101, raíz de solo lectura y capabilities retiradas.
- Scripts build/push/Fortio restaurados por separado, sintaxis PowerShell comprobada sin ejecutarlos. Tags predeterminados alineados con los Deployments.
- Pruebas existentes: cafeterías 22, menús 36, pedidos 131 y shared 5; total 194 aprobadas, sin cambiar los tests.
- Gateway de Compose comprobado con consultas de lectura: salud/cafeterías/menús 200; pedidos sin JWT 401; cotización interna por gateway 404.
- No se aplicaron manifiestos, no se publicaron imágenes y no se ejecutó Fortio. Estas verificaciones locales no certifican el estado actual del clúster ni un pago autenticado en producción.
