---
name: coffeefast-agent
description: Instrucciones y reglas globales para el proyecto CoffeeFast en el campus UCT.
skills:
  - ./.opencode/skills/SKILL.md
---

# CoffeeFast — Instrucciones para Agentes de IA (Agent.md)

Este archivo contiene las reglas, convenciones y contexto que todo agente de IA debe seguir al trabajar en el proyecto CoffeeFast.

## 1. Propósito del proyecto
CoffeeFast es una app de pedidos de café para el campus UCT. Tiene tres capas:
- **App móvil (app-mobile)**: Expo / React Native / TypeScript. Los estudiantes piden café, pagan con Wallet y retiran con QR.
- **App de escritorio (app-desktop)**: Electron + React + Vite + MUI. Pantalla de cocina (KDS), gestión de productos, inventario, reportes.
- **Backend / Microservicios (Microservices)**: Node/Express detrás de un gateway nginx. Comunican con Supabase (Postgres + Auth + Realtime).

## 2. Estructura de carpetas
```
C:\ti\
├── app-mobile/          # App móvil (Expo, React Native, TS)
│   ├── src/
│   │   ├── screens/     # Pantallas (Login, Register, Menu, Pedidos, Cart, etc.)
│   │   ├── components/  # Componentes base (Button, Input, Card, Header)
│   │   ├── theme/       # Tema compartido (colors, spacing, typography)
│   │   ├── context/     # Contextos (CartContext)
│   │   ├── hooks/       # Hooks reutilizables (useCartTotals)
│   │   ├── lib/         # Supabase client
│   │   └── theme/
├── app-desktop/         # App de escritorio (Electron, React, Vite, MUI)
│   ├── src/
│   │   ├── pages/       # Pantallas (Dashboard, Pedidos, Productos, etc.)
│   │   ├── components/  # Componentes base y UI
│   │   ├── theme/       # Tema compartido
│   │   ├── service/     # Servicios HTTP
│   │   └── layout/
├── Microservices/       # Backend (Node/Express)
│   ├── gateway/         # nginx, puerto 8080
│   ├── ms-cafeterias/   # Puerto 3002
│   ├── ms-menus/        # Puerto 3003
│   ├── ms-pedidos/      # Puerto 3005
│   └── shared/          # Código compartido (auth, http-client, supabase)
├── database/fixes/      # Migraciones y RPCs SQL
└── k8s-next/            # Manifiestos de Kubernetes
```

## 3. Reglas generales de código
- **No escribir código decoroso o innecesario.** Mantén las funciones pequeñas y con un solo propósito.
- **Usar componentes base existentes** (Button, Input, Card, Header) en lugar de crear estilos inline.
- **Usar tokens de tema** (colors, spacing, typography) en lugar de hex literales `#RRGGBB` o valores hardcodeados.
- **No tocar lógica de negocio** a menos que sea explícitamente solicitado.
- **No hacer commit, push o merge sin autorización previa.**
- **Prefiere TypeScript sobre JavaScript** cuando sea posible en app-mobile.

## 4. Convenciones por pantalla
### App móvil
- Las pantallas usan navegación manual con `useState` en `App.tsx` (no react-navigation para el flujo principal).
- Importar `colors`, `spacing`, `typography` desde `../theme/*`.
- Importar componentes base desde `../components/*`.

### App de escritorio
- Importar componentes base desde `../components/ui/*`.
- Usar `colors`, `spacing`, `typography` desde `../theme/`.
- Las pantallas del dueño usan `Header` consistente inyectado desde `app.jsx`.

## 5. Flujo de trabajo
1. Crear rama desde `develop` (ej. `S2-TX-Nombre`).
2. Hacer cambios solo en archivos necesarios.
3. Probar en emulador/escritorio antes de commit.
4. Commit con formato: `[FEAT]: Descripción de la tarea`.
5. No hacer merge a `develop` sin autorización.
6. Para reportar, usar el formato de Linear si se solicita.

## 6. Comandos útiles
```powershell
# Iniciar app móvil (con caché limpio)
cd C:\ti\app-mobile
npx expo start --android -c

# Iniciar app de escritorio
cd C:\ti\app-desktop
npm run electron:dev

# Verificar TypeScript
npx tsc --noEmit
```

---

**Última actualización:** 2026-10-28  
**Mantenedor:** Equipo CoffeeFast
