'use strict';

/**
 * Pruebas HTTP del módulo de afiliados.
 *
 * La RPC de Supabase se sustituye por un doble en memoria para comprobar el
 * contrato de las rutas: sesión, alcance por cafetería, mapeo de C02 a las
 * columnas de public.campanas, errores HTTP y conservación de los campos que
 * lee escritorio. La lógica SQL real se prueba en
 * database/fixes/prueba_administrar_campanas_afiliados.sql.
 */

const fs = require('fs');
const path = require('path');
const request = require('supertest');
const app = require('../src/app');
const crearCliente = require('../src/cliente-autenticado');

jest.mock('../src/cliente-autenticado', () => jest.fn());
jest.mock('@coffeefaster/shared', () => {
  const shared = jest.requireActual('@coffeefaster/shared');
  return {
    ...shared,
    auth: {
      exigirAuth(req, res, next) {
        const token = req.get('Authorization')?.replace(/^Bearer /, '');
        const sesion = sesiones[token];
        if (!token || !sesion) return res.status(401).json({ error: 'sesion_invalida' });
        req.accessToken = token;
        req.user = { id: token, activo: true };
        return next();
      },
    },
  };
});

const sesiones = {
  'sesion-dueno-7': { cafeteria: 7, rol: 'dueno', usuarioId: 1 },
  'sesion-dueno-8': { cafeteria: 8, rol: 'dueno', usuarioId: 2 },
  'sesion-empleado-7': { cafeteria: 7, rol: 'empleado', usuarioId: 3 },
};

const ruta = '/api/afiliados/cafeterias/7/campanas';
const alta = {
  nombre: 'Semana del café',
  descripcion: 'Campaña de prueba',
  descuento_normal_pct: 15,
  descuento_oferta_pct: 5,
  comision_pct: 10,
  inicio: '2099-12-01T08:00:00-03:00',
  fin: '2099-12-15T20:00:00-03:00',
};
const CAMPOS_ESCRITORIO = [
  'id', 'cafeteria_id', 'nombre', 'descripcion', 'estado', 'version_condiciones',
  'tasa_descuento', 'tasa_comision', 'vigencia_desde', 'vigencia_hasta',
  'confirmada_por_dueno', 'fecha_confirmacion', 'usuario_confirma_id',
  'version_confirmada', 'creado_en', 'actualizado_en',
];

let rpc;
let store;
let secuencia;

function filaBase(extra = {}) {
  return {
    id: ++secuencia,
    cafeteria_id: 7,
    nombre: 'Campaña base',
    descripcion: null,
    tipo: 'carrito_completo',
    estado: 'pendiente_aceptacion',
    version_condiciones: '1.0',
    tasa_descuento: 10,
    tasa_descuento_oferta: 3,
    tasa_comision: 5,
    vigencia_desde: '2099-12-01T11:00:00Z',
    vigencia_hasta: '2099-12-15T23:00:00Z',
    confirmada_por_dueno: false,
    fecha_confirmacion: null,
    usuario_confirma_id: null,
    version_confirmada: null,
    creado_en: '2026-11-16T12:00:00Z',
    actualizado_en: '2026-11-16T12:00:00Z',
    ...extra,
  };
}

function aceptar(fila) {
  return {
    ...fila,
    estado: 'aceptada',
    confirmada_por_dueno: true,
    version_confirmada: fila.version_condiciones,
    fecha_confirmacion: '2026-11-16T12:00:00Z',
    usuario_confirma_id: 1,
  };
}

function siguienteVersion(actual) {
  const partes = /^([0-9]+)\.([0-9]+)$/.exec(String(actual || '').trim());
  return partes ? `${partes[1]}.${Number(partes[2]) + 1}` : '9.9';
}

function cambioCondiciones(fila, cambios) {
  const nombre = Object.hasOwn(cambios, 'nombre')
    ? String(cambios.nombre).trim() : fila.nombre;
  const descripcion = Object.hasOwn(cambios, 'descripcion')
    ? (cambios.descripcion === null ? null : (String(cambios.descripcion).trim() || null))
    : fila.descripcion;
  const normal = Object.hasOwn(cambios, 'descuento_normal_pct')
    ? cambios.descuento_normal_pct : fila.tasa_descuento;
  const oferta = Object.hasOwn(cambios, 'descuento_oferta_pct')
    ? cambios.descuento_oferta_pct : fila.tasa_descuento_oferta;
  const comision = Object.hasOwn(cambios, 'comision_pct')
    ? cambios.comision_pct : fila.tasa_comision;
  const inicio = Object.hasOwn(cambios, 'inicio')
    ? cambios.inicio : fila.vigencia_desde;
  const fin = Object.hasOwn(cambios, 'fin')
    ? cambios.fin : fila.vigencia_hasta;

  return nombre !== fila.nombre
    || descripcion !== fila.descripcion
    || normal !== fila.tasa_descuento
    || oferta !== fila.tasa_descuento_oferta
    || comision !== fila.tasa_comision
    || inicio !== fila.vigencia_desde
    || fin !== fila.vigencia_hasta;
}

function cambioTasasOFechas(fila, cambios) {
  return (Object.hasOwn(cambios, 'descuento_normal_pct')
      && cambios.descuento_normal_pct !== fila.tasa_descuento)
    || (Object.hasOwn(cambios, 'descuento_oferta_pct')
      && cambios.descuento_oferta_pct !== fila.tasa_descuento_oferta)
    || (Object.hasOwn(cambios, 'comision_pct')
      && cambios.comision_pct !== fila.tasa_comision)
    || (Object.hasOwn(cambios, 'inicio') && cambios.inicio !== fila.vigencia_desde)
    || (Object.hasOwn(cambios, 'fin') && cambios.fin !== fila.vigencia_hasta);
}

function fakeRpc(nombre, parametros, token) {
  const sesion = sesiones[token];
  const cafeteriaId = parametros.p_cafeteria_id;

  if (nombre === 'listar_campanas_afiliados') {
    if (!sesion || sesion.rol !== 'dueno' || sesion.cafeteria !== cafeteriaId) {
      return { error: { message: 'sin_acceso_cafeteria', code: '42501' } };
    }
    return { data: [...store.values()].filter(fila => fila.cafeteria_id === cafeteriaId) };
  }

  if (nombre !== 'administrar_campana_afiliados') {
    return { error: { message: 'rpc_desconocida', code: 'XXXXX' } };
  }

  if (!sesion || sesion.rol !== 'dueno' || sesion.cafeteria !== cafeteriaId) {
    return { error: { message: 'sin_acceso_cafeteria', code: '42501' } };
  }

  const ahora = Date.parse('2026-11-16T12:00:00Z');
  const cambios = parametros.p_cambios;

  if (parametros.p_campana_id === null) {
    const fila = filaBase({
      cafeteria_id: cafeteriaId,
      nombre: cambios.nombre,
      descripcion: cambios.descripcion ?? null,
      tasa_descuento: cambios.descuento_normal_pct,
      tasa_descuento_oferta: cambios.descuento_oferta_pct,
      tasa_comision: cambios.comision_pct,
      vigencia_desde: cambios.inicio,
      vigencia_hasta: cambios.fin,
    });
    store.set(fila.id, fila);
    return { data: fila };
  }

  const fila = store.get(parametros.p_campana_id);
  if (!fila || fila.cafeteria_id !== cafeteriaId) {
    return { error: { message: 'sin_acceso_cafeteria', code: '42501' } };
  }

  if (fila.estado === 'finalizada' || ahora >= Date.parse(fila.vigencia_hasta)) {
    return { error: { message: 'campana_finalizada' } };
  }

  const soloEstado = Object.keys(cambios).length === 1 && Object.hasOwn(cambios, 'pausada');
  if (soloEstado) {
    if (cambios.pausada) {
      if (fila.estado === 'pausada') return { data: fila };
      if (!['activa', 'aceptada'].includes(fila.estado) &&
          !(fila.confirmada_por_dueno && fila.version_confirmada === fila.version_condiciones)) {
        return { error: { message: 'campana_no_activa' } };
      }
      fila.estado = 'pausada';
    } else {
      if (!fila.confirmada_por_dueno || fila.version_confirmada !== fila.version_condiciones) {
        return { error: { message: 'aceptacion_requerida' } };
      }
      fila.estado = ahora < Date.parse(fila.vigencia_desde) ? 'aceptada' : 'activa';
    }
    fila.actualizado_en = '2026-11-16T12:00:01Z';
    return { data: fila };
  }

  const confirmada = Boolean(fila.confirmada_por_dueno);
  const aceptada = confirmada && fila.version_confirmada === fila.version_condiciones;
  const cambioCond = cambioCondiciones(fila, cambios);
  if (confirmada && cambioCond) {
    return { error: { message: 'condiciones_aceptadas' } };
  }
  if (ahora >= Date.parse(fila.vigencia_desde) && cambioTasasOFechas(fila, cambios)) {
    return { error: { message: 'porcentajes_fijados' } };
  }
  if (cambioCond) {
    fila.version_condiciones = siguienteVersion(fila.version_condiciones);
  }

  if (Object.hasOwn(cambios, 'nombre')) fila.nombre = String(cambios.nombre).trim();
  if (Object.hasOwn(cambios, 'descripcion')) {
    fila.descripcion = cambios.descripcion === null
      ? null : (String(cambios.descripcion).trim() || null);
  }
  if (Object.hasOwn(cambios, 'descuento_normal_pct')) fila.tasa_descuento = cambios.descuento_normal_pct;
  if (Object.hasOwn(cambios, 'descuento_oferta_pct')) fila.tasa_descuento_oferta = cambios.descuento_oferta_pct;
  if (Object.hasOwn(cambios, 'comision_pct')) fila.tasa_comision = cambios.comision_pct;
  if (Object.hasOwn(cambios, 'inicio')) fila.vigencia_desde = cambios.inicio;
  if (Object.hasOwn(cambios, 'fin')) fila.vigencia_hasta = cambios.fin;
  fila.actualizado_en = '2026-11-16T12:00:01Z';
  return { data: fila };
}

beforeEach(() => {
  store = new Map();
  secuencia = 0;
  rpc = jest.fn(fakeRpc);
  crearCliente.mockReset().mockImplementation(token => ({
    rpc: (nombre, parametros) => rpc(nombre, parametros, token),
  }));
});

function guardar(fila) {
  store.set(fila.id, fila);
  secuencia = Math.max(secuencia, fila.id);
  return fila;
}

describe('administración de campañas sobre public.campanas', () => {
  test('POST crea y GET lee la misma campaña con los campos de escritorio y los alias de C02', async () => {
    const creada = await request(app)
      .post(ruta)
      .set('Authorization', 'Bearer sesion-dueno-7')
      .send(alta);

    expect(creada.status).toBe(201);
    expect(crearCliente).toHaveBeenCalledWith('sesion-dueno-7');
    expect(creada.body).toMatchObject({
      cafeteria_id: 7,
      nombre: alta.nombre,
      descripcion: alta.descripcion,
      estado: 'programada',
      estado_db: 'pendiente_aceptacion',
      descuento_normal_pct: 15,
      descuento_oferta_pct: 5,
      comision_pct: 10,
      tasa_descuento: 15,
      tasa_descuento_oferta: 5,
      tasa_comision: 10,
      inicio: alta.inicio,
      fin: alta.fin,
      version_condiciones: '1.0',
      confirmada_por_dueno: false,
    });
    for (const campo of CAMPOS_ESCRITORIO) expect(creada.body).toHaveProperty(campo);
    expect(creada.body).not.toHaveProperty('dueno_campana_id');

    const listado = await request(app)
      .get(`${ruta}/administracion`)
      .set('Authorization', 'Bearer sesion-dueno-7');

    expect(listado.status).toBe(200);
    expect(listado.body.campanas).toHaveLength(1);
    expect(listado.body.campanas[0]).toMatchObject({
      id: creada.body.id,
      cafeteria_id: 7,
      estado: 'programada',
      estado_db: 'pendiente_aceptacion',
      descuento_oferta_pct: 5,
    });
    for (const campo of CAMPOS_ESCRITORIO) expect(listado.body.campanas[0]).toHaveProperty(campo);
    expect(listado.body.campanas[0]).not.toHaveProperty('dueno_campana_id');
    expect(rpc).toHaveBeenLastCalledWith('listar_campanas_afiliados', { p_cafeteria_id: 7 }, 'sesion-dueno-7');
  });

  test('el listado administrativo solo devuelve campañas de la cafetería autorizada', async () => {
    guardar(filaBase({ cafeteria_id: 7, nombre: 'Cafetería 7' }));
    guardar(filaBase({ cafeteria_id: 8, nombre: 'Cafetería 8' }));

    const siete = await request(app).get(`${ruta}/administracion`).set('Authorization', 'Bearer sesion-dueno-7');
    const ocho = await request(app)
      .get('/api/afiliados/cafeterias/8/campanas/administracion')
      .set('Authorization', 'Bearer sesion-dueno-8');

    expect(siete.status).toBe(200);
    expect(ocho.status).toBe(200);
    expect(siete.body.campanas.map(c => c.nombre)).toEqual(['Cafetería 7']);
    expect(ocho.body.campanas.map(c => c.nombre)).toEqual(['Cafetería 8']);
  });

  test('GET con una respuesta que no es arreglo devuelve 503 y no inventa campañas', async () => {
    rpc.mockResolvedValueOnce({ data: { campanas: [] } });
    const respuesta = await request(app).get(`${ruta}/administracion`).set('Authorization', 'Bearer sesion-dueno-7');
    expect(respuesta.status).toBe(503);
    expect(respuesta.body).not.toHaveProperty('campanas');
  });

  test('PATCH permite editar antes de la aceptación y conserva el descuento de oferta', async () => {
    const creada = await request(app).post(ruta).set('Authorization', 'Bearer sesion-dueno-7').send(alta);
    const editada = await request(app)
      .patch(`${ruta}/${creada.body.id}`)
      .set('Authorization', 'Bearer sesion-dueno-7')
      .send({ nombre: 'Semana editada', descuento_normal_pct: 12 });

    expect(editada.status).toBe(200);
    expect(editada.body).toMatchObject({
      id: creada.body.id,
      nombre: 'Semana editada',
      descuento_normal_pct: 12,
      descuento_oferta_pct: 5,
      comision_pct: 10,
      estado: 'programada',
      estado_db: 'pendiente_aceptacion',
      version_condiciones: '1.1',
    });
    expect(rpc).toHaveBeenLastCalledWith(
      'administrar_campana_afiliados',
      { p_cafeteria_id: 7, p_campana_id: creada.body.id, p_cambios: { nombre: 'Semana editada', descuento_normal_pct: 12 } },
      'sesion-dueno-7'
    );
  });

  test('PATCH con valores idénticos no versiona y cambiar solo oferta sí versiona', async () => {
    const creada = await request(app).post(ruta).set('Authorization', 'Bearer sesion-dueno-7').send(alta);
    const misma = await request(app)
      .patch(`${ruta}/${creada.body.id}`)
      .set('Authorization', 'Bearer sesion-dueno-7')
      .send({ nombre: alta.nombre, descripcion: alta.descripcion, descuento_normal_pct: 15 });
    const oferta = await request(app)
      .patch(`${ruta}/${creada.body.id}`)
      .set('Authorization', 'Bearer sesion-dueno-7')
      .send({ descuento_oferta_pct: 6 });

    expect(misma.status).toBe(200);
    expect(misma.body.version_condiciones).toBe('1.0');
    expect(oferta.status).toBe(200);
    expect(oferta.body).toMatchObject({
      version_condiciones: '1.1',
      descuento_oferta_pct: 6,
      descuento_normal_pct: 15,
    });
  });

  test('PATCH rechaza nombre, descripción, tasas y fechas aceptadas', async () => {
    const creada = await request(app).post(ruta).set('Authorization', 'Bearer sesion-dueno-7').send(alta);
    const fila = store.get(creada.body.id);
    Object.assign(fila, aceptar(fila));

    for (const cambios of [
      { nombre: 'Nombre prohibido' },
      { descripcion: 'Descripción prohibida' },
      { descuento_normal_pct: 20 },
      { descuento_oferta_pct: 2 },
      { comision_pct: 2 },
      { inicio: '2020-01-01T00:00:00Z' },
      { fin: '2030-01-01T00:00:00Z' },
    ]) {
      const respuesta = await request(app)
        .patch(`${ruta}/${creada.body.id}`)
        .set('Authorization', 'Bearer sesion-dueno-7')
        .send(cambios);
      expect(respuesta.status).toBe(409);
      expect(respuesta.body).toEqual({ error: 'condiciones_aceptadas' });
    }
    expect(store.get(creada.body.id).tasa_descuento).toBe(15);
    expect(store.get(creada.body.id).version_condiciones).toBe('1.0');
  });

  test('PATCH pausa, reanuda una campaña futura y conserva aceptación y condiciones', async () => {
    const creada = await request(app).post(ruta).set('Authorization', 'Bearer sesion-dueno-7').send(alta);
    const fila = store.get(creada.body.id);
    Object.assign(fila, aceptar(fila));

    const pausada = await request(app)
      .patch(`${ruta}/${creada.body.id}`)
      .set('Authorization', 'Bearer sesion-dueno-7')
      .send({ pausada: true });
    expect(pausada.status).toBe(200);
    expect(pausada.body).toMatchObject({ estado: 'pausada', estado_db: 'pausada' });

    const reanudada = await request(app)
      .patch(`${ruta}/${creada.body.id}`)
      .set('Authorization', 'Bearer sesion-dueno-7')
      .send({ pausada: false });
    expect(reanudada.status).toBe(200);
    expect(reanudada.body).toMatchObject({
      estado: 'programada',
      estado_db: 'aceptada',
      descuento_normal_pct: 15,
      descuento_oferta_pct: 5,
      comision_pct: 10,
      confirmada_por_dueno: true,
      version_confirmada: '1.0',
    });
  });

  test('PATCH reanuda una campaña activa como activa', async () => {
    const fila = guardar(aceptar(filaBase({
      estado: 'activa',
      vigencia_desde: '2020-01-01T00:00:00Z',
      vigencia_hasta: '2099-01-01T00:00:00Z',
    })));

    const pausada = await request(app)
      .patch(`${ruta}/${fila.id}`)
      .set('Authorization', 'Bearer sesion-dueno-7')
      .send({ pausada: true });
    const reanudada = await request(app)
      .patch(`${ruta}/${fila.id}`)
      .set('Authorization', 'Bearer sesion-dueno-7')
      .send({ pausada: false });

    expect(pausada.body.estado).toBe('pausada');
    expect(reanudada.body).toMatchObject({ estado: 'activa', estado_db: 'activa' });
  });

  test('activar sin aceptación y reanudar una campaña finalizada devuelven 409', async () => {
    const pendiente = guardar(filaBase());
    const finalizada = guardar(aceptar(filaBase({
      estado: 'finalizada',
      vigencia_desde: '2020-01-01T00:00:00Z',
      vigencia_hasta: '2021-01-01T00:00:00Z',
    })));

    const sinAceptacion = await request(app)
      .patch(`${ruta}/${pendiente.id}`)
      .set('Authorization', 'Bearer sesion-dueno-7')
      .send({ pausada: false });
    const terminada = await request(app)
      .patch(`${ruta}/${finalizada.id}`)
      .set('Authorization', 'Bearer sesion-dueno-7')
      .send({ pausada: false });

    expect(sinAceptacion.status).toBe(409);
    expect(sinAceptacion.body).toEqual({ error: 'aceptacion_requerida' });
    expect(terminada.status).toBe(409);
    expect(terminada.body).toEqual({ error: 'campana_finalizada' });
  });

  test('dueño ajeno, empleado y campaña ajena con cafetería propia reciben 403', async () => {
    const propia = guardar(filaBase({ cafeteria_id: 7, nombre: 'Propia' }));
    const ajena = guardar(filaBase({ cafeteria_id: 8, nombre: 'Ajena' }));

    const ajeno = await request(app)
      .patch(`${ruta}/${propia.id}`)
      .set('Authorization', 'Bearer sesion-dueno-8')
      .send({ nombre: 'Intento ajeno' });
    const empleado = await request(app)
      .patch(`${ruta}/${propia.id}`)
      .set('Authorization', 'Bearer sesion-empleado-7')
      .send({ pausada: true });
    const cruzada = await request(app)
      .patch(`/api/afiliados/cafeterias/8/campanas/${propia.id}`)
      .set('Authorization', 'Bearer sesion-dueno-8')
      .send({ nombre: 'Campaña de 7 con URL 8' });
    const listadoAjeno = await request(app)
      .get(`${ruta}/administracion`)
      .set('Authorization', 'Bearer sesion-dueno-8');
    const listadoPostulables = await request(app)
      .get(`${ruta}?postulables=true`)
      .set('Authorization', 'Bearer sesion-empleado-7');

    expect([ajeno.status, empleado.status, cruzada.status, listadoAjeno.status, listadoPostulables.status])
      .toEqual([403, 403, 403, 403, 400]);
    expect(ajeno.body).toEqual({ error: 'sin_acceso_cafeteria' });
    expect(empleado.body).toEqual({ error: 'sin_acceso_cafeteria' });
    expect(cruzada.body).toEqual({ error: 'sin_acceso_cafeteria' });
    expect(listadoAjeno.body).toEqual({ error: 'sin_acceso_cafeteria' });
    expect(store.get(ajena.id).cafeteria_id).toBe(8);
  });

  test('sin sesión o con sesión inválida devuelve 401', async () => {
    await request(app).post(ruta).send(alta).expect(401);
    await request(app).get(`${ruta}/administracion`).set('Authorization', 'Bearer sesion-invalida').expect(401);
    await request(app).patch(`${ruta}/31`).set('Authorization', 'Bearer sesion-invalida').send({ pausada: true }).expect(401);
  });

  test('la consulta de vigentes rechaza postulables sin consultar la RPC administrativa', async () => {
    rpc.mockClear();
    for (const token of ['sesion-dueno-7', 'sesion-empleado-7']) {
      const respuesta = await request(app).get(`${ruta}?postulables=true`)
        .set('Authorization', `Bearer ${token}`).expect(400);
      expect(respuesta.body.error).toBe('parametros_no_admitidos');
    }
    for (const consulta of ['?postulables=false', '?postulables=true&extra=1']) {
      await request(app).get(`${ruta}${consulta}`)
        .set('Authorization', 'Bearer sesion-dueno-7').expect(400);
    }
    await request(app).get(`${ruta}?postulables=true`).expect(401);
    expect(rpc).not.toHaveBeenCalled();
  });

  test('rechaza identificadores inválidos antes de invocar la RPC', async () => {
    await request(app)
      .get('/api/afiliados/cafeterias/0/campanas/administracion')
      .set('Authorization', 'Bearer sesion-dueno-7')
      .expect(400);
    await request(app)
      .post('/api/afiliados/cafeterias/abc/campanas')
      .set('Authorization', 'Bearer sesion-dueno-7')
      .send(alta)
      .expect(400);
    await request(app)
      .patch('/api/afiliados/cafeterias/7/campanas/0')
      .set('Authorization', 'Bearer sesion-dueno-7')
      .send({ pausada: true })
      .expect(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  test('valida el cuerpo antes de invocar la RPC', async () => {
    const casos = [
      ['post', ruta, { ...alta, descuento_oferta_pct: 20 }, 'descuento de oferta mayor'],
      ['post', ruta, { ...alta, inicio: '2099-12-15T08:00:00-03:00', fin: '2099-12-01T20:00:00-03:00' }, 'fin anterior'],
      ['post', ruta, { ...alta, descuento_normal_pct: '15' }, 'porcentaje como texto'],
      ['post', ruta, { ...alta, campo_extra: 1 }, 'campo desconocido'],
      ['patch', `${ruta}/31`, { version_condiciones: '9.9' }, 'versión enviada por el cliente'],
      ['patch', `${ruta}/31`, { cafeteria_id: 8 }, 'reasignar cafetería'],
      ['patch', `${ruta}/31`, { pausada: 'true' }, 'pausada no booleana'],
      ['patch', `${ruta}/31`, { pausada: true, nombre: 'Mezcla' }, 'estado mezclado'],
      ['patch', `${ruta}/31`, {}, 'cuerpo vacío'],
    ];

    for (const [metodo, url, cuerpo] of casos) {
      const respuesta = await request(app)[metodo](url)
        .set('Authorization', 'Bearer sesion-dueno-7')
        .send(cuerpo);
      expect(respuesta.status).toBe(422);
      expect(respuesta.body).toEqual({ error: 'campana_invalida' });
    }
    expect(rpc).not.toHaveBeenCalled();
  });

  test.each([
    ['condiciones_aceptadas', 409, 'condiciones_aceptadas'],
    ['porcentajes_fijados', 409, 'porcentajes_fijados'],
    ['campana_finalizada', 409, 'campana_finalizada'],
    ['campana_no_activa', 409, 'campana_no_activa'],
    ['aceptacion_requerida', 409, 'aceptacion_requerida'],
    ['campana_invalida', 422, 'campana_invalida'],
    ['sin_acceso_cafeteria', 403, 'sin_acceso_cafeteria'],
    ['La aceptación es inmutable; cree una nueva campaña para otras condiciones',
      409, 'condiciones_aceptadas'],
    ['Cambiar condiciones requiere una nueva versión', 422, 'campana_invalida'],
  ])('traduce el rechazo SQL %s a HTTP %i', async (mensaje, status, esperado) => {
    rpc.mockResolvedValueOnce({ error: { message: mensaje, code: '22023' } });
    const respuesta = await request(app)
      .patch(`${ruta}/31`)
      .set('Authorization', 'Bearer sesion-dueno-7')
      .send({ pausada: false });
    expect(respuesta.status).toBe(status);
    expect(respuesta.body).toEqual({ error: esperado });
  });

  test('un 42501 inesperado no se convierte en conflicto de negocio', async () => {
    rpc.mockResolvedValueOnce({
      error: { message: 'Utilice la RPC para confirmar condiciones', code: '42501' },
    });
    const respuesta = await request(app)
      .patch(`${ruta}/31`)
      .set('Authorization', 'Bearer sesion-dueno-7')
      .send({ pausada: false });
    expect(respuesta.status).toBe(503);
    expect(respuesta.body).not.toEqual({ error: 'condiciones_aceptadas' });
  });

  test('un fallo inesperado de la RPC se responde como 503 sin datos inventados', async () => {
    rpc.mockResolvedValueOnce({ error: { message: 'connection refused', code: 'ECONNREFUSED' } });
    const respuesta = await request(app)
      .post(ruta)
      .set('Authorization', 'Bearer sesion-dueno-7')
      .send(alta);
    expect(respuesta.status).toBe(503);
    expect(respuesta.body).not.toHaveProperty('id');
  });

  test('los dos gateways exponen /api/afiliados hacia ms-pedidos', () => {
    const compose = fs.readFileSync(path.resolve(__dirname, '../../gateway/nginx.conf'), 'utf8');
    const k8s = fs.readFileSync(path.resolve(__dirname, '../../../k8s-next/gateway/nginx.conf'), 'utf8');
    for (const configuracion of [compose, k8s]) {
      expect(configuracion).toMatch(/location\s+\/api\/afiliados\s*\{/);
      expect(configuracion).toMatch(/ms-pedidos[^;]*:3005/);
    }
  });
});
