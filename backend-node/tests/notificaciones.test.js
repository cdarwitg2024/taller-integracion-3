const request = require('supertest');
const jwt = require('jsonwebtoken');

jest.mock('../src/config/supabase');
jest.mock('../src/clients/inventario.client', () => ({
  verificarDisponibilidad: jest.fn().mockResolvedValue(undefined),
  descontarStock: jest.fn().mockResolvedValue({ ok: true }),
  reponerStock: jest.fn().mockResolvedValue({ ok: true })
}));

const supabase = require('../src/config/supabase');
const app = require('../src/app');
const FcmService = require('../src/modules/notificaciones/fcm.service');
const NotificacionesService = require('../src/modules/notificaciones/notificaciones.service');
const PedidosService = require('../src/modules/pedidos/pedidos.service');
const { sembrarProductosBase } = require('./helpers/sembrarProductos');

const JWT_SECRET = 'secret-de-pruebas-notificaciones';
process.env.JWT_SECRET = JWT_SECRET;

const TOKEN_DISPOSITIVO = 'fcm-token-app-android-abcdef123456';

function tokenDe(usuarioId) {
  return jwt.sign({ id: usuarioId }, JWT_SECRET, { expiresIn: '1h' });
}

function authDe(usuarioId) {
  return `Bearer ${tokenDe(usuarioId)}`;
}

function sembrarUsuario(usuario) {
  supabase.__seed('usuarios', [{ activo: true, ...usuario }]);
}

// Helpers de la sección "Manejo de errores de FCM"
const crypto = require('crypto');

let clavePrueba = null;
function claveRsaDePrueba() {
  if (!clavePrueba) {
    clavePrueba = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      publicKeyEncoding: { type: 'spki', format: 'pem' }
    }).privateKey;
  }
  return clavePrueba;
}

function activarCredencialesFalso() {
  process.env.FCM_PROJECT_ID = 'proyecto-demo';
  process.env.FCM_CLIENT_EMAIL = 'firebase@proyecto-demo.iam.gserviceaccount.com';
  process.env.FCM_PRIVATE_KEY = claveRsaDePrueba();
  FcmService.__resetCache();
}

/**
 * Intercepta las dos llamadas que hace el servicio: el intercambio del JWT por
 * un access token (oauth2) y el envío del mensaje (fcm). Las respuestas de
 * envío se consumed de una cola para poder fallar uno y enviar otro.
 */
function mockFcm(respuestasEnvio) {
  global.fetch = jest.fn().mockImplementation(async (url) => {
    if (String(url).includes('oauth2.googleapis.com')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ access_token: 'access-token-de-prueba', expires_in: 3600 })
      };
    }
    const siguiente = respuestasEnvio.shift() || { ok: true, status: 200, json: {} };
    return { ok: siguiente.ok, status: siguiente.status, json: async () => siguiente.json };
  });
}

beforeEach(() => {
  supabase.__reset();
  sembrarProductosBase();
  sembrarUsuario({ id: 7, email: 'estudiante@coffefast.edu.co', nombre: 'Ana' });
  sembrarUsuario({ id: 8, email: 'otro@coffefast.edu.co', nombre: 'Luis' });
  delete process.env.FCM_PROJECT_ID;
  delete process.env.FCM_CLIENT_EMAIL;
  delete process.env.FCM_PRIVATE_KEY;
  FcmService.__resetCache();
});

describe('Módulo de Notificaciones (FCM)', () => {
  describe('POST /api/notificaciones/registro', () => {
    test('Debe rechazar el registro sin token JWT', async () => {
      const res = await request(app)
        .post('/api/notificaciones/registro')
        .send({ token: TOKEN_DISPOSITIVO, plataforma: 'android' });

      expect(res.status).toBe(401);
    });

    test('Debe rechazar el registro sin token de dispositivo', async () => {
      const res = await request(app)
        .post('/api/notificaciones/registro')
        .set('Authorization', authDe(7))
        .send({ plataforma: 'android' });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/token FCM/i);
    });

    test('Debe registrar el token tomando el usuario del JWT, no del body', async () => {
      const res = await request(app)
        .post('/api/notificaciones/registro')
        .set('Authorization', authDe(7))
        .send({ token: TOKEN_DISPOSITIVO, plataforma: 'android', usuario_id: 999 });

      expect(res.status).toBe(201);
      expect(res.body.ok).toBe(true);

      const guardados = supabase.__tabla('dispositivos');
      expect(guardados).toHaveLength(1);
      expect(guardados[0].usuario_id).toBe(7); // no el 999 del body
      expect(guardados[0].token_fcm).toBe(TOKEN_DISPOSITIVO);
      expect(guardados[0].activo).toBe(true);
    });

    test('No debe duplicar el token si el mismo dispositivo se registra otra vez', async () => {
      await request(app)
        .post('/api/notificaciones/registro')
        .set('Authorization', authDe(7))
        .send({ token: TOKEN_DISPOSITIVO, plataforma: 'android' });

      const res = await request(app)
        .post('/api/notificaciones/registro')
        .set('Authorization', authDe(7))
        .send({ token: TOKEN_DISPOSITIVO, plataforma: 'ios' });

      expect(res.status).toBe(201);
      const guardados = supabase.__tabla('dispositivos');
      expect(guardados).toHaveLength(1);
      expect(guardados[0].plataforma).toBe('ios'); // se actualiza, no se inserta otro
    });
  });

  describe('DELETE /api/notificaciones/registro', () => {
    test('Debe desactivar el token propio del usuario', async () => {
      await request(app)
        .post('/api/notificaciones/registro')
        .set('Authorization', authDe(7))
        .send({ token: TOKEN_DISPOSITIVO, plataforma: 'android' });

      const res = await request(app)
        .delete('/api/notificaciones/registro')
        .set('Authorization', authDe(7))
        .send({ token: TOKEN_DISPOSITIVO });

      expect(res.status).toBe(200);
      expect(res.body.desregistrado).toBe(true);
      expect(supabase.__tabla('dispositivos')[0].activo).toBe(false);
    });

    test('No debe desactivar el token de otro usuario', async () => {
      await request(app)
        .post('/api/notificaciones/registro')
        .set('Authorization', authDe(7))
        .send({ token: TOKEN_DISPOSITIVO, plataforma: 'android' });

      const res = await request(app)
        .delete('/api/notificaciones/registro')
        .set('Authorization', authDe(8))
        .send({ token: TOKEN_DISPOSITIVO });

      expect(res.status).toBe(200);
      expect(res.body.desregistrado).toBe(false);
      expect(supabase.__tabla('dispositivos')[0].activo).toBe(true);
    });
  });

  describe('GET /api/notificaciones/estado', () => {
    test('Debe reportar modo simulación cuando no hay credenciales de FCM', async () => {
      const res = await request(app)
        .get('/api/notificaciones/estado')
        .set('Authorization', authDe(7));

      expect(res.status).toBe(200);
      expect(res.body.modo).toBe('simulacion');
      expect(res.body.fcm_configurado).toBe(false);
      expect(res.body.eventos).toEqual(expect.arrayContaining(['en_preparacion', 'listo']));
    });
  });

  describe('POST /api/notificaciones/prueba', () => {
    test('Debe avisar cuando el usuario no tiene dispositivos registrados', async () => {
      const res = await request(app)
        .post('/api/notificaciones/prueba')
        .set('Authorization', authDe(7))
        .send({});

      expect(res.status).toBe(404);
      expect(res.body.error).toMatch(/dispositivos/i);
    });

    test('Debe enviar la notificación de prueba en modo simulación', async () => {
      supabase.__seed('dispositivos', [
        { id: 1, usuario_id: 7, token_fcm: TOKEN_DISPOSITIVO, plataforma: 'android', activo: true }
      ]);

      const res = await request(app)
        .post('/api/notificaciones/prueba')
        .set('Authorization', authDe(7))
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.enviados).toBe(1);
      expect(res.body.fallidos).toBe(0);
      expect(res.body.modo).toBe('simulacion');
    });
  });

  describe('Notificación automática al cambiar de estado', () => {
    let pedido;

    beforeEach(async () => {
      supabase.__seed('dispositivos', [
        { id: 1, usuario_id: 7, token_fcm: TOKEN_DISPOSITIVO, plataforma: 'android', activo: true }
      ]);
      supabase.__seed('cafeterias', [{ id: 'cafe-central-01', nombre: 'Cafetería Central' }]);

      pedido = await PedidosService.crearPedido({
        usuario_id: 7,
        cafeteria_id: 'cafe-central-01',
        franja_retiro: '10:15 - 10:25',
        productos: [
          {
            producto_id: 'prod-cafe-americano',
            nombre: 'Café Americano',
            cantidad: 1,
            precio_unitario: 1800
          }
        ]
      });
    });

    test('Debe notificar al pasar a "En preparación"', async () => {
      const spy = jest.spyOn(NotificacionesService, 'notificarPedido');

      const res = await request(app)
        .patch(`/api/pedidos/${pedido.id}/estado`)
        .send({ estado: 'preparando' }); // el KDS envía el alias

      expect(res.status).toBe(200);
      expect(res.body.pedido.estado).toBe('En preparación');
      expect(spy).toHaveBeenCalledWith(expect.objectContaining({ usuario_id: 7 }), 'en_preparacion');
      spy.mockRestore();
    });

    test('Debe notificar al pasar a "Listo"', async () => {
      await PedidosService.updateEstado(pedido.id, 'En preparación');
      const spy = jest.spyOn(NotificacionesService, 'notificarPedido');

      const res = await request(app)
        .patch(`/api/pedidos/${pedido.id}/estado`)
        .send({ estado: 'Listo' });

      expect(res.status).toBe(200);
      expect(res.body.pedido.estado).toBe('Listo');
      expect(spy).toHaveBeenCalledWith(expect.objectContaining({ usuario_id: 7 }), 'listo');
      spy.mockRestore();
    });

    test('No debe notificar en transiciones sin evento (ej. Retirado)', async () => {
      await PedidosService.updateEstado(pedido.id, 'En preparación');
      await PedidosService.updateEstado(pedido.id, 'Listo');
      const spy = jest.spyOn(NotificacionesService, 'notificarPedido');
      spy.mockClear();

      await PedidosService.updateEstado(pedido.id, 'Retirado');

      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    });
  });

  describe('Manejo de errores de FCM', () => {
    afterEach(() => {
      delete global.fetch;
      FcmService.__resetCache();
    });

    test('Debe desactivar el token cuando FCM responde UNREGISTERED', async () => {
      activarCredencialesFalso();
      supabase.__seed('dispositivos', [
        { id: 1, usuario_id: 7, token_fcm: 'token-caducado-123', plataforma: 'android', activo: true }
      ]);

      mockFcm([
        {
          ok: false,
          status: 404,
          json: {
            error: {
              status: 'UNREGISTERED',
              message: 'Requested entity was not found.'
            }
          }
        }
      ]);

      const resumen = await NotificacionesService.notificarPedido(
        { id: 1, usuario_id: 7, cafeteria_id: 'cafe-central-01' },
        'listo'
      );

      expect(resumen.enviados).toBe(0);
      expect(resumen.fallidos).toBe(1);
      expect(resumen.tokens_invalidos).toBe(1);
      expect(supabase.__tabla('dispositivos')[0].activo).toBe(false);
    });

    test('Un token caído no debe impedir enviar a los demás dispositivos', async () => {
      activarCredencialesFalso();
      supabase.__seed('dispositivos', [
        { id: 1, usuario_id: 7, token_fcm: 'token-bueno-1', plataforma: 'android', activo: true },
        { id: 2, usuario_id: 7, token_fcm: 'token-canonico-2', plataforma: 'android', activo: true }
      ]);

      mockFcm([
        { ok: false, status: 404, json: { error: { status: 'UNREGISTERED', message: 'no existe' } } },
        { ok: true, status: 200, json: { name: 'projects/x/messages/1' } }
      ]);

      const resumen = await NotificacionesService.notificarPedido(
        { id: 1, usuario_id: 7, cafeteria_id: 'cafe-central-01' },
        'en_preparacion'
      );

      expect(resumen.total_tokens).toBe(2);
      expect(resumen.enviados).toBe(1);
      expect(resumen.fallidos).toBe(1);
    });

    test('El pedido debe quedar en "Listo" aunque FCM esté caído', async () => {
      supabase.__seed('dispositivos', [
        { id: 1, usuario_id: 7, token_fcm: 'token-cualquiera', plataforma: 'android', activo: true }
      ]);
      supabase.__seed('cafeterias', [{ id: 'cafe-central-01', nombre: 'Cafetería Central' }]);

      const pedido = await PedidosService.crearPedido({
        usuario_id: 7,
        cafeteria_id: 'cafe-central-01',
        franja_retiro: '10:15 - 10:25',
        productos: [
          {
            producto_id: 'prod-cafe-americano',
            nombre: 'Café Americano',
            cantidad: 1,
            precio_unitario: 1800
          }
        ]
      });

      const spy = jest
        .spyOn(NotificacionesService, 'notificarPedido')
        .mockRejectedValue(new Error('FCM no responde'));

      const res = await request(app)
        .patch(`/api/pedidos/${pedido.id}/estado`)
        .send({ estado: 'En preparación' });

      expect(res.status).toBe(200);
      expect(res.body.pedido.estado).toBe('En preparación'); // la transición NO se revierte
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });
  });
});
