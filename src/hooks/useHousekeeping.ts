import { useState, useEffect } from 'react';
import { 
  collection, 
  onSnapshot, 
  doc, 
  setDoc, 
  updateDoc, 
  query, 
  where 
} from 'firebase/firestore';
import { db } from '@/services/firebase';
import { HousekeepingRecord, Room, Booking } from '@/types';
import { format, parseISO, isSameDay, startOfToday } from 'date-fns';

export function useHousekeeping(rooms: Room[], bookings: Booking[]) {
  const [housekeeping, setHousekeeping] = useState<HousekeepingRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!rooms.length) return;

    const unsub = onSnapshot(collection(db, 'housekeeping'), (snapshot) => {
      const records = snapshot.docs.map(doc => doc.data() as HousekeepingRecord);
      setHousekeeping(records);
      setLoading(false);
    }, (error) => {
      console.error('Housekeeping snapshot error:', error);
      // Silently handle permission errors which can happen during auth transitions
      if (error.code === 'permission-denied') {
        console.warn('Housekeeping: Permission denied. User might not be fully authenticated yet.');
      }
      setLoading(false);
    });

    return () => unsub();
  }, [rooms.length]);

  const updateStatus = async (roomId: string, updates: Partial<HousekeepingRecord>) => {
    const docRef = doc(db, 'housekeeping', roomId);
    const now = new Date().toISOString();
    
    // Determine status based on cleaned/inspected if not explicitly provided
    let status = updates.status;
    if (!status) {
      const current = housekeeping.find(h => h.roomId === roomId);
      const isCleaned = updates.cleaned !== undefined ? updates.cleaned : (current?.cleaned || false);
      const isInspected = updates.inspected !== undefined ? updates.inspected : (current?.inspected || false);
      
      if (isInspected) status = 'clean';
      else if (isCleaned) status = 'inspected';
      else status = 'dirty';
    }

    try {
      const current = housekeeping.find(h => h.roomId === roomId);
      await setDoc(docRef, {
        roomId,
        cleaned: false,
        inspected: false,
        lastCheckout: null,
        nextCheckin: null,
        ...current,
        ...updates,
        status, // This correctly overrides anything from current or updates
        lastUpdated: now
      }, { merge: true });
    } catch (error) {
      console.error('Error updating housekeeping:', error);
    }
  };

  const checkAutoDirty = async () => {
    const today = startOfToday();
    const todayStr = format(today, 'yyyy-MM-dd');

    for (const room of rooms) {
      // Find a booking checking out today for this room
      const checkoutToday = bookings.find(b => b.roomId === room.id && b.checkOut === todayStr);
      
      if (checkoutToday) {
        const record = housekeeping.find(h => h.roomId === room.id);
        
        // Only set to dirty if it was clean or if lastCheckout is not already today (avoid redundant updates)
        if (!record || (record.status === 'clean' && record.lastCheckout !== todayStr)) {
          console.log(`Setting room ${room.name} to dirty because of checkout today`);
          await updateStatus(room.id, {
            status: 'dirty',
            cleaned: false,
            inspected: false,
            lastCheckout: todayStr
          });
        }
      }

      // Update next check-in
      const futureBookings = bookings
        .filter(b => b.roomId === room.id && parseISO(b.checkIn) >= today)
        .sort((a, b) => parseISO(a.checkIn).getTime() - parseISO(b.checkIn).getTime());
      
      const nextCheckin = futureBookings[0] ? futureBookings[0].checkIn : null;
      const record = housekeeping.find(h => h.roomId === room.id);
      
      if (record && record.nextCheckin !== nextCheckin) {
        await updateStatus(room.id, { nextCheckin });
      } else if (!record && nextCheckin) {
        await updateStatus(room.id, { nextCheckin, status: 'clean', cleaned: true, inspected: true });
      }
    }
  };

  return {
    housekeeping,
    loading,
    updateStatus,
    checkAutoDirty
  };
}
