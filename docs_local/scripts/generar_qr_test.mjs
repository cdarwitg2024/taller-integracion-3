#!/usr/bin/env node
// ============================================================================
// TEST MANUAL FR-32 — Generador de QR de pedidos reales desde la BD local.
// NO SE SUBE. Vive solo en docs_local/.
//
// Uso:
//   node docs_local/scripts/generar_qr_test.mjs               # QR del pedido "listo"
//   node docs_local/scripts/generar_qr_test.mjs --all         # 1 PNG por pedido
//   node docs_local/scripts/generar_qr_test.mjs --id 1        # un pedido puntual
//   node docs_local/scripts/generar_qr_test.mjs --estado pendiente
//   node docs_local/scripts/generar_qr_test.mjs --url         # QR como URL (ejercita normalizarTokenQR)
//   node docs_local/scripts/generar_qr_test.mjs --terminal    # además imprime QR ASCII en la consola
//   node docs_local/scripts/generar_qr_test.mjs --reset       # restaura el seed (0001 pendiente, 0002 en_preparacion, 0003 listo)
//
// Flujo de prueba en el KDS: botón "Escanear QR" -> apuntar la cámara al PNG.
// Con MS Comercio (:3000) apagado el diálogo usa el fallback a Supabase.
// ============================================================================

import { execSync, spawnSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import QRCode from 'qrcode';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url)); // docs_local/scripts
const DOCS_DIR = path.dirname(SCRIPT_DIR);                        // docs_local
const REPO_DIR = path.dirname(DOCS_DIR);                          // raíz del repo
const APP_DIR = path.join(REPO_DIR, 'app-desktop');
const CONTAINER = process.env.SUPABASE_DB_CONTAINER || 'supabase_db_taller-integracion-3';
const SEED = [
  { id: 1, estado: 'pendiente', timestamps: null },
  { id: 2, estado: 'en_preparacion', timestamps: 'inicio_preparacion_en' },
  { id: 3, estado: 'listo', timestamps: 'listo_en' },
];

async function cargarEnv() {
  const env = {};
  for (const file of [path.join(REPO_DIR, '.env'), path.join(APP_DIR, '.env')]) {
    if (!existsSync(file)) continue;
    for (const linea of readFileSync(file, 'utf8').split('\n')) {
      const m = linea.trim().match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (m && !linea.trim().startsWith('#')) env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
    }
  }
  return env;
}

async function consultarPedidos() {
  const env = await cargarEnv();
  const url = (env.VITE_SUPABASE_URL || '').replace(/\/+$/, '');
  const key = env.VITE_SUPABASE_ANON_KEY;
  const cid = Number(process.env.VITE_CAFETERIA_ID || env.VITE_CAFETERIA_ID || 1);

  if (!url || !key) {
    console.error('Faltan VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY en el .env raíz o app-desktop/.env');
    process.exit(1);
  }

  const res = await fetch(
    `${url}/rest/v1/pedidos?select=id,codigo_retiro_diario,estado,qr_token,total&cafeteria_id=eq.${cid}&order=id.asc`,
    {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Accept-Profile': 'public',
      },
    },
  );
  if (!res.ok) {
    console.error(`Error consultando pedidos: HTTP ${res.status} ${await res.text()}`);
    process.exit(1);
  }
  const pedidos = await res.json();
  return { pedidos, cafeteríaId: cid, key, url };
}

function resultadoEsperado(p) {
  switch (p.estado) {
    case 'listo':
      return 'ÉXITO -> se marca Entregado (Alert verde) y la comanda sale del Kanban';
    case 'pendiente':
    case 'en_preparacion':
      return 'RECHAZO -> Alert rojo "aún no está listo para retiro"';
    case 'entregado':
      return 'RECHAZO -> Alert rojo "ya fue entregado"';
    default:
      return `RECHAZO -> Alert rojo (estado ${p.estado})`;
  }
}

async function generarPng(pedido, { comoUrl, mostrarTerminal, out }) {
  const token = pedido.qr_token;
  const contenido = comoUrl ? `https://cofeefast.app/q/${token}` : token;
  const destino = out || path.join(DOCS_DIR, `qr_${token}.png`);

  await QRCode.toFile(destino, contenido, { width: 480, margin: 2, errorCorrectionLevel: 'M' });

  console.log(`----------------------------------------`);
  console.log(`  Pedido   : #${pedido.id}  (${pedido.codigo_retiro_diario})   ${pedido.estado}`);
  console.log(`  Contenido: ${contenido}`);
  console.log(`  PNG      : ${destino}`);
  console.log(`  Esperado : ${resultadoEsperado(pedido)}`);
  if (mostrarTerminal) console.log(await QRCode.toString(contenido, { type: 'terminal', errorCorrectionLevel: 'M' }));
  return destino;
}

function resetSeed() {
  const sql = `
    ALTER TABLE public.pedidos DISABLE TRIGGER trg_validar_transicion_estado;
    UPDATE public.pedidos SET estado='pendiente', inicio_preparacion_en=NULL, listo_en=NULL, entregado_en=NULL, completado_en=NULL, cancelado_en=NULL WHERE id=1;
    UPDATE public.pedidos SET estado='en_preparacion', inicio_preparacion_en=now(), listo_en=NULL, entregado_en=NULL, completado_en=NULL, cancelado_en=NULL WHERE id=2;
    UPDATE public.pedidos SET estado='listo', inicio_preparacion_en=now(), listo_en=now(), entregado_en=NULL, completado_en=NULL, cancelado_en=NULL WHERE id=3;
    ALTER TABLE public.pedidos ENABLE TRIGGER trg_validar_transicion_estado;`;
  const args = ['exec', CONTAINER, 'psql', '-U', 'postgres', '-d', 'postgres', '-c', sql];
  const r = spawnSync('docker', args, { encoding: 'utf8' });
  if (r.status !== 0) {
    console.error('Fallo al restaurar seed:', (r.stderr || r.stdout).trim());
    process.exit(1);
  }
  console.log('Seed restaurado: 0001 pendiente, 0002 en_preparacion, 0003 listo.');
}

function parseArgs(argv) {
  const opts = { all: false, url: false, terminal: false, reset: false, id: null, estado: null, out: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--all') opts.all = true;
    else if (a === '--url') opts.url = true;
    else if (a === '--terminal') opts.terminal = true;
    else if (a === '--reset') opts.reset = true;
    else if (a === '--id') opts.id = argv[++i];
    else if (a === '--estado') opts.estado = argv[++i];
    else if (a === '--out') opts.out = argv[++i];
    else {
      console.error(`Argumento desconocido: ${a}`);
      process.exit(1);
    }
  }
  return opts;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));

  if (opts.reset) {
    resetSeed();
    if (!opts.all && !opts.id && !opts.estado) return; // solo resetea
  }

  const { pedidos } = await consultarPedidos();

  console.log('Pedidos en la BD de la cafetería actual:');
  console.log('  id | codigo      | estado         | qr_token');
  for (const p of pedidos) {
    console.log(`  ${String(p.id).padEnd(3)}| ${String(p.codigo_retiro_diario).padEnd(11)}| ${String(p.estado).padEnd(14)}| ${p.qr_token}`);
  }

  let seleccion = pedidos;
  if (opts.id) {
    const match = pedidos.filter(p => String(p.id) === String(opts.id) || p.codigo_retiro_diario === String(opts.id));
    if (!match.length) {
      console.error(`No existe pedido con id/codigo "${opts.id}".`);
      process.exit(1);
    }
    seleccion = match;
  } else if (opts.estado) {
    seleccion = pedidos.filter(p => p.estado === opts.estado);
    if (!seleccion.length) {
      console.error(`No hay pedidos en estado "${opts.estado}".`);
      process.exit(1);
    }
  } else if (!opts.all) {
    const listo = pedidos.filter(p => p.estado === 'listo');
    const base = listo.length ? listo : pedidos;
    seleccion = [base[0]];
    console.log(`\n(por defecto: pedido "${base[0].estado}" ${base === listo ? 'para probar el caso de ÉXITO' : ''})`);
  }

  for (const p of seleccion) {
    await generarPng(p, { comoUrl: opts.url, mostrarTerminal: opts.terminal, out: opts.out });
  }

  console.log(`\nListo. Abre el PNG y escanéalo desde el KDS (botón "Escanear QR").`);
  if (opts.url) console.log('Nota: el QR usa formato URL -> ejercita normalizarTokenQR.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});