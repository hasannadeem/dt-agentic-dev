#!/usr/bin/env node
/**
 * Emits validated pipeline.config.json values as GitHub Actions step outputs.
 *
 * Exists because the obvious approach — reading the config inline and
 * interpolating `${{ steps.cfg.outputs.gates }}` into `run:` — puts
 * repository-controlled text directly into a shell at workflow-render time.
 * That is a command-injection path, and an agent able to edit the config would
 * gain arbitrary execution in CI, defeating the rule that agents cannot touch
 * CI at all. It is structurally how the Nx supply-chain compromise started.
 *
 * Two defences here; the third is that `pipeline.config.json` is in the guard's
 * protected paths, so subagents cannot edit it in the first place.
 *   1. Values are rejected if they contain newlines or characters that have no
 *      business in a build command — a newline alone can forge extra step
 *      outputs by writing straight into $GITHUB_OUTPUT.
 *   2. The workflow passes them through `env:` and quotes them, so the shell
 *      never sees them as literal script text.
 */
import { readFileSync } from 'node:fs';

const FIELDS = {
  dir: { path: ['app', 'dir'], fallback: '.', pattern: /^[\w./-]+$/ },
  install: { path: ['app', 'install'], fallback: '', pattern: /^[\w./\- "'=:@&|]*$/ },
  gates: { path: ['gates', 'command'], fallback: '', pattern: /^[\w./\- "'=:@&|]*$/ },
};

function read(config, path) {
  return path.reduce((node, key) => (node == null ? undefined : node[key]), config);
}

let config;
try {
  config = JSON.parse(readFileSync('pipeline.config.json', 'utf8'));
} catch (err) {
  console.error(`Cannot read pipeline.config.json: ${err.message}`);
  process.exit(1);
}

const lines = [];
for (const [name, { path, fallback, pattern }] of Object.entries(FIELDS)) {
  const value = String(read(config, path) ?? fallback);
  if (/[\r\n]/.test(value)) {
    console.error(`pipeline.config.json: ${path.join('.')} must not contain newlines.`);
    process.exit(1);
  }
  if (!pattern.test(value)) {
    console.error(
      `pipeline.config.json: ${path.join('.')} contains characters that are not permitted ` +
      `in a build command (got: ${JSON.stringify(value)}). Shell metacharacters such as ` +
      '$ ` ; ( ) < > are rejected so a configuration file cannot become a CI exploit.',
    );
    process.exit(1);
  }
  lines.push(`${name}=${value}`);
}

if (!read(config, ['gates', 'command'])) {
  console.error('pipeline.config.json: gates.command is empty. The pipeline has no quality gate.');
  process.exit(1);
}

console.log(lines.join('\n'));
