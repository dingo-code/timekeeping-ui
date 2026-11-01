import test from 'node:test';
import assert from 'node:assert/strict';
import { formatResultDiff } from './resultOrder.js';
import { formatMs } from './timeFormat.js';

test('shows a signed time difference when status priority places a faster DNS below DNF', () => {
  assert.equal(formatResultDiff(300000 - 400000, formatMs), '-01:40,00');
  assert.equal(formatResultDiff(400000 - 300000, formatMs), '+01:40,00');
  for (const value of [0, null, undefined, 'invalid']) {
    assert.equal(formatResultDiff(value, formatMs), '-');
  }
});
