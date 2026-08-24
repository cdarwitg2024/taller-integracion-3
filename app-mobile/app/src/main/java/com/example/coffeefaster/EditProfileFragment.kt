package com.example.coffeefaster

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.fragment.app.Fragment
import com.example.coffeefaster.databinding.FragmentEditProfileBinding

class EditProfileFragment : Fragment() {

    private var _binding: FragmentEditProfileBinding? = null
    private val binding get() = _binding!!

    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentEditProfileBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        // Botones Volver y Cancelar regresan al perfil
        binding.btnVolver.setOnClickListener { goBackToProfile() }
        binding.btnCancelEdit.setOnClickListener { goBackToProfile() }

        // Guardar cambios
        binding.btnSaveProfile.setOnClickListener {
            Toast.makeText(context, "Cambios guardados con éxito", Toast.LENGTH_SHORT).show()
            goBackToProfile()
        }

        binding.btnChangePhoto.setOnClickListener {
            Toast.makeText(context, "Abrir galería para cambiar foto", Toast.LENGTH_SHORT).show()
        }
    }

    private fun goBackToProfile() {
        parentFragmentManager.popBackStack()
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}