const dotenv = require('dotenv');
dotenv.config();

const authMiddleware = (req, res, next) => {
  // Obtener API Key del header
  const apiKey = req.headers['x-api-key'] || req.headers['authorization'];
  
  // Verificar que existe
  if (!apiKey) {
    return res.status(401).json({
      success: false,
      error: 'No autorizado',
      message: 'Se requiere API Key en el header x-api-key'
    });
  }
  
  // Extraer key (si viene con "Bearer ")
  const key = apiKey.startsWith('Bearer ') ? apiKey.split(' ')[1] : apiKey;
  
  // En desarrollo, aceptar cualquier key que no esté vacía
  if (process.env.NODE_ENV === 'development') {
    if (key.length > 0) {
      return next();
    }
  }
  
  // Verificar contra variable de entorno
  const validKeys = [
    process.env.API_KEY_SERVICE,
    process.env.API_KEY_QR,
    process.env.API_KEY_NOTIFICACIONES,
    process.env.API_KEY_PAGOS
  ].filter(k => k); // Filtrar undefined
  
  if (!validKeys.includes(key)) {
    return res.status(403).json({
      success: false,
      error: 'Acceso denegado',
      message: 'API Key inválida'
    });
  }
  
  // Agregar información del servicio al request
  req.service = {
    key: key,
    type: key === process.env.API_KEY_SERVICE ? 'service' :
          key === process.env.API_KEY_QR ? 'qr' :
          key === process.env.API_KEY_NOTIFICACIONES ? 'notificaciones' :
          key === process.env.API_KEY_PAGOS ? 'pagos' : 'unknown'
  };
  
  next();
};

module.exports = authMiddleware;