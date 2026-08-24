package com.example.coffeefaster

import android.graphics.Color
import android.os.Bundle
import android.text.Editable
import android.text.TextWatcher
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import com.example.coffeefaster.databinding.ActivityRegisterBinding

class RegisterActivity : AppCompatActivity() {

    private lateinit var binding: ActivityRegisterBinding

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityRegisterBinding.inflate(layoutInflater)
        setContentView(binding.root)

        // Escuchar la escritura en el campo Password para colorear la barra
        binding.etPasswordRegister.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {
                updatePasswordStrengthBar(s.toString())
            }
            override fun afterTextChanged(s: Editable?) {}
        })

        // Volver al Login
        binding.tvBackToLogin.setOnClickListener {
            finish()
        }

        // Botón Registrarse
        binding.btnRegisterConfirm.setOnClickListener {
            Toast.makeText(this, "Registro simulado exitoso", Toast.LENGTH_SHORT).show()
            finish()
        }
    }

    private fun updatePasswordStrengthBar(password: String) {
        val grey = Color.parseColor("#E0E0E0")
        val red = Color.parseColor("#D32F2F")     // Rojo
        val yellow = Color.parseColor("#FBC02D")  // Amarillo
        val green = Color.parseColor("#388E3C")   // Verde

        when {
            password.length < 4 -> {
                // Sin contraseña: Todo gris
                setSegmentColors(grey, grey, grey, grey)
            }
            password.length < 6 -> {
                // Nivel 1 (Muy insegura): 1 bloque Rojo
                setSegmentColors(red, grey, grey, grey)
            }
            password.length < 8 -> {
                // Nivel 2 (Insegura): 2 bloques Rojos
                setSegmentColors(red, red, grey, grey)
            }
            password.length < 12 -> {
                // Nivel 3 (Media): 2 Rojos + 1 Amarillo
                setSegmentColors(red, red, yellow, grey)
            }
            else -> {
                // Nivel 4 (Segura): 2 Rojos + 1 Amarillo + 1 Verde
                setSegmentColors(red, red, yellow, green)
            }
        }
    }
    private fun setSegmentColors(c1: Int, c2: Int, c3: Int, c4: Int) {
        binding.seg1.setBackgroundColor(c1)
        binding.seg2.setBackgroundColor(c2)
        binding.seg3.setBackgroundColor(c3)
        binding.seg4.setBackgroundColor(c4)
    }
}