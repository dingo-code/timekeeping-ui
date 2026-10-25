const RESULT_PROFILES = {
  stage: {
    kind: 'stage',
    label: 'Stage Result - positional table',
    ranges: {
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
    },
    mapping: [
      { field: 'No Start', source: 'CAR NO', required: true },
      { field: 'Elapsed', source: 'STAGE TIME', required: true },
      { field: 'Penalty', source: 'PEN', required: false },
      { field: 'Total Time', source: 'TOTAL TIME', required: true },
      { field: 'Status', source: 'DNS/DNF/BWTM/DSQ jika tersedia', required: false },
    ],
  },
  shakedown: {
    kind: 'shakedown',
    label: 'Shakedown Result - positional table',
    ranges: {
      position: [0.0, 0.05],
      number: [0.05, 0.09],
      entrant: [0.09, 0.33],
      driver: [0.33, 0.49],
      navigator: [0.49, 0.655],
      className: [0.655, 0.70],
      car: [0.735, 0.80],
      type: [0.80, 0.91],
      stageTime: [0.91, 1.0],
    },
    mapping: [
      { field: 'No Start', source: 'CAR NO', required: true },
      { field: 'Elapsed', source: 'STAGE TIME', required: true },
      { field: 'Status', source: 'DNS/DNF/BWTM/DSQ jika tersedia', required: false },
    ],
  },
};

export async function readBackupResultPdf(file, onProgress, stageOrderHint = null) {
  const pdfjs = await import('pdfjs-dist');
  const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc = `${worker.default}?v=20260926-1`;
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  return parseBackupResultPdfDocument(pdf, file.name, { enableOcr: true, onProgress, stageOrderHint });
}

export async function parseBackupResultPdfDocument(pdf, fileName = 'backup.pdf', options = {}) {
  const pages = [];
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
    pages.push({ items, width: viewport.width, pageNumber });
  }

  let combinedText = pageTexts.join(' ');
  let profile = detectGroupStageProfile(pages, combinedText)
    || (/\bSHAKEDOWN\b/i.test(combinedText) ? RESULT_PROFILES.shakedown : RESULT_PROFILES.stage);
  let rows = pages.flatMap((page) => parsePageRows(page.items, page.width, page.pageNumber, profile));
  let usedOcr = false;
  let ocrConfidence = null;

  if (!rows.length && options.enableOcr) {
    notifyProgress(options.onProgress, 'PDF berupa scan/gambar atau text layer tidak dapat dibaca. Menyiapkan OCR otomatis...');
    let ocrResult;
    try {
      const provider = options.ocrPageProvider || extractOcrPages;
      ocrResult = await provider(pdf, options.onProgress);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error || 'Kesalahan tidak diketahui.');
      throw new Error(
        `OCR otomatis gagal dijalankan: ${detail}`,
        { cause: error },
      );
    }

    const ocrPages = ocrResult.pages || [];
    combinedText = ocrPages.map((page) => page.items.map((item) => item.text).join(' ')).join(' ');
    profile = detectGroupStageProfile(ocrPages, combinedText)
      || detectOcrStageProfile(ocrPages, combinedText, fileName, options.stageOrderHint)
      || (/\bSHAKEDOWN\b/i.test(combinedText) ? RESULT_PROFILES.shakedown : RESULT_PROFILES.stage);
    rows = ocrPages.flatMap((page) => parsePageRows(page.items, page.width, page.pageNumber, profile));
    usedOcr = true;
    ocrConfidence = Number.isFinite(ocrResult.confidence) ? ocrResult.confidence : null;
  }

  if (!rows.length) {
    const hasText = pageTexts.some((text) => text.trim().length > 20);
    throw new Error(usedOcr
      ? 'OCR selesai, tetapi pola tabel Result belum dikenali. Pastikan gambar tegak, tajam, dan menggunakan format Result yang didukung.'
      : hasText
        ? 'PDF memiliki teks, tetapi pola tabel Result belum dikenali. Periksa preview atau gunakan profil PDF lain.'
        : 'PDF tampaknya berupa scan/gambar. OCR otomatis tidak tersedia pada perangkat ini.');
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

  const stageMatch = profile.kind === 'stage' ? combinedText.match(/\bSS\s*([0-9]{1,2})\b/i) : null;
  const unreadableCount = rows.filter((row) => !row.readable).length;

  return {
    fileName,
    profile: profile.label,
    resultType: profile.kind,
    isShakedown: profile.kind === 'shakedown',
    pages: pdf.numPages,
    stageOrder: profile.stageOrder || (stageMatch ? Number(stageMatch[1]) : null),
    rows,
    unreadableCount,
    mapping: profile.mapping,
    usedOcr,
    ocrConfidence,
  };
}

async function extractOcrPages(pdf, onProgress) {
  if (typeof document === 'undefined') throw new Error('Browser tidak menyediakan canvas untuk OCR.');

  const [tesseract, workerAsset, coreAsset, languageAsset] = await Promise.all([
    import('tesseract.js'),
    import('tesseract.js/dist/worker.min.js?url'),
    import('tesseract.js-core/tesseract-core-lstm.wasm.js?url'),
    import('@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz?url'),
  ]);
  const languageResponse = await fetch(languageAsset.default);
  if (!languageResponse.ok) {
    throw new Error(`Model bahasa OCR lokal gagal dimuat (HTTP ${languageResponse.status}).`);
  }
  const language = {
    code: 'eng',
    data: new Uint8Array(await languageResponse.arrayBuffer()),
  };
  const { createWorker, PSM } = tesseract;
  const scale = 2.5;
  let activePage = 0;
  const worker = await createWorker([language], 1, {
    workerPath: workerAsset.default,
    corePath: coreAsset.default,
    workerBlobURL: false,
    logger: (message) => {
      const progress = Math.round(Math.max(0, Math.min(1, Number(message.progress) || 0)) * 100);
      if (activePage) {
        notifyProgress(onProgress, `Menjalankan OCR halaman ${activePage}/${pdf.numPages} (${progress}%)...`);
      } else {
        notifyProgress(onProgress, `Menyiapkan mesin OCR (${progress}%)...`);
      }
    },
  });

  const pages = [];
  const confidences = [];
  try {
    await worker.setParameters({
      tessedit_pageseg_mode: PSM.AUTO,
      preserve_interword_spaces: '1',
      user_defined_dpi: String(Math.round(72 * scale)),
    });

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      activePage = pageNumber;
      notifyProgress(onProgress, `Menjalankan OCR halaman ${pageNumber}/${pdf.numPages} (0%)...`);
      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const context = canvas.getContext('2d', { alpha: false });
      if (!context) throw new Error('Canvas OCR tidak dapat dibuat.');
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: context, viewport }).promise;
      const { data } = await worker.recognize(canvas, {}, { blocks: true, text: true });
      const items = ocrBlocksToItems(data.blocks);
      pages.push({ items, width: canvas.width, pageNumber });
      if (Number.isFinite(data.confidence)) confidences.push(data.confidence);
      canvas.width = 0;
      canvas.height = 0;
    }
  } finally {
    await worker.terminate();
  }

  return {
    pages,
    confidence: confidences.length
      ? confidences.reduce((total, value) => total + value, 0) / confidences.length
      : null,
  };
}

function ocrBlocksToItems(blocks) {
  return (blocks || []).flatMap((block) => (block.paragraphs || []).flatMap((paragraph) => (
    (paragraph.lines || []).flatMap((line) => {
      const y = Number(line.bbox?.y0 || 0);
      return (line.words || []).flatMap((word) => {
        const text = cleanText(word.text);
        return text ? [{ text, x: Number(word.bbox?.x0 || 0), y }] : [];
      });
    })
  )));
}

function notifyProgress(callback, message) {
  if (typeof callback === 'function') callback(message);
}

function parsePageRows(items, width, pageNumber, profile) {
  const { ranges } = profile;
  const candidates = items.filter((item) => {
    const ratio = item.x / width;
    return ratio >= ranges.number[0]
      && ratio < ranges.number[1]
      && /^\d{1,3}$/.test(item.text);
  });

  return candidates.flatMap((candidate) => {
    const line = items
      .filter((item) => Math.abs(item.y - candidate.y) <= 1.5)
      .sort((a, b) => a.x - b.x);
    const stageRaw = columnText(line, width, ranges.stageTime);
    const penaltyRaw = ranges.penalty ? columnText(line, width, ranges.penalty) : '';
    const totalRaw = ranges.totalTime ? columnText(line, width, ranges.totalTime) : '';
    const status = findStatus(line.filter((item) => item.x / width >= ranges.stageTime[0]).map((item) => item.text).join(' '));
    const position = positiveInteger(columnText(line, width, ranges.position));
    const entrant = columnText(line, width, ranges.entrant);
    const driver = columnText(line, width, ranges.driver);

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
      navigator: columnText(line, width, ranges.navigator),
      className: columnText(line, width, ranges.className),
      vehicle: cleanText(`${columnText(line, width, ranges.car)} ${columnText(line, width, ranges.type)}`),
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
        penalty: profile.comparePenalty !== false && Boolean(ranges.penalty) && penaltyMs != null,
        total: profile.compareTotal !== false && Boolean(ranges.totalTime) && totalTimeMs != null,
        status: Boolean(status),
      },
    }];
  });
}

function detectGroupStageProfile(pages, combinedText) {
  if (!/\bGROUP\b/i.test(combinedText) || !/\bDIFF\b/i.test(combinedText)) return null;

  for (const page of pages) {
    const stageColumns = page.items
      .map((item) => {
        const match = item.text.match(/^SS\s*([0-9]{1,2})$/i);
        return match ? { order: Number(match[1]), x: item.x } : null;
      })
      .filter(Boolean)
      .sort((a, b) => a.x - b.x);
    if (!stageColumns.length) continue;

    const lastStageX = stageColumns.at(-1).x;
    const totalColumns = page.items
      .filter((item) => /^TOTAL$/i.test(item.text) && item.x > lastStageX)
      .sort((a, b) => a.x - b.x);
    if (totalColumns.length < 2) continue;

    const firstDiff = page.items
      .filter((item) => /^DIFF$/i.test(item.text) && item.x > totalColumns[1].x)
      .sort((a, b) => a.x - b.x)[0];
    const anchors = [
      ...stageColumns.map((column) => column.x),
      totalColumns[0].x,
      totalColumns[1].x,
      firstDiff?.x || page.width,
    ];
    const latestStage = stageColumns.reduce((latest, column, index) => (
      column.order > latest.order ? { ...column, index } : latest
    ), { order: 0, x: 0, index: 0 });
    const stageTime = anchorRange(anchors, latestStage.index, page.width);
    const penalty = anchorRange(anchors, stageColumns.length, page.width);
    const totalTime = anchorRange(anchors, stageColumns.length + 1, page.width);
    const firstStageStart = anchorRange(anchors, 0, page.width)[0];
    const isSingleStage = stageColumns.length === 1;

    return {
      kind: 'stage',
      label: 'Group Result - cumulative SS table',
      stageOrder: latestStage.order,
      comparePenalty: isSingleStage,
      compareTotal: isSingleStage,
      ranges: {
        position: [0, 0.04],
        number: [0.04, 0.08],
        entrant: [0.08, 0.32],
        driver: [0.32, 0.465],
        navigator: [0.465, firstStageStart],
        className: [0, 0],
        car: [0, 0],
        type: [0, 0],
        stageTime,
        penalty,
        totalTime,
      },
      mapping: [
        { field: 'No Start', source: 'CAR NO', required: true },
        { field: 'Elapsed', source: `SS${latestStage.order}`, required: true },
        { field: 'Penalty', source: isSingleStage ? 'TOTAL PENALTY' : 'TOTAL PENALTY kumulatif (referensi)', required: false },
        { field: 'Total Time', source: isSingleStage ? 'TOTAL TIME' : 'TOTAL TIME kumulatif (referensi)', required: false },
        { field: 'Status', source: 'DNS/DNF/BWTM/DSQ jika tersedia', required: false },
      ],
    };
  }

  return null;
}

function detectOcrStageProfile(pages, combinedText, fileName, stageOrderHint) {
  const stagePattern = /(?:^|[^A-Z0-9])SS[\s_-]*([0-9]{1,2})(?=$|[^0-9])/gi;
  const fileMatch = [...String(fileName || '').matchAll(stagePattern)][0];
  const textStages = [...String(combinedText || '').matchAll(stagePattern)].map((match) => Number(match[1]));
  const stageOrder = fileMatch
    ? Number(fileMatch[1])
    : positiveInteger(stageOrderHint) || (textStages.length ? Math.max(...textStages) : null);
  if (!stageOrder) return null;

  for (const page of pages) {
    const participantYs = page.items
      .filter((item) => item.x / page.width >= 0.035
        && item.x / page.width < 0.09
        && /^\d{1,3}$/.test(item.text))
      .map((item) => item.y);
    if (!participantYs.length) continue;

    const timeItems = page.items.filter((item) => (
      parseDurationMs(item.text) != null
      && participantYs.some((y) => Math.abs(y - item.y) <= 3)
    ));
    const timeColumns = clusterHorizontalPositions(timeItems, page.width * 0.025);
    const stageColumn = timeColumns[stageOrder - 1];
    if (!stageColumn) continue;

    const inferredRange = anchorRange(timeColumns.map((column) => column.x), stageOrder - 1, page.width);
    const stageTime = [
      Math.max(inferredRange[0], (stageColumn.x / page.width) - 0.025),
      inferredRange[1],
    ];
    return {
      kind: 'stage',
      label: 'Group Result - OCR scan',
      stageOrder,
      comparePenalty: false,
      compareTotal: false,
      ranges: {
        position: [0, 0.035],
        number: [0.035, 0.09],
        entrant: [0.09, 0.32],
        driver: [0.32, 0.49],
        navigator: [0.49, stageTime[0]],
        className: [0, 0],
        car: [0, 0],
        type: [0, 0],
        stageTime,
      },
      mapping: [
        { field: 'No Start', source: 'CAR NO (OCR)', required: true },
        { field: 'Elapsed', source: `SS${stageOrder} (OCR)`, required: true },
        { field: 'Status', source: 'DNS/DNF/BWTM/DSQ jika terbaca OCR', required: false },
      ],
    };
  }

  return null;
}

function clusterHorizontalPositions(items, tolerance) {
  const clusters = [];
  [...items].sort((a, b) => a.x - b.x).forEach((item) => {
    const cluster = clusters.find((entry) => Math.abs(entry.x - item.x) <= tolerance);
    if (cluster) {
      cluster.values.push(item.x);
      cluster.x = cluster.values.reduce((total, value) => total + value, 0) / cluster.values.length;
    } else {
      clusters.push({ x: item.x, values: [item.x] });
    }
  });
  return clusters.sort((a, b) => a.x - b.x);
}

function anchorRange(anchors, index, width) {
  const current = anchors[index];
  const previous = anchors[index - 1];
  const next = anchors[index + 1];
  const start = previous == null ? current - ((next - current) / 2) : (previous + current) / 2;
  const end = next == null ? width : (current + next) / 2;
  return [Math.max(0, start / width), Math.min(1, end / width)];
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
