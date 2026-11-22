# syntax=docker/dockerfile:1
FROM node:22-alpine

WORKDIR /usr/src/app
COPY shared/package.json ../shared/package.json
COPY ms-afiliados/package*.json ./
RUN npm ci --omit=dev
RUN rm -rf node_modules/@coffeefaster/shared
COPY shared/ node_modules/@coffeefaster/shared/
COPY ms-afiliados/src/ ./src/

USER node
EXPOSE 3006
ENV NODE_ENV=production
ENV PORT=3006

CMD ["node", "src/server.js"]
