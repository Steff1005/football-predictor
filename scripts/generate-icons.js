const sharp = require('sharp')
const fs = require('fs')

const sizes = [72, 96, 128, 144, 152, 192, 384, 512]

async function generateIcons() {
  if (!fs.existsSync('public/icons')) {
    fs.mkdirSync('public/icons')
  }

  for (const size of sizes) {
    await sharp('public/favicon.svg')
      .resize(size, size)
      .png()
      .toFile(`public/icons/icon-${size}x${size}.png`)
    console.log(`✓ icon-${size}x${size}.png`)
  }

  await sharp('public/favicon.svg')
    .resize(180, 180)
    .png()
    .toFile('public/apple-touch-icon.png')
  console.log('✓ apple-touch-icon.png')
}

generateIcons()
