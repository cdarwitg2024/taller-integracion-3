# Investigación de tecnologías para React y Electron

## 1. Introducción

El desarrollo de aplicaciones utilizando React y Electron permite incorporar diferentes funcionalidades relacionadas con el procesamiento de información, visualización de datos, lectura de códigos QR y generación de documentos.

En esta investigación se analizan tres tecnologías que pueden integrarse en aplicaciones desarrolladas con React:

* **react-qr-reader**, orientada a la lectura de códigos QR y códigos de barras mediante la cámara del dispositivo.
* **Recharts**, utilizada para la representación gráfica de información mediante distintos tipos de gráficos.
* **@react-pdf/renderer**, destinada a la generación de documentos PDF mediante componentes de React.

También se analiza la funcionalidad **`webContents.printToPDF()`** de Electron como alternativa para generar documentos PDF a partir del contenido mostrado por la aplicación.

El objetivo es conocer las características, funcionamiento e integración de estas tecnologías, además de determinar qué alternativa resulta más adecuada dependiendo del tipo de funcionalidad que se requiera implementar.

---

# 2. react-qr-reader

## 2.1 ¿Qué es?

`react-qr-reader` es una biblioteca para React que permite leer códigos QR y códigos de barras utilizando la cámara del dispositivo.

La biblioteca proporciona el componente `QrReader`, encargado de acceder al flujo de video de la cámara y analizarlo para detectar códigos.

La versión publicada actualmente en npm es `3.0.0-beta-1`. La documentación disponible del paquete utiliza el componente `QrReader` como API principal, por lo que esta investigación se basa en dicha API.

## 2.2 Funcionamiento

El componente solicita acceso a la cámara del dispositivo y utiliza el flujo de video obtenido para realizar intentos de lectura.

Cuando se detecta un código, se ejecuta la función definida mediante la propiedad `onResult`, entregando el resultado obtenido.

También puede proporcionar información relacionada con errores producidos durante el proceso de lectura.

Entre las principales propiedades disponibles se encuentran:

| Propiedad        | Tipo                    | Descripción                                                    |
| ---------------- | ----------------------- | -------------------------------------------------------------- |
| `constraints`    | `MediaTrackConstraints` | Permite especificar características de la cámara utilizada.    |
| `onResult`       | `function`              | Función ejecutada durante el proceso de lectura.               |
| `scanDelay`      | `number`                | Define el intervalo entre los intentos de lectura.             |
| `ViewFinder`     | `component`             | Permite utilizar un componente personalizado como guía visual. |
| `containerStyle` | `object`                | Permite definir estilos para el contenedor.                    |
| `videoStyle`     | `object`                | Permite definir estilos para el elemento de video.             |

Por ejemplo, `constraints` puede utilizarse para solicitar preferentemente la cámara trasera mediante:

```jsx
constraints={{
    facingMode: 'environment'
}}
```

## 2.3 Instalación

La instalación mediante npm se realiza con:

```bash
npm install react-qr-reader
```

## 2.4 Compatibilidad

La documentación del paquete indica compatibilidad con navegadores como Chrome, Firefox y Safari en diferentes plataformas, incluyendo macOS, Android e iOS.

La biblioteca requiere React 16.8.0 o superior debido al uso de hooks.

La utilización de la cámara también depende de los permisos y capacidades disponibles en el entorno donde se ejecute la aplicación.

## 2.5 Consideraciones en Electron

Cuando `react-qr-reader` se utiliza dentro de una aplicación Electron, el componente se ejecuta en el proceso de renderizado junto con la interfaz React.

El acceso a dispositivos en Electron debe considerar el sistema de permisos propio de Electron. Entre los permisos disponibles se encuentra `media`, relacionado con dispositivos multimedia como cámaras, micrófonos y altavoces.

Por lo tanto, deben considerarse:

* Acceso a la cámara desde el proceso de renderizado.
* Permisos de acceso al dispositivo.
* Configuración de Electron cuando sea necesario gestionar solicitudes de permisos.
* Diferencias de comportamiento entre los sistemas operativos.

---

# 3. Recharts

## 3.1 ¿Qué es?

Recharts es una biblioteca de gráficos desarrollada para React que permite representar información mediante diferentes tipos de visualizaciones.

Utiliza un enfoque declarativo basado en componentes, permitiendo construir gráficos mediante elementos como ejes, barras, líneas, herramientas de información y leyendas.

Es especialmente apropiada para interfaces que necesitan mostrar información estadística o indicadores dentro de paneles de control.

## 3.2 Funcionamiento

Los gráficos se construyen mediante la combinación de diferentes componentes.

Entre los componentes más utilizados se encuentran:

* `BarChart`
* `LineChart`
* `XAxis`
* `YAxis`
* `Bar`
* `Line`
* `Tooltip`
* `Legend`

Los datos normalmente se proporcionan mediante un arreglo de objetos que posteriormente es utilizado por el gráfico.

Esta estructura permite actualizar los datos de manera dinámica sin tener que modificar manualmente la estructura visual del gráfico.

## 3.3 Instalación

La instalación mediante npm se realiza con:

```bash
npm install recharts
```

## 3.4 Aplicaciones

Recharts puede utilizarse para representar información como:

* Cantidad de pedidos.
* Estados de paquetes.
* Cantidad de usuarios.
* Estadísticas de ventas.
* Porcentajes de cumplimiento.
* Comparaciones entre categorías.
* Evolución de datos a través del tiempo.

La biblioteca dispone de diferentes tipos de gráficos, por lo que puede adaptarse a distintas necesidades de visualización.

---

# 4. @react-pdf/renderer

## 4.1 ¿Qué es?

`@react-pdf/renderer` es una biblioteca que permite generar documentos PDF utilizando componentes de React.

A diferencia de una impresión directa de una página web, esta alternativa permite definir específicamente la estructura y apariencia del documento que será generado.

La estructura del documento se construye mediante componentes como:

* `Document`
* `Page`
* `Text`
* `View`
* `StyleSheet`

Esto permite diseñar documentos independientes de la interfaz visual principal de la aplicación.

## 4.2 Funcionamiento

La estructura del PDF se define mediante componentes de React.

El contenido, distribución, estilos, tamaños de página y otros elementos pueden configurarse mediante la estructura proporcionada por la biblioteca.

Esto permite generar documentos con una estructura específica sin depender directamente de la apariencia de la interfaz principal de la aplicación.

## 4.3 Instalación

La instalación mediante npm se realiza con:

```bash
npm install @react-pdf/renderer
```

## 4.4 Aplicaciones

Puede utilizarse para generar documentos como:

* Informes.
* Facturas.
* Cotizaciones.
* Certificados.
* Comprobantes.
* Documentos administrativos.
* Reportes personalizados.

La principal característica de esta alternativa es el nivel de control sobre la estructura del documento.

---

# 5. Generación de PDF mediante Electron

## 5.1 `webContents.printToPDF()`

Electron proporciona una funcionalidad nativa para generar documentos PDF mediante:

```javascript
webContents.printToPDF()
```

Este método permite generar un documento PDF a partir del contenido de una ventana de Electron.

Entre las opciones que pueden configurarse se encuentran aspectos relacionados con:

* Tamaño de página.
* Orientación.
* Márgenes.
* Escala.
* Fondos.
* Encabezados y pies de página.

## 5.2 Ventajas

Una de las principales ventajas de `webContents.printToPDF()` es que forma parte de Electron.

Esto permite generar un PDF utilizando el contenido que actualmente se encuentra renderizado en una ventana de la aplicación, sin necesidad de incorporar una biblioteca adicional exclusivamente para realizar la impresión.

Por esta razón, resulta especialmente conveniente cuando se desea exportar una vista existente de la aplicación.

## 5.3 Consideraciones

El documento generado está relacionado directamente con la vista que se está renderizando.

Por lo tanto, esta alternativa puede ser menos conveniente cuando se requiere crear un documento completamente independiente de la interfaz gráfica, con una estructura específica y un control detallado sobre cada elemento del PDF.

---

# 6. Integración de React y Electron

## 6.1 Estructura general

Una aplicación que utiliza React y Electron normalmente separa la interfaz gráfica del proceso principal de Electron.

React se encarga principalmente de la interfaz de usuario, mientras que Electron proporciona funcionalidades propias del entorno de escritorio.

Una estructura posible es:

```text
proyecto/
├── src/
│   ├── components/
│   ├── pages/
│   └── App.jsx
│
├── electron/
│   └── main.js
│
├── package.json
└── vite.config.js
```

Durante el desarrollo, Electron puede cargar la aplicación React desde el servidor de desarrollo de Vite.

En producción, puede cargar los archivos generados después del proceso de compilación.

## 6.2 Comunicación entre React y Electron

Cuando una funcionalidad propia de Electron debe ser utilizada desde React, normalmente se utiliza comunicación entre el proceso de renderizado y el proceso principal.

Un flujo simplificado es:

```text
React
  │
  │ IPC
  ▼
Electron Main Process
  │
  ▼
Funcionalidad del sistema
```

Este mecanismo resulta útil para funcionalidades como generación de archivos, acceso al sistema de archivos y otras operaciones propias del entorno de escritorio.

---

# 7. Configuración básica de Vite + Electron

Una aplicación React desarrollada con Vite puede integrarse con Electron mediante scripts de npm que permitan coordinar ambos entornos.

Por ejemplo:

```json
{
    "scripts": {
        "dev": "vite",
        "electron:dev": "concurrently \"vite\" \"wait-on http://localhost:5173 && electron .\"",
        "build": "vite build",
        "electron:build": "npm run build && electron-builder"
    }
}
```

En este escenario:

* `vite` inicia el servidor de desarrollo.
* `concurrently` permite ejecutar procesos simultáneamente.
* `wait-on` espera hasta que el servidor de Vite esté disponible.
* `electron .` inicia Electron.
* `vite build` genera la versión compilada de la aplicación React.
* `electron-builder` permite empaquetar la aplicación.

---

# 8. Comparación de las alternativas para generación de PDF

Las dos alternativas principales analizadas para generar documentos PDF son `@react-pdf/renderer` y `webContents.printToPDF()`.

La elección entre ambas depende principalmente del tipo de documento que se desea generar.

| Característica                                  | `@react-pdf/renderer`      | `webContents.printToPDF()`               |
| ----------------------------------------------- | -------------------------- | ---------------------------------------- |
| Generación de PDF                               | Sí                         | Sí                                       |
| Utiliza componentes React                       | Sí                         | No, utiliza el contenido DOM renderizado |
| Genera documentos independientes de la interfaz | Sí                         | No es su objetivo principal              |
| Convierte una vista existente a PDF             | No es su función principal | Sí                                       |
| Control sobre el diseño del documento           | Alto                       | Depende de la vista renderizada          |
| Integración con Electron                        | Posible                    | Nativa                                   |
| Dependencias adicionales                        | Sí                         | No para la función de impresión          |
| Ideal para informes personalizados              | Sí                         | Puede requerir adaptar la interfaz       |
| Ideal para imprimir una vista existente         | No es la opción principal  | Sí                                       |

---

# 9. Elección de la tecnología según el tipo de PDF

La elección de la tecnología debe realizarse **dependiendo del tipo de PDF que se quiera crear**.

Si el objetivo es generar un documento independiente de la interfaz de la aplicación, con una estructura específica, diferentes secciones, estilos, tablas, encabezados y otros elementos propios de un documento formal, **`@react-pdf/renderer` resulta una alternativa adecuada**.

Por otro lado, si el objetivo es permitir que una vista existente de la aplicación sea exportada o impresa como PDF, **`webContents.printToPDF()` resulta una alternativa más directa**, especialmente dentro de una aplicación Electron.

Por lo tanto:

```text
PDF diseñado específicamente
        │
        ▼
@react-pdf/renderer
        │
        └── Informes
            Facturas
            Certificados
            Documentos personalizados


Vista existente de la aplicación
        │
        ▼
webContents.printToPDF()
        │
        └── Exportación de pantallas
            Reportes visuales
            Impresión de vistas
```

No existe una única alternativa que sea superior para todos los casos. La tecnología debe seleccionarse de acuerdo con los requisitos del documento y con el nivel de control que se necesite sobre su diseño.

---

# 10. Ejemplo de flujo combinado

Las tecnologías analizadas pueden utilizarse de manera conjunta dentro de una misma aplicación.

Un posible flujo de trabajo sería:

1. El usuario escanea un código QR utilizando `react-qr-reader`.
2. La aplicación procesa la información obtenida del código.
3. Los datos procesados se muestran mediante componentes de React.
4. Recharts utiliza los datos obtenidos para generar gráficos estadísticos.
5. El usuario puede generar un documento PDF con la información obtenida.
6. Dependiendo del tipo de documento requerido, se puede utilizar `@react-pdf/renderer` o `webContents.printToPDF()`.

El flujo puede representarse de la siguiente manera:

```text
        Código QR
            │
            ▼
   ┌─────────────────┐
   │ react-qr-reader │
   └────────┬────────┘
            │
            ▼
     Datos procesados
            │
            ▼
   ┌─────────────────┐
   │      React      │
   └────────┬────────┘
            │
            ▼
      ┌───────────┐
      │ Recharts  │
      └─────┬─────┘
            │
            ▼
       Información
       visualizada
            │
            ▼
       Generación PDF
        /          \
       /            \
      ▼              ▼
react-pdf      printToPDF()
      │              │
      ▼              ▼
Documento       Vista de
personalizado   aplicación
```

Este flujo permite utilizar cada tecnología para una función específica, evitando que una sola herramienta tenga que encargarse de todas las operaciones.

---

# 11. Resumen de las tecnologías

| Tecnología                   | Propósito principal                       | Integración con React | Integración con Electron                          | Uso recomendado                     |
| ---------------------------- | ----------------------------------------- | --------------------- | ------------------------------------------------- | ----------------------------------- |
| **react-qr-reader**          | Lectura de códigos QR y barras            | Directa               | Compatible, considerando permisos de dispositivos | Escaneo de códigos mediante cámara  |
| **Recharts**                 | Visualización de datos                    | Directa               | Compatible                                        | Dashboards y estadísticas           |
| **@react-pdf/renderer**      | Creación de documentos PDF personalizados | Directa               | Posible                                           | Informes y documentos estructurados |
| **webContents.printToPDF()** | Exportación de contenido a PDF            | Mediante Electron     | Nativa                                            | Exportar vistas existentes          |

---

# 12. Fuentes

## react-qr-reader

**react-qr-reader — npm**
https://www.npmjs.com/package/react-qr-reader

**react-qr-reader — GitHub**
https://github.com/react-qr-reader/react-qr-reader

## Recharts

**Recharts — documentación oficial**
https://recharts.github.io/en-US/

**Recharts — guía de inicio**
https://recharts.github.io/en-US/guide/

**Recharts — GitHub**
https://github.com/recharts/recharts

**Recharts — npm**
https://www.npmjs.com/package/recharts

## React PDF

**@react-pdf/renderer — npm**
https://www.npmjs.com/package/@react-pdf/renderer

**React-PDF — GitHub**
https://github.com/diegomura/react-pdf

## Electron

**Electron — Device Access**
https://www.electronjs.org/docs/latest/tutorial/devices

**Electron — systemPreferences**
https://www.electronjs.org/docs/latest/api/system-preferences

**Electron — session y permisos**
https://www.electronjs.org/docs/latest/api/session

**Electron — webContents**
https://www.electronjs.org/docs/latest/api/web-contents

**Electron — Electron Forge**
https://www.electronjs.org/docs/latest/tutorial/forge-overview
