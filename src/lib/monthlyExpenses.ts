import { format } from 'date-fns';
import { PeriodRange } from '@/lib/prorate';
import { MonthlyExpense } from '@/types';

export {
  getCombinedAmounts,
  sumCombinedExpenseAmounts,
  monthsInYear,
  splitAmountEvenly,
  spreadDocId,
  formatSpreadMonthLabel,
  saveExpenseSpread,
  findSpreadForCategoryYear,
  spreadHintForCategory,
} from '@/lib/expenseSpreads';

export function monthKeyFromRange(periodRange: PeriodRange | null): string | null {
  if (!periodRange) return null;
  return format(periodRange.start, 'yyyy-MM');
}

export function sumExpenseAmounts(amounts: Record<string, number> | undefined): number {
  if (!amounts) return 0;
  return Object.values(amounts).reduce((sum, value) => sum + (Number(value) || 0), 0);
}

export function sumMonthlyExpenseTotal(
  expense?: MonthlyExpense | null,
  recurringByCategory?: Record<string, number>,
): number {
  const manual = expense?.amounts || {};
  const spread = expense?.spreadAmounts || {};
  const recurring = recurringByCategory || {};
  const ids = new Set([...Object.keys(manual), ...Object.keys(spread), ...Object.keys(recurring)]);
  let total = 0;
  for (const id of ids) {
    total += (Number(manual[id]) || 0) + (Number(spread[id]) || 0) + (Number(recurring[id]) || 0);
  }
  return total;
}
