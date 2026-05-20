import React, { useState, useRef, useEffect } from 'react';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  isSameDay, 
  isToday, 
  addMonths, 
  subMonths, 
  startOfToday,
  parseISO,
  isValid
} from 'date-fns';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';

interface DatePickerProps {
  value: string;
  onChange: (date: string) => void;
  min?: string;
  placeholder?: string;
  required?: boolean;
  className?: string;
}

export default function DatePicker({ value, onChange, min, placeholder, required, className }: DatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(value ? parseISO(value) : startOfToday());
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync current month view when value changes externally
  useEffect(() => {
    if (value && isValid(parseISO(value))) {
      setCurrentMonth(parseISO(value));
    }
  }, [value]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  
  // Sunday start = 0, padding is 0. Monday start = 1, padding is 1.
  const paddingCount = monthStart.getDay(); 
  const padding = Array.from({ length: paddingCount });

  const handleDateSelect = (date: Date) => {
    onChange(format(date, 'yyyy-MM-dd'));
    setIsOpen(false);
  };

  const handleClear = () => {
    onChange('');
    setIsOpen(false);
  };

  const handleToday = () => {
    handleDateSelect(startOfToday());
  };

  const minDate = min ? parseISO(min) : null;

  return (
    <div className={cn("relative", className)} ref={containerRef}>
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full px-4 py-2 bg-gray-50 border rounded-lg focus-within:ring-2 focus-within:ring-blue-500 cursor-pointer transition-all"
      >
        <span className={cn("text-sm", !value && "text-gray-400")}>
          {value ? format(parseISO(value), 'dd.MM.yyyy') : (placeholder || 'Select date')}
        </span>
        <CalendarIcon size={16} className="text-gray-400" />
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="absolute z-[200] mt-2 p-4 bg-white rounded-2xl shadow-2xl border border-gray-100 min-w-[300px]"
          >
            <div className="flex items-center justify-between mb-4">
              <button 
                type="button"
                onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ChevronLeft size={18} />
              </button>
              <h3 className="text-sm font-black uppercase tracking-widest text-gray-900">
                {format(currentMonth, 'MMMM yyyy')}
              </h3>
              <button 
                type="button"
                onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ChevronRight size={18} />
              </button>
            </div>

            <div className="grid grid-cols-7 text-center text-[10px] font-black uppercase text-gray-400 mb-2">
              <span>S</span><span>M</span><span>T</span><span>W</span><span>T</span><span>F</span><span>S</span>
            </div>

            <div className="grid grid-cols-7 gap-1">
              {padding.map((_, i) => <div key={`pad-${i}`} className="h-9" />)}
              {days.map(day => {
                const isSelected = value && isSameDay(day, parseISO(value));
                const isDayToday = isToday(day);
                const isDisabled = minDate && day < minDate;

                return (
                  <button
                    key={day.toString()}
                    type="button"
                    disabled={isDisabled}
                    onClick={() => handleDateSelect(day)}
                    className={cn(
                      "h-9 w-full flex items-center justify-center rounded-xl text-xs font-bold transition-all",
                      isSelected ? "bg-black text-white shadow-lg shadow-black/20" : 
                      isDayToday ? "text-blue-600 font-black ring-1 ring-blue-100" :
                      "hover:bg-gray-50 text-gray-700",
                      isDisabled && "opacity-20 cursor-not-allowed hover:bg-transparent"
                    )}
                  >
                    {format(day, 'd')}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-50">
              <button 
                type="button"
                onClick={handleClear}
                className="text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-rose-500 transition-colors"
              >
                Clear
              </button>
              <button 
                type="button"
                onClick={handleToday}
                className="text-[10px] font-black uppercase tracking-widest text-blue-600 hover:text-blue-700 transition-colors"
              >
                Today
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
