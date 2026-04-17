const escapeCsvCell = (value) => {
  const stringValue = value === null || value === undefined ? '' : String(value);
  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
};

const buildCsvContent = ({ columns = [], rows = [] } = {}) => {
  const header = columns.map((column) => escapeCsvCell(column.label ?? column.key)).join(',');
  const lines = rows.map((row) =>
    columns.map((column) => escapeCsvCell(row?.[column.key])).join(','));

  return ['\uFEFF' + header, ...lines].join('\n');
};

export const downloadCsvFile = ({
  filename = 'report.csv',
  columns = [],
  rows = [],
} = {}) => {
  if (typeof window === 'undefined') {
    return;
  }

  const blob = new Blob([buildCsvContent({ columns, rows })], {
    type: 'text/csv;charset=utf-8',
  });
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
};
