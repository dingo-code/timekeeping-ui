const PDF_ROW_Y_TOLERANCE = 1.5;
const PDF_TEMPLATE_WIDTH = 595.92;

export async function parseEntryListPDF(file) {
  installPDFCompatibility();

  const pdfjs = await import('pdfjs-dist');
  const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc = `${worker.default}?v=20261023-1`;

  const pdf = await pdfjs.getDocument({
    data: new Uint8Array(await file.arrayBuffer()),
  }).promise;
  return parseEntryListPDFDocument(pdf);
}

export async function parseEntryListPDFDocument(pdf) {
  const rows = [];
  let readableTextItems = 0;

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    readableTextItems += content.items.filter((item) => cleanText(item.str)).length;
    rows.push(...parseEntryListPDFItems(content.items, page.getViewport({ scale: 1 }).width, pageNumber));
  }

  if (rows.length === 0 && readableTextItems === 0) {
    throw new Error('PDF tidak memiliki teks yang dapat dibaca. Gunakan PDF asli dari Excel/Google Sheets, bukan hasil scan atau foto.');
  }
  if (rows.length === 0) {
    throw new Error('Struktur tabel PDF belum dikenali. Kolom yang didukung: CAR NO, ENTRANT, DRIVER, REG, NAVIGATOR, REG, GRP, CAT, CAR, dan TYPE.');
  }

  return rows.map((row, index) => ({ ...row, entryOrder: row.entryOrder || index + 1 }));
}

export function parseEntryListPDFItems(items, viewportWidth = PDF_TEMPLATE_WIDTH, pageNumber = 1) {
  const lines = [];
  const scale = PDF_TEMPLATE_WIDTH / (Number(viewportWidth) || PDF_TEMPLATE_WIDTH);
  const rows = [];

  items.forEach((item) => {
    const value = cleanText(item.str);
    if (!value) return;

    const y = item.transform[5] * scale;
    let line = lines.find((candidate) => Math.abs(candidate.y - y) <= PDF_ROW_Y_TOLERANCE);
    if (!line) {
      line = { y, items: [] };
      lines.push(line);
    }
    line.items.push({
      value,
      x: item.transform[4] * scale,
      right: (item.transform[4] + Number(item.width || 0)) * scale,
    });
  });

  lines
    .sort((left, right) => right.y - left.y)
    .forEach(({ items }) => {
      const columns = {};
      items
        .sort((left, right) => left.x - right.x)
        .forEach((item) => {
          const key = columnForX(item.x);
          if (!key) return;
          if (!columns[key]) {
            columns[key] = { value: item.value, right: item.right };
            return;
          }
          columns[key].value = `${columns[key].value} ${item.value}`;
          columns[key].right = Math.max(columns[key].right, item.right);
        });

      const row = {
        participantId: '',
        entryOrder: positiveInteger(columnValue(columns, 'entryOrder')),
        startNumber: positiveInteger(columnValue(columns, 'startNumber')),
        entrant: columnValue(columns, 'entrant'),
        driver: columnValue(columns, 'driver'),
        driverRegion: columnValue(columns, 'driverRegion'),
        navigator: columnValue(columns, 'navigator'),
        navigatorRegion: columnValue(columns, 'navigatorRegion'),
        classCode: columnValue(columns, 'classCode'),
        categoryCode: columnValue(columns, 'categoryCode'),
        car: columnValue(columns, 'car'),
        type: columnValue(columns, 'type'),
        sourcePage: pageNumber,
      };

      splitMergedRegion(row, columns, 'driver', 'driverRegion', 295);
      splitMergedRegion(row, columns, 'navigator', 'navigatorRegion', 411);
      splitMergedVehicle(row);

      if (isEntryListRow(row)) rows.push(row);
    });
  return rows;
}

export function entryListPDFRowsToImportRows(rows) {
  return rows.map((row) => ({
    'NO URUT': row.entryOrder,
    'NO START': row.startNumber,
    'ENTRANT': row.entrant,
    'TEAM': row.entrant,
    'DRIVER': row.driver,
    'DRIVER REGION': row.driverRegion,
    'NAVIGATOR': row.navigator,
    'NAVIGATOR REGION': row.navigatorRegion,
    'CLASS': row.classCode,
    'GROUP': row.classCode,
    'CATEGORY': row.categoryCode,
    'BRAND': row.car,
    'TYPE': row.type,
  }));
}

function columnForX(x) {
  if (x >= 0 && x < 25) return 'entryOrder';
  if (x >= 25 && x < 50) return 'startNumber';
  if (x >= 50 && x < 190) return 'entrant';
  if (x >= 190 && x < 280) return 'driver';
  if (x >= 280 && x < 315) return 'driverRegion';
  if (x >= 315 && x < 395) return 'navigator';
  // Centered codes have different left edges: RC4 starts left of R1.
  // The CAR data also starts left of its centered heading in the PUT5 PDF.
  if (x >= 395 && x < 425) return 'navigatorRegion';
  if (x >= 425 && x < 455) return 'classCode';
  if (x >= 455 && x < 480) return 'categoryCode';
  if (x >= 480 && x < 525) return 'car';
  if (x >= 525) return 'type';
  return '';
}

function isEntryListRow(row) {
  return row.startNumber > 0
    && Boolean(row.driver)
    && Boolean(row.navigator)
    && Boolean(row.classCode)
    && Boolean(row.categoryCode);
}

function columnValue(columns, key) {
  return columns[key]?.value || '';
}

function splitMergedRegion(row, columns, nameKey, regionKey, regionStartX) {
  if (row[regionKey] || Number(columns[nameKey]?.right || 0) < regionStartX) return;
  const match = row[nameKey].match(/^(.*?)\s+([A-Z]{2,4})$/);
  if (!match) return;
  row[nameKey] = match[1];
  row[regionKey] = match[2];
}

function splitMergedVehicle(row) {
  if (row.type || !row.car.includes(' ')) return;
  if (/^(Land Rover|Alfa Romeo|Aston Martin|Mercedes Benz)$/i.test(row.car)) return;
  // PDF.js can combine adjacent CAR/TYPE cells into one text item.
  const match = row.car.match(/^(Land Rover|Alfa Romeo|Aston Martin|Mercedes Benz|\S+)\s+(.+)$/i);
  if (!match) return;
  row.car = match[1];
  row.type = match[2];
}

function cleanText(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function positiveInteger(value) {
  const parsed = Number(String(value || '').trim());
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 0;
}

function installPDFCompatibility() {
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
