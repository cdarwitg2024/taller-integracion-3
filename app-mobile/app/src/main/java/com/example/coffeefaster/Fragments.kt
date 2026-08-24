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

class HomeFragment : Fragment(android.R.layout.simple_list_item_1) {
    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        view.findViewById<TextView>(android.R.id.text1).text = "Pantalla de Inicio"
    }
}

class OrdersFragment : Fragment(android.R.layout.simple_list_item_1) {
    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        view.findViewById<TextView>(android.R.id.text1).text = "Pantalla Mis Pedidos"
    }
}

class ProfileFragment : Fragment() {
    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        // Contenedor principal
        val context = requireContext()
        val layout = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setPadding(64, 64, 64, 64)
            layoutParams = ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
        }

        // Icono / Emoji de perfil
        val tvIcon = TextView(context).apply {
            text = "👤"
            textSize = 60f
                    gravity = Gravity.CENTER
        }

        // Título o nombre
        val tvTitle = TextView(context).apply {
            text = "Mi Perfil"
            textSize = 22f
                    typeface = android.graphics.Typeface.DEFAULT_BOLD
            gravity = Gravity.CENTER
            setPadding(0, 16, 0, 48)
        }

        // Botón de Cerrar Sesión
        val btnLogout = com.google.android.material.button.MaterialButton(context).apply {
            text = "Cerrar sesión"
            textSize = 15f
                    cornerRadius = (12 * resources.displayMetrics.density).toInt()
            setBackgroundColor(android.graphics.Color.parseColor("#4A3B32")) // color mocha_dark
            setTextColor(android.graphics.Color.WHITE)
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            )

            setOnClickListener {
                // Redirigir al Login y limpiar la pila de pantallas
                val intent = Intent(requireActivity(), MainActivity::class.java)
                intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
                startActivity(intent)
            }
        }

        // Agregar las vistas al contenedor
        layout.addView(tvIcon)
        layout.addView(tvTitle)
        layout.addView(btnLogout)

        return layout
    }
}