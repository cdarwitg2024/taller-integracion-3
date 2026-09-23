import React, { useMemo } from 'react';
import { View } from 'react-native';

import qrcode from './vendor/qrcode-generator';

/**
 * Renderiza un QRCode en formato matricial usando Views nativas.
 * No requiere dependencias nativas (funciona en Expo / RN puro).
 */
function QrCode({ value, size = 200, quiet = 2, bgColor = '#FFFFFF', fgColor = '#1A110C' }) {
  const { matrix, count } = useMemo(() => {
    const qr = qrcode(0, 'M');
    qr.addData(String(value || ''));
    qr.make();
    const c = qr.getModuleCount();
    const rows = [];
    for (let r = 0; r < c; r++) {
      const row = [];
      for (let col = 0; col < c; col++) row.push(qr.isDark(r, col));
      rows.push(row);
    }
    return { matrix: rows, count: c };
  }, [value]);

  const total = count + quiet * 2;
  const cell = size / total;

  return (
    <View
      style={{
        width: size,
        height: size,
        flexDirection: 'row',
        flexWrap: 'wrap',
        backgroundColor: bgColor,
        padding: quiet * cell,
      }}
    >
      {matrix.flatMap((row, r) =>
        row.map((dark, c) => (
          <View
            key={`${r}-${c}`}
            style={{
              width: cell,
              height: cell,
              backgroundColor: dark ? fgColor : bgColor,
            }}
          />
        ))
      )}
    </View>
  );
}

export default QrCode;