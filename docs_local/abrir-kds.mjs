// ============================================================
// T16 · abrir-kds.mjs
// ============================================================
// Abre el KDS y el panel de pruebas en Firefox visible, con la sesión
// del empleado iniciada y la voz ya activada, y NO los cierra: es para
// que la persona lo pruebe con sus propias manos.
//
// A diferencia de ver-la-voz.mjs, acá no se crea ninguna comanda ni se
// limpia nada. Lo que se abre es exactamente lo que hay en producción.
//
// Uso: node docs_local/abrir-kds.mjs
// ============================================================

import { firefox } from 'playwright-core';
import { activarVoz } from './activar-voz.mjs';

const APP = 'http://localhost:5173';
const KDS = `${APP}/#/empleado/comandas`;
const PANEL = `${APP}/prueba-voz.html`;
const FIREFOX = '/home/elias/.cache/ms-playwright/firefox-1549/firefox/firefox';
const EMAIL = 'empleado@coffeefast.cl';
const CLAVE = '123456';

const log = (...a) => console.log(...a);

const navegador = await firefox.launch({
  executablePath: FIREFOX,
  headless: false,
  env: { ...process.env, MOZ_ENABLE_WAYLAND: '0' },
});
const ctx = await navegador.newContext({ viewport: { width: 1500, height: 940 } });

// --- KDS ---------------------------------------------------------------
const kds = await ctx.newPage();
await kds.goto(KDS, { waitUntil: 'domcontentloaded' });
await kds.waitForTimeout(3000);

// El login navega por hash, y con la página todavía montándose el clic a
// veces se pierde. Se reintenta y, si aun así no entra, se dice qué se
// vio en pantalla en vez de dejar un error de Playwright a medias.
let entro = false;
for (let intento = 1; intento <= 3 && !entro; intento++) {
  await kds.waitForSelector('input[placeholder="empleado@coffeefast.cl"]', { timeout: 10000 });
  await kds.locator('input[placeholder="empleado@coffeefast.cl"]').fill(EMAIL);
  await kds.locator('input[type="password"]').fill(CLAVE);
  await kds.getByRole('button', { name: /Ingresar a Comandas/i }).click({ force: true });
  try {
    await Promise.race([
      kds.waitForURL(/comandas/, { timeout: 15000 }),
      kds.waitForURL(new RegExp('empleado/comandas'), { timeout: 15000 }),
    ]).catch(async () => {});
    // debug
    try { log('[abrir] url tras click:', kds.url()); } catch {}
    await kds.waitForTimeout(1500);
    if (/comandas/.test(kds.url())) { entro = true; }

  } catch {
    const donde = kds.url().split('#')[1] || kds.url();
    const texto = (await kds.locator('body').innerText().catch(() => '')).slice(0, 120)
      .replace(/\n/g, ' ');
    log(`[abrir] intento ${intento}: no entró (en "${donde}") · ${texto}`);
  }
}
if (!entro) {
  log('[abrir] No se pudo iniciar sesión. Revisa que la app esté en :5173.');
  process.exit(1);
}
log('[abrir] sesión iniciada, el KDS cargó');

// --- Panel de pruebas, en otra pestaña ---------------------------------
const panel = await ctx.newPage();
await panel.goto(PANEL, { waitUntil: 'domcontentloaded' });
await panel.waitForSelector('#estado:has-text("Listo")', { timeout: 20000 });
log(`[abrir] panel: ${(await panel.locator('#estado').innerText()).trim()}`);

// --- La voz, que sin un clic previo el navegador no deja sonar --------
const estadoVoz = await activarVoz(kds);
log(`[abrir] voz: ${estadoVoz}`);

// --- Dejo el KDS adelante, que es donde se ve el aviso ----------------
await kds.bringToFront();
await kds.waitForTimeout(1200);

log('');
log('Listo para probar:');
log(`  KDS    ${KDS}`);
log(`  Panel  ${PANEL}   (segunda pestaña)`);
log('');
log('Para una comanda: en la pestaña del panel, "Crear 1 comanda" o');
log('"Crear 3 de golpe". El aviso tiene que sonar en la pestaña del KDS.');
log('Fijate en la barra de arriba del KDS: la voz queda en "Voz on".');
log('');
log('Si querés cortar el audio mientras suena, el mismo botón de la');
log('barra silencia y detiene lo que esté sonando.');
log('');
log('Este proceso queda vivo hasta que cierres la ventana del navegador.');

// No se cierra nada: la idea es que la persona pruebe tranquila.
await new Promise(() => {});
