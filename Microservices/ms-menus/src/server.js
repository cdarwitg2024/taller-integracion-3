require('dotenv').config();

const app = require('./app');

const PUERTO = Number(process.env.PORT) || 3003;

const servidor = app.listen(PUERTO, () => {
  console.log(`[ms-menus] escuchando en ${PUERTO}`);
  console.log(`[ms-menus] entorno: ${process.env.NODE_ENV || 'development'}`);
  console.log(`[ms-menus] health: http://localhost:${PUERTO}/health`);
  console.log(`[ms-menus] recurso: http://localhost:${PUERTO}/api/menus`);
  console.log(`[ms-menus] interno: POST http://${PUERTO === 3003 ? 'localhost' : 'ms-menus'}:${PUERTO}/api/menus/precios (fuera del gateway)`);
});

// Cierre limpio: sin esto, `docker compose down` corta la conexion a Supabase
// a medias y los logs se llenan de ECONNRESET.
for (const senal of ['SIGTERM', 'SIGINT']) {
  process.on(senal, () => {
    console.log(`[ms-menus] ${senal} recibido, cerrando`);
    servidor.close(() => process.exit(0));
  });
}