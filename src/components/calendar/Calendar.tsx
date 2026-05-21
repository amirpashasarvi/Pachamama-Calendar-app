import { useState, useMemo, useRef } from 'react';
import { 
  addDays, 
  eachDayOfInterval, 
  format, 
  isSameDay, 
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
  const { isAdmin } = useAuth();
  
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

  // Date state
  const [viewStartDate, setViewStartDate] = useState(startOfToday());
  const [daysCount, setDaysCount] = useState(30);
  const [showSummary, setShowSummary] = useState(true);
  const [showTeamRoster, setShowTeamRoster] = useState(true);

  // Scroll ref
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  const handleToday = () => {
    setViewStartDate(startOfToday());
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollLeft = 0;
    }
  };

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

  const days = useMemo(() => {
    return eachDayOfInterval({
      start: viewStartDate,
      end: addDays(viewStartDate, daysCount - 1)
    });
  }, [viewStartDate, daysCount]);

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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-pulse text-gray-400">Loading Calendar...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white select-none">
      <Header 
        viewStartDate={viewStartDate} 
        setViewStartDate={setViewStartDate}
        onToday={handleToday}
        daysCount={daysCount}
        setDaysCount={setDaysCount}
      />

      <div 
        ref={(el) => { scrollContainerRef.current = el; }}
        className="flex-1 overflow-auto border-t border-gray-400 scrollbar-thin scrollbar-thumb-gray-200"
      >
        <div className="inline-block min-w-full">
          
          {/* Header Row (Dates) */}
          <div className="flex sticky top-0 z-[90] bg-white border-b border-gray-400 shadow-sm border-l border-gray-400">
            <div className="w-28 sm:w-48 sticky left-0 z-[100] bg-white border-r border-gray-400 flex items-center justify-center p-2 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]">
              <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Rooms</span>
            </div>
            {days.map((day, idx) => (
              <div 
                key={`header-${day.toISOString()}-${idx}`} 
                className={`w-14 h-12 flex-shrink-0 flex flex-col items-center justify-center border-r border-gray-400 font-mono text-[10px] ${isToday(day) ? 'bg-blue-100 text-blue-700' : isWeekend(day) ? 'bg-gray-300 text-gray-700' : 'text-gray-600'}`}
              >
                <span className="uppercase font-bold tracking-tighter opacity-50">{format(day, 'EEE')}</span>
                <span className={`text-sm font-bold ${isToday(day) ? 'font-black text-blue-700' : 'text-black'}`}>{format(day, 'd')}</span>
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

      <div className="h-10 border-t border-gray-400 bg-gray-50 flex items-center px-4 justify-between">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <input 
              type="checkbox" 
              checked={showSummary} 
              onChange={(e) => setShowSummary(e.target.checked)} 
              id="summary-toggle"
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
            />
            <label htmlFor="summary-toggle" className="cursor-pointer font-bold text-[11px] uppercase tracking-wider text-gray-500">Show Summary</label>
          </div>

          <div className="flex items-center gap-2">
            <input 
              type="checkbox" 
              checked={showTeamRoster} 
              onChange={(e) => setShowTeamRoster(e.target.checked)} 
              id="roster-toggle"
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
            />
            <label htmlFor="roster-toggle" className="cursor-pointer font-bold text-[11px] uppercase tracking-wider text-gray-500">Show Team Roster</label>
          </div>
        </div>

        <button 
          onClick={() => handleAddBooking()}
          className="flex items-center gap-1.5 px-4 py-1 bg-black text-white rounded-lg text-xs font-bold hover:bg-gray-800 transition-colors"
        >
          <Plus size={14} /> Add Booking
        </button>
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
