import { format } from 'date-fns';
import { PeriodRange } from '@/lib/prorate';
import { MonthlyExpense } from '@/types';
import { asAmountMap } from '@/lib/expenseSpreads';

export {
  monthsInYear,
  splitAmountEvenly,
  formatSpreadMonthLabel,
  saveExpenseSpread,
  deleteExpenseSpread,
  spreadHintForCategory,
  spreadsForYear,
  spreadsForMonth,
  spreadAmountForMonth,
  getSpreadAmountsForMonth,
  spreadDisplayName,
  asAmountMap,
} from '@/lib/expenseSpreads';

export function monthKeyFromRange(periodRange: PeriodRange | null): string | null {
  if (!periodRange) return null;
  const start = periodRange.start;
  if (!(start instanceof Date) || Number.isNaN(start.getTime())) return null;
  return format(start, 'yyyy-MM');
}

export function sumExpenseAmounts(amounts: Record<string, number> | undefined): number {
  return Object.values(asAmountMap(amounts)).reduce((sum, value) => sum + (Number(value) || 0), 0);
}

export function sumMonthlyExpenseTotal(
  expense?: MonthlyExpense | null,
  recurringByCategory?: Record<string, number>,
  spreadByCategory?: Record<string, number>,
): number {
  const manual = asAmountMap(expense?.amounts);
  const recurring = asAmountMap(recurringByCategory);
  const spread = asAmountMap(spreadByCategory);
  const ids = new Set([...Object.keys(manual), ...Object.keys(spread), ...Object.keys(recurring)]);
  let total = 0;
  for (const id of ids) {
    total += (Number(manual[id]) || 0) + (Number(spread[id]) || 0) + (Number(recurring[id]) || 0);
  }
  return total;
}
