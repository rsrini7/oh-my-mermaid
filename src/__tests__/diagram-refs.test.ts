import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { initOmm, writeField } from '../lib/store.js';
import { commandDiagramRefs } from '../commands/diagram-refs.js';

let tmpDir: string;
let savedCwd: string;

beforeEach(() => {
  savedCwd = process.cwd();
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'omm-dref-test-'));
  process.chdir(tmpDir);
  initOmm(tmpDir);
});

afterEach(() => {
  process.chdir(savedCwd);
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('omm diagram-refs', () => {
  it('lists valid refs', () => {
    writeField('auth', 'description', 'Auth', tmpDir);
    writeField('auth', 'diagram', 'graph LR\n  A --> @command-surface\n  B --> @extension-points', tmpDir);
    writeField('command-surface', 'description', 'cs', tmpDir);
    writeField('extension-points', 'description', 'ep', tmpDir);

    let stdout = '';
    const spy = vi.spyOn(process.stdout, 'write').mockImplementation((msg: string | Uint8Array) => {
      stdout += String(msg);
      return true;
    });

    commandDiagramRefs(['auth']);
    expect(stdout).toContain('auth: 2 @ref(s)');
    expect(stdout).toContain('@command-surface');
    expect(stdout).toContain('@extension-points');
    expect(stdout).toContain('✓ ok');
    spy.mockRestore();
  });

  it('marks non-existent targets as ref-exists', () => {
    writeField('auth', 'description', 'Auth', tmpDir);
    writeField('auth', 'diagram', 'graph LR\n  A --> @nonexistent', tmpDir);

    let stdout = '';
    const spy = vi.spyOn(process.stdout, 'write').mockImplementation((msg: string | Uint8Array) => {
      stdout += String(msg);
      return true;
    });

    commandDiagramRefs(['auth']);
    expect(stdout).toContain('✗ ref-exists');
    spy.mockRestore();
  });

  it('marks self-references as ref-self', () => {
    writeField('auth', 'description', 'Auth', tmpDir);
    writeField('auth', 'diagram', 'graph LR\n  A --> @auth', tmpDir);

    let stdout = '';
    const spy = vi.spyOn(process.stdout, 'write').mockImplementation((msg: string | Uint8Array) => {
      stdout += String(msg);
      return true;
    });

    commandDiagramRefs(['auth']);
    expect(stdout).toContain('✗ ref-self');
    spy.mockRestore();
  });

  it('outputs JSON with --json', () => {
    writeField('auth', 'description', 'Auth', tmpDir);
    writeField('auth', 'diagram', 'graph LR\n  A --> @command-surface', tmpDir);
    writeField('command-surface', 'description', 'cs', tmpDir);

    let stdout = '';
    const spy = vi.spyOn(process.stdout, 'write').mockImplementation((msg: string | Uint8Array) => {
      stdout += String(msg);
      return true;
    });

    commandDiagramRefs(['auth', '--json']);
    const parsed = JSON.parse(stdout);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed[0].ref).toBe('@command-surface');
    expect(parsed[0].exists).toBe(true);
    expect(parsed[0].valid).toBe(true);
    spy.mockRestore();
  });

  it('errors when no diagram', () => {
    writeField('auth', 'description', 'Auth', tmpDir);

    let stderr = '';
    const spy = vi.spyOn(process.stderr, 'write').mockImplementation((msg: string | Uint8Array) => {
      stderr += String(msg);
      return true;
    });
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((code?: string | number | null) => {
      throw new Error('exit:' + code);
    });

    expect(() => commandDiagramRefs(['auth'])).toThrow('exit:1');
    expect(stderr).toContain('no diagram');
    spy.mockRestore();
    exitSpy.mockRestore();
  });

  it('shows no refs when diagram has none', () => {
    writeField('auth', 'description', 'Auth', tmpDir);
    writeField('auth', 'diagram', 'graph LR\n  A --> B', tmpDir);

    let stdout = '';
    const spy = vi.spyOn(process.stdout, 'write').mockImplementation((msg: string | Uint8Array) => {
      stdout += String(msg);
      return true;
    });

    commandDiagramRefs(['auth']);
    expect(stdout).toContain('no @ref found');
    spy.mockRestore();
  });

  it('shows help with --help or no args', () => {
    let stdout = '';
    const spy = vi.spyOn(process.stdout, 'write').mockImplementation((msg: string | Uint8Array) => {
      stdout += String(msg);
      return true;
    });

    commandDiagramRefs(['--help']);
    expect(stdout).toContain('omm diagram-refs');

    commandDiagramRefs([]);
    expect(stdout).toContain('omm diagram-refs');
    spy.mockRestore();
  });
});
