# Investigación: Node.js con Express

## 1. ¿Qué es Node.js con Express?

**Node.js** es un entorno de ejecución multiplataforma y **open source** que permite ejecutar código JavaScript del lado del servidor. No es un lenguaje de programación nuevo, sino una forma de sacar a JavaScript del navegador web utilizando el motor V8 de Google Chrome, lo que le otorga un altísimo rendimiento.

**Express.js** es un framework web rápido, flexible y minimalista construido sobre Node.js. Si Node.js proporciona la infraestructura base, Express proporciona las herramientas de alto nivel para gestionar rutas, peticiones web y comunicaciones HTTP sin tener que escribir el código base desde cero.

Principios clave de esta arquitectura:

- **Asíncrono y Basado en Eventos (Non-blocking I/O):** La arquitectura de Node.js no se bloquea. Si el servidor debe hacer una consulta lenta a una base de datos, no detiene todo el sistema; pasa la tarea a un segundo plano, atiende a otros usuarios (ej. otros estudiantes en la app) y emite un evento cuando la tarea inicial termina.

- **Un solo lenguaje (Isomorfismo):** Permite utilizar JavaScript o TypeScript de manera unificada en todo el stack tecnológico.
- **Minimalista y "No Opinado":** A diferencia de frameworks monolíticos, Express no impone una estructura de carpetas estricta ni obliga a usar un ORM o motor de base de datos específico. Otorga total libertad arquitectónica para construir microservicios independientes.

- **Basado en el Ecosistema NPM:** Se apoya en Node Package Manager, el registro de software más grande del mundo, permitiendo instalar módulos y librerías externas fácilmente.

## 2. Tecnologías del Ecosistema

Para el desarrollo del servidor (capa de microservicios) y cumplimiento de los requerimientos técnicos del proyecto, se integran los siguientes módulos:

| Componente                    | Descripción y Función en el Proyecto                               | Tecnología Base        |
| ----------------------------- | ------------------------------------------------------------------ | ---------------------- |
| **Node.js**                   | Entorno de ejecución principal para la lógica del backend.         | C++ / JavaScript       |
| **Express**                   | Framework para el enrutamiento web y gestión de peticiones REST.   | JavaScript             |
| **dotenv**                    | Módulo para aislar y cargar **Variables de Entorno** seguras.      | JavaScript             |
| **qrcode**                    | Librería especializada en la **generación de códigos QR** 2D.      | JavaScript             |
| **cors**                      | Middleware para permitir peticiones desde dominios/apps externas.  | JavaScript             |
| **nodemon** (Desarrollo)      | Herramienta que reinicia el servidor automáticamente al hacer cambios. | CLI                    |

## 3. Características principales (Conceptos clave del servidor)

### 3.1 Rutas RESTful

Una API RESTful estructura la comunicación entre el cliente (App Móvil o de Escritorio) y el servidor utilizando los verbos estándar del protocolo HTTP. Cada ruta representa una acción sobre un recurso.

- **GET**: Para consultar o leer datos. 
- **POST**: Para crear nuevos registros y enviar datos sensibles. 
- **PUT / PATCH**: Para actualizar información existente. 
- **DELETE**: Para eliminar recursos o cancelar pedidos.

Express facilita la implementación de estos endpoints delegando la lógica a métodos simples como `app.get()`, `app.post()`, manejando automáticamente los encabezados HTTP.

### 3.2 Middlewares (Interceptores)

Los middlewares son el núcleo del funcionamiento de Express. Son funciones que interceptan y se ejecutan durante el ciclo de vida de una petición HTTP (request) ANTES de que el servidor envíe la respuesta (response). 

Tienen acceso a los objetos `req` (lo que pide el usuario), `res` (lo que responderá el servidor) y a la función `next()`, la cual delega el control al siguiente middleware en la cadena.

Aplicaciones críticas de los middlewares en el proyecto:

- **Parseo de datos:** `app.use(express.json())` intercepta el texto plano que envía la aplicación y lo transforma en un objeto JSON manipulable.

- **Autenticación y Autorización:** Se pueden crear middlewares personalizados que lean un Token JWT. Si el token es inválido, el middleware rechaza la petición devolviendo un error 401 (No Autorizado) sin siquiera llegar a ejecutar la ruta del pedido.

- **Registro (Logging):** Auditar el tráfico, guardando en un registro la hora, IP y acción de cada petición.

### 3.3 Variables de Entorno (`dotenv`)

Las variables de entorno son configuraciones dinámicas que varían según el lugar donde se ejecuta el código (Entorno de Desarrollo en la PC local, o Entorno de Producción en el servidor de la universidad). Su propósito absoluto es **gestionar secretos, credenciales y puertos de forma segura**.

En lugar de codificar contraseñas de bases de datos (como la clave pública/secreta de Supabase) o tokens de APIs en el código fuente, estos valores se almacenan en un archivo llamado `.env`. 

La regla de oro es que el archivo `.env` **debe ser excluido del control de versiones** mediante `.gitignore`. La librería `dotenv` se encarga de inyectar estos valores en el objeto global `process.env` al arrancar el servidor.

### 3.4 Generación de códigos QR (`qrcode`)

La librería `qrcode` es la solución estándar en Node.js para la creación matemática de códigos de barras bidimensionales. Permite procesar cadenas de texto (como tokens criptográficos, identificadores de pedidos o identificadores de alumnos) y convertirlas en un formato visual decodificable por escáneres o cámaras.

Formatos de salida soportados por la librería:

- **Base64 (Data URI):** Imagen codificada en una cadena de texto larga. Es ideal para APIs REST, ya que se puede transmitir en una respuesta JSON y renderizarse directamente en el frontend (Android/React) sin necesidad de descargar un archivo.

- **Archivos de imagen físicos:** Exportación a formatos como `.png` almacenados directamente en el disco duro del servidor.

- **Salida de Terminal:** Impresión directa en consola para fines de depuración y testing.

## 4. Estructura de Servidor Recomendada

Dado que Express es "no opinado", el equipo de desarrollo es responsable de definir una arquitectura limpia. Para un entorno orientado a microservicios escalable, lo que se recomienda abandonar el patrón de tener todo el código en un solo archivo y adoptar una estructura basada en rutas y controladores modulares (similar a MVC, pero sin la capa "Vista").

Estructura de directorios propuesta para el microservicio:

```text
/microservicio-pedidos
├── /docs
│   └── investigacion_nodejs.md   # Documentación técnica del proyecto
├── /src
│   ├── /config                   # Configuraciones (Conexión a DB, clientes externos)
│   ├── /controllers              # Lógica de negocio (Ej: qrController.js - qué hacer al pedir un QR)
│   ├── /middlewares              # Interceptores (Ej: authMiddleware.js - validación de JWT)
│   ├── /routes                   # Definición de endpoints RESTful (Ej: pedidoRoutes.js)
│   ├── /services                 # Lógica compleja delegada (Ej: cálculos de tiempos de espera)
│   └── app.js                    # Archivo principal: inicializa Express y agrupa los middlewares
├── .env                          # Variables de entorno (¡Excluido de Git!)
├── .gitignore                    # Reglas de exclusión para el control de versiones
└── package.json                  # Manifiesto del proyecto, scripts y dependencias
```

## 5. Requisitos e Instalación del Entorno

Para levantar el servidor y que el equipo pueda comenzar la fase de desarrollo, es necesario configurar el entorno base mediante la línea de comandos.

### 5.1 Requisitos Previos del Sistema
**Instalación de Node.js:** Descargar la versión LTS (Long Term Support) desde el sitio oficial `nodejs.org`. Esta instalación incluye por defecto `npm` (Node Package Manager) y el motor de ejecución local.

### 5.2 Inicialización e Instalación de Dependencias
Ejecutar la siguiente secuencia de comandos en la terminal, ubicados en la raíz de la carpeta del proyecto:

```bash
# 1. Inicializar el proyecto Node.js
# Esto crea el archivo package.json que administrará las dependencias.
npm init -y

# 2. Instalar el framework y las librerías base para producción
npm install express dotenv qrcode cors

# 3. Instalar herramientas exclusivas para el entorno de desarrollo
# Nodemon escucha los cambios en los archivos y reinicia el servidor automáticamente.
npm install --save-dev nodemon
```

Una vez instaladas, se debe modificar el archivo `package.json` para agregar un script de ejecución rápida:

```json
"scripts": {
  "start": "node src/app.js",
  "dev": "nodemon src/app.js"
}
```

Con esto, se puede levantar el servidor localmente usando el comando `npm run dev`.

## 6. Resumen (puntos claves)

- **Express.js** es el framework principal sobre el entorno de **Node.js**, agilizando la creación de la capa de microservicios mediante una sintaxis minimalista y "no opinada".

- La arquitectura orientada a clientes independientes (App Móvil y KDS de Escritorio) exige que la comunicación se realice mediante rutas **RESTful** que respondan estrictamente en formato **JSON**.

- El flujo de la aplicación se controla a través de **Middlewares**, que interceptan las peticiones para aplicar lógicas de parseo, seguridad y configuración de CORS de manera centralizada.

- El manejo de puertos y claves criptográficas se aísla mediante **Variables de Entorno (`dotenv`)**, garantizando que el código fuente pueda compartirse entre el equipo sin exponer vulnerabilidades.

- La librería **`qrcode`** permite generar eficientemente el código de validación de retiro en un formato de imagen **Base64**, el cual se transmite por red y es renderizado de forma nativa por las aplicaciones cliente.

## 7. Solución de Errores Comunes (Troubleshooting)

Al trabajar con Node.js, Express y sus librerías, es normal encontrarse con ciertos errores durante la instalación o el desarrollo. A continuación, se detallan los problemas más frecuentes y los comandos para solucionarlos.

### Error 1: "nodemon: command not found" o "no se reconoce como comando"
**El Problema:** Al intentar ejecutar `nodemon src/app.js`, la terminal arroja un error diciendo que el comando no existe.

**La Causa:** `nodemon` se instaló como dependencia local (solo para este proyecto) y la terminal no puede acceder a él de forma global.
**La Solución:** 

Alternativa A (Recomendada): Usar el comando `npx`, que busca y ejecuta paquetes locales de npm automáticamente.

```bash
npx nodemon src/app.js
```

Alternativa B: Ejecutarlo a través del script `dev` configurado previamente en el `package.json`.

```bash
npm run dev
```

### Error 2: "Error: Cannot find module 'X'" (Ej: express o qrcode)
**El Problema:** El servidor crashea al arrancar indicando que no encuentra un módulo.

**La Causa:** Alguien del equipo clonó el repositorio desde GitHub pero olvidó descargar la carpeta `node_modules`, o se intentó usar una librería sin instalarla.
**La Solución:** Instalar o reconstruir las dependencias leyendo el archivo `package.json`.

```bash
# Para instalar todas las dependencias faltantes del proyecto de golpe:
npm install

# Si el error persiste con una librería específica (ej. qrcode), reinstalarla:
npm install qrcode
```

### Error 3: Puerto ya en uso ("EADDRINUSE: address already in use :::3000")
**El Problema:** Al intentar iniciar el servidor, Node.js arroja un error rojo indicando `EADDRINUSE`.

**La Causa:** Ya hay otro servidor Node.js corriendo en el fondo utilizando el puerto 3000, o se cerró mal la terminal anterior y el proceso quedó "fantasma".
**La Solución:** Buscar y "matar" el proceso que está ocupando el puerto.

*Si estás en Windows (Símbolo del sistema o PowerShell):*
```bash
# 1. Buscar el PID (Process ID) que está usando el puerto 3000
netstat -ano | findstr :3000

# 2. Forzar el cierre del proceso (Reemplazar "1234" por el PID que te dio el paso anterior)
taskkill /PID 1234 /F
```

*Si estás en Linux / Mac:*
```bash
# Buscar y matar el proceso en un solo paso
kill -9 $(lsof -t -i:3000)
```

### Error 4: Bloqueo por políticas de CORS desde la App
**El Problema:** La consola de la aplicación (Electron o Kotlin) arroja un error: `No 'Access-Control-Allow-Origin' header is present on the requested resource`.

**La Causa:** El servidor Node.js está funcionando, pero está rechazando la conexión por seguridad porque la aplicación externa está en un "origen" (puerto o dominio) distinto.

**La Solución:** Asegurarse de que el middleware `cors` esté instalado e importado **antes** de declarar cualquier ruta en `app.js`.

```bash
# 1. Asegurarse de tener instalado el paquete
npm install cors
```

```javascript
// 2. En el archivo app.js, debe estar estrictamente en este orden:
const cors = require('cors');
const app = express();

app.use(cors()); // <-- PRIMERO EL CORS
app.use(express.json()); // <-- LUEGO EL PARSEO
app.post('/api/ruta...', ...); // <-- AL FINAL LAS RUTAS
```

### Error 5: Las Variables de Entorno devuelven "undefined"
**El Problema:** Al intentar usar `process.env.PORT` o alguna clave secreta, el servidor devuelve `undefined`.

**La Causa:** El archivo `.env` no está en la raíz del proyecto (está dentro de `/src`), tiene un nombre incorrecto (ej. `.env.txt`), o se está intentando usar la variable antes de ejecutar `dotenv.config()`.

**La Solución:** 

1. Mover el archivo `.env` a la carpeta principal (al mismo nivel que `package.json`).

2. Asegurarse de que la línea `require('dotenv').config();` sea lo **primero** que se ejecuta en la parte superior del archivo `app.js`.

## 9. Referencias

- Node.js (Documentación Oficial): https://nodejs.org/es/docs/
- Express.js (Guía de Enrutamiento y Middlewares): https://expressjs.com/es/
- Repositorio de la librería `qrcode`: https://www.npmjs.com/package/qrcode
- Guía de implementación de variables de entorno (`dotenv`): https://www.npmjs.com/package/dotenv