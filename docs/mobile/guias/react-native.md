# Guía de la app móvil

Revisada el 11 de noviembre de 2026. CoffeeFast usa Expo 52 y React Native 0.76.9. CI ejecuta Node.js 22 y usa el CLI de Expo instalado en el proyecto.

## Configurar el entorno

Desde la raíz del repositorio, ejecuta estos comandos en PowerShell. Si ya tienes `app-mobile/.env`, conserva el archivo y revisa sus valores.

```powershell
Set-Location app-mobile
npm ci
if (-not (Test-Path -LiteralPath .env)) {
    Copy-Item -LiteralPath .env.example -Destination .env
}
```

| Variable | Valor |
|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase que usa el gateway |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Clave pública del mismo proyecto |
| `EXPO_PUBLIC_API_URL` | URL del gateway. En Android emulado, `http://10.0.2.2:8080` para Compose en el PC. En un teléfono físico, usa la IP local del PC y el puerto del gateway |

Revisa los valores del ejemplo antes de arrancar. La URL de Supabase corresponde al proyecto de datos y la URL de la API corresponde al gateway. Si usas Cloud, conserva la URL de ese proyecto al cambiar la dirección del gateway. Usa claves públicas en la app móvil.

## Ejecutar en Android

Abre el emulador desde Android Studio y ejecuta `npm run android` desde `app-mobile`. Para iniciar Expo y elegir el cliente, usa `npm start`. Después de cambiar el archivo de entorno, reinicia Expo con `npx expo start -c`.

Para iniciar el gateway y comprobar su conexión, sigue la [guía del flujo de pedidos](../../microservicios/operacion/puesta_en_marcha_flujo_pedidos.md).

## Pedidos y sesión

La app crea pedidos por el gateway y lee los pedidos del usuario en Supabase. La pantalla muestra el QR y el token de contingencia persistidos para pedidos activos. Si Supabase informa `PGRST303: JWT expired`, la app intenta renovar la sesión y repite la lectura una vez. Si la renovación falla porque la sesión dejó de ser válida, vuelve a iniciar sesión.

## Pruebas

```powershell
npm test -- --ci --runInBand
```

Consulta los resultados y el alcance de la prueba manual en Android en el [registro de validación](../../calidad/validacion/revision-pruebas.md).
