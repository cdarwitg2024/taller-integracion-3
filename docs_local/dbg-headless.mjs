import { firefox } from 'playwright-core';
const b = await firefox.launch({ executablePath: '/home/elias/.cache/ms-playwright/firefox-1549/firefox/firefox', headless: true });
const p = await b.newPage();
await p.goto('http://localhost:5173/#/login/empleado', { waitUntil: 'domcontentloaded' });
await p.waitForSelector('input[placeholder="empleado@coffeefast.cl"]', {timeout:5000});
await p.locator('input[placeholder="empleado@coffeefast.cl"]').fill('empleado@coffeefast.cl');
await p.locator('input[type="password"]').fill('123456');
await p.getByRole('button', { name: /Ingresar a Comandas/i }).click({ force: true });
await Promise.race([
  p.waitForURL(/comandas/, {timeout:15000}),
  p.waitForURL(new RegExp('empleado/comandas'), {timeout:15000}),
]).catch(()=>{});
console.log(p.url());
await b.close();
