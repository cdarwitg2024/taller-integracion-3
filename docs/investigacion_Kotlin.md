# Investigación de Kotlin para Android Studio

## 1. Introducción

Kotlin es el lenguaje recomendado por Android para el desarrollo de nuevas aplicaciones. Android Studio proporciona herramientas específicas para trabajar con Kotlin, ejecutar la aplicación en un emulador o dispositivo y administrar la compilación mediante Gradle.

Para el proyecto de la aplicación de pedidos de cafeterías universitarias, Kotlin será utilizado como tecnología del cliente móvil del estudiante. Esta aplicación deberá permitir, entre otras funciones, iniciar sesión, consultar cafeterías y productos, agregar productos al carrito, realizar pedidos y mostrar el código QR asociado al retiro del pedido.

## 2. Estructura de un proyecto Android

Android Studio organiza un proyecto en módulos y carpetas. En la vista Android, un módulo de aplicación suele mostrar principalmente:

```text
app/
├── manifests/
│   └── AndroidManifest.xml
├── kotlin+java/
│   └── com.example.cafeteria/
│       ├── MainActivity.kt
│       └── ...
├── res/
│   ├── drawable/
│   ├── mipmap/
│   ├── values/
│   └── layout/
│       ├── activity_main.xml
│       └── ...
└── Gradle Scripts/
```

La documentación oficial de Android Studio identifica `manifests` para el `AndroidManifest.xml`, `kotlin+java` para el código fuente Kotlin/Java y `res` para recursos que no son código. La estructura que aparece en la vista Android es una representación simplificada de la estructura real de archivos del proyecto.

### 2.1 Activities

Una `Activity` es un componente fundamental de Android y proporciona una ventana donde la aplicación muestra su interfaz de usuario. Se implementa normalmente como una clase Kotlin que hereda de `Activity` o de una clase compatible como `AppCompatActivity`.

Ejemplo:

```kotlin
class MainActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
    }
}
```

En el proyecto de cafetería, una Activity podría encargarse de una pantalla como el inicio de sesión, el menú de una cafetería o la visualización del pedido.

> **Nota:** las aplicaciones Android modernas pueden utilizar una arquitectura de una sola Activity junto con componentes de navegación o Jetpack Compose. Sin embargo, esta investigación utiliza el enfoque basado en Activities + XML solicitado por la tarea.

### 2.2 XML

Cuando se utiliza el sistema tradicional de Views, los archivos XML ubicados normalmente en `res/layout/` definen la estructura visual de una pantalla.

Por ejemplo:

```xml
<LinearLayout
    xmlns:android="http://schemas.android.com/apk/res/android"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:orientation="vertical">

    <TextView
        android:id="@+id/titulo"
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:text="Cafeterías" />

</LinearLayout>
```

La Activity puede cargar ese diseño mediante:

```kotlin
setContentView(R.layout.activity_main)
```

De esta manera se separa la definición visual de la lógica de Kotlin.

### 2.3 AndroidManifest.xml

`AndroidManifest.xml` contiene información esencial que Android necesita conocer sobre la aplicación. Entre otras cosas, declara componentes como Activities y permisos.

Ejemplo:

```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <application
        android:theme="@style/Theme.Cafeteria">

        <activity
            android:name=".MainActivity"
            android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>

    </application>
</manifest>
```

Si una Activity propia no está declarada correctamente en el manifiesto, Android no podrá utilizarla como componente de la aplicación.

El manifiesto también puede declarar permisos. Por ejemplo, si una funcionalidad requiere acceso a Internet:

```xml
<uses-permission android:name="android.permission.INTERNET" />
```

Para el proyecto de cafetería, este permiso será relevante si la aplicación móvil se comunica con APIs o servicios externos mediante HTTP.

---

## 3. Ciclo de vida de una Activity

Una Activity no permanece siempre en el mismo estado. Android administra su ciclo de vida mediante callbacks que se ejecutan cuando la Activity se crea, pasa a primer plano, pierde el foco, deja de ser visible o es destruida.

Los seis callbacks principales son:

```text
onCreate()
   ↓
onStart()
   ↓
onResume()
   ↓
[Activity en primer plano]
   ↓
onPause()
   ↓
onStop()
   ↓
onDestroy()
```

### 3.1 onCreate()

Se ejecuta cuando Android crea la Activity.

Es el lugar habitual para:

- Inicializar componentes.
- Cargar el XML de la interfaz.
- Configurar listeners.
- Inicializar variables.
- Preparar datos iniciales.

Ejemplo:

```kotlin
override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    setContentView(R.layout.activity_main)
}
```

### 3.2 onStart()

La Activity pasa a ser visible para el usuario.

### 3.3 onResume()

La Activity pasa al primer plano y el usuario puede interactuar con ella.

### 3.4 onPause()

La Activity pierde el foco, aunque todavía puede ser parcialmente visible.

Debe evitarse colocar aquí operaciones demasiado pesadas. Dependiendo del caso, puede utilizarse para pausar temporalmente operaciones que no deberían continuar mientras la pantalla no tiene el foco.

### 3.5 onStop()

La Activity deja de ser visible.

Es un momento apropiado para liberar recursos que no son necesarios mientras la pantalla está fuera de la vista.

### 3.6 onDestroy()

La Activity está siendo destruida. Puede ocurrir, por ejemplo, porque la Activity finalizó o debido a un cambio de configuración.

No se debe asumir que `onDestroy()` siempre será llamado antes de que el proceso de la aplicación sea eliminado.

### 3.7 Aplicación al proyecto

En la aplicación de cafetería, comprender el ciclo de vida será importante para evitar errores como:

- repetir solicitudes HTTP innecesariamente;
- perder información temporal de un pedido;
- mantener recursos activos cuando una pantalla ya no está visible;
- duplicar listeners o actualizaciones de datos.

Android recomienda separar la lógica de negocio de la Activity y utilizar componentes de arquitectura apropiados cuando el proyecto crece.

---

## 4. RecyclerView

`RecyclerView` es un componente de Android Jetpack utilizado para mostrar listas o conjuntos de datos de manera eficiente.

Es especialmente útil cuando una aplicación necesita mostrar muchos elementos, por ejemplo:

- cafeterías disponibles;
- productos de una cafetería;
- productos del carrito;
- historial de pedidos.

Su principal característica es que reutiliza las vistas de los elementos que salen de la pantalla, en lugar de crear una vista completamente nueva para cada elemento.

### 4.1 Componentes principales

Una implementación tradicional de `RecyclerView` utiliza principalmente:

- **RecyclerView**: contenedor de la lista.
- **Adapter**: conecta los datos con las vistas.
- **ViewHolder**: mantiene las referencias a las vistas de un elemento.
- **LayoutManager**: determina cómo se organizan los elementos.

La relación conceptual es:

```text
Datos
  ↓
Adapter
  ↓
ViewHolder
  ↓
RecyclerView
  ↓
Pantalla
```

### 4.2 Ejemplo simplificado

```kotlin
class ProductoAdapter(
    private val productos: List<Producto>
) : RecyclerView.Adapter<ProductoAdapter.ProductoViewHolder>() {

    class ProductoViewHolder(view: View) : RecyclerView.ViewHolder(view)

    override fun onCreateViewHolder(
        parent: ViewGroup,
        viewType: Int
    ): ProductoViewHolder {
        val view = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_producto, parent, false)
        return ProductoViewHolder(view)
    }

    override fun onBindViewHolder(
        holder: ProductoViewHolder,
        position: Int
    ) {
        val producto = productos[position]
        // Asociar los datos del producto con las vistas.
    }

    override fun getItemCount(): Int = productos.size
}
```

En una Activity:

```kotlin
val recyclerView = findViewById<RecyclerView>(R.id.recycler_productos)
recyclerView.layoutManager = LinearLayoutManager(this)
recyclerView.adapter = ProductoAdapter(productos)
```

Para el proyecto, un `RecyclerView` podría utilizarse para presentar los productos obtenidos desde el backend y permitir que el estudiante los seleccione para agregarlos al carrito.

---

## 5. Retrofit para HTTP

Retrofit es un cliente HTTP para Android y la JVM que permite definir APIs mediante interfaces y anotaciones.

Su propósito dentro de la aplicación sería facilitar la comunicación entre la aplicación Android y servicios que expongan APIs HTTP/REST.

En el proyecto de cafetería, Retrofit podría utilizarse para comunicarse con los microservicios del sistema, por ejemplo:

```text
Aplicación Android
        │
        │ HTTP/REST
        ▼
API / Microservicio
        │
        ▼
Supabase u otro servicio
```

### 5.1 Dependencia

La documentación oficial del proyecto Retrofit indica actualmente la versión `3.0.0` como versión estable publicada en Maven Central.

Ejemplo:

```kotlin
dependencies {
    implementation("com.squareup.retrofit2:retrofit:3.0.0")
}
```

La versión concreta utilizada en el proyecto deberá fijarse de acuerdo con las dependencias y configuración de Gradle del equipo.

### 5.2 Definir una API

Una interfaz puede representar los endpoints disponibles:

```kotlin
interface CafeteriaApi {

    @GET("cafeterias")
    suspend fun obtenerCafeterias(): List<Cafeteria>

    @GET("cafeterias/{id}/productos")
    suspend fun obtenerProductos(
        @Path("id") cafeteriaId: Long
    ): List<Producto>
}
```

Luego se crea una instancia de Retrofit:

```kotlin
val retrofit = Retrofit.Builder()
    .baseUrl("https://ejemplo.com/api/")
    .build()

val api = retrofit.create(CafeteriaApi::class.java)
```

### 5.3 ¿Por qué usar Retrofit?

Entre sus ventajas están:

- Permite definir endpoints mediante interfaces.
- Reduce código repetitivo para realizar solicitudes HTTP.
- Facilita trabajar con parámetros, rutas y métodos HTTP.
- Puede integrarse con convertidores para transformar respuestas JSON en objetos Kotlin.
- Es apropiado para consumir APIs REST desde Android.

En el proyecto de cafetería, Retrofit podría ser la capa utilizada por la aplicación móvil para comunicarse con los microservicios, por ejemplo, para operaciones relacionadas con pedidos, pagos o generación/validación de información.

> **Importante:** Retrofit no reemplaza a Supabase ni a los microservicios. Es una herramienta del lado del cliente para realizar comunicaciones HTTP con APIs.

---

## 6. Generación de códigos QR con ZXing

ZXing (Zebra Crossing) es una biblioteca orientada a la codificación y decodificación de códigos de barras, incluyendo códigos QR.

Para generar un QR, ZXing proporciona `QRCodeWriter`, cuyo método `encode()` recibe el contenido, el formato y las dimensiones solicitadas y produce una `BitMatrix`.

Conceptualmente:

```text
Texto / token
     ↓
QRCodeWriter
     ↓
BitMatrix
     ↓
Imagen QR
```

### 6.1 Ejemplo con ZXing

La API de ZXing permite realizar una codificación de este tipo:

```kotlin
val writer = QRCodeWriter()
val bitMatrix = writer.encode(
    contenido,
    BarcodeFormat.QR_CODE,
    400,
    400
)
```

A partir de la `BitMatrix` se puede construir una imagen que se muestre en un `ImageView`.

### 6.2 Alternativa para Android: ZXing Android Embedded

Para Android existe `zxing-android-embedded`, una biblioteca basada en ZXing que facilita especialmente las tareas relacionadas con códigos de barras y QR.

El proyecto publicado por JourneyApps incluye soporte para generar códigos y proporciona `BarcodeEncoder`. Un ejemplo de generación es:

```kotlin
val barcodeEncoder = BarcodeEncoder()
val bitmap = barcodeEncoder.encodeBitmap(
    contenido,
    BarcodeFormat.QR_CODE,
    400,
    400
)
imageViewQrCode.setImageBitmap(bitmap)
```

La versión publicada actualmente en Maven Central es `4.3.0`:

```kotlin
dependencies {
    implementation("com.journeyapps:zxing-android-embedded:4.3.0")
}
```

Esta biblioteca también permite escanear códigos QR. Sin embargo, generar el QR y escanear/validar el QR son funciones diferentes.

### 6.3 Aplicación al proyecto de cafetería

El flujo propuesto para el proyecto puede ser:

```text
Pedido confirmado
     ↓
Se obtiene/genera un token único
     ↓
La aplicación recibe el token
     ↓
ZXing genera el QR
     ↓
El estudiante muestra el QR
     ↓
La cafetería lo escanea
     ↓
Se valida el token
     ↓
Pedido entregado
```

Es importante que el QR no se considere simplemente como una imagen decorativa. En el proyecto, el documento de especificación plantea un token único de retiro asociado a la compra. La aplicación puede mostrar ese token representado mediante un código QR, mientras que el servicio encargado de validarlo debe comprobar que sea válido antes de cerrar la entrega.

---

## 7. Integración de las tecnologías en el proyecto

Las tecnologías investigadas cumplen funciones diferentes dentro de la aplicación Android:

| Tecnología | Función en la aplicación |
|---|---|
| Kotlin | Lenguaje principal de programación |
| Android Studio | Entorno de desarrollo |
| Activity | Gestionar una pantalla/punto de interacción de la aplicación |
| XML | Definir interfaces mediante Views en el enfoque solicitado |
| AndroidManifest.xml | Declarar componentes y permisos |
| RecyclerView | Mostrar listas dinámicas de cafeterías, productos o pedidos |
| Retrofit | Consumir APIs HTTP/REST |
| ZXing | Generar y trabajar con códigos QR |

Una posible arquitectura simplificada para el cliente móvil sería:

```text
APLICACIÓN ANDROID
        │
   ┌────┴─────┐
   │          │
Activities  XML / Views
   │
   ├──────────────┐
   │              │
RecyclerView   Pantallas
   │
   ▼
Datos de la app
   │
   ▼
Retrofit
   │
   │ HTTP/REST
   ▼
APIs / Microservicios
   │
   ▼
Backend / Supabase

Pedido confirmado
   │
   ▼
Token QR
   │
   ▼
ZXing
   │
   ▼
Código QR mostrado
en el dispositivo
```

---

## 8. Relación con el MVP del proyecto

Para el Sprint 1, estas tecnologías pueden apoyar directamente el flujo principal definido para la aplicación:

- **Kotlin + Android Studio**: desarrollo de la aplicación móvil.
- **Activities + XML**: construcción de las pantallas del estudiante.
- **RecyclerView**: visualización de cafeterías y productos.
- **Retrofit**: comunicación con las APIs necesarias.
- **ZXing**: generación del QR asociado al pedido.
- **Backend/Supabase**: almacenamiento y sincronización de la información.

El objetivo es que estas tecnologías formen parte de una solución integrada y no sean funcionalidades aisladas.

---

## 9. Conclusión

Kotlin junto con Android Studio proporciona una base adecuada para construir el cliente móvil de la aplicación de pedidos de cafeterías universitarias. Las Activities permiten gestionar las pantallas y su ciclo de vida, mientras que XML permite definir las interfaces utilizando Views. `RecyclerView` resulta especialmente útil para presentar listas dinámicas de cafeterías y productos.

Para la comunicación con servicios externos, Retrofit permite consumir APIs HTTP/REST mediante interfaces tipadas. Finalmente, ZXing permite generar códigos QR a partir de un contenido como un token de retiro, lo que encaja directamente con el flujo de retiro mediante QR definido para el proyecto.

La correcta separación de responsabilidades es importante: la aplicación Android se encarga principalmente de la experiencia del estudiante, Retrofit de la comunicación HTTP, ZXing de la representación QR y los servicios/backend de procesar y validar la información.

---

## 10. Fuentes consultadas

- Android Developers — Introducción a Android Studio: https://developer.android.com/studio/intro
- Android Developers — Introducción a las Activities: https://developer.android.com/guide/components/activities/intro-activities
- Android Developers — Ciclo de vida de una Activity: https://developer.android.com/guide/components/activities/activity-lifecycle
- Android Developers — Descripción general del manifiesto: https://developer.android.com/guide/topics/manifest/manifest-intro
- Android Developers — RecyclerView: https://developer.android.com/develop/ui/views/layout/recyclerview
- Retrofit — repositorio oficial: https://github.com/square/retrofit
- ZXing — repositorio oficial: https://github.com/zxing/zxing
- ZXing Android Embedded — repositorio: https://github.com/journeyapps/zxing-android-embedded
- Maven Central — ZXing Android Embedded: https://central.sonatype.com/artifact/com.journeyapps/zxing-android-embedded
