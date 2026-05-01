import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CODE_GS_PATH = join(__dirname, '..', 'apps_script', 'Code.gs');

describe('Code.gs integration — simulated doPost handling', () => {
  let context;
  let source;

  it('should load Code.gs in a VM sandbox', () => {
    source = readFileSync(CODE_GS_PATH, 'utf8');

    const logs = [];
    const mockBody = {
      appendParagraph: (text) => ({
        setFontFamily: () => ({}),
        setFontSize: () => ({}),
        setBold: () => ({}),
        setHeading: () => ({}),
        editAsText: () => ({
          setFontFamily: () => ({}),
          setFontSize: () => ({}),
          setBold: () => ({}),
          setForegroundColor: () => ({}),
        }),
      }),
      getNumChildren: () => 0,
      getChild: () => null,
      insertPageBreak: () => ({}),
    };

    const mockDoc = {
      getBody: () => mockBody,
    };

    context = vm.createContext({
      DocumentApp: {
        openById: () => mockDoc,
        getActiveDocument: () => mockDoc,
        ParagraphHeading: { HEADING1: 1, HEADING2: 2, HEADING3: 3, NORMAL: 0 },
      },
      ContentService: {
        createTextOutput: (text) => ({
          setMimeType: function () { return this; },
          getContent: () => text,
        }),
        MimeType: { JSON: 'application/json' },
      },
      Logger: { log: (msg) => logs.push(msg) },
      PropertiesService: {
        getScriptProperties: () => ({
          getProperty: () => null,
          setProperty: () => {},
        }),
      },
      UrlFetchApp: { fetch: () => ({ getBlob: () => ({}) }) },
      Utilities: {
        base64Decode: () => [],
        newBlob: () => ({}),
      },
      console: { log: (msg) => logs.push(msg) },
      _logs: logs,
    });

    const script = new vm.Script(source, { filename: 'Code.gs' });
    script.runInContext(context);
    assert.ok(true, 'Code.gs loaded without errors');
  });

  it('should have doPost function available', () => {
    assert.equal(typeof context.doPost, 'function');
  });

  it('should handle ping action', () => {
    const result = context.doPost({
      postData: {
        contents: JSON.stringify({
          secret: 'CHANGE_ME_TO_A_LONG_RANDOM_STRING',
          docId: 'test-doc-id',
          action: 'ping',
        }),
      },
    });
    const parsed = JSON.parse(result.getContent());
    assert.equal(parsed.status, 'ok');
  });

  it('should reject invalid secret', () => {
    const result = context.doPost({
      postData: {
        contents: JSON.stringify({
          secret: 'wrong-secret',
          docId: 'test-doc-id',
          action: 'ping',
        }),
      },
    });
    const parsed = JSON.parse(result.getContent());
    assert.equal(parsed.status, 'error');
    assert.match(parsed.message, /secret/i);
  });

  it('should have scrubArtifacts_ function', () => {
    assert.equal(typeof context.scrubArtifacts_, 'function');
  });

  it('should scrub SOURCE lines from content', () => {
    const input = 'Hello world\nSOURCE: Some Book | Chapter 1\nGoodbye';
    const result = context.scrubArtifacts_(input);
    assert.ok(!result.includes('SOURCE:'), 'SOURCE line should be removed');
    assert.ok(result.includes('Hello world'));
    assert.ok(result.includes('Goodbye'));
  });

  it('should have isFrontMatterSection_ function', () => {
    assert.equal(typeof context.isFrontMatterSection_, 'function');
  });

  it('should detect front matter sections correctly', () => {
    assert.equal(context.isFrontMatterSection_('front_author_intro'), true);
    assert.equal(context.isFrontMatterSection_('front_copyright'), true);
    assert.equal(context.isFrontMatterSection_('PAGE 1 — Domain 1'), false);
  });
});
