import { useState, useRef, useEffect } from 'react';
import { addYears, subYears, addMonths, subMonths } from 'date-fns';
import { ChevronLeft, ChevronRight, Eye, List } from 'lucide-react';
import { cn } from '@/lib/utils';
import { calendarLayoutClasses } from '@/lib/calendarLayout';

interface HeaderProps {
  viewStartDate: Date;
  setViewStartDate: (date: Date) => void;
  onScrollToDate: (date: Date) => void;
  visibleMonth: number;
  compact?: boolean;
  showSummary?: boolean;
  showTeamRoster?: boolean;
  onCompactCalendarChange?: (compact: boolean) => void;
  onShowSummaryChange?: (show: boolean) => void;
  onShowTeamRosterChange?: (show: boolean) => void;
  onOpenBookingList?: () => void;
}

export default function Header({
  viewStartDate,
  setViewStartDate,
  onScrollToDate,
  visibleMonth,
  compact = true,
  showSummary = false,
  showTeamRoster = false,
  onCompactCalendarChange,
  onShowSummaryChange,
  onShowTeamRosterChange,
  onOpenBookingList,
}: HeaderProps) {
  const [isViewOpen, setIsViewOpen] = useState(false);
  const viewMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (viewMenuRef.current && !viewMenuRef.current.contains(event.target as Node)) {
        setIsViewOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
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

  const navBtnClass = 'p-1.5 sm:p-1 bg-gray-200 hover:bg-gray-300 rounded transition-colors';

  const monthBtnClass = (active: boolean) => cn(
    layout.monthBtn,
    active ? 'bg-green-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-200'
  );

  return (
    <div className="bg-[#f0f2f5] border-b print:hidden">
      <div className={cn('flex items-center justify-between px-4', layout.calHeaderRow)}>
        <div className="flex items-center gap-2 sm:gap-3">

          <div className="flex items-center gap-1">
            <button
              onClick={() => setViewStartDate(subYears(viewStartDate, 1))}
              className={navBtnClass}
              aria-label="Previous year"
            >
              <ChevronLeft size={compact ? 12 : 14} />
            </button>
            <span className={cn('font-bold px-2 min-w-[44px] text-center', compact ? 'text-xs' : 'text-sm')}>{viewYear}</span>
            <button
              onClick={() => setViewStartDate(addYears(viewStartDate, 1))}
              className={navBtnClass}
              aria-label="Next year"
            >
              <ChevronRight size={compact ? 12 : 14} />
            </button>
          </div>

          <div className="hidden sm:flex items-center gap-0.5 ml-1">
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

          <div className="flex sm:hidden items-center gap-1 ml-1">
            <button
              type="button"
              onClick={() => navigateMonth(-1)}
              className={navBtnClass}
              aria-label="Previous month"
            >
              <ChevronLeft size={compact ? 12 : 14} />
            </button>
            <span className={cn('font-bold px-1 min-w-[28px] text-center', compact ? 'text-xs' : 'text-sm')}>
              {months[visibleMonth]}
            </span>
            <button
              type="button"
              onClick={() => navigateMonth(1)}
              className={navBtnClass}
              aria-label="Next month"
            >
              <ChevronRight size={compact ? 12 : 14} />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onCompactCalendarChange && (
            <div className="relative" ref={viewMenuRef}>
              <button
                type="button"
                onClick={() => setIsViewOpen(!isViewOpen)}
                className={cn(
                  'flex items-center gap-1.5 font-bold border border-gray-400 rounded hover:bg-gray-200 active:scale-95 transition-transform text-gray-700',
                  layout.todayBtn
                )}
                title="Calendar display"
                aria-label="Calendar display"
              >
                <Eye size={compact ? 14 : 16} />
              </button>

              {isViewOpen && (
                <div className="absolute right-0 mt-2 w-52 max-w-[90vw] bg-white rounded-2xl shadow-2xl border border-gray-100 p-2 z-[200] animate-in fade-in zoom-in-95 duration-100">
                  <div className="px-3 py-2 border-b border-gray-50">
                    <span className="text-xs font-bold text-gray-500">Calendar View</span>
                  </div>
                  <div className="py-1 space-y-0.5">
                    <label className="flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-gray-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={compact}
                        onChange={(e) => onCompactCalendarChange(e.target.checked)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                      />
                      <span className="text-xs font-medium text-gray-700">Compact calendar</span>
                    </label>
                    {onShowSummaryChange && (
                      <label className="flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-gray-50 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={showSummary}
                          onChange={(e) => onShowSummaryChange(e.target.checked)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                        />
                        <span className="text-xs font-medium text-gray-700">Summary</span>
                      </label>
                    )}
                    {onShowTeamRosterChange && (
                      <label className="flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-gray-50 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={showTeamRoster}
                          onChange={(e) => onShowTeamRosterChange(e.target.checked)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                        />
                        <span className="text-xs font-medium text-gray-700">Staff & Volunteers</span>
                      </label>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {onOpenBookingList && (
            <button
              type="button"
              onClick={onOpenBookingList}
              className={cn(
                'flex items-center gap-1.5 font-bold border border-gray-400 rounded hover:bg-gray-200 active:scale-95 transition-transform text-gray-700',
                layout.todayBtn
              )}
              title="Booking List"
              aria-label="Booking List"
            >
              <List size={compact ? 14 : 16} />
              <span className="hidden sm:inline uppercase">List</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
