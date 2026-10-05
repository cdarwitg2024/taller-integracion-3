require('dotenv').config();
const app = require('./app');

const PORT = Number(process.env.PORT) || 3004;

app.listen(PORT, () => {
  console.log(`[ms-inventario] Escuchando en puerto ${PORT}`);
  console.log(`[ms-inventario] Modo: ${process.env.NODE_ENV || 'development'}`);
  console.log(`[ms-inventario] Health: http://localhost:${PORT}/health`);
});
