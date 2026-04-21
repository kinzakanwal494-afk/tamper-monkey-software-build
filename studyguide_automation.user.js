// ==UserScript==
// @name         StudyGuide AI Automation - Full Pipeline
// @namespace    https://github.com/studyguide-automation
// @version      2.0.0
// @description  Automates study guide generation via GPT/Gemini and posts structured output to Google Docs via Apps Script
// @author       StudyGuide Automation
// @match        https://chat.openai.com/*
// @match        https://chatgpt.com/*
// @match        https://gemini.google.com/*
// @match        https://aistudio.google.com/*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addStyle
// @grant        GM_notification
// @connect      script.google.com
// @connect      script.googleusercontent.com
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  // ─────────────────────────────────────────────────────────────
  //  CONSTANTS & STATE
  // ─────────────────────────────────────────────────────────────
  const APP_ID = 'SG_AUTO';
  const STORAGE_KEYS = {
    APPS_SCRIPT_URL: `${APP_ID}_appsScriptUrl`,
    DOC_ID:          `${APP_ID}_docId`,
    PIPELINE_STATE:  `${APP_ID}_pipelineState`,
    CURRENT_STEP:    `${APP_ID}_currentStep`,
    COLLECTED_DATA:  `${APP_ID}_collectedData`,
    ERROR_LOG:       `${APP_ID}_errorLog`,
    CONFIG_PANEL:    `${APP_ID}_configPanelOpen`,
  };

  const PIPELINE_STEPS = [
    { id: 'exams_verification',        label: 'Exams Verification',        icon: '📋' },
    { id: 'outline_mapping',           label: 'Outline Mapping',           icon: '🗺️' },
    { id: 'sample_question_mapping',   label: 'Sample Question Mapping',   icon: '❓' },
    { id: 'chapters_structure',        label: 'Chapters Structure',        icon: '📚' },
    { id: 'practice_question_struct',  label: 'Practice Question Structure', icon: '✏️' },
    { id: 'domain_subdomain_weight',   label: 'Domain/Subdomain Weight',   icon: '⚖️' },
    { id: 'overview',                  label: 'Overview',                  icon: '🔍' },
    { id: 'main_purpose_target',       label: 'Main Purpose & Target',     icon: '🎯' },
    { id: 'memory_check',              label: 'Memory Check',              icon: '🧠' },
    { id: 'math_charts_graphs',        label: 'Math / Charts / Graphs',    icon: '📊' },
    { id: 'practice_generation',       label: 'Practice Question Generation', icon: '🎓' },
  ];

  const STATE = {
    IDLE:    'IDLE',
    RUNNING: 'RUNNING',
    PAUSED:  'PAUSED',
    STOPPED: 'STOPPED',
    ERROR:   'ERROR',
  };

  // ─────────────────────────────────────────────────────────────
  //  PROMPT TEMPLATES
  // ─────────────────────────────────────────────────────────────
  const PROMPTS = {
    exams_verification: (subject) => `
You are a study guide architect. Analyze the following subject/exam and provide a structured JSON response:
Subject: ${subject}

Return JSON only:
{
  "exam_name": "",
  "governing_body": "",
  "total_questions": 0,
  "time_limit_minutes": 0,
  "passing_score": "",
  "question_types": [],
  "domains": [{"name":"","weight_percent":0,"subdomain_count":0}],
  "verified": true
}`,

    outline_mapping: (examData) => `
Based on this exam data: ${JSON.stringify(examData)}

Create a complete outline mapping. Return JSON only:
{
  "outline": [
    {
      "domain": "#DOMAIN NAME",
      "weight": 0,
      "subdomains": [
        {
          "name": "##SUBDOMAIN NAME",
          "topics": ["###Topic 1", "###Topic 2"]
        }
      ]
    }
  ]
}`,

    sample_question_mapping: (outline) => `
Based on this outline: ${JSON.stringify(outline)}

Identify all question types per domain. Return JSON only:
{
  "question_type_map": [
    {
      "domain": "",
      "types": ["multiple_choice","true_false","scenario","calculation","matching"],
      "sample_per_type": 1
    }
  ]
}`,

    chapters_structure: (outline) => `
Based on this outline: ${JSON.stringify(outline)}

Generate a detailed chapters structure. Return JSON only:
{
  "chapters": [
    {
      "chapter_number": 1,
      "domain": "#DOMAIN",
      "subdomain": "##SUBDOMAIN",
      "topics": [
        {
          "heading": "###TOPIC HEADING",
          "key_concepts": [],
          "tables": [{"title":"","columns":[],"rows":[[]]}],
          "memory_hooks": []
        }
      ]
    }
  ]
}`,

    practice_question_struct: (chapters) => `
Based on these chapters: ${JSON.stringify(chapters)}

Define the practice question structure. Return JSON only:
{
  "practice_structure": {
    "total_questions": 0,
    "distribution": [
      {"domain":"","count":0,"types":{"multiple_choice":0,"scenario":0,"calculation":0}}
    ],
    "difficulty_split": {"easy":0,"medium":0,"hard":0},
    "feedback_style": "detailed"
  }
}`,

    domain_subdomain_weight: (examData, outline) => `
Verify and finalize domain/subdomain weights.
Exam data: ${JSON.stringify(examData)}
Outline: ${JSON.stringify(outline)}

Return JSON only:
{
  "weighted_structure": [
    {
      "domain": "#DOMAIN",
      "domain_weight_percent": 0,
      "subdomains": [
        {"name":"##SUBDOMAIN","subdomain_weight_percent":0,"topic_count":0}
      ]
    }
  ],
  "total_weight_check": 100
}`,

    overview: (allData) => `
Generate a comprehensive study guide overview based on all collected data:
${JSON.stringify(allData)}

Return JSON only:
{
  "overview": {
    "exam_name": "",
    "purpose_statement": "",
    "target_audience": "",
    "study_guide_scope": "",
    "total_domains": 0,
    "total_topics": 0,
    "estimated_study_hours": 0,
    "key_themes": []
  }
}`,

    main_purpose_target: (overview, weightedStructure) => `
Define main purpose and target coverage.
Overview: ${JSON.stringify(overview)}
Weighted Structure: ${JSON.stringify(weightedStructure)}

Return JSON only:
{
  "main_purpose": "",
  "target_covered": {
    "domains_covered": [],
    "competency_areas": [],
    "excluded_topics": [],
    "coverage_percent": 100
  }
}`,

    memory_check: (chapters) => `
Generate memory check content for all chapters.
Chapters: ${JSON.stringify(chapters)}

Return JSON only:
{
  "memory_checks": [
    {
      "domain": "#DOMAIN",
      "subdomain": "##SUBDOMAIN",
      "mnemonics": [],
      "key_formulas": [],
      "quick_reference_tables": [{"title":"","data":[]}],
      "visual_cues": [],
      "flashcard_prompts": [{"front":"","back":""}]
    }
  ]
}`,

    math_charts_graphs: (chapters) => `
Extract and generate all math-based, chart, and graph content.
Chapters: ${JSON.stringify(chapters)}

Return JSON only:
{
  "visual_content": [
    {
      "domain": "#DOMAIN",
      "type": "chart|graph|formula|table|diagram",
      "title": "",
      "description": "",
      "data_points": [],
      "ascii_representation": "",
      "mermaid_diagram": ""
    }
  ]
}`,

    practice_generation: (allData, practiceStruct) => `
Generate complete practice questions based on the study guide.
Practice Structure: ${JSON.stringify(practiceStruct)}
Study Data Summary: ${JSON.stringify(allData).substring(0, 3000)}

Return JSON only:
{
  "practice_questions": [
    {
      "id": 1,
      "domain": "#DOMAIN",
      "subdomain": "##SUBDOMAIN",
      "type": "multiple_choice",
      "difficulty": "medium",
      "question": "",
      "options": {"A":"","B":"","C":"","D":""},
      "correct_answer": "A",
      "explanation": "",
      "reference_topic": "###TOPIC"
    }
  ]
}`,
  };

  // ─────────────────────────────────────────────────────────────
  //  STYLES
  // ─────────────────────────────────────────────────────────────
  GM_addStyle(`
    #sg-panel {
      position: fixed;
      top: 80px;
      right: 16px;
      width: 380px;
      max-height: 88vh;
      background: #0f172a;
      color: #e2e8f0;
      border: 1px solid #334155;
      border-radius: 14px;
      box-shadow: 0 25px 60px rgba(0,0,0,0.6);
      font-family: 'Segoe UI', system-ui, sans-serif;
      font-size: 13px;
      z-index: 2147483647;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      transition: all 0.3s ease;
    }
    #sg-panel.collapsed { max-height: 52px; }
    #sg-header {
      background: linear-gradient(135deg, #1e3a5f, #0f4c81);
      padding: 12px 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      cursor: pointer;
      user-select: none;
      border-radius: 14px 14px 0 0;
      flex-shrink: 0;
    }
    #sg-header h3 {
      margin: 0;
      font-size: 14px;
      font-weight: 700;
      color: #7dd3fc;
      letter-spacing: 0.5px;
    }
    #sg-header-controls { display: flex; gap: 6px; align-items: center; }
    .sg-hbtn {
      background: rgba(255,255,255,0.1);
      border: none;
      color: #e2e8f0;
      padding: 3px 8px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 12px;
      transition: background 0.2s;
    }
    .sg-hbtn:hover { background: rgba(255,255,255,0.25); }
    #sg-body { overflow-y: auto; flex: 1; padding: 14px; display: flex; flex-direction: column; gap: 12px; }
    #sg-body::-webkit-scrollbar { width: 5px; }
    #sg-body::-webkit-scrollbar-track { background: #1e293b; }
    #sg-body::-webkit-scrollbar-thumb { background: #334155; border-radius: 3px; }

    /* Config Section */
    .sg-section {
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 10px;
      padding: 12px;
    }
    .sg-section-title {
      font-size: 11px;
      font-weight: 700;
      color: #94a3b8;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      margin-bottom: 10px;
    }
    .sg-field { margin-bottom: 10px; }
    .sg-field label { display: block; font-size: 11px; color: #94a3b8; margin-bottom: 4px; font-weight: 600; }
    .sg-field input, .sg-field textarea, .sg-field select {
      width: 100%;
      background: #0f172a;
      border: 1px solid #334155;
      border-radius: 7px;
      color: #e2e8f0;
      padding: 7px 10px;
      font-size: 12px;
      box-sizing: border-box;
      outline: none;
      transition: border-color 0.2s;
    }
    .sg-field input:focus, .sg-field textarea:focus {
      border-color: #3b82f6;
      box-shadow: 0 0 0 2px rgba(59,130,246,0.15);
    }
    .sg-field textarea { resize: vertical; min-height: 60px; }
    .sg-save-btn {
      width: 100%;
      background: #2563eb;
      color: #fff;
      border: none;
      border-radius: 7px;
      padding: 8px;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      transition: background 0.2s;
    }
    .sg-save-btn:hover { background: #1d4ed8; }

    /* Subject Input */
    #sg-subject-input {
      width: 100%;
      background: #0f172a;
      border: 1px solid #475569;
      border-radius: 7px;
      color: #e2e8f0;
      padding: 8px 10px;
      font-size: 13px;
      box-sizing: border-box;
      outline: none;
    }
    #sg-subject-input:focus { border-color: #3b82f6; }

    /* Control Buttons */
    .sg-controls { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 7px; }
    .sg-btn {
      border: none;
      border-radius: 8px;
      padding: 9px 6px;
      font-size: 11px;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.2s;
      letter-spacing: 0.3px;
    }
    .sg-btn:disabled { opacity: 0.4; cursor: not-allowed; }
    .sg-btn-start  { background: #16a34a; color: #fff; }
    .sg-btn-start:hover:not(:disabled)  { background: #15803d; }
    .sg-btn-pause  { background: #d97706; color: #fff; }
    .sg-btn-pause:hover:not(:disabled)  { background: #b45309; }
    .sg-btn-resume { background: #0891b2; color: #fff; }
    .sg-btn-resume:hover:not(:disabled) { background: #0e7490; }
    .sg-btn-stop   { background: #dc2626; color: #fff; }
    .sg-btn-stop:hover:not(:disabled)   { background: #b91c1c; }
    .sg-btn-retry  { background: #7c3aed; color: #fff; }
    .sg-btn-retry:hover:not(:disabled)  { background: #6d28d9; }
    .sg-btn-analyze { background: #0f766e; color: #fff; }
    .sg-btn-analyze:hover:not(:disabled) { background: #0d5e57; }

    /* Status Badge */
    #sg-status-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      border-radius: 20px;
      font-size: 11px;
      font-weight: 700;
    }
    .badge-idle    { background: #1e293b; color: #64748b; border: 1px solid #334155; }
    .badge-running { background: #052e16; color: #4ade80; border: 1px solid #16a34a; }
    .badge-paused  { background: #431407; color: #fb923c; border: 1px solid #d97706; }
    .badge-stopped { background: #1a1a1a;  color: #94a3b8; border: 1px solid #475569; }
    .badge-error   { background: #2d0000; color: #f87171; border: 1px solid #dc2626; }
    .badge-dot {
      width: 7px; height: 7px; border-radius: 50%;
      background: currentColor;
      animation: none;
    }
    .badge-running .badge-dot { animation: sg-pulse 1.2s ease-in-out infinite; }
    @keyframes sg-pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }

    /* Pipeline Steps */
    .sg-step {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 7px 10px;
      border-radius: 7px;
      margin-bottom: 4px;
      background: #0f172a;
      border: 1px solid #1e293b;
      transition: all 0.2s;
      font-size: 12px;
    }
    .sg-step.active  { border-color: #3b82f6; background: #1e3a5f; }
    .sg-step.done    { border-color: #16a34a; background: #052e16; }
    .sg-step.error   { border-color: #dc2626; background: #2d0000; }
    .sg-step.pending { opacity: 0.5; }
    .sg-step-icon { font-size: 14px; flex-shrink: 0; }
    .sg-step-label { flex: 1; color: #cbd5e1; }
    .sg-step-status { font-size: 14px; flex-shrink: 0; }

    /* Progress Bar */
    #sg-progress-wrap {
      background: #1e293b;
      border-radius: 5px;
      height: 8px;
      overflow: hidden;
    }
    #sg-progress-bar {
      height: 100%;
      background: linear-gradient(90deg, #2563eb, #7c3aed);
      border-radius: 5px;
      transition: width 0.4s ease;
      width: 0%;
    }

    /* Log */
    #sg-log {
      background: #020617;
      border: 1px solid #1e293b;
      border-radius: 7px;
      padding: 8px 10px;
      font-family: 'Courier New', monospace;
      font-size: 11px;
      max-height: 120px;
      overflow-y: auto;
      color: #94a3b8;
    }
    #sg-log::-webkit-scrollbar { width: 4px; }
    #sg-log::-webkit-scrollbar-thumb { background: #334155; border-radius: 2px; }
    .log-info  { color: #60a5fa; }
    .log-ok    { color: #4ade80; }
    .log-warn  { color: #fbbf24; }
    .log-error { color: #f87171; }

    /* Error Panel */
    #sg-error-panel {
      background: #2d0000;
      border: 1px solid #dc2626;
      border-radius: 7px;
      padding: 8px 10px;
      display: none;
      max-height: 90px;
      overflow-y: auto;
      font-size: 11px;
      color: #fca5a5;
    }

    /* Analyzer */
    #sg-analyzer-panel {
      display: none;
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 10px;
      padding: 12px;
      font-size: 12px;
    }
    .sg-analyzer-row { display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px solid #334155; }
    .sg-analyzer-row:last-child { border-bottom: none; }
    .sg-analyzer-key { color: #94a3b8; }
    .sg-analyzer-val { color: #7dd3fc; font-weight: 600; }

    /* Post to Doc Button */
    #sg-post-btn {
      width: 100%;
      background: linear-gradient(135deg, #059669, #0d9488);
      color: #fff;
      border: none;
      border-radius: 8px;
      padding: 10px;
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.2s;
      display: none;
    }
    #sg-post-btn:hover { opacity: 0.9; transform: translateY(-1px); }
    #sg-post-btn:disabled { opacity: 0.4; transform: none; cursor: not-allowed; }

    .sg-chip {
      display: inline-block;
      background: #1e3a5f;
      color: #7dd3fc;
      border-radius: 12px;
      padding: 2px 8px;
      font-size: 10px;
      font-weight: 600;
      margin: 2px;
    }
  `);

  // ─────────────────────────────────────────────────────────────
  //  RUNTIME STATE
  // ─────────────────────────────────────────────────────────────
  let currentState  = STATE.IDLE;
  let currentStep   = -1;
  let collectedData = {};
  let errorLog      = [];
  let abortFlag     = false;
  let pauseFlag     = false;

  // ─────────────────────────────────────────────────────────────
  //  BUILD UI
  // ─────────────────────────────────────────────────────────────
  function buildUI() {
    const panel = document.createElement('div');
    panel.id = 'sg-panel';

    panel.innerHTML = `
      <div id="sg-header">
        <h3>📖 StudyGuide AI</h3>
        <div id="sg-header-controls">
          <span id="sg-status-badge" class="badge-idle"><span class="badge-dot"></span>IDLE</span>
          <button class="sg-hbtn" id="sg-toggle-btn">▼</button>
          <button class="sg-hbtn" id="sg-close-btn">✕</button>
        </div>
      </div>

      <div id="sg-body">

        <!-- CONFIG SECTION -->
        <div class="sg-section">
          <div class="sg-section-title">⚙️ Configuration</div>
          <div class="sg-field">
            <label>App Script Web URL</label>
            <input type="text" id="sg-apps-script-url" placeholder="https://script.google.com/macros/s/.../exec" />
          </div>
          <div class="sg-field">
            <label>Doc ID</label>
            <input type="text" id="sg-doc-id" placeholder="Google Doc ID (from URL)" />
          </div>
          <button class="sg-save-btn" id="sg-save-config">💾 Save Configuration</button>
        </div>

        <!-- SUBJECT INPUT -->
        <div class="sg-section">
          <div class="sg-section-title">📝 Subject / Exam</div>
          <div class="sg-field">
            <label>Exam Name or Subject</label>
            <input type="text" id="sg-subject-input" placeholder="e.g. CompTIA Security+, AWS SAA-C03, PMP..." />
          </div>
          <div class="sg-field">
            <label>Additional Context (optional)</label>
            <textarea id="sg-extra-context" placeholder="Paste syllabus snippets, domain weights, or special instructions..."></textarea>
          </div>
        </div>

        <!-- CONTROLS -->
        <div class="sg-section">
          <div class="sg-section-title">🎮 Pipeline Controls</div>
          <div class="sg-controls">
            <button class="sg-btn sg-btn-start"   id="sg-btn-start">▶ START</button>
            <button class="sg-btn sg-btn-pause"   id="sg-btn-pause"   disabled>⏸ PAUSE</button>
            <button class="sg-btn sg-btn-resume"  id="sg-btn-resume"  disabled>▶ RESUME</button>
            <button class="sg-btn sg-btn-stop"    id="sg-btn-stop"    disabled>⏹ STOP</button>
            <button class="sg-btn sg-btn-retry"   id="sg-btn-retry"   disabled>↺ RETRY</button>
            <button class="sg-btn sg-btn-analyze" id="sg-btn-analyze">📊 ANALYZE</button>
          </div>
        </div>

        <!-- PROGRESS -->
        <div class="sg-section">
          <div class="sg-section-title" style="display:flex;justify-content:space-between">
            <span>⚡ Pipeline Progress</span>
            <span id="sg-step-counter" style="color:#7dd3fc">0 / ${PIPELINE_STEPS.length}</span>
          </div>
          <div id="sg-progress-wrap"><div id="sg-progress-bar"></div></div>
          <div style="margin-top:10px" id="sg-steps-list"></div>
        </div>

        <!-- LOG -->
        <div class="sg-section">
          <div class="sg-section-title">📜 Activity Log</div>
          <div id="sg-log"><span class="log-info">Ready. Configure settings and press START.</span></div>
        </div>

        <!-- ERROR PANEL -->
        <div class="sg-section" id="sg-error-section" style="display:none">
          <div class="sg-section-title" style="color:#f87171">⚠️ Errors</div>
          <div id="sg-error-panel"></div>
        </div>

        <!-- ANALYZER -->
        <div id="sg-analyzer-panel">
          <div class="sg-section-title">📊 Data Analyzer</div>
          <div id="sg-analyzer-content"></div>
        </div>

        <!-- POST BUTTON -->
        <button id="sg-post-btn">📤 Post to Google Doc</button>

      </div>
    `;

    document.body.appendChild(panel);
    initStepsList();
    loadConfig();
    bindEvents();
  }

  function initStepsList() {
    const list = document.getElementById('sg-steps-list');
    list.innerHTML = PIPELINE_STEPS.map((s, i) => `
      <div class="sg-step pending" id="sg-step-${i}">
        <span class="sg-step-icon">${s.icon}</span>
        <span class="sg-step-label">${s.label}</span>
        <span class="sg-step-status" id="sg-step-status-${i}">⬜</span>
      </div>
    `).join('');
  }

  // ─────────────────────────────────────────────────────────────
  //  BIND EVENTS
  // ─────────────────────────────────────────────────────────────
  function bindEvents() {
    document.getElementById('sg-toggle-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      document.getElementById('sg-panel').classList.toggle('collapsed');
      document.getElementById('sg-toggle-btn').textContent =
        document.getElementById('sg-panel').classList.contains('collapsed') ? '▲' : '▼';
    });
    document.getElementById('sg-header').addEventListener('click', () => {
      document.getElementById('sg-panel').classList.toggle('collapsed');
      document.getElementById('sg-toggle-btn').textContent =
        document.getElementById('sg-panel').classList.contains('collapsed') ? '▲' : '▼';
    });
    document.getElementById('sg-close-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      document.getElementById('sg-panel').style.display = 'none';
    });

    document.getElementById('sg-save-config').addEventListener('click', saveConfig);
    document.getElementById('sg-btn-start').addEventListener('click', startPipeline);
    document.getElementById('sg-btn-pause').addEventListener('click', pausePipeline);
    document.getElementById('sg-btn-resume').addEventListener('click', resumePipeline);
    document.getElementById('sg-btn-stop').addEventListener('click', stopPipeline);
    document.getElementById('sg-btn-retry').addEventListener('click', retryStep);
    document.getElementById('sg-btn-analyze').addEventListener('click', toggleAnalyzer);
    document.getElementById('sg-post-btn').addEventListener('click', postToGoogleDoc);
  }

  // ─────────────────────────────────────────────────────────────
  //  CONFIG PERSISTENCE
  // ─────────────────────────────────────────────────────────────
  function saveConfig() {
    const url   = document.getElementById('sg-apps-script-url').value.trim();
    const docId = document.getElementById('sg-doc-id').value.trim();
    if (!url || !docId) {
      addLog('⚠ Please fill both App Script URL and Doc ID.', 'warn');
      return;
    }
    GM_setValue(STORAGE_KEYS.APPS_SCRIPT_URL, url);
    GM_setValue(STORAGE_KEYS.DOC_ID, docId);
    addLog('✔ Configuration saved.', 'ok');
    showNotification('Configuration saved!');
  }

  function loadConfig() {
    const url   = GM_getValue(STORAGE_KEYS.APPS_SCRIPT_URL, '');
    const docId = GM_getValue(STORAGE_KEYS.DOC_ID, '');
    if (url)   document.getElementById('sg-apps-script-url').value = url;
    if (docId) document.getElementById('sg-doc-id').value = docId;
  }

  // ─────────────────────────────────────────────────────────────
  //  PIPELINE CONTROL
  // ─────────────────────────────────────────────────────────────
  async function startPipeline() {
    const subject = document.getElementById('sg-subject-input').value.trim();
    if (!subject) {
      addLog('⚠ Please enter an exam/subject name first.', 'warn');
      return;
    }
    const url   = GM_getValue(STORAGE_KEYS.APPS_SCRIPT_URL, '');
    const docId = GM_getValue(STORAGE_KEYS.DOC_ID, '');
    if (!url || !docId) {
      addLog('⚠ Please save your App Script URL and Doc ID first.', 'warn');
      return;
    }

    abortFlag   = false;
    pauseFlag   = false;
    collectedData = {};
    errorLog    = [];
    currentStep = 0;

    setUIState(STATE.RUNNING);
    resetAllSteps();
    addLog(`▶ Starting pipeline for: ${subject}`, 'info');

    await runPipeline(subject);
  }

  function pausePipeline() {
    pauseFlag = true;
    setUIState(STATE.PAUSED);
    addLog('⏸ Pipeline paused. Press RESUME to continue.', 'warn');
  }

  function resumePipeline() {
    pauseFlag = false;
    setUIState(STATE.RUNNING);
    addLog('▶ Resuming pipeline...', 'info');
    runPipeline(document.getElementById('sg-subject-input').value.trim(), currentStep);
  }

  function stopPipeline() {
    abortFlag = true;
    pauseFlag = false;
    setUIState(STATE.STOPPED);
    addLog('⏹ Pipeline stopped by user.', 'warn');
  }

  function retryStep() {
    if (currentStep < 0) return;
    abortFlag = false;
    pauseFlag = false;
    setUIState(STATE.RUNNING);
    const subject = document.getElementById('sg-subject-input').value.trim();
    addLog(`↺ Retrying step: ${PIPELINE_STEPS[currentStep].label}`, 'info');
    runPipeline(subject, currentStep);
  }

  // ─────────────────────────────────────────────────────────────
  //  MAIN PIPELINE
  // ─────────────────────────────────────────────────────────────
  async function runPipeline(subject, startFrom = 0) {
    for (let i = startFrom; i < PIPELINE_STEPS.length; i++) {
      if (abortFlag) break;

      while (pauseFlag) {
        await sleep(500);
        if (abortFlag) break;
      }
      if (abortFlag) break;

      currentStep = i;
      const step  = PIPELINE_STEPS[i];
      setStepState(i, 'active');
      addLog(`⚡ Running: ${step.label}`, 'info');
      updateProgress(i, PIPELINE_STEPS.length);

      try {
        const prompt  = buildPrompt(step.id, subject);
        const rawResp = await sendToAI(prompt);
        const parsed  = extractJSON(rawResp);
        collectedData[step.id] = parsed;
        setStepState(i, 'done');
        addLog(`✔ Completed: ${step.label}`, 'ok');
      } catch (err) {
        errorLog.push({ step: step.label, error: err.message, timestamp: new Date().toISOString() });
        setStepState(i, 'error');
        addLog(`✗ Error at ${step.label}: ${err.message}`, 'error');
        setUIState(STATE.ERROR);
        showErrorPanel();
        document.getElementById('sg-btn-retry').disabled = false;
        return;
      }

      await sleep(1200);
    }

    if (!abortFlag) {
      setUIState(STATE.IDLE);
      updateProgress(PIPELINE_STEPS.length, PIPELINE_STEPS.length);
      addLog('🎉 All pipeline steps completed! Ready to post to Google Doc.', 'ok');
      document.getElementById('sg-post-btn').style.display = 'block';
      showNotification('StudyGuide pipeline complete! Click "Post to Google Doc".');
    }
  }

  // ─────────────────────────────────────────────────────────────
  //  PROMPT BUILDER
  // ─────────────────────────────────────────────────────────────
  function buildPrompt(stepId, subject) {
    const d = collectedData;
    switch (stepId) {
      case 'exams_verification':       return PROMPTS.exams_verification(subject);
      case 'outline_mapping':          return PROMPTS.outline_mapping(d.exams_verification || { subject });
      case 'sample_question_mapping':  return PROMPTS.sample_question_mapping(d.outline_mapping || {});
      case 'chapters_structure':       return PROMPTS.chapters_structure(d.outline_mapping || {});
      case 'practice_question_struct': return PROMPTS.practice_question_struct(d.chapters_structure || {});
      case 'domain_subdomain_weight':  return PROMPTS.domain_subdomain_weight(d.exams_verification || {}, d.outline_mapping || {});
      case 'overview':                 return PROMPTS.overview(d);
      case 'main_purpose_target':      return PROMPTS.main_purpose_target(d.overview || {}, d.domain_subdomain_weight || {});
      case 'memory_check':             return PROMPTS.memory_check(d.chapters_structure || {});
      case 'math_charts_graphs':       return PROMPTS.math_charts_graphs(d.chapters_structure || {});
      case 'practice_generation':      return PROMPTS.practice_generation(d, d.practice_question_struct || {});
      default:                         return `Provide structured JSON data for: ${stepId} about ${subject}`;
    }
  }

  // ─────────────────────────────────────────────────────────────
  //  AI INTERACTION  (ChatGPT + Gemini)
  // ─────────────────────────────────────────────────────────────
  async function sendToAI(prompt) {
    const host = window.location.hostname;

    if (host.includes('openai') || host.includes('chatgpt')) {
      return await sendToGPT(prompt);
    } else if (host.includes('gemini') || host.includes('aistudio')) {
      return await sendToGemini(prompt);
    } else {
      throw new Error('Unsupported AI platform. Please open ChatGPT or Gemini.');
    }
  }

  async function sendToGPT(prompt) {
    const textarea = await waitForElement(
      'textarea[data-id="root"], #prompt-textarea, textarea[placeholder]',
      15000
    );
    if (!textarea) throw new Error('ChatGPT input textarea not found.');

    setNativeValue(textarea, prompt);
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    await sleep(500);

    const sendBtn = await waitForElement(
      'button[data-testid="send-button"], button[aria-label="Send prompt"]',
      5000
    );
    if (!sendBtn) throw new Error('ChatGPT send button not found.');
    sendBtn.click();

    return await waitForGPTResponse();
  }

  async function waitForGPTResponse(timeout = 120000) {
    const start = Date.now();
    await sleep(3000);

    return new Promise((resolve, reject) => {
      const check = setInterval(() => {
        if (Date.now() - start > timeout) {
          clearInterval(check);
          reject(new Error('GPT response timeout after 120s'));
          return;
        }
        const stopBtn = document.querySelector(
          'button[aria-label="Stop generating"], button[data-testid="stop-button"]'
        );
        if (stopBtn) return; // still generating

        const messages = document.querySelectorAll(
          '[data-message-author-role="assistant"], .markdown, .prose'
        );
        if (messages.length > 0) {
          const last = messages[messages.length - 1];
          const text = last.innerText || last.textContent;
          if (text && text.length > 20) {
            clearInterval(check);
            resolve(text);
          }
        }
      }, 1500);
    });
  }

  async function sendToGemini(prompt) {
    const textarea = await waitForElement(
      'rich-textarea .ql-editor, textarea[aria-label], .input-area textarea',
      15000
    );
    if (!textarea) throw new Error('Gemini input not found.');

    textarea.focus();
    document.execCommand('selectAll', false, null);
    document.execCommand('insertText', false, prompt);
    await sleep(500);

    const sendBtn = await waitForElement(
      'button[aria-label*="Send"], button.send-button, mat-icon[data-mat-icon-name="send"]',
      5000
    );
    if (!sendBtn) {
      // Try pressing Enter
      textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    } else {
      sendBtn.closest('button')?.click() || sendBtn.click();
    }

    return await waitForGeminiResponse();
  }

  async function waitForGeminiResponse(timeout = 120000) {
    const start = Date.now();
    await sleep(3000);

    return new Promise((resolve, reject) => {
      let lastLen = 0;
      let stableCount = 0;

      const check = setInterval(() => {
        if (Date.now() - start > timeout) {
          clearInterval(check);
          reject(new Error('Gemini response timeout after 120s'));
          return;
        }

        const responses = document.querySelectorAll(
          '.response-content, .model-response-text, message-content'
        );
        if (responses.length === 0) return;

        const last = responses[responses.length - 1];
        const text = last.innerText || last.textContent || '';

        if (text.length > 20) {
          if (text.length === lastLen) {
            stableCount++;
            if (stableCount >= 3) {
              clearInterval(check);
              resolve(text);
            }
          } else {
            lastLen = text.length;
            stableCount = 0;
          }
        }
      }, 1500);
    });
  }

  // ─────────────────────────────────────────────────────────────
  //  GOOGLE DOCS POST  (Apps Script)
  // ─────────────────────────────────────────────────────────────
  async function postToGoogleDoc() {
    const url   = GM_getValue(STORAGE_KEYS.APPS_SCRIPT_URL, '');
    const docId = GM_getValue(STORAGE_KEYS.DOC_ID, '');

    if (!url || !docId) {
      addLog('⚠ App Script URL or Doc ID missing.', 'warn');
      return;
    }

    const btn = document.getElementById('sg-post-btn');
    btn.disabled = true;
    btn.textContent = '⏳ Posting...';
    addLog('📤 Sending data to Google Doc...', 'info');

    const payload = {
      docId,
      subject: document.getElementById('sg-subject-input').value.trim(),
      generatedAt: new Date().toISOString(),
      data: collectedData,
    };

    GM_xmlhttpRequest({
      method: 'POST',
      url,
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify(payload),
      onload: (resp) => {
        if (resp.status >= 200 && resp.status < 300) {
          addLog('✔ Successfully posted to Google Doc!', 'ok');
          btn.textContent = '✔ Posted!';
          showNotification('Study guide posted to Google Doc!');
        } else {
          addLog(`✗ Post failed: HTTP ${resp.status} – ${resp.responseText}`, 'error');
          btn.disabled = false;
          btn.textContent = '📤 Retry Post';
        }
      },
      onerror: (err) => {
        addLog(`✗ Network error posting to Doc: ${JSON.stringify(err)}`, 'error');
        btn.disabled = false;
        btn.textContent = '📤 Retry Post';
      },
    });
  }

  // ─────────────────────────────────────────────────────────────
  //  ANALYZER
  // ─────────────────────────────────────────────────────────────
  function toggleAnalyzer() {
    const panel = document.getElementById('sg-analyzer-panel');
    const isVisible = panel.style.display === 'block';
    if (isVisible) {
      panel.style.display = 'none';
      return;
    }

    const content = document.getElementById('sg-analyzer-content');
    const steps_done  = Object.keys(collectedData).length;
    const steps_total = PIPELINE_STEPS.length;
    const errors_cnt  = errorLog.length;

    let html = `
      <div class="sg-analyzer-row">
        <span class="sg-analyzer-key">Steps Completed</span>
        <span class="sg-analyzer-val">${steps_done} / ${steps_total}</span>
      </div>
      <div class="sg-analyzer-row">
        <span class="sg-analyzer-key">Errors</span>
        <span class="sg-analyzer-val" style="color:${errors_cnt > 0 ? '#f87171' : '#4ade80'}">${errors_cnt}</span>
      </div>
      <div class="sg-analyzer-row">
        <span class="sg-analyzer-key">Data Size</span>
        <span class="sg-analyzer-val">${(JSON.stringify(collectedData).length / 1024).toFixed(1)} KB</span>
      </div>
      <div class="sg-analyzer-row">
        <span class="sg-analyzer-key">Current State</span>
        <span class="sg-analyzer-val">${currentState}</span>
      </div>
    `;

    if (collectedData.exams_verification) {
      const ev = collectedData.exams_verification;
      html += `
        <div style="margin-top:8px;font-weight:700;color:#94a3b8;font-size:11px">EXAM INFO</div>
        <div class="sg-analyzer-row">
          <span class="sg-analyzer-key">Exam</span>
          <span class="sg-analyzer-val">${ev.exam_name || '—'}</span>
        </div>
        <div class="sg-analyzer-row">
          <span class="sg-analyzer-key">Questions</span>
          <span class="sg-analyzer-val">${ev.total_questions || '—'}</span>
        </div>
        <div class="sg-analyzer-row">
          <span class="sg-analyzer-key">Domains</span>
          <span class="sg-analyzer-val">${(ev.domains || []).length}</span>
        </div>
      `;
    }

    if (collectedData.practice_generation) {
      const pq = collectedData.practice_generation;
      html += `
        <div style="margin-top:8px;font-weight:700;color:#94a3b8;font-size:11px">PRACTICE</div>
        <div class="sg-analyzer-row">
          <span class="sg-analyzer-key">Questions Generated</span>
          <span class="sg-analyzer-val">${(pq.practice_questions || []).length}</span>
        </div>
      `;
    }

    html += `<div style="margin-top:8px;font-size:10px;color:#475569">Steps completed:</div>
      <div style="margin-top:4px">
        ${Object.keys(collectedData).map(k => `<span class="sg-chip">${k.replace(/_/g, ' ')}</span>`).join('')}
      </div>`;

    content.innerHTML = html;
    panel.style.display = 'block';
  }

  // ─────────────────────────────────────────────────────────────
  //  UI HELPERS
  // ─────────────────────────────────────────────────────────────
  function setUIState(state) {
    currentState = state;
    const badge = document.getElementById('sg-status-badge');
    badge.className = 'badge-' + state.toLowerCase();
    badge.innerHTML = `<span class="badge-dot"></span>${state}`;

    document.getElementById('sg-btn-start').disabled   = state === STATE.RUNNING || state === STATE.PAUSED;
    document.getElementById('sg-btn-pause').disabled   = state !== STATE.RUNNING;
    document.getElementById('sg-btn-resume').disabled  = state !== STATE.PAUSED;
    document.getElementById('sg-btn-stop').disabled    = state === STATE.IDLE || state === STATE.STOPPED;
    document.getElementById('sg-btn-retry').disabled   = state !== STATE.ERROR;
  }

  function setStepState(idx, state) {
    const el = document.getElementById(`sg-step-${idx}`);
    const st = document.getElementById(`sg-step-status-${idx}`);
    if (!el || !st) return;
    el.className = `sg-step ${state}`;
    const icons = { active: '⏳', done: '✅', error: '❌', pending: '⬜' };
    st.textContent = icons[state] || '⬜';
  }

  function resetAllSteps() {
    PIPELINE_STEPS.forEach((_, i) => setStepState(i, 'pending'));
  }

  function updateProgress(done, total) {
    const pct = Math.round((done / total) * 100);
    document.getElementById('sg-progress-bar').style.width = `${pct}%`;
    document.getElementById('sg-step-counter').textContent = `${done} / ${total}`;
  }

  function addLog(msg, type = 'info') {
    const log = document.getElementById('sg-log');
    const span = document.createElement('span');
    span.className = `log-${type}`;
    const time = new Date().toLocaleTimeString();
    span.textContent = `[${time}] ${msg}`;
    const br = document.createElement('br');
    log.appendChild(span);
    log.appendChild(br);
    log.scrollTop = log.scrollHeight;
  }

  function showErrorPanel() {
    const section = document.getElementById('sg-error-section');
    const panel   = document.getElementById('sg-error-panel');
    if (errorLog.length === 0) return;
    panel.innerHTML = errorLog.map(e =>
      `<div><b>${e.step}</b>: ${e.error} <small style="color:#475569">${e.timestamp}</small></div>`
    ).join('');
    panel.style.display = 'block';
    section.style.display = 'block';
  }

  function showNotification(text) {
    GM_notification({
      title: 'StudyGuide AI',
      text,
      timeout: 4000,
    });
  }

  // ─────────────────────────────────────────────────────────────
  //  UTILITY FUNCTIONS
  // ─────────────────────────────────────────────────────────────
  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function waitForElement(selector, timeout = 10000) {
    return new Promise((resolve) => {
      const el = document.querySelector(selector);
      if (el) return resolve(el);

      const obs = new MutationObserver(() => {
        const found = document.querySelector(selector);
        if (found) { obs.disconnect(); resolve(found); }
      });
      obs.observe(document.body, { childList: true, subtree: true });

      setTimeout(() => { obs.disconnect(); resolve(null); }, timeout);
    });
  }

  function setNativeValue(el, value) {
    const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set
      || Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
    if (nativeSetter) nativeSetter.call(el, value);
    else el.value = value;
  }

  function extractJSON(text) {
    if (!text) throw new Error('Empty AI response');
    // Try to find JSON block
    const jsonMatch = text.match(/```json\s*([\s\S]*?)```/) ||
                      text.match(/```\s*([\s\S]*?)```/) ||
                      text.match(/(\{[\s\S]*\})/);
    if (jsonMatch) {
      try { return JSON.parse(jsonMatch[1].trim()); } catch { /* fall through */ }
    }
    // Try raw parse
    try { return JSON.parse(text.trim()); } catch { /* fall through */ }
    // Return raw text if not parseable JSON
    return { raw: text };
  }

  // ─────────────────────────────────────────────────────────────
  //  INIT
  // ─────────────────────────────────────────────────────────────
  function init() {
    buildUI();
    addLog('🟢 StudyGuide AI Automation loaded.', 'ok');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    setTimeout(init, 1500);
  }
})();
