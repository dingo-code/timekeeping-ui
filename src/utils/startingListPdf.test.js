import test from 'node:test';
import assert from 'node:assert/strict';
import { parseStartingListPDFItems } from './startingListPdf.js';

test('assigns a merged TC time to both adjacent participant rows', () => {
  const items = [
    { text: '1', x: 13, y: 740 },
    { text: '75', x: 31, y: 740 },
    { text: '8:00', x: 550, y: 732 },
    { text: '2', x: 13, y: 724 },
    { text: '35', x: 31, y: 724 },
  ];

  assert.deepEqual(parseStartingListPDFItems(items, 596), [
    { '*': '1', 'CAR NO': '75', 'TC TIME': '8:00' },
    { '*': '2', 'CAR NO': '35', 'TC TIME': '8:00' },
  ]);
});

test('does not copy a TC time across a larger separator gap', () => {
  const items = [
    { text: '7', x: 13, y: 648 },
    { text: '37', x: 31, y: 648 },
    { text: '8:12', x: 550, y: 640 },
    { text: '8', x: 13, y: 616 },
    { text: '93', x: 31, y: 616 },
    { text: '8:16', x: 550, y: 608 },
    { text: '9', x: 13, y: 600 },
    { text: '15', x: 31, y: 600 },
  ];

  assert.deepEqual(parseStartingListPDFItems(items, 596), [
    { '*': '7', 'CAR NO': '37', 'TC TIME': '8:12' },
    { '*': '8', 'CAR NO': '93', 'TC TIME': '8:16' },
    { '*': '9', 'CAR NO': '15', 'TC TIME': '8:16' },
  ]);
});

test('keeps supporting TC times aligned on the same row', () => {
  const items = [
    { text: '1', x: 13, y: 740 },
    { text: '75', x: 31, y: 740 },
    { text: '08:00:00', x: 550, y: 740 },
  ];

  assert.deepEqual(parseStartingListPDFItems(items, 596), [
    { '*': '1', 'CAR NO': '75', 'TC TIME': '08:00:00' },
  ]);
});
