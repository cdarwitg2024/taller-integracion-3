// Envío de notificaciones push a Firebase Cloud Messaging (FCM HTTP v1).
//
// Se usa la API HTTP oficial con `fetch` y la firma RS256 del service account
// hecha con el módulo `crypto` de Node, para no agregar dependencias nuevas
// (firebase-admin pesa decenas de MB en la imagen Docker).
//
// Si faltan las credenciales, el servicio entra en MODO SIMULACIÓN: registra
// el envío en el log y responde ok. Así el flujo completo (registro de token +
// disparo por cambio de estado) se puede probar de extremo a extremo sin
// credenciales reales, y solo hay que configurar las variables de entorno para
// activar el envío real.

const crypto = require('crypto');

const SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const FCM_URL = 'https://fcm.googleapis.com/v1/projects';

// Códigos de error de FCM que significan "este token ya no sirve".
const ERRORES_TOKEN_INVALIDO = ['UNREGISTERED', 'INVALID_ARGUMENT', 'SENDER_ID_MISMATCH'];

let cacheToken = { token: null, expiraEn: 0 };

function credenciales() {
  return {
    projectId: process.env.FCM_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || '',
    clientEmail: process.env.FCM_CLIENT_EMAIL || process.env.FIREBASE_CLIENT_EMAIL || '',
    // La clave privada suele pegarse con \n literales al ponerla en un .env,
    // y el JSON de Firebase viene con \r\n.
    privateKey: (process.env.FCM_PRIVATE_KEY || process.env.FIREBASE_PRIVATE_KEY || '')
      .replace(/\\r\\n/g, '\\n')
      .replace(/\\n/g, '\n')
      .trim()
  };
}

function base64url(entrada) {
  return Buffer.from(entrada)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

const FcmService = {
  estaConfigurado() {
    const { projectId, clientEmail, privateKey } = credenciales();
    return Boolean(projectId && clientEmail && privateKey);
  },

  modo() {
    return FcmService.estaConfigurado() ? 'real' : 'simulacion';
  },

  /** Estado para exponer en /api/notificaciones/estado. */
  estado() {
    const { projectId, clientEmail } = credenciales();
    return {
      modo: FcmService.modo(),
      fcm_configurado: FcmService.estaConfigurado(),
      project_id: projectId || null,
      client_email: clientEmail || null
    };
  },

  /**
   * Envía una notificación a un token.
   * @returns {{ok: true, modo: string, id?: string}}
   * @throws  Error con `tokenInvalido = true` si FCM dice que el token ya no existe.
   */
  async enviar({ token, titulo, cuerpo, data }) {
    if (!token) throw new Error('Token FCM vacío');

    if (!FcmService.estaConfigurado()) {
      console.log(
        `[fcm:simulacion] token=${recortarToken(token)} | "${titulo}" - "${cuerpo}" | data=${JSON.stringify(data || {})}`
      );
      return { ok: true, modo: 'simulacion' };
    }

    const accessToken = await FcmService.obtenerAccessToken();
    const { projectId } = credenciales();

    let respuesta;
    try {
      respuesta = await fetch(`${FCM_URL}/${encodeURIComponent(projectId)}/messages:send`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: {
            token,
            notification: { title: titulo, body: cuerpo },
            // FCM exige que los valores de `data` sean strings
            data: Object.entries(data || {}).reduce((acc, [clave, valor]) => {
              acc[clave] = String(valor);
              return acc;
            }, {})
          }
        })
      });
    } catch (errorConexion) {
      const error = new Error(`No se pudo conectar con FCM: ${errorConexion.message}`);
      error.tokenInvalido = false;
      throw error;
    }

    const cuerpoRespuesta = await respuesta.json().catch(() => null);

    if (!respuesta.ok) {
      const codigo = (cuerpoRespuesta && cuerpoRespuesta.error && cuerpoRespuesta.error.status) || 'UNKNOWN';
      const mensaje =
        (cuerpoRespuesta && cuerpoRespuesta.error && cuerpoRespuesta.error.message) ||
        `FCM respondió ${respuesta.status}`;

      const error = new Error(`${codigo}: ${mensaje}`);
      error.codigoFcm = codigo;
      error.tokenInvalido = ERRORES_TOKEN_INVALIDO.includes(codigo);
      throw error;
    }

    return {
      ok: true,
      modo: 'real',
      id: cuerpoRespuesta && cuerpoRespuesta.name
    };
  },

  /**
   * Intercambia el JWT firmado del service account por un access token de
   * Google. Se cachea hasta 1 minuto antes de expirar.
   */
  async obtenerAccessToken() {
    if (cacheToken.token && Date.now() < cacheToken.expiraEn - 60_000) {
      return cacheToken.token;
    }

    const { clientEmail, privateKey } = credenciales();
    const ahora = Math.floor(Date.now() / 1000);

    const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
    const claims = base64url(
      JSON.stringify({
        iss: clientEmail,
        scope: SCOPE,
        aud: 'https://oauth2.googleapis.com/token',
        iat: ahora,
        exp: ahora + 3600
      })
    );
    const firma = crypto.createSign('RSA-SHA256').update(`${header}.${claims}`).sign(privateKey);
    const assertion = `${header}.${claims}.${base64url(firma)}`;

    const respuesta = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion
      }).toString()
    });

    const json = await respuesta.json().catch(() => null);

    if (!respuesta.ok) {
      throw new Error(
        `No se pudo autenticar contra FCM: ${(json && json.error_description) || respuesta.status}`
      );
    }

    cacheToken = {
      token: json.access_token,
      expiraEn: Date.now() + (Number(json.expires_in) || 3600) * 1000
    };
    return cacheToken.token;
  },

  /** Solo para tests: limpia el access token cacheado. */
  __resetCache() {
    cacheToken = { token: null, expiraEn: 0 };
  }
};

function recortarToken(token) {
  const texto = String(token);
  return texto.length > 16 ? `${texto.slice(0, 8)}…${texto.slice(-6)}` : texto;
}

module.exports = FcmService;
