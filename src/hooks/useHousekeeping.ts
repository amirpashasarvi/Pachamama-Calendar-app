import { useState, useEffect, useRef } from 'react';
import { collection, onSnapshot, doc, setDoc } from 'firebase/firestore';
import { db } from '@/services/firebase';
import { HousekeepingRecord, HousekeepingHistoryEntry, Room, Booking } from '@/types';
import { format, parseISO, startOfToday } from 'date-fns';

export function useHousekeeping(rooms: Room[], bookings: Booking[], currentUserName?: string) {
  const [housekeeping, setHousekeeping] = useState<HousekeepingRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Stable refs so callbacks always read latest state without stale closures
  const stateRef = useRef({ rooms, bookings, housekeeping });
  stateRef.current = { rooms, bookings, housekeeping };

  useEffect(() => {
    if (!rooms.length) return;

    const unsub = onSnapshot(collection(db, 'housekeeping'), (snapshot) => {
      const records = snapshot.docs.map(d => d.data() as HousekeepingRecord);
      setHousekeeping(records);
      setLoading(false);
    }, (error) => {
      console.error('Housekeeping snapshot error:', error);
      if (error.code === 'permission-denied') {
        console.warn('Housekeeping: Permission denied during auth transition.');
      }
      setLoading(false);
    });

    return () => unsub();
  }, [rooms.length]);

  const updateStatus = async (
    roomId: string,
    updates: Partial<HousekeepingRecord>,
    actorName?: string
  ) => {
    const { housekeeping: currentHk } = stateRef.current;
    const docRef = doc(db, 'housekeeping', roomId);
    const now = new Date().toISOString();

    // Only compute a new status when the caller is explicitly changing status-related fields.
    // Metadata-only updates (nextCheckin, notes, assignedTo) must NOT recompute status — doing so
    // creates a race condition where a stale read clobbers a concurrent user action.
    const isStatusAction = updates.status !== undefined || updates.cleaned !== undefined || updates.inspected !== undefined;

    let status: string | undefined;
    if (isStatusAction) {
      status = updates.status;
      if (!status) {
        const current = currentHk.find(h => h.roomId === roomId);
        const isCleaned = updates.cleaned !== undefined ? updates.cleaned : (current?.cleaned || false);
        const isInspected = updates.inspected !== undefined ? updates.inspected : (current?.inspected || false);
        if (isInspected) status = 'clean';
        else if (isCleaned) status = 'cleaned';
        else status = 'dirty';
      }
    }

    const actor = actorName || currentUserName;

    // Attribution: track who performed each step; clear on reset
    const attributionUpdates: Partial<HousekeepingRecord> = {};
    if (updates.cleaned === true && actor)  attributionUpdates.cleanedBy = actor;
    if (updates.cleaned === false)          attributionUpdates.cleanedBy = '';
    if (updates.inspected === true && actor) attributionUpdates.inspectedBy = actor;
    if (updates.inspected === false)        attributionUpdates.inspectedBy = '';
    if (updates.status === 'dirty') {
      attributionUpdates.cleanedBy = '';
      attributionUpdates.inspectedBy = '';
    }

    let newHistory: HousekeepingHistoryEntry[] | undefined;

    if (isStatusAction && actor && status) {
      const actionLabel: Record<string, string> = {
        dirty: 'Reset to dirty',
        cleaned: 'Marked cleaned',
        clean: 'Marked ready',
      };
      const current = currentHk.find(h => h.roomId === roomId);
      const existing = current?.history || [];
      newHistory = [
        ...existing.slice(-19),
        { action: actionLabel[status] ?? status, timestamp: now, userName: actor },
      ];
    }

    try {
      const current = currentHk.find(h => h.roomId === roomId);
      await setDoc(docRef, {
        roomId,
        cleaned: false,
        inspected: false,
        lastCheckout: null,
        nextCheckin: null,
        notes: '',
        ...current,
        ...updates,
        ...attributionUpdates,
        ...(status !== undefined ? { status } : {}),
        lastUpdated: now,
        ...(newHistory ? { history: newHistory } : {}),
      }, { merge: true });
    } catch (error) {
      console.error('Error updating housekeeping:', error);
    }
  };

  const checkAutoDirty = async () => {
    // rooms and bookings are stable within a single run — only housekeeping is re-read
    // fresh per room to avoid stale-capture clobbering concurrent user actions.
    const { rooms: currentRooms, bookings: currentBookings } = stateRef.current;
    const today = startOfToday();
    const todayStr = format(today, 'yyyy-MM-dd');

    for (const room of currentRooms) {
      // Read housekeeping fresh for every iteration — a previous await may have let
      // onSnapshot fire and update stateRef, so this reflects the latest known state.
      const liveHk = stateRef.current.housekeeping;

      const checkoutToday = currentBookings.find(
        b => b.roomId === room.id && b.checkOut === todayStr
      );

      if (checkoutToday) {
        const record = liveHk.find(h => h.roomId === room.id);
        if (!record || (record.status === 'clean' && record.lastCheckout !== todayStr)) {
          await updateStatus(room.id, {
            status: 'dirty',
            cleaned: false,
            inspected: false,
            lastCheckout: todayStr,
          });
        }
      }

      // Re-read after the potential dirty write so nextCheckin logic sees latest state
      const liveHkAfter = stateRef.current.housekeeping;
      const record = liveHkAfter.find(h => h.roomId === room.id);

      const nextCheckin = currentBookings
        .filter(b => b.roomId === room.id && parseISO(b.checkIn) >= today)
        .sort((a, b) => parseISO(a.checkIn).getTime() - parseISO(b.checkIn).getTime())[0]?.checkIn ?? null;

      if (record && record.nextCheckin !== nextCheckin) {
        // Metadata-only — status intentionally omitted (see updateStatus fix)
        await updateStatus(room.id, { nextCheckin });
      } else if (!record && nextCheckin && !checkoutToday) {
        // Only create a clean record when no checkout is happening today
        await updateStatus(room.id, { nextCheckin, status: 'clean', cleaned: true, inspected: true });
      }
    }
  };

  // Keep a stable ref to the latest checkAutoDirty for use in effects
  const checkAutoDirtyRef = useRef(checkAutoDirty);
  checkAutoDirtyRef.current = checkAutoDirty;

  // Run once after initial data loads
  const hasAutoChecked = useRef(false);
  useEffect(() => {
    if (!loading && !hasAutoChecked.current) {
      hasAutoChecked.current = true;
      checkAutoDirtyRef.current();
    }
  }, [loading]);

  // Re-run every 30 minutes to catch midnight rollovers and missed checkouts
  useEffect(() => {
    const interval = setInterval(() => {
      checkAutoDirtyRef.current();
    }, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  return { housekeeping, loading, updateStatus, checkAutoDirty };
}
