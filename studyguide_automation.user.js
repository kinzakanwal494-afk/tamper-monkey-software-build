// ==UserScript==
// @name         StudyGuide AutoPilot v3.0 — ExamForge ULTRA
// @namespace    https://studyguide-autopilot.pro
// @version      3.0.0
// @description  ExamForge v14 core + 11-step StudyGuide pipeline + Gemini cross-tab image generation + Google Docs output
// @author       Sherii
// @match        https://chatgpt.com/*
// @match        https://chat.openai.com/*
// @match        https://gemini.google.com/*
// @match        https://aistudio.google.com/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @grant        GM_listValues
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @grant        GM_setClipboard
// @grant        GM_openInTab
// @connect      script.google.com
// @connect      script.googleusercontent.com
// @connect      gemini.google.com
// @connect      *
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  const VERSION = '3.0.0';
  const PREFIX  = 'SGA3_';

  /* ═══════════════════════════════════════════════
     PHASE CONSTANTS
  ═══════════════════════════════════════════════ */
  const PHASE = {
    IDLE:0, SESSION_INIT:1, OUTLINE_WAIT:2, DOMAIN_MAP:3,
    BOOKS_WAIT:4, BOOKS_ACK:5, SG_PIPELINE:6, GENERATING:7, DONE:8,
  };

  /* ═══════════════════════════════════════════════
     50 EXAM TYPES + VISUAL DNA
  ═══════════════════════════════════════════════ */
  const ET = {
    MATH:'math', PHYSICS:'physics', CHEMISTRY:'chemistry', BIOLOGY:'biology',
    STATISTICS:'statistics', ENGINEERING:'engineering', ENVIRONMENTAL:'environmental',
    ASTRONOMY:'astronomy', MEDICAL:'medical', NURSING:'nursing', PHARMACY:'pharmacy',
    ANATOMY:'anatomy', PHYSIOLOGY:'physiology', PROGRAMMING:'programming',
    NETWORKING:'networking', CYBERSECURITY:'cybersecurity', DATABASE:'database',
    DATASC:'datascience', ELECTRONICS:'electronics', BUSINESS:'business',
    ACCOUNTING:'accounting', ECONOMICS:'economics', FINANCE:'finance',
    MARKETING:'marketing', MANAGEMENT:'management', HISTORY:'history',
    GEOGRAPHY:'geography', LAW:'law', PSYCHOLOGY:'psychology', SOCIOLOGY:'sociology',
    PHILOSOPHY:'philosophy', POLITICAL:'political', ANTHROPOLOGY:'anthropology',
    LITERATURE:'literature', LINGUISTICS:'linguistics', ART:'art',
    ARCHITECTURE:'architecture', MUSIC:'music', FILM:'film',
    SAT:'sat', GRE:'gre', GMAT:'gmat', MCAT:'mcat', LSAT:'lsat',
    USMLE:'usmle', BAR:'bar', PMP:'pmp', ACTUARIAL:'actuarial',
    REALESTATE:'realestate', EDUCATION:'education', GENERAL:'general',
  };

  const VDNA = {
    math:{images:true,imageWhen:'smart',equations:true,reactions:false,code:false,graphs:true,tables:true,examples:true,casestudy:false},
    physics:{images:true,imageWhen:'smart',equations:true,reactions:false,code:false,graphs:true,tables:true,examples:true,casestudy:false},
    chemistry:{images:true,imageWhen:'smart',equations:true,reactions:true,code:false,graphs:true,tables:true,examples:true,casestudy:false},
    biology:{images:true,imageWhen:'smart',equations:false,reactions:false,code:false,graphs:true,tables:true,examples:true,casestudy:false},
    anatomy:{images:true,imageWhen:'always',equations:false,reactions:false,code:false,graphs:false,tables:true,examples:true,casestudy:false},
    physiology:{images:true,imageWhen:'smart',equations:true,reactions:false,code:false,graphs:true,tables:true,examples:true,casestudy:false},
    medical:{images:true,imageWhen:'smart',equations:false,reactions:false,code:false,graphs:true,tables:true,examples:true,casestudy:true},
    nursing:{images:true,imageWhen:'smart',equations:false,reactions:false,code:false,graphs:true,tables:true,examples:true,casestudy:true},
    pharmacy:{images:false,imageWhen:'never',equations:true,reactions:true,code:false,graphs:false,tables:true,examples:true,casestudy:false},
    usmle:{images:true,imageWhen:'smart',equations:false,reactions:false,code:false,graphs:true,tables:true,examples:true,casestudy:true},
    mcat:{images:true,imageWhen:'smart',equations:true,reactions:true,code:false,graphs:true,tables:true,examples:true,casestudy:false},
    programming:{images:true,imageWhen:'smart',equations:false,reactions:false,code:true,graphs:false,tables:true,examples:true,casestudy:false},
    networking:{images:true,imageWhen:'smart',equations:false,reactions:false,code:true,graphs:false,tables:true,examples:true,casestudy:false},
    cybersecurity:{images:true,imageWhen:'smart',equations:false,reactions:false,code:true,graphs:false,tables:true,examples:true,casestudy:false},
    database:{images:true,imageWhen:'smart',equations:false,reactions:false,code:true,graphs:false,tables:true,examples:true,casestudy:false},
    datascience:{images:true,imageWhen:'smart',equations:true,reactions:false,code:true,graphs:true,tables:true,examples:true,casestudy:false},
    electronics:{images:true,imageWhen:'smart',equations:true,reactions:false,code:false,graphs:true,tables:true,examples:true,casestudy:false},
    engineering:{images:true,imageWhen:'smart',equations:true,reactions:false,code:true,graphs:true,tables:true,examples:true,casestudy:false},
    statistics:{images:true,imageWhen:'smart',equations:true,reactions:false,code:true,graphs:true,tables:true,examples:true,casestudy:false},
    business:{images:true,imageWhen:'smart',equations:false,reactions:false,code:false,graphs:true,tables:true,examples:true,casestudy:true},
    accounting:{images:false,imageWhen:'never',equations:true,reactions:false,code:false,graphs:true,tables:true,examples:true,casestudy:false},
    economics:{images:true,imageWhen:'smart',equations:true,reactions:false,code:false,graphs:true,tables:true,examples:true,casestudy:false},
    finance:{images:false,imageWhen:'never',equations:true,reactions:false,code:false,graphs:true,tables:true,examples:true,casestudy:false},
    marketing:{images:false,imageWhen:'never',equations:false,reactions:false,code:false,graphs:true,tables:true,examples:true,casestudy:true},
    management:{images:false,imageWhen:'never',equations:false,reactions:false,code:false,graphs:true,tables:true,examples:true,casestudy:true},
    history:{images:true,imageWhen:'smart',equations:false,reactions:false,code:false,graphs:false,tables:true,examples:true,casestudy:false},
    geography:{images:true,imageWhen:'smart',equations:false,reactions:false,code:false,graphs:true,tables:true,examples:true,casestudy:false},
    law:{images:false,imageWhen:'never',equations:false,reactions:false,code:false,graphs:false,tables:true,examples:true,casestudy:true},
    psychology:{images:true,imageWhen:'smart',equations:false,reactions:false,code:false,graphs:true,tables:true,examples:true,casestudy:true},
    sociology:{images:false,imageWhen:'never',equations:false,reactions:false,code:false,graphs:true,tables:true,examples:true,casestudy:true},
    philosophy:{images:false,imageWhen:'never',equations:false,reactions:false,code:false,graphs:false,tables:false,examples:true,casestudy:false},
    political:{images:false,imageWhen:'never',equations:false,reactions:false,code:false,graphs:true,tables:true,examples:true,casestudy:true},
    anthropology:{images:true,imageWhen:'smart',equations:false,reactions:false,code:false,graphs:false,tables:true,examples:true,casestudy:false},
    literature:{images:false,imageWhen:'never',equations:false,reactions:false,code:false,graphs:false,tables:false,examples:true,casestudy:false},
    linguistics:{images:false,imageWhen:'never',equations:false,reactions:false,code:false,graphs:false,tables:true,examples:true,casestudy:false},
    art:{images:true,imageWhen:'smart',equations:false,reactions:false,code:false,graphs:false,tables:false,examples:true,casestudy:false},
    architecture:{images:true,imageWhen:'smart',equations:true,reactions:false,code:false,graphs:false,tables:false,examples:true,casestudy:false},
    music:{images:false,imageWhen:'never',equations:false,reactions:false,code:false,graphs:false,tables:false,examples:true,casestudy:false},
    film:{images:false,imageWhen:'never',equations:false,reactions:false,code:false,graphs:false,tables:false,examples:true,casestudy:false},
    gre:{images:false,imageWhen:'never',equations:true,reactions:false,code:false,graphs:true,tables:true,examples:true,casestudy:false},
    gmat:{images:false,imageWhen:'never',equations:true,reactions:false,code:false,graphs:true,tables:true,examples:true,casestudy:true},
    sat:{images:false,imageWhen:'never',equations:true,reactions:false,code:false,graphs:true,tables:true,examples:true,casestudy:false},
    lsat:{images:false,imageWhen:'never',equations:false,reactions:false,code:false,graphs:false,tables:false,examples:true,casestudy:true},
    bar:{images:false,imageWhen:'never',equations:false,reactions:false,code:false,graphs:false,tables:true,examples:true,casestudy:true},
    pmp:{images:false,imageWhen:'never',equations:false,reactions:false,code:false,graphs:true,tables:true,examples:true,casestudy:true},
    actuarial:{images:false,imageWhen:'never',equations:true,reactions:false,code:true,graphs:true,tables:true,examples:true,casestudy:false},
    realestate:{images:false,imageWhen:'never',equations:true,reactions:false,code:false,graphs:true,tables:true,examples:true,casestudy:false},
    education:{images:false,imageWhen:'never',equations:false,reactions:false,code:false,graphs:true,tables:true,examples:true,casestudy:true},
    environmental:{images:true,imageWhen:'smart',equations:false,reactions:false,code:false,graphs:true,tables:true,examples:true,casestudy:false},
    astronomy:{images:true,imageWhen:'smart',equations:true,reactions:false,code:false,graphs:true,tables:true,examples:true,casestudy:false},
    general:{images:false,imageWhen:'never',equations:false,reactions:false,code:false,graphs:false,tables:true,examples:true,casestudy:false},
  };

  const EXAM_META = {
    math:{icon:'🧮',label:'MATH',color:'#3b82f6'},physics:{icon:'⚛️',label:'PHYSICS',color:'#8b5cf6'},
    chemistry:{icon:'🧪',label:'CHEMISTRY',color:'#10b981'},biology:{icon:'🦠',label:'BIOLOGY',color:'#22c55e'},
    anatomy:{icon:'🫀',label:'ANATOMY',color:'#e11d48'},physiology:{icon:'🔬',label:'PHYSIOLOGY',color:'#7c3aed'},
    medical:{icon:'🩺',label:'MEDICAL',color:'#ef4444'},nursing:{icon:'💊',label:'NURSING',color:'#ef4444'},
    pharmacy:{icon:'💊',label:'PHARMACY',color:'#0891b2'},usmle:{icon:'🏥',label:'USMLE',color:'#b91c1c'},
    mcat:{icon:'🎓',label:'MCAT',color:'#7c3aed'},programming:{icon:'💻',label:'PROGRAMMING',color:'#f97316'},
    networking:{icon:'🌐',label:'NETWORKING',color:'#0ea5e9'},cybersecurity:{icon:'🔐',label:'CYBERSEC',color:'#dc2626'},
    database:{icon:'🗄️',label:'DATABASE',color:'#6366f1'},datascience:{icon:'📊',label:'DATA SCI',color:'#8b5cf6'},
    electronics:{icon:'⚡',label:'ELECTRONICS',color:'#f59e0b'},engineering:{icon:'⚙️',label:'ENGINEERING',color:'#64748b'},
    statistics:{icon:'📉',label:'STATISTICS',color:'#f59e0b'},business:{icon:'📊',label:'BUSINESS',color:'#06b6d4'},
    accounting:{icon:'💰',label:'ACCOUNTING',color:'#eab308'},economics:{icon:'📈',label:'ECONOMICS',color:'#6366f1'},
    finance:{icon:'💹',label:'FINANCE',color:'#15803d'},marketing:{icon:'📣',label:'MARKETING',color:'#f97316'},
    management:{icon:'🏢',label:'MANAGEMENT',color:'#64748b'},history:{icon:'🏛️',label:'HISTORY',color:'#a78bfa'},
    geography:{icon:'🌍',label:'GEOGRAPHY',color:'#34d399'},law:{icon:'⚖️',label:'LAW',color:'#94a3b8'},
    psychology:{icon:'🧠',label:'PSYCHOLOGY',color:'#f43f5e'},sociology:{icon:'👥',label:'SOCIOLOGY',color:'#a78bfa'},
    philosophy:{icon:'💭',label:'PHILOSOPHY',color:'#94a3b8'},political:{icon:'🏛️',label:'POLITICAL',color:'#3b82f6'},
    anthropology:{icon:'🦴',label:'ANTHROPO',color:'#d97706'},literature:{icon:'📖',label:'LITERATURE',color:'#a78bfa'},
    linguistics:{icon:'💬',label:'LINGUISTICS',color:'#06b6d4'},art:{icon:'🎨',label:'ART',color:'#ec4899'},
    architecture:{icon:'🏗️',label:'ARCHITECT',color:'#d97706'},music:{icon:'🎵',label:'MUSIC',color:'#a78bfa'},
    film:{icon:'🎬',label:'FILM',color:'#64748b'},gre:{icon:'🎓',label:'GRE',color:'#6366f1'},
    gmat:{icon:'📋',label:'GMAT',color:'#f97316'},sat:{icon:'📝',label:'SAT',color:'#3b82f6'},
    lsat:{icon:'⚖️',label:'LSAT',color:'#94a3b8'},bar:{icon:'⚖️',label:'BAR',color:'#64748b'},
    pmp:{icon:'📋',label:'PMP',color:'#06b6d4'},actuarial:{icon:'📊',label:'ACTUARIAL',color:'#6366f1'},
    realestate:{icon:'🏠',label:'REAL ESTATE',color:'#22c55e'},education:{icon:'🎒',label:'EDUCATION',color:'#f97316'},
    environmental:{icon:'🌿',label:'ENVIRON',color:'#22c55e'},astronomy:{icon:'🔭',label:'ASTRONOMY',color:'#8b5cf6'},
    general:{icon:'📚',label:'GENERAL',color:'#64748b'},
  };

  const ET_KEYWORDS = {
    math:['calculus','algebra','geometry','trigonometry','differential equations','linear algebra','mathematics','maths','integral','derivative','matrix','polynomial'],
    physics:['physics','mechanics','thermodynamics','electromagnetism','optics','quantum','nuclear','relativity','waves','kinematics'],
    chemistry:['chemistry','organic chemistry','inorganic','physical chemistry','biochemistry','stoichiometry','reactions','periodic table','bonding'],
    biology:['biology','cell biology','genetics','evolution','ecology','microbiology','molecular biology','botany','zoology'],
    statistics:['statistics','probability','hypothesis testing','regression','anova','bayesian','statistical'],
    engineering:['engineering','civil','mechanical','electrical engineering','chemical engineering','structural','fluid mechanics'],
    environmental:['environmental science','ecology','climate','sustainability','environmental chemistry','pollution'],
    astronomy:['astronomy','astrophysics','cosmology','planetary science','celestial'],
    medical:['medicine','clinical','pathology','pharmacology','diagnosis','treatment','disease','medical','mbbs'],
    nursing:['nursing','nclex','patient care','clinical nursing','nursing diagnosis'],
    pharmacy:['pharmacy','pharmacokinetics','pharmacodynamics','drug interactions','pharmaceutics'],
    anatomy:['anatomy','anatomical','dissection','human anatomy','gross anatomy','neuroanatomy'],
    physiology:['physiology','human physiology','organ systems','cardiovascular physiology','neurophysiology'],
    programming:['programming','coding','software','algorithm','data structures','python','java','javascript','c++','computer science','cs','dsa'],
    networking:['networking','network','ccna','ccnp','tcp/ip','osi model','routing','switching','cisco'],
    cybersecurity:['cybersecurity','security','ethical hacking','penetration testing','cryptography','cissp'],
    database:['database','sql','nosql','mysql','postgresql','mongodb','normalization','dbms'],
    datascience:['data science','machine learning','deep learning','neural networks','artificial intelligence','nlp'],
    electronics:['electronics','circuit','semiconductor','transistor','amplifier','digital electronics','microcontroller'],
    business:['business','management','strategy','entrepreneurship','operations','supply chain','mba'],
    accounting:['accounting','financial accounting','managerial accounting','bookkeeping','ledger','journal entry','acca','cpa','ca'],
    economics:['economics','microeconomics','macroeconomics','supply demand','gdp','inflation','monetary policy'],
    finance:['finance','financial analysis','investment','valuation','corporate finance','derivatives','cfa'],
    marketing:['marketing','consumer behavior','brand','advertising','digital marketing'],
    management:['leadership','organizational behavior','human resources','operations management'],
    history:['history','historical','ancient history','world history','civilization','empire','revolution','war'],
    geography:['geography','physical geography','human geography','geopolitics','climate zones','population'],
    law:['law','legal','constitutional','criminal law','civil law','contracts','torts','jurisprudence'],
    psychology:['psychology','cognitive','behavioral','developmental','social psychology','clinical psychology'],
    sociology:['sociology','social','culture','society','socialization','institutions'],
    philosophy:['philosophy','ethics','logic','metaphysics','epistemology','existentialism'],
    political:['political science','government','political theory','international relations'],
    anthropology:['anthropology','cultural anthropology','physical anthropology','archaeology'],
    literature:['literature','literary','novel','poetry','drama','shakespeare'],
    linguistics:['linguistics','language','phonetics','syntax','semantics','morphology'],
    art:['art history','visual art','painting','sculpture','art movements','renaissance'],
    architecture:['architecture','architectural design','building structures','urban design'],
    music:['music theory','music history','musicology','composition','harmony'],
    film:['film studies','cinema','film theory','film history','cinematography'],
    mcat:['mcat'],usmle:['usmle','step 1','step 2','step 3','medical licensing'],
    gre:['gre','graduate record'],gmat:['gmat','graduate management'],
    lsat:['lsat','law school admission'],sat:['sat exam','scholastic assessment'],
    bar:['bar exam','bar examination'],pmp:['pmp','project management professional','pmbok'],
    actuarial:['actuarial','actuary','soa','cas'],
  };

  function detectExamType(name) {
    if (!name) return 'general';
    const lower = name.toLowerCase();
    for (const [type, kws] of Object.entries(ET_KEYWORDS)) {
      for (const kw of kws) { if (lower === kw) return type; }
    }
    const all = [];
    for (const [type, kws] of Object.entries(ET_KEYWORDS)) {
      for (const kw of kws) all.push({type, kw, len:kw.length});
    }
    all.sort((a,b) => b.len - a.len);
    for (const {type, kw} of all) { if (lower.includes(kw)) return type; }
    return 'general';
  }

  /* ═══════════════════════════════════════════════
     STATE
  ═══════════════════════════════════════════════ */
  function defaultState() {
    return {
      phase:PHASE.IDLE, running:false, paused:false,
      outlineOk:false, booksOk:false,
      currentPage:0, totalPages:0,
      completedPages:[], failedPages:[], skippedPages:[],
      retries:0, maxRetries:7, globalErrors:0, maxGlobalErrors:20,
      pollMs:300, timeoutMs:300000, pageDelayMs:1500,
      lastResponse:'', domainMap:'', parsedMap:[],
      sessionAcked:false, booksAcked:false,
      watcherTimer:null, pauseResolver:null,
      startTime:null, logEntries:[],
      lastSentDomain:'', lastSentSubdomain:'',
      usedHeadings:{}, usedDomainHeaders:[], usedSubdomainHeaders:[],
      smartFillMissing:'', examType:'general',
      generatedImages:[], imageEnabled:true, geminiWaitMs:120,
      sgPipelineData:{}, sgPipelineStep:-1,
      geminiTabHandle:null,
    };
  }
  let S = defaultState();

  /* STORAGE */
  const store = {
    get(k,d){try{return GM_getValue(PREFIX+k,d===undefined?'':d);}catch(e){return d||'';}},
    set(k,v){try{GM_setValue(PREFIX+k,v);}catch(e){}},
    del(k){try{GM_deleteValue(PREFIX+k);}catch(e){}},
    clearAll(){try{GM_listValues().filter(k=>k.startsWith(PREFIX)).forEach(k=>GM_deleteValue(k));}catch(e){}},
    saveProgress(){
      this.set('progress',JSON.stringify({
        phase:S.phase,currentPage:S.currentPage,totalPages:S.totalPages,
        completedPages:S.completedPages,failedPages:S.failedPages,skippedPages:S.skippedPages,
        domainMap:S.domainMap,parsedMap:S.parsedMap,
        lastSentDomain:S.lastSentDomain,usedHeadings:S.usedHeadings,
        examType:S.examType,generatedImages:S.generatedImages,
      }));
    },
    loadProgress(){try{return JSON.parse(this.get('progress','')||'null');}catch(e){return null;}},
  };

  /* ═══════════════════════════════════════════════
     11-STEP SG PIPELINE
  ═══════════════════════════════════════════════ */
  const SG_STEPS = [
    {id:'exams_verification',      label:'Exams Verification',          icon:'📋'},
    {id:'outline_mapping',         label:'Outline Mapping',             icon:'🗺️'},
    {id:'sample_question_mapping', label:'Sample Question Mapping',     icon:'❓'},
    {id:'chapters_structure',      label:'Chapters Structure',          icon:'📚'},
    {id:'practice_question_struct',label:'Practice Question Structure', icon:'✏️'},
    {id:'domain_subdomain_weight', label:'Domain/Subdomain Weight',     icon:'⚖️'},
    {id:'overview',                label:'Overview',                    icon:'🔍'},
    {id:'main_purpose_target',     label:'Main Purpose & Target',       icon:'🎯'},
    {id:'memory_check',            label:'Memory Check',                icon:'🧠'},
    {id:'math_charts_graphs',      label:'Math / Charts / Graphs',      icon:'📊'},
    {id:'practice_generation',     label:'Practice Question Generation',icon:'🎓'},
  ];

  function buildSGPrompt(stepId, exam, collected) {
    const d = collected || {};
    const J = o => JSON.stringify(o).substring(0,2800);
    switch(stepId) {
      case 'exams_verification':
        return 'Analyze exam: "'+exam+'". Return JSON only:\n{"exam_name":"","governing_body":"","total_questions":0,"time_limit_minutes":0,"passing_score":"","question_types":[],"domains":[{"name":"","weight_percent":0,"subdomain_count":0}],"verified":true}';
      case 'outline_mapping':
        return 'Based on exam data: '+J(d.exams_verification||{exam})+'\nCreate outline. Return JSON only:\n{"outline":[{"domain":"#DOMAIN NAME","weight":0,"subdomains":[{"name":"##SUBDOMAIN NAME","topics":["###Topic 1"]}]}]}';
      case 'sample_question_mapping':
        return 'Based on outline: '+J(d.outline_mapping||{})+'\nQuestion types per domain. Return JSON only:\n{"question_type_map":[{"domain":"","types":["multiple_choice","scenario","calculation"]}]}';
      case 'chapters_structure':
        return 'Based on outline: '+J(d.outline_mapping||{})+'\nGenerate chapters. Return JSON only:\n{"chapters":[{"chapter_number":1,"domain":"#DOMAIN","subdomain":"##SUBDOMAIN","topics":[{"heading":"###TOPIC","key_concepts":[],"tables":[{"title":"","columns":[],"rows":[[]]}],"memory_hooks":[]}]}]}';
      case 'practice_question_struct':
        return 'Based on chapters: '+J(d.chapters_structure||{})+'\nPractice structure. Return JSON only:\n{"practice_structure":{"total_questions":0,"distribution":[{"domain":"","count":0}],"difficulty_split":{"easy":0,"medium":0,"hard":0}}}';
      case 'domain_subdomain_weight':
        return 'Verify domain weights.\nExam: '+J(d.exams_verification||{})+'\nOutline: '+J(d.outline_mapping||{})+'\nReturn JSON only:\n{"weighted_structure":[{"domain":"#DOMAIN","domain_weight_percent":0,"subdomains":[{"name":"##SUBDOMAIN","subdomain_weight_percent":0,"topic_count":0}]}],"total_weight_check":100}';
      case 'overview':
        return 'Generate overview.\nAll data: '+J(d)+'\nReturn JSON only:\n{"overview":{"exam_name":"","purpose_statement":"","target_audience":"","study_guide_scope":"","total_domains":0,"total_topics":0,"estimated_study_hours":0,"key_themes":[]}}';
      case 'main_purpose_target':
        return 'Main purpose and coverage.\nOverview: '+J(d.overview||{})+'\nWeighted: '+J(d.domain_subdomain_weight||{})+'\nReturn JSON only:\n{"main_purpose":"","target_covered":{"domains_covered":[],"competency_areas":[],"excluded_topics":[],"coverage_percent":100}}';
      case 'memory_check':
        return 'Memory check content.\nChapters: '+J(d.chapters_structure||{})+'\nReturn JSON only:\n{"memory_checks":[{"domain":"#DOMAIN","subdomain":"##SUBDOMAIN","mnemonics":[],"key_formulas":[],"flashcard_prompts":[{"front":"","back":""}]}]}';
      case 'math_charts_graphs':
        return 'Extract visual/math content.\nChapters: '+J(d.chapters_structure||{})+'\nReturn JSON only:\n{"visual_content":[{"domain":"#DOMAIN","type":"chart|graph|formula|diagram","title":"","description":"","ascii_representation":"","mermaid_diagram":""}]}';
      case 'practice_generation':
        return 'Generate practice questions.\nStudy data: '+J(d)+'\nReturn JSON only:\n{"practice_questions":[{"id":1,"domain":"#DOMAIN","subdomain":"##SUBDOMAIN","type":"multiple_choice","difficulty":"medium","question":"","options":{"A":"","B":"","C":"","D":""},"correct_answer":"A","explanation":"","reference_topic":"###TOPIC"}]}';
      default:
        return 'Provide structured JSON for: '+stepId+' about "'+exam+'"';
    }
  }

  /* ═══════════════════════════════════════════════
     STYLES
  ═══════════════════════════════════════════════ */
  GM_addStyle(`
    #sga-wrap{position:fixed!important;top:52px!important;right:16px!important;width:440px!important;z-index:2147483647!important;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif!important;font-size:13px!important;color:#e2e8f0!important;display:block!important;pointer-events:auto!important;}
    #sga-wrap *{box-sizing:border-box!important;}
    #sga-wrap.sga-hidden{display:none!important;}
    #sga-panel{background:#07090f!important;border:1px solid #1e2d42!important;border-radius:16px!important;box-shadow:0 24px 64px rgba(0,0,0,.8)!important;overflow:hidden!important;}
    #sga-header{display:flex!important;align-items:center!important;justify-content:space-between!important;padding:11px 14px!important;background:linear-gradient(135deg,#0d1520,#111e2e)!important;border-bottom:1px solid #1e2d42!important;cursor:grab!important;user-select:none!important;position:relative!important;}
    #sga-header::after{content:''!important;position:absolute!important;top:0!important;left:0!important;right:0!important;height:1px!important;background:linear-gradient(90deg,transparent,#3b82f6 40%,#6366f1 70%,transparent)!important;opacity:.5!important;}
    .sga-hbrand{display:flex!important;align-items:center!important;gap:9px!important;}
    .sga-logo{width:28px!important;height:28px!important;border-radius:8px!important;background:linear-gradient(135deg,#3b82f6,#6366f1)!important;display:flex!important;align-items:center!important;justify-content:center!important;font-size:14px!important;color:#fff!important;font-weight:900!important;flex-shrink:0!important;}
    .sga-hinfo{display:flex!important;flex-direction:column!important;gap:1px!important;}
    .sga-hname{font-size:13px!important;font-weight:700!important;color:#e2e8f0!important;}
    .sga-hver{font-size:9.5px!important;color:#475569!important;font-family:monospace!important;}
    .sga-hbadge{font-size:9px!important;font-weight:700!important;letter-spacing:.8px!important;text-transform:uppercase!important;padding:2px 7px!important;border-radius:4px!important;background:rgba(16,185,129,.12)!important;border:1px solid rgba(16,185,129,.25)!important;color:#10b981!important;}
    .sga-hbtns{display:flex!important;gap:5px!important;}
    .sga-hbtn{width:26px!important;height:26px!important;border:1px solid #28405c!important;border-radius:7px!important;background:#16202e!important;color:#94a3b8!important;cursor:pointer!important;display:flex!important;align-items:center!important;justify-content:center!important;font-size:12px!important;transition:all .15s!important;padding:0!important;}
    .sga-hbtn:hover{background:#1c2a3a!important;color:#e2e8f0!important;}
    .sga-hbtn.danger:hover{background:rgba(239,68,68,.15)!important;border-color:#ef4444!important;color:#ef4444!important;}
    #sga-statusbar{display:flex!important;align-items:center!important;justify-content:space-between!important;padding:7px 14px!important;background:#0c0f1a!important;border-bottom:1px solid #1e2d42!important;gap:10px!important;}
    #sga-status{display:inline-flex!important;align-items:center!important;gap:6px!important;padding:4px 11px!important;border-radius:20px!important;font-size:10.5px!important;font-weight:700!important;letter-spacing:.5px!important;text-transform:uppercase!important;border:1px solid!important;transition:all .3s!important;flex-shrink:0!important;}
    .s-dot{width:5px!important;height:5px!important;border-radius:50%!important;}
    .s-dot.pulse{animation:sgaPulse 1.3s ease-in-out infinite!important;}
    @keyframes sgaPulse{0%,100%{opacity:1}50%{opacity:.2}}
    #sga-status.idle{color:#475569!important;background:rgba(71,85,105,.08)!important;border-color:#1e2d42!important;}
    #sga-status.idle .s-dot{background:#475569!important;}
    #sga-status.running{color:#3b82f6!important;background:rgba(59,130,246,.1)!important;border-color:rgba(59,130,246,.3)!important;}
    #sga-status.running .s-dot{background:#3b82f6!important;}
    #sga-status.imaging{color:#8b5cf6!important;background:rgba(139,92,246,.1)!important;border-color:rgba(139,92,246,.3)!important;}
    #sga-status.imaging .s-dot{background:#8b5cf6!important;}
    #sga-status.paused{color:#f59e0b!important;background:rgba(245,158,11,.08)!important;border-color:rgba(245,158,11,.3)!important;}
    #sga-status.paused .s-dot{background:#f59e0b!important;}
    #sga-status.error{color:#ef4444!important;background:rgba(239,68,68,.08)!important;border-color:rgba(239,68,68,.3)!important;}
    #sga-status.error .s-dot{background:#ef4444!important;}
    #sga-status.done{color:#10b981!important;background:rgba(16,185,129,.08)!important;border-color:rgba(16,185,129,.3)!important;}
    #sga-status.done .s-dot{background:#10b981!important;}
    .sb-right{display:flex!important;flex-direction:column!important;align-items:flex-end!important;gap:1px!important;flex:1!important;overflow:hidden!important;}
    #sga-phase-lbl,#sga-elapsed{font-size:10px!important;color:#475569!important;font-family:monospace!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;}
    #sga-body{padding:11px 13px!important;display:flex!important;flex-direction:column!important;gap:9px!important;max-height:82vh!important;overflow-y:auto!important;overflow-x:hidden!important;}
    #sga-body::-webkit-scrollbar{width:4px!important;}
    #sga-body::-webkit-scrollbar-thumb{background:#28405c!important;border-radius:4px!important;}
    #sga-panel.minimized #sga-body,#sga-panel.minimized #sga-statusbar{display:none!important;}
    .sga-card{background:#0c0f1a!important;border:1px solid #1e2d42!important;border-radius:12px!important;padding:12px 13px!important;position:relative!important;}
    .sga-card-hdr{display:flex!important;align-items:center!important;justify-content:space-between!important;margin-bottom:10px!important;}
    .sga-card-title{font-size:10px!important;font-weight:700!important;text-transform:uppercase!important;letter-spacing:1.4px!important;color:#3b82f6!important;display:flex!important;align-items:center!important;gap:6px!important;}
    .sga-card-title::before{content:''!important;width:3px!important;height:11px!important;background:#3b82f6!important;border-radius:2px!important;flex-shrink:0!important;}
    .sga-card-title.grn{color:#10b981!important;}.sga-card-title.grn::before{background:#10b981!important;}
    .sga-card-title.prp{color:#8b5cf6!important;}.sga-card-title.prp::before{background:#8b5cf6!important;}
    .sga-card-title.org{color:#f97316!important;}.sga-card-title.org::before{background:#f97316!important;}
    .sga-card-title.pnk{color:#ec4899!important;}.sga-card-title.pnk::before{background:#ec4899!important;}
    .sga-badge{font-size:9px!important;font-weight:700!important;padding:2px 7px!important;border-radius:4px!important;text-transform:uppercase!important;letter-spacing:.5px!important;}
    .badge-req{background:rgba(239,68,68,.1)!important;border:1px solid rgba(239,68,68,.2)!important;color:#ef4444!important;}
    .badge-act{background:rgba(139,92,246,.1)!important;border:1px solid rgba(139,92,246,.2)!important;color:#8b5cf6!important;}
    .badge-v3{background:rgba(236,72,153,.1)!important;border:1px solid rgba(236,72,153,.25)!important;color:#ec4899!important;}
    .sga-fld{display:flex!important;flex-direction:column!important;gap:4px!important;margin-bottom:8px!important;}
    .sga-fld:last-child{margin-bottom:0!important;}
    .sga-fld label{font-size:10.5px!important;font-weight:600!important;color:#94a3b8!important;}
    .sga-fld label .req{color:#ef4444!important;}
    .sga-fld label .tip{font-size:9.5px!important;color:#475569!important;font-weight:400!important;}
    .sga-inp{background:#07090f!important;border:1px solid #1e2d42!important;border-radius:7px!important;padding:7px 10px!important;color:#e2e8f0!important;font-size:12px!important;font-family:monospace!important;outline:none!important;width:100%!important;transition:border-color .2s,box-shadow .2s!important;}
    .sga-inp:focus{border-color:#3b82f6!important;box-shadow:0 0 0 3px rgba(59,130,246,.12)!important;}
    .sga-inp::placeholder{color:#475569!important;}
    .sga-inp:disabled{opacity:.4!important;cursor:not-allowed!important;}
    .sga-inp-wrap{position:relative!important;}
    .sga-inp-wrap .sga-inp{padding-right:32px!important;}
    .sga-inp-action{position:absolute!important;right:8px!important;top:50%!important;transform:translateY(-50%)!important;background:none!important;border:none!important;color:#475569!important;cursor:pointer!important;font-size:11px!important;padding:2px!important;}
    .sga-inp-action:hover{color:#3b82f6!important;}
    .sga-frow{display:flex!important;gap:8px!important;}
    .sga-frow .sga-fld{flex:1!important;}
    .sga-fhint{font-size:9.5px!important;color:#475569!important;font-family:monospace!important;margin-top:2px!important;}
    .sga-dwr{display:flex!important;gap:6px!important;align-items:center!important;margin-bottom:6px!important;}
    .sga-dwr .dw-pg-lbl{width:48px!important;flex-shrink:0!important;text-align:right!important;font-size:10px!important;color:#10b981!important;font-family:monospace!important;font-weight:700!important;}
    .sga-dwr.auto-filled{background:rgba(16,185,129,.04)!important;border:1px solid rgba(16,185,129,.15)!important;border-radius:7px!important;padding:4px 6px!important;}
    .weight-total-bar{display:flex!important;align-items:center!important;justify-content:space-between!important;padding:5px 8px!important;border-radius:6px!important;margin-top:6px!important;font-size:11px!important;font-family:monospace!important;}
    .weight-total-bar.ok{background:rgba(16,185,129,.08)!important;border:1px solid rgba(16,185,129,.2)!important;color:#10b981!important;}
    .weight-total-bar.warn{background:rgba(245,158,11,.08)!important;border:1px solid rgba(245,158,11,.2)!important;color:#f59e0b!important;}
    .weight-total-bar.err{background:rgba(239,68,68,.08)!important;border:1px solid rgba(239,68,68,.2)!important;color:#ef4444!important;}
    #sga-exam-type-banner{display:none!important;align-items:center!important;gap:8px!important;padding:7px 11px!important;border-radius:8px!important;margin-bottom:4px!important;font-size:11px!important;font-weight:700!important;border:1px solid!important;}
    #sga-exam-type-banner.visible{display:flex!important;}
    .sga-btn{padding:7px 13px!important;border-radius:8px!important;border:1px solid #28405c!important;background:#16202e!important;color:#e2e8f0!important;font-size:12px!important;font-weight:600!important;cursor:pointer!important;transition:all .15s!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;gap:5px!important;white-space:nowrap!important;outline:none!important;min-height:32px!important;line-height:1!important;}
    .sga-btn:hover:not(:disabled){background:#1c2a3a!important;}
    .sga-btn:active:not(:disabled){transform:scale(.98)!important;}
    .sga-btn:disabled{opacity:.35!important;cursor:not-allowed!important;pointer-events:none!important;}
    .sga-btn.primary{background:linear-gradient(135deg,#3b82f6,#6366f1)!important;border-color:transparent!important;color:#fff!important;box-shadow:0 3px 12px rgba(59,130,246,.25)!important;}
    .sga-btn.primary:hover:not(:disabled){opacity:.88!important;}
    .sga-btn.success{background:rgba(16,185,129,.1)!important;border-color:rgba(16,185,129,.3)!important;color:#10b981!important;}
    .sga-btn.danger{background:rgba(239,68,68,.1)!important;border-color:rgba(239,68,68,.25)!important;color:#ef4444!important;}
    .sga-btn.warning{background:rgba(245,158,11,.1)!important;border-color:rgba(245,158,11,.25)!important;color:#f59e0b!important;}
    .sga-btn.info{background:rgba(6,182,212,.08)!important;border-color:rgba(6,182,212,.2)!important;color:#06b6d4!important;}
    .sga-btn.purple{background:rgba(139,92,246,.1)!important;border-color:rgba(139,92,246,.3)!important;color:#8b5cf6!important;}
    .sga-btn.sm{padding:5px 10px!important;font-size:11px!important;min-height:28px!important;}
    .sga-btn.lg{padding:9px 18px!important;font-size:13px!important;min-height:38px!important;}
    .sga-btn.full{width:100%!important;}
    .sga-btn.confirmed{background:rgba(16,185,129,.06)!important;border-color:rgba(16,185,129,.15)!important;color:rgba(16,185,129,.5)!important;cursor:default!important;pointer-events:none!important;}
    .sga-brow{display:flex!important;gap:6px!important;flex-wrap:wrap!important;align-items:center!important;}
    .sga-conn-result{display:flex!important;align-items:center!important;gap:6px!important;padding:5px 10px!important;border-radius:6px!important;font-size:11px!important;font-family:monospace!important;margin-top:7px!important;}
    .sga-conn-result.hidden{display:none!important;}
    .sga-conn-result.ok{background:rgba(16,185,129,.08)!important;border:1px solid rgba(16,185,129,.2)!important;color:#10b981!important;}
    .sga-conn-result.error{background:rgba(239,68,68,.08)!important;border:1px solid rgba(239,68,68,.2)!important;color:#ef4444!important;}
    .sga-conn-result.testing{background:rgba(59,130,246,.08)!important;border:1px solid rgba(59,130,246,.2)!important;color:#3b82f6!important;}
    .sga-step{display:flex!important;align-items:flex-start!important;gap:10px!important;padding:10px 11px!important;border-radius:10px!important;border:1px solid #1e2d42!important;background:#111622!important;transition:all .25s!important;margin-bottom:7px!important;position:relative!important;overflow:hidden!important;}
    .sga-step:last-child{margin-bottom:0!important;}
    .sga-step::before{content:''!important;position:absolute!important;top:0!important;left:0!important;width:2px!important;height:100%!important;background:#1e2d42!important;}
    .sga-step.active{border-color:rgba(59,130,246,.35)!important;background:rgba(59,130,246,.04)!important;}
    .sga-step.active::before{background:#3b82f6!important;}
    .sga-step.done{border-color:rgba(16,185,129,.25)!important;background:rgba(16,185,129,.03)!important;}
    .sga-step.done::before{background:#10b981!important;}
    .sga-step-num{width:24px!important;height:24px!important;border-radius:50%!important;display:flex!important;align-items:center!important;justify-content:center!important;font-size:11px!important;font-weight:800!important;background:#16202e!important;border:1.5px solid #28405c!important;color:#475569!important;flex-shrink:0!important;transition:all .25s!important;margin-top:1px!important;}
    .sga-step.active .sga-step-num{background:rgba(59,130,246,.12)!important;border-color:#3b82f6!important;color:#3b82f6!important;}
    .sga-step.done .sga-step-num{background:rgba(16,185,129,.12)!important;border-color:#10b981!important;color:#10b981!important;}
    .sga-step-body{flex:1!important;min-width:0!important;}
    .sga-step-title{font-size:12px!important;font-weight:700!important;color:#94a3b8!important;margin-bottom:3px!important;}
    .sga-step.active .sga-step-title{color:#e2e8f0!important;}
    .sga-step.done .sga-step-title{color:#10b981!important;}
    .sga-step-desc{font-size:11px!important;color:#475569!important;line-height:1.5!important;margin-bottom:8px!important;}
    .sga-step.active .sga-step-desc{color:#94a3b8!important;}
    .sga-step-actions{display:flex!important;gap:6px!important;flex-wrap:wrap!important;}
    .sga-dp-panel{background:linear-gradient(135deg,rgba(249,115,22,.06),rgba(99,102,241,.06))!important;border:1px solid rgba(249,115,22,.2)!important;border-radius:9px!important;padding:10px 12px!important;margin-top:8px!important;}
    .sga-dp-title{font-size:10px!important;font-weight:800!important;text-transform:uppercase!important;letter-spacing:1.2px!important;color:#f97316!important;margin-bottom:8px!important;}
    .sga-dp-domain{font-size:12px!important;font-weight:700!important;color:#e2e8f0!important;margin-bottom:2px!important;}
    .sga-dp-sub{font-size:11px!important;color:#94a3b8!important;font-family:monospace!important;}
    .sga-prog-outer{background:#07090f!important;border:1px solid #1e2d42!important;border-radius:6px!important;height:7px!important;overflow:hidden!important;}
    .sga-prog-inner{height:100%!important;background:linear-gradient(90deg,#3b82f6,#6366f1)!important;border-radius:6px!important;transition:width .55s ease!important;width:0%!important;}
    .sga-prog-inner.full{background:linear-gradient(90deg,#10b981,#059669)!important;}
    .sga-prog-nums{display:flex!important;justify-content:space-between!important;font-size:10.5px!important;color:#94a3b8!important;margin-top:5px!important;font-family:monospace!important;}
    .sga-stats-row{display:flex!important;gap:6px!important;flex-wrap:wrap!important;margin-top:8px!important;}
    .sga-stat-chip{display:flex!important;align-items:center!important;gap:4px!important;padding:3px 8px!important;border-radius:5px!important;background:#111622!important;border:1px solid #1e2d42!important;font-size:10px!important;font-family:monospace!important;color:#475569!important;}
    .sga-stat-chip .sv{font-weight:700!important;color:#94a3b8!important;}
    .sga-stat-chip.acc .sv{color:#3b82f6!important;}
    .sga-stat-chip.grn .sv{color:#10b981!important;}
    .sga-stat-chip.red .sv{color:#ef4444!important;}
    .sga-stat-chip.ylw .sv{color:#f59e0b!important;}
    .sga-stat-chip.org .sv{color:#f97316!important;}
    .sga-stat-chip.prp .sv{color:#8b5cf6!important;}
    .sga-page-feed{display:flex!important;flex-direction:column!important;gap:3px!important;max-height:88px!important;overflow-y:auto!important;margin-top:8px!important;}
    .sga-pfe{display:flex!important;align-items:center!important;gap:6px!important;padding:3px 8px!important;border-radius:5px!important;background:#111622!important;border:1px solid #1e2d42!important;font-size:10px!important;font-family:monospace!important;}
    .sga-pfe .pf-n{color:#475569!important;}
    .sga-pfe .pf-t{flex:1!important;color:#94a3b8!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important;}
    .sga-pfe .pf-b{font-size:9px!important;padding:1px 5px!important;border-radius:3px!important;font-weight:700!important;}
    .sga-pfe.ok .pf-b{background:rgba(16,185,129,.12)!important;color:#10b981!important;}
    .sga-pfe.fail .pf-b{background:rgba(239,68,68,.1)!important;color:#ef4444!important;}
    .sga-pfe.skipped .pf-b{background:rgba(245,158,11,.1)!important;color:#f59e0b!important;}
    .sga-pfe.cur{border-color:rgba(59,130,246,.3)!important;background:rgba(59,130,246,.04)!important;}
    .sga-pfe.cur .pf-b{background:rgba(59,130,246,.15)!important;color:#3b82f6!important;animation:sgaPulse 1s infinite!important;}
    .sga-pfe.img .pf-b{background:rgba(139,92,246,.15)!important;color:#8b5cf6!important;animation:sgaPulse 1s infinite!important;}
    .sga-failed-box{font-size:10.5px!important;color:#ef4444!important;padding:5px 9px!important;background:rgba(239,68,68,.05)!important;border:1px solid rgba(239,68,68,.15)!important;border-radius:6px!important;margin-top:7px!important;}
    .sga-failed-box.hidden{display:none!important;}
    .sga-ctrl-grid{display:grid!important;grid-template-columns:1fr 1fr!important;gap:7px!important;}
    #sga-btn-start{grid-column:1/-1!important;}
    .sga-divider{height:1px!important;background:#1e2d42!important;margin:8px 0!important;}
    .sga-accordion{border:1px solid #1e2d42!important;border-radius:9px!important;overflow:hidden!important;}
    .sga-acc-hdr{display:flex!important;align-items:center!important;justify-content:space-between!important;padding:9px 12px!important;background:#111622!important;cursor:pointer!important;user-select:none!important;font-size:11.5px!important;font-weight:600!important;color:#94a3b8!important;}
    .sga-acc-hdr:hover{background:#16202e!important;}
    .sga-acc-arrow{transition:transform .22s!important;font-size:10px!important;color:#475569!important;}
    .sga-accordion.open .sga-acc-arrow{transform:rotate(180deg)!important;}
    .sga-acc-body{display:none!important;padding:10px 12px!important;background:#0c0f1a!important;border-top:1px solid #1e2d42!important;}
    .sga-accordion.open .sga-acc-body{display:block!important;}
    .sga-log-wrap{background:#07090f!important;border:1px solid #1e2d42!important;border-radius:8px!important;overflow:hidden!important;}
    .sga-log-toolbar{display:flex!important;align-items:center!important;justify-content:space-between!important;padding:5px 10px!important;background:#111622!important;border-bottom:1px solid #1e2d42!important;}
    .sga-log-title{font-size:9.5px!important;font-weight:700!important;text-transform:uppercase!important;letter-spacing:1px!important;color:#475569!important;display:flex!important;align-items:center!important;gap:5px!important;}
    .sga-log-live{width:5px!important;height:5px!important;border-radius:50%!important;background:#10b981!important;animation:sgaPulse 2s infinite!important;}
    .sga-log-btns{display:flex!important;gap:5px!important;}
    .sga-log-btn{padding:2px 8px!important;border-radius:4px!important;border:1px solid #1e2d42!important;background:#16202e!important;color:#475569!important;font-size:9.5px!important;font-family:monospace!important;cursor:pointer!important;}
    .sga-log-btn:hover{color:#94a3b8!important;background:#1c2a3a!important;}
    #sga-log{padding:7px 10px!important;max-height:150px!important;min-height:50px!important;overflow-y:auto!important;font-family:monospace!important;font-size:10.5px!important;line-height:1.75!important;}
    #sga-log::-webkit-scrollbar{width:3px!important;}
    #sga-log::-webkit-scrollbar-thumb{background:#28405c!important;}
    .sga-le{display:flex!important;gap:7px!important;align-items:flex-start!important;}
    .sga-le-ts{color:#475569!important;flex-shrink:0!important;font-size:9.5px!important;padding-top:1px!important;}
    .sga-le-lv{font-size:9px!important;font-weight:700!important;text-transform:uppercase!important;padding:1px 5px!important;border-radius:3px!important;flex-shrink:0!important;letter-spacing:.5px!important;margin-top:1px!important;}
    .sga-le-lv.info{background:rgba(59,130,246,.12)!important;color:#3b82f6!important;}
    .sga-le-lv.ok{background:rgba(16,185,129,.12)!important;color:#10b981!important;}
    .sga-le-lv.warn{background:rgba(245,158,11,.1)!important;color:#f59e0b!important;}
    .sga-le-lv.error{background:rgba(239,68,68,.12)!important;color:#ef4444!important;}
    .sga-le-lv.hi{background:rgba(139,92,246,.15)!important;color:#8b5cf6!important;}
    .sga-le-lv.img{background:rgba(236,72,153,.15)!important;color:#ec4899!important;}
    .sga-le-msg{color:#94a3b8!important;flex:1!important;word-break:break-word!important;}
    .sga-le.ok .sga-le-msg{color:rgba(16,185,129,.9)!important;}
    .sga-le.error .sga-le-msg{color:rgba(239,68,68,.9)!important;}
    .sga-le.warn .sga-le-msg{color:rgba(245,158,11,.9)!important;}
    .sga-le.hi .sga-le-msg{color:rgba(139,92,246,.9)!important;}
    .sga-le.img .sga-le-msg{color:rgba(236,72,153,.9)!important;}
    #sga-toasts{position:fixed!important;top:15px!important;left:50%!important;transform:translateX(-50%)!important;z-index:2147483647!important;display:flex!important;flex-direction:column!important;gap:5px!important;pointer-events:none!important;min-width:200px!important;max-width:420px!important;}
    .sga-toast{padding:10px 14px!important;border-radius:10px!important;font-size:12.5px!important;font-weight:600!important;display:flex!important;align-items:center!important;gap:8px!important;box-shadow:0 8px 28px rgba(0,0,0,.5)!important;transform:translateY(-12px)!important;opacity:0!important;transition:transform .28s cubic-bezier(.34,1.56,.64,1),opacity .28s!important;pointer-events:all!important;border:1px solid!important;}
    .sga-toast.show{transform:translateY(0)!important;opacity:1!important;}
    .sga-toast.hide{transform:translateY(-8px)!important;opacity:0!important;}
    .sga-toast.info{background:#16202e!important;border-color:rgba(59,130,246,.3)!important;color:#e2e8f0!important;}
    .sga-toast.success{background:rgba(0,40,25,.95)!important;border-color:rgba(16,185,129,.4)!important;color:#10b981!important;}
    .sga-toast.warning{background:rgba(40,30,0,.95)!important;border-color:rgba(245,158,11,.4)!important;color:#f59e0b!important;}
    .sga-toast.error{background:rgba(40,0,5,.95)!important;border-color:rgba(239,68,68,.4)!important;color:#ef4444!important;}
    .sga-toast.purple{background:rgba(30,10,50,.95)!important;border-color:rgba(139,92,246,.4)!important;color:#a78bfa!important;}
    .sga-tog-row{display:flex!important;align-items:center!important;justify-content:space-between!important;padding:6px 0!important;}
    .sga-tog-lbl{font-size:11.5px!important;color:#94a3b8!important;font-weight:500!important;}
    .sga-tog-lbl span{font-size:10px!important;color:#475569!important;display:block!important;margin-top:1px!important;}
    .sga-toggle{width:34px!important;height:18px!important;border-radius:9px!important;background:#16202e!important;border:1px solid #28405c!important;cursor:pointer!important;position:relative!important;flex-shrink:0!important;transition:background .22s,border-color .22s!important;}
    .sga-toggle.on{background:#3b82f6!important;border-color:#3b82f6!important;}
    .sga-toggle::after{content:''!important;position:absolute!important;top:3px!important;left:3px!important;width:10px!important;height:10px!important;border-radius:50%!important;background:#475569!important;transition:transform .22s,background .22s!important;}
    .sga-toggle.on::after{transform:translateX(16px)!important;background:#fff!important;}
    #sga-misref-overlay{position:fixed!important;bottom:20px!important;left:20px!important;z-index:2147483647!important;width:420px!important;max-width:calc(100vw - 40px)!important;pointer-events:auto!important;}
    #sga-misref-overlay.hidden{display:none!important;}
    #sga-misref-overlay.minimized #sga-misref-box-body{display:none!important;}
    #sga-misref-box{background:#07090f!important;border:2px solid rgba(239,68,68,.55)!important;border-radius:14px!important;overflow:hidden!important;}
    #sga-misref-header{display:flex!important;align-items:center!important;justify-content:space-between!important;padding:10px 14px!important;background:linear-gradient(135deg,rgba(239,68,68,.15),rgba(239,68,68,.05))!important;border-bottom:1px solid rgba(239,68,68,.2)!important;}
    .mr-hdr-left{display:flex!important;align-items:center!important;gap:8px!important;}
    .mr-hdr-title{font-size:12px!important;font-weight:800!important;color:#ef4444!important;}
    .mr-hdr-btns{display:flex!important;gap:5px!important;}
    .mr-hdr-btn{width:24px!important;height:24px!important;border:1px solid rgba(239,68,68,.3)!important;border-radius:6px!important;background:rgba(239,68,68,.08)!important;color:#ef4444!important;cursor:pointer!important;font-size:12px!important;display:flex!important;align-items:center!important;justify-content:center!important;padding:0!important;}
    .mr-hdr-btn.min-btn{color:#f59e0b!important;border-color:rgba(245,158,11,.3)!important;background:rgba(245,158,11,.08)!important;}
    #sga-misref-box-body{padding:16px!important;}
    .mr-page-info{font-size:10.5px!important;font-family:monospace!important;color:#475569!important;margin-bottom:10px!important;}
    .mr-gpt-says{background:rgba(239,68,68,.06)!important;border:1px solid rgba(239,68,68,.2)!important;border-radius:8px!important;padding:9px 11px!important;margin-bottom:12px!important;font-size:11px!important;color:#94a3b8!important;max-height:80px!important;overflow-y:auto!important;}
    .mr-instruction{font-size:11.5px!important;color:#94a3b8!important;margin-bottom:12px!important;line-height:1.5!important;padding:9px 11px!important;background:rgba(59,130,246,.05)!important;border:1px solid rgba(59,130,246,.15)!important;border-radius:7px!important;}
    .mr-instruction strong{color:#3b82f6!important;}
    .mr-confirm-row{display:none!important;align-items:center!important;gap:8px!important;margin-bottom:10px!important;padding:8px 11px!important;background:rgba(16,185,129,.05)!important;border:1px solid rgba(16,185,129,.2)!important;border-radius:7px!important;}
    .mr-confirm-row.visible{display:flex!important;}
    .mr-confirm-txt{flex:1!important;font-size:11px!important;color:#10b981!important;}
    .mr-btns{display:grid!important;grid-template-columns:1fr 1fr!important;gap:8px!important;}
    .mr-btn-upload{padding:11px!important;border-radius:9px!important;background:rgba(59,130,246,.12)!important;border:1px solid rgba(59,130,246,.35)!important;color:#3b82f6!important;font-size:12px!important;font-weight:700!important;cursor:pointer!important;display:flex!important;flex-direction:column!important;align-items:center!important;gap:3px!important;}
    .mr-btn-skip{padding:11px!important;border-radius:9px!important;background:rgba(245,158,11,.1)!important;border:1px solid rgba(245,158,11,.3)!important;color:#f59e0b!important;font-size:12px!important;font-weight:700!important;cursor:pointer!important;display:flex!important;flex-direction:column!important;align-items:center!important;gap:3px!important;}
    .mr-btn-confirm{padding:10px!important;border-radius:9px!important;grid-column:1/-1!important;background:rgba(16,185,129,.12)!important;border:1px solid rgba(16,185,129,.35)!important;color:#10b981!important;font-size:12px!important;font-weight:700!important;cursor:pointer!important;display:none!important;}
    .mr-btn-confirm.visible{display:block!important;}
    .mr-status{text-align:center!important;font-size:10.5px!important;color:#475569!important;margin-top:10px!important;}
    .mr-status.active{color:#3b82f6!important;}
    .mr-status.ok{color:#10b981!important;}
    .sga-spin{display:inline-block!important;animation:sgaSpin .8s linear infinite!important;}
    @keyframes sgaSpin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
    .sg-pl-step{display:flex!important;align-items:center!important;gap:7px!important;padding:5px 8px!important;border-radius:7px!important;margin-bottom:4px!important;background:#0c0f1a!important;border:1px solid #1e2d42!important;font-size:11px!important;transition:all .2s!important;}
    .sg-pl-step.active{border-color:#3b82f6!important;background:rgba(59,130,246,.05)!important;}
    .sg-pl-step.done{border-color:rgba(16,185,129,.3)!important;background:rgba(16,185,129,.03)!important;}
    .sg-pl-step.error{border-color:rgba(239,68,68,.3)!important;}
    .sg-pl-icon{font-size:12px!important;flex-shrink:0!important;}
    .sg-pl-label{flex:1!important;color:#64748b!important;}
    .sg-pl-step.active .sg-pl-label{color:#e2e8f0!important;}
    .sg-pl-step.done .sg-pl-label{color:#10b981!important;}
    .sg-pl-status{font-size:12px!important;}
    #sga-gemini-panel{display:none!important;padding:10px 12px!important;background:rgba(139,92,246,.06)!important;border:1px solid rgba(139,92,246,.2)!important;border-radius:9px!important;margin-top:6px!important;}
    #sga-gemini-panel.visible{display:block!important;}
    .gp-title{font-size:9.5px!important;font-weight:800!important;text-transform:uppercase!important;letter-spacing:1px!important;color:#8b5cf6!important;margin-bottom:7px!important;display:flex!important;align-items:center!important;gap:6px!important;}
    .gp-topic{font-size:11px!important;color:#c4b5fd!important;margin-bottom:5px!important;font-family:monospace!important;}
    .gp-timer{font-size:10px!important;color:#6d28d9!important;font-family:monospace!important;}
    .gp-preview{margin-top:8px!important;border-radius:6px!important;overflow:hidden!important;max-height:100px!important;}
    .gp-preview img{width:100%!important;height:auto!important;display:block!important;}
    #sga-img-stats{display:none!important;align-items:center!important;justify-content:space-between!important;padding:7px 11px!important;border-radius:8px!important;background:rgba(139,92,246,.06)!important;border:1px solid rgba(139,92,246,.2)!important;font-size:11px!important;margin-top:6px!important;}
    #sga-img-stats.visible{display:flex!important;}
    .img-stat-num{font-size:14px!important;font-weight:800!important;color:#8b5cf6!important;font-family:monospace!important;}
    @media(max-width:500px){#sga-wrap{width:calc(100vw - 20px)!important;right:10px!important;}}
  `);


  /* ═══════════════════════════════════════════════
     LOG / TOAST / STATUS
  ═══════════════════════════════════════════════ */
  function log(msg, level='info') {
    const el = document.getElementById('sga-log'); if (!el) return;
    const now = new Date();
    const ts = now.toLocaleTimeString('en-US', {hour12:false, hour:'2-digit', minute:'2-digit', second:'2-digit'});
    const lvlMap = {info:'INFO', ok:'OK', warn:'WARN', error:'ERR', hi:'SYS', img:'IMG'};
    S.logEntries.push({ts, level, message: String(msg)});
    const e = document.createElement('div'); e.className = `sga-le ${level}`;
    e.innerHTML = `<span class="sga-le-ts">${ts}</span><span class="sga-le-lv ${level}">${lvlMap[level]||'INFO'}</span><span class="sga-le-msg">${esc(String(msg))}</span>`;
    el.appendChild(e);
    if (el.children.length > 400) el.children[0].remove();
    el.scrollTop = el.scrollHeight;
  }
  function esc(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function toast(msg, type='info', dur=4000) {
    const c = document.getElementById('sga-toasts'); if (!c) return;
    const icons = {info:'i', success:'✓', warning:'!', error:'✕', purple:'🎨'};
    const t = document.createElement('div'); t.className = `sga-toast ${type}`;
    t.innerHTML = `<span>${icons[type]||'i'}</span><span>${esc(msg)}</span><button style="margin-left:auto;background:none;border:none;color:inherit;opacity:.5;cursor:pointer;font-size:11px" onclick="this.parentElement.remove()">✕</button>`;
    c.appendChild(t);
    requestAnimationFrame(() => requestAnimationFrame(() => t.classList.add('show')));
    setTimeout(() => { t.classList.remove('show'); t.classList.add('hide'); setTimeout(() => t.remove(), 400); }, dur);
  }
  function setStatus(cls, txt) {
    const b = document.getElementById('sga-status'); const t = document.getElementById('sga-status-txt');
    if (b) { b.className = cls; const d = b.querySelector('.s-dot'); if (d) d.className = 's-dot' + (['running','paused','imaging'].includes(cls) ? ' pulse' : ''); }
    if (t) t.textContent = txt;
  }
  function setPhaseLabel(txt) {
    const a = document.getElementById('sga-phase-lbl'); if (a) a.textContent = txt;
    const b = document.getElementById('sga-pg-phase'); if (b) b.textContent = txt;
  }
  function setProgress(cur, total) {
    S.currentPage = cur; S.totalPages = total;
    const pct = total > 0 ? Math.round((cur / total) * 100) : 0;
    const bar = document.getElementById('sga-bar');
    if (bar) { bar.style.width = pct + '%'; if (pct >= 100) bar.classList.add('full'); }
    const pt = document.getElementById('sga-pg-txt'); if (pt) pt.textContent = `${cur} / ${total} pages`;
    const pp = document.getElementById('sga-pg-pct'); if (pp) pp.textContent = pct + '%';
    const sd = document.getElementById('sga-stat-done'); if (sd) sd.textContent = S.completedPages.length;
    const sw = document.getElementById('sga-stat-words'); if (sw) sw.textContent = (S.completedPages.length * (getCfg().words || 500)).toLocaleString();
    const ss = document.getElementById('sga-stat-skipped'); if (ss) ss.textContent = (S.skippedPages || []).length;
    const si = document.getElementById('sga-stat-images'); if (si) si.textContent = (S.generatedImages || []).length;
    updateFailedUI(); store.saveProgress();
  }
  function updateFailedUI() {
    const sf = document.getElementById('sga-stat-failed'); if (sf) sf.textContent = S.failedPages.length;
    const sr = document.getElementById('sga-stat-retries'); if (sr) sr.textContent = S.globalErrors;
    const fb = document.getElementById('sga-failed-box'); const fl = document.getElementById('sga-failed-list');
    if (fb && fl) { if (S.failedPages.length > 0) { fb.classList.remove('hidden'); fl.textContent = S.failedPages.join(', '); } else fb.classList.add('hidden'); }
  }
  function updateDomainIndicator(pg) {
    const panel = document.getElementById('sga-dp-panel');
    const dEl = document.getElementById('sga-dp-domain'); const sEl = document.getElementById('sga-dp-sub');
    if (!panel || !dEl || !sEl) return;
    const ctx = getPageContext(pg);
    if (ctx) { panel.style.display = 'block'; dEl.textContent = '🏷 ' + ctx.domain; sEl.textContent = '→ ' + ctx.subdomain + ` (p${ctx.startPage}–${ctx.endPage})`; }
  }
  function addFeedEntry(pg, status, label='', words=0) {
    const feed = document.getElementById('sga-pagefeed'); if (!feed) return;
    feed.querySelectorAll('.cur,.img').forEach(e => { if (e.id !== `sga-pfe-${pg}`) e.classList.remove('cur', 'img'); });
    const cls = status === 'ok' ? 'ok' : status === 'fail' ? 'fail' : status === 'skipped' ? 'skipped' : status === 'img' ? 'img' : 'cur';
    const badge = status === 'ok' ? 'SAVED' : status === 'fail' ? 'FAILED' : status === 'skipped' ? 'SKIPPED' : status === 'img' ? 'IMG...' : 'GEN...';
    const e = document.createElement('div'); e.className = `sga-pfe ${cls}`; e.id = `sga-pfe-${pg}`;
    e.innerHTML = `<span class="pf-n">p${pg}</span><span class="pf-t">${label || 'Page ' + pg}${words ? ` (~${words}w)` : ''}</span><span class="pf-b">${badge}</span>`;
    feed.appendChild(e); feed.scrollTop = feed.scrollHeight;
  }
  function updateFeedEntry(pg, status, words=0) {
    const ex = document.getElementById(`sga-pfe-${pg}`);
    const ctx = getPageContext(pg); const label = ctx ? `p${pg} · ${ctx.subdomain.slice(0, 30)}` : `Page ${pg}`;
    if (ex) ex.remove(); addFeedEntry(pg, status, label, words);
  }
  function setStep(n, state) {
    const el = document.getElementById(`sga-step${n}`); const num = document.getElementById(`sga-step${n}-num`);
    if (!el) return; el.className = `sga-step${state ? ' ' + state : ''}`;
    if (num) num.textContent = state === 'done' ? '✓' : state === 'error' ? '✗' : n;
  }
  function setSGStep(idx, state) {
    const el = document.getElementById(`sga-pl-${idx}`);
    if (!el) return;
    el.className = `sg-pl-step ${state}`;
    const st = el.querySelector('.sg-pl-status');
    if (st) st.textContent = state === 'done' ? '✅' : state === 'active' ? '⏳' : state === 'error' ? '❌' : '⬜';
  }
  function setBtnStates(running) {
    const g = id => document.getElementById(id);
    if (g('sga-btn-start'))  g('sga-btn-start').disabled = running;
    if (g('sga-btn-pause'))  g('sga-btn-pause').disabled = !running;
    if (g('sga-btn-resume')) g('sga-btn-resume').disabled = true;
    if (g('sga-btn-retry'))  g('sga-btn-retry').disabled = true;
    if (g('sga-btn-skip'))   g('sga-btn-skip').disabled = !running;
    if (g('sga-btn-stop'))   g('sga-btn-stop').disabled = !running;
  }

  /* ═══════════════════════════════════════════════
     EXAM TYPE BANNER
  ═══════════════════════════════════════════════ */
  function updateExamTypeBanner(examName) {
    const banner = document.getElementById('sga-exam-type-banner');
    const icon = document.getElementById('sga-exam-type-icon');
    const txt = document.getElementById('sga-exam-type-txt');
    if (!banner || !icon || !txt) return;
    const type = detectExamType(examName);
    const meta = EXAM_META[type] || EXAM_META.general;
    banner.className = 'visible';
    const rgb = hexToRgb(meta.color);
    banner.style.background = `rgba(${rgb},.08)`;
    banner.style.borderColor = `rgba(${rgb},.25)`;
    banner.style.color = meta.color;
    icon.textContent = meta.icon;
    txt.textContent = `${meta.label} — Visual: ${Object.entries(VDNA[type]||VDNA.general).filter(([k,v])=>v===true).map(([k])=>k).join(', ')}`;
    S.examType = type;
  }
  function hexToRgb(hex) {
    const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return r ? `${parseInt(r[1],16)},${parseInt(r[2],16)},${parseInt(r[3],16)}` : '139,92,246';
  }

  /* ═══════════════════════════════════════════════
     DOMAIN WEIGHT UI
  ═══════════════════════════════════════════════ */
  let domainWeightRows = [], domainRowCounter = 0;
  function addDomainWeightRow(name='', weight='', autoFilled=false) {
    const container = document.getElementById('sga-domain-weights-container'); if (!container) return;
    const id = ++domainRowCounter;
    domainWeightRows.push({ id, name: String(name), weight: parseFloat(weight) || 0 });
    const row = document.createElement('div');
    row.className = 'sga-dwr' + (autoFilled ? ' auto-filled' : ''); row.id = `sga-dwr-${id}`;
    row.innerHTML = `<input class="sga-inp sga-dw-name" placeholder="Domain name..." value="${esc(String(name))}" data-id="${id}" style="flex:1;font-size:11px"/>
      <input class="sga-inp sga-dw-pct" type="number" placeholder="%" min="0" max="100" step="0.1" value="${weight || ''}" data-id="${id}" style="width:62px;font-size:11px;flex-shrink:0"/>
      <span class="dw-pg-lbl" id="sga-dw-pgl-${id}">—</span>
      <button class="sga-btn danger sm" style="min-height:26px;padding:3px 8px;font-size:11px;flex-shrink:0" onclick="window._sgaRemoveDomain(${id})">✕</button>`;
    container.appendChild(row);
    row.querySelector('.sga-dw-name').addEventListener('input', e => { const r = domainWeightRows.find(r => r.id == id); if (r) r.name = e.target.value; updateWeightTotal(); });
    row.querySelector('.sga-dw-pct').addEventListener('input', e => { const r = domainWeightRows.find(r => r.id == id); if (r) r.weight = parseFloat(e.target.value) || 0; updateWeightTotal(); saveDomainWeights(); });
    updateWeightTotal(); return id;
  }
  window._sgaRemoveDomain = function(id) {
    domainWeightRows = domainWeightRows.filter(r => r.id != id);
    const el = document.getElementById(`sga-dwr-${id}`); if (el) el.remove();
    updateWeightTotal(); saveDomainWeights();
  };
  function updateWeightTotal() {
    const total = domainWeightRows.reduce((s, r) => s + (parseFloat(r.weight) || 0), 0);
    const bar = document.getElementById('sga-weight-total-bar');
    const val = document.getElementById('sga-weight-total-val'); const sts = document.getElementById('sga-weight-total-status');
    if (!bar) return; if (val) val.textContent = total.toFixed(1);
    const pages = parseInt(document.getElementById('sga-f-pages')?.value) || 0;
    domainWeightRows.forEach(r => {
      const pgl = document.getElementById(`sga-dw-pgl-${r.id}`); if (!pgl) return;
      pgl.textContent = (pages > 0 && total > 0) ? Math.round((parseFloat(r.weight) || 0) / total * pages) + 'p' : '—';
    });
    bar.className = 'weight-total-bar';
    if (domainWeightRows.length === 0) { bar.classList.add('warn'); if (sts) sts.textContent = 'Add domains or use auto-detect'; return; }
    if (Math.abs(total - 100) < 0.5) { bar.classList.add('ok'); if (sts) sts.textContent = '✓ Balanced'; }
    else if (total > 100) { bar.classList.add('err'); if (sts) sts.textContent = `✗ Over ${(total - 100).toFixed(1)}%`; }
    else { bar.classList.add('warn'); if (sts) sts.textContent = `⚠ ${(100 - total).toFixed(1)}% remaining`; }
  }
  function saveDomainWeights() { store.set('domainWeights', JSON.stringify(domainWeightRows.map(r => ({ name: r.name, weight: r.weight })))); }
  function loadDomainWeights() {
    try {
      const saved = JSON.parse(store.get('domainWeights', '') || 'null');
      if (Array.isArray(saved) && saved.length > 0) saved.forEach(r => addDomainWeightRow(r.name || '', r.weight || ''));
    } catch (e) {}
  }

  /* AUTO-DETECT DOMAINS */
  function parseAutoDetectedDomains(gptResponse) {
    const results = [];
    try {
      const jsonMatch = gptResponse.match(/\[[\s\S]*?\]/);
      if (jsonMatch) {
        const arr = JSON.parse(jsonMatch[0]);
        if (Array.isArray(arr)) {
          arr.forEach(item => {
            const name = (item.name || item.domain || item.title || '').trim();
            const weight = parseFloat(item.weight || item.percentage || item.pct || 0);
            if (name && weight > 0) results.push({ name, weight });
          });
          if (results.length > 0) return results;
        }
      }
    } catch (_) {}
    const lines = gptResponse.split('\n');
    const weightPattern = /(\d+(?:\.\d+)?)\s*%/;
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.length < 4) continue;
      if (/^(note|instruction|total|sum|format|example)/i.test(trimmed)) continue;
      const wMatch = trimmed.match(weightPattern); if (!wMatch) continue;
      const weight = parseFloat(wMatch[1]); if (weight <= 0 || weight > 100) continue;
      let name = trimmed.replace(/^\d+[\s.):)\-–—]+/, '').replace(/\s*[-–—(|]\s*\d+(?:\.\d+)?\s*%.*$/, '').replace(/\*\*/g, '').trim();
      if (name && name.length >= 3 && !results.find(r => r.name.toLowerCase() === name.toLowerCase())) results.push({ name, weight });
    }
    return results;
  }
  function autoFillDomainWeightsInUI(detected) {
    if (!detected || detected.length === 0) return;
    domainWeightRows = []; const container = document.getElementById('sga-domain-weights-container');
    if (container) container.innerHTML = '';
    detected.forEach(d => addDomainWeightRow(d.name, d.weight.toFixed(1), true));
    saveDomainWeights(); updateWeightTotal();
    log(`Auto-filled ${detected.length} domains ✓`, 'ok');
    toast(`✓ ${detected.length} domains auto-detected!`, 'success', 6000);
    S.autoDetectedDomains = detected;
  }

  /* DOMAIN ALLOCATION */
  function buildDomainAllocation(totalPages) {
    const rows = domainWeightRows.filter(r => r.name && parseFloat(r.weight) > 0);
    if (rows.length === 0) return [];
    const total = rows.reduce((s, r) => s + (parseFloat(r.weight) || 0), 0);
    let currentPage = 1, allocated = 0;
    return rows.map((r, idx) => {
      const w = parseFloat(r.weight) || 0; let pages;
      if (idx === rows.length - 1) pages = totalPages - allocated;
      else pages = Math.max(1, Math.round(w / total * totalPages));
      allocated += pages;
      const entry = { domain: r.name.trim(), weight: w, pages, startPage: currentPage, endPage: currentPage + pages - 1, subdomains: [] };
      currentPage += pages; return entry;
    });
  }
  function parseDomainMap(mapText, domainAllocation) {
    const lines = mapText.split('\n'); const parsed = [];
    function findAlloc(dn) {
      const d = dn.toLowerCase().trim();
      return domainAllocation.find(a => a.domain.toLowerCase().trim() === d || d.includes(a.domain.toLowerCase().trim()) || a.domain.toLowerCase().trim().includes(d));
    }
    let currentDomain = '', currentAlloc = null, subsInDomain = [];
    function flushDomain() {
      if (!currentDomain || subsInDomain.length === 0) return;
      const alloc = currentAlloc; if (!alloc) { subsInDomain = []; return; }
      const domainPages = alloc.pages, sCount = subsInDomain.length;
      let pg = alloc.startPage;
      subsInDomain.forEach((sub, idx) => {
        let subPages;
        if (idx === sCount - 1) subPages = alloc.endPage - pg + 1;
        else subPages = Math.max(1, Math.floor(domainPages / sCount));
        parsed.push({ domain: alloc.domain, subdomain: sub, startPage: pg, endPage: pg + subPages - 1, domainStartPage: alloc.startPage, domainEndPage: alloc.endPage, domainWeight: alloc.weight });
        pg += subPages;
      });
      subsInDomain = [];
    }
    for (const line of lines) {
      const trimmed = line.trim(); if (!trimmed) continue;
      if (/^#{1}[^#]/i.test(trimmed)) {
        flushDomain();
        currentDomain = trimmed.replace(/^#+\s*/, '').replace(/^DOMAIN[-\s]*\d+[:.]\s*/i, '').trim();
        currentAlloc = findAlloc(currentDomain);
        if (!currentAlloc && domainAllocation.length > 0) {
          const cnt = [...new Set(parsed.map(p => p.domain))].length;
          if (cnt < domainAllocation.length) { currentAlloc = domainAllocation[cnt]; }
        }
        continue;
      }
      if (/^#{2}[^#]/i.test(trimmed)) {
        const subRaw = trimmed.replace(/^#+\s*/, '').replace(/^SUBDOMAIN[-\s]*[\d.]+[:.]\s*/i, '').replace(/\s*[—\-]\s*pages?\s*[\d\s–\-—]+$/i, '').trim();
        if (subRaw) subsInDomain.push(subRaw); continue;
      }
    }
    flushDomain();
    log(`Domain map parsed: ${parsed.length} subdomains`, 'ok');
    return parsed;
  }
  function getPageContext(pg) {
    if (!S.parsedMap || S.parsedMap.length === 0) return null;
    for (const e of S.parsedMap) if (pg >= e.startPage && pg <= e.endPage) return e;
    return S.parsedMap[S.parsedMap.length - 1];
  }
  function getSubdomainsForDomain(domainName) {
    return S.parsedMap.filter(e => e.domain === domainName).map(e => `${e.subdomain} (pages ${e.startPage}–${e.endPage})`);
  }

  /* CONFIG */
  function getCfg() {
    const g = id => document.getElementById(id);
    return {
      exam:          (g('sga-f-exam')?.value || '').trim(),
      pages:         parseInt(g('sga-f-pages')?.value) || 0,
      words:         parseInt(g('sga-f-words')?.value) || 500,
      minL:          parseInt(g('sga-f-minl')?.value) || 5,
      maxL:          parseInt(g('sga-f-maxl')?.value) || 7,
      startPage:     parseInt(g('sga-f-startpage')?.value) || 1,
      remindEvery:   parseInt(g('sga-f-remind-every')?.value) || 5,
      pollMs:        parseInt(g('sga-f-poll')?.value) || 300,
      timeoutMs:     parseInt(g('sga-f-timeout')?.value) || 300000,
      maxRetries:    parseInt(g('sga-f-maxretry')?.value) || 7,
      pageDelay:     parseInt(g('sga-f-pagedelay')?.value) || 1500,
      minResp:       parseInt(g('sga-f-minresp')?.value) || 200,
      url:           (g('sga-f-url')?.value || '').trim(),
      docId:         (g('sga-f-docid')?.value || '').trim(),
      secret:        (g('sga-f-key')?.value || '').trim(),
      refRemind:     getTog('sga-tog-ref-remind'),
      validateResp:  getTog('sga-tog-validate'),
      stripSrc:      getTog('sga-tog-strip'),
      postDmap:      getTog('sga-tog-post-dmap'),
      domainIntro:   getTog('sga-tog-domain-intro'),
      misrefStop:    getTog('sga-tog-misref-stop'),
      imagesEnabled: getTog('sga-tog-images'),
      geminiWaitMs:  parseInt(g('sga-f-gemini-wait')?.value) || 120,
      imgPerPage:    parseInt(g('sga-f-img-per-page')?.value) || 0,
    };
  }
  function getTog(id) { const el = document.getElementById(id); return el ? el.classList.contains('on') : false; }
  function validateCfg() {
    const c = getCfg(); const errs = [];
    if (!c.exam)    errs.push('Exam Name is required');
    if (c.pages<1)  errs.push('Total Pages must be >= 1');
    if (!c.url)     errs.push('Apps Script URL is required');
    if (!c.docId)   errs.push('Google Doc ID is required');
    if (!c.secret)  errs.push('Secret Key is required');
    return errs;
  }

  /* MISSING REFERENCE */
  function isExplicitMissingSignal(text) {
    if (!text) return false;
    if (/REFERENCE_NOT_FOUND\s*:/i.test(text)) return true;
    if (/^(I'm sorry|I am sorry),?\s+(but\s+)?I (cannot|can't|am unable to) (find|locate|access)/im.test(text) && text.length < 300) return true;
    if (/no (files?|documents?|books?|PDFs?) (were|have been|are) (uploaded|attached|provided)/i.test(text)) return true;
    return false;
  }

  /* SUBJECT RULES */
  function getSubjectRules(examType) {
    const dna = VDNA[examType] || VDNA.general;
    const vis = [];
    if (dna.equations) vis.push('EQUATIONS: Every formula with ALL variables defined, step-by-step worked solutions. BANNED: "[Insert equation]"');
    if (dna.reactions) vis.push('REACTIONS: Balanced with state symbols. Organic: curved arrow mechanisms. BANNED: "[Reaction here]"');
    if (dna.code) vis.push('CODE: Complete runnable code with comments + expected output. Time/Space complexity shown. BANNED: "[Code here]"');
    if (dna.graphs) vis.push('GRAPHS: ASCII diagram with labeled axes every applicable page. BANNED: "[Graph here]"');
    if (dna.tables) vis.push('TABLES: Markdown tables for comparative/structured data.');
    if (dna.casestudy) vis.push('CASE STUDIES: Real scenario from reference every page.');
    if (dna.examples) vis.push('WORKED EXAMPLES: At least 1 complete worked example per page.');
    return `\nCONTENT LAW (zero exceptions):\n• Source ONLY from uploaded reference books\n• Every ###heading: specific topic, NEVER generic\n• If not in books: REFERENCE_NOT_FOUND: [topic]\n${vis.length > 0 ? '\nMANDATORY:\n' + vis.join('\n') : ''}`;
  }

  /* PROMPT BUILDER */
  function buildPrompts(cfg, examType) {
    const rules = getSubjectRules(examType);
    const meta = EXAM_META[examType] || EXAM_META.general;
    const FORBIDDEN = '"Core Concepts","Key Terminology","Overview","Introduction","Advanced Concepts","Summary","Conclusion","Review","Key Points"';

    return {
      init: `You are generating a professional ${meta.label} exam study book for: "${cfg.exam}".
STRUCTURE FORMAT:
  #Domain-N: Domain Name    → ONLY on FIRST page of each domain
  ##Subdomain-N.M: Name     → ONLY on FIRST page of each subdomain
  ###Specific Topic Heading → EVERY topic heading, EVERY page
RULES:
• NEVER use **bold** as heading — ALWAYS ### prefix
• Reference books ONLY — zero training data
• ~${cfg.words} words/page, ${cfg.minL}–${cfg.maxL} lines/paragraph
• Last line every page: SOURCE: Book Title | Chapter: name | Pages: range
• NO MCQs unless instructed
${rules}
Total: ${cfg.pages} pages. Do NOT generate yet. Reply ONLY: RULES ACKNOWLEDGED — READY FOR OUTLINE`,

      autoDetectDomains: `The exam outline has been uploaded.
TASK: Extract ALL official exam domains with percentage weights.
Return ONLY:
Domain 1: [Exact Name] – [Weight]%
Domain 2: [Exact Name] – [Weight]%
(all domains, weights total 100%, no extra text)`,

      domainMapWithWeights: (domainAlloc) => `Outline uploaded. Create the complete domain map.
DOMAIN WEIGHTS:
${domainAlloc.map((d,i) => `  Domain-${i+1}: "${d.domain}" — ${d.weight.toFixed(1)}% → ${d.pages} pages (p${d.startPage}–${d.endPage})`).join('\n')}
Format:
#Domain-1: Exact Domain Name
##Subdomain-1.1: Subdomain Name — Pages 1–8
Rules: # for Domain only, ## for Subdomain only. List ALL subdomains.`,

      booksAck: `All reference books uploaded. READ ALL BOOKS NOW.
HEADING RULES (memorize, apply forever):
• #Domain-N: Name     → ONLY on first page of each domain
• ##Subdomain-N.M: Name → ONLY on first page of each subdomain
• ###Topic Heading   → EVERY topic section, EVERY page
• NEVER **bold** as heading
${rules}
List each book filename, then reply: REFERENCE BOOKS CONFIRMED — READY TO GENERATE`,

      referenceReminder: `MID-SESSION REMINDER:
#Domain once | ##Subdomain once | ###heading ALWAYS (never bold, never plain text)
Reference books ONLY.
${rules}
Reply: REMINDER ACKNOWLEDGED`,

      domainIntro: (domainName, domainIdx, domainPages, startPage, endPage, subdomains) => {
        return `NEW DOMAIN STARTING. Write ONCE on page ${startPage} ONLY:
#Domain-${domainIdx}: ${domainName}
Pages ${startPage}–${endPage} (${domainPages} pages). Subdomains:
${subdomains.map((s,i) => `  ${i+1}. ${s}`).join('\n')}
${rules}
Reply: DOMAIN "${domainName}" CONFIRMED — READY`;
      },

      page: (pg, domainIdx, subdomainIdx) => {
        const ctx = getPageContext(pg);
        if (!ctx) return `Write study content for page ${pg}/${cfg.pages} for "${cfg.exam}". ~${cfg.words} words. Reference only. SOURCE at end.\n${rules}\nWrite page ${pg}:`;
        const isFirstDomain = pg === ctx.domainStartPage;
        const isFirstSub = pg === ctx.startPage;
        const posInSub = pg - ctx.startPage + 1;
        const totalSubPgs = ctx.endPage - ctx.startPage + 1;
        const isLastSub = pg === ctx.endPage;
        const domainLine = `#Domain-${domainIdx}: ${ctx.domain}`;
        const subLine = `##Subdomain-${subdomainIdx}: ${ctx.subdomain}`;
        const subKey = ctx.domain + '||' + ctx.subdomain;
        if (!S.usedHeadings[subKey]) S.usedHeadings[subKey] = [];
        const usedList = S.usedHeadings[subKey];
        const bannedBlock = usedList.length > 0 ? `BANNED ###HEADINGS for "${ctx.subdomain}":\n` + usedList.map((h, i) => `  ${i+1}. "${h}"`).join('\n') : '';
        const pageAngle = posInSub === 1 ? `Start with foundational mechanisms for "${ctx.subdomain}".` : posInSub === totalSubPgs && totalSubPgs > 1 ? `Complete coverage. Advanced aspects. LAST page.` : `Continue "${ctx.subdomain}" from different angle.`;

        if (isFirstDomain && isFirstSub) {
          return `PAGE ${pg}/${cfg.pages} — NEW DOMAIN + NEW SUBDOMAIN\nWRITE FIRST (ONCE ONLY):\n${domainLine}\n${subLine}\nThen 2-3 topic sections.\n###headings: SPECIFIC — NEVER: ${FORBIDDEN}\n${bannedBlock}\n${rules}\nANGLE: ${pageAngle}\n~${cfg.words} words. SOURCE at end.\nWrite page ${pg}:`;
        }
        if (!isFirstDomain && isFirstSub) {
          return `PAGE ${pg}/${cfg.pages} — NEW SUBDOMAIN\n"${domainLine}" was on page ${ctx.domainStartPage} — DO NOT write again.\nWRITE (ONCE ONLY):\n${subLine}\nThen 2-3 topic sections.\n###headings: SPECIFIC — NEVER: ${FORBIDDEN}\n${bannedBlock}\n${rules}\nANGLE: ${pageAngle}\n~${cfg.words} words. SOURCE at end.\nWrite page ${pg}:`;
        }
        return `PAGE ${pg}/${cfg.pages} — CONTINUATION\nSubdomain: ${ctx.subdomain} | Page ${posInSub}/${totalSubPgs}${isLastSub ? ' (LAST)' : ''}\nBANNED:\n✗ "${domainLine}" — was page ${ctx.domainStartPage}\n✗ "${subLine}" — was page ${ctx.startPage}\nStart with ###[Specific Topic Heading] only.\n###headings: SPECIFIC — NEVER: ${FORBIDDEN}\n${bannedBlock}\n${rules}\nANGLE: ${pageAngle}${isLastSub ? '\nLAST page — complete all remaining concepts.' : ''}\n~${cfg.words} words. SOURCE at end.\nWrite page ${pg}:`;
      },

      retryPage: (pg, domainIdx, subdomainIdx) => {
        const ctx = getPageContext(pg);
        const isFirstDomain = ctx && pg === ctx.domainStartPage;
        const isFirstSub = ctx && pg === ctx.startPage;
        const subKey = ctx ? (ctx.domain + '||' + ctx.subdomain) : null;
        const usedList = subKey && S.usedHeadings[subKey] ? S.usedHeadings[subKey] : [];
        let headingNote = '';
        if (isFirstDomain && isFirstSub) headingNote = `Start: #Domain-${domainIdx}: ${ctx?.domain}\n##Subdomain-${subdomainIdx}: ${ctx?.subdomain}\nThen ###[Specific Topic]`;
        else if (isFirstSub) headingNote = `Start: ##Subdomain-${subdomainIdx}: ${ctx?.subdomain}\nThen ###[Specific Topic]`;
        else headingNote = `Start with ###[Specific Topic] ONLY`;
        const bannedStr = usedList.length > 0 ? 'Banned: ' + usedList.map(h => `"${h}"`).join(', ') : '';
        return `Page ${pg} invalid. Rewrite completely.\nDomain: ${ctx?.domain||'Unknown'} | Sub: ${ctx?.subdomain||'Unknown'}\n${headingNote}\n${bannedStr}\n~${cfg.words} words | Reference only | SOURCE at end\n${rules}\nWrite now:`;
      },
    };
  }

  /* ═══════════════════════════════════════════════
     TIMER
  ═══════════════════════════════════════════════ */
  let _timer = null;
  function startTimer() {
    S.startTime = Date.now(); clearInterval(_timer);
    _timer = setInterval(() => {
      const el = document.getElementById('sga-elapsed'); if (!el || !S.startTime) return;
      const s = Math.floor((Date.now() - S.startTime) / 1000);
      el.textContent = `${String(Math.floor(s/3600)).padStart(2,'0')}:${String(Math.floor((s%3600)/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;
    }, 1000);
  }
  function stopTimer() { clearInterval(_timer); _timer = null; }

  /* ═══════════════════════════════════════════════
     GPT ENGINE
  ═══════════════════════════════════════════════ */
  const GPT = {
    getInput() {
      return document.getElementById('prompt-textarea')
        || document.querySelector('.ProseMirror[contenteditable="true"]')
        || document.querySelector('[contenteditable="true"][role="textbox"]') || null;
    },
    getSend() { return document.querySelector('[data-testid="send-button"]') || document.querySelector('button[aria-label*="Send" i]') || null; },
    getStop() { return document.querySelector('[data-testid="stop-button"]') || document.querySelector('button[aria-label*="Stop" i]') || null; },
    async injectText(text) {
      let el = this.getInput(); if (!el) { await sleep(800); el = this.getInput(); }
      if (!el) { log('Textarea not found', 'error'); return false; }
      try { el.focus(); await sleep(40); el.innerHTML = ''; el.dispatchEvent(new Event('input', {bubbles:true})); await sleep(60); } catch(_) {}
      try { el.focus(); document.execCommand('selectAll', false, null); document.execCommand('delete', false, null); await sleep(30); document.execCommand('insertText', false, text); await sleep(150); if ((el.textContent||el.value||'').trim().length > 20) return true; } catch(_) {}
      try { const ns = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value'); if (ns && el.tagName === 'TEXTAREA') { ns.set.call(el, text); el.dispatchEvent(new Event('input', {bubbles:true})); el.dispatchEvent(new Event('change', {bubbles:true})); await sleep(150); if ((el.value||'').trim().length > 20) return true; } } catch(_) {}
      try { const fk = Object.keys(el).find(k => k.startsWith('__reactFiber')||k.startsWith('__reactInternalInstance')); if (fk) { let node = el[fk]; while (node) { if (node.memoizedProps?.onChange) { node.memoizedProps.onChange({target:{value:text}}); break; } node = node.return; } await sleep(200); if ((el.textContent||el.value||'').trim().length > 20) return true; } } catch(_) {}
      try { const dt = new DataTransfer(); dt.setData('text/plain', text); el.dispatchEvent(new ClipboardEvent('paste', {bubbles:true, cancelable:true, clipboardData:dt})); await sleep(250); if ((el.textContent||el.value||'').trim().length > 20) return true; } catch(_) {}
      try { el.focus(); el.textContent = text; el.dispatchEvent(new InputEvent('input', {bubbles:true, inputType:'insertText', data:text})); await sleep(300); return true; } catch(e) { log('All inject methods failed: '+e.message, 'error'); return false; }
    },
    async clickSend() {
      for (let i = 0; i < 30; i++) { const btn = this.getSend(); if (btn && !btn.disabled) { btn.click(); return true; } await sleep(100); }
      return false;
    },
    async send(text) {
      const el = this.getInput();
      if (el) { try { el.innerHTML = ''; el.dispatchEvent(new Event('input',{bubbles:true})); } catch(_) {} await sleep(50); }
      const ok = await this.injectText(text); if (!ok) throw new Error('Text injection failed');
      await sleep(150); const sent = await this.clickSend(); if (!sent) throw new Error('Send button failed');
      await sleep(200);
    },
    isStreaming() { if (this.getStop()) return true; if (document.querySelector('[class*="result-streaming"]')) return true; return false; },
    countMsgs() { return document.querySelectorAll('[data-message-author-role="assistant"]').length; },
    getLatest() {
      const msgs = document.querySelectorAll('[data-message-author-role="assistant"]'); if (!msgs.length) return '';
      const last = msgs[msgs.length - 1];
      for (const sel of ['.markdown.prose', '.markdown', '.prose', '[class*="markdown"]', '.whitespace-pre-wrap']) {
        const el = last.querySelector(sel); if (el && el.textContent.trim().length > 5) return el.textContent.trim();
      }
      return last.textContent.trim();
    },
    waitForDone(timeoutMs) {
      const timeout = timeoutMs || S.timeoutMs;
      return new Promise((resolve, reject) => {
        const start = Date.now(); const initCount = this.countMsgs();
        let lastLen = 0, stable = 0, started = false, stoppedAt = 0, lastText = '';
        const POLL_MS = 300, STOP_GRACE = 400, STABLE_NEED = 2;
        const t = setInterval(() => {
          if (S.paused) return;
          if (Date.now() - start > timeout) { clearInterval(t); reject(new Error(`Timeout after ${Math.round(timeout/1000)}s`)); return; }
          const streaming = this.isStreaming(); const count = this.countMsgs(); const text = this.getLatest(); const len = text.length;
          if (!started) { if (streaming || count > initCount) { started = true; lastLen = len; lastText = text; } lastLen = len; return; }
          if (streaming) { stable = 0; stoppedAt = 0; lastLen = len; lastText = text; return; }
          if (stoppedAt === 0 && len > 0) { stoppedAt = Date.now(); lastLen = len; lastText = text; }
          if (stoppedAt > 0 && Date.now() - stoppedAt < STOP_GRACE) return;
          if (len > 0 && len === lastLen && text === lastText) { stable++; if (stable >= STABLE_NEED) { clearInterval(t); S.lastResponse = text; resolve(text); } }
          else { stable = 0; lastLen = len; lastText = text; }
        }, POLL_MS);
        S.watcherTimer = t;
      });
    },
    triggerUpload() {
      const plusSelectors = ['[data-testid="composer-plus-btn"]','[data-testid="composer-attach-btn"]','button[aria-label*="attach" i]','button[aria-label*="upload" i]','button[aria-label*="add" i]','button[aria-label*="paperclip" i]'];
      let plusBtn = null;
      for (const sel of plusSelectors) { const el = document.querySelector(sel); if (el) { plusBtn = el.closest('button') || el; break; } }
      if (!plusBtn) {
        const fi = document.querySelector('input[type="file"]'); if (fi) { fi.click(); return; }
        toast('📎 Click + manually in ChatGPT', 'warning', 8000); return;
      }
      plusBtn.click();
      setTimeout(() => {
        for (const el of document.querySelectorAll('[role="menuitem"],[role="option"],button,li')) {
          if (!el.offsetParent) continue;
          const t = (el.textContent||el.getAttribute('aria-label')||'').toLowerCase();
          if (t.includes('upload') || t.includes('computer') || t.includes('file')) { el.click(); setTimeout(() => { const fi = document.querySelector('input[type="file"]'); if (fi) fi.click(); }, 400); return; }
        }
        const fi = document.querySelector('input[type="file"]'); if (fi) fi.click();
      }, 600);
    },
  };

  /* ═══════════════════════════════════════════════
     GEMINI CROSS-TAB IMAGE GENERATION
  ═══════════════════════════════════════════════ */
  const GEMINI = {
    tabRef: null,
    imageStats: { generated:0, saved:0, failed:0 },
    _sharedImages: [], // images captured from Gemini tab via BroadcastChannel

    init() {
      // Listen for images posted from Gemini tab
      try {
        this._bc = new BroadcastChannel('sga_gemini_bridge');
        this._bc.onmessage = (ev) => {
          if (ev.data?.type === 'IMAGE_READY') {
            this._sharedImages.push(ev.data);
            log(`Gemini image received: ${ev.data.topic}`, 'img');
          }
        };
      } catch(e) {}
    },

    buildImagePrompt(examType, topic, subCtx) {
      const BW = `STYLE — BLACK AND WHITE ONLY:
- Grayscale only, no color
- Solid lines for primary elements, dashed for secondary
- Bold black labels with leader lines and arrows
- Professional scientific textbook quality`;

      const prompts = {
        math: `Draw a precise B&W mathematical diagram for: "${topic}".\n${BW}\n- Coordinate axes with arrows and tick marks, curves precisely drawn\n- Label all key points, intercepts, asymptotes\nGenerate now.`,
        physics: `Draw a precise B&W physics diagram for: "${topic}".\n${BW}\n- Force arrows labeled, standard IEEE circuit symbols\n- All measurements and units labeled\nGenerate now.`,
        chemistry: `Draw a precise B&W chemistry diagram for: "${topic}".\n${BW}\n- Molecular structure with bond angles, reaction mechanism with curved arrows\nGenerate now.`,
        biology: `Draw a precise B&W biology diagram for: "${topic}".\n${BW}\n- Cell/organism with all structures labeled via leader lines\nGenerate now.`,
        anatomy: `Draw a precise B&W anatomical atlas-style diagram for: "${topic}".\n${BW}\n- All anatomical structures labeled with leader lines\nGenerate now.`,
        medical: `Draw a precise B&W medical diagram for: "${topic}".\n${BW}\n- Anatomical structure or pathophysiology flowchart\nGenerate now.`,
        economics: `Draw a precise B&W economics diagram for: "${topic}".\n${BW}\n- P on y-axis, Q on x-axis, D downward solid, S upward dashed, equilibrium marked\nGenerate now.`,
        networking: `Draw a precise B&W network topology diagram for: "${topic}".\n${BW}\n- Standard network symbols, labeled devices and connections\nGenerate now.`,
        programming: `Draw a precise B&W algorithm flowchart for: "${topic}".\n${BW}\n- Oval=start/end, rectangle=process, diamond=decision, all labeled\nGenerate now.`,
        engineering: `Draw a precise B&W engineering diagram for: "${topic}".\n${BW}\n- Standard engineering symbols, dimensions, free body diagram\nGenerate now.`,
      };
      return prompts[examType] || `Draw a precise B&W academic diagram for: "${topic}" (${subCtx || 'General'}). Professional textbook quality. All elements labeled. Generate now.`;
    },

    generateAsciiFallback(examType, topic) {
      const fallbacks = {
        math: `[GRAPH: ${topic}]\n    y\n    |\n    |  f(x)\n    | /\n    |/______ x\n    O\n[Coordinate system for ${topic}]`,
        physics: `[DIAGRAM: ${topic}]\n    F→  ┌────┐\n  ─────│ m  │─────\n        └────┘\n[Force diagram for ${topic}]`,
        chemistry: `[REACTION: ${topic}]\n  Reactants → [TS] → Products\n     ΔH = activation energy\n[Reaction profile for ${topic}]`,
        economics: `[CHART: ${topic}]\n   P│ S\n    │  \\\n   P*│....X\n    │  /\n    │ D\n    └────── Q\n[Supply-Demand for ${topic}]`,
        networking: `[NETWORK: ${topic}]\n  [Client]──[Switch]──[Router]──[Internet]\n[Network topology for ${topic}]`,
        history: `[TIMELINE: ${topic}]\n  ────────────────────────────────────────\n  1800     1850     1900     1950\n   │        │        │        │\n[Historical timeline for ${topic}]`,
        biology: `[DIAGRAM: ${topic}]\n  ┌──────────────────────┐\n  │    Cell/Organism     │\n  │  ┌──────┐ ┌───────┐  │\n  │  │ Part1│ │ Part2 │  │\n  └──────────────────────┘\n[Biological structure: ${topic}]`,
      };
      return fallbacks[examType] || `[FIGURE: ${topic}]\n[See reference book for visual illustration of ${topic}]`;
    },

    async openGeminiTab() {
      try {
        this.tabRef = GM_openInTab('https://gemini.google.com/app', {active: false, insert: true});
        log('Gemini tab opened', 'img');
        await sleep(4000);
        return true;
      } catch(e) {
        log('Cannot open Gemini tab: '+e.message, 'warn');
        return false;
      }
    },

    showPanel(topic) {
      const panel = document.getElementById('sga-gemini-panel');
      const topicEl = document.getElementById('sga-gp-topic');
      const timerEl = document.getElementById('sga-gp-timer');
      const preview = document.getElementById('sga-gp-preview');
      if (panel) panel.classList.add('visible');
      if (topicEl) topicEl.textContent = topic || 'Generating...';
      if (timerEl) timerEl.textContent = '0s elapsed';
      if (preview) preview.innerHTML = '';
      const statsBar = document.getElementById('sga-img-stats');
      if (statsBar) statsBar.classList.add('visible');
    },

    hidePanel() {
      const panel = document.getElementById('sga-gemini-panel');
      if (panel) panel.classList.remove('visible');
    },

    updateTimer(seconds) {
      const el = document.getElementById('sga-gp-timer');
      if (el) el.textContent = `${seconds}s elapsed`;
    },

    updateStats() {
      const c = document.getElementById('sga-img-count'); if (c) c.textContent = this.imageStats.generated;
      const s = document.getElementById('sga-img-saved'); if (s) s.textContent = this.imageStats.saved;
      const f = document.getElementById('sga-img-failed'); if (f) f.textContent = this.imageStats.failed;
    },

    // Check if running in Gemini tab — if so, inject the image bridge
    checkIfGeminiAndBridge() {
      const host = window.location.hostname;
      if (!host.includes('gemini')) return;
      // Inject image capture bridge in Gemini tab
      // This runs when the script is active on gemini.google.com
      const bridgeKey = 'sga_gemini_pending';
      const pending = sessionStorage.getItem(bridgeKey);
      if (!pending) return;
      const task = JSON.parse(pending);
      sessionStorage.removeItem(bridgeKey);
      log('Gemini bridge: processing image task: ' + task.topic, 'img');

      (async () => {
        try {
          // Send prompt to Gemini
          await this.sendPromptToGemini(task.prompt);
          await sleep(3000);
          // Wait for image
          const img = await this.waitForGeminiImage(task.waitMs * 1000 || 120000);
          if (img) {
            const b64 = await this.imgToB64(img);
            // Broadcast back to parent tab
            try {
              const bc = new BroadcastChannel('sga_gemini_bridge');
              bc.postMessage({type:'IMAGE_READY', topic:task.topic, dataUrl:b64, src:img.src, page:task.page});
              bc.close();
            } catch(e) {}
            log('Gemini bridge: image sent back', 'img');
          }
        } catch(e) {
          log('Gemini bridge error: '+e.message, 'warn');
        }
      })();
    },

    async sendPromptToGemini(prompt) {
      // Find Gemini's text input
      const selectors = ['rich-textarea .ql-editor', 'div[contenteditable="true"]', 'textarea', '.ql-editor'];
      let input = null;
      for (const sel of selectors) { input = document.querySelector(sel); if (input) break; }
      if (!input) { await sleep(3000); for (const sel of selectors) { input = document.querySelector(sel); if (input) break; } }
      if (!input) throw new Error('Gemini input not found');
      input.focus();
      document.execCommand('selectAll', false, null);
      document.execCommand('insertText', false, prompt);
      await sleep(600);
      // Click send
      const sendSelectors = ['button[aria-label*="Send"]', 'button[aria-label*="send"]', 'mat-icon[data-mat-icon-name="send"]', '[data-testid="send-button"]'];
      for (const sel of sendSelectors) {
        const btn = document.querySelector(sel);
        if (btn) { const b = btn.closest('button') || btn; b.click(); return; }
      }
      input.dispatchEvent(new KeyboardEvent('keydown', {key:'Enter', bubbles:true}));
    },

    async waitForGeminiImage(timeoutMs) {
      const start = Date.now(); let lastLen = 0; let stableCount = 0;
      return new Promise((resolve, reject) => {
        const check = setInterval(() => {
          if (Date.now() - start > timeoutMs) { clearInterval(check); reject(new Error('Gemini image timeout')); return; }
          // Look for generated images
          const imgs = [...document.querySelectorAll('img')].filter(img => {
            const src = img.src || '';
            if (!src) return false;
            if (src.includes('blob:') || src.includes('data:')) return false;
            const w = img.naturalWidth || img.width || 0;
            const h = img.naturalHeight || img.height || 0;
            if (w > 200 && h > 200) return true;
            return false;
          });
          if (imgs.length > 0) {
            const img = imgs[imgs.length - 1];
            // Wait for stable (not still loading)
            if (img.complete && img.naturalWidth > 200) { clearInterval(check); setTimeout(() => resolve(img), 800); }
          }
        }, 1200);
      });
    },

    async imgToB64(imgEl) {
      return new Promise((resolve, reject) => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = imgEl.naturalWidth || imgEl.width || 800;
          canvas.height = imgEl.naturalHeight || imgEl.height || 600;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(imgEl, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/png'));
        } catch(e) {
          const src = imgEl.src;
          GM_xmlhttpRequest({ method:'GET', url:src, responseType:'blob',
            onload: r => { const reader = new FileReader(); reader.onload = ev => resolve(ev.target.result); reader.readAsDataURL(r.response); },
            onerror: () => reject(new Error('Cannot fetch image')) });
        }
      });
    },

    async generatePageImages(pg, ctx, examType, cfg, pageText) {
      if (!cfg.imagesEnabled) return [];
      const dna = VDNA[examType] || VDNA.general;
      if (!dna.images || dna.imageWhen === 'never') return [];
      const subjectCtx = ctx ? ctx.subdomain : 'General';
      const results = [];

      // Determine topics needing images
      let topics = [];
      if (dna.imageWhen === 'always') {
        const ht = (pageText.match(/^#{3}\s+(.+)$/mg) || []).map(h => h.replace(/^#+\s*/, '').trim());
        const limit = cfg.imgPerPage > 0 ? cfg.imgPerPage : 1;
        topics = (ht.length > 0 ? ht.slice(0, limit) : [subjectCtx]);
      } else {
        // Use first ###heading or subdomain context
        const ht = (pageText.match(/^#{3}\s+(.+)$/mg) || []).map(h => h.replace(/^#+\s*/, '').trim());
        topics = ht.length > 0 ? [ht[0]] : [subjectCtx];
      }

      for (const topic of topics) {
        if (!S.running) break;
        log(`Generating Gemini image: "${topic}"`, 'img');
        setStatus('imaging', 'Generating Image');
        addFeedEntry(pg, 'img', `p${pg} — 🎨 ${topic.slice(0, 25)}`);
        this.showPanel(topic);

        const prompt = this.buildImagePrompt(examType, topic, subjectCtx);

        try {
          // Store task for Gemini tab to pick up
          const task = { topic, prompt, waitMs: cfg.geminiWaitMs, page: pg };
          sessionStorage.setItem('sga_gemini_pending', JSON.stringify(task));

          // Check if Gemini tab already open
          if (!this.tabRef) await this.openGeminiTab();

          // Wait for image to come back via BroadcastChannel
          const imgData = await this.waitForBridgeImage(topic, cfg.geminiWaitMs * 1000);

          if (imgData) {
            results.push({ topic, dataUrl: imgData.dataUrl, src: imgData.src || '', page: pg });
            this.imageStats.generated++;
            this.imageStats.saved++;
            this.updateStats();
            log(`✓ Gemini image received: "${topic}"`, 'img');
            toast(`🎨 Image: ${topic.slice(0, 30)}`, 'purple', 4000);
            const preview = document.getElementById('sga-gp-preview');
            if (preview && imgData.dataUrl) preview.innerHTML = `<img src="${imgData.dataUrl}"/>`;
          } else {
            throw new Error('No image received from Gemini');
          }
        } catch(e) {
          log(`Gemini image failed for "${topic}": ${e.message} — using ASCII fallback`, 'warn');
          this.imageStats.failed++;
          this.updateStats();
          const ascii = this.generateAsciiFallback(examType, topic);
          results.push({ topic, dataUrl: null, src: null, asciiArt: ascii, page: pg });
        }
        this.hidePanel();
        setStatus('running', 'Running');
      }

      S.generatedImages.push(...results);
      const si = document.getElementById('sga-stat-images'); if (si) si.textContent = S.generatedImages.length;
      return results;
    },

    async waitForBridgeImage(topic, timeoutMs) {
      return new Promise((resolve) => {
        const start = Date.now();
        const timerInt = setInterval(() => {
          this.updateTimer(Math.floor((Date.now() - start) / 1000));
        }, 1000);
        const check = setInterval(() => {
          if (Date.now() - start > timeoutMs) { clearInterval(check); clearInterval(timerInt); resolve(null); return; }
          const idx = this._sharedImages.findIndex(img => img.topic === topic);
          if (idx >= 0) {
            const img = this._sharedImages.splice(idx, 1)[0];
            clearInterval(check); clearInterval(timerInt); resolve(img);
          }
        }, 800);
      });
    },
  };

  /* ═══════════════════════════════════════════════
     GOOGLE DOCS POSTER
  ═══════════════════════════════════════════════ */
  const DOCS = {
    async post(rawContent, section, cfg) {
      let content = String(rawContent || '').replace(/^\n+/, '').replace(/\n+$/, '');
      if (!content || content.length < 2) { log(`Empty content for "${section}" — skipping`, 'warn'); return; }
      log(`Posting to Docs: "${section}" — ${content.length} chars`, 'info');
      if (content.length > 40000) {
        const paragraphs = content.split('\n\n');
        let chunk = '', idx = 1;
        for (const para of paragraphs) {
          const addition = para + '\n\n';
          if (chunk.length > 0 && (chunk.length + addition.length) > 40000) {
            await this.sendWithRetry(chunk, `${section} (Part ${idx})`, cfg); chunk = addition; idx++;
          } else { chunk += addition; }
        }
        if (chunk.replace(/\n/g,'').trim()) await this.sendWithRetry(chunk, `${section} (Part ${idx})`, cfg);
        return;
      }
      await this.sendWithRetry(content, section, cfg);
    },
    async postImage(imageRecord, section, cfg) {
      if (!imageRecord) return;
      const payload = { secret: String(cfg.secret).trim(), docId: String(cfg.docId).trim(), action: 'appendImage', section: String(section||'').trim(), imageCaption: imageRecord.topic||'Generated Diagram', imageSrc: imageRecord.src||'', imageData: imageRecord.dataUrl||'', asciiArt: imageRecord.asciiArt||'' };
      try { await this._sendRaw(JSON.stringify(payload), cfg); log(`✓ Image saved to Docs: "${imageRecord.topic}"`, 'img'); }
      catch(e) {
        log(`Image save failed: ${e.message}`, 'warn');
        if (imageRecord.asciiArt) await this.post(`\n📊 FIGURE: ${imageRecord.topic}\n\`\`\`\n${imageRecord.asciiArt}\n\`\`\`\n`, section, cfg);
        else await this.post(`\n[📊 DIAGRAM: ${imageRecord.topic}]\n`, section, cfg);
      }
    },
    async sendWithRetry(content, section, cfg) {
      let lastErr = '';
      for (let attempt = 1; attempt <= 5; attempt++) {
        try { await this.sendChunk(content, section, cfg); log(`✓ Saved: "${section}"`, 'ok'); return; }
        catch(e) { lastErr = e.message; log(`Docs attempt ${attempt}/5 failed: ${e.message}`, 'warn'); if (attempt < 5) await sleep(Math.min(2000*attempt, 12000)); }
      }
      log(`DOCS SAVE FAILED: "${section}": ${lastErr}`, 'error'); toast(`⚠ Save failed: ${section.slice(0,40)}`, 'error', 10000);
    },
    sendChunk(content, section, cfg) {
      if (!cfg.url || !cfg.docId || !cfg.secret) return Promise.reject(new Error('Missing URL/DocID/Secret'));
      const payload = { secret: String(cfg.secret).trim(), docId: String(cfg.docId).trim(), action: 'append', section: String(section||'').trim(), content: String(content||'') };
      return this._sendRaw(JSON.stringify(payload), cfg);
    },
    _sendRaw(rawData, cfg) {
      return new Promise((resolve, reject) => {
        GM_xmlhttpRequest({ method:'POST', url:cfg.url, headers:{'Content-Type':'application/json; charset=UTF-8','Accept':'application/json, */*'}, data:rawData, timeout:90000,
          onload: r => {
            if (r.status >= 200 && r.status < 400) { try { const resp = JSON.parse(r.responseText||'{}'); if (resp.status==='error') { reject(new Error('Apps Script error: '+(resp.message||'unknown'))); return; } } catch(_) {} resolve(); }
            else reject(new Error(`HTTP ${r.status}`));
          },
          onerror: () => reject(new Error('Network error')), ontimeout: () => reject(new Error('Timeout')),
        });
      });
    },
    async testConnection(cfg) {
      return new Promise((resolve, reject) => {
        GM_xmlhttpRequest({ method:'POST', url:cfg.url, headers:{'Content-Type':'application/json'}, data:JSON.stringify({secret:String(cfg.secret||'').trim(),docId:String(cfg.docId||'').trim(),action:'ping'}), timeout:15000,
          onload: r => { if (r.status >= 200 && r.status < 400) resolve(r.responseText); else reject(new Error(`HTTP ${r.status}`)); },
          onerror: () => reject(new Error('Network unreachable')), ontimeout: () => reject(new Error('Connection timed out')),
        });
      });
    },
  };

  /* UTILITIES */
  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
  function checkPause() {
    return new Promise(resolve => {
      if (!S.paused) return resolve();
      log('Paused — click Resume to continue', 'warn'); setPhaseLabel('⏸ Paused');
      const t = setInterval(() => { if (!S.paused || !S.running) { clearInterval(t); if (S.running) log('Resumed ✓', 'ok'); resolve(); } }, 500);
      S.pauseResolver = () => { clearInterval(t); resolve(); };
    });
  }
  function waitForFlag(fn, label, ms=900000) {
    return new Promise((resolve, reject) => {
      const start = Date.now();
      const t = setInterval(() => {
        if (!S.running) { clearInterval(t); reject(new Error('Stopped by user')); return; }
        if (fn()) { clearInterval(t); resolve(); return; }
        if (Date.now() - start > ms) { clearInterval(t); reject(new Error('Timeout: ' + label)); }
      }, 700);
    });
  }
  function validateResponse(text, cfg) {
    if (!text || text.trim().length < cfg.minResp) return { valid:false, reason:`Too short: ${text?text.length:0} chars` };
    if (/REFERENCE_NOT_FOUND\s*:/i.test(text)) return { valid:false, reason:'MISSING_REFERENCE', isMissingRef:true, excerpt:text.slice(0,400) };
    const refusals = [/no (files?|documents?|books?|PDFs?) (were|have been|are) (uploaded|attached|provided)/i, /I don't have access to any (uploaded|attached|provided) (files?|documents?|books?)/i];
    for (const p of refusals) { if (p.test(text)) return { valid:false, reason:'GPT says no files uploaded' }; }
    return { valid:true };
  }

  /* ═══════════════════════════════════════════════
     SG PIPELINE RUNNER
  ═══════════════════════════════════════════════ */
  async function runSGPipeline(exam, cfg) {
    log('Starting 11-step StudyGuide pipeline...', 'hi');
    S.phase = PHASE.SG_PIPELINE; S.sgPipelineData = {}; S.sgPipelineStep = 0;
    for (let i = 0; i < SG_STEPS.length; i++) {
      if (!S.running) break;
      await checkPause(); if (!S.running) break;
      const step = SG_STEPS[i];
      S.sgPipelineStep = i;
      setSGStep(i, 'active');
      setPhaseLabel(`Pipeline: ${step.label}`);
      log(`⚡ Pipeline step ${i+1}/11: ${step.label}`, 'hi');
      try {
        const prompt = buildSGPrompt(step.id, exam, S.sgPipelineData);
        await GPT.send(prompt);
        const resp = await GPT.waitForDone(90000);
        // Extract JSON
        let parsed = null;
        const jm = resp.match(/```json\s*([\s\S]*?)```/) || resp.match(/```\s*([\s\S]*?)```/) || resp.match(/(\{[\s\S]*\})/);
        if (jm) { try { parsed = JSON.parse(jm[1].trim()); } catch(_) {} }
        if (!parsed) { try { parsed = JSON.parse(resp.trim()); } catch(_) {} }
        S.sgPipelineData[step.id] = parsed || { raw: resp };
        setSGStep(i, 'done');
        log(`✔ Pipeline step ${i+1}: ${step.label}`, 'ok');
        // Post to Google Docs
        try {
          const sectionLabel = `ANALYSIS — ${step.label}`;
          const content = JSON.stringify(S.sgPipelineData[step.id], null, 2);
          await DOCS.post(`\n### ${sectionLabel}\n\`\`\`json\n${content}\n\`\`\`\n`, sectionLabel, cfg);
        } catch(e) { log(`Pipeline step save failed: ${e.message}`, 'warn'); }
      } catch(e) {
        log(`Pipeline step ${i+1} error: ${e.message}`, 'warn');
        setSGStep(i, 'error');
        S.sgPipelineData[step.id] = { error: e.message };
      }
      await sleep(800);
    }
    log('StudyGuide pipeline complete ✓', 'ok');
    toast('✓ 11-step StudyGuide analysis complete!', 'success', 6000);
  }

  /* MISSING REF POPUP */
  function showMissingRefPopup(pg, ctx, gptExcerpt) {
    return new Promise(resolve => {
      const overlay = document.getElementById('sga-misref-overlay');
      const pageInfo = document.getElementById('mr-page-info');
      const gptSays = document.getElementById('mr-gpt-excerpt');
      const confirmRow = document.getElementById('mr-confirm-row');
      const btnUpload = document.getElementById('mr-btn-upload');
      const btnSkip = document.getElementById('mr-btn-skip');
      const btnConfirm = document.getElementById('mr-btn-confirm');
      const mrStatus = document.getElementById('mr-status');
      const btnMin = document.getElementById('mr-btn-minimize');
      if (!overlay) { resolve({action:'skip'}); return; }
      overlay.classList.remove('minimized');
      if (confirmRow) confirmRow.classList.remove('visible');
      if (btnConfirm) { btnConfirm.classList.remove('visible'); btnConfirm.style.display = 'none'; }
      if (mrStatus) { mrStatus.textContent = ''; mrStatus.className = 'mr-status'; }
      const subName = ctx ? ctx.subdomain : '?';
      if (pageInfo) pageInfo.textContent = `Page ${pg} — ${ctx?ctx.domain:'?'} → ${subName}`;
      if (gptSays) gptSays.textContent = gptExcerpt ? gptExcerpt.slice(0, 300) : 'GPT could not find this content.';
      overlay.classList.remove('hidden');
      setStatus('error', 'Reference Missing');
      function cleanup() {
        overlay.classList.add('hidden'); overlay.classList.remove('minimized');
        if (btnUpload) btnUpload.removeEventListener('click', onUpload);
        if (btnSkip) btnSkip.removeEventListener('click', onSkip);
        if (btnConfirm) btnConfirm.removeEventListener('click', onConfirm);
        if (btnMin) btnMin.removeEventListener('click', onMinimize);
      }
      function onMinimize() { overlay.classList.toggle('minimized'); if (btnMin) btnMin.textContent = overlay.classList.contains('minimized') ? '▲' : '—'; }
      async function onUpload() {
        try { await GPT.send(`New reference book uploading for "${subName}". Wait for upload.`); await GPT.waitForDone(20000); } catch(e) {}
        GPT.triggerUpload();
        overlay.classList.add('minimized'); if (btnMin) btnMin.textContent = '▲';
        if (confirmRow) confirmRow.classList.add('visible');
        if (btnConfirm) { btnConfirm.classList.add('visible'); btnConfirm.style.display = 'block'; }
        if (mrStatus) { mrStatus.textContent = 'Upload book → expand panel → click Confirm'; mrStatus.className = 'mr-status active'; }
      }
      async function onConfirm() {
        if (mrStatus) { mrStatus.textContent = 'Asking GPT...'; mrStatus.className = 'mr-status active'; }
        if (btnConfirm) btnConfirm.disabled = true;
        try {
          await GPT.send(`New book uploaded. Can you now find content about "${subName}"? If yes: CONTENT_CONFIRMED. If no: explain.`);
          const resp = await GPT.waitForDone(60000);
          if (/CONTENT_CONFIRMED/i.test(resp)) {
            if (mrStatus) { mrStatus.textContent = '✓ Confirmed — resuming'; mrStatus.className = 'mr-status ok'; }
            toast('✓ Content confirmed! Resuming...', 'success', 5000);
            await sleep(1200); cleanup(); resolve({action:'resume'});
          } else {
            overlay.classList.remove('minimized'); if (btnMin) btnMin.textContent = '—';
            if (mrStatus) { mrStatus.textContent = 'GPT still cannot find this. Try different book or skip.'; mrStatus.className = 'mr-status warn'; }
            if (gptSays) gptSays.textContent = resp.slice(0, 300);
            if (btnConfirm) btnConfirm.disabled = false;
          }
        } catch(e) { if (mrStatus) { mrStatus.textContent = 'Error — try again'; mrStatus.className = 'mr-status warn'; } if (btnConfirm) btnConfirm.disabled = false; }
      }
      function onSkip() {
        log(`Skipping subdomain: "${subName}"`, 'warn'); toast(`Skipping: ${subName}`, 'warning', 5000);
        cleanup(); resolve({action:'skip', subdomain:subName, subStart:ctx?ctx.startPage:pg, subEnd:ctx?ctx.endPage:pg});
      }
      if (btnUpload) btnUpload.addEventListener('click', onUpload);
      if (btnSkip) btnSkip.addEventListener('click', onSkip);
      if (btnConfirm) btnConfirm.addEventListener('click', onConfirm);
      if (btnMin) btnMin.addEventListener('click', onMinimize);
    });
  }

  /* ═══════════════════════════════════════════════
     MAIN WORKFLOW
  ═══════════════════════════════════════════════ */
  async function runWorkflow() {
    const errs = validateCfg();
    if (errs.length) { errs.forEach(e => log(e, 'error')); toast('Fix errors before starting', 'error'); return; }
    const cfg = getCfg();
    const examType = detectExamType(cfg.exam);
    S.examType = examType;
    const meta = EXAM_META[examType] || EXAM_META.general;
    log(`v3.0 — "${cfg.exam}" — Type: ${meta.label} ${meta.icon}`, 'hi');
    if (cfg.imagesEnabled) toast('🎨 Gemini image generation ENABLED', 'purple', 5000);

    S.maxRetries = cfg.maxRetries; S.pollMs = cfg.pollMs; S.timeoutMs = cfg.timeoutMs;
    S.running = true; S.paused = false; S.retries = 0; S.globalErrors = 0;
    S.lastSentDomain = ''; S.lastSentSubdomain = '';
    if (!S.usedHeadings) S.usedHeadings = {};
    if (!S.skippedPages) S.skippedPages = [];
    if (!S.generatedImages) S.generatedImages = [];
    GEMINI.imageStats = {generated:0, saved:0, failed:0};
    GEMINI.init();

    setStatus('running', 'Running'); setBtnStates(true); startTimer();
    const P = buildPrompts(cfg, examType);

    try {
      // STEP 1: Init
      S.phase = PHASE.SESSION_INIT; setPhaseLabel('Initializing...');
      setStep(1, ''); setStep(2, ''); setStep(3, '');
      await GPT.send(P.init); await GPT.waitForDone(); S.sessionAcked = true;
      await checkPause();

      // STEP 2: Outline upload
      S.phase = PHASE.OUTLINE_WAIT; setPhaseLabel('Awaiting Outline Upload'); setStep(1, 'active');
      const btnOC = document.getElementById('sga-btn-outline-ok'); if (btnOC) btnOC.disabled = false;
      log('>>> Upload exam outline to GPT → click Confirm Outline', 'warn');
      toast('Upload exam outline to GPT → click Confirm Outline', 'warning', 15000);
      await waitForFlag(() => S.outlineOk, 'Outline confirmation');
      log('Outline confirmed ✓', 'ok'); setStep(1, 'done');
      await checkPause(); if (!S.running) throw new Error('Stopped by user');

      // Auto-detect domains
      const userHasDomains = domainWeightRows.filter(r => r.name && r.weight > 0).length >= 2;
      if (!userHasDomains) {
        log('Auto-detecting domains...', 'hi');
        try {
          await GPT.send(P.autoDetectDomains);
          const detectResp = await GPT.waitForDone();
          const detected = parseAutoDetectedDomains(detectResp);
          if (detected.length >= 2) { autoFillDomainWeightsInUI(detected); await sleep(1500); }
          else { S.paused = true; setStatus('paused', 'Add Domains'); await checkPause(); if (!S.running) throw new Error('Stopped'); setStatus('running', 'Running'); }
        } catch(e) { log(`Auto-detect error: ${e.message}`, 'warn'); }
      }

      const domainAlloc = buildDomainAllocation(cfg.pages);
      if (domainAlloc.length === 0) { log('FATAL: No domain allocation', 'error'); toast('No domains configured.', 'error'); S.running = false; setBtnStates(false); stopTimer(); setStatus('error', 'No Domains'); return; }
      setProgress(0, cfg.pages);

      // Domain map
      S.phase = PHASE.DOMAIN_MAP;
      await GPT.send(P.domainMapWithWeights(domainAlloc));
      const dmText = await GPT.waitForDone();
      S.domainMap = dmText;
      S.parsedMap = parseDomainMap(dmText, domainAlloc);
      if (S.parsedMap.length === 0) {
        domainAlloc.forEach(d => { S.parsedMap.push({domain:d.domain,subdomain:d.domain+' — Core Topics',startPage:d.startPage,endPage:d.endPage,domainStartPage:d.startPage,domainEndPage:d.endPage,domainWeight:d.weight}); });
      }
      store.saveProgress(); await checkPause();

      // Books
      S.phase = PHASE.BOOKS_WAIT; setStep(2, 'active');
      const btnBC = document.getElementById('sga-btn-books-ok'); if (btnBC) btnBC.disabled = false;
      log('>>> Upload ALL reference books to GPT', 'warn');
      toast('Upload ALL reference books → click Confirm Books', 'warning', 15000);
      await waitForFlag(() => S.booksOk, 'Books confirmation');
      setStep(2, 'done'); await checkPause();

      S.phase = PHASE.BOOKS_ACK;
      await GPT.send(P.booksAck); await GPT.waitForDone(); S.booksAcked = true;
      await checkPause();

      // === 11-STEP SG PIPELINE ===
      await runSGPipeline(cfg.exam, cfg);
      await checkPause(); if (!S.running) throw new Error('Stopped by user');

      // === MAIN PAGE GENERATION ===
      const startPage = Math.max(1, cfg.startPage || 1);
      setProgress(startPage - 1, cfg.pages);
      S.phase = PHASE.GENERATING; setStep(3, 'active'); setPhaseLabel('Generating pages...');

      const pageMetaMap = {};
      domainAlloc.forEach((d, dIdx) => {
        const subs = S.parsedMap.filter(e => e.domain === d.domain);
        subs.forEach((sub, sIdx) => {
          const subLabel = `${dIdx+1}.${sIdx+1}`;
          for (let pg = sub.startPage; pg <= sub.endPage; pg++) { pageMetaMap[pg] = {domainIdx:dIdx+1, subdomainIdx:subLabel}; }
        });
      });

      const skippedSubdomains = new Set();

      for (let pg = startPage; pg <= cfg.pages; pg++) {
        if (!S.running) { log('Stopped', 'warn'); break; }
        await checkPause(); if (!S.running) break;

        const ctx = getPageContext(pg);
        const currentDomain = ctx ? ctx.domain : '';
        const currentSubdomain = ctx ? ctx.subdomain : '';
        const meta2 = pageMetaMap[pg] || {domainIdx:1, subdomainIdx:'1.1'};

        if (ctx && skippedSubdomains.has(ctx.domain + '||' + ctx.subdomain)) {
          S.skippedPages.push(pg); updateFeedEntry(pg, 'skipped'); setProgress(pg, cfg.pages); continue;
        }

        setPhaseLabel(`Page ${pg}/${cfg.pages}${currentDomain ? ' · ' + currentDomain.slice(0, 18) : ''}`);
        updateDomainIndicator(pg);
        addFeedEntry(pg, 'current', ctx ? `p${pg} · ${ctx.subdomain.slice(0, 25)}` : `Page ${pg}`);

        if (cfg.domainIntro && ctx && S.lastSentDomain !== currentDomain) {
          const dInfo = domainAlloc.find(d => d.domain === currentDomain);
          const subList = getSubdomainsForDomain(currentDomain);
          try {
            await GPT.send(P.domainIntro(currentDomain, meta2.domainIdx, dInfo ? dInfo.pages : 0, ctx.domainStartPage, ctx.domainEndPage, subList));
            await GPT.waitForDone(); S.lastSentDomain = currentDomain; S.lastSentSubdomain = '';
          } catch(e) { log(`Domain intro failed: ${e.message}`, 'warn'); S.lastSentDomain = currentDomain; }
          await checkPause(); if (!S.running) break;
        } else if (!cfg.domainIntro) { S.lastSentDomain = currentDomain; }

        if (cfg.refRemind && pg > startPage && (pg - startPage) % cfg.remindEvery === 0) {
          try { await GPT.send(P.referenceReminder); await GPT.waitForDone(); await sleep(600); } catch(e) {}
          await checkPause(); if (!S.running) break;
        }

        let pageSuccess = false, pageResp = '', isRetry = false, missingRefDetected = false;

        for (let attempt = 1; attempt <= cfg.maxRetries + 1; attempt++) {
          try {
            const prompt = isRetry ? P.retryPage(pg, meta2.domainIdx, meta2.subdomainIdx) : P.page(pg, meta2.domainIdx, meta2.subdomainIdx);
            await GPT.send(prompt);
            const resp = await GPT.waitForDone();
            const isMissingRef = cfg.misrefStop && isExplicitMissingSignal(resp);
            if (isMissingRef) {
              log(`⚠ Missing reference on page ${pg}`, 'warn'); missingRefDetected = true; setStatus('error', 'Reference Missing');
              const result = await showMissingRefPopup(pg, ctx, resp.slice(0, 400));
              if (result.action === 'skip') { if (ctx) skippedSubdomains.add(ctx.domain + '||' + ctx.subdomain); S.skippedPages.push(pg); updateFeedEntry(pg, 'skipped'); setProgress(pg, cfg.pages); setStatus('running', 'Running'); pageSuccess = false; break; }
              else if (result.action === 'resume') { setStatus('running', 'Running'); isRetry = true; missingRefDetected = false; continue; }
            }
            if (cfg.validateResp !== false) {
              const vld = validateResponse(resp, cfg);
              if (!vld.valid) { log(`Page ${pg} validation failed: ${vld.reason}`, 'warn'); if (attempt <= cfg.maxRetries) { isRetry = true; S.globalErrors++; await sleep(Math.min(attempt*2000, 10000)); continue; } throw new Error('Max retries: ' + vld.reason); }
            }
            pageResp = resp; pageSuccess = true; S.lastSentSubdomain = currentSubdomain; break;
          } catch(e) {
            log(`Page ${pg} attempt ${attempt} error: ${e.message}`, 'error'); S.globalErrors++; S.retries++;
            if (attempt <= cfg.maxRetries) { await sleep(Math.min(attempt*3000, 20000)); isRetry = true; }
          }
        }

        if (missingRefDetected && !pageSuccess) continue;

        if (pageSuccess) {
          const subKey2 = ctx ? (ctx.domain + '||' + ctx.subdomain) : null;
          if (subKey2) {
            if (!S.usedHeadings[subKey2]) S.usedHeadings[subKey2] = [];
            const hm = pageResp.match(/^#{3}\s+(.+)$/mg) || [];
            hm.forEach(h => { const c = h.replace(/^#{3}\s+/, '').trim(); if (c && !S.usedHeadings[subKey2].includes(c)) S.usedHeadings[subKey2].push(c); });
          }
          const sLabel = ctx ? `PAGE ${pg} — ${ctx.domain} > ${ctx.subdomain}` : `PAGE ${pg}`;
          let imageResults = [];
          if (cfg.imagesEnabled && S.running) {
            try { imageResults = await GEMINI.generatePageImages(pg, ctx, examType, cfg, pageResp); } catch(e) { log(`Image gen error on page ${pg}: ${e.message}`, 'warn'); }
          }
          try {
            await DOCS.post(pageResp, sLabel, cfg);
            for (const imgRecord of imageResults) { if (!S.running) break; await DOCS.postImage(imgRecord, `${sLabel} — Figure: ${imgRecord.topic}`, cfg); }
            S.completedPages.push(pg); S.retries = 0;
            setProgress(pg, cfg.pages); updateFeedEntry(pg, 'ok');
            log(`Page ${pg} ✓${imageResults.length > 0 ? ` + ${imageResults.length} image(s)` : ''}`, 'ok');
          } catch(e) { log(`Page ${pg} save failed: ${e.message}`, 'error'); S.completedPages.push(pg); setProgress(pg, cfg.pages); updateFeedEntry(pg, 'ok'); }
        } else if (!S.skippedPages.includes(pg)) {
          S.failedPages.push(pg); updateFeedEntry(pg, 'fail'); updateFailedUI();
          if (S.globalErrors >= S.maxGlobalErrors) {
            log('Max global errors — auto-pausing', 'error'); toast('Too many errors — paused.', 'error', 12000);
            setStatus('error', 'Too Many Errors'); S.paused = true;
            const btnP = document.getElementById('sga-btn-pause'); const btnR = document.getElementById('sga-btn-resume'); const btnRt = document.getElementById('sga-btn-retry');
            if (btnP) btnP.disabled = true; if (btnR) btnR.disabled = false; if (btnRt) btnRt.disabled = false;
            await checkPause(); setStatus('running', 'Running');
            if (btnP) btnP.disabled = false; if (btnR) btnR.disabled = true; if (btnRt) btnRt.disabled = true;
            S.globalErrors = 0;
          }
        }
        if (pg < cfg.pages && S.running) await sleep(cfg.pageDelay);
      }

      S.phase = PHASE.DONE; setStep(3, 'done'); stopTimer();
      setStatus('done', 'Complete!'); setPhaseLabel('✓ Complete');
      document.getElementById('sga-bar')?.classList.add('full');
      const imgCount = (S.generatedImages || []).length;
      log(`Complete: ${S.completedPages.length} pages | ${S.failedPages.length} failed | ${(S.skippedPages||[]).length} skipped | ${imgCount} images`, 'ok');
      toast(`✓ Done! ${S.completedPages.length} pages + ${imgCount} images!`, 'success', 15000);
      store.del('progress');

    } catch(err) {
      log('FATAL ERROR: ' + err.message, 'error'); setStatus('error', 'Error'); setPhaseLabel('Fatal Error');
      toast('Fatal error: ' + err.message, 'error', 10000);
    }

    S.running = false; setBtnStates(false);
    const btnP2 = document.getElementById('sga-btn-pause'); const btnR2 = document.getElementById('sga-btn-resume');
    if (btnP2) btnP2.disabled = true; if (btnR2) btnR2.disabled = true;
  }

  /* ═══════════════════════════════════════════════
     BUILD UI
  ═══════════════════════════════════════════════ */
  function buildUI() {
    ['sga-wrap','sga-toasts','sga-misref-overlay'].forEach(id => { const el = document.getElementById(id); if (el) el.remove(); });

    const tc = document.createElement('div'); tc.id = 'sga-toasts'; document.body.appendChild(tc);

    const mrModal = document.createElement('div');
    mrModal.id = 'sga-misref-overlay'; mrModal.className = 'hidden';
    mrModal.innerHTML = `<div id="sga-misref-box">
      <div id="sga-misref-header"><div class="mr-hdr-left"><span style="font-size:16px">⚠</span><span class="mr-hdr-title">Reference Not Found</span></div><div class="mr-hdr-btns"><button class="mr-hdr-btn min-btn" id="mr-btn-minimize" title="Minimize">—</button></div></div>
      <div id="sga-misref-box-body">
        <div class="mr-page-info" id="mr-page-info">Page ? — Domain: ? — Subdomain: ?</div>
        <div class="mr-gpt-says" id="mr-gpt-excerpt">GPT response here...</div>
        <div class="mr-instruction"><strong>📎 Upload Book:</strong> Click below → GPT upload opens → upload book → Confirm.<br>Minimize panel to access GPT.<br><strong>⏭ Skip:</strong> Skip this subdomain and continue.</div>
        <div class="mr-confirm-row" id="mr-confirm-row"><span class="mr-confirm-txt">✓ Book uploaded — click Confirm to resume</span></div>
        <div class="mr-btns">
          <button class="mr-btn-upload" id="mr-btn-upload">📎 Upload Book<span style="font-size:10px;opacity:.75;font-weight:400">Opens GPT file upload</span></button>
          <button class="mr-btn-skip" id="mr-btn-skip">⏭ Skip Subdomain<span style="font-size:10px;opacity:.75;font-weight:400">Continue with next</span></button>
          <button class="mr-btn-confirm" id="mr-btn-confirm" style="display:none">✓ Confirm Book Added — Resume Generation</button>
        </div>
        <div class="mr-status" id="mr-status"></div>
      </div></div>`;
    document.body.appendChild(mrModal);

    // SG pipeline steps HTML
    const sgStepsHtml = SG_STEPS.map((s, i) => `
      <div class="sg-pl-step" id="sga-pl-${i}">
        <span class="sg-pl-icon">${s.icon}</span>
        <span class="sg-pl-label">${s.label}</span>
        <span class="sg-pl-status">⬜</span>
      </div>`).join('');

    const wrap = document.createElement('div'); wrap.id = 'sga-wrap';
    wrap.innerHTML = `<div id="sga-panel">
      <div id="sga-header">
        <div class="sga-hbrand">
          <div class="sga-logo">⚡</div>
          <div class="sga-hinfo">
            <div class="sga-hname">StudyGuide AutoPilot</div>
            <div class="sga-hver">v${VERSION} · ExamForge ULTRA</div>
          </div>
          <span class="sga-hbadge">v3</span>
        </div>
        <div class="sga-hbtns">
          <button class="sga-hbtn" id="sga-hbtn-export" title="Export Log">📋</button>
          <button class="sga-hbtn" id="sga-hbtn-min" title="Minimize">—</button>
          <button class="sga-hbtn danger" id="sga-hbtn-close" title="Close">✕</button>
        </div>
      </div>
      <div id="sga-statusbar">
        <div id="sga-status" class="idle"><span class="s-dot pulse"></span><span id="sga-status-txt">Idle</span></div>
        <div class="sb-right">
          <span id="sga-phase-lbl">Fill config below to begin</span>
          <span id="sga-elapsed">00:00:00</span>
        </div>
      </div>
      <div id="sga-body">

        <!-- CONNECTION -->
        <div class="sga-card">
          <div class="sga-card-hdr"><div class="sga-card-title">🔗 Google Docs Connection</div><span class="sga-badge badge-req">Required</span></div>
          <div class="sga-fld"><label>Apps Script URL <span class="req">*</span></label><input id="sga-f-url" class="sga-inp" type="text" placeholder="https://script.google.com/macros/s/.../exec"/></div>
          <div class="sga-fld"><label>Google Doc ID <span class="req">*</span></label><input id="sga-f-docid" class="sga-inp" type="text" placeholder="1aBcDeFgHiJkLmNoPqRsTuVwXy"/></div>
          <div class="sga-fld"><label>Secret Key <span class="req">*</span></label><div class="sga-inp-wrap"><input id="sga-f-key" class="sga-inp" type="password" placeholder="same as Apps Script secret..."/><button class="sga-inp-action" id="sga-btn-toggle-key" tabindex="-1">👁</button></div></div>
          <div class="sga-brow"><button class="sga-btn info sm" id="sga-btn-test-conn">🧪 Test Connection</button></div>
          <div id="sga-conn-result" class="sga-conn-result hidden"><span id="sga-conn-ico">●</span><span id="sga-conn-msg"></span></div>
        </div>

        <!-- EXAM CONFIG -->
        <div class="sga-card">
          <div class="sga-card-hdr"><div class="sga-card-title">📚 Exam Configuration</div><span class="sga-badge badge-req">Required</span></div>
          <div class="sga-fld"><label>Exam Name <span class="req">*</span></label><input id="sga-f-exam" class="sga-inp" type="text" placeholder="e.g. CCNA / Organic Chemistry / Calculus II"/></div>
          <div id="sga-exam-type-banner">
            <span id="sga-exam-type-icon">📚</span>
            <span id="sga-exam-type-txt">Type exam name — auto-detected</span>
          </div>
          <div class="sga-frow">
            <div class="sga-fld"><label>Total Pages <span class="req">*</span></label><input id="sga-f-pages" class="sga-inp" type="number" placeholder="50" min="1" max="500"/><div class="sga-fhint">Split by domain weight</div></div>
            <div class="sga-fld"><label>Words / Page</label><input id="sga-f-words" class="sga-inp" type="number" placeholder="500" min="100" max="2000"/></div>
          </div>
          <div class="sga-frow">
            <div class="sga-fld"><label>Min Lines / Para</label><input id="sga-f-minl" class="sga-inp" type="number" placeholder="5" min="2" max="20"/></div>
            <div class="sga-fld"><label>Max Lines / Para</label><input id="sga-f-maxl" class="sga-inp" type="number" placeholder="7" min="2" max="30"/></div>
          </div>
          <div class="sga-fld"><label>Start From Page <span class="tip">(resume)</span></label><input id="sga-f-startpage" class="sga-inp" type="number" placeholder="1" min="1"/></div>
        </div>

        <!-- GEMINI IMAGE GENERATION -->
        <div class="sga-card">
          <div class="sga-card-hdr"><div class="sga-card-title pnk">🎨 Visual Content Generation</div><span class="sga-badge badge-v3">v3 NEW</span></div>
          <div style="font-size:10.5px;color:#94a3b8;line-height:1.6;background:rgba(236,72,153,.05);border:1px solid rgba(236,72,153,.15);border-radius:7px;padding:9px 11px;margin-bottom:10px">
            <b style="color:#ec4899">🎨 Gemini Image Generation:</b> Script opens new Gemini tab to generate diagrams, charts, anatomical figures, chemical structures, circuit diagrams — AUTOMATICALLY based on exam type.<br>
            <b style="color:#ec4899">⏳ Wait Time:</b> Gemini takes 30-120 seconds per image. Script waits patiently.<br>
            <b style="color:#ec4899">📥 Save Method:</b> Generated images are captured via DOM and sent to Google Docs.
          </div>
          <div class="sga-tog-row"><div class="sga-tog-lbl">Enable Image Generation (Gemini)<span>Opens Gemini in new tab automatically</span></div><div class="sga-toggle on" id="sga-tog-images"></div></div>
          <div class="sga-tog-row"><div class="sga-tog-lbl">Generate equations as images<span>Math/Physics/Chemistry equations rendered visually</span></div><div class="sga-toggle on" id="sga-tog-eq-images"></div></div>
          <div class="sga-tog-row"><div class="sga-tog-lbl">Generate charts/graphs<span>Data charts, supply-demand curves, bar graphs</span></div><div class="sga-toggle on" id="sga-tog-charts"></div></div>
          <div class="sga-tog-row"><div class="sga-tog-lbl">Generate diagrams/flowcharts<span>Network diagrams, anatomy, process flows</span></div><div class="sga-toggle on" id="sga-tog-diagrams"></div></div>
          <div class="sga-fld" style="margin-top:8px"><label>Max wait for Gemini (seconds)</label><input id="sga-f-gemini-wait" class="sga-inp" type="number" placeholder="120" min="30" max="600" value="120"/><div class="sga-fhint">Script waits this long for image generation</div></div>
          <div class="sga-fld"><label>Images per page <span class="tip">(0 = auto by exam type)</span></label><input id="sga-f-img-per-page" class="sga-inp" type="number" placeholder="0" min="0" max="5" value="0"/></div>
          <div id="sga-img-stats" class="hidden">
            <div><div class="img-stat-num" id="sga-img-count">0</div><div style="font-size:9.5px;color:#6d28d9">Generated</div></div>
            <div><div class="img-stat-num" id="sga-img-saved">0</div><div style="font-size:9.5px;color:#6d28d9">Saved</div></div>
            <div><div class="img-stat-num" id="sga-img-failed">0</div><div style="font-size:9.5px;color:#6d28d9">Failed</div></div>
          </div>
          <div id="sga-gemini-panel">
            <div class="gp-title"><span class="sga-spin">⟳</span> Generating Image via Gemini...</div>
            <div class="gp-topic" id="sga-gp-topic">Waiting for topic...</div>
            <div class="gp-timer" id="sga-gp-timer">0s elapsed</div>
            <div class="gp-preview" id="sga-gp-preview"></div>
          </div>
        </div>

        <!-- DOMAIN WEIGHTS -->
        <div class="sga-card">
          <div class="sga-card-hdr">
            <div class="sga-card-title org">⚖ Domain Weights</div>
            <div style="display:flex;gap:5px;align-items:center">
              <button class="sga-btn sm" style="color:#f97316;border-color:rgba(249,115,22,.3);background:rgba(249,115,22,.08)" id="sga-btn-add-domain">+ Add</button>
              <button class="sga-btn danger sm" id="sga-btn-clear-domains">🗑</button>
            </div>
          </div>
          <div style="font-size:10.5px;color:#475569;margin-bottom:8px;line-height:1.5;background:rgba(249,115,22,.05);border:1px solid rgba(249,115,22,.15);border-radius:7px;padding:8px 10px">
            <b style="color:#f97316">⚡ Auto-Detect:</b> Leave empty — after outline upload, UI auto-detects all domains+weights from GPT.
          </div>
          <div id="sga-domain-weights-container"></div>
          <div id="sga-weight-total-bar" class="weight-total-bar warn">
            <span>Total: <b id="sga-weight-total-val">0</b>%</span>
            <span id="sga-weight-total-status">Add domains or use auto-detect</span>
          </div>
        </div>

        <!-- REFERENCE ENFORCEMENT -->
        <div class="sga-card">
          <div class="sga-card-hdr"><div class="sga-card-title prp">🔒 Reference Enforcement</div><span class="sga-badge badge-act">Always On</span></div>
          <div style="background:linear-gradient(135deg,rgba(139,92,246,.06),rgba(59,130,246,.06));border:1px solid rgba(139,92,246,.2);border-radius:9px;padding:10px 12px;font-size:11px;color:#94a3b8;line-height:1.6">
            <div style="color:#8b5cf6;font-size:9.5px;font-weight:800;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px">v3 Enforced Rules</div>
            ✓ Reference books ONLY — zero training data<br>
            ✓ Domain/Subdomain headings: once on first page ONLY<br>
            ✓ Specific ###topic headings — no generic names<br>
            ✓ Math/Physics: real equations, not placeholders<br>
            ✓ Chemistry: balanced reactions with state symbols<br>
            ✓ Code: complete runnable examples with output<br>
            ✓ Missing reference → Upload/Skip popup<br>
            ✓ v3 NEW: Gemini images generated automatically
          </div>
          <div style="height:8px"></div>
          <div class="sga-tog-row"><div class="sga-tog-lbl">Reference reminder every N pages<span>Re-sends strict content rules</span></div><div class="sga-toggle on" id="sga-tog-ref-remind"></div></div>
          <div class="sga-fld" style="margin-top:6px"><label>Remind every <span class="tip">(pages)</span></label><input id="sga-f-remind-every" class="sga-inp" type="number" value="5" min="1" max="50"/></div>
          <div class="sga-tog-row"><div class="sga-tog-lbl">Validate response quality<span>Reject + retry if forbidden patterns</span></div><div class="sga-toggle on" id="sga-tog-validate"></div></div>
          <div class="sga-tog-row"><div class="sga-tog-lbl">Strip source mentions before saving</div><div class="sga-toggle on" id="sga-tog-strip"></div></div>
          <div class="sga-tog-row"><div class="sga-tog-lbl">Auto-stop on missing reference<span>Shows upload popup when GPT can't find content</span></div><div class="sga-toggle on" id="sga-tog-misref-stop"></div></div>
        </div>

        <!-- WORKFLOW STEPS -->
        <div class="sga-card">
          <div class="sga-card-hdr"><div class="sga-card-title grn">📋 Workflow Steps</div></div>
          <div class="sga-step" id="sga-step1">
            <div class="sga-step-num" id="sga-step1-num">1</div>
            <div class="sga-step-body">
              <div class="sga-step-title">Upload Exam Outline</div>
              <div class="sga-step-desc">Click GPT + → upload outline → confirm here. UI auto-detects domains.</div>
              <div class="sga-step-actions">
                <button class="sga-btn info sm" id="sga-btn-open-upload-outline">📎 Open GPT Upload</button>
                <button class="sga-btn success sm" id="sga-btn-outline-ok" disabled>✓ Confirm Outline</button>
              </div>
            </div>
          </div>
          <div class="sga-step" id="sga-step2">
            <div class="sga-step-num" id="sga-step2-num">2</div>
            <div class="sga-step-body">
              <div class="sga-step-title">Upload Reference Books</div>
              <div class="sga-step-desc">Upload ALL reference PDFs to GPT, then confirm.</div>
              <div class="sga-step-actions">
                <button class="sga-btn info sm" id="sga-btn-open-upload-books">📚 Open GPT Upload</button>
                <button class="sga-btn success sm" id="sga-btn-books-ok" disabled>✓ Confirm Books</button>
              </div>
            </div>
          </div>
          <div class="sga-step" id="sga-step3">
            <div class="sga-step-num" id="sga-step3-num">3</div>
            <div class="sga-step-body">
              <div class="sga-step-title">Auto Generate — 11-Step Pipeline + Text + Images</div>
              <div class="sga-step-desc">v3: 11-step StudyGuide analysis → Text pages + Gemini images generated automatically. Images saved to Google Docs.</div>
            </div>
          </div>
        </div>

        <!-- 11-STEP SG PIPELINE STATUS -->
        <div class="sga-card">
          <div class="sga-card-hdr"><div class="sga-card-title prp">📋 StudyGuide Pipeline (11 Steps)</div></div>
          <div id="sga-sg-pipeline-steps">
            ${sgStepsHtml}
          </div>
        </div>

        <!-- PROGRESS -->
        <div class="sga-card">
          <div class="sga-card-hdr"><div class="sga-card-title">📊 Generation Progress</div><span id="sga-pg-pct" style="font-family:monospace;font-size:12px;font-weight:700;color:#3b82f6">0%</span></div>
          <div class="sga-prog-outer"><div class="sga-prog-inner" id="sga-bar"></div></div>
          <div class="sga-prog-nums"><span id="sga-pg-phase" style="color:#475569">Waiting to start...</span><span id="sga-pg-txt">0 / 0 pages</span></div>
          <div class="sga-dp-panel" id="sga-dp-panel" style="display:none">
            <div class="sga-dp-title">📍 Current Location</div>
            <div class="sga-dp-domain" id="sga-dp-domain">—</div>
            <div class="sga-dp-sub" id="sga-dp-sub">—</div>
          </div>
          <div class="sga-stats-row">
            <div class="sga-stat-chip acc"><span>✓</span><span class="sv" id="sga-stat-done">0</span><span>done</span></div>
            <div class="sga-stat-chip red"><span>✗</span><span class="sv" id="sga-stat-failed">0</span><span>failed</span></div>
            <div class="sga-stat-chip ylw"><span>↺</span><span class="sv" id="sga-stat-retries">0</span><span>retries</span></div>
            <div class="sga-stat-chip grn"><span>~</span><span class="sv" id="sga-stat-words">0</span><span>words</span></div>
            <div class="sga-stat-chip org"><span>⏭</span><span class="sv" id="sga-stat-skipped">0</span><span>skipped</span></div>
            <div class="sga-stat-chip prp"><span>🖼</span><span class="sv" id="sga-stat-images">0</span><span>images</span></div>
          </div>
          <div style="margin-top:8px">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:5px">
              <span style="font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#475569">Recent Pages</span>
              <button class="sga-log-btn" id="sga-btn-clear-feed">Clear</button>
            </div>
            <div class="sga-page-feed" id="sga-pagefeed"></div>
          </div>
          <div class="sga-failed-box hidden" id="sga-failed-box"><b>Failed pages:</b> <span id="sga-failed-list"></span></div>
        </div>

        <!-- CONTROLS -->
        <div class="sga-card">
          <div class="sga-card-hdr"><div class="sga-card-title">🎯 Controls</div></div>
          <div class="sga-ctrl-grid">
            <button class="sga-btn primary lg" id="sga-btn-start">▶ Start Generation</button>
            <button class="sga-btn warning" id="sga-btn-pause" disabled>⏸ Pause</button>
            <button class="sga-btn" id="sga-btn-resume" disabled>▶ Resume</button>
            <button class="sga-btn info" id="sga-btn-retry" disabled>↺ Retry Page</button>
            <button class="sga-btn sm" id="sga-btn-skip" disabled>⏭ Skip Page</button>
            <button class="sga-btn danger sm" id="sga-btn-stop" disabled>⏹ Stop</button>
          </div>
          <div class="sga-divider"></div>
          <button class="sga-btn danger sm full" id="sga-btn-reset">🗑 Reset Everything</button>
        </div>

        <!-- ADVANCED -->
        <div class="sga-accordion" id="sga-acc-adv">
          <div class="sga-acc-hdr" id="sga-acc-adv-hdr"><span>⚙ Advanced Settings</span><span class="sga-acc-arrow">▼</span></div>
          <div class="sga-acc-body">
            <div class="sga-frow">
              <div class="sga-fld"><label>Poll Interval (ms)</label><input id="sga-f-poll" class="sga-inp" type="number" placeholder="300" value="300"/></div>
              <div class="sga-fld"><label>Timeout (ms)</label><input id="sga-f-timeout" class="sga-inp" type="number" placeholder="300000"/></div>
            </div>
            <div class="sga-frow">
              <div class="sga-fld"><label>Max Retries / Page</label><input id="sga-f-maxretry" class="sga-inp" type="number" placeholder="7" value="7"/></div>
              <div class="sga-fld"><label>Page Delay (ms)</label><input id="sga-f-pagedelay" class="sga-inp" type="number" placeholder="1500"/></div>
            </div>
            <div class="sga-fld"><label>Min Valid Response (chars)</label><input id="sga-f-minresp" class="sga-inp" type="number" placeholder="200" value="200"/></div>
            <div class="sga-tog-row"><div class="sga-tog-lbl">Post domain map to Google Docs</div><div class="sga-toggle on" id="sga-tog-post-dmap"></div></div>
            <div class="sga-tog-row"><div class="sga-tog-lbl">Send domain intro before each domain</div><div class="sga-toggle on" id="sga-tog-domain-intro"></div></div>
          </div>
        </div>

        <!-- LOG -->
        <div class="sga-card" style="padding:0">
          <div class="sga-log-wrap">
            <div class="sga-log-toolbar">
              <div class="sga-log-title"><span class="sga-log-live"></span>Console</div>
              <div class="sga-log-btns"><button class="sga-log-btn" id="sga-btn-log-copy">Copy</button><button class="sga-log-btn" id="sga-btn-log-clear">Clear</button></div>
            </div>
            <div id="sga-log"></div>
          </div>
        </div>
        <div style="height:4px"></div>
      </div>
    </div>`;
    document.body.appendChild(wrap);
    return wrap;
  }

  /* DRAG */
  function initDrag(wrap) {
    const hdr = document.getElementById('sga-header'); if (!hdr) return;
    let drag = false, sx, sy, ox, oy;
    hdr.addEventListener('mousedown', e => { if (e.target.closest('button')) return; drag = true; sx = e.clientX; sy = e.clientY; const r = wrap.getBoundingClientRect(); ox = r.left; oy = r.top; document.body.style.userSelect = 'none'; });
    document.addEventListener('mousemove', e => { if (!drag) return; wrap.style.left = Math.max(0, ox + e.clientX - sx) + 'px'; wrap.style.top = Math.max(0, oy + e.clientY - sy) + 'px'; wrap.style.right = 'auto'; });
    document.addEventListener('mouseup', () => { drag = false; document.body.style.userSelect = ''; });
  }

  /* EVENT BINDINGS */
  function bindEvents() {
    const g = id => document.getElementById(id);

    g('sga-hbtn-min')?.addEventListener('click', () => g('sga-panel').classList.toggle('minimized'));
    g('sga-hbtn-close')?.addEventListener('click', () => g('sga-wrap').classList.add('sga-hidden'));
    g('sga-hbtn-export')?.addEventListener('click', exportLog);
    g('sga-btn-toggle-key')?.addEventListener('click', () => { const inp = g('sga-f-key'); if (inp) inp.type = inp.type === 'password' ? 'text' : 'password'; });
    g('sga-f-exam')?.addEventListener('input', e => updateExamTypeBanner(e.target.value || ''));

    g('sga-btn-test-conn')?.addEventListener('click', async () => {
      const res = g('sga-conn-result'); res.className = 'sga-conn-result testing'; g('sga-conn-msg').textContent = 'Testing...';
      const cfg = getCfg();
      if (!cfg.url || !cfg.docId || !cfg.secret) { res.className = 'sga-conn-result error'; g('sga-conn-msg').textContent = 'Fill all 3 fields first'; return; }
      try { await DOCS.testConnection(cfg); res.className = 'sga-conn-result ok'; g('sga-conn-msg').textContent = 'Connection successful ✓'; }
      catch(e) { res.className = 'sga-conn-result error'; g('sga-conn-msg').textContent = 'Failed: ' + e.message; }
    });

    g('sga-btn-add-domain')?.addEventListener('click', () => { addDomainWeightRow('', '', false); saveDomainWeights(); });
    g('sga-btn-clear-domains')?.addEventListener('click', () => {
      if (!confirm('Clear all domain rows?')) return;
      domainWeightRows = []; const c = g('sga-domain-weights-container'); if (c) c.innerHTML = '';
      updateWeightTotal(); saveDomainWeights();
    });
    g('sga-f-pages')?.addEventListener('input', updateWeightTotal);

    g('sga-btn-open-upload-outline')?.addEventListener('click', () => GPT.triggerUpload());
    g('sga-btn-open-upload-books')?.addEventListener('click', () => GPT.triggerUpload());

    g('sga-btn-outline-ok')?.addEventListener('click', () => {
      S.outlineOk = true;
      const btn = g('sga-btn-outline-ok'); btn.disabled = true; btn.className = 'sga-btn success sm confirmed'; btn.textContent = '✓ Confirmed';
      toast('Outline confirmed!', 'success');
    });
    g('sga-btn-books-ok')?.addEventListener('click', () => {
      S.booksOk = true;
      const btn = g('sga-btn-books-ok'); btn.disabled = true; btn.className = 'sga-btn success sm confirmed'; btn.textContent = '✓ Confirmed';
      toast('Books confirmed!', 'success');
    });

    g('sga-btn-start')?.addEventListener('click', () => {
      S.outlineOk = false; S.booksOk = false;
      S.completedPages = []; S.failedPages = []; S.skippedPages = [];
      S.lastSentDomain = ''; S.lastSentSubdomain = '';
      S.usedHeadings = {}; S.usedDomainHeaders = []; S.usedSubdomainHeaders = [];
      S.generatedImages = []; S.sgPipelineData = {};
      setStep(1, ''); setStep(2, ''); setStep(3, '');
      SG_STEPS.forEach((_, i) => setSGStep(i, ''));
      ['sga-btn-outline-ok','sga-btn-books-ok'].forEach(id => { const btn = g(id); if (!btn) return; btn.disabled = true; btn.className = 'sga-btn success sm'; });
      const feed = g('sga-pagefeed'); if (feed) feed.innerHTML = '';
      GEMINI.imageStats = {generated:0, saved:0, failed:0}; GEMINI.updateStats();
      runWorkflow();
    });

    g('sga-btn-pause')?.addEventListener('click', () => {
      S.paused = true; g('sga-btn-pause').disabled = true; g('sga-btn-resume').disabled = false;
      setStatus('paused', 'Paused'); log('Paused', 'warn'); toast('Paused', 'warning');
    });
    g('sga-btn-resume')?.addEventListener('click', () => {
      S.paused = false; g('sga-btn-pause').disabled = false; g('sga-btn-resume').disabled = true; if (g('sga-btn-retry')) g('sga-btn-retry').disabled = true;
      setStatus('running', 'Running'); log('Resumed ✓', 'ok');
      if (S.pauseResolver) { S.pauseResolver(); S.pauseResolver = null; }
    });
    g('sga-btn-retry')?.addEventListener('click', () => {
      S.retries = 0; S.globalErrors = 0; S.paused = false;
      g('sga-btn-pause').disabled = false; g('sga-btn-resume').disabled = true; if (g('sga-btn-retry')) g('sga-btn-retry').disabled = true;
      setStatus('running', 'Running');
      if (S.pauseResolver) { S.pauseResolver(); S.pauseResolver = null; }
    });
    g('sga-btn-skip')?.addEventListener('click', () => { if (!S.running) return; if (S.watcherTimer) { clearInterval(S.watcherTimer); S.watcherTimer = null; } });
    g('sga-btn-stop')?.addEventListener('click', () => {
      S.running = false; S.paused = false;
      if (S.watcherTimer) { clearInterval(S.watcherTimer); S.watcherTimer = null; }
      if (S.pauseResolver) { S.pauseResolver(); S.pauseResolver = null; }
      setStatus('idle', 'Stopped'); setPhaseLabel('Stopped by user'); setBtnStates(false); stopTimer();
      toast('Stopped', 'warning');
    });
    g('sga-btn-reset')?.addEventListener('click', () => { if (!confirm('Reset everything?')) return; performReset(); });

    g('sga-btn-log-copy')?.addEventListener('click', () => {
      const txt = S.logEntries.map(e => `[${e.ts}][${e.level.toUpperCase()}] ${e.message}`).join('\n');
      try { GM_setClipboard(txt); toast('Log copied', 'success'); } catch(_) { navigator.clipboard?.writeText(txt).then(() => toast('Log copied', 'success')); }
    });
    g('sga-btn-log-clear')?.addEventListener('click', () => { const el = g('sga-log'); if (el) el.innerHTML = ''; S.logEntries = []; });
    g('sga-btn-clear-feed')?.addEventListener('click', () => { const el = g('sga-pagefeed'); if (el) el.innerHTML = ''; });
    g('sga-acc-adv-hdr')?.addEventListener('click', () => g('sga-acc-adv').classList.toggle('open'));
    document.querySelectorAll('#sga-wrap .sga-toggle').forEach(tog => tog.addEventListener('click', () => tog.classList.toggle('on')));

    const fields = ['sga-f-url','sga-f-docid','sga-f-key','sga-f-exam','sga-f-pages','sga-f-words','sga-f-minl','sga-f-maxl','sga-f-startpage','sga-f-remind-every','sga-f-poll','sga-f-timeout','sga-f-maxretry','sga-f-pagedelay','sga-f-minresp','sga-f-gemini-wait','sga-f-img-per-page'];
    fields.forEach(id => {
      const el = g(id); if (!el) return;
      const sv = store.get(id, ''); if (sv) el.value = sv;
      el.addEventListener('change', () => store.set(id, el.value));
      el.addEventListener('blur', () => store.set(id, el.value));
    });

    const savedExam = store.get('sga-f-exam', '');
    if (savedExam) setTimeout(() => updateExamTypeBanner(savedExam), 600);
  }

  /* RESET */
  function performReset() {
    S.running = false; S.paused = false;
    if (S.watcherTimer) clearInterval(S.watcherTimer);
    if (S.pauseResolver) S.pauseResolver();
    stopTimer(); S = defaultState(); store.clearAll();
    setStatus('idle', 'Idle'); setPhaseLabel('Fill config below to begin');
    setProgress(0, 0); setBtnStates(false);
    setStep(1, ''); setStep(2, ''); setStep(3, '');
    SG_STEPS.forEach((_, i) => setSGStep(i, ''));
    const g = id => document.getElementById(id);
    const btnOC = g('sga-btn-outline-ok'); if (btnOC) { btnOC.disabled = true; btnOC.className = 'sga-btn success sm'; btnOC.textContent = '✓ Confirm Outline'; }
    const btnBC = g('sga-btn-books-ok'); if (btnBC) { btnBC.disabled = true; btnBC.className = 'sga-btn success sm'; btnBC.textContent = '✓ Confirm Books'; }
    ['sga-f-url','sga-f-docid','sga-f-key','sga-f-exam','sga-f-pages','sga-f-words','sga-f-minl','sga-f-maxl','sga-f-startpage'].forEach(id => { const el = g(id); if (el) el.value = ''; });
    const logEl = g('sga-log'); if (logEl) logEl.innerHTML = '';
    const feed = g('sga-pagefeed'); if (feed) feed.innerHTML = '';
    ['sga-stat-done','sga-stat-failed','sga-stat-retries','sga-stat-words','sga-stat-skipped','sga-stat-images'].forEach(id => { const el = g(id); if (el) el.textContent = '0'; });
    const ptx = g('sga-pg-txt'); if (ptx) ptx.textContent = '0 / 0 pages';
    const ppc = g('sga-pg-pct'); if (ppc) ppc.textContent = '0%';
    const bar = g('sga-bar'); if (bar) { bar.style.width = '0%'; bar.classList.remove('full'); }
    const el2 = g('sga-elapsed'); if (el2) el2.textContent = '00:00:00';
    const cr = g('sga-conn-result'); if (cr) cr.className = 'sga-conn-result hidden';
    const fb = g('sga-failed-box'); if (fb) fb.classList.add('hidden');
    const dp = g('sga-dp-panel'); if (dp) dp.style.display = 'none';
    const etb = g('sga-exam-type-banner'); if (etb) { etb.className = ''; etb.style.display = 'none'; }
    domainWeightRows = []; const dwc = g('sga-domain-weights-container'); if (dwc) dwc.innerHTML = '';
    updateWeightTotal();
    GEMINI.imageStats = {generated:0, saved:0, failed:0}; GEMINI.updateStats();
    const imgPanel = g('sga-gemini-panel'); if (imgPanel) imgPanel.classList.remove('visible');
    const imgStats = g('sga-img-stats'); if (imgStats) imgStats.classList.remove('visible');
    toast('Reset complete', 'warning');
  }

  function exportLog() {
    const cfg = getCfg();
    const header = [`StudyGuide AutoPilot v${VERSION}`, `Exam: ${cfg.exam||'Not set'}`, `Type: ${(S.examType||'general').toUpperCase()}`, `Pages: ${S.currentPage}/${S.totalPages}`, `Done: ${S.completedPages.length} | Failed: ${S.failedPages.length} | Images: ${(S.generatedImages||[]).length}`, `Date: ${new Date().toISOString()}`, '─'.repeat(60), ''].join('\n');
    const lines = S.logEntries.map(e => `[${e.ts}][${e.level.padEnd(5)}] ${e.message}`).join('\n');
    const full = header + lines;
    try { GM_setClipboard(full); toast('Log copied', 'success'); }
    catch(_) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([full], {type:'text/plain'})); a.download = `sga-v3-log-${Date.now()}.txt`; a.click(); }
  }

  function checkRecovery() {
    const saved = store.loadProgress();
    if (!saved || saved.phase === PHASE.DONE || saved.phase === PHASE.IDLE) return;
    if (saved.phase === PHASE.GENERATING && saved.currentPage > 0) {
      if (saved.domainMap) S.domainMap = saved.domainMap;
      if (saved.parsedMap) S.parsedMap = saved.parsedMap;
      if (saved.lastSentDomain) S.lastSentDomain = saved.lastSentDomain;
      if (saved.usedHeadings) S.usedHeadings = saved.usedHeadings;
      if (saved.examType) S.examType = saved.examType;
      const sp = document.getElementById('sga-f-startpage');
      if (sp) { sp.value = saved.currentPage + 1; store.set('sga-f-startpage', sp.value); }
      toast(`Resume? Start From Page set to ${saved.currentPage + 1}`, 'warning', 10000);
    }
  }

  /* INIT */
  function launch() {
    const old = document.getElementById('sga-wrap'); if (old) old.remove();
    const wrap = buildUI(); initDrag(wrap); bindEvents(); loadDomainWeights();
    // Check if running in Gemini tab and bridge
    GEMINI.checkIfGeminiAndBridge();
    log(`StudyGuide AutoPilot v${VERSION} — ExamForge ULTRA — 50 exam types + 11-step pipeline + Gemini images ✓`, 'ok');
    checkRecovery();
    toast('StudyGuide AutoPilot v3.0 Ready! 🚀', 'success', 5000);
  }

  function init() {
    if (!document.body) { document.addEventListener('DOMContentLoaded', init); return; }
    let attempts = 0;
    const poll = setInterval(() => {
      attempts++;
      const ready = document.getElementById('prompt-textarea') || document.querySelector('[contenteditable="true"]') || document.querySelector('main') || attempts > 20;
      if (ready) { clearInterval(poll); setTimeout(launch, 500); }
    }, 600);
    setTimeout(() => { clearInterval(poll); if (!document.getElementById('sga-wrap')) setTimeout(launch, 100); }, 15000);
  }

  document.addEventListener('keydown', e => {
    if (e.altKey && e.shiftKey && e.key === 'E') { const w = document.getElementById('sga-wrap'); if (w) w.classList.toggle('sga-hidden'); }
    if (e.altKey && e.shiftKey && e.key === 'P') { if (S.running) { if (!S.paused) document.getElementById('sga-btn-pause')?.click(); else document.getElementById('sga-btn-resume')?.click(); } }
  });

  init();

})();
