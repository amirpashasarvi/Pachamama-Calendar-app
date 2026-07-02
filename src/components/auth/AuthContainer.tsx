import React from 'react';
import { useAuth } from '@/hooks/useAuth';
import { AlertTriangle, LogIn, LogOut } from 'lucide-react';

export default function AuthContainer({ children }: { children: React.ReactNode }) {
  const { user, profile, loading, login, logout } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#f5f5f5]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#f5f5f5] px-safe py-safe">
        <div className="p-8 bg-white rounded-2xl shadow-xl w-full max-w-md text-center mx-4">
          <h1 className="text-2xl sm:text-3xl font-bold mb-8">Pachamama Calendar</h1>
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

  if (user && !profile) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-[#f5f5f5] px-4">
        <div className="p-8 bg-white rounded-2xl shadow-xl w-full max-w-md text-center">
          <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-rose-50 text-rose-600">
            <AlertTriangle size={24} />
          </div>
          <h1 className="text-2xl font-bold mb-2">Access denied</h1>
          <p className="text-gray-500 mb-6">
            Your account is not authorized. Please contact the administrator.
          </p>
          <button
            onClick={logout}
            className="flex items-center justify-center gap-3 w-full py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-all"
          >
            <LogOut size={18} />
            Sign out
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
