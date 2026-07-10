// lib/colorUtils.js

/**
 * Given a hex color, returns a contrasting text color
 * that's the same hue but lighter or darker for readability.
 */
export function getContrastTextColor(hex) {
  // Strip #
  const raw = hex.replace("#", "");
  const r = parseInt(raw.substring(0, 2), 16);
  const g = parseInt(raw.substring(2, 4), 16);
  const b = parseInt(raw.substring(4, 6), 16);

  // Perceived luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  // If background is dark → return a light tint of same color
  // If background is light → return a dark shade of same color
  if (luminance < 0.5) {
    // Lighten: blend toward white
    return blendWithWhite(r, g, b, 0.6);
  } else {
    // Darken: blend toward black
    return blendWithBlack(r, g, b, 0.5);
  }
}

function blendWithWhite(r, g, b, amount) {
  const nr = Math.round(r + (255 - r) * amount);
  const ng = Math.round(g + (255 - g) * amount);
  const nb = Math.round(b + (255 - b) * amount);
  return `rgb(${nr}, ${ng}, ${nb})`;
}

function blendWithBlack(r, g, b, amount) {
  const nr = Math.round(r * (1 - amount));
  const ng = Math.round(g * (1 - amount));
  const nb = Math.round(b * (1 - amount));
  return `rgb(${nr}, ${ng}, ${nb})`;
}