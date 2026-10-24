/**
 * Pruebas de la capa de sesión y del atajo de login.
 *
 * Fallo que se reproducía: con el login de desarrollo
 * (empleado@coffeefaster.cl / 123456) se entraba al KDS SIN sesión de
 * Supabase, la función de voz no se podía llamar y el aviso caía a la
 * voz del sistema, que en este equipo no dice nada. Resultado: pedidos
 * entrando y silencio total, sin explicación útil.
 *
 *   node docs_local/probar-sesion.mjs
 */
import { firefox } from 'playwright-core';
import { activarVoz } from './activar-voz.mjs';

const BASE = 'http://127.0.0.1:5173';
const KDS = `${BASE}/#/empleado/comandas`;
const PANEL = `${BASE}/prueba-voz.html`;
const REAL = { email: 'empleado@coffeefast.cl', pass: '123456' };
const FALSO = { email: 'empleado@coffeefaster.cl', pass: '123456' };

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

const intentarLogin = async (credenciales) => {
  const ctx = await navegador.newContext();
  const p = await ctx.newPage();
  await p.goto(`${BASE}/#/login/empleado`, { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(1200);
  await p.locator('input[type="text"]').first().fill(credenciales.email);
  await p.locator('input[type="password"]').first().fill(credenciales.pass);
  await p.getByRole('button', { name: /Ingresar a Comandas/i }).click();
  await p.waitForTimeout(3000);
  // supabase-js guarda la sesión en localStorage; se lee desde ahí para
  // no depender de exponer el cliente en window.
  const sesion = await p.evaluate(() => {
    const clave = Object.keys(localStorage).find((k) => k.includes('auth-token'));
    if (!clave) return false;
    try {
      const v = JSON.parse(localStorage.getItem(clave));
      return Boolean(v?.access_token);
    } catch {
      return false;
    }
  });
  return { ctx, p, sesion, url: p.url() };
};

try {
  // --- 1. El login de ejemplo ya no debe entrar --------------------
  console.log('\n1) Login con la cuenta de ejemplo (no existe en Auth)');
  const malo = await intentarLogin(FALSO);
  comprobar(malo.sesion === false, 'no se creó una sesión de Supabase');
  comprobar(/login/.test(malo.url), `sigue en el login (${malo.url.split('#')[1] || malo.url})`);
  const texto = await malo.p.locator('body').innerText();
  const errorVisible = /incorrecto|denegado|credenciales|inválid/i.test(texto);
  const kdsVisible = await malo.p.locator('text=/Voz on|Silenciar avisos/i').count();
  comprobar(errorVisible, 'la pantalla de login muestra el error de credenciales');
  comprobar(kdsVisible === 0, 'no se entra al KDS sin sesión');
  await malo.ctx.close();

  // --- 2. La cuenta real sí entra y tiene sesión --------------------
  console.log('\n2) Login con la cuenta real');
  const bueno = await intentarLogin(REAL);
  comprobar(bueno.sesion === true, 'hay sesión de Supabase');
  comprobar(/comandas/.test(bueno.url), `el KDS cargó (${bueno.url.split('#')[1]})`);

  // --- 3. Con sesión, la voz avisa ----------------------------------
  console.log('\n3) Con sesión real, el aviso funciona');
  await activarVoz(bueno.p);
  await bueno.p.evaluate(() => {
    window.__audios = [];
    const playOriginal = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function play() {
      window.__audios.push(this.src);
      return playOriginal.apply(this, arguments);
    };
  });
  const panel = await bueno.ctx.newPage();
  await panel.goto(PANEL, { waitUntil: 'domcontentloaded' });
  await panel.waitForSelector('#estado:has-text("Listo")', { timeout: 15000 });
  await panel.locator('#btnUna').click();
  let sonó = 0;
  for (let i = 0; i < 40; i++) {
    await bueno.p.waitForTimeout(1000);
    sonó = await bueno.p.evaluate(() => window.__audios.length);
    if (sonó > 0) break;
  }
  const estadoPanel = (await panel.locator('#estado').textContent())?.trim() || '';
  console.log(`     (el panel dice: "${estadoPanel}")`);
  // Antes solo aceptaba el mensaje de creación. Como el panel ahora
  // espera a que el aviso llegue a un estado final, #estado puede quedar
  // con "Anunciado con la voz ...", que es una confirmación más fuerte:
  // si hay aviso, la comanda está creada y se anunció.
  comprobar(
    /cread|pedido|comanda|anunc|ok/i.test(estadoPanel),
    'el panel confirma la comanda',
  );
  comprobar(sonó > 0, `sonó el MP3 de ElevenLabs (${sonó} reproducción(es))`);
  comprobar(
    !(await bueno.p.locator('text=/Sin sesión/i').count()),
    'la barra NO dice "sin sesión"',
  );

  // --- 4. Sin sesión, avisa en vez de quedarse mudo ------------------
  console.log('\n4) Sin sesión: el aviso debe explicar el motivo');
  const sinSesion = await navegador.newContext();
  const p2 = await sinSesion.newPage();
  await p2.goto(`${BASE}/#/empleado/comandas`, { waitUntil: 'domcontentloaded' });
  await p2.waitForTimeout(2500);
  const enLogin = /login/.test(p2.url());
  console.log(`     (el KDS redirigió al login: ${enLogin})`);
  comprobar(
    enLogin || (await p2.locator('text=/Sin sesión/i').count()) > 0,
    'sin sesión no queda el KDS mudo: manda al login',
  );
  await sinSesion.close();
  await bueno.ctx.close();
} catch (e) {
  console.log(`  FALLA excepción: ${e.message.split('\n')[0]}`);
  fallos++;
} finally {
  await navegador.close();
}

console.log(`\n${fallos === 0 ? 'SESIÓN CORRECTA' : `${fallos} FALLO(S)`}`);
process.exit(fallos ? 1 : 0);
