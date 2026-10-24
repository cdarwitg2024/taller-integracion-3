// ============================================================
// T16 · probar-idioma.mjs
// ============================================================
// Comprueba que el aviso sale en español y con los códigos leídos por
// parejas, y que a ElevenLabs se le manda lo que se cree mandar.
//
// La parte importante no es que suene español (eso hay que escucharlo),
// sino que el request salga con language_code: 'es' y speed 0.95. Si
// esos campos no van, la voz suena con el acento que quiera el modelo y
// la prueba de audio "pasa" igual mientras el pedido está mal.
//
// Para eso intercepta la llamada a la Edge Function con page.route y
// copia el cuerpo antes de dejarla pasar, en vez de confiar en lo que
// el navegador dice que envió.
//
// Uso: node docs_local/probar-idioma.mjs
// ============================================================

import { firefox } from 'playwright-core';
import { activarVoz } from './activar-voz.mjs';

const URL_KDS = 'http://127.0.0.1:5173/#/empleado/comandas';
const URL_PANEL = 'http://127.0.0.1:5173/prueba-voz.html';
const FIREFOX = '/home/elias/.cache/ms-playwright/firefox-1549/firefox/firefox';
const EMAIL = 'empleado@coffeefast.cl';
const CLAVE = '123456';

const log = (...a) => console.log(...a);
let fallos = 0;
function comprobar(ok, descripcion, detalle = '') {
  if (ok) {
    log(`  ok   ${descripcion}`);
  } else {
    fallos++;
    log(`  FALLA ${descripcion}${detalle ? ` — ${detalle}` : ''}`);
  }
}

const navegador = await firefox.launch({ executablePath: FIREFOX, headless: true });
const contexto = await navegador.newContext();
const pagina = await contexto.newPage();

// Todo lo que se manda a la función queda registrado acá.
const cuerpos = [];
const respuestas = [];
await contexto.route('**/functions/v1/voz-pedido', async (ruta) => {
  // continue() no devuelve la respuesta, así que se hace fetch() y se
  // reenvía con fulfill(): así se puede leer el cuerpo enviado y las
  // cabeceras que la función arma después de hablar con ElevenLabs.
  const respuesta = await ruta.fetch();
  const cab = respuesta.headers();
  await ruta.fulfill({ response: respuesta });

  let cuerpo = null;
  try {
    cuerpo = ruta.request().postDataJSON();
    cuerpos.push(cuerpo);
  } catch {
    // Sin cuerpo JSON (por ejemplo un OPTIONS): se sigue igual.
  }

  respuestas.push({
    cuerpo,
    eco: {
      estado: respuesta.status(),
      modelo: cab['x-voz-modelo'] || null,
      idioma: cab['x-voz-idioma'] || null,
      velocidad: cab['x-voz-velocidad'] || null,
      textoEnviado: cab['x-voz-texto'] ? decodeURIComponent(cab['x-voz-texto']) : null,
    },
  });

  if (cuerpo) {
    log(`   (enviado) pedido_id=${cuerpo.pedido_id} idioma=${cuerpo.idioma ?? '(sin envío)'} velocidad=${cuerpo.velocidad ?? '(sin envío)'}`);
    if (cuerpo.texto) log(`             texto="${String(cuerpo.texto).slice(0, 70)}"`);
    log(`   (devuelto ${respuesta.status()}) idioma aplicado=${cab['x-voz-idioma'] || '(n/a)'} velocidad=${cab['x-voz-velocidad'] || '(n/a)'}`);
  }
});

// Reproducciones de audio dentro de la página del panel.
const reproducciones = [];
await contexto.exposeBinding('__registrarAudio', (_origen, duracion) => {
  reproducciones.push(duracion);
});
await pagina.addInitScript(() => {
  const Original = window.Audio;
  window.Audio = function (url) {
    const el = new Original(url);
    el.addEventListener('ended', () => window.__registrarAudio?.(el.duration || 0));
    return el;
  };
  window.Audio.prototype = Original.prototype;
});

try {
  log('1) Entrando al KDS con la cuenta real');
  await pagina.goto(URL_KDS, { waitUntil: 'domcontentloaded' });
  await pagina.waitForTimeout(2500);
  await pagina.locator('input[type="text"]').first().fill(EMAIL);
  await pagina.locator('input[type="password"]').first().fill(CLAVE);
  await pagina.getByRole('button', { name: /Ingresar a Comandas/i }).click();
  await pagina.waitForURL(/comandas/, { timeout: 20000 });
  comprobar(true, 'el KDS cargó con sesión');

  log('\n2) Activando los avisos de voz');
  await activarVoz(pagina);

  log('\n3) Creando una comanda desde el panel');
  const panel = await contexto.newPage();
  await panel.goto(URL_PANEL, { waitUntil: 'domcontentloaded' });
  await panel.waitForTimeout(2500);
  comprobar(/Listo/i.test(await panel.locator('#estado').innerText()), 'el panel arrancó bien');

  await panel.locator('#btnUna').click();
  await panel.waitForTimeout(1000);
  await panel.waitForFunction(
    () => /creada|creado/i.test(document.getElementById('estado')?.textContent || ''),
    null,
    { timeout: 30000 },
  );
  comprobar(true, 'el pedido se creó');

  log('\n4) Esperando que el KDS lo anuncie');
  // Más patience que el panel (esperarAnuncio usa 40 s): si el test se
  // rinde antes, falla por reloj y no por culpa del KDS.
  await panel.waitForFunction(
    () => /lo anunci|lo intent|sigue sin aparecer|No pude verificar/i.test(document.getElementById('log')?.textContent || ''),
    null,
    { timeout: 90000 },
  );
  await panel.waitForTimeout(1500);

  comprobar(cuerpos.length > 0, 'el KDS llamó a la Edge Function',
    'no hubo ninguna llamada');
  comprobar(reproducciones.length > 0, 'sonó el audio en el navegador',
    'no se registró ninguna reproducción');

  log('\n5) Lo que se le pidió a ElevenLabs');
  const cuerpo = cuerpos[cuerpos.length - 1] || {};
  const enPalabras = String(cuerpo.texto || '');

  if (cuerpos.length) {
    // El texto lo arma el servidor cuando el aviso no es agrupado, así que
    // acá se mira el código que el panel generó, no el texto enviado.
    const codigo = (await panel.locator('#log').innerText()).match(/código (\d+)/i);
    const esperado = codigo ? codigo[1] : null;
    if (esperado) {
      const digitos = esperado.length;
      log(`   el panel generó el código ${esperado} (${digitos} dígitos)`);
      comprobar(digitos >= 3, 'el código de prueba tiene 3+ dígitos (se lee por parejas)');
    } else {
      comprobar(false, 'se pudo leer el código del panel', 'no apareció en el log');
    }
  }

  // El idioma forzado y la velocidad viajan como variables de entorno del
  // servidor, no en el cuerpo: el cliente no los manda en el flujo normal.
  // Lo que se puede comprobar desde acá es que la función Acepte el
  // override cuando se le pide (lo usa el panel de texto libre).
  log('\n6) Override de idioma y velocidad (lo que usa el panel de texto libre)');
  const panelConTexto = await contexto.newPage();
  await panelConTexto.goto(URL_PANEL, { waitUntil: 'domcontentloaded' });
  await panelConTexto.waitForTimeout(2500);

  await panelConTexto.locator('#txtHablar').fill('Nueva comanda, número siete veintisiete. 2 cafés.');
  await panelConTexto.locator('#selIdioma').selectOption('es');
  await panelConTexto.locator('#rngVelocidad').fill('0.85');
  await panelConTexto.locator('#rngVelocidad').dispatchEvent('input');
  comprobar(
    (await panelConTexto.locator('#lblVelocidad').innerText()) === '0.85',
    'el panel muestra la velocidad elegida',
  );

  const antes = cuerpos.length;
  await panelConTexto.locator('#btnHablar').click();
  await panelConTexto.waitForFunction(
    () => /sonando|ERROR/i.test(document.getElementById('logHablar')?.textContent || ''),
    null,
    { timeout: 60000 },
  );
  let logHablar = await panelConTexto.locator('#logHablar').innerText();
  comprobar(/sonando/i.test(logHablar), 'el panel reprodujo el audio pedido',
    logHablar.split('\n').slice(0, 2).join(' | '));

  // El borrado de la comanda descartable se escribe después del "Sonando",
  // así que se espera explícitamente en vez de leer el log a ciegas.
  await panelConTexto.waitForFunction(
    () => /borrada/i.test(document.getElementById('logHablar')?.textContent || ''),
    null,
    { timeout: 20000 },
  ).catch(() => {});
  logHablar = await panelConTexto.locator('#logHablar').innerText();
  comprobar(cuerpos.length > antes, 'la función recibió el texto libre');

  const libre = [...cuerpos].reverse().find((c) => c?.idioma) || {};
  comprobar(libre.idioma === 'es', 'el idioma enviado es "es"', `fue "${libre.idioma}"`);
  comprobar(Math.abs(Number(libre.velocidad) - 0.85) < 0.001, 'la velocidad enviada es 0.85',
    `fue ${libre.velocidad}`);

  log('\n7) El camino real del KDS usa los valores por defecto');
  // El KDS no manda idioma ni velocidad: los saca de ELEVEN_IDIOMA y
  // ELEVEN_VELOCIDAD. Si el aviso normal saliera en otro idioma, el
  // override del panel de pruebas lo taparía y nadie se enteraría.
  const delKds = respuestas.find((r) => r.cuerpo && !r.cuerpo.idioma && r.eco?.idioma);
  comprobar(Boolean(delKds), 'hubo una respuesta del aviso normal del KDS');
  if (delKds) {
    comprobar(delKds.eco.idioma === 'es', 'el aviso normal sale en español',
      `fue "${delKds.eco.idioma}"`);
    comprobar(Math.abs(Number(delKds.eco.velocidad) - 0.95) < 0.001,
      'el aviso normal sale a velocidad 0.95', `fue ${delKds.eco.velocidad}`);
    if (delKds.eco.textoEnviado) {
      log(`   texto del aviso: "${delKds.eco.textoEnviado.slice(0, 80)}"`);
      comprobar(/número (\d)/.test(delKds.eco.textoEnviado) === false,
        'el código va en palabras, no en dígitos', `dice "${delKds.eco.textoEnviado.slice(0, 40)}"`);
      comprobar(/número [a-záéíóúñ]/i.test(delKds.eco.textoEnviado),
        'el texto del aviso trae el código escrito', `dice "${delKds.eco.textoEnviado.slice(0, 40)}"`);
    }
  }

  log('\n8) Lo que la función dice que le mandó a ElevenLabs');
  // Las cabeceras X-Voz-* las arma la función después de llamar a ElevenLabs,
  // así que son el único lugar donde se puede ver el idioma y la velocidad
  // reales. Si acá no fuera 'es', el panel no serviría para comparar acentos.
  const conAudio = respuestas.filter((r) => r.eco?.idioma && r.eco.idioma !== '(modelo sin language_code)');
  const ultima = conAudio[conAudio.length - 1];
  comprobar(Boolean(ultima), 'hubo una respuesta con audio y texto libre');
  if (ultima) {
    log(`   modelo=${ultima.eco.modelo} idioma=${ultima.eco.idioma} velocidad=${ultima.eco.velocidad}`);
    comprobar(ultima.eco.idioma === 'es', 'ElevenLabs recibió language_code: "es"',
      `fue "${ultima.eco.idioma}"`);
    comprobar(Math.abs(Number(ultima.eco.velocidad) - 0.85) < 0.001,
      'ElevenLabs recibió la velocidad 0.85', `fue ${ultima.eco.velocidad}`);
    comprobar(/flash_v2_5/.test(ultima.eco.modelo || ''),
      'el modelo soporta language_code (v2_5)', `fue "${ultima.eco.modelo}"`);
  }

  log('\n9) La comanda descartable se borró');
  comprobar(/borrada/i.test(logHablar), 'el panel limpió la comanda de prueba');
} catch (e) {
  fallos++;
  log(`  FALLA excepción: ${e.message || e}`);
} finally {
  await navegador.close();
}

log('');
if (fallos === 0) {
  log('IDIOMA OK');
} else {
  log(`${fallos} FALLO(S)`);
  process.exitCode = 1;
}
