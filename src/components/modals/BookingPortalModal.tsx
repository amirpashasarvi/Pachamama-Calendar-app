import { useState } from 'react';
import { motion } from 'motion/react';
import { Globe, FileText, Sparkles, Tag, Palmtree, Mail, Users, Coins, CalendarDays } from 'lucide-react';
import { cn } from '@/lib/utils';
import RoomPricingPanel from '@/components/bookingPortal/RoomPricingPanel';
import BookingFormsPanel from '@/components/bookingPortal/BookingFormsPanel';
import RetreatsPanel from '@/components/bookingPortal/RetreatsPanel';

interface BookingPortalModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type PortalSection =
  | 'bookingForms'
  | 'extras'
  | 'promotions'
  | 'retreats'
  | 'communications'
  | 'guestProfiles'
  | 'roomPricing';

const SECTIONS: { id: PortalSection; label: string; icon: typeof FileText; description: string }[] = [
  { id: 'bookingForms', label: 'Booking Forms', icon: FileText, description: 'Create and configure the forms guests use to book — rules, restrictions, payments, and appearance.' },
  { id: 'extras', label: 'Extras', icon: Sparkles, description: 'Add-ons guests can select at checkout, with season-specific pricing.' },
  { id: 'promotions', label: 'Promotions', icon: Tag, description: 'Coupons and automatic long-stay discounts.' },
  { id: 'retreats', label: 'Retreats', icon: Palmtree, description: 'Public-facing retreat details — photos, descriptions, and per-run pricing.' },
  { id: 'communications', label: 'Communications', icon: Mail, description: 'Email templates for booking confirmations, cancellations, and reminders.' },
  { id: 'guestProfiles', label: 'Guest Profiles', icon: Users, description: 'Search guests and see their full booking history across stays.' },
  { id: 'roomPricing', label: 'Room Pricing', icon: Coins, description: 'Per-guest pricing and seasonal rates for each accommodation.' },
];

export default function BookingPortalModal(props: BookingPortalModalProps) {
  if (!props.isOpen) return null;
  return <BookingPortalModalContent {...props} />;
}

function BookingPortalModalContent({ onClose }: BookingPortalModalProps) {
  const [activeSection, setActiveSection] = useState<PortalSection>('bookingForms');
  const active = SECTIONS.find(s => s.id === activeSection)!;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[200] bg-gray-50 flex flex-col pt-safe pb-safe px-safe"
    >
      {/* Header */}
      <header className="h-14 bg-white border-b px-4 sm:px-8 flex items-center justify-between sticky top-0 z-10 shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-1.5 bg-gray-100 text-gray-600 rounded-lg">
            <Globe size={16} />
          </div>
          <h2 className="text-lg font-semibold text-gray-900">Booking Portal</h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gray-900 text-white text-xs font-bold hover:bg-black transition-colors"
          title="Back to calendar"
          aria-label="Back to calendar"
        >
          <CalendarDays size={14} />
          Calendar
        </button>
      </header>

      {/* Mobile section selector — horizontal scroll (sidebar below is desktop-only) */}
      <div className="bg-white border-b shrink-0 sm:hidden">
        <div className="flex overflow-x-auto px-4">
          {SECTIONS.map(s => (
            <button
              key={s.id}
              type="button"
              onClick={() => setActiveSection(s.id)}
              className={cn(
                'px-4 py-3 text-xs font-bold whitespace-nowrap border-b-2 transition-all flex items-center gap-1.5',
                activeSection === s.id
                  ? 'border-black text-black'
                  : 'border-transparent text-gray-400 hover:text-gray-700'
              )}
            >
              <s.icon size={13} />
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar — desktop only */}
        <nav className="hidden sm:block w-60 shrink-0 bg-white border-r overflow-y-auto py-4">
          <div className="px-3 space-y-0.5">
            {SECTIONS.map(s => (
              <button
                key={s.id}
                type="button"
                onClick={() => setActiveSection(s.id)}
                className={cn(
                  'w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold transition-all text-left',
                  activeSection === s.id
                    ? 'bg-gray-900 text-white'
                    : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'
                )}
              >
                <s.icon size={15} />
                {s.label}
              </button>
            ))}
          </div>
        </nav>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-8">
          {activeSection === 'roomPricing' ? (
            <RoomPricingPanel />
          ) : activeSection === 'bookingForms' ? (
            <BookingFormsPanel />
          ) : activeSection === 'retreats' ? (
            <RetreatsPanel />
          ) : (
            <div className="max-w-2xl mx-auto text-center py-16 px-6 bg-white border border-gray-200 rounded-2xl">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-400">
                <active.icon size={22} />
              </div>
              <h3 className="text-base font-bold text-gray-900 mb-1">{active.label}</h3>
              <p className="text-sm text-gray-500 max-w-md mx-auto">{active.description}</p>
              <p className="mt-6 text-[10px] font-black uppercase tracking-widest text-gray-300">Coming soon</p>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
