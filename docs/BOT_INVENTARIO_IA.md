# Bot de Inventario IA

## 1. Propósito

Componente interno de CoffeeFast destinado al análisis del inventario y
a la generación de alertas de stock bajo para el Dueño de la Cafetería.

El SRS lo define como componente interno de soporte y establece que el
Dueño administra productos/stock y recibe alertas de IA.

**Trazabilidad SRS:** FR-12, BR-06 y CA-11.

## 2. Capacidades definidas

### A. Consulta de stock

El Dueño puede preguntar por la cantidad disponible de un producto. El
Bot consulta la información de inventario y devuelve el stock actual.

Ejemplo:

> "¿Cuánto stock queda de Sándwich de pollo?"

Respuesta mock:

> "Quedan 2 unidades de Sándwich de pollo. El stock se encuentra bajo el
> mínimo configurado."

### B. Alerta automática de stock bajo

El Bot puede detectar que un producto alcanza un nivel de stock bajo y
generar una alerta visible para el Dueño.

Ejemplo conceptual:

``` text
Stock anterior: 10
        ↓
Actualización del inventario
        ↓
Stock actual: 2
        ↓
Bot detecta stock bajo
        ↓
Genera alerta para el Dueño
```

## 3. Arquitectura interna

``` text
Interfaz de Administración del Dueño
                |
                | HTTPS / REST
                v
        NGINX / API Gateway
                |
                | /bot
                v
        Bot Inventario IA
          /                    /                     v               v
PostgreSQL        Motor de análisis
 (Supabase)       / reglas de stock
        ^               |
        |_______________|
          datos de inventario
```

### Componentes internos

-   **BotController:** expone las operaciones REST del Bot.
-   **InventoryService:** consulta productos y cantidades disponibles.
-   **StockAnalyzer:** determina si el stock está por debajo del mínimo
    definido.
-   **AlertService:** construye la alerta destinada al Dueño.
-   **InventoryRepository:** acceso a Supabase/PostgreSQL.
-   **AuditLogger:** registra eventos relevantes del análisis si se
    requiere trazabilidad.

> La implementación de IA concreta no está especificada en el SRS. Por
> lo tanto, para el microservicio mock se propone un análisis basado en
> reglas/umbral. La tecnología o modelo de IA definitivo queda fuera de
> lo especificado actualmente.

## 4. Endpoints mock

### GET `/bot/stock/:producto_id`

Consulta el stock actual de un producto.

**Respuesta 200:**

``` json
{
  "ok": true,
  "producto_id": "PROD-001",
  "producto": "Sándwich de pollo",
  "stock_actual": 2,
  "stock_minimo": 5,
  "nivel": "bajo",
  "mensaje": "Quedan 2 unidades. El stock está bajo."
}
```

### POST `/bot/consulta-stock`

Endpoint alternativo para representar una consulta realizada por
lenguaje natural.

**Request:**

``` json
{
  "usuario_id": "DUENO-001",
  "consulta": "¿Cuánto stock queda de Sándwich de pollo?"
}
```

**Respuesta 200:**

``` json
{
  "ok": true,
  "respuesta": "Quedan 2 unidades de Sándwich de pollo. El stock está bajo."
}
```

### GET `/bot/alertas-stock`

Devuelve las alertas de stock bajo disponibles para el Dueño.

**Respuesta 200:**

``` json
{
  "ok": true,
  "alertas": [
    {
      "producto_id": "PROD-001",
      "producto": "Sándwich de pollo",
      "stock_actual": 2,
      "stock_minimo": 5,
      "nivel": "bajo",
      "mensaje": "Stock bajo: quedan 2 unidades"
    }
  ]
}
```

## 5. Regla mock de stock

Para el prototipo se puede utilizar una regla sencilla:

``` text
si stock_actual <= stock_minimo
    generar alerta
si no
    no generar alerta
```

El valor del umbral debe quedar asociado al producto o configurarse como
parámetro del sistema. El ejemplo `10 -> 2` es ilustrativo y no se
establece como umbral obligatorio por el SRS.

## 6. Relación con el SRS

-   **FR-12:** análisis de inventario y alertas de stock bajo.
-   **BR-06:** administración y métricas exclusivas del Dueño.
-   **CA-10:** el Dueño puede gestionar productos y stock.
-   **CA-11:** el Bot IA puede generar alertas de stock bajo visibles
    para el Dueño.
