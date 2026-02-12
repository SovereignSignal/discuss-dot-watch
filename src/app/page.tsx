'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  CheckCircle2,
  Moon,
  Sun,
  Search,
  Bell,
  Bookmark,
  Eye,
  Keyboard,
  TrendingUp,
  Bot,
  Code2,
  Coins,
  MessageSquare,
  Flame,
} from 'lucide-react';

export default function LandingPage() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

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
    window.dispatchEvent(new Event('themechange'));
  };

  const isDark = theme === 'dark';

  return (
    <div 
      className="min-h-screen transition-colors duration-200"
      style={{ 
        backgroundColor: isDark ? '#09090b' : '#f5f5f5',
        color: isDark ? '#fafafa' : '#09090b'
      }}
    >
      {/* Nav */}
      <nav 
        className="sticky top-0 z-50 border-b backdrop-blur-sm"
        style={{ 
          backgroundColor: isDark ? 'rgba(9, 9, 11, 0.8)' : 'rgba(245, 245, 245, 0.8)',
          borderColor: isDark ? '#27272a' : '#e4e4e7'
        }}
      >
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">👁️‍🗨️</span>
            <span className="font-semibold tracking-tight">discuss.watch</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg transition-colors"
              style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }}
              aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <Link
              href="/app"
              className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              style={{
                backgroundColor: isDark ? '#fafafa' : '#09090b',
                color: isDark ? '#09090b' : '#fafafa',
              }}
            >
              Open App
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="py-20 md:py-28">
        <div className="max-w-5xl mx-auto px-6 text-center">
          <div 
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium mb-8"
            style={{
              backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
              color: isDark ? '#a1a1aa' : '#52525b'
            }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            100+ forums indexed
          </div>
          
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold mb-6 leading-[1.1] tracking-tight">
            All your forums.
            <br />
            <span style={{ color: isDark ? '#71717a' : '#a1a1aa' }}>One feed.</span>
          </h1>
          
          <p 
            className="text-lg mb-10 max-w-xl mx-auto leading-relaxed"
            style={{ color: isDark ? '#a1a1aa' : '#52525b' }}
          >
            Stop tab-hopping. Aggregate discussions from crypto, AI, and open source 
            communities into a single stream.
          </p>

          <div className="flex flex-wrap justify-center gap-3 mb-10">
            <Link
              href="/app"
              className="inline-flex items-center gap-2 px-6 py-3 font-medium rounded-lg transition-colors"
              style={{
                backgroundColor: isDark ? '#fafafa' : '#09090b',
                color: isDark ? '#09090b' : '#fafafa',
              }}
            >
              Start Reading
              <ArrowRight className="w-4 h-4" />
            </Link>
            <a
              href="#coverage"
              className="inline-flex items-center gap-2 px-6 py-3 font-medium rounded-lg transition-colors"
              style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }}
            >
              See Coverage
            </a>
          </div>

          <div className="flex flex-wrap justify-center items-center gap-x-6 gap-y-2 text-sm" style={{ color: isDark ? '#71717a' : '#a1a1aa' }}>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              Free
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              No tracking
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              Open source
            </span>
          </div>
        </div>
      </section>

      {/* Coverage */}
      <section 
        id="coverage" 
        className="py-20 border-t"
        style={{ 
          backgroundColor: isDark ? '#0a0a0a' : '#fafafa',
          borderColor: isDark ? '#1a1a1a' : '#e4e4e7'
        }}
      >
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-2xl md:text-3xl font-bold mb-3">Three verticals. One inbox.</h2>
            <p style={{ color: isDark ? '#71717a' : '#a1a1aa' }}>
              The communities shaping technology.
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-4">
            <VerticalCard
              icon={<Coins className="w-5 h-5" />}
              title="Crypto"
              count={77}
              examples={['Arbitrum', 'Uniswap', 'Aave', 'ENS', 'Optimism', 'Lido']}
              isDark={isDark}
            />
            <VerticalCard
              icon={<Bot className="w-5 h-5" />}
              title="AI"
              count={7}
              examples={['OpenAI', 'Hugging Face', 'PyTorch', 'LangChain']}
              isDark={isDark}
            />
            <VerticalCard
              icon={<Code2 className="w-5 h-5" />}
              title="Open Source"
              count={24}
              examples={['Rust', 'Swift', 'NixOS', 'Godot', 'Blender']}
              isDark={isDark}
            />
          </div>
        </div>
      </section>

      {/* Preview */}
      <section className="py-20 border-t" style={{ borderColor: isDark ? '#1a1a1a' : '#e4e4e7' }}>
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-2xl md:text-3xl font-bold mb-3">A feed that works</h2>
            <p style={{ color: isDark ? '#71717a' : '#a1a1aa' }}>
              Filter by community, search across everything, track what you&apos;ve read.
            </p>
          </div>

          <div 
            className="max-w-3xl mx-auto rounded-xl overflow-hidden shadow-2xl"
            style={{
              backgroundColor: isDark ? '#111111' : '#ffffff',
              border: `1px solid ${isDark ? '#262626' : '#e4e4e7'}`
            }}
          >
            <div 
              className="flex items-center gap-2 px-4 py-3 border-b"
              style={{ borderColor: isDark ? '#262626' : '#e4e4e7' }}
            >
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: isDark ? '#3f3f46' : '#d4d4d8' }} />
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: isDark ? '#3f3f46' : '#d4d4d8' }} />
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: isDark ? '#3f3f46' : '#d4d4d8' }} />
              </div>
              <span className="text-xs ml-2" style={{ color: isDark ? '#52525b' : '#a1a1aa' }}>discuss.watch</span>
            </div>
            <div className="p-4 space-y-3">
              <MockFeedItem 
                protocol="Arbitrum" 
                title="[AIP-X] Treasury Management Framework"
                category="Crypto"
                replies={24}
                views={1847}
                isHot
                isDark={isDark}
              />
              <MockFeedItem 
                protocol="PyTorch" 
                title="RFC: Native support for structured sparsity"
                category="AI"
                replies={18}
                views={2420}
                isNew
                isDark={isDark}
              />
              <MockFeedItem 
                protocol="NixOS" 
                title="RFC 0182: Simplified package versioning"
                category="OSS"
                replies={42}
                views={1203}
                isDark={isDark}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section 
        className="py-20 border-t"
        style={{ 
          backgroundColor: isDark ? '#0a0a0a' : '#fafafa',
          borderColor: isDark ? '#1a1a1a' : '#e4e4e7'
        }}
      >
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-2xl md:text-3xl font-bold mb-3">Built for power readers</h2>
            <p style={{ color: isDark ? '#71717a' : '#a1a1aa' }}>
              Stay on top of fast-moving communities.
            </p>
          </div>
          
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <FeatureCard icon={<Search />} title="Unified Search" description="Search all forums at once" isDark={isDark} />
            <FeatureCard icon={<Bell />} title="Keyword Alerts" description="Get notified on topics you care about" isDark={isDark} />
            <FeatureCard icon={<Bookmark />} title="Bookmarks" description="Save discussions to read later" isDark={isDark} />
            <FeatureCard icon={<Eye />} title="Read Tracking" description="Know what you've already seen" isDark={isDark} />
            <FeatureCard icon={<TrendingUp />} title="Hot & Active" description="Spot trending discussions" isDark={isDark} />
            <FeatureCard icon={<Keyboard />} title="Keyboard Nav" description="Navigate without the mouse" isDark={isDark} />
          </div>
        </div>
      </section>

      {/* For Agents */}
      <section className="py-20 border-t" style={{ borderColor: isDark ? '#1a1a1a' : '#e4e4e7' }}>
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <div 
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium mb-6"
                style={{
                  backgroundColor: 'rgba(34, 197, 94, 0.1)',
                  color: '#22c55e'
                }}
              >
                <Bot className="w-3 h-3" />
                Agent Friendly
              </div>
              <h2 className="text-2xl md:text-3xl font-bold mb-4">
                Built for humans.
                <br />
                <span style={{ color: isDark ? '#71717a' : '#a1a1aa' }}>Ready for agents.</span>
              </h2>
              <p className="mb-6" style={{ color: isDark ? '#a1a1aa' : '#71717a' }}>
                AI agents can search, monitor, and subscribe to forum discussions. 
                REST API and RSS feeds available.
              </p>
              <div className="flex flex-wrap gap-3">
                <a
                  href="/api/v1"
                  className="inline-flex items-center gap-2 px-4 py-2 font-medium rounded-lg text-sm"
                  style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }}
                >
                  API Docs
                </a>
              </div>
            </div>
            <div 
              className="rounded-xl p-6 font-mono text-sm"
              style={{ 
                backgroundColor: isDark ? '#111111' : '#ffffff',
                border: `1px solid ${isDark ? '#262626' : '#e4e4e7'}`
              }}
            >
              <div className="mb-2" style={{ color: isDark ? '#52525b' : '#a1a1aa' }}># Search discussions</div>
              <div className="mb-4" style={{ color: isDark ? '#a1a1aa' : '#52525b' }}>
                curl discuss.watch/api/v1/search?q=grants
              </div>
              <div className="mb-2" style={{ color: isDark ? '#52525b' : '#a1a1aa' }}># Get hot topics</div>
              <div className="mb-4" style={{ color: isDark ? '#a1a1aa' : '#52525b' }}>
                curl discuss.watch/api/v1/discussions?hot=true
              </div>
              <div className="mb-2" style={{ color: isDark ? '#52525b' : '#a1a1aa' }}># Subscribe to feed</div>
              <div style={{ color: isDark ? '#a1a1aa' : '#52525b' }}>
                discuss.watch/feed/crypto.xml
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section 
        className="py-20 border-t"
        style={{ 
          backgroundColor: isDark ? '#0a0a0a' : '#fafafa',
          borderColor: isDark ? '#1a1a1a' : '#e4e4e7'
        }}
      >
        <div className="max-w-xl mx-auto px-6 text-center">
          <h2 className="text-2xl md:text-3xl font-bold mb-4">
            Ready to simplify your reading?
          </h2>
          <p className="mb-8" style={{ color: isDark ? '#71717a' : '#a1a1aa' }}>
            No signup required.
          </p>
          <Link
            href="/app"
            className="inline-flex items-center gap-2 px-8 py-4 font-medium rounded-lg transition-colors"
            style={{
              backgroundColor: isDark ? '#fafafa' : '#09090b',
              color: isDark ? '#09090b' : '#fafafa',
            }}
          >
            Open App
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer 
        className="py-8 border-t"
        style={{ borderColor: isDark ? '#1a1a1a' : '#e4e4e7' }}
      >
        <div className="max-w-5xl mx-auto px-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="text-lg">👁️‍🗨️</span>
              <span className="text-sm font-medium">discuss.watch</span>
            </div>
            <p className="text-sm" style={{ color: isDark ? '#52525b' : '#a1a1aa' }}>
              Part of the{' '}
              <a 
                href="https://sovereignsignal.substack.com" 
                target="_blank" 
                rel="noopener noreferrer"
                className="underline underline-offset-2 hover:opacity-80"
              >
                Sovereign Signal
              </a>
              {' '}ecosystem
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

function VerticalCard({ icon, title, count, examples, isDark }: {
  icon: React.ReactNode;
  title: string;
  count: number;
  examples: string[];
  isDark: boolean;
}) {
  return (
    <div 
      className="p-6 rounded-xl"
      style={{ 
        backgroundColor: isDark ? '#111111' : '#ffffff',
        border: `1px solid ${isDark ? '#262626' : '#e4e4e7'}`
      }}
    >
      <div 
        className="inline-flex items-center justify-center w-10 h-10 rounded-lg mb-4"
        style={{ 
          backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
          color: isDark ? '#fafafa' : '#09090b'
        }}
      >
        {icon}
      </div>
      <div className="flex items-baseline gap-2 mb-3">
        <h3 className="font-semibold text-lg">{title}</h3>
        <span className="text-sm" style={{ color: isDark ? '#52525b' : '#a1a1aa' }}>{count} forums</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {examples.map((name) => (
          <span 
            key={name} 
            className="px-2 py-1 text-xs rounded-md"
            style={{ 
              backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
              color: isDark ? '#a1a1aa' : '#52525b'
            }}
          >
            {name}
          </span>
        ))}
      </div>
    </div>
  );
}

function MockFeedItem({ protocol, title, category, replies, views, isHot, isNew, isDark }: {
  protocol: string;
  title: string;
  category: string;
  replies: number;
  views: number;
  isHot?: boolean;
  isNew?: boolean;
  isDark: boolean;
}) {
  return (
    <div 
      className="p-3 rounded-lg flex items-start gap-3"
      style={{ backgroundColor: isDark ? '#171717' : '#f5f5f5' }}
    >
      <div 
        className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold"
        style={{ 
          backgroundColor: isDark ? '#262626' : '#e4e4e7',
          color: isDark ? '#a1a1aa' : '#52525b'
        }}
      >
        {protocol.slice(0, 2).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium mb-1 leading-snug">{title}</p>
        <div className="flex items-center flex-wrap gap-2 text-xs" style={{ color: isDark ? '#71717a' : '#a1a1aa' }}>
          <span style={{ color: isDark ? '#a1a1aa' : '#52525b' }}>{protocol}</span>
          <span>·</span>
          <span>{category}</span>
          {isNew && (
            <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-500 text-[10px] font-medium">NEW</span>
          )}
          {isHot && (
            <span className="flex items-center gap-1 text-orange-500">
              <Flame className="w-3 h-3" />
            </span>
          )}
          <span className="flex items-center gap-1 ml-auto">
            <MessageSquare className="w-3 h-3" />
            {replies}
          </span>
          <span className="flex items-center gap-1">
            <Eye className="w-3 h-3" />
            {views.toLocaleString()}
          </span>
        </div>
      </div>
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
      className="p-5 rounded-xl"
      style={{
        backgroundColor: isDark ? '#111111' : '#ffffff',
        border: `1px solid ${isDark ? '#262626' : '#e4e4e7'}`
      }}
    >
      <div 
        className="inline-flex items-center justify-center w-9 h-9 rounded-lg mb-3"
        style={{ 
          backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
          color: isDark ? '#a1a1aa' : '#52525b'
        }}
      >
        {icon}
      </div>
      <h3 className="font-medium mb-1">{title}</h3>
      <p className="text-sm" style={{ color: isDark ? '#71717a' : '#a1a1aa' }}>{description}</p>
    </div>
  );
}
