import test from 'node:test';
import assert from 'node:assert/strict';

import { normalizeCodes, runWithConcurrency } from '../shared.js';

test('normalizeCodes splits by line, trims whitespace, and removes empty lines', () => {
  assert.deepEqual(
    normalizeCodes('  A1  \r\n\n\tB2\t\n C3 \n'),
    ['A1', 'B2', 'C3'],
  );
});

test('runWithConcurrency respects the configured parallel limit and preserves result order', async () => {
  let running = 0;
  let maxRunning = 0;

  const results = await runWithConcurrency(['A', 'B', 'C', 'D'], 2, async (code) => {
    running += 1;
    maxRunning = Math.max(maxRunning, running);
    await new Promise((resolve) => setTimeout(resolve, 5));
    running -= 1;
    return `${code}-done`;
  });

  assert.equal(maxRunning, 2);
  assert.deepEqual(results, ['A-done', 'B-done', 'C-done', 'D-done']);
});
