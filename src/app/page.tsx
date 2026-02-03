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
} from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-screen text-white" style={{ backgroundColor: '#121212' }}>
      {/* Hero Section */}
      <header className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/20 via-transparent to-purple-900/20" />
        <div className="relative max-w-6xl mx-auto px-6 py-20 md:py-32">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-500/10 border border-indigo-500/20 rounded-full text-indigo-400 text-sm mb-8">
              <Globe className="w-4 h-4" />
              <span>70+ Governance Forums Supported</span>
            </div>
            <h1 className="text-4xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-white via-gray-200 to-gray-400 bg-clip-text text-transparent">
              Gov Watch
            </h1>
            <p className="text-xl md:text-2xl text-gray-400 mb-4 max-w-3xl mx-auto">
              Your Unified Gateway to DAO Governance
            </p>
            <p className="text-gray-500 mb-10 max-w-2xl mx-auto">
              Aggregate governance discussions from Aave, Compound, Uniswap, Arbitrum, Optimism, and dozens more
              Discourse-based forums into a single, powerful interface.
            </p>
            <Link
              href="/app"
              className="inline-flex items-center gap-2 px-8 py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg transition-colors text-lg"
            >
              Launch App
              <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </header>

      {/* Key Benefits */}
      <section className="py-16 border-t border-neutral-800">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center p-6">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-emerald-500/10 rounded-lg mb-4">
                <Zap className="w-6 h-6 text-emerald-400" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Save Time</h3>
              <p className="text-neutral-400 text-sm">
                Stop switching between dozens of forum tabs. See all governance activity in one place.
              </p>
            </div>
            <div className="text-center p-6">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-sky-500/10 rounded-lg mb-4">
                <Bell className="w-6 h-6 text-sky-400" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Never Miss a Vote</h3>
              <p className="text-neutral-400 text-sm">
                Set keyword alerts for topics you care about. Get highlighted matches instantly.
              </p>
            </div>
            <div className="text-center p-6">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-indigo-500/10 rounded-lg mb-4">
                <Shield className="w-6 h-6 text-indigo-400" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Privacy First</h3>
              <p className="text-neutral-400 text-sm">
                Optional sign-in to sync across devices. Works offline with local storage.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 bg-neutral-900/50">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-center mb-4">How It Works</h2>
          <p className="text-neutral-400 text-center mb-12 max-w-2xl mx-auto">
            Get started in minutes with a simple three-step process
          </p>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="relative">
              <div className="absolute -left-4 top-0 w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-sm font-bold">
                1
              </div>
              <div className="pl-8">
                <h3 className="font-semibold text-lg mb-2 flex items-center gap-2">
                  <FolderOpen className="w-5 h-5 text-indigo-400" />
                  Add Forums
                </h3>
                <p className="text-neutral-400 text-sm">
                  Choose from 70+ pre-configured governance forums or add any Discourse forum URL. Enable only
                  the forums relevant to your interests.
                </p>
              </div>
            </div>
            <div className="relative">
              <div className="absolute -left-4 top-0 w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-sm font-bold">
                2
              </div>
              <div className="pl-8">
                <h3 className="font-semibold text-lg mb-2 flex items-center gap-2">
                  <Bell className="w-5 h-5 text-indigo-400" />
                  Set Alerts
                </h3>
                <p className="text-neutral-400 text-sm">
                  Create keyword alerts for proposals, protocols, or topics you want to track. Matching
                  discussions are highlighted.
                </p>
              </div>
            </div>
            <div className="relative">
              <div className="absolute -left-4 top-0 w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-sm font-bold">
                3
              </div>
              <div className="pl-8">
                <h3 className="font-semibold text-lg mb-2 flex items-center gap-2">
                  <LayoutGrid className="w-5 h-5 text-indigo-400" />
                  Browse Feed
                </h3>
                <p className="text-neutral-400 text-sm">
                  View all discussions in a unified feed. Filter by forum, date range, or search. Bookmark
                  important topics for later reference.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-center mb-4">Powerful Features</h2>
          <p className="text-neutral-400 text-center mb-12 max-w-2xl mx-auto">
            Everything you need to stay on top of governance across the ecosystem
          </p>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <FeatureCard
              icon={<Search className="w-5 h-5" />}
              title="Smart Search"
              description="Instantly search across all discussions with real-time filtering"
            />
            <FeatureCard
              icon={<Bookmark className="w-5 h-5" />}
              title="Bookmarks"
              description="Save important discussions for quick access later"
            />
            <FeatureCard
              icon={<CheckCircle2 className="w-5 h-5" />}
              title="Read Tracking"
              description="Visual indicators show which discussions you've already seen"
            />
            <FeatureCard
              icon={<RefreshCw className="w-5 h-5" />}
              title="Auto Refresh"
              description="Discussions update automatically with smart caching"
            />
            <FeatureCard
              icon={<Keyboard className="w-5 h-5" />}
              title="Keyboard Shortcuts"
              description="Navigate quickly with /, j/k, and arrow keys"
            />
            <FeatureCard
              icon={<ThemeIcon />}
              title="Dark/Light Mode"
              description="Toggle between themes to match your preference"
            />
          </div>
        </div>
      </section>

      {/* Pro Tips */}
      <section className="py-20 bg-neutral-900/50">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-center mb-4">Pro Tips</h2>
          <p className="text-neutral-400 text-center mb-12 max-w-2xl mx-auto">
            Get the most out of Gov Watch with these power user tips
          </p>
          <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            <TipCard
              number="1"
              title="Use Keyword Alerts Strategically"
              tips={[
                'Add alerts for protocol names you hold tokens in',
                'Track "proposal", "vote", or "RFC" for early discussion visibility',
                'Set alerts for grant programs you\'re interested in',
              ]}
            />
            <TipCard
              number="2"
              title="Organize Your Feed"
              tips={[
                'Enable only forums you actively follow to reduce noise',
                'Use date filters to focus on recent activity',
                'Sort by "Most Replies" to find active discussions',
              ]}
            />
            <TipCard
              number="3"
              title="Stay Efficient"
              tips={[
                'Press "/" to instantly focus the search bar',
                'Use j/k or arrow keys to navigate the feed',
                'Bookmark proposals to track before voting',
              ]}
            />
            <TipCard
              number="4"
              title="Back Up Your Data"
              tips={[
                'Export your config periodically from Settings',
                'Import on a new device to sync your setup',
                'Your forums, alerts, and bookmarks are all backed up',
              ]}
            />
          </div>
        </div>
      </section>

      {/* Supported Forums Preview */}
      <section className="py-20">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-center mb-4">Supported Forums</h2>
          <p className="text-neutral-400 text-center mb-12 max-w-2xl mx-auto">
            Pre-configured support for major DeFi protocols, L2s, DAOs, and more
          </p>
          <div className="flex flex-wrap justify-center gap-3 mb-8">
            {[
              'Aave',
              'Compound',
              'Uniswap',
              'MakerDAO',
              'Arbitrum',
              'Optimism',
              'ENS',
              'Gitcoin',
              'Lido',
              'Curve',
              'Balancer',
              'dYdX',
              'Safe',
              'The Graph',
              'Polygon',
            ].map((forum) => (
              <span
                key={forum}
                className="px-4 py-2 bg-neutral-800 rounded-lg text-sm text-neutral-300"
              >
                {forum}
              </span>
            ))}
            <span className="px-4 py-2 bg-indigo-600/20 border border-indigo-500/30 rounded-lg text-sm text-indigo-400">
              +55 more
            </span>
          </div>
          <p className="text-center text-neutral-500 text-sm">
            Plus support for adding any custom Discourse forum URL
          </p>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-indigo-900/30 to-indigo-800/20">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to Streamline Your Governance Workflow?</h2>
          <p className="text-neutral-400 mb-8">
            Start aggregating governance discussions from across the ecosystem today.
            Sign in to sync your preferences across devices.
          </p>
          <Link
            href="/app"
            className="inline-flex items-center gap-2 px-8 py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg transition-colors text-lg"
          >
            Launch App
            <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t border-neutral-800">
        <div className="max-w-6xl mx-auto px-6 text-center text-neutral-500 text-sm">
          <p>Gov Watch - Governance Forum Aggregator</p>
          <p className="mt-2">
            Open source. Privacy-focused. Optional sync with secure authentication.
          </p>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="p-6 bg-neutral-900 border border-neutral-800 rounded-lg hover:border-neutral-700 transition-colors">
      <div className="inline-flex items-center justify-center w-10 h-10 bg-indigo-500/10 rounded-lg mb-4 text-indigo-400">
        {icon}
      </div>
      <h3 className="font-semibold mb-2">{title}</h3>
      <p className="text-neutral-400 text-sm">{description}</p>
    </div>
  );
}

function TipCard({
  number,
  title,
  tips,
}: {
  number: string;
  title: string;
  tips: string[];
}) {
  return (
    <div className="p-6 bg-neutral-800/50 border border-neutral-700 rounded-lg">
      <div className="flex items-center gap-3 mb-4">
        <span className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-sm font-bold">
          {number}
        </span>
        <h3 className="font-semibold">{title}</h3>
      </div>
      <ul className="space-y-2">
        {tips.map((tip, index) => (
          <li key={index} className="flex items-start gap-2 text-sm text-neutral-400">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
            <span>{tip}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ThemeIcon() {
  return (
    <div className="relative w-5 h-5">
      <Moon className="w-5 h-5 absolute inset-0" />
      <Sun className="w-3 h-3 absolute -right-1 -top-1 text-yellow-400" />
    </div>
  );
}
