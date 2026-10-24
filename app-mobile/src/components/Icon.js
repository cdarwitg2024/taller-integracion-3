import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';

/**
 * Icono reutilizable de CoffeeFast — S2-T3.
 *
 * Envuelve `@expo/vector-icons` (Ionicons) para que toda la app use la misma
 * familia, el mismo tamaño base y los mismos colores del tema. Reemplaza a los
 * emojis que se usaban como controles (tab bar, volver, cerrar, editar,
 * refresh, +/-, checkboxes), que no tenían ni ancho ni centrado consistentes.
 *
 * Props:
 * - name: Nombre del icono de Ionicons (ej: 'cart', 'close', 'chevron-back').
 * - size: Tamaño en px. Por defecto el `size` de texto estándar (20).
 * - color: Color del icono. Por defecto `colors.textoPrimario`.
 * - style: Estilo extra (márgenes, alineación, etc.).
 * - ...rest: Cualquier otra prop se pasa a Ionicons (accessibilityLabel, etc.).
 *
 * @type {React.FC<{
 *   name: string,
 *   size?: number,
 *   color?: string,
 *   style?: any,
 *   accessibilityLabel?: string,
 *   testID?: string,
 *   onPress?: () => void,
 * }>}
 */
const Icon = ({ name, size = 20, color = colors.textoPrimario, style, ...rest }) => (
  <Ionicons
    name={name}
    size={size}
    color={color}
    style={style}
    // Los iconos son decorativos salvo que quien los use dé su propio label en
    // el control que los contiene; así los lectores de pantalla no los leen dos
    // veces.
    accessible={false}
    {...rest}
  />
);

export default Icon;
