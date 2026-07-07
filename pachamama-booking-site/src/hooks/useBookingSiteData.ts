import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db, ensurePublicAuth } from '@/services/firebase';
import type { BookingForm, AccommodationPricing, SeasonalRate, Room, Booking, RetreatType, RetreatRun } from '@/types';

export function useBookingSiteData() {
  const [forms, setForms] = useState<BookingForm[]>([]);
  const [pricing, setPricing] = useState<AccommodationPricing[]>([]);
  const [seasonalRates, setSeasonalRates] = useState<SeasonalRate[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [retreatTypes, setRetreatTypes] = useState<RetreatType[]>([]);
  const [retreatRuns, setRetreatRuns] = useState<RetreatRun[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await ensurePublicAuth();
        if (cancelled) return;
        setReady(true);
      } catch {
        if (!cancelled) setError('Could not connect. Please refresh the page.');
      }
    })();

    const unsubs = [
      onSnapshot(query(collection(db, 'bookingForms'), orderBy('name', 'asc')), snap => {
        setForms(snap.docs.map(d => ({ ...d.data(), id: d.id } as BookingForm)));
      }),
      onSnapshot(collection(db, 'accommodationPricing'), snap => {
        setPricing(snap.docs.map(d => ({ ...d.data(), id: d.id } as AccommodationPricing)));
      }),
      onSnapshot(collection(db, 'seasonalRates'), snap => {
        setSeasonalRates(snap.docs.map(d => ({ ...d.data(), id: d.id } as SeasonalRate)));
      }),
      onSnapshot(query(collection(db, 'rooms'), orderBy('order', 'asc')), snap => {
        setRooms(snap.docs.map(d => ({ ...d.data(), id: d.id } as Room)));
      }),
      onSnapshot(collection(db, 'bookings'), snap => {
        setBookings(snap.docs.map(d => ({ ...d.data(), id: d.id } as Booking)).filter(b => !b.deletedAt));
      }),
      onSnapshot(query(collection(db, 'retreatTypes'), orderBy('name', 'asc')), snap => {
        setRetreatTypes(snap.docs.map(d => ({ ...d.data(), id: d.id } as RetreatType)));
      }),
      onSnapshot(collection(db, 'retreats'), snap => {
        setRetreatRuns(snap.docs.map(d => ({ ...d.data(), id: d.id } as RetreatRun)));
      }),
    ];

    return () => {
      cancelled = true;
      unsubs.forEach(u => u());
    };
  }, []);

  return { forms, pricing, seasonalRates, rooms, bookings, retreatTypes, retreatRuns, ready, error };
}
