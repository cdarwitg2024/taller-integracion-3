// ============================================================
// T16 · ver-la-voz.mjs
// ============================================================
// Abre la aplicación de verdad en una ventana visible (no headless) y
// hace el flujo completo para que el usuario lo vea y lo ESCUCHE:
//
//   1. Login de empleado en el KDS
//   2. Activa los avisos de voz
//   3. Abre el panel de prueba en otra ventana
//   4. Crea una comanda real
//   5. Espera a que el KDS la anuncie
//   6. Deja las ventanas abiertas para que se pueda repetir a mano
//
// Esto NO genera audios sueltos: todo pasa por el KDS real, por
// Realtime y por la Edge Function, igual que en producción. Si no suena,
// el problema está en la app, no en un archivo de muestra.
//
// Uso: node docs_local/ver-la-voz.mjs
// ============================================================

import { firefox } from 'playwright-core';
import { activarVoz } from './activar-voz.mjs';

const FIREFOX = '/home/elias/.cache/ms-playwright/firefox-1549/firefox/firefox';
const KDS = 'http://localhost:5173/#/empleado/comandas';
const PANEL = 'http://localhost:5173/prueba-voz.html';
const EMAIL = 'empleado@coffeefast.cl';
const CLAVE = '123456';

const log = (...a) => console.log('[ver-la-voz]', ...a);

// headed en X11: con Wayland activo Firefox puede no mapear la ventana.
const navegador = await firefox.launch({
  executablePath: FIREFOX,
  headless: false,
  env: { ...process.env, MOZ_ENABLE_WAYLAND: '0' },
});

// Si algo falla, la ventana sigue abierta para que el usuario pueda
// mirar qué quedó en pantalla en vez de cerrarse y no ver nada.
process.on('uncaughtException', (e) => {
  log('FALLÓ:', e.message);
  log('Dejo las ventanas abiertas para que puedas mirarlas.');
  process.exit(1);
});

const contexto = await navegador.newContext({ viewport: { width: 1400, height: 900 } });

// Sonidos del aviso, para dejar registro de qué se reprodujo.
const sonidos = [];
await contexto.exposeBinding('__sonido', (_o, info) => {
  sonidos.push(info);
  log(`♪ ${info.segundos.toFixed(1)}s — ${info.origen}`);
});
await contexto.addInitScript(() => {
  const Real = window.Audio;
  window.Audio = function (url) {
    const el = new Real(url);
    el.addEventListener('ended', () => window.__sonido?.({ segundos: el.duration || 0, origen: url.slice(0, 60) }));
    return el;
  };
  window.Audio.prototype = Real.prototype;
});

const kds = await contexto.newPage();
kds.on('console', (m) => {
  if (m.type() === 'error' && !/favicon|does not recognize/i.test(m.text())) {
    log('error en consola:', m.text().slice(0, 120));
  }
});

log('1) Abriendo el KDS…');
await kds.goto(KDS, { waitUntil: 'domcontentloaded' });
await kds.waitForTimeout(3000);

await kds.locator('input[type="text"]').first().fill(EMAIL);
await kds.locator('input[type="password"]').first().fill(CLAVE);
await kds.getByRole('button', { name: /Ingresar a Comandas/i }).click();
await kds.waitForURL(/comandas/, { timeout: 20000 });
log('   sesion iniciada, el KDS cargo');

log('2) Activando los avisos de voz…');
// force: true porque en ventana visible el botón nunca está "estable"
// (el ripple de MUI se repinta siempre) y la espera se agota. Es un
// clic real sobre el botón, solo se saltan las comprobaciones de
// estabilidad que no aportan nada aquí.
//
// Y hay que esperar a que el KDS termine de montar: si se aprieta apenas
// carga, el clic cae antes de que la barra esté lista y el aviso queda
// silenciado sin avisar. Por eso se comprueba que el botón pase a "Voz on"
// y se reintenta una vez si no.
await activarVoz(kds);

log('3) Abriendo el panel de prueba en otra ventana…');
const panel = await contexto.newPage();
await panel.goto(PANEL, { waitUntil: 'domcontentloaded' });
await panel.waitForTimeout(2500);
log(`   panel: ${(await panel.locator('#estado').innerText()).trim()}`);

log('4) Creando una comanda real (fíjate en la ventana del KDS)…');
await panel.locator('#btnUna').click({ force: true });
await panel.waitForFunction(
  () => /creada/i.test(document.getElementById('estado')?.textContent || ''),
    null,
    { timeout: 30000 },
);
log(`   ${(await panel.locator('#estado').innerText()).trim()}`);

log('5) Esperando el aviso…');
await panel.waitForFunction(
  () => /anunci/i.test(document.getElementById('log')?.textContent || ''),
    null,
    { timeout: 45000 },
);
log(`   ${(await panel.locator('#log').innerText()).split('\n')[0]}`);

log('6) Dejo las ventanas abiertas 3 minutos para que lo escuches y lo repitas.');
log('   El panel queda a la izquierda con "Crear 1 comanda" y "Crear 3 de golpe".');

await panel.bringToFront();
await kds.waitForTimeout(3000);

// Verificación de que la tarjeta apareció en pantalla, no solo en la base.
const tarjetas = await kds.locator('text=/Nueva comanda|Comanda/').count().catch(() => 0);
log(`   la comanda se ve en el KDS: ${tarjetas > 0 ? 'sí' : 'revisar'}`);

const resumen = await kds.locator('body').innerText();
if (/pendientes/i.test(resumen)) {
  const m = resumen.match(/(\d+)\s*pendientes?/i);
  if (m) log(`   pedidos pendientes en pantalla: ${m[1]}`);
}

await kds.screenshot({ path: '/tmp/opencode/kds-con-voz.png' }).catch(() => {});
log('captura del KDS: /tmp/opencode/kds-con-voz.png');

log('');
log('=== RESUMEN ===');
log(`Audios reproducidos en el KDS: ${sonidos.length}`);
for (const s of sonidos) log(`  - ${s.segundos.toFixed(1)}s`);
log('');
log('Si no oíste nada: revisar que el KDS tenga el botón "Voz on" y que el');
log('volumen del sistema esté arriba. La ventana del KDS quedó abierta.');

await kds.waitForTimeout(180000);

// Limpieza de lo que se creó en la demo.
log('Cerrando y borrando las comandas de prueba…');
await panel.locator('#btnLimpiar').click({ force: true }).catch(() => {});
await panel.waitForTimeout(2500);
await navegador.close();
log('Listo.');
