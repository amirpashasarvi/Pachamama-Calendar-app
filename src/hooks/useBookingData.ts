import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, doc, setDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '@/services/firebase';
import { Room, Booking, Retreat, RetreatType, GlobalSettings, ConfigOption, UserRecord, VenueHire, TeamPosition, TeamAssignment, CalendarDisplaySettings } from '@/types';

export function useBookingData() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [deletedBookings, setDeletedBookings] = useState<Booking[]>([]);
  const [retreats, setRetreats] = useState<Retreat[]>([]);
  const [retreatTypes, setRetreatTypes] = useState<RetreatType[]>([]);
  const [venueHires, setVenueHires] = useState<VenueHire[]>([]);
  const [deletedVenueHires, setDeletedVenueHires] = useState<VenueHire[]>([]);
  const [bookingTypes, setBookingTypes] = useState<ConfigOption[]>([]);
  const [bookingChannels, setBookingChannels] = useState<ConfigOption[]>([]);
  const [teamPositions, setTeamPositions] = useState<TeamPosition[]>([]);
  const [teamAssignments, setTeamAssignments] = useState<TeamAssignment[]>([]);
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [settings, setSettings] = useState<GlobalSettings | null>(null);
  const [calendarDisplaySettings, setCalendarDisplaySettings] = useState<CalendarDisplaySettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loaded = {
      rooms: false,
      bookings: false,
      retreats: false,
      retreatTypes: false,
      venueHires: false,
      settings: false,
      calendarDisplay: false,
      bookingTypes: false,
      bookingChannels: false,
      teamPositions: false,
      teamAssignments: false,
      users: false
    };

    const checkLoading = (key: keyof typeof loaded) => {
      loaded[key] = true;
      if (Object.values(loaded).every(v => v)) {
        setLoading(false);
      }
    };

    const qRooms = query(collection(db, 'rooms'), orderBy('order', 'asc'));
    const unsubRooms = onSnapshot(qRooms, (snap) => {
      const roomData: Room[] = [];
      snap.docs.forEach(d => {
        roomData.push({ ...d.data(), id: d.id } as Room);
      });
      setRooms(roomData);
      checkLoading('rooms');
    }, (error) => {
      checkLoading('rooms');
      handleFirestoreError(error, OperationType.LIST, 'rooms');
    });

    const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

    const unsubBookings = onSnapshot(collection(db, 'bookings'), (snap) => {
      const active: Booking[] = [];
      const deleted: Booking[] = [];
      snap.docs.forEach(d => {
        const item = { ...d.data(), id: d.id } as Booking;
        if (item.deletedAt) {
          if (Date.now() - new Date(item.deletedAt).getTime() < THIRTY_DAYS_MS) {
            deleted.push(item);
          }
          // Items older than 30 days are silently dropped from both lists
        } else {
          active.push(item);
        }
      });
      setBookings(active);
      setDeletedBookings(deleted);
      checkLoading('bookings');
    }, (error) => {
      checkLoading('bookings');
      handleFirestoreError(error, OperationType.LIST, 'bookings');
    });

    const unsubRetreats = onSnapshot(collection(db, 'retreats'), (snap) => {
      const retreatData: Retreat[] = [];
      snap.docs.forEach(d => {
        retreatData.push({ ...d.data(), id: d.id } as Retreat);
      });
      setRetreats(retreatData);
      checkLoading('retreats');
    }, (error) => {
      checkLoading('retreats');
      handleFirestoreError(error, OperationType.LIST, 'retreats');
    });

    const unsubRetreatTypes = onSnapshot(query(collection(db, 'retreatTypes'), orderBy('name', 'asc')), (snap) => {
      const data: RetreatType[] = [];
      snap.docs.forEach(d => {
        data.push({ ...d.data(), id: d.id } as RetreatType);
      });
      setRetreatTypes(data);
      checkLoading('retreatTypes');
    }, (error) => {
      checkLoading('retreatTypes');
      handleFirestoreError(error, OperationType.LIST, 'retreatTypes');
    });

    const unsubVenueHires = onSnapshot(collection(db, 'venueHires'), (snap) => {
      const active: VenueHire[] = [];
      const deleted: VenueHire[] = [];
      snap.docs.forEach(d => {
        const item = { ...d.data(), id: d.id } as VenueHire;
        if (item.deletedAt) {
          if (Date.now() - new Date(item.deletedAt).getTime() < THIRTY_DAYS_MS) {
            deleted.push(item);
          }
        } else {
          active.push(item);
        }
      });
      setVenueHires(active);
      setDeletedVenueHires(deleted);
      checkLoading('venueHires');
    }, (error) => {
      checkLoading('venueHires');
      handleFirestoreError(error, OperationType.LIST, 'venueHires');
    });

    const unsubTypes = onSnapshot(collection(db, 'bookingTypes'), (snap) => {
      const data: ConfigOption[] = snap.docs.map(d => ({ ...d.data(), id: d.id } as ConfigOption));
      data.sort((a, b) => {
        const ao = a.sortOrder ?? Infinity;
        const bo = b.sortOrder ?? Infinity;
        if (ao !== bo) return ao - bo;
        return a.name.localeCompare(b.name);
      });
      setBookingTypes(data);
      checkLoading('bookingTypes');
    }, (error) => {
      checkLoading('bookingTypes');
      handleFirestoreError(error, OperationType.LIST, 'bookingTypes');
    });

    const unsubChannels = onSnapshot(collection(db, 'bookingChannels'), (snap) => {
      const data: ConfigOption[] = snap.docs.map(d => ({ ...d.data(), id: d.id } as ConfigOption));
      data.sort((a, b) => {
        const ao = a.sortOrder ?? Infinity;
        const bo = b.sortOrder ?? Infinity;
        if (ao !== bo) return ao - bo;
        return a.name.localeCompare(b.name);
      });
      setBookingChannels(data);
      checkLoading('bookingChannels');
    }, (error) => {
      checkLoading('bookingChannels');
      handleFirestoreError(error, OperationType.LIST, 'bookingChannels');
    });

    const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
      const byEmail = new Map<string, UserRecord>();
      snap.docs.forEach(d => {
        const user = d.data() as Partial<UserRecord>;
        const email = (user.email || '').trim().toLowerCase();
        if (!email) return;
        const candidate: UserRecord = {
          id: d.id,
          uid: user.uid || '',
          name: user.name || email || 'Unnamed user',
          email,
          role: user.role === 'admin' ? 'admin' : 'staff',
          createdAt: user.createdAt,
        };

        const current = byEmail.get(email);
        const candidateIsUidDoc = candidate.uid && candidate.id === candidate.uid;
        const currentIsUidDoc = current?.uid && current.id === current.uid;
        if (!current || (candidateIsUidDoc && !currentIsUidDoc)) {
          byEmail.set(email, candidate);
        }
      });
      setUsers(Array.from(byEmail.values()).sort((a, b) => a.name.localeCompare(b.name)));
      checkLoading('users');
    }, (error) => {
      checkLoading('users');
      console.error('Users listener failed', error);
      handleFirestoreError(error, OperationType.LIST, 'users');
    });

    const unsubPositions = onSnapshot(query(collection(db, 'teamPositions'), orderBy('order', 'asc')), (snap) => {
      const data: TeamPosition[] = [];
      snap.docs.forEach(d => {
        data.push({ ...d.data(), id: d.id } as TeamPosition);
      });
      setTeamPositions(data);
      checkLoading('teamPositions');
    }, (error) => {
      checkLoading('teamPositions');
      handleFirestoreError(error, OperationType.LIST, 'teamPositions');
    });

    const unsubAssignments = onSnapshot(collection(db, 'teamAssignments'), (snap) => {
      const data: TeamAssignment[] = [];
      snap.docs.forEach(d => {
        data.push({ ...d.data(), id: d.id } as TeamAssignment);
      });
      setTeamAssignments(data);
      checkLoading('teamAssignments');
    }, (error) => {
      checkLoading('teamAssignments');
      handleFirestoreError(error, OperationType.LIST, 'teamAssignments');
    });

    const unsubSettings = onSnapshot(collection(db, 'settings'), (snap) => {
      const global = snap.docs.find(d => d.id === 'global');
      if (global) {
        setSettings(global.data() as GlobalSettings);
      } else {
        setSettings({
          bookingTypes: ['Retreat', 'Coliving', 'Festival', 'Venue Hire'],
          bookingSources: [
            'direct',
            'WeTravel',
            'Mangobeds',
            'BookRetreat',
            'BookYogaRetreat',
            'Responsible Travel',
            'Coliving.com',
            'MapMelon'
          ]
        });
      }
      checkLoading('settings');

      const defaultBookingBarFields = [
        { id: 'guestName', label: 'Guest Name', enabled: true },
        { id: 'adultsKids', label: 'Adults / Kids', enabled: false },
        { id: 'bookingType', label: 'Booking Type', enabled: false },
        { id: 'notes', label: 'Notes', enabled: false },
        { id: 'bookingChannel', label: 'Booking Channel', enabled: false },
        { id: 'paymentStatus', label: 'Payment Status', enabled: false },
        { id: 'dietary', label: 'Dietary Requirements', enabled: false },
      ];
      const defaultTeamRosterBarFields = [
        { id: 'name', label: 'Name', enabled: true },
        { id: 'accommodationNotes', label: 'Accommodation Notes', enabled: false },
      ];

      const display = snap.docs.find(d => d.id === 'calendarDisplay');
      if (display) {
        const existing = display.data() as CalendarDisplaySettings;
        const existingIds = new Set(existing.bookingBarFields.map((f: any) => f.id));
        const missingFields = defaultBookingBarFields.filter(f => !existingIds.has(f.id));
        if (missingFields.length > 0) {
          const merged = { ...existing, bookingBarFields: [...existing.bookingBarFields, ...missingFields] };
          setCalendarDisplaySettings(merged);
          setDoc(doc(db, 'settings', 'calendarDisplay'), merged).catch(() => {});
        } else {
          setCalendarDisplaySettings(existing);
        }
      } else {
        setCalendarDisplaySettings({
          bookingBarFields: defaultBookingBarFields,
          teamRosterBarFields: defaultTeamRosterBarFields,
        });
      }
      checkLoading('calendarDisplay');
    }, (error) => {
      checkLoading('settings');
      checkLoading('calendarDisplay');
      handleFirestoreError(error, OperationType.LIST, 'settings');
    });

    return () => {
      unsubRooms();
      unsubBookings();
      unsubRetreats();
      unsubRetreatTypes();
      unsubVenueHires();
      unsubTypes();
      unsubChannels();
      unsubUsers();
      unsubPositions();
      unsubAssignments();
      unsubSettings();
    };
  }, []);

  return { rooms, bookings, deletedBookings, retreats, retreatTypes, teamPositions, teamAssignments, venueHires, deletedVenueHires, settings, calendarDisplaySettings, bookingTypes, bookingChannels, users, loading };
}
