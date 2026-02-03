'use client';

import { ReactNode, useState, useEffect } from 'react';
import { LogIn, Loader2, Globe, Zap, Bell, Shield, ArrowRight, Sun, Moon } from 'lucide-react';
import { useAuth } from './AuthProvider';

interface AuthGateProps {
  children: ReactNode;
}

export function AuthGate({ children }: AuthGateProps) {
  const { isAuthenticated, isLoading, isConfigured, login } = useAuth();
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    const savedTheme = localStorage.getItem('gov-watch-theme') as 'dark' | 'light' | null;
    if (savedTheme) {
      setTheme(savedTheme);
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('gov-watch-theme', newTheme);
    document.documentElement.classList.toggle('light', newTheme === 'light');
    document.documentElement.classList.toggle('dark', newTheme === 'dark');
    // Dispatch custom event so Privy can update its theme
    window.dispatchEvent(new Event('themechange'));
  };

  const isDark = theme === 'dark';

  // Dev bypass
  if (process.env.NODE_ENV === 'development' && !isConfigured) {
    return <>{children}</>;
  }

  // Loading
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: isDark ? '#0a0a0f' : '#f8f9fa' }}>
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
      </div>
    );
  }

  // Not configured
  if (!isConfigured) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: isDark ? '#0a0a0f' : '#f8f9fa' }}>
        <div className="text-center max-w-md">
          <span className="text-5xl block mb-4">🗳️</span>
          <h1 className="text-2xl font-bold mb-2" style={{ color: isDark ? '#fff' : '#111827' }}>Gov Watch</h1>
          <p style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>
            Authentication not configured. Set up Privy to enable login.
          </p>
        </div>
      </div>
    );
  }

  // Not authenticated - show login
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex" style={{ backgroundColor: isDark ? '#0a0a0f' : '#f8f9fa' }}>
        {/* Left - Features (desktop only) */}
        <div 
          className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 border-r"
          style={{
            background: isDark 
              ? 'linear-gradient(135deg, rgba(49,46,129,0.3) 0%, #171717 50%, #171717 100%)' 
              : 'linear-gradient(135deg, rgba(199,210,254,0.5) 0%, #ffffff 50%, #ffffff 100%)',
            borderColor: isDark ? '#262626' : '#e5e7eb'
          }}
        >
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-3xl">🗳️</span>
              <span className="font-bold text-2xl" style={{ color: isDark ? '#fff' : '#111827' }}>Gov Watch</span>
            </div>
            <p style={{ color: isDark ? '#6b7280' : '#6b7280' }}>Governance Forum Aggregator</p>
          </div>

          <div className="space-y-8">
            <h2 className="text-3xl font-bold leading-tight" style={{ color: isDark ? '#fff' : '#111827' }}>
              Your unified gateway to<br />
              <span className="text-indigo-500">DAO governance</span>
            </h2>
            
            <div className="space-y-4">
              <FeatureItem icon={<Globe className="w-5 h-5" />} title="70+ Forums" description="Aave, Uniswap, Arbitrum, and more" isDark={isDark} />
              <FeatureItem icon={<Zap className="w-5 h-5" />} title="Save Hours" description="One feed instead of dozens of tabs" isDark={isDark} />
              <FeatureItem icon={<Bell className="w-5 h-5" />} title="Keyword Alerts" description="Never miss important proposals" isDark={isDark} />
              <FeatureItem icon={<Shield className="w-5 h-5" />} title="Privacy First" description="Optional sync, works offline" isDark={isDark} />
            </div>
          </div>

          <p style={{ color: '#6b7280' }} className="text-sm">
            Open source • No tracking • Free forever
          </p>
        </div>

        {/* Right - Sign in */}
        <div className="flex-1 flex flex-col">
          {/* Theme toggle */}
          <div className="flex justify-end p-4">
            <button
              onClick={toggleTheme}
              className="p-2.5 rounded-lg transition-colors"
              style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }}
              aria-label="Toggle theme"
            >
              {isDark ? <Sun className="w-5 h-5" style={{ color: '#fff' }} /> : <Moon className="w-5 h-5" style={{ color: '#111827' }} />}
            </button>
          </div>

          <div className="flex-1 flex items-center justify-center p-8">
            <div className="w-full max-w-md">
              {/* Mobile header */}
              <div className="lg:hidden text-center mb-8">
                <span className="text-4xl block mb-2">🗳️</span>
                <h1 className="text-2xl font-bold" style={{ color: isDark ? '#fff' : '#111827' }}>Gov Watch</h1>
                <p className="text-sm mt-1" style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>
                  Your unified gateway to DAO governance
                </p>
              </div>

              {/* Sign in card */}
              <div 
                className="rounded-2xl p-8"
                style={{
                  backgroundColor: isDark ? '#171717' : '#ffffff',
                  border: `1px solid ${isDark ? '#262626' : '#e5e7eb'}`
                }}
              >
                <div className="text-center mb-8">
                  <h2 className="text-xl font-semibold mb-2" style={{ color: isDark ? '#fff' : '#111827' }}>Welcome</h2>
                  <p className="text-sm" style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>
                    Sign in to access your personalized governance feed
                  </p>
                </div>

                <button
                  onClick={login}
                  className="flex items-center justify-center gap-2 w-full px-6 py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl transition-colors"
                >
                  <LogIn className="w-5 h-5" />
                  Sign In
                  <ArrowRight className="w-4 h-4" />
                </button>

                <div className="mt-6 pt-6" style={{ borderTop: `1px solid ${isDark ? '#262626' : '#e5e7eb'}` }}>
                  <p className="text-center text-xs mb-4" style={{ color: isDark ? '#6b7280' : '#9ca3af' }}>
                    Sign in with
                  </p>
                  <div className="flex justify-center gap-4 text-sm" style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>
                    <span>Email</span>
                    <span style={{ color: isDark ? '#404040' : '#d1d5db' }}>•</span>
                    <span>Google</span>
                    <span style={{ color: isDark ? '#404040' : '#d1d5db' }}>•</span>
                    <span>Wallet</span>
                  </div>
                </div>
              </div>

              {/* Mobile benefits */}
              <div className="lg:hidden mt-8 grid grid-cols-2 gap-3">
                <MobileBenefit icon={<Globe className="w-4 h-4" />} text="70+ forums" isDark={isDark} />
                <MobileBenefit icon={<Zap className="w-4 h-4" />} text="Save hours" isDark={isDark} />
                <MobileBenefit icon={<Bell className="w-4 h-4" />} text="Alerts" isDark={isDark} />
                <MobileBenefit icon={<Shield className="w-4 h-4" />} text="Private" isDark={isDark} />
              </div>

              <p className="text-center text-xs mt-8" style={{ color: '#6b7280' }}>
                Free • Open Source • No tracking
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

function FeatureItem({ icon, title, description, isDark }: { 
  icon: React.ReactNode; 
  title: string; 
  description: string;
  isDark: boolean;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex-shrink-0 w-10 h-10 bg-indigo-500/10 rounded-lg flex items-center justify-center text-indigo-500">
        {icon}
      </div>
      <div>
        <h3 className="font-medium" style={{ color: isDark ? '#fff' : '#111827' }}>{title}</h3>
        <p className="text-sm" style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>{description}</p>
      </div>
    </div>
  );
}

function MobileBenefit({ icon, text, isDark }: { icon: React.ReactNode; text: string; isDark: boolean }) {
  return (
    <div 
      className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm"
      style={{
        backgroundColor: isDark ? 'rgba(38,38,38,0.5)' : 'rgba(249,250,251,1)',
        color: isDark ? '#9ca3af' : '#6b7280'
      }}
    >
      <span className="text-indigo-500">{icon}</span>
      {text}
    </div>
  );
}
