# Verificación de Metrics API para Autoscaling

> Tarea: S2-T4 — Camilo Darwitg — Verificar Metrics API para Autoscaling
> Fecha: 2026-10-16
> Tipo: diagnóstico read-only
> Rama: `S2-T4-Camilodg-Verificar_Metrics_API_para_Autoscaling`

## 1. Objetivo

Verificar los **prerrequisitos de métricas** necesarios antes de implementar el Horizontal Pod Autoscaler (HPA) de `ms-menus`:

- que la **Metrics API** esté registrada y publique `PodMetrics` / `NodeMetrics`;
- el estado de los **permisos RBAC** del usuario actual para leer métricas;
- el comportamiento de `kubectl top`;
- que `ms-menus` tenga `requests.cpu` (base para HPA por utilización de CPU);
- los **permisos para crear HPA**.

Esta tarea es **read-only**: no se implementa HPA, no se modifica RBAC ni Metrics Server.

## 2. Metrics API

- **apiVersion encontrada:** `metrics.k8s.io/v1beta1` (aparece en `kubectl api-versions`).
- **APIGroup (`kubectl get --raw /apis/metrics.k8s.io`):**

  ```json
  {"kind":"APIGroup","apiVersion":"v1","name":"metrics.k8s.io","versions":[{"groupVersion":"metrics.k8s.io/v1beta1","version":"v1beta1"}],"preferredVersion":{"groupVersion":"metrics.k8s.io/v1beta1","version":"v1beta1"}}
  ```

- **Recursos publicados (`kubectl get --raw /apis/metrics.k8s.io/v1beta1`):**

  ```json
  {"kind":"APIResourceList","apiVersion":"v1","groupVersion":"metrics.k8s.io/v1beta1","resources":[{"name":"nodes","singularName":"","namespaced":false,"kind":"NodeMetrics","verbs":["get","list"]},{"name":"pods","singularName":"","namespaced":true,"kind":"PodMetrics","verbs":["get","list"]}]}
  ```

- Recursos confirmados: **`nodes` (NodeMetrics)** y **`pods` (PodMetrics)**, con verbos `get` y `list`.

> Nota: que el APIGroup exista y publique recursos **no** demuestra por sí solo que el backend esté entregando valores al usuario (eso depende además de RBAC y del backend de métricas).

## 3. Permisos RBAC

Usuario: `ldap:cdarwitg` (namespace `student-cdarwitg`).

| Recurso / Acción | Resultado |
|---|---|
| `get pods.metrics.k8s.io` (ns student-cdarwitg) | **no** |
| `list pods.metrics.k8s.io` (ns student-cdarwitg) | **no** |
| `get nodes.metrics.k8s.io` | **no** |
| `list nodes.metrics.k8s.io` | **no** |
| `create horizontalpodautoscalers.autoscaling` (ns student-cdarwitg) | **yes** |
| `get horizontalpodautoscalers.autoscaling` (ns student-cdarwitg) | **yes** |
| `list horizontalpodautoscalers.autoscaling` (ns student-cdarwitg) | **yes** |
| `update horizontalpodautoscalers.autoscaling` (ns student-cdarwitg) | **yes** |

## 4. kubectl top

`kubectl top` fue **BLOQUEADO POR RBAC** para el usuario actual:

- `kubectl top pods -n student-cdarwitg`:
  ```
  Error from server (Forbidden): pods.metrics.k8s.io is forbidden:
  User "ldap:cdarwitg" cannot list resource "pods" in API group "metrics.k8s.io"
  in the namespace "student-cdarwitg"
  ```
- `kubectl top pod -n student-cdarwitg -l app=ms-menus`: mismo error `Forbidden`.
- `kubectl top nodes`: `Error from server (Forbidden): nodes.metrics.k8s.io is forbidden` para el mismo usuario.

Adicionalmente, la consulta directa read-only:

```
kubectl get --raw "/apis/metrics.k8s.io/v1beta1/namespaces/student-cdarwitg/pods"
```

devuelve exactamente el mismo `Forbidden`:

```
Error from server (Forbidden): pods.metrics.k8s.io is forbidden:
User "ldap:cdarwitg" cannot list resource "pods" in API group "metrics.k8s.io"
in the namespace "student-cdarwitg"
```

**Interpretación:** `Forbidden` es una limitación de **RBAC del usuario**: no tiene autorización para leer el recurso `metrics.k8s.io`. **Esto no demuestra una falla del Metrics Server**, porque el APIGroup existe y publica los recursos `PodMetrics`/`NodeMetrics`, y el acceso se deniega por autorización (no por indisponibilidad del backend).

## 5. ms-menus y requests.cpu

Valor real del Deployment `ms-menus` (namespace `student-cdarwitg`):

```json
{"limits":{"cpu":"150m","memory":"128Mi"},"requests":{"cpu":"50m","memory":"64Mi"}}
```

- **`requests.cpu = 50m`** (confirmado).

Para un HPA basado en:

```yaml
type: Resource
resource:
  name: cpu
  target:
    type: Utilization
```

Kubernetes calcula la **utilización porcentual** como `uso_actual / requests.cpu`. Por eso `requests.cpu` es un **prerrequisito**: sin él no se puede calcular el porcentaje objetivo.

No se modificó `requests.cpu`.

## 6. Estado de preparación

| Comprobación | Estado |
|---|---|
| Metrics API registrada | **OK** |
| PodMetrics/NodeMetrics publicados | **OK** |
| Lectura PodMetrics por usuario | **BLOQUEADO POR RBAC** |
| kubectl top | **BLOQUEADO POR RBAC** |
| requests.cpu de ms-menus | **OK** (50m) |
| Permisos para crear HPA | **OK** |
| Consumo de métricas por HPA | **PENDIENTE** |

## 7. Conclusión

**VERIFICACIÓN CON OBSERVACIONES.**

La Metrics API se encuentra **registrada** (`metrics.k8s.io/v1beta1`) y **publica los recursos necesarios** (`PodMetrics` y `NodeMetrics`). El usuario actual (`ldap:cdarwitg`) **no posee permisos RBAC** para consultar directamente PodMetrics mediante `kubectl top` o la API de métricas, lo cual **no demuestra una falla de Metrics Server** (la denegación es por autorización). `ms-menus` posee `requests.cpu` (50m) y el usuario **sí tiene permisos para crear HPA**. La comprobación definitiva de que el controlador HPA puede consumir métricas reales se realizará en **S2-T5**.

## 8. Siguiente paso

**S2-T5:** crear un HPA controlado para `ms-menus` y comprobar:

- `TARGETS`;
- utilización actual de CPU;
- `ScalingActive`;
- Events;
- posibles `FailedGetResourceMetric`.

Si `TARGETS` muestra un valor real (p. ej. `5%/70%`), la obtención de métricas por el HPA estaría funcionando. Si aparece `<unknown>/70%`, **investigar el motivo** antes de realizar pruebas con Fortio.

> El HPA **no** se crea en esta tarea (S2-T4).
