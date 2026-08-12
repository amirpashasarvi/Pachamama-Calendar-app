import { addYears, subYears, addMonths, subMonths } from 'date-fns';
import { ChevronLeft, ChevronRight, List, DollarSign } from 'lucide-react';
import { cn } from '@/lib/utils';
import { calendarLayoutClasses } from '@/lib/calendarLayout';

interface HeaderProps {
  viewStartDate: Date;
  setViewStartDate: (date: Date) => void;
  onScrollToDate: (date: Date) => void;
  visibleMonth: number;
  compact?: boolean;
  onOpenBookings?: () => void;
  onOpenFinances?: () => void;
}

export default function Header({
  viewStartDate,
  setViewStartDate,
  onScrollToDate,
  visibleMonth,
  compact = true,
  onOpenBookings,
  onOpenFinances,
}: HeaderProps) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const viewYear = viewStartDate.getFullYear();
  const layout = calendarLayoutClasses(compact);
  const visibleDate = new Date(viewYear, visibleMonth, 1);

  const navigateMonth = (direction: -1 | 1) => {
    const target = direction === -1 ? subMonths(visibleDate, 1) : addMonths(visibleDate, 1);
    if (target.getFullYear() !== viewYear) {
      setViewStartDate(new Date(target.getFullYear(), 0, 1));
      setTimeout(() => onScrollToDate(target), 50);
    } else {
      onScrollToDate(target);
    }
  };

  const navBtnClass = cn(
    'inline-flex items-center justify-center bg-gray-200 hover:bg-gray-300 rounded transition-colors',
    compact ? 'h-7 w-7' : 'h-8 w-8',
  );

  const monthBtnClass = (active: boolean) => cn(
    layout.monthBtn,
    active ? 'bg-green-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-200'
  );

  const showDestinations = onOpenBookings || onOpenFinances;

  return (
    <div className="bg-[#f0f2f5] border-b print:hidden">
      <div className={cn('flex items-center justify-between px-4', layout.calHeaderRow)}>
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">

          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => setViewStartDate(subYears(viewStartDate, 1))}
              className={navBtnClass}
              aria-label="Previous year"
            >
              <ChevronLeft size={layout.navChevronSize} />
            </button>
            <span className={cn('font-bold px-2 min-w-[44px] text-center', layout.navYearText)}>{viewYear}</span>
            <button
              onClick={() => setViewStartDate(addYears(viewStartDate, 1))}
              className={navBtnClass}
              aria-label="Next year"
            >
              <ChevronRight size={layout.navChevronSize} />
            </button>
          </div>

          <div className="hidden sm:flex items-center gap-0.5 ml-1 min-w-0">
            {months.map((m, i) => (
              <button
                key={m}
                onClick={() => onScrollToDate(new Date(viewYear, i, 1))}
                className={monthBtnClass(i === visibleMonth)}
              >
                {m}
              </button>
            ))}
          </div>

          <div className="flex sm:hidden items-center gap-1 ml-1 shrink-0">
            <button
              type="button"
              onClick={() => navigateMonth(-1)}
              className={navBtnClass}
              aria-label="Previous month"
            >
              <ChevronLeft size={layout.navChevronSize} />
            </button>
            <span className={cn('font-bold px-1 min-w-[28px] text-center', layout.navYearText)}>
              {months[visibleMonth]}
            </span>
            <button
              type="button"
              onClick={() => navigateMonth(1)}
              className={navBtnClass}
              aria-label="Next month"
            >
              <ChevronRight size={layout.navChevronSize} />
            </button>
          </div>
        </div>

        {showDestinations && (
          <div className="flex items-center gap-1.5 shrink-0 ml-2">
            {onOpenBookings && (
              <button
                type="button"
                onClick={onOpenBookings}
                className={cn(
                  layout.calActionPill,
                  'bg-white border border-gray-300 text-gray-900 hover:bg-gray-50 hover:border-gray-400 transition-colors',
                )}
                title="Bookings"
                aria-label="Bookings"
              >
                <List size={layout.calActionPillIconSize} />
                Bookings
              </button>
            )}
            {onOpenFinances && (
              <button
                type="button"
                onClick={onOpenFinances}
                className={cn(
                  layout.calActionPill,
                  'bg-gray-900 text-white hover:bg-black transition-colors',
                )}
                title="Finances"
                aria-label="Finances"
              >
                <DollarSign size={layout.calActionPillIconSize} />
                Finances
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
