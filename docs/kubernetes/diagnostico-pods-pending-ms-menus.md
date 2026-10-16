# Diagnóstico de Pods Pending en ms-menus

> **Tarea:** S2-T1 — Camilo Darwitg — Diagnosticar Pods Pending en Kubernetes  
> **Fecha del diagnóstico:** 2026-10-15  
> **Tipo de prueba:** Reproducción controlada de escalamiento (`replicas`) con observación en tiempo real.

---

## 1. Objetivo

Durante una prueba previa de Kubernetes se escaló manualmente el Deployment `ms-menus` desde **1 a 3 réplicas**. Durante dicha prueba se observó que:

- la réplica original permaneció en estado `Running`;
- las **2 réplicas nuevas aparecieron inicialmente en estado `Pending`**;
- posteriormente las nuevas réplicas terminaron funcionando y el Deployment alcanzó 3 Pods `Running`.

El objetivo de **S2-T1** fue reproducir de manera controlada el escalamiento de 1 a 3 réplicas y analizar el comportamiento de los nuevos Pods mediante la evidencia proporcionada por Kubernetes.

Para el diagnóstico se consideraron:

- `Events`;
- `Pod Conditions`;
- `FailedScheduling`;
- `FailedCreate`;
- `ResourceQuota`;
- `LimitRange`;
- requests y limits;
- capacidad y asignación de nodos.

El diagnóstico se realizó **sin asumir previamente** que la causa correspondía a CPU, memoria, cuota, red, conexión a Internet o scheduler.

---

## 2. Entorno de prueba

La prueba se realizó sin registrar credenciales ni valores sensibles.

| Elemento | Valor |
|---|---|
| Rama | `S2-T1-Camilodg-Diagnosticar_pods_pending` |
| Namespace | `student-cdarwitg` |
| Deployment | `ms-menus` |
| Service | `ms-menus` (`ClusterIP`, `port 3003 → targetPort http`) |
| Imagen | `cdarwitg2024/ms-menus:v1.0.0` |
| Image Pull Policy | `IfNotPresent` |
| Puerto del contenedor | `3003` |
| Request CPU | `50m` |
| Request memoria | `64Mi` |
| Limit CPU | `150m` |
| Limit memoria | `128Mi` |
| Readiness Probe | `GET /health`, delay 3 s, period 5 s |
| Liveness Probe | `GET /health`, delay 10 s, period 15 s |
| Scheduling | Sin `nodeSelector`, `affinity` ni `tolerations` |
| Almacenamiento | Sin PVC; utiliza `emptyDir /tmp` |
| ResourceQuota | `student-provisioner-quota` |
| LimitRange | `student-provisioner-limits` |
| Nodos visibles | 3 nodos `Ready`: `rke2-estudiantes-agent-01/02/03` |

Cada nodo visible reportó aproximadamente:

- 16 CPU;
- 32 GiB de memoria;
- capacidad para 110 Pods;
- sin taints observados durante el diagnóstico.

### ResourceQuota relevante al inicio

| Dimensión | Hard | Usado |
|---|---:|---:|
| `requests.cpu` | 1 | 375m |
| `requests.memory` | 1G | 512Mi |
| `limits.cpu` | 2 | 1150m |
| `limits.memory` | 2G | 1Gi |
| `pods` | 12 | 8 |

### LimitRange relevante

Para contenedores:

| Recurso | Mínimo | Máximo | Request por defecto | Limit por defecto |
|---|---:|---:|---:|---:|
| CPU | 25m | 500m | 25m | 100m |
| Memoria | 64Mi | 512Mi | 64Mi | 128Mi |

El contenedor `ms-menus` define explícitamente sus requests y limits y estos se encuentran dentro de los rangos permitidos.

---

## 3. Estado previo

Antes de comenzar la reproducción se encontró:

- **Réplicas deseadas:** 3
- **Réplicas Ready:** 3/3
- **Réplicas Available:** 3
- **Pods Running:** 3
- **Pods Pending:** 0

### Distribución inicial entre nodos

- `ms-menus-6465dcb67f-72jhz` → `rke2-estudiantes-agent-02`
- `ms-menus-6465dcb67f-c96p8` → `rke2-estudiantes-agent-01`
- `ms-menus-6465dcb67f-shvbz` → `rke2-estudiantes-agent-03`

### Diferencia entre manifiesto versionado y estado del clúster

Se detectó una diferencia entre la configuración almacenada en el repositorio y el estado real del Deployment.

**Manifiesto versionado:**

`k8s-next/ms-menus/deployment.yaml`

```yaml
replicas: 1
```

**Estado real observado en el clúster:**

```text
spec.replicas = 3
```

Esto indica que el Deployment había sido escalado de forma imperativa y el manifiesto versionado no reflejaba el número de réplicas existente en el clúster.

Esta diferencia permaneció después de S2-T1, ya que el manifiesto no fue modificado durante la tarea.

---

## 4. Procedimiento de reproducción

Se realizaron **dos ciclos controlados `3 → 1 → 3`**.

La única operación de escritura realizada sobre Kubernetes durante S2-T1 fue modificar temporalmente `spec.replicas` del Deployment `ms-menus` mediante `kubectl scale`.

No se aplicaron, parchearon, editaron ni eliminaron otros recursos Kubernetes.

### Comandos principales utilizados

```powershell
# Estado inicial
kubectl get deployment ms-menus -n student-cdarwitg -o wide
kubectl get pods -n student-cdarwitg -l app=ms-menus -o wide
kubectl get rs -n student-cdarwitg -l app=ms-menus
kubectl get resourcequota -n student-cdarwitg

# Reducir temporalmente a una réplica
kubectl scale deployment ms-menus -n student-cdarwitg --replicas=1

# Volver a tres réplicas
kubectl scale deployment ms-menus -n student-cdarwitg --replicas=3

# Observar los Pods
kubectl get pods -n student-cdarwitg -l app=ms-menus -o wide

# Capturar evidencia
kubectl get events -n student-cdarwitg --sort-by=.lastTimestamp
kubectl describe deployment ms-menus -n student-cdarwitg
kubectl describe rs -n student-cdarwitg -l app=ms-menus
kubectl describe pod <POD> -n student-cdarwitg
```

El procedimiento utilizado fue:

1. Confirmar el estado inicial del Deployment.
2. Reducir temporalmente `ms-menus` a 1 réplica.
3. Esperar hasta alcanzar un estado estable.
4. Escalar nuevamente de 1 a 3 réplicas.
5. Observar inmediatamente los nuevos Pods.
6. Capturar los Events generados.
7. Inspeccionar Pods, ReplicaSet y ResourceQuota.
8. Repetir una segunda vez el ciclo para comprobar la consistencia del comportamiento.
9. Restaurar el estado final a 3 réplicas.

---

## 5. Resultados

| Prueba | Réplicas objetivo | Resultado | Tiempo aproximado | Observación |
|---|---:|---|---:|---|
| Estado inicial | 3 | 3 Pods `Running` y `Ready 1/1` | - | 0 Pending; distribuidos entre agent-01/02/03 |
| Prueba 1: 1 → 3 | 3 | 2 Pods nuevos: `Pending` → `Running` → `Ready 1/1` | Running entre ~4–8 s; Ready ~11–15 s | Ambos fueron asignados a nodos sin `FailedScheduling` ni `FailedCreate` |
| Prueba 2: 1 → 3 | 3 | 2 Pods nuevos: `Pending` → `Running` → `Ready 1/1` | Running entre ~3–6 s; Ready ~10–16 s | Se reprodujo el mismo patrón |

### Prueba 1

| Pod | Nodo | Estado inicial observado | Running | Ready 1/1 |
|---|---|---|---|---|
| `ms-menus-6465dcb67f-dcpph` | agent-01 | `Pending` con nodo asignado | ~t+4–8 s | ~t+15 s |
| `ms-menus-6465dcb67f-qnjdk` | agent-02 | `Pending` con nodo asignado | ~t+4 s | ~t+11–15 s |

### Prueba 2

| Pod | Nodo | Estado inicial observado | Running | Ready 1/1 |
|---|---|---|---|---|
| `ms-menus-6465dcb67f-hjcfg` | agent-02 | `Pending` con nodo asignado | ~t+3 s | ~t+10–16 s |
| `ms-menus-6465dcb67f-l6kd5` | agent-01 | `Pending` con nodo asignado | ~t+6 s | ~t+16 s |

En ambos ciclos, el Pod que permaneció funcionando durante la reducción a una réplica fue:

`ms-menus-6465dcb67f-shvbz` → agent-03.

---

## 6. Evidencia de Kubernetes

### Estado final de los Pods

```text
NAME                         READY   STATUS    NODE
ms-menus-6465dcb67f-hjcfg    1/1     Running   rke2-estudiantes-agent-02
ms-menus-6465dcb67f-l6kd5    1/1     Running   rke2-estudiantes-agent-01
ms-menus-6465dcb67f-shvbz    1/1     Running   rke2-estudiantes-agent-03
```

### Events relevantes del escalamiento

Durante las pruebas se observó la siguiente secuencia:

```text
Normal  ScalingReplicaSet  deployment/ms-menus
Scaled up replica set ms-menus-6465dcb67f from 1 to 3

Normal  SuccessfulCreate  replicaset/ms-menus-6465dcb67f
Created pod: ms-menus-6465dcb67f-dcpph

Normal  SuccessfulCreate  replicaset/ms-menus-6465dcb67f
Created pod: ms-menus-6465dcb67f-qnjdk

Normal  Scheduled  pod/ms-menus-6465dcb67f-dcpph
Successfully assigned student-cdarwitg/ms-menus-6465dcb67f-dcpph to rke2-estudiantes-agent-01

Normal  Scheduled  pod/ms-menus-6465dcb67f-qnjdk
Successfully assigned student-cdarwitg/ms-menus-6465dcb67f-qnjdk to rke2-estudiantes-agent-02

Normal  Pulled
Container image "cdarwitg2024/ms-menus:v1.0.0" already present on machine and can be accessed by the pod

Normal  Created
Container created

Normal  Started
Container started
```

También se registró durante el arranque:

```text
Warning  Unhealthy
Readiness probe failed: Get "http://<ip>:3003/health":
dial tcp <ip>:3003: connect: connection refused
```

Esta advertencia ocurrió durante el período inicial de arranque. Posteriormente la sonda de readiness fue satisfactoria y los Pods alcanzaron `Ready 1/1`.

Por lo tanto, durante las pruebas realizadas **no se observó un fallo persistente de readiness**.

### Pod Conditions una vez estabilizados

```text
PodReadyToStartContainers   True
Initialized                 True
Ready                       True
ContainersReady             True
PodScheduled                True
```

### Ausencias relevantes

Durante los dos ciclos:

- no apareció `FailedScheduling`;
- no apareció `FailedCreate`;
- no se observaron errores relacionados con ResourceQuota;
- no apareció `ImagePullBackOff`;
- no apareció `ErrImagePull`;
- los Pods terminaron correctamente en `Running` y `Ready 1/1`.

El ReplicaSet terminó reportando:

```text
3 Running / 0 Waiting / 0 Succeeded / 0 Failed
```

### ResourceQuota durante las pruebas

La ResourceQuota se mantuvo aproximadamente en:

```text
pods:          8/12
requests.cpu:  375m/1
limits.cpu:    1150m/2
```

Durante los escalamientos realizados no se observó agotamiento de estas dimensiones.

---

## 7. Análisis de causa

### Hechos comprobados

1. Al escalar de 1 a 3 réplicas, el ReplicaSet creó correctamente los 2 Pods adicionales mediante `SuccessfulCreate`.

2. Kubernetes asignó correctamente los nuevos Pods a nodos mediante eventos `Scheduled — Successfully assigned`.

3. Los Pods fueron observados inicialmente con `STATUS = Pending`, aunque ya tenían un nodo asignado.

4. No se registró ningún evento `FailedScheduling`.

5. No se registró ningún evento `FailedCreate`.

6. No se registraron errores de ResourceQuota durante las pruebas.

7. Las imágenes necesarias ya se encontraban disponibles en los nodos durante las reproducciones.

8. Los Pods alcanzaron `Running` aproximadamente entre 3 y 8 segundos después de su creación.

9. Los Pods alcanzaron `Ready 1/1` aproximadamente entre 10 y 16 segundos después de su creación.

10. El mismo comportamiento se reprodujo en dos ciclos independientes.

### Interpretación del Pending observado

Durante las dos reproducciones controladas, las nuevas réplicas pasaron transitoriamente por estado `Pending` antes de alcanzar `Running` y posteriormente `Ready`.

La evidencia demuestra que los Pods **sí fueron programados correctamente**, debido a que:

- recibieron un nodo;
- se registró `Scheduled — Successfully assigned`;
- no apareció `FailedScheduling`;
- `PodScheduled` terminó en `True`.

Por lo tanto, el `Pending` observado durante estas pruebas **no corresponde a un fallo de scheduling**.

El comportamiento observado es consistente con el período transitorio entre la creación/programación del Pod y el inicio efectivo de su contenedor.

### Hipótesis sobre el incidente original

El incidente original fue descrito como un período de `Pending` aparentemente mayor al observado durante las pruebas controladas.

Entre las posibles explicaciones se encuentran:

- que correspondiera al mismo período transitorio de creación, pero observado durante más tiempo;
- que existiera carga temporal sobre alguno de los nodos;
- que durante aquella ejecución fuera necesario obtener o preparar recursos que actualmente ya se encontraban disponibles.

Sin embargo, **ninguna de estas hipótesis puede demostrarse con la evidencia actualmente disponible**, debido a que los Events del incidente original ya no se encuentran disponibles.

### Causas no observadas durante las pruebas actuales

Durante estas reproducciones no se encontró evidencia de:

- falta de CPU o memoria que impidiera scheduling;
- `FailedScheduling`;
- `FailedCreate`;
- agotamiento de ResourceQuota;
- incumplimiento de LimitRange;
- problemas de `nodeSelector`;
- problemas de `affinity`;
- conflictos con taints/tolerations;
- problemas relacionados con PVC o almacenamiento persistente;
- `ImagePullBackOff`;
- `ErrImagePull`.

Estas condiciones pueden descartarse **para las dos reproducciones realizadas**, pero no deben utilizarse retrospectivamente para afirmar con certeza qué ocurrió durante un incidente histórico del cual ya no existen Events.

### Causa raíz

**No existe evidencia suficiente para determinar la causa raíz del incidente original si este correspondió a Pods que permanecieron en `Pending` durante un período significativamente mayor.**

Lo que sí quedó demostrado durante S2-T1 es que:

- las nuevas réplicas pueden crearse correctamente;
- Kubernetes puede asignarlas a nodos correctamente;
- el estado `Pending` aparece de forma transitoria durante el proceso de creación;
- no se observaron fallos de scheduling, admisión o cuota;
- las réplicas alcanzaron `Running` y `Ready` sin intervención adicional.

Por lo tanto, **el Pending reproducido durante las pruebas actuales corresponde a un estado transitorio del proceso de creación y arranque, y no a un fallo demostrado de configuración o scheduling**.

---

## 8. Configuración involucrada

No se identificó durante S2-T1 una configuración problemática que pueda demostrarse como causante del incidente original.

Sin embargo, se detectaron aspectos relevantes para las siguientes tareas.

### Drift del número de réplicas

**Recurso:** Deployment `ms-menus`  
**Archivo:** `k8s-next/ms-menus/deployment.yaml`

Configuración versionada:

```yaml
replicas: 1
```

Estado encontrado en el clúster:

```text
replicas: 3
```

El manifiesto versionado no refleja el estado actual del Deployment.

Este punto deberá revisarse antes de implementar Horizontal Pod Autoscaler, debido a que el número de réplicas pasará a ser administrado dinámicamente por el HPA.

### Readiness durante el arranque

Se observó una primera sonda de readiness con `connection refused` mientras el proceso todavía estaba iniciándose.

La configuración actual utiliza:

```text
initialDelaySeconds: 3
periodSeconds: 5
```

Posteriormente la sonda fue satisfactoria y todos los Pods alcanzaron `Ready 1/1`.

Por lo tanto, **no existe evidencia en estas pruebas de que la configuración actual de readiness constituya un fallo funcional**.

No se recomienda modificarla únicamente para eliminar una advertencia transitoria sin realizar antes una medición específica del tiempo de arranque.

### ResourceQuota

La ResourceQuota no causó problemas durante los ciclos `1 → 3`.

Sin embargo, representa un límite relevante para el futuro HPA:

```text
pods:        8/12
limits.cpu:  1150m/2
```

Por lo tanto, `maxReplicas` deberá definirse considerando los recursos disponibles del namespace y los demás Pods que se encuentren ejecutándose.

---

## 9. Relación con Horizontal Pod Autoscaler

Este diagnóstico es necesario antes de implementar Horizontal Pod Autoscaler porque el HPA puede solicitar nuevas réplicas, pero Kubernetes debe ser capaz de crearlas y ejecutarlas correctamente.

Las pruebas de S2-T1 demostraron que Kubernetes actualmente puede:

```text
ms-menus: 1 réplica
        ↓
escalamiento
        ↓
ms-menus: 3 réplicas
        ↓
nuevos Pods programados
        ↓
Running
        ↓
Ready 1/1
```

Se realizaron dos ciclos sin `FailedScheduling` ni `FailedCreate`.

### Restricciones relevantes para HPA

La cantidad máxima de réplicas deberá considerar la ResourceQuota disponible en el namespace.

Además, durante el diagnóstico previo se ejecutaron:

```powershell
kubectl top pods -n student-cdarwitg
kubectl top nodes
```

Ambos comandos devolvieron `Forbidden` debido a los permisos RBAC disponibles para el usuario utilizado.

Este resultado **no permite concluir que Metrics Server no exista**.

Únicamente demuestra que el usuario actual no dispone de permisos para consultar directamente esos recursos mediante `kubectl top`.

Antes de implementar un HPA basado en utilización de CPU deberá comprobarse si el controlador HPA del clúster puede acceder a `metrics.k8s.io` y obtener las métricas necesarias.

---

## 10. Conclusión

### ¿Se reprodujo el síntoma?

Sí.

Durante los dos ciclos `1 → 3`, las nuevas réplicas aparecieron inicialmente con `STATUS = Pending`.

### ¿Se reprodujo un fallo de Pending persistente?

No.

Los nuevos Pods abandonaron `Pending` automáticamente y alcanzaron `Running` aproximadamente entre 3 y 8 segundos después de su creación.

Posteriormente alcanzaron `Ready 1/1` aproximadamente entre 10 y 16 segundos.

### ¿Existió un problema de scheduling?

No se observó durante las pruebas realizadas.

Los Pods fueron asignados correctamente a nodos y no apareció ningún evento `FailedScheduling`.

### ¿Existió un problema de ResourceQuota?

No se observó durante las pruebas realizadas.

La cuota permaneció dentro de sus límites y no se registró `FailedCreate`.

### ¿Se encontró la causa del incidente original?

No puede determinarse retrospectivamente si el incidente original presentó una duración significativamente mayor.

Los Events correspondientes a ese momento ya no están disponibles y no existe evidencia suficiente para atribuirlo a una causa específica.

### ¿Existe una configuración que deba corregirse?

No se identificó una configuración causante del `Pending` durante las reproducciones.

Sin embargo, antes de implementar HPA deberán atenderse:

1. la diferencia entre `replicas: 1` del manifiesto y las 3 réplicas existentes en el clúster;
2. el límite establecido por ResourceQuota;
3. la disponibilidad de métricas necesarias para el HPA.

### Siguiente acción

La siguiente tarea deberá preparar `ms-menus` para Horizontal Pod Autoscaler y verificar previamente que el clúster permita al HPA obtener las métricas necesarias.

> **Conclusión final:** El síntoma de nuevas réplicas apareciendo inicialmente en estado `Pending` sí pudo reproducirse. Sin embargo, durante las dos pruebas controladas este estado fue transitorio: los Pods fueron programados correctamente, iniciaron sus contenedores y alcanzaron `Ready` sin intervención adicional. No se registraron eventos `FailedScheduling`, `FailedCreate` ni agotamiento de ResourceQuota. Por ello, no se identificó un fallo de configuración responsable del comportamiento reproducido. Si el incidente original presentó un `Pending` significativamente más prolongado, su causa no puede determinarse retrospectivamente con la evidencia actualmente disponible.

---

## 11. Estado final

Al finalizar S2-T1:

- **Réplicas finales de `ms-menus`:** 3
- **Deployment:** `3/3 READY`
- **Available:** 3
- **Unavailable:** 0
- **ReplicaSet:** 3/3

### Pods finales

- `ms-menus-6465dcb67f-hjcfg` → agent-02 → `Running` `1/1`
- `ms-menus-6465dcb67f-l6kd5` → agent-01 → `Running` `1/1`
- `ms-menus-6465dcb67f-shvbz` → agent-03 → `Running` `1/1`

El Service `ms-menus` (`ClusterIP :3003`) permaneció operativo después del escalamiento.

El único archivo creado durante S2-T1 fue:

```text
docs/kubernetes/diagnostico-pods-pending-ms-menus.md
```

No se realizaron cambios permanentes sobre otros recursos Kubernetes durante esta tarea.