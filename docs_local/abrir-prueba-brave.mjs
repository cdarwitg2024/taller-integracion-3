import { chromium } from 'playwright-core';
import { activarVoz } from './activar-voz.mjs';

const BRAVE = '/usr/bin/brave-browser';
const EMAIL = 'empleado@coffeefast.cl';
const CLAVE = '123456';

const b = await chromium.launch({
  executablePath: BRAVE,
  headless: false,
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
  env: { ...process.env },
});
const ctx = await b.newContext({ viewport: { width: 1600, height: 960 } });
const kds = await ctx.newPage();
await kds.goto('http://127.0.0.1:5173/#/login/empleado');
await kds.waitForSelector('input[placeholder="empleado@coffeefast.cl"]', {timeout:8000});
await kds.fill('input[placeholder="empleado@coffeefast.cl"]', EMAIL);
await kds.fill('input[type="password"]', CLAVE);
await kds.click('button:has-text("Ingresar a Comandas")');
await kds.waitForURL(/empleado\/comandas|\/comandas/, {timeout:12000}).catch(()=>{});
const panel = await ctx.newPage();
await panel.goto('http://127.0.0.1:5173/prueba-voz.html');
await panel.waitForSelector('#estado', {timeout:8000});
try{ await activarVoz(kds); }catch(e){}
await kds.bringToFront();
await new Promise(() => {});
