'use strict';

const app = require('./app');
const puerto = Number(process.env.PORT) || 3006;

const servidor = app.listen(puerto, () => {
  console.log(`[ms-afiliados] escuchando en ${puerto}`);
});

for (const senal of ['SIGTERM', 'SIGINT']) {
  process.on(senal, () => servidor.close());
}
