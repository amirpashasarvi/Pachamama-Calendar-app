import React from 'react';
import { useAuth } from '@/hooks/useAuth';
import { LogIn } from 'lucide-react';

export default function AuthContainer({ children }: { children: React.ReactNode }) {
  const { user, loading, login } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#f5f5f5]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-[#f5f5f5]">
        <div className="p-8 bg-white rounded-2xl shadow-xl w-full max-w-md text-center">
          <h1 className="text-3xl font-bold mb-2">Pachamama Retreat</h1>
          <p className="text-gray-500 mb-8">Booking & Operations Dashboard</p>
          <button
            onClick={login}
            className="flex items-center justify-center gap-3 w-full py-4 bg-black text-white rounded-xl font-medium hover:bg-gray-800 transition-all"
          >
            <LogIn size={20} />
            Sign in with Google
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
