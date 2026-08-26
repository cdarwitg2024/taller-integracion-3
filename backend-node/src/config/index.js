const dotenv = require('dotenv');
dotenv.config();

module.exports = {
  port: process.env.PORT || 3000,
  env: process.env.NODE_ENV || 'development',
  
  supabase: {
    url: process.env.SUPABASE_URL,
    key: process.env.SUPABASE_KEY
  },
  
  apiKeys: {
    service: process.env.API_KEY_SERVICE,
    qr: process.env.API_KEY_QR,
    notificaciones: process.env.API_KEY_NOTIFICACIONES,
    pagos: process.env.API_KEY_PAGOS
  },
  
  colas: {
    tiempoAtencionBase: parseFloat(process.env.TIEMPO_ATENCION_BASE) || 2.5,
    capacidadMaximaPorDefecto: parseInt(process.env.CAPACIDAD_MAXIMA_POR_DEFECTO) || 30
  },
  
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true
  }
};