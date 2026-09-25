/**
 * Verificación de Realtime para la tabla public.pedidos.
 *
 * Flujo:
 *   1. Abre un canal postgres_changes (INSERT) sobre public.pedidos con service_role.
 *   2. Inserta un pedido + detalle de prueba directamente (vía cliente supabase).
 *   3. Espera a recibir el evento realtime (por la publicación supabase_realtime).
 *   4. Limpia las filas de prueba y desconecta el canal.
 *
 * Uso: node scripts/verificar-realtime.cjs  (desde backend-node/)
 */
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_KEY;

if (!url || !serviceKey) {
  console.error('Faltan SUPABASE_URL / SUPABASE_SERVICE_KEY en .env');
  process.exit(1);
}

const supabase = createClient(url, serviceKey);

const ESPERA_MS = 10000;
const codigo = `#CF-TEST-${Date.now()}`;

function esperar(evento) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Tiempo agotado (${ESPERA_MS / 1000}s): no se recibió el evento INSERT de pedidos`));
    }, ESPERA_MS);
    evento.data = null;
    const check = () => {
      if (evento.data) {
        clearTimeout(timer);
        resolve();
      }
    };
    check();
    const intervalo = setInterval(() => { check(); if (evento.data) clearInterval(intervalo); }, 100);
  });
}

(async () => {
  try {
    // 1. Datos base reales para poder insertar el pedido de prueba
    const { data: usuario, error: eU } = await supabase.from('usuarios').select('id').limit(1).single();
    const { data: cafeteria, error: eC } = await supabase.from('cafeterias').select('id').limit(1).single();
    const { data: producto, error: eP } = await supabase.from('productos').select('id').limit(1).single();
    if (eU || eC || eP || !usuario || !cafeteria || !producto) {
      throw new Error('No hay datos base en BD (usuarios/cafeterias/productos). Corre antes el seed.');
    }

    const evento = { data: null };
    const echo = { data: null };

    const canal = supabase
      .channel('verif-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'pedidos' }, payload => {
        evento.data = payload;
      })
      .on('broadcast', { event: 'echo' }, payload => {
        echo.data = payload;
      })
      .subscribe(status => {
        console.log('  → estado del canal tras subscribe():', status);
      });

    console.log('⏳ Esperando que el canal se conecte...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    console.log('  → estado actual:', canal.state);

    // Prueba de transporte: broadcast echo (no depende de la publicación SQL)
    canal.send({ type: 'broadcast', event: 'echo', payload: { ping: true } });
    await new Promise(resolve => setTimeout(resolve, 2000));
    console.log(echo.data ? '  → broadcast: echo OK (transporte websocket funciona)' : '  → broadcast: SIN echo (¿problema de websocket?)');

    console.log('📦 Insertando pedido de prueba...');
    const { data: pedido, error: errInsert } = await supabase
      .from('pedidos')
      .insert({
        codigo_retiro_diario: codigo,
        usuario_id: usuario.id,
        cafeteria_id: cafeteria.id,
        total: 1000,
        estado: 'Pagado',
        qr_token: crypto.randomUUID(),
        nota: 'verificacion realtime'
      })
      .select()
      .single();
    if (errInsert) throw errInsert;

    await supabase.from('detalles_pedido').insert({
      pedido_id: pedido.id,
      producto_id: producto.id,
      cantidad: 1,
      precio_unitario: 1000,
      subtotal: 1000
    }).select();

    await esperar(evento);

    console.log(`✅ EVENTO REALTIME RECIBIDO (pedido id=${evento.data.new ? evento.data.new.id : '?'})`);
    console.log(JSON.stringify({ tipo: evento.data.eventType, tabla: evento.data.table, codigo: evento.data.new.codigo_retiro_diario }, null, 2));

    await supabase.removeChannel(canal);

    // Limpieza
    await supabase.from('detalles_pedido').delete().eq('pedido_id', pedido.id);
    const { error: errDel } = await supabase.from('pedidos').delete().eq('id', pedido.id);
    console.log(errDel ? `⚠️  No se pudo borrar el pedido de prueba: ${errDel.message}` : '🧹 Pedido de prueba eliminado.');
  } catch (err) {
    console.error(`❌ ${err.message}`);
    process.exitCode = 1;
  } finally {
    // Cierre limpio del proceso
    process.exit();
  }
})();