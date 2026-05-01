/**
 * StudyGuide AI — Google Apps Script formatter
 * ─────────────────────────────────────────────
 * Receives JSON from the Tampermonkey userscript and appends content into a
 * target Google Doc using professional study-book formatting:
 *
 *   • Front matter (Author Introduction, Copyright, How to Use This Book,
 *     Why Trust This Study Guide) → single column, Calibri 11, page-per-section.
 *   • Main body (domains + sub-domains + content + tables + figures +
 *     practice questions) → 2-column layout, Calibri 11, with headings styled as:
 *       #Domain-N:Name      → Heading 1, Calibri 14 bold, on a new page
 *       ##Subdomain-N.M:N.  → Heading 2, Calibri 12 bold
 *       ###Specific Topic   → inline bold line, Calibri 12 bold
 *   • Practice questions → `Q1. …` line bold Calibri 12, options as-is,
 *     `Answer: A` line bold Calibri 12, `Explanation:` word-prefix bold Calibri 12,
 *     explanation body Calibri 11.
 *
 * Entry points:
 *   doPost(e)   — webhook called by the userscript
 *   runTests()  — local sanity test
 *
 * Protocol:
 *   POST https://script.google.com/macros/s/.../exec
 *   Body JSON:
 *     { secret, docId, action:"ping" }
 *     { secret, docId, action:"append", section, content }
 *     { secret, docId, action:"appendImage", section, imageCaption,
 *       imageSrc|imageData|asciiArt }
 *
 * Deploy: Extensions → Apps Script → paste this file → Deploy → New deployment
 *   → Type: Web app, Execute as: Me, Access: Anyone with the link.
 *   Copy the /exec URL into the userscript's "Apps Script URL" field.
 */

// ── CONFIG ─────────────────────────────────────────────────────────────
const SHARED_SECRET = 'CHANGE_ME_TO_A_LONG_RANDOM_STRING';

const FONT          = 'Calibri';
const BODY_SIZE     = 11;
const H1_SIZE       = 14;  // #Domain-N
const H2_SIZE       = 12;  // ##Subdomain-N.M
const H3_SIZE       = 12;  // ###Topic heading
const Q_SIZE        = 12;  // practice question / answer / explanation label

// ── ENTRY ──────────────────────────────────────────────────────────────
function doPost(e) {
  try {
    const raw = (e && e.postData && e.postData.contents) || '{}';
    const payload = JSON.parse(raw);

    if (!payload.secret || String(payload.secret) !== String(SHARED_SECRET)) {
      return json({ status: 'error', message: 'invalid secret' });
    }
    if (!payload.docId) {
      return json({ status: 'error', message: 'missing docId' });
    }

    const action = String(payload.action || 'append').toLowerCase();

    if (action === 'ping') {
      return json({ status: 'ok', message: 'pong' });
    }

    const doc  = DocumentApp.openById(payload.docId);
    const body = doc.getBody();

    if (action === 'append') {
      appendSection_(body, payload);
      return json({ status: 'ok' });
    }

    if (action === 'appendimage') {
      appendImageBlock_(body, payload);
      return json({ status: 'ok' });
    }

    return json({ status: 'error', message: 'unknown action: ' + action });
  } catch (err) {
    return json({ status: 'error', message: String(err && err.message || err) });
  }
}

function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── SECTION ROUTING ───────────────────────────────────────────────────
// The userscript's `section` label tells us whether this chunk is front
// matter (single column) or main body (two columns).
function isFrontMatterSection_(section) {
  const s = String(section || '').toLowerCase();
  return (
    s.indexOf('author introduction') !== -1 ||
    s.indexOf('author_intro')        !== -1 ||
    s.indexOf('front_author_intro')  !== -1 ||
    s.indexOf('copyright')           !== -1 ||
    s.indexOf('how to use')          !== -1 ||
    s.indexOf('how_to_use')          !== -1 ||
    s.indexOf('why trust')           !== -1 ||
    s.indexOf('why_trust')           !== -1
  );
}

function appendSection_(body, payload) {
  const section = String(payload.section || '').trim();
  const content = String(payload.content || '');

  // Safety scrub — the userscript may already strip SOURCE: but double-check.
  const cleaned = scrubArtifacts_(content);
  if (!cleaned.trim()) return;

  ensureColumnMode_(body, isFrontMatterSection_(section));

  // Each front-matter section begins on a fresh page.
  if (isFrontMatterSection_(section)) {
    addPageBreakIfNeeded_(body);
  }
  // Each new Domain starts on a fresh page. We detect "#Domain-N:" in the
  // first few lines of a body chunk.
  else if (/^\s*#Domain[- ]\d/.test(cleaned) || /^\s*#\s+Domain[- ]\d/i.test(cleaned)) {
    addPageBreakIfNeeded_(body);
  }

  renderMarkup_(body, cleaned);
}

// ── COLUMN MODE CONTROL ───────────────────────────────────────────────
// Google Docs Apps Script doesn't have a first-class "sections with columns"
// API, but we can simulate column-layout changes by inserting a
// non-breaking-space paragraph followed by a ParagraphHeading.NORMAL line
// with the desired column count stored via DocumentProperties.
//
// Since Apps Script exposes only a single-column body through DocumentApp,
// we implement columns using a 1x2 borderless table for the main body
// content: every content chunk lives inside table cells that alternate
// left-column / right-column, approximating a 2-column book layout.
//
// Front matter is written directly to the body (no column wrapper).

const PROP_COLUMN_STATE = 'SG_COLUMN_STATE';
const PROP_COLUMN_TABLE = 'SG_COLUMN_TABLE_INDEX';

function ensureColumnMode_(body, wantSingle) {
  const props   = PropertiesService.getDocumentProperties();
  const current = props.getProperty(PROP_COLUMN_STATE); // '1' | '2' | null
  const want    = wantSingle ? '1' : '2';
  if (current === want) return;

  // Drop any previous tracking so future writes start a fresh column wrapper.
  props.deleteProperty(PROP_COLUMN_TABLE);
  props.setProperty(PROP_COLUMN_STATE, want);

  // Visual separator between column modes — a single empty paragraph.
  body.appendParagraph('');
}

// Append a paragraph into the active column context. In 2-column mode we
// lazily create / reuse a borderless 1x2 table; new paragraphs are routed
// into whichever cell is shorter.
function appendToColumn_(body, renderFn) {
  const props   = PropertiesService.getDocumentProperties();
  const mode    = props.getProperty(PROP_COLUMN_STATE) || '2';
  if (mode === '1') {
    // Single column — just render into the body.
    renderFn(body);
    return;
  }
  // 2-column mode — route into a 1x2 table.
  let tableIndex = Number(props.getProperty(PROP_COLUMN_TABLE) || -1);
  let table;
  if (tableIndex < 0 || !(table = safeTableAt_(body, tableIndex))) {
    table = body.appendTable([['', '']]);
    stripTableBorders_(table);
    setTableColumnWidths_(table, body);
    tableIndex = body.getChildIndex(table);
    props.setProperty(PROP_COLUMN_TABLE, String(tableIndex));
  }
  const leftCell  = table.getRow(0).getCell(0);
  const rightCell = table.getRow(0).getCell(1);
  const target    = (textLen_(leftCell) <= textLen_(rightCell)) ? leftCell : rightCell;
  renderFn(target);
}

function safeTableAt_(body, idx) {
  if (idx < 0 || idx >= body.getNumChildren()) return null;
  const ch = body.getChild(idx);
  return (ch && ch.getType() === DocumentApp.ElementType.TABLE) ? ch.asTable() : null;
}

function stripTableBorders_(table) {
  // Apps Script has no direct border-removal API, but setting borderWidth=0
  // via the underlying attribute works in practice.
  try { table.setBorderWidth(0); } catch (_) {}
  try { table.setBorderColor('#FFFFFF'); } catch (_) {}
}

function setTableColumnWidths_(table, body) {
  try {
    const usable = body.getPageWidth() - body.getMarginLeft() - body.getMarginRight();
    const col    = Math.floor(usable / 2) - 8; // small gutter
    table.setColumnWidth(0, col);
    table.setColumnWidth(1, col);
  } catch (_) {}
}

function textLen_(container) {
  try { return (container.getText() || '').length; } catch (_) { return 0; }
}

function addPageBreakIfNeeded_(body) {
  // Only insert a page break if the last child isn't already one.
  const n = body.getNumChildren();
  if (n > 0) {
    const last = body.getChild(n - 1);
    if (last.getType() !== DocumentApp.ElementType.PAGE_BREAK) {
      body.appendPageBreak();
    }
  } else {
    body.appendPageBreak();
  }
  // Reset the column tracker so the next paragraph starts a fresh wrapper.
  PropertiesService.getDocumentProperties().deleteProperty(PROP_COLUMN_TABLE);
}

// ── MARKUP → DOC RENDERING ────────────────────────────────────────────
// Tokenizes the content chunk into lines, walks blocks (headings, lists,
// tables, code, figures), and appends them with proper styles.

function renderMarkup_(body, text) {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // Skip pure blank lines but preserve paragraph breaks.
    if (!line.trim()) { i++; continue; }

    // 1) Block math  $$ … $$
    if (/^\s*\$\$/.test(line)) {
      const end = findLineIndex_(lines, i + 1, /\$\$\s*$/);
      const math = lines.slice(i + 1, end).join('\n');
      appendCodeBlock_(body, math, 'math');
      i = end + 1; continue;
    }

    // 2) Fenced code / chem / output
    const fence = /^\s*```\s*([a-zA-Z0-9_-]*)\s*$/.exec(line);
    if (fence) {
      const lang = (fence[1] || '').toLowerCase();
      const end = findLineIndex_(lines, i + 1, /^\s*```\s*$/);
      const code = lines.slice(i + 1, end).join('\n');
      appendCodeBlock_(body, code, lang || 'code');
      i = end + 1; continue;
    }

    // 3) Figure placeholder [FIGURE: title] … [/FIGURE]
    if (/^\s*\[FIGURE\s*:/i.test(line)) {
      const end = findLineIndex_(lines, i, /^\s*\[\/FIGURE\]\s*$/i);
      const block = lines.slice(i, end + 1).join('\n');
      appendFigurePlaceholder_(body, block);
      i = end + 1; continue;
    }

    // 4) Pipe table — a line that looks like "| col | col |" followed by
    //    a separator row like "|---|---|".
    if (isTableHeader_(line, lines[i + 1] || '')) {
      const end = findTableEnd_(lines, i);
      const tableLines = lines.slice(i, end);
      appendMarkdownTable_(body, tableLines);
      i = end; continue;
    }

    // 5) H1 — #Domain-N: … (or any H1)
    if (/^#[^#]/.test(line)) {
      const txt = stripPrefix_(line, '#');
      appendHeading_(body, txt, 1);
      i++; continue;
    }

    // 6) H2 — ##Subdomain-N.M: …
    if (/^##[^#]/.test(line)) {
      const txt = stripPrefix_(line, '##');
      appendHeading_(body, txt, 2);
      i++; continue;
    }

    // 7) H3 — ###Specific Topic
    if (/^###[^#]/.test(line)) {
      const txt = stripPrefix_(line, '###');
      appendHeading_(body, txt, 3);
      i++; continue;
    }

    // 8) Practice question "Qn. statement"
    const qMatch = /^(Q\d+)\.\s+(.+)$/.exec(line);
    if (qMatch) {
      appendPracticeQuestion_(body, qMatch[1], qMatch[2]);
      i++; continue;
    }

    // 9) Option line "(A) …"
    if (/^\(\s*[A-Za-z0-9]+\s*\)/.test(line)) {
      appendOptionLine_(body, line);
      i++; continue;
    }

    // 10) "Answer: X"
    if (/^Answer\s*:\s*/i.test(line)) {
      appendAnswerLine_(body, line);
      i++; continue;
    }

    // 11) "Explanation: …"
    if (/^Explanation\s*:/i.test(line)) {
      appendExplanationLine_(body, line);
      i++; continue;
    }

    // 12) Bullet list "- item"
    if (/^\s*-\s+/.test(line)) {
      const end = collectWhile_(lines, i, l => /^\s*-\s+/.test(l) || /^\s*$/.test(l));
      appendBulletList_(body, lines.slice(i, end).filter(l => /^\s*-\s+/.test(l)));
      i = end; continue;
    }

    // 13) Numbered list "1. item"
    if (/^\s*\d+\.\s+/.test(line)) {
      const end = collectWhile_(lines, i, l => /^\s*\d+\.\s+/.test(l) || /^\s*$/.test(l));
      appendNumberedList_(body, lines.slice(i, end).filter(l => /^\s*\d+\.\s+/.test(l)));
      i = end; continue;
    }

    // 14) Callout "> NOTE:" / "> WARNING:" / "> DEFINITION:"
    if (/^>\s+(NOTE|WARNING|DEFINITION)\s*:/i.test(line)) {
      appendCallout_(body, line);
      i++; continue;
    }

    // 15) Normal paragraph — collect until blank or block start
    {
      const end = collectWhile_(lines, i, (l, idx) => {
        if (idx === i) return true;
        if (!l.trim()) return false;
        if (isBlockStart_(l, lines[idx + 1] || '')) return false;
        return true;
      });
      const para = lines.slice(i, end).join(' ').replace(/\s+/g, ' ').trim();
      if (para) appendParagraph_(body, para);
      i = end; continue;
    }
  }
}

function findLineIndex_(lines, from, re) {
  for (let i = from; i < lines.length; i++) if (re.test(lines[i])) return i;
  return lines.length;
}

function collectWhile_(lines, from, pred) {
  let i = from;
  while (i < lines.length && pred(lines[i], i)) i++;
  return i;
}

function isTableHeader_(line, next) {
  if (!/^\s*\|.*\|\s*$/.test(line)) return false;
  return /^\s*\|\s*:?-{2,}.*\|/.test(next);
}

function findTableEnd_(lines, from) {
  let i = from + 2; // skip header + separator
  while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) i++;
  return i;
}

function isBlockStart_(line, next) {
  if (!line.trim()) return false;
  if (/^#{1,3}[^#]/.test(line)) return true;
  if (/^\s*```/.test(line)) return true;
  if (/^\s*\$\$/.test(line)) return true;
  if (/^\s*\[FIGURE\s*:/i.test(line)) return true;
  if (/^\s*-\s+/.test(line)) return true;
  if (/^\s*\d+\.\s+/.test(line)) return true;
  if (/^>\s+(NOTE|WARNING|DEFINITION)\s*:/i.test(line)) return true;
  if (/^(Q\d+)\.\s+/.test(line)) return true;
  if (/^\(\s*[A-Za-z0-9]+\s*\)/.test(line)) return true;
  if (/^(Answer|Explanation)\s*:/i.test(line)) return true;
  if (isTableHeader_(line, next)) return true;
  return false;
}

function stripPrefix_(line, hashes) {
  return line.replace(new RegExp('^' + hashes + '\\s*'), '').trim();
}

// ── PRIMITIVES ────────────────────────────────────────────────────────
function appendHeading_(body, text, level) {
  appendToColumn_(body, container => {
    const p = container.appendParagraph(text);
    if (level === 1) {
      p.setHeading(DocumentApp.ParagraphHeading.HEADING1);
      p.editAsText().setFontFamily(FONT).setFontSize(H1_SIZE).setBold(true);
    } else if (level === 2) {
      p.setHeading(DocumentApp.ParagraphHeading.HEADING2);
      p.editAsText().setFontFamily(FONT).setFontSize(H2_SIZE).setBold(true);
    } else {
      p.setHeading(DocumentApp.ParagraphHeading.NORMAL);
      p.editAsText().setFontFamily(FONT).setFontSize(H3_SIZE).setBold(true);
    }
  });
}

function appendParagraph_(body, text) {
  appendToColumn_(body, container => {
    const p = container.appendParagraph('');
    p.setHeading(DocumentApp.ParagraphHeading.NORMAL);
    renderInlineMarkup_(p.editAsText(), text, BODY_SIZE);
  });
}

// Inline renderer — handles **bold**, *italic*, `code`, $math$ inside a
// single paragraph's text element.
function renderInlineMarkup_(textEl, text, baseSize) {
  const tokens = tokenizeInline_(text);
  let cursor = textEl.getText().length; // usually 0 for a freshly-appended p
  tokens.forEach(tk => {
    const start = cursor;
    textEl.appendText(tk.text);
    cursor += tk.text.length;
    const end = cursor - 1;
    if (end < start) return;
    textEl.setFontFamily(start, end, FONT);
    textEl.setFontSize(start, end, baseSize);
    if (tk.bold)   textEl.setBold(start, end, true);
    if (tk.italic) textEl.setItalic(start, end, true);
    if (tk.mono) {
      textEl.setFontFamily(start, end, 'Consolas');
      textEl.setBackgroundColor(start, end, '#F1F3F4');
    }
  });
}

function tokenizeInline_(text) {
  // Tokens: {text, bold, italic, mono}
  const out = [];
  let buf = '';
  let bold = false, italic = false, mono = false;
  const push = () => { if (buf) out.push({ text: buf, bold, italic, mono }); buf = ''; };
  for (let i = 0; i < text.length; i++) {
    const c = text[i], n1 = text[i + 1];
    // `code`
    if (c === '`') {
      push();
      mono = !mono;
      continue;
    }
    // **bold**
    if (c === '*' && n1 === '*') {
      push();
      bold = !bold;
      i++;
      continue;
    }
    // *italic*
    if (c === '*') {
      push();
      italic = !italic;
      continue;
    }
    // inline math $...$  → render as monospace for now (Docs has no native eqn)
    if (c === '$' && n1 !== '$') {
      push();
      mono = !mono;
      continue;
    }
    buf += c;
  }
  push();
  return out;
}

function appendBulletList_(body, items) {
  appendToColumn_(body, container => {
    items.forEach(raw => {
      const txt = raw.replace(/^\s*-\s+/, '');
      const li = container.appendListItem('');
      li.setGlyphType(DocumentApp.GlyphType.BULLET);
      renderInlineMarkup_(li.editAsText(), txt, BODY_SIZE);
    });
  });
}

function appendNumberedList_(body, items) {
  appendToColumn_(body, container => {
    items.forEach(raw => {
      const txt = raw.replace(/^\s*\d+\.\s+/, '');
      const li = container.appendListItem('');
      li.setGlyphType(DocumentApp.GlyphType.NUMBER);
      renderInlineMarkup_(li.editAsText(), txt, BODY_SIZE);
    });
  });
}

function appendCodeBlock_(body, code, lang) {
  appendToColumn_(body, container => {
    const p = container.appendParagraph('');
    const t = p.editAsText();
    const label = '[' + (lang || 'code').toUpperCase() + ']\n';
    const content = code.replace(/\t/g, '  ');
    t.appendText(label + content);
    const total = t.getText().length;
    t.setFontFamily(0, total - 1, 'Consolas');
    t.setFontSize(0, total - 1, 10);
    t.setBackgroundColor(0, total - 1, '#F6F8FA');
  });
}

function appendMarkdownTable_(body, tableLines) {
  const rows = tableLines
    .filter(l => !/^\s*\|\s*:?-{2,}/.test(l)) // drop separator
    .map(l => l.replace(/^\s*\|/, '').replace(/\|\s*$/, '').split('|').map(c => c.trim()));

  if (!rows.length) return;
  appendToColumn_(body, container => {
    const tbl = container.appendTable(rows);
    // Style header row — bold, larger, subtle shade
    try {
      const headerRow = tbl.getRow(0);
      for (let c = 0; c < headerRow.getNumCells(); c++) {
        const cell = headerRow.getCell(c);
        const cellText = cell.editAsText();
        cellText.setFontFamily(FONT).setFontSize(BODY_SIZE).setBold(true);
        cell.setBackgroundColor('#F1F3F4');
      }
      for (let r = 1; r < tbl.getNumRows(); r++) {
        const row = tbl.getRow(r);
        for (let c = 0; c < row.getNumCells(); c++) {
          row.getCell(c).editAsText().setFontFamily(FONT).setFontSize(BODY_SIZE);
        }
      }
    } catch (_) {}
  });
}

function appendFigurePlaceholder_(body, block) {
  // Pull "[FIGURE: title]" and description for now — userscript will send the
  // actual image via action=appendImage right after this, which we'll render
  // inline into the current column cell.
  const titleMatch = /\[FIGURE\s*:\s*([^\]]+)\]/i.exec(block);
  const title = titleMatch ? titleMatch[1].trim() : 'Figure';
  appendToColumn_(body, container => {
    const p = container.appendParagraph(`Figure — ${title}`);
    p.editAsText().setFontFamily(FONT).setFontSize(BODY_SIZE - 1).setItalic(true);
  });
}

function appendCallout_(body, line) {
  const m = /^>\s+(NOTE|WARNING|DEFINITION)\s*:\s*(.*)$/i.exec(line);
  if (!m) return;
  const label = m[1].toUpperCase();
  const rest  = m[2];
  const colors = {
    NOTE:       '#E8F0FE',
    WARNING:    '#FCE8E6',
    DEFINITION: '#FEF7E0',
  };
  appendToColumn_(body, container => {
    const p = container.appendParagraph('');
    const t = p.editAsText();
    t.appendText(label + ': ');
    t.setFontFamily(0, label.length, FONT).setFontSize(0, label.length, BODY_SIZE).setBold(0, label.length, true);
    const s = t.getText().length;
    t.appendText(rest);
    const e = t.getText().length - 1;
    t.setFontFamily(s, e, FONT).setFontSize(s, e, BODY_SIZE);
    try { p.setBackgroundColor(colors[label] || '#EEE'); } catch (_) {}
  });
}

// ── PRACTICE QUESTION STYLING ─────────────────────────────────────────
function appendPracticeQuestion_(body, qLabel, statement) {
  appendToColumn_(body, container => {
    // Blank spacer above each question for readability
    container.appendParagraph('');
    const p = container.appendParagraph('');
    const t = p.editAsText();
    const full = `${qLabel}. ${statement}`;
    t.appendText(full);
    const end = t.getText().length - 1;
    t.setFontFamily(0, end, FONT).setFontSize(0, end, Q_SIZE).setBold(0, end, true);
  });
}

function appendOptionLine_(body, line) {
  appendToColumn_(body, container => {
    const p = container.appendParagraph(line);
    p.editAsText().setFontFamily(FONT).setFontSize(BODY_SIZE).setBold(false);
  });
}

function appendAnswerLine_(body, line) {
  appendToColumn_(body, container => {
    const p = container.appendParagraph(line);
    const t = p.editAsText();
    const end = t.getText().length - 1;
    t.setFontFamily(0, end, FONT).setFontSize(0, end, Q_SIZE).setBold(0, end, true);
  });
}

function appendExplanationLine_(body, line) {
  // "Explanation: body …"
  const idx = line.indexOf(':');
  const label = line.slice(0, idx + 1); // "Explanation:"
  const rest  = line.slice(idx + 1);

  appendToColumn_(body, container => {
    const p = container.appendParagraph('');
    const t = p.editAsText();
    // Label portion bold Calibri 12
    t.appendText(label);
    t.setFontFamily(0, label.length - 1, FONT)
     .setFontSize(0, label.length - 1, Q_SIZE)
     .setBold(0, label.length - 1, true);
    // Body portion Calibri 11, inline markup preserved
    const s = t.getText().length;
    const bodyText = rest.replace(/^\s/, '');
    renderInlineMarkupWithOffset_(t, bodyText, BODY_SIZE, s);
  });
}

function renderInlineMarkupWithOffset_(textEl, text, baseSize, startOffset) {
  const tokens = tokenizeInline_(text);
  let cursor = startOffset;
  // Pre-insert a leading space for separation
  textEl.appendText(' ');
  cursor += 1;
  tokens.forEach(tk => {
    const start = cursor;
    textEl.appendText(tk.text);
    cursor += tk.text.length;
    const end = cursor - 1;
    if (end < start) return;
    textEl.setFontFamily(start, end, FONT);
    textEl.setFontSize(start, end, baseSize);
    if (tk.bold)   textEl.setBold(start, end, true);
    if (tk.italic) textEl.setItalic(start, end, true);
    if (tk.mono) {
      textEl.setFontFamily(start, end, 'Consolas');
      textEl.setBackgroundColor(start, end, '#F1F3F4');
    }
  });
}

// ── IMAGE APPEND ──────────────────────────────────────────────────────
function appendImageBlock_(body, payload) {
  const caption = String(payload.imageCaption || 'Figure').trim();
  const dataUrl = payload.imageData;
  const src     = payload.imageSrc;
  const ascii   = payload.asciiArt;

  appendToColumn_(body, container => {
    try {
      let blob = null;
      if (dataUrl && /^data:image\//.test(dataUrl)) {
        const match = /^data:(image\/\w+);base64,(.*)$/.exec(dataUrl);
        if (match) {
          blob = Utilities.newBlob(Utilities.base64Decode(match[2]), match[1], caption);
        }
      } else if (src && /^https?:\/\//.test(src)) {
        const resp = UrlFetchApp.fetch(src, { muteHttpExceptions: true });
        if (resp.getResponseCode() >= 200 && resp.getResponseCode() < 300) {
          blob = resp.getBlob().setName(caption);
        }
      }

      if (blob) {
        // container.appendImage is available on Body/TableCell
        const img = container.appendImage(blob);
        try {
          // Scale image to fit column width
          const maxW = 280; // approximate half-page width minus gutter, in pts
          const w = img.getWidth() || maxW;
          const h = img.getHeight() || (maxW * 0.75);
          if (w > maxW) {
            const scale = maxW / w;
            img.setWidth(Math.floor(w * scale));
            img.setHeight(Math.floor(h * scale));
          }
        } catch (_) {}
        // Caption below
        const cap = container.appendParagraph(caption);
        cap.editAsText().setFontFamily(FONT).setFontSize(BODY_SIZE - 1).setItalic(true);
      } else if (ascii) {
        appendCodeBlock_(body, ascii, 'figure');
        const cap = container.appendParagraph(caption);
        cap.editAsText().setFontFamily(FONT).setFontSize(BODY_SIZE - 1).setItalic(true);
      } else {
        const p = container.appendParagraph(`[Figure: ${caption}]`);
        p.editAsText().setFontFamily(FONT).setFontSize(BODY_SIZE).setItalic(true);
      }
    } catch (err) {
      const p = container.appendParagraph(`[Figure insert failed: ${caption}]`);
      p.editAsText().setFontFamily(FONT).setFontSize(BODY_SIZE).setItalic(true);
    }
  });
}

// ── CONTENT SCRUBBING ─────────────────────────────────────────────────
// Remove artifacts we never want in the doc: SOURCE lines, acknowledgement
// echoes, stray "```" fence leftovers, leading/trailing blank lines.
function scrubArtifacts_(text) {
  if (!text) return '';
  let t = String(text);

  // Drop any line starting with "SOURCE:"
  t = t.replace(/^\s*SOURCE\s*:.*$/gmi, '');

  // Drop acknowledgement echoes that sometimes leak through
  t = t.replace(/^\s*(RULES|OUTLINE|SAMPLES|REFERENCE[_\s]*BOOKS?|DOMAIN)[\s_]*(ACKNOWLEDGED|CONFIRMED).*$/gmi, '');

  // Drop REFERENCE_NOT_FOUND lines (those trigger popups on the client side)
  t = t.replace(/^\s*REFERENCE_NOT_FOUND\s*:.*$/gmi, '');

  // Normalise multiple blank lines
  t = t.replace(/\n{3,}/g, '\n\n');

  // Trim
  t = t.replace(/^\s+/, '').replace(/\s+$/, '');
  return t;
}

// ── LOCAL TESTS ───────────────────────────────────────────────────────
function runTests() {
  // Quick sanity test using the active document. Open a Doc, paste-run this
  // function from the Apps Script editor after setting SHARED_SECRET.
  const doc = DocumentApp.getActiveDocument();
  if (!doc) { Logger.log('No active document.'); return; }
  const body = doc.getBody();

  appendSection_(body, {
    section: 'front_author_intro',
    content: '###Author Introduction\n\nThis is the first paragraph of the introduction …',
  });
  appendSection_(body, {
    section: 'PAGE 1 — Domain 1: Foundations — p1',
    content:
      '#Domain-1: Foundations\n\n' +
      '##Subdomain-1.1: Core Principles\n\n' +
      '###Three-way handshake\n\n' +
      'The **handshake** consists of three stages. Example: client sends SYN.\n\n' +
      '| Step | Packet | Purpose |\n|------|--------|---------|\n| 1 | SYN | Initiate |\n| 2 | SYN-ACK | Acknowledge |\n| 3 | ACK | Confirm |\n\n' +
      'SOURCE: Demo Book | Chapter: 1 | Pages: 1-3',
  });
  appendSection_(body, {
    section: 'Practice Questions — Domain 1 (Batch 1)',
    content:
      'Q1. Which packet initiates the handshake?\n(A) ACK\n(B) SYN\n(C) FIN\n(D) RST\nAnswer: B\nExplanation: The initiator sends SYN to request synchronization. ACK is used later. FIN closes the session. RST aborts.',
  });
}
