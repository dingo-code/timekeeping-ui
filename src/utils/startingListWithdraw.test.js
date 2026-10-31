import test from 'node:test';
import assert from 'node:assert/strict';
import { buildStartingListPayload, isWithdrawActiveOnStage } from './startingListWithdraw.js';

const stages = [1, 2, 3, 4].map((ss_order) => ({ id: `ss-${ss_order}`, ss_order }));
const wd = (stage) => ({ id: 'car-90', start_number: 90, start_order: 11, withdraw_from_stage_id: `ss-${stage}` });
const active = { id: 'car-91', start_number: 91, start_order: 11 };
const payload = (rows, stage, options = {}) => buildStartingListPayload(rows, { stage: stages[stage - 1], stages, ...options });

test('WD in SS1 cannot occupy order 11 in SS2 or any later starting list', () => {
  for (const stage of [2, 3, 4]) {
    assert.deepEqual(payload([wd(1), active], stage), [{ participant_id: 'car-91', start_order: 11, list_position: 1, target_tc_time: '' }]);
  }
});

test('WD in SS2 keeps its SS1 slot and releases slots from SS2 onward', () => {
  assert.equal(isWithdrawActiveOnStage(wd(2), stages[0], stages), false);
  assert.equal(payload([wd(2)], 1)[0].start_order, 11);
  for (const stage of [2, 3, 4]) assert.deepEqual(payload([wd(2), active], stage).map((entry) => entry.participant_id), ['car-91']);
});

test('future WD and active participants still cannot share a start order', () => {
  assert.throws(() => payload([wd(3), active], 2), /Start Ke 11/);
  assert.throws(() => payload([{ ...wd(1), withdraw_from_stage_id: '' }, active], 2), /Start Ke 11/);
});

test('ignores invalid old WD drafts without renumbering imported active rows', () => {
  const entries = payload([wd(1), active, { id: 'car-92', start_number: 92, start_order: 12 }], 3, {
    startOrderDrafts: { 'car-90': 'invalid', 'car-91': 11 }, tcTargetDrafts: { 'car-91': '09:00:00' },
  });
  assert.deepEqual(entries.map((entry) => [entry.participant_id, entry.start_order, entry.list_position]), [['car-91', 11, 1], ['car-92', 12, 2]]);
  assert.equal(entries[0].target_tc_time, '09:00:00');
  assert.throws(() => payload([active], 3, { startOrderDrafts: { 'car-91': 0 } }), /lebih besar dari 0/);
});

test('supports an empty list when everyone is WD', () => {
  assert.deepEqual(payload([wd(1)], 3), []);
});

test('shakedown selection is independent from WD on official stages', () => {
  const stage = { id: 'shake', ss_order: 0, is_shakedown: true };
  const entries = buildStartingListPayload([wd(1), active], { stage, stages: [stage, ...stages], shakedownParticipantIds: ['car-90'] });
  assert.deepEqual(entries.map((entry) => entry.participant_id), ['car-90']);
});
