# syntax=docker/dockerfile:1
FROM node:22-alpine

WORKDIR /usr/src/app

COPY ms-pedidos/package*.json ./
RUN npm install --omit=dev

RUN rm -rf node_modules/@coffeefaster/shared

COPY shared/ node_modules/@coffeefaster/shared/

COPY ms-pedidos/ ./

USER node

EXPOSE 3005

ENV NODE_ENV=production
ENV PORT=3005

CMD ["node", "src/server.js"]
