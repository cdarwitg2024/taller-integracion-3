# Verificación de múltiples réplicas de ms-menus

> Tarea: S2-T3 — Camilo Darwitg — Verificar múltiples réplicas de ms-menus
> Fecha: 2026-10-16
> Tipo de actividad: verificación read-only del estado actual

## 1. Objetivo

Verificar que `ms-menus` puede operar con **múltiples réplicas simultáneas** en Kubernetes y que el **Service** las descubre y balancea correctamente. Esta tarea es **read-only**: no se repitieron pruebas de escalamiento ni se modificó nada.

## 2. Estado del Deployment

Deployment `ms-menus`, namespace `student-cdarwitg`:

| Desired | Current | Ready | Available |
|---:|---:|---:|---:|
| 3 | 3 | 3 | 3 |

- `UP-TO-DATE: 3`, `unavailable: 0`.
- Conditions: `Progressing: True (NewReplicaSetAvailable)`, `Available: True (MinimumReplicasAvailable)`.
- ReplicaSet activo: `ms-menus-6465dcb67f` (3/3). Sin `OldReplicaSets`.

## 3. Pods observados

| Pod | Estado | Ready | Restarts | Nodo |
|---|---|---|---|---|
| `ms-menus-6465dcb67f-hjcfg` | Running | 1/1 | 0 | `rke2-estudiantes-agent-02` |
| `ms-menus-6465dcb67f-l6kd5` | Running | 1/1 | 0 | `rke2-estudiantes-agent-01` |
| `ms-menus-6465dcb67f-shvbz` | Running | 1/1 | 0 | `rke2-estudiantes-agent-03` |

- **3 réplicas** en total; **3 Running**; **3 Ready**.
- **0 Pods Pending**; **0 reinicios** (`RESTARTS = 0`).
- Distribución observada: **una réplica por nodo** (agent-01, agent-02, agent-03).

## 4. Service y Endpoints

Service `ms-menus`:

- **Tipo:** `ClusterIP`
- **Selector:** `app: ms-menus`
- **Puerto:** `3003`
- **targetPort:** `http` (→ 3003)
- **ClusterIP:** `10.43.58.189`

Endpoints actuales: **3 direcciones**, una por réplica Ready.

| Endpoint IP | Nodo | Pod (targetRef) |
|---|---|---|
| `10.42.151.157` | agent-03 | `ms-menus-6465dcb67f-shvbz` |
| `10.42.160.148` | agent-01 | `ms-menus-6465dcb67f-l6kd5` |
| `10.42.79.75` | agent-02 | `ms-menus-6465dcb67f-hjcfg` |

- **Relación Pods Ready ↔ Endpoints: 3 ↔ 3** (coinciden exactamente).
- Verificación de selector: el Service `app: ms-menus` matchea **únicamente** los 3 Pods de `ms-menus`; **no** selecciona Pods de otros microservicios (`fortio`, `gateway`, `ms-cafeterias`, `ms-inventario`, `ms-pedidos` quedan fuera).

## 5. Prueba del Service

Prueba HTTP no destructiva desde un Pod existente (sin crear Pods, sin instalar nada): se ejecutó `wget` desde el Pod `gateway-574647c589-z8j45`.

```
GET http://ms-menus:3003/health   (x5, a través del Service)
```

Resultado real (5/5 exitosos):

```json
{"servicio":"ms-menus","version":"1.0.0","status":"healthy","timestamp":"2026-10-16T04:17:36.890Z"}
{"servicio":"ms-menus","version":"1.0.0","status":"healthy","timestamp":"2026-10-16T04:17:37.686Z"}
{"servicio":"ms-menus","version":"1.0.0","status":"healthy","timestamp":"2026-10-16T04:17:38.394Z"}
{"servicio":"ms-menus","version":"1.0.0","status":"healthy","timestamp":"2026-10-16T04:17:39.102Z"}
{"servicio":"ms-menus","version":"1.0.0","status":"healthy","timestamp":"2026-10-16T04:17:39.894Z"}
```

El Service respondió correctamente en las 5 solicitudes. No se determinó a qué réplica respondió cada una (no era necesario).

## 6. Eventos

`kubectl get events -n student-cdarwitg` → **`No resources found`** (los Events del namespace ya expiraron). **No hay eventos problemáticos activos** (`FailedScheduling`, `FailedCreate`, `Unhealthy`, `BackOff`, `Failed`, `Killing`): no se observó ninguno.

## 7. Evidencia previa de S2-T1

S2-T1 ya realizó **dos ciclos controlados de escalamiento 1 → 3 exitosos**, con Pods asignados correctamente, **sin** `FailedScheduling` ni `FailedCreate`, alcanzando `Running` y `Ready`. Detalle completo en:

`docs/kubernetes/diagnostico-pods-pending-ms-menus.md`

## 8. Conclusión

**VERIFICACIÓN EXITOSA.**

- múltiples réplicas **Running/Ready** (3/3);
- el **Service las selecciona correctamente** (3 Pods Ready = 3 Endpoints);
- **no existe un error activo** que impida su funcionamiento;
- el Service responde `GET /health` correctamente.
