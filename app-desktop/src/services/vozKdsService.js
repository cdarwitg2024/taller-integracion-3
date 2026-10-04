import { supabase, isSupabaseConfigured } from '../service/supabase';
import { CAFETERIA_ID } from './backendApi';

import { codigoEnPalabras } from './vozNumeros.js';

// ============================================================
// T16 · Avisos de voz del KDS (ElevenLabs TTS)
// ============================================================
// Cuando entra un pedido nuevo, la cocina lo escucha: "Nueva
// comanda, número 42. 2 cafés, 1 medialuna."
//
// DISEÑO (docs/notificaciones_voz_elevenlabs.md):
//   * Cascada: ElevenLabs (vía Edge Function "voz-pedido") -> voz
//     del sistema (Web Speech) -> nada. El pedido JAMÁS se pierde
//     por un problema de audio: la tarjeta ya está en pantalla.
//   * La API key vive en el servidor. El navegador no la tiene.
//   * Un pedido se anuncia una sola vez. Lo garantiza la tabla
//     anuncios_pedido (pedido_id UNIQUE) del lado servidor, así
//     que funciona aunque haya varias pantallas abiertas.
//   * Si entran varios pedidos juntos se agrupan en un aviso
//     ("Entraron 3 comandas nuevas") y los audios nunca se
//     superponen: van en cola.
//
// Uso en el KDS:
//   useEffect(() => vozKds.suscribir(setEstadoVoz), []);
//   const agregar = (c) => { setPedidos(...); vozKds.anunciar(c); };
//   <KdsTopBar onActivarVoz={vozKds.activar} onSilenciarVoz={vozKds.silenciar} />

const PREFS_KEY = 'kds_voz_prefs_v1';

// Estados que ve la interfaz.
export const VOZ_APAGADA = 'apagada';
export const VOZ_ACTIVA = 'activa';
export const VOZ_SILENCIADA = 'silenciada';

const MAX_ITEMS_HABLA = 4;
const MAX_CARACTERES = 300;
const VENTANA_AGRUPACION_MS = 1500; // pedidos en este plazo se agrupan
const PAUSA_ENTRE_AVISOS_MS = 400;
// Cuántas comandas caben cómodamente en un aviso agrupado antes de
// que se haga demasiado largo para escucharlo de un tirón.
const MAX_PEDIDOS_POR_AVISO = 4;
// Tope del aviso agrupado. ~9 caracteres por segundo es lo que tarda el
// audio: 120 caracteres ≈ 12 s, que ya es mucho en una cocina.
const MAX_CARACTERES_AGRUPADO = 120;
// Tiempo máximo que puede tomar todo el ciclo de un aviso (descargar el
// MP3 + reproducirlo + pausa). Pasado esto, la cola está trabada y se
// reinicia sola para no dejar el KDS mudo en silencio.
const LIMITE_COLA_BLOQUEADA_MS = 60_000;
// Si la Edge Function no contesta, cortamos y usamos la voz del
// sistema: un TTS lento no puede dejar al KDS sin anunciar pedidos.
const TIMEOUT_FUNCION_MS = 12000;

// Audio mudo para "desbloquear" el sonido tras un clic del usuario.
// WAV PCM de 8 bits, mono, 8000 Hz, 50 ms de silencio real (400 muestras).
// Importante: un WAV con el chunk "data" vacío no lo decodifican varios
// navegadores (Firefox lo rechaza) y el audio queda bloqueado igual.
const AUDIO_MUDO =
  'data:audio/wav;base64,UklGRrQBAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YZABAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA';

/**
 * Arma la frase del aviso de UNA comanda.
 * Espejo de armarFrase() en supabase/functions/voz-pedido/index.ts. Para
 * una comanda sola el servidor vuelve a armarla con datos de la base
 * (fuente de verdad) y esta copia se usa para la voz del sistema y para
 * mostrar el texto. En un aviso agrupado manda el texto del cliente
 * (armarFraseGrupo), porque la base no sabe cuántas entraron juntas.
 */
export function armarFrase(pedido) {
  const codigo = Number(pedido?.codigo_retiro_diario);
  const numero = Number.isFinite(codigo) && codigo > 0 ? codigoEnPalabras(codigo) : null;

  const partes = [];
  for (const d of pedido?.detalles_pedido || []) {
    const nombre = (d.productos?.nombre || '').trim();
    if (!nombre) continue;
    partes.push(`${Number(d.cantidad) || 1} ${nombre}`);
    if (partes.length >= MAX_ITEMS_HABLA) break;
  }

  let texto = numero ? `Nueva comanda, número ${numero}` : 'Nueva comanda entrante';
  if (partes.length) texto += `. ${partes.join(', ')}`;
  texto += '.';
  if (texto.length > MAX_CARACTERES) texto = texto.slice(0, MAX_CARACTERES - 1) + '…';
  return texto;
}

/**
 * Texto del aviso cuando entraron varias comandas juntas.
 * El KDS es el único que sabe cuántas entraron en la ráfaga, así que
 * aquí se arma la frase con todas: antes el servidor solo alcanzaba a
 * describir la primera y las otras quedaban mudas.
 *
 * Va deliberadamente corto. Con las cantidades de cada ítem el aviso de
 * 3 comandas medía 20 s de audio, y en hora punta la cola se atrasa una
 * y otra vez. Acá se dice cuántas son y cuáles, más la lista de
 * productos sin repetir: el detalle con cantidades está en la pantalla,
 * que es donde el empleado lo tiene que hacer igual.
 */
export function armarFraseGrupo(pedidos) {
  if (!pedidos?.length) return '';
  if (pedidos.length === 1) return armarFrase(pedidos[0]);

  const codigos = pedidos
    .map((p) => Number(p?.codigo_retiro_diario))
    .filter((c) => Number.isFinite(c) && c > 0)
    .map(codigoEnPalabras);

  const encabezado = codigos.length === pedidos.length
    ? `, ${codigos.join(', ')}`
    : '';

  const vistos = new Set();
  for (const p of pedidos) {
    for (const d of p?.detalles_pedido || []) {
      const nombre = (d.productos?.nombre || '').trim();
      if (nombre) vistos.add(nombre);
    }
  }

  let texto = `Entraron ${pedidos.length} comandas nuevas${encabezado}.`;
  if (vistos.size) {
    // Se arma de a uno para no cortar un nombre por la mitad ni dejar
    // una coma colgando, midiendo el total acumulado y no solo el
    // nombre nuevo.
    let lista = '';
    for (const nombre of vistos) {
      const prueba = lista ? `${lista}, ${nombre}` : ` ${nombre}`;
      if (`${texto}${prueba}.`.length > MAX_CARACTERES_AGRUPADO) break;
      lista = prueba;
    }
    if (lista) texto += `${lista}.`;
  }
  return texto;
}

function leerPrefs() {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    const prefs = raw ? JSON.parse(raw) : {};
    return { silenciada: Boolean(prefs.silenciada) };
  } catch {
    return { silenciada: false };
  }
}

function guardarPrefs(prefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    /* modo privado: la preferencia solo vive en memoria */
  }
}

export const vozKdsService = {
  // Estado interno
  _estado: null, // se inicializa abajo (necesita localStorage)
  _audio: null,
  _urlAudio: null,
  _cola: [],
  _procesando: false,
  _cerrarAudio: null, // cierra la promesa del audio en curso
  _sinAnunciar: 0, // pedidos que entraron con la voz apagada
  _latido: null,
  _vigilandoSesion: false,
  _intervaloSesion: null,
  _timerAgrupacion: null,
  _oyentes: new Set(),
  _diagnostico: null, // último motivo por el que no se usó ElevenLabs

  // -----------------------------------------------------------------
  // Estado e integración con la interfaz
  // -----------------------------------------------------------------
  obtenerEstado() {
    return this._estado;
  },

  obtenerDiagnostico() {
    return this._diagnostico;
  },

  /**
   * Permite que la UI se entere de los cambios de estado y de voz.
   * El listener recibe (estado, diagnostico).
   */
  suscribir(fn) {
    this._oyentes.add(fn);
    try {
      fn(this._estado, this._diagnostico);
    } catch {
      /* un listener roto no debe romper el aviso */
    }
    return () => this._oyentes.delete(fn);
  },

  _notificar() {
    this._oyentes.forEach(fn => {
      try {
        fn(this._estado, this._diagnostico);
      } catch {
        /* idem */
      }
    });
  },

  _setEstado(estado) {
    if (this._estado === estado) return;
    this._estado = estado;
    this._notificar();
  },

  _setDiagnostico(texto) {
    if (this._diagnostico === texto) return;
    this._diagnostico = texto;
    this._notificar();
  },

  // -----------------------------------------------------------------
  // Activar / silenciar
  // -----------------------------------------------------------------

  /**
   * Los navegadores (Chrome/Chromium) bloquean el audio si el
   * usuario no interactuó con la página. Este método se llama desde
   * un clic real: reproduce un audio mudo para "desbloquear" el
   * canal de sonido de la sesión.
   */
  async activar() {
    this._detenerAudio();
    try {
      const silencioso = new Audio(AUDIO_MUDO);
      silencioso.volume = 0;
      await silencioso.play();
    } catch {
      // sin desbloqueo: el primer aviso real puede pedir un clic
    }
    guardarPrefs({ silenciada: false });
    this._sinAnunciar = 0;
    this._setDiagnostico(null);
    this._setEstado(VOZ_ACTIVA);
    this._vigilarSesion();
    await this._pump();
    return true;
  },

  /**
   * La voz depende de la sesión de Supabase (la función exige JWT).
   * Si la sesión se cae a mitad de turno, hay que decirlo en el
   * momento: si no, el KDS queda mudo sin explicación.
   */
  async _vigilarSesion() {
    if (this._vigilandoSesion) return;
    this._vigilandoSesion = true;

    const revisar = async () => {
      if (this._estado !== VOZ_ACTIVA) return;
      let token = null;
      try {
        const { data } = await supabase.auth.getSession();
        token = data?.session?.access_token || null;
      } catch {
        token = null;
      }
      if (token) {
        // Se volvió a tener sesión: el aviso de falta ya no aplica.
        if (/Sin sesión/.test(this._diagnostico || '')) this._setDiagnostico(null);
        return;
      }
      this._setDiagnostico(
        'Se perdió la sesión de Supabase: los avisos van a fallar. Inicia sesión otra vez.',
      );
    };

    try {
      supabase.auth.onAuthStateChange((evento) => {
        if (evento === 'SIGNED_OUT' || evento === 'TOKEN_REFRESHED' || evento === 'SIGNED_IN') {
          revisar();
        }
      });
    } catch {
      /* si el cliente no soporta el evento, el chequeo por intervalo basta */
    }

    this._intervaloSesion = setInterval(revisar, 30_000);
  },

  silenciar() {
    guardarPrefs({ silenciada: true });
    this._detenerAudio();
    this._cola = [];
    if (this._timerAgrupacion) {
      clearTimeout(this._timerAgrupacion);
      this._timerAgrupacion = null;
    }
    this._procesando = false;
    this._setEstado(VOZ_SILENCIADA);
  },

  // -----------------------------------------------------------------
  // Anuncios
  // -----------------------------------------------------------------

  /**
   * Encola el aviso de un pedido nuevo.
   * No bloquea: el KDS ya agregó la tarjeta, esto es solo audio.
   */
  anunciar(pedido) {
    if (!pedido) return;
    // En el KDS, `id` es el código de retiro (lo que ve el empleado);
    // el id real de la tabla `pedidos` viene en `rawId`.
    const idReal = pedido.rawId ?? pedido.id;
    if (idReal === null || idReal === undefined || idReal === '') return;
    if (this._estado !== VOZ_ACTIVA) {
      // No se descarta en silencio: se cuenta y se avisa, porque si no el
      // operador ve pedidos entrando y cree que el aviso está roto.
      this._sinAnunciar += 1;
      this._setDiagnostico(
        this._estado === VOZ_SILENCIADA
          ? `Voz silenciada: ${this._sinAnunciar} pedido(s) sin anunciar`
          : `Voz apagada: ${this._sinAnunciar} pedido(s) sin anunciar. Actívala para avisos.`,
      );
      return;
    }

    this._cola.push({ pedidoId: String(idReal), pedido });

    // Agrupa lo que entra en la misma ráfaga: si no, tres pedidos
    // juntos serían tres audios superpuestos.
    if (!this._timerAgrupacion) {
      this._timerAgrupacion = setTimeout(() => {
        this._timerAgrupacion = null;
        this._pump();
      }, VENTANA_AGRUPACION_MS);
    }
  },

  /**
   * Red de seguridad: si la cola quedara trabada (un await que nunca
   * resuelve, el runtime caído colgado, una pestaña suspendida) se
   * suelta el bloqueo para que los pedidos siguientes se anuncien.
   * Sin esto, un solo atasco apagaba la voz para toda la sesión.
   */
  _vigilar() {
    if (this._latido) return;
    this._latido = setInterval(() => {
      if (!this._procesando) {
        clearInterval(this._latido);
        this._latido = null;
        return;
      }
      const lleva = Date.now() - (this._desdeProcesando || 0);
      if (lleva < LIMITE_COLA_BLOQUEADA_MS) return;
      console.warn(`[vozKds] la cola quedó trabada ${Math.round(lleva / 1000)} s; se reinicia`);
      this._cerrarAudio?.(false);
      this._detenerAudio();
      this._procesando = false;
      this._setDiagnostico('La cola de voz se reinició sola. Revisa que la voz esté activa.');
    }, 5000);
  },

  async _pump() {
    if (this._procesando || this._estado !== VOZ_ACTIVA) return;
    if (!this._cola.length) return;

    this._procesando = true;
    this._desdeProcesando = Date.now();
    this._vigilar();
    try {
      while (this._cola.length && this._estado === VOZ_ACTIVA) {
        const lote = this._sacarLote();

        // El aviso se arma acá porque el KDS es quien sabe cuántas
        // comandas entraron juntas. Si no, el servidor solo puede
        // describir la primera y las demás quedan sin anunciar.
        const agrupado = lote.length > 1;
        const texto = armarFraseGrupo(lote.map((x) => x.pedido));
        const pedidoId = lote[0].pedidoId;

        const ok = await this._reproducir(texto, pedidoId, agrupado);
        if (!ok && this._estado === VOZ_ACTIVA) {
          // ElevenLabs no sirvió: se intenta la voz del sistema y se
          // espera a que termine antes del siguiente aviso.
          await this._hablarVozSistema(texto);
        } else if (this._cola.length) {
          await new Promise(r => setTimeout(r, PAUSA_ENTRE_AVISOS_MS));
        }
      }
    } finally {
      this._procesando = false;
    }
  },

  /**
   * Saca el lote: 1 pedido, o hasta MAX_PEDIDOS_POR_AVISO si había una
   * ráfaga. El tope importa: si entran 8 comandas juntas y metemos las 8
   * en un solo texto, el aviso se corta a los 300 caracteres y las últimas
   * no se anuncian nunca. Con el tope, el resto queda en la cola y sale en
   * el siguiente aviso.
   */
  _sacarLote() {
    return this._cola.length > 1
      ? this._cola.splice(0, MAX_PEDIDOS_POR_AVISO)
      : this._cola.splice(0, 1);
  },

  // -----------------------------------------------------------------
  // Capa 1: ElevenLabs vía Edge Function
  // -----------------------------------------------------------------
  async _reproducir(_texto, pedidoId, agrupado = false) {
    if (!isSupabaseConfigured) {
      this._setDiagnostico('Supabase no configurado');
      return false;
    }

    // Sin sesión real de Supabase (por ejemplo, el fallback de
    // desarrollo del login) la función rechazaría el pedido: mejor
    // no gastar un viaje y dejar el motivo claro.
    let token = null;
    try {
      const { data } = await supabase.auth.getSession();
      token = data?.session?.access_token || null;
    } catch {
      token = null;
    }
    if (!token) {
      // Sin sesión no hay voz: la función exige JWT. La voz del sistema
      // no es un sustituto confiable (en muchos equipos no hay ninguna
      // voz instalada y suena en silencio), así que no se promete nada:
      // se dice el motivo y qué hacer.
      this._setDiagnostico(
        'Sin sesión de Supabase: los avisos NO funcionan. Cierra sesión e inicia sesión con una cuenta real.',
      );
      return false;
    }

    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/voz-pedido`;

    // Si la función de voz se cuelga, no puede quedarnos freezes la
    // cola: el audio tiene que llegar igual. Con timeout cortamos la
    // llamada y dejamos que speak() hable con la voz del sistema.
    const controlador = new AbortController();
    const t = setTimeout(() => controlador.abort(), TIMEOUT_FUNCION_MS);

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
          'Content-Type': 'application/json',
        },
        // Una comanda suelta la frase la arma el servidor desde la base
        // (fuente de verdad). En un aviso agrupado se manda el texto ya
        // armado, porque la base no sabe de la ráfaga.
        body: JSON.stringify(
          agrupado
            ? { pedido_id: Number(pedidoId), cafeteria_id: CAFETERIA_ID, texto: _texto }
            : { pedido_id: Number(pedidoId), cafeteria_id: CAFETERIA_ID },
        ),
        signal: controlador.signal,
      });

      const tipo = res.headers.get('content-type') || '';

      if (res.status === 200 && tipo.includes('audio')) {
        const blob = await res.blob();
        if (blob.size > 0) {
          this._setDiagnostico(null);
          await this._reproducirBlob(blob);
          return true;
        }
        this._setDiagnostico('ElevenLabs devolvió audio vacío');
        return false;
      }

      if (tipo.includes('application/json')) {
        const cuerpo = await res.json().catch(() => ({}));
        if (cuerpo?.ya_anunciado) {
          // Otra pantalla ya lo anunció (o ya se está anunciando):
          // no se vuelve a generar ni a gastar.
          this._setDiagnostico(null);
          return true;
        }
        this._setDiagnostico(this._traducirError(cuerpo, res.status));
        return false;
      }

      this._setDiagnostico(`La función respondió HTTP ${res.status}`);
      return false;
    } catch (e) {
      if (e?.name === 'AbortError') {
        this._setDiagnostico('La función de voz tardó demasiado: se usará la voz del sistema');
        return false;
      }
      this._setDiagnostico('No se pudo contactar la función de voz');
      console.warn('[vozKds] error llamando a voz-pedido:', e);
      return false;
    } finally {
      clearTimeout(t);
    }
  },

  _traducirError(cuerpo, status) {
    switch (cuerpo?.error) {
      case 'sin_configuracion':
        return 'La función no tiene ELEVENLABS_API_KEY: se usará la voz del sistema';
      case 'no_autenticado':
      case 'sin_permiso':
        return 'La sesión no está autorizada para anuncios';
      case 'ya_anunciado':
        return null;
      case 'pedido_no_pendiente':
        return `El pedido ya no está pendiente (${cuerpo.estado || '?'})`;
      case 'elevenlabs_rechazado':
        return `ElevenLabs rechazó la petición (HTTP ${cuerpo.status}): se usará la voz del sistema`;
      case 'voz_no_disponible':
        return `La voz configurada no existe (${cuerpo.voz}): se usará la voz del sistema`;
      case 'elevenlabs_inalcanzable':
        return 'No se pudo alcanzar ElevenLabs: se usará la voz del sistema';
      case 'elevenlabs_timeout':
        return 'ElevenLabs tardó demasiado: se usará la voz del sistema';
      case 'pedido_no_existe':
        return 'El pedido ya no existe';
      default:
        return `La función de voz respondió HTTP ${status}`;
    }
  },

  _reproducirBlob(blob) {
    return new Promise(resolve => {
      this._cerrarAudio?.(false);
      this._detenerAudio();

      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      this._audio = audio;
      this._urlAudio = url;

      let cerrado = false;
      let reloj = null;

      const limpiar = (completado = true) => {
        if (cerrado) return;
        cerrado = true;
        if (reloj) clearTimeout(reloj);
        if (this._cerrarAudio === limpiar) this._cerrarAudio = null;
        if (this._urlAudio === url) {
          URL.revokeObjectURL(url);
          this._urlAudio = null;
          this._audio = null;
        }
        resolve(completado);
      };
      this._cerrarAudio = limpiar;

      audio.onended = () => limpiar(true);
      audio.onerror = () => {
        console.warn('[vozKds] el navegador no pudo reproducir el MP3');
        limpiar(false);
      };
      audio.play().catch(() => {
        // Autoplay bloqueado: se avisa para que el operador cliquee.
        console.warn('[vozKds] el navegador bloqueó el audio; haz clic en la pantalla');
        limpiar(false);
      });

      // Reloj de seguridad: si el navegador deja el audio colgado (pestaña
      // en segundo plano,_STREAMING pausado, error silencioso) no
      // llegará ni 'onended' ni 'onerror'. Sin esto la cola se bloquea
      // para siempre. Se espera un margen amplio sobre la duración real
      // para no cortar un audio legítimo.
      audio.addEventListener('loadedmetadata', () => {
        const limite = Math.max(20, (Number(audio.duration) || 15) * 2 + 10);
        reloj = setTimeout(() => {
          console.warn('[vozKds] el audio no terminó a tiempo; se sigue con el siguiente');
          limpiar(false);
        }, limite * 1000);
      }, { once: true });
    });
  },

  // -----------------------------------------------------------------
  // Capa 2: voz del sistema (gratis, sin internet)
  // -----------------------------------------------------------------

  /**
   * Habla con la voz del sistema y **espera a que termine**.
   * Antes se daba por hecho a los 400 ms y el siguiente aviso cancelaba
   * el anterior a medio frase: sonaba "cortada".
   *
   * @returns {Promise<boolean>} true si terminó de hablar
   */
  _hablarVozSistema(texto) {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      this._setDiagnostico('Este navegador no soporta voz del sistema');
      return Promise.resolve(false);
    }

    return new Promise(resolve => {
      let terminado = false;
      // `ok` distingue "terminó de hablar" de "seagate el reloj": lo
      // segundo NO es una voz funcionando y no puede reportarse como tal.
      const finalizar = (ok) => {
        if (terminado) return;
        terminado = true;
        clearTimeout(seguro);
        clearInterval(esperaVoces);
        resolve(ok);
      };

      // Red de seguridad: si el motor no dispara `end` (pasa en equipos
      // sin voces instaladas) no se bloquea la cola, pero se reporta
      // como fallo para que quede a la vista.
      const seguro = setTimeout(() => {
        this._setDiagnostico(
          'La voz del sistema no respondió: es probable que no haya voces instaladas.',
        );
        finalizar(false);
      }, Math.max(4000, texto.length * 120));

      // Las voces se cargan de forma asíncrona: se espera un poco antes
      // de declarar que no hay ninguna.
      let esperaVoces = 0;
      const esperar = () => {
        const lista = window.speechSynthesis.getVoices() || [];
        if (lista.length) {
          clearInterval(esperaVoces);
          hablar(lista);
        }
      };
      esperaVoces = setInterval(esperar, 250);
      setTimeout(() => {
        if (terminado) return;
        clearInterval(esperaVoces);
        if (!(window.speechSynthesis.getVoices() || []).length) {
          this._setDiagnostico(
            'Este equipo no tiene voces instaladas: los avisos no se escucharán.',
          );
          finalizar(false);
        }
      }, 1500);

      const hablar = (lista) => {
        try {
          window.speechSynthesis.cancel();
          const utter = new SpeechSynthesisUtterance(texto);
          utter.lang = 'es-CL';
          utter.rate = 1;
          const vozEs = this._vozEspanol(lista);
          if (vozEs) {
            // Algunos navegadores rechazan la asignación si el objeto no
            // es una SpeechSynthesisVoice válida. Perder el aviso entero
            // por un acento es peor que hablar con la voz por defecto.
            try {
              utter.voice = vozEs;
            } catch {
              /* se habla con la voz que elija el sistema */
            }
          }
          utter.onend = () => finalizar(true);
          utter.onerror = () => {
            this._setDiagnostico('La voz del sistema falló al hablar');
            finalizar(false);
          };
          window.speechSynthesis.speak(utter);
        } catch (e) {
          console.warn('[vozKds] la voz del sistema falló:', e);
          finalizar(false);
        }
      };
    });
  },

  /**
   * Primera voz en español disponible, si el sistema tiene alguna.
   * Se puede pasar la lista ya cargada para no consultarla dos veces.
   */
  _vozEspanol(lista) {
    try {
      const voces = lista || window.speechSynthesis.getVoices() || [];
      return voces.find((v) => /^es/i.test(v.lang)) || null;
    } catch {
      return null;
    }
  },

  // -----------------------------------------------------------------
  // Audio
  // -----------------------------------------------------------------
  _detenerAudio() {
    // Importante: pause() NO dispara 'onended', así que hay que cerrar
    // la promesa a mano. Si no, el await de _reproducirBlob nunca
    // termina, _procesando queda en true y la cola se muere en
    // silencio para todos los pedidos siguientes.
    this._cerrarAudio?.(false);
    if (this._audio) {
      this._audio.pause();
      this._audio.currentTime = 0;
      this._audio = null;
    }
    if (this._urlAudio) {
      URL.revokeObjectURL(this._urlAudio);
      this._urlAudio = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  },
};

vozKdsService._estado = leerPrefs().silenciada ? VOZ_SILENCIADA : VOZ_APAGADA;

export default vozKdsService;
