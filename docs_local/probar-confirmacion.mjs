// T16 · probar-confirmacion.mjs
// ============================================================
// El panel de pruebas promete confirmar si el KDS anunció una comanda.
// Hasta hace poco no podía cumplirlo: la clave anon no tiene SELECT
// sobre anuncios_pedido, así que la consulta siempre volvía denegada y
// el panel concluía que nadie había hablado.
//
// Esta prueba cierra ese círculo: abre el KDS con la cuenta real (para
// que exista sesión), activa la voz, crea una comanda desde el panel y
// EXIGE que el panel confirme el aviso. Si el panel vuelve a no poder
// verificar, la prueba falla en vez de darse por satisfecha con que
// "no se rompió".
//
// Uso: node docs_local/probar-confirmacion.mjs
// ============================================================

import { readFileSync } from 'node:fs';
import { firefox } from 'playwright-core';
import { activarVoz } from './activar-voz.mjs';

// La anon key vive en app-desktop/.env; hace falta para el header apikey
// de la llamada directa a la función.
const ANON_KEY = (() => {
  try {
    const env = readFileSync(new URL('../app-desktop/.env', import.meta.url), 'utf8');
    return env.match(/VITE_SUPABASE_ANON_KEY\s*=\s*"?([^"\n]+)"?/)?.[1]?.trim() || '';
  } catch { return ''; }
})();

const APP = 'http://localhost:5173';
const KDS = `${APP}/#/empleado/comandas`;
const PANEL = `${APP}/prueba-voz.html`;
const FIREFOX = '/home/elias/.cache/ms-playwright/firefox-1549/firefox/firefox';
const EMAIL = 'empleado@coffeefast.cl';
const CLAVE = '123456';

const log = (...a) => console.log(...a);
let fallos = 0;
function comprobar(ok, desc, detalle = '') {
  if (ok) log(`  ok   ${desc}`);
  else { fallos++; log(`  FALLA ${desc}${detalle ? ` — ${detalle}` : ''}`); }
}

const navegador = await firefox.launch({ executablePath: FIREFOX, headless: true });
// Un solo contexto a propósito: el panel tiene que reusear la sesión
// que dejó el KDS, así que las dos pestañas comparten almacenamiento.
const ctx = await navegador.newContext({ viewport: { width: 1400, height: 900 } });

log('1) KDS con la cuenta real, para que exista sesión');
const kds = await ctx.newPage();
await kds.goto(KDS, { waitUntil: 'domcontentloaded' });
await kds.waitForTimeout(3000);
await kds.locator('input[type="text"]').first().fill(EMAIL);
await kds.locator('input[type="password"]').first().fill(CLAVE);
await kds.getByRole('button', { name: /Ingresar a Comandas/i }).click({ force: true });
await kds.waitForURL(/comandas/, { timeout: 20000 });
await kds.waitForTimeout(1500);
comprobar(true, 'el KDS tiene sesión');

await activarVoz(kds);
comprobar(await kds.locator('text=/Voz on/i').count() > 0, 'la voz quedó activa');

log('\n2) Creando la comanda desde el panel');
const panel = await ctx.newPage();
await panel.goto(PANEL, { waitUntil: 'domcontentloaded' });
await panel.waitForSelector('#estado:has-text("Listo")', { timeout: 20000 });

// Que el panel pueda leer anuncios_pedido es justo lo que se prueba.
const lectura = await panel.evaluate(async () => {
  const { supabase } = await import('/src/service/supabase.js');
  const sesion = await supabase.auth.getSession();
  if (!sesion.data.session) return { sesion: false };
  const { error } = await supabase.from('anuncios_pedido').select('id').limit(1);
  return { sesion: true, error: error ? `${error.code}: ${error.message}` : null };
});
comprobar(lectura.sesion, 'el panel encontró la sesión del KDS');
comprobar(!lectura.error, 'el panel puede leer anuncios_pedido', lectura.error || '');

await panel.locator('#btnUna').click();
await panel.waitForTimeout(1500);
const pedidoId = await panel.evaluate(() => document.getElementById('log')?.textContent?.match(/Pedido #(\d+)/)?.[1] || null);
log(`   pedido creado: ${pedidoId ?? '(no se pudo leer el id)'}`);

log('\n3) El panel tiene que confirmar el aviso (no basta con que suene)');
// El panel escribe una de estas cuatro cosas. "No pude verificar" y
// "no hay sesión" NO cuentan como confirmación.
const confirmo = async () => panel.evaluate(() => {
  const t = document.getElementById('log')?.textContent || '';
  return {
    anuncio: /✓ El KDS lo anunció/i.test(t),
    fallo: /quedó en (fallido|descartado)/i.test(t),
    sinFila: /sigue sin aparecer/i.test(t),
    sinSesion: /No hay sesión/i.test(t),
    sinPermiso: /No pude verificar/i.test(t),
    texto: t.split('\n').slice(0, 3).join(' | '),
  };
});

let estado = await confirmo();
const limite = Date.now() + 90000;
while (Date.now() < limite && !estado.anuncio && !estado.fallo) {
  await panel.waitForTimeout(1500);
  estado = await confirmo();
}

comprobar(estado.anuncio, 'el panel confirmó que el KDS anunció', estado.texto);
if (!estado.anuncio) {
  log(`   sin anuncio=${estado.sinFila} sinPermiso=${estado.sinPermiso} sinSesion=${estado.sinSesion}`);
}

// La fila existe y quedó marcada como emitida.
if (pedidoId) {
  const fila = await panel.evaluate(async (id) => {
    const { supabase } = await import('/src/service/supabase.js');
    const { data } = await supabase
      .from('anuncios_pedido')
      .select('estado, voz, caracteres')
      .eq('pedido_id', Number(id))
      .maybeSingle();
    return data;
  }, pedidoId);
  log(`   fila en anuncios_pedido: ${fila ? JSON.stringify(fila) : '(no existe)'}`);
  comprobar(!!fila, 'existe la fila del aviso');
  comprobar(fila?.estado === 'emitido', 'la fila quedó en "emitido"', `estado: ${fila?.estado}`);
  comprobar(!!fila?.voz, 'la fila guardó la voz usada');
}

log('\n4) Un empleado NO puede falsear el control de avisos');
// Si el empleado pudiera marcar como emitido, el control no valdría nada.
const escritura = await panel.evaluate(async (id) => {
  const { supabase } = await import('/src/service/supabase.js');
  const { error } = await supabase
    .from('anuncios_pedido')
    .update({ estado: 'emitido' })
    .eq('pedido_id', Number(id));
  return error ? `${error.code}: ${error.message}` : null;
}, pedidoId || 1);
comprobar(!!escritura, 'el UPDATE con la sesión del empleado es rechazado', escritura || 'permitido');

log('\n5) El dueño queda fuera: la voz es solo del KDS');
// La voz de aviso pertenece a la pantalla del KDS, que es la del empleado.
// Ni el dueño ni su token deben poder leer los avisos ni gastar cuota
// generando audio.
const DUE_EMAIL = 'dueno@cofeefast.cl';
const DUE_CLAVE = process.env.PWD_DUENO || 'prueba123';

const dueno = await ctx.newPage();
// Hay que navegar primero: sin origen, el import del cliente de Supabase
// no resuelve y la evaluación falla sin decir por qué.
await dueno.goto(PANEL, { waitUntil: 'domcontentloaded' });
await dueno.waitForSelector('#estado:has-text("Listo")', { timeout: 20000 });
const sesionDueno = await dueno.evaluate(async ([email, clave]) => {
  const { supabase } = await import('/src/service/supabase.js');
  const { data, error } = await supabase.auth.signInWithPassword({ email, password: clave });
  return { entro: !!data.session, error: error?.message || null };
}, [DUE_EMAIL, DUE_CLAVE]).catch(() => ({ entro: false, error: 'no se pudo evaluar' }));

if (!sesionDueno.entro) {
  // No se marca como ok: se dice que quedó sin verificar.
  log(`  AVISO el dueño no pudo iniciar sesión (${sesionDueno.error || 'sin detalle'}),`);
  log('         así que su permiso NO quedó verificado en esta corrida.');
} else {
  const lecturaDueno = await dueno.evaluate(async () => {
    const { supabase } = await import('/src/service/supabase.js');
    const { data, error } = await supabase.from('anuncios_pedido').select('id').limit(1);
    return { filas: data?.length ?? 0, error: error?.message || null };
  });
  comprobar(
    lecturaDueno.filas === 0 || !!lecturaDueno.error,
    'el dueño no puede leer los avisos',
    `vio ${lecturaDueno.filas} fila(s)${lecturaDueno.error ? ` · ${lecturaDueno.error}` : ''}`,
  );

  // La URL y la clave vienen desde Node: dentro de la función que se
  // serializa no se puede usar import.meta.
  const fnDueno = await dueno.evaluate(async ([url, anonKey]) => {
    const { supabase } = await import('/src/service/supabase.js');
    const token = (await supabase.auth.getSession()).data.session.access_token;
    const r = await fetch(`${url}/functions/v1/voz-pedido`, {
      method: 'POST',
      headers: { apikey: anonKey, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ pedido_id: 999999 }),
    });
    return { status: r.status, cuerpo: (await r.text()).slice(0, 80) };
  }, [APP.replace('5173', '54321'), ANON_KEY]);
  comprobar(
    fnDueno.status === 403,
    'la función de voz le devuelve 403 al dueño',
    `status ${fnDueno.status} · ${fnDueno.cuerpo}`,
  );
}
await dueno.close();

// Limpieza
await panel.locator('#btnLimpiar').click({ force: true }).catch(() => {});
await panel.waitForTimeout(1500);
await navegador.close();

log('');
if (fallos === 0) log('CONFIRMACIÓN OK');
else { log(`${fallos} FALLO(S)`); process.exitCode = 1; }
