/**
 * omm push — Sync local .omm/ to the architecture repository.
 *
 * Usage:
 *   omm push                          Push to configured arch repo
 *   omm push --to ~/arch/team-repo    Push to specific repo (also saves config)
 *   omm push --dry-run                Show what would change
 *   omm push --json                   JSON output
 *   omm push --commit                 Auto-commit to git after push
 *   omm push --commit -m "message"    Auto-commit with custom message
 */

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { ensureOmmForRead, getOmmDir } from '../lib/store.js';
import {
  getArchRepo, setArchRepo, getArchRemote, getProjectName, getArchTarget,
  walkDir, copyFiles, diffDirs, initArchRepo,
} from '../lib/arch.js';

interface PushOptions {
  to?: string;
  dryRun: boolean;
  json: boolean;
  commit: boolean;
  message?: string;
}

function parseArgs(args: string[]): PushOptions {
  const opts: PushOptions = { dryRun: false, json: false, commit: false };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--to' && args[i + 1]) opts.to = args[++i];
    else if (a === '--dry-run') opts.dryRun = true;
    else if (a === '--json') opts.json = true;
    else if (a === '--commit') opts.commit = true;
    else if ((a === '-m' || a === '--message') && args[i + 1]) opts.message = args[++i];
    else if (a === '--help' || a === '-h') {
      process.stdout.write(HELP);
      process.exit(0);
    } else {
      process.stderr.write(`error: unknown arg '${a}'\n`);
      process.exit(1);
    }
  }
  return opts;
}

const HELP = `
omm push — Sync local architecture docs to the shared repository.

Usage:
  omm push                              Push to configured arch repo
  omm push --to ~/arch/team-repo        Push to specific repo (saves config)
  omm push --dry-run                    Show what would change
  omm push --json                       JSON output
  omm push --commit                     Auto-commit to git after push
  omm push --commit -m "update docs"    Auto-commit with message

Examples:
  omm push --to ~/arch/my-team          First time: set arch repo and push
  omm push                              Subsequent: push to saved repo
  omm push --dry-run                    Preview changes
  omm push --commit -m "add auth"       Push and commit to git
`;

function gitExec(cmd: string, cwd: string): string {
  try {
    return execSync(cmd, { cwd, stdio: ['pipe', 'pipe', 'pipe'], encoding: 'utf-8' }).trim();
  } catch {
    return '';
  }
}

export async function commandPush(args: string[]): Promise<void> {
  if (!ensureOmmForRead()) return;

  const opts = parseArgs(args);
  const cwd = process.cwd();
  const ommDir = getOmmDir(cwd);

  // Resolve arch repo
  let archRepo = opts.to || getArchRepo(cwd);
  if (!archRepo) {
    process.stderr.write('error: no architecture repository configured.\n');
    process.stderr.write('  Run: omm push --to <path-to-arch-repo>\n');
    process.stderr.write('  Or:  omm config arch-repo <path>\n');
    process.exit(1);
  }

  // Resolve to absolute path
  archRepo = path.resolve(archRepo);

  // Save if --to was specified
  if (opts.to) {
    setArchRepo(opts.to, cwd);
  }

  // Initialize arch repo if needed
  if (!opts.dryRun) {
    initArchRepo(archRepo);
  }

  const projectName = getProjectName(cwd);
  const archTarget = getArchTarget(archRepo, projectName);
  const sourceFiles = walkDir(ommDir);

  // Compute diff
  const diff = diffDirs(ommDir, archTarget);

  if (opts.json) {
    process.stdout.write(JSON.stringify({
      arch_repo: archRepo,
      project: projectName,
      target: archTarget,
      source_files: sourceFiles.length,
      added: diff.added.length,
      modified: diff.modified.length,
      removed: diff.removed.length,
    }, null, 2) + '\n');
    if (opts.dryRun) return;
  }

  // Report
  const total = diff.added.length + diff.modified.length + diff.removed.length;
  if (total === 0 && !opts.dryRun) {
    process.stderr.write(`Already up to date. (${sourceFiles.length} files, no changes)\n`);
    return;
  }

  if (opts.dryRun) {
    process.stderr.write(`Would push ${sourceFiles.length} files → ${archTarget}\n\n`);
    if (diff.added.length) {
      process.stderr.write(`  Added (${diff.added.length}):\n`);
      diff.added.slice(0, 15).forEach(f => process.stderr.write(`    + ${f}\n`));
      if (diff.added.length > 15) process.stderr.write(`    ... +${diff.added.length - 15} more\n`);
    }
    if (diff.modified.length) {
      process.stderr.write(`  Modified (${diff.modified.length}):\n`);
      diff.modified.slice(0, 15).forEach(f => process.stderr.write(`    ~ ${f}\n`));
      if (diff.modified.length > 15) process.stderr.write(`    ... +${diff.modified.length - 15} more\n`);
    }
    if (diff.removed.length) {
      process.stderr.write(`  Removed (${diff.removed.length}):\n`);
      diff.removed.slice(0, 15).forEach(f => process.stderr.write(`    - ${f}\n`));
      if (diff.removed.length > 15) process.stderr.write(`    ... +${diff.removed.length - 15} more\n`);
    }
    return;
  }

  // Execute push: copy files from .omm/ to arch repo
  fs.mkdirSync(archTarget, { recursive: true });

  // Remove files that no longer exist in source
  for (const f of diff.removed) {
    const target = path.join(archTarget, f);
    if (fs.existsSync(target)) fs.unlinkSync(target);
  }

  // Copy all source files
  const copied = copyFiles(ommDir, archTarget, sourceFiles);

  // Clean empty directories
  cleanEmptyDirs(archTarget);

  process.stderr.write(`Pushed ${copied} files → ${archTarget}\n`);
  process.stderr.write(`  ${diff.added.length} added, ${diff.modified.length} modified, ${diff.removed.length} removed\n`);

  // Auto-commit if requested
  if (opts.commit) {
    const changes = gitExec('git status --porcelain .omm/', archRepo);
    if (!changes) {
      process.stderr.write('No git changes to commit.\n');
      return;
    }

    const commitMsg = opts.message || buildCommitMessage(projectName, diff);
    gitExec(`git add .omm/`, archRepo);
    gitExec(`git commit -m "${commitMsg}"`, archRepo);
    process.stderr.write(`Committed: ${commitMsg}\n`);

    // Auto-configure remote from config if not set in git
    const configuredRemote = getArchRemote(cwd);
    if (configuredRemote) {
      const existingRemote = gitExec('git remote get-url origin', archRepo);
      if (!existingRemote) {
        gitExec(`git remote add origin ${configuredRemote}`, archRepo);
        process.stderr.write(`Added remote: ${configuredRemote}\n`);
      } else if (existingRemote !== configuredRemote) {
        gitExec(`git remote set-url origin ${configuredRemote}`, archRepo);
        process.stderr.write(`Updated remote: ${configuredRemote}\n`);
      }
    }

    // Push to remote
    const remoteUrl = gitExec('git remote get-url origin', archRepo);
    if (remoteUrl) {
      const pushResult = gitExec('git push -u origin main 2>&1 || git push -u origin master 2>&1', archRepo);
      if (pushResult) {
        process.stderr.write(`Pushed to ${remoteUrl}\n`);
      } else {
        process.stderr.write('Push failed. Check remote access.\n');
      }
    } else {
      process.stderr.write('No remote configured. Use `omm config arch-remote <url>` to set one.\n');
    }
  }
}

function buildCommitMessage(projectName: string, diff: { added: string[]; modified: string[]; removed: string[] }): string {
  const parts: string[] = [];
  if (diff.added.length) parts.push(`${diff.added.length} added`);
  if (diff.modified.length) parts.push(`${diff.modified.length} modified`);
  if (diff.removed.length) parts.push(`${diff.removed.length} removed`);
  return `omm(${projectName}): ${parts.join(', ')}`;
}

function cleanEmptyDirs(dir: string): void {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      cleanEmptyDirs(path.join(dir, entry.name));
    }
  }
  // Remove if empty
  try {
    const remaining = fs.readdirSync(dir);
    if (remaining.length === 0 && dir !== path.dirname(dir)) {
      fs.rmdirSync(dir);
    }
  } catch {}
}
