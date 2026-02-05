'use client';

import { PrivyProvider, usePrivy, useLogin, useLogout } from '@privy-io/react-auth';
import { createContext, useContext, ReactNode, useCallback, useState, useEffect } from 'react';

// Auth context types
export interface AuthUser {
  id: string;  // Privy DID
  email?: string;
  walletAddress?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isConfigured: boolean;
  login: () => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

// Get initial theme from localStorage (runs on client only)
function getInitialTheme(): 'dark' | 'light' {
  if (typeof window === 'undefined') return 'dark';
  const saved = localStorage.getItem('gov-watch-theme');
  return saved === 'light' ? 'light' : 'dark';
}

// Hook to use auth context
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

// Inner provider that uses Privy hooks (only rendered when Privy is configured)
function PrivyAuthInner({ children }: { children: ReactNode }) {
  const { ready, authenticated, user: privyUser } = usePrivy();
  const { login: privyLogin } = useLogin();
  const { logout: privyLogout } = useLogout();

  const user: AuthUser | null = privyUser
    ? {
        id: privyUser.id,
        email: privyUser.email?.address,
        walletAddress: privyUser.wallet?.address,
      }
    : null;

  // Sync user to database on login
  useEffect(() => {
    if (authenticated && privyUser) {
      fetch('/api/user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          privyDid: privyUser.id,
          email: privyUser.email?.address,
          walletAddress: privyUser.wallet?.address,
        }),
      }).catch(() => {}); // Silent fail — DB might not be configured
    }
  }, [authenticated, privyUser]);

  const login = useCallback(() => {
    privyLogin();
  }, [privyLogin]);

  const logout = useCallback(async () => {
    await privyLogout();
    // Clear guest mode so user returns to login screen
    localStorage.removeItem('discuss-watch-guest-mode');
    // Redirect to landing page
    window.location.href = '/';
  }, [privyLogout]);

  const value: AuthContextType = {
    user,
    isAuthenticated: authenticated,
    isLoading: !ready,
    isConfigured: true,
    login,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// Fallback provider when Privy is not configured
function NoAuthProvider({ children }: { children: ReactNode }) {
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  const value: AuthContextType = {
    user: null,
    isAuthenticated: false,
    isLoading: !isHydrated,
    isConfigured: false,
    login: () => {
      console.warn('Authentication is not configured. Set NEXT_PUBLIC_PRIVY_APP_ID to enable.');
    },
    logout: async () => {},
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// Main AuthProvider component
interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [mounted, setMounted] = useState(false);

  // Read theme from localStorage on mount and listen for changes
  useEffect(() => {
    setTheme(getInitialTheme());
    setMounted(true);

    // Listen for theme changes via storage event (cross-tab) and custom event (same tab)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'gov-watch-theme') {
        setTheme(e.newValue === 'light' ? 'light' : 'dark');
      }
    };

    const handleThemeChange = () => {
      setTheme(getInitialTheme());
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('themechange', handleThemeChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('themechange', handleThemeChange);
    };
  }, []);

  // If Privy is not configured, use fallback provider
  if (!appId) {
    return <NoAuthProvider>{children}</NoAuthProvider>;
  }

  // Don't render Privy until we know the theme (prevents flash)
  if (!mounted) {
    return null;
  }

  return (
    <PrivyProvider
      appId={appId}
      config={{
        appearance: {
          theme: theme,
          accentColor: '#4f46e5', // Indigo-600 to match app theme
          logo: '/icon.svg',
        },
        loginMethods: ['email', 'google', 'wallet'],
        // Don't auto-create embedded wallets
        embeddedWallets: {
          ethereum: {
            createOnLogin: 'off',
          },
        },
      }}
    >
      <PrivyAuthInner>{children}</PrivyAuthInner>
    </PrivyProvider>
  );
}
