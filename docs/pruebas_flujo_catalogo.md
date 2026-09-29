# Prueba del flujo de catálogo — T11

**Alcance:** Registro → Login → Cafeterías → seleccionar cafetería → Menú → Producto → disponibilidad

**Fecha:** 29 de septiembre de 2026
**Entorno:** Supabase local (`http://127.0.0.1:54321`), app móvil React Native con emulador Android

---

## Resultado

**El flujo completo se recorre sin errores bloqueantes.** No fue necesario corregir
código de la app para poder completarlo.

---

## 1. Pruebas de integración contra la API

Cada paso se ejecutó con llamadas reales a la API de Supabase, usando un usuario
recién creado, para comprobar que el flujo funciona de verdad y no solo en pantalla.

| # | Paso | Resultado | Evidencia |
|---|------|-----------|-----------|
| 1 | Registro | ✅ OK | `HTTP 200`. El trigger `on_auth_user_created` crea la fila en `usuarios` y la wallet con saldo inicial. |
| 2 | Login | ✅ OK | `HTTP 200`, sesión creada. |
| 3 | Ver cafeterías | ✅ OK | 3 cafeterías activas visibles para un usuario recién registrado (RLS permite lectura). |
| 4 | Menú de una cafetería | ✅ OK | 17 productos, con la categoría embebida correctamente. |
| 5 | Detalle de producto | ✅ OK | El componente recibe el producto ya normalizado por `mapProduct`. |
| 6 | Disponibilidad | ✅ OK | `productos` está en la publicación `supabase_realtime`; el hook se suscribe a UPDATE, INSERT y DELETE. |

### Verificación del paso Registro → Login

El registro es el paso con más piezas encadenadas, porque la app manda metadata que
un trigger de la base tiene que interpretar:

- `RegisterScreen` envía `first_name`, `last_name` y `full_name` en `user_metadata`
- El trigger `handle_new_auth_user` lee `first_name` / `last_name` y arma `usuarios`

Resultado con una cuenta nueva:

```
nombre      "Prueba"
apellido    "Flujo"
wallets     1 fila,  saldo $10.000
```

El nombre y apellido llegan correctamente, y el saldo inicial se crea solo.

### Verificación de la consulta del menú

Se probó la consulta **exacta** que usa `MenuScreen.js`, que incluye el embed de la
categoría (`categorias(nombre)`). Ese embed depende de que exista la clave foránea,
así que se verificó también que esté creada:

```
productos_cafeteria_id_fkey -> cafeterias(id)
productos_categoria_id_fkey -> categorias(id) ON DELETE SET NULL
```

```
17 producto(s)
ej: "Croissant de Almendra" $3.500   categorias={"nombre":"Repostería"}
```

### Verificación de la disponibilidad en tiempo real

| Requisito | Estado |
|-----------|--------|
| Tabla en la publicación `supabase_realtime` | ✅ `productos` |
| RLS con política de lectura para el usuario | ✅ `productos_select_public` |
| `REPLICA IDENTITY` para diff de UPDATE | ✅ `default` |
| Claves foráneas para los embeds | ✅ ambas |

---

## 2. Pruebas manuales en la app

| Caso | Resultado |
|------|-----------|
| Registro con cuenta nueva y entrada automática al catálogo | ✅ OK |
| Login con la cuenta recién creada | ✅ OK |
| Listado de cafeterías | ✅ 3 cafeterías reales |
| Menú con filtro por categoría | ✅ OK |
| Detalle de producto (apertura y cierre con el botón atrás) | ✅ OK |
| Disponibilidad actualizándose sola al cambiar el stock en la base | ✅ OK |

---

## 3. Hallazgos

### 3.1 Sin impacto en el flujo: usuarios huérfanos al borrar una cuenta

Al borrar una cuenta de Supabase Auth, la fila de `usuarios` y la de `wallets`
**quedan en la base**.

**Causa:** el trigger solo escucha el INSERT.

```sql
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_auth_user();
```

No hay nada que atrase el `DELETE`, así que el perfil y el saldo sobreviven a la
cuenta. Se confirmó en la práctica: al eliminar 4 usuarios de prueba de Auth,
quedaron 4 filas en `usuarios` y 4 en `wallets`.

**Por qué importa:** si se borra una cuenta de prueba antes de una demo, quedan
usuarios fantasma con saldo y el correo queda ocupado en `usuarios.email`.

**Corrección propuesta** (no aplicada: queda fuera del alcance de esta tarea, que
es de verificación):

```sql
CREATE OR REPLACE FUNCTION public.borrar_usuario_al_eliminar()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  DELETE FROM public.wallets WHERE usuario_id IN (
    SELECT id FROM public.usuarios WHERE auth_user_id = OLD.id
  );
  DELETE FROM public.usuarios WHERE auth_user_id = OLD.id;
  RETURN OLD;
END $$;

CREATE TRIGGER on_auth_user_deleted
  AFTER DELETE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.borrar_usuario_al_eliminar();
```

### 3.2 Falso positivo descartado: consistencia de la disponibilidad

Al revisar el hook `useDisponibilidadProductos` se detectó una aparente
contradicción con `MenuScreen`: el hook recalcula `available` como `stock > 0`
ignorando `activo` y `eliminado_en`, mientras `mapProduct` usa
`activo && !eliminado && stock > 0`.

**Se investigó y se descartó.** `MenuScreen` aplica antes el caso
`!activo || eliminado`, que saca el producto de la lista. Los dos caminos son
consistentes y un producto desactivado desaparece correctamente.

Queda documentado para que nadie lo "arregle" después.

---

## 4. Limpieza

Las cuentas creadas para la prueba se eliminaron de Supabase Auth y de la base,
junto con sus wallets. La base quedó con los 3 usuarios reales del taller:

| id | Nombre | Correo | Saldo |
|----|--------|--------|-------|
| 1 | María | maria.gonzalez@cafeteria.com | $50.000 |
| 2 | Camila | estudiante@alu.uct.cl | $3.000 |
| 3 | Enrique | enrique2026@alu.uct.cl | $10.000 |

---

## 5. Requisitos de la tarea

| Requisito | Estado |
|-----------|--------|
| Probar Registro → Login → Cafeterías → cafetería → Menú → Producto → disponibilidad | ✅ Completado |
| Corregir errores que impidan completar el flujo | ✅ No se encontraron errores bloqueantes |
