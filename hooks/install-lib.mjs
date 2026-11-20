#!/usr/bin/env node
// Config-file helpers for install.mjs (zero dependencies, Node >= 18). Every function returns
// one status word: added | unchanged | removed | created | updated | absent | invalid.
// Every change writes <file>.bak-<timestamp> first (when the file existed), writes atomically,
// and re-parses JSON output before replacing the original. With dry=true nothing is written.
//
// CLI (kept for scripts):  node install-lib.mjs add-hook <file> <event> <command> [claude]
//                          | remove-hook <file> <needle> | block-set <file> <content-file>
//                          | block-remove <file> | check-json <file>      (DRY_RUN=1 = dry run)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const BEGIN = '<!-- skill-pack:begin -->';
export const END = '<!-- skill-pack:end -->';
export const AGY_HOOK_NAME = 'skill-pack-router';

function stamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

function writeSafely(file, text, { json = false, dry = false } = {}) {
  if (json) JSON.parse(text); // never write invalid JSON
  if (dry) return;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (fs.existsSync(file)) fs.copyFileSync(file, `${file}.bak-${stamp()}`);
  const tmp = `${file}.skill-pack.${process.pid}.tmp`;
  let mode;
  try { mode = fs.statSync(file).mode & 0o777; } catch { mode = undefined; }
  fs.writeFileSync(tmp, text, mode ? { mode } : undefined);
  if (json) JSON.parse(fs.readFileSync(tmp, 'utf8'));
  fs.renameSync(tmp, file);
}

// Tolerates a UTF-8 BOM, as Windows editors write it.
function readJson(file) {
  if (!fs.existsSync(file)) return { data: {}, existed: false };
  const raw = fs.readFileSync(file, 'utf8').replace(/^﻿/, '');
  if (!raw.trim()) return { data: {}, existed: true };
  return { data: JSON.parse(raw), existed: true };
}
const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
const asList = (n) => (Array.isArray(n) ? n : [n]).filter(Boolean);

// Claude Code / Codex style: { hooks: { <event>: [ { matcher?, hooks: [ {type, command} ] } ] } }.
// needles: strings identifying this pack's router; an older entry of ours with another command is replaced.
export function addHook(file, event, command, { needles = [], dry = false } = {}) {
  let parsed;
  try { parsed = readJson(file); } catch { return 'invalid'; }
  const s = parsed.data;
  if (!isObj(s)) return 'invalid';
  s.hooks = isObj(s.hooks) ? s.hooks : {};
  const list = Array.isArray(s.hooks[event]) ? s.hooks[event] : [];
  const ours = (h) => h && typeof h.command === 'string' && (h.command === command || asList(needles).some((n) => h.command.includes(n)));
  const same = list.some((e) => e && Array.isArray(e.hooks) && e.hooks.some((h) => h && h.command === command));
  if (same) return 'unchanged';
  const replaced = list.some((e) => e && Array.isArray(e.hooks) && e.hooks.some(ours));
  const kept = [];
  for (const e of list) {
    if (!e || !Array.isArray(e.hooks)) { kept.push(e); continue; }
    const hs = e.hooks.filter((h) => !ours(h));
    if (hs.length) kept.push({ ...e, hooks: hs });
  }
  s.hooks[event] = [...kept, { hooks: [{ type: 'command', command, timeout: 5 }] }];
  writeSafely(file, JSON.stringify(s, null, 2) + '\n', { json: true, dry });
  return replaced ? 'updated' : parsed.existed ? 'added' : 'created';
}

export function removeHook(file, needles, { dry = false } = {}) {
  if (!fs.existsSync(file)) return 'absent';
  let s;
  try { s = readJson(file).data; } catch { return 'invalid'; }
  if (!isObj(s) || !isObj(s.hooks)) return 'unchanged';
  const ours = (h) => h && typeof h.command === 'string' && asList(needles).some((n) => h.command.includes(n));
  let removed = 0;
  for (const [event, list] of Object.entries(s.hooks)) {
    if (!Array.isArray(list)) continue;
    const next = [];
    for (const e of list) {
      if (!e || !Array.isArray(e.hooks)) { next.push(e); continue; }
      const kept = e.hooks.filter((h) => !ours(h));
      removed += e.hooks.length - kept.length;
      if (kept.length) next.push({ ...e, hooks: kept });
    }
    if (next.length) s.hooks[event] = next; else delete s.hooks[event];
  }
  if (!removed) return 'unchanged';
  writeSafely(file, JSON.stringify(s, null, 2) + '\n', { json: true, dry });
  return 'removed';
}

// Antigravity style (~/.gemini/config/hooks.json): { <hook name>: { enabled?, <Event>: [handlers] } }.
export function agyHookSet(file, event, command, { dry = false } = {}) {
  let parsed;
  try { parsed = readJson(file); } catch { return 'invalid'; }
  const s = parsed.data;
  if (!isObj(s)) return 'invalid';
  const want = { [event]: [{ type: 'command', command, timeout: 10 }] };
  const cur = s[AGY_HOOK_NAME];
  if (JSON.stringify(cur) === JSON.stringify(want)) return 'unchanged';
  s[AGY_HOOK_NAME] = want;
  writeSafely(file, JSON.stringify(s, null, 2) + '\n', { json: true, dry });
  return cur ? 'updated' : parsed.existed ? 'added' : 'created';
}

export function agyHookRemove(file, { dry = false } = {}) {
  if (!fs.existsSync(file)) return 'absent';
  let s;
  try { s = readJson(file).data; } catch { return 'invalid'; }
  if (!isObj(s) || !(AGY_HOOK_NAME in s)) return 'unchanged';
  delete s[AGY_HOOK_NAME];
  writeSafely(file, JSON.stringify(s, null, 2) + '\n', { json: true, dry });
  return 'removed';
}

export function blockSet(file, body, { dry = false } = {}) {
  const block = `${BEGIN}\n${body.trim()}\n${END}`;
  const existed = fs.existsSync(file);
  const cur = existed ? fs.readFileSync(file, 'utf8') : '';
  const b = cur.indexOf(BEGIN), e = cur.indexOf(END);
  let next;
  if (b >= 0 && e > b) next = cur.slice(0, b) + block + cur.slice(e + END.length);
  else next = (cur.trim() ? cur.replace(/\s*$/, '\n\n') : '') + block + '\n';
  if (next === cur) return 'unchanged';
  writeSafely(file, next, { dry });
  return existed ? (b >= 0 ? 'updated' : 'added') : 'created';
}

export function blockRemove(file, { dry = false } = {}) {
  if (!fs.existsSync(file)) return 'absent';
  const cur = fs.readFileSync(file, 'utf8');
  const b = cur.indexOf(BEGIN), e = cur.indexOf(END);
  if (b < 0 || e < b) return 'unchanged';
  const before = cur.slice(0, b).replace(/\s*$/, '');
  const after = cur.slice(e + END.length).replace(/^\s*/, '');
  // a rule file that held only front matter + our block goes away completely
  const rest = [before, after].filter(Boolean).join('\n\n').trim();
  if (!rest || /^---\n[\s\S]*?\n---$/.test(rest) && rest.includes(AGY_HOOK_NAME)) {
    if (!dry) { fs.copyFileSync(file, `${file}.bak-${stamp()}`); fs.unlinkSync(file); }
    return 'removed';
  }
  writeSafely(file, rest + '\n', { dry });
  return 'removed';
}

export function checkJson(file) {
  try { readJson(file); return 'valid'; } catch { return 'invalid'; }
}

const isMain = (() => { try { return fs.realpathSync(process.argv[1] || '') === fs.realpathSync(fileURLToPath(import.meta.url)); } catch { return false; } })();
if (isMain) {
  const dry = process.env.DRY_RUN === '1';
  const [cmd, ...a] = process.argv.slice(2);
  let r;
  try {
    if (cmd === 'add-hook') r = addHook(a[0], a[1], a[2], { dry });
    else if (cmd === 'remove-hook') r = removeHook(a[0], a[1], { dry });
    else if (cmd === 'block-set') r = blockSet(a[0], fs.readFileSync(a[1], 'utf8'), { dry });
    else if (cmd === 'block-remove') r = blockRemove(a[0], { dry });
    else if (cmd === 'check-json') r = checkJson(a[0]);
    else { console.error(`unknown command: ${cmd}`); process.exitCode = 2; }
  } catch (e) { console.error(`install-lib ${cmd}: ${e.message}`); r = 'error'; }
  if (r) console.log(r);
  if (r === 'invalid' || r === 'error') process.exitCode = 1;
}
