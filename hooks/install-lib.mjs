#!/usr/bin/env node
// JSON/config helpers for install.sh and uninstall.sh (zero dependencies, Node >= 18).
//
//   add-hook    <settings.json> <event> <command> <claude|gemini>   append a command hook, dedupe by command
//   remove-hook <settings.json> <needle>                             drop every hook whose command contains needle
//   block-set   <file> <content-file>                                insert/replace the managed block
//   block-remove <file>                                              remove the managed block
//   check-json  <file>                                               exit 1 if the file is not valid JSON
//
// Every change writes <file>.bak-<timestamp> first (when the file existed), writes atomically,
// and re-parses JSON output before replacing the original. DRY_RUN=1 reports without writing.
// Prints one status word: added | unchanged | removed | created | updated | absent | invalid.

import fs from 'node:fs';
import path from 'node:path';

const BEGIN = '<!-- skill-pack:begin -->';
const END = '<!-- skill-pack:end -->';
const DRY = process.env.DRY_RUN === '1';

function stamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

function writeSafely(file, text, { json = false } = {}) {
  if (json) JSON.parse(text); // never write invalid JSON
  if (DRY) return;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (fs.existsSync(file)) fs.copyFileSync(file, `${file}.bak-${stamp()}`);
  const tmp = `${file}.skill-pack.${process.pid}.tmp`;
  let mode;
  try { mode = fs.statSync(file).mode & 0o777; } catch { mode = undefined; }
  fs.writeFileSync(tmp, text, mode ? { mode } : undefined);
  if (json) JSON.parse(fs.readFileSync(tmp, 'utf8'));
  fs.renameSync(tmp, file);
}

function readJson(file) {
  if (!fs.existsSync(file)) return { data: {}, existed: false };
  const raw = fs.readFileSync(file, 'utf8');
  if (!raw.trim()) return { data: {}, existed: true };
  return { data: JSON.parse(raw), existed: true };
}

function addHook(file, event, command, style) {
  let parsed;
  try { parsed = readJson(file); } catch { console.log('invalid'); process.exitCode = 1; return; }
  const s = parsed.data;
  if (typeof s !== 'object' || Array.isArray(s) || s === null) { console.log('invalid'); process.exitCode = 1; return; }
  s.hooks = s.hooks && typeof s.hooks === 'object' ? s.hooks : {};
  const list = Array.isArray(s.hooks[event]) ? s.hooks[event] : [];
  const exists = list.some((e) => e && Array.isArray(e.hooks) && e.hooks.some((h) => h && h.command === command));
  if (exists) { console.log('unchanged'); return; }
  const hook = style === 'gemini'
    ? { name: 'skill-pack-router', type: 'command', command, timeout: 5000, description: 'Suggest matching skills from the skill pack' }
    : { type: 'command', command, timeout: 5 };
  const entry = style === 'gemini' ? { matcher: '*', hooks: [hook] } : { hooks: [hook] };
  s.hooks[event] = [...list, entry];
  writeSafely(file, JSON.stringify(s, null, 2) + '\n', { json: true });
  console.log(parsed.existed ? 'added' : 'created');
}

function removeHook(file, needle) {
  if (!fs.existsSync(file)) { console.log('absent'); return; }
  let s;
  try { s = readJson(file).data; } catch { console.log('invalid'); process.exitCode = 1; return; }
  if (!s || !s.hooks || typeof s.hooks !== 'object') { console.log('unchanged'); return; }
  let removed = 0;
  for (const [event, list] of Object.entries(s.hooks)) {
    if (!Array.isArray(list)) continue;
    const next = [];
    for (const e of list) {
      if (!e || !Array.isArray(e.hooks)) { next.push(e); continue; }
      const kept = e.hooks.filter((h) => !(h && typeof h.command === 'string' && h.command.includes(needle)));
      removed += e.hooks.length - kept.length;
      if (kept.length) next.push({ ...e, hooks: kept });
    }
    if (next.length) s.hooks[event] = next; else delete s.hooks[event];
  }
  if (!removed) { console.log('unchanged'); return; }
  writeSafely(file, JSON.stringify(s, null, 2) + '\n', { json: true });
  console.log('removed');
}

function blockSet(file, contentFile) {
  const body = fs.readFileSync(contentFile, 'utf8').trim();
  const block = `${BEGIN}\n${body}\n${END}`;
  const existed = fs.existsSync(file);
  const cur = existed ? fs.readFileSync(file, 'utf8') : '';
  const b = cur.indexOf(BEGIN), e = cur.indexOf(END);
  let next;
  if (b >= 0 && e > b) next = cur.slice(0, b) + block + cur.slice(e + END.length);
  else next = (cur.trim() ? cur.replace(/\s*$/, '\n\n') : '') + block + '\n';
  if (next === cur) { console.log('unchanged'); return; }
  writeSafely(file, next);
  console.log(existed ? (b >= 0 ? 'updated' : 'added') : 'created');
}

function blockRemove(file) {
  if (!fs.existsSync(file)) { console.log('absent'); return; }
  const cur = fs.readFileSync(file, 'utf8');
  const b = cur.indexOf(BEGIN), e = cur.indexOf(END);
  if (b < 0 || e < b) { console.log('unchanged'); return; }
  const next = (cur.slice(0, b).replace(/\s*$/, '') + '\n' + cur.slice(e + END.length).replace(/^\s*/, '\n')).trim();
  if (!next) {
    // the file held only our block: keep a backup, then remove it
    if (!DRY) { fs.copyFileSync(file, `${file}.bak-${stamp()}`); fs.unlinkSync(file); }
    console.log('removed');
    return;
  }
  writeSafely(file, next + '\n');
  console.log('removed');
}

function checkJson(file) {
  try { JSON.parse(fs.readFileSync(file, 'utf8')); console.log('valid'); } catch { console.log('invalid'); process.exitCode = 1; }
}

const [cmd, ...a] = process.argv.slice(2);
try {
  if (cmd === 'add-hook') addHook(a[0], a[1], a[2], a[3] || 'claude');
  else if (cmd === 'remove-hook') removeHook(a[0], a[1]);
  else if (cmd === 'block-set') blockSet(a[0], a[1]);
  else if (cmd === 'block-remove') blockRemove(a[0]);
  else if (cmd === 'check-json') checkJson(a[0]);
  else { console.error(`unknown command: ${cmd}`); process.exitCode = 2; }
} catch (e) {
  console.error(`install-lib ${cmd}: ${e.message}`);
  console.log('error');
  process.exitCode = 1;
}
