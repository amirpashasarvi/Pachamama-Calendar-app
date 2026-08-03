import { useState, useMemo, useRef, useEffect, useCallback, memo, startTransition, type RefObject, type MutableRefObject } from 'react';
import { 
  addDays, 
  differenceInDays,
  eachDayOfInterval, 
  format, 
  isWeekend, 
  startOfToday,
} from 'date-fns';
import { useBooking } from '@/hooks/useBooking';
import Header from './Header';
import RoomRow from './RoomRow';
import RetreatBar from './RetreatBar';
import SummaryRow from './SummaryRow';
import BookingModal from '@/components/modals/BookingModal';
import BlockRoomModal from '@/components/modals/BlockRoomModal';
import RoomModal from '@/components/modals/RoomModal';
import type { SettingsOpenOptions } from '@/components/modals/SettingsModal';
import VenueHireModal from '@/components/modals/VenueHireModal';
import TeamAssignmentModal from '@/components/modals/TeamAssignmentModal';
import TeamRosterSection from './TeamRosterSection';
import { Room, Booking, Retreat, HousekeepingRecord, VenueHire, TeamPosition, TeamAssignment, CalendarDisplaySettings, ConfigOption } from '@/types';
import { useAuth } from '@/hooks/useAuth';
import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { isWithinInterval, parseISO, isValid } from 'date-fns';

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
import { isActiveLifecycle } from '@/lib/bookingLifecycle';
import { isBlockedBooking } from '@/lib/bookingBlock';
import { calendarLayoutClasses } from '@/lib/calendarLayout';
import { buildBookingsByRoom, buildOccupiedDatesByRoom, EMPTY_OCCUPIED_DATES } from '@/lib/calendarOccupancy';

const EMPTY_ROOM_BOOKINGS: Booking[] = [];

type RoomMaps = {
  bookingsByRoom: Map<string, Booking[]>;
  occupiedDatesByRoom: Map<string, Set<string>>;
};

const EMPTY_ROOM_MAPS: RoomMaps = {
  bookingsByRoom: new Map(),
  occupiedDatesByRoom: new Map(),
};

function buildRoomMaps(
  activeBookings: Booking[],
  cacheRef: MutableRefObject<RoomMaps>,
): RoomMaps {
  const prev = cacheRef.current;
  const bookingsByRoom = buildBookingsByRoom(activeBookings, prev.bookingsByRoom);
  const occupiedDatesByRoom = buildOccupiedDatesByRoom(
    bookingsByRoom,
    prev.occupiedDatesByRoom,
    prev.bookingsByRoom,
  );
  const next = { bookingsByRoom, occupiedDatesByRoom };
  cacheRef.current = next;
  return next;
}

interface CalendarGridProps {
  scrollContainerRef: RefObject<HTMLDivElement | null>;
  layout: ReturnType<typeof calendarLayoutClasses>;
  days: Date[];
  rooms: Room[];
  bookingsByRoom: Map<string, Booking[]>;
  occupiedDatesByRoom: Map<string, Set<string>>;
  housekeepingByRoom: Map<string, HousekeepingRecord['status']>;
  bookingTypes: ConfigOption[];
  calendarDisplaySettings: CalendarDisplaySettings | null;
  activeBookings: Booking[];
  activeVenueHires: VenueHire[];
  retreats: Retreat[];
  venueHireTintDates: Set<string>;
  venueHireBoundaryDates: { start: Set<string>; end: Set<string> };
  retreatTintDates: Set<string>;
  retreatBoundaryDates: { start: Set<string>; end: Set<string> };
  teamPositions: TeamPosition[];
  teamAssignments: TeamAssignment[];
  sensors: ReturnType<typeof useSensors>;
  isAdmin: boolean;
  compact: boolean;
  showSummary: boolean;
  showTeamRoster: boolean;
  showHousekeepingStatus: boolean;
  onAddBooking: (roomId?: string, date?: Date) => void;
  onEditRoom: (room: Room) => void;
  onEditBooking: (booking: Booking) => void;
  onDragEnd: (event: DragEndEvent) => void;
  onAddRetreat: () => void;
  onEditRetreat: (retreat: Retreat) => void;
  onAddVenueHire: () => void;
  onEditVenueHire: (venueHire: VenueHire) => void;
  onBlockRooms?: () => void;
  onAddTeamAssignment: (positionId: string, date: Date) => void;
  onEditTeamAssignment: (assignment: TeamAssignment) => void;
}

const CalendarGrid = memo(function CalendarGrid({
  scrollContainerRef,
  layout,
  days,
  rooms,
  bookingsByRoom,
  occupiedDatesByRoom,
  housekeepingByRoom,
  bookingTypes,
  calendarDisplaySettings,
  activeBookings,
  activeVenueHires,
  retreats,
  venueHireTintDates,
  venueHireBoundaryDates,
  retreatTintDates,
  retreatBoundaryDates,
  teamPositions,
  teamAssignments,
  sensors,
  isAdmin,
  compact,
  showSummary,
  showTeamRoster,
  showHousekeepingStatus,
  onAddBooking,
  onEditRoom,
  onEditBooking,
  onDragEnd,
  onAddRetreat,
  onEditRetreat,
  onAddVenueHire,
  onEditVenueHire,
  onBlockRooms,
  onAddTeamAssignment,
  onEditTeamAssignment,
}: CalendarGridProps) {
  return (
    <div
      ref={(el) => { scrollContainerRef.current = el; }}
      className="flex-1 overflow-auto border-t border-gray-200 scrollbar-thin scrollbar-thumb-gray-200 print:overflow-visible print:h-auto print:flex-none"
    >
      <div className="inline-block min-w-full">
        <div className="flex sticky top-0 z-[90] bg-white border-b border-gray-200 shadow-sm">
          <div className={cn('sticky left-0 z-[100] bg-white border-r border-gray-200 flex items-center justify-center shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)]', layout.roomLabelCol, layout.roomLabelPad)}>
            {isAdmin ? (
              <button
                onClick={() => onAddBooking()}
                className={cn('flex items-center justify-center gap-1 w-full bg-green-600 text-white hover:bg-green-700 transition-colors shadow-sm', layout.addBookingBtn)}
              >
                <Plus size={layout.addBookingPlusSize} /> Add Booking
              </button>
            ) : (
              <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Rooms</span>
            )}
          </div>
          {days.map((day, idx) => (
            <div
              key={`header-${day.toISOString()}-${idx}`}
              className={cn(
                'w-14 flex-shrink-0 flex flex-col items-center justify-center border-r border-gray-200 font-mono',
                layout.dateHeaderRow,
                layout.dateHeaderWeekday,
                isWeekend(day) ? 'bg-gray-50 text-gray-500' : 'text-gray-500'
              )}
            >
              <span className="uppercase font-bold tracking-tighter opacity-60">{format(day, 'EEE')}</span>
              <span className={cn('font-bold text-gray-800', layout.dateHeaderDayNum)}>{format(day, 'd')}</span>
            </div>
          ))}
        </div>

        <RetreatBar
          days={days}
          retreats={retreats}
          venueHires={activeVenueHires}
          onAdd={onAddRetreat}
          onEdit={onEditRetreat}
          onAddVenue={onAddVenueHire}
          onEditVenue={onEditVenueHire}
          onBlockRooms={onBlockRooms}
          compact={compact}
        />

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <div className="flex flex-col">
            {rooms.length === 0 ? (
              <div className="p-20 text-center flex flex-col items-center gap-4">
                <div className="p-4 bg-gray-50 rounded-full text-gray-400">
                  <Plus size={32} />
                </div>
                <p className="text-gray-400 font-medium italic">Your property is empty. Add a room to get started.</p>
              </div>
            ) : (
              <SortableContext items={rooms.map(r => r.id)} strategy={verticalListSortingStrategy}>
                {rooms.map(room => (
                  <RoomRow
                    key={`room-${room.id}`}
                    room={room}
                    days={days}
                    bookings={bookingsByRoom.get(room.id) ?? EMPTY_ROOM_BOOKINGS}
                    occupiedDates={occupiedDatesByRoom.get(room.id) ?? EMPTY_OCCUPIED_DATES}
                    bookingTypes={bookingTypes}
                    calendarDisplaySettings={calendarDisplaySettings}
                    housekeepingStatus={showHousekeepingStatus ? housekeepingByRoom.get(room.id) : undefined}
                    onEditRoom={onEditRoom}
                    onEditBooking={onEditBooking}
                    onAddBooking={onAddBooking}
                    venueHireTintDates={venueHireTintDates}
                    venueHireBoundaryDates={venueHireBoundaryDates}
                    retreatTintDates={retreatTintDates}
                    retreatBoundaryDates={retreatBoundaryDates}
                    isAdmin={isAdmin}
                    compact={compact}
                  />
                ))}
              </SortableContext>
            )}
          </div>
        </DndContext>

        {showSummary && (
          <SummaryRow days={days} bookings={activeBookings} rooms={rooms} compact={compact} />
        )}

        {showTeamRoster && (
          <TeamRosterSection
            days={days}
            positions={teamPositions}
            assignments={teamAssignments}
            onAddAssignment={onAddTeamAssignment}
            onEditAssignment={onEditTeamAssignment}
            isAdmin={isAdmin}
            compact={compact}
          />
        )}
      </div>
    </div>
  );
});

interface CalendarProps {
  rooms?: Room[];
  bookings?: Booking[];
  housekeeping?: HousekeepingRecord[];
  showSummary?: boolean;
  showTeamRoster?: boolean;
  showHousekeepingStatus?: boolean;
  compact?: boolean;
  onCompactCalendarChange?: (compact: boolean) => void;
  onShowSummaryChange?: (show: boolean) => void;
  onShowTeamRosterChange?: (show: boolean) => void;
  onShowHousekeepingStatusChange?: (show: boolean) => void;
  onOpenBookingList?: () => void;
  onOpenRetreatSettings?: (options: SettingsOpenOptions) => void;
}

export default function Calendar({
  rooms: propRooms,
  bookings: propBookings,
  housekeeping: propHousekeeping,
  showSummary = false,
  showTeamRoster = false,
  showHousekeepingStatus = false,
  compact = true,
  onCompactCalendarChange,
  onShowSummaryChange,
  onShowTeamRosterChange,
  onShowHousekeepingStatusChange,
  onOpenBookingList,
  onOpenRetreatSettings,
}: CalendarProps) {
  const { rooms: localRooms, bookings: localBookings, retreats, venueHires, settings, bookingTypes, bookingChannels, paymentChannels, teamPositions, teamAssignments, calendarDisplaySettings, loading } = useBooking();
  const { isAdmin, profile } = useAuth();
  
  const rooms = propRooms || localRooms;
  const bookings = propBookings || localBookings;
  const housekeeping = propHousekeeping || [];

  const activeBookings = useMemo(() => bookings.filter(isActiveLifecycle), [bookings]);
  const activeVenueHires = useMemo(() => venueHires.filter(isActiveLifecycle), [venueHires]);
  const roomMapsCacheRef = useRef<RoomMaps>(EMPTY_ROOM_MAPS);
  const { bookingsByRoom, occupiedDatesByRoom } = useMemo(
    () => buildRoomMaps(activeBookings, roomMapsCacheRef),
    [activeBookings],
  );
  const housekeepingByRoom = useMemo(() => {
    const map = new Map<string, HousekeepingRecord['status']>();
    for (const record of housekeeping) {
      map.set(record.roomId, record.status);
    }
    return map;
  }, [housekeeping]);
  const layout = useMemo(() => calendarLayoutClasses(compact), [compact]);
  
  // Modal states
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [initialBookingData, setInitialBookingData] = useState<Partial<Booking>>({});

  const [isRoomModalOpen, setIsRoomModalOpen] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);

  const [isVenueHireModalOpen, setIsVenueHireModalOpen] = useState(false);
  const [selectedVenueHire, setSelectedVenueHire] = useState<VenueHire | null>(null);

  const [isBlockRoomModalOpen, setIsBlockRoomModalOpen] = useState(false);
  const [selectedBlockBooking, setSelectedBlockBooking] = useState<Booking | null>(null);
  const [initialBlockData, setInitialBlockData] = useState<{ roomId?: string; checkIn?: string; checkOut?: string }>({});

  const [isTeamAssignmentModalOpen, setIsTeamAssignmentModalOpen] = useState(false);
  const [selectedTeamAssignment, setSelectedTeamAssignment] = useState<TeamAssignment | null>(null);
  const [initialTeamAssignmentData, setInitialTeamAssignmentData] = useState<Partial<TeamAssignment>>({});

  // Date state — always Jan 1 of the viewed year
  const [viewStartDate, setViewStartDate] = useState(() => new Date(new Date().getFullYear(), 0, 1));

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

  const handleEditRoom = useCallback((room: Room) => {
    setSelectedRoom(room);
    setIsRoomModalOpen(true);
  }, []);

  const handleEditBooking = useCallback((booking: Booking) => {
    if (isBlockedBooking(booking)) {
      if (!isAdmin) return;
      setSelectedBlockBooking(booking);
      setInitialBlockData({});
      startTransition(() => setIsBlockRoomModalOpen(true));
      return;
    }
    setSelectedBooking(booking);
    setInitialBookingData({});
    startTransition(() => setIsBookingModalOpen(true));
  }, [isAdmin]);

  const handleAddBlockRoom = useCallback(() => {
    setSelectedBlockBooking(null);
    setInitialBlockData({});
    startTransition(() => setIsBlockRoomModalOpen(true));
  }, []);

  const handleCloseBlockRoomModal = useCallback(() => {
    setIsBlockRoomModalOpen(false);
    setSelectedBlockBooking(null);
    setInitialBlockData({});
  }, []);

  const handleAddBooking = useCallback((roomId?: string, date?: Date) => {
    setSelectedBooking(null);
    setInitialBookingData({
      roomId: roomId || '',
      checkIn: date ? format(date, 'yyyy-MM-dd') : '',
      checkOut: date ? format(addDays(date, 6), 'yyyy-MM-dd') : '',
    });
    startTransition(() => setIsBookingModalOpen(true));
  }, []);

  const handleCloseBookingModal = useCallback(() => {
    setIsBookingModalOpen(false);
  }, []);

  const handleAddRetreat = useCallback(() => {
    onOpenRetreatSettings?.({ view: 'retreats', addRetreatRun: true });
  }, [onOpenRetreatSettings]);

  const handleEditRetreat = useCallback((retreat: Retreat) => {
    onOpenRetreatSettings?.({ view: 'retreats', retreatRunId: retreat.id });
  }, [onOpenRetreatSettings]);

  const handleAddVenueHire = useCallback(() => {
    setSelectedVenueHire(null);
    setIsVenueHireModalOpen(true);
  }, []);

  const handleEditVenueHire = useCallback((venueHire: VenueHire) => {
    setSelectedVenueHire(venueHire);
    setIsVenueHireModalOpen(true);
  }, []);

  const handleAddTeamAssignment = useCallback((positionId: string, date: Date) => {
    setSelectedTeamAssignment(null);
    setInitialTeamAssignmentData({
      positionId,
      startDate: format(date, 'yyyy-MM-dd'),
      endDate: format(addDays(date, 7), 'yyyy-MM-dd'),
    });
    setIsTeamAssignmentModalOpen(true);
  }, []);

  const handleEditTeamAssignment = useCallback((assignment: TeamAssignment) => {
    setSelectedTeamAssignment(assignment);
    setIsTeamAssignmentModalOpen(true);
  }, []);

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
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
  }, [rooms]);

  const handleAddRoom = useCallback(() => {
    setSelectedRoom(null);
    setIsRoomModalOpen(true);
  }, []);

  const venueHireTintDates = useMemo(() => {
    const dates = new Set<string>();
    activeVenueHires.forEach(vh => {
      const start = parseISO(vh.startDate);
      const end = parseISO(vh.endDate);
      if (!isValid(start) || !isValid(end) || end < start) return;
      const interval = eachDayOfInterval({ start, end });
      interval.forEach(d => dates.add(format(d, 'yyyy-MM-dd')));
    });
    return dates;
  }, [activeVenueHires]);

  const venueHireBoundaryDates = useMemo(() => {
    const start = new Set<string>();
    const end = new Set<string>();
    activeVenueHires.forEach(vh => {
      const startDate = parseISO(vh.startDate);
      const endDate = parseISO(vh.endDate);
      if (!isValid(startDate) || !isValid(endDate) || endDate < startDate) return;
      start.add(format(startDate, 'yyyy-MM-dd'));
      end.add(format(endDate, 'yyyy-MM-dd'));
    });
    return { start, end };
  }, [activeVenueHires]);

  const retreatTintDates = useMemo(() => {
    const dates = new Set<string>();
    retreats.forEach(r => {
      const start = parseISO(r.startDate);
      const end = parseISO(r.endDate);
      if (!isValid(start) || !isValid(end) || end < start) return;
      const interval = eachDayOfInterval({ start, end });
      interval.forEach(d => dates.add(format(d, 'yyyy-MM-dd')));
    });
    return dates;
  }, [retreats]);

  const retreatBoundaryDates = useMemo(() => {
    const start = new Set<string>();
    const end = new Set<string>();
    retreats.forEach(r => {
      const startDate = parseISO(r.startDate);
      const endDate = parseISO(r.endDate);
      if (!isValid(startDate) || !isValid(endDate) || endDate < startDate) return;
      start.add(format(startDate, 'yyyy-MM-dd'));
      end.add(format(endDate, 'yyyy-MM-dd'));
    });
    return { start, end };
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
        onScrollToDate={scrollToDate}
        visibleMonth={visibleMonth}
        compact={compact}
        showSummary={showSummary}
        showTeamRoster={showTeamRoster}
        onCompactCalendarChange={onCompactCalendarChange}
        onShowSummaryChange={onShowSummaryChange}
        onShowTeamRosterChange={onShowTeamRosterChange}
        onShowHousekeepingStatusChange={onShowHousekeepingStatusChange}
        showHousekeepingStatus={showHousekeepingStatus}
        onOpenBookingList={isAdmin ? onOpenBookingList : undefined}
      />

      <CalendarGrid
        scrollContainerRef={scrollContainerRef}
        layout={layout}
        days={days}
        rooms={rooms}
        bookingsByRoom={bookingsByRoom}
        occupiedDatesByRoom={occupiedDatesByRoom}
        housekeepingByRoom={housekeepingByRoom}
        bookingTypes={bookingTypes}
        calendarDisplaySettings={calendarDisplaySettings}
        activeBookings={activeBookings}
        activeVenueHires={activeVenueHires}
        retreats={retreats}
        venueHireTintDates={venueHireTintDates}
        venueHireBoundaryDates={venueHireBoundaryDates}
        retreatTintDates={retreatTintDates}
        retreatBoundaryDates={retreatBoundaryDates}
        teamPositions={teamPositions}
        teamAssignments={teamAssignments}
        sensors={sensors}
        isAdmin={isAdmin}
        compact={compact}
        showSummary={showSummary}
        showTeamRoster={showTeamRoster}
        showHousekeepingStatus={showHousekeepingStatus}
        onAddBooking={handleAddBooking}
        onEditRoom={handleEditRoom}
        onEditBooking={handleEditBooking}
        onDragEnd={handleDragEnd}
        onAddRetreat={handleAddRetreat}
        onEditRetreat={handleEditRetreat}
        onAddVenueHire={handleAddVenueHire}
        onEditVenueHire={handleEditVenueHire}
        onBlockRooms={isAdmin ? handleAddBlockRoom : undefined}
        onAddTeamAssignment={handleAddTeamAssignment}
        onEditTeamAssignment={handleEditTeamAssignment}
      />

      {isBookingModalOpen && (
        <BookingModal
          isOpen
          onClose={handleCloseBookingModal}
          booking={selectedBooking}
          initialData={initialBookingData}
          rooms={rooms}
          bookings={bookings}
          venueHires={venueHires}
          settings={settings}
          bookingTypes={bookingTypes}
          bookingChannels={bookingChannels}
          paymentChannels={paymentChannels}
          isAdmin={isAdmin}
          currentUserName={profile?.name}
          currentUserEmail={profile?.email}
        />
      )}

      {isBlockRoomModalOpen && (
        <BlockRoomModal
          isOpen
          onClose={handleCloseBlockRoomModal}
          booking={selectedBlockBooking}
          initialData={initialBlockData}
          rooms={rooms}
          bookings={bookings}
          bookingChannel={bookingChannels[0]?.name || 'Direct'}
          currentUserName={profile?.name}
          currentUserEmail={profile?.email}
        />
      )}

      <RoomModal 
        isOpen={isRoomModalOpen}
        onClose={() => setIsRoomModalOpen(false)}
        room={selectedRoom}
        bookings={bookings}
      />

      <VenueHireModal
        isOpen={isVenueHireModalOpen}
        onClose={() => setIsVenueHireModalOpen(false)}
        venueHire={selectedVenueHire}
        rooms={rooms}
        bookingChannels={bookingChannels}
        paymentChannels={paymentChannels}
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
