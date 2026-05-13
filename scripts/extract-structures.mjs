/**
 * Crops structure images from pre-rendered PDF page PNGs using exact pixel coordinates
 * detected by detect-rows.mjs analysis.
 * Run AFTER page PNGs already exist in public/structures/_page1.png and _page2.png.
 * If they don't exist, renders them first.
 */
import puppeteer from 'puppeteer'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PDF_PATH = 'C:/Users/Aryan/Downloads/Vidhi Hexachem Product List (1) (1).pdf'
const OUT_DIR = path.join(__dirname, '../public/structures')

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true })

// ---- Exact pixel coordinates detected via border analysis ----
// Structure column: x=1238 to 1758 (between vertical separators at x=1237 and x=1759)
const STRUCT_X = 1238
const STRUCT_W = 520  // 1758 - 1238

// Page 1: 8 rows (products 1-8). Header ends at y=490.
// Row borders at: 490, 695, 899, 1103, 1307, 1511, 1715, 1920, 2125
const PAGE1_ROWS = [
  { sr: 1, top: 492, bottom: 694 },
  { sr: 2, top: 697, bottom: 898 },
  { sr: 3, top: 901, bottom: 1102 },
  { sr: 4, top: 1105, bottom: 1306 },
  { sr: 5, top: 1309, bottom: 1510 },
  { sr: 6, top: 1513, bottom: 1714 },
  { sr: 7, top: 1717, bottom: 1919 },
  { sr: 8, top: 1922, bottom: 2124 },
]

// Page 2: 9 rows (products 9-17). Header ends at y=341.
// Row borders at: 341, 544, 748, 952, 1157, 1361, 1565, 1769, 1973, 2178
const PAGE2_ROWS = [
  { sr: 9,  top: 342,  bottom: 543 },
  { sr: 10, top: 546,  bottom: 747 },
  { sr: 11, top: 751,  bottom: 951 },
  { sr: 12, top: 955,  bottom: 1156 },
  { sr: 13, top: 1159, bottom: 1360 },
  { sr: 14, top: 1363, bottom: 1564 },
  { sr: 15, top: 1567, bottom: 1768 },
  { sr: 16, top: 1771, bottom: 1972 },
  { sr: 17, top: 1975, bottom: 2177 },
]

function makeHtml(b64) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>*{margin:0;padding:0} canvas{display:block}</style></head>
<body><canvas id="c"></canvas>
<script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
<script>
pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
window.renderPage=async function(pageNum,scale){
  const raw=atob("${b64}");
  const bytes=new Uint8Array(raw.length);
  for(let i=0;i<raw.length;i++) bytes[i]=raw.charCodeAt(i);
  const pdf=await pdfjsLib.getDocument({data:bytes}).promise;
  window.__numPages=pdf.numPages;
  const page=await pdf.getPage(pageNum);
  const vp=page.getViewport({scale});
  const c=document.getElementById('c');
  c.width=vp.width; c.height=vp.height;
  await page.render({canvasContext:c.getContext('2d'),viewport:vp}).promise;
  window._done=true;
};
</script></body></html>`
}

async function renderPage(browser, htmlFile, pageNum, scale) {
  const page = await browser.newPage()
  await page.goto('file:///' + htmlFile.replace(/\\/g, '/'))
  await page.waitForFunction('typeof pdfjsLib !== "undefined"', { timeout: 30000 })
  await page.evaluate((n, s) => window.renderPage(n, s), pageNum, scale)
  await page.waitForFunction('window._done === true', { timeout: 60000 })
  const dims = await page.evaluate(() => {
    const c = document.getElementById('c')
    return { w: c.width, h: c.height }
  })
  await page.setViewport({ width: dims.w, height: dims.h, deviceScaleFactor: 1 })
  const imgPath = path.join(OUT_DIR, `_page${pageNum}.png`)
  await page.screenshot({ path: imgPath, clip: { x: 0, y: 0, width: dims.w, height: dims.h } })
  await page.close()
  console.log(`  Rendered page ${pageNum}: ${dims.w}x${dims.h}`)
  return imgPath
}

async function cropStructures(pageImg, rows) {
  const PAD = 8
  for (const row of rows) {
    const left = STRUCT_X + PAD
    const top = row.top + PAD
    const width = STRUCT_W - PAD * 2
    const height = row.bottom - row.top - PAD * 2

    const outFile = path.join(OUT_DIR, `product-${row.sr}.png`)
    await sharp(pageImg)
      .extract({ left, top, width, height })
      .resize(300, 200, { fit: 'inside', background: { r: 255, g: 255, b: 255, alpha: 1 } })
      .flatten({ background: '#ffffff' })
      .png()
      .toFile(outFile)
    console.log(`  product-${row.sr}.png (y=${row.top}-${row.bottom})`)
  }
}

async function run() {
  const page1Path = path.join(OUT_DIR, '_page1.png')
  const page2Path = path.join(OUT_DIR, '_page2.png')

  const needRender = !fs.existsSync(page1Path) || !fs.existsSync(page2Path)

  if (needRender) {
    console.log('Rendering PDF pages...')
    const pdfBase64 = fs.readFileSync(PDF_PATH).toString('base64')
    const htmlFile = path.join(__dirname, '_pdf_render_tmp.html')
    fs.writeFileSync(htmlFile, makeHtml(pdfBase64))
    const browser = await puppeteer.launch({ headless: true })
    try {
      await renderPage(browser, htmlFile, 1, 3)
      await renderPage(browser, htmlFile, 2, 3)
    } finally {
      await browser.close()
      if (fs.existsSync(htmlFile)) fs.unlinkSync(htmlFile)
    }
  } else {
    console.log('Using existing page renders.')
  }

  console.log('\nCropping Page 1 structures (products 1-8)...')
  await cropStructures(page1Path, PAGE1_ROWS)

  console.log('\nCropping Page 2 structures (products 9-17)...')
  await cropStructures(page2Path, PAGE2_ROWS)

  console.log('\nAll 17 structures saved to public/structures/')
}

run().catch(e => { console.error(e); process.exit(1) })
