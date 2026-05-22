import { updateDoc, doc, deleteField } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '@/services/firebase';
import { Booking, VenueHire } from '@/types';
import { differenceInDays, parseISO, format } from 'date-fns';
import { Trash2, RotateCcw, Calendar } from 'lucide-react';
import Modal from '@/components/ui/Modal';

interface TrashedItemsModalProps {
  isOpen: boolean;
  onClose: () => void;
  deletedBookings: Booking[];
  deletedVenueHires: VenueHire[];
}

const THIRTY_DAYS = 30;

function daysRemaining(deletedAt: string): number {
  const daysSince = differenceInDays(new Date(), parseISO(deletedAt));
  return Math.max(0, THIRTY_DAYS - daysSince);
}

function safeFormat(iso: string | undefined, fmt: string): string {
  if (!iso) return '';
  try { return format(parseISO(iso), fmt); }
  catch { return iso; }
}

export default function TrashedItemsModal({
  isOpen, onClose, deletedBookings, deletedVenueHires
}: TrashedItemsModalProps) {

  const handleRestore = async (collectionName: string, id: string) => {
    try {
      await updateDoc(doc(db, collectionName, id), { deletedAt: deleteField() });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `${collectionName}/${id}`);
    }
  };

  const allDeleted = [
    ...deletedBookings.map(b => ({
      id: b.id,
      collectionName: 'bookings',
      name: b.guestName,
      badge: b.type || 'Booking',
      dateRange: `${safeFormat(b.checkIn, 'dd MMM')} – ${safeFormat(b.checkOut, 'dd MMM yyyy')}`,
      deletedAt: b.deletedAt!,
    })),
    ...deletedVenueHires.map(v => ({
      id: v.id,
      collectionName: 'venueHires',
      name: v.name,
      badge: 'Venue Hire',
      dateRange: `${safeFormat(v.startDate, 'dd MMM')} – ${safeFormat(v.endDate, 'dd MMM yyyy')}`,
      deletedAt: v.deletedAt!,
    })),
  ].sort((a, b) => b.deletedAt.localeCompare(a.deletedAt));

  const isEmpty = allDeleted.length === 0;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEmpty ? 'Recently Deleted' : `Recently Deleted (${allDeleted.length})`}
    >
      {isEmpty ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-gray-400">
          <Trash2 size={32} strokeWidth={1.5} />
          <p className="text-sm font-bold">No recently deleted items</p>
          <p className="text-xs text-center max-w-xs leading-relaxed">
            Deleted bookings and venue hires appear here for 30 days before being permanently removed.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-gray-400 pb-2">
            Items move here when deleted and stay recoverable for 30 days.
          </p>
          {allDeleted.map(item => {
            const remaining = daysRemaining(item.deletedAt);
            const isExpiringSoon = remaining <= 5;
            return (
              <div
                key={`${item.collectionName}-${item.id}`}
                className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-gray-800 truncate">{item.name}</span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 bg-gray-200 text-gray-500 rounded uppercase tracking-wide shrink-0">
                      {item.badge}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                    <span className="text-xs text-gray-500 flex items-center gap-1">
                      <Calendar size={10} />
                      {item.dateRange}
                    </span>
                    <span className={`text-[10px] font-black ${isExpiringSoon ? 'text-rose-500' : 'text-amber-500'}`}>
                      {remaining}d left
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => handleRestore(item.collectionName, item.id)}
                  className="flex items-center gap-1.5 px-3 py-2.5 bg-white border border-gray-200 rounded-lg text-xs font-bold text-gray-700 hover:bg-green-50 hover:border-green-300 hover:text-green-700 transition-colors shrink-0"
                >
                  <RotateCcw size={12} /> Restore
                </button>
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
}
