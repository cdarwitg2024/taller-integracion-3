# V06 — Registro independiente de entradas y salidas

Fecha: 17 de noviembre de 2026 (UTC).

Resultado: **30/30 casos aprobados**, más comprobación de ausencia de escrituras.

Este archivo contiene solo evidencia textual y puede eliminarse sin afectar la migración, la ejecución de la aplicación o las pruebas de estructura. Ningún archivo ejecutable depende de él. No contiene seeds ni comandos INSERT.

## Entorno y trazabilidad

- PostgreSQL: PostgreSQL 17.12 on x86_64-pc-linux-musl, compiled by gcc (Alpine 15.2.0) 15.2.0, 64-bit
- Node.js: v22.23.5.
- Contenedor dedicado: `cf-v06-validacion`, sin red, eliminado después de validar.
- Base temporal: `cf_v04_test_200828_1794939967347`, eliminada al finalizar.
- Migración: `20261117175958_cotizar_carrito_afiliado.sql`.
- SHA-256 del archivo validado: `c6f3fd11f0441d03cc344fd36f466a5ef9499c08c2335b3696eaa22d0d8f02de`.
- Identidad de prueba: rol SQL `authenticated` con UUID ficticio en `request.jwt.claim.sub`; `auth.uid()` emulado en PostgreSQL. No acredita GoTrue, JWT HTTP real, gateway ni Cloud.
- Se cargaron datos ficticios únicamente en la base desechable desde un script temporal externo al repositorio; no se añadieron fixtures, seeds ni runners funcionales al proyecto. Cada consulta se ejecutó entre BEGIN y ROLLBACK.

## Referencias temporales de entrada

- Usuarios 10 y 11: estudiantes; 11 es el afiliado del código NORTE. Usuario 1: dueño. Usuario 4: empleado. Usuario 12: cuenta inactiva. Usuario 20: comprador con atribuciones previas no revertidas.
- Cafetería 1; producto 41: $10.000 normal; producto 42: $10.000 con promoción vigente 20 %, precio efectivo $8.000; producto 43: $9.990 normal.
- Campaña 31: vigente, activa y aceptada, descuento normal 15 %, oferta 5 %, comisión 10 %. Afiliación 431: aprobada, código NORTE activo.
- Afiliación 501: código DESACTIVADO. Afiliaciones 502 y 503: pendiente y rechazada; ambas con código NULL por restricción V04. Enviarlas como texto no constituye un código válido.
- Campañas 32–37: futura, pausada, vencida, borrador, sin aceptación y sin tasa de oferta, respectivamente. Sus códigos son CAMPANA-ID. OTRA-11 pertenece a la cafetería 2.

## Casos ejecutados

### 01. C01: código elegible en carrito normal

Estado: **APROBADO**.

Entrada y contexto:

```json
{
  "usuario": 10,
  "cafeteria_id": 1,
  "items": [
    {
      "producto_id": 41,
      "cantidad": 1
    }
  ],
  "codigo": "NORTE",
  "rol": "authenticated",
  "sinSesion": false
}
```

Consulta:

```sql
SELECT row_to_json(c) FROM public.cotizar_carrito_afiliado(1,'[{"producto_id":41,"cantidad":1}]'::jsonb,'NORTE') c;
```

Salida esperada:

```json
{"subtotal":10000,"descuento_afiliado":1500,"total":8500,"comision":850,"motivo":null}
```

Salida observada:

```json
{"subtotal":10000,"descuento_afiliado":1500,"total":8500,"comision":850,"motivo":null}
```

### 02. C01: redondeo de $1.498,50 hacia arriba

Estado: **APROBADO**.

Entrada y contexto:

```json
{
  "usuario": 10,
  "cafeteria_id": 1,
  "items": [
    {
      "producto_id": 43,
      "cantidad": 1
    }
  ],
  "codigo": "NORTE",
  "rol": "authenticated",
  "sinSesion": false
}
```

Consulta:

```sql
SELECT row_to_json(c) FROM public.cotizar_carrito_afiliado(1,'[{"producto_id":43,"cantidad":1}]'::jsonb,'NORTE') c;
```

Salida esperada:

```json
{"subtotal":9990,"descuento_afiliado":1499,"total":8491,"comision":849,"motivo":null}
```

Salida observada:

```json
{"subtotal":9990,"descuento_afiliado":1499,"total":8491,"comision":849,"motivo":null}
```

### 03. C01: carrito mixto normal y en oferta

Estado: **APROBADO**.

Entrada y contexto:

```json
{
  "usuario": 10,
  "cafeteria_id": 1,
  "items": [
    {
      "producto_id": 41,
      "cantidad": 1
    },
    {
      "producto_id": 42,
      "cantidad": 1
    }
  ],
  "codigo": "NORTE",
  "rol": "authenticated",
  "sinSesion": false
}
```

Consulta:

```sql
SELECT row_to_json(c) FROM public.cotizar_carrito_afiliado(1,'[{"producto_id":41,"cantidad":1},{"producto_id":42,"cantidad":1}]'::jsonb,'NORTE') c;
```

Salida esperada:

```json
{"subtotal":18000,"descuento_afiliado":1900,"total":16100,"comision":1610,"motivo":null}
```

Salida observada:

```json
{"subtotal":18000,"descuento_afiliado":1900,"total":16100,"comision":1610,"motivo":null}
```

### 04. Carrito solo en oferta

Estado: **APROBADO**.

Entrada y contexto:

```json
{
  "usuario": 10,
  "cafeteria_id": 1,
  "items": [
    {
      "producto_id": 42,
      "cantidad": 1
    }
  ],
  "codigo": "NORTE",
  "rol": "authenticated",
  "sinSesion": false
}
```

Consulta:

```sql
SELECT row_to_json(c) FROM public.cotizar_carrito_afiliado(1,'[{"producto_id":42,"cantidad":1}]'::jsonb,'NORTE') c;
```

Salida esperada:

```json
{"subtotal":8000,"descuento_afiliado":400,"total":7600,"comision":760,"motivo":null}
```

Salida observada:

```json
{"subtotal":8000,"descuento_afiliado":400,"total":7600,"comision":760,"motivo":null}
```

### 05. Código inválido

Estado: **APROBADO**.

Entrada y contexto:

```json
{
  "usuario": 10,
  "cafeteria_id": 1,
  "items": [
    {
      "producto_id": 41,
      "cantidad": 1
    }
  ],
  "codigo": "NO-EXISTE",
  "rol": "authenticated",
  "sinSesion": false
}
```

Consulta:

```sql
SELECT row_to_json(c) FROM public.cotizar_carrito_afiliado(1,'[{"producto_id":41,"cantidad":1}]'::jsonb,'NO-EXISTE') c;
```

Salida esperada:

```json
{"subtotal":10000,"descuento_afiliado":0,"total":10000,"comision":0,"motivo":"codigo_invalido"}
```

Salida observada:

```json
{"subtotal":10000,"descuento_afiliado":0,"total":10000,"comision":0,"motivo":"codigo_invalido"}
```

### 06. Código desactivado

Estado: **APROBADO**.

Entrada y contexto:

```json
{
  "usuario": 10,
  "cafeteria_id": 1,
  "items": [
    {
      "producto_id": 41,
      "cantidad": 1
    }
  ],
  "codigo": "DESACTIVADO",
  "rol": "authenticated",
  "sinSesion": false
}
```

Consulta:

```sql
SELECT row_to_json(c) FROM public.cotizar_carrito_afiliado(1,'[{"producto_id":41,"cantidad":1}]'::jsonb,'DESACTIVADO') c;
```

Salida esperada:

```json
{"subtotal":10000,"descuento_afiliado":0,"total":10000,"comision":0,"motivo":"codigo_desactivado"}
```

Salida observada:

```json
{"subtotal":10000,"descuento_afiliado":0,"total":10000,"comision":0,"motivo":"codigo_desactivado"}
```

### 07. Afiliación pendiente: sin código canjeable

Estado: **APROBADO**.

Entrada y contexto:

```json
{
  "usuario": 10,
  "cafeteria_id": 1,
  "items": [
    {
      "producto_id": 41,
      "cantidad": 1
    }
  ],
  "codigo": "502",
  "rol": "authenticated",
  "sinSesion": false
}
```

Consulta:

```sql
SELECT row_to_json(c) FROM public.cotizar_carrito_afiliado(1,'[{"producto_id":41,"cantidad":1}]'::jsonb,'502') c;
```

Salida esperada:

```json
{"subtotal":10000,"descuento_afiliado":0,"total":10000,"comision":0,"motivo":"codigo_invalido"}
```

Salida observada:

```json
{"subtotal":10000,"descuento_afiliado":0,"total":10000,"comision":0,"motivo":"codigo_invalido"}
```

### 08. Afiliación rechazada: sin código canjeable

Estado: **APROBADO**.

Entrada y contexto:

```json
{
  "usuario": 10,
  "cafeteria_id": 1,
  "items": [
    {
      "producto_id": 41,
      "cantidad": 1
    }
  ],
  "codigo": "503",
  "rol": "authenticated",
  "sinSesion": false
}
```

Consulta:

```sql
SELECT row_to_json(c) FROM public.cotizar_carrito_afiliado(1,'[{"producto_id":41,"cantidad":1}]'::jsonb,'503') c;
```

Salida esperada:

```json
{"subtotal":10000,"descuento_afiliado":0,"total":10000,"comision":0,"motivo":"codigo_invalido"}
```

Salida observada:

```json
{"subtotal":10000,"descuento_afiliado":0,"total":10000,"comision":0,"motivo":"codigo_invalido"}
```

### 09. Carrito sin beneficio: sin código

Estado: **APROBADO**.

Entrada y contexto:

```json
{
  "usuario": 10,
  "cafeteria_id": 1,
  "items": [
    {
      "producto_id": 41,
      "cantidad": 1
    }
  ],
  "codigo": null,
  "rol": "authenticated",
  "sinSesion": false
}
```

Consulta:

```sql
SELECT row_to_json(c) FROM public.cotizar_carrito_afiliado(1,'[{"producto_id":41,"cantidad":1}]'::jsonb,NULL) c;
```

Salida esperada:

```json
{"subtotal":10000,"descuento_afiliado":0,"total":10000,"comision":0,"motivo":"sin_codigo"}
```

Salida observada:

```json
{"subtotal":10000,"descuento_afiliado":0,"total":10000,"comision":0,"motivo":"sin_codigo"}
```

### 10. Código propio: comisión cero

Estado: **APROBADO**.

Entrada y contexto:

```json
{
  "usuario": 11,
  "cafeteria_id": 1,
  "items": [
    {
      "producto_id": 41,
      "cantidad": 1
    }
  ],
  "codigo": "NORTE",
  "rol": "authenticated",
  "sinSesion": false
}
```

Consulta:

```sql
SELECT row_to_json(c) FROM public.cotizar_carrito_afiliado(1,'[{"producto_id":41,"cantidad":1}]'::jsonb,'NORTE') c;
```

Salida esperada:

```json
{"subtotal":10000,"descuento_afiliado":1500,"total":8500,"comision":0,"motivo":null}
```

Salida observada:

```json
{"subtotal":10000,"descuento_afiliado":1500,"total":8500,"comision":0,"motivo":null}
```

### 11. C01: dueño activo también puede comprar

Estado: **APROBADO**.

Entrada y contexto:

```json
{
  "usuario": 1,
  "cafeteria_id": 1,
  "items": [
    {
      "producto_id": 41,
      "cantidad": 1
    }
  ],
  "codigo": "NORTE",
  "rol": "authenticated",
  "sinSesion": false
}
```

Consulta:

```sql
SELECT row_to_json(c) FROM public.cotizar_carrito_afiliado(1,'[{"producto_id":41,"cantidad":1}]'::jsonb,'NORTE') c;
```

Salida esperada:

```json
{"subtotal":10000,"descuento_afiliado":1500,"total":8500,"comision":850,"motivo":null}
```

Salida observada:

```json
{"subtotal":10000,"descuento_afiliado":1500,"total":8500,"comision":850,"motivo":null}
```

### 12. C01: empleado activo también puede comprar

Estado: **APROBADO**.

Entrada y contexto:

```json
{
  "usuario": 4,
  "cafeteria_id": 1,
  "items": [
    {
      "producto_id": 41,
      "cantidad": 1
    }
  ],
  "codigo": "NORTE",
  "rol": "authenticated",
  "sinSesion": false
}
```

Consulta:

```sql
SELECT row_to_json(c) FROM public.cotizar_carrito_afiliado(1,'[{"producto_id":41,"cantidad":1}]'::jsonb,'NORTE') c;
```

Salida esperada:

```json
{"subtotal":10000,"descuento_afiliado":1500,"total":8500,"comision":850,"motivo":null}
```

Salida observada:

```json
{"subtotal":10000,"descuento_afiliado":1500,"total":8500,"comision":850,"motivo":null}
```

### 13. Beneficio usado globalmente por el comprador

Estado: **APROBADO**.

Entrada y contexto:

```json
{
  "usuario": 20,
  "cafeteria_id": 1,
  "items": [
    {
      "producto_id": 41,
      "cantidad": 1
    }
  ],
  "codigo": "NORTE",
  "rol": "authenticated",
  "sinSesion": false
}
```

Consulta:

```sql
SELECT row_to_json(c) FROM public.cotizar_carrito_afiliado(1,'[{"producto_id":41,"cantidad":1}]'::jsonb,'NORTE') c;
```

Salida esperada:

```json
{"subtotal":10000,"descuento_afiliado":0,"total":10000,"comision":0,"motivo":"beneficio_usado"}
```

Salida observada:

```json
{"subtotal":10000,"descuento_afiliado":0,"total":10000,"comision":0,"motivo":"beneficio_usado"}
```

### 14. Código de otra cafetería

Estado: **APROBADO**.

Entrada y contexto:

```json
{
  "usuario": 10,
  "cafeteria_id": 1,
  "items": [
    {
      "producto_id": 41,
      "cantidad": 1
    }
  ],
  "codigo": "OTRA-11",
  "rol": "authenticated",
  "sinSesion": false
}
```

Consulta:

```sql
SELECT row_to_json(c) FROM public.cotizar_carrito_afiliado(1,'[{"producto_id":41,"cantidad":1}]'::jsonb,'OTRA-11') c;
```

Salida esperada:

```json
{"subtotal":10000,"descuento_afiliado":0,"total":10000,"comision":0,"motivo":"codigo_invalido"}
```

Salida observada:

```json
{"subtotal":10000,"descuento_afiliado":0,"total":10000,"comision":0,"motivo":"codigo_invalido"}
```

### 15. Elegibilidad: campana_no_iniciada

Estado: **APROBADO**.

Entrada y contexto:

```json
{
  "usuario": 10,
  "cafeteria_id": 1,
  "items": [
    {
      "producto_id": 41,
      "cantidad": 1
    }
  ],
  "codigo": "CAMPANA-32",
  "rol": "authenticated",
  "sinSesion": false
}
```

Consulta:

```sql
SELECT row_to_json(c) FROM public.cotizar_carrito_afiliado(1,'[{"producto_id":41,"cantidad":1}]'::jsonb,'CAMPANA-32') c;
```

Salida esperada:

```json
{"subtotal":10000,"descuento_afiliado":0,"total":10000,"comision":0,"motivo":"campana_no_iniciada"}
```

Salida observada:

```json
{"subtotal":10000,"descuento_afiliado":0,"total":10000,"comision":0,"motivo":"campana_no_iniciada"}
```

### 16. Elegibilidad: campana_pausada

Estado: **APROBADO**.

Entrada y contexto:

```json
{
  "usuario": 10,
  "cafeteria_id": 1,
  "items": [
    {
      "producto_id": 41,
      "cantidad": 1
    }
  ],
  "codigo": "CAMPANA-33",
  "rol": "authenticated",
  "sinSesion": false
}
```

Consulta:

```sql
SELECT row_to_json(c) FROM public.cotizar_carrito_afiliado(1,'[{"producto_id":41,"cantidad":1}]'::jsonb,'CAMPANA-33') c;
```

Salida esperada:

```json
{"subtotal":10000,"descuento_afiliado":0,"total":10000,"comision":0,"motivo":"campana_pausada"}
```

Salida observada:

```json
{"subtotal":10000,"descuento_afiliado":0,"total":10000,"comision":0,"motivo":"campana_pausada"}
```

### 17. Elegibilidad: campana_finalizada

Estado: **APROBADO**.

Entrada y contexto:

```json
{
  "usuario": 10,
  "cafeteria_id": 1,
  "items": [
    {
      "producto_id": 41,
      "cantidad": 1
    }
  ],
  "codigo": "CAMPANA-34",
  "rol": "authenticated",
  "sinSesion": false
}
```

Consulta:

```sql
SELECT row_to_json(c) FROM public.cotizar_carrito_afiliado(1,'[{"producto_id":41,"cantidad":1}]'::jsonb,'CAMPANA-34') c;
```

Salida esperada:

```json
{"subtotal":10000,"descuento_afiliado":0,"total":10000,"comision":0,"motivo":"campana_finalizada"}
```

Salida observada:

```json
{"subtotal":10000,"descuento_afiliado":0,"total":10000,"comision":0,"motivo":"campana_finalizada"}
```

### 18. Elegibilidad: campana_no_activa

Estado: **APROBADO**.

Entrada y contexto:

```json
{
  "usuario": 10,
  "cafeteria_id": 1,
  "items": [
    {
      "producto_id": 41,
      "cantidad": 1
    }
  ],
  "codigo": "CAMPANA-35",
  "rol": "authenticated",
  "sinSesion": false
}
```

Consulta:

```sql
SELECT row_to_json(c) FROM public.cotizar_carrito_afiliado(1,'[{"producto_id":41,"cantidad":1}]'::jsonb,'CAMPANA-35') c;
```

Salida esperada:

```json
{"subtotal":10000,"descuento_afiliado":0,"total":10000,"comision":0,"motivo":"campana_no_activa"}
```

Salida observada:

```json
{"subtotal":10000,"descuento_afiliado":0,"total":10000,"comision":0,"motivo":"campana_no_activa"}
```

### 19. Elegibilidad: campana_no_aceptada

Estado: **APROBADO**.

Entrada y contexto:

```json
{
  "usuario": 10,
  "cafeteria_id": 1,
  "items": [
    {
      "producto_id": 41,
      "cantidad": 1
    }
  ],
  "codigo": "CAMPANA-36",
  "rol": "authenticated",
  "sinSesion": false
}
```

Consulta:

```sql
SELECT row_to_json(c) FROM public.cotizar_carrito_afiliado(1,'[{"producto_id":41,"cantidad":1}]'::jsonb,'CAMPANA-36') c;
```

Salida esperada:

```json
{"subtotal":10000,"descuento_afiliado":0,"total":10000,"comision":0,"motivo":"campana_no_aceptada"}
```

Salida observada:

```json
{"subtotal":10000,"descuento_afiliado":0,"total":10000,"comision":0,"motivo":"campana_no_aceptada"}
```

### 20. Elegibilidad: condiciones_incompletas

Estado: **APROBADO**.

Entrada y contexto:

```json
{
  "usuario": 10,
  "cafeteria_id": 1,
  "items": [
    {
      "producto_id": 41,
      "cantidad": 1
    }
  ],
  "codigo": "CAMPANA-37",
  "rol": "authenticated",
  "sinSesion": false
}
```

Consulta:

```sql
SELECT row_to_json(c) FROM public.cotizar_carrito_afiliado(1,'[{"producto_id":41,"cantidad":1}]'::jsonb,'CAMPANA-37') c;
```

Salida esperada:

```json
{"subtotal":10000,"descuento_afiliado":0,"total":10000,"comision":0,"motivo":"condiciones_incompletas"}
```

Salida observada:

```json
{"subtotal":10000,"descuento_afiliado":0,"total":10000,"comision":0,"motivo":"condiciones_incompletas"}
```

### 21. No confiar en precio enviado por el cliente

Estado: **APROBADO**.

Entrada y contexto:

```json
{
  "usuario": 10,
  "cafeteria_id": 1,
  "items": [
    {
      "producto_id": 41,
      "cantidad": 1,
      "precio": 1,
      "usuario_id": 11
    }
  ],
  "codigo": "NORTE",
  "rol": "authenticated",
  "sinSesion": false
}
```

Consulta:

```sql
SELECT row_to_json(c) FROM public.cotizar_carrito_afiliado(1,'[{"producto_id":41,"cantidad":1,"precio":1,"usuario_id":11}]'::jsonb,'NORTE') c;
```

Salida esperada:

```json
{"subtotal":10000,"descuento_afiliado":1500,"total":8500,"comision":850,"motivo":null}
```

Salida observada:

```json
{"subtotal":10000,"descuento_afiliado":1500,"total":8500,"comision":850,"motivo":null}
```

### 22. Productos repetidos agrupados

Estado: **APROBADO**.

Entrada y contexto:

```json
{
  "usuario": 10,
  "cafeteria_id": 1,
  "items": [
    {
      "producto_id": 41,
      "cantidad": 1
    },
    {
      "producto_id": 41,
      "cantidad": 2
    }
  ],
  "codigo": "NORTE",
  "rol": "authenticated",
  "sinSesion": false
}
```

Consulta:

```sql
SELECT row_to_json(c) FROM public.cotizar_carrito_afiliado(1,'[{"producto_id":41,"cantidad":1},{"producto_id":41,"cantidad":2}]'::jsonb,'NORTE') c;
```

Salida esperada:

```json
{"subtotal":30000,"descuento_afiliado":4500,"total":25500,"comision":2550,"motivo":null}
```

Salida observada:

```json
{"subtotal":30000,"descuento_afiliado":4500,"total":25500,"comision":2550,"motivo":null}
```

### 23. Cuenta inactiva denegada

Estado: **APROBADO**.

Entrada y contexto:

```json
{
  "usuario": 12,
  "cafeteria_id": 1,
  "items": [
    {
      "producto_id": 41,
      "cantidad": 1
    }
  ],
  "codigo": "NORTE",
  "rol": "authenticated",
  "sinSesion": false
}
```

Consulta:

```sql
SELECT row_to_json(c) FROM public.cotizar_carrito_afiliado(1,'[{"producto_id":41,"cantidad":1}]'::jsonb,'NORTE') c;
```

Salida esperada:

```json
{"sqlstate":"42501"}
```

Salida observada:

```json
{"sqlstate":"42501"}
```

### 24. Rol inactivo denegado

Estado: **APROBADO**.

Entrada y contexto:

```json
{
  "usuario": 10,
  "cafeteria_id": 1,
  "items": [
    {
      "producto_id": 41,
      "cantidad": 1
    }
  ],
  "codigo": "NORTE",
  "rol": "authenticated",
  "sinSesion": false
}
```

Consulta:

```sql
SELECT row_to_json(c) FROM public.cotizar_carrito_afiliado(1,'[{"producto_id":41,"cantidad":1}]'::jsonb,'NORTE') c;
```

Condición temporal adicional, revertida al terminar: `UPDATE roles SET activo=false WHERE id=1;`

Salida esperada:

```json
{"sqlstate":"42501"}
```

Salida observada:

```json
{"sqlstate":"42501"}
```

### 25. Sesión ausente denegada

Estado: **APROBADO**.

Entrada y contexto:

```json
{
  "usuario": 10,
  "cafeteria_id": 1,
  "items": [
    {
      "producto_id": 41,
      "cantidad": 1
    }
  ],
  "codigo": "NORTE",
  "rol": "authenticated",
  "sinSesion": true
}
```

Consulta:

```sql
SELECT row_to_json(c) FROM public.cotizar_carrito_afiliado(1,'[{"producto_id":41,"cantidad":1}]'::jsonb,'NORTE') c;
```

Salida esperada:

```json
{"sqlstate":"42501"}
```

Salida observada:

```json
{"sqlstate":"42501"}
```

### 26. Acceso anon denegado

Estado: **APROBADO**.

Entrada y contexto:

```json
{
  "usuario": 10,
  "cafeteria_id": 1,
  "items": [
    {
      "producto_id": 41,
      "cantidad": 1
    }
  ],
  "codigo": "NORTE",
  "rol": "anon",
  "sinSesion": true
}
```

Consulta:

```sql
SELECT row_to_json(c) FROM public.cotizar_carrito_afiliado(1,'[{"producto_id":41,"cantidad":1}]'::jsonb,'NORTE') c;
```

Salida esperada:

```json
{"sqlstate":"42501"}
```

Salida observada:

```json
{"sqlstate":"42501"}
```

### 27. Acceso service_role denegado

Estado: **APROBADO**.

Entrada y contexto:

```json
{
  "usuario": 10,
  "cafeteria_id": 1,
  "items": [
    {
      "producto_id": 41,
      "cantidad": 1
    }
  ],
  "codigo": "NORTE",
  "rol": "service_role",
  "sinSesion": true
}
```

Consulta:

```sql
SELECT row_to_json(c) FROM public.cotizar_carrito_afiliado(1,'[{"producto_id":41,"cantidad":1}]'::jsonb,'NORTE') c;
```

Salida esperada:

```json
{"sqlstate":"42501"}
```

Salida observada:

```json
{"sqlstate":"42501"}
```

### 28. Cantidad inválida

Estado: **APROBADO**.

Entrada y contexto:

```json
{
  "usuario": 10,
  "cafeteria_id": 1,
  "items": [
    {
      "producto_id": 41,
      "cantidad": 0
    }
  ],
  "codigo": "NORTE",
  "rol": "authenticated",
  "sinSesion": false
}
```

Consulta:

```sql
SELECT row_to_json(c) FROM public.cotizar_carrito_afiliado(1,'[{"producto_id":41,"cantidad":0}]'::jsonb,'NORTE') c;
```

Salida esperada:

```json
{"sqlstate":"22023"}
```

Salida observada:

```json
{"sqlstate":"22023"}
```

### 29. Producto ajeno o inexistente

Estado: **APROBADO**.

Entrada y contexto:

```json
{
  "usuario": 10,
  "cafeteria_id": 1,
  "items": [
    {
      "producto_id": 999,
      "cantidad": 1
    }
  ],
  "codigo": "NORTE",
  "rol": "authenticated",
  "sinSesion": false
}
```

Consulta:

```sql
SELECT row_to_json(c) FROM public.cotizar_carrito_afiliado(1,'[{"producto_id":999,"cantidad":1}]'::jsonb,'NORTE') c;
```

Salida esperada:

```json
{"sqlstate":"22023"}
```

Salida observada:

```json
{"sqlstate":"22023"}
```

### 30. Límite acumulado de repetidos

Estado: **APROBADO**.

Entrada y contexto:

```json
{
  "usuario": 10,
  "cafeteria_id": 1,
  "items": [
    {
      "producto_id": 41,
      "cantidad": 600
    },
    {
      "producto_id": 41,
      "cantidad": 600
    }
  ],
  "codigo": "NORTE",
  "rol": "authenticated",
  "sinSesion": false
}
```

Consulta:

```sql
SELECT row_to_json(c) FROM public.cotizar_carrito_afiliado(1,'[{"producto_id":41,"cantidad":600},{"producto_id":41,"cantidad":600}]'::jsonb,'NORTE') c;
```

Salida esperada:

```json
{"sqlstate":"22023"}
```

Salida observada:

```json
{"sqlstate":"22023"}
```

## Ausencia de efectos persistidos

Se comparó el contenido completo, ordenado por ID, de usuarios, roles, productos, promociones, campañas, solicitudes de afiliación, pedidos, pagos, wallets, movimientos de Wallet y movimientos de comisión antes y después de los casos. **Sin diferencias**. Las condiciones transitorias y consultas se revirtieron; la base completa fue eliminada en el bloque de limpieza.

## Alcance

Se acreditan las entradas y salidas SQL requeridas por V06. La comisión de la salida es un cálculo, no una acreditación de saldo. La confirmación de pago, la serialización del beneficio y el endpoint HTTP corresponden a V07/V08 y C07. No se modificó ninguna base de desarrollo ni Cloud.
