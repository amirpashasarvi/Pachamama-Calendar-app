import AuthContainer from './components/auth/AuthContainer';
import Calendar from './components/calendar/Calendar';
import { useAuth } from './hooks/useAuth';
import { LogOut, User as UserIcon, Settings, BrushCleaning, Bell, MoreHorizontal } from 'lucide-react';
import CalendarViewMenu from './components/calendar/CalendarViewMenu';
import { useState, useRef, useEffect } from 'react';
import SettingsModal, { type SettingsOpenOptions } from './components/modals/SettingsModal';
import StatisticsModal from './components/modals/StatisticsModal';
import DashboardModal from './components/modals/DashboardModal';
import BookingPortalModal from './components/modals/BookingPortalModal';
import HousekeepingModal from './components/modals/HousekeepingModal';
import ProfileModal from './components/modals/ProfileModal';
import { BookingDataProvider, useBooking } from './hooks/useBooking';
import { useHousekeeping } from './hooks/useHousekeeping';
import { useAlerts } from './hooks/useAlerts';
import { cn } from './lib/utils';
import {
  loadShowSummaryPreference,
  saveShowSummaryPreference,
  loadShowTeamRosterPreference,
  saveShowTeamRosterPreference,
  loadShowHousekeepingStatusPreference,
  saveShowHousekeepingStatusPreference,
  calendarLayoutClasses,
} from './lib/calendarLayout';

function AppContent() {
  const { profile, logout, isAdmin, user } = useAuth();
  const { bookingTypes, bookingChannels, paymentChannels, expenseCategories, users, bookings, deletedBookings, venueHires, deletedVenueHires, rooms, retreats, retreatTypes, teamPositions, calendarDisplaySettings } = useBooking();
  const { housekeeping, updateStatus, checkAutoDirty } = useHousekeeping(rooms, bookings, profile?.name || profile?.email);
  
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsOpenOptions, setSettingsOpenOptions] = useState<SettingsOpenOptions | null>(null);
  const [isStatsOpen, setIsStatsOpen] = useState(false);
  const [isDashboardOpen, setIsDashboardOpen] = useState(false);
  const [isBookingPortalOpen, setIsBookingPortalOpen] = useState(false);
  const [isHousekeepingOpen, setIsHousekeepingOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [showSummary, setShowSummary] = useState(loadShowSummaryPreference);
  const [showTeamRoster, setShowTeamRoster] = useState(loadShowTeamRosterPreference);
  const [showHousekeepingStatus, setShowHousekeepingStatus] = useState(loadShowHousekeepingStatusPreference);
  const [compactCalendar, setCompactCalendar] = useState(true);

  const layout = calendarLayoutClasses(compactCalendar);

  const handleCompactCalendarChange = (compact: boolean) => {
    setCompactCalendar(compact);
  };

  const handleShowSummaryChange = (show: boolean) => {
    setShowSummary(show);
    saveShowSummaryPreference(show);
  };

  const handleShowTeamRosterChange = (show: boolean) => {
    setShowTeamRoster(show);
    saveShowTeamRosterPreference(show);
  };

  const handleShowHousekeepingStatusChange = (show: boolean) => {
    setShowHousekeepingStatus(show);
    saveShowHousekeepingStatusPreference(show);
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

  const { preDepartureBalanceAlerts, postDepartureBalanceAlerts, criticalCount, totalCount } = useAlerts(bookings, rooms);

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
      <header className={cn('border-b flex items-center justify-between bg-white relative z-[150] print:hidden pt-safe pl-safe pr-safe', layout.appHeaderMinH)}>
        <div className="flex items-center gap-3 min-w-0 flex-1 mr-2 pl-3 sm:pl-5">
          <h1 className={cn('font-bold tracking-tight leading-tight truncate', layout.appTitleClass)}>
            <span className="sm:hidden">Pachamama</span>
            <span className="hidden sm:inline">Pachamama Calendar</span>
          </h1>
        </div>

        <div className="flex items-center gap-2 sm:gap-4 shrink-0 pr-3 sm:pr-5">
          <div className="flex items-center gap-0.5 sm:gap-1">

            <CalendarViewMenu
              iconSize={layout.appIconSize}
              buttonClassName={iconBtn()}
              compact={compactCalendar}
              showSummary={showSummary}
              showTeamRoster={showTeamRoster}
              showHousekeepingStatus={showHousekeepingStatus}
              onCompactCalendarChange={handleCompactCalendarChange}
              onShowSummaryChange={handleShowSummaryChange}
              onShowTeamRosterChange={handleShowTeamRosterChange}
              onShowHousekeepingStatusChange={handleShowHousekeepingStatusChange}
            />

            <div className="border-l border-gray-100 ml-0.5 pl-1 sm:ml-1 sm:pl-2">
              <button
                type="button"
                onClick={() => setIsHousekeepingOpen(true)}
                className={iconBtn()}
                title="Housekeeping"
                aria-label="Housekeeping"
              >
                <BrushCleaning size={layout.appIconSize} />
              </button>
            </div>

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
                      <span className="absolute top-0 right-0 translate-x-1/3 -translate-y-1/3 min-w-[13px] h-3.5 px-0.5 bg-rose-500 text-white text-[7px] font-bold rounded-full flex items-center justify-center border border-white leading-none pointer-events-none">
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
                          <span className="text-xs font-bold text-gray-500">Balance Alerts</span>
                          {totalCount > 0 && <span className="text-xs text-gray-400">{totalCount} items</span>}
                        </div>
                        <div className="overflow-y-auto flex-1 min-h-0 sm:max-h-[70vh]">
                        {totalCount === 0 ? (
                          <div className="p-6 text-center text-xs text-gray-400 font-bold italic">All clear — no outstanding balances</div>
                        ) : (
                          <>
                            {preDepartureBalanceAlerts.length > 0 && (
                              <div className="mt-1">
                                <p className="px-3 pt-2 pb-1 text-xs font-bold text-amber-500">
                                  Before & during stay ({preDepartureBalanceAlerts.length})
                                </p>
                                {preDepartureBalanceAlerts.map(a => (
                                  <div key={a.bookingId} className="px-3 py-2 rounded-xl hover:bg-amber-50/40 flex items-start gap-2.5">
                                    <div className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 bg-amber-500" />
                                    <div className="min-w-0">
                                      <p className="text-xs font-bold text-gray-900 truncate">{a.guestName}</p>
                                      <p className="text-xs text-gray-400 mt-0.5">
                                        {a.room} ·{' '}
                                        {a.daysUntilCheckIn > 0
                                          ? (a.daysUntilCheckIn === 1 ? 'Arrives tomorrow' : `Arrives in ${a.daysUntilCheckIn}d`)
                                          : a.daysUntilCheckIn === 0
                                            ? 'Arrives today'
                                            : a.daysUntilCheckOut === 0
                                              ? 'Checks out today'
                                              : a.daysUntilCheckOut === 1
                                                ? 'Checks out tomorrow'
                                                : `Currently staying · ${a.daysUntilCheckOut}d left`}
                                      </p>
                                      <p className="text-xs font-bold text-amber-600 mt-0.5">
                                        €{a.remaining.toFixed(0)} remaining
                                      </p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                            {postDepartureBalanceAlerts.length > 0 && (
                              <div className={cn('mt-1', preDepartureBalanceAlerts.length > 0 && 'border-t border-gray-50 pt-1')}>
                                <p className="px-3 pt-2 pb-1 text-xs font-bold text-rose-500">
                                  After departure ({postDepartureBalanceAlerts.length})
                                </p>
                                {postDepartureBalanceAlerts.map(a => (
                                  <div key={a.bookingId} className="px-3 py-2 rounded-xl hover:bg-rose-50/40 flex items-start gap-2.5">
                                    <div className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 bg-rose-500" />
                                    <div className="min-w-0">
                                      <p className="text-xs font-bold text-gray-900 truncate">{a.guestName}</p>
                                      <p className="text-xs text-gray-400 mt-0.5">
                                        {a.room} · {a.daysSinceCheckout === 0 ? 'Checked out today' : `${a.daysSinceCheckout}d since checkout`}
                                      </p>
                                      <p className="text-xs font-bold text-rose-600 mt-0.5">
                                        €{a.remaining.toFixed(0)} remaining
                                      </p>
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

                {/* Desktop: Settings */}
                <div className="hidden sm:flex items-center gap-1 border-l border-gray-100 ml-1 pl-2">
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
                      <div className="py-1 space-y-0.5">
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
                <div className="w-8 h-8 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center transition-all group-hover:border-blue-200 group-hover:bg-blue-50 overflow-hidden shrink-0">
                  {user?.photoURL ? (
                    <img
                      src={user.photoURL}
                      alt=""
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <UserIcon size={16} className="text-gray-400 group-hover:text-blue-500" />
                  )}
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
          showHousekeepingStatus={showHousekeepingStatus}
          compact={compactCalendar}
          onOpenBookings={isAdmin ? () => setIsStatsOpen(true) : undefined}
          onOpenFinances={isAdmin ? () => setIsDashboardOpen(true) : undefined}
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
            deletedBookings={deletedBookings}
            deletedVenueHires={deletedVenueHires}
            currentUserName={profile?.name}
            currentUserEmail={profile?.email}
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
