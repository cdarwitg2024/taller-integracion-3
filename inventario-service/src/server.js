require('dotenv').config();
const app = require('./app');

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`[inventario-service] Escuchando en puerto ${PORT}`);
  console.log(`[inventario-service] Modo: ${process.env.NODE_ENV || 'development'}`);
  console.log(`[inventario-service] Health: http://localhost:${PORT}/health`);
});