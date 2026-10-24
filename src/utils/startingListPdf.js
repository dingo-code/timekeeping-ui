const ROW_ALIGNMENT_TOLERANCE = 2.5;
const DEFAULT_TIME_ALIGNMENT_TOLERANCE = 12;

export async function parseStartingListPDF(file) {
  installStartingListPDFCompatibility();
  const pdfjs = await import('pdfjs-dist');
  const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc = `${worker.default}?v=20261024-1`;
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const parsedRows = [];

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

    parsedRows.push(...parseStartingListPDFItems(items, viewport.width));
  }

  if (parsedRows.length === 0) {
    throw new Error('Format tabel PDF tidak dikenali. Kolom urutan dan CAR NO tidak ditemukan.');
  }
  return parsedRows;
}

export function parseStartingListPDFItems(items, viewportWidth) {
  const orderItems = items
    .filter((item) => item.x < viewportWidth * 0.04 && /^\d+$/.test(item.text) && item.y > 35)
    .sort((a, b) => b.y - a.y);
  const targetTimeItems = items.filter((item) => (
    item.x >= viewportWidth * 0.9 && /^\d{1,2}[:.,]\d{2}(?:[:.,]\d{2})?$/.test(item.text)
  ));
  const timeTolerance = calculateTimeAlignmentTolerance(orderItems);

  return orderItems.flatMap((orderItem) => {
    const rowItems = items.filter((item) => Math.abs(item.y - orderItem.y) <= ROW_ALIGNMENT_TOLERANCE);
    const carNumberItem = rowItems.find((item) => (
      item.x >= viewportWidth * 0.04 &&
      item.x < viewportWidth * 0.09 &&
      /^\d+$/.test(item.text)
    ));
    if (!carNumberItem) return [];

    const targetTimeItem = targetTimeItems
      .map((item) => ({ item, distance: Math.abs(item.y - orderItem.y) }))
      .filter(({ distance }) => distance <= timeTolerance)
      .sort((a, b) => a.distance - b.distance)[0]?.item;

    return [{
      '*': orderItem.text,
      'CAR NO': carNumberItem.text,
      'TC TIME': targetTimeItem?.text || '',
    }];
  });
}

function calculateTimeAlignmentTolerance(orderItems) {
  if (orderItems.length < 2) return DEFAULT_TIME_ALIGNMENT_TOLERANCE;
  const gaps = orderItems
    .slice(1)
    .map((item, index) => Math.abs(orderItems[index].y - item.y))
    .filter((gap) => gap > ROW_ALIGNMENT_TOLERANCE)
    .sort((a, b) => a - b);
  if (gaps.length === 0) return DEFAULT_TIME_ALIGNMENT_TOLERANCE;

  const middle = Math.floor(gaps.length / 2);
  const medianGap = gaps.length % 2 === 0
    ? (gaps[middle - 1] + gaps[middle]) / 2
    : gaps[middle];
  return Math.max(ROW_ALIGNMENT_TOLERANCE, Math.min(DEFAULT_TIME_ALIGNMENT_TOLERANCE, medianGap * 0.7));
}

function installStartingListPDFCompatibility() {
  if (!Promise.withResolvers) {
    Promise.withResolvers = () => {
      let resolve;
      let reject;
      const promise = new Promise((resolvePromise, rejectPromise) => {
        resolve = resolvePromise;
        reject = rejectPromise;
      });
      return { promise, resolve, reject };
    };
  }
  if (!Array.prototype.at) {
    Object.defineProperty(Array.prototype, 'at', {
      configurable: true,
      writable: true,
      value(index) {
        const position = Number(index);
        return this[position < 0 ? this.length + position : position];
      },
    });
  }
  if (!String.prototype.at) {
    Object.defineProperty(String.prototype, 'at', {
      configurable: true,
      writable: true,
      value(index) {
        const position = Number(index);
        return this[position < 0 ? this.length + position : position];
      },
    });
  }
}

function cleanText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}
