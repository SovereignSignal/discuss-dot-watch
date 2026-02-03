'use client';

import { ReactNode } from 'react';
import { LogIn, Loader2, Globe, Zap, Bell, Shield, CheckCircle2, ArrowRight } from 'lucide-react';
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
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#0a0a0f' }}>
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mx-auto mb-4" />
          <p className="text-neutral-400">Loading...</p>
        </div>
      </div>
    );
  }

  // If auth is not configured (no Privy app ID), show error
  if (!isConfigured) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: '#0a0a0f' }}>
        <div className="text-center max-w-md">
          <span className="text-5xl mx-auto mb-4 block">🗳️</span>
          <h1 className="text-2xl font-bold text-white mb-2">Gov Watch</h1>
          <p className="text-neutral-400 mb-6">
            Authentication is not configured. Please set up Privy to enable login.
          </p>
          <p className="text-neutral-500 text-sm">
            Contact the administrator to configure <code className="text-indigo-400">NEXT_PUBLIC_PRIVY_APP_ID</code>
          </p>
        </div>
      </div>
    );
  }

  // If not authenticated, show login screen
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex" style={{ backgroundColor: '#0a0a0f' }}>
        {/* Left side - Branding & Features */}
        <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 bg-gradient-to-br from-indigo-950/50 via-neutral-900 to-neutral-900 border-r border-neutral-800">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-3xl">🗳️</span>
              <span className="font-bold text-2xl text-white">Gov Watch</span>
            </div>
            <p className="text-neutral-500">Governance Forum Aggregator</p>
          </div>

          <div className="space-y-8">
            <h2 className="text-3xl font-bold text-white leading-tight">
              Your unified gateway to<br />
              <span className="text-indigo-400">DAO governance</span>
            </h2>
            
            <div className="space-y-4">
              <FeatureItem 
                icon={<Globe className="w-5 h-5" />}
                title="70+ Forums"
                description="Aave, Uniswap, Arbitrum, and more"
              />
              <FeatureItem 
                icon={<Zap className="w-5 h-5" />}
                title="Save Hours"
                description="One feed instead of dozens of tabs"
              />
              <FeatureItem 
                icon={<Bell className="w-5 h-5" />}
                title="Keyword Alerts"
                description="Never miss important proposals"
              />
              <FeatureItem 
                icon={<Shield className="w-5 h-5" />}
                title="Privacy First"
                description="Optional sync, works offline"
              />
            </div>
          </div>

          <div className="text-neutral-500 text-sm">
            Open source • No tracking • Free forever
          </div>
        </div>

        {/* Right side - Sign in form */}
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="w-full max-w-md">
            {/* Mobile header */}
            <div className="lg:hidden text-center mb-8">
              <div className="flex items-center justify-center gap-2 mb-2">
                <span className="text-4xl">🗳️</span>
              </div>
              <h1 className="text-2xl font-bold text-white">Gov Watch</h1>
              <p className="text-neutral-400 text-sm mt-1">Your unified gateway to DAO governance</p>
            </div>

            {/* Sign in card */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-8">
              <div className="text-center mb-8">
                <h2 className="text-xl font-semibold text-white mb-2">Welcome</h2>
                <p className="text-neutral-400 text-sm">
                  Sign in to access your personalized governance feed
                </p>
              </div>

              <button
                onClick={login}
                className="flex items-center justify-center gap-2 w-full px-6 py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-900"
              >
                <LogIn className="w-5 h-5" />
                Sign In
                <ArrowRight className="w-4 h-4" />
              </button>

              <div className="mt-6 pt-6 border-t border-neutral-800">
                <p className="text-center text-neutral-500 text-xs mb-4">
                  Sign in with
                </p>
                <div className="flex justify-center gap-4 text-neutral-400 text-sm">
                  <span>Email</span>
                  <span className="text-neutral-600">•</span>
                  <span>Google</span>
                  <span className="text-neutral-600">•</span>
                  <span>Wallet</span>
                </div>
              </div>
            </div>

            {/* Benefits for mobile */}
            <div className="lg:hidden mt-8 grid grid-cols-2 gap-4">
              <MobileBenefit icon={<Globe className="w-4 h-4" />} text="70+ forums" />
              <MobileBenefit icon={<Zap className="w-4 h-4" />} text="Save hours" />
              <MobileBenefit icon={<Bell className="w-4 h-4" />} text="Alerts" />
              <MobileBenefit icon={<Shield className="w-4 h-4" />} text="Private" />
            </div>

            <p className="text-center text-neutral-600 text-xs mt-8">
              Free • Open Source • No tracking
            </p>
          </div>
        </div>
      </div>
    );
  }

  // User is authenticated, show the app
  return <>{children}</>;
}

function FeatureItem({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex-shrink-0 w-10 h-10 bg-indigo-500/10 rounded-lg flex items-center justify-center text-indigo-400">
        {icon}
      </div>
      <div>
        <h3 className="font-medium text-white">{title}</h3>
        <p className="text-neutral-400 text-sm">{description}</p>
      </div>
    </div>
  );
}

function MobileBenefit({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-neutral-800/50 rounded-lg text-sm text-neutral-400">
      <span className="text-indigo-400">{icon}</span>
      {text}
    </div>
  );
}
