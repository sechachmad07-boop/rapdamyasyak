// ============================================================
// imageUtils.js  --  Utilitas pemrosesan gambar
// - Konversi warna RGB <-> YCbCr (BT.601)
// - Pemecahan gambar menjadi blok 8x8
// - Penggabungan kembali blok menjadi gambar
// ============================================================

// Pastikan nilai piksel berada di rentang 0..255 (clamping)
function clamp(v) {
  return v < 0 ? 0 : v > 255 ? 255 : Math.round(v);
}

// ------------------------------------------------------------
// RGB -> YCbCr (BT.601)
// Y  = luminance (kecerahan)  -> channel yang kita sisipi watermark
// Cb = chroma blue
// Cr = chroma red
// Mata manusia kurang sensitif ke Cb/Cr, jadi watermark di Y
// tetap "tak kasat mata" namun tahan kompresi.
// ------------------------------------------------------------
function rgbToYcbcr(r, g, b) {
  const Y  =  0.299 * r + 0.587 * g + 0.114 * b;
  const Cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
  const Cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
  return { Y, Cb, Cr };
}

// ------------------------------------------------------------
// YCbCr -> RGB (kebalikan)
// ------------------------------------------------------------
function ycbcrToRgb(Y, Cb, Cr) {
  const r = Y + 1.402 * (Cr - 128);
  const g = Y - 0.344136 * (Cb - 128) - 0.714136 * (Cr - 128);
  const b = Y + 1.772 * (Cb - 128);
  return { r: clamp(r), g: clamp(g), b: clamp(b) };
}

// ------------------------------------------------------------
// Ambil buffer piksel RGB (Uint8Array, 3 channel) + dimensi,
// kembalikan array 2D channel Y (tinggi x lebar) dan Cb, Cr.
// ------------------------------------------------------------
function splitChannels(rgbBuffer, width, height) {
  const Y  = Array.from({ length: height }, () => new Array(width).fill(0));
  const Cb = Array.from({ length: height }, () => new Array(width).fill(0));
  const Cr = Array.from({ length: height }, () => new Array(width).fill(0));
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 3;
      const { Y: Yv, Cb: Cbv, Cr: Crv } = rgbToYcbcr(
        rgbBuffer[idx], rgbBuffer[idx + 1], rgbBuffer[idx + 2]
      );
      Y[y][x] = Yv;
      Cb[y][x] = Cbv;
      Cr[y][x] = Crv;
    }
  }
  return { Y, Cb, Cr };
}

// ------------------------------------------------------------
// Gabungkan channel Y (yang sudah dimodifikasi) + Cb/Cr asli
// menjadi buffer RGB Uint8Array.
// ------------------------------------------------------------
function mergeChannels(Y, Cb, Cr, width, height) {
  const out = new Uint8Array(width * height * 3);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const { r, g, b } = ycbcrToRgb(Y[y][x], Cb[y][x], Cr[y][x]);
      const idx = (y * width + x) * 3;
      out[idx] = r; out[idx + 1] = g; out[idx + 2] = b;
    }
  }
  return out;
}

// ------------------------------------------------------------
// Pad dimensi gambar ke kelipatan 8 (agar blok 8x8 pas).
// Jika tidak pas, tambah piksel duplikasi tepi.
// Mengembalikan {data, width, height, origW, origH}.
// ------------------------------------------------------------
function padToMultipleOf8(rgbBuffer, width, height) {
  const newW = Math.ceil(width / 8) * 8;
  const newH = Math.ceil(height / 8) * 8;
  if (newW === width && newH === height) {
    return { data: rgbBuffer, width, height, origW: width, origH: height };
  }
  const out = new Uint8Array(newW * newH * 3);
  for (let y = 0; y < newH; y++) {
    for (let x = 0; x < newW; x++) {
      const sx = Math.min(x, width - 1);
      const sy = Math.min(y, height - 1);
      const si = (sy * width + sx) * 3;
      const di = (y * newW + x) * 3;
      out[di] = rgbBuffer[si];
      out[di + 1] = rgbBuffer[si + 1];
      out[di + 2] = rgbBuffer[si + 2];
    }
  }
  return { data: out, width: newW, height: newH, origW: width, origH: height };
}

// ------------------------------------------------------------
// Crop kembali ke dimensi asli (buang padding).
// ------------------------------------------------------------
function cropToOriginal(rgbBuffer, paddedW, paddedH, origW, origH) {
  if (paddedW === origW && paddedH === origH) return rgbBuffer;
  const out = new Uint8Array(origW * origH * 3);
  for (let y = 0; y < origH; y++) {
    for (let x = 0; x < origW; x++) {
      const si = (y * paddedW + x) * 3;
      const di = (y * origW + x) * 3;
      out[di] = rgbBuffer[si];
      out[di + 1] = rgbBuffer[si + 1];
      out[di + 2] = rgbBuffer[si + 2];
    }
  }
  return out;
}

module.exports = {
  clamp, rgbToYcbcr, ycbcrToRgb,
  splitChannels, mergeChannels,
  padToMultipleOf8, cropToOriginal,
};
