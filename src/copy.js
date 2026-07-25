// Deterministic 0-100 grader for landing-page hero copy. No LLM, no network.
// Ported verbatim from the browser tool at
// https://1h-money-store.vercel.app/grader — the same engine that produced the
// public 239-page dataset.

const HYPE = ['revolutionize', 'revolutionary', 'unlock', 'unleash', 'seamless', 'seamlessly', 'game-changer', 'game changer', 'game-changing', 'cutting-edge', 'cutting edge', 'next-level', 'next level', 'supercharge', 'effortless', 'effortlessly', 'elevate', 'empower', 'empowering', 'transform', 'transformative', 'best-in-class', 'world-class', 'state-of-the-art', 'robust', 'synergy', 'disruptive', 'innovative', 'innovation', 'leverage', 'harness', 'turbocharge', 'skyrocket', '10x', 'paradigm', 'frictionless', 'bleeding-edge', 'holistic'];

const FILLER = ['solutions', 'solution', 'platform', 'powerful', 'amazing', 'great', 'awesome', 'stuff', 'things', 'simply', 'just', 'very', 'really', 'stunning', 'beautiful', 'ultimate', 'premium', 'quality', 'value', 'experience', 'journey', 'ecosystem', 'suite', 'toolkit', 'all-in-one', 'one-stop'];

const WEAKCTA = ['submit', 'learn more', 'click here', 'read more', 'get started', 'sign up', 'signup', 'continue', 'next', 'go', 'here', 'more info', 'discover', 'explore'];

const words = (t) => t.trim().match(/[A-Za-z0-9'-]+/g) || [];

function countHits(t, list) {
  const l = ' ' + t.toLowerCase() + ' ';
  let n = 0;
  for (const w of list) {
    const re = new RegExp('(^|[^a-z])' + w.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&') + '([^a-z]|$)', 'g');
    const m = l.match(re);
    if (m) n += m.length;
  }
  return n;
}

// Three rules were tightened on 2026-07-25 after an audit of the 239-page corpus.
// Kept byte-for-byte in step with the browser grader in parweb/landing-copy-grader
// and with the live one, so the same hero copy scores the same everywhere.

// A digit is only a claim if it isn't part of a name, a version, a year or a list
// index: 11 of the 44 pages the old rule credited with a number were artefacts
// (Auth0, Mem0, n8n.io, "Framer 3.0", B2C, "(c) 2026", tailwindcss quoting pt-4).
const hasNumber = (t) => {
  const s = String(t)
    .replace(/\u00a9\s*\d{4}/g, ' ')
    .replace(/\b(?:19|20)\d{2}\b/g, ' ')
    .replace(/\bv?\d+(?:\.\d+)+\b(?!\s*%)/g, ' ')
    .replace(/[A-Za-z]+-?\d+[A-Za-z0-9-]*/g, ' ')
    .replace(/^\s*\d+[.)]\s+/gm, ' ');
  return /\d/.test(s);
};

// A button arrow is not an emoji. "Get started ->" was losing 4 points for a
// typographic sign a large share of landing pages use.
const emojiCount = (t) => {
  const m = t.match(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}]/gu) || [];
  return m.filter((ch) => {
    const p = ch.codePointAt(0);
    if (p >= 0x2b00 && p <= 0x2b8f) return false;   // supplemental arrows
    if (p >= 0x2713 && p <= 0x2714) return false;   // check marks
    if (p >= 0x2794 && p <= 0x27bf) return false;   // dingbat arrows
    return true;
  }).length;
};

// An acronym is not a shout. On technical pages SQL/MCP/TUI/CLI/PATH gave 5 false
// positives out of 5. Rule: 6 letters or more is a shout; below that, only words
// people actually do shout in a headline.
const SHOUT = ['FREE', 'NEW', 'BEST', 'NOW', 'SALE', 'TODAY', 'FAST', 'EASY', 'ONLY',
  'SAVE', 'JOIN', 'WIN', 'TOP', 'HOT', 'BIG', 'MUST', 'LIMITED'];
const capsCount = (ws) => ws.filter((w) => {
  if (!(w.length > 2 && w === w.toUpperCase() && /[A-Z]/.test(w))) return false;
  return w.length >= 6 || SHOUT.includes(w);
}).length;

export function gradeLandingCopy(headline = '', subhead = '', cta = '') {
  const h = headline, s = subhead, c = cta;
  const all = h + ' ' + s + ' ' + c;
  const dims = [];

  // 1. Anti-hype (25)
  const hype = countHits(all, HYPE);
  const excl = (all.match(/!/g) || []).length;
  const emo = emojiCount(all);
  const caps = capsCount(words(h + ' ' + s));
  dims.push({ key: 'Anti-hype', max: 25, score: Math.max(0, 25 - (hype * 7 + excl * 5 + emo * 4 + caps * 4)), notes: { hype, exclamations: excl, emoji: emo, allcaps: caps } });

  // 2. Specificity (25)
  let spec = hasNumber(all) ? 25 : 8;
  if (/%|\bx\b|×|hours?|days?|minutes?|\bno\b|zero/i.test(all) && spec < 25) spec = Math.min(25, spec + 9);
  dims.push({ key: 'Specificity', max: 25, score: spec, notes: { number: hasNumber(all) } });

  // 3. Clarity (25)
  const filler = countHits(all, FILLER);
  dims.push({ key: 'Clarity', max: 25, score: Math.max(0, 25 - filler * 6), notes: { filler } });

  // 4. Headline shape (13)
  const hw = words(h).length;
  let hlScore = 13;
  if (hw === 0) hlScore = 0;
  else if (hw > 12) hlScore = 5;
  else if (hw > 10) hlScore = 9;
  else if (hw < 3) hlScore = 7;
  dims.push({ key: 'Headline shape', max: 13, score: hlScore, notes: { words: hw } });

  // 5. CTA (12)
  const ctaW = c.trim().toLowerCase();
  const weak = WEAKCTA.indexOf(ctaW) >= 0 || ctaW === '';
  const ctaScore = c.trim() === '' ? 0 : (weak ? 4 : 12);
  dims.push({ key: 'CTA', max: 12, score: ctaScore, notes: { weak, empty: c.trim() === '' } });

  const total = Math.round(dims.reduce((a, d) => a + d.score, 0));
  const verdict = total >= 80 ? 'Reads human & sharp.' : total >= 60 ? 'Decent, but softening in places.' : total >= 40 ? 'Somewhat generic.' : 'This reads AI-generated.';

  const fixes = [];
  if (hype > 0) fixes.push({ title: 'Cut the hype words', detail: 'Found ' + hype + ' ("revolutionize/unlock/seamless/leverage"…). Replace each with a plain, concrete verb.' });
  if (!hasNumber(all)) fixes.push({ title: 'Add one number', detail: 'No concrete figure anywhere. A single number (a %, a count, a timeframe) instantly raises believability. 82% of the 239 pages in our dataset fail this one.' });
  if (filler > 0) fixes.push({ title: 'Delete filler', detail: 'Found ' + filler + ' vague words ("solutions/platform/powerful"…). They add length, not meaning.' });
  if (hw > 12) fixes.push({ title: 'Shorten the headline', detail: hw + ' words is too long. Aim for ≤10 — cut to the single idea a stranger would repeat.' });
  if (hw > 0 && hw < 3) fixes.push({ title: 'Say more in the headline', detail: 'A ' + hw + '-word headline is usually too vague to carry the offer. Add the outcome.' });
  if (weak && c.trim() !== '') fixes.push({ title: 'Rewrite the CTA', detail: '"' + c.trim() + '" is generic. Use an action + outcome ("Start a project", "Grade my page"), not "Submit/Learn more".' });
  if (excl > 0) fixes.push({ title: 'Remove exclamation marks', detail: 'Found ' + excl + '. Confident copy doesn’t shout.' });
  if (emo > 0) fixes.push({ title: 'Drop the emoji from the copy', detail: 'Emoji in a hero headline reads as templated/generated.' });
  if (caps > 0) fixes.push({ title: 'Lose the ALL-CAPS words', detail: 'Full-caps words in the hero read as shouty, not designed.' });
  if (fixes.length === 0) fixes.push({ title: 'Nicely done', detail: 'No obvious tells. Next lever is rhythm and a point of view — write three hero variants and pick by voice.' });

  const flags = [];
  if (hype > 0) flags.push('hype');
  if (filler > 0) flags.push('filler');
  if (weak && c.trim() !== '') flags.push('weakcta');
  if (!hasNumber(all)) flags.push('nonum');
  if (hw > 12) flags.push('longhl');
  if (hw > 0 && hw < 3) flags.push('shorthl');
  if (excl > 0) flags.push('excl');
  if (emo > 0) flags.push('emoji');
  if (caps > 0) flags.push('caps');

  return { score: total, verdict, dimensions: dims, flags, fixes: fixes.slice(0, 6) };
}
