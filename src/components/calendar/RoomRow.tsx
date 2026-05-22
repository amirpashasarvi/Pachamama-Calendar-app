import React from 'react';
import { isWeekend, isToday, format, parseISO } from 'date-fns';
import { Room, Booking } from '@/types';
import BookingBar from './BookingBar';
import { Plus, GripVertical } from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@/lib/utils';

interface RoomRowProps {
  key?: React.Key;
  room: Room;
  days: Date[];
  bookings: Booking[];
  housekeepingStatus?: 'clean' | 'dirty' | 'inspected' | 'cleaned';
  onEditRoom: () => void;
  onEditBooking: (booking: Booking) => void;
  onAddBooking: (date: Date) => void;
  venueHireTintDates?: string[];
  isAdmin?: boolean;
}

export default function RoomRow({ room, days, bookings, housekeepingStatus, onEditRoom, onEditBooking, onAddBooking, venueHireTintDates = [], isAdmin = false }: RoomRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: room.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 100 : 'auto',
    position: 'relative' as const
  };

  return (
    <div 
      ref={setNodeRef}
      style={style}
      className="flex relative border-b border-gray-200 group h-14 bg-white"
    >
      {/* Room Label Column */}
      <div 
        className={cn("w-28 sm:w-48 sticky left-0 z-[80] bg-white border-r border-gray-200 p-2 flex items-center gap-2 flex-shrink-0 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)] overflow-hidden", isAdmin ? "cursor-pointer hover:bg-gray-50" : "cursor-default")}
        onClick={isAdmin ? onEditRoom : undefined}
      >
        {/* Thicker Color Strip Drag Handle */}
        <div 
          {...attributes}
          {...listeners}
          className="absolute left-0 top-0 bottom-0 w-3 cursor-grab active:cursor-grabbing group/handle hover:w-6 transition-all duration-200 flex items-center justify-center overflow-hidden"
          style={{ backgroundColor: room.color }}
          title="Drag to reorder"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical size={12} className="text-white opacity-0 group-hover/handle:opacity-100 transition-opacity" />
        </div>

        <div className="flex flex-col ml-4 flex-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold truncate tracking-tight uppercase">{String(room.name)}</span>
            {housekeepingStatus && (
              <div 
                className={`w-2 h-2 rounded-full shrink-0 shadow-sm ${
                  housekeepingStatus === 'dirty' ? 'bg-rose-500 shadow-rose-200' : 
                  (housekeepingStatus === 'inspected' || housekeepingStatus === 'cleaned') ? 'bg-amber-500 shadow-amber-200' : 'bg-green-500 shadow-green-200'
                }`} 
                title={
                  housekeepingStatus === 'dirty' ? 'Dirty' : 
                  (housekeepingStatus === 'inspected' || housekeepingStatus === 'cleaned') ? 'Cleaned, needs inspection' : 'Clean'
                }
              />
            )}
          </div>
        </div>
      </div>

      {/* Grid Cells */}
      <div className="flex-1 relative flex">
        {days.map((day, idx) => {
          const dateStr = format(day, 'yyyy-MM-dd');
          const isVenueHireDay = venueHireTintDates.includes(dateStr);
          
          const isOccupied = bookings.some(booking => {
            const checkIn = format(parseISO(booking.checkIn), 'yyyy-MM-dd');
            const checkOut = format(parseISO(booking.checkOut), 'yyyy-MM-dd');
            return dateStr >= checkIn && dateStr < checkOut;
          });
          
          return (
            <div 
              key={`${String(room.id)}-${day.toISOString()}-${idx}`} 
              className={cn(
                "w-14 flex-shrink-0 border-r border-gray-200 h-full transition-colors flex items-center justify-center text-blue-400",
                isAdmin && !isOccupied ? "cursor-crosshair hover:bg-blue-50/30 active:bg-blue-50" : "",
                isWeekend(day) ? 'bg-gray-50' : '',
                isVenueHireDay ? 'bg-orange-50/60' : '',
                isToday(day) ? 'bg-sky-50/70' : '',
                isOccupied ? 'cursor-default pointer-events-none' : ''
              )}
              onClick={() => isAdmin && !isOccupied && onAddBooking(day)}
            >
              {isAdmin && !isOccupied && <Plus size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />}
            </div>
          );
        })}

        {/* Booking Bars Overlay */}
        <div className="absolute inset-0 pointer-events-none">
          {bookings.map(booking => (
            <BookingBar 
              key={`booking-${String(booking.id)}`} 
              booking={booking} 
              days={days} 
              roomColor={String(room.color)}
              onEdit={() => onEditBooking(booking)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
