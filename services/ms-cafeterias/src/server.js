require('dotenv').config();

const app = require('./app');

const PUERTO = Number(process.env.PORT) || 3002;

const servidor = app.listen(PUERTO, () => {
  console.log(`[ms-cafeterias] escuchando en ${PUERTO}`);
  console.log(`[ms-cafeterias] entorno: ${process.env.NODE_ENV || 'development'}`);
  console.log(`[ms-cafeterias] health: http://localhost:${PUERTO}/health`);
  console.log(`[ms-cafeterias] recurso: http://localhost:${PUERTO}/api/cafeterias`);
});

// Cierre limpio: sin esto, `docker compose down` corta la conexion a Supabase
// a medias y los logs se llenan de ECONNRESET.
for (const senal of ['SIGTERM', 'SIGINT']) {
  process.on(senal, () => {
    console.log(`[ms-cafeterias] ${senal} recibido, cerrando`);
    servidor.close(() => process.exit(0));
  });
}