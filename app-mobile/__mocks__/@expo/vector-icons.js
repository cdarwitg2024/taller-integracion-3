/**
 * Mock de @expo/vector-icons para Jest — S2-T3.
 *
 * La librería real carga fuentes tipográficas a través de `expo-font`
 * (módulo nativo), que no existe en el entorno de Jest. Este mock renderiza
 * cada familia de iconos como un `<Text>` que expone el nombre del icono, así
 * los tests pueden buscarlo y el render no depende de módulos nativos.
 */

const React = require('react');
const { Text } = require('react-native');

const crearFamilia = () =>
  function MockIcon({ name, size, color, style, ...rest }) {
    return React.createElement(
      Text,
      {
        ...rest,
        testID: `icon-${name}`,
        // Se replican los props reales del icono para que los tests puedan
        // verificar tamaño, color y estilos como lo haría el render real.
        style: [{ fontSize: size, color }, style],
        iconSize: size,
        iconColor: color,
      },
      name,
    );
  };

module.exports = {
  Ionicons: crearFamilia(),
  MaterialIcons: crearFamilia(),
  MaterialCommunityIcons: crearFamilia(),
  AntDesign: crearFamilia(),
  Feather: crearFamilia(),
  FontAwesome: crearFamilia(),
  FontAwesome5: crearFamilia(),
  FontAwesome6: crearFamilia(),
  Entypo: crearFamilia(),
  EvilIcons: crearFamilia(),
  Fontisto: crearFamilia(),
  Foundation: crearFamilia(),
  Octicons: crearFamilia(),
  SimpleLineIcons: crearFamilia(),
  Zocial: crearFamilia(),
};
