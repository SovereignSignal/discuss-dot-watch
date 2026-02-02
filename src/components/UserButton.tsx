'use client';

import { LogIn, LogOut, User, Loader2 } from 'lucide-react';
import { useAuth } from './AuthProvider';

export function UserButton() {
  const { user, isAuthenticated, isLoading, isConfigured, login, logout } = useAuth();

  // Don't show anything if auth isn't configured
  if (!isConfigured) {
    return null;
  }

  // Show loading state
  if (isLoading) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 text-gray-400">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-sm">Loading...</span>
      </div>
    );
  }

  // Show login button when not authenticated
  if (!isAuthenticated || !user) {
    return (
      <button
        onClick={login}
        className="flex items-center gap-2 px-3 py-2 w-full rounded-lg text-gray-300 hover:bg-gray-800 hover:text-white transition-colors text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
      >
        <LogIn className="w-4 h-4" />
        <span className="text-sm font-medium">Sign In</span>
      </button>
    );
  }

  // Show user info when authenticated
  const displayName = user.email || truncateAddress(user.walletAddress) || 'User';

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 px-3 py-2">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center">
          <User className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white truncate">{displayName}</p>
          <p className="text-xs text-gray-400">Signed in</p>
        </div>
      </div>
      <button
        onClick={logout}
        className="flex items-center gap-2 px-3 py-1.5 w-full rounded-lg text-gray-400 hover:bg-gray-800 hover:text-white transition-colors text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
      >
        <LogOut className="w-3.5 h-3.5" />
        <span>Sign Out</span>
      </button>
    </div>
  );
}

function truncateAddress(address: string | undefined): string | undefined {
  if (!address) return undefined;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
