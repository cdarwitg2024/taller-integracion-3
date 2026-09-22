# Investigación: Supabase

## 1. ¿Qué es Supabase?

Supabase es una plataforma **open source** que funciona como una alternativa a Firebase. Es un "Backend as a Service" (BaaS): te da todo el backend listo para usar, de forma que solo te concentras en el frontend.

Se describe a sí misma como **"una base de datos PostgreSQL con esteroides"**. En lugar de usar una base NoSQL (como hace Firebase), está construida sobre **PostgreSQL**, una base de datos relacional completa y madura.

Principios clave:

- **Todo es open source** y autohospedable (se puede correr en tu propio servidor).
- Se basa en **estándares existentes** (SQL, REST, JWT, S3) en lugar de reinventar ruedas.
- Es **portable**: es fácil migrar datos dentro y fuera (usa `pg_dump`, CSV, etc.).
- Es **componible**: cada módulo funciona solo, pero se potencian entre sí.

## 2. Tecnologías que utiliza (stack interno)

Cada proyecto de Supabase es un conjunto de servicios, todos open source, que hablan con una única base de datos PostgreSQL:

| Componente                    | Qué es                                                            | Tecnología            |
| ----------------------------- | ------------------------------------------------------------------ | ---------------------- |
| **PostgreSQL**          | La base de datos principal (núcleo de todo)                       | C                      |
| **GoTrue**              | Servicio de autenticación (usuarios, tokens JWT)                  | Go                     |
| **PostgREST**           | Convierte la base de datos en una**API REST** automática    | Haskell                |
| **pg_graphql**          | Extensión que genera una**API GraphQL** automática         | SQL/Rust               |
| **Realtime**            | Motor de**WebSockets** (presencia, broadcast, cambios en DB) | Elixir                 |
| **Storage API**         | Almacenamiento de archivos **compatible con S3**            | Node.js / TypeScript   |
| **Deno Edge Functions** | Ejecución de funciones serverless en TypeScript                   | Deno (TypeScript/Rust) |
| **postgres-meta**       | API para gestionar la base (tablas, roles, consultas)              | Node.js / TypeScript   |
| **Supavisor**           | Pooler de conexiones a PostgreSQL (multi-tenant)                   | Elixir                 |
| **Envoy**               | Gateway / proxy de la API                                          | C++                    |
| **Studio**              | El panel de administración web (Dashboard)                        | TypeScript             |

> Al usar PostgreSQL estándar, puedes aprovechar todo su ecosistema: extensiones (PostGIS, pgvector para IA/embeddings), triggers, funciones, vistas, etc.

## 3. Características principales (los módulos)

### 3.1 Base de datos

- PostgreSQL completo con **acceso total** (puedes usar SQL puro).
- **RLS (Row Level Security)**: seguridad a nivel de fila mediante políticas, clave para proteger datos por usuario.
- Extensiones como **pgvector** (búsquedas vectoriales/IA), PostGIS (geoespacial), etc.

### 3.2 API

- **API REST autogenerada** (PostgREST): cada tabla se expone como endpoints `/table`, con filtros, paginación, joins y ordenamiento.
- **API GraphQL autogenerada** (pg_graphql).
- Autenticación mediante **JWT** y claves de proyecto (`anon` pública / `service_role` secreta).

### 3.3 Auth (Autenticación)

- Registro/login con **email y contraseña**, **magic links**, **proveedores sociales** (Google, GitHub, Apple, etc.), **teléfono (OTP)** y **SSO corporativo (SAML/OAuth2/OIDC)**.
- **MFA**, protección con **CAPTCHA**, gestión de sesiones y tokens JWT.

### 3.4 Realtime

- **Presence**: saber quién está conectado.
- **Broadcast**: mensajería en tiempo real entre clientes.
- **Database changes**: recibir cambios de la base en vivo vía WebSockets (ideal para chats, notificaciones).

### 3.5 Storage

- Almacenamiento de archivos (imágenes, videos, etc.) con **CDN** integrado.
- **Compatible con S3**, transformación de imágenes, y buckets públicos o privados con políticas de acceso.

### 3.6 Edge Functions

- Funciones serverless en **Deno/TypeScript** desplegadas en el borde (edge), para lógica de negocio personalizada.

### 3.7 Otros

- **SQL Editor**, **Cron** (tareas programadas), **Webhooks**, backups con point-in-time recovery, **CLI** de desarrollo local, y más.

## 4. Cómo trabajar con Supabase en la Web

### Flujo general (igual para web y móvil)

1. **Crear un proyecto** en [supabase.com](https://supabase.com/dashboard).
2. **Diseñar el esquema** de la base (desde el Dashboard, SQL o el CLI).
3. Copiar las credenciales: **Project URL** y la **clave pública (`publishable key` / `anon key`)**.
4. Instalar el **client library** de tu lenguaje/framework.
5. Trabajar con Auth, Base de datos, Storage, Realtime y Edge Functions desde el cliente.

### Clientes oficiales

- **JavaScript/TypeScript** → `@supabase/supabase-js` (usado por React, Vue, Node.js).
- **Framework SSR** (Next.js, etc.) → `@supabase/ssr` (manejo de sesiones vía cookies en servidor).
- Otros: Python, Dart/Flutter, Swift, Kotlin (todos generados con OpenAPI).

### Ejemplo de uso con JS (web)

```js
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(URL_PROYECTO, CLAVE_PUBLICA);

// Consultar datos
const { data, error } = await supabase
  .from('perfiles')
  .select('*')
  .eq('id', userId);

// Insertar
await supabase.from('mensajes').insert({ contenido: 'Hola' });

// Auth (login con email)
await supabase.auth.signInWithPassword({
  email: 'usuario@correo.com',
  password: 'clave'
});

// Realtime (escuchar cambios en vivo)
supabase.channel('public:mensajes')
  .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mensajes' },
    payload => console.log('Nuevo mensaje:', payload.new))
  .subscribe();
```

> **Importante (web)**: la clave pública se expone en el navegador sin problema, **siempre que se active RLS** en las tablas para que cada usuario solo vea/edite sus propios datos. La clave `service_role` **jamás** debe ir en el frontend.

## 5. Cómo trabajar con Supabase en Aplicaciones Móviles

La experiencia es la misma que en web: usas el client library de tu plataforma. Ejemplos oficiales:

- **Flutter** → paquete `supabase_flutter` (Android, iOS y web).
- **React Native / Expo** → `@supabase/supabase-js`.
- **iOS nativo** → `supabase-swift`.
- **Android nativo** → `supabase-kt` (Kotlin).

### Detalles específicos de móvil

- **Deep links**: para magic links o confirmación de email, se configura un *redirect URL* tipo `miapp://login-callback` y se registra en el sistema (AndroidManifest, Info.plist, etc.).
- **Notificaciones**: se integra con proveedores de push (por ejemplo, Expo Notifications o FCM).
- **Sesión offline/guardado**: el SDK guarda la sesión en el dispositivo para mantener el login.

### Ejemplo mínimo en Kotlin (supabase-kt)

```kotlin
// app/build.gradle.kts
dependencies {
    implementation("io.github.jan-tennert.supabase:postgrest-kt:2.0.0")
    implementation("io.github.jan-tennert.supabase:auth-kt:2.0.0")
}

// Inicialización del cliente (Application class u onCreate)
createSupabaseClient(
    supabaseUrl = URL_PROYECTO,
    supabaseKey = CLAVE_PUBLICA
) {
    install(Auth)
    install(Postgrest)
}
```

```kotlin
// Consultar perfil del usuario logueado
val usuario = supabase.auth.currentUserOrNull()

val perfil = supabase
    .from("perfiles")
    .select {
        eq("id", usuario?.id)
        single()
    }

// Login con email y contraseña
supabase.auth.signInWith(Email) {
    email = "usuario@correo.com"
    password = "clave"
}
```

## 6. Herramienta GUI de administración (Studio / Dashboard)

Supabase incluye **Studio**, un panel web open source (accesible en `app.supabase.com`) para administrar todo el proyecto sin escribir código:

| Sección                                 | Función                                                                                 |
| ---------------------------------------- | ---------------------------------------------------------------------------------------- |
| **Table Editor**                   | Ver y editar datos, crear tablas y relaciones con una interfaz visual.                   |
| **SQL Editor**                     | Escribir y ejecutar consultas SQL (incluye plantillas/quickstarts).                      |
| **Schema Designer**                | Diseñador visual de esquemas (arrastrar y soltar tablas/relaciones).                    |
| **Auth / Authentication**          | Gestionar usuarios, proveedores de login, plantillas de emails, políticas de seguridad. |
| **Storage**                        | Gestionar buckets y archivos, subir/descargar desde el navegador.                        |
| **Realtime**                       | Configurar canales y comportamiento en tiempo real.                                      |
| **Edge Functions**                 | Crear y desplegar funciones serverless.                                                  |
| **Reports / Logs**                 | Métricas de uso, consultas lentas y logs de la aplicación.                             |
| **API Docs**                       | Documentación generada automáticamente de tu API (REST y GraphQL).                     |
| **Security & Performance Advisor** | Recomendaciones para endurecer seguridad y optimizar rendimiento.                        |
| **Backups**                        | Copias de seguridad diarias y restauración point-in-time.                               |

Además existe la **CLI** (`supabase`) para desarrollo local, migraciones (`supabase migration`), y el **Management API** para gestionar proyectos de forma programática.

## 7. Resumen (puntos clave)

- Supabase = **PostgreSQL + Backend completo (Auth, API, Storage, Realtime, Functions)**, todo open source.
- La **API es autogenerada**: no escribes endpoints, solo defines tu esquema.
- La seguridad se apoya en **RLS + JWT**: la clave pública va en el cliente, pero las políticas de base de datos protegen los datos.
- Funciona igual en **web y móvil** gracias a client libraries (`supabase-js`, `supabase_flutter`, Swift, Kotlin, Python).
- Su **GUI (Studio)** permite administrar base de datos, auth, storage y funciones sin tocar código.

## Referencias

- Documentación oficial: https://supabase.com/docs
- Arquitectura: https://supabase.com/docs/guides/getting-started/architecture
- Características: https://supabase.com/docs/guides/getting-started/features
- Tutoriales oficiales: https://supabase.com/docs/guides/getting-started/tutorials
