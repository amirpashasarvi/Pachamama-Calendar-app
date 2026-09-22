import { jsPDF } from 'jspdf';
import { Invoice } from '@/types';
import { INVOICE_ISSUER, defaultInvoiceBankDetails } from '@/lib/invoiceDetails';
import {
  calculateInvoiceTotals,
  formatDiscountDisplay,
  formatEuro,
  formatInvoiceDate,
  invoiceFilename,
  lineDiscountAmount,
} from '@/lib/invoiceLogic';

const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 18;
const CONTENT_W = PAGE_W - MARGIN * 2;

function addPageIfNeeded(doc: jsPDF, y: number, needed: number): number {
  if (y + needed <= PAGE_H - 16) return y;
  doc.addPage();
  return 18;
}

export function downloadInvoicePdf(invoice: Invoice): void {
  const totals = calculateInvoiceTotals(invoice);
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const right = PAGE_W - MARGIN;
  let y = 20;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(17, 24, 39);
  doc.text('INVOICE', MARGIN, y);

  y += 8;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(107, 114, 128);
  doc.text(invoice.invoiceNumber, MARGIN, y);
  y += 5;
  doc.text(formatInvoiceDate(invoice.invoiceDate), MARGIN, y);

  y += 14;
  doc.setTextColor(17, 24, 39);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(INVOICE_ISSUER.title, MARGIN, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(invoice.guestName || '—', PAGE_W / 2, y);

  y += 5;
  doc.setTextColor(75, 85, 99);
  INVOICE_ISSUER.addressLines.forEach((line, i) => {
    doc.text(line, MARGIN, y + i * 5);
  });
  const billLines = [
    invoice.guestEmail || '',
    invoice.guestPhone || '',
  ].filter(Boolean);
  billLines.forEach((line, i) => {
    doc.text(line, PAGE_W / 2, y + i * 5);
  });
  y += Math.max(INVOICE_ISSUER.addressLines.length, billLines.length || 1) * 5 + 5;
  doc.setTextColor(37, 99, 235);
  doc.text(INVOICE_ISSUER.email, MARGIN, y);
  doc.setTextColor(17, 24, 39);

  y += 10;
  doc.setFillColor(249, 250, 251);
  doc.roundedRect(MARGIN, y, CONTENT_W, 16, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Description', MARGIN + 4, y + 6);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(75, 85, 99);
  const desc = doc.splitTextToSize(invoice.description || '—', CONTENT_W - 8);
  doc.text(desc, MARGIN + 4, y + 12);
  y += 16 + Math.max(0, (desc.length - 1) * 4) + 8;

  const cols = {
    item: MARGIN,
    qty: MARGIN + 88,
    price: MARGIN + 112,
    disc: MARGIN + 142,
    total: right,
  };

  y = addPageIfNeeded(doc, y, 20);
  doc.setFillColor(249, 250, 251);
  doc.roundedRect(MARGIN, y, CONTENT_W, 8, 1.5, 1.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(107, 114, 128);
  doc.text('ITEM', cols.item + 2, y + 5.5);
  doc.text('QTY', cols.qty, y + 5.5);
  doc.text('PRICE', cols.price, y + 5.5);
  doc.text('DISCOUNT', cols.disc, y + 5.5);
  doc.text('TOTAL', cols.total, y + 5.5, { align: 'right' });
  y += 12;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  (invoice.items || []).forEach((item, index) => {
    const descLines = doc.splitTextToSize(item.description || '—', 82);
    const rowH = Math.max(8, descLines.length * 4.5 + 3);
    y = addPageIfNeeded(doc, y, rowH + 2);
    doc.setTextColor(17, 24, 39);
    doc.text(descLines, cols.item + 2, y);
    doc.text(String(item.quantity ?? 0), cols.qty, y);
    doc.text(formatEuro(item.unitPrice || 0), cols.price, y);
    const dAmt = lineDiscountAmount(item);
    doc.setTextColor(dAmt ? 185 : 156, dAmt ? 28 : 163, dAmt ? 28 : 175);
    doc.text(formatDiscountDisplay(dAmt), cols.disc, y);
    doc.setTextColor(17, 24, 39);
    doc.text(formatEuro(totals.itemTotals[index] || 0), cols.total, y, { align: 'right' });
    y += rowH;
    doc.setDrawColor(243, 244, 246);
    doc.line(MARGIN, y - 3, right, y - 3);
  });

  y += 2;
  y = addPageIfNeeded(doc, y, 50);
  doc.setFillColor(249, 250, 251);
  doc.roundedRect(MARGIN, y, CONTENT_W, 10, 1.5, 1.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(17, 24, 39);
  doc.text('Subtotal', MARGIN + 2, y + 6.5);
  doc.text(formatEuro(totals.subtotal), right, y + 6.5, { align: 'right' });
  y += 14;

  if (totals.invoiceDiscountAmount > 0) {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(185, 28, 28);
    doc.text('Invoice discount', MARGIN + 2, y);
    doc.text(`−${formatEuro(totals.invoiceDiscountAmount)}`, right, y, { align: 'right' });
    y += 7;
  }

  doc.setDrawColor(229, 231, 235);
  doc.line(PAGE_W / 2, y, right, y);
  y += 8;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(17, 24, 39);
  doc.text('Invoice Total', PAGE_W / 2, y);
  doc.text(formatEuro(totals.total), right, y, { align: 'right' });
  y += 8;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text('Paid', PAGE_W / 2, y);
  doc.text(formatEuro(totals.paid), right, y, { align: 'right' });
  y += 6;
  doc.text('Remaining', PAGE_W / 2, y);
  doc.text(formatEuro(totals.remaining), right, y, { align: 'right' });
  y += 6;
  const statusColor = totals.status === 'PAID'
    ? [21, 128, 61]
    : totals.status === 'PARTIALLY PAID'
      ? [180, 83, 9]
      : [185, 28, 28];
  doc.setTextColor(statusColor[0], statusColor[1], statusColor[2]);
  doc.setFont('helvetica', 'bold');
  doc.text(totals.status, right, y, { align: 'right' });
  doc.setTextColor(17, 24, 39);
  y += 10;

  if (invoice.paymentMethod) {
    y = addPageIfNeeded(doc, y, 12);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(107, 114, 128);
    doc.text('PAYMENT METHOD', MARGIN, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(17, 24, 39);
    doc.text(invoice.paymentMethod, MARGIN, y);
    y += 10;
  }

  const paymentDetailsText = invoice.paymentDetails || defaultInvoiceBankDetails();
  if (paymentDetailsText) {
    y = addPageIfNeeded(doc, y, 20);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(107, 114, 128);
    doc.text('PAYMENT DETAILS', MARGIN, y);
    y += 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(55, 65, 81);
    const bankLines = doc.splitTextToSize(paymentDetailsText, CONTENT_W);
    bankLines.forEach((line: string) => {
      y = addPageIfNeeded(doc, y, 5);
      doc.text(line, MARGIN, y);
      y += 4.5;
    });
  }

  doc.save(invoiceFilename(invoice));
}
