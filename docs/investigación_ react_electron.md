# Investigación: Vite + React + MUI + Electron

## 1. Introducción

El desarrollo de aplicaciones de escritorio mediante tecnologías web permite combinar herramientas como **React, Vite, MUI y Electron** para construir interfaces modernas y aplicaciones multiplataforma.

Cada tecnología cumple una función diferente:

- **Vite** proporciona el entorno de desarrollo y construcción del proyecto.
- **React** permite crear la interfaz mediante componentes reutilizables.
- **MUI (Material UI)** proporciona componentes visuales prediseñados para React.
- **Electron** permite ejecutar una aplicación web como una aplicación de escritorio.
- **electron-builder** permite empaquetar la aplicación Electron para distribuirla.
- **WebSockets** permiten establecer una comunicación bidireccional y en tiempo real entre la aplicación y un servidor.

El objetivo de esta investigación es explicar estas tecnologías, su estructura, sus principales características y la forma en que pueden integrarse en una misma aplicación.

---

# 2. Vite + React

## 2.1 ¿Qué es React?

**React** es una biblioteca de JavaScript utilizada para construir interfaces de usuario mediante componentes.

En lugar de construir toda la interfaz como una única página, React permite dividirla en partes independientes y reutilizables.

Por ejemplo, una aplicación podría estar formada por:

```text
Aplicación
├── Navbar
├── Sidebar
├── Dashboard
│   ├── Card
│   └── Table
└── Footer
```

Cada elemento puede implementarse como un componente independiente.

Una característica importante de React es que los componentes pueden recibir información mediante `props` y mantener información interna mediante `state`.

Ejemplo:

```jsx
function Saludo({ nombre }) {
  return <h1>Hola, {nombre}</h1>;
}
```

El componente puede reutilizarse con diferentes valores:

```jsx
<Saludo nombre="Diego" />
<Saludo nombre="Pepito" />
```

De esta manera, React facilita la creación de interfaces modulares y reutilizables.

---

## 2.2 ¿Qué es Vite?

**Vite** es una herramienta de desarrollo y construcción para proyectos web modernos. Proporciona principalmente un servidor de desarrollo y un proceso de construcción para generar los archivos optimizados de producción.

Durante el desarrollo, Vite proporciona funcionalidades como **Hot Module Replacement (HMR)**, permitiendo reflejar cambios en el código rápidamente sin tener que reconstruir manualmente toda la aplicación.

Una distinción importante es:

```text
React → biblioteca para construir interfaces

Vite → herramienta utilizada para desarrollar y construir
        el proyecto
```

Por lo tanto, Vite no reemplaza a React. Ambas tecnologías cumplen funciones diferentes y pueden utilizarse conjuntamente.

---

## 2.3 Estructura de un proyecto

Una estructura posible para un proyecto Vite + React + Electron es:

```text
proyecto/
├── src/
│   ├── components/
│   │   ├── Navbar.jsx
│   │   └── Card.jsx
│   ├── pages/
│   │   └── Home.jsx
│   ├── App.jsx
│   └── main.jsx
│
├── electron/
│   ├── main.js
│   └── preload.js
│
├── public/
├── package.json
├── vite.config.js
└── index.html
```

### Principales elementos

| Elemento | Función |
|---|---|
| `src/` | Código principal de React |
| `components/` | Componentes reutilizables |
| `pages/` | Vistas o páginas de la aplicación |
| `App.jsx` | Componente principal |
| `main.jsx` | Punto de entrada de React |
| `electron/` | Código relacionado con Electron |
| `main.js` | Proceso principal de Electron |
| `preload.js` | Intermediario entre Electron y el renderer |
| `public/` | Archivos estáticos |
| `package.json` | Dependencias y scripts |
| `vite.config.js` | Configuración de Vite |

Esta separación permite mantener diferenciada la interfaz de usuario de las funcionalidades propias del entorno de escritorio.

Una estructura de este tipo también aparece en investigaciones previas del proyecto, donde React se separa del proceso principal de Electron.

---

## 2.4 Flujo básico de desarrollo

El funcionamiento general puede representarse de la siguiente manera:

```text
Código React
     │
     ↓
    Vite
     │
     ├── Servidor de desarrollo
     │
     └── Build de producción
             │
             ↓
       Archivos optimizados
```

Durante el desarrollo, Vite permite trabajar rápidamente sobre la interfaz. Cuando la aplicación está preparada para producción, el comando de construcción genera los archivos que posteriormente pueden ser utilizados por Electron.

---

# 3. MUI (Material UI)

## 3.1 ¿Qué es MUI?

**MUI (Material UI)** es una biblioteca de componentes para React que implementa los principios de **Material Design**. Proporciona componentes visuales listos para utilizar, evitando tener que construir desde cero muchos elementos comunes de una interfaz.

Por ejemplo, en lugar de crear manualmente un botón y definir todos sus estilos, se puede utilizar:

```jsx
import Button from '@mui/material/Button';

function Guardar() {
  return (
    <Button variant="contained">
      Guardar
    </Button>
  );
}
```

MUI también permite personalizar los componentes mediante propiedades, estilos y temas.

---

## 3.2 Principales componentes

MUI proporciona una gran variedad de componentes agrupados según su propósito. Entre ellos se encuentran botones, campos de entrada, tablas, diálogos, elementos de navegación y herramientas para organizar layouts.

| Componente | Función |
|---|---|
| `Button` | Ejecutar acciones |
| `TextField` | Introducir texto |
| `Select` | Seleccionar una opción |
| `Checkbox` | Selección múltiple o booleana |
| `Card` | Agrupar información |
| `Table` | Mostrar información tabular |
| `Dialog` | Mostrar ventanas de diálogo |
| `Alert` | Mostrar mensajes importantes |
| `Snackbar` | Mostrar notificaciones temporales |
| `AppBar` | Barra superior |
| `Drawer` | Menú lateral |
| `Tabs` | Navegación mediante pestañas |
| `Container` | Contenedor para organizar contenido |
| `Grid` | Organización de elementos |
| `Stack` | Distribución de elementos |

La biblioteca también cuenta con componentes más avanzados mediante **MUI X**, como Data Grid, selectores de fecha y hora y gráficos.

---

## 3.3 Formularios

Los componentes de MUI pueden utilizarse para crear formularios de forma sencilla.

Ejemplo:

```jsx
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';

function Login() {
  return (
    <>
      <TextField label="Usuario" />
      <TextField label="Contraseña" type="password" />

      <Button variant="contained">
        Iniciar sesión
      </Button>
    </>
  );
}
```

En este caso, `TextField` permite introducir información y `Button` permite ejecutar la acción correspondiente.

---

## 3.4 Organización de interfaces

MUI proporciona componentes destinados específicamente a organizar los elementos de una interfaz.

Por ejemplo, `Stack` permite distribuir elementos en una dirección determinada:

```jsx
<Stack spacing={2}>
  <TextField label="Nombre" />
  <TextField label="Correo" />
  <Button variant="contained">
    Guardar
  </Button>
</Stack>
```

También existen componentes como `Grid`, `Container` y `Box` para crear diferentes estructuras de layout.

Esto resulta especialmente útil en aplicaciones con paneles, formularios, tablas y menús.

---

## 3.5 Ventajas de utilizar MUI

Entre sus principales ventajas se encuentran:

- Gran cantidad de componentes disponibles.
- Integración directa con React.
- Componentes reutilizables.
- Soporte para personalización y temas.
- Diseño consistente.
- Componentes preparados considerando accesibilidad.
- Reducción del tiempo necesario para crear interfaces.

---

# 4. Electron

## 4.1 ¿Qué es Electron?

**Electron** es un framework que permite desarrollar aplicaciones de escritorio utilizando tecnologías web como JavaScript, HTML y CSS.

Una aplicación React normalmente se ejecuta dentro de un navegador. Electron permite utilizar esa interfaz web dentro de una aplicación de escritorio y acceder además a funcionalidades propias del sistema operativo.

Por esta razón, React y Electron cumplen funciones diferentes:

```text
React
 ↓
Interfaz de usuario

Electron
 ↓
Entorno de aplicación de escritorio
```

Electron utiliza una arquitectura multiproceso similar a la de Chromium. Sus dos procesos principales son el **Main Process** y los **Renderer Processes**.

---

## 4.2 Main Process

Cada aplicación Electron tiene un único **Main Process**, que actúa como punto de entrada de la aplicación.

Este proceso se ejecuta en un entorno Node.js y se encarga, entre otras cosas, de administrar las ventanas de la aplicación mediante `BrowserWindow`.

Ejemplo simplificado:

```js
const { app, BrowserWindow } = require('electron');

function createWindow() {
  const window = new BrowserWindow({
    width: 1200,
    height: 800
  });

  window.loadURL('http://localhost:5173');
}

app.whenReady().then(createWindow);
```

En una aplicación real, la URL utilizada durante desarrollo normalmente se reemplaza por los archivos generados por el proceso de build.

---

## 4.3 Renderer Process

Cada ventana de Electron posee un **Renderer Process**, encargado de mostrar el contenido web.

En una aplicación Vite + React, la interfaz React se ejecuta principalmente en este proceso.

Por lo tanto:

```text
Main Process
      │
      │ administra
      ↓
BrowserWindow
      │
      ↓
Renderer Process
      │
      ↓
React + MUI
```

El renderer se comporta de manera similar al contenido web de un navegador, mientras que el proceso principal tiene acceso a funcionalidades específicas de Electron y Node.js.

---

## 4.4 Preload

El archivo `preload.js` actúa como un intermediario entre el renderer y las funcionalidades de Electron.

Una arquitectura simplificada es:

```text
React
  │
  ↓
Renderer
  │
  ↓
Preload
  │
  ↓
Main Process
  │
  ↓
Funcionalidad de Electron
```

Esto permite exponer únicamente las funciones que la interfaz necesita, en lugar de proporcionar acceso directo e innecesario al entorno de Node.js.

---

## 4.5 Comunicación entre React y Electron

Cuando React necesita utilizar una funcionalidad propia de Electron, puede utilizar mecanismos de comunicación entre procesos, conocidos como **IPC (Inter-Process Communication)**.

El flujo general es:

```text
React
  │
  │ IPC
  ↓
Main Process
  │
  ↓
Funcionalidad del sistema
```

Esta separación permite mantener diferenciadas la interfaz y las operaciones propias del entorno de escritorio.

---

# 5. Empaquetado con electron-builder

## 5.1 ¿Qué es electron-builder?

**electron-builder** es una herramienta utilizada para empaquetar aplicaciones Electron y generar archivos preparados para su distribución en sistemas como Windows, macOS y Linux.

La diferencia entre Electron y electron-builder puede resumirse así:

```text
Electron
→ ejecuta y proporciona el entorno de la aplicación.

electron-builder
→ empaqueta la aplicación para distribuirla.
```

---

## 5.2 Proceso de empaquetado

El flujo general de una aplicación Vite + React + Electron es:

```text
Código fuente
     │
     ↓
Vite
     │
     ↓
Build de React
     │
     ↓
Electron
     │
     ↓
electron-builder
     │
     ↓
Aplicación distribuible
```

El archivo encontrado previamente en el proyecto también propone un flujo mediante scripts de npm donde primero se ejecuta `vite build` y posteriormente `electron-builder`.

---

## 5.3 Instalación

electron-builder puede instalarse como dependencia de desarrollo:

```bash
npm install --save-dev electron-builder
```

La documentación oficial utiliza esta instalación para agregar la herramienta al proyecto.

---

## 5.4 Configuración

La configuración puede incluirse directamente dentro de `package.json` mediante la propiedad `build`:

```json
{
  "build": {
    "appId": "com.ejemplo.miapp"
  }
}
```

También es posible utilizar un archivo de configuración independiente, por ejemplo `electron-builder.yml`.

La configuración puede utilizarse para especificar información como:

- Identificador de la aplicación.
- Sistema operativo objetivo.
- Arquitectura.
- Iconos.
- Tipo de instalador.
- Archivos adicionales.
- Opciones de publicación.

---

## 5.5 Scripts de npm

Un proyecto puede definir scripts para facilitar el proceso:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "electron:build": "npm run build && electron-builder"
  }
}
```

De esta manera:

```bash
npm run build
```

genera el build del frontend.

Mientras que:

```bash
npm run electron:build
```

primero genera el build de Vite y posteriormente ejecuta electron-builder.

---

## 5.6 Resultado del empaquetado

electron-builder puede generar diferentes tipos de paquetes dependiendo del sistema operativo y la configuración utilizada.

Por ejemplo, en Windows puede utilizarse **NSIS** para generar un instalador. También existen formatos para macOS y Linux.

De forma predeterminada, electron-builder empaqueta el contenido de la aplicación utilizando un archivo **ASAR**, aunque también permite configurar cómo se incluyen los archivos y recursos.

---

# 6. WebSockets

## 6.1 ¿Qué es WebSocket?

**WebSocket** es una tecnología que permite establecer una comunicación bidireccional entre un cliente y un servidor mediante una conexión persistente.

A diferencia de realizar continuamente solicitudes HTTP para comprobar si existen nuevos datos, una conexión WebSocket permanece abierta y permite enviar y recibir mensajes mientras está activa.

El concepto puede representarse de la siguiente manera:

```text
Cliente                         Servidor
   │                               │
   │──── establecer conexión ─────>│
   │                               │
   │<──────── mensaje ─────────────│
   │                               │
   │──────── mensaje ─────────────>│
   │                               │
   │<──────── mensaje ─────────────│
```

La comunicación puede ocurrir en ambos sentidos.

---

## 6.2 HTTP vs WebSocket

Una comunicación HTTP tradicional normalmente funciona mediante solicitudes y respuestas:

```text
Cliente ───── solicitud ─────> Servidor
Cliente <──── respuesta ────── Servidor
```

Si el cliente necesita comprobar continuamente si existen nuevos datos, debe realizar nuevas solicitudes.

Con WebSocket:

```text
Cliente ═══════════════════════ Servidor
           conexión abierta
                ↕
           mensajes
```

El servidor puede enviar información al cliente cuando corresponda sin esperar necesariamente una nueva solicitud.

---

## 6.3 Funcionamiento básico

En JavaScript se puede crear una conexión utilizando el objeto `WebSocket`:

```js
const socket = new WebSocket('ws://localhost:8080');

socket.onopen = () => {
  console.log('Conectado');
};

socket.onmessage = (event) => {
  console.log('Mensaje recibido:', event.data);
};

socket.onclose = () => {
  console.log('Conexión cerrada');
};

socket.onerror = (error) => {
  console.error('Error:', error);
};
```

También es posible enviar información:

```js
socket.send('Hola servidor');
```

La API WebSocket proporciona mecanismos para crear y administrar la conexión, además de enviar y recibir datos.

---

## 6.4 Uso de WebSockets con React

React puede utilizar WebSockets para actualizar automáticamente el estado de un componente cuando llega información desde el servidor.

Ejemplo simplificado:

```jsx
import { useEffect, useState } from 'react';

function Mensajes() {
  const [mensaje, setMensaje] = useState('');

  useEffect(() => {
    const socket = new WebSocket('ws://localhost:8080');

    socket.onmessage = (event) => {
      setMensaje(event.data);
    };

    return () => {
      socket.close();
    };
  }, []);

  return <p>{mensaje}</p>;
}
```

En este caso:

1. React crea la conexión.
2. El servidor envía un mensaje.
3. `onmessage` recibe la información.
4. `setMensaje()` actualiza el estado.
5. React vuelve a renderizar el componente.

---

## 6.5 Casos de uso

WebSockets son especialmente útiles cuando la aplicación necesita información en tiempo real.

Algunos ejemplos son:

- Chats.
- Notificaciones.
- Sistemas colaborativos.
- Monitoreo.
- Actualizaciones de estados.
- Paneles con información dinámica.
- Sistemas donde varios usuarios trabajan sobre los mismos datos.

Por ejemplo:

```text
Usuario A
    │
    │ modifica información
    ↓
Servidor
    │
    │ WebSocket
    ↓
Usuario B
    │
    ↓
Interfaz actualizada
```

---

# 7. Integración de las tecnologías

Las tecnologías investigadas cumplen funciones diferentes, pero pueden utilizarse conjuntamente.

Una arquitectura simplificada sería:

```text
                    APLICACIÓN
                        │
                 ┌──────┴──────┐
                 │   Electron  │
                 │             │
                 │ React + MUI │
                 └──────┬──────┘
                        │
                    WebSocket
                        ↕
                    Servidor
```

Mientras tanto, Vite y electron-builder participan principalmente en el ciclo de desarrollo y distribución:

```text
             DESARROLLO

          Vite + React + MUI
                  │
                  ↓
              Electron
                  │
                  ↓
              Aplicación


             DISTRIBUCIÓN

          Vite build
              │
              ↓
           Electron
              │
              ↓
      electron-builder
              │
              ↓
      Instalador / paquete
```

Por lo tanto, cada herramienta tiene una responsabilidad diferente:

| Tecnología | Responsabilidad |
|---|---|
| **Vite** | Desarrollo y construcción del frontend |
| **React** | Creación de la interfaz mediante componentes |
| **MUI** | Componentes visuales para React |
| **Electron** | Ejecución de la aplicación como aplicación de escritorio |
| **electron-builder** | Empaquetado y distribución |
| **WebSocket** | Comunicación bidireccional en tiempo real |

---

# 8. Resumen

- **React** permite construir interfaces mediante componentes reutilizables.
- **Vite** proporciona el servidor de desarrollo y las herramientas necesarias para construir el proyecto para producción.
- **MUI** proporciona componentes visuales listos para utilizar dentro de React.
- **Electron** permite utilizar tecnologías web para crear aplicaciones de escritorio.
- Electron utiliza principalmente un **Main Process** y uno o más **Renderer Processes**, con `preload` como mecanismo intermediario para exponer funcionalidades de forma controlada.
- **electron-builder** permite empaquetar una aplicación Electron y generar archivos distribuibles para diferentes sistemas operativos.
- **WebSockets** permiten mantener una comunicación bidireccional y persistente entre una aplicación y un servidor.
- Estas tecnologías pueden combinarse para desarrollar una aplicación de escritorio con una interfaz React/MUI, ejecutada mediante Electron, construida con Vite, empaquetada con electron-builder y conectada a un servidor mediante WebSockets.

---

# Referencias

- Vite — documentación oficial: https://vite.dev/guide/
- MUI — documentación oficial: https://mui.com/
- MUI Components: https://mui.com/components/
- Material UI: https://mui.com/material-ui/
- Electron — documentación oficial: https://www.electronjs.org/docs/latest/
- Electron — Process Model: https://www.electronjs.org/docs/latest/tutorial/process-model
- electron-builder — documentación oficial: https://www.electron.build/docs/
- electron-builder — Configuration: https://www.electron.build/docs/configuration/
- electron-builder — CLI: https://www.electron.build/docs/cli/
- MDN — WebSocket API: https://developer.mozilla.org/es/docs/Web/API/WebSocket
- MDN — WebSockets API: https://developer.mozilla.org/es/docs/Web/API/WebSockets_API