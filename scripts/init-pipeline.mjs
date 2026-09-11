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
  // Android must be detected before generic Gradle/Node: an Android repo has a
  // build.gradle too, and many have a package.json for tooling.
  {
    id: 'android', marker: 'settings.gradle.kts', language: 'android (gradle)',
    install: './gradlew --no-daemon help', tier: 'virtual',
    // `lint` alone checks only the DEFAULT variant — naming the variant is not
    // optional. Lint is also not part of `build`, so it must be named too.
    gates: () => './gradlew --no-daemon lintDebug testDebugUnitTest',
  },
  {
    id: 'android', marker: 'settings.gradle', language: 'android (gradle)',
    install: './gradlew --no-daemon help', tier: 'virtual',
    gates: () => './gradlew --no-daemon lintDebug testDebugUnitTest',
  },
  {
    id: 'apple', marker: 'Package.swift', language: 'swift package',
    install: 'swift package resolve', tier: 'host',
    gates: () => 'swift build && swift test',
  },
  {
    id: 'flutter', marker: 'pubspec.yaml', language: 'flutter/dart', tier: 'host',
    install: 'flutter pub get',
    gates: () => 'dart format --output=none --set-exit-if-changed . && flutter analyze --fatal-infos && flutter test',
  },
  {
    id: 'dotnet', marker: 'global.json', language: '.net', install: 'dotnet restore', tier: 'host',
    // `dotnet test` builds by default; --no-build needs a matching prior build.
    gates: () => 'dotnet format --verify-no-changes && dotnet build -c Release && dotnet test -c Release --no-build',
  },
  {
    id: 'maven', marker: 'pom.xml', language: 'java (maven)', install: 'mvn -B -ntp dependency:go-offline', tier: 'host',
    // `verify`, not `test`: `test` skips integration tests and packaging.
    gates: () => 'mvn -B -ntp verify',
  },
  {
    id: 'elixir', marker: 'mix.exs', language: 'elixir', install: 'mix deps.get', tier: 'host',
    gates: () => 'mix compile --warnings-as-errors && mix format --check-formatted && mix test',
  },
  {
    id: 'php', marker: 'composer.json', language: 'php', install: 'composer install --no-interaction --prefer-dist', tier: 'host',
    gates: () => 'vendor/bin/phpunit',
  },
  {
    id: 'cpp', marker: 'CMakeLists.txt', language: 'c/c++', install: 'cmake -B build -DCMAKE_BUILD_TYPE=Debug', tier: 'host',
    gates: () => 'cmake --build build && ctest --test-dir build --output-on-failure',
  },
  {
    id: 'node', marker: 'package.json', language: 'javascript/typescript',
    install: 'npm ci',
    gates: (dir) => {
      const pkgPath = join(dir, 'package.json');
      let scripts = {};
      try { scripts = JSON.parse(readFileSync(pkgPath, 'utf8')).scripts ?? {}; } catch { /* unreadable */ }
      if (scripts.gates) return 'npm run gates';
      const parts = ['lint', 'typecheck', 'test'].filter((s) => scripts[s]).map((s) => `npm run ${s}`);
      // Returning a command that cannot pass is worse than returning nothing:
      // the pipeline's entire quality model assumes the gate is real.
      return parts.length ? parts.join(' && ') : null;
    },
  },
  { id: 'python', marker: 'pyproject.toml', language: 'python', install: 'pip install -e ".[dev]"', gates: () => 'ruff check . && ruff format --check . && pytest -q', tier: 'host' },
  { id: 'python', marker: 'requirements.txt', language: 'python', install: 'pip install -r requirements.txt', gates: () => 'ruff check . && pytest -q', tier: 'host' },
  { id: 'go', marker: 'go.mod', language: 'go', install: 'go mod download', gates: () => 'go build ./... && go vet ./... && go test -race ./...', tier: 'host' },
  { id: 'rust', marker: 'Cargo.toml', language: 'rust', install: 'cargo fetch', gates: () => 'cargo fmt --all -- --check && cargo clippy --all-targets --all-features -- -D warnings && cargo test --all-features', tier: 'host' },
  { id: 'ruby', marker: 'Gemfile', language: 'ruby', install: 'bundle install', gates: () => 'bundle exec rubocop && bundle exec rspec', tier: 'host' },
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
  'scripts/ci-config.mjs',
  'docs/11-capability-tiers.md',
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
  // Which tier of verification this project's gate command can reach. Anything
  // above "host" means CI cannot prove the feature works — see
  // docs/11-capability-tiers.md. Specs for such projects must declare what a
  // human has to check on real hardware.
  verification: { tier: detected?.tier ?? 'host' },
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
const gatesUsable = Boolean(config.gates.command);
if (detected && gatesUsable) {
  console.log(`  Detected ${detected.language} in "${appDir}" — gates: ${config.gates.command}`);
} else if (detected) {
  console.log(`  Detected ${detected.language} in "${appDir}", but found no usable gate command.`);
} else {
  console.log('  No known toolchain detected. Set app.dir and gates.command in pipeline.config.json by hand.');
}

if (config.verification.tier !== 'host') {
  console.log(`
  NOTE: detected a ${config.verification.tier}-tier project. Its gate command runs
  host-side checks only. Emulator, device and hardware behaviour cannot be
  proven by CI — specs must declare what a human verifies on real hardware.
  See docs/11-capability-tiers.md (copied into your project).`);
}

if (!gatesUsable) {
  console.log(`
  ⚠  THIS PROJECT HAS NO QUALITY GATE.

     The pipeline's safety model rests entirely on a gate command that fails
     when the code is wrong. Without one, agents will write code with nothing
     checking it, the reviewer's verdict becomes the only signal, and "all
     gates green" means nothing. Do not run the pipeline in this state.

     Before using it here, give the project a real gate:
       1. Add a test runner and enough characterisation tests to capture what
          the code does today — start with the paths you would be most afraid
          to break.
       2. Add linting, and type-checking if the language supports it.
       3. Put the combined command in gates.command and confirm it passes on a
          clean checkout, then confirm it FAILS when you deliberately break
          something. An unfalsifiable gate is not a gate.

     Untested codebases need this bootstrap step first — it is not yet
     automated. See docs/10-improvement-backlog.md.`);
}
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
