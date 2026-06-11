import { addYears, subYears } from 'date-fns';
import { ChevronLeft, ChevronRight, Printer } from 'lucide-react';
import { cn } from '@/lib/utils';
import { calendarLayoutClasses } from '@/lib/calendarLayout';

interface HeaderProps {
  viewStartDate: Date;
  setViewStartDate: (date: Date) => void;
  onToday: () => void;
  onScrollToDate: (date: Date) => void;
  visibleMonth: number;
  compact?: boolean;
}

export default function Header({ viewStartDate, setViewStartDate, onToday, onScrollToDate, visibleMonth, compact = true }: HeaderProps) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const viewYear = viewStartDate.getFullYear();
  const layout = calendarLayoutClasses(compact);

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
              className="p-1.5 sm:p-1 bg-gray-200 hover:bg-gray-300 rounded transition-colors"
            >
              <ChevronLeft size={compact ? 12 : 14} />
            </button>
            <span className={cn('font-bold px-2 min-w-[44px] text-center', compact ? 'text-xs' : 'text-sm')}>{viewYear}</span>
            <button
              onClick={() => setViewStartDate(addYears(viewStartDate, 1))}
              className="p-1.5 sm:p-1 bg-gray-200 hover:bg-gray-300 rounded transition-colors"
            >
              <ChevronRight size={compact ? 12 : 14} />
            </button>
          </div>

          <button
            onClick={onToday}
            className={cn('font-bold border border-gray-400 rounded hover:bg-gray-200 active:scale-95 transition-transform text-gray-700 uppercase', layout.todayBtn)}
          >
            today
          </button>

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
        </div>

        <button
          className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500"
          title="Print Calendar"
          onClick={() => window.print()}
        >
          <Printer size={compact ? 16 : 18} />
        </button>
      </div>

      <div className={cn('flex sm:hidden overflow-x-auto px-2 gap-0.5', compact ? 'pb-1' : 'pb-2')}>
        {months.map((m, i) => (
          <button
            key={m}
            onClick={() => onScrollToDate(new Date(viewYear, i, 1))}
            className={cn('shrink-0', monthBtnClass(i === visibleMonth))}
          >
            {m}
          </button>
        ))}
      </div>
    </div>
  );
}
