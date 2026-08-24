package com.example.coffeefaster

enum class ItemType { CAFETERIA, PRODUCTO }

data class ItemModel(
    val id: Int,
    val nombre: String,
    val detalle: String,
    val tiempoEstimado: String,
    val disponible: Boolean,
    val tipo: ItemType
)