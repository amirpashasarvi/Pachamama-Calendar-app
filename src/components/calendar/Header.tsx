import { useState, useRef, useEffect } from 'react';
import { addYears, subYears, addMonths, subMonths } from 'date-fns';
import { ChevronLeft, ChevronRight, List, DollarSign, MoreVertical } from 'lucide-react';
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
  const [isDestMenuOpen, setIsDestMenuOpen] = useState(false);
  const destMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isDestMenuOpen) return;
    function handleClickOutside(event: MouseEvent) {
      if (destMenuRef.current && !destMenuRef.current.contains(event.target as Node)) {
        setIsDestMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isDestMenuOpen]);

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

  /** Compact year/month steppers — mobile only */
  const mobileNavBtnClass = 'inline-flex items-center justify-center h-7 w-5 bg-gray-200 hover:bg-gray-300 rounded transition-colors';

  const monthBtnClass = (active: boolean) => cn(
    layout.monthBtn,
    active ? 'bg-green-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-200'
  );

  const showDestinations = onOpenBookings || onOpenFinances;

  return (
    <div className="bg-[#f0f2f5] border-b print:hidden">
      <div className={cn(
        'flex items-center justify-between',
        'px-2 sm:px-4',
        layout.calHeaderRow,
      )}>
        <div className="flex items-center gap-1.5 sm:gap-3 min-w-0">

          {/* Year — desktop */}
          <div className="hidden sm:flex items-center gap-1 shrink-0">
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

          {/* Year — mobile compact */}
          <div className="flex sm:hidden items-center shrink-0">
            <button
              type="button"
              onClick={() => setViewStartDate(subYears(viewStartDate, 1))}
              className={mobileNavBtnClass}
              aria-label="Previous year"
            >
              <ChevronLeft size={10} />
            </button>
            <span className="font-bold text-[11px] px-0.5 min-w-[34px] text-center tabular-nums">{viewYear}</span>
            <button
              type="button"
              onClick={() => setViewStartDate(addYears(viewStartDate, 1))}
              className={mobileNavBtnClass}
              aria-label="Next year"
            >
              <ChevronRight size={10} />
            </button>
          </div>

          {/* Month pills — desktop */}
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

          {/* Month stepper — mobile (green selected month label) */}
          <div className="flex sm:hidden items-center shrink-0">
            <button
              type="button"
              onClick={() => navigateMonth(-1)}
              className={mobileNavBtnClass}
              aria-label="Previous month"
            >
              <ChevronLeft size={10} />
            </button>
            <span className="inline-flex items-center justify-center min-w-[36px] h-7 px-1.5 rounded text-[11px] font-bold bg-green-600 text-white shadow-sm">
              {months[visibleMonth]}
            </span>
            <button
              type="button"
              onClick={() => navigateMonth(1)}
              className={mobileNavBtnClass}
              aria-label="Next month"
            >
              <ChevronRight size={10} />
            </button>
          </div>
        </div>

        {/* Desktop destination pills */}
        {showDestinations && (
          <div className="hidden sm:flex items-center gap-1.5 shrink-0 ml-2">
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

        {/* Mobile destination overflow menu */}
        {showDestinations && (
          <div className="relative sm:hidden shrink-0 ml-1" ref={destMenuRef}>
            <button
              type="button"
              onClick={() => setIsDestMenuOpen(v => !v)}
              className="inline-flex items-center justify-center h-8 w-8 rounded-lg text-gray-500 hover:text-gray-800 hover:bg-gray-200/80 transition-colors"
              title="More"
              aria-label="Bookings and Finances"
              aria-expanded={isDestMenuOpen}
              aria-haspopup="menu"
            >
              <MoreVertical size={16} />
            </button>
            {isDestMenuOpen && (
              <div
                role="menu"
                className="absolute right-0 top-full mt-1 w-40 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-[200] animate-in fade-in zoom-in-95 duration-100"
              >
                {onOpenBookings && (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => { setIsDestMenuOpen(false); onOpenBookings(); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left text-xs font-bold text-gray-800 hover:bg-gray-50"
                  >
                    <List size={14} className="text-gray-400" />
                    Bookings
                  </button>
                )}
                {onOpenFinances && (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => { setIsDestMenuOpen(false); onOpenFinances(); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left text-xs font-bold text-gray-800 hover:bg-gray-50"
                  >
                    <DollarSign size={14} className="text-gray-400" />
                    Finances
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
