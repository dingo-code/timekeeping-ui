import test from 'node:test';
import assert from 'node:assert/strict';
import { sortEntryList } from './entryListOrder.js';

test('uses document order even when race results arrive in a different order', () => {
  const entries = [{ start_number: 1, entry_order: 115 }, { start_number: 128, entry_order: 2 }, { start_number: 129, entry_order: 1 }];
  assert.deepEqual(sortEntryList(entries).map((entry) => entry.start_number), [129, 128, 1]);
  assert.equal(entries[0].start_number, 1);
});

test('keeps unimported participants after document rows and supports old events', () => {
  const entries = [{ start_number: 5 }, { start_number: 129, entry_order: 1 }, { start_number: 2, entry_order: 0 }];
  assert.deepEqual(sortEntryList(entries).map((entry) => entry.start_number), [129, 2, 5]);
  assert.deepEqual(sortEntryList(entries.filter((entry) => !entry.entry_order)).map((entry) => entry.start_number), [2, 5]);
});
