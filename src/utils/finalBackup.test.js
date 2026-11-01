import test from 'node:test';
import assert from 'node:assert/strict';
import { backupDurationDifference, buildFinalBackupWebRows } from './finalBackup.js';
import { buildOverallEntries } from './overallResults.js';

const stage = { id: 'ss-1', ss_order: 1 };
const entry = (number, confirmed, time, status = 'OK') => ({
  start_number: number, participant_id: `car-${number}`, parc_ferme_confirmed: confirmed,
  status, stage_times: [{ ss_id: stage.id, ss_order: 1, status, start_time: '09:00:00', finish_time: status === 'OK' ? '09:05:00' : '', elapsed_time_ms: time - 20000, penalty_time_ms: 20000, total_time_ms: time }],
});

test('final backup uses the public final classification and ranks only confirmed Parc Ferme participants', () => {
  const entries = [entry(1, false, 100000), entry(2, true, 300000), entry(3, true, 400000)];
  const rows = buildFinalBackupWebRows({ groups: [{ entries }] }, [1, 2]);
  assert.deepEqual(rows.map((row) => [row.number, row.position, row.diffPrevMs, row.diffFirstMs]), [[2, 1, 0, 0], [3, 2, 100000, 100000]]);
  assert.deepEqual(rows[0].stageTimesMs, { 1: 280000, 2: null });
  assert.equal(rows[0].penaltyMs, 20000);
  assert.equal(rows[0].totalTimeMs, 300000);
  assert.equal(buildOverallEntries(entries, stage).length, 3);
  assert.deepEqual(buildFinalBackupWebRows({ groups: [{ entries: [entry(1, false, 100000)] }] }, [1]), []);
});

test('final backup preserves DNF priority over faster DNS and the recorded timing values', () => {
  const rows = buildFinalBackupWebRows({ groups: [{ entries: [entry(1, true, 300000, 'DNS'), entry(90, true, 400000, 'DNF')] }] }, [1]);
  assert.deepEqual(rows.map((row) => row.number), [90, 1]);
  assert.equal(rows[0].totalTimeMs, 400000);
  assert.equal(rows[1].status, 'NOT_FINISHER');
});

test('PDF precision rounds both values but still detects a difference of one printed tick', () => {
  assert.equal(backupDurationDifference(1000, 1040, 1), 0);
  assert.equal(backupDurationDifference(1000, 1100, 1), -100);
  assert.equal(backupDurationDifference(1000, 1040), -40);
  assert.equal(backupDurationDifference(0, 0, 1), 0);
  assert.equal(backupDurationDifference(null, 1000, 1), null);
  assert.equal(backupDurationDifference(1000, 'invalid', 1), null);
});
