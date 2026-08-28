import { paperDimensions, paperSizeOptions, printWidthScale } from '../utils/printLayout';

export function PrintLayoutStyle({ paperSize, orientation, marginMm = 5, children = '' }) {
  const { width, height } = paperDimensions(paperSize, orientation);
  const scale = printWidthScale(paperSize, orientation, marginMm);
  const fontSize = Math.max(5.1, 7 * scale);
  const cellX = Math.max(1.2, 3 * scale);
  const cellY = Math.max(1, 2.2 * scale);
  const headerHeight = Math.max(52, 72 * scale);
  const logoWidth = Math.max(68, 120 * scale);
  const metaWidth = Math.max(80, 132 * scale);

  return <style>{`
    .uniform-result-table tbody td { font-size: 11px !important; line-height: 1.15 !important; font-weight: 500 !important; }
    .uniform-result-table thead th { text-align: center !important; }
    @media print {
      @page { size: ${width}mm ${height}mm; margin: ${marginMm}mm; }
      * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
      html, body { width: 100% !important; min-width: 0 !important; }
      body { margin: 0 !important; background: #fff !important; }
      aside, header, .no-print { display: none !important; }
      main, main > div { display: block !important; padding: 0 !important; background: #fff !important; }
      .print-page, .print-panel { width: 100% !important; max-width: none !important; box-sizing: border-box !important; border: 0 !important; border-radius: 0 !important; box-shadow: none !important; padding: 0 !important; }
      .print-table-wrap { width: 100% !important; max-width: none !important; overflow: visible !important; }
      .print-header { break-after: avoid !important; page-break-after: avoid !important; margin-bottom: ${Math.max(4, 7 * scale)}px !important; padding-bottom: ${Math.max(4, 7 * scale)}px !important; }
      .print-header-grid { grid-template-columns: ${logoWidth}px minmax(0, 1fr) ${metaWidth}px !important; min-height: ${headerHeight}px !important; gap: ${Math.max(4, 6 * scale)}px !important; }
      .print-logo-box, .print-meta-box { height: ${headerHeight}px !important; min-height: 0 !important; }
      .print-logo-img { max-height: ${headerHeight}px !important; }
      .print-title { font-size: ${Math.max(11, 16 * scale)}px !important; line-height: 1.05 !important; }
      .print-subtitle { margin-top: ${Math.max(1, 2 * scale)}px !important; font-size: ${Math.max(6.3, 9 * scale)}px !important; line-height: 1.1 !important; }
      .print-status { border-width: 1px !important; padding: ${Math.max(2, 3 * scale)}px ${Math.max(4, 8 * scale)}px !important; font-size: ${Math.max(6.3, 9 * scale)}px !important; line-height: 1.05 !important; }
      .print-date { font-size: ${Math.max(5.3, 8 * scale)}px !important; line-height: 1.05 !important; }
      .print-group { break-inside: auto !important; page-break-inside: auto !important; margin-bottom: ${Math.max(5, 7 * scale)}px !important; }
      .print-group-title { break-after: avoid !important; page-break-after: avoid !important; margin-bottom: ${Math.max(2, 3 * scale)}px !important; }
      .print-group-title h2 { font-size: ${Math.max(8, 12 * scale)}px !important; line-height: 1.05 !important; }
      .print-group-title span { font-size: ${Math.max(5.5, 8 * scale)}px !important; }
      table { width: 100% !important; max-width: 100% !important; table-layout: fixed !important; border-spacing: 0 !important; page-break-inside: auto !important; }
      th, td { box-sizing: border-box !important; padding: ${cellY}px ${cellX}px !important; overflow: hidden !important; overflow-wrap: anywhere !important; word-break: normal !important; vertical-align: top !important; font-size: ${fontSize}px !important; line-height: 1.12 !important; font-weight: 500 !important; }
      tbody td { background-color: #fff !important; }
      thead th { background-color: #cbd5e1 !important; font-weight: 800 !important; text-align: center !important; }
      thead { display: table-header-group !important; }
      tfoot { display: table-footer-group !important; }
      tr, td, th { break-inside: avoid !important; page-break-inside: avoid !important; }
      tr { page-break-after: auto !important; }
      .print-driver-name, .print-codriver-name { font-size: ${fontSize}px !important; line-height: 1.12 !important; }
      ${children}
    }
  `}</style>;
}

export function PaperSizeField({ value, onChange, className = '' }) {
  return (
    <label className={className}>
      <span className="mb-1 block text-xs font-bold text-gray-500">Ukuran Kertas</span>
      <select className="min-w-0 max-w-full w-full rounded-lg border border-gray-300 bg-white p-3 text-sm font-bold outline-none focus:ring-1 focus:ring-red-500" value={value} onChange={(event) => onChange(event.target.value)}>
        {paperSizeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  );
}

export function OrientationField({ value, onChange, className = '' }) {
  return (
    <label className={className}>
      <span className="mb-1 block text-xs font-bold text-gray-500">Orientasi Kertas</span>
      <select className="min-w-0 max-w-full w-full rounded-lg border border-gray-300 bg-white p-3 text-sm font-bold outline-none focus:ring-1 focus:ring-red-500" value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="portrait">Portrait</option>
        <option value="landscape">Landscape</option>
      </select>
    </label>
  );
}
