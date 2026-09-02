# MS Pagos Simulado

## 1. Propósito

Microservicio que simula el procesamiento de pagos para las pruebas de
integración de CoffeeFast. El SRS especifica un mocking síncrono con una
latencia simulada de **500 ms** y una tasa de aprobación simulada del
**99%**.

**Trazabilidad SRS:** FR-04 y NFR-01/NFR-08.

## 2. Arquitectura interna

``` text
App Móvil
    |
    | HTTPS / REST
    v
NGINX / API Gateway
    |
    | /pagos
    v
MS Pagos Simulado
    |
    +--> PaymentController
    |
    +--> PaymentService
    |       |
    |       +--> demora simulada 500 ms
    |       +--> resultado mock (99% aprobado)
    |
    +--> AuditLogger
    |
    v
Supabase PostgreSQL
```

### Componentes internos

-   **PaymentController:** recibe la solicitud de pago.
-   **PaymentService:** aplica la simulación síncrona de 500 ms y
    determina el resultado mock.
-   **PaymentRepository:** registra el resultado asociado al pedido
    cuando corresponda.
-   **AuditLogger:** registra transacciones de pago, conforme a NFR-08.

## 3. Endpoint mock

### POST `/pagos/procesar`

Procesa un pago simulado.

**Request:**

``` json
{
  "pedido_id": "PED-001",
  "usuario_id": "USR-001",
  "monto": 8500,
  "metodo": "tarjeta_mock"
}
```

**Respuesta 200 aprobada:**

``` json
{
  "ok": true,
  "pedido_id": "PED-001",
  "estado_pago": "aprobado",
  "monto": 8500,
  "comprobante_id": "CMP-001",
  "latencia_simulada_ms": 500
}
```

**Respuesta mock rechazada:**

``` json
{
  "ok": false,
  "pedido_id": "PED-001",
  "estado_pago": "rechazado",
  "motivo": "Pago simulado rechazado",
  "latencia_simulada_ms": 500
}
```

## 4. Comportamiento mock

1.  Recibe la solicitud.
2.  Valida los campos básicos.
3.  Espera aproximadamente 500 ms para simular latencia.
4.  Devuelve un resultado simulado.
5.  Registra la transacción.
6.  Si el pago es aprobado, el flujo superior puede continuar con la
    generación del QR dinámico definida por FR-05.

Para una implementación académica, la probabilidad del 99% puede
simularse mediante una condición controlada o un generador
pseudoaleatorio. Para pruebas deterministas se recomienda permitir un
modo mock que fuerce `aprobado` o `rechazado`.

## 5. Errores mock

-   `400 Bad Request`: monto, pedido o usuario inválido.
-   `404 Not Found`: pedido o usuario inexistente.
-   `500 Internal Server Error`: error interno simulado.

## 6. Relación con el SRS

-   **FR-04:** carrito de una sola cafetería y procesamiento de pago
    simulado.
-   **NFR-01:** el SRS establece menos de 2 s para procesar el pedido
    completo, incluido el pago simulado; este microservicio aporta una
    latencia simulada de 500 ms.
-   **NFR-08:** logs estructurados de transacciones de pago.
