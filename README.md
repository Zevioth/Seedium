# MozCraft Seed Map

A mobile-friendly Minecraft Bedrock / MCPE structure explorer starter, built with plain HTML, CSS, and JavaScript and deployable to Vercel. No Firebase, build step, frontend packages, or account system is required.

## What works

- Seed, X/Z center, radius, max-result, and structure-type inputs.
- Bedrock structure lookup through a small Vercel serverless proxy at `/api/scan`.
- Interactive coordinate grid with pan, zoom, center reset, map clicks, selected structure focus, and click-to-set search center.
- Results list with coordinates, distance, copy X/Z, and copy `/tp @s X ~ Z` actions.
- Copyable share URL using query parameters.
- Responsive layout for desktop and Android/mobile browsers.
- Input validation and readable error states.

## Important scope note

This is a **structure map MVP**, not a full Chunkbase replacement yet. The canvas is a coordinate grid with structure markers. It does **not** calculate or draw actual terrain, biome borders, cave layers, slime chunks, or ore distribution. Structure results are queried from the external SeedFinder service, so the feature depends on that service being available and on its supported prediction model. There is no version selector in this MVP; results may differ by exact Bedrock release.

Upstream API: <https://www.mineseedfinder.com/seedfinder/documentation>
Upstream project: <https://github.com/zebedelu/SeedFinder>

The upstream API documentation currently states a limit of 60 requests per IP per minute. The site should avoid repeatedly firing scans automatically. This project only submits a request when the user presses **Scan this seed**.

## Deploy to Vercel (recommended)

1. Extract this ZIP.
2. Create a new repository on GitHub, for example `mozcraft-seed-map`.
3. Upload the contents of this folder to the repository root (so `index.html`, `app.js`, `styles.css`, and `api/` are at the root, not inside another nested project folder).
4. In Vercel, choose **Add New → Project**, import your GitHub repository, and deploy.
5. Use the default project settings. This is a static site plus a Node.js serverless function; no build command or output directory is needed.
6. Open the deployed URL and run a scan. Don't test by opening `index.html` directly as a `file://` URL, because `/api/scan` is a Vercel endpoint.

## Local development

Install Node.js 20+ and the Vercel CLI, then run:

```bash
npm install -g vercel
npm run dev
```

Open the local URL printed by Vercel CLI. The local Vercel development server is needed to run `/api/scan`.

## Configuration

By default, `api/scan.js` calls `https://www.mineseedfinder.com/scan/bedrock`. To use a compatible upstream API host, configure this Vercel environment variable:

```text
SEEDFINDER_API_BASE=https://www.mineseedfinder.com
```

The base should be an origin such as `https://www.mineseedfinder.com`, not a URL ending in `/scan`.

## Folder structure

```text
mozcraft-seed-map/
├── api/
│   └── scan.js                 # Vercel serverless proxy + input validation
├── assets/
│   └── favicon.svg
├── docs/
│   └── API_AND_LIMITATIONS.md # scope, response, and integration notes
├── .gitignore
├── app.js                      # map canvas, form, results, interactivity
├── index.html                  # app markup
├── LICENSE                     # license for this starter's original code
├── package.json
├── README.md
├── styles.css
└── vercel.json
```

## Structure scan request

The browser sends `POST /api/scan` with JSON:

```json
{
  "seed": "31415",
  "x": 0,
  "z": 0,
  "radius": 100,
  "max": 50,
  "types": ["1", "5", "13", "24"]
}
```

The proxy validates the inputs and forwards them to the Bedrock endpoint. Seed values are kept as strings when forwarded to avoid unnecessary JavaScript integer precision loss.

## Attribution and trademarks

MozCraft Seed Map is an independent community project and is not affiliated with Mojang Studios or Microsoft. Minecraft is a trademark of Microsoft. This starter does not bundle or copy the upstream engine source; it calls the upstream public API. The original code in this starter is licensed under MIT; upstream service and repository terms remain separate.
