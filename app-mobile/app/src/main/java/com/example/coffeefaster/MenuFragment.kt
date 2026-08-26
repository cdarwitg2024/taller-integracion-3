package com.example.coffeefaster

import android.os.Bundle
import android.view.View
import android.widget.ImageButton
import android.widget.TextView
import androidx.fragment.app.Fragment
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import java.text.NumberFormat
import java.util.Locale

/**
 * Pantalla del menú de productos de una cafetería seleccionada.
 * Muestra nombre, imagen, precio, disponibilidad y cantidad de cada producto,
 * usando datos mock (sin backend, pago ni QR todavía).
 */
class MenuFragment : Fragment(R.layout.fragment_menu) {

    companion object {
        private const val ARG_CAFETERIA_ID = "arg_cafeteria_id"
        private const val ARG_CAFETERIA_NOMBRE = "arg_cafeteria_nombre"

        fun newInstance(cafeteriaId: Int, cafeteriaNombre: String): MenuFragment {
            val fragment = MenuFragment()
            fragment.arguments = Bundle().apply {
                putInt(ARG_CAFETERIA_ID, cafeteriaId)
                putString(ARG_CAFETERIA_NOMBRE, cafeteriaNombre)
            }
            return fragment
        }
    }

    private lateinit var adapter: MenuAdapter
    private lateinit var tvResumenSeleccion: TextView
    private lateinit var tvResumenTotal: TextView
    private val formatoPrecio = NumberFormat.getCurrencyInstance(Locale("es", "CL"))

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        val cafeteriaId = arguments?.getInt(ARG_CAFETERIA_ID) ?: -1
        val cafeteriaNombre = arguments?.getString(ARG_CAFETERIA_NOMBRE) ?: "Cafetería"

        view.findViewById<TextView>(R.id.tvMenuCafeteriaNombre).text = cafeteriaNombre
        tvResumenSeleccion = view.findViewById(R.id.tvResumenSeleccion)
        tvResumenTotal = view.findViewById(R.id.tvResumenTotal)

        val recyclerView = view.findViewById<RecyclerView>(R.id.recyclerViewMenu)
        val productos = MenuMockData.getProductos(cafeteriaId)

        adapter = MenuAdapter(productos) { actualizarResumen() }
        recyclerView.layoutManager = LinearLayoutManager(context)
        recyclerView.adapter = adapter

        view.findViewById<ImageButton>(R.id.btnVolver).setOnClickListener {
            parentFragmentManager.popBackStack()
        }

        actualizarResumen()
    }

    private fun actualizarResumen() {
        val totalUnidades = adapter.totalUnidadesSeleccionadas()
        val totalMonto = adapter.totalMontoSeleccionado()

        if (totalUnidades == 0) {
            tvResumenSeleccion.text = getString(R.string.menu_resumen_vacio)
            tvResumenTotal.text = ""
        } else {
            val etiqueta = if (totalUnidades == 1) "producto seleccionado" else "productos seleccionados"
            tvResumenSeleccion.text = "$totalUnidades $etiqueta"
            tvResumenTotal.text = formatoPrecio.format(totalMonto)
        }
    }
}
