// ─── Paleta de colores de CoffeeFast ─────────────────────────────
// Colores base del sistema de diseño.
//
// S2-T1: además de la paleta base, aquí viven los TOKENS SEMÁNTICOS que antes
// estaban hardcodeados en componentes y pantallas (tarjetas, inputs, títulos,
// contenedores). Los valores hex son EXACTAMENTE los que ya se usaban, por lo
// que normalizar a estos tokens no cambia nada visualmente.

export const colors = {
  // Primarios
  cafeOscuro: '#4A332C',
  cafeMedio: '#8C6D58',
  cafeClaro: '#A09590',

  // Fondos
  fondo: '#F8F6F4',
  fondoSuave: '#F7F5F3',
  crema: '#F5EBE1',
  blanco: '#FFFFFF',

  // Acentos
  dorado: '#C9A96E',
  doradoBg: '#FBF5E8',
  acento: '#E07A5F',

  // Estados
  verde: '#5B8C51',
  verdeBg: '#E8F3E4',
  rojo: '#A92A2A',
  rojoBg: '#FCEAE3',
  naranja: '#B58A29',
  naranjaBg: '#FBF3E0',

  // Estados de stock (puntos, barras y etiquetas dentro de las tarjetas)
  verdeStock: '#5B8C5A',
  naranjaStock: '#B8860B',
  rojoStock: '#B05A4E',
  stockTrack: '#E6DED8',

  // Textos
  textoPrimario: '#4A332C',
  textoOscuro: '#3D2B26',
  textoMedio: '#6B5850',
  textoMedioClaro: '#7C6B65',
  textoSecundario: '#8A7B76',
  textoTenue: '#958781',
  textoMarron: '#8A6A60',
  textoMarronOscuro: '#5A4A42',
  marronMedio: '#6D554C',
  textoDeshabilitado: '#A09590',
  textoDeshabilitadoClaro: '#B8AAA4',
  textoBlanco: '#FFFFFF',

  // Superficies (placeholders de imagen, modales, chips)
  superficieCrema: '#F3E7DD',
  superficieCremaSuave: '#F0E7E0',
  superficieHueso: '#FFFDFB',
  cremaBoton: '#F5F1EE',
  chipBg: '#F3EEEA',
  chipBadgeBg: '#E2D8D1',
  blancoTranslucido: 'rgba(255,255,255,0.28)',
  blancoOverlay: 'rgba(255,255,255,0.92)',

  // Overlays
  overlayOscuro: 'rgba(74, 51, 44, 0.55)',
  overlayModal: 'rgba(61, 43, 38, 0.45)',
  overlayNegro: 'rgba(0,0,0,0.5)',
  overlayNegroSuave: 'rgba(0,0,0,0.45)',
  doradoTranslucido: 'rgba(201, 169, 110, 0.15)',
  blancoHumo: 'rgba(255, 255, 255, 0.05)',
  blancoTenue: 'rgba(255, 255, 255, 0.16)',
  blancoBordeTranslucido: 'rgba(255,255,255,0.4)',

  // Bordes
  borde: '#EFE7DD',
  bordeOscuro: '#D8C9BD',
  bordeSuave: '#EFE8E3',
  bordeInput: '#D0C5B8',
  bordeError: '#F5C6CB',
  bordeExito: '#C3E6CB',
  bordeDorado: '#ECD5AA',

  // Deshabilitado
  deshabilitado: '#D8D3D0',

  // Mensajes
  textoExito: '#155724',
  textoError: '#A94442',

  // Marcas (métodos de pago)
  visa: '#1A1F71',
  mastercard: '#EB001B',

  // Sombras
  sombra: '#000000',
};

export default colors;
