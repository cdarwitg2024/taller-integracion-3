package com.example.coffeefaster

import android.content.Intent
import android.os.Bundle
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.GravityCompat
import com.example.coffeefaster.databinding.ActivityHomeBinding

class HomeActivity : AppCompatActivity() {

    private lateinit var binding: ActivityHomeBinding

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityHomeBinding.inflate(layoutInflater)
        setContentView(binding.root)

        // Cargar Fragmento inicial (Home)
        if (savedInstanceState == null) {
            supportFragmentManager.beginTransaction()
                .replace(R.id.fragmentContainer, HomeFragment())
                .commit()
        }

        // Abrir Drawer desde el icono de la Toolbar
        binding.toolbar.setNavigationOnClickListener {
            binding.drawerLayout.openDrawer(GravityCompat.START)
        }

        // Manejar clics del menú lateral
        binding.navigationView.setNavigationItemSelectedListener { menuItem ->
            when (menuItem.itemId) {
                R.id.nav_menus -> {
                    Toast.makeText(this, "Ver Menús seleccionado", Toast.LENGTH_SHORT).show()
                }
                R.id.nav_cafeterias -> {
                    supportFragmentManager.beginTransaction()
                        .replace(R.id.fragmentContainer, HomeFragment())
                        .commit()
                }
                R.id.nav_profile -> {
                    supportFragmentManager.beginTransaction()
                        .replace(R.id.fragmentContainer, ProfileFragment())
                        .commit()
                }
                R.id.nav_config -> {
                    Toast.makeText(this, "Configuración seleccionada", Toast.LENGTH_SHORT).show()
                }
                R.id.nav_orders -> {
                    supportFragmentManager.beginTransaction()
                        .replace(R.id.fragmentContainer, OrdersFragment())
                        .commit()
                }
            }
            binding.drawerLayout.closeDrawer(GravityCompat.START)
            true
        }

        // Botón LogOut del menú lateral
        val btnLogout = binding.navigationView.findViewById<com.google.android.material.button.MaterialButton>(R.id.btnDrawerLogout)
        btnLogout?.setOnClickListener {
            val intent = Intent(this, MainActivity::class.java)
            intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
            startActivity(intent)
        }
    }
}