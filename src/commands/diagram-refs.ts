/**
 * omm diagram-refs <path> — List @class-name references in a diagram
 *
 * Usage:
 *   omm diagram-refs <element>           Show all @refs in an element's diagram
 *   omm diagram-refs <element> --json    JSON output with resolution status
 */

import { ensureOmmForRead, readField, readNodeField, listClasses } from '../lib/store.js';
import { extractRefs } from '../lib/refs.js';

const HELP = `
omm diagram-refs <path> — List @class-name references in a diagram

Usage:
  omm diagram-refs <element>           Show all @refs in an element's diagram
  omm diagram-refs <element> --json    JSON output with resolution status

Examples:
  omm diagram-refs overall-architecture
  omm diagram-refs command-surface/agent
`;

interface ParsedArgs {
  element: string;
  json: boolean;
  help: boolean;
}

function parseArgs(args: string[]): ParsedArgs {
  const out: ParsedArgs = { element: '', json: false, help: false };
  for (const a of args) {
    if (a === '--help' || a === '-h') out.help = true;
    else if (a === '--json') out.json = true;
    else if (!a.startsWith('--')) out.element = a;
  }
  return out;
}

function readDiagram(element: string): string | null {
  const parts = element.split('/');
  if (parts.length === 1) {
    return readField(parts[0], 'diagram');
  }
  return readNodeField(parts[0], parts.slice(1), 'diagram');
}

export function commandDiagramRefs(args: string[]): void {
  if (!ensureOmmForRead()) return;

  const parsed = parseArgs(args);
  if (parsed.help || !parsed.element) {
    process.stdout.write(HELP.trim() + '\n');
    return;
  }

  const diagram = readDiagram(parsed.element);
  if (!diagram) {
    process.stderr.write(`error: no diagram for '${parsed.element}'\n`);
    process.exit(1);
  }

  const refs = extractRefs(diagram);
  const allClasses = listClasses();

  if (parsed.json) {
    const result = refs.map(target => ({
      ref: `@${target}`,
      target,
      exists: allClasses.includes(target),
      valid: allClasses.includes(target) && target !== parsed.element,
      error: !allClasses.includes(target) ? 'ref-exists (target not found)' :
             target === parsed.element ? 'ref-self (cannot reference own class)' : null,
    }));
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    return;
  }

  if (refs.length === 0) {
    process.stdout.write(`${parsed.element}: no @ref found\n`);
    return;
  }

  process.stdout.write(`${parsed.element}: ${refs.length} @ref(s)\n\n`);
  for (const target of refs) {
    const exists = allClasses.includes(target);
    const isSelf = target === parsed.element;
    const status = !exists ? '✗ ref-exists' : isSelf ? '✗ ref-self' : '✓ ok';
    const desc = !exists ? '(target class does not exist)' :
                 isSelf ? '(cannot reference own class)' :
                 `(→ ${target})`;
    process.stdout.write(`  ${status.padEnd(14)} @${target.padEnd(20)} ${desc}\n`);
  }
}
