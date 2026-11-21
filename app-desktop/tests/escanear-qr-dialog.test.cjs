const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { transformSync } = require('esbuild');
const React = require('react');
const { create, act } = require('react-test-renderer');

const archivo = path.resolve(__dirname, '../src/components/EscanearQrDialog.jsx');

// Entorno de navegador minimo: la prueba usa la pestana de token, pero el
// componente intenta encender la camara al montarse en modo QR.
global.window = global.window || {};
global.navigator = {
  ...(global.navigator || {}),
  mediaDevices: {
    getUserMedia: async () => {
      throw Object.assign(new Error('camara no disponible'), { name: 'NotFoundError' });
    }
  },
  vibrate: () => {}
};

// Se ejecuta el componente REAL del KDS. Solo se sustituyen la presentacion
// MUI, el lector de QR y los servicios externos.
const componentes = [
  'Alert', 'Box', 'Button', 'CircularProgress', 'Dialog', 'DialogActions',
  'DialogContent', 'DialogTitle', 'IconButton', 'Stack', 'Tab', 'Tabs',
  'TextField', 'Typography'
];
const mui = Object.fromEntries(componentes.map((nombre) => [
  nombre,
  ({ children, ...props }) => React.createElement(nombre, props, children)
]));

function cargarDialogo({ validarQr, pedidosService }) {
  const codigo = transformSync(fs.readFileSync(archivo, 'utf8'), {
    format: 'cjs',
    loader: 'jsx',
    jsx: 'automatic',
    target: 'node22',
    sourcefile: archivo
  }).code;

  const modulo = { exports: {} };
  const importar = (nombre) => {
    if (nombre === 'react' || nombre === 'react/jsx-runtime') return require(nombre);
    if (nombre === '@mui/material') return mui;
    if (nombre.startsWith('@mui/icons-material/')) return () => React.createElement('icono');
    if (nombre === 'jsqr') return () => null;
    if (nombre.endsWith('/services/backendApi') || nombre === '../services/backendApi') {
      return { __esModule: true, default: { validarQr } };
    }
    if (nombre.endsWith('/services/pedidosService') || nombre === '../services/pedidosService') {
      return {
        __esModule: true,
        default: pedidosService,
        normalizarTokenQR: (texto) => String(texto || '').trim()
      };
    }
    throw new Error(`Import no previsto en la prueba: ${nombre}`);
  };

  Function('require', 'module', 'exports', codigo)(importar, modulo, modulo.exports);
  return modulo.exports.default;
}

async function montar(servicios) {
  const Dialogo = cargarDialogo(servicios);
  let arbol;
  await act(async () => {
    arbol = create(React.createElement(Dialogo, {
      open: true,
      cafeteriaId: 1,
      onClose: () => {}
    }));
  });

  const raiz = arbol.root;
  await act(async () => {
    raiz.findByType('Tabs').props.onChange(null, 'token');
  });

  const campo = raiz.findByType('TextField');
  await act(async () => {
    campo.props.onChange({ target: { value: 'CF-TOKEN-100' } });
  });

  const boton = raiz.findAllByType('Button').find((b) => b.props.children === 'Validar Token');
  assert.ok(boton, 'Debe existir el boton Validar Token');

  const textoPlano = (nodo) => {
    if (nodo === null || nodo === undefined) return '';
    if (typeof nodo === 'string' || typeof nodo === 'number') return String(nodo);
    if (Array.isArray(nodo)) return nodo.map(textoPlano).join(' ');
    return textoPlano(nodo.children);
  };

  return {
    arbol,
    texto: () => textoPlano(arbol.toJSON()),
    validar: async () => {
      await act(async () => {
        boton.props.onClick();
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
      });
    },
    desmontar: () => act(() => arbol.unmount())
  };
}

test('rechazo del servicio se muestra y no se reintenta escribiendo en Supabase', async (t) => {
  let fallbackLlamado = false;
  const vista = await montar({
    validarQr: async () => ({
      valido: false,
      motivo: 'cafeteria_ajena',
      razon: 'El empleado no pertenece a la cafetería del pedido.'
    }),
    pedidosService: {
      validarQrEntrega: async () => {
        fallbackLlamado = true;
        return { valido: true };
      }
    }
  });
  t.after(vista.desmontar);

  await vista.validar();

  assert.equal(fallbackLlamado, false, 'El KDS no debe usar una escritura alternativa de entrega');
  assert.match(vista.texto(), /Validación Rechazada/);
  assert.match(vista.texto(), /no pertenece a la cafetería del pedido/);
});

test('rechazo por segundo uso muestra «Este pedido ya fue entregado»', async (t) => {
  const vista = await montar({
    validarQr: async () => ({
      valido: false,
      motivo: 'ya_entregado',
      razon: 'Este pedido ya fue entregado.',
      pedido: { id: 100, estado: 'entregado' }
    }),
    pedidosService: { validarQrEntrega: async () => ({ valido: true }) }
  });
  t.after(vista.desmontar);

  await vista.validar();

  assert.match(vista.texto(), /Este pedido ya fue entregado\./);
  assert.match(vista.texto(), /Pedido #\s*100/);
});

test('error del servicio se muestra como error de conexión sin fallback de escritura', async (t) => {
  let fallbackLlamado = false;
  const vista = await montar({
    validarQr: async () => {
      throw new Error('Servicio de pedidos no disponible');
    },
    pedidosService: {
      validarQrEntrega: async () => {
        fallbackLlamado = true;
        return { valido: true };
      }
    }
  });
  t.after(vista.desmontar);

  await vista.validar();

  assert.equal(fallbackLlamado, false);
  assert.match(vista.texto(), /Error de Conexión/);
  assert.match(vista.texto(), /Servicio de pedidos no disponible/);
});

test('éxito del servicio muestra la entrega confirmada', async (t) => {
  const vista = await montar({
    validarQr: async () => ({
      valido: true,
      mensaje: 'Entrega validada exitosamente.',
      pedido: { id: 100, estado: 'entregado' }
    }),
    pedidosService: { validarQrEntrega: async () => ({ valido: false }) }
  });
  t.after(vista.desmontar);

  await vista.validar();

  assert.match(vista.texto(), /Entrega Validada Exitosamente/);
  assert.match(vista.texto(), /Pedido #\s*100/);
  assert.match(vista.texto(), /Estado actual:\s*Entregado/);
});
