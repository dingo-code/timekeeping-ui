import { paperDimensions } from './printLayout';

const cleanText = (value) => String(value || '').replace(/\s+/g, ' ').trim();

export async function generateReportPdfFromElement({ element, paperSize, orientation, fileName }) {
  if (!element) throw new Error('Konten laporan tidak ditemukan.');

  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);

  const dimensions = paperDimensions(paperSize, orientation);
  const doc = new jsPDF({
    orientation,
    unit: 'mm',
    format: [Math.min(dimensions.width, dimensions.height), Math.max(dimensions.width, dimensions.height)],
    compress: true,
  });
  const margin = 5;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const compact = pageWidth < 205;
  const headerHeight = compact ? 25 : 30;
  const title = cleanText(element.querySelector('.print-title')?.textContent) || 'Result';
  const subtitles = Array.from(element.querySelectorAll('.print-subtitle'))
    .map((node) => cleanText(node.textContent))
    .filter(Boolean);
  const status = cleanText(element.querySelector('.print-status')?.textContent);
  const printDate = cleanText(element.querySelector('.print-date')?.textContent);
  const logoUrl = element.querySelector('.print-logo-img')?.src;
  const logo = logoUrl ? await loadImageData(logoUrl) : null;
  const drawnHeaderPages = new Set();

  const drawHeader = () => {
    const pageNumber = doc.internal.getCurrentPageInfo().pageNumber;
    if (drawnHeaderPages.has(pageNumber)) return;
    drawnHeaderPages.add(pageNumber);
    if (logo) doc.addImage(logo.data, logo.format, margin, margin, compact ? 24 : 30, compact ? 14 : 18, undefined, 'FAST');
    const centerX = pageWidth / 2;
    doc.setTextColor(17, 24, 39);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(compact ? 10 : 13);
    doc.text(title.toUpperCase(), centerX, margin + 4, { align: 'center', maxWidth: pageWidth * 0.48 });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(compact ? 5.5 : 7);
    subtitles.slice(0, 4).forEach((line, index) => doc.text(line, centerX, margin + 8 + (index * 3), { align: 'center', maxWidth: pageWidth * 0.52 }));
    if (status) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(compact ? 6 : 7.5);
      doc.text(status, pageWidth - margin, margin + 5, { align: 'right', maxWidth: compact ? 35 : 48 });
    }
    if (printDate) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(compact ? 4.8 : 6);
      doc.text(printDate, pageWidth - margin, margin + 14, { align: 'right', maxWidth: compact ? 38 : 52 });
    }
    doc.setDrawColor(156, 163, 175);
    doc.line(margin, headerHeight, pageWidth - margin, headerHeight);
  };

  drawHeader();
  let cursorY = headerHeight + 4;
  const tables = Array.from(element.querySelectorAll('table'));
  if (!tables.length) throw new Error('Tabel laporan belum tersedia.');

  for (const table of tables) {
    const section = table.closest('.print-group');
    const sectionTitle = cleanText(section?.querySelector('.print-group-title h2, h2')?.textContent);
    if (sectionTitle) {
      if (cursorY > pageHeight - 22) {
        doc.addPage();
        drawHeader();
        cursorY = headerHeight + 4;
      }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(compact ? 7 : 9);
      doc.text(sectionTitle.toUpperCase(), margin, cursorY);
      cursorY += 3;
    }

    const head = [Array.from(table.querySelectorAll('thead th')).map((cell) => cleanText(cell.textContent))];
    const body = Array.from(table.querySelectorAll('tbody tr')).map((row) =>
      Array.from(row.querySelectorAll('td')).map((cell) => cleanText(cell.textContent))
    );
    if (!head[0].length || !body.length) continue;

    autoTable(doc, {
      head,
      body,
      startY: cursorY,
      margin: { top: headerHeight + 4, right: margin, bottom: 9, left: margin },
      theme: 'grid',
      showHead: 'everyPage',
      rowPageBreak: 'avoid',
      styles: {
        font: 'helvetica',
        fontSize: compact ? 4.3 : 5.8,
        cellPadding: compact ? 0.65 : 1,
        lineWidth: 0.12,
        lineColor: [203, 213, 225],
        textColor: [17, 24, 39],
        overflow: 'linebreak',
        valign: 'top',
      },
      headStyles: { fillColor: [203, 213, 225], textColor: [15, 23, 42], fontStyle: 'bold', halign: 'center' },
      didDrawPage: drawHeader,
    });
    cursorY = (doc.lastAutoTable?.finalY || cursorY) + 5;
  }

  const totalPages = doc.getNumberOfPages();
  for (let page = 1; page <= totalPages; page += 1) {
    doc.setPage(page);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.5);
    doc.setTextColor(107, 114, 128);
    doc.text(`Halaman ${page} / ${totalPages}`, pageWidth - margin, pageHeight - 3, { align: 'right' });
  }
  doc.save(safeFileName(fileName || title));
}

function safeFileName(value) {
  const normalized = cleanText(value).replace(/[^a-z0-9._-]+/gi, '-').replace(/^-+|-+$/g, '');
  return `${normalized || 'result'}.pdf`;
}

async function loadImageData(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const blob = await response.blob();
    const data = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    const format = blob.type.includes('png') ? 'PNG' : 'JPEG';
    return { data, format };
  } catch {
    return null;
  }
}
