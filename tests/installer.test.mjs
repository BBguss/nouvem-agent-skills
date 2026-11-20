// Installer tests: run install.sh / uninstall.sh (wrappers around install.mjs) against a temporary
// HOME and a copy of the pack.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(HERE, '..');

let root, home, pack, bin;
const AGY_ORIGINAL = { 'process-kill-guard': { PreToolUse: [{ type: 'command', command: 'node /opt/guard.cjs', timeout: 5 }] } };
const ORIGINAL = {
  model: 'opus',
  env: { FOO: 'bar' },
  permissions: { allow: ['Bash(ls:*)'] },
  hooks: {
    PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: 'sh /opt/guard.sh' }] }],
    UserPromptSubmit: [{ hooks: [{ type: 'command', command: 'node /opt/watch.cjs' }] }],
    SessionStart: [{ hooks: [{ type: 'command', command: 'node /opt/watch.cjs' }] }],
    Stop: [{ hooks: [{ type: 'command', command: 'node /opt/watch.cjs' }] }],
  },
};

function run(script, args = [], extraEnv = {}) {
  const r = spawnSync(process.env.TEST_SH || 'sh', [path.join(pack, script), ...args], {
    encoding: 'utf8',
    env: { HOME: home, PATH: `${bin}:/usr/bin:/bin`, XDG_CACHE_HOME: path.join(home, '.cache'), ...extraEnv },
  });
  assert.equal(r.status, 0, `${script} ${args.join(' ')} failed:\n${r.stdout}\n${r.stderr}`);
  return r.stdout;
}
const readJson = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const snapshot = () => {
  const out = {};
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (p.includes(`${path.sep}.cache`)) continue;
      if (e.isSymbolicLink()) out[p] = 'link:' + fs.readlinkSync(p);
      else if (e.isDirectory()) walk(p);
      else if (!/\.bak-\d/.test(e.name)) out[p] = fs.readFileSync(p, 'utf8');
    }
  };
  walk(home);
  return out;
};
const routerCount = (settings, event) => (settings.hooks[event] || [])
  .flatMap((e) => e.hooks).filter((h) => h.command.includes('skill-router.mjs')).length;

before(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-pack-install-'));
  home = path.join(root, 'home');
  pack = path.join(root, 'pack');
  bin = path.join(root, 'bin');
  // hermetic pack copy: scripts + hooks + fixture skills
  fs.mkdirSync(pack, { recursive: true });
  for (const f of ['install.mjs', 'install.sh', 'uninstall.sh', 'link-all.sh']) fs.copyFileSync(path.join(SRC, f), path.join(pack, f));
  fs.cpSync(path.join(SRC, 'hooks'), path.join(pack, 'hooks'), { recursive: true });
  fs.cpSync(path.join(HERE, 'fixtures', 'pack'), pack, { recursive: true });
  // PATH: node only
  fs.mkdirSync(bin);
  fs.symlinkSync(process.execPath, path.join(bin, 'node'));
  // harness homes
  fs.mkdirSync(path.join(home, '.claude', 'skills', 'release-deploy'), { recursive: true }); // a real folder: must survive
  fs.writeFileSync(path.join(home, '.claude', 'skills', 'release-deploy', 'SKILL.md'), 'user-owned\n');
  fs.writeFileSync(path.join(home, '.claude', 'settings.json'), JSON.stringify(ORIGINAL, null, 2));
  fs.mkdirSync(path.join(home, '.agents', 'skills'), { recursive: true });
  fs.mkdirSync(path.join(home, '.codex'), { recursive: true });
  fs.writeFileSync(path.join(home, '.codex', 'AGENTS.md'), '# My codex rules\n\nBe nice.\n');
  // Antigravity: global config with a user hook that must survive
  fs.mkdirSync(path.join(home, '.gemini', 'config'), { recursive: true });
  fs.writeFileSync(path.join(home, '.gemini', 'config', 'hooks.json'), JSON.stringify(AGY_ORIGINAL, null, 2));
  // leftovers of the old Gemini CLI target: link, BeforeAgent hook, GEMINI.md block
  const realPack = fs.realpathSync(pack);
  fs.mkdirSync(path.join(home, '.gemini', 'skills'), { recursive: true });
  fs.symlinkSync(path.join(realPack, 'build-project'), path.join(home, '.gemini', 'skills', 'build-project'));
  fs.writeFileSync(path.join(home, '.gemini', 'settings.json'), JSON.stringify({ theme: 'dark', hooks: { BeforeAgent: [{ matcher: '*', hooks: [{ type: 'command', command: `node "${path.join(realPack, 'hooks', 'skill-router.mjs')}"` }] }] } }));
  fs.writeFileSync(path.join(home, '.gemini', 'GEMINI.md'), '# mine\n\n<!-- skill-pack:begin -->\nold\n<!-- skill-pack:end -->\n');
  fs.mkdirSync(path.join(home, '.config', 'opencode', 'node_modules', '@opencode-ai', 'plugin'), { recursive: true });
});
after(() => fs.rmSync(root, { recursive: true, force: true }));

describe('install.sh / uninstall.sh', () => {
  test('--dry-run changes nothing', () => {
    const before = snapshot();
    const out = run('install.sh', ['--dry-run']);
    assert.match(out, /dry run/);
    assert.deepEqual(snapshot(), before);
  });

  test('install wires every harness and keeps existing settings and hooks', () => {
    const out = run('install.sh');
    assert.match(out, /Summary/);
    const s = readJson(path.join(home, '.claude', 'settings.json'));
    for (const k of ['model', 'env', 'permissions']) assert.deepEqual(s[k], ORIGINAL[k]);
    for (const [event, list] of Object.entries(ORIGINAL.hooks)) {
      for (const e of list) assert.ok(s.hooks[event].some((x) => JSON.stringify(x) === JSON.stringify(e)), `${event} kept`);
    }
    assert.equal(routerCount(s, 'UserPromptSubmit'), 1);
    assert.equal(s.hooks.UserPromptSubmit.length, 2);
    assert.ok(fs.readdirSync(path.join(home, '.claude')).some((f) => f.startsWith('settings.json.bak-')), 'backup written');

    // links: created for pack skills, the real folder untouched
    const link = path.join(home, '.claude', 'skills', 'build-project');
    assert.ok(fs.lstatSync(link).isSymbolicLink());
    assert.equal(fs.readlinkSync(link), path.join(fs.realpathSync(pack), 'build-project'));
    assert.equal(fs.readFileSync(path.join(home, '.claude', 'skills', 'release-deploy', 'SKILL.md'), 'utf8'), 'user-owned\n');
    for (const d of ['.agents/skills', '.codex/skills', '.gemini/config/skills', '.config/opencode/skills']) {
      assert.ok(fs.lstatSync(path.join(home, d, 'release-deploy')).isSymbolicLink(), d);
    }

    // codex: hooks.json + managed block appended after the user's rules
    assert.equal(routerCount(readJson(path.join(home, '.codex', 'hooks.json')), 'UserPromptSubmit'), 1);
    const codexMd = fs.readFileSync(path.join(home, '.codex', 'AGENTS.md'), 'utf8');
    assert.match(codexMd, /^# My codex rules/);
    assert.match(codexMd, /<!-- skill-pack:begin -->[\s\S]*\| build-project \|[\s\S]*<!-- skill-pack:end -->/);

    // antigravity: named PreInvocation hook next to the user's own hook
    const agy = readJson(path.join(home, '.gemini', 'config', 'hooks.json'));
    assert.deepEqual(agy['process-kill-guard'], AGY_ORIGINAL['process-kill-guard']);
    assert.match(agy['skill-pack-router'].PreInvocation[0].command, /skill-router\.mjs/);
    // old Gemini CLI wiring is cleaned up, the user's own content stays
    assert.ok(!fs.existsSync(path.join(home, '.gemini', 'skills', 'build-project')));
    const g = readJson(path.join(home, '.gemini', 'settings.json'));
    assert.equal(g.theme, 'dark');
    assert.equal(routerCount(g, 'BeforeAgent'), 0);
    assert.equal(fs.readFileSync(path.join(home, '.gemini', 'GEMINI.md'), 'utf8'), '# mine\n');

    // opencode: plugin with the pack path filled in, plus fallback block
    const plugin = fs.readFileSync(path.join(home, '.config', 'opencode', 'plugins', 'skill-pack-router.js'), 'utf8');
    assert.ok(plugin.includes('file://') && plugin.includes('skill-router.mjs') && !plugin.includes('__SKILL_PACK_ROUTER_URL__'));
    assert.match(fs.readFileSync(path.join(home, '.config', 'opencode', 'AGENTS.md'), 'utf8'), /skill-pack:begin/);
  });

  test('second run is idempotent', () => {
    const before = snapshot();
    const out = run('install.sh');
    assert.deepEqual(snapshot(), before);
    assert.match(out, /already present/);
    assert.match(out, /up to date/);
  });

  test('installed hook command works', () => {
    const s = readJson(path.join(home, '.claude', 'settings.json'));
    const cmd = s.hooks.UserPromptSubmit.flatMap((e) => e.hooks).find((h) => h.command.includes('skill-router')).command;
    const r = spawnSync('sh', ['-c', cmd], {
      input: JSON.stringify({ prompt: 'bikin web portofolio', cwd: os.tmpdir() }),
      encoding: 'utf8',
      env: { HOME: home, PATH: `${bin}:/usr/bin:/bin`, XDG_CACHE_HOME: path.join(home, '.cache') },
    });
    assert.equal(r.status, 0);
    assert.match(JSON.parse(r.stdout).hookSpecificOutput.additionalContext, /build-project/);
  });

  test('installed Antigravity hook injects once per turn', () => {
    const cmd = readJson(path.join(home, '.gemini', 'config', 'hooks.json'))['skill-pack-router'].PreInvocation[0].command;
    const call = () => spawnSync('sh', ['-c', cmd], {
      input: JSON.stringify({ hookEventName: 'PreInvocation', conversationId: 'c-test', initialNumSteps: 4, lastUserInput: 'bikin web portofolio', workspacePaths: [os.tmpdir()] }),
      encoding: 'utf8',
      env: { HOME: home, PATH: `${bin}:/usr/bin:/bin`, XDG_CACHE_HOME: path.join(home, '.cache') },
    });
    const first = call();
    assert.equal(first.status, 0);
    assert.match(JSON.parse(first.stdout).injectSteps[0].systemMessage.systemMessage, /build-project/);
    assert.deepEqual(JSON.parse(call().stdout), {});
  });

  test('--no-hooks gives Antigravity an always-on rule instead of the hook', () => {
    const h2 = path.join(root, 'home2');
    fs.mkdirSync(path.join(h2, '.gemini', 'config'), { recursive: true });
    const r = spawnSync('sh', [path.join(pack, 'install.sh'), '--no-hooks', '--harness', 'gemini'], {
      encoding: 'utf8', env: { HOME: h2, PATH: `${bin}:/usr/bin:/bin`, XDG_CACHE_HOME: path.join(h2, '.cache') },
    });
    assert.equal(r.status, 0, r.stderr);
    const rule = fs.readFileSync(path.join(h2, '.gemini', 'config', 'rules', 'skill-pack.md'), 'utf8');
    assert.match(rule, /^---\nname: skill-pack-router[\s\S]*trigger: always_on[\s\S]*\| build-project \|/);
    assert.ok(!fs.existsSync(path.join(h2, '.gemini', 'config', 'hooks.json')));
    spawnSync('sh', [path.join(pack, 'uninstall.sh'), '--harness', 'antigravity'], { env: { HOME: h2, PATH: `${bin}:/usr/bin:/bin` } });
    assert.ok(!fs.existsSync(path.join(h2, '.gemini', 'config', 'rules', 'skill-pack.md')));
  });

  test('--harness limits the targets', () => {
    const out = run('install.sh', ['--dry-run', '--harness', 'codex']);
    assert.match(out, /codex/);
    assert.doesNotMatch(out, /^claude/m);
  });

  test('--project writes the project hook and AGENTS.md block only', () => {
    const proj = path.join(root, 'proj');
    fs.mkdirSync(proj);
    run('install.sh', ['--project', proj]);
    assert.equal(routerCount(readJson(path.join(proj, '.claude', 'settings.json')), 'UserPromptSubmit'), 1);
    assert.match(fs.readFileSync(path.join(proj, 'AGENTS.md'), 'utf8'), /skill-pack:begin/);
    assert.ok(readJson(path.join(proj, '.agents', 'hooks.json'))['skill-pack-router']);
    run('install.sh', ['--uninstall', '--project', proj]);
    assert.equal(routerCount(readJson(path.join(proj, '.claude', 'settings.json')), 'UserPromptSubmit'), 0);
    assert.ok(!fs.existsSync(path.join(proj, 'AGENTS.md')));
    assert.deepEqual(readJson(path.join(proj, '.agents', 'hooks.json')), {});
  });

  test('uninstall removes only what install created', () => {
    run('uninstall.sh');
    const s = readJson(path.join(home, '.claude', 'settings.json'));
    assert.deepEqual(s.hooks, ORIGINAL.hooks);
    assert.equal(s.model, 'opus');
    assert.ok(!fs.existsSync(path.join(home, '.claude', 'skills', 'build-project')));
    assert.equal(fs.readFileSync(path.join(home, '.claude', 'skills', 'release-deploy', 'SKILL.md'), 'utf8'), 'user-owned\n');
    assert.equal(fs.readFileSync(path.join(home, '.codex', 'AGENTS.md'), 'utf8'), '# My codex rules\n\nBe nice.\n');
    assert.ok(!fs.existsSync(path.join(home, '.config', 'opencode', 'plugins', 'skill-pack-router.js')));
    assert.ok(!fs.existsSync(path.join(home, '.config', 'opencode', 'AGENTS.md')));
    assert.deepEqual(readJson(path.join(home, '.gemini', 'config', 'hooks.json')), AGY_ORIGINAL);
    assert.ok(!fs.existsSync(path.join(home, '.gemini', 'config', 'skills', 'build-project')));
  });

  test('invalid settings.json is left untouched', () => {
    const f = path.join(home, '.claude', 'settings.json');
    fs.writeFileSync(f, '{ broken');
    const out = run('install.sh', ['--harness', 'claude']);
    assert.match(out, /FAILED/);
    assert.equal(fs.readFileSync(f, 'utf8'), '{ broken');
  });
});
