import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeRows, findImportedRacer, getReviewIssues, validateReview } from './entryListMatching.js';

const participant = (id, number, driver = 'Driver Lama') => ({
  id, start_number: number, driver: { full_name: driver }, navigator: { full_name: 'Navigator Lama' },
  vehicle: { brand: 'Toyota', type: 'Corolla DX' },
});
const reviewRow = (key, number, id, kind = 'matched') => ({ key, data: { startNumber: number }, participantId: id, kind });

test('preserves participant identity when a matched crew changes start number', () => {
  const [row] = analyzeRows([{ startNumber: 23, driver: 'Driver Lama', navigator: 'Navigator Lama', car: 'Toyota', type: 'Corolla DX' }], [participant('old-entry', 100)]);
  assert.equal(row.participantId, 'old-entry');
  assert.equal(row.kind, 'matched');
  assert.deepEqual(validateReview([row], [participant('old-entry', 100)]), []);
});

test('reports duplicate mappings on both affected rows', () => {
  const issues = getReviewIssues([reviewRow('a', 23, 'same'), reviewRow('b', 21, 'same')], [participant('same', 100)]);
  assert.deepEqual(issues.map((issue) => issue.rowKey), ['a', 'b']);
  assert.ok(issues.every((issue) => /23, 21/.test(issue.message)));
});

test('still blocks a confirmed new entry using an unmapped old entry number', () => {
  const issues = getReviewIssues([reviewRow('new', 23, '', 'confirmed-new')], [participant('old', '23')]);
  assert.equal(issues.length, 1);
  assert.equal(issues[0].rowKey, 'new');
  assert.match(issues[0].message, /Driver Lama/);
});

test('allows a start-number swap when both existing entries are mapped', () => {
  assert.deepEqual(validateReview([reviewRow('a', 21, 'one'), reviewRow('b', 23, 'two')], [participant('one', 23), participant('two', 21)]), []);
});

test('keeps unmatched or ambiguous entries pending explicit review', () => {
  const issues = getReviewIssues([reviewRow('a', 23, '', 'new'), reviewRow('b', 21, '', 'ambiguous')], []);
  assert.deepEqual(issues.map((issue) => issue.rowKey), ['a', 'b']);
  assert.match(issues[0].message, /konfirmasi/);
  assert.match(issues[1].message, /ambigu/);
});

test('marks both rows for duplicate car numbers', () => {
  const issues = getReviewIssues([reviewRow('a', 23, 'one'), reviewRow('b', 23, 'two')], []);
  assert.deepEqual(issues.map((issue) => issue.rowKey), ['a', 'b']);
});

test('blocks duplicate document sequence numbers on both rows', () => {
  const rows = [reviewRow('a', 129, 'one'), reviewRow('b', 128, 'two')];
  rows.forEach((row) => { row.data.entryOrder = 1; });
  const issues = getReviewIssues(rows, []);
  assert.deepEqual(issues.map((issue) => issue.rowKey), ['a', 'b']);
  assert.ok(issues.every((issue) => /No urut 1/.test(issue.message)));
});

test('does not reuse a replaced driver master record for a different person', () => {
  const racers = [{ id: 'old-driver', full_name: 'Edwin Djaya' }];
  assert.equal(findImportedRacer(racers, 'Iskra Scastia', 'old-driver'), undefined);
  assert.equal(racers[0].full_name, 'Edwin Djaya');
});

test('reuses a replacement driver already present in the racer master', () => {
  const racers = [{ id: 'old-driver', full_name: 'Edwin Djaya' }, { id: 'replacement', full_name: 'Iskra Scastia' }];
  assert.equal(findImportedRacer(racers, 'Iskra Scastia', 'old-driver').id, 'replacement');
  assert.equal(findImportedRacer(racers, 'EDWIN DJAYA', 'old-driver').id, 'old-driver');
});
