# AGENTS.md

## Project Overview

This is a **Tampermonkey userscript + Google Apps Script** project for automated study guide generation. It has **no traditional backend, no database, and no build system**.

- `StudyGuide_v13.user.js` — Browser userscript (runs on ChatGPT/Gemini via Tampermonkey)
- `Code.gs` — Google Apps Script that receives content and formats it into Google Docs

## Cursor Cloud specific instructions

### Development Environment

- **Node.js** is used solely for development tooling (linting, syntax validation). The app itself runs in-browser (Tampermonkey) and on Google Apps Script.
- There is no build step or compilation. Both files are vanilla JavaScript.
- Run `npm install` to install dev dependencies (ESLint).

### Available Commands

| Command | Purpose |
|---------|---------|
| `npm run lint` | Run ESLint on both `.js` and `.gs` files |
| `npm run lint:fix` | Auto-fix ESLint issues |
| `npm run validate` | Syntax-check both files via `new Function()` |
| `npm test` | Run validate + lint |

### Development Server

A local dev server can be started with `node /tmp/dev-server.js` (created during setup) to serve:
- `GET /` — Test page with mocked Tampermonkey APIs
- `GET /StudyGuide_v13.user.js` — Userscript source
- `GET /Code.gs` — Apps Script source
- `POST /api/test` — Mock Apps Script endpoint (simulates `doPost`)

### Key Gotchas

- ESLint reports 14 warnings (unused vars) — these are expected because `doGet`/`doPost` are called by Google's infrastructure, and some userscript functions are called dynamically.
- The `.gs` extension is not recognized by `node --check`, so validation uses `new Function()` instead.
- Chrome blocks direct navigation to `.user.js` files (Tampermonkey security). Use `curl` to verify the server is correctly serving the userscript.
- There are no traditional "tests" — the `npm test` command validates syntax and lint only.
- The userscript injects UI into ChatGPT/Gemini pages; testing the full flow requires those sites plus a deployed Google Apps Script endpoint.
