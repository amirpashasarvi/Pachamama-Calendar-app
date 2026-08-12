import { useState, useRef, useEffect } from 'react';
import { Plus, ChevronDown, Ban } from 'lucide-react';
import { cn } from '@/lib/utils';
import { calendarLayoutClasses } from '@/lib/calendarLayout';

interface AddMenuProps {
  compact?: boolean;
  onAddBooking: () => void;
  onAddRetreat: () => void;
  onAddVenueHire: () => void;
  onBlockRooms?: () => void;
}

export default function AddMenu({
  compact = false,
  onAddBooking,
  onAddRetreat,
  onAddVenueHire,
  onBlockRooms,
}: AddMenuProps) {
  const layout = calendarLayoutClasses(compact);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  const itemClass = 'w-full flex items-center gap-2 px-3 py-2 text-left text-[11px] font-bold transition-colors whitespace-nowrap';

  const runAction = (action: () => void) => {
    setMenuOpen(false);
    action();
  };

  return (
    <div className="relative flex justify-center w-full overflow-visible" ref={menuRef}>
      <button
        type="button"
        onClick={() => setMenuOpen(v => !v)}
        className={cn(
          layout.calActionPill,
          compact ? 'h-6' : 'h-7',
          'bg-gray-800 text-white hover:bg-gray-700 transition-colors shrink-0',
        )}
        aria-expanded={menuOpen}
        aria-haspopup="menu"
      >
        <Plus size={layout.calActionPillIconSize} />
        <span>Add</span>
        <ChevronDown
          size={layout.calActionPillIconSize}
          className={cn('shrink-0 transition-transform', menuOpen && 'rotate-180')}
        />
      </button>

      {menuOpen && (
        <>
          <div
            className="fixed inset-0 z-[240]"
            aria-hidden="true"
            onPointerDown={() => setMenuOpen(false)}
          />
          <div
            role="menu"
            className="absolute left-0 top-full mt-1 w-[11rem] bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-[250] animate-in fade-in zoom-in-95 duration-100"
          >
          <button
            type="button"
            onClick={() => runAction(onAddBooking)}
            className={cn(itemClass, 'text-green-700 hover:bg-green-50')}
          >
            <Plus size={11} className="shrink-0" />
            Booking
          </button>
          <button
            type="button"
            onClick={() => runAction(onAddRetreat)}
            className={cn(itemClass, 'text-blue-700 hover:bg-blue-50')}
          >
            <Plus size={11} className="shrink-0" />
            Retreat
          </button>
          <button
            type="button"
            onClick={() => runAction(onAddVenueHire)}
            className={cn(itemClass, 'text-orange-700 hover:bg-orange-50')}
          >
            <Plus size={11} className="shrink-0" />
            Venue hire
          </button>
          {onBlockRooms && (
            <div className="mt-1 pt-1 border-t border-gray-100">
              <button
                type="button"
                onClick={() => runAction(onBlockRooms)}
                className={cn(itemClass, 'text-gray-700 hover:bg-gray-50')}
              >
                <Ban size={11} className="shrink-0" />
                Block rooms
              </button>
            </div>
          )}
        </div>
        </>
      )}
    </div>
  );
}
