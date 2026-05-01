import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const USERSCRIPT_PATH = join(__dirname, '..', 'studyguide_automation.user.js');

describe('studyguide_automation.user.js syntax validation', () => {
  let source;

  it('should be readable', () => {
    source = readFileSync(USERSCRIPT_PATH, 'utf8');
    assert.ok(source.length > 1000, 'File should have substantial content');
  });

  it('should have a valid Tampermonkey metadata block', () => {
    source = readFileSync(USERSCRIPT_PATH, 'utf8');
    assert.match(source, /\/\/ ==UserScript==/);
    assert.match(source, /\/\/ ==\/UserScript==/);
  });

  it('should declare required @grant permissions', () => {
    source = readFileSync(USERSCRIPT_PATH, 'utf8');
    assert.match(source, /@grant\s+GM_xmlhttpRequest/);
    assert.match(source, /@grant\s+GM_setValue/);
    assert.match(source, /@grant\s+GM_getValue/);
  });

  it('should match expected sites', () => {
    source = readFileSync(USERSCRIPT_PATH, 'utf8');
    assert.match(source, /@match\s+https:\/\/chatgpt\.com\/\*/);
    assert.match(source, /@match\s+https:\/\/gemini\.google\.com\/\*/);
  });

  it('should contain the IIFE wrapper', () => {
    source = readFileSync(USERSCRIPT_PATH, 'utf8');
    assert.match(source, /\(function\s*\(\)\s*\{/);
    assert.match(source, /'use strict'/);
  });

  it('should reference Google Apps Script connection', () => {
    source = readFileSync(USERSCRIPT_PATH, 'utf8');
    assert.match(source, /script\.google\.com/);
  });

  it('should have version 13.0.0', () => {
    source = readFileSync(USERSCRIPT_PATH, 'utf8');
    assert.match(source, /@version\s+13\.0\.0/);
  });
});
