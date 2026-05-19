/**
 * Build crisp favicons from the MADSToQ logo (Google recommends ≥48×48; render large then downscale).
 * Run: npm run generate-favicon
 */
const path = require("path");
const fs = require("fs");
const sharp = require("sharp");

const APP_PUBLIC = path.join(__dirname, "../apps/standard-erp/public");
const INPUT = path.join(APP_PUBLIC, "website/MADSToQ.png");

async function buildSquareLogoBuffer() {
  const meta = await sharp(INPUT).metadata();
  const cropSize = Math.min(meta.width, meta.height);
  const top = Math.max(0, Math.floor((meta.height - cropSize) / 2));

  return sharp(INPUT)
    .extract({ left: 0, top, width: cropSize, height: cropSize })
    .resize(512, 512, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 1 } })
    .png()
    .toBuffer();
}

function circleMask(size) {
  const r = size / 2;
  return Buffer.from(
    `<svg width="${size}" height="${size}"><circle cx="${r}" cy="${r}" r="${r}" fill="#fff"/></svg>`
  );
}

async function writeCircularPng(sourceBuffer, size, outputPath) {
  const masked = await sharp(sourceBuffer)
    .resize(size, size, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 1 } })
    .ensureAlpha()
    .composite([{ input: circleMask(size), blend: "dest-in" }])
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

  fs.copyFileSync(INPUT, path.join(APP_PUBLIC, "MADSToQ.png"));
  console.log("Copied logo to", path.join(APP_PUBLIC, "MADSToQ.png"));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
