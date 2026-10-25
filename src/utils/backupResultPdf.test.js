import test from 'node:test';
import assert from 'node:assert/strict';
import { filterWebRowsForBackupPdf, parseBackupResultPdfDocument } from './backupResultPdf.js';

const PAGE_WIDTH = 596;

test('reads single-stage group result columns', async () => {
  const result = await parseBackupResultPdfDocument(fakePdf([
    item('GROUP : G1', 223, 780),
    item('DIFF', 515, 747),
    item('SS1', 395, 741),
    item('TOTAL', 432, 746),
    item('TOTAL', 467, 747),
    ...resultRow({ y: 721, position: 1, number: 75, driver: 'Adil Prakoso', navigator: 'Karmela', times: [
      ['4:32.04', 390], ['0:00', 433], ['4:32.04', 466],
    ] }),
  ]), 'G1_SPO_SS1_PUT4.pdf');

  assert.equal(result.profile, 'Group Result - cumulative SS table');
  assert.equal(result.stageOrder, 1);
  assert.equal(result.groupName, 'G1');
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0].number, 75);
  assert.equal(result.rows[0].elapsedMs, 272040);
  assert.equal(result.rows[0].penaltyMs, 0);
  assert.equal(result.rows[0].totalTimeMs, 272040);
  assert.equal(result.rows[0].available.penalty, true);
  assert.equal(result.rows[0].available.total, true);
});

test('uses latest SS column and ignores cumulative totals for multi-stage group result', async () => {
  const result = await parseBackupResultPdfDocument(fakePdf([
    item('GROUP : G1', 210, 782),
    item('DIFF', 520, 751),
    item('SS1', 369, 746),
    item('SS2', 407, 746),
    item('TOTAL', 442, 750),
    item('TOTAL', 475, 751),
    ...resultRow({ y: 727, position: 1, number: 75, driver: 'Adil Prakoso', navigator: 'Karmela', times: [
      ['4:32.04', 365], ['4:34.82', 403], ['0:00', 443], ['9:06.86', 474],
    ] }),
  ]), 'G1_SPO_SS2_PUT4.pdf');

  assert.equal(result.stageOrder, 2);
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0].elapsedMs, 274820);
  assert.equal(result.rows[0].penaltyMs, 0);
  assert.equal(result.rows[0].totalTimeMs, 546860);
  assert.equal(result.rows[0].available.elapsed, true);
  assert.equal(result.rows[0].available.penalty, false);
  assert.equal(result.rows[0].available.total, false);
  assert.match(result.mapping.find((entry) => entry.field === 'Elapsed').source, /SS2/);
});

test('limits group result comparison to web rows from the detected PDF group', () => {
  const rows = filterWebRowsForBackupPdf([
    { number: 75, groupName: 'G1' },
    { number: 35, groupName: 'g1' },
    { number: 93, groupName: 'G2' },
  ], { groupName: 'G1' });

  assert.deepEqual(rows.map((row) => row.number), [75, 35]);
});

test('keeps all web rows when the PDF has no detected group scope', () => {
  const rows = [{ number: 75, groupName: 'G1' }, { number: 93, groupName: 'G2' }];
  assert.equal(filterWebRowsForBackupPdf(rows, { groupName: '' }), rows);
});

test('infers SS and shifted car-number columns from OCR rows without table headers', async () => {
  const progress = [];
  const result = await parseBackupResultPdfDocument(fakePdf([]), 'scan-result.pdf', {
    enableOcr: true,
    stageOrderHint: 1,
    onProgress: (message) => progress.push(message),
    ocrPageProvider: async () => ({
      confidence: 91.4,
      pages: [{
        pageNumber: 1,
        width: PAGE_WIDTH,
        items: [
          item('1', 16, 721),
          item('75', 58, 721),
          item('TEAM', 82, 721),
          item('Adil Prakoso', 194, 721),
          item('Karmela', 278, 721),
          item('4:32.04', 390, 721),
          item('0:00', 433, 721),
          item('4:32.04', 466, 721),
        ].map(toParsedItem),
      }],
    }),
  });

  assert.equal(result.usedOcr, true);
  assert.equal(result.ocrConfidence, 91.4);
  assert.equal(result.profile, 'Group Result - visual OCR');
  assert.equal(result.stageOrder, 1);
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0].number, 75);
  assert.equal(result.rows[0].elapsedMs, 272040);
  assert.equal(result.rows[0].available.penalty, false);
  assert.equal(result.rows[0].available.total, false);
  assert.match(progress[0], /pembacaan visual otomatis/);
});

function fakePdf(items) {
  return {
    numPages: 1,
    async getPage() {
      return {
        getViewport: () => ({ width: PAGE_WIDTH }),
        getTextContent: async () => ({ items }),
      };
    },
  };
}

function resultRow({ y, position, number, driver, navigator, times }) {
  return [
    item(String(position), 16, y),
    item(String(number), 34, y),
    item('TEAM', 52, y),
    item(driver, 194, y),
    item(navigator, 278, y),
    ...times.map(([text, x]) => item(text, x, y)),
  ];
}

function item(str, x, y) {
  return { str, transform: [1, 0, 0, 1, x, y] };
}

function toParsedItem(value) {
  return { text: value.str, x: value.transform[4], y: value.transform[5] };
}
