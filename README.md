# FIFA World Cup 2026 — ML Predictions

End-to-end CRISP-DM project: ML models predict every WC 2026 match, a Monte Carlo
simulator runs in the browser, and a Next.js site lets you explore "what-if" scenarios.

## Quick start

### 1. Python notebook (train models + export JSON)

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
# Place your Kaggle API token at %USERPROFILE%\.kaggle\kaggle.json
jupyter notebook notebook/wc2026_pipeline.ipynb
# Restart & Run All -> writes artifacts/ + web/public/data/
```

### 2. Next.js site

```powershell
cd web
npm install
npm run dev          # local
npm run build        # static export to ./out
npm start            # serve ./out at http://127.0.0.1:3000
```

On Windows, `start-site.bat` at the project root builds and opens the site.
Do not open `web/out/index.html` directly: Next.js assets require an HTTP server
with `web/out/` as its root.

## Architecture

- **Notebook** (`notebook/wc2026_pipeline.ipynb`) — full CRISP-DM pipeline:
  Business Understanding → Data Understanding → Data Preparation → Modeling
  (XGBoost W/D/L classifier + Dixon-Coles-adjusted Poisson goals model) →
  Evaluation → Deployment (JSON artifact export).
- **Browser Monte Carlo** (`web/src/lib/sim/`) — TS engine + Web Worker, seeded
  RNG, ~10k tournament iterations in ~1–2 s, supports user constraints.
- **Site** (`web/`) — Next.js 15, Tailwind, shadcn/ui, Framer Motion, Recharts.

See `notebook/wc2026_pipeline.ipynb` for the methodology write-up.

## Deploy

The site is a fully static export (`web/out/`). Drop it on any static host:

- **Vercel** (recommended): `cd web && npx vercel deploy --prod` — zero config.
- **Netlify / Cloudflare Pages**: point at `web/` with build command `npm run build`, publish directory `out`.
- **Any web server**: `web/out/` is plain HTML/JS/JSON — copy it anywhere.

There is no backend. The Monte Carlo runs entirely in the user's browser via a
Web Worker, fed by the JSON artifacts in `web/public/data/`.

## Project layout

```
notebook/wc2026_pipeline.ipynb   — full CRISP-DM pipeline (built by build_notebook.py)
notebook/build_notebook.py       — source of truth; regenerates the .ipynb
data/raw/wc2026_teams.json       — 48-team list + group draw (hand-curated)
artifacts/                       — trained models (joblib) + JSON exports
web/                             — Next.js 15 app, static export
  src/lib/sim/                   — Monte Carlo engine + Web Worker + tests
  src/app/                       — pages: /, /groups, /bracket, /versus, /simulator, /methodology
  scripts/seed-data.mjs          — placeholder JSON so the site runs before the notebook does
```

## Tests

```powershell
cd web
npm test           # Vitest — engine, RNG determinism, scoreline distribution
```
