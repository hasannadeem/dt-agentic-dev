#!/usr/bin/env node
/**
 * Installs the agentic pipeline into another project.
 *
 * Usage:
 *   node scripts/init-pipeline.mjs /path/to/your/project [--app-dir src] [--dry-run]
 *
 * Copies the agent team, stage commands, governance guard, conventions and
 * artifact templates into the target repository, then writes a
 * pipeline.config.json describing that project's layout and gate command.
 * Existing files are never overwritten — conflicts are reported and skipped,
 * so re-running is safe.
 */
import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync, statSync } from 'node:fs';
import { join, dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const SOURCE = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const target = resolve(args.find((a) => !a.startsWith('--')) ?? '');
const appDirFlag = args.includes('--app-dir') ? args[args.indexOf('--app-dir') + 1] : null;

if (!args.length || args.includes('--help')) {
  console.log(readFileSync(new URL(import.meta.url)).toString().split('*/')[0].replace('/**', ''));
  process.exit(0);
}
if (!existsSync(target)) {
  console.error(`Target directory does not exist: ${target}`);
  process.exit(1);
}
if (target === SOURCE) {
  console.error('Target is this repository — nothing to install.');
  process.exit(1);
}

/**
 * Detects toolchain from marker files so the generated config has a gate
 * command that actually runs. Order matters: a repo can have several markers,
 * and the first match is the one the tests live under.
 */
const TOOLCHAINS = [
  {
    id: 'node', marker: 'package.json', language: 'javascript/typescript',
    install: 'npm ci',
    gates: (dir) => {
      const pkgPath = join(dir, 'package.json');
      let scripts = {};
      try { scripts = JSON.parse(readFileSync(pkgPath, 'utf8')).scripts ?? {}; } catch { /* unreadable */ }
      if (scripts.gates) return 'npm run gates';
      const parts = ['lint', 'typecheck', 'test'].filter((s) => scripts[s]).map((s) => `npm run ${s}`);
      return parts.length ? parts.join(' && ') : 'npm test';
    },
  },
  { id: 'python', marker: 'pyproject.toml', language: 'python', install: 'pip install -e ".[dev]"', gates: () => 'ruff check . && mypy . && pytest' },
  { id: 'python', marker: 'requirements.txt', language: 'python', install: 'pip install -r requirements.txt', gates: () => 'ruff check . && pytest' },
  { id: 'go', marker: 'go.mod', language: 'go', install: 'go mod download', gates: () => 'go vet ./... && go test ./...' },
  { id: 'rust', marker: 'Cargo.toml', language: 'rust', install: 'cargo fetch', gates: () => 'cargo clippy -- -D warnings && cargo test' },
  { id: 'ruby', marker: 'Gemfile', language: 'ruby', install: 'bundle install', gates: () => 'bundle exec rubocop && bundle exec rspec' },
];

/** Finds the shallowest directory containing a known toolchain marker. */
function detect(root) {
  const skip = new Set(['node_modules', '.git', 'vendor', 'dist', 'build', 'target', '.venv']);
  const queue = [''];
  while (queue.length) {
    const rel = queue.shift();
    const abs = join(root, rel);
    for (const tc of TOOLCHAINS) {
      if (existsSync(join(abs, tc.marker))) {
        return { ...tc, dir: rel || '.', gates: tc.gates(abs) };
      }
    }
    let entries = [];
    try { entries = readdirSync(abs, { withFileTypes: true }); } catch { continue; }
    for (const e of entries) {
      if (e.isDirectory() && !skip.has(e.name) && !e.name.startsWith('.')) {
        queue.push(join(rel, e.name));
      }
    }
  }
  return null;
}

/** Files and directories that make up the platform. */
const PAYLOAD = [
  '.claude/agents',
  '.claude/commands',
  '.claude/hooks',
  '.claude/settings.json',
  'CLAUDE.md',
  'scripts/validate-artifacts.mjs',
  'specs/spec-template.md',
  'tasks/task-template.md',
];

const copied = [];
const skipped = [];

function copyPath(rel) {
  const from = join(SOURCE, rel);
  const to = join(target, rel);
  if (!existsSync(from)) return;
  if (statSync(from).isDirectory()) {
    for (const entry of readdirSync(from)) copyPath(join(rel, entry));
    return;
  }
  if (existsSync(to)) { skipped.push(rel); return; }
  if (!dryRun) {
    mkdirSync(dirname(to), { recursive: true });
    copyFileSync(from, to);
  }
  copied.push(rel);
}

const detected = detect(target);
const appDir = appDirFlag ?? detected?.dir ?? '.';

const config = {
  app: {
    dir: appDir,
    language: detected?.language ?? 'unknown',
    install: detected?.install ?? '',
  },
  gates: {
    command: detected?.gates ?? '',
    description: 'lint, type-check, and the full test suite',
  },
  artifacts: { specs: 'specs', tasks: 'tasks' },
  guard: {
    secretPaths: ['.env', '.env.*', '*.pem', '*.key', '*.p12', '*.pfx', 'id_rsa*'],
    platformPaths: ['.claude/*', '.claude/**/*', '.github/workflows/*'],
  },
};

for (const rel of PAYLOAD) copyPath(rel);

const configPath = join(target, 'pipeline.config.json');
const configExists = existsSync(configPath);
if (!configExists && !dryRun) {
  writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
}

console.log(`\nInstalling the agentic pipeline into ${target}${dryRun ? ' (dry run)' : ''}\n`);
console.log(detected
  ? `  Detected ${detected.language} in "${appDir}" — gates: ${config.gates.command}`
  : `  No known toolchain detected. Set app.dir and gates.command in pipeline.config.json by hand.`);
console.log(`\n  Copied  ${copied.length} file(s)`);
if (skipped.length) {
  console.log(`  Skipped ${skipped.length} existing file(s) — review these yourself:`);
  for (const s of skipped) console.log(`            ${s}`);
}
console.log(configExists ? '  Kept    existing pipeline.config.json' : `  Wrote   pipeline.config.json`);

console.log(`
Next steps:
  1. Check pipeline.config.json — especially gates.command; it must pass on a clean checkout.
  2. Run it: cd ${relative(process.cwd(), join(target, appDir)) || '.'} && ${config.gates.command || '<your gate command>'}
  3. Enable branch protection on main (PRs required) — the guard blocks pushes to main,
     but only GitHub can enforce it for humans and other tools.
  4. Open the project in Claude Code and run /pipeline-spec "<your first requirement>".

Read docs/08-operator-guide.md in this repository for how the stages work.
`);
