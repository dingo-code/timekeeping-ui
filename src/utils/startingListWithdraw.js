export function isWithdrawActiveOnStage(participant, stage, stages) {
  if (!participant?.withdraw_from_stage_id || !stage || stage.is_shakedown) return false;
  const withdrawStage = stages.find((item) => item.id === participant.withdraw_from_stage_id);
  if (!withdrawStage) return true;
  return Number(stage.ss_order) >= Number(withdrawStage.ss_order);
}

export function buildStartingListPayload(rows, {
  stage, stages, startOrderDrafts = {}, tcTargetDrafts = {}, shakedownParticipantIds = [],
}) {
  const selectedRows = rows.filter((row) => stage?.is_shakedown
    ? shakedownParticipantIds.includes(row.id)
    : !isWithdrawActiveOnStage(row, stage, stages));
  const entries = selectedRows.map((row, index) => ({
    participant_id: row.id,
    start_order: Number(startOrderDrafts[row.id] ?? row.start_order ?? row.start_number),
    list_position: index + 1,
    target_tc_time: tcTargetDrafts[row.id] ?? row.target_tc_time ?? '',
  }));
  if (entries.some((row) => !Number.isInteger(row.start_order) || row.start_order <= 0)) {
    throw new Error('Semua Start Ke harus berupa angka lebih besar dari 0.');
  }
  const orders = new Set();
  for (const row of entries) {
    if (orders.has(row.start_order)) throw new Error(`Start Ke ${row.start_order} dipakai lebih dari satu peserta.`);
    orders.add(row.start_order);
  }
  return entries;
}
