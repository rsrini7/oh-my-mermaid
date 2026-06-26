import YAML from 'yaml';
import { ensureOmmForRead, readFlows, writeFlows } from '../lib/store.js';
import type { FlowDef } from '../types.js';

const HELP = `
omm flows <element> [options]

Manage flow definitions for animated path visualization in the viewer.

Usage:
  omm flows <element>                          List flows for an element
  omm flows <element> add <name>               Add a new flow (reads steps from stdin)
  omm flows <element> remove <name>            Remove a flow
  omm flows <element> -                        Read flows YAML from stdin

Flow YAML format (stdin for add):
  name: Install
  description: Developer installs skills
  steps:
    - node: user
    - edge: user->skills-sh-cli
    - node: skill-files
    - edge: skill-files->html-output
    - node: html-output

Examples:
  omm flows overall-architecture                         # list flows
  omm flows overall-architecture add Install <<'EOF'
  name: Install
  description: Developer installs skills via CLI
  steps:
    - node: user
    - edge: user->skills-sh-cli
    - node: skills-sh-cli
    - edge: skills-sh-cli->skill-files
    - node: skill-files
  EOF
  omm flows overall-architecture remove Install          # remove flow
`;

export function commandFlows(args: string[]): void {
  if (!ensureOmmForRead()) return;

  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    process.stdout.write(HELP.trim() + '\n');
    return;
  }

  const element = args[0];
  const subcommand = args[1];

  if (!subcommand || subcommand === '--list') {
    const flows = readFlows(element);
    if (flows.length === 0) {
      process.stdout.write(`No flows defined for ${element}.\n`);
      return;
    }
    for (const f of flows) {
      const desc = f.description ? ` — ${f.description}` : '';
      process.stdout.write(`  ${f.name}${desc}\n`);
      for (const s of f.steps) {
        if (s.node) process.stdout.write(`    → node: ${s.node}\n`);
        if (s.edge) process.stdout.write(`    → edge: ${s.edge}\n`);
      }
    }
    return;
  }

  if (subcommand === 'add') {
    const name = args[2];
    if (!name) {
      process.stderr.write('error: omm flows <element> add <name>\n');
      process.exit(1);
    }
    const chunks: string[] = [];
    process.stdin.setEncoding('utf-8');
    process.stdin.on('data', (chunk: string) => chunks.push(chunk));
    process.stdin.on('end', () => {
      const raw = chunks.join('');
      let flow: FlowDef;
      try {
        flow = YAML.parse(raw) as FlowDef;
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        process.stderr.write(`error: invalid YAML: ${msg}\n`);
        process.exit(1);
        return;
      }
      if (!flow.name) flow.name = name;
      if (!flow.steps?.length) {
        process.stderr.write('error: flow must have at least one step\n');
        process.exit(1);
        return;
      }
      const flows = readFlows(element);
      const idx = flows.findIndex(f => f.name === name);
      if (idx >= 0) {
        flows[idx] = flow;
      } else {
        flows.push(flow);
      }
      writeFlows(element, flows);
    });
    return;
  }

  if (subcommand === 'remove') {
    const name = args[2];
    if (!name) {
      process.stderr.write('error: omm flows <element> remove <name>\n');
      process.exit(1);
    }
    const flows = readFlows(element);
    const idx = flows.findIndex(f => f.name === name);
    if (idx < 0) {
      process.stderr.write(`error: flow '${name}' not found in ${element}\n`);
      process.exit(1);
      return;
    }
    flows.splice(idx, 1);
    writeFlows(element, flows);
    return;
  }

  if (subcommand === '-') {
    const chunks: string[] = [];
    process.stdin.setEncoding('utf-8');
    process.stdin.on('data', (chunk: string) => chunks.push(chunk));
    process.stdin.on('end', () => {
      const raw = chunks.join('');
      let flows: FlowDef[];
      try {
        const parsed = YAML.parse(raw) as { flows: FlowDef[] };
        flows = parsed?.flows ?? [];
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        process.stderr.write(`error: invalid YAML: ${msg}\n`);
        process.exit(1);
        return;
      }
      writeFlows(element, flows);
    });
    return;
  }

  process.stderr.write(`error: unknown subcommand '${subcommand}'. Run 'omm flows --help' for usage.\n`);
  process.exit(1);
}
