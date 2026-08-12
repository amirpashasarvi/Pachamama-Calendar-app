import { useState, useRef, useEffect, useMemo } from 'react';
import { format, parseISO } from 'date-fns';
import { Search } from 'lucide-react';
import { Booking, Room } from '@/types';
import { cn } from '@/lib/utils';
import { isBlockedBooking } from '@/lib/bookingBlock';
import { calendarLayoutClasses } from '@/lib/calendarLayout';

interface GuestSearchProps {
  bookings: Booking[];
  rooms: Room[];
  compact?: boolean;
  onSelectBooking: (booking: Booking) => void;
}

function safeFormat(iso: string, fmt: string): string {
  try {
    return format(parseISO(iso), fmt);
  } catch {
    return iso;
  }
}

export default function GuestSearch({
  bookings,
  rooms,
  compact = false,
  onSelectBooking,
}: GuestSearchProps) {
  const layout = calendarLayoutClasses(compact);
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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

  useEffect(() => {
    if (isOpen) {
      const t = window.setTimeout(() => inputRef.current?.focus(), 30);
      return () => window.clearTimeout(t);
    }
  }, [isOpen]);

  const roomNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const room of rooms) map.set(room.id, room.name);
    return map;
  }, [rooms]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 1) return [];

    return bookings
      .filter(b => !isBlockedBooking(b) && (b.guestName || '').toLowerCase().includes(q))
      .sort((a, b) => {
        const nameCmp = (a.guestName || '').localeCompare(b.guestName || '');
        if (nameCmp !== 0) return nameCmp;
        return (a.checkIn || '').localeCompare(b.checkIn || '');
      })
      .slice(0, 20);
  }, [bookings, query]);

  const open = () => {
    setIsOpen(true);
  };

  const close = () => {
    setIsOpen(false);
    setQuery('');
  };

  const pick = (booking: Booking) => {
    onSelectBooking(booking);
    close();
  };

  return (
    <div className="relative flex items-center justify-center w-full overflow-visible" ref={menuRef}>
      <button
        type="button"
        onClick={() => (isOpen ? close() : open())}
        className={cn(
          'inline-flex items-center justify-center rounded transition-colors text-gray-500 hover:text-gray-800 hover:bg-gray-100',
          compact ? 'h-7 w-7' : 'h-8 w-8',
        )}
        title="Search guest"
        aria-label="Search guest"
        aria-expanded={isOpen}
        aria-haspopup="dialog"
      >
        <Search size={layout.calActionPillIconSize + 1} />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-[240]"
            aria-hidden="true"
            onPointerDown={close}
          />
          <div
            role="dialog"
            aria-label="Search guest"
            className="absolute left-0 top-full mt-1 w-[16rem] bg-white rounded-xl shadow-lg border border-gray-100 p-2 z-[250] animate-in fade-in zoom-in-95 duration-100"
          >
            <input
              ref={inputRef}
              type="search"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Guest name…"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-medium text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-black focus:border-black outline-none"
            />

            <div className="mt-1.5 max-h-56 overflow-y-auto">
              {query.trim().length === 0 ? (
                <p className="px-2 py-3 text-[11px] text-gray-400 text-center">
                  Type a guest name to find their booking
                </p>
              ) : matches.length === 0 ? (
                <p className="px-2 py-3 text-[11px] text-gray-400 text-center">
                  No guests match “{query.trim()}”
                </p>
              ) : (
                <div className="space-y-0.5">
                  {matches.map(booking => (
                    <button
                      key={booking.id}
                      type="button"
                      onClick={() => pick(booking)}
                      className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <p className="text-xs font-bold text-gray-900 truncate">{booking.guestName}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5 truncate">
                        {roomNameById.get(booking.roomId) || 'Room'} ·{' '}
                        {safeFormat(booking.checkIn, 'dd MMM')} – {safeFormat(booking.checkOut, 'dd MMM yyyy')}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
