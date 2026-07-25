#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { checkAiSlop } from './slop.js';
import { gradeLandingCopy } from './copy.js';
import { getSlopStats } from './stats.js';

const server = new McpServer({ name: 'ai-slop-checker', version: '1.0.0' });

const json = (o) => ({ content: [{ type: 'text', text: JSON.stringify(o, null, 2) }] });

server.registerTool(
  'check_ai_slop',
  {
    title: 'Check text for AI-writing style tells',
    description:
      'Score any prose 0-100 on how human it reads (100 = reads human) by counting six families of style tells: LLM word/phrase density, em-dash density, formulaic structures, sentence-length uniformity, lack of specifics, and over-perfect bullet lists. Returns the score, a verdict, per-dimension sub-scores with the raw counts that produced them, and up to 6 concrete fixes. Fully deterministic and local: no LLM call, no network, same input always gives the same number. This measures STYLE, not authorship — it is a tells counter, not an AI detector.',
    inputSchema: {
      text: z.string().min(1).describe('The prose to score. At least ~200 characters gives a reliable read; shorter text still scores but the sentence-rhythm dimension is skipped.')
    }
  },
  async ({ text }) => json(checkAiSlop(text))
);

server.registerTool(
  'grade_landing_copy',
  {
    title: 'Grade landing-page hero copy',
    description:
      'Score a landing-page hero (headline + sub-headline + call-to-action button) 0-100 across five weighted dimensions: Anti-hype (25), Specificity (25), Clarity (25), Headline shape (13), CTA (12). Returns the score, a verdict, per-dimension sub-scores with raw counts, short flags, and up to 6 targeted rewrites. Deterministic, no LLM, no network. This is the same engine used to score the public 239-page dataset exposed by get_slop_stats, so scores are directly comparable to real landing pages.',
    inputSchema: {
      headline: z.string().describe('The hero headline (h1).'),
      subhead: z.string().default('').describe('The sub-headline / first sub-line under the h1. Optional.'),
      cta: z.string().default('').describe('The call-to-action button label, e.g. "Start your first invoice". Optional, but an empty CTA scores 0 on that dimension.')
    }
  },
  async ({ headline, subhead = '', cta = '' }) => json(gradeLandingCopy(headline, subhead, cta))
);

server.registerTool(
  'get_slop_stats',
  {
    title: 'Benchmark stats from 239 real landing pages',
    description:
      'Return the reference distribution for grade_landing_copy: 239 real landing pages (min 41, median 79, mean 80.1, 19 perfect scores), how often each tell fires across them, the 10 lowest-scoring domains, and the score distribution. Use it to tell a user whether their score is actually good. Static local data, no network.',
    inputSchema: {}
  },
  async () => json(getSlopStats())
);

await server.connect(new StdioServerTransport());
