package com.example.coffeefaster

import android.os.Bundle
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import com.example.coffeefaster.databinding.ActivityForgotPasswordBinding

class ForgotPasswordActivity : AppCompatActivity() {

    private lateinit var binding: ActivityForgotPasswordBinding

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityForgotPasswordBinding.inflate(layoutInflater)
        setContentView(binding.root)

        // Botón Enviar enlace
        binding.btnResetPassword.setOnClickListener {
            Toast.makeText(this, "Enlace de recuperación enviado", Toast.LENGTH_SHORT).show()
            finish()
        }

        // Click en "log in" para volver atrás
        binding.tvBackToLogin.setOnClickListener {
            finish()
        }
    }
}