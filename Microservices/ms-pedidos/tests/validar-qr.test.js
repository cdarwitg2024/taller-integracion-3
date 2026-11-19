'use strict';

const request = require('supertest');

// El servicio usa `supabase.obtenerCliente()` (service_role) para la entrega.
// Se sustituye por una base en memoria que respeta las condiciones atomicas
// (`estado = listo` y `qr_usado = false`) y registra que tablas consulta.
// No existe ninguna tabla/columna de comisiones en este mock: la entrega no
// debe depender de ellas.
const mockEstado = {
  pedidos: new Map(),
  usuarios: new Map(),
  cafeteriaUsuarios: [],
  logs: [],
  consultas: []
};

const resetMockEstado = () => {
  mockEstado.pedidos.clear();
  mockEstado.usuarios.clear();
  mockEstado.cafeteriaUsuarios.length = 0;
  mockEstado.logs.length = 0;
  mockEstado.consultas.length = 0;
};

jest.mock('@coffeefaster/shared', () => {
  const actual = jest.requireActual('@coffeefaster/shared');

  const resolver = (tabla, filas, filtros) => filas.filter((fila) => filtros.every((f) => {
    const valor = fila[f.columna];
    if (f.tipo === 'eq') return valor === f.valor;
    if (f.tipo === 'is') return valor === null || valor === undefined;
    if (f.tipo === 'in') return f.valores.includes(valor);
    if (f.tipo === 'orQr') return fila.qr_token === f.valor || fila.codigo_retiro_diario === f.valor;
    if (f.tipo === 'orQrUsado') return valor === false || valor === null || valor === undefined;
    return true;
  }));

  const builder = (tabla, operacion, datos) => {
    const filtros = [];
    let proyeccion = '*';
    let modoLista = false;

    const q = {
      select: (campos) => {
        proyeccion = campos;
        return q;
      },
      eq: (columna, valor) => {
        filtros.push({ tipo: 'eq', columna, valor });
        return q;
      },
      is: (columna, valor) => {
        if (valor === null) filtros.push({ tipo: 'is', columna, valor });
        return q;
      },
      in: (columna, valores) => {
        filtros.push({ tipo: 'in', columna, valores });
        return q;
      },
      or: (expresion) => {
        if (/^qr_token\.eq\./.test(expresion)) {
          filtros.push({
            tipo: 'orQr',
            valor: expresion.split(',')[0].replace('qr_token.eq.', '')
          });
        } else if (expresion === 'qr_usado.eq.false,qr_usado.is.null') {
          filtros.push({ tipo: 'orQrUsado' });
        }
        return q;
      },
      limit: () => {
        modoLista = true;
        return q;
      },
      maybeSingle: () => Promise.resolve(ejecutar()),
      single: () => Promise.resolve(ejecutar()),
      then: (resolve, reject) => Promise.resolve(ejecutar()).then(resolve, reject)
    };

    function ejecutar() {
      if (tabla === 'logs_validacion_qr' && operacion === 'insert') {
        mockEstado.logs.push({ ...datos });
        return { data: null, error: null };
      }

      if (tabla === 'pedidos' && operacion === 'update') {
        const [fila] = resolver(tabla, [...mockEstado.pedidos.values()], filtros);
        if (!fila) return { data: null, error: null };
        Object.assign(fila, datos);
        return { data: { ...fila }, error: null };
      }

      if (tabla === 'pedidos') {
        const filas = resolver(tabla, [...mockEstado.pedidos.values()], filtros);
        if (modoLista) return { data: filas.map((fila) => ({ ...fila })), error: null };
        const [fila] = filas;
        return { data: fila ? { ...fila } : null, error: null };
      }

      if (tabla === 'usuarios') {
        const [fila] = resolver(tabla, [...mockEstado.usuarios.values()], filtros);
        return { data: fila ? { ...fila } : null, error: null };
      }

      if (tabla === 'cafeteria_usuarios') {
        const [fila] = resolver(tabla, mockEstado.cafeteriaUsuarios, filtros);
        return { data: fila ? { ...fila } : null, error: null };
      }

      return { data: null, error: null };
    }

    return q;
  };

  const supabaseFalso = {
    from: jest.fn((tabla) => {
      mockEstado.consultas.push(tabla);
      return {
        select: (campos) => builder(tabla, 'select', null).select(campos),
        update: (datos) => builder(tabla, 'update', datos),
        insert: (datos) => builder(tabla, 'insert', datos)
      };
    })
  };

  return {
    ...actual,
    auth: {
      exigirAuth: (req, res, next) => {
        req.user = { authUserId: req.headers['x-auth-user'] || 'uuid-empleado-a' };
        next();
      }
    },
    supabase: { obtenerCliente: () => supabaseFalso }
  };
});

const app = require('../src/app');

const CAFETERIA_A = 1;
const CAFETERIA_B = 2;

function sembrar({ estadoPedido = 'listo', qrUsado = false } = {}) {
  resetMockEstado();

  mockEstado.usuarios.set('uuid-empleado-a', { id: 20, rol_id: 2, activo: true, auth_user_id: 'uuid-empleado-a' });
  mockEstado.usuarios.set('uuid-empleado-b', { id: 21, rol_id: 2, activo: true, auth_user_id: 'uuid-empleado-b' });
  mockEstado.usuarios.set('uuid-estudiante', { id: 30, rol_id: 1, activo: true, auth_user_id: 'uuid-estudiante' });
  mockEstado.usuarios.set('uuid-inactivo', { id: 22, rol_id: 2, activo: false, auth_user_id: 'uuid-inactivo' });

  mockEstado.cafeteriaUsuarios.push(
    { id: 1, usuario_id: 20, cafeteria_id: CAFETERIA_A },
    { id: 2, usuario_id: 21, cafeteria_id: CAFETERIA_B },
    { id: 3, usuario_id: 22, cafeteria_id: CAFETERIA_A }
  );

  const pedido = {
    id: 100,
    usuario_id: 30,
    cafeteria_id: CAFETERIA_A,
    estado: estadoPedido,
    qr_usado: qrUsado,
    qr_token: 'S3T6-QR-100',
    codigo_retiro_diario: 'S3T6-TOK-100',
    codigo_pedido: 'S3T6-100',
    total: 8500,
    entregado_en: qrUsado ? '2026-11-18T09:00:00.000Z' : null
  };
  mockEstado.pedidos.set(String(pedido.id), pedido);
  return pedido;
}

const entregar = (token, usuario = 'uuid-empleado-a') =>
  request(app)
    .post('/api/pedidos/validar-qr')
    .set('x-auth-user', usuario)
    .send({ qr_token: token });

const pedido100 = () => mockEstado.pedidos.get('100');

describe('POST /api/pedidos/validar-qr', () => {
  test('QR valido: listo -> entregado, qr_usado y entregado_en en una sola operacion', async () => {
    sembrar();
    const res = await entregar('S3T6-QR-100');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ valido: true, motivo: 'entregado' });
    expect(res.body.pedido).toMatchObject({ id: 100, estado: 'entregado', qr_usado: true });
    expect(res.body.pedido.entregado_en).toBeTruthy();

    const pedido = pedido100();
    expect(pedido.estado).toBe('entregado');
    expect(pedido.qr_usado).toBe(true);
    expect(pedido.entregado_en).toBeTruthy();
    expect(mockEstado.logs.filter((l) => l.resultado === 'entregado')).toHaveLength(1);
    expect(res.body.comision).toBeUndefined();
    expect(mockEstado.consultas).not.toContain('movimientos_comision');
  });

  test('token de contingencia persistido ejecuta la misma operacion de entrega', async () => {
    sembrar();
    const res = await entregar('S3T6-TOK-100');

    expect(res.status).toBe(200);
    expect(res.body.valido).toBe(true);
    expect(pedido100()).toMatchObject({ estado: 'entregado', qr_usado: true });
  });

  test('repetir el QR devuelve ya_entregado y no reescribe la entrega', async () => {
    sembrar();
    await entregar('S3T6-QR-100');
    const entregadoEn = pedido100().entregado_en;

    const res = await entregar('S3T6-QR-100');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      valido: false,
      motivo: 'ya_entregado',
      razon: 'Este pedido ya fue entregado.'
    });
    expect(pedido100().entregado_en).toBe(entregadoEn);
    expect(pedido100().qr_usado).toBe(true);
    expect(mockEstado.logs.filter((l) => l.resultado === 'entregado')).toHaveLength(1);
  });

  test('repetir el token y usar la otra credencial del mismo pedido tambien devuelve ya_entregado', async () => {
    sembrar();
    await entregar('S3T6-TOK-100');
    const entregadoEn = pedido100().entregado_en;

    for (const credencial of ['S3T6-TOK-100', 'S3T6-QR-100']) {
      const res = await entregar(credencial);
      expect(res.body).toMatchObject({ valido: false, motivo: 'ya_entregado' });
      expect(res.body.razon).toContain('ya fue entregado');
    }

    expect(pedido100().entregado_en).toBe(entregadoEn);
    expect(mockEstado.logs.filter((l) => l.resultado === 'entregado')).toHaveLength(1);
  });

  test('dos intentos simultaneos: solo el que confirma la transicion devuelve valido true', async () => {
    sembrar();
    const [a, b] = await Promise.all([
      entregar('S3T6-QR-100'),
      entregar('S3T6-TOK-100')
    ]);

    const exitos = [a, b].filter((r) => r.body.valido === true);
    const rechazos = [a, b].filter((r) => r.body.valido === false);

    expect(exitos).toHaveLength(1);
    expect(rechazos).toHaveLength(1);
    expect(rechazos[0].body.motivo).toBe('ya_entregado');
    expect(pedido100()).toMatchObject({ estado: 'entregado', qr_usado: true });
    expect(mockEstado.logs.filter((l) => l.resultado === 'entregado')).toHaveLength(1);
  });

  test('credencial invalida: rechazo sin cambios persistidos', async () => {
    sembrar();
    const antes = { ...pedido100() };

    const res = await entregar('S3T6-NO-EXISTE');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ valido: false, motivo: 'credencial_invalida' });
    expect(pedido100()).toEqual(antes);
    expect(mockEstado.logs).toHaveLength(0);
  });

  test('pedido aun no listo: rechazo sin cambios persistidos', async () => {
    sembrar({ estadoPedido: 'pendiente' });
    const antes = { ...pedido100() };

    const res = await entregar('S3T6-QR-100');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ valido: false, motivo: 'no_listo' });
    expect(res.body.razon).toContain('aún no está listo');
    expect(pedido100()).toEqual(antes);
  });

  test('empleado de otra cafeteria: rechazo sin id, estado ni fecha de entrega', async () => {
    sembrar();
    const antes = { ...pedido100() };

    const res = await entregar('S3T6-QR-100', 'uuid-empleado-b');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ valido: false, motivo: 'sin_autorizacion' });
    expect(res.body.razon).toContain('no pertenece a la cafetería');
    expect(res.body.pedido).toBeUndefined();
    const cuerpo = JSON.stringify(res.body);
    expect(cuerpo).not.toContain('"id"');
    expect(cuerpo).not.toContain('entregado_en');
    expect(cuerpo).not.toContain('"estado"');
    expect(pedido100()).toEqual(antes);
    expect(mockEstado.logs.filter((l) => l.resultado === 'entregado')).toHaveLength(0);
  });

  test('rol no empleado se rechaza ANTES de buscar el pedido y sin datos del pedido', async () => {
    sembrar();
    mockEstado.consultas.length = 0;

    const res = await entregar('S3T6-QR-100', 'uuid-estudiante');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ valido: false, motivo: 'sin_autorizacion' });
    expect(res.body.pedido).toBeUndefined();
    expect(res.body.razon).toContain('Solo un empleado');
    expect(mockEstado.consultas).toContain('usuarios');
    expect(mockEstado.consultas).not.toContain('pedidos');
    expect(mockEstado.consultas).not.toContain('cafeteria_usuarios');
    expect(pedido100()).toMatchObject({ estado: 'listo', qr_usado: false });
  });

  test('empleado inactivo se rechaza antes de buscar el pedido', async () => {
    sembrar();
    mockEstado.consultas.length = 0;

    const res = await entregar('S3T6-QR-100', 'uuid-inactivo');

    expect(res.body).toMatchObject({ valido: false, motivo: 'sin_autorizacion' });
    expect(res.body.pedido).toBeUndefined();
    expect(mockEstado.consultas).not.toContain('pedidos');
    expect(pedido100()).toMatchObject({ estado: 'listo', qr_usado: false });
  });

  test('la entrega valida no consulta comisiones ni columnas de atribucion hipoteticas', async () => {
    sembrar();

    const res = await entregar('S3T6-QR-100');

    expect(res.body).toMatchObject({ valido: true, motivo: 'entregado' });
    expect(res.body.comision).toBeUndefined();
    expect(mockEstado.consultas).not.toContain('movimientos_comision');
    expect(mockEstado.consultas).toContain('pedidos');
    expect(mockEstado.consultas).toContain('logs_validacion_qr');
  });
});
