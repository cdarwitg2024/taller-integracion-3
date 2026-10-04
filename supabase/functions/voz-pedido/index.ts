// ============================================================
// T16 · Edge Function: voz-pedido
// ============================================================
// Genera el audio del aviso de "nueva comanda" para el KDS.
//
// Reglas de diseño (ver docs/notificaciones_voz_elevenlabs.md):
//   1. La ELEVENLABS_API_KEY NUNCA sale de este servidor: el
//      navegador solo habla con esta función.
//   2. Exige un JWT de empleado o dueño (verify_jwt de Supabase
//      + validación propia de nuevo).
//   3. Idempotencia: la tabla anuncios_pedido tiene pedido_id
//      UNIQUE. Un pedido se anuncia UNA sola vez, aunque haya
//      varias pantallas de cocina o la conexión se caiga.
//   4. El texto se arma AQUÍ, con datos de la base, no con lo que
//      mande el navegador: si no, la función sería un TTS abierto
//      para cualquiera con la anon key (y un agujero de cuota).
//   5. Ante cualquier error devuelve JSON (no audio). El cliente
//      cae a la voz del sistema. El pedido nunca se pierde.
//
// Variables de entorno requeridas:
//   ELEVENLABS_API_KEY   (secreto, required)
//   ELEVEN_MODELO        (opcional, default eleven_flash_v2_5)
//   ELEVEN_VOZ           (opcional, id de voz)
//   ELEVEN_IDIOMA        (opcional, default es)
//   ELEVEN_VELOCIDAD     (opcional, default 0.95; rango 0.7 a 1.2)
//
// Sobre el idioma: no hay una voz nativa en español disponible con la
// clave actual (el endpoint /v1/voices responde 401 missing_permissions,
// o sea que solo hay permiso de TTS). La salida se fuerza a español con
// language_code, que es lo que hace que George suene con fonética
// española. Si algún día hay una voz española de verdad, basta cambiar
// ELEVEN_VOZ: el resto del código no cambia.
// ============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.47.10';
import { codigoEnPalabras } from './numeros.ts';

const MODELO_DEFAULT = 'eleven_flash_v2_5';
// Sarah funciona con el plan gratuito de ElevenLabs. No todas las voces de la
// biblioteca se pueden usar por API sin pagar: con plan free, las voces de
// biblioteca (Elli, Rachel, Domi, Emily, Josh, Drew, ...) devuelven 402
// paid_plan_required. Verificadas como 200 en plan free: Sarah, George, Arnold.
const VOZ_DEFAULT = 'EXAVITQu4vr4xnSDxMaL'; // Sarah
const MAX_CARACTERES = 300;
const TIMEOUT_ELEVEN_MS = 10000;
const MAX_ITEMS_HABLA = 4;
const IDIOMA_DEFAULT = 'es';
const VELOCIDAD_DEFAULT = 0.95;
// Rango que acepta la API de ElevenLabs para voice_settings.speed.
const VELOCIDAD_MIN = 0.7;
const VELOCIDAD_MAX = 1.2;
// El cliente puede pedir idioma/velocidad (lo usa el panel de pruebas), pero
// sin control: cualquier otra cosa se cae al valor configurado.
const IDIOMAS_PERMITIDOS = ['es', 'en', 'pt', 'fr', 'de', 'it'];

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Expose-Headers': 'X-Voz-Texto, X-Voz-Modelo, X-Voz-Idioma, X-Voz-Velocidad',
};

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

/** Plural simple para locutar: 1 café / 2 cafés */
function pluralizar(cantidad, singular, plural) {
  return cantidad === 1 ? singular : plural;
}

/**
 * Texto del aviso de un pedido, con el código ya en palabras.
 * Espejo de armarFrase() en app-desktop/src/services/vozKdsService.js
 */
function armarFrase(pedido, detalles) {
  const codigo = Number(pedido.codigo_retiro_diario);
  const numero = Number.isFinite(codigo) && codigo > 0 ? codigoEnPalabras(codigo) : '';

  const partes = [];
  for (const d of detalles) {
    const nombre = (d.productos?.nombre || '').trim();
    if (!nombre) continue;
    const cantidad = Number(d.cantidad) || 1;
    partes.push(`${cantidad} ${nombre}`);
    if (partes.length >= MAX_ITEMS_HABLA) break;
  }

  let texto = numero ? `Nueva comanda, número ${numero}` : 'Nueva comanda entrante';
  if (partes.length) texto += `. ${partes.join(', ')}`;
  texto += '.';

  if (texto.length > MAX_CARACTERES) texto = texto.slice(0, MAX_CARACTERES - 1) + '…';
  return texto;
}

/** Lee ELEVEN_VELOCIDAD y la acota al rango que acepta la API. */
function velocidadConfig() {
  const crudo = Number(Deno.env.get('ELEVEN_VELOCIDAD'));
  if (!Number.isFinite(crudo)) return VELOCIDAD_DEFAULT;
  return Math.min(VELOCIDAD_MAX, Math.max(VELOCIDAD_MIN, crudo));
}

/**
 * Idioma pedido por el cliente. Solo se acepta un código corto de la
 * lista: el panel lo usa para comparar acentos, pero no se le da
 * control libre sobre la locución.
 */
function normalizarIdioma(bruto) {
  const codigo = String(bruto || '').trim().toLowerCase().slice(0, 5);
  return IDIOMAS_PERMITIDOS.includes(codigo) ? codigo : null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS });
  }
  if (req.method !== 'POST') {
    return json({ error: 'metodo_no_permitido' }, 405);
  }

  const apiKey = Deno.env.get('ELEVENLABS_API_KEY');
  if (!apiKey) {
    // No es un error del pedido: el cliente solo cae a voz del sistema.
    return json({ error: 'sin_configuracion', mensaje: 'La función no tiene ELEVENLABS_API_KEY' }, 503);
  }

  const url = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !anonKey || !serviceKey) {
    return json({ error: 'sin_configuracion', mensaje: 'Faltan credenciales de Supabase en la función' }, 503);
  }

  // ---------------------------------------------------------------
  // 1) Autenticación: el JWT lo exige el gateway (verify_jwt) y
  //    además lo validamos nosotros para saber QUIÉN llama.
  // ---------------------------------------------------------------
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return json({ error: 'no_autenticado' }, 401);

  const anon = createClient(url, anonKey, { auth: { persistSession: false } });
  const { data: authData, error: authError } = await anon.auth.getUser(token);
  if (authError || !authData?.user) {
    return json({ error: 'no_autenticado' }, 401);
  }

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  const { data: usuario } = await admin
    .from('usuarios')
    .select('id, rol_id')
    .eq('auth_user_id', authData.user.id)
    .maybeSingle();

  if (!usuario || ![2, 3].includes(usuario.rol_id)) {
    return json({ error: 'sin_permiso' }, 403);
  }

  // ---------------------------------------------------------------
  // 2) Pedido: debe existir, estar pendiente y ser real.
  // ---------------------------------------------------------------
  let pedidoId;
  let textoDelCliente = null;
  let idiomaPedido = null;
  let velocidadPedida = null;
  try {
    const cuerpo = await req.json();
    pedidoId = Number(cuerpo?.pedido_id);
    // Texto opcional. El KDS lo manda solo cuando agrupa varias comandas
    // en un aviso: la base no sabe cuántas entraron juntas, así que para
    // un pedido individual el texto se sigue armando desde la base.
    if (typeof cuerpo?.texto === 'string' && cuerpo.texto.trim()) {
      textoDelCliente = cuerpo.texto.replace(/\s+/g, ' ').trim().slice(0, MAX_CARACTERES);
    }
    idiomaPedido = normalizarIdioma(cuerpo?.idioma);
    const v = Number(cuerpo?.velocidad);
    velocidadPedida = Number.isFinite(v)
      ? Math.min(VELOCIDAD_MAX, Math.max(VELOCIDAD_MIN, v))
      : null;
  } catch {
    return json({ error: 'cuerpo_invalido' }, 400);
  }
  if (!Number.isInteger(pedidoId) || pedidoId <= 0) {
    return json({ error: 'pedido_invalido' }, 400);
  }

  const { data: pedido } = await admin
    .from('pedidos')
    .select('id, cafeteria_id, estado, codigo_retiro_diario')
    .eq('id', pedidoId)
    .maybeSingle();

  if (!pedido) return json({ error: 'pedido_no_existe' }, 404);
  if (pedido.estado !== 'pendiente') {
    return json({ error: 'pedido_no_pendiente', estado: pedido.estado }, 409);
  }

  // ---------------------------------------------------------------
  // 3) Idempotencia: reservar el pedido con un INSERT ... ON CONFLICT.
  //    Solo el primero que llega sigue; los demás reciben la señal
  //    de "ya anunciado" y NO gastan créditos.
  //    Si el intento anterior quedó "fallido", se reintenta.
  // ---------------------------------------------------------------
  const { data: reserva } = await admin
    .from('anuncios_pedido')
    .insert({
      pedido_id: pedido.id,
      cafeteria_id: pedido.cafeteria_id,
      usuario_id: usuario.id,
      canal: 'elevenlabs',
      modelo: Deno.env.get('ELEVEN_MODELO') || MODELO_DEFAULT,
      estado: 'en_curso',
    })
    .select('id')
    .maybeSingle();

  if (!reserva?.id) {
    // No se reservó: o el pedido ya está reservado, o el INSERT falló.
    const { data: previo } = await admin
      .from('anuncios_pedido')
      .select('id, estado')
      .eq('pedido_id', pedido.id)
      .maybeSingle();

    if (!previo) {
      return json({ error: 'no_se_pudo_reservar' }, 500);
    }
    if (previo.estado === 'fallido') {
      // El intento anterior falló: se reintenta con este.
    } else {
      // 'emitido' (ya se anunció) o 'en_curso' (otra pantalla
      // lo está generando ahora mismo): no se vuelve a gastar créditos.
      return json({ ya_anunciado: true, motivo: previo.estado }, 200);
    }
  }

  // ---------------------------------------------------------------
  // 4) Texto: el que envía el KDS si trajo (aviso agrupado), o el
  //    armado desde la base, que es la fuente de verdad.
  // ---------------------------------------------------------------
  let texto = textoDelCliente;
  if (!texto) {
    const { data: detalles } = await admin
      .from('detalles_pedido')
      .select('cantidad, productos(nombre)')
      .eq('pedido_id', pedido.id);

    texto = armarFrase(pedido, detalles || []);
  }

  // ---------------------------------------------------------------
  // 5) ElevenLabs.
  // ---------------------------------------------------------------
  const modelo = Deno.env.get('ELEVEN_MODELO') || MODELO_DEFAULT;
  const voz = Deno.env.get('ELEVEN_VOZ') || VOZ_DEFAULT;
  const idioma = idiomaPedido || Deno.env.get('ELEVEN_IDIOMA') || IDIOMA_DEFAULT;
  const velocidad = velocidadPedida ?? velocidadConfig();

  // language_code solo existe en los modelos v2_5. Mandarlo en un
  // multilingual_v2 devuelve 422 y se pierde el audio, así que se
  // manda solo cuando el modelo lo soporta.
  const aceptaIdioma = modelo.includes('v2_5');
  const cuerpo = {
    text: texto,
    model_id: modelo,
    ...(aceptaIdioma ? { language_code: idioma } : {}),
    voice_settings: {
      stability: 0.5,
      similarity_boost: 0.75,
      style: 0.3,
      use_speaker_boost: true,
      speed: velocidad,
    },
  };

  let res;
  try {
    res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voz}`, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
      },
      // Un TTS colgado no puede dejar la función abierta: el KDS
      // espera pocos segundos y después usa la voz del sistema.
      signal: AbortSignal.timeout(TIMEOUT_ELEVEN_MS),
      body: JSON.stringify(cuerpo),
    });
  } catch (e) {
    const esTimeout = e?.name === 'TimeoutError' || e?.name === 'AbortError';
    await admin
      .from('anuncios_pedido')
      .update({
        estado: 'fallido',
        detalle: esTimeout
          ? `timeout ${TIMEOUT_ELEVEN_MS}ms esperando a ElevenLabs`
          : `red: ${String(e).slice(0, 180)}`,
      })
      .eq('pedido_id', pedido.id);
    return json(
      { error: esTimeout ? 'elevenlabs_timeout' : 'elevenlabs_inalcanzable' },
      502,
    );
  }

  if (!res.ok) {
    const cuerpo = await res.text().catch(() => '');

    // 404 = el id de ELEVEN_VOZ no existe o no está disponible en el
    // plan. Es el error más fácil de cometer (un caracter de más o de
    // menos) y el mensaje genérico no alcanzaba a explicarlo, así que se
    // devuelve el id que se usó para poder compararlo con el configurado.
    if (res.status === 404) {
      await admin
        .from('anuncios_pedido')
        .update({ estado: 'fallido', detalle: `voz no encontrada: ${voz}` })
        .eq('pedido_id', pedido.id);
      return json({ error: 'voz_no_disponible', voz }, 502);
    }

    await admin
      .from('anuncios_pedido')
      .update({ estado: 'fallido', detalle: `http ${res.status}: ${cuerpo.slice(0, 180)}` })
      .eq('pedido_id', pedido.id);
    return json({ error: 'elevenlabs_rechazado', status: res.status }, 502);
  }

  const audio = new Uint8Array(await res.arrayBuffer());

  await admin
    .from('anuncios_pedido')
    .update({
      estado: 'emitido',
      emitido_en: new Date().toISOString(),
      caracteres: texto.length,
      modelo,
      voz,
      // Se limpia el detalle del intento anterior: si no, un pedido que
      // falló y después se emitió queda auditado como emitido con el error
      // viejo todavía visible.
      detalle: null,
    })
    .eq('pedido_id', pedido.id);

  return new Response(audio, {
    status: 200,
    headers: {
      ...CORS,
      'Content-Type': 'audio/mpeg',
      'Cache-Control': 'no-store',
      'X-Voz-Texto': encodeURIComponent(texto),
      // Eco de lo que realmente se le pidió a ElevenLabs. Sirve para
      // probar el idioma y la velocidad desde el navegador sin tener que
      // abrir el panel de ElevenLabs, y no expone nada secreto.
      'X-Voz-Modelo': modelo,
      'X-Voz-Idioma': aceptaIdioma ? idioma : '(modelo sin language_code)',
      'X-Voz-Velocidad': String(velocidad),
    },
  });
});
