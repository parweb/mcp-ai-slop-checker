// Deterministic AI-style-tells scoring for prose. No LLM, no network.
// 100 = reads human. Ported verbatim from the browser tool at
// https://1h-money-store.vercel.app/sounds-ai

const LLM_PHRASES = ["it's important to note", "it is important to note", "it's worth noting", "it is worth noting", "in today's fast-paced world", "in today's digital age", "in today's world", "navigate the complexities", "navigating the complexities", "in the realm of", "in the world of", "a testament to", "plays a crucial role", "plays a pivotal role", "plays a vital role", "at the end of the day", "dive into", "diving into", "delve into", "delving into", "embark on a journey", "embark on this journey", "ever-evolving landscape", "ever-changing landscape", "unlock the potential", "unlock the power", "unleash the power", "unleash the potential", "take it to the next level", "look no further", "when it comes to", "game-changer", "game changer", "in summary", "to summarize", "first and foremost", "it goes without saying", "needless to say", "the possibilities are endless", "best practices", "actionable insights", "valuable insights", "key takeaways", "in an era where", "in an age where", "stands as a", "serves as a"];

const LLM_WORDS = ['delve', 'delves', 'delving', 'tapestry', 'testament', 'moreover', 'furthermore', 'additionally', 'consequently', 'leverage', 'leveraging', 'leverages', 'seamless', 'seamlessly', 'robust', 'crucial', 'pivotal', 'foster', 'fostering', 'fosters', 'harness', 'harnessing', 'harnesses', 'elevate', 'elevates', 'empower', 'empowers', 'empowering', 'streamline', 'streamlining', 'holistic', 'multifaceted', 'myriad', 'plethora', 'realm', 'underscore', 'underscores', 'underscoring', 'showcase', 'showcases', 'showcasing', 'boast', 'boasts', 'boasting', 'vibrant', 'bustling', 'comprehensive', 'invaluable', 'paramount', 'meticulous', 'meticulously', 'intricate', 'intricacies', 'nuanced', 'profound', 'embark', 'embarking', 'transformative', 'innovative', 'cutting-edge', 'game-changing', 'synergy', 'paradigm', 'beacon', 'commendable', 'noteworthy', 'unwavering', 'unparalleled', 'captivate', 'captivating', 'resonate', 'resonates', 'endeavor', 'endeavors', 'facilitate', 'facilitates', 'utilize', 'utilizing', 'optimal', 'pertinent'];

const words = (t) => t.trim().match(/[A-Za-z0-9'’-]+/g) || [];
const esc = (w) => w.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');

function countList(t, list) {
  const l = ' ' + t.toLowerCase().replace(/[‘’]/g, "'") + ' ';
  let n = 0;
  for (const w of list) {
    const m = l.match(new RegExp('(^|[^a-z])' + esc(w) + '([^a-z]|$)', 'g'));
    if (m) n += m.length;
  }
  return n;
}

const sentences = (t) =>
  t.replace(/\n+/g, '. ')
    .split(/[.!?]+["'’)\]]?\s+|[.!?]+$/)
    .map((s) => words(s).length)
    .filter((n) => n >= 2);

function cv(arr) {
  if (arr.length < 2) return 0;
  const m = arr.reduce((a, b) => a + b, 0) / arr.length;
  if (!m) return 0;
  const v = arr.reduce((a, b) => a + (b - m) * (b - m), 0) / arr.length;
  return Math.sqrt(v) / m;
}

const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, Math.round(x)));

export function checkAiSlop(text) {
  const W = words(text).length || 1;
  const dims = [], fixes = [], flags = [];

  // 1. LLM-word density (30)
  const pHits = countList(text, LLM_PHRASES);
  const wHits = countList(text, LLM_WORDS);
  const weighted = pHits * 2 + wHits;
  const s1 = clamp(30 - (weighted * 100 / W) * 9, 0, 30);
  dims.push({ key: 'LLM-word density', max: 30, score: s1, notes: { phrases: pHits, words: wHits } });
  if (weighted > 0) {
    flags.push('llmwords');
    fixes.push({ title: 'Cut the LLM words', detail: 'Found ' + (pHits + wHits) + ' ("delve/tapestry/furthermore/it’s important to note"…). Each one is a known model tell. Replace with the plain word you’d say out loud.' });
  }

  // 2. Em-dash density (20)
  const dashes = (text.match(/—|–|(^|[^-])--([^-]|$)/g) || []).length;
  const allow = Math.floor(W / 400);
  const effD = Math.max(0, dashes - allow);
  const s2 = clamp(20 - effD * 4 - (dashes * 100 / W) * 6, 0, 20);
  dims.push({ key: 'Em-dash density', max: 20, score: s2, notes: { dashes } });
  if (effD > 0) {
    flags.push('emdash');
    fixes.push({ title: 'Thin out the em-dashes', detail: dashes + ' em-dash' + (dashes > 1 ? 'es' : '') + ' in ' + W + ' words. Keep one if you love it — swap the rest for periods or commas.' });
  }

  // 3. Formulaic structures (15)
  const f1 = (text.match(/not only\b[^.!?\n]{1,80}\bbut(\s+also)?\b/gi) || []).length;
  const f2 = (text.match(/whether you'?re\b[^.!?\n]{1,60}\bor\b/gi) || []).length;
  const f3 = (text.match(/\bin conclusion\b/gi) || []).length;
  const f4 = (text.match(/it'?s not (just|only|about)\b[^.!?\n]{1,60}[,;—–-]\s*it'?s\b/gi) || []).length;
  const triads = (text.match(/\b[\w'’-]+, [\w'’-]+,? and [\w'’-]+\b/g) || []).length;
  const fHits = f1 + f2 + f3 + f4;
  const triPen = Math.max(0, triads - 1);
  const s3 = clamp(15 - fHits * 5 - triPen * 4, 0, 15);
  dims.push({ key: 'Formulaic structures', max: 15, score: s3, notes: { hits: fHits, triads } });
  if (fHits > 0 || triPen > 0) {
    flags.push('formulaic');
    fixes.push({ title: 'Break the templates', detail: (fHits > 0 ? '"Not only… but also / whether you’re… or / in conclusion" ×' + fHits + '. ' : '') + (triPen > 0 ? triads + ' rule-of-three lists ("X, Y, and Z"). ' : '') + 'These scaffolds read machine-assembled. Say one thing plainly instead.' });
  }

  // 4. Sentence rhythm (15)
  const sl = sentences(text);
  const c = cv(sl);
  const s4 = sl.length < 4 ? 12 : clamp(c * 30, 0, 15);
  dims.push({ key: 'Sentence rhythm', max: 15, score: s4, notes: { sentences: sl.length, cv: Math.round(c * 100) / 100 } });
  if (sl.length >= 4 && s4 < 8) {
    flags.push('uniform');
    fixes.push({ title: 'Vary sentence length', detail: 'Your sentences are suspiciously even (' + sl.length + ' sentences, low variance). Humans write long, then short. Like this.' });
  }

  // 5. Specificity (10)
  const hasNum = /\d/.test(text);
  const propers = (text.match(/(?:[a-z,;'’"”]\s+|\s[—–(]\s?)([A-Z][a-z]{2,})/g) || []).length;
  const s5 = (hasNum ? 5 : 0) + (propers > 0 ? 5 : 0);
  dims.push({ key: 'Specificity', max: 10, score: s5, notes: { number: hasNum, propers } });
  if (s5 < 10) {
    flags.push('nospec');
    fixes.push({ title: 'Add something checkable', detail: (hasNum ? '' : 'No number anywhere. ') + (propers > 0 ? '' : 'No names, places or products mid-sentence. ') + 'Filler floats free of facts — one date, figure or proper noun grounds the whole text.' });
  }

  // 6. List perfection (10)
  const lines = text.split('\n');
  const bullets = lines.filter((l) => /^\s*([-*•–]|\d+[.)])\s+/.test(l));
  const boldColon = (text.match(/\*\*[^*\n]{2,60}\*\*:?/g) || []).length;
  const bCV = cv(bullets.map((l) => words(l).length));
  const pen6 = Math.min(10, boldColon * 3 + (bullets.length >= 3 ? (bCV < 0.35 ? 6 : 2) : 0));
  const s6 = 10 - pen6;
  dims.push({ key: 'List perfection', max: 10, score: s6, notes: { bullets: bullets.length, bold: boldColon } });
  if (pen6 > 2) {
    flags.push('lists');
    fixes.push({ title: 'Rough up the bullets', detail: (boldColon > 0 ? boldColon + ' "**Bold:** explanation" items — the classic chat-assistant list format. ' : '') + (bullets.length >= 3 && bCV < 0.35 ? 'All ' + bullets.length + ' bullets are near-identical length. ' : '') + 'Merge some into prose, let one run long.' });
  }

  let total = dims.reduce((a, d) => a + d.score, 0);
  total = Math.max(0, Math.min(100, Math.round(total)));
  const verdict = total >= 80 ? 'Reads human.' : total >= 60 ? 'Mostly human — a few tells.' : total >= 40 ? 'Noticeably AI-flavored.' : 'This sounds AI-generated.';
  if (fixes.length === 0) fixes.push({ title: 'Clean', detail: 'No obvious tells tripped. Remember: that proves style, not authorship — this is a tells counter, not a detector.' });

  return { score: total, verdict, words: W, dimensions: dims, flags, fixes: fixes.slice(0, 6) };
}
