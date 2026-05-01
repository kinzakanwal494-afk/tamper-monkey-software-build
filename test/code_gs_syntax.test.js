import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CODE_GS_PATH = join(__dirname, '..', 'apps_script', 'Code.gs');

describe('Code.gs syntax validation', () => {
  let source;

  it('should be readable', () => {
    source = readFileSync(CODE_GS_PATH, 'utf8');
    assert.ok(source.length > 100, 'File should have substantial content');
  });

  it('should contain the doPost entry point', () => {
    source = readFileSync(CODE_GS_PATH, 'utf8');
    assert.match(source, /function doPost\(e\)/);
  });

  it('should contain the runTests function', () => {
    source = readFileSync(CODE_GS_PATH, 'utf8');
    assert.match(source, /function runTests\(\)/);
  });

  it('should have a SHARED_SECRET constant', () => {
    source = readFileSync(CODE_GS_PATH, 'utf8');
    assert.match(source, /const SHARED_SECRET/);
  });

  it('should contain helper functions for rendering', () => {
    source = readFileSync(CODE_GS_PATH, 'utf8');
    assert.match(source, /function renderMarkup_\(/);
    assert.match(source, /function appendHeading_\(/);
    assert.match(source, /function appendParagraph_\(/);
    assert.match(source, /function appendMarkdownTable_\(/);
  });

  it('should contain image handling', () => {
    source = readFileSync(CODE_GS_PATH, 'utf8');
    assert.match(source, /function appendImageBlock_\(/);
  });

  it('should contain scrubArtifacts_ for filtering content', () => {
    source = readFileSync(CODE_GS_PATH, 'utf8');
    assert.match(source, /function scrubArtifacts_\(/);
  });
});
