const PDF_ROW_Y_TOLERANCE = 1.5;

export async function parseEntryListPDF(file) {
  installPDFCompatibility();

  const pdfjs = await import('pdfjs-dist');
  const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc = `${worker.default}?v=20261023-1`;

  const pdf = await pdfjs.getDocument({
    data: new Uint8Array(await file.arrayBuffer()),
  }).promise;
  const rows = [];
  let readableTextItems = 0;

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const lines = [];

    content.items.forEach((item) => {
      const value = cleanText(item.str);
      if (!value) return;
      readableTextItems += 1;

      const y = item.transform[5];
      let line = lines.find((candidate) => Math.abs(candidate.y - y) <= PDF_ROW_Y_TOLERANCE);
      if (!line) {
        line = { y, items: [] };
        lines.push(line);
      }
      line.items.push({
        value,
        x: item.transform[4],
        right: item.transform[4] + Number(item.width || 0),
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

        if (isEntryListRow(row)) rows.push(row);
      });
  }

  if (rows.length === 0 && readableTextItems === 0) {
    throw new Error('PDF tidak memiliki teks yang dapat dibaca. Gunakan PDF asli dari Excel/Google Sheets, bukan hasil scan atau foto.');
  }
  if (rows.length === 0) {
    throw new Error('Struktur tabel PDF belum dikenali. Kolom yang didukung: CAR NO, ENTRANT, DRIVER, REG, NAVIGATOR, REG, GRP, CAT, CAR, dan TYPE.');
  }

  return rows;
}

export function entryListPDFRowsToImportRows(rows) {
  return rows.map((row) => ({
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
  if (x >= 25 && x < 50) return 'startNumber';
  if (x >= 50 && x < 190) return 'entrant';
  if (x >= 190 && x < 280) return 'driver';
  if (x >= 280 && x < 315) return 'driverRegion';
  if (x >= 315 && x < 395) return 'navigator';
  if (x >= 395 && x < 435) return 'navigatorRegion';
  if (x >= 435 && x < 465) return 'classCode';
  if (x >= 465 && x < 490) return 'categoryCode';
  if (x >= 490 && x < 525) return 'car';
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
