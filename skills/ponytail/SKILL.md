# Skill: Ponytail

Este archivo documenta la skill "Ponytail" para el proyecto CoffeeFast. Una skill es un conjunto de instrucciones, herramientas y convenciones que ayudan a un agente de IA a trabajar de manera más eficiente y consistente en un contexto específico.

## Propósito
Proporcionar directrices para trabajar con componentes, utilidades y herramientas comunes ("skills") dentro del ecosistema CoffeeFast, reduciendo el código decoroso y mejorando la consistencia entre pantallas y microservicios.

## Estructura de la carpeta skills/
```
skills/
├── ponytail/
│   └── ponytail.md      # Este archivo
└── ...                  # Otras skills futuras
```

## Reglas de la skill Ponytail

### 1. Componentes base primero
Antes de crear un componente nuevo, verificar si ya existe uno en:
- `app-mobile/src/components/`
- `app-desktop/src/components/ui/`
- `app-mobile/src/theme/`

Si ya existe un `Button`, `Input`, `Card`, `Header` o similar, reutilizarlo en lugar de crear uno nuevo.

### 2. Tokens de diseño
Nunca usar valores literales de color, espaciado o tipografía. Usar siempre:
- `colors.cafeOscuro`, `colors.textoSecundario`, etc.
- `spacing.lg`, `spacing.md`, etc.
- `typography.cuerpo`, `typography.subtitulo`, etc.

### 3. Funciones pequeñas y con propósito único
Cada función debe hacer una sola cosa. Si una función hace más de una cosa, dividirla en funciones más pequeñas. Esto reduce el código decoroso y facilita el mantenimiento.

### 4. Ejemplo de componente siguiendo la skill Ponytail

**Incorrecto (código decoroso):**
```jsx
<Button style={{ backgroundColor: '#4A332C', color: '#FFFFFF', padding: 16, borderRadius: 12 }}>
  Iniciar sesión
</Button>
```

**Correcto (usando componentes base y tokens):**
```jsx
<Button variant="primary" size="lg">
  Iniciar sesión
</Button>
```

## 5. Cómo usar esta skill
Cuando un agente de IA trabaje en cualquier pantalla o componente de CoffeeFast:
1. Leer primero `agent.md` en la raíz del proyecto.
2. Revisar si existe un componente base que cumpla la función.
3. Verificar que no existan hex literales o valores hardcodeados.
4. Si se crea algo nuevo, documentar brevemente en el archivo correspondiente.

## 6. Relación con otros archivos
- `agent.md` en la raíz: instrucciones globales.
- `skills/ponytail/ponytail.md`: este archivo, reglas específicas de la skill Ponytail.
- `app-mobile/src/theme/tokens.js`: definición de colores, espaciado y tipografía.
- `app-desktop/src/theme/theme.js`: tema de MUI para escritorio.

---

**Última actualización:** 2026-10-28  
**Mantenedor:** Equipo CoffeeFast
