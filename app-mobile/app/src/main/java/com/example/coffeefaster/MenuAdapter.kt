package com.example.coffeefaster

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ImageButton
import android.widget.ImageView
import android.widget.TextView
import androidx.recyclerview.widget.RecyclerView
import java.text.NumberFormat
import java.util.Locale

class MenuAdapter(
    private val productos: List<ProductoMenuModel>,
    private val onCantidadChanged: () -> Unit
) : RecyclerView.Adapter<MenuAdapter.ProductoViewHolder>() {

    private val formatoPrecio = NumberFormat.getCurrencyInstance(Locale("es", "CL"))

    class ProductoViewHolder(view: View) : RecyclerView.ViewHolder(view) {
        val ivImagen: ImageView = view.findViewById(R.id.ivProductoImagen)
        val tvNombre: TextView = view.findViewById(R.id.tvProductoNombre)
        val tvPrecio: TextView = view.findViewById(R.id.tvProductoPrecio)
        val tvDisponibilidad: TextView = view.findViewById(R.id.tvProductoDisponibilidad)
        val tvCantidad: TextView = view.findViewById(R.id.tvCantidad)
        val btnAumentar: ImageButton = view.findViewById(R.id.btnAumentar)
        val btnDisminuir: ImageButton = view.findViewById(R.id.btnDisminuir)
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ProductoViewHolder {
        val view = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_menu_producto, parent, false)
        return ProductoViewHolder(view)
    }

    override fun onBindViewHolder(holder: ProductoViewHolder, position: Int) {
        val producto = productos[position]

        holder.ivImagen.setImageResource(producto.imagenRes)
        holder.tvNombre.text = producto.nombre
        holder.tvPrecio.text = formatoPrecio.format(producto.precio)
        holder.tvCantidad.text = producto.cantidad.toString()

        if (producto.disponible) {
            holder.tvDisponibilidad.text = "Disponible"
            holder.tvDisponibilidad.setTextColor(holder.itemView.context.getColor(R.color.green_ready))
        } else {
            holder.tvDisponibilidad.text = "Agotado"
            holder.tvDisponibilidad.setTextColor(holder.itemView.context.getColor(R.color.orange_prep))
        }

        val habilitado = producto.disponible
        holder.btnAumentar.isEnabled = habilitado
        holder.btnDisminuir.isEnabled = habilitado && producto.cantidad > 0
        holder.itemView.alpha = if (habilitado) 1.0f else 0.5f

        holder.btnAumentar.setOnClickListener {
            if (!producto.disponible) return@setOnClickListener
            producto.cantidad += 1
            notifyItemChanged(position)
            onCantidadChanged()
        }

        holder.btnDisminuir.setOnClickListener {
            if (producto.cantidad > 0) {
                producto.cantidad -= 1
                notifyItemChanged(position)
                onCantidadChanged()
            }
        }
    }

    override fun getItemCount() = productos.size

    fun totalUnidadesSeleccionadas(): Int = productos.sumOf { it.cantidad }

    fun totalMontoSeleccionado(): Int = productos.sumOf { it.precio * it.cantidad }
}