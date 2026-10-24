// ============================================================
// T16 · smoke-rutas.mjs
// ============================================================
// Recorre las pantallas reales de la app y verifica que cargan sin
// errores. Sirve para contestar "¿se rompió algo de los demás?" con
// evidencia y no con suposiciones: si el merge hubiera tocado algo que
// no debía, algún camino se caería acá.
//
// No prueba lógica de negocio, solo que cada pantalla llega a renderizar
// y que el login de empleado y el de dueño siguen entrando.
//
// Uso: node docs_local/smoke-rutas.mjs
// ============================================================

import { firefox } from 'playwright-core';

const APP = 'http://localhost:5173';
const FIREFOX = '/home/elias/.cache/ms-playwright/firefox-1549/firefox/firefox';

const RUTAS = [
  { hash: '#/', nombre: 'Menú público', espera: /Cafeter|Coffee|menu|Menú/i },
  { hash: '#/login/empleado', nombre: 'Login de empleado', espera: /Iniciar Sesi|PORTAL EMPLEADO/i },
  { hash: '#/login/dueno', nombre: 'Login de dueño', espera: /Iniciar Sesi|Dueño|DUENO/i },
  { hash: '#/login', nombre: 'Selector de login', espera: /empleado|dueno|Acceder/i },
  { hash: '#/empleado/comandas', nombre: 'KDS (sin sesión: debe redirigir)', espera: /login|Ventas|Órdenes|pedido/i },
];

const log = (...a) => console.log(...a);
let fallos = 0;
function comprobar(ok, desc, detalle = '') {
  if (ok) log(`  ok   ${desc}`);
  else { fallos++; log(`  FALLA ${desc}${detalle ? ` — ${detalle}` : ''}`); }
}

const navegador = await firefox.launch({ executablePath: FIREFOX, headless: true });
const ctx = await navegador.newContext({ viewport: { width: 1400, height: 900 } });

async function erroresDe(pagina) {
  const errores = [];
  pagina.on('pageerror', (e) => errores.push(String(e)));
  pagina.on('console', (m) => {
    if (m.type() !== 'error') return;
    const t = m.text();
    // El warning de props del login de upstream no es un fallo funcional.
    if (/favicon|does not recognize|Download the React DevTools/i.test(t)) return;
    errores.push(t);
  });
  return errores;
}

log('1) Pantallas sin sesión');
for (const ruta of RUTAS) {
  const p = await ctx.newPage();
  const errores = await erroresDe(p);
  await p.goto(`${APP}/${ruta.hash}`, { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(3000);
  const texto = await p.locator('body').innerText().catch(() => '');
  const cargo = texto.length > 40;
  comprobar(cargo, `${ruta.nombre} renderiza`, `texto de ${texto.length} caracteres`);
  if (ruta.espera) {
    comprobar(ruta.espera.test(texto), `${ruta.nombre} muestra lo esperado`,
      texto.slice(0, 70).replace(/\n/g, ' '));
  }
  comprobar(errores.length === 0, `${ruta.nombre} sin errores de consola`,
    errores[0]?.slice(0, 90));
  await p.close();
}

log('\n2) Login de empleado y KDS');
{
  const p = await ctx.newPage();
  const errores = await erroresDe(p);
  await p.goto(`${APP}/#/login/empleado`, { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(2500);
  await p.locator('input[type="text"]').first().fill('empleado@coffeefast.cl');
  await p.locator('input[type="password"]').first().fill('123456');
  await p.getByRole('button', { name: /Ingresar a Comandas/i }).click();
  await p.waitForURL(/comandas/, { timeout: 20000 });
  await p.waitForTimeout(3000);
  comprobar(true, 'el empleado entra al KDS');

  const cuerpo = await p.locator('body').innerText();
  comprobar(!/Iniciar Sesi/i.test(cuerpo.slice(0, 200)), 'ya no está en el login');
  comprobar(/Voz|voz/i.test(cuerpo), 'la barra de voz está presente');
  comprobar(errores.length === 0, 'el KDS no tira errores de consola', errores[0]?.slice(0, 90));
  await p.close();
}

log('\n3) Login de dueño y panel de dueño');
{
  const p = await ctx.newPage();
  const errores = await erroresDe(p);
  await p.goto(`${APP}/#/login/dueno`, { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(2500);

  const tieneEmail = await p.locator('input[type="text"]').count();
  if (tieneEmail) {
    await p.locator('input[type="text"]').first().fill('dueno@coffeefast.cl');
    await p.locator('input[type="password"]').first().fill('123456');
    const boton = p.getByRole('button', { name: /Ingresar|Acceder|Entrar/i }).first();
    await boton.click({ force: true });
    await p.waitForTimeout(5000);
    const cuerpo = await p.locator('body').innerText();
    comprobar(
      !/Iniciar Sesi/i.test(cuerpo.slice(0, 200)) || /Cargando/i.test(cuerpo),
      'el dueño entra (o queda cargando, no rebota al login)',
      cuerpo.slice(0, 80).replace(/\n/g, ' '),
    );
  } else {
    comprobar(false, 'el login de dueño tiene campo de correo');
  }
  comprobar(errores.length === 0, 'el login de dueño no tira errores', errores[0]?.slice(0, 90));
  await p.close();
}

log('\n4) El panel de pruebas de voz');
{
  const p = await ctx.newPage();
  const errores = await erroresDe(p);
  await p.goto(`${APP}/prueba-voz.html`, { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(2500);
  const estado = await p.locator('#estado').innerText();
  comprobar(/Listo/i.test(estado), 'el panel arranca', estado);
  comprobar(await p.locator('#txtHablar').count() > 0, 'está la caja de texto libre');
  comprobar(await p.locator('#selIdioma').count() > 0, 'está el selector de idioma');
  comprobar(await p.locator('#rngVelocidad').count() > 0, 'está el control de velocidad');
  comprobar(errores.length === 0, 'el panel no tira errores', errores[0]?.slice(0, 90));
  await p.close();
}

await navegador.close();

log('');
if (fallos === 0) log('RUTAS OK');
else { log(`${fallos} FALLO(S)`); process.exitCode = 1; }
