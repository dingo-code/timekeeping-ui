import test from 'node:test';
import assert from 'node:assert/strict';
import { entryListPDFRowsToImportRows, parseEntryListPDFDocument, parseEntryListPDFItems } from './entryListPdf.js';

// Coordinates and text grouping from the PUT5-26 entry-list PDF.
function entryItems({ number = 23, order = 105, classCode = 'RC4', category = 'NS', car = 'Peugeot', type = '208 Rally4', mergedCar = false } = {}) {
  return [
    item(String(order), 9.47, 518.91),
    item(String(number), 32.06, 517.70),
    item('PUTKAR REBORN', 53.39, 518.30),
    item('Alfonso Marcell', 193.53, 517.70),
    item('JTG', 285.75, 517.70),
    item('Auddy RG', 317.30, 517.70),
    item('JTG', 402.23, 517.70),
    item(classCode, classCode.startsWith('RC') ? 433.28 : 436.20, 517.70),
    item(category, 465.48, 517.70),
    item(mergedCar ? `${car} ${type}` : car, 484.74, 517.70),
    ...(!mergedCar ? [item(type, 525.39, 517.70)] : []),
  ];
}

test('retains all eleven RC4, RC3 and RC2 entries from the final section', () => {
  const numbers = [23, 21, 20, 19, 18, 17, 16, 15, 11, 73, 1];
  const items = numbers.flatMap((number, index) => entryItems({
    number, classCode: index < 4 ? 'RC4' : index < 7 ? 'RC3' : 'RC2',
  }).map((entry) => ({ ...entry, transform: [1, 0, 0, 1, entry.transform[4], entry.transform[5] - index * 16.38] })));

  const rows = parseEntryListPDFItems(items, 595.92, 3);
  assert.deepEqual(rows.map((row) => row.startNumber), numbers);
  assert.deepEqual(rows.map((row) => row.classCode), ['RC4', 'RC4', 'RC4', 'RC4', 'RC3', 'RC3', 'RC3', 'RC2', 'RC2', 'RC2', 'RC2']);
  assert.ok(rows.every((row) => row.categoryCode === 'NS' && row.car === 'Peugeot' && row.sourcePage === 3));
});

test('keeps the category separate from the car brand for the PUT5 layout', () => {
  const [row] = parseEntryListPDFItems(entryItems({ classCode: 'R1', car: 'Toyota', type: 'Corolla DX' }));
  assert.equal(row.categoryCode, 'NS');
  assert.equal(row.car, 'Toyota');
  assert.equal(row.type, 'Corolla DX');
  assert.equal(row.navigatorRegion, 'JTG');
  assert.equal(row.entryOrder, 105);
  assert.equal(entryListPDFRowsToImportRows([row])[0]['NO URUT'], 105);
});

test('splits adjacent vehicle cells combined into one PDF text item', () => {
  const [row] = parseEntryListPDFItems(entryItems({ classCode: 'F2', car: 'Mitsubishi', type: 'Lancer GLXi', mergedCar: true }));
  assert.equal(row.car, 'Mitsubishi');
  assert.equal(row.type, 'Lancer GLXi');
  assert.equal(row.categoryCode, 'NS');
});

test('does not split a multi-word brand when its model is empty', () => {
  const [row] = parseEntryListPDFItems(entryItems({ car: 'Land Rover', type: '' }));
  assert.equal(row.car, 'Land Rover');
  assert.equal(row.type, '');
});

test('retains the previous layout and scaled pages', () => {
  const items = entryItems().map((entry) => {
    const x = entry.transform[4] === 433.28 ? 440 : entry.transform[4] === 484.74 ? 495 : entry.transform[4];
    return { ...entry, transform: [1, 0, 0, 1, x * 2, entry.transform[5] * 2], width: entry.width * 2 };
  });
  const [row] = parseEntryListPDFItems(items, 595.92 * 2);
  assert.equal(row.startNumber, 23);
  assert.equal(row.classCode, 'RC4');
  assert.equal(row.categoryCode, 'NS');
  assert.equal(row.car, 'Peugeot');
});

test('reads subsequent pages even when they do not repeat the heading', async () => {
  const pages = [entryItems({ number: 129, order: 1, classCode: 'R1' }), entryItems({ order: 42 })];
  const rows = await parseEntryListPDFDocument({
    numPages: pages.length,
    getPage: async (number) => ({
      getTextContent: async () => ({ items: pages[number - 1] }),
      getViewport: () => ({ width: 595.92 }),
    }),
  });
  assert.deepEqual(rows.map((row) => [row.startNumber, row.sourcePage]), [[129, 1], [23, 2]]);
  assert.deepEqual(rows.map((row) => row.entryOrder), [1, 42]);
});

test('falls back to continuous file order across pages without a sequence column', async () => {
  const rows = await parseEntryListPDFDocument({
    numPages: 2,
    getPage: async (number) => ({
      getTextContent: async () => ({ items: entryItems({ number: number === 1 ? 129 : 23 }).filter((entry) => entry.transform[4] >= 25) }),
      getViewport: () => ({ width: 595.92 }),
    }),
  });
  assert.deepEqual(rows.map((row) => row.entryOrder), [1, 2]);
});

test('distinguishes scanned PDFs from unsupported text layouts', async () => {
  const document = (items) => ({ numPages: 1, getPage: async () => ({
    getTextContent: async () => ({ items }), getViewport: () => ({ width: 595.92 }),
  }) });
  await assert.rejects(parseEntryListPDFDocument(document([])), /tidak memiliki teks/);
  await assert.rejects(parseEntryListPDFDocument(document([item('Other layout', 10, 100)])), /Struktur tabel/);
});

function item(str, x, y) {
  return { str, width: str.length * 4, transform: [1, 0, 0, 1, x, y] };
}
