/**
 * Regresión del atasco de la cola de voz.
 *
 * El fallo original: al detener el audio con pause() nunca llegaba el
 * evento 'onended', la promesa quedaba pendiente, _procesando se
 * quedaba en true y la voz moría en silencio para todos los pedidos
 * siguientes. Esta prueba interrumpe el audio a mitad de camino y
 * comprueba que el siguiente pedido igual se anuncia.
 *
 *   node docs_local/probar-cola-viva.mjs
 */
import { firefox } from 'playwright-core';
import { activarVoz } from './activar-voz.mjs';

const KDS = 'http://127.0.0.1:5173/#/empleado/comandas';
const PANEL = 'http://127.0.0.1:5173/prueba-voz.html';
const EMAIL = 'empleado@coffeefast.cl';
const CLAVE = '123456';

let fallos = 0;
const comprobar = (c, t) => {
  console.log(`  ${c ? 'ok   ' : 'FALLA'} ${t}`);
  if (!c) fallos++;
};

const navegador = await firefox.launch({
  executablePath: '/home/elias/.cache/ms-playwright/firefox-1549/firefox/firefox',
  headless: true,
  args: ['autoplay-policy=no-user-gesture-required'],
});
const ctx = await navegador.newContext();
const kds = await ctx.newPage();
const panel = await ctx.newPage();

const esperarMp3 = async (ms = 30_000) => {
  for (let i = 0; i < ms / 1000; i++) {
    await kds.waitForTimeout(1000);
    const n = await kds.evaluate(() => (window.__audios || []).filter((a) => a.mp3).length);
    if (n > 0) return n;
  }
  return 0;
};

try {
  await kds.goto(KDS, { waitUntil: 'domcontentloaded' });
  await kds.waitForTimeout(1500);
  if (await kds.locator('input[type="password"]').count()) {
    await kds.locator('input[type="text"]').first().fill(EMAIL);
    await kds.locator('input[type="password"]').first().fill(CLAVE);
    await kds.getByRole('button', { name: /Ingresar a Comandas/i }).click();
    await kds.waitForTimeout(3000);
  }
  await activarVoz(kds);
  await kds.waitForTimeout(1000);

  await kds.evaluate(() => {
    window.__audios = [];
    const playOriginal = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function play() {
      const reg = { mp3: true, el: this, terminado: false };
      this.addEventListener('ended', () => { reg.terminado = true; }, { once: true });
      window.__audios.push(reg);
      return playOriginal.apply(this, arguments);
    };
  });

  await panel.goto(PANEL, { waitUntil: 'domcontentloaded' });
  await panel.waitForTimeout(1200);

  // --- Aviso 1: se interrumpe con el botón del KDS ------------------
  console.log('\n1) Primer aviso, interrumpido con el botón del KDS');
  await panel.locator('#btnUna').click();
  comprobar((await esperarMp3()) > 0, 'el primer aviso arrancó');
  await kds.waitForTimeout(1200);
  const corte = await kds.evaluate(() => {
    const reg = window.__audios[window.__audios.length - 1];
    reg.el.pause();
    return { pausado: reg.el.paused, terminado: reg.terminado };
  });
  comprobar(corte.pausado === true, 'el audio quedó pausado a mitad');
  await kds.waitForTimeout(1200);
  comprobar(
    (await kds.evaluate(() => window.__audios[window.__audios.length - 1].terminado)) === false,
    'pause() NO marca el audio como terminado (el bug original)',
  );

  // Así se silencia en la app de verdad: el botón del KDS, que llama a
  // _detenerAudio() sobre un audio que sigue sonando.
  await activarVoz(kds, { silenciar: true });
  await kds.waitForTimeout(800);
  comprobar(await kds.locator('text=/Voz off/i').count() > 0, 'la barra pasó a "Voz off"');

  // force: true en los clics de la barra: el ripple de MUI se repinta
  // siempre y el botón nunca llega a estar "estable", así que la espera
  // de acción se agota. El clic sigue siendo real.
  // --- Aviso 2: entra con la voz silenciada ------------------------
  console.log('\n2) Segundo aviso con la voz silenciada');
  await panel.waitForTimeout(800);
  await panel.locator('#btnUna').click();
  await kds.waitForTimeout(4000);
  const enSilencio = await kds.evaluate(() => window.__audios.filter((a) => a.mp3).length);
  comprobar(enSilencio === 1, 'no se anuncia nada con la voz silenciada');
  comprobar(
    await kds.locator('text=/sin anunciar/i').count() > 0,
    'la barra avisa que hay pedidos sin anunciar',
  );

  // --- Aviso 3: al reactivar debe volver a funcionar ---------------
  console.log('\n3) Tercer aviso tras reactivar la voz');
  await activarVoz(kds);
  await kds.waitForTimeout(1000);
  await kds.evaluate(() => {
    window.__audios = [];
    const playOriginal = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function play() {
      window.__audios.push({ mp3: true, el: this, terminado: false });
      return playOriginal.apply(this, arguments);
    };
  });
  await panel.waitForTimeout(800);
  await panel.locator('#btnUna').click();
  comprobar((await esperarMp3()) > 0, 'vuelve a anunciar después de reactivar');

  // --- Aviso 4: y tras recargar la página --------------------------
  console.log('\n4) Cuarto aviso tras recargar el KDS');
  await kds.reload({ waitUntil: 'domcontentloaded' });
  await kds.waitForTimeout(2000);
  await activarVoz(kds);
  await kds.waitForTimeout(1000);
  await kds.evaluate(() => {
    window.__audios = [];
    const playOriginal = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function play() {
      window.__audios.push({ mp3: true, el: this, terminado: false });
      return playOriginal.apply(this, arguments);
    };
  });
  await panel.waitForTimeout(800);
  await panel.locator('#btnUna').click();
  comprobar((await esperarMp3()) > 0, 'vuelve a anunciar después de recargar');
} catch (e) {
  console.log(`  FALLA excepción: ${e.message.split('\n')[0]}`);
  fallos++;
} finally {
  await navegador.close();
}

console.log(`\n${fallos === 0 ? 'COLA SIEMPRE VIVA' : `${fallos} FALLO(S)`}`);
process.exit(fallos ? 1 : 0);
