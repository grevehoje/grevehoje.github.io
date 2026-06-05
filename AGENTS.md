# AGENTS.md — GreveHoje.pt

## Stack
- **Monorepo** (pnpm workspace): `client/` + `server/`
- **Client:** React 19 + TypeScript 6.x + Vite 8 + vanilla CSS (CSS custom properties, no Tailwind)
- **Server:** Node.js + Express 5 + TypeScript (CommonJS), `ts-node-dev` for dev

## Commands

| Task | Command |
|------|---------|
| Dev (both) | `pnpm dev` |
| Dev (client) | `pnpm --filter client dev` → `vite` at `:5173` |
| Dev (server) | `pnpm --filter server dev` → `ts-node-dev --respawn --transpile-only src/index.ts` at `:3001` |
| Build (client) | `pnpm --filter client build` → `tsc -b && vite build` (type-check + bundle) |
| Build (server) | `pnpm --filter server build` → `tsc` |
| Lint | `pnpm --filter client lint` → `eslint .` |
| Tests | **None set up** (server test is a placeholder) |

## Important gotchas
- **Module systems differ:** `client/package.json` has `"type": "module"` (ESM), `server/package.json` has `"type": "commonjs"` (CJS). Do not convert the server to ESM without explicit request.
- **Client fetches API directly:** uses `import.meta.env.VITE_API_URL` (set in `.env.production`), falls back to `http://localhost:3001` in dev. No Vite proxy.
- **No database:** In-memory cache refreshed every 15 minutes. Data comes from scraping 5 operators: CP, Metro Lisboa, Metro do Porto, Carris, Fertagus.
- **Scrapers are live:** They hit real external URLs. Failures are caught and return `yellow` status with error message.
- **Theme system:** `data-theme="light|dark"` on `<html>`, persisted in `localStorage('theme')`, default follows `prefers-color-scheme`.
- **CSS conventions:** Vanilla CSS custom properties (`--bg`, `--text`, etc.) in `App.css`. Dark theme via `[data-theme='dark']`.

## Architecture
- Single API endpoint: `GET /api/status` → `{ hasStrikes, lastUpdate, operators: StrikeInfo[] }`
- Status colors: `red` (strike today), `yellow` (strike upcoming), `green` (normal)
- Server entry: `server/src/index.ts` — Express app with CORS, JSON body parser, `dotenv`. Waits for initial scrape before listening.
- All scrapers in `server/src/scrapers.ts`, each implements `Scraper` interface. `parsePortugueseDate()` at module level extracts dates from Portuguese text (e.g. "3 de junho" or "11 de dezembro de 2025").
- Client entry: `client/src/main.tsx` → `App.tsx`

## Existing instruction files
- `GEMINI.md` — engineering standards (keep as reference)
- `SPRINT.md` — sprint progress (keep as reference)

## Deployment prep (done)
- API URL configurable via `VITE_API_URL` in `client/.env.production`
- CORS restricted to `CORS_ORIGIN` env var (defaults to `http://localhost:5173`)
- `client/index.html` updated: `lang="pt"`, proper title + meta tags
- Local env secrets gitignored in `client/.gitignore` (`*.local`)

Pending: Vercel (frontend) + Render (backend) + custom domain per `SPRINT.md`.
