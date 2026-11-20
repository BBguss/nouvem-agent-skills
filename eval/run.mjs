// Routing benchmark: labeled prompts -> does the router suggest an acceptable skill?
// The prompts were written as natural requests, not copied from triggers.json.
// Usage: node eval/run.mjs [prompts-file.json] [--verbose]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { route, loadIndex } from '../hooks/skill-router.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const fileArg = process.argv.slice(2).find((a) => !a.startsWith('--'));
const cases = JSON.parse(fs.readFileSync(fileArg ? path.resolve(fileArg) : path.join(here, 'prompts.json'), 'utf8'));
const skills = loadIndex({ rebuild: true });
const verbose = process.argv.includes('--verbose');
let pos = 0, top1 = 0, top3 = 0, neg = 0, negClean = 0, offTarget = 0;
const times = [];
for (const c of cases) {
  const t0 = process.hrtime.bigint();
  const r = route(c.p, here, { skills }); // `here` has no project files: text-only routing
  times.push(Number(process.hrtime.bigint() - t0) / 1e6);
  const names = r.picked.map((x) => x.skill.name);
  if (!c.ok.length) {
    neg++;
    if (!names.length) negClean++;
    else if (verbose) console.log('FALSE+ ', JSON.stringify(c.p), '->', names.join(','));
    continue;
  }
  pos++;
  const hit1 = names.length > 0 && c.ok.includes(names[0]);
  const hit3 = names.some((n) => c.ok.includes(n));
  if (hit1) top1++;
  if (hit3) top3++;
  offTarget += names.filter((n) => !c.ok.includes(n) && n !== 'dynamic-workflow').length;
  if (verbose && !hit1) console.log(hit3 ? 'TOP3   ' : 'MISS   ', JSON.stringify(c.p), '->', names.join(',') || '(none)', '| want', c.ok.join('/'));
}
times.sort((a, b) => a - b);
const pct = (a, b) => (100 * a / b).toFixed(1) + '%';
console.log(JSON.stringify({
  skills: skills.length,
  prompts: cases.length,
  taskPrompts: pos,
  chitchatPrompts: neg,
  top1Correct: pct(top1, pos),
  top3Correct: pct(top3, pos),
  silentOnChitchat: pct(negClean, neg),
  offTargetSuggestionsPerPrompt: (offTarget / pos).toFixed(2),
  routeMsMedian: times[Math.floor(times.length / 2)].toFixed(2),
  routeMsP95: times[Math.floor(times.length * 0.95)].toFixed(2),
}, null, 2));
