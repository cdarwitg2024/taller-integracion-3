package com.example.coffeefaster

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import androidx.recyclerview.widget.RecyclerView

class ItemAdapter(
    private var items: List<ItemModel>,
    private val onCafeteriaClick: ((ItemModel) -> Unit)? = null
) : RecyclerView.Adapter<ItemAdapter.ItemViewHolder>() {

    class ItemViewHolder(view: View) : RecyclerView.ViewHolder(view) {
        val tvNombre: TextView = view.findViewById(R.id.tvItemNombre)
        val tvDetalle: TextView = view.findViewById(R.id.tvItemDetalle)
        val tvTiempo: TextView = view.findViewById(R.id.tvItemTiempo)
        val tvEstado: TextView = view.findViewById(R.id.tvItemEstado)
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ItemViewHolder {
        val view = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_card, parent, false)
        return ItemViewHolder(view)
    }

    override fun onBindViewHolder(holder: ItemViewHolder, position: Int) {
        val item = items[position]
        holder.tvNombre.text = item.nombre
        holder.tvDetalle.text = item.detalle
        holder.tvTiempo.text = "⏱️ ${item.tiempoEstimado}"

        if (item.disponible) {
            holder.tvEstado.text = "Disponible"
            holder.tvEstado.setTextColor(holder.itemView.context.getColor(android.R.color.holo_green_dark))
        } else {
            holder.tvEstado.text = "Agotado / Cerrado"
            holder.tvEstado.setTextColor(holder.itemView.context.getColor(android.R.color.holo_red_dark))
        }

        // Al tocar una cafetería disponible, navegar a su menú de productos
        if (item.tipo == ItemType.CAFETERIA) {
            holder.itemView.isClickable = item.disponible
            holder.itemView.setOnClickListener {
                if (item.disponible) {
                    onCafeteriaClick?.invoke(item)
                } else {
                    android.widget.Toast.makeText(
                        holder.itemView.context,
                        "Esta cafetería está cerrada por ahora",
                        android.widget.Toast.LENGTH_SHORT
                    ).show()
                }
            }
        } else {
            holder.itemView.setOnClickListener(null)
        }
    }

    override fun getItemCount() = items.size

    fun updateList(newList: List<ItemModel>) {
        items = newList
        notifyDataSetChanged()
    }
}