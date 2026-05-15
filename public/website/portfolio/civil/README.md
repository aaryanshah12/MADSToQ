# civilPortfolio

Luxury **Indian weekend villas** website for **Aranya Grove** — a plotted estate near Agol, Kadi, Gujarat. Immersive layout with parallax reveals and optional Three.js villa accents.

## Preview locally

```bash
cd civilPortfolio
python3 -m http.server 8080
```

Open [http://localhost:8080](http://localhost:8080).

## Deploy (GitHub Pages)

1. Push to `MADSTOQSolution/civilPortfolio`.
2. **Settings → Pages** → `main` branch, root `/`.
3. Live at `https://madstoqsolution.github.io/civilPortfolio/`

## Stack

- Static HTML / CSS / JavaScript
- [Three.js](https://threejs.org/) — optional courtyard villa hero model
- [GSAP ScrollTrigger](https://greensock.com/scrolltrigger/)

## Customize

- Update plot pricing, RERA number, and contact details in `index.html`.
- Replace gallery images with actual township photography.
- Wire the inquiry form to your CRM or Formspree in `main.js`.
