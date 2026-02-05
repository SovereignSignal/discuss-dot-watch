'use client';

import { LogIn, LogOut, User, Loader2 } from 'lucide-react';
import { useAuth } from './AuthProvider';
import { useTheme } from '@/hooks/useTheme';

export function UserButton() {
  const { user, isAuthenticated, isLoading, isConfigured, login, logout } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  // Theme tokens
  const textPrimary = isDark ? '#ffffff' : '#09090b';
  const textMuted = isDark ? '#a3a3a3' : '#52525b';
  const textDim = isDark ? '#71717a' : '#71717a';
  const hoverBg = isDark ? '#1f1f23' : 'rgba(0,0,0,0.05)';

  // Don't show anything if auth isn't configured
  if (!isConfigured) {
    return null;
  }

  // Show loading state
  if (isLoading) {
    return (
      <div className="flex items-center gap-2 px-3 py-2" style={{ color: textMuted }}>
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
        className="flex items-center gap-2 px-3 py-2 w-full rounded-lg transition-colors text-left"
        style={{ color: textMuted }}
        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = hoverBg; e.currentTarget.style.color = textPrimary; }}
        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = textMuted; }}
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
        <div className="w-8 h-8 rounded-full flex items-center justify-center"
          style={{ background: isDark ? 'linear-gradient(135deg, #3f3f46, #52525b)' : 'linear-gradient(135deg, #a1a1aa, #71717a)' }}>
          <User className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate" style={{ color: textPrimary }}>{displayName}</p>
          <p className="text-xs" style={{ color: textDim }}>Signed in</p>
        </div>
      </div>
      <button
        onClick={logout}
        className="flex items-center gap-2 px-3 py-1.5 w-full rounded-lg transition-colors text-left text-sm"
        style={{ color: textMuted }}
        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = hoverBg; e.currentTarget.style.color = textPrimary; }}
        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = textMuted; }}
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
