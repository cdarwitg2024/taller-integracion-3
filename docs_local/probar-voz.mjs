/**
 * Prueba automática del aviso de voz del KDS (T14).
 *
 * Abre el KDS en un navegador, inicia sesión, activa la voz, crea un pedido
 * y comprueba que el MP3 de ElevenLabs se reprodujo. Sirve para no depender
 * de que alguien esté mirando la pantalla.
 *
 *   node docs_local/probar-voz.mjs
 *
 * Requiere: dev server en 5173, Supabase local en 54321 y el runtime de la
 * Edge Function con ELEVENLABS_API_KEY cargada.
 */
import { firefox } from 'playwright-core';
import { activarVoz } from './activar-voz.mjs';

const KDS = 'http://127.0.0.1:5173/#/empleado/comandas';
const PANEL = 'http://127.0.0.1:5173/prueba-voz.html';
const EMAIL = 'empleado@coffeefast.cl';
const CLAVE = '123456';

const log = (...a) => console.log(...a);
const ok = (t) => log(`  ok   ${t}`);
const mal = (t) => log(`  FALLA ${t}`);

const navegador = await firefox.launch({
  executablePath: '/home/elias/.cache/ms-playwright/firefox-1549/firefox/firefox',
  headless: true,
  args: ['autoplay-policy=no-user-gesture-required'],
});

const ctx = await navegador.newContext();
const pagina = await ctx.newPage();
const errores = [];
pagina.on('pageerror', (e) => errores.push(String(e)));
pagina.on('console', (m) => {
  if (m.type() === 'error') errores.push(m.text());
});

let fallos = 0;
const comprobar = (cond, texto) => (cond ? ok(texto) : (mal(texto), fallos++));

try {
  // --- 1. Sesión en el KDS -------------------------------------------
  log('\n1) Iniciando sesión en el KDS');
  await pagina.goto(KDS, { waitUntil: 'domcontentloaded' });
  await pagina.waitForTimeout(1500);

  const tieneLogin = await pagina.locator('input[type="password"]').count();
  if (tieneLogin) {
    // El campo de correo es type="text", no type="email": se toma el
    // primero que no sea el de la contraseña.
    const correo = pagina.locator('input[type="text"]').first();
    await correo.fill(EMAIL);
    await pagina.locator('input[type="password"]').first().fill(CLAVE);
    await pagina.getByRole('button', { name: /Ingresar a Comandas/i }).click();
    await pagina.waitForTimeout(3000);
  }
  comprobar(await pagina.locator('text=/Terminal de Cocina|Cocina Central/i').count() > 0,
    'el KDS cargó');

  // --- 2. Activar la voz ---------------------------------------------
  log('\n2) Activando los avisos de voz');
  if (await pagina.getByRole('button', { name: /Activar voz/i }).count()) {
    await activarVoz(pagina);
  }
  comprobar(await pagina.locator('text=/Voz on/i').count() > 0, 'la barra muestra "Voz on"');

  // --- 3. Instrumentar el audio --------------------------------------
  log('\n3) Espiando las reproducciones');
  await pagina.evaluate(() => {
    window.__audios = [];
    const original = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function play() {
      const el = this;
      const rec = { mp3: String(el.src).startsWith('blob:'), dur: null, ok: false };
      el.addEventListener('loadedmetadata', () => { rec.dur = el.duration; }, { once: true });
      el.addEventListener('ended', () => { rec.ok = true; }, { once: true });
      window.__audios.push(rec);
      return original.apply(this, arguments);
    };
    window.__fallback = [];
    const hablar = window.speechSynthesis.speak.bind(window.speechSynthesis);
    window.speechSynthesis.speak = (u) => {
      window.__fallback.push(String(u.text).slice(0, 80));
      return hablar(u);
    };
  });

  // --- 4. Crear el pedido desde el panel ------------------------------
  log('\n4) Creando una comanda desde el panel');
  const panel = await ctx.newPage();
  await panel.goto(PANEL, { waitUntil: 'domcontentloaded' });
  await panel.waitForTimeout(1200);

  const estadoInicial = (await panel.locator('#estado').textContent())?.trim() || '';
  comprobar(/Supabase configurado/i.test(estadoInicial),
    `el panel arrancó bien ("${estadoInicial}")`);

  await panel.locator('#btnUna').click();
  log('  creando el pedido…');

  // --- 5. Esperar el anuncio -----------------------------------------
  log('\n5) Esperando el aviso (máx 30 s)');
  let audios = [];
  for (let i = 0; i < 30; i++) {
    await pagina.waitForTimeout(1000);
    audios = await pagina.evaluate(() => window.__audios);
    if (audios.some((a) => a.mp3)) break;
  }
  const mp3 = audios.filter((a) => a.mp3);
  const fallbacks = await pagina.evaluate(() => window.__fallback);

  if (mp3.length) {
    const a = mp3[0];
    comprobar(a.dur > 0.5, `se reprodujo el MP3 de ElevenLabs (${Number(a.dur).toFixed(2)} s)`);

    // El audio acaba de empezar: hay que esperar a que termine antes de
    // mirar el evento 'ended', si no la prueba falla sola.
    for (let i = 0; i < 25 && !audios[audios.length - 1].ok; i++) {
      await pagina.waitForTimeout(1000);
      audios = await pagina.evaluate(() => window.__audios);
    }
    const ultima = audios.filter((x) => x.mp3).pop();
    comprobar(ultima.ok, 'el audio llegó hasta el final sin cortarse');
  } else {
    mal('no se reprodujo ningún MP3');
  }
  comprobar(fallbacks.length === 0,
    fallbacks.length ? `cayó a la voz del sistema: "${fallbacks[0]}"` : 'no se usó la voz del sistema');

  // --- 6. Estado en la barra del KDS ---------------------------------
  const barra = (await pagina.locator('body').innerText()).split('\n');
  const diag = barra.find((l) => /ElevenLabs|vaz del sistema|no pudo/i.test(l));
  if (diag) log(`  aviso en la barra: ${diag.trim()}`);

  const erroresRelevantes = errores.filter((e) => !/favicon|Download the React DevTools/i.test(e));

  // Los warnings de React del tipo "does not recognize the X prop" no son
  // fallos de T16: los produce el markup del login que escribió upstream
  // (un alignItems que llega al DOM dentro de un Button). Antes de esta
  // separación cualquier warning ajeno daba la prueba por fallida y tapaba
  // el resultado real del audio. Se siguen mostrando, pero no tumban la
  // prueba; los errores de T16 (voz-pedido / vozKdsService) sí la tumban.
  const esWarningDeProps = (t) => /does not recognize the .* prop on a DOM element/i.test(t);
  const warningsAjenos = erroresRelevantes.filter(esWarningDeProps);
  const erroresReales = erroresRelevantes.filter((t) => !esWarningDeProps(t));

  if (warningsAjenos.length) {
    log(`   (aviso, no falla) ${warningsAjenos.length} warning(s) de React de props sobre DOM:`);
    log(`     ${warningsAjenos[0].slice(0, 110)}...`);
  }

  comprobar(erroresReales.length === 0,
    erroresReales.length ? `errores en consola: ${erroresReales[0]}` : 'sin errores en consola');
} catch (e) {
  mal(`excepción: ${e.message.split('\n')[0]}`);
  fallos++;
} finally {
  await navegador.close();
}

log(`\n${fallos === 0 ? 'TODO OK' : `${fallos} FALLO(S)`}`);
process.exit(fallos ? 1 : 0);
