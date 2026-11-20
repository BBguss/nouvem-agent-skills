// Lexical relevance (BM25) between a prompt and each skill's own text.
// Keywords and regexes catch exact phrasing; this catches paraphrases: it compares the
// prompt with the skill's description, its "When to use" section and its keywords,
// after mapping common Indonesian words and English inflections to one canonical term.
// Zero dependencies; the per-skill term weights are precomputed into the router index.

const STOP = new Set((
  // English
  'a an the and or but of to in on at for with without by as is are was were be been being it its this that these those ' +
  'i me my we our you your they them their he she his her what which who whom when where why how can could would should ' +
  'will shall may might must do does did done have has had not no yes so if then than too very just also only some any ' +
  'all each every into from up down out over about again more most other such own same few here there now ok okay please ' +
  'thanks thank want need let get got make sure one two use using used like know think see look go going lets ' +
  // Indonesian (incl. informal)
  'yang dan di ke dari ini itu ada untuk dengan atau juga saja aja sih dong deh ya nih tuh kok kan lah pun ' +
  'saya aku gue gw kamu lo lu kita kami mereka dia nya punya akan sudah udah belum lagi masih bisa mau ingin pengen ' +
  'tolong coba gimana bagaimana apa siapa mana kapan berapa biar supaya agar kalau kalo jadi buat pada oleh sama tapi ' +
  'tetapi karena soalnya terus lalu habis setelah sebelum dulu sekarang barusan banget sangat cuma hanya semua tiap'
).split(/\s+/));

// Indonesian / informal / inflected forms -> canonical English term.
const SYN = {
  bikin: 'build', buat: 'build', buatkan: 'build', bikinin: 'build', bangun: 'build', membangun: 'build', membuat: 'build', create: 'build', make: 'build', scaffold: 'build',
  cek: 'check', periksa: 'check', mengecek: 'check', review: 'check', audit: 'audit', keamanan: 'security', aman: 'secure', pengaman: 'guard', celah: 'vulnerability', kerentanan: 'vulnerability',
  lambat: 'slow', lemot: 'slow', lelet: 'slow', cepat: 'fast', performa: 'performance', kinerja: 'performance',
  kenapa: 'why', mengapa: 'why', penyebab: 'cause', sebab: 'cause', analisis: 'analyze', analisa: 'analyze', analyse: 'analyze', selidiki: 'investigate', triase: 'triage',
  error: 'error', galat: 'error', gagal: 'fail', failing: 'fail', fails: 'fail', failed: 'fail', rusak: 'broken', crash: 'crash', meledak: 'crash', explodes: 'crash',
  pantau: 'watch', awasi: 'watch', memantau: 'watch', monitor: 'watch', monitoring: 'watch', eye: 'watch',
  rilis: 'release', terbitkan: 'release', ship: 'release', deploy: 'deploy', deployment: 'deploy', produksi: 'production', prod: 'production', live: 'production',
  pindah: 'migrate', pindahkan: 'migrate', memindahkan: 'migrate', migrasi: 'migrate', move: 'migrate', moving: 'migrate', cutover: 'migrate',
  jalan: 'run', jalankan: 'run', menjalankan: 'run', running: 'run', lokal: 'local', locally: 'local', laptop: 'local', komputer: 'local',
  tes: 'test', uji: 'test', pengujian: 'test', testing: 'test', tests: 'test', suite: 'test', bukti: 'evidence', lulus: 'pass', passes: 'pass',
  selesai: 'done', kelar: 'done', beres: 'done', finished: 'done', finish: 'done', complete: 'done', verifikasi: 'verify', verified: 'verify',
  dokumen: 'docs', dokumentasi: 'docs', dokumennya: 'docs', documentation: 'docs', readme: 'docs', changelog: 'changelog', catat: 'record', catatan: 'record', rapihin: 'tidy', rapikan: 'tidy', sinkron: 'sync',
  rencana: 'plan', rencanakan: 'plan', planning: 'plan', eksekusi: 'implement', implementasi: 'implement', lapisan: 'layer', layer: 'layer',
  tambah: 'add', tambahkan: 'add', ubah: 'change', ganti: 'change', perbaiki: 'fix', benerin: 'fix', fixed: 'fix', fitur: 'feature', fiturnya: 'feature',
  sandi: 'password', kata: 'password', kredensial: 'credential', credentials: 'credential', token: 'secret', secrets: 'secret', kunci: 'key', keys: 'key',
  folder: 'path', direktori: 'path', repo: 'repository', repository: 'repository', proyek: 'project', project: 'project', lain: 'other', luar: 'outside', sibling: 'other', another: 'other',
  server: 'server', mesin: 'machine', box: 'machine', node: 'machine', berat: 'heavy', jest: 'test',
  situs: 'site', website: 'site', web: 'site', halaman: 'page', toko: 'shop', store: 'shop', ecommerce: 'shop',
  basis: 'database', db: 'database', replika: 'replica', reboot: 'restart', mulai: 'start', restart: 'restart', reload: 'reload', downtime: 'downtime', gangguan: 'outage',
  agen: 'agent', agents: 'agent', bot: 'agent', chatbot: 'agent', assistant: 'agent', alat: 'tool', tools: 'tool', mcp: 'tool', function: 'tool',
  hotfix: 'hotfix', tambal: 'hotfix', patch: 'hotfix', revert: 'rollback', kembalikan: 'rollback',
  tugas: 'task', pekerjaan: 'task', kerjaan: 'task', paralel: 'parallel', bersamaan: 'parallel', sekaligus: 'parallel',
};

function stemEn(w) {
  if (w.length <= 4) return w;
  if (w.endsWith('ies')) return w.slice(0, -3) + 'y';
  if (w.endsWith('ing') && w.length > 6) return w.slice(0, -3);
  if (w.endsWith('ed') && w.length > 5) return w.slice(0, -2);
  if (w.endsWith('es') && /(ches|shes|sses|xes)$/.test(w)) return w.slice(0, -2);
  if (w.endsWith('s') && !w.endsWith('ss')) return w.slice(0, -1);
  return w;
}

// Indonesian suffix -nya / -kan / -in on otherwise unknown words
function stemId(w) {
  for (const suf of ['nya', 'kan', 'in']) {
    if (w.length > suf.length + 3 && w.endsWith(suf)) { const b = w.slice(0, -suf.length); if (SYN[b]) return b; }
  }
  return w;
}

export function lexTokens(text) {
  const out = [];
  const words = String(text).normalize('NFKC').toLowerCase().split(/[^\p{L}\p{N}]+/u);
  for (let w of words) {
    if (w.length < 2 || STOP.has(w) || /^\d+$/.test(w)) continue;
    w = stemId(w);
    let c = SYN[w];
    if (!c) { const s = stemEn(w); c = SYN[s] || s; }
    if (c.length >= 2 && !STOP.has(c)) out.push(c);
  }
  return out;
}

// Text of one skill used for lexical matching.
export function skillText({ name, description, body, keywords }) {
  const when = /##\s*When to use[^\n]*\n([\s\S]*?)(\n##\s|$)/i.exec(body || '');
  return [name.replace(/-/g, ' '), description, when ? when[1] : '', (keywords || []).join(' . ')].join('\n');
}

// Precompute BM25 term weights per document. docs: array of token arrays.
export function bm25Weights(docs, { k1 = 1.2, b = 0.75 } = {}) {
  const N = docs.length;
  const df = new Map();
  for (const d of docs) for (const t of new Set(d)) df.set(t, (df.get(t) || 0) + 1);
  const avgdl = docs.reduce((s, d) => s + d.length, 0) / Math.max(N, 1);
  return docs.map((d) => {
    const tf = new Map();
    for (const t of d) tf.set(t, (tf.get(t) || 0) + 1);
    const w = {};
    for (const [t, f] of tf) {
      const n = df.get(t);
      const idf = Math.log(1 + (N - n + 0.5) / (n + 0.5));
      w[t] = +(idf * (f * (k1 + 1)) / (f + k1 * (1 - b + b * d.length / avgdl))).toFixed(3);
    }
    return w;
  });
}

export function lexScore(weights, promptTokens) {
  let s = 0;
  const hit = [];
  for (const t of new Set(promptTokens)) {
    const w = weights && weights[t];
    if (w) { s += w; hit.push(t); }
  }
  return { s, hit };
}
