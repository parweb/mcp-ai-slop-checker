import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkAiSlop } from '../src/slop.js';
import { gradeLandingCopy } from '../src/copy.js';
import { getSlopStats } from '../src/stats.js';

// The two published worked examples from github.com/parweb/landing-copy-grader.
// If these numbers move, the engine drifted from the public dataset.
const AI_HERO = {
  headline: 'Revolutionize your workflow with our seamless, cutting-edge platform',
  subhead: 'Unlock powerful solutions that transform your business',
  cta: 'Learn more'
};
const HUMAN_HERO = {
  headline: 'Cut invoice time from 3 days to 20 minutes',
  subhead: 'Turn your spreadsheet into a client-ready invoice, no template hunting.',
  cta: 'Start your first invoice'
};

test('grade_landing_copy: generic AI hero scores 32/100', () => {
  const r = gradeLandingCopy(AI_HERO.headline, AI_HERO.subhead, AI_HERO.cta);
  assert.equal(r.score, 32);
  assert.equal(r.verdict, 'This reads AI-generated.');
  assert.deepEqual(r.flags.sort(), ['filler', 'hype', 'nonum', 'weakcta']);
});

test('grade_landing_copy: specific human hero scores 100/100', () => {
  const r = gradeLandingCopy(HUMAN_HERO.headline, HUMAN_HERO.subhead, HUMAN_HERO.cta);
  assert.equal(r.score, 100);
  assert.equal(r.verdict, 'Reads human & sharp.');
  assert.deepEqual(r.flags, []);
});

test('grade_landing_copy: dimensions always sum to the total and stay in range', () => {
  for (const h of [AI_HERO, HUMAN_HERO]) {
    const r = gradeLandingCopy(h.headline, h.subhead, h.cta);
    const sum = r.dimensions.reduce((a, d) => a + d.score, 0);
    assert.equal(sum, r.score);
    for (const d of r.dimensions) {
      assert.ok(d.score >= 0 && d.score <= d.max, `${d.key} out of range`);
    }
  }
});

test('grade_landing_copy: empty CTA scores 0 on the CTA dimension', () => {
  const r = gradeLandingCopy('Cut invoice time from 3 days to 20 minutes', '', '');
  const cta = r.dimensions.find((d) => d.key === 'CTA');
  assert.equal(cta.score, 0);
});

test('grade_landing_copy is deterministic', () => {
  const a = gradeLandingCopy(AI_HERO.headline, AI_HERO.subhead, AI_HERO.cta);
  const b = gradeLandingCopy(AI_HERO.headline, AI_HERO.subhead, AI_HERO.cta);
  assert.deepEqual(a, b);
});

const AI_PROSE = `In today's fast-paced world, it's important to note that businesses must delve into the ever-evolving landscape of digital transformation. Moreover, organizations can leverage robust, cutting-edge solutions to unlock their full potential. Furthermore, this comprehensive approach fosters a seamless experience that empowers teams to streamline their workflows. It's not just about technology — it's about people, process, and purpose. Additionally, companies that harness these transformative capabilities will find themselves well-positioned to navigate the complexities of tomorrow.`;

const HUMAN_PROSE = `We scored 239 landing pages last Tuesday. The script took 40 minutes and broke twice on Cloudflare. Median score: 79.

What surprised me was the tell that fired most. Not em-dashes. Not "delve". It was the absence of any number at all: 194 of the 239 heroes contain no digit. Four out of five companies make a claim about their product and attach no quantity to it.

Stripe scored 61. I stared at that for a while, because Stripe's copy is obviously written by humans who are good at their job. So the score is not a verdict on the writer. It is a count of how generic the surface reads, nothing more.`;

test('check_ai_slop: LLM-flavored prose scores low', () => {
  const r = checkAiSlop(AI_PROSE);
  assert.ok(r.score < 50, `expected < 50, got ${r.score}`);
  assert.ok(r.flags.includes('llmwords'), 'should flag LLM words');
  assert.ok(r.fixes.length > 0);
});

test('check_ai_slop: human prose scores high', () => {
  const r = checkAiSlop(HUMAN_PROSE);
  assert.ok(r.score >= 80, `expected >= 80, got ${r.score}`);
  assert.equal(r.verdict, 'Reads human.');
});

test('check_ai_slop: human prose outscores AI prose by a wide margin', () => {
  assert.ok(checkAiSlop(HUMAN_PROSE).score - checkAiSlop(AI_PROSE).score > 40);
});

test('check_ai_slop: em-dash spam is caught', () => {
  const r = checkAiSlop('The plan was simple — ship it — then measure — then decide — and repeat.');
  const dim = r.dimensions.find((d) => d.key === 'Em-dash density');
  assert.equal(dim.notes.dashes, 4);
  assert.ok(dim.score < dim.max);
  assert.ok(r.flags.includes('emdash'));
});

test('check_ai_slop: score is 0-100 and dimensions sum to it', () => {
  for (const t of [AI_PROSE, HUMAN_PROSE, 'short.', '']) {
    const r = checkAiSlop(t || ' ');
    assert.ok(r.score >= 0 && r.score <= 100);
    assert.equal(r.dimensions.reduce((a, d) => a + d.score, 0), r.score);
  }
});

test('check_ai_slop is deterministic', () => {
  assert.deepEqual(checkAiSlop(AI_PROSE), checkAiSlop(AI_PROSE));
});

test('get_slop_stats: 239 pages, and the flag counts match the published CSV', () => {
  const s = getSlopStats();
  assert.equal(s.n, 239);
  assert.equal(s.score.median, 79);
  assert.equal(s.score.min, 41);
  const nonum = s.flag_frequency.find((f) => f.flag === 'nonum');
  assert.equal(nonum.pages, 194);
  assert.equal(s.lowest_10.length, 10);
  assert.equal(s.perfect_100_domains.length, s.score.perfect_100);
  const total = Object.values(s.distribution).reduce((a, b) => a + b, 0);
  assert.equal(total, 239, 'distribution must cover all 239 pages');
});
