import { RecurringExpense } from '@/types';
import { formatSpreadMonthLabel } from '@/lib/expenseSpreads';

export function monthIndexFromKey(monthKey: string): number {
  return parseInt(monthKey.slice(5, 7), 10);
}

export function monthsOfYearFromKeys(monthKeys: string[]): number[] {
  return [...new Set(monthKeys.map(monthIndexFromKey))].sort((a, b) => a - b);
}

export function monthKeysFromMonthsOfYear(year: number, monthsOfYear: number[]): string[] {
  return monthsOfYear.map(m => `${year}-${String(m).padStart(2, '0')}`);
}

export function formatMonthsOfYearLabel(monthsOfYear: number[], year: number): string {
  if (monthsOfYear.length === 0) return '';
  return formatSpreadMonthLabel(monthKeysFromMonthsOfYear(year, monthsOfYear));
}

export function recurringAppliesToMonth(item: RecurringExpense, monthKey: string): boolean {
  if (!item.active) return false;
  return item.monthsOfYear.includes(monthIndexFromKey(monthKey));
}

export function getRecurringAmountsForMonth(
  monthKey: string,
  items: RecurringExpense[],
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const item of items) {
    if (!recurringAppliesToMonth(item, monthKey)) continue;
    out[item.categoryId] = (out[item.categoryId] || 0) + item.amountPerMonth;
  }
  return out;
}

export function getActiveSubscriptionsForMonth(
  monthKey: string,
  items: RecurringExpense[],
): RecurringExpense[] {
  return items
    .filter(item => recurringAppliesToMonth(item, monthKey))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function recurringHintForCategory(
  monthKey: string,
  categoryId: string,
  items: RecurringExpense[],
): string | null {
  const matches = items.filter(
    item => item.categoryId === categoryId && recurringAppliesToMonth(item, monthKey),
  );
  if (matches.length === 0) return null;
  const total = matches.reduce((sum, item) => sum + item.amountPerMonth, 0);
  if (matches.length === 1) {
    return `Subscription: ${matches[0].name} · ${formatCurrencyHint(total)}/mo`;
  }
  return `Subscriptions: ${matches.map(m => m.name).join(', ')} · ${formatCurrencyHint(total)}/mo`;
}

function formatCurrencyHint(amount: number): string {
  return `€${amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}
