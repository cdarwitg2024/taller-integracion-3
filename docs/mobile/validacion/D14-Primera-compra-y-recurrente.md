# D14 · Primera compra y compra recurrente

Base `48e3af9`, con D06, D08 y C12 integradas. La regla vigente es un uso por
comprador y código. La prueba usa al estudiante 10, la cafetería 1 y el código
`CAFE-11`, cuyo titular es otro estudiante.

| Paso | Esperado | Observado en PostgreSQL 15 |
|---|---|---|
| Confirmar la compra con `CAFE-11` | Descuento $150, débito $850 y comisión $85 | Pedido #2. Total $850, movimiento Wallet −$850 y comisión $85. |
| Volver a cotizar con el mismo código | Motivo `beneficio_usado`, total $1.000 | La RPC devolvió ese motivo y el precio completo. |
| Retirar el código y confirmar con otra clave | Segundo pedido, débito $1.000, sin descuento ni comisión | Pedido #3. Total $1.000, movimiento Wallet −$1.000, descuento $0 y cero filas de comisión. |

La prueba verifica que ambos pedidos pertenecen al mismo estudiante y
cafetería. Ejecuta las RPC reales de V07, V08 y V09 y la migración C12 en una
base desechable. La suite ya está conectada al job `database` de CI.
El registro usa PostgreSQL local y no corresponde a una compra en dispositivo.

Para reproducir, seguir el entorno del job `database` en
[CI Functional](../../../.github/workflows/ci-functional.yml). Con el
contenedor PostgreSQL listo y el checkout de db_CoffeeFaster fijado en
`d074ed5`, ejecutar desde la raíz:

```powershell
$env:TEST_POSTGRES_CONTAINER = 'cf-test-postgres'
$env:DB_COFFEEFASTER_DIR = '.test-bd'
node database/tests/prueba_limitar_beneficio_por_comprador_y_codigo.cjs
```

La salida `D14 OK` identifica los dos pedidos y sus importes.
