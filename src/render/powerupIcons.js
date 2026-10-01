// =============================================================================
// Power-up symbols, painted on a canvas. Used by the floating 3D drops and by
// the HUD's active power-up row.
// =============================================================================

export function drawPowerupIcon(g, type, S, color = '#fff') {
  g.save();
  g.clearRect(0, 0, S, S);
  g.translate(S / 2, S / 2);
  g.scale(S / 128, S / 128);
  g.fillStyle = color; g.strokeStyle = color;
  g.lineWidth = 8; g.lineCap = 'round'; g.lineJoin = 'round';
  switch (type) {
    case 'fullPantry': {
      // three bullets in a row
      for (const x of [-30, 0, 30]) {
        g.beginPath();
        g.moveTo(x - 10, 34); g.lineTo(x - 10, -14);
        g.quadraticCurveTo(x - 10, -40, x, -46); g.quadraticCurveTo(x + 10, -40, x + 10, -14);
        g.lineTo(x + 10, 34); g.closePath(); g.fill();
        g.fillStyle = 'rgba(0,0,0,0.45)'; g.fillRect(x - 10, 18, 20, 5); g.fillStyle = color;
      }
      g.fillRect(-46, 40, 92, 8);
      break;
    }
    case 'oneBite': {
      // skull with a big bite out of the top
      g.beginPath(); g.arc(0, -8, 40, 0, Math.PI * 2); g.fill();
      g.fillRect(-24, 20, 48, 26);
      g.globalCompositeOperation = 'destination-out';
      g.beginPath(); g.arc(-15, -6, 11, 0, 7); g.fill();
      g.beginPath(); g.arc(15, -6, 11, 0, 7); g.fill();
      g.beginPath(); g.moveTo(0, 6); g.lineTo(-7, 18); g.lineTo(7, 18); g.fill();
      for (const x of [-12, 0, 12]) g.fillRect(x - 2, 30, 4, 16);
      for (let i = 0; i < 4; i++) { g.beginPath(); g.arc(-18 + i * 12, -50, 9, 0, 7); g.fill(); } // the bite
      g.globalCompositeOperation = 'source-over';
      break;
    }
    case 'doubleDough': {
      g.font = '900 78px Impact, "Arial Black", sans-serif';
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('x2', 0, 6);
      g.lineWidth = 6; g.beginPath(); g.arc(0, 2, 56, 0, Math.PI * 2); g.stroke();
      break;
    }
    case 'pressureCooker': {
      // a pot with its lid blowing off
      g.beginPath();
      g.moveTo(-44, -6); g.lineTo(44, -6); g.lineTo(38, 40); g.quadraticCurveTo(0, 50, -38, 40); g.closePath(); g.fill();
      g.fillRect(-56, -2, 14, 8); g.fillRect(42, -2, 14, 8);
      g.save(); g.translate(6, -26); g.rotate(-0.35);
      g.fillRect(-42, -6, 84, 10); g.fillRect(-8, -16, 16, 10);
      g.restore();
      for (const [x, y] of [[-30, -40], [30, -48], [0, -56]]) { g.beginPath(); g.moveTo(x, y + 14); g.lineTo(x + 6, y); g.stroke(); }
      break;
    }
    case 'shopClass': {
      // hammer
      g.save(); g.rotate(-0.6);
      g.fillRect(-7, -18, 14, 70);
      g.fillRect(-36, -42, 60, 24);
      g.beginPath(); g.moveTo(24, -42); g.lineTo(44, -50); g.lineTo(44, -14); g.lineTo(24, -18); g.fill();
      g.restore();
      break;
    }
    case 'clearanceSale': {
      // price tag
      g.save(); g.rotate(-0.4);
      g.beginPath(); g.moveTo(-46, -26); g.lineTo(26, -26); g.lineTo(50, 0); g.lineTo(26, 26); g.lineTo(-46, 26); g.closePath(); g.fill();
      g.globalCompositeOperation = 'destination-out';
      g.beginPath(); g.arc(30, 0, 7, 0, 7); g.fill();
      g.font = '900 34px Impact, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('$10', -10, 2);
      g.globalCompositeOperation = 'source-over';
      g.restore();
      break;
    }
  }
  g.restore();
}

// A data URL for the HUD.
const urlCache = new Map();
export function powerupIconURL(type, color) {
  const key = type + color;
  if (urlCache.has(key)) return urlCache.get(key);
  const c = document.createElement('canvas');
  c.width = c.height = 96;
  drawPowerupIcon(c.getContext('2d'), type, 96, color);
  const url = c.toDataURL();
  urlCache.set(key, url);
  return url;
}
