import React from 'react';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export default function Modal({ isOpen, onClose, title, children, footer }: ModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop — hidden on mobile since modal is full-screen */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-[100] hidden sm:block"
          />

          {/* Content
              Mobile: full-screen sheet (avoids iOS keyboard offset issues)
              Desktop (sm+): centered floating card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed inset-0 sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 w-full sm:max-w-2xl bg-white sm:rounded-2xl shadow-2xl z-[110] overflow-hidden flex flex-col h-full sm:h-auto sm:max-h-[90vh]"
          >
            {/* Header */}
            <div className="shrink-0 flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-xl font-bold tracking-tight">{title}</h2>
              <button
                onClick={onClose}
                className="p-2.5 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-900 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto p-6">
              {children}
            </div>

            {/* Sticky footer — only rendered when passed */}
            {footer && (
              <div className="shrink-0 border-t bg-white px-6 py-4">
                {footer}
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
