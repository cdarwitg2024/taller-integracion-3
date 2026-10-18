# Configuración de Horizontal Pod Autoscaler en CoffeeFast

> Tarea: S2-T5 — Camilo Darwitg — Configurar Horizontal Pod Autoscaler
> Fecha: 2026-10-16
> Rama: `S2-T5-Camilodg-Configurar_Horizontal_Pod_Autoscaler`
> Cambio controlado en Kubernetes: crear/actualizar `HorizontalPodAutoscaler` de los 3 microservicios de negocio

## 1. Objetivo

Implementar **autoscaling independiente** (Horizontal Pod Autoscaler basado en
utilización de CPU) para los **tres microservicios de negocio** de CoffeeFast:

1. `ms-cafeterias`
2. `ms-menus`
3. `ms-pedidos`

`gateway` **no** es un microservicio de negocio y **no** tiene HPA.

El objetivo incluye demostrar que el controlador HPA consume **métricas reales**
de CPU (`metrics.k8s.io`), aun cuando el usuario `ldap:cdarwitg` no puede leer
PodMetrics directamente (`kubectl top` → Forbidden por RBAC). No se generó carga
(Fortio se usará en una tarea posterior).

## 2. Microservicios

| Microservicio | requests.cpu | limits.cpu | requests.memory | limits.memory | HPA |
|---|---|---|---|---|---|
| ms-cafeterias | 50m | 150m | 64Mi | 128Mi | `HPA/ms-cafeterias` |
| ms-menus | 50m | 150m | 64Mi | 128Mi | `HPA/ms-menus` |
| ms-pedidos | 50m | 150m | 64Mi | 128Mi | `HPA/ms-pedidos` |

Los recursos declarados en los manifiestos (`k8s-next/*/deployment.yaml`)
coinciden con la configuración **live** (sin discrepancias). Los tres tienen
`requests.cpu = 50m`, requisito para `Utilization`.

## 3. ResourceQuota

`student-provisioner-quota` (namespace `student-cdarwitg`):

| Recurso | Usado (durante la tarea) | Hard |
|---|---|---|
| pods | 6 | 12 |
| requests.cpu | 275m | 1 |
| requests.memory | 384Mi | 1G |
| limits.cpu | 850m | 2 |
| limits.memory | 768Mi | 2G |

### Por qué `maxReplicas: 2`

El namespace no contiene solo los 3 microservicios. Componentes **fijos** (no
escalables) presentes: `gateway`, `ms-inventario`, `fortio` → **3 Pods**
(req.cpu 125m, req.mem 192Mi, lim.cpu 400m, lim.mem 384Mi).

Con los 3 MS a `maxReplicas`:

- **max 3 por MS** → 9 Pods escalables + 3 fijos = **12 Pods = cuota completa**
  (0 margen). Inseguro (sin espacio para rolling updates ni recreación).
- **max 2 por MS** → 6 Pods escalables + 3 fijos = **9 Pods**, con **margen de
  3 Pods** (25 % de la cuota) para infraestructura y rolling updates.

Peor caso con la propuesta (max 2 por MS), todos los 3 MS al máximo:

| Recurso | Peor caso | Hard | ¿Excede? |
|---|---|---|---|
| pods | 3 fijos + 6 = **9** | 12 | No |
| requests.cpu | 125m + 300m = **425m** | 1 (1000m) | No |
| requests.memory | 192Mi + 384Mi = **576Mi** | 1G (1024Mi) | No |
| limits.cpu | 400m + 900m = **1300m** | 2 (2000m) | No |
| limits.memory | 384Mi + 768Mi = **1152Mi** | 2G (2048Mi) | No |

Por eso se eligió **`maxReplicas: 2`** para los tres (y se **redujo** el
`maxReplicas` de `ms-menus` de 5 → 2, ya que 5 + 3 + 3 excedería la cuota).

## 4. Configuración de HPA

| MS | min | max | CPU target |
|---|---|---|---|
| ms-cafeterias | 1 | 2 | 70% |
| ms-menus | 1 | 2 | 70% |
| ms-pedidos | 1 | 2 | 70% |

Todos usan `autoscaling/v2`, métrica `Resource` `cpu` `Utilization` 70 %,
`scaleTargetRef` a **su propio** Deployment, en el namespace `student-cdarwitg`.

Manifiestos:

```
k8s-next/ms-cafeterias/hpa.yaml
k8s-next/ms-menus/hpa.yaml
k8s-next/ms-pedidos/hpa.yaml
```

Validados con `--dry-run=client` y aplicados **individualmente** (no `-R`, no
directorios).

## 5. Estado de los HPA

| MS | TARGETS | MINPODS | MAXPODS | REPLICAS | ScalingActive | Estado |
|---|---|---|---|---|---|---|
| ms-cafeterias | `cpu: 2%/70%` | 1 | 2 | 1 | True | FUNCIONANDO |
| ms-menus | `cpu: 2%/70%` | 1 | 2 | 1 | True | FUNCIONANDO |
| ms-pedidos | `cpu: 2%/70%` | 1 | 2 | 1 | True | FUNCIONANDO |

Conditions en los tres:

- **AbleToScale:** `True` — `ReadyForNewScale`
- **ScalingActive:** `True` — `ValidMetricFound` ("the HPA was able to successfully calculate a replica count from cpu resource utilization (percentage of request)")
- **ScalingLimited:** `False` — `DesiredWithinRange`

Sin `FailedGetResourceMetric`, `FailedComputeMetricsReplicas` ni `FailedGetScale`.

## 6. Comportamiento sin carga

No se generó carga. Sin carga, la CPU real es ~2 %, muy por debajo del objetivo
(70 %), por lo que los HPA tienden a `minReplicas = 1`.

- `ms-menus`: había llegado a 3 réplicas por escalamiento manual previo; el HPA
  lo redujo automáticamente **3 → 1** (`SuccessfulRescale — New size: 1; reason:
  All metrics below target`). Este es el scale-down real observado.
- `ms-cafeterias` y `ms-pedidos`: partían de **1** réplica; permanecen en **1**
  (ya están en `minReplicas`, no se observó cambio).

No se hizo `kubectl scale`, no se forzaron réplicas y no se impidió ningún
scale-down.

## 7. Validación de métricas

Los tres HPA muestran un **porcentaje real** (`2%/70%`) con
`ScalingActive=True (ValidMetricFound)`. Esto demuestra que el **controlador HPA
sí puede consumir métricas reales** de `metrics.k8s.io`, **aunque** el usuario
`ldap:cdarwitg` no pueda ejecutar `kubectl top` (Forbidden por RBAC) ni leer
PodMetrics directamente. El `Forbidden` era una **limitación de RBAC del
usuario**, no una falla de Metrics Server.

Al arrancar, cada HPA nuevo mostró transitoriamente `cpu: <unknown>/70%`, que se
convirtió en `2%/70%` en ~1 minuto. Comportamiento esperado.

## 8. Estado final

**Deployments** (todos 1/1):

```
gateway         1/1
ms-cafeterias   1/1
ms-inventario   1/1
ms-menus        1/1
ms-pedidos      1/1
```

**Pods** (6, todos Running 1/1, 0 restarts): `fortio`, `gateway-...`, `ms-cafeterias-...`, `ms-inventario-...`, `ms-menus-...`, `ms-pedidos-...`.

**HPA:** `ms-cafeterias`, `ms-menus`, `ms-pedidos` (exactamente 3; **ninguno** para `gateway`).

**ResourceQuota:** `pods 6/12`, `requests.cpu 275m/1`, `requests.memory 384Mi/1G`, `limits.cpu 850m/2`, `limits.memory 768Mi/2G`. Sin `FailedCreate` ni `exceeded quota`.

**Services/Endpoints** (1 endpoint Ready por MS):

| Service | Puerto | Endpoint |
|---|---|---|
| ms-cafeterias | 3002 | `10.42.151.145:3002` |
| ms-menus | 3003 | `10.42.151.157:3003` |
| ms-pedidos | 3005 | `10.42.151.167:3005` |

Prueba `GET /health` (read-only, desde el Pod existente `gateway-...`):
`ms-cafeterias`, `ms-menus` y `ms-pedidos` respondieron `status: healthy`.

## 9. Cambios realizados

**CREADO (repositorio):**
- `k8s-next/ms-cafeterias/hpa.yaml`
- `k8s-next/ms-menus/hpa.yaml` (creado en esta tarea; su `maxReplicas` se ajustó 5 → 2)
- `k8s-next/ms-pedidos/hpa.yaml`

**CREADO/RENOMBRADO (documentación):**
- `docs/kubernetes/configuracion-hpa-microservicios.md` (reemplaza a `configuracion-hpa-ms-menus.md`)

**CREADO (Kubernetes):**
- `HorizontalPodAutoscaler/ms-cafeterias`
- `HorizontalPodAutoscaler/ms-menus` (actualizado `maxReplicas` 5 → 2)
- `HorizontalPodAutoscaler/ms-pedidos`

**NO MODIFICADO:**
- `deployment.yaml` (los 3)
- `service.yaml`
- RBAC
- Metrics Server
- ResourceQuota
- LimitRange
- Supabase
- base de datos
- código JavaScript

## 10. Conclusión

**AUTOSCALING CONFIGURADO EN LOS 3 MICROSERVICIOS.**

Existen exactamente **3 HPA**, uno por cada microservicio de negocio
(`ms-cafeterias`, `ms-menus`, `ms-pedidos`), cada uno controlando su propio
Deployment, todos con **métricas reales funcionando** (`ScalingActive=True`,
`cpu: 2%/70%`). No existe HPA para `gateway`. La configuración respeta la
ResourceQuota con margen operativo.

## 11. Siguiente paso

Preparar **Fortio** para generar **carga controlada** y verificar el **scale-up
automático** (1 → 2) de los microservicios, respetando la ResourceQuota
(`pods` libres: 3; `maxReplicas: 2` por MS). Verificar luego el retorno a
`minReplicas` cuando la CPU baje.
