# API Endpoints — CoffeeFaster

Base URL: `http://localhost:3000`

---

## Tabla de contenidos

1. [Autenticación](#autenticación)
   - [POST /auth/register](#post-authregister)
   - [POST /auth/login](#post-authlogin)
   - [GET /auth/me](#get-authme)
2. [Cafeterías y Productos](#cafeterías-y-productos)
   - [GET /cafeterias](#get-cafeterias)
   - [GET /cafeterias/:cafeteria_id/productos](#get-cafeteriascafeteria_idproductos)
3. [Pedidos](#pedidos)
   - [GET /pedidos](#get-pedidos)
4. [Salud del Servidor](#salud-del-servidor)
   - [GET /health](#get-health)
5. [Autenticación JWT](#autenticación-jwt)

---

## Autenticación

### POST `/auth/register`

Registra un nuevo usuario en el sistema.

**Headers:**

```
Content-Type: application/json
```

**Body (entrada):**

```json
{
  "nombre": "string",
  "apellido": "string",
  "email": "string",
  "password": "string",
  "rol": "string",
  "telefono": "string (opcional)"
}
```

| Campo | Tipo | Requerido | Restricciones |
|-------|------|-----------|---------------|
| `nombre` | string | Si | Debe ser string |
| `apellido` | string | Si | Debe ser string |
| `email` | string | Si | Debe ser string. Se normaliza a lowercase + trim |
| `password` | string | Si | Minimo 6 caracteres |
| `rol` | string | Si | Valores permitidos: `cliente`, `dueño`, `empleado`, `superadmin` |
| `telefono` | string | No | Si se envia, debe ser string |

**Respuestas:**

| Codigo | Descripcion | Body |
|--------|-------------|------|
| `201` | Registro exitoso | Ver estructura abajo |
| `400` | Campos requeridos faltantes, tipos invalidos, rol invalido o password < 6 caracteres | `{ "error": "string" }` |
| `409` | El email ya esta registrado | `{ "error": "El email ya está registrado" }` |
| `500` | Error interno del servidor | `{ "error": "Error interno del servidor" }` |

**Estructura de respuesta 201:**

```json
{
  "id": "1",
  "rol": "cliente",
  "nombre": "Juan",
  "apellido": "Perez",
  "email": "juan@correo.cl",
  "telefono": "+56912345678",
  "foto_url": null,
  "activo": true,
  "ultima_conexion": null,
  "creado_en": "2026-09-01T12:00:00.000Z"
}
```

> **Nota:** El campo `password_hash` nunca se retorna en la respuesta.

---

### POST `/auth/login`

Autentica un usuario y devuelve un token JWT.

**Headers:**

```
Content-Type: application/json
```

**Body (entrada):**

```json
{
  "email": "string",
  "password": "string"
}
```

| Campo | Tipo | Requerido |
|-------|------|-----------|
| `email` | string | Si |
| `password` | string | Si |

**Respuestas:**

| Codigo | Descripcion | Body |
|--------|-------------|------|
| `200` | Login exitoso | Ver estructura abajo |
| `400` | Email o password faltantes | `{ "error": "Email y password son requeridos" }` |
| `401` | Credenciales invalidas o usuario inactivo | `{ "error": "Credenciales inválidas" }` o `{ "error": "Usuario inactivo" }` |
| `500` | Error interno del servidor | `{ "error": "Error interno del servidor" }` |

**Estructura de respuesta 200:**

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "usuario": {
    "id": "1",
    "rol": "cliente",
    "nombre": "Juan",
    "apellido": "Perez",
    "email": "juan@correo.cl",
    "telefono": "+56912345678",
    "foto_url": null,
    "activo": true,
    "ultima_conexion": "2026-09-01T12:05:00.000Z",
    "creado_en": "2026-09-01T12:00:00.000Z"
  }
}
```

> **Nota:** Al hacer login exitoso, se actualiza el campo `ultima_conexion` del usuario.

---

### GET `/auth/me`

Retorna el perfil del usuario autenticado. Requiere token JWT.

**Headers:**

```
Authorization: Bearer <token>
```

**Body:** No aplica.

**Respuestas:**

| Codigo | Descripcion | Body |
|--------|-------------|------|
| `200` | OK | Objeto usuario (misma estructura que en login) |
| `401` | Sin token, formato invalido, token expirado, token invalido o usuario inactivo | `{ "error": "string" }` |
| `404` | Usuario no encontrado en la base de datos | `{ "error": "Usuario no encontrado" }` |
| `500` | Error interno del servidor | `{ "error": "Error interno del servidor" }` |

**Estructura de respuesta 200:**

```json
{
  "id": "1",
  "rol": "cliente",
  "nombre": "Juan",
  "apellido": "Perez",
  "email": "juan@correo.cl",
  "telefono": "+56912345678",
  "foto_url": null,
  "activo": true,
  "ultima_conexion": "2026-09-01T12:05:00.000Z",
  "creado_en": "2026-09-01T12:00:00.000Z"
}
```

---

## Cafeterías y Productos

### GET `/cafeterias`

Lista todas las cafeterias registradas.

**Headers:** No requiere autenticacion.

**Body:** No aplica.

**Respuestas:**

| Codigo | Descripcion | Body |
|--------|-------------|------|
| `200` | Array de cafeterias | Ver estructura abajo |

**Estructura de respuesta 200:**

```json
[
  {
    "id": "1",
    "nombre": "Cafetería Central",
    "descripcion": "Cafetería principal del campus universitario, ubicada en el edificio central. Ambiente amplio con WiFi y zona de estudio.",
    "hora_apertura": "07:00",
    "hora_cierre": "20:00",
    "imagen_url": "https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=400",
    "activa": true
  },
  {
    "id": "2",
    "nombre": "Café Ingeniería",
    "descripcion": "Especializada en café de especialidad y snacks saludables. Ubicada en la facultad de Ingeniería.",
    "hora_apertura": "08:00",
    "hora_cierre": "18:00",
    "imagen_url": "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=400",
    "activa": true
  },
  {
    "id": "3",
    "nombre": "Biblioteca Café",
    "descripcion": "Cafetería tranquila dentro de la biblioteca central. Ideal para sesiones de estudio largas.",
    "hora_apertura": "08:00",
    "hora_cierre": "22:00",
    "imagen_url": "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400",
    "activa": true
  }
]
```

---

### GET `/cafeterias/:cafeteria_id/productos`

Lista todos los productos activos de una cafetería específica.

**Headers:** No requiere autenticacion.

**Parametros de ruta:**

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `cafeteria_id` | string | ID de la cafetería |

**Body:** No aplica.

**Respuestas:**

| Codigo | Descripcion | Body |
|--------|-------------|------|
| `200` | Array de productos de la cafetería | Ver estructura abajo |
| `404` | Cafeteria no encontrada | `{ "error": "Cafetería no encontrada" }` |

**Estructura de respuesta 200:**

```json
[
  {
    "id": "1",
    "cafeteria_id": "1",
    "nombre": "Café Americano",
    "descripcion": "Café negro clásico, preparado con granos 100% arábica de origen colombiano.",
    "precio": 2500,
    "imagen_url": "https://images.unsplash.com/photo-1541167760496-1628856ab772?w=300",
    "stock": 50,
    "activo": true
  },
  {
    "id": "2",
    "cafeteria_id": "1",
    "nombre": "Croissant de Almendra",
    "descripcion": "Croissant artesanal relleno de crema de almendra tostada.",
    "precio": 3500,
    "imagen_url": "https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=300",
    "stock": 20,
    "activo": true
  }
]
```

> **Nota:** El campo `precio` esta en **CLP** (pesos chilenos, valor entero).

---

## Pedidos

### GET `/pedidos`

Lista todos los pedidos registrados. Actualmente retorna datos mock sin requerir autenticacion.

**Headers:** No requiere autenticacion actualmente (pendiente de proteger con JWT).

**Body:** No aplica.

**Respuestas:**

| Codigo | Descripcion | Body |
|--------|-------------|------|
| `200` | Array de pedidos | Ver estructura abajo |

**Estructura de respuesta 200:**

```json
[
  {
    "id": "1",
    "usuario_id": "1",
    "cafeteria_id": "1",
    "productos": [
      {
        "producto_id": "1",
        "nombre": "Café Americano",
        "cantidad": 2,
        "precio_unitario": 2500,
        "subtotal": 5000
      },
      {
        "producto_id": "3",
        "nombre": "Croissant de Almendra",
        "cantidad": 1,
        "precio_unitario": 3500,
        "subtotal": 3500
      }
    ],
    "total": 8500,
    "estado": "Pendiente",
    "creado_en": "2026-08-24T08:30:00.000Z"
  }
]
```

**Estados posibles de un pedido:**

| Estado | Descripcion |
|--------|-------------|
| `Pendiente` | Pedido recibido, esperando preparacion |
| `En_preparacion` | Pedido en proceso de preparacion |
| `Listo` | Pedido listo para retirar |

> **Nota:** `POST /pedidos` **no existe** actualmente. Solo esta implementado `GET /pedidos` con datos mock.

---

## Salud del Servidor

### GET `/health`

Verifica que el servidor este operativo.

**Headers:** No requiere autenticacion.

**Body:** No aplica.

**Respuestas:**

| Codigo | Descripcion | Body |
|--------|-------------|------|
| `200` | Servidor operativo | Ver estructura abajo |

**Estructura de respuesta 200:**

```json
{
  "status": "ok",
  "timestamp": "2026-09-01T12:00:00.000Z"
}
```

---

## Autenticación JWT

### Header requerido

Las rutas protegidas exigen el siguiente header:

```
Authorization: Bearer <token_jwt>
```

### Payload del token

El token JWT contiene el siguiente payload:

```json
{
  "id": "1",
  "email": "juan@correo.cl",
  "rol": "cliente",
  "nombre": "Juan",
  "iat": 1756734000,
  "exp": 1757338800
}
```

### Duracion del token

Por defecto **7 dias**. Configurable via variable de entorno `JWT_EXPIRES_IN`.

### Errores del middleware de autenticacion

| Mensaje de error | Causa |
|------------------|-------|
| `"Token de autorización requerido"` | Header `Authorization` ausente |
| `"Formato de token inválido. Use: Bearer <token>"` | Header no tiene formato `Bearer <token>` (debe tener exactamente 2 partes separadas por espacio) |
| `"Token expirado"` | El JWT ha expirado segun `exp` |
| `"Token inválido"` | La firma del JWT no es valida |
| `"Usuario no encontrado"` | El `id` del token no corresponde a ningun usuario en la base de datos |
| `"Usuario inactivo"` | El usuario tiene `activo: false` |

---

## Convenciones generales

- **Puerto por defecto:** 3000 (configurable via `PORT` en `.env`)
- **Content-Type:** `application/json` en todos los endpoints
- **Precios:** En pesos chilenos (CLP), valores enteros
- **IDs:** Strings autoincrementales internos (mock). En Supabase seran UUIDs
- **Passwords:** Nunca se retornan en respuestas. Se almacenan con bcrypt (10 rounds)
- **Email:** Se normaliza a lowercase + trim en registro y login
- **CORS:** Habilitado para todos los origenes
- **Helmet:** Habilitado (headers de seguridad HTTP)
- **Logging:** Morgan en modo `dev`

---

## Variables de entorno

| Variable | Valor por defecto | Descripcion |
|----------|-------------------|-------------|
| `PORT` | `3000` | Puerto del servidor |
| `JWT_SECRET` | (requerido) | Clave secreta para firmar JWT |
| `JWT_EXPIRES_IN` | `7d` | Tiempo de expiracion del token JWT |
