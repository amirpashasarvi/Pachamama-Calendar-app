import { updateDoc, doc, deleteField } from 'firebase/firestore';
import { differenceInDays, format, parseISO } from 'date-fns';
import { db, handleFirestoreError, OperationType } from '@/services/firebase';
import { Booking, VenueHire, ActivityEntityType } from '@/types';
import { logActivity } from '@/lib/activityLog';

export const RECOVERABLE_DAYS = 30;

export interface RecoverableItem {
  id: string;
  collectionName: 'bookings' | 'venueHires';
  entityType: ActivityEntityType;
  name: string;
  badge: string;
  dateRange: string;
  deletedAt: string;
}

function safeFormat(iso: string | undefined, fmt: string): string {
  if (!iso) return '';
  try {
    return format(parseISO(iso), fmt);
  } catch {
    return iso;
  }
}

export function daysRemaining(deletedAt: string): number {
  const daysSince = differenceInDays(new Date(), parseISO(deletedAt));
  return Math.max(0, RECOVERABLE_DAYS - daysSince);
}

export function buildRecoverableItems(
  deletedBookings: Booking[],
  deletedVenueHires: VenueHire[],
): RecoverableItem[] {
  return [
    ...deletedBookings.map(b => ({
      id: b.id,
      collectionName: 'bookings' as const,
      entityType: 'booking' as const,
      name: b.guestName,
      badge: b.type || 'Booking',
      dateRange: `${safeFormat(b.checkIn, 'dd MMM')} – ${safeFormat(b.checkOut, 'dd MMM yyyy')}`,
      deletedAt: b.deletedAt!,
    })),
    ...deletedVenueHires.map(v => ({
      id: v.id,
      collectionName: 'venueHires' as const,
      entityType: 'venueHire' as const,
      name: v.name,
      badge: 'Venue Hire',
      dateRange: `${safeFormat(v.startDate, 'dd MMM')} – ${safeFormat(v.endDate, 'dd MMM yyyy')}`,
      deletedAt: v.deletedAt!,
    })),
  ].sort((a, b) => b.deletedAt.localeCompare(a.deletedAt));
}

export function recoverableKey(entityType: ActivityEntityType, entityId: string): string {
  return `${entityType}:${entityId}`;
}

export async function restoreDeletedItem(params: {
  collectionName: 'bookings' | 'venueHires';
  entityType: ActivityEntityType;
  id: string;
  name: string;
  userName: string;
  userEmail: string;
}): Promise<void> {
  try {
    await updateDoc(doc(db, params.collectionName, params.id), { deletedAt: deleteField() });
    const label = params.entityType === 'booking' ? 'Booking' : 'Venue Hire';
    await logActivity({
      action: 'restored',
      entityType: params.entityType,
      entityId: params.id,
      summary: `${label} restored · ${params.name}`,
      userName: params.userName || params.userEmail,
      userEmail: params.userEmail,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `${params.collectionName}/${params.id}`);
    throw err;
  }
}
