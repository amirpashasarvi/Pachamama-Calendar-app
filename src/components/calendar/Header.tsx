import { addYears, subYears } from 'date-fns';
import { ChevronLeft, ChevronRight, Printer } from 'lucide-react';

interface HeaderProps {
  viewStartDate: Date;
  setViewStartDate: (date: Date) => void;
  onToday: () => void;
  onScrollToDate: (date: Date) => void;
  visibleMonth: number;
}

export default function Header({ viewStartDate, setViewStartDate, onToday, onScrollToDate, visibleMonth }: HeaderProps) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const viewYear = viewStartDate.getFullYear();

  return (
    <div className="bg-[#f0f2f5] border-b print:hidden">
      {/* Main controls row */}
      <div className="h-14 flex items-center justify-between px-4">
        <div className="flex items-center gap-2 sm:gap-4">

          {/* Year Navigator */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setViewStartDate(subYears(viewStartDate, 1))}
              className="p-2 sm:p-1 bg-gray-200 hover:bg-gray-300 rounded transition-colors"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="text-sm font-bold px-2 min-w-[44px] text-center">{viewYear}</span>
            <button
              onClick={() => setViewStartDate(addYears(viewStartDate, 1))}
              className="p-2 sm:p-1 bg-gray-200 hover:bg-gray-300 rounded transition-colors"
            >
              <ChevronRight size={14} />
            </button>
          </div>

          <button
            onClick={onToday}
            className="text-xs font-bold px-3 py-2 sm:py-1 border border-gray-400 rounded hover:bg-gray-200 active:scale-95 transition-transform text-gray-700 uppercase"
          >
            today
          </button>

          {/* Month shortcuts — desktop */}
          <div className="hidden sm:flex items-center gap-1 ml-2">
            {months.map((m, i) => (
              <button
                key={m}
                onClick={() => onScrollToDate(new Date(viewYear, i, 1))}
                className={`px-3 py-1.5 rounded-md text-sm font-bold transition-all ${i === visibleMonth ? 'bg-green-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-200'}`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        {/* Print button */}
        <button
          className="p-2 hover:bg-gray-100 rounded-lg text-gray-500"
          title="Print Calendar"
          onClick={() => window.print()}
        >
          <Printer size={18} />
        </button>
      </div>

      {/* Mobile-only month shortcuts — horizontally scrollable */}
      <div className="flex sm:hidden overflow-x-auto px-2 pb-2 gap-0.5">
        {months.map((m, i) => (
          <button
            key={m}
            onClick={() => onScrollToDate(new Date(viewYear, i, 1))}
            className={`shrink-0 px-3 py-1.5 rounded-md text-sm font-bold transition-all ${i === visibleMonth ? 'bg-green-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-200'}`}
          >
            {m}
          </button>
        ))}
      </div>
    </div>
  );
}
