package com.example.coffeefaster

import android.content.Intent
import android.os.Bundle
import android.view.Gravity
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.LinearLayout
import android.widget.TextView
import androidx.fragment.app.Fragment
import android.text.Editable
import android.text.TextWatcher
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView

class HomeFragment : Fragment(R.layout.fragment_home) {

    private val mockData = listOf(
        ItemModel(1, "Cafetería Edificio 7 - Facultad de Ingenieria", "Especialidad en café de grano y repostería", "10 - 15 min", true, ItemType.CAFETERIA),
        ItemModel(2, "Cafetería Edificio 1 - Facultad de Artes", "Para llevar rápido", "5 - 8 min", true, ItemType.CAFETERIA),
        ItemModel(3, "Cafeteria Edificio 4 - x", "Comidas Completas y rapidas", "4 - 7 min", false, ItemType.CAFETERIA),
        ItemModel(4, "Cafeteria Edificio 12 - Facultad Pedagogía", "Sandwiches artesanales y bebidas frías", "3 - 5 min", true, ItemType.CAFETERIA),
        ItemModel(5, "Carrito Comida #1", "Meriendas sanas", "2 - 4 min", true, ItemType.CAFETERIA),
        ItemModel(6, "Carrito Comida #2", "Desayunos Ricos", "2 - 4 min", false, ItemType.CAFETERIA)
    )

    private lateinit var adapter: ItemAdapter

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        val recyclerView = view.findViewById<RecyclerView>(R.id.recyclerView)
        val etSearch = view.findViewById<com.google.android.material.textfield.TextInputEditText>(R.id.etSearch)

        adapter = ItemAdapter(filterData("")) { cafeteria ->
            parentFragmentManager.beginTransaction()
                .replace(R.id.fragmentContainer, MenuFragment.newInstance(cafeteria.id, cafeteria.nombre))
                .addToBackStack(null)
                .commit()
        }
        recyclerView.layoutManager = LinearLayoutManager(context)
        recyclerView.adapter = adapter

        // Búsqueda en tiempo real
        etSearch.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {
                adapter.updateList(filterData(s.toString()))
            }
            override fun afterTextChanged(s: Editable?) {}
        })
    }

    private fun filterData(query: String): List<ItemModel> {
        return mockData.filter { item ->
            item.nombre.contains(query, ignoreCase = true)
        }
    }
}

class OrdersFragment : Fragment(android.R.layout.simple_list_item_1) {
    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        view.findViewById<TextView>(android.R.id.text1).text = "Pantalla Mis Pedidos"
    }
}