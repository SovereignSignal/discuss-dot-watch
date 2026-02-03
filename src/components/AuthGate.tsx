'use client';

import { ReactNode } from 'react';
import { Bell, LogIn, Loader2 } from 'lucide-react';
import { useAuth } from './AuthProvider';

interface AuthGateProps {
  children: ReactNode;
}

/**
 * AuthGate requires users to authenticate before accessing the app.
 * Shows a login screen if not authenticated.
 */
export function AuthGate({ children }: AuthGateProps) {
  const { isAuthenticated, isLoading, isConfigured, login } = useAuth();

  // In development without Privy configured, bypass auth for testing
  if (process.env.NODE_ENV === 'development' && !isConfigured) {
    return <>{children}</>;
  }

  // Show loading state while checking auth
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  // If auth is not configured (no Privy app ID), show error
  if (!isConfigured) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950 p-4">
        <div className="text-center max-w-md">
          <Bell className="w-12 h-12 text-indigo-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">Gov Watch</h1>
          <p className="text-gray-400 mb-6">
            Authentication is not configured. Please set up Privy to enable login.
          </p>
          <p className="text-gray-500 text-sm">
            Contact the administrator to configure <code className="text-indigo-400">NEXT_PUBLIC_PRIVY_APP_ID</code>
          </p>
        </div>
      </div>
    );
  }

  // If not authenticated, show login screen
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950 p-4">
        <div className="text-center max-w-md">
          <div className="mb-8">
            <Bell className="w-16 h-16 text-indigo-500 mx-auto mb-4" />
            <h1 className="text-3xl font-bold text-white mb-2">Gov Watch</h1>
            <p className="text-gray-400">
              Your unified gateway to DAO governance discussions
            </p>
          </div>

          <div className="bg-gray-900 rounded-xl p-6 mb-6">
            <h2 className="text-lg font-semibold text-white mb-4">Sign in to continue</h2>
            <p className="text-gray-400 text-sm mb-6">
              Create an account or sign in to access your personalized governance feed,
              save discussions, and sync across devices.
            </p>
            <button
              onClick={login}
              className="flex items-center justify-center gap-2 w-full px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900"
            >
              <LogIn className="w-5 h-5" />
              Sign In
            </button>
          </div>

          <p className="text-gray-500 text-xs">
            Sign in with email, Google, or your crypto wallet
          </p>
        </div>
      </div>
    );
  }

  // User is authenticated, show the app
  return <>{children}</>;
}
