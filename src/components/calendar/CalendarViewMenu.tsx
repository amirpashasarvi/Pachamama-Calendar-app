import { useState, useRef, useEffect } from 'react';
import { Eye } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CalendarViewMenuProps {
  iconSize?: number;
  buttonClassName?: string;
  compact: boolean;
  showSummary?: boolean;
  showTeamRoster?: boolean;
  showHousekeepingStatus?: boolean;
  onCompactCalendarChange: (compact: boolean) => void;
  onShowSummaryChange?: (show: boolean) => void;
  onShowTeamRosterChange?: (show: boolean) => void;
  onShowHousekeepingStatusChange?: (show: boolean) => void;
}

export default function CalendarViewMenu({
  iconSize = 16,
  buttonClassName,
  compact,
  showSummary = false,
  showTeamRoster = false,
  showHousekeepingStatus = false,
  onCompactCalendarChange,
  onShowSummaryChange,
  onShowTeamRosterChange,
  onShowHousekeepingStatusChange,
}: CalendarViewMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          buttonClassName,
          isOpen && 'relative z-[201]',
        )}
        title="Calendar View"
        aria-label="Calendar View"
        aria-expanded={isOpen}
        aria-haspopup="dialog"
      >
        <Eye size={iconSize} />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-[199]"
            aria-hidden="true"
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsOpen(false);
            }}
          />
          <div
            role="dialog"
            aria-label="Calendar View"
            className="absolute right-0 mt-2 w-52 max-w-[90vw] bg-white rounded-2xl shadow-2xl border border-gray-100 p-2 z-[200] animate-in fade-in zoom-in-95 duration-100"
          >
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
              {onShowHousekeepingStatusChange && (
                <label className="flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-gray-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showHousekeepingStatus}
                    onChange={(e) => onShowHousekeepingStatusChange(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                  />
                  <span className="text-xs font-medium text-gray-700">Housekeeping status</span>
                </label>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
