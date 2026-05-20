import AuthContainer from './components/auth/AuthContainer';
import Calendar from './components/calendar/Calendar';
import { useAuth } from './hooks/useAuth';
import { LogOut, User as UserIcon, Settings, BarChart2, BrushCleaning, Bell, AlertTriangle } from 'lucide-react';
import { useState, useMemo, useRef, useEffect } from 'react';
import SettingsModal from './components/modals/SettingsModal';
import StatisticsModal from './components/modals/StatisticsModal';
import HousekeepingModal from './components/modals/HousekeepingModal';
import ProfileModal from './components/modals/ProfileModal';
import { BookingDataProvider, useBooking } from './hooks/useBooking';
import { useHousekeeping } from './hooks/useHousekeeping';
import { cn } from './lib/utils';
import { format, parseISO, differenceInHours, isToday } from 'date-fns';

function AppContent() {
  const { profile, logout, isAdmin } = useAuth();
  const { bookingTypes, bookingChannels, users, bookings, venueHires, rooms, retreatTypes, teamPositions, calendarDisplaySettings } = useBooking();
  const { housekeeping, updateStatus, checkAutoDirty } = useHousekeeping(rooms, bookings);
  
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isStatsOpen, setIsStatsOpen] = useState(false);
  const [isHousekeepingOpen, setIsHousekeepingOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  // Close menus on click outside
  const userMenuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const notifications = useMemo(() => {
    return rooms.map(room => {
      const record = housekeeping.find(h => h.roomId === room.id);
      if (!record || record.status === 'clean') return null;

      const nextBooking = bookings
        .filter(b => b.roomId === room.id && isToday(parseISO(b.checkIn)))
        .sort((a, b) => parseISO(a.checkIn).getTime() - parseISO(b.checkIn).getTime())[0];

      let urgency = '';
      let isCritical = false;
      if (nextBooking) {
        const hours = differenceInHours(parseISO(nextBooking.checkIn + 'T15:00:00'), new Date());
        urgency = `check-in in ${hours}hrs`;
        isCritical = hours < 3;
      }

      return {
        roomName: room.name,
        status: record.status,
        urgency,
        isCritical
      };
    }).filter(Boolean);
  }, [rooms, housekeeping, bookings]);

  return (
    <div className="flex flex-col h-screen bg-white overflow-hidden">
      {/* Header bar */}
      <header className="h-14 border-b flex items-center justify-between px-6 bg-white z-50">
        <div className="flex items-center gap-4">
          <h1 className="font-bold text-xl tracking-tight">Pachamama</h1>
          <span className="hidden md:block py-1 px-2.5 bg-gray-100 rounded text-[10px] font-bold uppercase tracking-wider text-gray-500">
            Operations
          </span>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-1">
            <div className="relative">
              <button 
                onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-blue-600 relative"
                title="Notifications"
              >
                <Bell size={18} />
                {notifications.length > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-rose-500 text-white text-[8px] font-black rounded-full flex items-center justify-center border-2 border-white">
                    {notifications.length}
                  </span>
                )}
              </button>

              {isNotificationsOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-2xl border border-gray-100 p-2 z-[60] animate-in fade-in zoom-in-95 duration-100">
                  <div className="px-3 py-2 border-b border-gray-50 flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Notifications</span>
                    {notifications.length > 0 && <div className="w-1.5 h-1.5 rounded-full bg-rose-500" />}
                  </div>
                  <div className="max-h-64 overflow-y-auto mt-1">
                    {notifications.length === 0 ? (
                      <div className="p-4 text-center text-xs text-gray-400 font-bold italic">No pending tasks</div>
                    ) : (
                      notifications.map((n, i) => (
                        <button 
                          key={i}
                          onClick={() => {
                            setIsNotificationsOpen(false);
                            setIsHousekeepingOpen(true);
                          }}
                          className={cn(
                            "w-full text-left p-3 rounded-xl hover:bg-gray-50 flex items-start gap-3 transition-colors group",
                            n?.isCritical && "bg-rose-50/50 hover:bg-rose-50"
                          )}
                        >
                          <div className={cn(
                            "w-2 h-2 rounded-full mt-1.5",
                            n?.status === 'dirty' ? "bg-rose-500" : "bg-amber-500"
                          )} />
                          <div>
                            <p className="text-xs font-black text-gray-900 group-hover:text-blue-600 transition-colors uppercase tracking-tight">
                              {n?.roomName} — needs {n?.status === 'dirty' ? 'cleaning' : 'inspection'}
                            </p>
                            {n?.urgency && (
                              <p className={cn(
                                "text-[10px] font-bold mt-0.5 flex items-center gap-1",
                                n.isCritical ? "text-rose-500" : "text-gray-400"
                              )}>
                                <AlertTriangle size={10} />
                                {n.urgency}
                              </p>
                            )}
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <button 
              onClick={() => setIsHousekeepingOpen(true)}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-blue-600"
              title="Housekeeping"
            >
              <BrushCleaning size={18} />
            </button>

            {isAdmin && (
              <>
                <button 
                  onClick={() => setIsStatsOpen(true)}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-blue-600"
                  title="Statistics"
                >
                  <BarChart2 size={18} />
                </button>
                <button 
                  onClick={() => setIsSettingsOpen(true)}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-blue-600"
                  title="Settings"
                >
                  <Settings size={18} />
                </button>
              </>
            )}

            <div className="relative border-l ml-2 pl-4" ref={userMenuRef}>
              <button 
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className="flex items-center gap-2 group"
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
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-2xl shadow-2xl border border-gray-100 p-2 z-[60] animate-in fade-in zoom-in-95 duration-100">
                  <div className="px-3 py-2.5 border-b border-gray-50 flex flex-col">
                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Account</span>
                    <span className="text-xs font-bold text-gray-900 truncate mt-0.5">{profile?.email}</span>
                  </div>
                  <div className="mt-1 space-y-0.5">
                    <button 
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        setIsProfileOpen(true);
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all font-bold text-xs"
                    >
                      <UserIcon size={14} /> Profile
                    </button>
                    <button 
                      onClick={logout}
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
        <Calendar rooms={rooms} bookings={bookings} housekeeping={housekeeping} />
      </main>

      <HousekeepingModal
        isOpen={isHousekeepingOpen}
        onClose={() => setIsHousekeepingOpen(false)}
        rooms={rooms}
        bookings={bookings}
        housekeeping={housekeeping}
        updateStatus={updateStatus}
        checkAutoDirty={checkAutoDirty}
      />

      <ProfileModal 
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
      />

      {isAdmin && (
        <>
          <SettingsModal 
            isOpen={isSettingsOpen}
            onClose={() => setIsSettingsOpen(false)}
            bookingTypes={bookingTypes}
            bookingChannels={bookingChannels}
            users={users}
            rooms={rooms}
            retreatTypes={retreatTypes}
            teamPositions={teamPositions}
            displaySettings={calendarDisplaySettings}
          />
          <StatisticsModal
            isOpen={isStatsOpen}
            onClose={() => setIsStatsOpen(false)}
            bookings={bookings}
            venueHires={venueHires}
            rooms={rooms}
            bookingChannels={bookingChannels}
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
