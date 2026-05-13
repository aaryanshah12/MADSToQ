/**
 * Build public/favicon.png (48×48) from the MADSToQ logo for Google Search favicon guidelines.
 * Run: node scripts/generate-favicon.js
 */
const path = require("path");
const fs = require("fs");
const sharp = require("sharp");

const SIZE = 48;
const R = SIZE / 2;

async function main() {
  const input = path.join(__dirname, "../public/website/MADSToQ.png");
  const output = path.join(__dirname, "../public/favicon.png");

  if (!fs.existsSync(input)) {
    console.error("Missing input:", input);
    process.exit(1);
  }

  const circleSvg = Buffer.from(
    `<svg width="${SIZE}" height="${SIZE}"><circle cx="${R}" cy="${R}" r="${R}" fill="#fff"/></svg>`
  );

  await sharp(input)
    .resize(SIZE, SIZE, {
      fit: "contain",
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    })
    .ensureAlpha()
    .composite([{ input: circleSvg, blend: "dest-in" }])
    .png()
    .toFile(output);

  const meta = await sharp(output).metadata();
  console.log("Wrote", output, `(${meta.width}×${meta.height})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
