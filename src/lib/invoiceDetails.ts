export const INVOICE_ISSUER = {
  title: 'Pachamama Farm Retreat',
  name: 'Pachamama Farm Retreat',
  addressLines: ['85318, Ukropci', 'Montenegro'],
  email: 'BeHappy@pachamamaretreat.me',
};

export const INVOICE_BANK = {
  accountHolder: 'Amir Sarvi',
  iban: 'BE25 9672 4232 7382',
  swift: 'TRWIBEB1XXX',
  bank: 'Wise',
  bankAddress: ['Rue du Trône 100, 3rd floor', 'Brussels 1050', 'Belgium'],
  swiftNote: 'Use when sending money from outside SEPA',
};

export function defaultInvoiceBankDetails(): string {
  return [
    INVOICE_BANK.accountHolder,
    `IBAN: ${INVOICE_BANK.iban}`,
    `SWIFT/BIC: ${INVOICE_BANK.swift}`,
    INVOICE_BANK.bank,
    ...INVOICE_BANK.bankAddress,
    INVOICE_BANK.swiftNote,
  ].join('\n');
}

const PAYMENT_METHOD_KEY = 'pachamama.invoicePaymentMethod';
const BANK_DETAILS_KEY = 'pachamama.invoiceBankDetails';

export function getLastInvoicePaymentMethod(): string {
  try {
    return localStorage.getItem(PAYMENT_METHOD_KEY) || '';
  } catch {
    return '';
  }
}

export function setLastInvoicePaymentMethod(value: string): void {
  try {
    localStorage.setItem(PAYMENT_METHOD_KEY, value);
  } catch {
    /* ignore quota / private mode */
  }
}

export function getLastInvoiceBankDetails(): string {
  try {
    return localStorage.getItem(BANK_DETAILS_KEY) || defaultInvoiceBankDetails();
  } catch {
    return defaultInvoiceBankDetails();
  }
}

export function setLastInvoiceBankDetails(value: string): void {
  try {
    localStorage.setItem(BANK_DETAILS_KEY, value);
  } catch {
    /* ignore quota / private mode */
  }
}
