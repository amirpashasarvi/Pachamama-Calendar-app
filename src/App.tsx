import AuthContainer from './components/auth/AuthContainer';
import Calendar from './components/calendar/Calendar';
import { useAuth } from './hooks/useAuth';
import { LogOut, User as UserIcon, Settings, BrushCleaning, Bell, DollarSign, Trash2, MessageSquare, MoreHorizontal, Globe } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import SettingsModal, { type SettingsOpenOptions } from './components/modals/SettingsModal';
import StatisticsModal from './components/modals/StatisticsModal';
import DashboardModal from './components/modals/DashboardModal';
import BookingPortalModal from './components/modals/BookingPortalModal';
import TrashedItemsModal from './components/modals/TrashedItemsModal';
import HousekeepingModal from './components/modals/HousekeepingModal';
import ProfileModal from './components/modals/ProfileModal';
import { BookingDataProvider, useBooking } from './hooks/useBooking';
import { useHousekeeping } from './hooks/useHousekeeping';
import { useAlerts } from './hooks/useAlerts';
import { cn } from './lib/utils';
import {
  loadCompactCalendarPreference,
  saveCompactCalendarPreference,
  loadShowSummaryPreference,
  saveShowSummaryPreference,
  loadShowTeamRosterPreference,
  saveShowTeamRosterPreference,
  calendarLayoutClasses,
} from './lib/calendarLayout';

function AppContent() {
  const { profile, logout, isAdmin } = useAuth();
  const { bookingTypes, bookingChannels, paymentChannels, expenseCategories, users, bookings, deletedBookings, venueHires, deletedVenueHires, rooms, retreats, retreatTypes, teamPositions, calendarDisplaySettings } = useBooking();
  const { housekeeping, updateStatus, checkAutoDirty } = useHousekeeping(rooms, bookings, profile?.name || profile?.email);
  
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsOpenOptions, setSettingsOpenOptions] = useState<SettingsOpenOptions | null>(null);
  const [isStatsOpen, setIsStatsOpen] = useState(false);
  const [isDashboardOpen, setIsDashboardOpen] = useState(false);
  const [isBookingPortalOpen, setIsBookingPortalOpen] = useState(false);
  const [isTrashOpen, setIsTrashOpen] = useState(false);
  const [isHousekeepingOpen, setIsHousekeepingOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [showSummary, setShowSummary] = useState(loadShowSummaryPreference);
  const [showTeamRoster, setShowTeamRoster] = useState(loadShowTeamRosterPreference);
  const [compactCalendar, setCompactCalendar] = useState(loadCompactCalendarPreference);

  const layout = calendarLayoutClasses(compactCalendar);

  const handleCompactCalendarChange = (compact: boolean) => {
    setCompactCalendar(compact);
    saveCompactCalendarPreference(compact);
  };

  const handleShowSummaryChange = (show: boolean) => {
    setShowSummary(show);
    saveShowSummaryPreference(show);
  };

  const handleShowTeamRosterChange = (show: boolean) => {
    setShowTeamRoster(show);
    saveShowTeamRosterPreference(show);
  };

  // Close menus on click outside
  const userMenuRef = useRef<HTMLDivElement>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);
  const notificationsMenuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
      if (moreMenuRef.current && !moreMenuRef.current.contains(event.target as Node)) {
        setIsMoreMenuOpen(false);
      }
      if (notificationsMenuRef.current && !notificationsMenuRef.current.contains(event.target as Node)) {
        setIsNotificationsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const { arrivalAlerts, balanceAlerts, noteAlerts, commentAlerts, criticalCount, totalCount } = useAlerts(bookings, rooms, housekeeping);

  const openRetreatSettings = (options: SettingsOpenOptions) => {
    setSettingsOpenOptions(options);
    setIsSettingsOpen(true);
  };

  const iconBtn = (extra?: string) => cn(
    'hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-blue-600',
    'min-w-11 min-h-11 inline-flex items-center justify-center',
    'sm:min-w-0 sm:min-h-0',
    layout.appIconBtn,
    extra,
  );

  return (
    <div className="flex flex-col h-screen bg-white overflow-hidden print:h-auto print:overflow-visible">
      {/* Header bar */}
      <header className={cn('border-b flex items-center justify-between bg-white relative z-[150] print:hidden pt-safe px-safe', layout.appHeaderMinH, layout.appHeaderPx)}>
        <div className="flex items-center gap-3 min-w-0 flex-1 mr-2">
          <h1 className={cn('font-bold tracking-tight leading-tight truncate', layout.appTitleClass)}>
            <span className="sm:hidden">Pachamama</span>
            <span className="hidden sm:inline">Pachamama Calendar</span>
          </h1>
        </div>

        <div className="flex items-center gap-2 sm:gap-4 shrink-0">
          <div className="flex items-center gap-0.5 sm:gap-1">

            {/* Housekeeping — visible to all staff */}
            <button
              type="button"
              onClick={() => setIsHousekeepingOpen(true)}
              className={iconBtn()}
              title="Housekeeping"
              aria-label="Housekeeping"
            >
              <BrushCleaning size={layout.appIconSize} />
            </button>

            {/* Admin-only controls */}
            {isAdmin && (
              <>
                {/* Alerts — always visible */}
                <div className="relative border-l border-gray-100 ml-0.5 pl-1 sm:ml-1 sm:pl-2" ref={notificationsMenuRef}>
                  <button
                    type="button"
                    onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                    className={cn(iconBtn(), 'relative')}
                    title="Alerts"
                    aria-label="Alerts"
                  >
                    <Bell size={layout.appIconSize} />
                    {criticalCount > 0 && (
                      <span className="absolute top-2 right-2 sm:top-1.5 sm:right-1.5 w-4 h-4 bg-rose-500 text-white text-[8px] font-black rounded-full flex items-center justify-center border-2 border-white">
                        {criticalCount}
                      </span>
                    )}
                  </button>

                  {isNotificationsOpen && (
                    <>
                      <button
                        type="button"
                        aria-label="Close alerts"
                        className="fixed inset-0 z-[205] bg-black/30 sm:hidden"
                        onClick={() => setIsNotificationsOpen(false)}
                      />
                      <div className={cn(
                        'bg-white rounded-2xl shadow-2xl border border-gray-100 p-2 z-[210]',
                        'animate-in fade-in zoom-in-95 duration-100',
                        'fixed left-3 right-3 top-[calc(env(safe-area-inset-top)+3.25rem)] max-h-[min(70vh,calc(100dvh-5rem))] flex flex-col',
                        'sm:absolute sm:inset-auto sm:right-0 sm:top-full sm:mt-2 sm:w-80 sm:max-w-[90vw] sm:max-h-none sm:flex-none',
                      )}>
                        <div className="px-3 py-2 border-b border-gray-50 flex items-center justify-between shrink-0">
                          <span className="text-xs font-bold text-gray-500">Today's Alerts</span>
                          {totalCount > 0 && <span className="text-xs text-gray-400">{totalCount} items</span>}
                        </div>
                        <div className="overflow-y-auto flex-1 min-h-0 sm:max-h-[70vh]">
                        {totalCount === 0 ? (
                          <div className="p-6 text-center text-xs text-gray-400 font-bold italic">All clear — no alerts today</div>
                        ) : (
                          <>
                            {arrivalAlerts.length > 0 && (
                              <div className="mt-1">
                                <p className="px-3 pt-2 pb-1 text-xs font-bold text-blue-500">
                                  Check-ins ({arrivalAlerts.length})
                                </p>
                                {arrivalAlerts.map(a => (
                                  <div key={a.bookingId} className="px-3 py-2 rounded-xl hover:bg-gray-50 flex items-start gap-2.5">
                                    <div className={cn('w-1.5 h-1.5 rounded-full mt-1.5 shrink-0', a.isToday ? 'bg-blue-500' : 'bg-gray-300')} />
                                    <div className="min-w-0">
                                      <p className="text-xs font-bold text-gray-900 truncate">{a.guestName}</p>
                                      <p className="text-xs text-gray-400 mt-0.5">
                                        {a.room} · {a.isToday ? 'Today' : 'Tomorrow'} · {a.adults}A{a.kids > 0 ? ` ${a.kids}K` : ''}
                                      </p>
                                      {a.paymentStatus !== 'Paid' && (
                                        <span className={cn('text-xs font-bold', a.paymentStatus === 'Unpaid' ? 'text-rose-500' : 'text-amber-500')}>
                                          {a.paymentStatus}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                            {balanceAlerts.length > 0 && (
                              <div className={cn('mt-1', arrivalAlerts.length > 0 && 'border-t border-gray-50 pt-1')}>
                                <p className="px-3 pt-2 pb-1 text-xs font-bold text-amber-500">
                                  Balance Due ({balanceAlerts.length})
                                </p>
                                {balanceAlerts.map(a => (
                                  <div key={a.bookingId} className={cn('px-3 py-2 rounded-xl hover:bg-gray-50 flex items-start gap-2.5', a.isToday && a.paymentStatus === 'Unpaid' && 'bg-rose-50/40')}>
                                    <div className={cn('w-1.5 h-1.5 rounded-full mt-1.5 shrink-0', a.isToday ? 'bg-rose-500' : 'bg-amber-400')} />
                                    <div className="min-w-0">
                                      <p className="text-xs font-bold text-gray-900 truncate">{a.guestName}</p>
                                      <p className="text-xs text-gray-400 mt-0.5">
                                        {a.room} · {a.isToday ? 'Arriving today' : `In ${a.daysUntilCheckIn}d`}
                                      </p>
                                      <p className={cn('text-xs font-bold mt-0.5', a.paymentStatus === 'Unpaid' ? 'text-rose-600' : 'text-amber-500')}>
                                        €{a.remaining.toFixed(0)} remaining · {a.paymentStatus}
                                      </p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                            {commentAlerts.length > 0 && (
                              <div className={cn('mt-1', (arrivalAlerts.length > 0 || balanceAlerts.length > 0) && 'border-t border-gray-50 pt-1')}>
                                <p className="px-3 pt-2 pb-1 text-xs font-bold text-indigo-500">
                                  Booking Comments ({commentAlerts.length})
                                </p>
                                {commentAlerts.map(a => (
                                  <div key={a.bookingId} className="px-3 py-2 rounded-xl hover:bg-gray-50 flex items-start gap-2.5">
                                    <MessageSquare size={12} className="mt-0.5 shrink-0 text-indigo-400" />
                                    <div className="min-w-0">
                                      <p className="text-xs font-bold text-gray-900 truncate">{a.guestName}</p>
                                      <p className="text-xs text-gray-400 mt-0.5">{a.room} · check-in {a.checkIn}</p>
                                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{a.comment}</p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                            {noteAlerts.length > 0 && (
                              <div className={cn('mt-1', (arrivalAlerts.length > 0 || balanceAlerts.length > 0 || commentAlerts.length > 0) && 'border-t border-gray-50 pt-1')}>
                                <p className="px-3 pt-2 pb-1 text-xs font-bold text-violet-500">
                                  Housekeeping Notes ({noteAlerts.length})
                                </p>
                                {noteAlerts.map(a => (
                                  <div key={a.roomId} className="px-3 py-2 rounded-xl hover:bg-gray-50 flex items-start gap-2.5">
                                    <MessageSquare size={12} className="mt-0.5 shrink-0 text-violet-400" />
                                    <div className="min-w-0">
                                      <p className="text-xs font-bold text-gray-900">{a.roomName}</p>
                                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{a.note}</p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </>
                        )}
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* Desktop: Trash, Finances, Settings */}
                <div className="hidden sm:flex items-center gap-1 border-l border-gray-100 ml-1 pl-2">
                  <button
                    type="button"
                    onClick={() => setIsTrashOpen(true)}
                    className={cn(iconBtn('hover:text-rose-500'))}
                    title="Recently Deleted"
                    aria-label="Recently Deleted"
                  >
                    <Trash2 size={layout.appIconSize} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsDashboardOpen(true)}
                    className={iconBtn()}
                    title="Finances"
                    aria-label="Finances"
                  >
                    <DollarSign size={layout.appIconSize} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsSettingsOpen(true)}
                    className={iconBtn()}
                    title="Settings"
                    aria-label="Settings"
                  >
                    <Settings size={layout.appIconSize} />
                  </button>
                </div>

                {/* Booking Portal — separated, distinct styling from the calendar tools above */}
                <button
                  type="button"
                  onClick={() => setIsBookingPortalOpen(true)}
                  className="hidden sm:flex items-center gap-1.5 border-l border-gray-100 ml-2 pl-4 mr-0.5 text-gray-700 hover:text-black transition-colors"
                  title="Booking Portal"
                  aria-label="Booking Portal"
                >
                  <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gray-900 text-white text-xs font-bold hover:bg-black transition-colors">
                    <Globe size={14} />
                    Booking Portal
                  </span>
                </button>

                {/* Mobile: overflow menu */}
                <div className="relative sm:hidden border-l border-gray-100 ml-0.5 pl-1" ref={moreMenuRef}>
                  <button
                    type="button"
                    onClick={() => setIsMoreMenuOpen(!isMoreMenuOpen)}
                    className={iconBtn()}
                    title="More"
                    aria-label="More"
                  >
                    <MoreHorizontal size={layout.appIconSize} />
                  </button>

                  {isMoreMenuOpen && (
                    <div className="absolute right-0 mt-2 w-52 max-w-[90vw] bg-white rounded-2xl shadow-2xl border border-gray-100 p-2 z-[200] animate-in fade-in zoom-in-95 duration-100">
                      <div className="px-3 py-2 border-b border-gray-50">
                        <span className="text-xs font-bold text-gray-500">More</span>
                      </div>
                      <div className="pt-1 pb-2">
                        <button
                          type="button"
                          onClick={() => { setIsMoreMenuOpen(false); setIsBookingPortalOpen(true); }}
                          className="w-full flex items-center gap-3 px-3 py-2.5 bg-gray-900 hover:bg-black text-white rounded-xl transition-all font-bold text-xs"
                        >
                          <Globe size={16} /> Booking Portal
                        </button>
                      </div>
                      <div className="py-1 space-y-0.5 border-t border-gray-50">
                        <button
                          type="button"
                          onClick={() => { setIsMoreMenuOpen(false); setIsTrashOpen(true); }}
                          className="w-full flex items-center gap-3 px-3 py-2.5 text-gray-700 hover:bg-gray-50 rounded-xl transition-all font-bold text-xs"
                        >
                          <Trash2 size={16} className="text-gray-400" />
                          Recently Deleted
                        </button>
                        <button
                          type="button"
                          onClick={() => { setIsMoreMenuOpen(false); setIsDashboardOpen(true); }}
                          className="w-full flex items-center gap-3 px-3 py-2.5 text-gray-700 hover:bg-gray-50 rounded-xl transition-all font-bold text-xs"
                        >
                          <DollarSign size={16} className="text-gray-400" /> Finances
                        </button>
                        <button
                          type="button"
                          onClick={() => { setIsMoreMenuOpen(false); setIsSettingsOpen(true); }}
                          className="w-full flex items-center gap-3 px-3 py-2.5 text-gray-700 hover:bg-gray-50 rounded-xl transition-all font-bold text-xs"
                        >
                          <Settings size={16} className="text-gray-400" /> Settings
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            <div className="relative border-l border-gray-100 ml-0.5 pl-1 sm:ml-2 sm:pl-4" ref={userMenuRef}>
              <button
                type="button"
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className="flex items-center gap-2 group min-w-11 min-h-11 sm:min-w-0 sm:min-h-0 justify-center sm:justify-start"
                aria-label="Account"
              >
                <div className="text-right hidden sm:block">
                  <p className="text-[10px] font-bold leading-none text-gray-900 group-hover:text-blue-600 transition-colors">{profile?.name || profile?.email}</p>
                  <p className="text-[9px] text-gray-400 uppercase tracking-widest mt-0.5 font-black">{profile?.role}</p>
                </div>
                <div className="w-8 h-8 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center transition-all group-hover:border-blue-200 group-hover:bg-blue-50 overflow-hidden">
                  <UserIcon size={16} className="text-gray-400 group-hover:text-blue-500" />
                </div>
              </button>

              {isUserMenuOpen && (
                <div className="absolute right-0 mt-2 w-52 max-w-[90vw] bg-white rounded-2xl shadow-2xl border border-gray-100 p-2 z-[200] animate-in fade-in zoom-in-95 duration-100">
                  <div className="px-3 py-2.5 border-b border-gray-100">
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Account</p>
                    <p className="text-xs font-bold text-gray-900 truncate">{profile?.name || profile?.email}</p>
                    {profile?.name && <p className="text-[10px] text-gray-400 truncate mt-0.5">{profile?.email}</p>}
                    <span className="inline-block mt-1.5 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-gray-100 text-gray-500">
                      {profile?.role === 'admin' ? 'Admin' : 'Staff'}
                    </span>
                  </div>
                  <div className="mt-1 space-y-0.5">
                    <button
                      type="button"
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        logout();
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2 text-gray-600 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all font-bold text-xs"
                    >
                      <LogOut size={14} /> Logout
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 relative overflow-hidden">
        <Calendar
          rooms={rooms}
          bookings={bookings}
          housekeeping={housekeeping}
          showSummary={showSummary}
          showTeamRoster={showTeamRoster}
          compact={compactCalendar}
          onCompactCalendarChange={handleCompactCalendarChange}
          onShowSummaryChange={handleShowSummaryChange}
          onShowTeamRosterChange={handleShowTeamRosterChange}
          onOpenBookingList={() => setIsStatsOpen(true)}
          onOpenRetreatSettings={isAdmin ? openRetreatSettings : undefined}
        />
      </main>

      <HousekeepingModal
        isOpen={isHousekeepingOpen}
        onClose={() => setIsHousekeepingOpen(false)}
        rooms={rooms}
        bookings={bookings}
        housekeeping={housekeeping}
        updateStatus={updateStatus}
        checkAutoDirty={checkAutoDirty}
        users={users}
        currentUserName={profile?.name}
      />

      <ProfileModal 
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
      />

      {isAdmin && (
        <>
          <SettingsModal 
            isOpen={isSettingsOpen}
            onClose={() => {
              setIsSettingsOpen(false);
              setSettingsOpenOptions(null);
            }}
            bookingTypes={bookingTypes}
            bookingChannels={bookingChannels}
            paymentChannels={paymentChannels}
            expenseCategories={expenseCategories}
            users={users}
            rooms={rooms}
            retreatTypes={retreatTypes}
            retreats={retreats}
            venueHires={venueHires}
            teamPositions={teamPositions}
            displaySettings={calendarDisplaySettings}
            openOptions={settingsOpenOptions}
            onOpenOptionsHandled={() => setSettingsOpenOptions(null)}
          />
          <StatisticsModal
            isOpen={isStatsOpen}
            onClose={() => setIsStatsOpen(false)}
            bookings={bookings}
            venueHires={venueHires}
            rooms={rooms}
            bookingChannels={bookingChannels}
            paymentChannels={paymentChannels}
          />
          <TrashedItemsModal
            isOpen={isTrashOpen}
            onClose={() => setIsTrashOpen(false)}
            deletedBookings={deletedBookings}
            deletedVenueHires={deletedVenueHires}
            currentUserName={profile?.name}
            currentUserEmail={profile?.email}
          />
          <DashboardModal
            isOpen={isDashboardOpen}
            onClose={() => setIsDashboardOpen(false)}
            bookings={bookings}
            venueHires={venueHires}
            rooms={rooms}
            bookingChannels={bookingChannels}
            paymentChannels={paymentChannels}
          />
          <BookingPortalModal
            isOpen={isBookingPortalOpen}
            onClose={() => setIsBookingPortalOpen(false)}
          />
        </>
      )}
    </div>
  );
}

export default function App() {
  return (
    <AuthContainer>
      <BookingDataProvider>
        <AppContent />
      </BookingDataProvider>
    </AuthContainer>
  );
}
