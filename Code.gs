// ═══════════════════════════════════════════════════════════════════
//  StudyGuide AI — Google Apps Script (Docs Formatter) v2
//  Professional book-layout formatting with:
//  • Dark navy chapter banners with gold accents
//  • Two-column content layout (reduces white space)
//  • Blue-header tables, Key Term callout boxes
//  • Practice question banners + formatted Q blocks
//  • Image placeholders, math/equation blocks
//  • Calibri font, 1.5 line spacing throughout
// ═══════════════════════════════════════════════════════════════════

var SCRIPT_PROPS = PropertiesService.getScriptProperties();

// ─────────────────────────────────────────────────────────────
//  DESIGN CONSTANTS
// ─────────────────────────────────────────────────────────────
var FONT         = 'Calibri';
var BODY_SIZE    = 11;
var H3_SIZE      = 12;
var H2_SIZE      = 14;
var H1_SIZE      = 16;
var LINE_SPACING = 1.5;

var C = {
  NAVY:        '#0D1B2A',
  NAVY_MED:    '#1B3A5C',
  BLUE_HDR:    '#2E5090',
  BLUE_ACCENT: '#1A4480',
  BLUE_LIGHT:  '#E8EDF3',
  GREY_LIGHT:  '#F5F7FA',
  GREY_ALT:    '#F0F2F5',
  GREY_BORDER: '#CBD5E1',
  GOLD:        '#C9A96E',
  WHITE:       '#FFFFFF',
  BLACK:       '#000000',
  GREEN_DARK:  '#166534',
  RED_SOFT:    '#DC2626',
};

var FRONT_MATTER_KEYS = [
  'author introduction', 'copyright', 'how to use this book',
  'why trust this study guide', 'why trust this book',
  'front_author', 'front_copyright', 'front_how_to_use', 'front_why_trust',
];

// ─────────────────────────────────────────────────────────────
//  HTTP HANDLERS
// ─────────────────────────────────────────────────────────────
function doGet(e) {
  return _json({ status: 'ok', message: 'StudyGuide Apps Script v2 running.', version: '2.0.0' });
}

function doPost(e) {
  try {
    var p = JSON.parse(e.postData.contents);
    var secret = SCRIPT_PROPS.getProperty('SECRET_KEY') || '';
    if (secret && p.secret !== secret) return _json({ status: 'error', message: 'Invalid secret' });
    if (!p.docId) return _json({ status: 'error', message: 'Missing docId' });

    var action = (p.action || '').toLowerCase();

    if (action === 'ping') {
      try { return _json({ status: 'ok', title: DocumentApp.openById(p.docId).getName() }); }
      catch (err) { return _json({ status: 'error', message: 'Cannot open doc: ' + err.message }); }
    }

    if (action === 'append') {
      if (!(p.content || '').trim()) return _json({ status: 'ok', message: 'Empty — skipped' });
      appendFormattedContent(p.docId, p.content, p.section || '');
      return _json({ status: 'ok', section: p.section });
    }

    if (action === 'appendimage') {
      appendImage(p.docId, p);
      return _json({ status: 'ok', section: p.section || '' });
    }

    return _json({ status: 'error', message: 'Unknown action' });
  } catch (err) {
    return _json({ status: 'error', message: err.message });
  }
}

function _json(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

// ═══════════════════════════════════════════════════════════════════
//  MAIN ENTRY — route content to the right renderer
// ═══════════════════════════════════════════════════════════════════
function appendFormattedContent(docId, rawContent, section) {
  var doc  = DocumentApp.openById(docId);
  var body = doc.getBody();
  var text = rawContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  text = _stripSource(text);

  if (_isFrontMatter(section, text)) {
    _renderFrontMatter(body, text);
  } else {
    var blocks = _parseBlocks(text);
    _renderContentPage(body, blocks, section);
  }

  doc.saveAndClose();
}

// ═══════════════════════════════════════════════════════════════════
//  BLOCK PARSER — splits markdown into typed blocks
// ═══════════════════════════════════════════════════════════════════
function _parseBlocks(content) {
  var lines = content.split('\n');
  var blocks = [];
  var i = 0;

  while (i < lines.length) {
    var raw = lines[i];
    var t = raw.trim();
    if (t === '') { i++; continue; }

    // ── #Domain heading ──
    if (t.match(/^#[^#]/) && t.match(/Domain-\d+/i)) {
      blocks.push({ type: 'CHAPTER_BANNER', text: t.replace(/^#\s*/, '') });
      i++; continue;
    }
    // ── # other H1 ──
    if (t.match(/^#[^#]/)) {
      blocks.push({ type: 'H1', text: t.replace(/^#\s*/, '') });
      i++; continue;
    }
    // ── ##Subdomain heading ──
    if (t.match(/^##[^#]/)) {
      blocks.push({ type: 'H2', text: t.replace(/^##\s*/, '') });
      i++; continue;
    }
    // ── ###Practice Questions heading ──
    if (t.match(/^###\s*Practice Questions/i)) {
      blocks.push({ type: 'PRACTICE_BANNER', text: t.replace(/^###\s*/, '') });
      i++; continue;
    }
    // ── ###Topic heading ──
    if (t.match(/^###/)) {
      blocks.push({ type: 'H3', text: t.replace(/^###\s*/, '') });
      i++; continue;
    }

    // ── Table ──
    if (_isTableRow(t)) {
      var tbl = [];
      while (i < lines.length && _isTableRow(lines[i].trim())) {
        if (!_isTableSep(lines[i].trim())) tbl.push(lines[i].trim());
        i++;
      }
      if (tbl.length) blocks.push({ type: 'TABLE', rows: tbl });
      continue;
    }

    // ── Code / Chem block ──
    if (t.match(/^```/)) {
      var lang = t.replace(/^```\s*/, '').toLowerCase();
      var code = []; i++;
      while (i < lines.length && !lines[i].trim().match(/^```\s*$/)) { code.push(lines[i]); i++; }
      i++;
      blocks.push({ type: 'CODE', lang: lang, code: code.join('\n') });
      continue;
    }

    // ── Block math $$...$$ ──
    if (t === '$$') {
      var math = []; i++;
      while (i < lines.length && lines[i].trim() !== '$$') { math.push(lines[i]); i++; }
      i++;
      blocks.push({ type: 'MATH', content: math.join('\n') });
      continue;
    }

    // ── Figure ──
    if (t.match(/^\[FIGURE:/i)) {
      var fTitle = t.replace(/^\[FIGURE:\s*/i, '').replace(/\]\s*$/, '');
      var fDesc = []; i++;
      while (i < lines.length && !lines[i].trim().match(/^\[\/FIGURE\]/i)) { fDesc.push(lines[i].trim()); i++; }
      i++;
      blocks.push({ type: 'FIGURE', title: fTitle, desc: fDesc.join(' ') });
      continue;
    }

    // ── Practice question ──
    if (_isQLine(t)) {
      var q = { type: 'QUESTION', q: t, opts: [], ans: '', expl: '' };
      i++;
      while (i < lines.length && _isOptLine(lines[i].trim())) { q.opts.push(lines[i].trim()); i++; }
      if (i < lines.length && _isAnsLine(lines[i].trim())) { q.ans = lines[i].trim(); i++; }
      if (i < lines.length && _isExplLine(lines[i].trim())) {
        var ep = [lines[i].trim()]; i++;
        while (i < lines.length && lines[i].trim() !== '' &&
               !_isQLine(lines[i].trim()) && !_isAnsLine(lines[i].trim()) && !_isOptLine(lines[i].trim())) {
          ep.push(lines[i].trim()); i++;
        }
        q.expl = ep.join(' ');
      }
      blocks.push(q);
      continue;
    }

    // ── Callout / Key Term ──
    if (t.match(/^>\s*(NOTE|WARNING|DEFINITION|KEY\s*TERM)\s*:/i)) {
      blocks.push({ type: 'CALLOUT', text: t });
      i++; continue;
    }

    // ── Bullet list ──
    if (t.match(/^-\s+/)) {
      var bItems = [];
      while (i < lines.length && lines[i].trim().match(/^-\s+/)) {
        bItems.push(lines[i].trim().replace(/^-\s+/, '')); i++;
      }
      blocks.push({ type: 'BULLETS', items: bItems });
      continue;
    }

    // ── Numbered list ──
    if (t.match(/^\d+\.\s+/)) {
      var nItems = [];
      while (i < lines.length && lines[i].trim().match(/^\d+\.\s+/)) {
        nItems.push(lines[i].trim().replace(/^\d+\.\s+/, '')); i++;
      }
      blocks.push({ type: 'NUMBERED', items: nItems });
      continue;
    }

    // ── Bold-only line as heading (GPT sometimes skips ###) ──
    if (t.match(/^\*\*[^*]+\*\*$/) && t.length < 100) {
      var bh = t.replace(/^\*\*/, '').replace(/\*\*$/, '');
      blocks.push({ type: (bh.toUpperCase() === 'DISCLAIMER') ? 'H3' : 'H3', text: bh });
      i++; continue;
    }

    // ── Regular paragraph ──
    blocks.push({ type: 'PARA', text: t });
    i++;
  }

  return blocks;
}

// ═══════════════════════════════════════════════════════════════════
//  CONTENT PAGE RENDERER — banners + two-column layout
// ═══════════════════════════════════════════════════════════════════
function _renderContentPage(body, blocks, section) {
  var bannerRendered = false;
  var contentBlocks = [];

  for (var b = 0; b < blocks.length; b++) {
    var blk = blocks[b];

    if (blk.type === 'CHAPTER_BANNER') {
      _renderChapterBanner(body, blk.text);
      bannerRendered = true;
      continue;
    }

    if (blk.type === 'PRACTICE_BANNER') {
      _renderPracticeBanner(body, blk.text);
      bannerRendered = true;
      continue;
    }

    contentBlocks.push(blk);
  }

  if (contentBlocks.length === 0) return;

  // Render in two-column layout
  _renderTwoColumns(body, contentBlocks);
}

// ═══════════════════════════════════════════════════════════════════
//  CHAPTER BANNER — dark navy full-width box
//  Matches sample: dark background, "Chapter-N:" subtitle,
//  large bold name, gold decorative line
// ═══════════════════════════════════════════════════════════════════
function _renderChapterBanner(body, rawText) {
  // Parse: "Domain-1: Security Concepts" → "Chapter-1:" + "Security Concepts"
  var m = rawText.match(/^Domain-(\d+)\s*:\s*(.+)$/i);
  var chapterLabel = m ? 'Chapter-' + m[1] + ':' : '';
  var chapterName  = m ? m[2].trim() : rawText;

  // Page break before new chapter
  body.appendPageBreak();

  // Create banner table (1 row, 1 col, dark navy background)
  var table = body.appendTable();
  var row   = table.appendTableRow();
  var cell  = row.appendTableCell('');

  // Style the banner table
  table.setBorderWidth(0);
  table.setBorderColor(C.NAVY);
  cell.setBackgroundColor(C.NAVY);
  cell.setPaddingTop(28);
  cell.setPaddingBottom(28);
  cell.setPaddingLeft(24);
  cell.setPaddingRight(24);

  // Remove default empty first row
  if (table.getNumRows() > 1) table.removeRow(0);

  // Remove default empty paragraph in cell
  if (cell.getNumChildren() > 0 && cell.getChild(0).getType() === DocumentApp.ElementType.PARAGRAPH) {
    var defPara = cell.getChild(0).asParagraph();
    if (defPara.getText() === '') {
      // Reuse it for the chapter label
      if (chapterLabel) {
        defPara.setText(chapterLabel);
        defPara.setFontFamily(FONT);
        defPara.setFontSize(H2_SIZE);
        defPara.setForegroundColor(C.WHITE);
        defPara.setBold(false);
        defPara.setSpacingAfter(2);
        defPara.setLineSpacing(1.2);
      } else {
        defPara.setText(' ');
        defPara.setFontSize(4);
      }
    }
  }

  // Chapter name — large bold white
  var namePara = cell.appendParagraph(chapterName);
  namePara.setFontFamily(FONT);
  namePara.setFontSize(26);
  namePara.setBold(true);
  namePara.setForegroundColor(C.WHITE);
  namePara.setLineSpacing(1.15);
  namePara.setSpacingAfter(8);

  // Gold decorative line
  var goldLine = cell.appendParagraph('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  goldLine.setFontFamily(FONT);
  goldLine.setFontSize(8);
  goldLine.setForegroundColor(C.GOLD);
  goldLine.setSpacingAfter(6);
  goldLine.setSpacingBefore(0);

  // Subtitle
  var subtitle = cell.appendParagraph('Comprehensive Study Guide — In-Depth Coverage');
  subtitle.setFontFamily(FONT);
  subtitle.setFontSize(10);
  subtitle.setForegroundColor('#94A3B8');
  subtitle.setItalic(true);
  subtitle.setLineSpacing(1.2);

  // Small spacer after banner
  var spacer = body.appendParagraph('');
  spacer.setFontSize(4);
  spacer.setSpacingAfter(0);
  spacer.setSpacingBefore(0);
}

// ═══════════════════════════════════════════════════════════════════
//  PRACTICE QUESTIONS BANNER
// ═══════════════════════════════════════════════════════════════════
function _renderPracticeBanner(body, text) {
  body.appendPageBreak();

  var table = body.appendTable();
  var row   = table.appendTableRow();
  var cell  = row.appendTableCell('');

  table.setBorderWidth(0);
  table.setBorderColor(C.NAVY);
  cell.setBackgroundColor(C.NAVY);
  cell.setPaddingTop(16);
  cell.setPaddingBottom(16);
  cell.setPaddingLeft(20);
  cell.setPaddingRight(20);

  if (table.getNumRows() > 1) table.removeRow(0);

  // Reuse default paragraph
  var defP = cell.getChild(0).asParagraph();
  defP.setText(text);
  defP.setFontFamily(FONT);
  defP.setFontSize(18);
  defP.setBold(true);
  defP.setForegroundColor(C.WHITE);
  defP.setLineSpacing(1.3);
  defP.setAlignment(DocumentApp.HorizontalAlignment.CENTER);

  var spacer = body.appendParagraph('');
  spacer.setFontSize(4);
}

// ═══════════════════════════════════════════════════════════════════
//  TWO-COLUMN LAYOUT — borderless table with content split
// ═══════════════════════════════════════════════════════════════════
function _renderTwoColumns(body, blocks) {
  if (!blocks.length) return;

  // Split blocks into left / right columns (balanced by estimated height)
  var split = _splitBlocks(blocks);

  // Create 1-row, 2-column invisible table
  var table = body.appendTable();
  var row   = table.appendTableRow();
  var leftCell  = row.appendTableCell('');
  var rightCell = row.appendTableCell('');

  if (table.getNumRows() > 1) table.removeRow(0);

  table.setBorderWidth(0);
  table.setBorderColor(C.WHITE);

  leftCell.setPaddingTop(4);
  leftCell.setPaddingBottom(4);
  leftCell.setPaddingLeft(2);
  leftCell.setPaddingRight(10);

  rightCell.setPaddingTop(4);
  rightCell.setPaddingBottom(4);
  rightCell.setPaddingLeft(10);
  rightCell.setPaddingRight(2);

  // Render blocks in each cell
  _renderBlocksInContainer(leftCell, split.left);
  _renderBlocksInContainer(rightCell, split.right);

  // Clean up default empty paragraphs
  _cleanCell(leftCell);
  _cleanCell(rightCell);
}

// ═══════════════════════════════════════════════════════════════════
//  BLOCK SPLITTER — greedy balanced distribution
// ═══════════════════════════════════════════════════════════════════
function _splitBlocks(blocks) {
  var left = [], right = [];
  var leftH = 0, rightH = 0;

  for (var i = 0; i < blocks.length; i++) {
    var h = _estimateHeight(blocks[i]);
    if (leftH <= rightH) {
      left.push(blocks[i]);
      leftH += h;
    } else {
      right.push(blocks[i]);
      rightH += h;
    }
  }

  return { left: left, right: right };
}

function _estimateHeight(block) {
  switch (block.type) {
    case 'H1': case 'H2': return 3;
    case 'H3': return 2;
    case 'PARA': return Math.max(2, Math.ceil((block.text || '').length / 55));
    case 'TABLE': return (block.rows || []).length + 2;
    case 'CODE': return Math.max(3, (block.code || '').split('\n').length + 2);
    case 'MATH': return 4;
    case 'FIGURE': return 8;
    case 'QUESTION':
      return 3 + (block.opts || []).length + (block.ans ? 1 : 0) + (block.expl ? 3 : 0);
    case 'CALLOUT': return 3;
    case 'BULLETS': return (block.items || []).length + 1;
    case 'NUMBERED': return (block.items || []).length + 1;
    default: return 2;
  }
}

// ═══════════════════════════════════════════════════════════════════
//  RENDER BLOCKS IN A CONTAINER (body or table cell)
// ═══════════════════════════════════════════════════════════════════
function _renderBlocksInContainer(container, blocks) {
  for (var i = 0; i < blocks.length; i++) {
    var b = blocks[i];
    switch (b.type) {
      case 'H1':              _rH1(container, b.text); break;
      case 'H2':              _rH2(container, b.text); break;
      case 'H3':              _rH3(container, b.text); break;
      case 'PARA':            _rPara(container, b.text); break;
      case 'TABLE':           _rTable(container, b.rows); break;
      case 'CODE':            _rCode(container, b.code, b.lang); break;
      case 'MATH':            _rMath(container, b.content); break;
      case 'FIGURE':          _rFigure(container, b.title, b.desc); break;
      case 'QUESTION':        _rQuestion(container, b); break;
      case 'CALLOUT':         _rCallout(container, b.text); break;
      case 'BULLETS':         _rBullets(container, b.items); break;
      case 'NUMBERED':        _rNumbered(container, b.items); break;
      case 'CHAPTER_BANNER':  break; // handled separately
      case 'PRACTICE_BANNER': break; // handled separately
    }
  }
}

// ═══════════════════════════════════════════════════════════════════
//  HEADING RENDERERS
// ═══════════════════════════════════════════════════════════════════

// H1 — used rarely outside chapter banner
function _rH1(container, text) {
  var p = container.appendParagraph(text);
  p.setHeading(DocumentApp.ParagraphHeading.HEADING1);
  p.setFontFamily(FONT); p.setFontSize(H1_SIZE);
  p.setBold(true); p.setForegroundColor(C.BLUE_ACCENT);
  p.setLineSpacing(LINE_SPACING); p.setSpacingAfter(4);
}

// H2 — section heading with blue accent bar (table-based)
function _rH2(container, rawText) {
  var text = _convertSubdomain(rawText);

  // Create a mini 1x2 table: thin blue bar | heading text
  var tbl = container.appendTable();
  var row = tbl.appendTableRow();
  var barCell  = row.appendTableCell(' ');
  var textCell = row.appendTableCell('');

  if (tbl.getNumRows() > 1) tbl.removeRow(0);

  tbl.setBorderWidth(0);
  tbl.setBorderColor(C.WHITE);

  // Blue accent bar (narrow cell with blue background)
  barCell.setBackgroundColor(C.BLUE_HDR);
  barCell.setPaddingTop(2); barCell.setPaddingBottom(2);
  barCell.setPaddingLeft(0); barCell.setPaddingRight(0);
  barCell.setWidth(5);
  var barP = barCell.getChild(0).asParagraph();
  barP.setText('');
  barP.setFontSize(2);

  // Heading text
  textCell.setPaddingTop(4); textCell.setPaddingBottom(4);
  textCell.setPaddingLeft(8); textCell.setPaddingRight(4);
  var headP = textCell.getChild(0).asParagraph();
  headP.setText(text);
  headP.setFontFamily(FONT);
  headP.setFontSize(H2_SIZE);
  headP.setBold(true);
  headP.setForegroundColor(C.BLUE_ACCENT);
  headP.setLineSpacing(1.2);

  // Thin blue line below heading
  var lineP = textCell.appendParagraph('━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  lineP.setFontSize(5);
  lineP.setForegroundColor(C.BLUE_HDR);
  lineP.setSpacingBefore(0); lineP.setSpacingAfter(2);
}

// H3 — topic heading (bold, size 12, Calibri)
function _rH3(container, text) {
  var p = container.appendParagraph(text);
  p.setFontFamily(FONT); p.setFontSize(H3_SIZE);
  p.setBold(true); p.setForegroundColor(C.BLACK);
  p.setLineSpacing(LINE_SPACING);
  p.setSpacingBefore(6); p.setSpacingAfter(2);
}

// ═══════════════════════════════════════════════════════════════════
//  PARAGRAPH — with inline bold/italic/code/math
// ═══════════════════════════════════════════════════════════════════
function _rPara(container, text) {
  var p = container.appendParagraph('');
  p.setFontFamily(FONT); p.setFontSize(BODY_SIZE);
  p.setLineSpacing(LINE_SPACING);
  p.setAlignment(DocumentApp.HorizontalAlignment.JUSTIFY);
  _applyInline(p, text);
}

function _applyInline(para, text) {
  para.clear();
  var tokens = _parseInline(text);
  for (var i = 0; i < tokens.length; i++) {
    var tk = tokens[i];
    var ap = para.appendText(tk.text);
    ap.setFontFamily(tk.code ? 'Courier New' : FONT);
    ap.setFontSize(tk.size || BODY_SIZE);
    if (tk.bold) ap.setBold(true);
    if (tk.italic) ap.setItalic(true);
    if (tk.code) ap.setBackgroundColor('#F0F0F0');
    if (tk.color) ap.setForegroundColor(tk.color);
  }
}

function _parseInline(text) {
  var tokens = [];
  var re = /(\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`|\$(.+?)\$)/g;
  var last = 0, m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) tokens.push({ text: text.substring(last, m.index) });
    if (m[2])      tokens.push({ text: m[2], bold: true, italic: true });
    else if (m[3]) tokens.push({ text: m[3], bold: true });
    else if (m[4]) tokens.push({ text: m[4], italic: true });
    else if (m[5]) tokens.push({ text: m[5], code: true });
    else if (m[6]) tokens.push({ text: m[6], bold: true, italic: true });
    last = re.lastIndex;
  }
  if (last < text.length) tokens.push({ text: text.substring(last) });
  if (!tokens.length) tokens.push({ text: text });
  return tokens;
}

// ═══════════════════════════════════════════════════════════════════
//  TABLE — blue header row, clean borders, alternating rows
// ═══════════════════════════════════════════════════════════════════
function _rTable(container, tableRows) {
  if (!tableRows.length) return;

  var headerCells = _parseTR(tableRows[0]);
  var numCols = headerCells.length;

  var table = container.appendTable();
  // Header row
  var hRow = table.appendTableRow();
  for (var c = 0; c < numCols; c++) {
    var hCell = hRow.appendTableCell(headerCells[c] || '');
    var hP = hCell.getChild(0).asParagraph();
    hP.setFontFamily(FONT); hP.setFontSize(BODY_SIZE);
    hP.setBold(true); hP.setForegroundColor(C.WHITE);
    hP.setLineSpacing(1.2);
    hCell.setBackgroundColor(C.BLUE_HDR);
    hCell.setPaddingTop(4); hCell.setPaddingBottom(4);
    hCell.setPaddingLeft(6); hCell.setPaddingRight(6);
  }

  // Data rows with alternating background
  for (var r = 1; r < tableRows.length; r++) {
    var cells = _parseTR(tableRows[r]);
    var dRow = table.appendTableRow();
    var bg = (r % 2 === 0) ? C.GREY_ALT : C.WHITE;
    for (var c2 = 0; c2 < numCols; c2++) {
      var val = (c2 < cells.length) ? cells[c2] : '';
      var dCell = dRow.appendTableCell('');
      var dP = dCell.getChild(0).asParagraph();
      dP.setFontFamily(FONT); dP.setFontSize(BODY_SIZE);
      dP.setLineSpacing(1.2);
      _applyInline(dP, val);
      dCell.setBackgroundColor(bg);
      dCell.setPaddingTop(3); dCell.setPaddingBottom(3);
      dCell.setPaddingLeft(6); dCell.setPaddingRight(6);
    }
  }

  // Remove default empty first row
  if (table.getNumRows() > tableRows.length) {
    try { table.removeRow(0); } catch(e) {}
  }

  table.setBorderColor(C.GREY_BORDER);
  table.setBorderWidth(1);

  // Spacer
  var sp = container.appendParagraph('');
  sp.setFontSize(3); sp.setSpacingAfter(0); sp.setSpacingBefore(0);
}

// ═══════════════════════════════════════════════════════════════════
//  CODE BLOCK
// ═══════════════════════════════════════════════════════════════════
function _rCode(container, code, lang) {
  var isChem = (lang === 'chem' || lang === 'chemistry');
  if (isChem) { _rChem(container, code); return; }

  var isOutput = (lang === 'output');
  var label = isOutput ? 'Output:' : (lang ? lang.toUpperCase() + ':' : 'CODE:');

  // Label
  var lp = container.appendParagraph(label);
  lp.setFontFamily(FONT); lp.setFontSize(H3_SIZE);
  lp.setBold(true); lp.setForegroundColor(C.BLUE_ACCENT);
  lp.setLineSpacing(1.2); lp.setSpacingAfter(2);

  // Code in a styled table cell
  var tbl = container.appendTable();
  var row = tbl.appendTableRow();
  var cell = row.appendTableCell(code);
  if (tbl.getNumRows() > 1) tbl.removeRow(0);
  tbl.setBorderWidth(1); tbl.setBorderColor(C.GREY_BORDER);
  cell.setBackgroundColor('#F8F9FA');
  cell.setPaddingTop(8); cell.setPaddingBottom(8);
  cell.setPaddingLeft(10); cell.setPaddingRight(10);
  var cp = cell.getChild(0).asParagraph();
  cp.setFontFamily('Courier New'); cp.setFontSize(9);
  cp.setLineSpacing(1.15); cp.setForegroundColor('#1E293B');

  var sp = container.appendParagraph('');
  sp.setFontSize(2);
}

// ═══════════════════════════════════════════════════════════════════
//  CHEMICAL REACTION BLOCK
// ═══════════════════════════════════════════════════════════════════
function _rChem(container, code) {
  var lp = container.appendParagraph('Chemical Reaction:');
  lp.setFontFamily(FONT); lp.setFontSize(H3_SIZE);
  lp.setBold(true); lp.setForegroundColor(C.BLUE_ACCENT);
  lp.setLineSpacing(1.2);

  var rxLines = code.split('\n');
  for (var i = 0; i < rxLines.length; i++) {
    var rl = rxLines[i].trim();
    if (!rl) continue;
    var rp = container.appendParagraph(rl);
    rp.setFontFamily(FONT); rp.setFontSize(BODY_SIZE);
    rp.setBold(true); rp.setLineSpacing(LINE_SPACING);
    rp.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  }
  container.appendParagraph('').setFontSize(2);
}

// ═══════════════════════════════════════════════════════════════════
//  MATH / EQUATION BLOCK
// ═══════════════════════════════════════════════════════════════════
function _rMath(container, content) {
  var lp = container.appendParagraph('Equation:');
  lp.setFontFamily(FONT); lp.setFontSize(H3_SIZE);
  lp.setBold(true); lp.setForegroundColor(C.BLUE_ACCENT);
  lp.setLineSpacing(1.2);

  var mp = container.appendParagraph(content.trim());
  mp.setFontFamily('Cambria Math'); mp.setFontSize(12);
  mp.setBold(true); mp.setLineSpacing(LINE_SPACING);
  mp.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  mp.setSpacingAfter(6); mp.setSpacingBefore(4);
}

// ═══════════════════════════════════════════════════════════════════
//  FIGURE / IMAGE PLACEHOLDER
// ═══════════════════════════════════════════════════════════════════
function _rFigure(container, title, desc) {
  var figLabel = 'Figure: ' + title;

  // Figure box (table with border)
  var tbl = container.appendTable();
  var row = tbl.appendTableRow();
  var cell = row.appendTableCell('');
  if (tbl.getNumRows() > 1) tbl.removeRow(0);
  tbl.setBorderWidth(1); tbl.setBorderColor(C.GREY_BORDER);
  cell.setBackgroundColor('#FAFBFC');
  cell.setPaddingTop(20); cell.setPaddingBottom(12);
  cell.setPaddingLeft(12); cell.setPaddingRight(12);

  // Reuse default paragraph for placeholder text
  var ph = cell.getChild(0).asParagraph();
  ph.setText('[IMAGE PLACEHOLDER]');
  ph.setFontFamily(FONT); ph.setFontSize(H3_SIZE);
  ph.setBold(true); ph.setForegroundColor('#94A3B8');
  ph.setAlignment(DocumentApp.HorizontalAlignment.CENTER);

  var szP = cell.appendParagraph('Recommended size: 400 × 300 px');
  szP.setFontFamily(FONT); szP.setFontSize(8);
  szP.setForegroundColor('#94A3B8');
  szP.setAlignment(DocumentApp.HorizontalAlignment.CENTER);

  // Figure label below
  var flP = container.appendParagraph(figLabel);
  flP.setFontFamily(FONT); flP.setFontSize(10);
  flP.setBold(true); flP.setItalic(true);
  flP.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  flP.setForegroundColor(C.BLUE_ACCENT);
  flP.setLineSpacing(LINE_SPACING); flP.setSpacingAfter(2);

  if (desc) {
    var descP = container.appendParagraph(desc);
    descP.setFontFamily(FONT); descP.setFontSize(9);
    descP.setItalic(true); descP.setForegroundColor('#64748B');
    descP.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
    descP.setLineSpacing(1.2);
  }

  container.appendParagraph('').setFontSize(2);
}

// ═══════════════════════════════════════════════════════════════════
//  PRACTICE QUESTION RENDERER
// ═══════════════════════════════════════════════════════════════════
function _rQuestion(container, q) {
  // Question line — bold, size 12
  var qP = container.appendParagraph(q.q);
  qP.setFontFamily(FONT); qP.setFontSize(H3_SIZE);
  qP.setBold(true); qP.setForegroundColor(C.NAVY);
  qP.setLineSpacing(LINE_SPACING);
  qP.setSpacingBefore(6);

  // Options
  for (var i = 0; i < q.opts.length; i++) {
    var oP = container.appendParagraph(q.opts[i]);
    oP.setFontFamily(FONT); oP.setFontSize(BODY_SIZE);
    oP.setLineSpacing(LINE_SPACING);
    oP.setIndentStart(12);
  }

  // Answer line — bold, size 12, green
  if (q.ans) {
    var aP = container.appendParagraph(q.ans);
    aP.setFontFamily(FONT); aP.setFontSize(H3_SIZE);
    aP.setBold(true); aP.setForegroundColor(C.GREEN_DARK);
    aP.setLineSpacing(LINE_SPACING);
    aP.setSpacingBefore(3);
  }

  // Explanation — label bold 12, content 11
  if (q.expl) {
    var colonIdx = q.expl.indexOf(':');
    var explLabel = q.expl.substring(0, colonIdx + 1);
    var explBody  = q.expl.substring(colonIdx + 1).trim();

    // Explanation in a light grey box
    var eTbl = container.appendTable();
    var eRow = eTbl.appendTableRow();
    var eCell = eRow.appendTableCell('');
    if (eTbl.getNumRows() > 1) eTbl.removeRow(0);
    eTbl.setBorderWidth(0); eTbl.setBorderColor(C.GREY_LIGHT);
    eCell.setBackgroundColor(C.GREY_LIGHT);
    eCell.setPaddingTop(4); eCell.setPaddingBottom(4);
    eCell.setPaddingLeft(8); eCell.setPaddingRight(8);

    var eP = eCell.getChild(0).asParagraph();
    eP.clear();
    eP.setLineSpacing(1.3);
    var elT = eP.appendText(explLabel + ' ');
    elT.setFontFamily(FONT); elT.setFontSize(H3_SIZE); elT.setBold(true);
    if (explBody) {
      var ecT = eP.appendText(explBody);
      ecT.setFontFamily(FONT); ecT.setFontSize(BODY_SIZE); ecT.setBold(false);
    }
  }

  // Spacer
  container.appendParagraph('').setFontSize(3);
}

// ═══════════════════════════════════════════════════════════════════
//  CALLOUT / KEY TERM BOX
// ═══════════════════════════════════════════════════════════════════
function _rCallout(container, line) {
  var cleaned = line.replace(/^>\s*/, '');
  var colonIdx = cleaned.indexOf(':');
  var label = cleaned.substring(0, colonIdx).trim().toUpperCase();
  var content = cleaned.substring(colonIdx + 1).trim();

  // Key Term / Note / Warning box
  var tbl = container.appendTable();

  // Header row (dark blue)
  var hRow = tbl.appendTableRow();
  var hCell = hRow.appendTableCell(label);
  var hP = hCell.getChild(0).asParagraph();
  hP.setFontFamily(FONT); hP.setFontSize(10);
  hP.setBold(true); hP.setForegroundColor(C.WHITE);
  hCell.setBackgroundColor(C.NAVY_MED);
  hCell.setPaddingTop(4); hCell.setPaddingBottom(4);
  hCell.setPaddingLeft(8); hCell.setPaddingRight(8);

  // Content row (light background)
  var cRow = tbl.appendTableRow();
  var cCell = cRow.appendTableCell('');
  var cP = cCell.getChild(0).asParagraph();
  cP.setFontFamily(FONT); cP.setFontSize(BODY_SIZE);
  cP.setLineSpacing(1.3);
  _applyInline(cP, content);
  cCell.setBackgroundColor(C.BLUE_LIGHT);
  cCell.setPaddingTop(6); cCell.setPaddingBottom(6);
  cCell.setPaddingLeft(8); cCell.setPaddingRight(8);

  // Remove default first row
  if (tbl.getNumRows() > 2) tbl.removeRow(0);

  tbl.setBorderWidth(1); tbl.setBorderColor(C.GREY_BORDER);

  container.appendParagraph('').setFontSize(2);
}

// ═══════════════════════════════════════════════════════════════════
//  LIST RENDERERS
// ═══════════════════════════════════════════════════════════════════
function _rBullets(container, items) {
  for (var i = 0; i < items.length; i++) {
    var li = container.appendListItem('');
    li.setGlyphType(DocumentApp.GlyphType.BULLET);
    li.setFontFamily(FONT); li.setFontSize(BODY_SIZE);
    li.setLineSpacing(LINE_SPACING);
    _applyInline(li, items[i]);
  }
}

function _rNumbered(container, items) {
  for (var i = 0; i < items.length; i++) {
    var li = container.appendListItem('');
    li.setGlyphType(DocumentApp.GlyphType.NUMBER);
    li.setFontFamily(FONT); li.setFontSize(BODY_SIZE);
    li.setLineSpacing(LINE_SPACING);
    _applyInline(li, items[i]);
  }
}

// ═══════════════════════════════════════════════════════════════════
//  FRONT MATTER — single column, clean style
// ═══════════════════════════════════════════════════════════════════
function _renderFrontMatter(body, content) {
  var lines = content.split('\n');
  var i = 0;

  while (i < lines.length) {
    var t = lines[i].trim();
    if (t === '') { i++; continue; }

    // ### heading in front matter → H1 tag, Calibri 11
    if (t.match(/^###/)) {
      var hText = t.replace(/^###\s*/, '');
      var hp = body.appendParagraph(hText);
      hp.setHeading(DocumentApp.ParagraphHeading.HEADING1);
      hp.setFontFamily(FONT); hp.setFontSize(H2_SIZE);
      hp.setBold(true); hp.setForegroundColor(C.BLUE_ACCENT);
      hp.setLineSpacing(LINE_SPACING);
      hp.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
      hp.setSpacingAfter(8);

      // Decorative line under front matter heading
      var dl = body.appendParagraph('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      dl.setFontSize(6); dl.setForegroundColor(C.BLUE_HDR);
      dl.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
      dl.setSpacingAfter(8); dl.setSpacingBefore(0);

      i++; continue;
    }

    // **DISCLAIMER** bold heading
    if (t.match(/^\*\*DISCLAIMER\*\*$/i)) {
      var dp = body.appendParagraph('DISCLAIMER');
      dp.setFontFamily(FONT); dp.setFontSize(H3_SIZE);
      dp.setBold(true); dp.setForegroundColor(C.RED_SOFT);
      dp.setLineSpacing(LINE_SPACING); dp.setSpacingBefore(8);
      i++; continue;
    }

    // Bold-only line
    if (t.match(/^\*\*[^*]+\*\*$/) && t.length < 100) {
      var bt = t.replace(/^\*\*/, '').replace(/\*\*$/, '');
      var bp = body.appendParagraph(bt);
      bp.setFontFamily(FONT); bp.setFontSize(H3_SIZE);
      bp.setBold(true); bp.setLineSpacing(LINE_SPACING);
      bp.setSpacingBefore(4);
      i++; continue;
    }

    // Regular paragraph
    var pp = body.appendParagraph('');
    pp.setFontFamily(FONT); pp.setFontSize(BODY_SIZE);
    pp.setLineSpacing(LINE_SPACING);
    pp.setAlignment(DocumentApp.HorizontalAlignment.JUSTIFY);
    _applyInline(pp, t);
    i++;
  }
}

// ═══════════════════════════════════════════════════════════════════
//  IMAGE HANDLER
// ═══════════════════════════════════════════════════════════════════
function appendImage(docId, payload) {
  var doc  = DocumentApp.openById(docId);
  var body = doc.getBody();
  var caption = payload.imageCaption || payload.section || 'Figure';

  var inserted = false;

  if (payload.imageData && payload.imageData.indexOf('data:') === 0) {
    try {
      var parts = payload.imageData.split(',');
      var mimeMatch = parts[0].match(/data:([^;]+)/);
      var mime = mimeMatch ? mimeMatch[1] : 'image/png';
      var decoded = Utilities.base64Decode(parts[1]);
      var blob = Utilities.newBlob(decoded, mime, 'figure.png');
      var img = body.appendImage(blob);
      _scaleImage(img, 380);
      inserted = true;
    } catch (err) {
      var fb = body.appendParagraph('[Image error: ' + err.message + ']');
      fb.setFontFamily(FONT); fb.setFontSize(9);
      fb.setItalic(true); fb.setForegroundColor(C.RED_SOFT);
    }
  } else if (payload.imageSrc) {
    try {
      var resp = UrlFetchApp.fetch(payload.imageSrc);
      var imgBlob = resp.getBlob();
      var img2 = body.appendImage(imgBlob);
      _scaleImage(img2, 380);
      inserted = true;
    } catch (err2) {
      var fb2 = body.appendParagraph('[Image URL failed: ' + err2.message + ']');
      fb2.setFontFamily(FONT); fb2.setFontSize(9);
      fb2.setItalic(true); fb2.setForegroundColor(C.RED_SOFT);
    }
  } else if (payload.asciiArt) {
    var ascP = body.appendParagraph(payload.asciiArt);
    ascP.setFontFamily('Courier New'); ascP.setFontSize(8);
    ascP.setLineSpacing(1.0);
    inserted = true;
  } else {
    _rFigure(body, caption, '');
    inserted = true;
  }

  // Caption
  if (inserted) {
    var capP = body.appendParagraph(caption);
    capP.setFontFamily(FONT); capP.setFontSize(10);
    capP.setBold(true); capP.setItalic(true);
    capP.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
    capP.setForegroundColor(C.BLUE_ACCENT);
    capP.setLineSpacing(LINE_SPACING);
  }

  doc.saveAndClose();
}

function _scaleImage(img, maxW) {
  var w = img.getWidth();
  if (w > maxW) {
    var r = maxW / w;
    img.setWidth(maxW);
    img.setHeight(Math.round(img.getHeight() * r));
  }
}

// ═══════════════════════════════════════════════════════════════════
//  UTILITIES
// ═══════════════════════════════════════════════════════════════════
function _isFrontMatter(section, content) {
  var s = (section || '').toLowerCase();
  for (var k = 0; k < FRONT_MATTER_KEYS.length; k++) {
    if (s.indexOf(FRONT_MATTER_KEYS[k]) !== -1) return true;
  }
  var c = content.substring(0, 400).toLowerCase();
  return c.indexOf('###author introduction') !== -1 ||
         c.indexOf('###copyright') !== -1 ||
         c.indexOf('###how to use') !== -1 ||
         c.indexOf('###why trust') !== -1;
}

function _convertSubdomain(text) {
  var m = text.match(/^Subdomain-(\d+\.\d+)\s*:\s*(.+)$/i);
  if (m) return m[1] + ' ' + m[2].trim();
  return text;
}

function _isTableRow(l) { return !!l.match(/^\|.+\|$/); }
function _isTableSep(l) { return !!l.match(/^\|[\s\-:|]+\|$/); }
function _parseTR(line) {
  var c = line.split('|'); c.shift(); c.pop();
  return c.map(function(s) { return s.trim(); });
}

function _isQLine(l) { return !!l.match(/^Q\d+[\.\)]\s+/i); }
function _isOptLine(l) { return !!l.match(/^\([A-Z]\)\s+/i); }
function _isAnsLine(l) { return !!l.match(/^Answer\s*:\s*/i) || !!l.match(/^Answer:[A-Z]/i); }
function _isExplLine(l) { return !!l.match(/^Explanation\s*:\s*/i); }

function _stripSource(content) {
  return content.replace(/^\s*SOURCE\s*:.*$/gmi, '').replace(/\n{3,}/g, '\n\n').trim();
}

function _cleanCell(cell) {
  var n = cell.getNumChildren();
  if (n <= 1) return;
  // Remove leading empty paragraph (the default one created by appendTableCell)
  try {
    var first = cell.getChild(0);
    if (first.getType() === DocumentApp.ElementType.PARAGRAPH && first.asParagraph().getText() === '') {
      cell.removeChild(first);
    }
  } catch (e) {}
  // Remove trailing empty paragraph
  n = cell.getNumChildren();
  if (n > 1) {
    try {
      var last = cell.getChild(n - 1);
      if (last.getType() === DocumentApp.ElementType.PARAGRAPH && last.asParagraph().getText() === '') {
        cell.removeChild(last);
      }
    } catch (e) {}
  }
}
