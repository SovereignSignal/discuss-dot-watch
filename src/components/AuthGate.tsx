'use client';

import { ReactNode, useState, useEffect } from 'react';
import { LogIn, Loader2, Globe, Zap, Bell, Shield, ArrowRight, Sun, Moon } from 'lucide-react';
import { useAuth } from './AuthProvider';
import { c } from '@/lib/theme';
import { getTotalForumCount } from '@/lib/forumPresets';

interface AuthGateProps {
  children: ReactNode;
}

export function AuthGate({ children }: AuthGateProps) {
  const { isAuthenticated, isLoading, isConfigured, login } = useAuth();
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    const savedTheme = localStorage.getItem('discuss-watch-theme') as 'dark' | 'light' | null;
    if (savedTheme) setTheme(savedTheme);
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('discuss-watch-theme', newTheme);
    document.documentElement.classList.toggle('light', newTheme === 'light');
    document.documentElement.classList.toggle('dark', newTheme === 'dark');
    window.dispatchEvent(new Event('themechange'));
  };

  const isDark = theme === 'dark';
  const t = c(isDark);

  // Dev bypass
  if (process.env.NODE_ENV === 'development' && !isConfigured) return <>{children}</>;

  // Loading
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: t.bg }}>
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: t.fgMuted }} />
      </div>
    );
  }

  // Not configured
  if (!isConfigured) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: t.bg }}>
        <div className="text-center max-w-md">
          <span className="text-5xl block mb-4">👁️‍🗨️</span>
          <h1 className="text-2xl font-bold mb-2" style={{ color: t.fg }}>discuss.watch</h1>
          <p style={{ color: t.fgMuted }}>
            Authentication not configured. Set up Privy to enable login.
          </p>
        </div>
      </div>
    );
  }

  // Authenticated - show children
  if (isAuthenticated) return <>{children}</>;

  // Not authenticated - show login
  return (
    <div className="min-h-screen flex" style={{ backgroundColor: t.bg }}>
      {/* Left - Features (desktop only) */}
      <div
        className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 border-r"
        style={{
          background: isDark
            ? 'linear-gradient(135deg, rgba(49,46,129,0.3) 0%, #171717 50%, #171717 100%)'
            : 'linear-gradient(135deg, rgba(199,210,254,0.5) 0%, #ffffff 50%, #ffffff 100%)',
          borderColor: t.border
        }}
      >
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-3xl">👁️‍🗨️</span>
            <span className="font-bold text-2xl" style={{ color: t.fg }}>discuss.watch</span>
          </div>
          <p style={{ color: t.fgDim }}>Unified forum feed</p>
        </div>

        <div className="space-y-8">
          <h2 className="text-3xl font-bold leading-tight" style={{ color: t.fg }}>
            All your forums.<br />
            <span style={{ color: t.fgMuted }}>One feed.</span>
          </h2>

          <div className="space-y-4">
            <FeatureItem icon={<Globe className="w-5 h-5" />} title={`${getTotalForumCount()} Forums`} description="Crypto, AI, and open source communities" t={t} />
            <FeatureItem icon={<Zap className="w-5 h-5" />} title="Save Hours" description="One feed instead of dozens of tabs" t={t} />
            <FeatureItem icon={<Bell className="w-5 h-5" />} title="Keyword Alerts" description="Never miss important discussions" t={t} />
            <FeatureItem icon={<Shield className="w-5 h-5" />} title="Privacy First" description="Optional sync, works offline" t={t} />
          </div>
        </div>

        <p className="text-sm" style={{ color: t.fgDim }}>
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
            style={{ backgroundColor: t.bgActive }}
            aria-label="Toggle theme"
          >
            {isDark ? <Sun className="w-5 h-5" style={{ color: t.fg }} /> : <Moon className="w-5 h-5" style={{ color: t.fg }} />}
          </button>
        </div>

        <div className="flex-1 flex items-center justify-center p-8">
          <div className="w-full max-w-md">
            {/* Mobile header */}
            <div className="lg:hidden text-center mb-8">
              <span className="text-4xl block mb-2">👁️‍🗨️</span>
              <h1 className="text-2xl font-bold" style={{ color: t.fg }}>discuss.watch</h1>
              <p className="text-sm mt-1" style={{ color: t.fgMuted }}>
                All your forums, one feed
              </p>
            </div>

            {/* Sign in card */}
            <div className="rounded-2xl p-8" style={{ backgroundColor: t.bgCard, border: `1px solid ${t.border}` }}>
              <div className="text-center mb-8">
                <h2 className="text-xl font-semibold mb-2" style={{ color: t.fg }}>Welcome</h2>
                <p className="text-sm" style={{ color: t.fgMuted }}>
                  Sign in to sync your feed across devices
                </p>
              </div>

              <button
                onClick={login}
                className="flex items-center justify-center gap-2 w-full px-6 py-4 font-semibold rounded-xl transition-colors"
                style={{ backgroundColor: t.fg, color: isDark ? '#000' : '#fff' }}
              >
                <LogIn className="w-5 h-5" />
                Sign In
                <ArrowRight className="w-4 h-4" />
              </button>

              <div className="mt-6 pt-6" style={{ borderTop: `1px solid ${t.border}` }}>
                <p className="text-center text-xs mb-4" style={{ color: t.fgDim }}>
                  Sign in with
                </p>
                <div className="flex justify-center gap-4 text-sm" style={{ color: t.fgMuted }}>
                  <span>Email</span>
                  <span style={{ color: t.border }}>•</span>
                  <span>Wallet</span>
                </div>
              </div>
            </div>

            {/* Mobile benefits */}
            <div className="lg:hidden mt-8 grid grid-cols-2 gap-3">
              <MobileBenefit icon={<Globe className="w-4 h-4" />} text={`${getTotalForumCount()} forums`} t={t} />
              <MobileBenefit icon={<Zap className="w-4 h-4" />} text="Save hours" t={t} />
              <MobileBenefit icon={<Bell className="w-4 h-4" />} text="Alerts" t={t} />
              <MobileBenefit icon={<Shield className="w-4 h-4" />} text="Private" t={t} />
            </div>

            <p className="text-center text-xs mt-8" style={{ color: t.fgDim }}>
              Free • Open Source • No tracking
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function FeatureItem({ icon, title, description, t }: {
  icon: React.ReactNode;
  title: string;
  description: string;
  t: ReturnType<typeof c>;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: t.bgActive, color: t.fgMuted }}>
        {icon}
      </div>
      <div>
        <h3 className="font-medium" style={{ color: t.fg }}>{title}</h3>
        <p className="text-sm" style={{ color: t.fgMuted }}>{description}</p>
      </div>
    </div>
  );
}

function MobileBenefit({ icon, text, t }: { icon: React.ReactNode; text: string; t: ReturnType<typeof c> }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm" style={{ backgroundColor: t.bgSubtle, color: t.fgMuted }}>
      <span style={{ color: t.fgDim }}>{icon}</span>
      {text}
    </div>
  );
}
