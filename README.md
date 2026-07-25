# mcp-ai-slop-checker

An MCP server that tells your model when its own writing sounds like AI.

Three tools, all **deterministic, local and offline**: no LLM call, no API key, no network request, no telemetry. The same input always returns the same number, so you can put a score in a test and assert on it.

```
check_ai_slop(text)                          -> 0-100, 6 dimensions, named tells, fixes
grade_landing_copy(headline, subhead, cta)   -> 0-100, 5 dimensions, flags, rewrites
get_slop_stats()                             -> benchmark stats from 239 real landing pages
```

## Why

Every "AI detector" is a probabilistic classifier that guesses at authorship and gets it wrong on both sides. This does the opposite and says so plainly: it **counts style tells** — em-dash density, `delve`/`tapestry`/`furthermore` frequency, "not only… but also" scaffolds, suspiciously even sentence lengths, missing specifics, over-parallel bullet lists — and hands back the raw counts that produced each sub-score.

That makes it useful in a loop an agent can actually close: write → score → see which count is high → fix that specific thing → re-score. A classifier's "87% likely AI" gives an agent nothing to act on. `"hype": 5` does.

**A score is a style measurement, not an authorship claim.** `stripe.com` scores 61 and was obviously written by professionals. Low score means *reads generic*, never *was generated*.

## Install

Listed in the official [MCP Registry](https://registry.modelcontextprotocol.io) as `io.github.parweb/ai-slop-checker`.

Installs straight from GitHub — not on npm yet, so use the `github:` spec:

```bash
claude mcp add ai-slop-checker -- npx -y github:parweb/mcp-ai-slop-checker
```

Or in any MCP client config (`claude_desktop_config.json`, `.mcp.json`, Cursor, etc.):

```json
{
  "mcpServers": {
    "ai-slop-checker": {
      "command": "npx",
      "args": ["-y", "github:parweb/mcp-ai-slop-checker"]
    }
  }
}
```

Or install the self-contained MCPB bundle (dependencies included, no install step) from the
[v1.0.0 release](https://github.com/parweb/mcp-ai-slop-checker/releases/tag/v1.0.0) —
`mcp-ai-slop-checker.mcpb`, SHA-256 `56a17584b7504d70a9023f8a4b5ce2e7e528b4982a3781a19351f81e6403f2d9`.

From source:

```bash
git clone https://github.com/parweb/mcp-ai-slop-checker
cd mcp-ai-slop-checker && npm install && npm test
# then point your client at:  node /abs/path/mcp-ai-slop-checker/src/index.js
```

Node >= 18. One runtime dependency (`@modelcontextprotocol/sdk`) plus `zod`.

## Tools

### `check_ai_slop(text)`

Scores prose 0-100, where **100 reads human**. Six dimensions: LLM-word density (30), em-dash density (20), formulaic structures (15), sentence rhythm (15), specificity (10), list perfection (10). ~200+ characters gives a reliable read.

Real output, trimmed to the parts that matter:

```jsonc
// input: a 74-word paragraph of "In today's fast-paced world… delve… Moreover… seamless…"
{
  "score": 34,
  "verdict": "This sounds AI-generated.",
  "words": 74,
  "dimensions": [
    { "key": "LLM-word density",     "max": 30, "score": 0,  "notes": { "phrases": 5, "words": 14 } },
    { "key": "Em-dash density",      "max": 20, "score": 8,  "notes": { "dashes": 1 } },
    { "key": "Formulaic structures", "max": 15, "score": 10, "notes": { "hits": 1, "triads": 1 } },
    { "key": "Sentence rhythm",      "max": 15, "score": 6,  "notes": { "sentences": 5, "cv": 0.2 } },
    { "key": "Specificity",          "max": 10, "score": 0,  "notes": { "number": false, "propers": 0 } },
    { "key": "List perfection",      "max": 10, "score": 10, "notes": { "bullets": 0, "bold": 0 } }
  ],
  "flags": ["llmwords", "emdash", "formulaic", "uniform", "nospec"],
  "fixes": [
    { "title": "Cut the LLM words",
      "detail": "Found 19 (\"delve/tapestry/furthermore/it's important to note\"…). Each one is a known model tell. Replace with the plain word you'd say out loud." },
    { "title": "Vary sentence length",
      "detail": "Your sentences are suspiciously even (5 sentences, low variance). Humans write long, then short. Like this." }
  ]
}
```

The hand-written paragraph in [`test/engine.test.js`](test/engine.test.js) — same subject, same rough length — scores **92, "Reads human."**

### `grade_landing_copy(headline, subhead, cta)`

Scores a hero block 0-100 across Anti-hype (25), Specificity (25), Clarity (25), Headline shape (13), CTA (12). `subhead` and `cta` are optional, but an empty CTA scores 0 on that dimension.

Real output:

```jsonc
// headline: "Revolutionize your workflow with our seamless, cutting-edge platform"
// subhead:  "Unlock powerful solutions that transform your business"
// cta:      "Learn more"
{
  "score": 32,
  "verdict": "This reads AI-generated.",
  "dimensions": [
    { "key": "Anti-hype",      "max": 25, "score": 0,  "notes": { "hype": 5, "exclamations": 0, "emoji": 0, "allcaps": 0 } },
    { "key": "Specificity",    "max": 25, "score": 8,  "notes": { "number": false } },
    { "key": "Clarity",        "max": 25, "score": 7,  "notes": { "filler": 3 } },
    { "key": "Headline shape", "max": 13, "score": 13, "notes": { "words": 8 } },
    { "key": "CTA",            "max": 12, "score": 4,  "notes": { "weak": true, "empty": false } }
  ],
  "flags": ["hype", "filler", "weakcta", "nonum"],
  "fixes": [
    { "title": "Cut the hype words", "detail": "Found 5 (\"revolutionize/unlock/seamless/leverage\"…). Replace each with a plain, concrete verb." },
    { "title": "Add one number",     "detail": "No concrete figure anywhere. …81% of the 239 pages in our dataset fail this one." },
    { "title": "Rewrite the CTA",    "detail": "\"Learn more\" is generic. Use an action + outcome…" }
  ]
}
```

Fix all four and the same offer scores **100**:

```
headline: "Cut invoice time from 3 days to 20 minutes"
subhead:  "Turn your spreadsheet into a client-ready invoice, no template hunting."
cta:      "Start your first invoice"
-> { "score": 100, "verdict": "Reads human & sharp.", "flags": [] }
```

Both numbers are asserted in [`test/engine.test.js`](test/engine.test.js), so they can't silently drift.

### `get_slop_stats()`

Without a baseline, "your copy scored 74" is meaningless. This returns the reference distribution so the model can say *"that's below the median of 239 real landing pages."*

| | |
|---|---|
| pages | 239 (303 attempted, 64 excluded) |
| score | min **41** · median **79** · mean **80.1** · **19** perfect · **31** below 70 |
| extracted | 2026-07-24, raw HTML, no JS execution, no LLM |

How often each tell fires:

| flag | pages | % | meaning |
|---|---:|---:|---|
| `nonum` | 194 | 81% | not a single digit in the hero |
| `filler` | 82 | 34% | ≥1 filler word |
| `weakcta` | 35 | 15% | CTA is a stock verb phrase |
| `caps` | 31 | 13% | ALL-CAPS word in headline/sub |
| `hype` | 16 | 7% | ≥1 hype word |
| `shorthl` | 12 | 5% | headline under 3 words |
| `longhl` | 7 | 3% | headline over 12 words |
| `excl` | 7 | 3% | exclamation mark |
| `emoji` | 5 | 2% | emoji in the hero |

**The most common tell is not the em-dash and not "delve" — it's the absence of a number.** Four landing pages in five make a claim with zero quantity attached to it.

Full CSV, methodology and the exclusion list: [open dataset gist](https://gist.github.com/parweb/5ed569ba76c365f7b789a979ad6090e7?utm_source=mcp).

## Tests

```bash
npm test
```

18 tests: the scoring engines against published fixtures, plus 6 that spawn the real server over stdio and drive it through an actual MCP client (`listTools`, three `callTool` round-trips, optional-argument handling, and a validation error that must not kill the process).

```
# tests 18
# pass 18
# fail 0
```

## Related

Same engines, other surfaces:

- [Does this sound AI?](https://1h-money-store.vercel.app/sounds-ai?utm_source=mcp) — `check_ai_slop` in the browser
- [Landing-page leaderboard](https://1h-money-store.vercel.app/leaderboard?utm_source=mcp) — all 239 pages, scored, with the hero text
- [parweb/landing-copy-grader](https://github.com/parweb/landing-copy-grader) — the single-file browser grader and the dataset

## Honesty notes

- This counts style tells. It does not detect authorship, and nothing reliably does.
- The word lists are opinionated and English-only. They are plain arrays at the top of [`src/slop.js`](src/slop.js) and [`src/copy.js`](src/copy.js) — read them, disagree, fork.
- Scores are comparable over time only because nothing here is stochastic. That's the whole point.
- Built and maintained by an autonomous agent org. The code, the dataset and these numbers are real and reproducible; run `npm test` and check.

## License

MIT
