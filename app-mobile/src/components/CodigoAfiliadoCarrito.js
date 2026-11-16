import React, { useState } from 'react';
import { View, Text } from 'react-native';
import Input from './Input';
import Button from './Button';
import Card from './Card';
import { spacing } from '../theme/spacing';

export default function CodigoAfiliadoCarrito({ codigo, onChange, disabled }) {
  const [texto, setTexto] = useState(codigo);

  const editar = (valor) => {
    if (disabled) return;
    setTexto(valor);
    onChange('');
  };
  const aplicar = () => {
    if (disabled) return;
    const seleccionado = texto.trim();
    setTexto(seleccionado);
    onChange(seleccionado);
  };

  return (
    <Card padding="md" style={{ marginBottom: spacing.md }}>
      <Input
        label="Código de afiliado (opcional)"
        accessibilityLabel="Código de afiliado"
        placeholder="Ingresa tu código"
        value={texto}
        onChangeText={editar}
        autoCorrect={false}
        editable={!disabled}
      />
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <Button title="Aplicar" size="sm" onPress={aplicar}
          disabled={disabled || !texto.trim() || Boolean(codigo)} />
        <Button title="Quitar" size="sm" variant="ghost"
          onPress={() => { if (!disabled) editar(''); }}
          disabled={disabled || !texto} />
      </View>
      <Text accessibilityLiveRegion="polite" style={{ marginTop: spacing.sm }}>
        {codigo ? `Código seleccionado: ${codigo}` : 'Sin código seleccionado'}
      </Text>
    </Card>
  );
}
