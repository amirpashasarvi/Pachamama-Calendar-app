import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { 
  addDays, 
  differenceInDays,
  eachDayOfInterval, 
  format, 
  isToday,
  isWeekend, 
  startOfToday,
} from 'date-fns';
import { useBooking } from '@/hooks/useBooking';
import Header from './Header';
import RoomRow from './RoomRow';
import RetreatBar from './RetreatBar';
import SummaryRow from './SummaryRow';
import BookingModal from '@/components/modals/BookingModal';
import RoomModal from '@/components/modals/RoomModal';
import RetreatModal from '@/components/modals/RetreatModal';
import VenueHireModal from '@/components/modals/VenueHireModal';
import TeamAssignmentModal from '@/components/modals/TeamAssignmentModal';
import TeamRosterSection from './TeamRosterSection';
import { Room, Booking, Retreat, HousekeepingRecord, VenueHire, TeamPosition, TeamAssignment } from '@/types';
import { useAuth } from '@/hooks/useAuth';
import { Plus } from 'lucide-react';
import { isWithinInterval, parseISO } from 'date-fns';

// Sorting imports
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { doc, writeBatch } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '@/services/firebase';

interface CalendarProps {
  rooms?: Room[];
  bookings?: Booking[];
  housekeeping?: HousekeepingRecord[];
}

export default function Calendar({ rooms: propRooms, bookings: propBookings, housekeeping: propHousekeeping }: CalendarProps) {
  const { rooms: localRooms, bookings: localBookings, retreats, venueHires, settings, bookingTypes, bookingChannels, teamPositions, teamAssignments, loading } = useBooking();
  const { isAdmin, profile } = useAuth();
  
  const rooms = propRooms || localRooms;
  const bookings = propBookings || localBookings;
  const housekeeping = propHousekeeping || [];
  
  // Modal states
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [initialBookingData, setInitialBookingData] = useState<Partial<Booking>>({});

  const [isRoomModalOpen, setIsRoomModalOpen] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);

  const [isRetreatModalOpen, setIsRetreatModalOpen] = useState(false);
  const [selectedRetreat, setSelectedRetreat] = useState<Retreat | null>(null);

  const [isVenueHireModalOpen, setIsVenueHireModalOpen] = useState(false);
  const [selectedVenueHire, setSelectedVenueHire] = useState<VenueHire | null>(null);

  const [isTeamAssignmentModalOpen, setIsTeamAssignmentModalOpen] = useState(false);
  const [selectedTeamAssignment, setSelectedTeamAssignment] = useState<TeamAssignment | null>(null);
  const [initialTeamAssignmentData, setInitialTeamAssignmentData] = useState<Partial<TeamAssignment>>({});

  // Date state — always Jan 1 of the viewed year
  const [viewStartDate, setViewStartDate] = useState(() => new Date(new Date().getFullYear(), 0, 1));
  const [showSummary, setShowSummary] = useState(true);
  const [showTeamRoster, setShowTeamRoster] = useState(true);

  // Tracks which month index (0–11) is currently dominant in the viewport
  const [visibleMonth, setVisibleMonth] = useState(startOfToday().getMonth());

  // Scroll ref
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  // Scroll the grid to bring a specific date into view (56px per day column)
  const scrollToDate = (date: Date) => {
    const yearStart = new Date(date.getFullYear(), 0, 1);
    const dayIndex = differenceInDays(date, yearStart);
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollLeft = dayIndex * 56;
    }
  };

  const handleToday = () => {
    const today = startOfToday();
    const currentYear = today.getFullYear();
    if (viewStartDate.getFullYear() !== currentYear) {
      setViewStartDate(new Date(currentYear, 0, 1));
      // Allow React to re-render the new year before scrolling
      setTimeout(() => scrollToDate(today), 50);
    } else {
      scrollToDate(today);
    }
  };

  // Update visibleMonth from scroll position using rAF for smooth performance
  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const dayIndex = Math.floor(el.scrollLeft / 56);
    const date = new Date(viewStartDate.getFullYear(), 0, 1 + dayIndex);
    setVisibleMonth(date.getMonth());
  }, [viewStartDate]);

  // Attach passive scroll listener; re-attach when viewed year changes or grid mounts after loading
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    let rafId: number;
    const onScroll = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(handleScroll);
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      el.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(rafId);
    };
  }, [handleScroll, loading]);

  // Scroll to today automatically once loading completes
  useEffect(() => {
    if (!loading && scrollContainerRef.current) {
      scrollToDate(startOfToday());
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  // DnD Sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Always render the full year (Jan 1 – Dec 31)
  const days = useMemo(() => {
    const year = viewStartDate.getFullYear();
    return eachDayOfInterval({
      start: new Date(year, 0, 1),
      end: new Date(year, 11, 31),
    });
  }, [viewStartDate]);

  const handleAddRoom = () => {
    setSelectedRoom(null);
    setIsRoomModalOpen(true);
  };

  const handleEditRoom = (room: Room) => {
    setSelectedRoom(room);
    setIsRoomModalOpen(true);
  };

  const handleEditBooking = (booking: Booking) => {
    setSelectedBooking(booking);
    setInitialBookingData({});
    setIsBookingModalOpen(true);
  };

  const handleAddBooking = (roomId?: string, date?: Date) => {
    setSelectedBooking(null);
    setInitialBookingData({
      roomId: roomId || '',
      checkIn: date ? format(date, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
      checkOut: date ? format(addDays(date, 7), 'yyyy-MM-dd') : format(addDays(new Date(), 7), 'yyyy-MM-dd'),
    });
    setIsBookingModalOpen(true);
  };

  const handleAddRetreat = () => {
    setSelectedRetreat(null);
    setIsRetreatModalOpen(true);
  };

  const handleEditRetreat = (retreat: Retreat) => {
    setSelectedRetreat(retreat);
    setIsRetreatModalOpen(true);
  };

  const handleAddVenueHire = () => {
    setSelectedVenueHire(null);
    setIsVenueHireModalOpen(true);
  };

  const handleEditVenueHire = (venueHire: VenueHire) => {
    setSelectedVenueHire(venueHire);
    setIsVenueHireModalOpen(true);
  };

  const handleAddTeamAssignment = (positionId: string, date: Date) => {
    setSelectedTeamAssignment(null);
    setInitialTeamAssignmentData({
      positionId,
      startDate: format(date, 'yyyy-MM-dd'),
      endDate: format(addDays(date, 7), 'yyyy-MM-dd')
    });
    setIsTeamAssignmentModalOpen(true);
  };

  const handleEditTeamAssignment = (assignment: TeamAssignment) => {
    setSelectedTeamAssignment(assignment);
    setIsTeamAssignmentModalOpen(true);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (over && active.id !== over.id) {
      const oldIndex = rooms.findIndex((room) => room.id === active.id);
      const newIndex = rooms.findIndex((room) => room.id === over.id);
      
      if (oldIndex !== -1 && newIndex !== -1) {
        const newOrder = arrayMove(rooms, oldIndex, newIndex);
        
        // Update Firestore
        const batch = writeBatch(db);
        newOrder.forEach((room: Room, index: number) => {
          const roomRef = doc(db, 'rooms', room.id);
          batch.update(roomRef, { order: index });
        });

        try {
          await batch.commit();
        } catch (error) {
          handleFirestoreError(error, OperationType.UPDATE, 'rooms');
        }
      }
    }
  };

  const venueHireTintDates = useMemo(() => {
    const dates = new Set<string>();
    venueHires.forEach(vh => {
      const start = parseISO(vh.startDate);
      const end = parseISO(vh.endDate);
      const interval = eachDayOfInterval({ start, end });
      interval.forEach(d => dates.add(format(d, 'yyyy-MM-dd')));
    });
    return Array.from(dates);
  }, [venueHires]);

  const retreatTintDates = useMemo(() => {
    const dates = new Set<string>();
    retreats.forEach(r => {
      const start = parseISO(r.startDate);
      const end = parseISO(r.endDate);
      const interval = eachDayOfInterval({ start, end });
      interval.forEach(d => dates.add(format(d, 'yyyy-MM-dd')));
    });
    return Array.from(dates);
  }, [retreats]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-pulse text-gray-400">Loading Calendar...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white select-none print:h-auto">
      <Header
        viewStartDate={viewStartDate}
        setViewStartDate={setViewStartDate}
        onToday={handleToday}
        onScrollToDate={scrollToDate}
        visibleMonth={visibleMonth}
      />

      <div 
        ref={(el) => { scrollContainerRef.current = el; }}
        className="flex-1 overflow-auto border-t border-gray-200 scrollbar-thin scrollbar-thumb-gray-200 print:overflow-visible print:h-auto print:flex-none"
      >
        <div className="inline-block min-w-full">
          
          {/* Header Row (Dates) */}
          <div className="flex sticky top-0 z-[90] bg-white border-b border-gray-200 shadow-sm">
            <div className="w-28 sm:w-48 sticky left-0 z-[100] bg-white border-r border-gray-200 flex items-center justify-center p-2 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)]">
              <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Rooms</span>
            </div>
            {days.map((day, idx) => (
              <div 
                key={`header-${day.toISOString()}-${idx}`} 
                className={`w-14 h-12 flex-shrink-0 flex flex-col items-center justify-center border-r border-gray-200 font-mono text-[10px] ${isToday(day) ? 'bg-sky-50 text-sky-700' : isWeekend(day) ? 'bg-gray-50 text-gray-500' : 'text-gray-500'}`}
              >
                <span className="uppercase font-bold tracking-tighter opacity-60">{format(day, 'EEE')}</span>
                <span className={`text-sm font-bold ${isToday(day) ? 'font-black text-sky-700' : 'text-gray-800'}`}>{format(day, 'd')}</span>
              </div>
            ))}
          </div>

          <RetreatBar 
            days={days} 
            retreats={retreats} 
            venueHires={venueHires}
            onAdd={handleAddRetreat} 
            onEdit={handleEditRetreat} 
            onAddVenue={handleAddVenueHire}
            onEditVenue={handleEditVenueHire}
          />
          
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <div className="flex flex-col">
              {rooms.length === 0 ? (
                <div className="p-20 text-center flex flex-col items-center gap-4">
                  <div className="p-4 bg-gray-50 rounded-full text-gray-400">
                    <Plus size={32} />
                  </div>
                  <p className="text-gray-400 font-medium italic">Your property is empty. Add a room to get started.</p>
                </div>
              ) : (
                <SortableContext 
                  items={rooms.map(r => r.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {rooms.map(room => (
                    <RoomRow 
                      key={`room-${room.id}`} 
                      room={room} 
                      days={days} 
                      bookings={bookings.filter(b => b.roomId === room.id)}
                      housekeepingStatus={housekeeping.find(h => h.roomId === room.id)?.status}
                      onEditRoom={() => handleEditRoom(room)}
                      onEditBooking={handleEditBooking}
                      onAddBooking={(date) => handleAddBooking(room.id, date)}
                      venueHireTintDates={venueHireTintDates}
                      retreatTintDates={retreatTintDates}
                      isAdmin={isAdmin}
                    />
                  ))}
                </SortableContext>
              )}
            </div>
          </DndContext>

          {showSummary && (
            <SummaryRow 
              days={days} 
              bookings={bookings} 
              rooms={rooms}
            />
          )}

          {showTeamRoster && (
            <TeamRosterSection 
              days={days}
              positions={teamPositions}
              assignments={teamAssignments}
              onAddAssignment={handleAddTeamAssignment}
              onEditAssignment={handleEditTeamAssignment}
              isAdmin={isAdmin}
            />
          )}

        </div>
      </div>

      <div className="h-12 border-t border-gray-200 bg-white flex items-center px-4 justify-between">
        <div className="flex items-center gap-5">
          <div className="flex items-center gap-2">
            <input 
              type="checkbox" 
              checked={showSummary} 
              onChange={(e) => setShowSummary(e.target.checked)} 
              id="summary-toggle"
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
            />
            <label htmlFor="summary-toggle" className="cursor-pointer text-xs text-gray-400 font-medium">Summary</label>
          </div>
          <div className="flex items-center gap-2">
            <input 
              type="checkbox" 
              checked={showTeamRoster} 
              onChange={(e) => setShowTeamRoster(e.target.checked)} 
              id="roster-toggle"
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
            />
            <label htmlFor="roster-toggle" className="cursor-pointer text-xs text-gray-400 font-medium">Team Roster</label>
          </div>
        </div>

        {isAdmin && (
          <button 
            onClick={() => handleAddBooking()}
            className="flex items-center gap-1.5 px-5 py-2 bg-black text-white rounded-xl text-xs font-bold hover:bg-gray-800 transition-colors"
          >
            <Plus size={14} /> Add Booking
          </button>
        )}
      </div>

      <BookingModal 
        isOpen={isBookingModalOpen}
        onClose={() => setIsBookingModalOpen(false)}
        booking={selectedBooking}
        initialData={initialBookingData}
        rooms={rooms}
        bookings={bookings}
        venueHires={venueHires}
        settings={settings}
        bookingTypes={bookingTypes}
        bookingChannels={bookingChannels}
        isAdmin={isAdmin}
        currentUserName={profile?.name}
        currentUserEmail={profile?.email}
      />

      <RoomModal 
        isOpen={isRoomModalOpen}
        onClose={() => setIsRoomModalOpen(false)}
        room={selectedRoom}
        bookings={bookings}
      />

      <RetreatModal
        isOpen={isRetreatModalOpen}
        onClose={() => setIsRetreatModalOpen(false)}
        retreat={selectedRetreat}
      />

      <VenueHireModal
        isOpen={isVenueHireModalOpen}
        onClose={() => setIsVenueHireModalOpen(false)}
        venueHire={selectedVenueHire}
        rooms={rooms}
        bookingChannels={bookingChannels}
        currentUserName={profile?.name}
        currentUserEmail={profile?.email}
      />

      <TeamAssignmentModal
        isOpen={isTeamAssignmentModalOpen}
        onClose={() => setIsTeamAssignmentModalOpen(false)}
        assignment={selectedTeamAssignment}
        initialData={initialTeamAssignmentData}
        positions={teamPositions}
        isAdmin={isAdmin}
      />
    </div>
  );
}
