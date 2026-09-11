#!/usr/bin/env node
/**
 * Checks that an installed pipeline is actually wired up correctly.
 *
 * Run after installing into a project, and any time the pipeline behaves oddly:
 *   node scripts/doctor.mjs
 *
 * Every check states what it verified and, on failure, what to do about it.
 * A check that cannot be performed reports UNKNOWN rather than passing — a
 * green run that skipped half the checks is worse than an honest amber one.
 */
import { existsSync, readFileSync } from 'node:fs';
import { execFileSync, execSync } from 'node:child_process';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const results = [];
const check = (name, fn) => {
  try {
    const { state, detail, fix } = fn();
    results.push({ name, state, detail, fix });
  } catch (err) {
    results.push({ name, state: 'FAIL', detail: err.message.split('\n')[0], fix: undefined });
  }
};
const pass = (detail) => ({ state: 'PASS', detail });
const fail = (detail, fix) => ({ state: 'FAIL', detail, fix });
const warn = (detail, fix) => ({ state: 'WARN', detail, fix });
const unknown = (detail, fix) => ({ state: 'UNKNOWN', detail, fix });

const at = (...p) => join(root, ...p);
const run = (cmd, args, opts = {}) =>
  execFileSync(cmd, args, { cwd: root, encoding: 'utf8', stdio: 'pipe', ...opts });

let config = null;
check('pipeline.config.json is present and valid', () => {
  if (!existsSync(at('pipeline.config.json'))) {
    return fail('not found', 'Run: node scripts/init-pipeline.mjs <this project>');
  }
  config = JSON.parse(readFileSync(at('pipeline.config.json'), 'utf8'));
  return pass(`app.dir="${config.app?.dir}", tier="${config.verification?.tier ?? 'host'}"`);
});

check('a real quality gate is configured', () => {
  const cmd = config?.gates?.command;
  if (!cmd) {
    return fail(
      'gates.command is empty — the pipeline has no way to tell good code from bad',
      'Add a lint/type/test command that fails when the code is wrong, then confirm it FAILS when you break something on purpose.',
    );
  }
  return pass(cmd);
});

check('the agent team is installed', () => {
  const missing = ['requirements-analyst', 'planner', 'architect', 'developer',
    'code-reviewer', 'qa-engineer', 'security-auditor']
    .filter((a) => !existsSync(at('.claude/agents', `${a}.md`)));
  return missing.length
    ? fail(`missing: ${missing.join(', ')}`, 'Re-run the installer; it will not overwrite what exists.')
    : pass('7 agents');
});

check('the stage commands are installed', () => {
  const missing = ['spec', 'plan', 'dev', 'review', 'status']
    .filter((c) => !existsSync(at('.claude/commands', `pipeline-${c}.md`)));
  return missing.length ? fail(`missing: ${missing.join(', ')}`) : pass('5 commands');
});

check('the governance guard is active', () => {
  if (!existsSync(at('.claude/hooks/guard.py'))) return fail('guard.py not found');
  const settings = existsSync(at('.claude/settings.json'))
    ? readFileSync(at('.claude/settings.json'), 'utf8') : '';
  if (!settings.includes('guard.py')) {
    return fail('guard.py exists but settings.json does not invoke it',
      'The hook must be registered in .claude/settings.json, or it never runs.');
  }
  if (!/"matcher":\s*"[^"]*Bash/.test(settings)) {
    return fail('the hook does not match Bash',
      'Agents with shell access can reach protected paths through redirection.');
  }
  return pass('registered for file tools and Bash');
});

check('the guard behaves correctly', () => {
  if (!existsSync(at('.claude/hooks/guard_test.py'))) {
    return unknown('guard_test.py not installed', 'Re-run the installer to get the scenario suite.');
  }
  const out = run('python3', [at('.claude/hooks/guard_test.py')]);
  const m = out.match(/All (\d+) scenarios passed/);
  return m ? pass(`${m[1]} scenarios`) : fail(out.trim().split('\n').pop());
});

check('spec and task conventions hold', () => {
  if (!existsSync(at('scripts/validate-artifacts.mjs'))) return unknown('validator not installed');
  const out = run('node', [at('scripts/validate-artifacts.mjs')]);
  return pass(out.trim());
});

check('CI runs the gates', () => {
  const wf = at('.github/workflows/ci.yml');
  if (!existsSync(wf)) {
    return fail('no .github/workflows/ci.yml',
      'Without CI the gates run only where an agent happens to run them — which is the assurance we are trying not to rely on.');
  }
  const body = readFileSync(wf, 'utf8');
  const missing = [];
  if (!body.includes('validate-artifacts')) missing.push('artifact validation');
  if (!body.includes('guard_test')) missing.push('guard scenarios');
  if (!/gitleaks|secret/i.test(body)) missing.push('secret scanning');
  return missing.length
    ? warn(`present, but not running: ${missing.join(', ')}`, 'Compare against templates/ci.yml.template.')
    : pass('gates, artifact validation, guard scenarios, secret scanning');
});

check('CI config values are injection-safe', () => {
  if (!existsSync(at('scripts/ci-config.mjs'))) {
    return warn('ci-config.mjs not installed',
      'If CI interpolates config values into `run:` directly, an agent that edits the config gains command execution in CI.');
  }
  run('node', [at('scripts/ci-config.mjs')]);
  return pass('validated reader present and config passes it');
});

check('main is protected from direct pushes', () => {
  let remote = '';
  try { remote = run('git', ['remote', 'get-url', 'origin']).trim(); } catch { /* no remote */ }
  if (!remote) return unknown('no git remote configured');
  return unknown(
    'cannot be verified locally',
    'Enable branch protection on main (require a PR, block force-push). The guard stops agents; only the host stops humans and other tools.',
  );
});

check('secrets are not tracked in git', () => {
  let tracked = '';
  try { tracked = execSync('git ls-files', { cwd: root, encoding: 'utf8' }); } catch { return unknown('not a git repository'); }
  const leaked = tracked.split('\n').filter((f) => /(^|\/)\.env($|\.)|\.pem$|\.key$|id_rsa/.test(f));
  return leaked.length
    ? fail(`tracked secret-shaped files: ${leaked.join(', ')}`, 'Remove them from history, rotate the credentials, and add them to .gitignore.')
    : pass('none tracked');
});

const icon = { PASS: '  ok  ', FAIL: ' FAIL ', WARN: ' warn ', UNKNOWN: '  ??  ' };
console.log(`\nPipeline doctor — ${root}\n`);
for (const r of results) {
  console.log(`${icon[r.state]} ${r.name}`);
  if (r.detail) console.log(`        ${r.detail}`);
  if (r.fix && r.state !== 'PASS') console.log(`        → ${r.fix}`);
}

const failed = results.filter((r) => r.state === 'FAIL').length;
const unknowns = results.filter((r) => r.state === 'UNKNOWN').length;
console.log(
  `\n${results.filter((r) => r.state === 'PASS').length} passed, ${failed} failed, ` +
  `${results.filter((r) => r.state === 'WARN').length} warnings, ${unknowns} unverifiable.\n`,
);
if (failed) {
  console.log('Fix the failures above before running the pipeline: each one removes a control the pipeline assumes it has.\n');
}
process.exit(failed ? 1 : 0);
