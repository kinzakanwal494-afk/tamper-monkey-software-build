# StudyGuide AI — Google Apps Script formatter

This folder contains the Apps Script `Code.gs` that receives content from the
Tampermonkey userscript (`studyguide_automation.user.js`) and writes it into a
Google Doc with the exact layout requested:

- **Front matter** (`Author Introduction`, `Copyright`, `How to Use This Book`,
  `Why Trust This Study Guide`) → single-column layout, each on its own page.
- **Main body** (`#Domain-N:` through practice questions) → two-column layout,
  simulated with borderless 1×2 tables.
- **Fonts**: Calibri 11 body; H1 `#Domain-N` = Calibri 14 bold; H2
  `##Subdomain-N.M` = Calibri 12 bold; H3 `###Topic` = inline Calibri 12 bold.
- **Practice questions**: `Q1.` line bold Calibri 12, options normal Calibri 11,
  `Answer:` line bold Calibri 12, `Explanation:` label bold Calibri 12 and
  the explanation body Calibri 11.
- **Markup tokens supported**: headings `#` `##` `###`; bold `**text**`; italic
  `*text*`; inline `` `code` ``; block code ` ```lang `; chem block
  ` ```chem `; output block ` ```output `; block math `$$ … $$`; inline math
  `$ … $`; bullet lists `- `; numbered lists `1. `; markdown tables with
  `|---|---|` separator; figures `[FIGURE: title] … [/FIGURE]`; callouts
  `> NOTE:` / `> WARNING:` / `> DEFINITION:`.
- **Scrubbed automatically** (never written to the doc):
  - Any `SOURCE: …` line
  - `RULES ACKNOWLEDGED`, `OUTLINE_CONFIRMED`, `SAMPLES_CONFIRMED`,
    `REFERENCE BOOKS CONFIRMED`, `DOMAIN … CONFIRMED` acknowledgements
  - `REFERENCE_NOT_FOUND: …` (those only drive the client-side popup)
  - Triple-newlines collapsed to double

## Deploy

1. Open **script.google.com** → **New project**.
2. Paste the entire contents of `Code.gs` into the editor.
3. At the top of the file, replace the placeholder in
   `const SHARED_SECRET = 'CHANGE_ME_TO_A_LONG_RANDOM_STRING';` with a long,
   random string you'll also paste into the userscript.
4. **Deploy** → **New deployment** → **Type: Web app** → set
   **Execute as: Me** and **Who has access: Anyone with the link** → **Deploy**.
5. Authorise the scopes on first run
   (`DocumentApp`, `PropertiesService`, `UrlFetchApp`).
6. Copy the generated `/exec` URL.

## Wire up the userscript

In the Tampermonkey panel, **Google Docs Connection** section:

| Field                | Value                                                            |
|----------------------|------------------------------------------------------------------|
| Apps Script Web URL  | The `/exec` URL from step 6                                      |
| Google Doc ID        | The target doc's ID (from its URL)                               |
| Secret Key           | The same long random string you put in `SHARED_SECRET`           |

Click **🧪 Test Connection** — it should go green.
Then click **💾 Save Docs Config**. You're ready to run Start Generation.

## Protocol (what the userscript POSTs)

All POST requests are JSON:

```jsonc
// Connection test
{ "secret": "…", "docId": "…", "action": "ping" }

// Append a text section (a page, a table, a practice-question batch, etc.)
{
  "secret": "…",
  "docId":  "…",
  "action": "append",
  "section": "PAGE 3 — Domain 1: Foundations — p3",
  "content": "### Three-way handshake\n\nThe handshake consists …\nSOURCE: …"
}

// Append an image (inline into the current column cell)
{
  "secret": "…",
  "docId":  "…",
  "action": "appendImage",
  "section": "PAGE 3 — Domain 1 — Figure",
  "imageCaption": "TCP handshake",
  "imageData":    "data:image/png;base64,iVBORw0KGgoAAAA…",
  "imageSrc":     "https://…optional fallback URL…",
  "asciiArt":     "optional text fallback if no image captured"
}
```

Responses:

```json
{ "status": "ok" }
{ "status": "error", "message": "…" }
```

## Column behaviour

- Apps Script has no public "insert a multi-column section" API, so the
  formatter uses a borderless 1×2 table whenever two-column mode is active.
- Front-matter sections (the four preamble pages) are written in single-column
  mode to the body directly.
- Each domain gets a fresh page break before its `#Domain-N:` heading, and
  each front-matter page gets its own page break before the heading.
- Paragraphs in two-column mode are routed into the left cell until it fills,
  then the right cell — approximating a real two-column book flow.

## Known limitations (on purpose)

- **Real-time posting, no batching, no word breaks**: every `append` call
  writes a complete paragraph (or complete block) in one transaction, so
  nothing is ever cut between words or sentences. The userscript already
  chunks at paragraph boundaries (40 KB limit) before posting.
- **Image sizing** is best-effort (column width ≈ 280 pt). For very wide
  diagrams the image is down-scaled proportionally.
- **Inline math** renders as monospaced grey-background text (Google Docs has
  no native equation element exposed to Apps Script); block math is rendered
  as a Consolas code block.

## Tests

From the Apps Script editor you can run the `runTests()` function with a
target Google Doc open — it exercises the front matter, main body, table,
and practice-question rendering paths.
