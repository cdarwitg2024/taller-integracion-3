# Verificación de Autoscaling bajo carga

> Tarea: **S2-T7** — Verificar Autoscaling bajo carga
> Fecha: 2026-10-19
> Rama: `S2-T7-Camilodg_Verificar_Autoscaling_bajo_carga`

## 1. Objetivo

Demostrar experimentalmente que **Kubernetes aumenta y reduce automáticamente
las réplicas** de un microservicio de CoffeeFast mediante **HPA** cuando
**Fortio** genera carga, **sin** usar `kubectl scale`.

Cadena buscada para `ms-menus`:

```
1 Pod  →  Fortio genera carga  →  CPU > 70%  →  HPA escala
       →  carga termina  →  CPU baja  →  estabilización  →  HPA reduce
```

## 2. Configuración final del HPA

Los tres HPA quedaron configurados de forma definitiva como:

```yaml
minReplicas: 1
maxReplicas: 3
averageUtilization: 70
```

Interpretación: **1 Pod base + hasta 2 Pods adicionales = máximo 3 Pods
totales**. El clúster fue sincronizado con `kubectl apply` de los tres
`hpa.yaml` (`k8s-next/ms-cafeterias/hpa.yaml`, `k8s-next/ms-menus/hpa.yaml`,
`k8s-next/ms-pedidos/hpa.yaml`).

Estado final *live*:

| HPA | minReplicas | maxReplicas | Target | Réplicas |
|---|---|---|---|---|
| ms-cafeterias | 1 | 3 | 70% | 1 |
| ms-menus | 1 | 3 | 70% | 1 |
| ms-pedidos | 1 | 3 | 70% | 1 |

## 3. Estado inicial (base)

Antes de generar carga:

| MS | CPU (HPA) | Target | Réplicas | ScalingActive |
|---|---|---|---|---|
| ms-cafeterias | 2% | 70% | 1 | True |
| ms-menus | 2% | 70% | 1 | True |
| ms-pedidos | 2% | 70% | 1 | True |

- Pods base (5, todos `Running 1/1`): `fortio`, `gateway`, `ms-cafeterias`,
  `ms-menus`, `ms-pedidos`.
- Los 3 HPA con `ScalingActive=True` y sin `<unknown>` → aptos para la prueba.

## 4. Prueba inicial (primera verificación)

> **Nota:** esta fue una **prueba inicial**, ejecutada cuando el
> `maxReplicas` todavía era **2**. **No** corresponde a la configuración
> definitiva del HPA (que es `maxReplicas: 3`).

```
fortio load -loglevel Warning -qps 100 -c 10 -t 30s http://ms-menus:3003/api/menus
```

| Métrica | Valor |
|---|---|
| Requests | **732** (+10 warmup) |
| HTTP 200 | **732 (100%)** |
| Errores | **0** |
| Throughput real | **24.2 qps** |
| Latencia media | **411.4 ms** |
| p50 | **373 ms** |
| p90 | **640 ms** |
| p99 | **888 ms** |

- **CPU máxima observada por el HPA: `282% / 70%`.**
- El HPA escaló automáticamente **1 → 2**. Como en ese momento el
  `maxReplicas` era **2**, el HPA quedó limitado en 2 réplicas; de ahí la
  condición `ScalingLimited=True / TooManyReplicas` observada, que
  **correspondía a esa configuración anterior** (ya no la definitiva).
- No se ejecutó una segunda prueba de mayor carga en ese momento (la prueba
  inicial ya había disparado el escalado). Algo de esta evidencia histórica se
  conserva por su valor demostrativo.

## 5. Validación manual definitiva

Con el HPA ya en su configuración final (`maxReplicas: 3`) se ejecutó una
verificación manual más completa, que constituye la **evidencia principal**:

```
kubectl exec -n student-cdarwitg fortio -- fortio load \
  -loglevel Warning \
  -qps 30 \
  -c 5 \
  -t 60s \
  http://ms-menus:3003/api/menus
```

| Métrica | Valor |
|---|---|
| QPS objetivo | 30 |
| Concurrencia | 5 |
| Duración | 60s |
| Requests medidos | **1004** (+5 warmup) |
| HTTP 200 | **1004 (100%)** |
| Errores | **0** |
| Throughput real | **16.694 qps** |
| Latencia media | 0.29919781 s (~**299 ms**) |
| p50 | ~259.5 ms |
| p75 | ~336 ms |
| p90 | ~468 ms |
| p99 | ~899 ms |
| Máximo | ~1.664 s |

> Fortio indicó que se estaba quedando atrás respecto del QPS solicitado
> (no alcanzó los 30 qps sostenidos: el throughput real fue ~16.694 qps).
> **Esto no es un error HTTP**: las **1004** solicitudes medidas respondieron
> **HTTP 200**.

## 6. Scale-up definitivo (1 → 3)

Durante esta prueba, el HPA de `ms-menus` escaló **automáticamente de 1 → 3
Pods**, **sin** `kubectl scale`.

- Pod original: `ms-menus-6465dcb67f-shvbz`
- Pods adicionales: `ms-menus-6465dcb67f-5xwdl`, `ms-menus-6465dcb67f-bnr4d`
- Los tres Pods quedaron **Running 1/1**.
- Distribución en nodos distintos:
  - original → `rke2-estudiantes-agent-03`
  - réplica adicional → `rke2-estudiantes-agent-02`
  - réplica adicional → `rke2-estudiantes-agent-01`

Eventos:

```
SuccessfulRescale  horizontalpodautoscaler/ms-menus
    New size: 3; reason: cpu resource utilization (percentage of request) above target

ScalingReplicaSet  deployment/ms-menus
    Scaled up replica set ms-menus-6465dcb67f from 1 to 3

SuccessfulCreate   replicaset/ms-menus-6465dcb67f   (x2)
    Created pod: ms-menus-6465dcb67f-5xwdl
    Created pod: ms-menus-6465dcb67f-bnr4d
```

> **Eventos transitorios (no son fallas):** durante el arranque de uno de los
> Pods se observó un `readiness probe` con *connection refused* temporal, y un
> `SyncError` transitorio por *"object has been modified"*. Ambos se
> resolvieron solos: los Pods terminaron correctamente en **Running/Ready**.

## 7. Scale-down definitivo (3 → 1)

Al terminar Fortio:

- La CPU bajó nuevamente a ~**2–4% / 70%**.
- El HPA mantuvo temporalmente 3 réplicas por la **estabilización de
  scale-down**.
- Tras ~**5 minutos** el HPA redujo **automáticamente de 3 → 1**.
- Los Pods adicionales `ms-menus-6465dcb67f-bnr4d` y
  `ms-menus-6465dcb67f-5xwdl` pasaron a **Terminating** y fueron eliminados.
- El Pod original permaneció **Running**.

**NO** se utilizó `kubectl scale`.

Ciclo completo verificado:

```
1 Pod
 → Fortio genera carga
 → HPA detecta utilización superior al objetivo
 → HPA escala automáticamente a 3 Pods
 → termina la carga
 → CPU disminuye
 → ventana de estabilización
 → HPA reduce automáticamente a 1 Pod
```

## 8. Evidencia Kubernetes

### Scale-up

```
Deployment ms-menus: 1 → 3 réplicas (automático)

NAME                        READY  STATUS   NODE
ms-menus-6465dcb67f-shvbz   1/1    Running  rke2-estudiantes-agent-03   (original)
ms-menus-6465dcb67f-5xwdl   1/1    Running  rke2-estudiantes-agent-02
ms-menus-6465dcb67f-bnr4d   1/1    Running  rke2-estudiantes-agent-01
```

### Scale-down

```
NAME                        STATUS
ms-menus-6465dcb67f-bnr4d   Terminating → eliminado
ms-menus-6465dcb67f-5xwdl   Terminating → eliminado
ms-menus-6465dcb67f-shvbz   Running (permanece)
```

### Independencia de los otros HPA

`ms-cafeterias` y `ms-pedidos` permanecieron en **1** réplica durante toda la
prueba (no se les generó carga). Confirma que cada HPA escala de forma
independiente.

## 9. Estado final

HPA:

```
ms-cafeterias   cpu ~2%/70%   min 1   max 3   replicas 1
ms-menus        cpu ~2%/70%   min 1   max 3   replicas 1
ms-pedidos      cpu ~2%/70%   min 1   max 3   replicas 1
```

Pods base (5, `Running 1/1`):

```
fortio           Running 1/1
gateway          Running 1/1
ms-cafeterias    Running 1/1
ms-menus         Running 1/1
ms-pedidos       Running 1/1
```

> **Nota sobre ResourceQuota:** no se conserva un *snapshot* exacto de la
> ResourceQuota correspondiente a la prueba `1 → 3` (con `maxReplicas: 3`), por
> lo que **no** se incluye una tabla de consumo para esa prueba. La tabla
> `5 → 6` de la verificación original correspondía a la prueba inicial
> (`1 → 2`, `maxReplicas: 2`) y **no** debe reutilizarse como si
> correspondiera a `1 → 3`.

## 10. Conclusión

**S2-T7 fue EXITOSA.** Queda demostrado experimentalmente que:

1. El estado inicial de `ms-menus` era de **1 Pod**.
2. **Fortio generó carga sostenida** sobre `GET /api/menus`.
3. El **HPA reaccionó automáticamente** al superar la CPU el objetivo del 70%.
4. Hubo **scale-up automático `1 → 3`**.
5. Se **crearon dos Pods adicionales**, ambos distribuidos en nodos distintos.
6. Los **tres Pods quedaron Running/Ready**.
7. **No se utilizó `kubectl scale`** en ningún momento.
8. Finalizada la carga, la **CPU volvió a valores bajos** (~2–4%).
9. Tras la **estabilización** (~5 min), hubo **scale-down automático `3 → 1`**.
10. El **estado final es saludable** (5 Pods base `Running 1/1`).
11. La **configuración definitiva** es `minReplicas=1`, `maxReplicas=3`,
    `averageUtilization=70` en los tres HPA.

> **Anticipo para S2-T10:** la reducción automática de Pods (`3 → 1`) ya quedó
> evidenciada experimentalmente aquí como parte del ciclo completo de
> autoscaling; formalmente podrá documentarse de nuevo en su tarea
> correspondiente.
