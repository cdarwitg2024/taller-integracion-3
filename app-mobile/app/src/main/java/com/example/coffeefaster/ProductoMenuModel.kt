package com.example.coffeefaster

import androidx.annotation.DrawableRes

/**
 * Representa un producto dentro del menú de una cafetería específica.
 *
 * @param cantidad cantidad actualmente seleccionada por el usuario (estado local, en memoria).
 */
data class ProductoMenuModel(
    val id: Int,
    val cafeteriaId: Int,
    val nombre: String,
    val precio: Int,
    val disponible: Boolean,
    @DrawableRes val imagenRes: Int,
    var cantidad: Int = 0
)
