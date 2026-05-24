#!/usr/bin/env node
/**
 * Generate PWA icons: public/icons/icon-192.png and icon-512.png
 * Pure Node.js — no external dependencies.
 */

const zlib = require('zlib')
const fs   = require('fs')
const path = require('path')

// CRC32 table
const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = (c & 1) ? 0xEDB88320 ^ (c >>> 1) : c >>> 1
    t[n] = c
  }
  return t
})()

function crc32(buf) {
  let c = 0xFFFFFFFF
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8)
  return (c ^ 0xFFFFFFFF) >>> 0
}

function chunk(type, data) {
  const typeB = Buffer.from(type, 'ascii')
  const lenB  = Buffer.alloc(4)
  lenB.writeUInt32BE(data.length)
  const crcInput = Buffer.concat([typeB, data])
  const crcB = Buffer.alloc(4)
  crcB.writeUInt32BE(crc32(crcInput))
  return Buffer.concat([lenB, typeB, data, crcB])
}

function buildPng(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width,  0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8]  = 8 // bit depth
  ihdr[9]  = 6 // RGBA
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0

  // Raw scanlines: each row prefixed with filter byte 0
  const raw = Buffer.alloc(height * (1 + width * 4))
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0
    for (let x = 0; x < width; x++) {
      const src = (y * width + x) * 4
      const dst = y * (width * 4 + 1) + 1 + x * 4
      raw[dst]   = rgba[src]
      raw[dst+1] = rgba[src+1]
      raw[dst+2] = rgba[src+2]
      raw[dst+3] = rgba[src+3]
    }
  }

  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

function lerp(a, b, t) { return a + (b - a) * t }

function drawIcon(size) {
  const pixels = new Uint8Array(size * size * 4)
  const cx = size / 2
  const cy = size / 2
  const r  = size * 0.42

  // Colours
  const BG    = [17,  24,  39,  255]  // #111827
  const GREEN = [34,  197, 94,  255]  // #22c55e
  const WHITE = [255, 255, 255, 255]

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx   = x - cx
      const dy   = y - cy
      const dist = Math.sqrt(dx * dx + dy * dy)
      const idx  = (y * size + x) * 4

      // Anti-aliased circle edge (±1 px blend)
      const t = Math.max(0, Math.min(1, (r + 1 - dist) / 2))

      // Base: background blended to green inside circle
      let r_ = lerp(BG[0], GREEN[0], t)
      let g_ = lerp(BG[1], GREEN[1], t)
      let b_ = lerp(BG[2], GREEN[2], t)

      // Simple soccer-ball hexagon outlines inside the circle (decorative)
      if (dist < r - 1) {
        const norm = size / 192  // scale factor
        const px   = dx / norm
        const py   = dy / norm

        // Rotating hex grid: draw thin lines at 60°/120°/180° angles
        const hex  = (px * 0.866 + py * 0.5) % 20
        const hex2 = (py) % 20
        const hex3 = (px * 0.866 - py * 0.5) % 20

        const near = (v, w) => Math.abs(((v % w) + w) % w - w / 2) < (0.9 * norm)
        if (near(hex, 20) || near(hex2, 20) || near(hex3, 20)) {
          const alpha = 0.18
          r_ = r_ * (1 - alpha) + WHITE[0] * alpha
          g_ = g_ * (1 - alpha) + WHITE[1] * alpha
          b_ = b_ * (1 - alpha) + WHITE[2] * alpha
        }
      }

      pixels[idx]   = Math.round(r_)
      pixels[idx+1] = Math.round(g_)
      pixels[idx+2] = Math.round(b_)
      pixels[idx+3] = 255
    }
  }

  return buildPng(size, size, pixels)
}

const outDir = path.join(__dirname, '..', 'public', 'icons')
fs.mkdirSync(outDir, { recursive: true })

for (const size of [192, 512]) {
  const file = path.join(outDir, `icon-${size}.png`)
  fs.writeFileSync(file, drawIcon(size))
  console.log(`Created ${file}`)
}
console.log('Done.')
