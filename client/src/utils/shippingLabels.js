import { formatDateTime } from './format.js';

const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const formatAddressLines = (shippingAddress) => {
  if (!shippingAddress) {
    return ['Address unavailable'];
  }

  return [
    [shippingAddress.firstName, shippingAddress.lastName].filter(Boolean).join(' '),
    shippingAddress.phone,
    shippingAddress.address,
    [shippingAddress.city, shippingAddress.state].filter(Boolean).join(', '),
    shippingAddress.zipCode,
    shippingAddress.email,
  ].filter(Boolean);
};

const buildLabelMarkup = (labels) => {
  const cards = labels.map((label) => {
    const addressLines = formatAddressLines(label.shippingAddress)
      .map((line) => `<div>${escapeHtml(line)}</div>`)
      .join('');

    return `
      <article class="label-card">
        <header class="label-card__header">
          <div>
            <div class="label-card__brand">FitSync Shipping Label</div>
            <h1>${escapeHtml(label.orderNumber ?? 'Order')}</h1>
          </div>
          <div class="label-card__meta">
            <div>${escapeHtml(formatDateTime(label.createdAt))}</div>
            <div>${escapeHtml(label.status ?? 'Pending')}</div>
          </div>
        </header>
        <section class="label-card__section">
          <div class="label-card__label">Ship to</div>
          <div class="label-card__address">${addressLines}</div>
        </section>
        <section class="label-card__grid">
          <div>
            <div class="label-card__label">Item</div>
            <div>${escapeHtml(label.itemName ?? 'Marketplace item')}</div>
            <div class="label-card__muted">Qty ${escapeHtml(label.quantity ?? 1)}</div>
          </div>
          <div>
            <div class="label-card__label">Tracking</div>
            <div>${escapeHtml(label.carrier || 'Assign carrier')}</div>
            <div class="label-card__muted">${escapeHtml(label.trackingNumber || 'Tracking number pending')}</div>
          </div>
        </section>
      </article>
    `;
  }).join('');

  return `
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <title>FitSync Shipping Labels</title>
        <style>
          body { margin: 24px; font-family: Arial, sans-serif; color: #111827; background: #f4f4f5; }
          .label-grid { display: grid; gap: 18px; }
          .label-card { background: #ffffff; border: 1px solid #d4d4d8; border-radius: 18px; padding: 20px; page-break-inside: avoid; }
          .label-card__header, .label-card__grid { display: flex; justify-content: space-between; gap: 16px; }
          .label-card__header { align-items: flex-start; margin-bottom: 18px; }
          .label-card__brand { font-size: 12px; letter-spacing: 0.12em; text-transform: uppercase; color: #71717a; margin-bottom: 8px; }
          .label-card h1 { font-size: 22px; margin: 0; }
          .label-card__meta { text-align: right; color: #52525b; font-size: 14px; }
          .label-card__section { border: 1px dashed #a1a1aa; border-radius: 14px; padding: 14px 16px; margin-bottom: 16px; }
          .label-card__label { font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; color: #71717a; margin-bottom: 6px; }
          .label-card__address { line-height: 1.5; font-size: 15px; }
          .label-card__grid { align-items: flex-start; }
          .label-card__muted { color: #71717a; font-size: 13px; margin-top: 4px; }
          @media print {
            body { background: #ffffff; margin: 0; }
            .label-grid { gap: 12px; }
            .label-card { box-shadow: none; break-inside: avoid; }
          }
        </style>
      </head>
      <body>
        <main class="label-grid">${cards}</main>
      </body>
    </html>
  `;
};

export const printShippingLabels = (labels) => {
  if (typeof window === 'undefined') {
    return { ok: false, error: 'Shipping labels can only be printed in the browser.' };
  }

  if (!Array.isArray(labels) || !labels.length) {
    return { ok: false, error: 'Select at least one order item to print shipping labels.' };
  }

  const popup = window.open('', '_blank', 'noopener,noreferrer');
  if (!popup) {
    return { ok: false, error: 'Allow pop-ups to open printable shipping labels.' };
  }

  popup.document.write(buildLabelMarkup(labels));
  popup.document.close();
  popup.focus();
  popup.print();

  return { ok: true };
};
