#!/usr/bin/env node
// skill-router: pick the skills of this pack that fit a user prompt and tell the agent to load them.
//
// Hook mode (default): reads a hook payload (JSON or plain text) on stdin, prints a
// hookSpecificOutput JSON with additionalContext on stdout, or nothing when no skill fits.
// It never blocks a prompt: every error ends in exit 0 with no output.
//
// CLI:
//   node skill-router.mjs --explain "prompt text" [--cwd DIR]   scores + the context that would be sent
//   node skill-router.mjs --table                               markdown trigger table (managed blocks)
//   node skill-router.mjs --rebuild                             rebuild the trigger index cache
//
// Env: SKILL_ROUTER_DISABLE=1 (off), SKILL_ROUTER_DEBUG=1 (scores on stderr),
//      SKILL_PACK_DIR (pack root override), SKILL_ROUTER_FORMAT=text (plain text output),
//      SKILL_ROUTER_CACHE_DIR (index cache dir override).
// Zero dependencies, Node >= 18.

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { lexTokens, skillText, bm25Weights, lexScore } from './lexical.mjs';

const INDEX_VERSION = 4;
export const THRESHOLD = 2;      // minimum score to suggest a skill
export const STRONG = 3;         // "strong" match, used for the dynamic-workflow rule
export const MAX_SKILLS = 3;
// lexical similarity (paraphrase matching): points = min(LEX_CAP, (bm25 - LEX_MIN) * LEX_SCALE)
export const LEX_MIN = Number(process.env.SKILL_ROUTER_LEX_MIN || 4);
export const LEX_SCALE = Number(process.env.SKILL_ROUTER_LEX_SCALE || 0.6);
export const LEX_CAP = Number(process.env.SKILL_ROUTER_LEX_CAP || 4);
const FALLBACK_SKILL = 'dynamic-workflow';
const MAX_PROMPT = 8000;

const HERE = path.dirname(fileURLToPath(import.meta.url));
export function packDir() {
  return path.resolve(process.env.SKILL_PACK_DIR || path.join(HERE, '..'));
}

// ---------- index (parsed triggers, cached) ----------

function readFrontmatter(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  const out = {};
  if (!m) return out;
  for (const line of m[1].split(/\r?\n/)) {
    const kv = /^([A-Za-z_-]+):\s*(.*)$/.exec(line);
    if (kv) out[kv[1]] = kv[2].replace(/^["']|["']$/g, '').trim();
  }
  return out;
}

const STOP = new Set(('use when the a an and or of to in on for with is are be by as at it its this that from into ' +
  'any all each every not no never must should can may user asks asked about after before then than ' +
  'runs run keeps one two new uses using via per also only own like such these those what which who').split(' '));

// Keywords for a skill without triggers.json, derived from its description.
function deriveTriggers(name, description) {
  const keywords = new Set();
  const slash = new Set();
  for (const q of description.matchAll(/["“]([^"”]{3,60})["”]/g)) keywords.add(q[1].trim());
  for (const s of description.matchAll(/(^|[\s(])(\/[a-z][a-z0-9-]{1,30})\b/g)) slash.add(s[2]);
  keywords.add(name.replace(/-/g, ' '));
  // description terms: matched with low weight, need several to count
  const first = description.split(/(?<=\.)\s/)[0] || description;
  const terms = [...new Set(norm(first).split(' '))]
    .filter((w) => w.length >= 4 && !STOP.has(w) && !/^\d+$/.test(w)).slice(0, 40);
  return { keywords: [...keywords], patterns: [], files: [], negative: [], slash: [...slash], priority: 1, terms, derived: true };
}

function cacheFile(pack) {
  const h = crypto.createHash('sha1').update(pack).digest('hex').slice(0, 12);
  const dirs = [];
  if (process.env.SKILL_ROUTER_CACHE_DIR) dirs.push(process.env.SKILL_ROUTER_CACHE_DIR);
  dirs.push(path.join(process.env.XDG_CACHE_HOME || path.join(os.homedir(), '.cache'), 'skill-pack'));
  dirs.push(path.join(pack, '.cache'));
  for (const d of dirs) {
    try { fs.mkdirSync(d, { recursive: true }); fs.accessSync(d, fs.constants.W_OK); return path.join(d, `index-${h}.json`); } catch { /* next */ }
  }
  return null;
}

function mtime(p) { try { return fs.statSync(p).mtimeMs; } catch { return 0; } }

// Signature of the pack: every skill folder with its SKILL.md and triggers.json mtimes.
function scanPack(pack) {
  const skills = [];
  let entries = [];
  try { entries = fs.readdirSync(pack, { withFileTypes: true }); } catch { return { skills, sig: '' }; }
  for (const e of entries) {
    if (e.name.startsWith('.') || e.name.startsWith('_') || ['hooks', 'tests', 'scripts', 'node_modules'].includes(e.name)) continue;
    const dir = path.join(pack, e.name);
    if (!e.isDirectory() && !(e.isSymbolicLink() && mtime(dir))) continue;
    const skillMd = path.join(dir, 'SKILL.md');
    const m1 = mtime(skillMd);
    if (!m1) continue;
    skills.push({ dir: e.name, skillMd, m1, m2: mtime(path.join(dir, 'triggers.json')) });
  }
  skills.sort((a, b) => a.dir.localeCompare(b.dir));
  const sig = skills.map((s) => `${s.dir}:${s.m1}:${s.m2}`).join('|');
  return { skills, sig };
}

function buildIndex(pack, scanned) {
  const out = [];
  for (const s of scanned.skills) {
    let fm = {};
    let body = '';
    try { body = fs.readFileSync(s.skillMd, 'utf8'); fm = readFrontmatter(body.slice(0, 4000)); } catch { /* keep empty */ }
    const name = fm.name || s.dir;
    const description = fm.description || '';
    let trig = null;
    if (s.m2) {
      try {
        const t = JSON.parse(fs.readFileSync(path.join(pack, s.dir, 'triggers.json'), 'utf8'));
        const arr = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string' && x.trim()) : []);
        trig = {
          keywords: arr(t.keywords), patterns: arr(t.patterns), files: arr(t.files), negative: arr(t.negative),
          slash: arr(t.slash).map((x) => (x.startsWith('/') ? x : '/' + x)),
          priority: Number.isFinite(t.priority) ? t.priority : 1, terms: [], derived: false,
        };
      } catch { trig = null; /* broken triggers.json: fall back to the description */ }
    }
    if (!trig) trig = deriveTriggers(name, description);
    out.push({ name, dir: s.dir, skillMd: s.skillMd, description, ...trig, _text: skillText({ name, description, body, keywords: trig.keywords }) });
  }
  const weights = bm25Weights(out.map((x) => lexTokens(x._text)));
  out.forEach((x, i) => { x.lex = weights[i]; delete x._text; });
  return out;
}

export function loadIndex({ rebuild = false } = {}) {
  const pack = packDir();
  const scanned = scanPack(pack);
  const file = cacheFile(pack);
  if (file && !rebuild) {
    try {
      const c = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (c.v === INDEX_VERSION && c.pack === pack && c.sig === scanned.sig) return c.skills;
    } catch { /* rebuild */ }
  }
  const skills = buildIndex(pack, scanned);
  if (file) {
    try {
      const tmp = `${file}.${process.pid}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify({ v: INDEX_VERSION, pack, sig: scanned.sig, skills }));
      fs.renameSync(tmp, file);
    } catch { /* cache is optional */ }
  }
  return skills;
}

// ---------- matching ----------

// Keywords are matched on a normalized form: lower case, every run of non letter/number
// characters (any script) collapsed to one space, padded with spaces. " kw " inside
// " prompt " is then a Unicode-aware whole-word/phrase match, without one regex per keyword
// (hundreds of Unicode regexes cost ~0.7 ms each to compile).
export function norm(s) {
  return ' ' + String(s).normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim() + ' ';
}
function keywordHit(kw, normPrompt) {
  const k = norm(kw);
  if (k.length <= 2) return false;
  if (normPrompt.includes(k)) return true;
  // "sub agent" / "sub-agent" also matches "subagent"
  const joined = ' ' + k.trim().replace(/ /g, '') + ' ';
  return joined !== k && normPrompt.includes(joined);
}
const reCache = new Map();
function userRe(src) {
  let re = reCache.get(src);
  if (re !== undefined) return re;
  re = null;
  // the u flag is ~2x slower to compile; use it only when the pattern needs it
  const needU = /\\[pPu]\{|[^\x00-\x7f]/.test(src);
  try { re = new RegExp(src, needU ? 'iu' : 'i'); } catch { try { re = new RegExp(src, needU ? 'i' : 'iu'); } catch { re = null; } }
  reCache.set(src, re);
  return re;
}

export function scoreSkill(skill, prompt, ctx) {
  const why = [];
  let kw = 0, pat = 0, term = 0, slash = 0, files = 0;
  const slashHit = (s) => new RegExp(`(^|\\s)${s.replace(/[.*+?^${}()|[\]\\\/]/g, '\\$&')}(?=$|\\s|[.,:;!?])`, 'i').test(prompt);
  for (const s of skill.slash || []) {
    if (slashHit(s)) { slash = 10; why.push(s); break; }
  }
  for (const k of skill.keywords || []) {
    // a keyword written as "/cmd" must appear with its slash
    if (k.trim().startsWith('/') ? slashHit(k.trim()) : keywordHit(k, ctx.normPrompt)) { kw += 2 + 0.5 * (k.trim().split(/\s+/).length - 1); why.push(`"${k}"`); }
  }
  kw = Math.min(kw, 6);
  for (const p of skill.patterns || []) {
    const re = userRe(p);
    const m = re && re.exec(prompt);
    if (m) {
      pat += 3;
      const t = m[0].replace(/\s+/g, ' ').trim();
      why.push(`"${t.length > 40 ? t.slice(0, 37) + '...' : t}" (pattern)`);
    }
  }
  pat = Math.min(pat, 6);
  if (skill.terms && skill.terms.length) {
    const hits = skill.terms.filter((t) => ctx.tokens.has(t));
    if (hits.length >= 2) { term = Math.min(0.5 * hits.length, 2); why.push(`terms: ${hits.slice(0, 4).join(', ')}`); }
  }
  let lex = 0;
  if (ctx.lexTokens && skill.lex) {
    const l = lexScore(skill.lex, ctx.lexTokens);
    lex = Math.min(LEX_CAP, Math.max(0, (l.s - LEX_MIN) * LEX_SCALE));
    if (lex > 0) why.push(`similar: ${l.hit.slice(0, 4).join(', ')}`);
  }
  let score = slash + kw + pat + term + lex;
  if (score > 0 && skill.files && skill.files.length && ctx.cwdFiles) {
    for (const f of skill.files) {
      if (ctx.cwdFiles.has(f.toLowerCase()) || (f.includes('/') && ctx.exists(f))) { files += 1; why.push(`file ${f}`); }
      if (files >= 2) break;
    }
    score += files;
  }
  for (const n of skill.negative || []) {
    const re = userRe(n);
    if (re && re.test(prompt)) { return { score: 0, why: [`suppressed by /${n}/`], suppressed: true }; }
  }
  return { score, why };
}

export function extractPrompt(payload) {
  if (payload == null) return '';
  if (typeof payload === 'string') return payload;
  const pick = (v) => {
    if (typeof v === 'string') return v;
    if (Array.isArray(v)) return v.map((x) => (typeof x === 'string' ? x : x && (x.text || (typeof x.content === 'string' ? x.content : '')) || '')).join('\n');
    if (v && typeof v === 'object') return pick(v.content ?? v.text ?? v.prompt ?? '');
    return '';
  };
  for (const k of ['prompt', 'user_prompt', 'userPrompt', 'input', 'message', 'text', 'query', 'request']) {
    const s = pick(payload[k]);
    if (s && s.trim()) return s;
  }
  if (Array.isArray(payload.messages)) {
    for (let i = payload.messages.length - 1; i >= 0; i--) {
      const m = payload.messages[i];
      if (m && (m.role === 'user' || !m.role)) { const s = pick(m); if (s.trim()) return s; }
    }
  }
  if (payload.llm_request && Array.isArray(payload.llm_request.messages)) return extractPrompt({ messages: payload.llm_request.messages });
  return '';
}

export function route(prompt, cwd, { skills } = {}) {
  prompt = String(prompt || '').slice(0, MAX_PROMPT);
  const list = skills || loadIndex();
  if (!prompt.trim() || !list.length) return { picked: [], scores: [] };
  let cwdFiles = null;
  if (cwd) { try { cwdFiles = new Set(fs.readdirSync(cwd).map((f) => f.toLowerCase())); } catch { cwdFiles = null; } }
  const normPrompt = norm(prompt);
  const ctx = {
    normPrompt,
    tokens: new Set(normPrompt.split(' ').filter((t) => t.length >= 4)),
    lexTokens: lexTokens(prompt),
    cwdFiles,
    exists: (f) => { try { return fs.existsSync(path.join(cwd, f)); } catch { return false; } },
  };
  const scores = list.map((s) => ({ skill: s, ...scoreSkill(s, prompt, ctx) }))
    .sort((a, b) => b.score - a.score || (b.skill.priority ?? 1) - (a.skill.priority ?? 1) || a.skill.name.localeCompare(b.skill.name));
  const above = scores.filter((x) => x.score >= THRESHOLD && !x.suppressed);
  // fallback skills (priority 0) only count on their own when nothing specific matched,
  // or when called by slash alias; otherwise they come in through the multi-skill rule below
  const specific = above.filter((x) => (x.skill.priority ?? 1) > 0 || x.why.some((w) => /^\/[^/]*$/.test(w)));
  let picked = (specific.length ? specific : above).slice(0, MAX_SKILLS);
  const strong = picked.filter((x) => x.score >= STRONG);
  const fb = scores.find((x) => x.skill.name === FALLBACK_SKILL || x.skill.dir === FALLBACK_SKILL);
  if (strong.length >= 2 && fb && !fb.suppressed && !picked.includes(fb)) {
    picked = [...picked, { ...fb, why: ['several skills apply; use it to sequence them'] }];
  }
  return { picked, scores };
}

export function renderContext(picked) {
  const lines = ['[skill-pack] Skills from the installed pack that match this request. Read each SKILL.md and follow it before acting, without waiting to be asked:'];
  for (const p of picked) {
    lines.push(`- ${p.skill.name}: matched ${p.why.slice(0, 4).join(', ')}. ${firstClause(p.skill.description)} -> ${p.skill.skillMd}`);
  }
  lines.push('Project instructions (AGENTS.md/CLAUDE.md/GEMINI.md) and project-level skills with the same purpose take precedence over these. Skip a listed skill if it clearly does not fit the request.');
  return lines.join('\n');
}
function firstClause(d) {
  if (!d) return '';
  const s = d.split(/(?<=\.)\s/)[0];
  return s.length > 160 ? s.slice(0, 157) + '...' : s;
}

export function renderTable(skills) {
  const rows = ['| Skill | Load it when the user says or the task involves | SKILL.md |', '|---|---|---|'];
  for (const s of skills) {
    const trig = [...(s.slash || []), ...(s.keywords || [])].slice(0, 10).map((k) => k.replace(/\|/g, '/')).join(', ');
    rows.push(`| ${s.name} | ${trig || firstClause(s.description).replace(/\|/g, '/')} | ${s.skillMd} |`);
  }
  return rows.join('\n');
}

// ---------- entry ----------

function readStdin() {
  try { return fs.readFileSync(0, 'utf8'); } catch { return ''; }
}

function main() {
  const argv = process.argv.slice(2);
  if (argv.includes('--table')) { process.stdout.write(renderTable(loadIndex()) + '\n'); return; }
  if (argv.includes('--rebuild')) { const s = loadIndex({ rebuild: true }); process.stdout.write(`indexed ${s.length} skills\n`); return; }
  const ci = argv.indexOf('--cwd');
  const cliCwd = ci >= 0 ? argv[ci + 1] : null;
  const ei = argv.indexOf('--explain');
  if (ei >= 0) {
    const prompt = argv.slice(ei + 1).filter((a, i, all) => a !== '--cwd' && all[i - 1] !== '--cwd').join(' ');
    const t0 = process.hrtime.bigint();
    const r = route(prompt, cliCwd || process.cwd());
    const ms = Number(process.hrtime.bigint() - t0) / 1e6;
    for (const x of r.scores.filter((x) => x.score > 0 || x.suppressed)) {
      process.stdout.write(`${x.score.toFixed(1).padStart(5)}  ${x.skill.name.padEnd(26)} ${x.why.join(', ')}\n`);
    }
    process.stdout.write(`-- threshold ${THRESHOLD}, ${r.scores.length} skills, ${ms.toFixed(1)} ms\n`);
    process.stdout.write(r.picked.length ? renderContext(r.picked) + '\n' : '(no skill suggested)\n');
    return;
  }
  if (process.env.SKILL_ROUTER_DISABLE === '1') return;
  const raw = readStdin();
  let payload = raw;
  try { payload = JSON.parse(raw); } catch { /* plain text prompt */ }
  const prompt = extractPrompt(payload);
  if (!prompt.trim()) return;
  // Harness-generated turns (background task notices, system reminders) are not user requests.
  if (/^\s*<(task-notification|system-reminder|local-command-stdout|command-name|bash-stdout)\b/i.test(prompt)) return;
  const cwd = (payload && typeof payload === 'object' && (payload.cwd || payload.workspace || payload.directory)) || process.cwd();
  const r = route(prompt, cwd);
  if (process.env.SKILL_ROUTER_DEBUG === '1') {
    for (const x of r.scores.filter((x) => x.score > 0)) process.stderr.write(`[skill-router] ${x.score.toFixed(1)} ${x.skill.name} ${x.why.join(', ')}\n`);
  }
  if (!r.picked.length) return;
  const text = renderContext(r.picked);
  if (process.env.SKILL_ROUTER_FORMAT === 'text') { process.stdout.write(text + '\n'); return; }
  const event = (payload && typeof payload === 'object' && (payload.hook_event_name || payload.hookEventName)) || 'UserPromptSubmit';
  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: event, additionalContext: text } }) + '\n');
}

const isMain = (() => { try { return fs.realpathSync(process.argv[1] || '') === fs.realpathSync(fileURLToPath(import.meta.url)); } catch { return false; } })();
if (isMain) {
  try { main(); } catch (e) {
    if (process.env.SKILL_ROUTER_DEBUG === '1') process.stderr.write(`[skill-router] error: ${e && e.stack || e}\n`);
  }
  process.exitCode = 0;
}
