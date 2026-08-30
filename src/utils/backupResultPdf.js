const RESULT_PROFILE = 'Stage Result - positional table';

const columnRanges = {
  position: [0.0, 0.04],
  number: [0.04, 0.075],
  entrant: [0.075, 0.295],
  driver: [0.295, 0.42],
  navigator: [0.42, 0.555],
  className: [0.555, 0.59],
  car: [0.59, 0.65],
  type: [0.65, 0.745],
  stageTime: [0.745, 0.80],
  penalty: [0.80, 0.84],
  totalTime: [0.84, 0.89],
};

export async function readBackupResultPdf(file) {
  const pdfjs = await import('pdfjs-dist');
  const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  return parseBackupResultPdfDocument(pdf, file.name);
}

export async function parseBackupResultPdfDocument(pdf, fileName = 'backup.pdf') {
  const rows = [];
  const pageTexts = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    const items = content.items
      .map((item) => ({
        text: cleanText(item.str),
        x: Number(item.transform?.[4] || 0),
        y: Number(item.transform?.[5] || 0),
      }))
      .filter((item) => item.text);

    pageTexts.push(items.map((item) => item.text).join(' '));
    rows.push(...parsePageRows(items, viewport.width, pageNumber));
  }

  if (!rows.length) {
    const hasText = pageTexts.some((text) => text.trim().length > 20);
    throw new Error(hasText
      ? 'PDF memiliki teks, tetapi pola tabel Result belum dikenali. Periksa preview atau gunakan profil PDF lain.'
      : 'PDF tampaknya berupa scan/gambar. Jalankan OCR terlebih dahulu sebelum membandingkan.');
  }

  const duplicateNumbers = new Set();
  const seen = new Set();
  rows.forEach((row) => {
    if (seen.has(row.key)) duplicateNumbers.add(row.key);
    seen.add(row.key);
  });
  rows.forEach((row) => {
    if (duplicateNumbers.has(row.key)) {
      row.readable = false;
      row.parseIssue = `Nomor start #${row.number} muncul lebih dari satu kali di PDF.`;
    }
  });

  const combinedText = pageTexts.join(' ');
  const stageMatch = combinedText.match(/\bSS\s*([0-9]{1,2})\b/i);
  const unreadableCount = rows.filter((row) => !row.readable).length;

  return {
    fileName,
    profile: RESULT_PROFILE,
    pages: pdf.numPages,
    stageOrder: stageMatch ? Number(stageMatch[1]) : null,
    rows,
    unreadableCount,
    mapping: [
      { field: 'No Start', source: 'CAR NO', required: true },
      { field: 'Elapsed', source: 'STAGE TIME', required: true },
      { field: 'Penalty', source: 'PEN', required: false },
      { field: 'Total Time', source: 'TOTAL TIME', required: true },
      { field: 'Status', source: 'DNS/DNF/BWTM/DSQ jika tersedia', required: false },
    ],
  };
}

function parsePageRows(items, width, pageNumber) {
  const candidates = items.filter((item) => {
    const ratio = item.x / width;
    return ratio >= columnRanges.number[0]
      && ratio < columnRanges.number[1]
      && /^\d{1,3}$/.test(item.text);
  });

  return candidates.flatMap((candidate) => {
    const line = items
      .filter((item) => Math.abs(item.y - candidate.y) <= 1.5)
      .sort((a, b) => a.x - b.x);
    const stageRaw = columnText(line, width, columnRanges.stageTime);
    const penaltyRaw = columnText(line, width, columnRanges.penalty);
    const totalRaw = columnText(line, width, columnRanges.totalTime);
    const status = findStatus(line.filter((item) => item.x / width >= columnRanges.stageTime[0]).map((item) => item.text).join(' '));
    const position = positiveInteger(columnText(line, width, columnRanges.position));
    const entrant = columnText(line, width, columnRanges.entrant);
    const driver = columnText(line, width, columnRanges.driver);

    // Angka pada kolom CAR NO hanya dianggap baris peserta jika di sisi kanan
    // terdapat data result, atau di sisi kiri terdeteksi posisi dan identitas.
    if (!stageRaw && !penaltyRaw && !totalRaw && !status && !(position && (entrant || driver))) return [];

    const number = Number(candidate.text);
    const elapsedMs = parseDurationMs(stageRaw);
    const explicitPenaltyMs = parseDurationMs(penaltyRaw);
    const totalTimeMs = parseDurationMs(totalRaw);
    const derivedPenaltyMs = elapsedMs != null && totalTimeMs != null
      ? Math.max(0, totalTimeMs - elapsedMs)
      : null;
    const penaltyMs = explicitPenaltyMs ?? derivedPenaltyMs;
    const readable = Number.isInteger(number)
      && number > 0
      && (elapsedMs != null || totalTimeMs != null || Boolean(status));

    return [{
      key: String(number),
      number,
      runNo: 1,
      position,
      entrant,
      driver,
      navigator: columnText(line, width, columnRanges.navigator),
      className: columnText(line, width, columnRanges.className),
      vehicle: cleanText(`${columnText(line, width, columnRanges.car)} ${columnText(line, width, columnRanges.type)}`),
      elapsedMs,
      penaltyMs,
      totalTimeMs,
      status,
      readable,
      parseIssue: readable ? '' : `Waktu/status pada halaman ${pageNumber} tidak dapat dibaca.`,
      sourcePage: pageNumber,
      sourceRow: position || null,
      sourceKind: 'pdf',
      available: {
        tc: false,
        start: false,
        finish: false,
        elapsed: elapsedMs != null,
        penalty: penaltyMs != null,
        total: totalTimeMs != null,
        status: Boolean(status),
      },
    }];
  });
}

function columnText(items, width, [start, end]) {
  return cleanText(items
    .filter((item) => {
      const ratio = item.x / width;
      return ratio >= start && ratio < end;
    })
    .map((item) => item.text)
    .join(' '));
}

export function parseDurationMs(value) {
  const normalized = cleanText(value).replace(/^\+/, '');
  if (!normalized) return null;
  const parts = normalized.split(':');
  if (parts.length !== 2 && parts.length !== 3) return null;
  const secondsPart = parts.pop();
  const secondsMatch = secondsPart.match(/^(\d{1,2})(?:[.,](\d{1,3}))?$/);
  if (!secondsMatch) return null;
  const seconds = Number(secondsMatch[1]);
  const fraction = Number((secondsMatch[2] || '').padEnd(3, '0'));
  const minutes = Number(parts.pop());
  const hours = parts.length ? Number(parts.pop()) : 0;
  if (![hours, minutes, seconds, fraction].every(Number.isFinite) || minutes > 59 || seconds > 59) return null;
  return (((hours * 60 + minutes) * 60 + seconds) * 1000) + fraction;
}

function findStatus(value) {
  const match = String(value || '').toUpperCase().match(/\b(DNS|DNF|BWTM|DSQ|OK)\b/);
  return match?.[1] || '';
}

function positiveInteger(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

function cleanText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}
