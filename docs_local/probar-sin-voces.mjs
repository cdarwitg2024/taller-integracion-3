/**
 * El fallback a la voz del sistema no puede mentir.
 *
 * Antes, cuando no había voces instaladas el reloj de seguridad
 * resolvía "true" (como si hubiera hablado) y el KDS quedaba mudo sin
 * decir nada. Ahora debe avisar que no hay voces, y la cola debe
 * sobrevivir igual para el pedido siguiente.
 *
 *   node docs_local/probar-sin-voces.mjs
 */
import { firefox } from 'playwright-core';
import { activarVoz } from './activar-voz.mjs';

const BASE = 'http://127.0.0.1:5173';
const KDS = `${BASE}/#/empleado/comandas`;
const PANEL = `${BASE}/prueba-voz.html`;

let fallos = 0;
const comprobar = (c, t) => {
  console.log(`  ${c ? 'ok   ' : 'FALLA'} ${t}`);
  if (!c) fallos++;
};
const barra = (p) => p.locator('text=/voces instaladas|no respondió|sesión de Supabase/i');

const navegador = await firefox.launch({
  executablePath: '/home/elias/.cache/ms-playwright/firefox-1549/firefox/firefox',
  headless: true,
  args: ['autoplay-policy=no-user-gesture-required'],
});
const ctx = await navegador.newContext();
const kds = await ctx.newPage();
const panel = await ctx.newPage();

const crear = async () => {
  await panel.locator('#btnUna').click();
  await panel.waitForTimeout(2500);
};

try {
  await kds.goto(`${BASE}/#/login/empleado`, { waitUntil: 'domcontentloaded' });
  await kds.waitForTimeout(1200);
  await kds.locator('input[type="text"]').first().fill('empleado@coffeefast.cl');
  await kds.locator('input[type="password"]').first().fill('123456');
  await kds.getByRole('button', { name: /Ingresar a Comandas/i }).click();
  await kds.waitForTimeout(3500);
  await activarVoz(kds);

  // Se rompe la función de voz (como si ElevenLabs no respondiera) y se
  // deja el equipo sin ninguna voz instalada, que es el caso real que
  // escuchó el usuario: silencio sin explicación.
  await kds.evaluate(() => {
    window.__hablas = 0;
    const fetchOriginal = window.fetch;
    window.fetch = (url, opts) => {
      if (String(url).includes('/functions/v1/voz-pedido')) {
        return Promise.reject(new Error('simulado: la función no está'));
      }
      return fetchOriginal(url, opts);
    };
    window.speechSynthesis.getVoices = () => [];
  });
  console.log('\n1) Función de voz caída + equipo sin voces instaladas');
  await panel.goto(PANEL, { waitUntil: 'domcontentloaded' });
  await panel.waitForSelector('#estado:has-text("Listo")', { timeout: 15000 });
  await crear();

  await kds.waitForTimeout(9000);
  const texto1 = await kds.locator('body').innerText();
  comprobar(
    /no tiene voces instaladas|no respondió/i.test(texto1),
    `la barra explica por qué no se escucha (${(texto1.match(/[^\n]*(voces instaladas|no respondió)[^\n]*/i) || [''])[0].trim() || 'sin mensaje'})`,
  );
  comprobar(
    !/se usará la voz del sistema/i.test(texto1),
    'no promete una voz del sistema que no existe',
  );

  // --- La cola debe seguir viva tras el fallo ----------------------
  console.log('\n2) La cola sobrevive al fallo');
  await kds.evaluate(() => {
    window.speechSynthesis.getVoices = () => [{ lang: 'es-CL', name: 'Fake', default: true }];
    window.speechSynthesis.speak = (u) => {
      window.__hablas += 1;
      setTimeout(() => u.onend && u.onend(), 50);
    };
  });
  await crear();
  await kds.waitForTimeout(9000);
  const hablas = await kds.evaluate(() => window.__hablas);
  comprobar(hablas > 0, `el pedido siguiente se sigue procesando (${hablas} intento(s) de habla)`);
} catch (e) {
  console.log(`  FALLA excepción: ${e.message.split('\n')[0]}`);
  fallos++;
} finally {
  await navegador.close();
}

console.log(`\n${fallos === 0 ? 'FALLBACK HONESTO' : `${fallos} FALLO(S)`}`);
process.exit(fallos ? 1 : 0);
