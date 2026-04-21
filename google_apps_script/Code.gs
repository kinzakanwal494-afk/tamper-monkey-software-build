/**
 * StudyGuide AI Automation – Google Apps Script (Web App)
 *
 * Deploy as:  Execute as: Me  |  Who has access: Anyone
 *
 * After deploying, copy the Web App URL into the
 * Tampermonkey panel's "App Script Web URL" field.
 * Also copy the target Google Doc ID into "Doc ID".
 */

// ─────────────────────────────────────────────────────────────
//  MAIN WEB APP ENTRY POINT
// ─────────────────────────────────────────────────────────────
function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    const docId   = payload.docId;
    const subject = payload.subject || 'Unknown Subject';
    const data    = payload.data    || {};

    if (!docId) return jsonResponse({ success: false, error: 'Missing docId' });

    const doc  = DocumentApp.openById(docId);
    const body = doc.getBody();

    // Clear existing content
    body.clear();

    writeStudyGuide(body, subject, data, payload.generatedAt);

    doc.saveAndClose();

    return jsonResponse({ success: true, message: 'Study guide written to document.' });
  } catch (err) {
    return jsonResponse({ success: false, error: err.message });
  }
}

// Allow CORS pre-flight
function doGet(e) {
  return jsonResponse({ status: 'StudyGuide Apps Script is running.' });
}

// ─────────────────────────────────────────────────────────────
//  STUDY GUIDE WRITER
// ─────────────────────────────────────────────────────────────
function writeStudyGuide(body, subject, data, generatedAt) {

  // ── Cover / Title ──────────────────────────────────────────
  addHeading(body, `📖 STUDY GUIDE: ${subject.toUpperCase()}`, DocumentApp.ParagraphHeading.TITLE);
  addParagraph(body, `Generated: ${generatedAt || new Date().toISOString()}`, { italic: true, color: '#888888' });
  addHorizontalRule(body);

  // ── Overview ───────────────────────────────────────────────
  if (data.overview && data.overview.overview) {
    const ov = data.overview.overview;
    addHeading(body, '🔍 OVERVIEW', DocumentApp.ParagraphHeading.HEADING1);
    addKeyValuePairs(body, {
      'Exam / Subject':       ov.exam_name           || subject,
      'Purpose':              ov.purpose_statement   || '',
      'Target Audience':      ov.target_audience     || '',
      'Scope':                ov.study_guide_scope   || '',
      'Total Domains':        ov.total_domains       || '',
      'Total Topics':         ov.total_topics        || '',
      'Estimated Study Hours': ov.estimated_study_hours || '',
    });
    if (ov.key_themes && ov.key_themes.length) {
      addParagraph(body, 'Key Themes: ' + ov.key_themes.join(' • '));
    }
  }

  // ── Main Purpose & Target ──────────────────────────────────
  if (data.main_purpose_target) {
    const mp = data.main_purpose_target;
    addHeading(body, '🎯 MAIN PURPOSE & TARGET COVERED', DocumentApp.ParagraphHeading.HEADING1);
    addParagraph(body, mp.main_purpose || '');
    if (mp.target_covered) {
      const tc = mp.target_covered;
      if (tc.domains_covered && tc.domains_covered.length) {
        addParagraph(body, 'Domains Covered:', { bold: true });
        tc.domains_covered.forEach(d => addBullet(body, d));
      }
      if (tc.competency_areas && tc.competency_areas.length) {
        addParagraph(body, 'Competency Areas:', { bold: true });
        tc.competency_areas.forEach(c => addBullet(body, c));
      }
    }
  }

  // ── Domain / Subdomain Weights ─────────────────────────────
  if (data.domain_subdomain_weight && data.domain_subdomain_weight.weighted_structure) {
    addHeading(body, '⚖️ DOMAIN & SUBDOMAIN WEIGHT STRUCTURE', DocumentApp.ParagraphHeading.HEADING1);
    data.domain_subdomain_weight.weighted_structure.forEach(domain => {
      addHeading(body, `${domain.domain} (${domain.domain_weight_percent}%)`, DocumentApp.ParagraphHeading.HEADING2);
      if (domain.subdomains && domain.subdomains.length) {
        const headers = ['Subdomain', 'Weight %', 'Topics'];
        const rows    = domain.subdomains.map(sd => [
          sd.name || '',
          String(sd.subdomain_weight_percent || 0) + '%',
          String(sd.topic_count || 0),
        ]);
        addTable(body, headers, rows);
      }
    });
  }

  // ── Chapters Structure ─────────────────────────────────────
  if (data.chapters_structure && data.chapters_structure.chapters) {
    addHeading(body, '📚 CHAPTERS STRUCTURE', DocumentApp.ParagraphHeading.HEADING1);
    data.chapters_structure.chapters.forEach(ch => {
      addHeading(body, `Chapter ${ch.chapter_number}: ${ch.domain}`, DocumentApp.ParagraphHeading.HEADING2);
      if (ch.subdomain) {
        addHeading(body, ch.subdomain, DocumentApp.ParagraphHeading.HEADING3);
      }
      (ch.topics || []).forEach(topic => {
        addHeading(body, topic.heading || '', DocumentApp.ParagraphHeading.HEADING3);

        if (topic.key_concepts && topic.key_concepts.length) {
          addParagraph(body, 'Key Concepts:', { bold: true });
          topic.key_concepts.forEach(c => addBullet(body, c));
        }

        if (topic.tables && topic.tables.length) {
          topic.tables.forEach(tbl => {
            if (tbl.title) addParagraph(body, tbl.title, { bold: true, color: '#1a73e8' });
            if (tbl.columns && tbl.columns.length && tbl.rows && tbl.rows.length) {
              addTable(body, tbl.columns, tbl.rows);
            }
          });
        }

        if (topic.memory_hooks && topic.memory_hooks.length) {
          addParagraph(body, '🧠 Memory Hooks:', { bold: true, color: '#7c3aed' });
          topic.memory_hooks.forEach(h => addBullet(body, h));
        }
      });
    });
  }

  // ── Memory Check ───────────────────────────────────────────
  if (data.memory_check && data.memory_check.memory_checks) {
    addHeading(body, '🧠 MEMORY CHECK', DocumentApp.ParagraphHeading.HEADING1);
    data.memory_check.memory_checks.forEach(mc => {
      addHeading(body, mc.domain, DocumentApp.ParagraphHeading.HEADING2);
      if (mc.subdomain) addHeading(body, mc.subdomain, DocumentApp.ParagraphHeading.HEADING3);

      if (mc.mnemonics && mc.mnemonics.length) {
        addParagraph(body, 'Mnemonics:', { bold: true });
        mc.mnemonics.forEach(m => addBullet(body, m));
      }

      if (mc.key_formulas && mc.key_formulas.length) {
        addParagraph(body, 'Key Formulas:', { bold: true });
        mc.key_formulas.forEach(f => addBullet(body, f));
      }

      if (mc.flashcard_prompts && mc.flashcard_prompts.length) {
        addParagraph(body, 'Flashcard Prompts:', { bold: true });
        const fcHeaders = ['Question (Front)', 'Answer (Back)'];
        const fcRows    = mc.flashcard_prompts.map(fc => [fc.front || '', fc.back || '']);
        addTable(body, fcHeaders, fcRows);
      }

      if (mc.quick_reference_tables && mc.quick_reference_tables.length) {
        mc.quick_reference_tables.forEach(qrt => {
          if (qrt.title) addParagraph(body, qrt.title, { bold: true });
          if (qrt.data && qrt.data.length) {
            const keys = Object.keys(qrt.data[0] || {});
            if (keys.length) {
              const rows = qrt.data.map(row => keys.map(k => String(row[k] || '')));
              addTable(body, keys, rows);
            }
          }
        });
      }
    });
  }

  // ── Visual / Math / Charts / Graphs ────────────────────────
  if (data.math_charts_graphs && data.math_charts_graphs.visual_content) {
    addHeading(body, '📊 VISUAL AREA – MATH / CHARTS / GRAPHS', DocumentApp.ParagraphHeading.HEADING1);
    data.math_charts_graphs.visual_content.forEach(vc => {
      addHeading(body, `${vc.title || vc.type} (${vc.domain || ''})`, DocumentApp.ParagraphHeading.HEADING3);
      if (vc.description) addParagraph(body, vc.description);
      if (vc.ascii_representation) {
        addCodeBlock(body, vc.ascii_representation);
      }
      if (vc.mermaid_diagram) {
        addParagraph(body, 'Diagram:', { bold: true });
        addCodeBlock(body, vc.mermaid_diagram);
      }
      if (vc.data_points && vc.data_points.length) {
        addParagraph(body, 'Data Points:', { bold: true });
        vc.data_points.forEach(dp => addBullet(body, String(dp)));
      }
    });
  }

  // ── Practice Questions ─────────────────────────────────────
  if (data.practice_generation && data.practice_generation.practice_questions) {
    addHeading(body, '🎓 PRACTICE QUESTIONS', DocumentApp.ParagraphHeading.HEADING1);

    const grouped = {};
    data.practice_generation.practice_questions.forEach(q => {
      const domain = q.domain || 'General';
      if (!grouped[domain]) grouped[domain] = [];
      grouped[domain].push(q);
    });

    Object.keys(grouped).forEach(domain => {
      addHeading(body, domain, DocumentApp.ParagraphHeading.HEADING2);
      grouped[domain].forEach((q, idx) => {
        addParagraph(body, `Q${idx + 1}. [${q.type || 'MCQ'}] [${q.difficulty || 'medium'}] ${q.question}`, { bold: true });

        if (q.options) {
          Object.entries(q.options).forEach(([key, val]) => {
            const isCorrect = key === q.correct_answer;
            addParagraph(body, `   ${key}. ${val}${isCorrect ? ' ✓' : ''}`, {
              color: isCorrect ? '#16a34a' : '#333333',
            });
          });
        }

        if (q.explanation) {
          addParagraph(body, `Explanation: ${q.explanation}`, { italic: true, color: '#555555' });
        }
        if (q.reference_topic) {
          addParagraph(body, `Reference: ${q.reference_topic}`, { italic: true, color: '#888888' });
        }
        addParagraph(body, '');
      });
    });
  }

  // ── Sample Question Mapping ────────────────────────────────
  if (data.sample_question_mapping && data.sample_question_mapping.question_type_map) {
    addHeading(body, '❓ SAMPLE QUESTION MAPPING', DocumentApp.ParagraphHeading.HEADING1);
    const headers = ['Domain', 'Question Types'];
    const rows    = data.sample_question_mapping.question_type_map.map(item => [
      item.domain || '',
      (item.types || []).join(', '),
    ]);
    addTable(body, headers, rows);
  }

  // ── Practice Structure ─────────────────────────────────────
  if (data.practice_question_struct && data.practice_question_struct.practice_structure) {
    const ps = data.practice_question_struct.practice_structure;
    addHeading(body, '✏️ PRACTICE QUESTION STRUCTURE', DocumentApp.ParagraphHeading.HEADING1);
    addKeyValuePairs(body, {
      'Total Questions': ps.total_questions || '',
      'Feedback Style':  ps.feedback_style  || '',
    });
    if (ps.difficulty_split) {
      addKeyValuePairs(body, {
        'Easy':   ps.difficulty_split.easy   || 0,
        'Medium': ps.difficulty_split.medium || 0,
        'Hard':   ps.difficulty_split.hard   || 0,
      });
    }
    if (ps.distribution && ps.distribution.length) {
      const headers = ['Domain', 'Count', 'MCQ', 'Scenario', 'Calculation'];
      const rows    = ps.distribution.map(d => [
        d.domain || '',
        String(d.count || 0),
        String((d.types || {}).multiple_choice || 0),
        String((d.types || {}).scenario        || 0),
        String((d.types || {}).calculation     || 0),
      ]);
      addTable(body, headers, rows);
    }
  }

  addHorizontalRule(body);
  addParagraph(body, `— End of Study Guide for ${subject} —`, { italic: true, color: '#aaaaaa' });
}

// ─────────────────────────────────────────────────────────────
//  HELPER WRITERS
// ─────────────────────────────────────────────────────────────
function addHeading(body, text, level) {
  const p = body.appendParagraph(text || '');
  p.setHeading(level);
  return p;
}

function addParagraph(body, text, opts) {
  opts = opts || {};
  const p = body.appendParagraph(text || '');
  p.setHeading(DocumentApp.ParagraphHeading.NORMAL);
  if (opts.bold)    p.setBold(true);
  if (opts.italic)  p.setItalic(true);
  if (opts.color)   p.setForegroundColor(opts.color);
  return p;
}

function addBullet(body, text) {
  const p = body.appendListItem(text || '');
  p.setGlyphType(DocumentApp.GlyphType.BULLET);
  return p;
}

function addHorizontalRule(body) {
  body.appendHorizontalRule();
}

function addCodeBlock(body, code) {
  const p = body.appendParagraph(code || '');
  p.setHeading(DocumentApp.ParagraphHeading.NORMAL);
  p.setFontFamily('Courier New');
  p.setFontSize(10);
  p.setBackgroundColor('#f5f5f5');
  return p;
}

function addKeyValuePairs(body, obj) {
  Object.entries(obj).forEach(([k, v]) => {
    if (v === null || v === undefined || v === '') return;
    const p = body.appendParagraph('');
    p.setHeading(DocumentApp.ParagraphHeading.NORMAL);
    const boldText = p.appendText(`${k}: `);
    boldText.setBold(true);
    p.appendText(String(v));
  });
}

function addTable(body, headers, rows) {
  if (!headers || !headers.length || !rows || !rows.length) return;

  const allRows = [headers, ...rows];
  const table   = body.appendTable(allRows);

  // Style header row
  const headerRow = table.getRow(0);
  for (let c = 0; c < headerRow.getNumCells(); c++) {
    const cell = headerRow.getCell(c);
    cell.setBackgroundColor('#1a73e8');
    cell.getText() && cell.getChild(0).asParagraph().setBold(true);
    try { cell.getChild(0).asParagraph().setForegroundColor('#ffffff'); } catch(_) {}
  }

  // Alternate row shading
  for (let r = 1; r < table.getNumRows(); r++) {
    const row = table.getRow(r);
    const bg  = r % 2 === 0 ? '#f8f9fa' : '#ffffff';
    for (let c = 0; c < row.getNumCells(); c++) {
      row.getCell(c).setBackgroundColor(bg);
    }
  }

  return table;
}

// ─────────────────────────────────────────────────────────────
//  RESPONSE HELPER
// ─────────────────────────────────────────────────────────────
function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
