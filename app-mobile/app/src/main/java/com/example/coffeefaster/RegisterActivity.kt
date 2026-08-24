package com.example.coffeefaster

import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import com.google.android.material.button.MaterialButton

class RegisterActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        setContentView(R.layout.activity_register)

        val btnBack = findViewById<MaterialButton>(R.id.btnBack)

        btnBack.setOnClickListener {
            finish()
        }
    }
}