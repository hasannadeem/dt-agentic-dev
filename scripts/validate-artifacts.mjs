#!/usr/bin/env node
/**
 * Validates the pipeline's own artifacts against the conventions in CLAUDE.md.
 *
 * We claim "traceability by construction"; without this, it is traceability by
 * good manners. Runs in CI alongside the app's gates.
 *
 * Usage: node scripts/validate-artifacts.mjs
 * Exit 0 = all conventions hold, 1 = violations found.
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Project layout comes from pipeline.config.json when present, so this script
 *  works unmodified in any repository that adopts the platform. */
function config() {
  try {
    return JSON.parse(readFileSync(join(root, 'pipeline.config.json'), 'utf8'));
  } catch {
    return {};
  }
}
const { specs: SPEC_DIR = 'specs', tasks: TASK_DIR = 'tasks' } = config().artifacts ?? {};

const SPEC_STATUSES = ['Draft', 'Approved', 'Implemented', 'Superseded'];
const TASK_STATUSES = ['Todo', 'In progress', 'In review', 'Done', 'Blocked'];
const SPEC_FILE = /^SPEC-(\d{3})-[a-z0-9-]+\.md$/;
const TASK_FILE = /^TASK-(\d{3})\.(\d+)-[a-z0-9-]+\.md$/;

const problems = [];
const fail = (file, msg) => problems.push(`${file}: ${msg}`);

/** Reads the value of a `**Field:** value` line, ignoring any trailing HTML comment. */
function field(body, name) {
  const m = body.match(new RegExp(`^\\*\\*${name}:\\*\\*\\s*(.+)$`, 'm'));
  if (!m) return null;
  return m[1].replace(/<!--.*?-->/g, '').trim();
}

function listMarkdown(dir) {
  const path = join(root, dir);
  if (!existsSync(path)) return [];
  return readdirSync(path).filter((f) => f.endsWith('.md') && !f.endsWith('-template.md'));
}

// ---- specs -------------------------------------------------------------
const specs = new Map(); // "001" -> { file, status }

for (const file of listMarkdown(SPEC_DIR)) {
  const match = SPEC_FILE.exec(file);
  if (!match) {
    fail(`${SPEC_DIR}/${file}`, 'filename must match SPEC-<nnn>-<kebab-slug>.md');
    continue;
  }
  const body = readFileSync(join(root, SPEC_DIR, file), 'utf8');
  const status = field(body, 'Status');

  if (!status) fail(`${SPEC_DIR}/${file}`, 'missing a **Status:** line');
  else if (!SPEC_STATUSES.includes(status))
    fail(`${SPEC_DIR}/${file}`, `status "${status}" is not one of ${SPEC_STATUSES.join(' | ')}`);

  for (const section of ['## Open questions & assumptions', '## Acceptance criteria']) {
    if (!body.includes(section)) fail(`${SPEC_DIR}/${file}`, `missing required section "${section}"`);
  }

  if (specs.has(match[1]))
    fail(`${SPEC_DIR}/${file}`, `duplicate spec number ${match[1]} (also ${specs.get(match[1]).file})`);
  specs.set(match[1], { file, status });
}

// ---- tasks -------------------------------------------------------------
const tasksBySpec = new Map();

for (const file of listMarkdown(TASK_DIR)) {
  const match = TASK_FILE.exec(file);
  if (!match) {
    fail(`${TASK_DIR}/${file}`, 'filename must match TASK-<nnn>.<n>-<kebab-slug>.md');
    continue;
  }
  const [, specNum] = match;
  const body = readFileSync(join(root, TASK_DIR, file), 'utf8');
  const status = field(body, 'Status');
  const specRef = field(body, 'Spec');
  const branch = field(body, 'Branch');

  if (!status) fail(`${TASK_DIR}/${file}`, 'missing a **Status:** line');
  else if (!TASK_STATUSES.includes(status))
    fail(`${TASK_DIR}/${file}`, `status "${status}" is not one of ${TASK_STATUSES.join(' | ')}`);

  if (!body.includes('## Done-criteria'))
    fail(`${TASK_DIR}/${file}`, 'missing required section "## Done-criteria"');

  // Spec 000 is the reserved "no spec" bucket for maintenance work.
  if (specNum !== '000') {
    const spec = specs.get(specNum);
    if (!spec) {
      fail(`${TASK_DIR}/${file}`, `references SPEC-${specNum}, which does not exist`);
    } else {
      if (spec.status === 'Draft')
        fail(`${TASK_DIR}/${file}`, `derives from SPEC-${specNum}, which is still Draft — only a human may approve a spec before tasks are written`);
      (tasksBySpec.get(specNum) ?? tasksBySpec.set(specNum, []).get(specNum)).push({ file, status });
    }
  } else if (specRef && !/none/i.test(specRef)) {
    fail(`${TASK_DIR}/${file}`, 'TASK-000.* is the no-spec bucket; its **Spec:** line should say "none"');
  }

  if (branch && !/^(task\/\d{3}\.\d+-[a-z0-9-]+|none)/.test(branch))
    fail(`${TASK_DIR}/${file}`, `branch "${branch}" must match task/<specnnn>.<n>-<slug>`);
}

// ---- cross-artifact consistency ---------------------------------------
for (const [num, spec] of specs) {
  if (spec.status !== 'Implemented') continue;
  const open = (tasksBySpec.get(num) ?? []).filter((t) => t.status !== 'Done');
  for (const task of open)
    fail(`${SPEC_DIR}/${spec.file}`, `marked Implemented but ${task.file} is still "${task.status}"`);
}

// ---- report ------------------------------------------------------------
if (problems.length) {
  console.error(`Artifact validation failed (${problems.length} problem${problems.length > 1 ? 's' : ''}):\n`);
  for (const p of problems) console.error(`  - ${p}`);
  console.error('\nConventions are defined in CLAUDE.md.');
  process.exit(1);
}

console.log(`Artifact validation passed: ${specs.size} spec(s), ${[...tasksBySpec.values()].flat().length} spec-linked task(s).`);
