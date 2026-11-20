// Router tests: node --test tests/*.test.mjs
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PACK = path.resolve(HERE, '..');
const ROUTER = path.join(PACK, 'hooks', 'skill-router.mjs');
const FIXTURE_PACK = path.join(HERE, 'fixtures', 'pack');
const FIXTURE_PROJECT = path.join(HERE, 'fixtures', 'project-node');

const cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-router-cache-'));
process.env.SKILL_ROUTER_CACHE_DIR = cacheDir;
process.env.SKILL_PACK_DIR = FIXTURE_PACK;
const R = await import(ROUTER);

after(() => fs.rmSync(cacheDir, { recursive: true, force: true }));

const names = (prompt, cwd = os.tmpdir()) => R.route(prompt, cwd).picked.map((p) => p.skill.name);

function hook(input, env = {}) {
  const r = spawnSync(process.execPath, [ROUTER], {
    input: typeof input === 'string' ? input : JSON.stringify(input),
    encoding: 'utf8',
    env: { ...process.env, SKILL_PACK_DIR: FIXTURE_PACK, SKILL_ROUTER_CACHE_DIR: cacheDir, ...env },
  });
  return r;
}

describe('routing (fixture pack)', () => {
  const cases = [
    ['bikin web portofolio pakai next', ['build-project']],
    ['build me a portfolio website with next.js', ['build-project']],
    ['deploy ke production', ['release-deploy']],
    ['please deploy this to production tonight', ['release-deploy']],
    ['setup project ini di lokal', ['local-dev-setup']],
    ['how do I run this repo locally?', ['local-dev-setup']],
    ['cek keamanan kode ini', ['security-audit-cycle']],
    ['check the security of this endpoint', ['security-audit-cycle']],
    ['/off-sec the payment api', ['security-audit-cycle']],
    ['jalankan sub-agent secara paralel', ['task-delegation']],
  ];
  for (const [prompt, want] of cases) {
    test(`"${prompt}" -> ${want.join(', ')}`, () => {
      const got = names(prompt);
      assert.equal(got[0], want[0], `got ${JSON.stringify(got)}`);
    });
  }

  test('"kenapa build saya error" -> analyze-problem or error-runbook, not build-project', () => {
    const got = names('kenapa build saya error');
    assert.ok(['analyze-problem', 'error-runbook'].includes(got[0]), `got ${JSON.stringify(got)}`);
    assert.ok(!got.includes('build-project'));
  });

  test('"why does the build fail with this stack trace" -> error-runbook / analyze-problem', () => {
    const got = names('why does the build fail with this stack trace');
    assert.ok(got.includes('error-runbook'), `got ${JSON.stringify(got)}`);
  });

  for (const p of ['hello', 'thanks!', 'ok', '']) {
    test(`"${p}" -> nothing`, () => assert.deepEqual(names(p), []));
  }

  test('whole-word matching: "redeployment" does not trigger release-deploy', () => {
    assert.ok(!names('write redeployment notes for the team').includes('release-deploy'));
  });

  test('negative regex suppresses (local-dev-setup off for production prompts)', () => {
    const r = R.route('setup di lokal lalu ke production', os.tmpdir());
    const s = r.scores.find((x) => x.skill.name === 'local-dev-setup');
    assert.equal(s.score, 0);
    assert.ok(s.suppressed);
  });

  test('negative in own triggers: "jangan deploy" suppresses release-deploy', () => {
    assert.ok(!names('cek config deploy, jangan deploy dulu').includes('release-deploy'));
  });

  test('files in cwd only boost when there is a text hit', () => {
    assert.deepEqual(names('hello', FIXTURE_PROJECT), []);
    const inTmp = R.route('deploy ke production', os.tmpdir()).picked[0].score;
    const inProj = R.route('deploy ke production', FIXTURE_PROJECT).picked[0].score;
    assert.ok(inProj > inTmp, `${inProj} > ${inTmp}`);
  });

  test('two strong matches add dynamic-workflow (priority 0 fallback)', () => {
    const got = names('bikin web portofolio lalu deploy ke production');
    assert.ok(got.includes('build-project') && got.includes('release-deploy'), JSON.stringify(got));
    assert.equal(got[got.length - 1], 'dynamic-workflow');
  });

  test('priority 0 skill alone is used only when nothing specific matches', () => {
    assert.deepEqual(names('set up a workflow for me'), ['dynamic-workflow']);
    assert.ok(!names('deploy the workflow to production').includes('dynamic-workflow'));
  });

  test('at most 3 skills (+ dynamic-workflow)', () => {
    const got = names('bikin web portofolio, cek keamanan, deploy ke production, jalankan sub-agent secara paralel');
    assert.ok(got.filter((n) => n !== 'dynamic-workflow').length <= 3, JSON.stringify(got));
  });

  test('skill without triggers.json falls back to its description', () => {
    assert.deepEqual(names('tolong optimasi SEO situs ini'), ['web-quality-audit']);
  });
});

describe('hook I/O', () => {
  const ctxOf = (r) => JSON.parse(r.stdout).hookSpecificOutput;

  test('Claude Code UserPromptSubmit payload', () => {
    const r = hook({ session_id: 'x', hook_event_name: 'UserPromptSubmit', prompt: 'bikin web portofolio', cwd: os.tmpdir() });
    assert.equal(r.status, 0);
    const o = ctxOf(r);
    assert.equal(o.hookEventName, 'UserPromptSubmit');
    assert.match(o.additionalContext, /build-project/);
    assert.match(o.additionalContext, /SKILL\.md/);
    assert.match(o.additionalContext, /take precedence/);
  });

  test('Gemini CLI BeforeAgent payload echoes the event name', () => {
    const o = ctxOf(hook({ hook_event_name: 'BeforeAgent', prompt: 'deploy ke production', cwd: os.tmpdir() }));
    assert.equal(o.hookEventName, 'BeforeAgent');
    assert.match(o.additionalContext, /release-deploy/);
  });

  for (const shape of [
    { user_prompt: 'deploy ke production' },
    { input: 'deploy ke production' },
    { message: 'deploy ke production' },
    { message: { role: 'user', content: [{ type: 'text', text: 'deploy ke production' }] } },
    { messages: [{ role: 'user', content: 'hello' }, { role: 'assistant', content: 'hi' }, { role: 'user', content: 'deploy ke production' }] },
  ]) {
    test(`payload shape ${Object.keys(shape)[0]}`, () => assert.match(ctxOf(hook(shape)).additionalContext, /release-deploy/));
  }

  test('plain text stdin', () => assert.match(ctxOf(hook('deploy ke production')).additionalContext, /release-deploy/));

  test('no match prints nothing, exit 0', () => {
    const r = hook({ prompt: 'hello' });
    assert.equal(r.status, 0);
    assert.equal(r.stdout, '');
  });

  test('garbage and empty input never fail', () => {
    for (const input of ['', '{', '\u0000\u0001', '{"prompt": 42}', 'null', '[]']) {
      const r = hook(input);
      assert.equal(r.status, 0, `input ${JSON.stringify(input)}`);
    }
  });

  test('harness notices are not routed', () => {
    assert.equal(hook({ prompt: '<task-notification>\n<summary>deploy ke production</summary></task-notification>' }).stdout, '');
    assert.equal(hook({ prompt: '<system-reminder>deploy ke production</system-reminder>' }).stdout, '');
  });

  test('SKILL_ROUTER_DISABLE=1 prints nothing', () => {
    assert.equal(hook({ prompt: 'deploy ke production' }, { SKILL_ROUTER_DISABLE: '1' }).stdout, '');
  });

  test('SKILL_ROUTER_DEBUG=1 writes scores to stderr only', () => {
    const r = hook({ prompt: 'deploy ke production' }, { SKILL_ROUTER_DEBUG: '1' });
    assert.match(r.stderr, /\[skill-router\] .*release-deploy/);
    assert.doesNotThrow(() => JSON.parse(r.stdout));
  });

  test('missing pack dir: exit 0, no output', () => {
    const r = hook({ prompt: 'deploy ke production' }, { SKILL_PACK_DIR: path.join(os.tmpdir(), 'does-not-exist-pack') });
    assert.equal(r.status, 0);
    assert.equal(r.stdout, '');
  });

  test('--explain CLI', () => {
    const r = spawnSync(process.execPath, [ROUTER, '--explain', 'deploy ke production'], {
      encoding: 'utf8', env: { ...process.env, SKILL_PACK_DIR: FIXTURE_PACK, SKILL_ROUTER_CACHE_DIR: cacheDir },
    });
    assert.equal(r.status, 0);
    assert.match(r.stdout, /release-deploy/);
    assert.match(r.stdout, /threshold/);
  });

  test('--table lists every skill', () => {
    const r = spawnSync(process.execPath, [ROUTER, '--table'], {
      encoding: 'utf8', env: { ...process.env, SKILL_PACK_DIR: FIXTURE_PACK, SKILL_ROUTER_CACHE_DIR: cacheDir },
    });
    for (const n of fs.readdirSync(FIXTURE_PACK)) assert.match(r.stdout, new RegExp(`\\| ${n} \\|`));
  });
});

describe('index cache', () => {
  let tmpPack;
  before(() => {
    tmpPack = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-router-pack-'));
    fs.cpSync(FIXTURE_PACK, tmpPack, { recursive: true });
  });
  after(() => fs.rmSync(tmpPack, { recursive: true, force: true }));

  test('rebuilds when a triggers.json changes; broken triggers.json does not crash', () => {
    const prev = process.env.SKILL_PACK_DIR;
    process.env.SKILL_PACK_DIR = tmpPack;
    try {
      assert.deepEqual(R.route('zanzibar launch', os.tmpdir()).picked, []);
      const f = path.join(tmpPack, 'release-deploy', 'triggers.json');
      const t = JSON.parse(fs.readFileSync(f, 'utf8'));
      t.keywords.push('zanzibar launch');
      fs.writeFileSync(f, JSON.stringify(t));
      const future = new Date(Date.now() + 5000);
      fs.utimesSync(f, future, future);
      assert.equal(R.route('zanzibar launch', os.tmpdir()).picked[0].skill.name, 'release-deploy');
      fs.writeFileSync(f, '{ not json');
      const later = new Date(Date.now() + 10000);
      fs.utimesSync(f, later, later);
      // falls back to description-derived triggers: "push to production" is quoted there
      assert.equal(R.route('push to production', os.tmpdir()).picked[0].skill.name, 'release-deploy');
      assert.ok(fs.readdirSync(cacheDir).some((n) => n.startsWith('index-')));
    } finally {
      process.env.SKILL_PACK_DIR = prev;
    }
  });

  test('warm routing is fast (< 200 ms in process, loose for loaded CI hosts)', () => {
    R.route('deploy ke production', os.tmpdir());
    const t0 = performance.now();
    R.route('bikin web portofolio lalu deploy ke production', os.tmpdir());
    assert.ok(performance.now() - t0 < 200);
  });
});

// Optional: the real pack, once its triggers.json files exist.
const realSkills = fs.readdirSync(PACK, { withFileTypes: true })
  .filter((e) => e.isDirectory() && fs.existsSync(path.join(PACK, e.name, 'SKILL.md'))).map((e) => e.name);
const withTriggers = realSkills.filter((n) => fs.existsSync(path.join(PACK, n, 'triggers.json')));
const needed = ['build-project', 'analyze-problem', 'error-runbook', 'release-deploy', 'local-dev-setup', 'security-audit-cycle'];
const realReady = needed.every((n) => withTriggers.includes(n));

describe('real pack', { skip: realReady ? false : `triggers.json missing for: ${needed.filter((n) => !withTriggers.includes(n)).join(', ')}` }, () => {
  const realNames = (p) => {
    const prev = process.env.SKILL_PACK_DIR;
    process.env.SKILL_PACK_DIR = PACK;
    try { return R.route(p, os.tmpdir()).picked.map((x) => x.skill.name); } finally { process.env.SKILL_PACK_DIR = prev; }
  };
  const cases = [
    ['bikin web portofolio pakai next', ['build-project']],
    ['kenapa build saya error', ['analyze-problem', 'error-runbook']],
    ['deploy ke production', ['release-deploy']],
    ['setup project ini di lokal', ['local-dev-setup']],
    ['cek keamanan kode ini', ['security-audit-cycle']],
  ];
  for (const [p, oneOf] of cases) {
    test(`"${p}" -> ${oneOf.join(' | ')}`, () => {
      const got = realNames(p);
      assert.ok(oneOf.includes(got[0]), `got ${JSON.stringify(got)}`);
    });
  }
  test('"hello" -> nothing', () => assert.deepEqual(realNames('hello'), []));
});
