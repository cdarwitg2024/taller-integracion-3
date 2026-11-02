import React from 'react';
import { StyleSheet } from 'react-native';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import {
  faArrowRight,
  faArrowDown,
  faArrowUp,
  faBurger,
  faBox,
  faBoxArchive,
  faBreadSlice,
  faBottleWater,
  faCartShopping,
  faCheck,
  faCircleCheck,
  faCircleExclamation,
  faCircleQuestion,
  faCircle,
  faChevronDown,
  faChevronUp,
  faClock,
  faCoffee,
  faCreditCard,
  faEnvelope,
  faGraduationCap,
  faHashtag,
  faLightbulb,
  faLocationDot,
  faLock,
  faMagnifyingGlass,
  faMobileScreenButton,
  faMugHot,
  faPen,
  faPhone,
  faReceipt,
  faRotateLeft,
  faStore,
  faTriangleExclamation,
  faUser,
  faUtensils,
  faWifi,
  faXmark,
  faCookieBite,
  faGlassWater,
} from '@fortawesome/free-solid-svg-icons';

const iconMap = {
  arrowRight: faArrowRight,
  arrowDown: faArrowDown,
  arrowUp: faArrowUp,
  box: faBox,
  archive: faBoxArchive,
  bread: faBreadSlice,
  bottle: faBottleWater,
  cart: faCartShopping,
  check: faCheck,
  success: faCircleCheck,
  alert: faCircleExclamation,
  help: faCircleQuestion,
  pending: faCircle,
  chevronDown: faChevronDown,
  chevronUp: faChevronUp,
  clock: faClock,
  coffee: faCoffee,
  card: faCreditCard,
  envelope: faEnvelope,
  student: faGraduationCap,
  number: faHashtag,
  idea: faLightbulb,
  location: faLocationDot,
  lock: faLock,
  search: faMagnifyingGlass,
  phone: faPhone,
  mobile: faMobileScreenButton,
  mug: faMugHot,
  edit: faPen,
  receipt: faReceipt,
  refund: faRotateLeft,
  store: faStore,
  warning: faTriangleExclamation,
  user: faUser,
  food: faUtensils,
  wifi: faWifi,
  close: faXmark,
  cookie: faCookieBite,
  drink: faGlassWater,
  sandwich: faBurger,
} as const;

export type AppIconName = keyof typeof iconMap;

type AppIconProps = {
  name: AppIconName;
  size?: number;
  color?: string;
  style?: any;
};

export default function AppIcon({
  name,
  size,
  color,
  style,
}: AppIconProps) {
  const flattened = StyleSheet.flatten(style) || {};
  const { fontSize, color: styleColor, ...layoutStyle } = flattened;

  return (
    <FontAwesomeIcon
      icon={iconMap[name]}
      size={size || (typeof fontSize === 'number' ? fontSize : 20)}
      color={color || styleColor || '#5C3D2E'}
      style={layoutStyle}
    />
  );
}
