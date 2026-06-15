import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import { ensureOmmForRead, ensureOmmForWrite, getOmmDir } from '../lib/store.js';

const ARCH_CONFIG_KEYS = ['arch_repo', 'arch-repo'];

/**
 * Get the configured architecture repository path.
 */
export function getArchRepo(cwd: string = process.cwd()): string | null {
  const ommDir = getOmmDir(cwd);
  const configPath = path.join(ommDir, 'config.yaml');
  if (!fs.existsSync(configPath)) return null;
  try {
    const config = YAML.parse(fs.readFileSync(configPath, 'utf-8')) as Record<string, unknown>;
    if (!config) return null;
    // Check standard key names
    for (const key of ARCH_CONFIG_KEYS) {
      if (typeof config[key] === 'string' && config[key]) return config[key] as string;
    }
    // Fallback: find any string value that looks like a path to an existing directory
    for (const [key, val] of Object.entries(config)) {
      if (typeof val === 'string' && val.startsWith('/') && fs.existsSync(val) && fs.existsSync(path.join(val, '.omm'))) {
        return val;
      }
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Set the architecture repository path in config.
 */
export function setArchRepo(repoPath: string, cwd: string = process.cwd()): void {
  ensureOmmForWrite(cwd);
  const ommDir = getOmmDir(cwd);
  const configPath = path.join(ommDir, 'config.yaml');
  let config: Record<string, unknown> = {};
  if (fs.existsSync(configPath)) {
    try {
      config = YAML.parse(fs.readFileSync(configPath, 'utf-8')) as Record<string, unknown> || {};
    } catch {}
  }
  // Use underscore key as canonical, remove hyphen variant if present
  delete config['arch-repo'];
  config['arch_repo'] = repoPath;
  fs.writeFileSync(configPath, YAML.stringify(config), 'utf-8');
}

/**
 * Get the configured git remote URL for the architecture repository.
 */
export function getArchRemote(cwd: string = process.cwd()): string | null {
  const ommDir = getOmmDir(cwd);
  const configPath = path.join(ommDir, 'config.yaml');
  if (!fs.existsSync(configPath)) return null;
  try {
    const config = YAML.parse(fs.readFileSync(configPath, 'utf-8')) as Record<string, unknown>;
    if (!config) return null;
    return (config['arch_remote'] as string) ?? (config['arch-remote'] as string) ?? null;
  } catch {
    return null;
  }
}

export function setArchRemote(remoteUrl: string, cwd: string = process.cwd()): void {
  ensureOmmForWrite(cwd);
  const ommDir = getOmmDir(cwd);
  const configPath = path.join(ommDir, 'config.yaml');
  let config: Record<string, unknown> = {};
  if (fs.existsSync(configPath)) {
    try {
      config = YAML.parse(fs.readFileSync(configPath, 'utf-8')) as Record<string, unknown> || {};
    } catch {}
  }
  delete config['arch-remote'];
  config['arch_remote'] = remoteUrl;
  fs.writeFileSync(configPath, YAML.stringify(config), 'utf-8');
}

/**
 * Get the project name (used as subdirectory in the arch repo).
 */
export function getProjectName(cwd: string = process.cwd()): string {
  return path.basename(cwd);
}

/**
 * Resolve the target directory in the arch repo for this project.
 * Structure: {arch_repo}/.omm/{project_name}/
 */
export function getArchTarget(archRepo: string, projectName: string): string {
  return path.join(archRepo, '.omm', projectName);
}

/**
 * Walk a directory and return all files with relative paths.
 */
export function walkDir(dir: string, base: string = dir): Array<{ relPath: string; fullPath: string }> {
  const results: Array<{ relPath: string; fullPath: string }> = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    const rel = path.relative(base, full);
    if (entry.isDirectory()) {
      results.push(...walkDir(full, base));
    } else {
      results.push({ relPath: rel, fullPath: full });
    }
  }
  return results;
}

/**
 * Copy files from source to destination, creating directories as needed.
 */
export function copyFiles(srcDir: string, destDir: string, files: Array<{ relPath: string }>): number {
  let count = 0;
  for (const file of files) {
    const src = path.join(srcDir, file.relPath);
    const dest = path.join(destDir, file.relPath);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
    count++;
  }
  return count;
}

/**
 * Compute a simple diff summary between two directories.
 */
export function diffDirs(
  srcDir: string,
  destDir: string,
): { added: string[]; modified: string[]; removed: string[] } {
  const srcFiles = new Set(walkDir(srcDir).map(f => f.relPath));
  const destFiles = new Set(walkDir(destDir).map(f => f.relPath));

  const added: string[] = [];
  const modified: string[] = [];
  const removed: string[] = [];

  for (const f of srcFiles) {
    if (!destFiles.has(f)) {
      added.push(f);
    } else {
      const srcContent = fs.readFileSync(path.join(srcDir, f), 'utf-8');
      const destContent = fs.readFileSync(path.join(destDir, f), 'utf-8');
      if (srcContent !== destContent) modified.push(f);
    }
  }
  for (const f of destFiles) {
    if (!srcFiles.has(f)) removed.push(f);
  }

  return { added, modified, removed };
}

/**
 * Initialize a directory as an architecture repository.
 * Creates .omm/ and config.yaml if they don't exist.
 */
export function initArchRepo(repoPath: string): void {
  const ommDir = path.join(repoPath, '.omm');
  if (!fs.existsSync(ommDir)) {
    fs.mkdirSync(ommDir, { recursive: true });
  }
  const configPath = path.join(ommDir, 'config.yaml');
  if (!fs.existsSync(configPath)) {
    fs.writeFileSync(configPath, YAML.stringify({ version: '0.1.0', arch_repo: true }), 'utf-8');
  }
}

/**
 * List all projects in an architecture repository.
 */
export function listArchProjects(archRepo: string): string[] {
  const ommDir = path.join(archRepo, '.omm');
  if (!fs.existsSync(ommDir)) return [];
  return fs.readdirSync(ommDir, { withFileTypes: true })
    .filter(d => d.isDirectory() && !d.name.startsWith('.'))
    .map(d => d.name)
    .sort();
}
