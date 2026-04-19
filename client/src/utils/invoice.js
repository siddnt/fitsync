import { formatCurrency, formatDateTime } from './format.js';

const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const formatShippingAddress = (shippingAddress) => {
  if (!shippingAddress) {
    return 'Address unavailable';
  }

  return [
    shippingAddress.address,
    [shippingAddress.city, shippingAddress.state].filter(Boolean).join(', '),
    shippingAddress.zipCode,
  ]
    .filter(Boolean)
    .join(' | ');
};

const formatPdfAmount = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 'Rs 0.00';
  }
  return `Rs ${numeric.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const escapePdfText = (value) => String(value ?? '')
  .replace(/\\/g, '\\\\')
  .replace(/\(/g, '\\(')
  .replace(/\)/g, '\\)')
  .replace(/\r?\n/g, ' ');

const byteLength = (value) => new TextEncoder().encode(value).length;
const PRINT_FRAME_ID = 'fitsync-invoice-print-frame';

const getTotalSavings = (order) =>
  (Number(order?.catalogDiscountAmount) || 0) + (Number(order?.discountAmount) || 0);

export const buildInvoiceMarkup = (order) => {
  const itemRows = (order?.items ?? [])
    .map((item) => `
      <tr>
        <td>${escapeHtml(item.name)}</td>
        <td>${escapeHtml(String(item.quantity ?? 0))}</td>
        <td>${escapeHtml(formatCurrency(item.price))}</td>
        <td>${escapeHtml(formatCurrency(item.subtotal ?? ((item.quantity ?? 0) * (item.price ?? 0))))}</td>
      </tr>
    `)
    .join('');

  const totalSavings = getTotalSavings(order);

  return `
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <title>Invoice ${escapeHtml(order?.orderNumber ?? 'Order')}</title>
        <style>
          body { font-family: Arial, sans-serif; color: #111827; margin: 32px; }
          h1, h2, h3, p { margin: 0; }
          .header, .meta { display: flex; justify-content: space-between; gap: 24px; }
          .header { align-items: flex-start; margin-bottom: 24px; }
          .meta { margin-top: 24px; }
          .card { border: 1px solid #d1d5db; border-radius: 12px; padding: 16px; flex: 1; }
          table { border-collapse: collapse; margin-top: 24px; width: 100%; }
          th, td { border-bottom: 1px solid #e5e7eb; padding: 12px; text-align: left; }
          th { color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; }
          .totals-row { display: flex; justify-content: space-between; margin: 8px 0; }
          .total-strong { font-size: 18px; font-weight: 700; }
          .muted { color: #6b7280; }
          .address { white-space: pre-line; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <h1>FitSync Invoice</h1>
            <p class="muted">Order ${escapeHtml(order?.orderNumber ?? '-')}</p>
          </div>
          <div>
            <p><strong>Issued:</strong> ${escapeHtml(formatDateTime(order?.createdAt))}</p>
            <p><strong>Payment:</strong> ${escapeHtml(order?.paymentMethod ?? 'N/A')}</p>
          </div>
        </div>

        <div class="meta">
          <div class="card">
            <h3>Ship to</h3>
            <p class="address" style="margin-top: 8px;">${escapeHtml([
              [order?.shippingAddress?.firstName, order?.shippingAddress?.lastName].filter(Boolean).join(' '),
              order?.shippingAddress?.phone,
              formatShippingAddress(order?.shippingAddress),
              order?.shippingAddress?.email,
            ].filter(Boolean).join('\n'))}</p>
          </div>
          <div class="card">
            <h3>Order summary</h3>
            <div class="totals-row"><span>Original price</span><span>${escapeHtml(formatCurrency(order?.originalSubtotal ?? order?.subtotal))}</span></div>
            ${Number(order?.catalogDiscountAmount ?? 0) > 0 ? `<div class="totals-row"><span>Product discount</span><span>-${escapeHtml(formatCurrency(order?.catalogDiscountAmount))}</span></div>` : ''}
            <div class="totals-row"><span>Subtotal</span><span>${escapeHtml(formatCurrency(order?.subtotal))}</span></div>
            ${Number(order?.discountAmount ?? 0) > 0 ? `<div class="totals-row"><span>Promo discount</span><span>-${escapeHtml(formatCurrency(order?.discountAmount))}</span></div>` : ''}
            <div class="totals-row"><span>Tax</span><span>${escapeHtml(formatCurrency(order?.tax))}</span></div>
            <div class="totals-row"><span>Shipping</span><span>${escapeHtml(formatCurrency(order?.shippingCost))}</span></div>
            <div class="totals-row total-strong"><span>Total</span><span>${escapeHtml(formatCurrency(order?.total))}</span></div>
            ${totalSavings > 0 ? `<p class="muted" style="margin-top: 8px;">Total savings: ${escapeHtml(formatCurrency(totalSavings))}</p>` : ''}
            ${order?.promo?.code ? `<p class="muted" style="margin-top: 8px;">Promo ${escapeHtml(order.promo.code)}${order?.promo?.description ? ` - ${escapeHtml(order.promo.description)}` : ''}</p>` : ''}
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Item</th>
              <th>Qty</th>
              <th>Unit price</th>
              <th>Line total</th>
            </tr>
          </thead>
          <tbody>${itemRows}</tbody>
        </table>
      </body>
    </html>
  `;
};

const buildInvoicePdfString = (order) => {
  const shippingLines = [
    [order?.shippingAddress?.firstName, order?.shippingAddress?.lastName].filter(Boolean).join(' '),
    order?.shippingAddress?.phone,
    formatShippingAddress(order?.shippingAddress),
    order?.shippingAddress?.email,
  ].filter(Boolean);

  const itemLines = (order?.items ?? []).flatMap((item) => ([
    `${item.name} x ${item.quantity ?? 0}`,
    `  Unit ${formatPdfAmount(item.price)} | Line ${formatPdfAmount(item.subtotal ?? ((item.quantity ?? 0) * (item.price ?? 0)))}`,
  ]));

  const totalSavings = getTotalSavings(order);

  const lines = [
    'FitSync Invoice',
    `Order: ${order?.orderNumber ?? 'Order'}`,
    `Issued: ${order?.createdAt ? formatDateTime(order.createdAt) : 'N/A'}`,
    `Payment: ${order?.paymentMethod ?? 'N/A'}`,
    '',
    'Ship to',
    ...shippingLines,
    '',
    'Summary',
    `Original price: ${formatPdfAmount(order?.originalSubtotal ?? order?.subtotal)}`,
    ...(Number(order?.catalogDiscountAmount ?? 0) > 0 ? [`Product discount: -${formatPdfAmount(order?.catalogDiscountAmount)}`] : []),
    `Subtotal: ${formatPdfAmount(order?.subtotal)}`,
    ...(Number(order?.discountAmount ?? 0) > 0 ? [`Promo discount: -${formatPdfAmount(order?.discountAmount)}`] : []),
    `Tax: ${formatPdfAmount(order?.tax)}`,
    `Shipping: ${formatPdfAmount(order?.shippingCost)}`,
    `Total: ${formatPdfAmount(order?.total)}`,
    ...(totalSavings > 0 ? [`Total savings: ${formatPdfAmount(totalSavings)}`] : []),
    ...(order?.promo?.code ? [`Promo: ${order.promo.code}${order?.promo?.description ? ` - ${order.promo.description}` : ''}`] : []),
    '',
    'Items',
    ...(itemLines.length ? itemLines : ['No items recorded']),
  ];

  const content = [
    'BT',
    '/F1 12 Tf',
    ...lines.map((line, index) => {
      const y = 800 - (index * 18);
      return `1 0 0 1 48 ${y} Tm (${escapePdfText(line)}) Tj`;
    }),
    'ET',
  ].join('\n');

  const objects = [
    '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
    '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj',
    '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj',
    '4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj',
    `5 0 obj << /Length ${byteLength(content)} >> stream\n${content}\nendstream\nendobj`,
  ];

  let pdf = '%PDF-1.4\n';
  const offsets = [0];

  objects.forEach((objectString) => {
    offsets.push(byteLength(pdf));
    pdf += `${objectString}\n`;
  });

  const startXref = byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  });
  pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${startXref}\n%%EOF`;

  return pdf;
};

const cleanupPrintFrame = (frame) => {
  if (!frame?.parentNode) {
    return;
  }

  frame.parentNode.removeChild(frame);
};

const printInvoiceWithPopup = (markup) => {
  const invoiceWindow = window.open('', '_blank', 'noopener,noreferrer');
  if (!invoiceWindow) {
    return { ok: false, error: 'Could not open the invoice preview. Try downloading the PDF instead.' };
  }

  invoiceWindow.document.write(markup);
  invoiceWindow.document.close();
  invoiceWindow.focus();
  invoiceWindow.print();

  return { ok: true };
};

const printInvoiceWithIframe = (markup) => {
  if (typeof document === 'undefined') {
    return { ok: false, error: 'Printing is unavailable outside the browser.' };
  }

  const existingFrame = document.getElementById(PRINT_FRAME_ID);
  if (existingFrame) {
    cleanupPrintFrame(existingFrame);
  }

  const frame = document.createElement('iframe');
  frame.id = PRINT_FRAME_ID;
  frame.setAttribute('aria-hidden', 'true');
  frame.tabIndex = -1;
  frame.style.position = 'fixed';
  frame.style.right = '0';
  frame.style.bottom = '0';
  frame.style.width = '0';
  frame.style.height = '0';
  frame.style.border = '0';
  frame.style.opacity = '0';
  frame.style.pointerEvents = 'none';

  let cleanedUp = false;
  const cleanup = () => {
    if (cleanedUp) {
      return;
    }

    cleanedUp = true;
    window.setTimeout(() => cleanupPrintFrame(frame), 1000);
  };

  frame.onload = () => {
    const frameWindow = frame.contentWindow;
    if (!frameWindow) {
      cleanup();
      return;
    }

    const handleAfterPrint = () => {
      frameWindow.removeEventListener?.('afterprint', handleAfterPrint);
      cleanup();
    };

    frameWindow.addEventListener?.('afterprint', handleAfterPrint, { once: true });

    window.setTimeout(() => {
      try {
        frameWindow.focus();
        frameWindow.print();
      } catch (_error) {
        cleanup();
        return;
      }

      // Some browsers do not reliably emit afterprint for hidden frames.
      window.setTimeout(cleanup, 4000);
    }, 50);
  };

  if ('srcdoc' in frame) {
    frame.srcdoc = markup;
  }

  document.body.appendChild(frame);

  if (!('srcdoc' in frame)) {
    const frameDocument = frame.contentWindow?.document;
    if (!frameDocument) {
      cleanup();
      return { ok: false, error: 'Could not prepare the invoice preview.' };
    }

    frameDocument.open();
    frameDocument.write(markup);
    frameDocument.close();
  }

  return { ok: true };
};

export const printInvoiceDocument = (order) => {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return { ok: false, error: 'Printing is unavailable outside the browser.' };
  }

  const markup = buildInvoiceMarkup(order);
  const iframeResult = printInvoiceWithIframe(markup);

  if (iframeResult.ok) {
    return iframeResult;
  }

  return printInvoiceWithPopup(markup);
};

export const downloadInvoicePdf = (order) => {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return { ok: false, error: 'PDF download is unavailable outside the browser.' };
  }

  try {
    const pdfString = buildInvoicePdfString(order);
    const blob = new Blob([pdfString], { type: 'application/pdf' });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${order?.orderNumber ?? 'invoice'}.pdf`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.URL.revokeObjectURL(url);
    return { ok: true };
  } catch (_error) {
    return { ok: false, error: 'Could not generate the PDF receipt.' };
  }
};
