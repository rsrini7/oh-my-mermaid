import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { initOmm, writeField } from '../lib/store.js';
import { commandRefSyntax } from '../commands/ref-syntax.js';

let tmpDir: string;
let savedCwd: string;

beforeEach(() => {
  savedCwd = process.cwd();
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'omm-refsyn-test-'));
  process.chdir(tmpDir);
});

afterEach(() => {
  process.chdir(savedCwd);
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('omm ref-syntax', () => {
  it('prints the @class-name convention', () => {
    let stdout = '';
    const spy = vi.spyOn(process.stdout, 'write').mockImplementation((msg: string | Uint8Array) => {
      stdout += String(msg);
      return true;
    });

    commandRefSyntax();
    expect(stdout).toContain('@class-name');
    expect(stdout).toContain('Syntax');
    expect(stdout).toContain('Rules');
    expect(stdout).toContain('Validation');
    spy.mockRestore();
  });

  it('lists available @refs from the project', () => {
    initOmm(tmpDir);
    writeField('auth', 'description', 'Auth', tmpDir);
    writeField('auth', 'diagram', 'graph LR\n  A --> B', tmpDir);
    writeField('api', 'description', 'API', tmpDir);
    writeField('api', 'diagram', 'graph LR\n  A --> B', tmpDir);

    let stdout = '';
    const spy = vi.spyOn(process.stdout, 'write').mockImplementation((msg: string | Uint8Array) => {
      stdout += String(msg);
      return true;
    });

    commandRefSyntax();
    expect(stdout).toContain('Available @refs');
    expect(stdout).toContain('@auth');
    expect(stdout).toContain('@api');
    spy.mockRestore();
  });

  it('handles no .omm/ gracefully', () => {
    // No initOmm - so no .omm directory
    let stdout = '';
    const stderr = '';
    const outSpy = vi.spyOn(process.stdout, 'write').mockImplementation((msg: string | Uint8Array) => {
      stdout += String(msg);
      return true;
    });
    const errSpy = vi.spyOn(process.stderr, 'write').mockImplementation((msg: string | Uint8Array) => {
      return true;
    });

    // Should not throw even without .omm/
    expect(() => commandRefSyntax()).not.toThrow();
    expect(stdout).toContain('@class-name');
    outSpy.mockRestore();
    errSpy.mockRestore();
  });

  it('documents that refs only support top-level perspective names', () => {
    let stdout = '';
    const spy = vi.spyOn(process.stdout, 'write').mockImplementation((msg: string | Uint8Array) => {
      stdout += String(msg);
      return true;
    });

    commandRefSyntax();
    expect(stdout).toContain('Only top-level perspective names work');
    expect(stdout).toMatch(/[Cc]hild paths do NOT/);
    spy.mockRestore();
  });

  it('documents the @ regex pattern', () => {
    let stdout = '';
    const spy = vi.spyOn(process.stdout, 'write').mockImplementation((msg: string | Uint8Array) => {
      stdout += String(msg);
      return true;
    });

    commandRefSyntax();
    expect(stdout).toMatch(/regex.*@/i);
    spy.mockRestore();
  });
});
