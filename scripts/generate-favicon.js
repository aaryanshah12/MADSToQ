/**
 * Build crisp favicons from the MADSToQ logo (Google recommends ≥48×48; render large then downscale).
 * Run: npm run generate-favicon
 */
const path = require("path");
const fs = require("fs");
const sharp = require("sharp");

const APP_PUBLIC = path.join(__dirname, "../apps/standard-erp/public");
const INPUT = path.join(APP_PUBLIC, "website/MADSToQ-logo.png");

async function buildSquareLogoBuffer() {
  return sharp(INPUT)
    .resize(512, 512, {
      fit: "contain",
      background: { r: 255, g: 255, b: 255, alpha: 0 },
    })
    .png()
    .toBuffer();
}

function circleArtwork(size) {
  const pad = Math.max(2, Math.round(size * 0.08));
  const stroke = Math.max(2, Math.round(size * 0.055));
  const c = size / 2;
  const outerR = c - pad;
  const innerR = outerR - stroke;
  return {
    pad,
    stroke,
    innerR,
    svg: Buffer.from(
      `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
        <circle cx="${c}" cy="${c}" r="${outerR - stroke / 2}" fill="#ffffff" stroke="#122033" stroke-width="${stroke}"/>
      </svg>`
    ),
    clip: Buffer.from(
      `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
        <circle cx="${c}" cy="${c}" r="${innerR}" fill="#ffffff"/>
      </svg>`
    ),
  };
}

async function writeCircularPng(sourceBuffer, size, outputPath) {
  const art = circleArtwork(size);
  const logoSize = Math.round(art.innerR * 2 * 0.92);
  const logo = await sharp(sourceBuffer)
    .resize(logoSize, logoSize, {
      fit: "contain",
      background: { r: 255, g: 255, b: 255, alpha: 0 },
    })
    .png()
    .toBuffer();
  const offset = Math.round((size - logoSize) / 2);
  const placed = await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: logo, left: offset, top: offset }])
    .png()
    .toBuffer();
  const clipped = await sharp(placed)
    .ensureAlpha()
    .composite([{ input: art.clip, blend: "dest-in" }])
    .png()
    .toBuffer();

  const masked = await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([
      { input: art.svg, left: 0, top: 0 },
      { input: clipped, left: 0, top: 0 },
    ])
    .png({ compressionLevel: 9 })
    .toBuffer();

  await sharp(masked).toFile(outputPath);
  const meta = await sharp(outputPath).metadata();
  console.log("Wrote", outputPath, `(${meta.width}×${meta.height})`);
}

async function main() {
  if (!fs.existsSync(INPUT)) {
    console.error("Missing input:", INPUT);
    process.exit(1);
  }

  const square = await buildSquareLogoBuffer();

  await writeCircularPng(square, 48, path.join(APP_PUBLIC, "favicon.png"));
  await writeCircularPng(square, 192, path.join(APP_PUBLIC, "favicon-192.png"));
  await writeCircularPng(square, 180, path.join(APP_PUBLIC, "apple-touch-icon.png"));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
