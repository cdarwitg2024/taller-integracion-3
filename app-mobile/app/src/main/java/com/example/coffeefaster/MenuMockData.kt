package com.example.coffeefaster

/**
 * Fuente de datos mock para el menú de productos de cada cafetería.
 * Todo en memoria: no hay backend ni persistencia real todavía.
 */
object MenuMockData {

    private val productosPorCafeteria: Map<Int, List<ProductoMenuModel>> = mapOf(
        // Cafetería Edificio 7 - Facultad de Ingeniería
        1 to listOf(
            ProductoMenuModel(101, 1, "Cappuccino Vainilla", 2200, true, R.drawable.ic_product_coffee),
            ProductoMenuModel(102, 1, "Espresso Doble", 1600, true, R.drawable.ic_product_coffee),
            ProductoMenuModel(103, 1, "Muffin de Arándanos", 1800, true, R.drawable.ic_product_pastry),
            ProductoMenuModel(104, 1, "Sandwich Ave Mayo", 3200, false, R.drawable.ic_product_sandwich),
            ProductoMenuModel(105, 1, "Jugo Natural Naranja", 1900, true, R.drawable.ic_product_drink)
        ),
        // Cafetería Edificio 1 - Facultad de Artes
        2 to listOf(
            ProductoMenuModel(201, 2, "Café Americano", 1500, true, R.drawable.ic_product_coffee),
            ProductoMenuModel(202, 2, "Croissant Mantequilla", 1700, true, R.drawable.ic_product_pastry),
            ProductoMenuModel(203, 2, "Sandwich Vegetariano", 2900, true, R.drawable.ic_product_sandwich),
            ProductoMenuModel(204, 2, "Limonada Menta", 1800, false, R.drawable.ic_product_drink)
        ),
        // Cafetería Edificio 4
        3 to listOf(
            ProductoMenuModel(301, 3, "Menú Almuerzo del Día", 4200, false, R.drawable.ic_product_sandwich),
            ProductoMenuModel(302, 3, "Café con Leche", 1600, false, R.drawable.ic_product_coffee),
            ProductoMenuModel(303, 3, "Ensalada César", 3500, false, R.drawable.ic_product_sandwich)
        ),
        // Cafetería Edificio 12 - Facultad Pedagogía
        4 to listOf(
            ProductoMenuModel(401, 4, "Sandwich Artesanal Jamón", 3100, true, R.drawable.ic_product_sandwich),
            ProductoMenuModel(402, 4, "Bebida Fría Frutilla", 2000, true, R.drawable.ic_product_drink),
            ProductoMenuModel(403, 4, "Cookie Chocolate", 1200, true, R.drawable.ic_product_pastry),
            ProductoMenuModel(404, 4, "Latte Caramelo", 2300, true, R.drawable.ic_product_coffee)
        ),
        // Carrito Comida #1
        5 to listOf(
            ProductoMenuModel(501, 5, "Barra de Cereal", 900, true, R.drawable.ic_product_pastry),
            ProductoMenuModel(502, 5, "Yogurt con Granola", 1900, true, R.drawable.ic_product_pastry),
            ProductoMenuModel(503, 5, "Agua Mineral", 1000, true, R.drawable.ic_product_drink)
        ),
        // Carrito Comida #2
        6 to listOf(
            ProductoMenuModel(601, 6, "Café Cortado", 1400, false, R.drawable.ic_product_coffee),
            ProductoMenuModel(602, 6, "Pan con Palta", 2100, false, R.drawable.ic_product_sandwich),
            ProductoMenuModel(603, 6, "Jugo Natural Plátano", 1800, false, R.drawable.ic_product_drink)
        )
    )

    fun getProductos(cafeteriaId: Int): List<ProductoMenuModel> {
        return productosPorCafeteria[cafeteriaId] ?: emptyList()
    }
}
