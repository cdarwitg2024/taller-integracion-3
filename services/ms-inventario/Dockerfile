# syntax=docker/dockerfile:1
FROM node:22-alpine

WORKDIR /usr/src/app

COPY ms-inventario/package*.json ./
RUN npm install --omit=dev

RUN rm -rf node_modules/@coffeefaster/shared

COPY shared/ node_modules/@coffeefaster/shared/

COPY ms-inventario/ ./

USER node

EXPOSE 3004

ENV NODE_ENV=production
ENV PORT=3004

CMD ["node", "src/server.js"]
