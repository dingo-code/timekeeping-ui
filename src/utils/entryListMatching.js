export function analyzeRows(rows, participants) {
  return rows.map((data, index) => {
    const exactCrew = participants.filter((p) => norm(p.driver?.full_name) === norm(data.driver) && norm(p.navigator?.full_name) === norm(data.navigator));
    const driver = participants.filter((p) => norm(p.driver?.full_name) === norm(data.driver));
    const vehicleDriver = driver.filter((p) => norm(`${p.vehicle?.brand || ''} ${p.vehicle?.type || ''}`).includes(norm(`${data.car} ${data.type}`)));
    let candidate = exactCrew.length === 1 ? exactCrew[0] : vehicleDriver.length === 1 ? vehicleDriver[0] : driver.length === 1 ? driver[0] : null;
    if (!candidate && data.participantId) candidate = participants.find((p) => p.id === data.participantId);
    const ambiguous = !candidate && (exactCrew.length > 1 || driver.length > 1);
    return { key: `${data.startNumber}-${index}`, data, participantId: candidate?.id || '', kind: ambiguous ? 'ambiguous' : candidate ? 'matched' : 'new', confidence: exactCrew.length === 1 ? 'Driver + Navigator' : vehicleDriver.length === 1 ? 'Driver + Kendaraan' : driver.length === 1 ? 'Driver' : ambiguous ? 'Ambigu' : 'Baru' };
  });
}

export function getReviewIssues(rows, participants) {
  const numbers = new Map(), ids = new Map(), orders = new Map();
  for (const row of rows) {
    const number = Number(row.data.startNumber);
    numbers.set(number, [...(numbers.get(number) || []), row]);
    if (row.data.entryOrder) orders.set(row.data.entryOrder, [...(orders.get(row.data.entryOrder) || []), row]);
    if (row.participantId) ids.set(row.participantId, [...(ids.get(row.participantId) || []), row]);
  }

  return rows.flatMap((row) => {
    const number = Number(row.data.startNumber);
    const messages = [];
    if (numbers.get(number).length > 1) messages.push(`No ${number} muncul lebih dari sekali di file.`);
    if (orders.get(row.data.entryOrder)?.length > 1) messages.push(`No urut ${row.data.entryOrder} muncul lebih dari sekali di file.`);
    if (row.participantId && ids.get(row.participantId).length > 1) {
      const mappedNumbers = ids.get(row.participantId).map((item) => item.data.startNumber).join(', ');
      messages.push(`No ${number}: peserta lama yang sama dipilih untuk baris ${mappedNumbers}. Pilih peserta lama yang berbeda.`);
    }
    if (row.kind === 'ambiguous' && !row.participantId) messages.push(`No ${number} masih ambigu. Pilih peserta lama yang sesuai.`);
    if (row.kind === 'new') messages.push(`No ${number} belum cocok dengan peserta lama. Pilih peserta lama atau konfirmasi sebagai peserta baru.`);
    const occupant = participants.find((p) => Number(p.start_number) === number && p.id !== row.participantId && !ids.has(p.id));
    if (occupant) {
      messages.push(`No ${number} masih dimiliki ${occupant.driver?.full_name || 'peserta lama'} yang tidak dipetakan dalam file.`);
    }
    return messages.map((message) => ({ rowKey: row.key, message }));
  });
}

export function validateReview(rows, participants) {
  return [...new Set(getReviewIssues(rows, participants).map((issue) => issue.message))];
}

export function findImportedRacer(racers, name, existingId) {
  const existing = racers.find((racer) => racer.id === existingId);
  // A manually mapped replacement entry must not rename the old driver's
  // master record, which may also be used by other events.
  if (existing && (!norm(name) || norm(existing.full_name) === norm(name))) return existing;
  return racers.find((racer) => norm(racer.full_name) === norm(name));
}

function norm(value) {
  return String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();
}
