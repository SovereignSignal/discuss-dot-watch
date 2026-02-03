'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Bell,
  Search,
  Moon,
  Sun,
  RefreshCw,
  Keyboard,
  ArrowRight,
  CheckCircle2,
  Zap,
  Shield,
  Globe,
  TrendingUp,
  Eye,
  MessageSquare,
  Flame,
  Bookmark,
} from 'lucide-react';

export default function LandingPage() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  // Load theme from localStorage on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem('gov-watch-theme') as 'dark' | 'light' | null;
    if (savedTheme) {
      setTheme(savedTheme);
      document.documentElement.classList.toggle('light', savedTheme === 'light');
      document.documentElement.classList.toggle('dark', savedTheme === 'dark');
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

  return (
    <div 
      className="min-h-screen transition-colors duration-200"
      style={{ 
        backgroundColor: isDark ? '#0a0a0f' : '#f8f9fa',
        color: isDark ? '#ffffff' : '#111827'
      }}
    >
      {/* Hero Section */}
      <header className="relative overflow-hidden border-b" style={{ borderColor: isDark ? '#262626' : '#e5e7eb' }}>
        {/* Gradient background */}
        <div className={`absolute inset-0 ${isDark ? 'bg-gradient-to-b from-indigo-950/50 via-transparent to-transparent' : 'bg-gradient-to-b from-indigo-100/50 via-transparent to-transparent'}`} />
        <div className={`absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] ${isDark ? 'bg-indigo-600/20' : 'bg-indigo-400/20'} blur-[120px] rounded-full`} />
        
        <div className="relative max-w-6xl mx-auto px-6 pt-8 pb-16">
          {/* Nav */}
          <nav className="flex items-center justify-between mb-12">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🗳️</span>
              <span className="font-bold text-xl">Gov Watch</span>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={toggleTheme}
                className="p-2.5 rounded-lg transition-colors"
                style={{ 
                  backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                }}
                aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>
              <Link
                href="/app"
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Launch App
              </Link>
            </div>
          </nav>

          {/* Hero content */}
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div 
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm mb-6"
                style={{
                  backgroundColor: isDark ? 'rgba(99, 102, 241, 0.1)' : 'rgba(99, 102, 241, 0.1)',
                  border: `1px solid ${isDark ? 'rgba(99, 102, 241, 0.3)' : 'rgba(99, 102, 241, 0.3)'}`,
                  color: isDark ? '#818cf8' : '#4f46e5'
                }}
              >
                <Globe className="w-4 h-4" />
                <span>70+ Governance Forums</span>
              </div>
              
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 leading-tight">
                Your Unified Gateway to{' '}
                <span className="text-indigo-500">DAO Governance</span>
              </h1>
              
              <p className="text-lg mb-8 leading-relaxed" style={{ color: isDark ? '#9ca3af' : '#4b5563' }}>
                Stop juggling dozens of forum tabs. Aggregate governance discussions from 
                Aave, Uniswap, Arbitrum, and 70+ more Discourse forums into one powerful feed.
              </p>

              <div className="flex flex-wrap gap-4 mb-8">
                <Link
                  href="/app"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg transition-colors"
                >
                  Launch App
                  <ArrowRight className="w-5 h-5" />
                </Link>
                <a
                  href="#features"
                  className="inline-flex items-center gap-2 px-6 py-3 font-medium rounded-lg transition-colors"
                  style={{
                    backgroundColor: isDark ? '#262626' : '#e5e7eb',
                    color: isDark ? '#ffffff' : '#111827'
                  }}
                >
                  See Features
                </a>
              </div>

              {/* Trust badges */}
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm" style={{ color: isDark ? '#6b7280' : '#6b7280' }}>
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  Free & Open Source
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  No Tracking
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  Works Offline
                </span>
              </div>
            </div>

            {/* App preview */}
            <div className="relative hidden lg:block">
              <div className={`absolute inset-0 ${isDark ? 'bg-gradient-to-r from-indigo-600/20 to-purple-600/20' : 'bg-gradient-to-r from-indigo-400/10 to-purple-400/10'} blur-3xl`} />
              <div 
                className="relative rounded-xl overflow-hidden shadow-2xl"
                style={{
                  backgroundColor: isDark ? '#171717' : '#ffffff',
                  border: `1px solid ${isDark ? '#404040' : '#e5e7eb'}`
                }}
              >
                {/* Mock app header */}
                <div 
                  className="flex items-center gap-2 px-4 py-3 border-b"
                  style={{ 
                    backgroundColor: isDark ? '#171717' : '#ffffff',
                    borderColor: isDark ? '#262626' : '#e5e7eb'
                  }}
                >
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-500/60" />
                    <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
                    <div className="w-3 h-3 rounded-full bg-green-500/60" />
                  </div>
                  <span className="text-xs ml-2" style={{ color: isDark ? '#6b7280' : '#9ca3af' }}>gov-watch.app</span>
                </div>
                {/* Mock feed items */}
                <div className="p-3 space-y-2">
                  <MockFeedItem 
                    protocol="Arbitrum" 
                    title="[AIP-X] Treasury Management Framework"
                    replies={24}
                    views={1847}
                    likes={61}
                    isHot
                    isDark={isDark}
                    date="Feb 1"
                  />
                  <MockFeedItem 
                    protocol="Uniswap" 
                    title="[RFC] Deploy Uniswap v3 on Sei Network"
                    replies={18}
                    views={2420}
                    likes={34}
                    isNew
                    isDark={isDark}
                    date="Feb 2"
                  />
                  <MockFeedItem 
                    protocol="Aave" 
                    title="[ARFC] Onboard weETH to Aave v3 on Ethereum"
                    replies={12}
                    views={892}
                    likes={28}
                    isDark={isDark}
                    date="Jan 30"
                  />
                  <MockFeedItem 
                    protocol="Optimism" 
                    title="Grants Council Season 6 Elections"
                    replies={45}
                    views={2103}
                    likes={52}
                    isHot
                    isDark={isDark}
                    date="Jan 28"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Logos/Social proof */}
      <section className="py-12 border-b" style={{ borderColor: isDark ? '#262626' : '#e5e7eb' }}>
        <div className="max-w-6xl mx-auto px-6">
          <p className="text-center text-sm mb-6" style={{ color: isDark ? '#6b7280' : '#6b7280' }}>Aggregating governance from</p>
          <div className="flex flex-wrap justify-center gap-x-8 gap-y-4" style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>
            {['Aave', 'Uniswap', 'Arbitrum', 'Optimism', 'Compound', 'ENS', 'Lido', 'MakerDAO'].map((name) => (
              <span key={name} className="text-lg font-semibold opacity-60 hover:opacity-100 transition-opacity">
                {name}
              </span>
            ))}
            <span className="text-lg font-semibold text-indigo-500">+62 more</span>
          </div>
        </div>
      </section>

      {/* Key Benefits */}
      <section id="features" className="py-20">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Why Gov Watch?</h2>
            <p style={{ color: isDark ? '#9ca3af' : '#6b7280' }} className="max-w-2xl mx-auto">
              Built for governance participants who need to stay informed across multiple protocols
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            <BenefitCard
              icon={<Zap className="w-6 h-6" />}
              iconBg="bg-amber-500/10"
              iconColor="text-amber-500"
              title="Save Hours Every Week"
              description="One feed instead of 70+ forum tabs. Filter by date, protocol, or keywords. Find what matters in seconds."
              isDark={isDark}
            />
            <BenefitCard
              icon={<Bell className="w-6 h-6" />}
              iconBg="bg-sky-500/10"
              iconColor="text-sky-500"
              title="Never Miss Important Votes"
              description="Set keyword alerts for proposals, protocols, or topics. Matching discussions are highlighted instantly."
              isDark={isDark}
            />
            <BenefitCard
              icon={<Shield className="w-6 h-6" />}
              iconBg="bg-emerald-500/10"
              iconColor="text-emerald-500"
              title="Privacy Respecting"
              description="Optional sign-in. Works fully offline. Your data stays in your browser. No tracking, no ads, ever."
              isDark={isDark}
            />
          </div>
        </div>
      </section>

      {/* Feature showcase */}
      <section className="py-20" style={{ backgroundColor: isDark ? 'rgba(23, 23, 23, 0.5)' : 'rgba(249, 250, 251, 1)' }}>
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Powerful Features</h2>
            <p style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>Everything you need to stay on top of DAO governance</p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <FeatureCard icon={<Search />} title="Smart Search" description="Search across all discussions instantly" isDark={isDark} />
            <FeatureCard icon={<TrendingUp />} title="Activity Indicators" description="Spot hot & trending discussions at a glance" isDark={isDark} />
            <FeatureCard icon={<Bookmark />} title="Bookmarks" description="Save important proposals for later" isDark={isDark} />
            <FeatureCard icon={<Eye />} title="Read Tracking" description="Know which discussions you've already seen" isDark={isDark} />
            <FeatureCard icon={<RefreshCw />} title="Real-time Updates" description="Discussions refresh automatically" isDark={isDark} />
            <FeatureCard icon={<Keyboard />} title="Keyboard Shortcuts" description="Navigate quickly with hotkeys" isDark={isDark} />
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Get Started in Minutes</h2>
            <p style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>Simple setup, powerful results</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <StepCard
              number="1"
              title="Choose Your Forums"
              description="Select from 70+ pre-configured governance forums or add any Discourse URL"
              isDark={isDark}
            />
            <StepCard
              number="2"
              title="Set Keyword Alerts"
              description="Track specific proposals, protocols, or topics you care about"
              isDark={isDark}
            />
            <StepCard
              number="3"
              title="Browse Your Feed"
              description="Filter, search, and bookmark. All governance in one place."
              isDark={isDark}
            />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 relative overflow-hidden">
        <div className={`absolute inset-0 ${isDark ? 'bg-gradient-to-r from-indigo-900/20 via-indigo-800/10 to-purple-900/20' : 'bg-gradient-to-r from-indigo-100/50 via-indigo-50/30 to-purple-100/50'}`} />
        <div className="relative max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Ready to Simplify Your Governance Workflow?
          </h2>
          <p className="mb-8 text-lg" style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>
            Join thousands of governance participants who use Gov Watch daily.
          </p>
          <Link
            href="/app"
            className="inline-flex items-center gap-2 px-8 py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg transition-colors text-lg"
          >
            Launch App — It&apos;s Free
            <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t" style={{ borderColor: isDark ? '#262626' : '#e5e7eb' }}>
        <div className="max-w-6xl mx-auto px-6 text-center text-sm" style={{ color: isDark ? '#6b7280' : '#6b7280' }}>
          <p className="flex items-center justify-center gap-2">
            <span>🗳️</span>
            <span>Gov Watch — Open Source Governance Aggregator</span>
          </p>
        </div>
      </footer>
    </div>
  );
}

function MockFeedItem({ protocol, title, replies, views, likes, isHot, isNew, isDark, logoUrl, date }: {
  protocol: string;
  title: string;
  replies: number;
  views: number;
  likes?: number;
  isHot?: boolean;
  isNew?: boolean;
  isDark: boolean;
  logoUrl?: string;
  date?: string;
}) {
  return (
    <div 
      className="p-4 rounded-xl flex items-start gap-3"
      style={{
        backgroundColor: isDark ? 'rgba(38, 38, 38, 0.5)' : 'rgba(249, 250, 251, 1)',
        border: `1px solid ${isDark ? 'rgba(64, 64, 64, 0.5)' : '#e5e7eb'}`
      }}
    >
      {/* Protocol Logo */}
      <div 
        className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center overflow-hidden ${
          logoUrl ? '' : 'bg-gradient-to-br from-indigo-500 to-indigo-600'
        }`}
        style={logoUrl ? { 
          backgroundColor: isDark ? '#262626' : '#f3f4f6',
          border: `1px solid ${isDark ? '#404040' : '#e5e7eb'}`
        } : undefined}
      >
        {logoUrl ? (
          <img src={logoUrl} alt="" className="w-6 h-6 object-contain" />
        ) : (
          <span className="text-white text-xs font-bold">{protocol.slice(0, 2).toUpperCase()}</span>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Title */}
        <p className="text-sm font-semibold mb-1.5 line-clamp-2 leading-snug" style={{ color: isDark ? '#f3f4f6' : '#111827' }}>
          {title}
        </p>
        
        {/* Meta row */}
        <div className="flex items-center flex-wrap gap-x-2 gap-y-1 text-[11px]" style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>
          <span className="font-medium text-indigo-500">{protocol}</span>
          <span style={{ color: isDark ? '#525252' : '#d1d5db' }}>·</span>
          <span>{date || 'Jan 28'}</span>
          
          {isNew && (
            <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-500 text-[10px] font-semibold">
              NEW
            </span>
          )}
          {isHot && (
            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-orange-500/15 text-orange-500 font-medium">
              <Flame className="w-2.5 h-2.5" />
              <span className="text-[10px]">Hot</span>
            </span>
          )}
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-3 mt-2 text-[11px]" style={{ color: isDark ? '#6b7280' : '#9ca3af' }}>
          <span className="flex items-center gap-1">
            <MessageSquare className="w-3 h-3" />
            {replies}
          </span>
          <span className="flex items-center gap-1">
            <Eye className="w-3 h-3" />
            {views.toLocaleString()}
          </span>
          {likes !== undefined && (
            <span className="flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              {likes}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function BenefitCard({ icon, iconBg, iconColor, title, description, isDark }: {
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  title: string;
  description: string;
  isDark: boolean;
}) {
  return (
    <div 
      className="p-6 rounded-xl"
      style={{
        backgroundColor: isDark ? '#171717' : '#ffffff',
        border: `1px solid ${isDark ? '#262626' : '#e5e7eb'}`
      }}
    >
      <div className={`inline-flex items-center justify-center w-12 h-12 ${iconBg} rounded-xl mb-4 ${iconColor}`}>
        {icon}
      </div>
      <h3 className="font-semibold text-lg mb-2">{title}</h3>
      <p className="text-sm leading-relaxed" style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>{description}</p>
    </div>
  );
}

function FeatureCard({ icon, title, description, isDark }: {
  icon: React.ReactNode;
  title: string;
  description: string;
  isDark: boolean;
}) {
  return (
    <div 
      className="p-5 rounded-lg transition-colors"
      style={{
        backgroundColor: isDark ? 'rgba(38, 38, 38, 0.5)' : '#ffffff',
        border: `1px solid ${isDark ? 'rgba(64, 64, 64, 0.5)' : '#e5e7eb'}`
      }}
    >
      <div className="inline-flex items-center justify-center w-10 h-10 bg-indigo-500/10 rounded-lg mb-3 text-indigo-500">
        {icon}
      </div>
      <h3 className="font-semibold mb-1">{title}</h3>
      <p className="text-sm" style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>{description}</p>
    </div>
  );
}

function StepCard({ number, title, description, isDark }: {
  number: string;
  title: string;
  description: string;
  isDark: boolean;
}) {
  return (
    <div className="relative p-6">
      <div className="absolute top-6 left-6 w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center font-bold text-lg text-white">
        {number}
      </div>
      <div className="pl-16">
        <h3 className="font-semibold text-lg mb-2">{title}</h3>
        <p className="text-sm" style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>{description}</p>
      </div>
    </div>
  );
}
