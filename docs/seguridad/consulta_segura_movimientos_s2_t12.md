# Integración de Consulta Segura de Movimientos y Aislamiento por Wallet (S2-T12)

> **Tarea:** S2-T12 — Diego Vásquez — Integrar consulta segura de movimientos  
> **Fecha:** 2026-10-25  
> **Rama de trabajo:** `S2-T12-Diego-Vásquez-Integrar-consulta-segura-de-movimientos`  
> **Módulo:** `app-mobile` / Supabase Database  
> **Tipo de actividad:** Integración de cliente seguro, resiliencia ante errores y auditoría de seguridad RLS.

---

## 1. Contexto y Requerimiento

La tarea **S2-T12** tiene como objetivo:
> *"Conectar Mobile con el backend responsable de consultar movimientos, verificando que el usuario autenticado únicamente pueda consultar los movimientos pertenecientes a su propia Wallet."*

Esta tarea complementa y asegura la funcionalidad visual incorporada en **S2-T11** (`MovimientoItem.tsx`), garantizando que los datos exhibidos en la billetera móvil provengan de una conexión autenticada, resiliente y con estricto control de acceso multi-usuario.

---

## 2. Arquitectura de Consulta y Backend Responsable

En el ecosistema de CoffeeFast:
* El módulo de billetera (`wallets`) y movimientos (`movimientos_wallet`) se gestiona directamente en **Supabase** (PostgreSQL + PostgREST + Realtime) mediante tokens JWT emitidos por Supabase Auth.
* Los microservicios de aplicación (`backend-node`, `ms-pedidos`) delegan la consulta de saldos y transacciones históricas al motor de base de datos con políticas de seguridad a nivel de fila (**Row Level Security - RLS**).

### Flujo de Consulta Segura

```
+--------------------------------------------------------------------+
|                         App Mobile (React Native)                  |
| 1. Lee sesión activa: session.user.id (auth.uid)                   |
| 2. Obtiene usuario_id interno desde public.usuarios                |
| 3. Resuelve wallet_id perteneciente al usuario                     |
| 4. Consulta public.movimientos_wallet con filtro wallet_id         |
+---------------------------------+----------------------------------+
                                  |
                                  | HTTPS (Authorization: Bearer <JWT>)
                                  v
+--------------------------------------------------------------------+
|                       Supabase PostgREST API                       |
| - Valida firma y expiración del JWT                                |
| - Pasa contexto auth.uid() a PostgreSQL                            |
+---------------------------------+----------------------------------+
                                  |
                                  v
+--------------------------------------------------------------------+
|                 PostgreSQL Engine - RLS Enforcement                |
| Política: movimientos_wallet_select_own                            |
| USING (wallet_id IN (                                              |
|     SELECT w.id FROM wallets w                                     |
|     WHERE w.usuario_id = public.mi_usuario_id()                    |
| ))                                                                 |
| -> Si wallet_id pertenece al usuario: retorna registros.           |
| -> Si wallet_id es ajeno o usuario no autenticado: retorna 0 filas|
+--------------------------------------------------------------------+
```

---

## 3. Cambios Implementados en Mobile (`app-mobile`)

En el componente [`WalletScreen.tsx`](file:///home/diego/Proyectos/IntegraIII_Dev/taller-integracion-3/app-mobile/src/screens/WalletScreen.tsx):

1. **Estado de error dedicado (`errorMovimientos`):**
   * Se diferenció el estado de *lista vacía* (usuario nuevo sin transacciones) del estado de *error de consulta* (falla de conexión, token expirado o denegación).
2. **Resiliencia en `cargarSaldo()`:**
   * La consulta captura errores de PostgREST y problemas de red mediante bloque `try/catch`.
   * En caso de fallo, se notifica de forma segura al usuario sin exponer detalles internos ni tokens.
3. **Interfaz de reintento amigable:**
   * Se incorporó una tarjeta de error estilizada con ícono de advertencia y botón de acción secundaria *"Reintentar consulta"* que re-ejecuta la carga sincronizada.
4. **Protección de acceso anónimo / invitado:**
   * Si `userId` no está definido, se presenta la pantalla de bloqueo de billetera solicitando inicio de sesión previo.

---

## 4. Implementación y Auditoría en Base de Datos (`db_CoffeeFaster`)

Las directivas de seguridad y optimizaciones se encuentran implementadas formalmente en la migración [`0011_consulta_segura_movimientos_wallet.sql`](file:///home/diego/Proyectos/IntegraIII_Dev/db_CoffeeFaster/supabase/migrations/0011_consulta_segura_movimientos_wallet.sql) del repositorio `db_CoffeeFaster`, garantizando compatibilidad total con la plataforma Supabase y validadas con el script [`verificar_consulta_segura_movimientos.sql`](file:///home/diego/Proyectos/IntegraIII_Dev/taller-integracion-3/database/fixes/verificar_consulta_segura_movimientos.sql):

| Regla de Seguridad | Implementación | Resultado |
| :--- | :--- | :---: |
| **Aislamiento de lectura** | `movimientos_wallet_select_own` restringe la lectura a `wallet_id` del usuario autenticado. | **CUMPLIDO** |
| **Prevención de acceso cruzado** | Consulta con `wallet_id` de otro usuario retorna 0 filas. | **CUMPLIDO** |
| **Bloqueo a usuarios anónimos** | Rol `anon` sin permisos de `SELECT` sobre `movimientos_wallet`. | **CUMPLIDO** |
| **Protección contra manipulación** | `authenticated` no posee permisos de `INSERT`, `UPDATE` o `DELETE` sobre `movimientos_wallet` (solo muta vía RPC `recargar_saldo` o `procesar_pago`). | **CUMPLIDO** |

---

## 5. Verificación de Calidad

* **TypeScript / Typecheck:** Ejecutado en `app-mobile` sin errores de compilación ni advertencias en el código fuente.
* **Compatibilidad de Estilos:** Se utilizaron los tokens semánticos normalizados del sistema de diseño (`colors`, `spacing`, `typography`).
