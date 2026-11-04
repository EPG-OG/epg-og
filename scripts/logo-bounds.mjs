// Finds the visible (non-transparent) bounds of a channel logo PNG, so the app can crop
// away the padding many guide logos ship with. Dependency-free: 8-bit PNGs only.
import { inflateSync } from 'node:zlib';

function decodePng(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) return null;
  let pos = 8;
  let width, height, depth, colorType, interlace;
  let trns, plte;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      depth = data[8];
      colorType = data[9];
      interlace = data[12];
    } else if (type === 'tRNS') trns = data;
    else if (type === 'PLTE') plte = data;
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    pos += 12 + len;
  }
  if (depth !== 8 || interlace) return null;
  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[colorType];
  if (!channels) return null;

  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const px = Buffer.alloc(height * stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let i = 0; i < stride; i++) {
      const a = i >= channels ? px[y * stride + i - channels] : 0;
      const b = y > 0 ? px[(y - 1) * stride + i] : 0;
      const c = y > 0 && i >= channels ? px[(y - 1) * stride + i - channels] : 0;
      let v = line[i];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      px[y * stride + i] = v & 0xff;
    }
  }

  const alphaAt = (x, y) => {
    const i = y * stride + x * channels;
    if (colorType === 6) return px[i + 3];
    if (colorType === 4) return px[i + 1];
    if (colorType === 3) return trns && px[i] < trns.length ? trns[px[i]] : 255;
    return 255; // no alpha channel
  };
  const rgbAt = (x, y) => {
    const i = y * stride + x * channels;
    if (colorType === 3) return [plte[px[i] * 3], plte[px[i] * 3 + 1], plte[px[i] * 3 + 2]];
    if (colorType === 0 || colorType === 4) return [px[i], px[i], px[i]];
    return [px[i], px[i + 1], px[i + 2]];
  };
  return { width, height, alphaAt, rgbAt };
}

const linear = (v) => {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
const luminance = ([r, g, b]) => 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
const GUIDE_BACKGROUND = luminance([0x14, 0x16, 0x1a]);

/**
 * How readable a logo is on the app's dark background:
 *   darkShare – share of its visible pixels with too little contrast against the background
 *   coverage  – share of its visible area that is solid (near 1 = it has its own background box)
 */
export function logoContrast(buf) {
  let img;
  try {
    img = decodePng(buf);
  } catch {
    return undefined;
  }
  if (!img) return undefined;
  const { width, height, alphaAt, rgbAt } = img;
  let visible = 0, dark = 0;
  let minX = width, minY = height, maxX = -1, maxY = -1;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      if (alphaAt(x, y) <= 128) continue;
      visible++;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      const contrast = (luminance(rgbAt(x, y)) + 0.05) / (GUIDE_BACKGROUND + 0.05);
      if (contrast < 2.2) dark++;
    }
  if (!visible) return undefined;
  return { darkShare: dark / visible, coverage: visible / ((maxX - minX + 1) * (maxY - minY + 1)) };
}

/** Returns [x, y, w, h, imageWidth, imageHeight] of the visible area, or undefined if it can't tell. */
export function logoBounds(buf) {
  let img;
  try {
    img = decodePng(buf);
  } catch {
    return undefined;
  }
  if (!img) return undefined;
  const { width, height, alphaAt } = img;
  let minX = width, minY = height, maxX = -1, maxY = -1;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++)
      if (alphaAt(x, y) > 16) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
  if (maxX < 0) return undefined;
  const bounds = [minX, minY, maxX - minX + 1, maxY - minY + 1, width, height];
  // Not worth cropping if the padding is negligible.
  return bounds[2] * bounds[3] > width * height * 0.9 ? undefined : bounds;
}
