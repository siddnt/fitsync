const DEFAULT_PAGE_WIDTH = 612;
const DEFAULT_PAGE_HEIGHT = 792;
const DEFAULT_MARGIN_X = 42;
const DEFAULT_TOP_Y = 760;
const DEFAULT_LINE_HEIGHT = 14;
const DEFAULT_LINES_PER_PAGE = 46;

const escapeCsvCell = (value) => {
  const stringValue = value === null || value === undefined ? '' : String(value);
  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
};

const escapePdfText = (value) =>
  String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/\r/g, ' ')
    .replace(/\n/g, ' ');

const wrapText = (value, width = 92) => {
  const input = String(value ?? '').trim();
  if (!input) {
    return [''];
  }

  const words = input.split(/\s+/);
  const lines = [];
  let current = '';

  words.forEach((word) => {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= width) {
      current = candidate;
      return;
    }

    if (current) {
      lines.push(current);
    }

    if (word.length <= width) {
      current = word;
      return;
    }

    let remaining = word;
    while (remaining.length > width) {
      lines.push(remaining.slice(0, width));
      remaining = remaining.slice(width);
    }
    current = remaining;
  });

  if (current) {
    lines.push(current);
  }

  return lines.length ? lines : [''];
};

export const buildCsvReport = ({ columns = [], rows = [] } = {}) => {
  const header = columns.map((column) => escapeCsvCell(column.label)).join(',');
  const body = rows.map((row) =>
    columns.map((column) => escapeCsvCell(row[column.key])).join(','));

  return ['\uFEFF' + header, ...body].join('\n');
};

const buildPdfContentStream = (lines = []) => {
  const commands = ['BT', '/F1 10 Tf', `${DEFAULT_MARGIN_X} ${DEFAULT_TOP_Y} Td`];

  lines.forEach((line, index) => {
    if (index === 0) {
      commands.push(`(${escapePdfText(line)}) Tj`);
      return;
    }

    commands.push(`0 -${DEFAULT_LINE_HEIGHT} Td`);
    commands.push(`(${escapePdfText(line)}) Tj`);
  });

  commands.push('ET');
  return commands.join('\n');
};

export const buildPdfReport = ({ title = 'FitSync Report', summary = [], columns = [], rows = [] } = {}) => {
  const tableLines = rows.flatMap((row) => {
    const joined = columns.map((column) => `${column.label}: ${row[column.key] ?? ''}`).join(' | ');
    return wrapText(joined);
  });

  const lines = [
    ...wrapText(title, 72),
    '',
    ...summary.flatMap((line) => wrapText(line)),
    ...(summary.length ? [''] : []),
    ...wrapText(columns.map((column) => column.label).join(' | ')),
    ...(rows.length ? [''] : []),
    ...tableLines,
  ];

  const pages = [];
  for (let index = 0; index < lines.length; index += DEFAULT_LINES_PER_PAGE) {
    pages.push(lines.slice(index, index + DEFAULT_LINES_PER_PAGE));
  }

  if (!pages.length) {
    pages.push(wrapText(title));
  }

  const objects = [''];
  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objects[2] = '';
  const fontObjectId = 3;
  objects[fontObjectId] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';

  const pageIds = [];

  pages.forEach((pageLines) => {
    const contentStream = buildPdfContentStream(pageLines);
    const contentObjectId = objects.length;
    objects[contentObjectId] = `<< /Length ${Buffer.byteLength(contentStream, 'utf8')} >>\nstream\n${contentStream}\nendstream`;

    const pageObjectId = contentObjectId + 1;
    objects[pageObjectId] = [
      '<< /Type /Page',
      '/Parent 2 0 R',
      `/MediaBox [0 0 ${DEFAULT_PAGE_WIDTH} ${DEFAULT_PAGE_HEIGHT}]`,
      `/Resources << /Font << /F1 ${fontObjectId} 0 R >> >>`,
      `/Contents ${contentObjectId} 0 R`,
      '>>',
    ].join('\n');

    pageIds.push(pageObjectId);
  });

  objects[2] = `<< /Type /Pages /Count ${pageIds.length} /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] >>`;

  let pdf = '%PDF-1.4\n';
  const offsets = [0];

  for (let index = 1; index < objects.length; index += 1) {
    offsets[index] = Buffer.byteLength(pdf, 'utf8');
    pdf += `${index} 0 obj\n${objects[index]}\nendobj\n`;
  }

  const xrefOffset = Buffer.byteLength(pdf, 'utf8');
  pdf += `xref\n0 ${objects.length}\n`;
  pdf += '0000000000 65535 f \n';

  for (let index = 1; index < objects.length; index += 1) {
    pdf += `${String(offsets[index]).padStart(10, '0')} 00000 n \n`;
  }

  pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(pdf, 'utf8');
};

export const sendReportResponse = (res, {
  format = 'csv',
  fileBaseName = 'report',
  title,
  summary = [],
  columns = [],
  rows = [],
} = {}) => {
  const normalizedFormat = String(format || 'csv').trim().toLowerCase();
  const safeBaseName = String(fileBaseName || 'report').replace(/[^a-z0-9-_]+/gi, '-').toLowerCase();

  if (normalizedFormat === 'pdf') {
    const pdfBuffer = buildPdfReport({ title, summary, columns, rows });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${safeBaseName}.pdf"`);
    return res.status(200).send(pdfBuffer);
  }

  const csvString = buildCsvReport({ columns, rows });
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${safeBaseName}.csv"`);
  return res.status(200).send(csvString);
};
