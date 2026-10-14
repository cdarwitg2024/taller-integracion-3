require('dotenv').config();
const app = require('./app');

const PUERTO = Number(process.env.PORT) || 3005;

const servidor = app.listen(PUERTO, () => {
  console.log(`[ms-pedidos] escuchando en ${PUERTO}`);
  console.log(`[ms-pedidos] entorno: ${process.env.NODE_ENV || 'development'}`);
  console.log(`[ms-pedidos] health: http://localhost:${PUERTO}/health`);
  console.log(`[ms-pedidos] recurso: http://localhost:${PUERTO}/api/pedidos`);
});

for (const senal of ['SIGTERM', 'SIGINT']) {
  process.on(senal, () => {
    console.log(`[ms-pedidos] ${senal} recibido, cerrando`);
    servidor.close(() => process.exit(0));
  });
}
