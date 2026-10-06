# Notificaciones de voz en el KDS con ElevenLabs (TTS)

> Documento técnico de investigación y propuesta de mejora.
> Alcance evaluado: **solo el aviso sonoro de ingreso de un pedido nuevo a la cocina**. Quedan fuera los comandos por voz.

---

## 1. Motivación: el problema que ataca

El KDS actual comunica los pedidos **solo por vía visual**: una tarjeta que aparece en la columna "Pendiente". En una cocina real eso tiene tres costos:

| Problema | Consecuencia medible |
|---|---|
| El pedido solo se percibe mirando la pantalla | Si la persona está en el horno, con guantes, o atendiendo otro pedido, el pedido nuevo se demora en verse |
| El retraso se acumula | Cada segundo de demora en el primero se suma a todos los que vienen detrás; la cola crece y el tiempo de atención (KPI de la cafetería) sube |
| Con ruido de fondo la alerta visual se pierde | Campana, extractor y música compiten con la atención visual |

Agregar un canal **auditivo** libera la vista: la cocina sigue haciendo su trabajo y aun así se entera de que entró algo. El audio no reemplaza a la tarjeta, la acompaña.

**Relación con los requisitos del proyecto:** los requisitos de notificación del taller (FR-19 / BR-06) corresponden al Bot de Telegram del **Dueño**. Esta propuesta es independiente y aplica al rol **empleado/cocina**, por lo que se plantea como una mejora sobre lo solicitado y no como cumplimiento de un requisito.

---

## 2. Qué es esta tecnología

**TTS (Text-to-Speech)** es la conversión de texto en voz sintetizada.

**ElevenLabs** es un proveedor de TTS por API que genera voz de calidad superior a los motores clásicos, con entonación, ritmo y matices, y soporte multilingüe. Se consume por HTTP:

```http
POST https://api.elevenlabs.io/v1/text-to-speech/{voice_id}
Headers:
  xi-api-key: sk_...
  Content-Type: application/json
  Accept: audio/mpeg
Body:
  {
    "text": "Nueva comanda, número 42. 2 cafés y 1 medialuna.",
    "model_id": "eleven_flash_v2_5",
    "voice_settings": { "stability": 0.5, "similarity_boost": 0.75, "style": 0.3 }
  }

← 200 OK
   content-type: audio/mpeg
   body: archivo de audio (MP3)
```

El MP3 se reproduce en el navegador con `new Audio(url).play()`. No hay streaming, ni video, ni avatar: es un archivo de audio generado frase por frase.

**Aclaración importante:** esta tecnología **no escucha ni transcribe**. Es unidireccional (texto → sonido). El reconocimiento de voz (transcribir la voz del usuario) es otra tecnología distinta, la Web Speech API, y **queda fuera de este alcance**.

---

## 3. Alcance: qué hace y qué no

### Dentro del alcance
1. Llega un pedido nuevo a la BD (`INSERT` en `pedidos` con `estado = 'pendiente'`).
2. El KDS lo recibe por Realtime (ya implementado en `services/kdsRealtime.js`, callback `onComanda`).
3. Se arma una frase corta: `"Nueva comanda, número 42. 2 cafés y 1 medialuna."`
4. Se pide el audio a la función de servidor y se reproduce en la pantalla.
5. Queda registro en BD de qué pedido se anomalizó, para auditoría y para evitar duplicados.

### Fuera del alcance
- ~~Comandos por voz ("oye sistema", "prepara la última comanda")~~ — requiere reconocimiento de voz.
- ~~Transcripción de voz~~ — Web Speech API, tecnología distinta.
- ~~Anunciar cambios de estado~~ (en preparación / listo) — se puede agregar después.
- ~~Notificación al cliente~~ — ya existe por otro mecanismo.

---

## 4. Arquitectura propuesta

Principio de diseño: **la clave de la API nunca llega al navegador del empleado**. El cliente solo habla con una función de servidor, y esa función es la única que habla con ElevenLabs.

```
   Cliente (Supabase)                    Servidor                      Tercero
┌──────────────────────┐          ┌───────────────────────┐     ┌──────────────┐
│  Pedido nuevo (INSERT)│          │                       │     │              │
│         │            │          │  Supabase Edge        │     │  ElevenLabs  │
│         ▼            │  fetch   │  Function             │     │  TTS API     │
│  Realtime (ya existe)├─────────►│  "voz-pedido"         ├────►│  (texto →    │
│  onComanda(comanda)  │ {pedido  │                       │◄────┤   MP3)       │
│         │            │  _id}    │  1. valida JWT        │     │              │
│         ▼            │          │  2. valida cafetería  │     └──────────────┘
│  vozKdsService       │◄─────────┤  3. marca "anunciado" │
│   (arma la frase)    │  MP3 mpeg│  4. llama ElevenLabs  │
│         │            │          │  5. devuelve el audio │
│         ▼            │          │                       │
│  new Audio().play()  │          │  secret:              │
│  (o Web Speech si    │          │  ELEVENLABS_API_KEY   │
│   ElevenLabs falla)  │          │  (nunca sale)         │
└──────────────────────┘          └───────────────────────┘
```

**Por qué una Edge Function y no `backend-node`:** el KDS funciona completo sin `backend-node` (toda la lectura/escritura va directo a Supabase; durante las pruebas de T13, con `localhost:3000` caído, el KDS siguió operando sin ningún problema). Si el audio dependiera de ese servicio, el aviso de voz se caería justo cuando el backend no está. La Edge Function vive junto a la base de datos y hereda la misma disponibilidad del KDS.

**Por qué no llamar a ElevenLabs desde el navegador:** el prototipo original guardaba la key en `localStorage` del navegador. Cualquiera con acceso al equipo (DevTools, máquina compartida, respaldo del navegador) podría extraerla y consumir la cuota. El costo relevante no es el audio propio, sino el que genere un tercero.

---

## 5. Metodología replicada del prototipo: cascada de proveedores

El principio es que la función **nunca sea un punto único de falla**. Si la capa preferida falla, se cae a la siguiente:

```
 Anunciar pedido
    │
    ├─ 1) ElevenLabs (vía Edge Function)   ← voz natural, la calidad objetivo
    │        ✗ sin key / HTTP 4xx / red caída / cuota agotada
    │        ↓  el error se registra y se traga; no interrumpe nada
    │
    ├─ 2) Web Speech API del navegador      ← sin costo, sin internet
    │        ✗ sin voces en español instaladas en el sistema
    │        ↓
    │
    └─ 3) Silencio + la tarjeta visual      ← el pedido ya está en el kanban
```

Tres reglas que hacen que esto sea robusto:

1. **Ninguna falla de audio interrumpe el flujo del pedido.** El audio es un extra sobre un flujo que ya funciona. Los errores se registran en consola y se comunican como estado en la UI; nunca se propagan como excepciones.
2. **Reproducción en serie, no superpuesta.** Si entran varios pedidos juntos, los audios se encolan y se reproducen uno tras otro (`audio.pause()` + `URL.revokeObjectURL` antes de cada uno). Si entran 3 en menos de ~2 segundos, se agrupan en un único anuncio: *"Entraron 3 comandas nuevas"*. Menos ruido para la cocina y menos caracteres facturados.
3. **Un pedido se anuncia una sola vez.** Con varias pantallas de cocina abiertas, o ante una reconexión, el mismo pedido no puede repetirse. Esto se resuelve en la base de datos con una restricción de unicidad, no en memoria del navegador.

---

## 6. Componentes a crear

| # | Archivo | Responsabilidad |
|---|---|---|
| 1 | `supabase/functions/voz-pedido/index.ts` | Edge Function. Valida el JWT del empleado y que el rol sea **2** (el dueño recibe 403), valida que el pedido exista y esté `pendiente`, reserva el pedido en `anuncios_pedido` (si ya lo estaba, responde `ya_anunciado` sin llamar a ElevenLabs), pide el audio y lo devuelve como MP3. |
| 2 | `database/fixes/crear_anuncios_pedido.sql` (+ espejo en `scrips_database/fixes/`) | Tabla `anuncios_pedido` con `pedido_id` **único**: es la garantía de "una vez por pedido". Columnas: `id`, `pedido_id`, `cafeteria_id`, `usuario_id`, `canal`, `modelo`, `voz`, `caracteres`, `estado`, `detalle`, `creado_en`, `emitido_en`. |
| 3 | `app-desktop/src/services/vozKdsService.js` | Cliente. Arma la frase desde los detalles del pedido, invoca la función, reproduce el audio, maneja la cascada, la cola, el agrupamiento, el silenciar y el desbloqueo de audio. |
| 4 | Toggle 🔊 en `components/KdsTopBar.jsx` | Interruptor de avisos de voz con estado visible (activo / silenciado / sin permisos). |
| 5 | Integración en `pages/empleado/Comandas.jsx` | Se engancha al camino del pedido nuevo (el mismo callback que ya agrega la tarjeta), **solo en alta real, nunca en la carga inicial** de la pantalla. |
| 6 | `app-desktop/prueba-voz.html` | Banco de pruebas: crea pedidos reales desde el navegador (1 o 3 seguidos) y permite borrar los de prueba, sin salir de la app. |
| 7 | Preferencias del operador | Solo la preferencia de silencio, en `localStorage` (`kds_voz_prefs_v1`). No se creó tabla de configuración: el volumen y la voz se fijan en la función. |


> **Detalle de implementación que conviene no olvidar:** en el KDS, el objeto
> `comanda.id` es el **código de retiro** (lo que ve el empleado, p. ej. `427`),
> no el id de la tabla `pedidos`. El id real viene en `comando.rawId`. Por eso
> el servicio de voz usa `pedido.rawId ?? pedido.id`, igual que el resto del
> proyecto (`PedidoCard`, `DetallePedidoDialog`, `pedidosService`).

---

## 7. Configuración

### Secretos y variables
| Dónde | Variable | ¿La ve el empleado? |
|---|---|---|
| Secreto de la Edge Function | `ELEVENLABS_API_KEY` | **No.** Es justamente lo que se quiere evitar. |
| Secreto/config de la función | `ELEVEN_MODELO` (por defecto `eleven_flash_v2_5`) | No |
| `localStorage` del navegador | `kds_voz_prefs_v1` (solo `silenciada`) | Sí, en su propio equipo |
| Secreto/config de la función | `ELEVEN_VOZ` (por defecto George, `JBFqnCBsd6RMkjVDRZzb`; con plan gratis solo funcionan Sarah, George y Arnold) | No |
| Secreto/config de la función | `ELEVEN_IDIOMA` (por defecto `es`) | No |
| Secreto/config de la función | `ELEVEN_VELOCIDAD` (por defecto `0.95`; la API acepta entre `0.7` y `1.2`) | No |

La key **nunca** se escribe en `app-desktop/.env`: toda variable `VITE_*` se compila dentro del bundle y es legible por cualquiera que abra el navegador.

### El idioma: forzarlo en vez de elegirlo

Con la clave disponible **no hay una voz nativa en español**: `GET /v1/voices` responde `401 missing_permissions`, o sea que la clave tiene permiso de TTS pero no de listado. Así que la idea de filtrar la biblioteca por `es` no es realizable hoy, y no se puede pedir una voz española concreta.

Lo que se hace es **forzar el idioma en la request** con `language_code: 'es'`, que hace que la locución salga con fonética española en vez del acento inglés por defecto de la voz. Es una solución honesta con lo que hay, no una voz española de verdad: cuando exista una, basta cambiar `ELEVEN_VOZ` y el resto del código sigue igual.

`language_code` solo existe en los modelos `v2_5` (`eleven_flash_v2_5`, `eleven_turbo_v2_5` y sus variantes `_turbo`). En `eleven_multilingual_v2` la API responde 422 y se pierde el audio, así que la función mira el modelo antes de mandar el campo.

Para comparar acentos sin esperar que el KDS anuncie algo, el banco de pruebas (`prueba-voz.html`) tiene una caja de texto libre con idioma y velocidad.

### Lectura de los códigos de retiro

El `codigo_retiro_diario` se locuta **de dos en dos desde la izquierda**, no dígito a dígito ni como número completo:

| Código | Se lee |
|---|---|
| `727` | siete veintisiete |
| `1234` | doce treinta y cuatro |
| `12345` | uno veintitrés cuarenta y cinco |
| `100` | uno cero |
| `1000` | diez cero |

El grupo va de a dos por posición, no por valor: con cantidad impar de dígitos el primero va de uno solo (`727` → `7` + `27`, `100` → `1` + `00`). Los números de treinta a noventa llevan "y" (`34` → treinta y cuatro), menos las decenas redondas (`40` → cuarenta), y de 21 a 29 van con "veinti-" (`27` → veintisiete).

Hay dos copias de esta lógica, `numeros.ts` en la Edge Function y `vozNumeros.js` en el navegador, porque el cliente no puede leer dentro de `supabase/functions/` y en un aviso agrupado el texto lo arma el KDS. `docs_local/probar-numeros.mjs` compara las dos sobre más de mil códigos para que no se separen sin que nadie se entere.

### Modelos disponibles
| Modelo | Latencia | Precio API | Idiomas | Límite por request |
|---|---|---|---|---|
| `eleven_flash_v2_5` | ~75 ms | **$0.05 / 1.000 caracteres** | 32 (incluye español) | 40.000 caracteres |
| `eleven_multilingual_v2` | ~250–300 ms | $0.10 / 1.000 caracteres | 29 (incluye español) | 10.000 caracteres |
| `eleven_v3` | — | — | 70+ (incluye español) | 5.000 caracteres |

**Recomendación: `eleven_flash_v2_5`.** Para un aviso operativo importa que suene rápido y barato, no cinematográfico; además cuesta la mitad. `eleven_multilingual_v2` (el que usa el prototipo) aporta mayor calidad expresiva a cambio del doble de precio, y es la opción adecuada si el objetivo es una demo.

### Selección de voz
El prototipo iniciaba con Rachel y Adam, que son voces **en inglés**. Para el KDS hay que elegir una voz con español: el propio prototipo ya ordenaba el desplegable poniendo primero las que declaran `es` en sus etiquetas, y la API `GET /v1/voices` permite filtrarlas. Alternativa: clonar la voz de una persona del equipo.

### Costo estimado
Con 300 pedidos/día y una frase promedio de ~55 caracteres (~500.000 caracteres/mes):

| Modelo | Costo aproximado/mes |
|---|---|
| `eleven_flash_v2_5` | **~$25** |
| `eleven_multilingual_v2` | ~$50 |

Los precios son los publicados por ElevenLabs para uso por API y **deben confirmarse en el panel de la cuenta** antes de comprometer presupuesto. El uso comercial requiere plan pagado; los niveles gratuitos alcanzan para toda la fase de pruebas.

---

## 8. Ventajas y desventajas

### Ventajas
- **Libera la atención visual:** la persona de cocina puede seguir haciendo su trabajo sin vigilar la pantalla.
- **Aviso inmediato y global:** el Realtime ya entrega el evento; el audio se suma con una latencia menor a 1 s.
- **No toca la lógica de negocio:** es un adorno del evento que ya existe, sin cambios en el flujo del pedido ni en los estados.
- **Costo acotado y predecible:** se paga por caracteres generados, con un costo por pedido de centavos.
- **Degradación elegante:** si el servicio falla, el pedido sigue apareciendo normalmente en pantalla.
- **Auditable:** queda registro de qué se anunció, cuándo y con qué modelo.

### Desventajas
- **Agrega un tercero externo al sistema:** la disponibilidad del KDS pasa a depender parcialmente de un servicio ajena.
- **Costo variable:** si no se controla, un volumen alto de pedidos (o pantallas duplicadas) puede disparar el gasto.
- **Requiere un clic previo del usuario** por la política de autoplay de los navegadores: sin ese paso no hay audio.
- **La calidad de voz depende del modelo elegido** y de que la voz esté en español; con la voz equivocada el anuncio se entiende mal.
- **No es instantáneo en la práctica:** siempre suena después de que la tarjeta ya apareció; es confirmación, no anticipación.
- **Ruido en la cocina:** si no se agrupan ni se limitan los avisos, puede terminar molestando y la gente lo silenciaría.

---

## 9. Límites y riesgos técnicos

| # | Límite | Impacto | Mitigación |
|---|---|---|---|
| 1 | **Política de autoplay de los navegadores** | Chrome/Chromium bloquea el audio sin una interacción previa del usuario | Botón "Activar avisos" al entrar (una vez por sesión). Es una restricción del navegador, no un defecto |
| 2 | **Depende de internet** | Sin red no hay audio generado | Cae a la voz del sistema (Web Speech); si tampoco hay voces en español, queda solo la tarjeta visual |
| 3 | **Costo por uso** | Escala con el número de pedidos | Modelo Flash, agrupado de pedidos simultáneos, cache de frases repetidas e interruptor de apagado |
| 4 | **Latencia** | El aviso suena después de que la tarjeta apareció | Es coherente con el diseño: la voz confirma, no reemplaza a la pantalla |
| 5 | **Salida no determinista** | La misma frase puede sonar distinta en cada generación (salvo fijando `seed`) | No afecta la información transmitida |
| 6 | **Dependencia de Realtime** | Si el KDS está desconectado en el momento del insert, el pedido entra por el poll de respaldo y **no suena** (Realtime no reenvía eventos perdidos) | Segunda fase: al reconectar, anunciar solo los pedidos que no estén en `anuncios_pedido` |
| 7 | **Varias pantallas de cocina** | Cada pantalla intentaría reproducir el mismo aviso | La restricción de unicidad en `anuncios_pedido`: solo la primera que llega obtiene el audio |
| 8 | **Abuso de la función** | Con la anon key, alguien podría invocar la función repetidamente y gastar cuota | La función exige JWT válido de un empleado, valida que el pedido exista y esté `pendiente`, y marca el pedido como anunciado en la misma operación |
| 9 | **Voz del sistema inconsistente** | En equipos sin voces en español, el fallback puede sonar con acento raro o no hablar | Se detecta y se informa en la UI en vez de fallar en silencio |
| 10 | **Sin caché de audio** | Cada pedido regenera el mismo texto si se repite ("Nueva comanda, número 42" cambia, pero "2 cafés" se repite) | Segunda fase: cachear por hash del texto normalizado |
| 11 | **TTS colgado o red que se cae** | Una llamada lenta, un corte de DNS o un 5xx deja la cola esperando y el KDS queda sin anunciar los pedidos siguientes | Timeout de 10 s por intento en la Edge Function y 12 s en el cliente. La función **reintenta hasta 3 veces** lo que se va solo con una espera (errores de red, timeouts, 429 y 5xx, con espera creciente entre intentos); un 404 o un 4xx de validación no se reintenta porque no va a mejorar. Si aun así falla, cae a la voz del sistema y la cola sigue |
| 12 | **Sin relación usuario ↔ cafetería** | La función valida el rol del que llama, pero no que ese empleado pertenezca a la cafetería del pedido: con la clave de la cafetería 1 serviría en cualquiera | Hoy solo hay una cafetería. Al abrir varias: agregar la relación en la base o fijar `KDS_CAFETERIA_ID` en la función |
| 13 | **`pedidos` sin RLS** (preexistente, no lo introduce esta función) | La tabla tiene RLS desactivado y permisos amplios para `anon` y `authenticated`: con la anon key se pueden insertar pedidos | Endurecer las políticas de `pedidos` por separado. Para esta función no cambia nada: igual exige JWT de empleado |

| 14 | **Empleado sin permiso de lectura sobre `anuncios_pedido`** | La política dejaba leer solo al dueño (rol 3), así que el empleado con el KDS abierto, y el panel de pruebas, no podían confirmar si una comanda se anunciaró: la consulta volvía `permission denied` y no había forma de distinguir "no se anunció" de "no puedo mirar" | La política ahora cubre empleados y dueños (`anuncios_pedido_select_operadores`). El panel reutiliza la sesión del KDS en lugar de la clave `anon`. Los INSERT/UPDATE siguen siendo exclusivos de `service_role`, así que un empleado no puede falsear el control de avisos (verificado en `probar-confirmacion.mjs`). **Pendiente:** la política filtra por rol y no por cafetería, porque `cafeteria_usuarios` todavía no existe; cuando exista, hay que cambiar el `USING` para limitar cada empleado a su cafetería |
| 15 | **`en_curso` leído como resultado final** | La función reserva la fila antes de llamar a ElevenLabs y recién después la pasa a `emitido` o `fallido`. El panel veía `en_curso` y cerraba la verificación justo cuando el aviso iba a salir bien, así que reportaba un fallo inexistente | El panel sigue consultando hasta que la fila toma un estado final. `en_curso` no cierra nada |

---

## 10. Alternativas consideradas

| Alternativa | Evaluación |
|---|---|
| Llamar a ElevenLabs desde el navegador (como hace el prototipo) | Descartada: expone la clave en el equipo de cada empleado, costo abierto y sin control |
| `translate_tts` de Google (segundo nivel del prototipo) | Descartada para producción: endpoint no documentado, sin garantía, contrario a los términos de uso de Google y sin funcionamiento offline |
| Solo Web Speech API (voz del sistema) | Viable como respaldo: sin costo ni clave, pero calidad variable según el equipo. Insuficiente como solución principal |
| Notificar por el Bot de Telegram | El Bot cubre al Dueño (FR-19); el aviso de cocina es otro canal y otra necesidad |
| `backend-node` como intermediario | Descartada: el KDS opera sin él; sería un punto de falla nuevo en el servicio crítico |
| Generar el audio en el cliente con un modelo local | Descartada: peso de modelo, CPU y calidad muy inferiores; no viable en una tablet de cocina |

---

## 11. Plan de trabajo

| Fase | Contenido | Tamaño |
|---|---|---|
| **F1** | Tabla `anuncios_pedido` + RLS + índices | chica — **hecho** |
| **F2** | Edge Function `voz-pedido`: validación, idempotencia, llamada a ElevenLabs, respuesta binaria | media — **hecho** |
| **F3** | `vozKdsService.js`: cascada, cola, agrupamiento, silenciar, desbloqueo de audio | media — **hecho** |
| **F4** | Toggle en `KdsTopBar`, integración en `Comandas.jsx`, preferencia de silencio | chica — **hecho** |
| **F5** | Pruebas con `prueba-voz.html`, build y consola | chica — **hecho con clave falsa** |
| **F6 (opcional)** | Cache de frases repetidas y anuncio de pendientes al reconectar | chica |

**Estimación:** 2 a 3 jornadas para F1–F5.

### Criterios de aceptación
- [x] Al insertar un pedido en BD, la tarjeta aparece **y** se intenta el aviso, sin recargar la pantalla.
- [x] Sin key válida, el pedido **igual** aparece en el kanban, se avisa por qué en la barra superior y no hay errores en consola.
- [x] Con la fila en `emitido`, una segunda llamada responde `ya_anunciado` sin volver a generar audio.
- [x] Tres pedidos en menos de 2 segundos producen un único aviso agrupado, sin audios superpuestos.
- [x] El interruptor silencia de inmediato, sin recargar la pantalla ni perder el estado del kanban.
- [x] `npm run build` sin errores y consola del navegador limpia.
- [x] La clave de ElevenLabs no aparece en el bundle del navegador.
- [ ] **Pendiente de una clave real:** que suene la voz de ElevenLabs (hasta ahora solo se verificó el camino de error, que cae a la voz del sistema).
- [ ] **Pendiente:** announcing con dos pantallas KDS abiertas a la vez.

---

## 12. Puesta en marcha y uso

### Puesta en marcha
```bash
# 1. Crear la tabla de control de anuncios
psql -f database/fixes/crear_anuncios_pedido.sql

# 2. Cargar la clave como secreto de la función (nunca en el repositorio)
supabase secrets set ELEVENLABS_API_KEY=sk_...

# 3. Desplegar la función (con verificación de JWT activa)
supabase functions deploy voz-pedido

# 4. Probar: iniciar sesión como empleado en el KDS y abrir el banco de pruebas
#    http://localhost:5173/prueba-voz.html  →  "Crear 1 comanda" / "Crear 3 de golpe"
INSERT INTO public.pedidos (cafeteria_id, estado, codigo_retiro_diario, ...)
VALUES (1, 'pendiente', '9999', ...);
# → la tarjeta aparece en "Pendiente" y suena el aviso
```

### Uso en operación
1. Al entrar al KDS, se hace **un clic en "Activar avisos de voz"** (una vez por sesión).
2. Se trabaja con normalidad: cada pedido nuevo se anuncia por audio.
3. Si el audio molesta (llamadas, clientes), se aprieta 🔊 para silenciar sin salir del sistema.

---

## 13. Problemas encontrados probando en el KDS real

Estas correcciones salieron de insertar pedidos con `prueba-voz.html` y no de la
revisión de código. Se dejan registradas porque son fáciles de reintroducir.

| # | Síntoma | Causa | Corrección |
|---|---|---|---|
| 1 | La función respondía `404 pedido_no_existe` en todos los pedidos | En el KDS, `comanda.id` es el **código de retiro** (427), no el id de `pedidos` | `vozKdsService` envía `pedido.rawId ?? pedido.id` |
| 2 | La voz sonaba **cortada** a mitad de frase | El siguiente aviso llamaba `speechSynthesis.cancel()` a los 400 ms del anterior | `_hablarVozSistema()` ahora devuelve una promesa que resuelve en `onend`, con tiempo máximo de seguridad |
| 3 | El primer aviso a veces no sonaba | El WAV mudo de desbloqueo tenía el chunk `data` **vacío**: Firefox lo rechaza y el audio seguía bloqueado | WAV PCM de 8 bits con 400 muestras reales de silencio |
| 4 | Un TTS lento dejaba la cola congelada (150 s hasta el 504 del gateway) | No había timeout en ninguna de las dos puntas | 10 s en la función (`AbortSignal.timeout`) y 12 s en el cliente (`AbortController`) |
| 5 | Las comandas **no se ordenaban por hora** | `getAll` las devuelve de más nueva a más vieja y el poll de respaldo las volcaba así cada 10 s | `mergeConSnapshot` vuelve a ordenar; además el comparador pasó a comparar instantes reales (epoch) en vez de minutos del día, que empataba pedidos del mismo minuto |
| 6 | De 3 comandas seguidas solo se anunciaba **la primera** | El resumen del cliente ("Entraron 3 comandas nuevas") se descartaba: la función siempre armaba el texto desde la base, y de la ráfaga solo conoce un pedido | La función acepta un `texto` opcional (solo lo manda el KDS cuando agrupa) y el cliente arma la frase con todas. La base sigue siendo la fuente de verdad para un pedido individual |
| 7 | El aviso agrupado duraba **20 segundos** | Se recitaba cada ítem con su cantidad para cada comanda | El agrupado va corto: cuántos son, cuáles y la lista de productos **sin repetir**. Medido con el audio real: 20 s → 11 s |
| 8 | Salía `Café Americano,, Capuchino` (coma duplicada) | Al concatenar el primer ítem ya quedaba con coma final y el segundo agregaba otra | Se arma la lista contra un acumulador y se mide el largo total, no solo el nombre nuevo |
| 9 | Un pedido que falló y después se emitió quedaba auditado como `emitido` **con el error viejo** | El `UPDATE` de éxito no limpiaba `detalle` | `detalle: null` al emitir |

### La voz de ElevenLabs: qué clave usar y qué voz elegir

Con la clave real (`sk_…`) la cadena completa funciona: la función responde
`200 audio/mpeg` y el KDS reproduce el MP3 sin caerse a la voz del sistema.
Pero hubo que resolver dos cosas de la cuenta, no del código:

**1. El plan gratis no deja usar las voces de la biblioteca.** Con la voz que
venía por defecto, `MF3mGyEYCl7XYWbV9V6O` (Elli), ElevenLabs responde:

```
402 {"type":"payment_required","code":"paid_plan_required",
     "message":"Free users cannot use library voices via the API.
                Please upgrade your subscription to use this voice."}
```

Probando voces una por una contra la API, con este plan funcionan solo tres:

| Voz | Id | Resultado |
|---|---|---|
| Sarah | `EXAVITQu4vr4xnSDxMaL` | 200 · **usada por defecto** |
| George | `JBFqnCBsd6RMkjVDRZzb` | 200 |
| Arnold | `VR6AewLTigWG4xSOukaG` | 200 |
| Elli, Rachel, Domi, Emily, Josh, Drew | — | 402 `paid_plan_required` |

Por eso `VOZ_DEFAULT` en la función cambió de Elli a Sarah. Si la cuenta pasa
a plan pago, se puede cambiar por cualquier voz de la biblioteca.

**2. La clave puede venir acotada por permisos.** Si la clave no tiene
`voices_read`, `GET /v1/voices` responde `401 missing_permissions` aunque la
clave sea correcta; no es una clave inválida. Para el TTS alcanza con permiso de
síntesis, que es el que importa acá. Se puede comprobar con:

```bash
curl -s https://api.elevenlabs.io/v1/voices -H "xi-api-key: sk_..." | head -c 200
# 401 missing_permissions  -> clave válida pero acotada, el TTS funciona igual
# 401 unauthorized          -> la clave está mal
```

### Cómo dejar la voz real configurada

```bash
# 1. Secreto local (no se sube al repositorio: está en .gitignore)
cat > supabase/functions/.env <<'EOF'
ELEVENLABS_API_KEY=sk_...
ELEVEN_MODELO=eleven_flash_v2_5
ELEVEN_VOZ=EXAVITQu4vr4xnSDxMaL
EOF

# 2. Reiniciar el runtime local
npx supabase functions serve voz-pedido --env-file supabase/functions/.env

# 3. En producción
supabase secrets set ELEVENLABS_API_KEY=sk_...
supabase functions deploy voz-pedido
```

Ojo con una trampa fácil: el identificador de 64 caracteres que aparece en el
panel de ElevenLabs **no es la clave**. Es el ID, y la API lo rechaza con
`"API key ID used as API key"`. La clave empieza con `sk_`.

Mientras la clave falte o sea inválida, la barra superior del KDS lo dice
explícito ("ElevenLabs rechazó la petición (HTTP 401): se usará la voz del
sistema"), para que nadie piense que el aviso salió con la voz buena.

### Verificación hecha con la clave real

| Prueba | Resultado |
|---|---|
| Una comanda | 1 llamada, `200 audio/mpeg`, 87 815 B, 5,5 s, reproducido hasta el final |
| Tres comandas juntas | 1 llamada agrupada, 179 348 B, 11,2 s, texto con los tres códigos |
| Sin tocar la voz del sistema | `speechSynthesis.speak()` no se invocó en ningún caso |
| Auditoría | `estado=emitido`, `canal=elevenlabs`, `voz=JBFqnCBsd6RMkjVDRZzb`, `detalle` limpio |
| Idioma | `X-Voz-Idioma: es`, `X-Voz-Velocidad: 0.95` sobre `eleven_flash_v2_5` |
| Texto generado | "Nueva comanda, número dos noventa y cinco. 1 Café Americano, 2 Capuchino." |

### La sesión es obligatoria para que suene

El aviso lo dispara el navegador del KDS, no la base: si no hay una pestaña del
KDS con sesión iniciada y la voz activada, el pedido se crea igual y nadie lo
anuncia. `docs_local/probar-sesion.mjs` cubre justo ese caso, incluida la
comprobación de que el login no entre sin sesión real.

El usuario de prueba es `empleado@coffeefast.cl` y el placeholder del formulario
dice lo mismo (antes decía `coffeefaster.cl`, un dominio que no existe en Auth,
as que el error de credenciales no se entendía).

### La suite de pruebas

Está en `docs_local/` y no se versiona porque depende de Firefox de Playwright
instalado en el equipo de cada uno. Con el dev server, la Edge Function y la base
levantadas:

| Prueba | Qué cubre | Resultado esperado |
|---|---|---|
| `probar-numeros.mjs` | Lectura de códigos y que las dos copias coincidan | `NÚMEROS OK` |
| `probar-sesion.mjs` | Login real, aviso con sesión y sin ella | `SESIÓN CORRECTA` |
| `probar-voz.mjs` | MP3 de ElevenLabs reproducido entero | `TODO OK` |
| `probar-cola-viva.mjs` | Avisos seguidos, con voz silenciada y tras recargar | `COLA SIEMPRE VIVA` |
| `probar-sin-voces.mjs` | Fallback honesto cuando el equipo no tiene voces | `FALLBACK HONESTO` |
| `probar-idioma.mjs` | Que a ElevenLabs le llegue `language_code: 'es'` y la velocidad | `IDIOMA OK` |

`probar-idioma.mjs` intercepta la llamada a la Edge Function y lee las cabeceras
`X-Voz-Idioma` y `X-Voz-Velocidad` en vez de creerle al navegador: son el único
lugar donde se ve lo que realmente llegó a ElevenLabs.

Una advertencia sobre los warnings: React registra como error de consola los
props que llegan a un elemento del DOM. El markup del login que escribió otra
persona produce uno (`alignItems` dentro de un `Button`) y `probar-voz.mjs` lo
muestra aparte para que no tape el resultado real del audio.

---

## 14. Referencias

- **Prototipo de origen:** `/home/elias/Documentos/test_botKDS/kds-voice-prototype.html` (620 líneas, sin build). De ahí se toma la metodología: cascada de TTS, manejo de errores sin romper el flujo, control de reproducción en serie.
- **API de ElevenLabs:** `POST /v1/text-to-speech/{voice_id}` · `GET /v1/voices` · header `xi-api-key`.
- **Puntos de integración en el proyecto:** `app-desktop/src/services/kdsRealtime.js` (callback `onComanda`) y `app-desktop/src/pages/empleado/Comandas.jsx`.
- **Precedente de configuración con RLS:** `app-desktop/src/service/telegram_dueno.js`.
- **Precedente de migración SQL replicada:** `database/fixes/` y `scrips_database/fixes/`.
