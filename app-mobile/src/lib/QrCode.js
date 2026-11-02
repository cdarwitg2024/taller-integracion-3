import React, { useMemo } from 'react';
import Svg, { Path, Rect } from 'react-native-svg';

import qrcode from './vendor/qrcode-generator';

/**
 * Dibuja la matriz en un solo SVG: las celdas conservan sus coordenadas
 * y no dependen del redondeo ni del salto de fila del layout nativo.
 */
function QrCode({ value, size = 220, quiet = 4, bgColor = '#FFFFFF', fgColor = '#000000' }) {
  const { path, count } = useMemo(() => {
    const qr = qrcode(0, 'M');
    qr.addData(String(value || ''));
    qr.make();
    const c = qr.getModuleCount();
    const modules = [];
    for (let r = 0; r < c; r++) {
      for (let col = 0; col < c; col++) {
        if (qr.isDark(r, col)) modules.push(`M${col},${r}h1v1h-1z`);
      }
    }
    return { path: modules.join(''), count: c };
  }, [value]);

  const margin = Math.max(4, quiet);
  const total = count + margin * 2;

  return (
    <Svg
      width={size}
      height={size}
      viewBox={`${-margin} ${-margin} ${total} ${total}`}
      accessibilityLabel="QR de retiro del pedido"
    >
      <Rect x={-margin} y={-margin} width={total} height={total} fill={bgColor} />
      <Path d={path} fill={fgColor} />
    </Svg>
  );
}

export default QrCode;
