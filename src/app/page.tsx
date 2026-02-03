import Link from 'next/link';
import {
  LayoutGrid,
  Bell,
  Bookmark,
  Search,
  Moon,
  Sun,
  RefreshCw,
  Keyboard,
  FolderOpen,
  ArrowRight,
  CheckCircle2,
  Zap,
  Shield,
  Globe,
  TrendingUp,
  Eye,
  MessageSquare,
  Flame,
} from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-screen text-white" style={{ backgroundColor: '#0a0a0f' }}>
      {/* Hero Section */}
      <header className="relative overflow-hidden border-b border-neutral-800">
        {/* Gradient background */}
        <div className="absolute inset-0 bg-gradient-to-b from-indigo-950/50 via-transparent to-transparent" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-indigo-600/20 blur-[120px] rounded-full" />
        
        <div className="relative max-w-6xl mx-auto px-6 pt-12 pb-16">
          {/* Nav */}
          <nav className="flex items-center justify-between mb-16">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🗳️</span>
              <span className="font-bold text-xl">Gov Watch</span>
            </div>
            <Link
              href="/app"
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-sm font-medium transition-colors"
            >
              Launch App
            </Link>
          </nav>

          {/* Hero content */}
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-indigo-500/10 border border-indigo-500/30 rounded-full text-indigo-400 text-sm mb-6">
                <Globe className="w-4 h-4" />
                <span>70+ Governance Forums</span>
              </div>
              
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 leading-tight">
                Your Unified Gateway to{' '}
                <span className="text-indigo-400">DAO Governance</span>
              </h1>
              
              <p className="text-lg text-neutral-400 mb-8 leading-relaxed">
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
                  className="inline-flex items-center gap-2 px-6 py-3 bg-neutral-800 hover:bg-neutral-700 text-white font-medium rounded-lg transition-colors"
                >
                  See Features
                </a>
              </div>

              {/* Trust badges */}
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-neutral-500">
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
              <div className="absolute inset-0 bg-gradient-to-r from-indigo-600/20 to-purple-600/20 blur-3xl" />
              <div className="relative bg-neutral-900 border border-neutral-700 rounded-xl overflow-hidden shadow-2xl">
                {/* Mock app header */}
                <div className="flex items-center gap-2 px-4 py-3 border-b border-neutral-800 bg-neutral-900">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-500/50" />
                    <div className="w-3 h-3 rounded-full bg-yellow-500/50" />
                    <div className="w-3 h-3 rounded-full bg-green-500/50" />
                  </div>
                  <span className="text-xs text-neutral-500 ml-2">gov-watch.app</span>
                </div>
                {/* Mock feed items */}
                <div className="p-4 space-y-3">
                  <MockFeedItem 
                    protocol="Arbitrum" 
                    title="[AIP-X] Treasury Management Framework"
                    replies={24}
                    views={1847}
                    isHot
                  />
                  <MockFeedItem 
                    protocol="Uniswap" 
                    title="Temperature Check: Fee Switch Activation"
                    replies={156}
                    views={8420}
                    isHot
                  />
                  <MockFeedItem 
                    protocol="Aave" 
                    title="[ARFC] Risk Parameter Updates"
                    replies={12}
                    views={892}
                    isNew
                  />
                  <MockFeedItem 
                    protocol="Optimism" 
                    title="Season 5 Grants Council Elections"
                    replies={45}
                    views={2103}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Logos/Social proof */}
      <section className="py-12 border-b border-neutral-800">
        <div className="max-w-6xl mx-auto px-6">
          <p className="text-center text-sm text-neutral-500 mb-6">Aggregating governance from</p>
          <div className="flex flex-wrap justify-center gap-x-8 gap-y-4 text-neutral-400">
            {['Aave', 'Uniswap', 'Arbitrum', 'Optimism', 'Compound', 'ENS', 'Lido', 'MakerDAO'].map((name) => (
              <span key={name} className="text-lg font-semibold opacity-60 hover:opacity-100 transition-opacity">
                {name}
              </span>
            ))}
            <span className="text-lg font-semibold text-indigo-400">+62 more</span>
          </div>
        </div>
      </section>

      {/* Key Benefits */}
      <section id="features" className="py-20">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Why Gov Watch?</h2>
            <p className="text-neutral-400 max-w-2xl mx-auto">
              Built for governance participants who need to stay informed across multiple protocols
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            <BenefitCard
              icon={<Zap className="w-6 h-6" />}
              iconBg="bg-amber-500/10"
              iconColor="text-amber-400"
              title="Save Hours Every Week"
              description="One feed instead of 70+ forum tabs. Filter by date, protocol, or keywords. Find what matters in seconds."
            />
            <BenefitCard
              icon={<Bell className="w-6 h-6" />}
              iconBg="bg-sky-500/10"
              iconColor="text-sky-400"
              title="Never Miss Important Votes"
              description="Set keyword alerts for proposals, protocols, or topics. Matching discussions are highlighted instantly."
            />
            <BenefitCard
              icon={<Shield className="w-6 h-6" />}
              iconBg="bg-emerald-500/10"
              iconColor="text-emerald-400"
              title="Privacy Respecting"
              description="Optional sign-in. Works fully offline. Your data stays in your browser. No tracking, no ads, ever."
            />
          </div>
        </div>
      </section>

      {/* Feature showcase */}
      <section className="py-20 bg-neutral-900/50">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Powerful Features</h2>
            <p className="text-neutral-400">Everything you need to stay on top of DAO governance</p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <FeatureCard icon={<Search />} title="Smart Search" description="Search across all discussions instantly" />
            <FeatureCard icon={<TrendingUp />} title="Activity Indicators" description="Spot hot & trending discussions at a glance" />
            <FeatureCard icon={<Bookmark />} title="Bookmarks" description="Save important proposals for later" />
            <FeatureCard icon={<Eye />} title="Read Tracking" description="Know which discussions you've already seen" />
            <FeatureCard icon={<RefreshCw />} title="Real-time Updates" description="Discussions refresh automatically" />
            <FeatureCard icon={<Keyboard />} title="Keyboard Shortcuts" description="Navigate quickly with hotkeys" />
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Get Started in Minutes</h2>
            <p className="text-neutral-400">Simple setup, powerful results</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <StepCard
              number="1"
              title="Choose Your Forums"
              description="Select from 70+ pre-configured governance forums or add any Discourse URL"
            />
            <StepCard
              number="2"
              title="Set Keyword Alerts"
              description="Track specific proposals, protocols, or topics you care about"
            />
            <StepCard
              number="3"
              title="Browse Your Feed"
              description="Filter, search, and bookmark. All governance in one place."
            />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-900/20 via-indigo-800/10 to-purple-900/20" />
        <div className="relative max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Ready to Simplify Your Governance Workflow?
          </h2>
          <p className="text-neutral-400 mb-8 text-lg">
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
      <footer className="py-8 border-t border-neutral-800">
        <div className="max-w-6xl mx-auto px-6 text-center text-neutral-500 text-sm">
          <p className="flex items-center justify-center gap-2">
            <span>🗳️</span>
            <span>Gov Watch — Open Source Governance Aggregator</span>
          </p>
        </div>
      </footer>
    </div>
  );
}

function MockFeedItem({ protocol, title, replies, views, isHot, isNew }: {
  protocol: string;
  title: string;
  replies: number;
  views: number;
  isHot?: boolean;
  isNew?: boolean;
}) {
  return (
    <div className="p-3 bg-neutral-800/50 rounded-lg border border-neutral-700/50">
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-xs font-medium text-indigo-400">{protocol}</span>
        {isHot && (
          <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-orange-500/20 text-orange-400 text-[10px]">
            <Flame className="w-2.5 h-2.5" />
            Hot
          </span>
        )}
        {isNew && (
          <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px]">
            NEW
          </span>
        )}
      </div>
      <p className="text-sm text-neutral-200 mb-2 line-clamp-1">{title}</p>
      <div className="flex items-center gap-3 text-[10px] text-neutral-500">
        <span className="flex items-center gap-1">
          <MessageSquare className="w-3 h-3" />
          {replies}
        </span>
        <span className="flex items-center gap-1">
          <Eye className="w-3 h-3" />
          {views.toLocaleString()}
        </span>
      </div>
    </div>
  );
}

function BenefitCard({ icon, iconBg, iconColor, title, description }: {
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  title: string;
  description: string;
}) {
  return (
    <div className="p-6 rounded-xl bg-neutral-900 border border-neutral-800">
      <div className={`inline-flex items-center justify-center w-12 h-12 ${iconBg} rounded-xl mb-4 ${iconColor}`}>
        {icon}
      </div>
      <h3 className="font-semibold text-lg mb-2">{title}</h3>
      <p className="text-neutral-400 text-sm leading-relaxed">{description}</p>
    </div>
  );
}

function FeatureCard({ icon, title, description }: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="p-5 bg-neutral-800/50 border border-neutral-700/50 rounded-lg hover:border-neutral-600 transition-colors">
      <div className="inline-flex items-center justify-center w-10 h-10 bg-indigo-500/10 rounded-lg mb-3 text-indigo-400">
        {icon}
      </div>
      <h3 className="font-semibold mb-1">{title}</h3>
      <p className="text-neutral-400 text-sm">{description}</p>
    </div>
  );
}

function StepCard({ number, title, description }: {
  number: string;
  title: string;
  description: string;
}) {
  return (
    <div className="relative p-6">
      <div className="absolute top-6 left-6 w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center font-bold text-lg">
        {number}
      </div>
      <div className="pl-16">
        <h3 className="font-semibold text-lg mb-2">{title}</h3>
        <p className="text-neutral-400 text-sm">{description}</p>
      </div>
    </div>
  );
}
