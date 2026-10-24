// ============================================================
// T16 · activar-voz.mjs
// ============================================================
// Un solo lugar donde se aprieta el botón de voz del KDS.
//
// Antes cada prueba lo hacía por su cuenta y todas fallaban de a
// ratos por lo mismo:
//
//   1. El botón de la barra se repinta constantly por el ripple de MUI,
//      así que nunca está "estable" y la espera de acción se agota.
//   2. Si se aprieta apenas carga la página, el clic cae antes de que la
//      barra esté montada y la voz queda silenciada sin avisar.
//
// Consecuencia: pruebas que fallaban por reloj o por montage y no por
// culpa del KDS, y que volvían a pasar en la siguiente corrida sin que
// nadie supiera por qué.
//
// Este helper hace el clic de verdad (no simula nada), espera a que el
// KDS esté listo y comprueba que la barra quedó como se pidió. Si no
// logra el estado esperado, lanza un error claro en vez de dejar que la
// prueba siga y falle más abajo por un motivo que no es el real.
//
// Uso:
//   await activarVoz(pagina);                    // deja la voz activa
//   await activarVoz(pagina, { silenciar: true }); // la deja apagada
// ============================================================

/**
 * @param {import('playwright-core').Page} pagina la pestaña del KDS
 * @param {{ silenciar?: boolean, intentos?: number }} opciones
 */
export async function activarVoz(pagina, { silenciar = false, intentos = 3 } = {}) {
  const esperado = silenciar ? /Voz off/i : /Voz on/i;
  const contrario = silenciar ? /Voz on/i : /Voz off/i;

  // Que el KDS termine de montar antes de tocar nada.
  await pagina.waitForTimeout(2500);

  // Con DEPURAR_VOZ=1 se ve qué encuentra el helper en cada intento:
  // sirve para distinguir "el clic no entró" de "entró y el estado no
  // cambió", que son dos problemas muy distintos.
  const depurar = Boolean(process.env.DEPURAR_VOZ);

  for (let intento = 1; intento <= intentos; intento++) {
    const btn = pagina.getByRole('button', { name: /Activar voz|Voz on|Voz off/i }).first();

    // force: true porque el botón nunca está estable (ripple de MUI).
    // El clic sigue siendo real; solo se saltan las comprobaciones de
    // estabilidad, que acá no aportan nada.
    await btn.click({ force: true });
    await pagina.waitForTimeout(1500);

    const texto = (await btn.innerText()).trim();
    if (depurar) {
      const estado = await pagina.evaluate(() => ({
        url: location.hash,
        foco: document.hasFocus(),
        visible: document.visibilityState,
        prefs: localStorage.getItem('kds_voz_prefs_v1'),
      }));
      console.log(`   [voz] intento ${intento}: "${texto}" ${JSON.stringify(estado)}`);
    }
    if (esperado.test(texto)) return texto;
    if (contrario.test(texto)) continue; // ya está en el otro estado: va bien

    // Con el servidor de desarrollo, guardar un archivo recarga la página
    // y el clic se pierde a mitad de camino. Se recarga y se reintenta, en
    // vez de failar por una recarga que el test no provoque.
    if (intento < intentos) {
      await pagina.reload({ waitUntil: 'domcontentloaded' });
      await pagina.waitForTimeout(3000);
    }
  }

  const btn = pagina.getByRole('button', { name: /Activar voz|Voz on|Voz off/i }).first();
  const final = (await btn.innerText().catch(() => '?')).trim();
  throw new Error(
    `no se pudo dejar la voz en "${silenciar ? 'Voz off' : 'Voz on'}"; ` +
    `la barra sigue en "${final}" después de ${intentos} intento(s)`,
  );
}

/**
 * Igual que activarVoz, pero sin lanzar: útil cuando lo que se está
 * probando es justamente que el aviso NO suene.
 */
export async function intentarActivarVoz(pagina, opciones) {
  try {
    return { ok: true, texto: await activarVoz(pagina, opciones) };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}
