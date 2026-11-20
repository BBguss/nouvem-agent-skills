#!/usr/bin/env node
// Install the skill pack: link skills into every detected agent harness and wire up automatic
// skill activation (a prompt hook where the harness has one, a managed instructions block or
// rule where it does not). Cross-platform: Linux, macOS, BusyBox and Windows (cmd, PowerShell,
// Git Bash). Node >= 18, no dependencies. Idempotent: running it again only changes what is
// missing or outdated.
//
// Usage: node install.mjs [--dry-run] [--harness claude,agents,codex,antigravity,opencode]
//                         [--no-hooks] [--links-only] [--project DIR] [--uninstall] [-h|--help]
// Wrappers: install.sh / uninstall.sh (POSIX), install.ps1 (PowerShell), install.cmd (cmd).

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as lib from './hooks/install-lib.mjs';

const PACK = fs.realpathSync(path.dirname(fileURLToPath(import.meta.url)));
const WIN = process.platform === 'win32';
const fwd = (p) => (WIN ? p.replace(/\\/g, '/') : p);
const ROUTER = path.join(PACK, 'hooks', 'skill-router.mjs');
const HOOK_CMD = `node "${fwd(ROUTER)}"`;
const NEEDLES = [...new Set([ROUTER, fwd(ROUTER)])];
const HARNESSES = ['claude', 'agents', 'codex', 'antigravity', 'opencode'];
const ALIASES = { gemini: 'antigravity', agy: 'antigravity' };
const SKIP_DIRS = new Set(['hooks', 'tests', 'scripts', 'eval', 'node_modules']);

const USAGE = `Usage: node install.mjs [options]     (or: sh install.sh, .\\install.ps1, install.cmd)

  --dry-run          show what would change, change nothing
  --harness LIST     only these harnesses (comma separated): ${HARNESSES.join(', ')}
                     (gemini and agy are accepted as names for antigravity)
  --no-hooks         link skills and write instruction blocks, but register no hook or plugin
  --links-only       only link skills
  --project DIR      install into one project instead of your home:
                     DIR/.claude/settings.json hook, DIR/.agents/hooks.json (Antigravity)
                     and a managed block in DIR/AGENTS.md
  --uninstall        remove exactly what the installer added (same options apply)`;

// ---------- options ----------
const opt = { dry: false, hooks: true, linksOnly: false, only: null, project: null, uninstall: false };
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  const val = (name) => (a.includes('=') ? a.slice(a.indexOf('=') + 1) : argv[++i]) ?? '';
  if (a === '--dry-run') opt.dry = true;
  else if (a === '--no-hooks') opt.hooks = false;
  else if (a === '--links-only') { opt.hooks = false; opt.linksOnly = true; }
  else if (a === '--uninstall') opt.uninstall = true;
  else if (a === '--harness' || a.startsWith('--harness=')) {
    opt.only = new Set(val().split(',').map((s) => s.trim().toLowerCase()).filter(Boolean).map((s) => ALIASES[s] || s));
    const bad = [...opt.only].filter((h) => !HARNESSES.includes(h));
    if (bad.length) fail(`unknown harness: ${bad.join(', ')}`, 2);
  } else if (a === '--project' || a.startsWith('--project=')) opt.project = val();
  else if (a === '-h' || a === '--help') { console.log(USAGE); process.exit(0); }
  else fail(`unknown option: ${a}\n\n${USAGE}`, 2);
}
function fail(msg, code = 1) { console.error(`error: ${msg}`); process.exit(code); }
if (Number(process.versions.node.split('.')[0]) < 18) fail(`node >= 18 required, found ${process.version}`);

const HOME = os.homedir();
const DRY = opt.dry;
const summary = [];
const say = (s) => summary.push(s);
const dryTag = DRY ? ' (dry run)' : '';
const wanted = (h) => !opt.only || opt.only.has(h);

function onPath(cmd) {
  const exts = WIN ? (process.env.PATHEXT || '.EXE;.CMD;.BAT;.PS1').split(';') : [''];
  for (const dir of (process.env.PATH || '').split(path.delimiter)) {
    if (!dir) continue;
    for (const e of exts) { try { if (fs.statSync(path.join(dir, cmd + e)).isFile()) return true; } catch { /* next */ } }
  }
  return false;
}
const exists = (p) => fs.existsSync(p);

// ---------- skill links (symlinks; directory junctions on Windows, no admin rights needed) ----------
function linkTarget(l) {
  try {
    if (!fs.lstatSync(l).isSymbolicLink()) return null;
    return path.resolve(path.dirname(l), fs.readlinkSync(l)).replace(/[\\/]+$/, '');
  } catch { return null; }
}
const same = (a, b) => (WIN ? a.toLowerCase() === b.toLowerCase() : a === b);
const intoPack = (t) => t && (same(t, PACK) || (WIN ? t.toLowerCase().startsWith(PACK.toLowerCase() + path.sep) : t.startsWith(PACK + path.sep)));

function packSkills() {
  return fs.readdirSync(PACK, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !/^[_.]/.test(d.name) && !SKIP_DIRS.has(d.name) && exists(path.join(PACK, d.name, 'SKILL.md')))
    .map((d) => d.name).sort();
}

function linkSkills(dir) {
  let made = 0, unchanged = 0, skipped = 0, pruned = 0;
  if (!DRY) fs.mkdirSync(dir, { recursive: true });
  for (const n of packSkills()) {
    const src = path.join(PACK, n);
    const dest = path.join(dir, n);
    const t = linkTarget(dest);
    if (t) {
      if (same(t, src)) { unchanged++; continue; }
      if (!intoPack(t)) { console.log(`  skip ${dest} (link to ${t}, not this pack)`); skipped++; continue; }
    } else if (exists(dest)) { console.log(`  skip ${dest} (real folder, not a link; left untouched)`); skipped++; continue; }
    if (!DRY) {
      if (t) fs.rmSync(dest, { force: true, recursive: false });
      fs.symlinkSync(src, dest, WIN ? 'junction' : 'dir');
    }
    made++;
  }
  if (exists(dir)) {
    for (const n of fs.readdirSync(dir)) {
      const l = path.join(dir, n);
      const t = linkTarget(l);
      if (t && intoPack(t) && !exists(t)) { if (!DRY) fs.rmSync(l, { force: true }); pruned++; }
    }
  }
  say(`  links in ${dir}: ${made} new/updated, ${unchanged} unchanged, ${skipped} skipped, ${pruned} stale removed`);
}

function unlinkSkills(dir) {
  if (!exists(dir)) return;
  let n = 0;
  for (const name of fs.readdirSync(dir)) {
    const l = path.join(dir, name);
    if (intoPack(linkTarget(l))) { if (!DRY) fs.rmSync(l, { force: true }); n++; }
  }
  if (n) say(`  ${dir}: ${n} links removed${dryTag}`);
}

// ---------- hooks and managed blocks ----------
function report(what, r) {
  if (r === 'unchanged') say(`  ${what}: already present`);
  else if (r === 'invalid' || r === 'error') say(`  ${what}: FAILED (file is not valid JSON), left unchanged`);
  else if (r !== 'absent') say(`  ${what}: ${r}${dryTag}`);
}
function addHook(file, event) {
  report(`hook ${event} -> ${file}`, lib.addHook(file, event, HOOK_CMD, { needles: NEEDLES, dry: DRY }));
}
function rmHook(file) {
  const r = lib.removeHook(file, NEEDLES, { dry: DRY });
  if (r === 'removed') report(`hook in ${file}`, r);
}
function agyHook(file) {
  report(`hook PreInvocation -> ${file}`, lib.agyHookSet(file, 'PreInvocation', HOOK_CMD, { dry: DRY }));
}

let blockBody = null;
async function block() {
  if (blockBody) return blockBody;
  const { renderTable, loadIndex } = await import(pathToFileURL(ROUTER).href);
  blockBody = [
    '## Skill pack: automatic skill loading',
    '',
    `Skills from the pack at \`${fwd(PACK)}\` are installed. Do not wait for a slash command: when the user's words, sentence or task context match a row below (any language), read that SKILL.md and follow it before acting. When two or more rows match, load each one (and \`dynamic-workflow\` if it is listed) and sequence them. Project instructions (AGENTS.md/CLAUDE.md/GEMINI.md) and project-level skills with the same purpose take precedence over these skills.`,
    '',
    renderTable(loadIndex()),
  ].join('\n');
  return blockBody;
}
async function setBlock(file, { frontMatter = '' } = {}) {
  if (opt.linksOnly) return;
  const body = await block();
  let r;
  if (frontMatter && !exists(file)) {
    // a new rule file: front matter first, then the managed block
    if (!DRY) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, frontMatter); }
    else { say(`  managed block in ${file}: created${dryTag}`); return; }
    r = lib.blockSet(file, body, { dry: DRY });
    r = 'created';
  } else r = lib.blockSet(file, body, { dry: DRY });
  if (r === 'unchanged') say(`  managed block in ${file}: up to date`);
  else say(`  managed block in ${file}: ${r}${dryTag}`);
}
function rmBlock(file) {
  const r = lib.blockRemove(file, { dry: DRY });
  if (r === 'removed') say(`  managed block in ${file}: removed${dryTag}`);
}

const AGY_RULE_FM = `---\nname: ${lib.AGY_HOOK_NAME}\ndescription: Load the matching skill from the installed skill pack without waiting for a slash command\ntrigger: always_on\n---\n\n`;

// ---------- opencode plugin ----------
const OC_MARK = 'skill-pack-router (opencode plugin)';
function opencodePlugin(cfg) {
  const dest = path.join(cfg, 'plugins', 'skill-pack-router.js');
  const src = fs.readFileSync(path.join(PACK, 'hooks', 'opencode-plugin.js'), 'utf8')
    .replace('"__SKILL_PACK_ROUTER_URL__"', JSON.stringify(pathToFileURL(ROUTER).href));
  if (exists(dest)) {
    const cur = fs.readFileSync(dest, 'utf8');
    if (cur === src) { say(`  opencode plugin ${dest}: up to date`); return; }
    if (!cur.includes(OC_MARK)) { say(`  opencode plugin ${dest}: exists and is not ours, left untouched`); return; }
  }
  if (!DRY) { fs.mkdirSync(path.dirname(dest), { recursive: true }); fs.writeFileSync(dest, src); }
  say(`  opencode plugin ${dest}: installed${dryTag}`);
}
function rmOpencodePlugin(cfg) {
  const p = path.join(cfg, 'plugins', 'skill-pack-router.js');
  if (exists(p) && fs.readFileSync(p, 'utf8').includes(OC_MARK)) {
    if (!DRY) fs.rmSync(p);
    say(`  plugin ${p}: removed${dryTag}`);
  }
}

// ---------- harness table ----------
const G = path.join(HOME, '.gemini');
const OC = path.join(HOME, '.config', 'opencode');
const harness = {
  claude: {
    label: 'claude (Claude Code)',
    present: () => exists(path.join(HOME, '.claude')) || onPath('claude'),
    async install() {
      linkSkills(path.join(HOME, '.claude', 'skills'));
      if (opt.hooks) addHook(path.join(HOME, '.claude', 'settings.json'), 'UserPromptSubmit');
    },
    uninstall() { unlinkSkills(path.join(HOME, '.claude', 'skills')); rmHook(path.join(HOME, '.claude', 'settings.json')); },
  },
  agents: {
    label: 'agents (shared ~/.agents skills dir)',
    present: () => exists(path.join(HOME, '.agents')),
    async install() { linkSkills(path.join(HOME, '.agents', 'skills')); },
    uninstall() { unlinkSkills(path.join(HOME, '.agents', 'skills')); },
  },
  codex: {
    label: 'codex (Codex CLI)',
    present: () => exists(path.join(HOME, '.codex')) || onPath('codex'),
    async install() {
      linkSkills(path.join(HOME, '.codex', 'skills'));
      // Codex reads Claude-style hooks from ~/.codex/hooks.json; a new hook needs one-time trust in Codex (/hooks)
      if (opt.hooks) addHook(path.join(HOME, '.codex', 'hooks.json'), 'UserPromptSubmit');
      await setBlock(path.join(HOME, '.codex', 'AGENTS.md'));
    },
    uninstall() {
      unlinkSkills(path.join(HOME, '.codex', 'skills'));
      rmHook(path.join(HOME, '.codex', 'hooks.json'));
      rmBlock(path.join(HOME, '.codex', 'AGENTS.md'));
    },
  },
  antigravity: {
    label: 'antigravity (Antigravity CLI `agy`, global config ~/.gemini/config)',
    present: () => exists(path.join(G, 'config')) || exists(path.join(G, 'antigravity-cli')) || exists(path.join(G, 'antigravity')) || onPath('agy') || exists(G),
    async install() {
      const cfg = path.join(G, 'config');
      linkSkills(path.join(cfg, 'skills'));
      if (opt.hooks) { agyHook(path.join(cfg, 'hooks.json')); rmBlock(path.join(cfg, 'rules', 'skill-pack.md')); }
      else await setBlock(path.join(cfg, 'rules', 'skill-pack.md'), { frontMatter: AGY_RULE_FM });
      legacyGemini();
    },
    uninstall() {
      const cfg = path.join(G, 'config');
      unlinkSkills(path.join(cfg, 'skills'));
      const r = lib.agyHookRemove(path.join(cfg, 'hooks.json'), { dry: DRY });
      if (r === 'removed') say(`  hook in ${path.join(cfg, 'hooks.json')}: removed${dryTag}`);
      rmBlock(path.join(cfg, 'rules', 'skill-pack.md'));
      legacyGemini();
    },
  },
  opencode: {
    label: 'opencode',
    present: () => exists(OC) || onPath('opencode'),
    async install() {
      linkSkills(path.join(OC, 'skills'));
      if (opt.hooks && exists(path.join(OC, 'node_modules', '@opencode-ai', 'plugin'))) opencodePlugin(OC);
      await setBlock(path.join(OC, 'AGENTS.md'));
    },
    uninstall() { unlinkSkills(path.join(OC, 'skills')); rmOpencodePlugin(OC); rmBlock(path.join(OC, 'AGENTS.md')); },
  },
};

// Earlier versions targeted Gemini CLI (~/.gemini/skills, settings.json BeforeAgent, GEMINI.md block).
// Antigravity replaces it; clean those up so nothing is loaded twice.
function legacyGemini() {
  unlinkSkills(path.join(G, 'skills'));
  rmHook(path.join(G, 'settings.json'));
  rmBlock(path.join(G, 'GEMINI.md'));
}

// ---------- run ----------
async function main() {
  if (DRY) console.log('(dry run: nothing will be changed)');
  if (opt.project) {
    if (!exists(opt.project)) fail(`project dir not found: ${opt.project}`);
    const P = fs.realpathSync(opt.project);
    say(`project ${P}`);
    if (opt.uninstall) {
      rmHook(path.join(P, '.claude', 'settings.json'));
      const r = lib.agyHookRemove(path.join(P, '.agents', 'hooks.json'), { dry: DRY });
      if (r === 'removed') say(`  hook in ${path.join(P, '.agents', 'hooks.json')}: removed${dryTag}`);
      rmBlock(path.join(P, 'AGENTS.md'));
    } else {
      if (opt.hooks) {
        addHook(path.join(P, '.claude', 'settings.json'), 'UserPromptSubmit');
        agyHook(path.join(P, '.agents', 'hooks.json'));
      }
      await setBlock(path.join(P, 'AGENTS.md'));
    }
  } else {
    let found = 0;
    for (const name of HARNESSES) {
      if (!wanted(name)) continue;
      const h = harness[name];
      if (opt.uninstall) { const before = summary.length; h.uninstall(); if (summary.length > before) summary.splice(before, 0, name); continue; }
      if (!h.present()) continue;
      found++;
      say(h.label);
      await h.install();
    }
    if (!opt.uninstall && !found) say(`no supported agent harness found under ${HOME} (${HARNESSES.join(', ')})`);
  }
  if (!DRY && !opt.uninstall) {
    try { const { loadIndex } = await import(pathToFileURL(ROUTER).href); loadIndex({ rebuild: true }); } catch { /* warm-up only */ }
  }
  console.log(`\nDone${dryTag}.${summary.length ? ' Summary:' : ' Nothing to change.'}`);
  for (const s of summary) console.log(s);
  if (!opt.uninstall) console.log(`Test it: node "${fwd(ROUTER)}" --explain "deploy this to production"`);
}

main().catch((e) => fail(e && e.stack || String(e)));
