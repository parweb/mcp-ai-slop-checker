// Benchmark stats from a public open dataset: 239 real landing pages, hero copy
// extracted from raw HTML (no JS execution) on 2026-07-24 and scored with the
// exact `grade_landing_copy` engine in this package.
//
// Full CSV, with the extracted headline/subhead/cta of every page:
//   https://github.com/parweb/landing-copy-grader/blob/main/data/landing-pages-scores.csv
// Methodology + exclusions (303 attempted -> 239 kept) are documented there.
//
// The table below is pinned by test/engine.test.js against
// `node scripts/verify-dataset.js` in that repo, which re-scores all 239 rows
// offline. It is not hand-maintained: it was wrong once because it was.

export const DATASET = {
  n: 239,
  attempted: 303,
  excluded: 64,
  extracted_at: '2026-07-24',
  method: 'static-fetch-regex-v1 (raw HTML, no JS execution, no LLM)',
  source_csv: 'https://raw.githubusercontent.com/parweb/landing-copy-grader/main/data/landing-pages-scores.csv',
  score: { min: 41, median: 79, mean: 80.1, max: 100, perfect_100: 19, below_70: 31 },
  distribution: {
    '40-49': 1, '50-59': 4, '60-69': 26, '70-79': 90, '80-89': 75, '90-99': 24, '100': 19
  },
  flag_frequency: [
    { flag: 'nonum', pages: 195, pct: 82, meaning: 'not a single digit in the hero' },
    { flag: 'filler', pages: 82, pct: 34, meaning: '>=1 filler word (solutions/platform/powerful…)' },
    { flag: 'weakcta', pages: 35, pct: 15, meaning: 'CTA is a stock verb phrase (Learn more / Get started)' },
    { flag: 'caps', pages: 33, pct: 14, meaning: 'ALL-CAPS word in headline or sub-line' },
    { flag: 'hype', pages: 16, pct: 7, meaning: '>=1 hype word (revolutionize/unlock/seamless…)' },
    { flag: 'shorthl', pages: 13, pct: 5, meaning: 'headline under 3 words' },
    { flag: 'longhl', pages: 9, pct: 4, meaning: 'headline over 12 words' },
    { flag: 'excl', pages: 7, pct: 3, meaning: 'exclamation mark in the hero' },
    { flag: 'emoji', pages: 7, pct: 3, meaning: 'emoji in the hero' }
  ],
  headline_finding:
    'The single most common tell is the absence of a number: 195 of 239 pages (82%) make a claim in their hero with zero quantity attached. Not em-dashes, not "delve".',
  lowest_10: [
    { domain: 'copy.ai', score: 41, flags: ['filler', 'nonum', 'shorthl'] },
    { domain: 'beehiiv.com', score: 51, flags: ['filler', 'nonum', 'caps'] },
    { domain: 'bitwarden.com', score: 51, flags: ['filler', 'nonum', 'caps'] },
    { domain: 'optimizely.com', score: 57, flags: ['filler', 'nonum', 'longhl'] },
    { domain: 'unit.co', score: 58, flags: ['hype', 'filler', 'nonum'] },
    { domain: 'close.com', score: 61, flags: ['filler', 'nonum', 'caps'] },
    { domain: 'jotform.com', score: 61, flags: ['filler', 'nonum', 'caps'] },
    { domain: 'stripe.com', score: 61, flags: ['filler', 'weakcta', 'nonum'] },
    { domain: 'asana.com', score: 62, flags: ['hype', 'filler', 'weakcta'] },
    { domain: 'marqeta.com', score: 62, flags: ['hype', 'filler', 'nonum'] }
  ],
  perfect_100_domains: [
    'appsmith.com', 'auth0.com', 'calendly.com', 'dashlane.com', 'framer.com',
    'gumroad.com', 'indiehackers.com', 'instacart.com', 'leadpages.com',
    'lithic.com', 'logrocket.com', 'mem0.ai', 'pipedream.com', 'pocketbase.io',
    'podia.com', 'producthunt.com', 'scale.com', 'trychroma.com', 'wise.com'
  ],
  caveat:
    'A score is a style measurement, not an authorship claim. stripe.com scores 61 and was certainly written by humans — treat a low score as "reads generic", never as "was generated".'
};

export function getSlopStats() {
  return DATASET;
}
