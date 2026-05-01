# AGENTS.md

## Project Overview

StudyGuide AI Automation — a Tampermonkey userscript + Google Apps Script system that generates professional exam study guides via AI (ChatGPT/Gemini) and formats them into Google Docs.

### Key Files

| File | Purpose |
|------|---------|
| `studyguide_automation.user.js` | Tampermonkey userscript (~4600 LOC) that orchestrates AI content generation |
| `apps_script/Code.gs` | Google Apps Script (~760 LOC) that formats content into Google Docs |

## Cursor Cloud specific instructions

### Development Commands

All commands are defined in `package.json`:

- **Lint**: `npm run lint` — ESLint with flat config (warnings are expected from existing code patterns like empty catch blocks)
- **Tests**: `npm test` — Node.js built-in test runner, tests live in `test/`
- **Syntax validation**: `npm run validate` — checks JS syntax for both the userscript and Code.gs

### Architecture Notes

- This is NOT a traditional web application with a dev server. There is no build step, no bundled output, no backend to start.
- The userscript runs inside a browser via Tampermonkey extension, and the Apps Script runs on Google's infrastructure.
- For development, you edit the `.user.js` and `.gs` files directly. Testing is done via ESLint (syntax/style), Node test runner (structure validation), and the Apps Script editor's `runTests()` function (requires a Google Doc).
- The ESLint config (`eslint.config.js`) declares Tampermonkey globals for the userscript and Google Apps Script globals for `.gs` files.

### Gotchas

- `apps_script/Code.gs` uses the `.gs` extension which Node.js does not natively recognize. Use `node --input-type=commonjs` with `vm.Script` for syntax checking (already wired into `npm run validate`).
- The userscript is wrapped in an IIFE with `'use strict'` — it is intentionally `sourceType: 'script'` for ESLint, not a module.
- ESLint warnings (empty catch blocks, unused vars) in existing code are intentional patterns and should not be "fixed" without understanding context.
- The `main` branch is intentionally minimal (just README). Active development code lives on feature branches.
