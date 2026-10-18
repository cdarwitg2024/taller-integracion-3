# Configuración de Fortio para pruebas de carga

> Tarea: **S2-T6** — Configurar Fortio para generar carga
> Fecha: 2026-10-18
> Rama: `S2-T6-Camilodg-Configurar_Fortio_para_generar_carga`

## 1. Objetivo

Dejar **Fortio** preparado para generar **carga controlada** contra los
microservicios de CoffeeFast y poder **observar después** el comportamiento del
HPA (que aumente Pods cuando suba la CPU).

Esta tarea **T6** solo audita y **valida** Fortio con una prueba mínima
(`SMOKE`). **No** se ejecuta carga `MEDIA` ni `ALTA`: la demostración de
escalado (`1 → 2` Pods) es **S2-T7**.

## 2. Fortio existente

| Campo | Valor |
|---|---|
| Tipo de recurso | **Pod standalone** (`kind: Pod`, sin ownerReferences) |
| Nombre | `fortio` |
| Namespace | `student-cdarwitg` |
| Imagen | `fortio/fortio` (`fortio/fortio:latest`) |
| Args | `["server"]` |
| Versión real | **Fortio 1.75.3** (go1.25.14, linux/amd64) |
| restartPolicy | `Never` |
| requests | `cpu 25m`, `memory 64Mi` |
| limits | `cpu 100m`, `memory 128Mi` |
| QoS | Burstable |
| Nodo | `rke2-estudiantes-agent-02` |
| Estado | `Running`, `Ready 1/1`, `restarts 0` |
| Ownership | Ninguno (Pod directo, no Deployment/Job) |

El Pod corre `fortio server` (UI/API), pero para las pruebas se ejecutan
comandos `fortio ...` **dentro** del Pod vía `kubectl exec`.

### Infraestructura como código (CASO B)

Fortio **no** estaba versionado en el repositorio (solo había menciones en docs).
Se agregó `k8s-next/fortio/fortio.yaml` como **manifiesto declarativo que
representa** el Pod vivo, **sin aplicarlo** (aplicarlo podría recrear el Pod
existente). No se creó un segundo Fortio.

## 3. Conectividad

Desde el Pod `fortio` (comandos `fortio curl`, sin instalar nada):

| Microservicio | URL health | Resultado |
|---|---|---|
| ms-cafeterias | `http://ms-cafeterias:3002/health` | **HTTP 200** `{"status":"healthy"}` |
| ms-menus | `http://ms-menus:3003/health` | **HTTP 200** `{"status":"healthy"}` |
| ms-pedidos | `http://ms-pedidos:3005/health` | **HTTP 200** `{"status":"healthy"}` |

DNS interno y conectividad HTTP correctos hacia los tres.

## 4. Endpoints candidatos

Endpoints reales revisados en el código (`*.routes.js` / `*.controller.js` /
`*.service.js`):

| MS | Endpoint | Auth | Read-only | Supabase | Apto | Motivo |
|---|---|---|---|---|---|---|
| ms-cafeterias | `GET /health` | No | Sí | No | Sí (débil) | No toca Supabase; puede consumir poca CPU |
| ms-cafeterias | `GET /api/cafeterias` | **No** | **Sí** | **SELECT** | **Sí (recomendado)** | Público, read-only, representativo (consulta real) |
| ms-cafeterias | `GET /api/cafeterias/:id` | No | Sí | SELECT | Sí | Requiere un id válido |
| ms-menus | `GET /health` | No | Sí | No | Sí (débil) | No toca Supabase |
| ms-menus | `GET /api/menus` | **No** | **Sí** | **SELECT** | **Sí (recomendado)** | Público, read-only, representativo |
| ms-menus | `GET /api/menus/:id` | No | Sí | SELECT | Sí | Requiere id válido |
| ms-menus | `POST /api/menus/precios` | No | No (POST) | SELECT | **No** | Es POST e interno; el gateway lo bloquea (404) |
| ms-pedidos | `GET /health` | No | Sí | No | **Sí (recomendado)** | Único endpoint público; los demás exigen JWT |
| ms-pedidos | `GET /api/pedidos` | **JWT** | Sí | SELECT | No | Exige token |
| ms-pedidos | `GET /api/pedidos/:id` | **JWT** | Sí | SELECT | No | Exige token |
| ms-pedidos | `GET /api/pedidos/cafeteria/:id` | **JWT** | Sí | SELECT | No | Exige token |
| ms-pedidos | `GET /api/pedidos/usuario/:id` | **JWT** | Sí | SELECT | No | Exige token |

**Recomendados para carga:**
- **ms-cafeterias:** `GET /api/cafeterias`
- **ms-menus:** `GET /api/menus`
- **ms-pedidos:** `GET /health`

## 5. Autenticación (PASO 7)

`ms-pedidos` exige **JWT** en **todos** sus endpoints reales (`exigirAuth`), y
la validación hace un *round-trip* a Supabase (`auth.getUser`) **por request**.

Decisión: **no** se usan tokens en las pruebas.
- No se imprimen ni se guardan tokens (ni en scripts ni en Git).
- **No** se debilita la autenticación para facilitar Fortio.
- Para `ms-pedidos` se usa `GET /health` (público, read-only).

## 6. Estrategia de carga

Flags verificadas en la versión instalada (`fortio load -help`): `-qps`, `-c`,
`-t`, `-n`, `-json`, `-loglevel`, etc. No se usan flags inventadas.

| Nivel | QPS | Concurrencia | Duración | Comando |
|---|---|---|---|---|
| **SMOKE** | 10 | 2 | 5s | `fortio load -qps 10 -c 2 -t 5s <URL>` |
| **MEDIA** | 100 | 10 | 30s | `fortio load -qps 100 -c 10 -t 30s <URL>` |
| **ALTA** | 300 | 30 | 120s | `fortio load -qps 300 -c 30 -t 120s <URL>` |

Script reutilizable (sigue la convención `.ps1` de `k8s-next/`):

```powershell
# SMOKE
pwsh ./k8s-next/comandos-fortio.ps1 -Url http://ms-menus:3003/api/menus -Qps 10 -Duration 5s -Concurrency 2

# MEDIA
pwsh ./k8s-next/comandos-fortio.ps1 -Url http://ms-menus:3003/api/menus -Qps 100 -Duration 30s -Concurrency 10

# ALTA (S2-T7)
pwsh ./k8s-next/comandos-fortio.ps1 -Url http://ms-menus:3003/api/menus -Qps 300 -Duration 120s -Concurrency 30
```

El script **no** contiene tokens/secretos y **no** modifica Kubernetes (no hace
`scale` ni toca los HPA).

> En T6 solo se ejecutó **SMOKE**. **MEDIA** y **ALTA** quedan pendientes para T7.

## 7. Smoke test (resultado real)

Ejecutado contra un endpoint real read-only:

- **URL:** `http://ms-menus:3003/api/menus`
- **Comando:** `fortio load -loglevel Warning -qps 10 -c 2 -t 5s http://ms-menus:3003/api/menus`

| Métrica | Valor |
|---|---|
| QPS solicitado | 10 |
| Concurrencia | 2 |
| Duración | 5s |
| Requests totales | **40** (+2 warmup) |
| Código 200 | **40 (100.0%)** |
| Errores | **0** |
| Latencia media | **254.25 ms** |
| p50 | **236.13 ms** |
| p75 | 250 ms |
| p90 | **330 ms** |
| p99 | **610.91 ms** |
| Throughput real | **7.8 qps** |

Notas:
- No alcanzó los 10 qps objetivo: con 2 hilos y ~250 ms por llamada, el techo es
  ~8 qps. La latencia (round-trip a Supabase) manda sobre la CPU.
- Para subir el throughput real en T7 hay que subir **concurrencia** (más que QPS).

## 8. Estado HPA posterior al smoke

`kubectl get hpa -n student-cdarwitg`:

| HPA | TARGETS | MIN | MAX | RÉPLICAS |
|---|---|---|---|---|
| ms-cafeterias | cpu 2%/70% | 1 | 2 | **1** |
| ms-menus | cpu 6%/70% | 1 | 2 | **1** |
| ms-pedidos | cpu 2%/70% | 1 | 2 | **1** |

Deployments: los 4 (`gateway`, `ms-cafeterias`, `ms-menus`, `ms-pedidos`) en
`1/1`. Pods: 5 (fortio + gateway + 3 MS), todos Running.

**No hubo escalado** (esperado con un smoke tan pequeño). No se modificaron los
HPA ni se ejecutó `kubectl scale`.

## 9. Preparación para S2-T7

Objetivo de T7: demostrar que la carga dispara el HPA y este **sube de 1 a 2
Pods** automáticamente.

Procedimiento propuesto:

1. **Confirmar estado inicial** (1 réplica por MS):
   ```powershell
   kubectl get hpa -n student-cdarwitg
   kubectl get pods -n student-cdarwitg
   ```
2. **Generar carga** sobre el MS objetivo. Como el cuello es la latencia de
   Supabase, se prioriza **concurrencia** alta sobre QPS:
   ```powershell
   # ejemplo ms-menus
   pwsh ./k8s-next/comandos-fortio.ps1 -Url http://ms-menus:3003/api/menus -Qps 300 -Duration 120s -Concurrency 30
   ```
   Si con `ms-menus` no sube la CPU > 70%, aumentar concurrencia (p. ej. `-c 50`)
   o repetir el bloque (el HPA evalúa por defecto cada 15s y puede tardar 1–3
   min en escalar).
3. **Observar el HPA** en paralelo (mientras corre la carga):
   ```powershell
   kubectl get hpa -n student-cdarwitg -w
   kubectl get pods -n student-cdarwitg -w
   ```
   Esperado: `REPLICAS` pasa de `1` a `2` cuando la CPU supera el **70%**.
4. **Detener la carga**: el `-t` termina solo. **No** se hace `kubectl scale`
   manual.
5. **Confirmar el descenso**: minutos después de bajar la carga, el HPA vuelve a
   `1` réplica (política de scale-down).

Consideraciones de capacidad (ResourceQuota actual): `pods 5/12`,
`requests.cpu 225m/1`, `limits.cpu 700m/2`. Subir los 3 MS de 1 a 2 réplicas
consume +3 pods y +150m req.cpu / +450m lim.cpu, dentro de la cuota.

No se modifica en T6 ni en T7: ResourceQuota, LimitRange, RBAC, Metrics Server,
ni los valores de los HPA (`min`/`max`/target).
