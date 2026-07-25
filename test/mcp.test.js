// End-to-end: spawn the real server over stdio and talk to it as an MCP client.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const SERVER = fileURLToPath(new URL('../src/index.js', import.meta.url));

let client;

before(async () => {
  client = new Client({ name: 'test-client', version: '1.0.0' });
  await client.connect(new StdioClientTransport({ command: process.execPath, args: [SERVER] }));
});

after(async () => { await client.close(); });

const call = async (name, args) => {
  const res = await client.callTool({ name, arguments: args });
  assert.ok(!res.isError, `tool ${name} returned an error: ${JSON.stringify(res.content)}`);
  return JSON.parse(res.content[0].text);
};

test('server advertises exactly the three tools', async () => {
  const { tools } = await client.listTools();
  assert.deepEqual(tools.map((t) => t.name).sort(), ['check_ai_slop', 'get_slop_stats', 'grade_landing_copy']);
  for (const t of tools) {
    assert.ok(t.description && t.description.length > 40, `${t.name} needs a real description`);
    assert.equal(t.inputSchema.type, 'object');
  }
});

test('check_ai_slop over MCP', async () => {
  const r = await call('check_ai_slop', {
    text: `In today's fast-paced world, it's important to note that businesses must delve into the ever-evolving landscape of digital transformation. Moreover, organizations can leverage robust, cutting-edge solutions to unlock their full potential. Furthermore, this comprehensive approach fosters a seamless experience that empowers teams to streamline their workflows. It's not just about technology — it's about people, process, and purpose. Additionally, companies that harness these transformative capabilities will find themselves well-positioned to navigate the complexities of tomorrow.`
  });
  assert.ok(r.score < 50, `expected a low score, got ${r.score}`);
  assert.ok(r.flags.includes('llmwords'));
  assert.equal(r.dimensions.length, 6);
});

test('grade_landing_copy over MCP returns the published 32 and 100', async () => {
  const bad = await call('grade_landing_copy', {
    headline: 'Revolutionize your workflow with our seamless, cutting-edge platform',
    subhead: 'Unlock powerful solutions that transform your business',
    cta: 'Learn more'
  });
  assert.equal(bad.score, 32);

  const good = await call('grade_landing_copy', {
    headline: 'Cut invoice time from 3 days to 20 minutes',
    subhead: 'Turn your spreadsheet into a client-ready invoice, no template hunting.',
    cta: 'Start your first invoice'
  });
  assert.equal(good.score, 100);
});

test('grade_landing_copy works with headline only (optional args)', async () => {
  const r = await call('grade_landing_copy', { headline: 'Ship it in 20 minutes' });
  assert.ok(typeof r.score === 'number');
});

test('get_slop_stats over MCP', async () => {
  const s = await call('get_slop_stats', {});
  assert.equal(s.n, 239);
  assert.equal(s.score.median, 79);
});

test('invalid input is rejected, not crashed on', async () => {
  const res = await client.callTool({ name: 'check_ai_slop', arguments: { text: '' } });
  assert.ok(res.isError, 'empty text should be a validation error');
  // and the server is still alive afterwards
  const s = await call('get_slop_stats', {});
  assert.equal(s.n, 239);
});
