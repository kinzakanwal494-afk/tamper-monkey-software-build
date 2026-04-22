// ═══════════════════════════════════════════════════════════════════
//  StudyGuide AI — Google Apps Script (Docs Formatter)
//  Receives markdown-like content from the Tampermonkey userscript
//  and formats it into rich Google Docs with Calibri font, proper
//  heading hierarchy, tables, image placeholders, practice-question
//  formatting, math/equation blocks, and 1.5 line spacing.
// ═══════════════════════════════════════════════════════════════════

const SCRIPT_PROPS = PropertiesService.getScriptProperties();

function doGet(e) {
  return jsonResponse({
    status: 'ok',
    message: 'StudyGuide AI Apps Script is running. Use POST requests to interact.',
    version: '13.0.0'
  });
}

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    const secret = SCRIPT_PROPS.getProperty('SECRET_KEY') || '';
    if (secret && payload.secret !== secret) {
      return jsonResponse({ status: 'error', message: 'Invalid secret key' });
    }

    const docId = payload.docId;
    if (!docId) {
      return jsonResponse({ status: 'error', message: 'Missing docId' });
    }

    const action = (payload.action || '').toLowerCase();

    if (action === 'ping') {
      try {
        const doc = DocumentApp.openById(docId);
        return jsonResponse({ status: 'ok', title: doc.getName() });
      } catch (err) {
        return jsonResponse({ status: 'error', message: 'Cannot open doc: ' + err.message });
      }
    }

    if (action === 'append') {
      const content = payload.content || '';
      const section = payload.section || '';
      if (!content.trim()) {
        return jsonResponse({ status: 'ok', message: 'Empty content — skipped' });
      }
      appendFormattedContent(docId, content, section);
      return jsonResponse({ status: 'ok', section: section });
    }

    if (action === 'appendimage') {
      appendImage(docId, payload);
      return jsonResponse({ status: 'ok', section: payload.section || '' });
    }

    return jsonResponse({ status: 'error', message: 'Unknown action: ' + action });

  } catch (err) {
    return jsonResponse({ status: 'error', message: err.message });
  }
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ═══════════════════════════════════════════════════════════════════
//  CONSTANTS
// ═══════════════════════════════════════════════════════════════════
var FONT_FAMILY   = 'Calibri';
var BODY_SIZE     = 11;
var HEADING3_SIZE = 12;
var LINE_SPACING  = 1.5;

var FRONT_MATTER_SECTIONS = [
  'author introduction',
  'copyright',
  'how to use this book',
  'why trust this study guide',
  'why trust this book',
];

// ═══════════════════════════════════════════════════════════════════
//  MAIN APPEND — parses markdown content and writes formatted blocks
// ═══════════════════════════════════════════════════════════════════
function appendFormattedContent(docId, rawContent, section) {
  var doc  = DocumentApp.openById(docId);
  var body = doc.getBody();

  var content = rawContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  content = stripSourceLine(content);

  var isFrontMatter = detectFrontMatter(section, content);
  var lines = content.split('\n');
  var i = 0;

  while (i < lines.length) {
    var line = lines[i];
    var trimmed = line.trim();

    if (trimmed === '') { i++; continue; }

    // ── TABLE DETECTION ──
    if (isTableRow(trimmed) && i + 1 < lines.length && isTableSeparator(lines[i + 1].trim())) {
      var tableLines = [];
      while (i < lines.length && isTableRow(lines[i].trim())) {
        if (!isTableSeparator(lines[i].trim())) {
          tableLines.push(lines[i].trim());
        }
        i++;
      }
      appendTable(body, tableLines);
      continue;
    }
    if (isTableRow(trimmed) && i > 0) {
      var tableLines2 = [];
      while (i < lines.length && isTableRow(lines[i].trim())) {
        if (!isTableSeparator(lines[i].trim())) {
          tableLines2.push(lines[i].trim());
        }
        i++;
      }
      if (tableLines2.length > 0) {
        appendTable(body, tableLines2);
      }
      continue;
    }

    // ── CODE / CHEM BLOCKS ──
    if (trimmed.match(/^```/)) {
      var lang = trimmed.replace(/^```\s*/, '').toLowerCase();
      var codeLines = [];
      i++;
      while (i < lines.length && !lines[i].trim().match(/^```\s*$/)) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```
      appendCodeBlock(body, codeLines.join('\n'), lang);
      continue;
    }

    // ── BLOCK MATH $$...$$ ──
    if (trimmed === '$$') {
      var mathLines = [];
      i++;
      while (i < lines.length && lines[i].trim() !== '$$') {
        mathLines.push(lines[i]);
        i++;
      }
      i++; // skip closing $$
      appendMathBlock(body, mathLines.join('\n'));
      continue;
    }

    // ── FIGURE PLACEHOLDER ──
    if (trimmed.match(/^\[FIGURE:\s*/i)) {
      var figTitle = trimmed.replace(/^\[FIGURE:\s*/i, '').replace(/\]\s*$/, '');
      var figDesc = [];
      i++;
      while (i < lines.length && !lines[i].trim().match(/^\[\/FIGURE\]/i)) {
        figDesc.push(lines[i].trim());
        i++;
      }
      i++; // skip [/FIGURE]
      appendFigurePlaceholder(body, figTitle, figDesc.join(' '));
      continue;
    }

    // ── HEADINGS ──
    if (trimmed.match(/^###\s*Practice Questions/i)) {
      appendPracticeHeading(body, trimmed.replace(/^###\s*/, ''));
      i++;
      continue;
    }

    // #Domain-N: Name → Chapter-N: Name (H1)
    if (trimmed.match(/^#[^#]/)) {
      var h1Text = trimmed.replace(/^#\s*/, '');
      h1Text = convertDomainToChapter(h1Text);
      appendHeading1(body, h1Text, isFrontMatter);
      i++;
      continue;
    }

    // ##Subdomain-N.M: Name → N.M Name (H2)
    if (trimmed.match(/^##[^#]/)) {
      var h2Text = trimmed.replace(/^##\s*/, '');
      h2Text = convertSubdomainHeading(h2Text);
      appendHeading2(body, h2Text);
      i++;
      continue;
    }

    // ###Topic → Bold Size 12
    if (trimmed.match(/^###/)) {
      var h3Text = trimmed.replace(/^###\s*/, '');
      if (isFrontMatter) {
        appendHeading1FrontMatter(body, h3Text);
      } else {
        appendHeading3(body, h3Text);
      }
      i++;
      continue;
    }

    // ── PRACTICE QUESTION LINE ──
    if (isPracticeQuestionLine(trimmed)) {
      i = appendPracticeQuestion(body, lines, i);
      continue;
    }

    // ── CALLOUT BLOCKS ──
    if (trimmed.match(/^>\s*(NOTE|WARNING|DEFINITION)\s*:/i)) {
      appendCallout(body, trimmed);
      i++;
      continue;
    }

    // ── BULLET LIST ──
    if (trimmed.match(/^-\s+/)) {
      while (i < lines.length && lines[i].trim().match(/^-\s+/)) {
        var bulletText = lines[i].trim().replace(/^-\s+/, '');
        appendBulletItem(body, bulletText);
        i++;
      }
      continue;
    }

    // ── NUMBERED LIST ──
    if (trimmed.match(/^\d+\.\s+/)) {
      var listNum = 0;
      while (i < lines.length && lines[i].trim().match(/^\d+\.\s+/)) {
        listNum++;
        var numText = lines[i].trim().replace(/^\d+\.\s+/, '');
        appendNumberedItem(body, numText, listNum);
        i++;
      }
      continue;
    }

    // ── BOLD-ONLY LINE AS HEADING (GPT sometimes skips ### and just bolds) ──
    if (isBoldOnlyHeading(trimmed) && !isFrontMatter) {
      var boldHeadText = trimmed.replace(/^\*\*/, '').replace(/\*\*$/, '');
      if (boldHeadText.toUpperCase() === 'DISCLAIMER') {
        appendHeading3(body, boldHeadText);
      } else if (boldHeadText.length < 80) {
        appendHeading3(body, boldHeadText);
      } else {
        appendParagraph(body, trimmed, isFrontMatter);
      }
      i++;
      continue;
    }

    // ── REGULAR PARAGRAPH ──
    appendParagraph(body, trimmed, isFrontMatter);
    i++;
  }

  doc.saveAndClose();
}

// ═══════════════════════════════════════════════════════════════════
//  FRONT MATTER DETECTION
// ═══════════════════════════════════════════════════════════════════
function detectFrontMatter(section, content) {
  var lower = (section || '').toLowerCase();
  for (var k = 0; k < FRONT_MATTER_SECTIONS.length; k++) {
    if (lower.indexOf(FRONT_MATTER_SECTIONS[k]) !== -1) return true;
  }
  var contentLower = content.substring(0, 300).toLowerCase();
  if (contentLower.indexOf('###author introduction') !== -1) return true;
  if (contentLower.indexOf('###copyright') !== -1) return true;
  if (contentLower.indexOf('###how to use') !== -1) return true;
  if (contentLower.indexOf('###why trust') !== -1) return true;
  return false;
}

// ═══════════════════════════════════════════════════════════════════
//  HEADING CONVERTERS
// ═══════════════════════════════════════════════════════════════════
function convertDomainToChapter(text) {
  var m = text.match(/^Domain-(\d+)\s*:\s*(.+)$/i);
  if (m) return 'Chapter-' + m[1] + ': ' + m[2].trim();
  return text;
}

function convertSubdomainHeading(text) {
  var m = text.match(/^Subdomain-(\d+\.\d+)\s*:\s*(.+)$/i);
  if (m) return m[1] + ' ' + m[2].trim();
  return text;
}

// ═══════════════════════════════════════════════════════════════════
//  HEADING FORMATTERS
// ═══════════════════════════════════════════════════════════════════
function appendHeading1(body, text, isFrontMatter) {
  var para = body.appendParagraph(text);
  para.setHeading(DocumentApp.ParagraphHeading.HEADING1);
  para.setFontFamily(FONT_FAMILY);
  para.setFontSize(isFrontMatter ? BODY_SIZE : 14);
  para.setLineSpacing(LINE_SPACING);
  para.setBold(true);
  para.setSpacingAfter(6);
}

function appendHeading1FrontMatter(body, text) {
  var para = body.appendParagraph(text);
  para.setHeading(DocumentApp.ParagraphHeading.HEADING1);
  para.setFontFamily(FONT_FAMILY);
  para.setFontSize(BODY_SIZE);
  para.setLineSpacing(LINE_SPACING);
  para.setBold(true);
  para.setSpacingAfter(6);
}

function appendHeading2(body, text) {
  var para = body.appendParagraph(text);
  para.setHeading(DocumentApp.ParagraphHeading.HEADING2);
  para.setFontFamily(FONT_FAMILY);
  para.setFontSize(13);
  para.setLineSpacing(LINE_SPACING);
  para.setBold(true);
  para.setSpacingAfter(4);
}

function appendHeading3(body, text) {
  var para = body.appendParagraph(text);
  para.setHeading(DocumentApp.ParagraphHeading.NORMAL);
  para.setFontFamily(FONT_FAMILY);
  para.setFontSize(HEADING3_SIZE);
  para.setLineSpacing(LINE_SPACING);
  para.setBold(true);
  para.setSpacingAfter(3);
  para.setSpacingBefore(6);
}

// ═══════════════════════════════════════════════════════════════════
//  PARAGRAPH — with inline bold/italic parsing
// ═══════════════════════════════════════════════════════════════════
function appendParagraph(body, text, isFrontMatter) {
  var para = body.appendParagraph('');
  para.setFontFamily(FONT_FAMILY);
  para.setFontSize(BODY_SIZE);
  para.setLineSpacing(LINE_SPACING);
  applyInlineFormatting(para, text);
  return para;
}

function applyInlineFormatting(para, text) {
  para.clear();
  var tokens = parseInlineMarkdown(text);
  for (var t = 0; t < tokens.length; t++) {
    var tok = tokens[t];
    var appended = para.appendText(tok.text);
    appended.setFontFamily(FONT_FAMILY);
    appended.setFontSize(tok.size || BODY_SIZE);
    if (tok.bold) appended.setBold(true);
    if (tok.italic) appended.setItalic(true);
    if (tok.code) {
      appended.setFontFamily('Courier New');
      appended.setBackgroundColor('#f0f0f0');
    }
  }
}

function parseInlineMarkdown(text) {
  var tokens = [];
  var regex = /(\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`|\$(.+?)\$)/g;
  var lastIndex = 0;
  var match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({ text: text.substring(lastIndex, match.index) });
    }
    if (match[2]) {
      tokens.push({ text: match[2], bold: true, italic: true });
    } else if (match[3]) {
      tokens.push({ text: match[3], bold: true });
    } else if (match[4]) {
      tokens.push({ text: match[4], italic: true });
    } else if (match[5]) {
      tokens.push({ text: match[5], code: true });
    } else if (match[6]) {
      tokens.push({ text: match[6], bold: true, italic: true });
    }
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) {
    tokens.push({ text: text.substring(lastIndex) });
  }
  if (tokens.length === 0) {
    tokens.push({ text: text });
  }
  return tokens;
}

// ═══════════════════════════════════════════════════════════════════
//  TABLE SUPPORT
// ═══════════════════════════════════════════════════════════════════
function isTableRow(line) {
  return line.match(/^\|.+\|$/);
}

function isTableSeparator(line) {
  return line.match(/^\|[\s\-:|]+\|$/);
}

function parseTableRow(line) {
  var cells = line.split('|');
  cells.shift(); // remove leading empty
  cells.pop();   // remove trailing empty
  return cells.map(function(c) { return c.trim(); });
}

function appendTable(body, tableLines) {
  if (tableLines.length === 0) return;

  var headerCells = parseTableRow(tableLines[0]);
  var numCols = headerCells.length;
  var numRows = tableLines.length;

  var table = body.appendTable();

  // Header row
  var headerRow = table.appendTableRow();
  for (var c = 0; c < numCols; c++) {
    var cell = headerRow.appendTableCell(headerCells[c] || '');
    var cellPara = cell.getChild(0).asParagraph();
    cellPara.setFontFamily(FONT_FAMILY);
    cellPara.setFontSize(BODY_SIZE);
    cellPara.setBold(true);
    cellPara.setLineSpacing(LINE_SPACING);
    cell.setBackgroundColor('#e8e8e8');
  }

  // Data rows
  for (var r = 1; r < numRows; r++) {
    var rowCells = parseTableRow(tableLines[r]);
    var dataRow = table.appendTableRow();
    for (var c2 = 0; c2 < numCols; c2++) {
      var val = (c2 < rowCells.length) ? rowCells[c2] : '';
      var dCell = dataRow.appendTableCell('');
      var dPara = dCell.getChild(0).asParagraph();
      dPara.setFontFamily(FONT_FAMILY);
      dPara.setFontSize(BODY_SIZE);
      dPara.setLineSpacing(LINE_SPACING);
      applyInlineFormatting(dPara, val);
    }
  }

  // Remove the empty first row that appendTable() creates
  if (table.getNumRows() > numRows) {
    try { table.removeRow(0); } catch(e) {}
  }

  body.appendParagraph('').setFontSize(2); // spacing after table
}

// ═══════════════════════════════════════════════════════════════════
//  CODE BLOCKS
// ═══════════════════════════════════════════════════════════════════
function appendCodeBlock(body, code, lang) {
  var isChem = (lang === 'chem' || lang === 'chemistry');
  var isOutput = (lang === 'output');

  if (isChem) {
    appendChemBlock(body, code);
    return;
  }

  var label = isOutput ? 'Output:' : (lang ? lang.toUpperCase() + ':' : 'CODE:');
  var labelPara = body.appendParagraph(label);
  labelPara.setFontFamily(FONT_FAMILY);
  labelPara.setFontSize(HEADING3_SIZE);
  labelPara.setBold(true);
  labelPara.setLineSpacing(LINE_SPACING);

  var codePara = body.appendParagraph(code);
  codePara.setFontFamily('Courier New');
  codePara.setFontSize(10);
  codePara.setLineSpacing(1.15);
  codePara.setIndentStart(18);
  codePara.setBackgroundColor('#f5f5f5');
  codePara.setSpacingAfter(6);
}

// ═══════════════════════════════════════════════════════════════════
//  CHEMISTRY REACTION BLOCKS
// ═══════════════════════════════════════════════════════════════════
function appendChemBlock(body, code) {
  var labelPara = body.appendParagraph('Chemical Reaction:');
  labelPara.setFontFamily(FONT_FAMILY);
  labelPara.setFontSize(HEADING3_SIZE);
  labelPara.setBold(true);
  labelPara.setLineSpacing(LINE_SPACING);

  var reactionLines = code.split('\n');
  for (var r = 0; r < reactionLines.length; r++) {
    var rLine = reactionLines[r].trim();
    if (!rLine) continue;
    var rPara = body.appendParagraph(rLine);
    rPara.setFontFamily(FONT_FAMILY);
    rPara.setFontSize(BODY_SIZE);
    rPara.setBold(true);
    rPara.setLineSpacing(LINE_SPACING);
    rPara.setIndentStart(18);
    rPara.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  }
  body.appendParagraph('').setFontSize(2);
}

// ═══════════════════════════════════════════════════════════════════
//  MATH / EQUATION BLOCKS
// ═══════════════════════════════════════════════════════════════════
function appendMathBlock(body, mathContent) {
  var labelPara = body.appendParagraph('Equation:');
  labelPara.setFontFamily(FONT_FAMILY);
  labelPara.setFontSize(HEADING3_SIZE);
  labelPara.setBold(true);
  labelPara.setLineSpacing(LINE_SPACING);

  var mathPara = body.appendParagraph(mathContent.trim());
  mathPara.setFontFamily('Cambria Math');
  mathPara.setFontSize(12);
  mathPara.setBold(true);
  mathPara.setLineSpacing(LINE_SPACING);
  mathPara.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  mathPara.setIndentStart(18);
  mathPara.setSpacingAfter(6);
  mathPara.setSpacingBefore(6);
}

// ═══════════════════════════════════════════════════════════════════
//  FIGURE / IMAGE PLACEHOLDER
// ═══════════════════════════════════════════════════════════════════
function appendFigurePlaceholder(body, title, description) {
  var figNum = 'Figure: ' + title;

  var borderPara = body.appendParagraph('─'.repeat(50));
  borderPara.setFontFamily(FONT_FAMILY);
  borderPara.setFontSize(8);
  borderPara.setForegroundColor('#999999');
  borderPara.setAlignment(DocumentApp.HorizontalAlignment.CENTER);

  var placeholder = body.appendParagraph('[IMAGE PLACEHOLDER]');
  placeholder.setFontFamily(FONT_FAMILY);
  placeholder.setFontSize(HEADING3_SIZE);
  placeholder.setBold(true);
  placeholder.setForegroundColor('#666666');
  placeholder.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  placeholder.setLineSpacing(LINE_SPACING);

  var sizePara = body.appendParagraph('Recommended size: 400×300 px');
  sizePara.setFontFamily(FONT_FAMILY);
  sizePara.setFontSize(9);
  sizePara.setForegroundColor('#999999');
  sizePara.setAlignment(DocumentApp.HorizontalAlignment.CENTER);

  var figLabel = body.appendParagraph(figNum);
  figLabel.setFontFamily(FONT_FAMILY);
  figLabel.setFontSize(BODY_SIZE);
  figLabel.setBold(true);
  figLabel.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  figLabel.setLineSpacing(LINE_SPACING);

  if (description) {
    var descPara = body.appendParagraph(description);
    descPara.setFontFamily(FONT_FAMILY);
    descPara.setFontSize(10);
    descPara.setItalic(true);
    descPara.setForegroundColor('#555555');
    descPara.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
    descPara.setLineSpacing(LINE_SPACING);
  }

  var borderPara2 = body.appendParagraph('─'.repeat(50));
  borderPara2.setFontFamily(FONT_FAMILY);
  borderPara2.setFontSize(8);
  borderPara2.setForegroundColor('#999999');
  borderPara2.setAlignment(DocumentApp.HorizontalAlignment.CENTER);

  body.appendParagraph('').setFontSize(2);
}

// ═══════════════════════════════════════════════════════════════════
//  PRACTICE QUESTION FORMATTER
// ═══════════════════════════════════════════════════════════════════
function isPracticeQuestionLine(line) {
  return !!line.match(/^Q\d+[\.\)]\s+/i);
}

function isOptionLine(line) {
  return !!line.match(/^\([A-Z]\)\s+/i);
}

function isAnswerLine(line) {
  return !!line.match(/^Answer\s*:\s*/i) || !!line.match(/^Answer:[A-Z]/i);
}

function isExplanationLine(line) {
  return !!line.match(/^Explanation\s*:\s*/i);
}

function appendPracticeQuestion(body, lines, startIdx) {
  var i = startIdx;
  var qLine = lines[i].trim();

  // Q line — entire line bold, size 12
  var qPara = body.appendParagraph(qLine);
  qPara.setFontFamily(FONT_FAMILY);
  qPara.setFontSize(HEADING3_SIZE);
  qPara.setBold(true);
  qPara.setLineSpacing(LINE_SPACING);
  qPara.setSpacingBefore(8);
  i++;

  // Options — (A), (B), (C), etc. — normal size 11
  while (i < lines.length && isOptionLine(lines[i].trim())) {
    var optPara = body.appendParagraph(lines[i].trim());
    optPara.setFontFamily(FONT_FAMILY);
    optPara.setFontSize(BODY_SIZE);
    optPara.setLineSpacing(LINE_SPACING);
    optPara.setIndentStart(18);
    i++;
  }

  // Answer line — bold, size 12
  if (i < lines.length && isAnswerLine(lines[i].trim())) {
    var ansLine = lines[i].trim();
    var ansPara = body.appendParagraph(ansLine);
    ansPara.setFontFamily(FONT_FAMILY);
    ansPara.setFontSize(HEADING3_SIZE);
    ansPara.setBold(true);
    ansPara.setLineSpacing(LINE_SPACING);
    ansPara.setSpacingBefore(4);
    i++;
  }

  // Explanation line(s) — "Explanation:" bold size 12, rest size 11
  // Explanation can continue on following lines until a blank line or next question
  if (i < lines.length && isExplanationLine(lines[i].trim())) {
    var explLine = lines[i].trim();
    var colonIdx = explLine.indexOf(':');
    var explLabel = explLine.substring(0, colonIdx + 1);
    var explContentParts = [explLine.substring(colonIdx + 1).trim()];
    i++;

    // Gather continuation lines
    while (i < lines.length) {
      var nextTrimmed = lines[i].trim();
      if (nextTrimmed === '' || isPracticeQuestionLine(nextTrimmed) ||
          isAnswerLine(nextTrimmed) || isOptionLine(nextTrimmed)) break;
      explContentParts.push(nextTrimmed);
      i++;
    }

    var fullExplContent = explContentParts.join(' ').trim();
    var explPara = body.appendParagraph('');
    explPara.setLineSpacing(LINE_SPACING);

    var labelText = explPara.appendText(explLabel + ' ');
    labelText.setFontFamily(FONT_FAMILY);
    labelText.setFontSize(HEADING3_SIZE);
    labelText.setBold(true);

    if (fullExplContent) {
      var contentText = explPara.appendText(fullExplContent);
      contentText.setFontFamily(FONT_FAMILY);
      contentText.setFontSize(BODY_SIZE);
      contentText.setBold(false);
    }
  }

  // Blank spacing after question
  var spacer = body.appendParagraph('');
  spacer.setFontSize(4);

  return i;
}

function appendPracticeHeading(body, text) {
  var para = body.appendParagraph(text);
  para.setHeading(DocumentApp.ParagraphHeading.HEADING2);
  para.setFontFamily(FONT_FAMILY);
  para.setFontSize(14);
  para.setBold(true);
  para.setLineSpacing(LINE_SPACING);
  para.setSpacingBefore(12);
  para.setSpacingAfter(6);
}

// ═══════════════════════════════════════════════════════════════════
//  CALLOUT BLOCKS (> NOTE: / > WARNING: / > DEFINITION:)
// ═══════════════════════════════════════════════════════════════════
function appendCallout(body, line) {
  var cleaned = line.replace(/^>\s*/, '');
  var colonIdx = cleaned.indexOf(':');
  var label = cleaned.substring(0, colonIdx + 1);
  var content = cleaned.substring(colonIdx + 1).trim();

  var para = body.appendParagraph('');
  para.setLineSpacing(LINE_SPACING);
  para.setIndentStart(18);

  var labelText = para.appendText(label + ' ');
  labelText.setFontFamily(FONT_FAMILY);
  labelText.setFontSize(HEADING3_SIZE);
  labelText.setBold(true);

  if (content) {
    var contentText = para.appendText(content);
    contentText.setFontFamily(FONT_FAMILY);
    contentText.setFontSize(BODY_SIZE);
    contentText.setBold(false);
  }

  para.setSpacingAfter(4);
}

// ═══════════════════════════════════════════════════════════════════
//  LIST ITEMS
// ═══════════════════════════════════════════════════════════════════
function appendBulletItem(body, text) {
  var item = body.appendListItem('');
  item.setGlyphType(DocumentApp.GlyphType.BULLET);
  item.setFontFamily(FONT_FAMILY);
  item.setFontSize(BODY_SIZE);
  item.setLineSpacing(LINE_SPACING);
  applyInlineFormatting(item, text);
}

function appendNumberedItem(body, text, num) {
  var item = body.appendListItem('');
  item.setGlyphType(DocumentApp.GlyphType.NUMBER);
  item.setFontFamily(FONT_FAMILY);
  item.setFontSize(BODY_SIZE);
  item.setLineSpacing(LINE_SPACING);
  applyInlineFormatting(item, text);
}

// ═══════════════════════════════════════════════════════════════════
//  IMAGE HANDLER
// ═══════════════════════════════════════════════════════════════════
function appendImage(docId, payload) {
  var doc  = DocumentApp.openById(docId);
  var body = doc.getBody();
  var caption = payload.imageCaption || payload.section || 'Figure';

  if (payload.imageData && payload.imageData.indexOf('data:') === 0) {
    try {
      var parts = payload.imageData.split(',');
      var mimeMatch = parts[0].match(/data:([^;]+)/);
      var mime = mimeMatch ? mimeMatch[1] : 'image/png';
      var decoded = Utilities.base64Decode(parts[1]);
      var blob = Utilities.newBlob(decoded, mime, 'figure.png');

      var img = body.appendImage(blob);
      var maxWidth = 400;
      var width = img.getWidth();
      var height = img.getHeight();
      if (width > maxWidth) {
        var ratio = maxWidth / width;
        img.setWidth(maxWidth);
        img.setHeight(Math.round(height * ratio));
      }
    } catch (err) {
      var fallback = body.appendParagraph('[Image could not be inserted: ' + err.message + ']');
      fallback.setFontFamily(FONT_FAMILY);
      fallback.setFontSize(10);
      fallback.setItalic(true);
      fallback.setForegroundColor('#cc0000');
    }
  } else if (payload.imageSrc) {
    try {
      var response = UrlFetchApp.fetch(payload.imageSrc);
      var imgBlob = response.getBlob();
      var img2 = body.appendImage(imgBlob);
      var maxW = 400;
      if (img2.getWidth() > maxW) {
        var r = maxW / img2.getWidth();
        img2.setWidth(maxW);
        img2.setHeight(Math.round(img2.getHeight() * r));
      }
    } catch (err2) {
      var fb = body.appendParagraph('[Image URL failed: ' + err2.message + ']');
      fb.setFontFamily(FONT_FAMILY);
      fb.setFontSize(10);
      fb.setItalic(true);
      fb.setForegroundColor('#cc0000');
    }
  } else if (payload.asciiArt) {
    var asciiPara = body.appendParagraph(payload.asciiArt);
    asciiPara.setFontFamily('Courier New');
    asciiPara.setFontSize(9);
    asciiPara.setLineSpacing(1.0);
  } else {
    appendFigurePlaceholder(body, caption, '');
  }

  // Caption below image
  var captionPara = body.appendParagraph(caption);
  captionPara.setFontFamily(FONT_FAMILY);
  captionPara.setFontSize(10);
  captionPara.setBold(true);
  captionPara.setItalic(true);
  captionPara.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  captionPara.setLineSpacing(LINE_SPACING);

  doc.saveAndClose();
}

// ═══════════════════════════════════════════════════════════════════
//  UTILITIES
// ═══════════════════════════════════════════════════════════════════
function isBoldOnlyHeading(line) {
  return !!line.match(/^\*\*[^*]+\*\*$/) && line.length < 100;
}

function stripSourceLine(content) {
  return content
    .replace(/^\s*SOURCE\s*:.*$/gmi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
