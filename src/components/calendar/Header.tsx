import { useState, useRef, useEffect } from 'react';
import { format, startOfToday, addDays, subDays, addYears, subYears } from 'date-fns';
import { ChevronLeft, ChevronRight, Printer } from 'lucide-react';
import DatePicker from '@/components/ui/DatePicker';

interface HeaderProps {
  viewStartDate: Date;
  setViewStartDate: (date: Date) => void;
  onToday?: () => void;
  daysCount: number;
  setDaysCount: (n: number) => void;
}

export default function Header({ viewStartDate, setViewStartDate, onToday, daysCount, setDaysCount }: HeaderProps) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  return (
    <div className="bg-[#f0f2f5] border-b">
      {/* Main controls row */}
      <div className="h-14 flex items-center justify-between px-4">
        <div className="flex items-center gap-2 sm:gap-4">
          {/* Date Navigator */}
          <div className="flex items-center gap-1.5 font-bold">
            <button
              onClick={() => setViewStartDate(subDays(viewStartDate, 7))}
              className="p-2 sm:p-1 bg-gray-200 hover:bg-gray-300 rounded transition-colors"
            >
              <ChevronLeft size={14} />
            </button>

            <DatePicker
              value={format(viewStartDate, 'yyyy-MM-dd')}
              onChange={(val) => setViewStartDate(new Date(val))}
              className="border-none bg-transparent h-auto p-0 focus-within:ring-0 min-w-[120px]"
            />

            <button
              onClick={() => setViewStartDate(addDays(viewStartDate, 7))}
              className="p-2 sm:p-1 bg-gray-200 hover:bg-gray-300 rounded transition-colors"
            >
              <ChevronRight size={14} />
            </button>
          </div>

          {/* Year Navigator — hidden on mobile, use DatePicker to navigate years */}
          <div className="hidden sm:flex items-center gap-1.5">
            <button
              onClick={() => setViewStartDate(subYears(viewStartDate, 1))}
              className="p-1 bg-gray-200 hover:bg-gray-300 rounded transition-colors"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="text-xs font-bold px-1">{format(viewStartDate, 'yyyy')}</span>
            <button
              onClick={() => setViewStartDate(addYears(viewStartDate, 1))}
              className="p-1 bg-gray-200 hover:bg-gray-300 rounded transition-colors"
            >
              <ChevronRight size={14} />
            </button>
          </div>

          <button
            onClick={() => onToday ? onToday() : setViewStartDate(startOfToday())}
            className="text-xs font-bold px-3 py-2 sm:py-1 border border-gray-400 rounded hover:bg-gray-200 active:scale-95 transition-transform text-gray-700 uppercase"
          >
            today
          </button>

          {/* Month shortcuts — desktop only; mobile uses the scrollable row below */}
          <div className="hidden sm:flex items-center gap-1 ml-2">
            {months.map((m, i) => {
              const isCurrent = format(viewStartDate, 'MMM') === m;
              return (
                <button
                  key={m}
                  onClick={() => {
                    const newDate = new Date(viewStartDate.getFullYear(), i, 1);
                    setViewStartDate(newDate);
                  }}
                  className={`px-3 py-1.5 rounded-md text-sm font-bold transition-all ${isCurrent ? 'bg-green-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-200'}`}
                >
                  {m}
                </button>
              );
            })}
          </div>
        </div>

        {/* Right side: Days count (all screens) + Print (desktop only) */}
        <div className="flex items-center gap-2 sm:gap-3 mr-1 sm:mr-0">
          <select
            value={daysCount}
            onChange={(e) => setDaysCount(Number(e.target.value))}
            className="text-xs font-bold border rounded-lg px-2 py-2 sm:py-1.5 bg-white shadow-sm"
          >
            <option value={14}>14 days</option>
            <option value={21}>21 days</option>
            <option value={30}>30 days</option>
            <option value={60}>60 days</option>
          </select>

          <button className="hidden sm:block p-2 hover:bg-gray-100 rounded-lg text-gray-500" title="Print Calendar">
            <Printer size={18} />
          </button>
        </div>
      </div>

      {/* Mobile-only month shortcuts — horizontally scrollable */}
      <div className="flex sm:hidden overflow-x-auto px-2 pb-2 gap-0.5">
        {months.map((m, i) => {
          const isCurrent = format(viewStartDate, 'MMM') === m;
          return (
            <button
              key={m}
              onClick={() => {
                const newDate = new Date(viewStartDate.getFullYear(), i, 1);
                setViewStartDate(newDate);
              }}
              className={`shrink-0 px-3 py-1.5 rounded-md text-sm font-bold transition-all ${isCurrent ? 'bg-green-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-200'}`}
            >
              {m}
            </button>
          );
        })}
      </div>
    </div>
  );
}
