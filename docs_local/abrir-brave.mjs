import { chromium } from 'playwright-core';
import { activarVoz } from './activar-voz.mjs';

const BRAVE = '/usr/bin/brave-browser';
const EMAIL = 'empleado@coffeefast.cl';
const CLAVE = '123456';

const b = await chromium.launch({
  executablePath: BRAVE,
  headless: false,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  env: { ...process.env, DISPLAY: process.env.DISPLAY || ':0' },
});
const ctx = await b.newContext({ viewport: { width: 1500, height: 940 } });

const kds = await ctx.newPage();
await kds.goto('http://localhost:5173/#/login/empleado', { waitUntil: 'domcontentloaded' });
await kds.waitForSelector('input[placeholder="empleado@coffeefast.cl"]', { timeout: 10000 });
await kds.locator('input[placeholder="empleado@coffeefast.cl"]').fill(EMAIL);
await kds.locator('input[type="password"]').fill(CLAVE);
await kds.getByRole('button', { name: /Ingresar a Comandas/i }).click({ force: true });
await Promise.race([
  kds.waitForURL(/empleado\/comandas/, { timeout: 15000 }),
  kds.waitForURL(/comandas/, { timeout: 15000 }),
]).catch(async () => { await kds.waitForTimeout(2500); });

const panel = await ctx.newPage();
await panel.goto('http://localhost:5173/prueba-voz.html', { waitUntil: 'domcontentloaded' });
await panel.waitForSelector('#estado', { timeout: 15000 });

try { await activarVoz(kds); } catch (e) { console.log('activarVoz:', e.message); }
await kds.bringToFront();
await new Promise(() => {});
