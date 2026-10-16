# Preparación de ms-menus para Horizontal Pod Autoscaler

> Tarea: S2-T2 — Camilo Darwitg — Preparar ms-menus para Autoscaling en Kubernetes
> Fecha: 2026-10-15
> Tipo de actividad: auditoría técnica read-only previa a HPA

## 1. Objetivo

El objetivo de S2-T2 fue **verificar si el Deployment `ms-menus` cumple los requisitos necesarios para implementar posteriormente un Horizontal Pod Autoscaler (HPA)**.

La tarea se planteó originalmente bajo el nombre de "Corregir recursos", lo que sugería modificar `requests`/`limits`. Sin embargo, la auditoría fue **read-only** y se asumió explícitamente que **no se modificarían CPU ni memoria sin evidencia técnica que lo justificara**. Tras la revisión no se encontró dicha evidencia, por lo que **no se cambió ningún recurso**.

Durante esta etapa **no se implementó HPA**, no se instaló Fortio, no se generó carga y no se modificó Metrics Server, ResourceQuota, LimitRange ni RBAC.

## 2. Configuración actual de ms-menus

| Elemento | Valor |
|---|---|
| Deployment | `ms-menus` |
| Namespace | `student-cdarwitg` |
| apiVersion | `apps/v1` |
| Imagen | `cdarwitg2024/ms-menus:v1.0.0` (`imagePullPolicy: IfNotPresent`) |
| replicas (manifiesto) | `1` |
| replicas (clúster) | `3` |
| containerPort | `3003` (name `http`) |
| CPU request | `50m` |
| CPU limit | `150m` |
| Memoria request | `64Mi` |
| Memoria limit | `128Mi` |
| readinessProbe | `GET /health` — `initialDelaySeconds 3`, `periodSeconds 5`, `timeoutSeconds 2`, `failureThreshold 3` |
| livenessProbe | `GET /health` — `initialDelaySeconds 10`, `periodSeconds 15`, `timeoutSeconds 2`, `failureThreshold 3` |
| strategy | `RollingUpdate` — `maxSurge: 0`, `maxUnavailable: 1` |
| Service | `ms-menus`, tipo `ClusterIP`, `selector app: ms-menus`, `port 3003 → targetPort http` |
| labels / selector | `app: ms-menus`, `ms: menus` / `matchLabels: app: ms-menus` |

## 3. Verificación de múltiples réplicas

Al momento de la auditoría:

- `ms-menus` estaba ejecutándose con **3 réplicas**;
- las **3 estaban `Running` y `Ready 1/1`**;
- el **Service `ms-menus` tenía 3 Endpoints**, correspondientes a las 3 réplicas (una por nodo: `rke2-estudiantes-agent-01/02/03`).

La capacidad de escalar ya había sido comprobada en **S2-T1**, donde se realizaron **dos ciclos controlados de escalamiento 1 → 3**: los Pods fueron programados correctamente, sin `FailedScheduling` ni `FailedCreate`, alcanzando `Running` en ~3–8 s y `Ready` en ~10–16 s.

**En S2-T2 no se repitieron estas pruebas.** El detalle completo está en `docs/kubernetes/diagnostico-pods-pending-ms-menus.md`.

## 4. Compatibilidad con HPA

| Requisito | Estado | Evidencia |
|---|---|---|
| Deployment escalable | **OK** | Subrecurso `scale` disponible (`update/patch deployments/scale = yes`); ya escaló en S2-T1 |
| Múltiples réplicas funcionan | **OK** | 3/3 Pods `Running`/`Ready` |
| Service selecciona todas las réplicas | **OK** | 3 Endpoints (`app: ms-menus`) |
| CPU requests definidos | **OK** | `requests.cpu: 50m` |
| ResourceQuota permite escalamiento adicional | **OK** | `pods 8/12`, `limits.cpu 1150m/2`, etc. |
| labels/selectors correctos | **OK** | `app: ms-menus` consistente en Deployment / ReplicaSet / Service |
| readiness funcional | **OK** | Los Pods alcanzan `Ready 1/1` |
| Metrics API (registrada) | **OK** | `metrics.k8s.io/v1beta1` presente en `api-versions` y en `--raw /apis/metrics.k8s.io` |
| Metrics API consumible por el HPA | **PENDIENTE** | Falta comprobar que el controlador HPA obtiene datos reales de CPU |
| Permisos para crear HPA | **OK** | `create/get/update horizontalpodautoscalers = yes` |

> **Nota:** la Metrics API **no se marca como completamente OK para HPA**. La API está **registrada**, pero falta comprobar que el **controlador HPA recibe datos reales** desde `metrics.k8s.io`.

## 5. Requests y Limits

Valores actuales:

```
requests:
  cpu: 50m
  memory: 64Mi
limits:
  cpu: 150m
  memory: 128Mi
```

- **Por qué `requests.cpu` es necesario para un HPA con `averageUtilization`:** el HPA calcula la utilización como `uso_promedio_de_CPU / requests.cpu_por_Pod`. Sin `requests.cpu` definido, no puede calcular el porcentaje y reportaría una métrica desconocida. En `ms-menus` el request **sí está definido** (`50m`), por lo que el cálculo es posible.
- **`50m`** equivale a `0.05` de un core (5 % de 1 vCPU).
- **Ejemplo con `averageUtilization: 70`:** el objetivo sería `0.70 × 50m ≈ 35m` de CPU promedio por Pod. El HPA escalaría al superar ese promedio y desescalaría por debajo (con la tolerancia por defecto).
- **Sensibilidad:** ese umbral (~35m) es un valor absoluto bajo, por lo que el HPA podría resultar **relativamente sensible** a la carga.
- **Evidencia para cambiarlo:** **NO existe todavía evidencia experimental suficiente** para modificar el request de CPU.

**Conclusión:** **mantener los valores actuales** (`requests 50m/64Mi`, `limits 150m/128Mi`). El ajuste, si fuera necesario, se realizará **después** de las pruebas de carga con Fortio.

## 6. ResourceQuota

ResourceQuota del namespace: `student-provisioner-quota`.

| Dimensión | Hard | Usado | Libre |
|---|---|---|---|
| pods | 12 | 8 | **4** |
| requests.cpu | 1 (1000m) | 375m | 625m |
| requests.memory | 1G (1024Mi) | 512Mi | 512Mi |
| limits.cpu | 2 (2000m) | 1150m | 850m |
| limits.memory | 2G (2048Mi) | 1Gi (1024Mi) | 1024Mi |

Cada réplica adicional de `ms-menus` consume aproximadamente:

```
+1 Pod
+50m  requests.cpu
+64Mi requests.memory
+150m limits.cpu
+128Mi limits.memory
```

Con el estado observado, la dimensión **más restrictiva era la cantidad de Pods** (8/12), es decir **~4 Pods adicionales disponibles**. Partiendo de 3 réplicas de `ms-menus`, eso daba un **techo teórico aproximado de 7 réplicas** bajo ese estado específico del namespace.

> **IMPORTANTE:** **7 no es un límite permanente.** La ResourceQuota es **compartida** por todo el namespace y su utilización **puede cambiar** si aparecen o desaparecen otros Pods. Para una futura demostración se considerará un `maxReplicas` **conservador**, y el valor definitivo se decidirá durante la configuración y prueba del HPA.

## 7. Drift entre repositorio y clúster

Existe un **drift declarativo** en el número de réplicas:

| Fuente | Valor |
|---|---|
| Repositorio (`k8s-next/ms-menus/deployment.yaml`) | `replicas: 1` |
| Clúster (`spec.replicas`) | `replicas: 3` |

El resto de la configuración relevante (resources, probes, strategy, labels/selectors, Service) **coincidía** entre el manifiesto y el Deployment real. Este drift **no fue corregido durante S2-T2**.

El manejo de `replicas` debe resolverse **junto con la implementación del HPA**, porque a partir de ese momento la cantidad de réplicas pasará a ser administrada dinámicamente por el autoscaler. Alternativas a considerar (la decisión definitiva corresponde a la implementación del HPA, **no a esta auditoría**):

- **mantener un valor inicial coherente con `minReplicas`** (por ejemplo, alinear `replicas` con el mínimo definido en el HPA); o
- **eliminar el campo `replicas`** y dejar que el **mínimo lo defina el HPA** (`minReplicas`).

No se afirma todavía que se vaya a eliminar `replicas`: es una de las alternativas a evaluar.

## 8. Readiness y Liveness

Durante **S2-T1** se observó inicialmente la advertencia:

```
Readiness probe failed: Get "http://<ip>:3003/health": dial tcp <ip>:3003: connect: connection refused
```

Es el comportamiento **normal de arranque** (el proceso Node aún no escucha en `3003` en la primera sonda). Posteriormente **todos los Pods alcanzaron correctamente `Running` y `Ready 1/1`**.

No existe evidencia de que la configuración de probes esté causando un problema.

**Conclusión:** **no modificar `readinessProbe` ni `livenessProbe`.**

## 9. Metrics API y RBAC

Lo comprobado:

- `kubectl api-versions` incluye **`metrics.k8s.io/v1beta1`**.
- `kubectl get --raw /apis/metrics.k8s.io` confirmó la existencia del **APIGroup**.
- `kubectl get --raw /apis/metrics.k8s.io/v1beta1` mostró los recursos:
  - `nodes` → `NodeMetrics`
  - `pods` → `PodMetrics`

Lo **no** disponible para el usuario:

- `kubectl auth can-i get/list pods.metrics.k8s.io -n student-cdarwitg` → **`no`**
- `kubectl top pods` → **`Forbidden`**

Diferenciación explícita de estados:

| Estado | Resultado |
|---|---|
| Metrics API registrada | **Sí, comprobado** |
| Usuario con acceso a `PodMetrics` | **No** (limitado por RBAC) |
| HPA capaz de consumir métricas | **Pendiente de comprobar** |

**No se afirma que Metrics Server esté roto.** El `Forbidden` de `kubectl top` corresponde a los **permisos del usuario actual**, no a una falla del backend. Tampoco se afirma que Metrics Server funcione completamente. El **controlador HPA utiliza sus propios permisos (ServiceAccount)**, por lo que la prueba definitiva será **crear posteriormente el HPA y comprobar el campo de utilización de CPU**.

## 10. Cambios realizados

**No se realizaron cambios de configuración Kubernetes durante S2-T2.**

No se modificaron:

- `requests`
- `limits`
- `replicas`
- `probes`
- `Service`
- `labels`
- `ResourceQuota`
- `LimitRange`
- `RBAC`
- `Metrics Server`

La **única modificación del repositorio** fue la creación de **este documento Markdown** (`docs/kubernetes/preparacion-autoscaling-ms-menus.md`). El documento de S2-T1 (`docs/kubernetes/diagnostico-pods-pending-ms-menus.md`) **no fue modificado**.

## 11. Conclusión

- `ms-menus` está **técnicamente preparado para avanzar hacia HPA**;
- **no se encontró evidencia** para cambiar CPU ni memoria;
- **múltiples réplicas funcionan** (3/3 `Running`/`Ready`);
- el **Service funciona** con las réplicas (3 Endpoints);
- la **ResourceQuota permite una demostración limitada** de autoscaling;
- la **Metrics API está registrada**;
- **falta comprobar** que el HPA pueda obtener **métricas reales** de CPU;
- el **drift de `replicas`** se resolverá durante la implementación de HPA.

> Con la evidencia obtenida, no fue necesario modificar los recursos de `ms-menus` durante S2-T2. El Deployment cumple los prerrequisitos principales para avanzar a la configuración del Horizontal Pod Autoscaler. La validación pendiente más importante es comprobar que el controlador HPA pueda consumir métricas reales de CPU desde `metrics.k8s.io`.

## 12. Siguiente paso

Configurar un **HPA de prueba** para `ms-menus` y verificar si Kubernetes muestra una **métrica de CPU válida** (por ejemplo, observando el campo de utilización en `kubectl get hpa`). Esto permitirá confirmar si el controlador HPA recibe datos reales desde `metrics.k8s.io`.

**NO se crea el HPA durante esta tarea.**
