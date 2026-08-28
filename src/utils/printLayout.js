const PAPER_SIZES = {
  a5: { label: 'A5', width: 148, height: 210 },
  a4: { label: 'A4', width: 210, height: 297 },
  a3: { label: 'A3', width: 297, height: 420 },
  letter: { label: 'Letter', width: 216, height: 279 },
  legal: { label: 'Legal', width: 216, height: 356 },
  f4: { label: 'F4 / Folio', width: 210, height: 330 },
};

export const paperSizeOptions = Object.entries(PAPER_SIZES).map(([value, paper]) => ({ value, label: paper.label }));

export function normalizePaperSize(value) {
  return PAPER_SIZES[value] ? value : 'a4';
}

export function paperDimensions(paperSize, orientation) {
  const paper = PAPER_SIZES[normalizePaperSize(paperSize)];
  return orientation === 'landscape'
    ? { width: paper.height, height: paper.width }
    : { width: paper.width, height: paper.height };
}

export function printWidthScale(paperSize, orientation, marginMm = 5) {
  const { width } = paperDimensions(paperSize, orientation);
  return Math.max(0.52, Math.min(1.35, (width - (marginMm * 2)) / 287));
}
