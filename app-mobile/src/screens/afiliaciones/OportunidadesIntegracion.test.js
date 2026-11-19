// Opt-in: el runner crea servicios y datos desechables antes de ejecutar este caso.
import React from 'react';
import { Text, TouchableOpacity } from 'react-native';
import { act, create } from 'react-test-renderer';
import http from 'node:http';
import OportunidadesScreen from './OportunidadesScreen';

jest.mock('../../lib/supabase', () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: {
    access_token: process.env.A03_INTEGRATION_TOKEN,
  } }, error: null }) } },
}));

const integracion = process.env.A03_INTEGRATION_URL ? test : test.skip;
integracion('A03: lista persistida con activa + pausada + vencida, y cafetería sin campañas', async () => {
  const anterior = global.fetch;
  let tree;
  // Adaptador Node para el transporte HTTP real del cliente React Native en Jest.
  global.fetch = (url, opciones = {}) => new Promise((resolve, reject) => {
    const request = http.request(url, { method: opciones.method, headers: opciones.headers }, response => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', chunk => { body += chunk; });
      response.on('end', () => {
        opciones.signal?.removeEventListener('abort', cancelar);
        resolve({ ok: response.statusCode < 400, status: response.statusCode, text: async () => body });
      });
      response.on('error', reject);
    });
    const cancelar = () => request.destroy(Object.assign(new Error('Aborted'), { name: 'AbortError' }));
    opciones.signal?.addEventListener('abort', cancelar, { once: true });
    request.on('error', reject);
    request.end();
  });
  const texto = () => tree.root.findAllByType(Text).flatMap(n => n.props.children).join(' ');
  const esperar = async contiene => {
    for (let n = 0; n < 100; n++) {
      await act(async () => { await new Promise(resolve => setTimeout(resolve, 30)); });
      if (texto().includes(contiene)) return;
    }
    throw new Error(`No apareció el estado esperado: ${contiene}. Vista: ${texto()}`);
  };
  const pulsar = async etiqueta => act(async () => tree.root.findAllByType(TouchableOpacity)
    .find(n => n.props.accessibilityLabel === etiqueta).props.onPress());
  try {
    await act(async () => { tree = create(<OportunidadesScreen />); });
    await esperar('Ver campañas de Norte A03');
    await pulsar('Ver campañas de Norte A03');
    await esperar('Activa A03');
    expect(texto()).toContain('15%');
    expect(texto()).toContain('10%');
    expect(texto()).not.toContain('Pausada A03');
    expect(texto()).not.toContain('Vencida A03');
    console.log('PASS: seleccionar Norte A03 muestra Activa A03, descuento 15%, comisión 10%; excluye pausada/vencida');
    await pulsar('Ver campañas de Sur A03');
    await esperar('No hay oportunidades disponibles');
    expect(texto()).not.toContain('Activa A03');
    console.log('PASS: seleccionar Sur A03 muestra No hay oportunidades disponibles, sin campañas de Norte');
  } finally {
    if (tree) act(() => tree.unmount());
    global.fetch = anterior;
  }
});
