/**
 * COLOR CONVERSION UTILITIES
 *
 * Convert various color formats to Figma's RGB (0-1 range).
 */

export interface RGB {
  r: number;
  g: number;
  b: number;
}

export interface RGBA extends RGB {
  a: number;
}

/**
 * Parse any color format and return Figma-compatible RGB (0-1 range)
 */
export function parseColor(value: string): RGBA {
  // Default to black if parsing fails
  const defaultColor: RGBA = { r: 0, g: 0, b: 0, a: 1 };

  if (!value || typeof value !== "string") {
    return defaultColor;
  }

  const trimmed = value.trim();

  // Hex color
  if (trimmed.startsWith("#")) {
    return hexToRgba(trimmed);
  }

  // RGB/RGBA
  if (trimmed.startsWith("rgb")) {
    return parseRgbString(trimmed);
  }

  // HSL/HSLA
  if (trimmed.startsWith("hsl")) {
    return parseHslString(trimmed);
  }

  // OKLCH
  if (trimmed.startsWith("oklch")) {
    return parseOklchString(trimmed);
  }

  return defaultColor;
}

/**
 * Convert hex color to RGBA (0-1 range)
 */
export function hexToRgba(hex: string): RGBA {
  let h = hex.replace("#", "");

  // Handle shorthand (#RGB or #RGBA)
  if (h.length === 3) {
    h = h
      .split("")
      .map((c) => c + c)
      .join("");
  } else if (h.length === 4) {
    h = h
      .split("")
      .map((c) => c + c)
      .join("");
  }

  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  const a = h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1;

  return { r, g, b, a };
}

/**
 * Parse rgb() or rgba() string
 */
function parseRgbString(value: string): RGBA {
  const match = value.match(
    /rgba?\(\s*([\d.]+)%?\s*,?\s*([\d.]+)%?\s*,?\s*([\d.]+)%?\s*(?:,?\s*\/?\s*([\d.]+)%?)?\s*\)/i
  );

  if (!match) {
    return { r: 0, g: 0, b: 0, a: 1 };
  }

  const [, r, g, b, a] = match;

  // Check if values are percentages
  const isPercent = value.includes("%");
  const divisor = isPercent ? 100 : 255;

  return {
    r: parseFloat(r) / divisor,
    g: parseFloat(g) / divisor,
    b: parseFloat(b) / divisor,
    a: a ? parseFloat(a) : 1,
  };
}

/**
 * Parse hsl() or hsla() string
 */
function parseHslString(value: string): RGBA {
  const match = value.match(
    /hsla?\(\s*([\d.]+)\s*,?\s*([\d.]+)%\s*,?\s*([\d.]+)%\s*(?:,?\s*\/?\s*([\d.]+)%?)?\s*\)/i
  );

  if (!match) {
    return { r: 0, g: 0, b: 0, a: 1 };
  }

  const [, h, s, l, a] = match;
  const rgb = hslToRgb(parseFloat(h), parseFloat(s) / 100, parseFloat(l) / 100);

  return {
    ...rgb,
    a: a ? parseFloat(a) : 1,
  };
}

/**
 * Convert HSL to RGB (0-1 range)
 */
export function hslToRgb(h: number, s: number, l: number): RGB {
  h = h / 360;

  let r: number, g: number, b: number;

  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;

    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }

  return { r, g, b };
}

/**
 * Parse oklch() string
 * Format: oklch(L C H) or oklch(L C H / A)
 */
function parseOklchString(value: string): RGBA {
  // Match oklch(0.5 0.2 180) or oklch(0.5 0.2 180 / 0.5) or oklch(50% 0.2 180)
  const match = value.match(
    /oklch\(\s*([\d.]+)%?\s+([\d.]+)\s+([\d.]+)\s*(?:\/\s*([\d.]+)%?)?\s*\)/i
  );

  if (!match) {
    return { r: 0, g: 0, b: 0, a: 1 };
  }

  let [, l, c, h, a] = match;

  // Convert percentage to decimal for lightness
  let lightness = parseFloat(l);
  if (value.includes("%")) {
    lightness = lightness / 100;
  }

  const rgb = oklchToRgb(lightness, parseFloat(c), parseFloat(h));

  return {
    ...rgb,
    a: a ? parseFloat(a) : 1,
  };
}

/**
 * Convert OKLCH to RGB (0-1 range)
 * This is an approximation - OKLCH is a perceptually uniform color space
 */
export function oklchToRgb(l: number, c: number, h: number): RGB {
  // Convert OKLCH to OKLab
  const hRad = (h * Math.PI) / 180;
  const a = c * Math.cos(hRad);
  const b = c * Math.sin(hRad);

  // Convert OKLab to linear RGB
  const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = l - 0.0894841775 * a - 1.291485548 * b;

  const l3 = l_ * l_ * l_;
  const m3 = m_ * m_ * m_;
  const s3 = s_ * s_ * s_;

  let r = 4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3;
  let g = -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3;
  let bVal = -0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3;

  // Convert linear RGB to sRGB
  r = linearToSrgb(r);
  g = linearToSrgb(g);
  bVal = linearToSrgb(bVal);

  // Clamp values
  r = Math.max(0, Math.min(1, r));
  g = Math.max(0, Math.min(1, g));
  bVal = Math.max(0, Math.min(1, bVal));

  return { r, g, b: bVal };
}

/**
 * Convert linear RGB to sRGB
 */
function linearToSrgb(x: number): number {
  if (x <= 0.0031308) {
    return 12.92 * x;
  }
  return 1.055 * Math.pow(x, 1 / 2.4) - 0.055;
}

/**
 * Convert Figma RGB to hex string
 */
export function rgbToHex(rgb: RGB): string {
  const r = Math.round(rgb.r * 255)
    .toString(16)
    .padStart(2, "0");
  const g = Math.round(rgb.g * 255)
    .toString(16)
    .padStart(2, "0");
  const b = Math.round(rgb.b * 255)
    .toString(16)
    .padStart(2, "0");
  return `#${r}${g}${b}`;
}
