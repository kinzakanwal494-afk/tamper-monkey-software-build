// ==UserScript==
// @name         StudyGuide AI Automation v13 - Text + Gemini Images
// @namespace    https://github.com/studyguide-automation
// @version      13.0.0
// @description  v13 — Automated exam study-guide generation. Text pages + Gemini images + equations + charts, captured from DOM and posted to Google Docs via Apps Script.
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
// @grant        GM_openInTab
// @connect      script.google.com
// @connect      script.googleusercontent.com
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  // ─────────────────────────────────────────────────────────────
  //  CONSTANTS & STORAGE
  // ─────────────────────────────────────────────────────────────
  const APP_ID = 'SG_V13';
  const GEMINI_URL = 'https://gemini.google.com/app';

  const STORAGE_KEYS = {
    APPS_SCRIPT_URL: `${APP_ID}_appsScriptUrl`,
    DOC_ID:          `${APP_ID}_docId`,
    SECRET_KEY:      `${APP_ID}_secretKey`,
    EXAM_CONFIG:     `${APP_ID}_examConfig`,
    IMAGE_CONFIG:    `${APP_ID}_imageConfig`,
    DOMAINS:         `${APP_ID}_domains`,
    REF_CONFIG:      `${APP_ID}_refConfig`,
    WORKFLOW:        `${APP_ID}_workflow`,
    PROGRESS:        `${APP_ID}_progress`,
    PIPELINE_STATE:  `${APP_ID}_pipelineState`,
    PRACTICE_CONFIG: `${APP_ID}_practiceConfig`,
    SAMPLE_MAPPING:  `${APP_ID}_sampleMapping`,
  };

  const STATE = {
    IDLE:    'IDLE',
    RUNNING: 'RUNNING',
    PAUSED:  'PAUSED',
    STOPPED: 'STOPPED',
    ERROR:   'ERROR',
  };

  // Default configurations (all image toggles default ON per spec)
  const DEFAULT_EXAM_CONFIG = {
    examName:       '',
    totalPages:     50,
    wordsPerPage:   650,
    minLinesPerPara: 4,
    maxLinesPerPara: 8,
    startFromPage:  1,
  };

  const DEFAULT_PRACTICE_CONFIG = {
    totalQuestions:   100,
    perBatch:         10,
    explMinLength:    80,
    explMaxLength:    250,
  };

  // Sample Question Mapping — fields to auto-detect with weights
  // Each field receives a weight% and a detected value from GPT after outline upload.
  const SAMPLE_MAPPING_FIELDS = [
    { key: 'scenarioBased',   label: 'Scenario-based questions',   unit: '%' },
    { key: 'definitionType',  label: 'Definition type',             unit: '%' },
    { key: 'recallStatement', label: 'Recall / Statemental type',   unit: '%' },
    { key: 'applicationBased',label: 'Application-based',           unit: '%' },
    { key: 'fillInTheBlanks', label: 'Fill in the blanks',          unit: '%' },
    { key: 'statementsLength',label: 'Statements length (words)',   unit: 'w' },
    { key: 'optionsCount',    label: 'Options count (per MCQ)',     unit: 'n' },
    { key: 'chartsGraphsImg', label: 'Charts / Graphs / Images',    unit: '%' },
  ];

  const DEFAULT_SAMPLE_MAPPING = (() => {
    const m = {};
    SAMPLE_MAPPING_FIELDS.forEach(f => { m[f.key] = { weight: 0, detected: '' }; });
    return m;
  })();

  const DEFAULT_IMAGE_CONFIG = {
    enableGemini:           true,
    requiresPlus:           true,
    equationsAsImages:      true,
    mathVisualRendering:    true,
    generateCharts:         true,
    dataChartsSupplyDemand: true,
    generateDiagrams:       true,
    networkAnatomyFlow:     true,
    maxWaitGeminiSec:       120,
  };

  const DEFAULT_REF_CONFIG = {
    reminderEveryPages:  5,
    validateQuality:     true,
    stripSourceMentions: true,
    autoStopOnMissing:   true,
  };

  const DEFAULT_WORKFLOW = {
    outlineUploaded: false,
    booksUploaded:   false,
    samplesUploaded: false,
  };

  const DEFAULT_PROGRESS = {
    percent:    0,
    message:    'Waiting to start...',
    pagesDone:  0,
    pagesTotal: 0,
    done:       0,
    failed:     0,
    retries:    0,
    words:      0,
    skipped:    0,
    images:     0,
    questions:  0,
    recent:     [],
    currentPage: 0,
  };

  // v13 Enforced reference rules (shown in UI, always on)
  const V13_RULES = [
    'Reference books ONLY — zero training data',
    'Domain/Subdomain headings: once on first page ONLY',
    'Specific ###topic headings — no generic names',
    'Math/Physics: real equations, not placeholders',
    'Chemistry: balanced reactions with state symbols',
    'Code: complete runnable examples with output',
    'Missing reference → Upload/Skip popup',
    'v13 NEW: Gemini images generated automatically',
  ];

  // ─────────────────────────────────────────────────────────────
  //  STYLES
  // ─────────────────────────────────────────────────────────────
  GM_addStyle(`
    #sg-panel {
      position: fixed;
      top: 70px;
      right: 16px;
      width: 420px;
      max-height: 92vh;
      background: #0b1220;
      color: #e2e8f0;
      border: 1px solid #1e293b;
      border-radius: 14px;
      box-shadow: 0 25px 60px rgba(0,0,0,0.65);
      font-family: 'Segoe UI', system-ui, sans-serif;
      font-size: 13px;
      z-index: 2147483647;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    #sg-panel.collapsed { max-height: 50px; }
    #sg-header {
      background: linear-gradient(135deg, #1e3a5f, #0f4c81);
      padding: 11px 14px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      cursor: pointer;
      user-select: none;
      flex-shrink: 0;
    }
    #sg-header h3 {
      margin: 0;
      font-size: 14px;
      font-weight: 700;
      color: #7dd3fc;
      letter-spacing: 0.4px;
    }
    #sg-header-controls { display: flex; gap: 6px; align-items: center; }
    .sg-hbtn {
      background: rgba(255,255,255,0.12);
      border: none;
      color: #e2e8f0;
      padding: 3px 8px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 12px;
    }
    .sg-hbtn:hover { background: rgba(255,255,255,0.25); }
    #sg-body {
      overflow-y: auto;
      flex: 1;
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    #sg-body::-webkit-scrollbar { width: 6px; }
    #sg-body::-webkit-scrollbar-track { background: #0f172a; }
    #sg-body::-webkit-scrollbar-thumb { background: #334155; border-radius: 3px; }

    .sg-section {
      background: #111c30;
      border: 1px solid #1e293b;
      border-radius: 10px;
      padding: 11px 12px;
    }
    .sg-section-title {
      font-size: 12px;
      font-weight: 700;
      color: #7dd3fc;
      letter-spacing: 0.5px;
      margin-bottom: 8px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .sg-section-sub {
      font-size: 10.5px;
      color: #64748b;
      margin-bottom: 8px;
      line-height: 1.45;
    }
    .sg-badge-required {
      background: #7f1d1d;
      color: #fecaca;
      font-size: 9px;
      font-weight: 800;
      padding: 2px 7px;
      border-radius: 10px;
      letter-spacing: 0.5px;
    }
    .sg-badge-on {
      background: #052e16;
      color: #4ade80;
      font-size: 9px;
      font-weight: 800;
      padding: 2px 7px;
      border-radius: 10px;
      letter-spacing: 0.5px;
      border: 1px solid #16a34a;
    }

    .sg-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    .sg-grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; }

    .sg-field { margin-bottom: 8px; }
    .sg-field label {
      display: block;
      font-size: 11px;
      color: #94a3b8;
      margin-bottom: 3px;
      font-weight: 600;
    }
    .sg-field input, .sg-field textarea, .sg-field select {
      width: 100%;
      background: #0b1220;
      border: 1px solid #1e293b;
      border-radius: 6px;
      color: #e2e8f0;
      padding: 6px 9px;
      font-size: 12px;
      box-sizing: border-box;
      outline: none;
    }
    .sg-field input:focus, .sg-field textarea:focus {
      border-color: #3b82f6;
      box-shadow: 0 0 0 2px rgba(59,130,246,0.15);
    }
    .sg-field textarea { resize: vertical; min-height: 52px; }

    /* Toggle row */
    .sg-toggle-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 5px 0;
      border-bottom: 1px dashed #1e293b;
    }
    .sg-toggle-row:last-child { border-bottom: none; }
    .sg-toggle-label {
      flex: 1;
      font-size: 11.5px;
      color: #cbd5e1;
    }
    .sg-toggle-sub {
      display: block;
      font-size: 10px;
      color: #64748b;
      margin-top: 2px;
    }
    .sg-toggle {
      position: relative;
      width: 36px;
      height: 20px;
      background: #334155;
      border-radius: 20px;
      cursor: pointer;
      transition: background 0.2s;
      flex-shrink: 0;
    }
    .sg-toggle::before {
      content: '';
      position: absolute;
      top: 2px;
      left: 2px;
      width: 16px;
      height: 16px;
      background: #fff;
      border-radius: 50%;
      transition: left 0.2s;
    }
    .sg-toggle.on {
      background: #16a34a;
    }
    .sg-toggle.on::before { left: 18px; }

    /* Save button */
    .sg-save-btn {
      width: 100%;
      background: #2563eb;
      color: #fff;
      border: none;
      border-radius: 7px;
      padding: 7px;
      font-size: 11.5px;
      font-weight: 700;
      cursor: pointer;
      transition: background 0.2s;
      margin-top: 6px;
    }
    .sg-save-btn:hover { background: #1d4ed8; }

    /* v13 Rule list */
    .sg-rules {
      list-style: none;
      margin: 0; padding: 0;
      font-size: 11px;
      color: #cbd5e1;
    }
    .sg-rules li { padding: 3px 0; }
    .sg-rules li::before {
      content: '✓ ';
      color: #4ade80;
      font-weight: 700;
      margin-right: 3px;
    }

    /* Workflow */
    .sg-step-card {
      background: #0b1220;
      border: 1px solid #1e293b;
      border-radius: 8px;
      padding: 10px;
      margin-bottom: 8px;
    }
    .sg-step-title {
      font-size: 12px;
      font-weight: 700;
      color: #e2e8f0;
      margin-bottom: 3px;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .sg-step-sub {
      font-size: 10.5px;
      color: #94a3b8;
      margin-bottom: 7px;
      line-height: 1.4;
    }
    .sg-step-actions { display: flex; gap: 6px; }
    .sg-step-btn {
      flex: 1;
      padding: 6px 8px;
      border-radius: 6px;
      border: 1px solid #334155;
      background: #1e293b;
      color: #cbd5e1;
      font-size: 11px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s;
    }
    .sg-step-btn:hover { background: #334155; }
    .sg-step-btn.primary { background: #2563eb; border-color: #3b82f6; color: #fff; }
    .sg-step-btn.primary:hover { background: #1d4ed8; }
    .sg-step-btn.confirmed { background: #052e16; border-color: #16a34a; color: #4ade80; }

    /* Domains list */
    #sg-domains-list {
      display: flex; flex-direction: column; gap: 6px;
      margin-bottom: 8px;
    }
    .sg-domain-row {
      display: grid;
      grid-template-columns: 1fr 70px 26px;
      gap: 6px;
      align-items: center;
    }
    .sg-domain-row input {
      background: #0b1220;
      border: 1px solid #1e293b;
      border-radius: 6px;
      color: #e2e8f0;
      padding: 5px 8px;
      font-size: 11.5px;
      outline: none;
    }
    .sg-domain-row input:focus { border-color: #3b82f6; }
    .sg-domain-del {
      background: #2d0000;
      border: 1px solid #dc2626;
      color: #f87171;
      border-radius: 5px;
      cursor: pointer;
      font-size: 12px;
      padding: 4px;
    }
    .sg-domain-del:hover { background: #7f1d1d; color: #fff; }
    .sg-domain-hint {
      font-size: 10px;
      color: #64748b;
      margin-bottom: 6px;
      font-style: italic;
    }

    /* Sample mapping rows */
    #sg-sample-mapping-list {
      display: flex; flex-direction: column; gap: 6px;
    }
    .sg-sm-row {
      display: grid;
      grid-template-columns: 1.5fr 68px 90px;
      gap: 6px;
      align-items: center;
    }
    .sg-sm-label {
      font-size: 11.5px;
      color: #cbd5e1;
      line-height: 1.25;
    }
    .sg-sm-label small {
      display: block;
      font-size: 9.5px;
      color: #64748b;
      margin-top: 1px;
    }
    .sg-sm-row input {
      background: #0b1220;
      border: 1px solid #1e293b;
      border-radius: 6px;
      color: #e2e8f0;
      padding: 5px 7px;
      font-size: 11.5px;
      outline: none;
      width: 100%;
      box-sizing: border-box;
    }
    .sg-sm-row input:focus { border-color: #3b82f6; }
    .sg-sm-detected {
      font-size: 11px;
      font-weight: 700;
      color: #4ade80;
      background: #052e16;
      border: 1px solid #16a34a;
      border-radius: 6px;
      padding: 5px 7px;
      text-align: center;
      min-height: 18px;
      line-height: 1.2;
    }
    .sg-sm-detected.empty {
      color: #64748b;
      background: #0b1220;
      border-color: #334155;
      font-weight: 500;
      font-style: italic;
    }

    /* Big Auto Generate button */
    #sg-auto-generate {
      width: 100%;
      background: linear-gradient(135deg, #059669, #0d9488);
      color: #fff;
      border: none;
      border-radius: 10px;
      padding: 13px;
      font-size: 14px;
      font-weight: 800;
      cursor: pointer;
      letter-spacing: 0.5px;
      transition: all 0.2s;
      text-transform: uppercase;
    }
    #sg-auto-generate:hover { opacity: 0.92; transform: translateY(-1px); }
    #sg-auto-generate:disabled { opacity: 0.45; transform: none; cursor: not-allowed; }
    #sg-auto-generate .sg-subline {
      display: block;
      font-size: 9.5px;
      font-weight: 500;
      color: rgba(255,255,255,0.78);
      margin-top: 3px;
      text-transform: none;
      letter-spacing: 0.2px;
    }

    /* Progress */
    #sg-progress-wrap {
      background: #0b1220;
      border-radius: 5px;
      height: 10px;
      overflow: hidden;
      border: 1px solid #1e293b;
    }
    #sg-progress-bar {
      height: 100%;
      background: linear-gradient(90deg, #2563eb, #7c3aed, #059669);
      border-radius: 5px;
      transition: width 0.4s ease;
      width: 0%;
    }
    .sg-progress-stats {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 6px;
      margin-top: 9px;
    }
    .sg-stat {
      background: #0b1220;
      border: 1px solid #1e293b;
      border-radius: 7px;
      padding: 6px 8px;
      text-align: center;
    }
    .sg-stat-val {
      display: block;
      font-size: 14px;
      font-weight: 800;
      color: #7dd3fc;
      line-height: 1.2;
    }
    .sg-stat-lbl {
      display: block;
      font-size: 9.5px;
      color: #94a3b8;
      text-transform: uppercase;
      letter-spacing: 0.4px;
      margin-top: 2px;
    }
    .sg-stat.ok .sg-stat-val    { color: #4ade80; }
    .sg-stat.fail .sg-stat-val  { color: #f87171; }
    .sg-stat.retry .sg-stat-val { color: #fbbf24; }
    .sg-stat.skip .sg-stat-val  { color: #94a3b8; }
    .sg-stat.img .sg-stat-val   { color: #c084fc; }
    .sg-stat.word .sg-stat-val  { color: #7dd3fc; }

    #sg-progress-text {
      font-size: 11px;
      color: #94a3b8;
      margin-top: 6px;
      text-align: center;
    }
    #sg-progress-pct {
      font-size: 22px;
      font-weight: 800;
      color: #7dd3fc;
      text-align: center;
      margin-bottom: 4px;
    }

    /* Recent pages */
    #sg-recent-pages {
      max-height: 100px;
      overflow-y: auto;
      background: #0b1220;
      border: 1px solid #1e293b;
      border-radius: 6px;
      padding: 5px 8px;
      font-size: 10.5px;
      color: #94a3b8;
      margin-top: 8px;
    }
    #sg-recent-pages::-webkit-scrollbar { width: 4px; }
    #sg-recent-pages::-webkit-scrollbar-thumb { background: #334155; }
    .sg-recent-item {
      padding: 2px 0;
      border-bottom: 1px dashed #1e293b;
      display: flex;
      justify-content: space-between;
    }
    .sg-recent-item:last-child { border-bottom: none; }
    .sg-recent-status { font-size: 10px; font-weight: 700; }

    /* Control buttons */
    .sg-controls {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 6px;
    }
    .sg-btn {
      border: none;
      border-radius: 7px;
      padding: 8px 5px;
      font-size: 10.5px;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.15s;
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
    .sg-btn-skip   { background: #475569; color: #fff; }
    .sg-btn-skip:hover:not(:disabled)   { background: #334155; }
    .sg-btn-reset  { background: #1e293b; color: #f87171; border: 1px solid #dc2626; grid-column: span 3; }
    .sg-btn-reset:hover:not(:disabled)  { background: #7f1d1d; color: #fff; }
    .sg-btn-verify { background: linear-gradient(135deg, #0f766e, #0891b2); color: #fff; }
    .sg-btn-verify:hover:not(:disabled) { background: linear-gradient(135deg, #0d5e57, #0e7490); }

    /* Status */
    #sg-status-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 3px 9px;
      border-radius: 20px;
      font-size: 10.5px;
      font-weight: 700;
    }
    .badge-idle    { background: #1e293b; color: #64748b; border: 1px solid #334155; }
    .badge-running { background: #052e16; color: #4ade80; border: 1px solid #16a34a; }
    .badge-paused  { background: #431407; color: #fb923c; border: 1px solid #d97706; }
    .badge-stopped { background: #1a1a1a; color: #94a3b8; border: 1px solid #475569; }
    .badge-error   { background: #2d0000; color: #f87171; border: 1px solid #dc2626; }
    .badge-dot {
      width: 6px; height: 6px; border-radius: 50%;
      background: currentColor;
    }
    .badge-running .badge-dot { animation: sg-pulse 1.2s ease-in-out infinite; }
    @keyframes sg-pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }

    /* Live console */
    #sg-console {
      background: #020617;
      border: 1px solid #1e293b;
      border-radius: 7px;
      padding: 8px 10px;
      font-family: 'Courier New', Consolas, monospace;
      font-size: 10.5px;
      height: 150px;
      overflow-y: auto;
      color: #94a3b8;
      line-height: 1.5;
    }
    #sg-console::-webkit-scrollbar { width: 4px; }
    #sg-console::-webkit-scrollbar-thumb { background: #334155; border-radius: 2px; }
    .log-info  { color: #60a5fa; }
    .log-ok    { color: #4ade80; }
    .log-warn  { color: #fbbf24; }
    .log-error { color: #f87171; }
    .log-img   { color: #c084fc; }
    .log-sys   { color: #94a3b8; font-style: italic; }

    /* Step notification banner */
    #sg-step-notify {
      background: linear-gradient(135deg, #78350f, #b45309);
      border: 1px solid #f59e0b;
      border-radius: 8px;
      padding: 10px 12px;
      color: #fef3c7;
      font-size: 12px;
      font-weight: 600;
      display: none;
      line-height: 1.4;
      animation: sg-blink 1.6s ease-in-out infinite;
    }
    #sg-step-notify .sg-notify-title {
      display: block;
      font-size: 13px;
      color: #fff;
      margin-bottom: 2px;
    }
    @keyframes sg-blink {
      0%,100% { box-shadow: 0 0 0 0 rgba(245,158,11,0.0); }
      50%     { box-shadow: 0 0 0 4px rgba(245,158,11,0.35); }
    }

    /* Upload / Skip popup */
    #sg-popup-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.72);
      display: none;
      align-items: center;
      justify-content: center;
      z-index: 2147483646;
    }
    #sg-popup {
      background: #0b1220;
      border: 1px solid #dc2626;
      border-radius: 12px;
      padding: 22px;
      width: 420px;
      max-width: 90vw;
      box-shadow: 0 25px 60px rgba(0,0,0,0.8);
      color: #e2e8f0;
    }
    #sg-popup h3 {
      margin: 0 0 10px 0;
      color: #f87171;
      font-size: 16px;
    }
    #sg-popup p {
      font-size: 12px;
      color: #cbd5e1;
      line-height: 1.5;
      margin-bottom: 14px;
    }
    #sg-popup .sg-popup-btns {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }
  `);

  // ─────────────────────────────────────────────────────────────
  //  RUNTIME STATE
  // ─────────────────────────────────────────────────────────────
  let currentState = STATE.IDLE;
  let abortFlag    = false;
  let pauseFlag    = false;
  let skipFlag     = false;

  // Confirmation resolvers — startGeneration awaits these when it needs
  // the user to do something in ChatGPT (upload outline / samples / books).
  const pendingConfirm = {
    outline:  null,
    samples:  null,
    books:    null,
    newBook:  null,
  };
  let subjectRulesAcknowledged = false;
  let examConfig     = loadObj(STORAGE_KEYS.EXAM_CONFIG,     DEFAULT_EXAM_CONFIG);
  let imageConfig    = loadObj(STORAGE_KEYS.IMAGE_CONFIG,    DEFAULT_IMAGE_CONFIG);
  let refConfig      = loadObj(STORAGE_KEYS.REF_CONFIG,      DEFAULT_REF_CONFIG);
  let workflow       = loadObj(STORAGE_KEYS.WORKFLOW,        DEFAULT_WORKFLOW);
  let progress       = loadObj(STORAGE_KEYS.PROGRESS,        DEFAULT_PROGRESS);
  let domains        = loadObj(STORAGE_KEYS.DOMAINS,         []); // [{name, weight}]
  let practiceConfig = loadObj(STORAGE_KEYS.PRACTICE_CONFIG, DEFAULT_PRACTICE_CONFIG);
  let sampleMapping  = loadObj(STORAGE_KEYS.SAMPLE_MAPPING,  DEFAULT_SAMPLE_MAPPING);

  // ─────────────────────────────────────────────────────────────
  //  UI BUILD
  // ─────────────────────────────────────────────────────────────
  function buildUI() {
    const panel = document.createElement('div');
    panel.id = 'sg-panel';
    panel.innerHTML = `
      <div id="sg-header">
        <h3>📖 StudyGuide AI — v13</h3>
        <div id="sg-header-controls">
          <span id="sg-status-badge" class="badge-idle"><span class="badge-dot"></span>IDLE</span>
          <button class="sg-hbtn" id="sg-toggle-btn">▼</button>
          <button class="sg-hbtn" id="sg-close-btn">✕</button>
        </div>
      </div>
      <div id="sg-body">

        <!-- 1. EXAM CONFIGURATION -->
        <div class="sg-section">
          <div class="sg-section-title">
            <span>📚 Exam Configuration</span>
            <span class="sg-badge-required">REQUIRED</span>
          </div>
          <div class="sg-field">
            <label>Exam Name</label>
            <input type="text" id="sg-exam-name" placeholder="e.g. CompTIA Security+, USMLE Step 1, PMP..." />
          </div>
          <div class="sg-grid-3">
            <div class="sg-field">
              <label>Total Pages</label>
              <input type="number" id="sg-total-pages" min="1" />
            </div>
            <div class="sg-field">
              <label>Words / Page</label>
              <input type="number" id="sg-words-page" min="100" />
            </div>
            <div class="sg-field">
              <label>Start From Page</label>
              <input type="number" id="sg-start-page" min="1" />
            </div>
          </div>
          <div class="sg-grid-2">
            <div class="sg-field">
              <label>Min Lines / Para</label>
              <input type="number" id="sg-min-lines" min="1" />
            </div>
            <div class="sg-field">
              <label>Max Lines / Para</label>
              <input type="number" id="sg-max-lines" min="1" />
            </div>
          </div>
          <button class="sg-save-btn" id="sg-save-exam">💾 Save Exam Config</button>
        </div>

        <!-- 1b. PRACTICE QUESTIONS GENERATION -->
        <div class="sg-section">
          <div class="sg-section-title">
            <span>🎓 Practice Questions Generation</span>
            <span class="sg-badge-required">REQUIRED</span>
          </div>
          <div class="sg-grid-2">
            <div class="sg-field">
              <label>Total Questions Generation</label>
              <input type="number" id="sg-pq-total" min="1" />
            </div>
            <div class="sg-field">
              <label>Per Batch Questions</label>
              <input type="number" id="sg-pq-batch" min="1" />
            </div>
          </div>
          <div class="sg-grid-2">
            <div class="sg-field">
              <label>Explanation Min Length (words)</label>
              <input type="number" id="sg-pq-expl-min" min="10" />
            </div>
            <div class="sg-field">
              <label>Explanation Max Length (words)</label>
              <input type="number" id="sg-pq-expl-max" min="10" />
            </div>
          </div>
          <div class="sg-grid-2" style="gap:6px">
            <button class="sg-save-btn" id="sg-save-practice" style="margin-top:0">💾 Save Practice Config</button>
            <button class="sg-save-btn" id="sg-gen-practice" style="margin-top:0;background:linear-gradient(135deg,#7c3aed,#2563eb)">🎓 Generate Now</button>
          </div>
          <div id="sg-pq-progress" style="margin-top:8px;font-size:10.5px;color:#94a3b8;text-align:center">
            0 / 0 questions generated
          </div>
        </div>

        <!-- 1c. AUTO-DETECT SAMPLE QUESTION MAPPINGS -->
        <div class="sg-section">
          <div class="sg-section-title">
            <span>🧩 Auto-Detect Sample Question Mappings</span>
            <span class="sg-badge-on">AUTO</span>
          </div>
          <div class="sg-section-sub">
            After outline/books upload, the script asks GPT to analyse the exam and return a weighted
            distribution for each question type below. Detected values appear next to each field and
            are used when generating practice questions.
          </div>
          <div id="sg-sample-mapping-list"></div>
          <div class="sg-grid-2" style="gap:6px;margin-top:6px">
            <button class="sg-step-btn" id="sg-sm-reset">↺ Reset</button>
            <button class="sg-step-btn primary" id="sg-sm-detect">🔍 Auto-Detect Now</button>
          </div>
          <div style="margin-top:6px;text-align:right;font-size:10px;color:#64748b" id="sg-sm-total">
            Total weight (% fields): 0%
          </div>
          <button class="sg-save-btn" id="sg-save-sample">💾 Save Mapping</button>
        </div>

        <!-- 2. VISUAL CONTENT GENERATION -->
        <div class="sg-section">
          <div class="sg-section-title">
            <span>🎨 Visual Content Generation</span>
            <span class="sg-badge-on">GEMINI</span>
          </div>
          <div class="sg-section-sub">
            🎨 <b>Gemini Image Generation:</b> Script opens a new Gemini tab to generate diagrams, charts,
            anatomical figures, chemical structures and circuit diagrams — automatically, based on exam type.<br>
            ⏳ <b>Wait time:</b> Gemini takes 30–120 seconds per image. Script waits patiently.<br>
            📥 <b>Save method:</b> Generated images are captured via DOM and sent to Google Docs.
          </div>

          <div class="sg-toggle-row">
            <div class="sg-toggle-label">
              Enable Image Generation (Gemini)
              <span class="sg-toggle-sub">Requires ChatGPT Plus/Pro account</span>
            </div>
            <div class="sg-toggle" id="tog-enableGemini"></div>
          </div>
          <div class="sg-toggle-row">
            <div class="sg-toggle-label">Requires ChatGPT Plus/Pro account</div>
            <div class="sg-toggle" id="tog-requiresPlus"></div>
          </div>
          <div class="sg-toggle-row">
            <div class="sg-toggle-label">
              Generate equations as images
              <span class="sg-toggle-sub">Math / Physics / Chemistry equations rendered visually</span>
            </div>
            <div class="sg-toggle" id="tog-equationsAsImages"></div>
          </div>
          <div class="sg-toggle-row">
            <div class="sg-toggle-label">Math/Physics/Chemistry equations rendered visually</div>
            <div class="sg-toggle" id="tog-mathVisualRendering"></div>
          </div>
          <div class="sg-toggle-row">
            <div class="sg-toggle-label">
              Generate charts / graphs
              <span class="sg-toggle-sub">Data charts, supply-demand curves, bar graphs</span>
            </div>
            <div class="sg-toggle" id="tog-generateCharts"></div>
          </div>
          <div class="sg-toggle-row">
            <div class="sg-toggle-label">Data charts, supply-demand curves, bar graphs</div>
            <div class="sg-toggle" id="tog-dataChartsSupplyDemand"></div>
          </div>
          <div class="sg-toggle-row">
            <div class="sg-toggle-label">
              Generate diagrams / flowcharts
              <span class="sg-toggle-sub">Network diagrams, anatomy, process flows</span>
            </div>
            <div class="sg-toggle" id="tog-generateDiagrams"></div>
          </div>
          <div class="sg-toggle-row">
            <div class="sg-toggle-label">Network diagrams, anatomy, process flows</div>
            <div class="sg-toggle" id="tog-networkAnatomyFlow"></div>
          </div>

          <div class="sg-field" style="margin-top:8px">
            <label>Max wait for Gemini (seconds)</label>
            <input type="number" id="sg-max-wait" min="10" max="600" />
          </div>
          <button class="sg-save-btn" id="sg-save-image">💾 Save Image Config</button>
        </div>

        <!-- 3. DOMAIN WEIGHTS -->
        <div class="sg-section">
          <div class="sg-section-title">
            <span>⚖ Domain Weights</span>
            <span class="sg-badge-on">AUTO-DETECT</span>
          </div>
          <div class="sg-domain-hint">
            ⚡ Auto-Detect: Leave empty — after outline upload, UI auto-detects all domains + weights from GPT.
          </div>
          <div id="sg-domains-list"></div>
          <div class="sg-grid-2" style="gap:6px">
            <button class="sg-step-btn" id="sg-add-domain">➕ Add Domain</button>
            <button class="sg-step-btn primary" id="sg-detect-domains">🔍 Auto-Detect Now</button>
          </div>
          <div style="margin-top:6px;text-align:right;font-size:10px;color:#64748b" id="sg-weight-total">
            Total weight: 0%
          </div>
        </div>

        <!-- 4. REFERENCE ENFORCEMENT -->
        <div class="sg-section">
          <div class="sg-section-title">
            <span>🔒 Reference Enforcement</span>
            <span class="sg-badge-on">ALWAYS ON</span>
          </div>
          <div style="font-size:11px;font-weight:700;color:#c084fc;margin-bottom:5px">
            v13 Enforced Rules
          </div>
          <ul class="sg-rules">
            ${V13_RULES.map(r => `<li>${escapeHtml(r)}</li>`).join('')}
          </ul>

          <div class="sg-toggle-row" style="margin-top:8px">
            <div class="sg-toggle-label">
              Reference reminder every N pages
              <span class="sg-toggle-sub">Re-sends strict content rules</span>
            </div>
            <div class="sg-toggle on" id="tog-refReminderEnabled"></div>
          </div>
          <div class="sg-field">
            <label>Remind every (pages)</label>
            <input type="number" id="sg-remind-every" min="1" max="50" />
          </div>
          <div class="sg-toggle-row">
            <div class="sg-toggle-label">
              Validate response quality
              <span class="sg-toggle-sub">Reject + retry if response has forbidden patterns</span>
            </div>
            <div class="sg-toggle" id="tog-validateQuality"></div>
          </div>
          <div class="sg-toggle-row">
            <div class="sg-toggle-label">Strip source mentions before saving</div>
            <div class="sg-toggle" id="tog-stripSourceMentions"></div>
          </div>
          <div class="sg-toggle-row">
            <div class="sg-toggle-label">
              Auto-stop on missing reference
              <span class="sg-toggle-sub">Shows upload popup when GPT can't find content</span>
            </div>
            <div class="sg-toggle" id="tog-autoStopOnMissing"></div>
          </div>
          <button class="sg-save-btn" id="sg-save-ref">💾 Save Reference Config</button>
        </div>

        <!-- 5. WORKFLOW STEPS -->
        <div class="sg-section">
          <div class="sg-section-title">
            <span>📋 Workflow Steps</span>
          </div>

          <div class="sg-step-card">
            <div class="sg-step-title">1️⃣ Upload Exam Outline</div>
            <div class="sg-step-sub">
              Click GPT + → upload outline → confirm here. UI auto-detects domains.
            </div>
            <div class="sg-step-actions">
              <button class="sg-step-btn primary" id="sg-open-outline">📎 Open GPT Upload</button>
              <button class="sg-step-btn" id="sg-confirm-outline">✓ Confirm Outline</button>
            </div>
          </div>

          <div class="sg-step-card">
            <div class="sg-step-title">2️⃣ Upload Reference Books</div>
            <div class="sg-step-sub">
              Upload ALL reference PDFs to GPT, then confirm.
            </div>
            <div class="sg-step-actions">
              <button class="sg-step-btn primary" id="sg-open-books">📚 Open GPT Upload</button>
              <button class="sg-step-btn" id="sg-confirm-books">✓ Confirm Books</button>
            </div>
          </div>

          <div class="sg-step-card">
            <div class="sg-step-title">3️⃣ Upload Sample Questions</div>
            <div class="sg-step-sub">
              Upload sample-question PDFs / references to GPT, then confirm. Used for
              sample-question mapping and practice-question style.
            </div>
            <div class="sg-step-actions">
              <button class="sg-step-btn primary" id="sg-open-samples">❓ Open GPT Upload</button>
              <button class="sg-step-btn" id="sg-confirm-samples">✓ Confirm Samples</button>
            </div>
          </div>
        </div>

        <!-- 6. AUTO GENERATE -->
        <div class="sg-section">
          <div id="sg-step-notify">
            <span class="sg-notify-title">🔔 Action Required</span>
            <span id="sg-step-notify-msg">Waiting...</span>
          </div>
          <button id="sg-auto-generate">
            ⚡ Auto Generate — Text + Images
            <span class="sg-subline">
              v13: Text pages + Gemini images + equations + charts generated automatically.
              Images detected from DOM and saved to Google Docs.
            </span>
          </button>
        </div>

        <!-- 7. GENERATION PROGRESS -->
        <div class="sg-section">
          <div class="sg-section-title">
            <span>📊 Generation Progress</span>
            <span id="sg-page-counter" style="color:#7dd3fc;font-weight:700">0 / 0 pages</span>
          </div>
          <div id="sg-progress-pct">0%</div>
          <div id="sg-progress-wrap"><div id="sg-progress-bar"></div></div>
          <div id="sg-progress-text">Waiting to start...</div>

          <div class="sg-progress-stats">
            <div class="sg-stat ok"><span class="sg-stat-val" id="sg-stat-done">0</span><span class="sg-stat-lbl">done</span></div>
            <div class="sg-stat fail"><span class="sg-stat-val" id="sg-stat-failed">0</span><span class="sg-stat-lbl">failed</span></div>
            <div class="sg-stat retry"><span class="sg-stat-val" id="sg-stat-retries">0</span><span class="sg-stat-lbl">retries</span></div>
            <div class="sg-stat word"><span class="sg-stat-val" id="sg-stat-words">0</span><span class="sg-stat-lbl">words</span></div>
            <div class="sg-stat skip"><span class="sg-stat-val" id="sg-stat-skipped">⏭ 0</span><span class="sg-stat-lbl">skipped</span></div>
            <div class="sg-stat img"><span class="sg-stat-val" id="sg-stat-images">🖼 0</span><span class="sg-stat-lbl">images</span></div>
            <div class="sg-stat" style="grid-column:span 3"><span class="sg-stat-val" id="sg-stat-questions" style="color:#c084fc">🎓 0</span><span class="sg-stat-lbl">practice questions</span></div>
          </div>

          <div style="margin-top:10px;font-size:10.5px;color:#94a3b8;font-weight:700">Recent Pages</div>
          <div id="sg-recent-pages"><div style="color:#475569">No pages generated yet.</div></div>
        </div>

        <!-- 8. CONTROLS -->
        <div class="sg-section">
          <div class="sg-section-title"><span>🎯 Controls</span></div>
          <div class="sg-controls">
            <button class="sg-btn sg-btn-verify" id="sg-btn-verify" style="grid-column:span 3">📋 Start Exam Verification</button>
            <button class="sg-btn sg-btn-start"  id="sg-btn-start">▶ Start Generation</button>
            <button class="sg-btn sg-btn-pause"  id="sg-btn-pause"  disabled>⏸ Pause</button>
            <button class="sg-btn sg-btn-resume" id="sg-btn-resume" disabled>▶ Resume</button>
            <button class="sg-btn sg-btn-retry"  id="sg-btn-retry"  disabled>↺ Retry Page</button>
            <button class="sg-btn sg-btn-skip"   id="sg-btn-skip"   disabled>⏭ Skip Page</button>
            <button class="sg-btn sg-btn-stop"   id="sg-btn-stop"   disabled>⏹ Stop</button>
            <button class="sg-btn sg-btn-reset"  id="sg-btn-reset">🗑 Reset Everything</button>
          </div>
        </div>

        <!-- 9. LIVE CONSOLE -->
        <div class="sg-section">
          <div class="sg-section-title">
            <span>💻 Live Console</span>
            <button class="sg-hbtn" id="sg-clear-console">🗑</button>
          </div>
          <div id="sg-console"></div>
        </div>

        <!-- Apps Script config -->
        <div class="sg-section">
          <div class="sg-section-title"><span>🔗 Google Docs Connection</span></div>
          <div class="sg-field">
            <label>Apps Script Web URL</label>
            <input type="text" id="sg-apps-script-url" placeholder="https://script.google.com/macros/s/.../exec" />
          </div>
          <div class="sg-field">
            <label>Google Doc ID</label>
            <input type="text" id="sg-doc-id" placeholder="Doc ID (from URL)" />
          </div>
          <div class="sg-field">
            <label>Secret Key</label>
            <input type="password" id="sg-secret-key" placeholder="same as Apps Script secret..." />
          </div>
          <div class="sg-grid-2" style="gap:6px">
            <button class="sg-save-btn" id="sg-save-docs" style="margin-top:0">💾 Save Docs Config</button>
            <button class="sg-save-btn" id="sg-test-conn" style="margin-top:0;background:linear-gradient(135deg,#0891b2,#0e7490)">🧪 Test Connection</button>
          </div>
          <div id="sg-conn-result" style="display:none;margin-top:7px;padding:6px 10px;border-radius:6px;font-size:11px;font-family:monospace"></div>
        </div>

      </div>

      <!-- Missing reference popup -->
      <div id="sg-popup-overlay">
        <div id="sg-popup">
          <h3 id="sg-popup-title">⚠ Missing Reference</h3>
          <p id="sg-popup-body">GPT could not find the referenced content. Upload the missing reference or skip this page.</p>
          <div class="sg-popup-btns">
            <button class="sg-step-btn primary" id="sg-popup-upload">📎 Upload Reference</button>
            <button class="sg-step-btn" id="sg-popup-skip">⏭ Skip Page</button>
          </div>
        </div>
      </div>

      <!-- Missing-book popup (from reference verification) -->
      <div id="sg-book-popup-overlay" style="position:fixed;inset:0;background:rgba(0,0,0,0.72);display:none;align-items:center;justify-content:center;z-index:2147483646">
        <div style="background:#0b1220;border:1px solid #f59e0b;border-radius:12px;padding:22px;width:460px;max-width:90vw;color:#e2e8f0;box-shadow:0 25px 60px rgba(0,0,0,0.8)">
          <h3 style="margin:0 0 10px 0;color:#fbbf24;font-size:16px">⚠ Missing Book / Data Detected</h3>
          <p id="sg-book-popup-body" style="font-size:12px;color:#cbd5e1;line-height:1.5;margin-bottom:14px">
            GPT reports missing reference data for some domains / subdomains.
            Upload the missing book, then click "Confirm New Book" to continue.
          </p>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
            <button class="sg-step-btn primary" id="sg-book-popup-add">📎 Add New Book</button>
            <button class="sg-step-btn" id="sg-book-popup-confirm">✓ Confirm New Book</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(panel);
    applyConfigsToUI();
    renderDomains();
    renderSampleMapping();
    updateProgressUI();
    bindEvents();
  }

  // ─────────────────────────────────────────────────────────────
  //  LOAD / APPLY CONFIG
  // ─────────────────────────────────────────────────────────────
  function applyConfigsToUI() {
    // Exam
    $('#sg-exam-name').value    = examConfig.examName || '';
    $('#sg-total-pages').value  = examConfig.totalPages;
    $('#sg-words-page').value   = examConfig.wordsPerPage;
    $('#sg-start-page').value   = examConfig.startFromPage;
    $('#sg-min-lines').value    = examConfig.minLinesPerPara;
    $('#sg-max-lines').value    = examConfig.maxLinesPerPara;

    // Image toggles
    setToggle('tog-enableGemini',          imageConfig.enableGemini);
    setToggle('tog-requiresPlus',          imageConfig.requiresPlus);
    setToggle('tog-equationsAsImages',     imageConfig.equationsAsImages);
    setToggle('tog-mathVisualRendering',   imageConfig.mathVisualRendering);
    setToggle('tog-generateCharts',        imageConfig.generateCharts);
    setToggle('tog-dataChartsSupplyDemand',imageConfig.dataChartsSupplyDemand);
    setToggle('tog-generateDiagrams',      imageConfig.generateDiagrams);
    setToggle('tog-networkAnatomyFlow',    imageConfig.networkAnatomyFlow);
    $('#sg-max-wait').value = imageConfig.maxWaitGeminiSec;

    // Practice
    $('#sg-pq-total').value    = practiceConfig.totalQuestions;
    $('#sg-pq-batch').value    = practiceConfig.perBatch;
    $('#sg-pq-expl-min').value = practiceConfig.explMinLength;
    $('#sg-pq-expl-max').value = practiceConfig.explMaxLength;

    // Reference
    $('#sg-remind-every').value = refConfig.reminderEveryPages;
    setToggle('tog-validateQuality',     refConfig.validateQuality);
    setToggle('tog-stripSourceMentions', refConfig.stripSourceMentions);
    setToggle('tog-autoStopOnMissing',   refConfig.autoStopOnMissing);

    // Docs
    $('#sg-apps-script-url').value = GM_getValue(STORAGE_KEYS.APPS_SCRIPT_URL, '');
    $('#sg-doc-id').value          = GM_getValue(STORAGE_KEYS.DOC_ID, '');
    const sk = $('#sg-secret-key'); if (sk) sk.value = GM_getValue(STORAGE_KEYS.SECRET_KEY, '');

    // Workflow
    applyWorkflowUI();
  }

  function applyWorkflowUI() {
    const b1 = $('#sg-confirm-outline');
    const b2 = $('#sg-confirm-books');
    const b3 = $('#sg-confirm-samples');
    if (b1) b1.classList.toggle('confirmed', workflow.outlineUploaded);
    if (b2) b2.classList.toggle('confirmed', workflow.booksUploaded);
    if (b3) b3.classList.toggle('confirmed', workflow.samplesUploaded);
    if (b1) b1.textContent = workflow.outlineUploaded ? '✔ Outline Confirmed' : '✓ Confirm Outline';
    if (b2) b2.textContent = workflow.booksUploaded   ? '✔ Books Confirmed'   : '✓ Confirm Books';
    if (b3) b3.textContent = workflow.samplesUploaded ? '✔ Samples Confirmed' : '✓ Confirm Samples';
  }

  function setToggle(id, on) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.toggle('on', !!on);
  }

  // ─────────────────────────────────────────────────────────────
  //  DOMAIN RENDER
  // ─────────────────────────────────────────────────────────────
  function renderDomains() {
    const list = $('#sg-domains-list');
    if (!list) return;
    if (!domains.length) {
      list.innerHTML = `<div style="font-size:11px;color:#64748b;font-style:italic">
        No domains yet. Click "Auto-Detect Now" after uploading the outline, or add manually.
      </div>`;
    } else {
      list.innerHTML = domains.map((d, i) => `
        <div class="sg-domain-row">
          <input type="text" placeholder="Domain name" value="${escapeAttr(d.name || '')}" data-idx="${i}" data-field="name" />
          <input type="number" placeholder="%" min="0" max="100" value="${d.weight ?? ''}" data-idx="${i}" data-field="weight" />
          <button class="sg-domain-del" data-idx="${i}" title="Remove">🗑</button>
        </div>
      `).join('');

      list.querySelectorAll('input').forEach(inp => {
        inp.addEventListener('input', (e) => {
          const idx = +e.target.dataset.idx;
          const field = e.target.dataset.field;
          if (field === 'weight') {
            domains[idx][field] = parseFloat(e.target.value) || 0;
          } else {
            domains[idx][field] = e.target.value;
          }
          saveObj(STORAGE_KEYS.DOMAINS, domains);
          updateWeightTotal();
        });
      });

      list.querySelectorAll('.sg-domain-del').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const idx = +e.target.dataset.idx;
          domains.splice(idx, 1);
          saveObj(STORAGE_KEYS.DOMAINS, domains);
          renderDomains();
          updateWeightTotal();
        });
      });
    }
    updateWeightTotal();
  }

  function updateWeightTotal() {
    const total = domains.reduce((s, d) => s + (parseFloat(d.weight) || 0), 0);
    const el = $('#sg-weight-total');
    if (!el) return;
    el.textContent = `Total weight: ${total.toFixed(1)}%`;
    el.style.color = (Math.abs(total - 100) < 0.5) ? '#4ade80'
                   : (total > 100 ? '#f87171' : '#fbbf24');
  }

  // ─────────────────────────────────────────────────────────────
  //  SAMPLE-QUESTION-MAPPING RENDER
  // ─────────────────────────────────────────────────────────────
  function renderSampleMapping() {
    const list = $('#sg-sample-mapping-list');
    if (!list) return;
    list.innerHTML = SAMPLE_MAPPING_FIELDS.map(f => {
      const entry = sampleMapping[f.key] || { weight: 0, detected: '' };
      const detected = (entry.detected === '' || entry.detected === null || entry.detected === undefined)
        ? `<span class="sg-sm-detected empty">not detected</span>`
        : `<span class="sg-sm-detected">${escapeHtml(String(entry.detected))}</span>`;
      return `
        <div class="sg-sm-row" data-key="${f.key}">
          <div class="sg-sm-label">
            ${escapeHtml(f.label)}
            <small>weight (${f.unit}) → detected</small>
          </div>
          <input type="number" step="0.1" min="0" placeholder="${f.unit}"
                 value="${entry.weight ?? ''}" data-field="weight" data-key="${f.key}" />
          ${detected}
        </div>
      `;
    }).join('');

    list.querySelectorAll('input').forEach(inp => {
      inp.addEventListener('input', (e) => {
        const key = e.target.dataset.key;
        const val = parseFloat(e.target.value);
        if (!sampleMapping[key]) sampleMapping[key] = { weight: 0, detected: '' };
        sampleMapping[key].weight = isNaN(val) ? 0 : val;
        saveObj(STORAGE_KEYS.SAMPLE_MAPPING, sampleMapping);
        updateSampleMappingTotal();
      });
    });
    updateSampleMappingTotal();
  }

  function updateSampleMappingTotal() {
    // Only sum fields whose unit is '%'
    const pctKeys = SAMPLE_MAPPING_FIELDS.filter(f => f.unit === '%').map(f => f.key);
    const total = pctKeys.reduce((s, k) =>
      s + (parseFloat(sampleMapping[k]?.weight) || 0), 0);
    const el = $('#sg-sm-total');
    if (!el) return;
    el.textContent = `Total weight (% fields): ${total.toFixed(1)}%`;
    el.style.color = (Math.abs(total - 100) < 0.5) ? '#4ade80'
                   : (total > 100 ? '#f87171' : '#fbbf24');
  }

  // ─────────────────────────────────────────────────────────────
  //  EVENTS
  // ─────────────────────────────────────────────────────────────
  // Safe binder — logs + continues on missing element / error, so a single
  // missing ID never breaks every other button on the panel.
  function on(sel, ev, fn) {
    try {
      const el = (typeof sel === 'string') ? $(sel) : sel;
      if (!el) { log(`⚠ bind: "${sel}" not found`, 'warn'); return; }
      el.addEventListener(ev, (e) => {
        try { return fn(e); }
        catch (err) { log(`✗ handler ${sel}: ${err.message}`, 'error'); console.error(err); }
      });
    } catch (err) {
      log(`✗ bind error ${sel}: ${err.message}`, 'error');
    }
  }

  function bindEvents() {
    on('#sg-toggle-btn', 'click', (e) => { e.stopPropagation(); togglePanel(); });
    on('#sg-header',     'click', togglePanel);
    on('#sg-close-btn',  'click', (e) => {
      e.stopPropagation();
      const p = $('#sg-panel'); if (p) p.style.display = 'none';
    });

    // Saves
    on('#sg-save-exam',     'click', saveExamConfig);
    on('#sg-save-image',    'click', saveImageConfig);
    on('#sg-save-ref',      'click', saveRefConfig);
    on('#sg-save-docs',     'click', saveDocsConfig);
    on('#sg-test-conn',     'click', testDocsConnection);
    on('#sg-save-practice', 'click', savePracticeConfig);
    on('#sg-gen-practice',  'click', generatePracticeQuestions);
    on('#sg-save-sample',   'click', saveSampleMapping);
    on('#sg-sm-reset',      'click', resetSampleMapping);
    on('#sg-sm-detect',     'click', autoDetectSampleMapping);

    // Toggles — clicking flips state and auto-saves immediately.
    bindToggle('tog-enableGemini',          imageConfig, 'enableGemini',          STORAGE_KEYS.IMAGE_CONFIG);
    bindToggle('tog-requiresPlus',          imageConfig, 'requiresPlus',          STORAGE_KEYS.IMAGE_CONFIG);
    bindToggle('tog-equationsAsImages',     imageConfig, 'equationsAsImages',     STORAGE_KEYS.IMAGE_CONFIG);
    bindToggle('tog-mathVisualRendering',   imageConfig, 'mathVisualRendering',   STORAGE_KEYS.IMAGE_CONFIG);
    bindToggle('tog-generateCharts',        imageConfig, 'generateCharts',        STORAGE_KEYS.IMAGE_CONFIG);
    bindToggle('tog-dataChartsSupplyDemand',imageConfig, 'dataChartsSupplyDemand',STORAGE_KEYS.IMAGE_CONFIG);
    bindToggle('tog-generateDiagrams',      imageConfig, 'generateDiagrams',      STORAGE_KEYS.IMAGE_CONFIG);
    bindToggle('tog-networkAnatomyFlow',    imageConfig, 'networkAnatomyFlow',    STORAGE_KEYS.IMAGE_CONFIG);

    bindToggle('tog-validateQuality',     refConfig, 'validateQuality',     STORAGE_KEYS.REF_CONFIG);
    bindToggle('tog-stripSourceMentions', refConfig, 'stripSourceMentions', STORAGE_KEYS.REF_CONFIG);
    bindToggle('tog-autoStopOnMissing',   refConfig, 'autoStopOnMissing',   STORAGE_KEYS.REF_CONFIG);

    // Domains
    on('#sg-add-domain', 'click', () => {
      domains.push({ name: '', weight: 0 });
      saveObj(STORAGE_KEYS.DOMAINS, domains);
      renderDomains();
    });
    on('#sg-detect-domains', 'click', autoDetectDomains);

    // Workflow
    on('#sg-open-outline',    'click', () => openGPTForUpload('outline'));
    on('#sg-confirm-outline', 'click', () => confirmUpload('outline'));
    on('#sg-open-books',      'click', () => openGPTForUpload('books'));
    on('#sg-confirm-books',   'click', () => confirmUpload('books'));
    on('#sg-open-samples',    'click', () => openGPTForUpload('samples'));
    on('#sg-confirm-samples', 'click', () => confirmUpload('samples'));

    // Auto-generate + controls
    on('#sg-auto-generate','click', autoGenerate);
    on('#sg-btn-verify',   'click', startExamVerification);
    on('#sg-btn-start',    'click', startGeneration);
    on('#sg-btn-pause',    'click', pauseGeneration);
    on('#sg-btn-resume',   'click', resumeGeneration);
    on('#sg-btn-retry',    'click', retryPage);
    on('#sg-btn-skip',     'click', skipPage);
    on('#sg-btn-stop',     'click', stopGeneration);
    on('#sg-btn-reset',    'click', resetEverything);

    // Console
    on('#sg-clear-console', 'click', () => {
      const c = $('#sg-console'); if (c) c.innerHTML = '';
      log('Console cleared.', 'sys');
    });

    // Popup
    on('#sg-popup-upload', 'click', () => { hidePopup(); openGPTForUpload('missing'); });
    on('#sg-popup-skip',   'click', () => { hidePopup(); skipPage(); });

    // Book popup
    on('#sg-book-popup-add',     'click', () => openGPTForUpload('new-book'));
    on('#sg-book-popup-confirm', 'click', () => {
      if (pendingConfirm.newBook) { pendingConfirm.newBook(); pendingConfirm.newBook = null; }
      hideBookPopup();
      log('✔ New book confirmed. Re-checking coverage...', 'ok');
    });
  }

  function bindToggle(id, target, field, storageKey) {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('click', () => {
      target[field] = !target[field];
      el.classList.toggle('on', target[field]);
      saveObj(storageKey, target);
      log(`Toggle "${field}" → ${target[field] ? 'ON' : 'OFF'}`, 'sys');
    });
  }

  function togglePanel() {
    const p = $('#sg-panel');
    p.classList.toggle('collapsed');
    $('#sg-toggle-btn').textContent = p.classList.contains('collapsed') ? '▲' : '▼';
  }

  // ─────────────────────────────────────────────────────────────
  //  SAVE CONFIGS
  // ─────────────────────────────────────────────────────────────
  function saveExamConfig() {
    examConfig = {
      examName:        $('#sg-exam-name').value.trim(),
      totalPages:      parseInt($('#sg-total-pages').value, 10)  || DEFAULT_EXAM_CONFIG.totalPages,
      wordsPerPage:    parseInt($('#sg-words-page').value, 10)   || DEFAULT_EXAM_CONFIG.wordsPerPage,
      startFromPage:   parseInt($('#sg-start-page').value, 10)   || 1,
      minLinesPerPara: parseInt($('#sg-min-lines').value, 10)    || DEFAULT_EXAM_CONFIG.minLinesPerPara,
      maxLinesPerPara: parseInt($('#sg-max-lines').value, 10)    || DEFAULT_EXAM_CONFIG.maxLinesPerPara,
    };
    if (!examConfig.examName) {
      log('⚠ Exam Name is required.', 'warn');
      return;
    }
    saveObj(STORAGE_KEYS.EXAM_CONFIG, examConfig);
    progress.pagesTotal = examConfig.totalPages;
    saveObj(STORAGE_KEYS.PROGRESS, progress);
    updateProgressUI();
    log(`✔ Exam config saved — ${examConfig.examName}, ${examConfig.totalPages} pages.`, 'ok');
    notify('Exam configuration saved!');
  }

  function saveImageConfig() {
    imageConfig.maxWaitGeminiSec =
      parseInt($('#sg-max-wait').value, 10) || DEFAULT_IMAGE_CONFIG.maxWaitGeminiSec;
    saveObj(STORAGE_KEYS.IMAGE_CONFIG, imageConfig);
    log('✔ Image config saved.', 'ok');
    notify('Image configuration saved!');
  }

  function saveRefConfig() {
    refConfig.reminderEveryPages =
      parseInt($('#sg-remind-every').value, 10) || DEFAULT_REF_CONFIG.reminderEveryPages;
    saveObj(STORAGE_KEYS.REF_CONFIG, refConfig);
    log('✔ Reference config saved.', 'ok');
    notify('Reference configuration saved!');
  }

  function saveDocsConfig() {
    const url    = $('#sg-apps-script-url').value.trim();
    const docId  = $('#sg-doc-id').value.trim();
    const secret = ($('#sg-secret-key')?.value || '').trim();
    GM_setValue(STORAGE_KEYS.APPS_SCRIPT_URL, url);
    GM_setValue(STORAGE_KEYS.DOC_ID, docId);
    GM_setValue(STORAGE_KEYS.SECRET_KEY, secret);
    log('✔ Google Docs connection saved.', 'ok');
    notify('Docs connection saved!');
  }

  function testDocsConnection() {
    const result = $('#sg-conn-result');
    const url    = $('#sg-apps-script-url').value.trim();
    const docId  = $('#sg-doc-id').value.trim();
    const secret = ($('#sg-secret-key')?.value || '').trim();

    if (!url || !docId) {
      if (result) {
        result.style.display = 'block';
        result.style.background = 'rgba(239,68,68,.08)';
        result.style.color = '#f87171';
        result.textContent = '✗ URL and Doc ID required';
      }
      return;
    }
    if (result) {
      result.style.display = 'block';
      result.style.background = 'rgba(59,130,246,.08)';
      result.style.color = '#60a5fa';
      result.textContent = '⏳ Testing...';
    }

    GM_xmlhttpRequest({
      method: 'POST',
      url,
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify({ secret, docId, action: 'ping' }),
      timeout: 15000,
      onload: (r) => {
        if (r.status >= 200 && r.status < 400) {
          let serverErr = null;
          try {
            const resp = JSON.parse(r.responseText || '{}');
            if (resp.status === 'error') serverErr = resp.message || 'Server error';
          } catch (_) {}
          if (result) {
            result.style.display = 'block';
            if (serverErr) {
              result.style.background = 'rgba(239,68,68,.08)';
              result.style.color = '#f87171';
              result.textContent = '✗ ' + serverErr;
            } else {
              result.style.background = 'rgba(16,185,129,.08)';
              result.style.color = '#4ade80';
              result.textContent = '✓ Connection successful';
            }
          }
        } else if (result) {
          result.style.display = 'block';
          result.style.background = 'rgba(239,68,68,.08)';
          result.style.color = '#f87171';
          result.textContent = `✗ HTTP ${r.status}`;
        }
      },
      onerror: () => {
        if (result) {
          result.style.display = 'block';
          result.style.background = 'rgba(239,68,68,.08)';
          result.style.color = '#f87171';
          result.textContent = '✗ Network unreachable';
        }
      },
      ontimeout: () => {
        if (result) {
          result.style.display = 'block';
          result.style.background = 'rgba(239,68,68,.08)';
          result.style.color = '#f87171';
          result.textContent = '✗ Timed out';
        }
      },
    });
  }

  function savePracticeConfig() {
    practiceConfig = {
      totalQuestions: parseInt($('#sg-pq-total').value, 10)    || DEFAULT_PRACTICE_CONFIG.totalQuestions,
      perBatch:       parseInt($('#sg-pq-batch').value, 10)    || DEFAULT_PRACTICE_CONFIG.perBatch,
      explMinLength:  parseInt($('#sg-pq-expl-min').value, 10) || DEFAULT_PRACTICE_CONFIG.explMinLength,
      explMaxLength:  parseInt($('#sg-pq-expl-max').value, 10) || DEFAULT_PRACTICE_CONFIG.explMaxLength,
    };
    if (practiceConfig.explMinLength > practiceConfig.explMaxLength) {
      log('⚠ Explanation min length > max length — swapping.', 'warn');
      const t = practiceConfig.explMinLength;
      practiceConfig.explMinLength = practiceConfig.explMaxLength;
      practiceConfig.explMaxLength = t;
    }
    saveObj(STORAGE_KEYS.PRACTICE_CONFIG, practiceConfig);
    log(`✔ Practice config saved — ${practiceConfig.totalQuestions} Q, ${practiceConfig.perBatch}/batch.`, 'ok');
    notify('Practice configuration saved!');
  }

  function saveSampleMapping() {
    saveObj(STORAGE_KEYS.SAMPLE_MAPPING, sampleMapping);
    log('✔ Sample question mapping saved.', 'ok');
    notify('Sample mapping saved!');
  }

  function resetSampleMapping() {
    if (!confirm('Reset all sample question mapping weights and detected values?')) return;
    sampleMapping = JSON.parse(JSON.stringify(DEFAULT_SAMPLE_MAPPING));
    saveObj(STORAGE_KEYS.SAMPLE_MAPPING, sampleMapping);
    renderSampleMapping();
    log('↺ Sample mapping reset.', 'warn');
  }

  async function autoDetectSampleMapping() {
    if (!isOnGPT()) {
      log('⚠ Sample mapping auto-detect runs on ChatGPT. Open chatgpt.com.', 'warn');
      return;
    }
    if (!examConfig.examName) {
      log('⚠ Set Exam Name first.', 'warn');
      return;
    }

    log('🔍 Asking GPT to detect sample question mapping distribution...', 'info');

    const fieldList = SAMPLE_MAPPING_FIELDS.map(f =>
      `  - "${f.key}" → ${f.label} (unit: ${f.unit === '%' ? 'percent weight' : f.unit === 'w' ? 'average word count' : 'integer count'})`
    ).join('\n');

    const prompt = `You are analysing the exam "${examConfig.examName}" using the outline and reference books I uploaded.

Estimate the typical SAMPLE QUESTION distribution for this exam. For every field below, return a single numeric value:
- Fields with unit "percent weight" → percentage 0–100 (all % fields must sum to 100).
- Fields with unit "average word count" → typical statement length (e.g. 25).
- Fields with unit "integer count" → typical option count per MCQ (e.g. 4 or 5).

Fields:
${fieldList}

Return STRICT JSON ONLY in this shape, no prose:
{
  "scenarioBased":    0,
  "definitionType":   0,
  "recallStatement":  0,
  "applicationBased": 0,
  "fillInTheBlanks":  0,
  "statementsLength": 0,
  "optionsCount":     0,
  "chartsGraphsImg":  0
}`;

    try {
      const raw = await sendToGPT(prompt);
      const data = extractJSON(raw);
      let updated = 0;
      SAMPLE_MAPPING_FIELDS.forEach(f => {
        if (data && Object.prototype.hasOwnProperty.call(data, f.key)) {
          const val = parseFloat(data[f.key]);
          if (!isNaN(val)) {
            if (!sampleMapping[f.key]) sampleMapping[f.key] = { weight: 0, detected: '' };
            sampleMapping[f.key].detected = val;
            sampleMapping[f.key].weight   = val;
            updated++;
          }
        }
      });
      saveObj(STORAGE_KEYS.SAMPLE_MAPPING, sampleMapping);
      renderSampleMapping();
      log(`✔ Auto-detected ${updated} sample mapping fields.`, 'ok');
      notify(`Sample mapping: ${updated} fields detected.`);
    } catch (err) {
      log(`✗ Sample mapping detect failed: ${err.message}`, 'error');
    }
  }

  // ─────────────────────────────────────────────────────────────
  //  WORKFLOW STEPS
  // ─────────────────────────────────────────────────────────────
  function openGPTForUpload(kind) {
    const host = window.location.hostname;
    if (host.includes('chatgpt') || host.includes('openai')) {
      log(`📎 Opening GPT upload dialog for ${kind}...`, 'info');
      GPT.triggerUpload();
    } else {
      log('ℹ Open ChatGPT in a new tab and use the + to upload.', 'info');
      try { GM_openInTab('https://chatgpt.com/', { active: true }); } catch (_) {}
    }
  }

  async function confirmUpload(kind) {
    if (kind === 'outline') {
      workflow.outlineUploaded = true;
      log('✔ Outline confirmed.', 'ok');
      applyWorkflowUI();
      saveObj(STORAGE_KEYS.WORKFLOW, workflow);
      hideStepNotify();
      if (pendingConfirm.outline) {
        pendingConfirm.outline(); pendingConfirm.outline = null;
      } else {
        // Manual (non-orchestrated) path: auto-detect inline
        await autoDetectDomains();
      }
    } else if (kind === 'books') {
      workflow.booksUploaded = true;
      log('✔ Reference books confirmed.', 'ok');
      applyWorkflowUI();
      saveObj(STORAGE_KEYS.WORKFLOW, workflow);
      hideStepNotify();
      if (pendingConfirm.books) {
        pendingConfirm.books(); pendingConfirm.books = null;
      }
    } else if (kind === 'samples') {
      workflow.samplesUploaded = true;
      log('✔ Sample questions confirmed.', 'ok');
      applyWorkflowUI();
      saveObj(STORAGE_KEYS.WORKFLOW, workflow);
      hideStepNotify();
      if (pendingConfirm.samples) {
        pendingConfirm.samples(); pendingConfirm.samples = null;
      } else {
        await autoDetectSampleMapping();
      }
    }
  }

  // ─────────────────────────────────────────────────────────────
  //  AUTO-DETECT DOMAINS (via GPT)
  // ─────────────────────────────────────────────────────────────
  async function autoDetectDomains() {
    if (!isOnGPT()) {
      log('⚠ Auto-detect runs on ChatGPT. Please run from chatgpt.com.', 'warn');
      return;
    }
    log('🔍 Asking GPT to extract domains + weights from the uploaded outline...', 'info');
    const prompt = `From the exam outline I just uploaded, extract ALL domains and their official weight percentages.
Return STRICT JSON ONLY in this shape — no prose, no commentary:
{
  "domains": [
    { "name": "DOMAIN NAME", "weight": 20 }
  ]
}
Rules:
- Weights MUST sum to 100.
- Use the exact domain names from the outline.
- If a domain has no explicit weight, estimate proportionally from sub-topic counts.`;

    try {
      const raw = await sendToGPT(prompt);
      const data = extractJSON(raw);
      const list = Array.isArray(data.domains) ? data.domains : [];
      if (!list.length) {
        log('⚠ GPT returned no domains. Add them manually.', 'warn');
        return;
      }
      domains = list.map(d => ({
        name:   String(d.name || '').trim(),
        weight: parseFloat(d.weight) || 0,
      })).filter(d => d.name);
      saveObj(STORAGE_KEYS.DOMAINS, domains);
      renderDomains();
      log(`✔ Auto-detected ${domains.length} domains.`, 'ok');
      notify(`Detected ${domains.length} domains from outline.`);
    } catch (err) {
      log(`✗ Auto-detect failed: ${err.message}`, 'error');
    }
  }

  // ─────────────────────────────────────────────────────────────
  //  EXAM VERIFICATION (pre-flight check via GPT)
  // ─────────────────────────────────────────────────────────────
  async function startExamVerification() {
    if (!examConfig.examName) {
      log('⚠ Enter the Exam Name first.', 'warn');
      return;
    }
    if (!isOnGPT()) {
      log('⚠ Exam verification runs on ChatGPT. Open chatgpt.com and retry.', 'warn');
      return;
    }

    const btn = $('#sg-btn-verify');
    btn.disabled = true;
    btn.textContent = '⏳ Verifying...';
    log(`📋 Starting exam verification for "${examConfig.examName}"...`, 'info');

    const prompt = `You are a study-guide architect. Verify the following exam and return ONLY STRICT JSON:

Exam: ${examConfig.examName}

Return JSON (no prose):
{
  "exam_name": "",
  "governing_body": "",
  "total_questions": 0,
  "time_limit_minutes": 0,
  "passing_score": "",
  "question_types": [],
  "domains": [{"name":"","weight_percent":0,"subdomain_count":0}],
  "recommended_references": [],
  "verified": true,
  "warnings": []
}

Rules:
- If the exam is unknown or ambiguous, set "verified": false and list issues in "warnings".
- Domain weights must sum to 100 when verified is true.
- Use the exact official names (no paraphrasing).`;

    try {
      const raw = await sendToGPT(prompt);
      const data = extractJSON(raw);

      if (!data || data.verified === false) {
        const warnings = (data && data.warnings) ? data.warnings.join('; ') : 'Exam not verified.';
        log(`✗ Verification failed: ${warnings}`, 'error');
        notify('Exam verification failed — see console.');
      } else {
        log(`✔ Verified: ${data.exam_name || examConfig.examName}`, 'ok');
        if (data.governing_body)     log(`   Governing body: ${data.governing_body}`, 'sys');
        if (data.total_questions)    log(`   Total questions: ${data.total_questions}`, 'sys');
        if (data.time_limit_minutes) log(`   Time limit: ${data.time_limit_minutes} min`, 'sys');
        if (data.passing_score)      log(`   Passing score: ${data.passing_score}`, 'sys');
        if (Array.isArray(data.question_types) && data.question_types.length) {
          log(`   Question types: ${data.question_types.join(', ')}`, 'sys');
        }
        if (Array.isArray(data.domains) && data.domains.length) {
          log(`   Detected ${data.domains.length} domain(s) — pre-filling Domain Weights.`, 'sys');
          domains = data.domains.map(d => ({
            name:   String(d.name || '').trim(),
            weight: parseFloat(d.weight_percent) || 0,
          })).filter(d => d.name);
          saveObj(STORAGE_KEYS.DOMAINS, domains);
          renderDomains();
        }
        notify('Exam verified successfully!');
      }
    } catch (err) {
      log(`✗ Exam verification error: ${err.message}`, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = '📋 Start Exam Verification';
    }
  }

  // ─────────────────────────────────────────────────────────────
  //  AUTO GENERATE (Text + Images pipeline)
  // ─────────────────────────────────────────────────────────────
  async function autoGenerate() {
    if (!examConfig.examName) {
      log('⚠ Set Exam Name first.', 'warn');
      return;
    }
    await startGeneration();
  }

  // ─────────────────────────────────────────────────────────────
  //  STEP NOTIFICATION (yellow banner + active confirm button)
  // ─────────────────────────────────────────────────────────────
  function showStepNotify(title, message) {
    const box = $('#sg-step-notify');
    const msg = $('#sg-step-notify-msg');
    if (!box || !msg) return;
    box.style.display = 'block';
    msg.innerHTML = `<b>${escapeHtml(title)}</b><br>${escapeHtml(message)}`;
  }
  function hideStepNotify() {
    const box = $('#sg-step-notify');
    if (box) box.style.display = 'none';
  }

  function waitForConfirm(kind) {
    return new Promise((resolve) => { pendingConfirm[kind] = resolve; });
  }

  function showBookPopup(missingList) {
    const overlay = $('#sg-book-popup-overlay');
    const body    = $('#sg-book-popup-body');
    if (!overlay || !body) return Promise.resolve();
    const listHtml = (missingList && missingList.length)
      ? `<br><br><b>Missing:</b><br>• ${missingList.map(escapeHtml).join('<br>• ')}`
      : '';
    body.innerHTML = `GPT reports missing reference data. Upload the missing book, then click "Confirm New Book" to continue.${listHtml}`;
    overlay.style.display = 'flex';
    return new Promise((resolve) => { pendingConfirm.newBook = resolve; });
  }
  function hideBookPopup() {
    const overlay = $('#sg-book-popup-overlay');
    if (overlay) overlay.style.display = 'none';
  }

  // ─────────────────────────────────────────────────────────────
  //  MASTER RULES (the v13 absolute-structure command)
  // ─────────────────────────────────────────────────────────────
  function buildMasterRules() {
    const cfg = {
      pages: examConfig.totalPages,
      words: examConfig.wordsPerPage,
      minL:  examConfig.minLinesPerPara,
      maxL:  examConfig.maxLinesPerPara,
    };
    const subjectRules = ''; // reserved for subject-specific extra rules (future)
    return `You are the StudyGuide AI — exam "${examConfig.examName}".

ABSOLUTE STRUCTURE FORMAT — USE EXACT SYMBOLS, ZERO EXCEPTIONS:
  #Domain-N: Domain Name       → ALWAYS start with # symbol. Written ONLY on FIRST page of domain. NEVER repeat.
  ##Subdomain-N.M: Name        → ALWAYS start with ## symbols. Written ONLY on FIRST page of subdomain. NEVER repeat.
  ###Specific Topic Heading    → ALWAYS start with ### symbols. Every topic heading on every page MUST begin with ###.

HEADING SYMBOL RULES — CRITICAL:
• NEVER write a domain name without # prefix
• NEVER write a subdomain name without ## prefix
• NEVER write a topic heading without ### prefix
• NEVER use bold (**text**) as a substitute for ### headings
• NEVER write headings as plain text without # symbols
• EVERY section heading = ### prefix. No exceptions. Ever.

CONTENT LAW — zero exceptions:
1. Source ONLY from uploaded reference books — zero general knowledge, zero training data
2. No author mentions, no student/reader references, no "this chapter/book/section" mentions
3. Write pure technical knowledge — define, explain, describe mechanisms directly
4. ~${cfg.words} words per page. Every paragraph: ${cfg.minL}–${cfg.maxL} lines
5. Tables → | col | col | markdown — ONLY when reference contains actual tables
6. Last line every page: SOURCE: Book Title | Chapter: name | Pages: range
7. NO MCQs, no exercises, no "test yourself" sections
8. If content not in any reference book → REFERENCE_NOT_FOUND: [topic]
${subjectRules}
Total pages: ${cfg.pages} | Words/page: ~${cfg.words} | Para lines: ${cfg.minL}–${cfg.maxL}
Do NOT generate anything yet. Reply ONLY: RULES ACKNOWLEDGED — READY FOR OUTLINE`;
  }

  // ─────────────────────────────────────────────────────────────
  //  MASTER ORCHESTRATOR — this is what "Start Generation" runs
  // ─────────────────────────────────────────────────────────────
  async function startGeneration() {
    if (currentState === STATE.RUNNING) return;

    // Guards
    if (!examConfig.examName)           { log('⚠ Set Exam Name first.', 'warn'); return; }
    if (!GM_getValue(STORAGE_KEYS.APPS_SCRIPT_URL, '') ||
        !GM_getValue(STORAGE_KEYS.DOC_ID, ''))
                                        { log('⚠ Save Apps Script URL + Doc ID first.', 'warn'); return; }
    if (!isOnGPT())                     { log('⚠ Open chatgpt.com — the orchestrator drives ChatGPT.', 'warn'); return; }

    abortFlag = false;
    pauseFlag = false;
    skipFlag  = false;
    subjectRulesAcknowledged = false;

    setUIState(STATE.RUNNING);
    log(`▶ Starting full generation pipeline for "${examConfig.examName}"...`, 'info');

    try {
      // 1) Inject master rules, wait for acknowledgement
      log('📜 Injecting master rules into GPT...', 'info');
      const ackResp = await sendToGPT(buildMasterRules());
      if (!/RULES\s+ACKNOWLEDGED/i.test(ackResp)) {
        log('⚠ GPT did not acknowledge rules verbatim, continuing anyway.', 'warn');
      } else {
        log('✔ GPT acknowledged rules.', 'ok');
      }
      subjectRulesAcknowledged = true;

      // 2) Ask user to upload outline
      showStepNotify('Upload Exam Outline', 'Open ChatGPT + button, upload the outline PDF, then click "✓ Confirm Outline" in the Workflow section.');
      notify('Upload exam outline to ChatGPT now.');
      log('⏸ Waiting for outline upload + confirmation...', 'warn');
      await waitForConfirm('outline');
      if (abortFlag) throw new Error('Aborted');

      // 3) Ask GPT to confirm outline + emit domain mapping in strict format
      log('🗺 Requesting strict domain + subdomain mapping...', 'info');
      const mappingPrompt = `Step 1: Confirm you have read the outline I just uploaded. Start your reply with exactly:
OUTLINE_CONFIRMED

Step 2: On new lines output the OFFICIAL domain + subdomain mapping with official exam weights.
Use this EXACT format — no extra text, no commentary, no intro, no outro:

Domain-1:<domain name>
Subdomain-1.1:<subdomain name>    <weight%>
Subdomain-1.2:<subdomain name>    <weight%>
Domain-2:<domain name>
Subdomain-2.1:<subdomain name>    <weight%>
...

Rules:
- Zero extra text.
- Weights MUST sum to 100 overall.
- Use official exam weights from the outline I uploaded.
- Four spaces between subdomain name and its weight percent.`;

      const mappingResp = await sendToGPT(mappingPrompt);
      if (!/OUTLINE_CONFIRMED/i.test(mappingResp)) {
        log('⚠ GPT did not confirm outline. Continuing with parse attempt.', 'warn');
      }
      const parsed = parseDomainMapping(mappingResp);
      if (!parsed.domains.length) {
        throw new Error('Could not parse any domains from GPT mapping response.');
      }
      domains = parsed.domains; // [{name, weight, subdomains:[{name,weight}]}]
      saveObj(STORAGE_KEYS.DOMAINS, domains);
      renderDomains();
      log(`✔ Parsed ${domains.length} domain(s), ${parsed.totalSub} subdomain(s).`, 'ok');

      // 4) Upload sample questions
      showStepNotify('Upload Sample Questions', 'Upload sample-question PDFs to ChatGPT, then click "✓ Confirm Samples".');
      notify('Upload sample-question PDFs to ChatGPT now.');
      log('⏸ Waiting for sample questions upload + confirmation...', 'warn');
      await waitForConfirm('samples');
      if (abortFlag) throw new Error('Aborted');

      // 4a) Confirm samples + run mapping
      log('🧩 Confirming samples + detecting sample mapping...', 'info');
      await sendToGPT(`Confirm you have read the uploaded sample questions. Reply exactly:
SAMPLES_CONFIRMED

Then STOP — do not output anything else.`);
      await autoDetectSampleMapping();

      // 5) Upload reference books
      showStepNotify('Upload Reference Books', 'Upload ALL reference book PDFs to ChatGPT, then click "✓ Confirm Books".');
      notify('Upload reference books to ChatGPT now.');
      log('⏸ Waiting for reference-book upload + confirmation...', 'warn');
      await waitForConfirm('books');
      if (abortFlag) throw new Error('Aborted');

      // 6) Send list of uploaded books + verify coverage
      log('📚 Asking GPT to list uploaded books and verify coverage...', 'info');
      let verifyOK = false;
      let verifyTries = 0;
      while (!verifyOK && !abortFlag) {
        verifyTries++;
        const verifyResp = await sendToGPT(`List every reference book you currently have access to (title + author if possible).
Then cross-check EVERY domain and subdomain from the mapping above and say for each whether the reference data is:
  COMPLETE | PARTIAL | MISSING

Return STRICT JSON only:
{
  "books": ["Book 1", "Book 2"],
  "coverage": [
    {"domain": "Domain-1", "subdomain": "Subdomain-1.1", "status": "COMPLETE|PARTIAL|MISSING", "notes": ""}
  ],
  "missing_any": true|false
}`);
        const verifyData = extractJSON(verifyResp);
        const missing = (verifyData.coverage || []).filter(c => (c.status || '').toUpperCase() === 'MISSING');
        if (verifyData.missing_any === false || !missing.length) {
          log(`✔ Coverage verified on attempt ${verifyTries}.`, 'ok');
          verifyOK = true;
        } else {
          log(`⚠ ${missing.length} missing coverage item(s). Prompting for new book.`, 'warn');
          showStepNotify('Missing Reference Data', `GPT reports ${missing.length} missing areas. Upload the missing book.`);
          const list = missing.map(m => `${m.domain} / ${m.subdomain}${m.notes ? ' — ' + m.notes : ''}`);
          await showBookPopup(list);
          hideBookPopup();
          if (abortFlag) throw new Error('Aborted');
          // After user uploads, tell GPT to ingest
          await sendToGPT(`A new reference book has been uploaded. Read it fully.
Then re-check only the previously MISSING items. Reply STRICT JSON:
{
  "still_missing": [ {"domain":"","subdomain":"","notes":""} ]
}`);
        }
      }

      // 7) Per-domain generation
      for (let di = 0; di < domains.length; di++) {
        if (abortFlag) break;
        const d = domains[di];
        const domainNum = di + 1;
        log(`🎯 ===== DOMAIN ${domainNum}: ${d.name} =====`, 'info');

        // Overview (2 pages × ~500 words)
        await generateOverview(d, domainNum);
        // Purpose (1 page × ~600 words)
        await generatePurposePage(d, domainNum);
        // Subdomain purpose table
        await generateSubdomainTable(d, domainNum);
        // Memory check table
        await generateMemoryTable(d, domainNum);

        // Subdomain by subdomain content + images
        const subs = d.subdomains || [];
        for (let si = 0; si < subs.length; si++) {
          if (abortFlag) break;
          const sub = subs[si];
          const subNum = si + 1;
          log(`📘 Subdomain ${domainNum}.${subNum}: ${sub.name}`, 'info');
          await generateSubdomainContent(d, domainNum, sub, subNum, si === 0);
        }

        if (abortFlag) break;

        // Practice questions for this domain
        await generatePracticeQuestionsForDomain(d, domainNum);
      }

      if (!abortFlag) {
        setUIState(STATE.IDLE);
        log('🎉 Full generation pipeline complete!', 'ok');
        notify('StudyGuide generation complete!');
      }
    } catch (err) {
      setUIState(STATE.ERROR);
      log(`✗ Orchestrator error: ${err.message}`, 'error');
    }
  }

  // ─────────────────────────────────────────────────────────────
  //  DOMAIN-MAPPING PARSER (strict format)
  // ─────────────────────────────────────────────────────────────
  function parseDomainMapping(text) {
    const out = { domains: [], totalSub: 0 };
    const lines = text.split(/\r?\n/);
    let currentDomain = null;
    for (const raw of lines) {
      const line = raw.trim();
      if (!line) continue;
      const dMatch = line.match(/^Domain-(\d+)\s*:\s*(.+)$/i);
      const sMatch = line.match(/^Subdomain-(\d+)\.(\d+)\s*:\s*(.+?)(?:\s{2,}|\t+)(\d+(?:\.\d+)?)\s*%?$/i)
                  || line.match(/^Subdomain-(\d+)\.(\d+)\s*:\s*(.+?)\s+(\d+(?:\.\d+)?)\s*%?$/i);
      if (dMatch) {
        currentDomain = { name: dMatch[2].trim(), weight: 0, subdomains: [] };
        out.domains.push(currentDomain);
      } else if (sMatch && currentDomain) {
        const subName = sMatch[3].trim();
        const weight  = parseFloat(sMatch[4]) || 0;
        currentDomain.subdomains.push({ name: subName, weight });
        currentDomain.weight += weight;
        out.totalSub++;
      } else if (/^Subdomain-/i.test(line) && currentDomain) {
        // no weight specified
        const bare = line.match(/^Subdomain-\d+\.\d+\s*:\s*(.+)$/i);
        if (bare) {
          currentDomain.subdomains.push({ name: bare[1].trim(), weight: 0 });
          out.totalSub++;
        }
      }
    }
    return out;
  }

  // ─────────────────────────────────────────────────────────────
  //  CONTENT GENERATORS
  // ─────────────────────────────────────────────────────────────
  async function generateOverview(domain, domainNum) {
    log(`📖 Overview for ${domain.name} (2 pages × 500 words)...`, 'info');
    for (let p = 1; p <= 2; p++) {
      if (abortFlag) return;
      const headingBlock = (p === 1)
        ? `#Domain-${domainNum}:${domain.name}
${(domain.subdomains || []).map((s, i) => `##Subdomain-${domainNum}.${i+1}:${s.name}`).join('\n')}

`
        : '';
      const prompt = `Overview page ${p} of 2 for Domain-${domainNum}: "${domain.name}".

Rules:
- Target exactly ~500 words.
- Paragraphs: ${examConfig.minLinesPerPara}–${examConfig.maxLinesPerPara} lines each, with a clear example inside each paragraph.
- Use ### headings only for sub-topics.
- No bold substitutes for headings.
- Reference-book sourced only.
${p === 1
  ? `- BEGIN the response with exactly this block (first page of domain):\n${headingBlock}`
  : `- Continue the overview. Do NOT repeat #Domain / ##Subdomain headings.`}

Reply with the page content only.`;
      await runAndPostPage({
        promptText: prompt,
        label:      `overview_d${domainNum}_p${p}`,
        allowImages:true,
      });
    }
  }

  async function generatePurposePage(domain, domainNum) {
    log(`🎯 Main-purpose page for ${domain.name} (~600 words)...`, 'info');
    const prompt = `Main purpose page for Domain-${domainNum}: "${domain.name}".
- Target ~600 words on this single page.
- Paragraphs: ${examConfig.minLinesPerPara}–${examConfig.maxLinesPerPara} lines, each with an example.
- Use only ### headings (no #, no ##).
- Reference-book sourced only.
Reply with the page content only.`;
    await runAndPostPage({
      promptText: prompt,
      label:      `purpose_d${domainNum}`,
      allowImages:true,
    });
  }

  async function generateSubdomainTable(domain, domainNum) {
    log(`📊 Subdomain purpose table for ${domain.name}...`, 'info');
    const prompt = `Produce a single markdown table titled "###Subdomain Purpose Table" for Domain-${domainNum}: "${domain.name}".
Columns: | # | Subdomain | Purpose |
Include every subdomain of this domain (${(domain.subdomains || []).map(s => s.name).join(' | ')}).
Purpose column: 1–2 sentences, reference-book sourced only.
Return the markdown only.`;
    await runAndPostPage({
      promptText: prompt,
      label:      `subtable_d${domainNum}`,
      allowImages:false,
    });
  }

  async function generateMemoryTable(domain, domainNum) {
    log(`🧠 Memory-check table for ${domain.name}...`, 'info');
    const prompt = `Produce a single markdown table titled "###Memory Check" for Domain-${domainNum}: "${domain.name}".
Columns: | Term / Shortcut | 1-line definition |
Include 8–15 of the most important shortcuts / key terms / mnemonics from this domain,
one per row, each with a single-line definition from the reference books only.
Return the markdown only.`;
    await runAndPostPage({
      promptText: prompt,
      label:      `memtable_d${domainNum}`,
      allowImages:false,
    });
  }

  async function generateSubdomainContent(domain, domainNum, sub, subNum, isFirstSubOfDomain) {
    const pagesForSub = Math.max(1, Math.round(((sub.weight || 0) / 100) * examConfig.totalPages));
    log(`📄 Generating ${pagesForSub} page(s) for Subdomain-${domainNum}.${subNum}: ${sub.name}`, 'info');

    for (let p = 1; p <= pagesForSub; p++) {
      if (abortFlag) return;
      const headingBlock = (p === 1)
        ? `${isFirstSubOfDomain ? `#Domain-${domainNum}:${domain.name}\n` : ''}##Subdomain-${domainNum}.${subNum}:${sub.name}\n\n`
        : '';
      const prompt = `Content page ${p}/${pagesForSub} for Subdomain-${domainNum}.${subNum}: "${sub.name}" (of Domain-${domainNum}: "${domain.name}").

- Target ~${examConfig.wordsPerPage} words.
- Paragraphs: ${examConfig.minLinesPerPara}–${examConfig.maxLinesPerPara} lines, each with a concrete example that fully conveys the concept to a student.
- Use only ### headings for specific topics — NO generic names, NO repeats, NO bold substitutes.
${p === 1
  ? `- BEGIN the response with exactly this heading block:\n${headingBlock}`
  : `- Continue. Do NOT repeat # or ## headings.`}
- Reference-book sourced only.
Reply with the page content only.`;
      await runAndPostPage({
        promptText: prompt,
        label:      `d${domainNum}_s${subNum}_p${p}`,
        allowImages:true,
      });
    }
  }

  // ─────────────────────────────────────────────────────────────
  //  PAGE RUNNER (send prompt, post, images, stats)
  // ─────────────────────────────────────────────────────────────
  async function runAndPostPage({ promptText, label, allowImages }) {
    // Pause / abort support
    while (pauseFlag) { await sleep(400); if (abortFlag) return; }
    if (abortFlag) return;

    progress.currentPage++;
    updateProgressUI();

    // Reference reminder every N pages
    if (refConfig.reminderEveryPages > 0 &&
        progress.done > 0 &&
        (progress.done % refConfig.reminderEveryPages === 0)) {
      await sendReferenceReminder();
    }

    try {
      const raw = await sendToGPT(promptText);

      if (refConfig.autoStopOnMissing && detectMissingReference(raw)) {
        log(`⚠ Missing reference for ${label}. Showing popup.`, 'warn');
        showPopup('⚠ Missing Reference',
          `GPT could not find required content for ${label}. Upload the missing reference or skip this page.`);
        setUIState(STATE.PAUSED);
        while (pauseFlag || currentState === STATE.PAUSED) {
          await sleep(400);
          if (abortFlag || skipFlag) break;
        }
        hidePopup();
        if (skipFlag) { skipFlag = false; progress.skipped++; updateProgressUI(); return; }
        if (abortFlag) return;
        setUIState(STATE.RUNNING);
      }

      let text = raw;
      if (refConfig.validateQuality && !validateQuality(text)) {
        log(`↺ Quality failed for ${label} — retrying once.`, 'warn');
        progress.retries++;
        updateProgressUI();
        text = await sendToGPT(promptText + '\n\nRewrite the page — previous response failed quality rules.');
      }
      if (refConfig.stripSourceMentions) text = stripSourceMentions(text);

      const wordCount = countWords(text);

      // Ask GPT whether this page needs images
      let images = [];
      if (allowImages && imageConfig.enableGemini) {
        images = await maybeGenerateImagesForPage(text, label);
      }

      await postPageToDoc({ page: progress.currentPage, text, images, wordCount, label });
      progress.done++;
      progress.words += wordCount;
      if (images.length) progress.images += images.length;
      pushRecent(progress.currentPage, 'ok', `${label} · ${wordCount}w · ${images.length}🖼`);
      log(`✔ ${label} done (${wordCount}w, ${images.length} img).`, 'ok');
    } catch (err) {
      progress.failed++;
      pushRecent(progress.currentPage, 'fail', `${label}: ${err.message}`);
      log(`✗ ${label} failed: ${err.message}`, 'error');
    }
    saveObj(STORAGE_KEYS.PROGRESS, progress);
    updateProgressUI();
    await sleep(600);
  }

  // ─────────────────────────────────────────────────────────────
  //  IMAGE CHECK — ask GPT if page needs images + detail prompts
  // ─────────────────────────────────────────────────────────────
  async function maybeGenerateImagesForPage(pageText, label) {
    try {
      const checkResp = await sendToGPT(`Analyse the page you just wrote for "${label}".
Reply STRICT JSON only:
{
  "needs_image": true|false,
  "prompts": [
    {"title": "short title", "prompt": "one paragraph extremely detailed image generation prompt, textbook quality, labels, no watermarks"}
  ]
}
Rules: Include an image prompt ONLY if the page truly requires a diagram / chart / anatomical figure / chemical structure / circuit diagram to be understood. Otherwise return needs_image:false with prompts:[].`);
      const data = extractJSON(checkResp);
      if (!data || !data.needs_image || !Array.isArray(data.prompts) || !data.prompts.length) {
        return [];
      }
      log(`🖼 GPT requests ${data.prompts.length} image(s) for ${label}. Opening Gemini...`, 'img');

      const results = [];
      for (const p of data.prompts) {
        if (abortFlag) break;
        try {
          const img = await runGeminiPrompt(p.prompt, `${label}_${sanitizeLabel(p.title || 'img')}`);
          if (img) results.push({ label: p.title || label, dataUrl: img });
        } catch (err) {
          log(`⚠ Gemini image "${p.title}" failed: ${err.message}`, 'warn');
        }
      }
      return results;
    } catch (err) {
      log(`⚠ Image-check failed: ${err.message}`, 'warn');
      return [];
    }
  }

  function sanitizeLabel(s) {
    return String(s).replace(/[^a-z0-9_]+/gi, '_').slice(0, 40);
  }

  // ─────────────────────────────────────────────────────────────
  //  PRACTICE QUESTIONS
  // ─────────────────────────────────────────────────────────────
  async function generatePracticeQuestions() {
    if (!examConfig.examName) { log('⚠ Set Exam Name first.', 'warn'); return; }
    if (!domains || !domains.length) { log('⚠ No domains yet — run Start Generation first.', 'warn'); return; }
    if (!isOnGPT()) { log('⚠ Open chatgpt.com to generate practice questions.', 'warn'); return; }
    log(`🎓 Generating practice questions for ${domains.length} domain(s)...`, 'info');
    for (let i = 0; i < domains.length; i++) {
      if (abortFlag) break;
      await generatePracticeQuestionsForDomain(domains[i], i + 1);
    }
    log('✔ Practice-question generation complete.', 'ok');
  }

  async function generatePracticeQuestionsForDomain(domain, domainNum) {
    const subCount   = (domain.subdomains || []).length;
    const perSubRule = 10;                                  // 10 per subdomain baseline
    const totalFromUI = practiceConfig.totalQuestions || 0;
    // Distribute the UI total proportionally to domain weight if > 0, otherwise use perSubRule * subCount
    let qForDomain;
    if (totalFromUI > 0) {
      const totalWeight = domains.reduce((s, d) => s + (d.weight || 0), 0) || 100;
      qForDomain = Math.round((domain.weight / totalWeight) * totalFromUI);
    } else {
      qForDomain = perSubRule * subCount;
    }
    if (qForDomain <= 0) qForDomain = perSubRule * subCount;

    const typeBreakdown = buildTypeBreakdown(qForDomain);
    log(`🎓 Domain ${domainNum} — generating ${qForDomain} practice question(s): ${JSON.stringify(typeBreakdown)}`, 'info');

    const batch = practiceConfig.perBatch || 10;
    let produced = 0;
    let batchIdx = 0;
    while (produced < qForDomain && !abortFlag) {
      const remaining = qForDomain - produced;
      const thisBatch = Math.min(batch, remaining);
      batchIdx++;
      const prompt = `Generate ${thisBatch} practice question(s) for Domain-${domainNum}: "${domain.name}" using ONLY the reference books.

Distribution across the FULL domain target (${qForDomain} total Qs): ${JSON.stringify(typeBreakdown)}.
Options per MCQ: ${Math.max(2, parseInt(sampleMapping.optionsCount?.weight || 4, 10))}.
Typical statement length (words): ${parseInt(sampleMapping.statementsLength?.weight || 25, 10)}.
Explanation length: ${practiceConfig.explMinLength}–${practiceConfig.explMaxLength} words.

Return STRICT JSON only:
{
  "questions": [
    {
      "id": 0,
      "domain": "${domain.name}",
      "subdomain": "",
      "type": "scenario|definition|recall|application|fill_in_blank|chart_based",
      "statement": "",
      "options": {"A":"","B":"","C":"","D":""},
      "correct_answer": "A",
      "explanation": "",
      "reference_topic": ""
    }
  ]
}
Rules:
- Respect distribution across the WHOLE domain run (across batches).
- Reference-book sourced only. No fabrication.
- Spread questions evenly across the ${subCount} subdomain(s).`;

      try {
        const raw = await sendToGPT(prompt);
        const data = extractJSON(raw);
        const arr = Array.isArray(data.questions) ? data.questions : [];
        if (!arr.length) throw new Error('No questions parsed');

        await postQuestionsToDoc({
          domain:    domain.name,
          domainNum,
          batchIdx,
          questions: arr,
        });
        produced += arr.length;
        progress.questions = (progress.questions || 0) + arr.length;
        saveObj(STORAGE_KEYS.PROGRESS, progress);
        updateProgressUI();
        log(`✔ Practice batch ${batchIdx} → ${arr.length} Q (total ${produced}/${qForDomain}).`, 'ok');
      } catch (err) {
        log(`✗ Practice batch ${batchIdx} failed: ${err.message}`, 'error');
        break;
      }
      await sleep(500);
    }
  }

  function buildTypeBreakdown(totalQ) {
    // Use sample-mapping % fields as the split; fallback to equal split.
    const pctFields = ['scenarioBased','definitionType','recallStatement','applicationBased','fillInTheBlanks','chartsGraphsImg'];
    const weights = {};
    let sum = 0;
    pctFields.forEach(k => {
      const w = parseFloat(sampleMapping[k]?.weight) || 0;
      weights[k] = w;
      sum += w;
    });
    const breakdown = {};
    if (sum > 0) {
      pctFields.forEach(k => {
        breakdown[k] = Math.round((weights[k] / sum) * totalQ);
      });
    } else {
      const base = Math.floor(totalQ / pctFields.length);
      pctFields.forEach((k, i) => { breakdown[k] = base + (i === 0 ? totalQ - base * pctFields.length : 0); });
    }
    return breakdown;
  }

  async function postQuestionsToDoc(args) {
    return DOCS.postQuestions(args);
  }

  function pauseGeneration() {
    pauseFlag = true;
    setUIState(STATE.PAUSED);
    log('⏸ Paused.', 'warn');
  }

  function resumeGeneration() {
    pauseFlag = false;
    setUIState(STATE.RUNNING);
    log('▶ Resumed.', 'info');
  }

  function stopGeneration() {
    abortFlag = true;
    pauseFlag = false;
    setUIState(STATE.STOPPED);
    log('⏹ Stopped.', 'warn');
  }

  function retryPage() {
    abortFlag = false;
    pauseFlag = false;
    progress.retries++;
    saveObj(STORAGE_KEYS.PROGRESS, progress);
    updateProgressUI();
    log(`↺ Retrying page ${progress.currentPage}...`, 'info');
    // The running loop will re-enter; if not running, start fresh from current page.
    if (currentState !== STATE.RUNNING) startGeneration();
  }

  function skipPage() {
    skipFlag = true;
    pauseFlag = false;
    progress.skipped++;
    pushRecent(progress.currentPage, 'skip', 'skipped by user');
    saveObj(STORAGE_KEYS.PROGRESS, progress);
    updateProgressUI();
    log(`⏭ Skipped page ${progress.currentPage}.`, 'warn');
    if (currentState === STATE.PAUSED) setUIState(STATE.RUNNING);
  }

  function resetEverything() {
    if (!confirm('Reset ALL progress and saved data? This cannot be undone.')) return;
    abortFlag = true;
    pauseFlag = false;
    progress = { ...DEFAULT_PROGRESS };
    workflow = { ...DEFAULT_WORKFLOW };
    domains  = [];
    saveObj(STORAGE_KEYS.PROGRESS, progress);
    saveObj(STORAGE_KEYS.WORKFLOW, workflow);
    saveObj(STORAGE_KEYS.DOMAINS,  domains);
    applyWorkflowUI();
    renderDomains();
    updateProgressUI();
    $('#sg-console').innerHTML = '';
    setUIState(STATE.IDLE);
    log('🗑 Reset complete.', 'warn');
  }

  // ─────────────────────────────────────────────────────────────
  //  GPT: PAGE TEXT GENERATION
  // ─────────────────────────────────────────────────────────────
  async function generatePageText(pageNum) {
    const headingRule = (pageNum === examConfig.startFromPage)
      ? 'Include domain (#) and subdomain (##) headings on this FIRST page only.'
      : 'Do NOT repeat domain/subdomain headings. Use only specific ###topic headings.';

    const prompt = `You are generating page ${pageNum} of ${examConfig.totalPages} for the study guide of "${examConfig.examName}".

STRICT v13 RULES (enforce all):
- Use REFERENCE BOOKS ONLY. Zero training data. Zero fabrication.
- If reference content is missing, output exactly: "MISSING_REFERENCE: <topic>".
- ${headingRule}
- Use ONLY specific ###topic headings — no generic names like "Introduction".
- Each paragraph: ${examConfig.minLinesPerPara}–${examConfig.maxLinesPerPara} lines.
- Target ~${examConfig.wordsPerPage} words for this page.
- Math/Physics: include REAL equations (not placeholders).
- Chemistry: balanced reactions with state symbols (s, l, g, aq).
- Code blocks: complete runnable examples with expected output.
- Do NOT include source citations inline — just content.

Produce the page now. Return plain text (markdown allowed).`;

    return await sendToGPT(prompt);
  }

  async function sendReferenceReminder() {
    if (!isOnGPT()) return;
    log('🔒 Re-sending v13 reference rules...', 'sys');
    const reminder = `REFERENCE REMINDER (v13): Continue using REFERENCE BOOKS ONLY. No training data.
- Specific ###topic headings only (no generic names).
- Math/Chemistry/Code must be real, balanced, and runnable.
- If reference missing, output "MISSING_REFERENCE: <topic>".
Acknowledge with "OK" and continue.`;
    try {
      await sendToGPT(reminder);
    } catch (err) {
      log(`⚠ Reminder failed: ${err.message}`, 'warn');
    }
  }

  // ─────────────────────────────────────────────────────────────
  //  GEMINI: IMAGE GENERATION (new tab per batch)
  // ─────────────────────────────────────────────────────────────
  function shouldGenerateImages(text) {
    const s = text.toLowerCase();
    const hasEquation = imageConfig.equationsAsImages && /\$\$|\\\[|\\begin\{|=\s*[-+]?\d/.test(text);
    const hasChart    = imageConfig.generateCharts    && /(chart|graph|curve|bar\s+graph|supply|demand)/.test(s);
    const hasDiagram  = imageConfig.generateDiagrams  && /(diagram|flowchart|anatomy|network|process\s+flow|circuit|structure)/.test(s);
    return hasEquation || hasChart || hasDiagram;
  }

  async function generateGeminiImagesForPage(pageText, pageNum) {
    // Build image prompts from page text
    const imgPrompts = buildImagePrompts(pageText, pageNum);
    if (!imgPrompts.length) return [];

    const results = [];
    for (const p of imgPrompts) {
      if (abortFlag) break;
      try {
        const img = await runGeminiPrompt(p.prompt, p.label);
        if (img) results.push({ label: p.label, dataUrl: img });
      } catch (err) {
        log(`⚠ Gemini image "${p.label}" failed: ${err.message}`, 'warn');
      }
    }
    return results;
  }

  function buildImagePrompts(pageText, pageNum) {
    const prompts = [];
    const headings = (pageText.match(/###\s+([^\n]+)/g) || []).slice(0, 3);

    headings.forEach((h, i) => {
      const topic = h.replace(/^###\s+/, '').trim();
      if (imageConfig.equationsAsImages && /\$\$|\\\[|\\begin\{/.test(pageText)) {
        prompts.push({
          label: `eq_${pageNum}_${i+1}`,
          prompt: `Create a clean, high-resolution equation diagram for the topic "${topic}".
Include real equations (LaTeX rendered). No text watermarks. White background. Educational style.`,
        });
      }
      if (imageConfig.generateCharts && /(chart|graph|curve)/i.test(pageText)) {
        prompts.push({
          label: `chart_${pageNum}_${i+1}`,
          prompt: `Create a professional chart/graph illustrating "${topic}" for ${examConfig.examName}.
Labeled axes, legend, clean colors, educational textbook style.`,
        });
      }
      if (imageConfig.generateDiagrams && /(diagram|anatomy|network|flow|circuit|structure)/i.test(pageText)) {
        prompts.push({
          label: `diag_${pageNum}_${i+1}`,
          prompt: `Create a clear educational diagram for "${topic}" ( ${examConfig.examName} ).
Label every part. Textbook quality. No watermarks.`,
        });
      }
    });

    return prompts;
  }

  async function runGeminiPrompt(prompt, label) {
    // If we're already on gemini.google.com, run inline. Else open a new tab with a flag in storage.
    if (window.location.hostname.includes('gemini.google.com')) {
      return await sendToGeminiAndCapture(prompt);
    }
    // Cross-tab: open Gemini in a new tab with an instruction stored
    log(`🌐 Opening Gemini in new tab for "${label}" — ensure you are logged in.`, 'img');
    GM_setValue(`${APP_ID}_pendingGeminiPrompt`, { prompt, label, ts: Date.now() });
    GM_openInTab(GEMINI_URL, { active: false, insert: true });
    // Poll storage for result (captured by the Gemini-side userscript instance)
    const timeoutMs = imageConfig.maxWaitGeminiSec * 1000;
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      if (abortFlag) return null;
      const result = GM_getValue(`${APP_ID}_geminiResult_${label}`, null);
      if (result) {
        GM_setValue(`${APP_ID}_geminiResult_${label}`, null);
        return result;
      }
      await sleep(1500);
    }
    throw new Error('Gemini cross-tab timeout');
  }

  async function sendToGeminiAndCapture(prompt) {
    const textarea = await waitForElement(
      'rich-textarea .ql-editor, textarea[aria-label]',
      15000
    );
    if (!textarea) throw new Error('Gemini input not found');

    textarea.focus();
    document.execCommand('selectAll', false, null);
    document.execCommand('insertText', false, prompt);
    await sleep(400);

    const sendBtn = await waitForElement(
      'button[aria-label*="Send"], button.send-button',
      5000
    );
    if (sendBtn) (sendBtn.closest('button') || sendBtn).click();
    else textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

    const timeoutMs = imageConfig.maxWaitGeminiSec * 1000;
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      if (abortFlag) return null;
      await sleep(1500);
      const img = document.querySelector(
        'img[alt*="Generated"], img[data-generated], .model-response-text img, message-content img'
      );
      if (img && img.src && img.complete && img.naturalWidth > 50) {
        return await urlToDataUrl(img.src);
      }
    }
    throw new Error('Gemini image timeout');
  }

  async function urlToDataUrl(url) {
    try {
      const resp = await fetch(url);
      const blob = await resp.blob();
      return await new Promise((res) => {
        const r = new FileReader();
        r.onloadend = () => res(r.result);
        r.readAsDataURL(blob);
      });
    } catch {
      return url;
    }
  }

  // ─────────────────────────────────────────────────────────────
  //  GPT DOM INTERACTION
  // ─────────────────────────────────────────────────────────────
  function isOnGPT() {
    const h = window.location.hostname;
    return h.includes('chatgpt') || h.includes('openai');
  }

  // ChatGPT interaction layer — hardened (multi-strategy injection, streaming-aware wait, upload helper)
  const GPT = {
    getInput() {
      return document.getElementById('prompt-textarea')
          || document.querySelector('.ProseMirror[contenteditable="true"]')
          || document.querySelector('[contenteditable="true"][role="textbox"]')
          || document.querySelector('textarea[data-id="root"]')
          || document.querySelector('textarea[placeholder]');
    },
    getSend() {
      return document.querySelector('[data-testid="send-button"]')
          || document.querySelector('button[aria-label*="Send" i]')
          || document.querySelector('button[aria-label="Send prompt"]');
    },
    getStop() {
      return document.querySelector('[data-testid="stop-button"]')
          || document.querySelector('button[aria-label*="Stop" i]');
    },
    isStreaming() {
      if (this.getStop()) return true;
      if (document.querySelector('[class*="result-streaming"]')) return true;
      return false;
    },
    countMsgs() {
      return document.querySelectorAll('[data-message-author-role="assistant"]').length;
    },
    getLatest() {
      const msgs = document.querySelectorAll('[data-message-author-role="assistant"]');
      if (!msgs.length) return '';
      const last = msgs[msgs.length - 1];
      const sels = ['.markdown.prose', '.markdown', '.prose', '[class*="markdown"]', '[class*="prose"]', '.whitespace-pre-wrap'];
      for (const s of sels) {
        const el = last.querySelector(s);
        if (el && (el.textContent || '').trim().length > 5) return el.textContent.trim();
      }
      return (last.textContent || '').trim();
    },

    async injectText(text) {
      let el = this.getInput();
      if (!el) { await sleep(800); el = this.getInput(); }
      if (!el) { log('ChatGPT textarea not found.', 'error'); return false; }

      try { el.focus(); await sleep(40); el.innerHTML = ''; el.dispatchEvent(new Event('input', { bubbles: true })); await sleep(60); } catch (_) {}

      // Strategy 1: execCommand insertText (works for ProseMirror)
      try {
        el.focus();
        document.execCommand('selectAll', false, null);
        document.execCommand('delete', false, null);
        await sleep(30);
        document.execCommand('insertText', false, text);
        await sleep(150);
        if ((el.textContent || el.value || '').trim().length > 20) return true;
      } catch (_) {}

      // Strategy 2: native value setter (HTMLTextArea)
      try {
        const ns = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value');
        if (ns && el.tagName === 'TEXTAREA') {
          ns.set.call(el, text);
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
          await sleep(150);
          if ((el.value || '').trim().length > 20) return true;
        }
      } catch (_) {}

      // Strategy 3: React fiber onChange
      try {
        const fk = Object.keys(el).find(k => k.startsWith('__reactFiber') || k.startsWith('__reactInternalInstance'));
        if (fk) {
          let node = el[fk];
          while (node) {
            if (node.memoizedProps && node.memoizedProps.onChange) {
              node.memoizedProps.onChange({ target: { value: text } });
              break;
            }
            node = node.return;
          }
          await sleep(200);
          if ((el.textContent || el.value || '').trim().length > 20) return true;
        }
      } catch (_) {}

      // Strategy 4: synthetic paste event
      try {
        const dt = new DataTransfer();
        dt.setData('text/plain', text);
        el.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: dt }));
        await sleep(250);
        if ((el.textContent || el.value || '').trim().length > 20) return true;
      } catch (_) {}

      // Strategy 5: direct textContent + InputEvent
      try {
        el.focus();
        el.textContent = text;
        el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
        await sleep(300);
        return true;
      } catch (e) {
        log('All inject methods failed: ' + e.message, 'error');
        return false;
      }
    },

    async clickSend() {
      for (let i = 0; i < 30; i++) {
        const btn = this.getSend();
        if (btn && !btn.disabled) { btn.click(); return true; }
        await sleep(100);
      }
      return false;
    },

    async send(text) {
      const el = this.getInput();
      if (el) {
        try { el.innerHTML = ''; el.dispatchEvent(new Event('input', { bubbles: true })); } catch (_) {}
        await sleep(50);
      }
      const ok = await this.injectText(text);
      if (!ok) throw new Error('Text injection failed');
      await sleep(150);
      const sent = await this.clickSend();
      if (!sent) throw new Error('Send button failed');
      await sleep(200);
    },

    // Streaming-aware wait: waits for stop button to disappear + text to stabilize
    waitForDone(timeoutMs) {
      const timeout = timeoutMs || 300000;
      return new Promise((resolve, reject) => {
        const start = Date.now();
        const initCount = this.countMsgs();
        let lastLen = 0, lastText = '', stable = 0, started = false, stoppedAt = 0;
        const POLL_MS = 300, STOP_GRACE = 400, STABLE_NEED = 2;
        const t = setInterval(() => {
          if (abortFlag) { clearInterval(t); reject(new Error('Aborted')); return; }
          if (pauseFlag) return;
          if (Date.now() - start > timeout) {
            clearInterval(t);
            reject(new Error(`GPT response timeout after ${Math.round(timeout / 1000)}s`));
            return;
          }
          const streaming = this.isStreaming();
          const count = this.countMsgs();
          const text = this.getLatest();
          const len = text.length;
          if (!started) {
            if (streaming || count > initCount) { started = true; lastLen = len; lastText = text; }
            lastLen = len;
            return;
          }
          if (streaming) { stable = 0; stoppedAt = 0; lastLen = len; lastText = text; return; }
          if (stoppedAt === 0 && len > 0) { stoppedAt = Date.now(); lastLen = len; lastText = text; }
          if (stoppedAt > 0 && Date.now() - stoppedAt < STOP_GRACE) return;
          if (len > 0 && len === lastLen && text === lastText) {
            stable++;
            if (stable >= STABLE_NEED) { clearInterval(t); resolve(text); }
          } else { stable = 0; lastLen = len; lastText = text; }
        }, POLL_MS);
      });
    },

    // Trigger the ChatGPT attachment upload dialog
    triggerUpload() {
      // Step 1: direct file input
      const directFi = document.querySelector('input[type="file"]');
      if (directFi) { directFi.click(); return; }

      // Step 2: find the + / attach / paperclip button
      const plusSelectors = [
        '[data-testid="composer-plus-btn"]',
        '[data-testid="composer-attach-btn"]',
        '[data-testid="attachments-menu-button"]',
        'button[aria-label*="attach" i]',
        'button[aria-label*="upload" i]',
        'button[aria-label*="add" i]',
        'button[aria-label*="file" i]',
        'button[aria-label*="paperclip" i]',
        'button[aria-label*="plus" i]',
        'form button svg[data-icon="paperclip"]',
        'form button svg[data-icon="plus"]',
      ];
      let plusBtn = null;
      for (const sel of plusSelectors) {
        const el = document.querySelector(sel);
        if (el) { plusBtn = el.closest('button') || el; break; }
      }
      if (!plusBtn) {
        const composerArea = document.querySelector('form,#prompt-textarea,div[contenteditable]')?.closest('div');
        if (composerArea) {
          for (const btn of composerArea.querySelectorAll('button')) {
            const lbl = (btn.getAttribute('aria-label') || btn.title || btn.textContent || '').toLowerCase();
            if (lbl && !lbl.includes('send') && !lbl.includes('stop') && !lbl.includes('submit')) {
              plusBtn = btn; break;
            }
          }
        }
      }
      if (plusBtn) {
        plusBtn.click();
        setTimeout(() => {
          const menuSelectors = '[role="menuitem"],[role="option"],button,li,[role="listitem"]';
          for (const el of document.querySelectorAll(menuSelectors)) {
            if (!el.offsetParent) continue;
            const t = (el.textContent || el.getAttribute('aria-label') || '').toLowerCase();
            if (t.includes('upload') || t.includes('computer') || t.includes('file') || t.includes('attach')) {
              el.click();
              setTimeout(() => {
                const fi = document.querySelector('input[type="file"]');
                if (fi) fi.click();
              }, 400);
              return;
            }
          }
          const fi = document.querySelector('input[type="file"]');
          if (fi) fi.click();
          else log('⚠ ChatGPT upload menu not found — click + manually.', 'warn');
        }, 600);
        return;
      }
      log('⚠ Could not find upload button — click + in ChatGPT manually.', 'warn');
    },
  };

  // Thin compatibility wrappers so the rest of the codebase keeps working.
  async function sendToGPT(prompt) {
    await GPT.send(prompt);
    return await GPT.waitForDone();
  }
  async function waitForGPTResponse(timeoutMs = 300000) {
    return await GPT.waitForDone(timeoutMs);
  }

  // ─────────────────────────────────────────────────────────────
  //  GOOGLE DOCS POSTER (Apps Script protocol)
  // ─────────────────────────────────────────────────────────────
  const DOCS = {
    _cfg() {
      return {
        url:    GM_getValue(STORAGE_KEYS.APPS_SCRIPT_URL, ''),
        docId:  GM_getValue(STORAGE_KEYS.DOC_ID, ''),
        secret: GM_getValue(STORAGE_KEYS.SECRET_KEY, ''),
      };
    },
    _sendRaw(rawData) {
      const cfg = this._cfg();
      if (!cfg.url || !cfg.docId) return Promise.reject(new Error('Missing URL/DocID'));
      return new Promise((resolve, reject) => {
        GM_xmlhttpRequest({
          method: 'POST',
          url: cfg.url,
          headers: { 'Content-Type': 'application/json; charset=UTF-8', 'Accept': 'application/json, */*' },
          data: rawData,
          timeout: 90000,
          onload: (r) => {
            if (r.status >= 200 && r.status < 400) {
              try {
                const resp = JSON.parse(r.responseText || '{}');
                if (resp.status === 'error') { reject(new Error('Apps Script: ' + (resp.message || 'unknown'))); return; }
              } catch (_) {}
              resolve();
            } else reject(new Error(`HTTP ${r.status}: ${(r.responseText || '').slice(0, 200)}`));
          },
          onerror: () => reject(new Error('Network error')),
          ontimeout: () => reject(new Error('Request timed out after 90s')),
        });
      });
    },

    async sendChunk(content, section) {
      const cfg = this._cfg();
      const payload = {
        secret: String(cfg.secret || '').trim(),
        docId:  String(cfg.docId).trim(),
        action: 'append',
        section: String(section || '').trim(),
        content: String(content || ''),
      };
      return this._sendRaw(JSON.stringify(payload));
    },

    async sendWithRetry(content, section, attempts = 5) {
      let lastErr = '';
      for (let i = 1; i <= attempts; i++) {
        try {
          await this.sendChunk(content, section);
          log(`📤 Saved to Docs: "${section}"`, 'sys');
          return;
        } catch (e) {
          lastErr = e.message;
          log(`Docs save attempt ${i}/${attempts} failed: ${e.message}`, 'warn');
          if (i < attempts) await sleep(Math.min(2000 * i, 12000));
        }
      }
      log(`✗ Docs save failed after ${attempts} attempts: "${section}": ${lastErr}`, 'error');
    },

    // Post an arbitrary text block — chunks on paragraph boundaries if > 40KB
    async post(content, section) {
      let text = String(content || '').replace(/^\n+/, '').replace(/\n+$/, '');
      if (!text) return;
      if (text.length <= 40000) { await this.sendWithRetry(text, section); return; }
      const paragraphs = text.split('\n\n');
      let chunk = '', idx = 1;
      for (const p of paragraphs) {
        const add = p + '\n\n';
        if (chunk.length > 0 && (chunk.length + add.length) > 40000) {
          await this.sendWithRetry(chunk, `${section} (Part ${idx})`);
          chunk = add; idx++;
        } else {
          chunk += add;
        }
      }
      if (chunk.replace(/\n/g, '').trim()) await this.sendWithRetry(chunk, `${section} (Part ${idx})`);
    },

    async postImage(imageRecord, section) {
      if (!imageRecord) return;
      const cfg = this._cfg();
      const payload = {
        secret: String(cfg.secret || '').trim(),
        docId:  String(cfg.docId).trim(),
        action: 'appendImage',
        section: String(section || '').trim(),
        imageCaption: imageRecord.label || imageRecord.topic || 'Figure',
        imageSrc:     imageRecord.src || '',
        imageData:    imageRecord.dataUrl || '',
        asciiArt:     imageRecord.asciiArt || '',
      };
      try {
        await this._sendRaw(JSON.stringify(payload));
        log(`🖼 Image saved to Docs: "${payload.imageCaption}"`, 'sys');
      } catch (e) {
        log(`⚠ Image save failed: ${e.message} — falling back to text placeholder.`, 'warn');
        const fallback = imageRecord.asciiArt
          ? `\n📊 FIGURE: ${payload.imageCaption}\n\`\`\`\n${imageRecord.asciiArt}\n\`\`\`\n`
          : `\n[📊 DIAGRAM: ${payload.imageCaption}]\n`;
        await this.post(fallback, section);
      }
    },

    async postQuestions({ domain, domainNum, batchIdx, questions }) {
      const lines = [`\n## Practice Questions — Domain ${domainNum}: ${domain} (Batch ${batchIdx})\n`];
      questions.forEach((q, i) => {
        lines.push(`**Q${i + 1} [${q.type || '—'}]** — ${q.statement || q.question || ''}`);
        const opts = q.options || {};
        Object.keys(opts).forEach(k => lines.push(`  ${k}) ${opts[k]}`));
        if (q.correct_answer) lines.push(`**Answer:** ${q.correct_answer}`);
        if (q.explanation)    lines.push(`**Explanation:** ${q.explanation}`);
        if (q.reference_topic)lines.push(`_Ref: ${q.reference_topic}_`);
        lines.push('');
      });
      await this.post(lines.join('\n'), `Practice Questions — Domain ${domainNum} (Batch ${batchIdx})`);
    },
  };

  // Wrapper used by the orchestrator
  function postPageToDoc({ page, text, images, wordCount, label }) {
    const section = `${label ? `[${label}] ` : ''}Page ${page} — ${examConfig.examName}${wordCount ? ` (~${wordCount}w)` : ''}`;
    return (async () => {
      await DOCS.post(text, section);
      if (images && images.length) {
        for (const img of images) {
          if (abortFlag) break;
          await DOCS.postImage(img, `${section} — Figure: ${img.label || img.topic || ''}`);
        }
      }
    })();
  }

  // ─────────────────────────────────────────────────────────────
  //  QUALITY + REFERENCE VALIDATION
  // ─────────────────────────────────────────────────────────────
  function detectMissingReference(text) {
    return /MISSING_REFERENCE\s*:/i.test(text) ||
           /i\s+don'?t\s+have\s+access/i.test(text) ||
           /i\s+cannot\s+find.*reference/i.test(text);
  }

  function validateQuality(text) {
    if (!text || text.length < 200) return false;
    // Forbidden patterns (training-data / placeholder / generic)
    const forbidden = [
      /\[placeholder\]/i,
      /as an ai language model/i,
      /lorem ipsum/i,
      /<insert .* here>/i,
      /\btodo\b:/i,
    ];
    return !forbidden.some(r => r.test(text));
  }

  function stripSourceMentions(text) {
    return text
      .replace(/\(see\s+[^)]+?(page|chapter)\s+\d+[^)]*\)/gi, '')
      .replace(/\[source:[^\]]+\]/gi, '')
      .replace(/according to the reference[^.]*\./gi, '')
      .replace(/as stated in [^.]+\./gi, '')
      .trim();
  }

  function countWords(text) {
    return (text.trim().split(/\s+/).filter(Boolean) || []).length;
  }

  // ─────────────────────────────────────────────────────────────
  //  PROGRESS UI
  // ─────────────────────────────────────────────────────────────
  function updateProgressUI() {
    const total = progress.pagesTotal || examConfig.totalPages || 1;
    const done  = Math.min(progress.done, total);
    const pct   = Math.round((done / total) * 100);

    $('#sg-progress-bar').style.width = `${pct}%`;
    $('#sg-progress-pct').textContent = `${pct}%`;
    $('#sg-progress-text').textContent = progress.message || (currentState === STATE.RUNNING
      ? `Generating page ${progress.currentPage}/${total}...`
      : 'Waiting to start...');
    $('#sg-page-counter').textContent = `${done} / ${total} pages`;

    $('#sg-stat-done').textContent    = progress.done;
    $('#sg-stat-failed').textContent  = progress.failed;
    $('#sg-stat-retries').textContent = progress.retries;
    $('#sg-stat-words').textContent   = progress.words.toLocaleString();
    $('#sg-stat-skipped').textContent = `⏭ ${progress.skipped}`;
    $('#sg-stat-images').textContent  = `🖼 ${progress.images}`;
    const qEl = $('#sg-stat-questions');
    if (qEl) qEl.textContent = `🎓 ${progress.questions || 0}`;
    const pqPg = $('#sg-pq-progress');
    if (pqPg) {
      const tot = practiceConfig.totalQuestions || 0;
      pqPg.textContent = `${progress.questions || 0} / ${tot} questions generated`;
    }

    renderRecent();
  }

  function pushRecent(page, status, detail) {
    progress.recent = progress.recent || [];
    progress.recent.unshift({ page, status, detail, ts: new Date().toLocaleTimeString() });
    progress.recent = progress.recent.slice(0, 12);
  }

  function renderRecent() {
    const box = $('#sg-recent-pages');
    if (!box) return;
    if (!progress.recent || !progress.recent.length) {
      box.innerHTML = `<div style="color:#475569">No pages generated yet.</div>`;
      return;
    }
    const statusIcon = { ok: '✅', fail: '❌', skip: '⏭', retry: '↺' };
    const statusColor = { ok: '#4ade80', fail: '#f87171', skip: '#94a3b8', retry: '#fbbf24' };
    box.innerHTML = progress.recent.map(r => `
      <div class="sg-recent-item">
        <span><b>Page ${r.page}</b> <span style="color:#475569">· ${r.ts}</span></span>
        <span class="sg-recent-status" style="color:${statusColor[r.status] || '#94a3b8'}">
          ${statusIcon[r.status] || '•'} ${escapeHtml(r.detail || '')}
        </span>
      </div>
    `).join('');
  }

  // ─────────────────────────────────────────────────────────────
  //  UI STATE
  // ─────────────────────────────────────────────────────────────
  function setUIState(state) {
    currentState = state;
    const badge = $('#sg-status-badge');
    badge.className = 'badge-' + state.toLowerCase();
    badge.innerHTML = `<span class="badge-dot"></span>${state}`;

    $('#sg-btn-start').disabled  = state === STATE.RUNNING || state === STATE.PAUSED;
    $('#sg-btn-pause').disabled  = state !== STATE.RUNNING;
    $('#sg-btn-resume').disabled = state !== STATE.PAUSED;
    $('#sg-btn-stop').disabled   = state === STATE.IDLE || state === STATE.STOPPED;
    $('#sg-btn-retry').disabled  = !(state === STATE.ERROR || state === STATE.PAUSED || state === STATE.STOPPED);
    $('#sg-btn-skip').disabled   = !(state === STATE.RUNNING || state === STATE.PAUSED);
    $('#sg-auto-generate').disabled = state === STATE.RUNNING;
  }

  function showPopup(title, body) {
    $('#sg-popup-title').textContent = title;
    $('#sg-popup-body').textContent  = body;
    $('#sg-popup-overlay').style.display = 'flex';
  }
  function hidePopup() {
    $('#sg-popup-overlay').style.display = 'none';
  }

  // ─────────────────────────────────────────────────────────────
  //  LOGGING
  // ─────────────────────────────────────────────────────────────
  function log(msg, type = 'info') {
    const el = $('#sg-console');
    if (!el) return;
    const time = new Date().toLocaleTimeString();
    const line = document.createElement('div');
    line.className = `log-${type}`;
    line.textContent = `[${time}] ${msg}`;
    el.appendChild(line);
    el.scrollTop = el.scrollHeight;
  }

  function notify(text) {
    try {
      GM_notification({ title: 'StudyGuide v13', text, timeout: 4000 });
    } catch {/* ignore */}
  }

  // ─────────────────────────────────────────────────────────────
  //  UTILS
  // ─────────────────────────────────────────────────────────────
  function $(sel) { return document.querySelector(sel); }

  function loadObj(key, fallback) {
    try {
      const raw = GM_getValue(key, null);
      if (!raw) return JSON.parse(JSON.stringify(fallback));
      return { ...JSON.parse(JSON.stringify(fallback)), ...JSON.parse(raw) };
    } catch {
      return JSON.parse(JSON.stringify(fallback));
    }
  }
  function saveObj(key, obj) {
    GM_setValue(key, JSON.stringify(obj));
  }

  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

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
    const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set
                || Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
    if (setter) setter.call(el, value); else el.value = value;
  }

  function extractJSON(text) {
    if (!text) throw new Error('Empty AI response');
    const m = text.match(/```json\s*([\s\S]*?)```/) ||
              text.match(/```\s*([\s\S]*?)```/)   ||
              text.match(/(\{[\s\S]*\})/);
    if (m) {
      try { return JSON.parse(m[1].trim()); } catch { /* fallthrough */ }
    }
    try { return JSON.parse(text.trim()); } catch { /* fallthrough */ }
    return { raw: text };
  }

  function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, c =>
      ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  }
  function escapeAttr(s) { return escapeHtml(s); }

  // ─────────────────────────────────────────────────────────────
  //  INIT
  // ─────────────────────────────────────────────────────────────
  function init() {
    try {
      if (document.getElementById('sg-panel')) {
        console.warn('[StudyGuide] Panel already present — skipping re-init.');
        return;
      }
      buildUI();
      log('🟢 StudyGuide AI v13 loaded — Text + Gemini Images pipeline ready.', 'ok');
    } catch (err) {
      console.error('[StudyGuide] Init error:', err);
      // Best-effort surface via alert for visibility if log panel failed to mount
      try { alert('StudyGuide init failed: ' + err.message); } catch (_) {}
    }
  }

  // Install global error listeners so runtime errors are visible in the console
  window.addEventListener('error', (e) => {
    try { log(`✗ JS error: ${e.message} (${e.filename}:${e.lineno})`, 'error'); } catch (_) {}
  });
  window.addEventListener('unhandledrejection', (e) => {
    try { log(`✗ Unhandled promise rejection: ${e.reason && e.reason.message || e.reason}`, 'error'); } catch (_) {}
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    setTimeout(init, 1200);
  }
})();
