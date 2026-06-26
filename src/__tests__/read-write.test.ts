import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { initOmm, readField, classExists, isValidField, writeField } from '../lib/store.js';

let tmpDir: string;
let savedCwd: string;

beforeEach(() => {
  savedCwd = process.cwd();
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'omm-rw-test-'));
  process.chdir(tmpDir);
  initOmm(tmpDir);
});

afterEach(() => {
  process.chdir(savedCwd);
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// These tests exercise the underlying store functions that commandRead/commandWrite use.
// The command wrappers themselves call process.exit() which is hard to test in vitest.

describe('isValidField', () => {
  it('accepts valid fields', () => {
    expect(isValidField('description')).toBe(true);
    expect(isValidField('diagram')).toBe(true);
    expect(isValidField('constraint')).toBe(true);
    expect(isValidField('concern')).toBe(true);
    expect(isValidField('context')).toBe(true);
    expect(isValidField('todo')).toBe(true);
    expect(isValidField('note')).toBe(true);
  });

  it('rejects invalid fields', () => {
    expect(isValidField('invalid')).toBe(false);
    expect(isValidField('')).toBe(false);
    expect(isValidField('Description')).toBe(false); // case-sensitive
    expect(isValidField('desc')).toBe(false);
  });
});

describe('writeField + readField', () => {
  it('writes and reads a top-level field', () => {
    writeField('auth', 'description', 'hello world', tmpDir);
    expect(readField('auth', 'description', tmpDir)).toBe('hello world');
  });

  it('creates element directory if missing', () => {
    expect(classExists('new-elem', tmpDir)).toBe(false);
    writeField('new-elem', 'description', 'content', tmpDir);
    expect(classExists('new-elem', tmpDir)).toBe(true);
    expect(readField('new-elem', 'description', tmpDir)).toBe('content');
  });

  it('updates meta when writing a field', () => {
    writeField('auth', 'description', 'first', tmpDir);
    writeField('auth', 'context', 'second context', tmpDir);
    const metaPath = path.join(tmpDir, '.omm', 'auth', 'meta.yaml');
    expect(fs.existsSync(metaPath)).toBe(true);
    const metaContent = fs.readFileSync(metaPath, 'utf-8');
    expect(metaContent).toContain('update_count: 2');
    expect(metaContent).toContain('last_field: context');
  });

  it('reads diagram field correctly', () => {
    const diagram = 'graph LR\n  A --> B\n  B --> C';
    writeField('auth', 'diagram', diagram, tmpDir);
    expect(readField('auth', 'diagram', tmpDir)).toBe(diagram);
  });

  it('preserves special characters in fields', () => {
    const text = 'A "quoted" string with\nnewlines and tabs\t.';
    writeField('auth', 'description', text, tmpDir);
    expect(readField('auth', 'description', tmpDir)).toBe(text);
  });
});

describe('classExists', () => {
  it('returns true for elements that exist in tmpDir', () => {
    // After initOmm, the dir exists but no elements are created yet
    // Create an element first
    writeField('mytest', 'description', 'content', tmpDir);
    expect(classExists('mytest', tmpDir)).toBe(true);
  });

  it('returns false for non-existing elements', () => {
    expect(classExists('nonexistent', tmpDir)).toBe(false);
  });
});
