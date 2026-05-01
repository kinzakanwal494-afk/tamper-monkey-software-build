import globals from 'globals';

export default [
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: {
        ...globals.browser,
        ...globals.es2021,
      },
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-undef': 'error',
      'no-redeclare': 'error',
      'no-constant-condition': 'warn',
      'no-empty': 'warn',
    },
  },
  {
    files: ['studyguide_automation.user.js'],
    languageOptions: {
      sourceType: 'script',
      globals: {
        ...globals.browser,
        ...globals.es2021,
        // Tampermonkey/Greasemonkey globals
        GM_xmlhttpRequest: 'readonly',
        GM_setValue: 'readonly',
        GM_getValue: 'readonly',
        GM_addStyle: 'readonly',
        GM_notification: 'readonly',
        GM_openInTab: 'readonly',
        GM_info: 'readonly',
        GM_registerMenuCommand: 'readonly',
        GM_unregisterMenuCommand: 'readonly',
        GM_setClipboard: 'readonly',
        GM_download: 'readonly',
        GM_getResourceText: 'readonly',
        GM_getResourceURL: 'readonly',
        unsafeWindow: 'readonly',
        cloneInto: 'readonly',
        exportFunction: 'readonly',
      },
    },
  },
  {
    files: ['apps_script/**/*.gs', 'apps_script/**/*.js'],
    languageOptions: {
      sourceType: 'script',
      globals: {
        ...globals.es2021,
        // Google Apps Script globals
        DocumentApp: 'readonly',
        DriveApp: 'readonly',
        SpreadsheetApp: 'readonly',
        UrlFetchApp: 'readonly',
        PropertiesService: 'readonly',
        ContentService: 'readonly',
        Logger: 'readonly',
        HtmlService: 'readonly',
        Utilities: 'readonly',
        Session: 'readonly',
        ScriptApp: 'readonly',
        LockService: 'readonly',
        CacheService: 'readonly',
        MailApp: 'readonly',
        GmailApp: 'readonly',
        CalendarApp: 'readonly',
        FormApp: 'readonly',
        Charts: 'readonly',
        Maps: 'readonly',
        Browser: 'readonly',
        console: 'readonly',
      },
    },
  },
  {
    files: ['test/**/*.js'],
    languageOptions: {
      sourceType: 'module',
      globals: {
        ...globals.node,
        ...globals.es2021,
      },
    },
  },
  {
    files: ['eslint.config.js'],
    languageOptions: {
      sourceType: 'module',
    },
  },
  {
    ignores: ['node_modules/**'],
  },
];
