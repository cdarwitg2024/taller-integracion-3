# syntax=docker/dockerfile:1

# Contexto de build: services/ (la carpeta PADRE de este Dockerfile), porque
# shared/ vive un nivel arriba.
#
# OJO: el .dockerignore que cuenta es services/.dockerignore, no este. Docker
# solo lee el de la RAIZ del contexto. services/.dockerignore es el que evita
# que node_modules y .env viajen al daemon.
FROM node:22-alpine

WORKDIR /usr/src/app

# 1. Dependencias del servicio. Se declara tambien @supabase/supabase-js (aunque
#    el codigo no la importe directo) porque shared/ la usa en runtime y su
#    dependencia no se hoistea a traves del symlink de `file:`.
COPY ms-menus/package*.json ./
RUN npm install --omit=dev

# 2. Se quita el symlink que npm creo para `file:../shared`.
#    Con symlink, Node resuelve las deps de shared en /usr/src/shared/node_modules
#    (que no existe) en vez de en las del servicio, y revienta con MODULE_NOT_FOUND.
RUN rm -rf node_modules/@coffeefaster/shared

# 3. shared como directorio REAL dentro de node_modules. Asi Node sube por
#    node_modules y encuentra las dependencias del servicio.
COPY shared/ node_modules/@coffeefaster/shared/

# 4. Codigo del servicio. Al final: npm install no lo pisa.
COPY ms-menus/ ./

# node (no root): si el proceso se compromete, no escribe en el contenedor.
USER node

EXPOSE 3003

ENV NODE_ENV=production
ENV PORT=3003

CMD ["node", "src/server.js"]