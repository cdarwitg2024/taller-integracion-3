# ============================================================================
# Frontend web (app-desktop) para el cluster K8s.
# Multi-stage: build con Node 20 + Vite; runtime con nginx:1.27-alpine.
# Las variables VITE_* se inyectan SOLO como ARG/ENV de build; nunca queda un
# .env en la imagen. La publishable key es publica por diseño y va por
# --build-arg; la service key jamás entra a esta imagen.
# ============================================================================
FROM node:20-alpine AS build
WORKDIR /app

ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY
ARG VITE_BACKEND
ARG VITE_CAFETERIA_ID

ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL \
    VITE_SUPABASE_PUBLISHABLE_KEY=$VITE_SUPABASE_PUBLISHABLE_KEY \
    VITE_BACKEND=$VITE_BACKEND \
    VITE_CAFETERIA_ID=$VITE_CAFETERIA_ID

COPY app-desktop/package*.json ./
ENV ELECTRON_SKIP_BINARY_DOWNLOAD=1
RUN npm ci --legacy-peer-deps

COPY app-desktop/ ./
RUN npm run build

FROM nginx:1.27-alpine AS runtime
COPY --from=build /app/dist /usr/share/nginx/html
COPY app-desktop/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80