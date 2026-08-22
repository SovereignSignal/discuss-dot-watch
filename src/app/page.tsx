'use client';

import { ArrowRight, Search, Bell, Bookmark, Eye, Newspaper, Landmark, Keyboard } from 'lucide-react';
import { getTotalForumCount, getForumsByCategory } from '@/lib/forumPresets';
import { getEnabledExternalSources } from '@/lib/externalSources';
import { MarketingChrome, MarketingLink } from '@/components/MarketingChrome';
import { HeroFeedPreview } from '@/components/HeroFeedPreview';
import { TickerBadge } from '@/components/ui/TickerBadge';
import { MetricBox } from '@/components/ui/MetricBox';
import { SectionHeader } from '@/components/ui/SectionHeader';
import type { Vertical } from '@/components/ui/TickerBadge';

const VERTICALS: Array<{
  id: Vertical;
  title: string;
  blurb: string;
  examples: string[];
}> = [
  {
    id: 'crypto',
    title: 'Crypto',
    blurb: 'DAO governance, Snapshot votes, Realms proposals, grants.',
    examples: ['Uniswap', 'Arbitrum', 'Aave', 'ENS', 'Optimism', 'Lido'],
  },
  {
    id: 'ai',
    title: 'AI',
    blurb: 'Safety funding, research, evals, and tooling forums.',
    examples: ['EA Forum', 'LessWrong', 'PyTorch', 'Hugging Face', 'LangChain'],
  },
  {
    id: 'oss',
    title: 'Open Source',
    blurb: 'Foundation governance, maintainer threads, release RFCs.',
    examples: ['Rust', 'Swift', 'NixOS', 'Godot', 'Next.js', 'Node.js'],
  },
];

const FEATURES = [
  { icon: Search, title: 'Unified search', body: 'Query every cached forum from one input.' },
  { icon: Bell, title: 'Keyword alerts', body: 'Filter the feed to the words you actually care about.' },
  { icon: Newspaper, title: 'Daily brief', body: 'New grants and paid roles, summarized once a day.' },
  { icon: Eye, title: 'Read tracking', body: 'Already-seen threads collapse so the inbox stays short.' },
  { icon: Bookmark, title: 'Saved folders', body: 'Bookmark a thread and file it without making an account.' },
  { icon: Landmark, title: 'Governance', body: 'Per-DAO terminals: turnout, idle VP, and forum-linked votes.' },
  { icon: Keyboard, title: 'Command menu', body: 'Cmd+K to jump views, forums, and density without the mouse.' },
];

export default function LandingPage() {
  const forumCount = getTotalForumCount();
  const sourceCount = getEnabledExternalSources().length;

  return (
    <MarketingChrome>
      <section className="px-5 pt-14 pb-16 md:pt-20 md:pb-24">
        <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:gap-14">
          <div>
            <SectionHeader meta={`${forumCount + sourceCount} sources`}>Coverage</SectionHeader>
            <div className="mb-5 flex flex-wrap gap-1.5">
              <TickerBadge vertical="crypto">CRYPTO</TickerBadge>
              <TickerBadge vertical="ai">AI</TickerBadge>
              <TickerBadge vertical="oss">OSS</TickerBadge>
            </div>

            <h1
              className="font-semibold tracking-tight leading-[1.08]"
              style={{ fontSize: 'clamp(2rem, 5vw, 3.25rem)' }}
            >
              All your forums.
              <br />
              <span style={{ color: 'var(--ds-fg-dim)' }}>One feed.</span>
            </h1>

            <p
              className="mt-5 max-w-md leading-relaxed"
              style={{ color: 'var(--ds-fg-muted)', fontSize: 'var(--ds-text-base)' }}
            >
              A reader for crypto, AI, and open-source communities — grants, roles,
              and governance in the same stream. No account.
            </p>

            <div className="mt-7 flex flex-wrap items-center gap-2.5">
              <MarketingLink href="/app" size="lg">
                Open the feed
                <ArrowRight className="h-4 w-4" />
              </MarketingLink>
              <MarketingLink href="#coverage" variant="secondary" size="lg">
                See coverage
              </MarketingLink>
            </div>

            <div className="mt-8 grid grid-cols-3 gap-2">
              <MetricBox label="Forums" value={forumCount} />
              <MetricBox label="External" value={sourceCount} sub="HN, Snapshot, Realms" />
              <MetricBox label="Verticals" value={3} sub="Crypto · AI · OSS" />
            </div>
          </div>

          <HeroFeedPreview />
        </div>
      </section>

      <section
        id="coverage"
        className="px-5 py-16 md:py-20"
        style={{ borderTop: '1px solid var(--ds-border)' }}
      >
        <div className="mx-auto max-w-6xl">
          <SectionHeader meta="three inboxes, one reader">Verticals</SectionHeader>
          <h2
            className="mb-8 font-semibold tracking-tight"
            style={{ fontSize: 'var(--ds-text-xl)' }}
          >
            The communities that move money, research, and code.
          </h2>
          <div className="grid gap-3 md:grid-cols-3">
            {VERTICALS.map((v) => (
              <VerticalCard
                key={v.id}
                vertical={v.id}
                title={v.title}
                count={getForumsByCategory(v.id).length}
                blurb={v.blurb}
                examples={v.examples}
              />
            ))}
          </div>
        </div>
      </section>

      <section
        className="px-5 py-16 md:py-20"
        style={{
          borderTop: '1px solid var(--ds-border)',
          backgroundColor: 'var(--ds-bg-card)',
        }}
      >
        <div className="mx-auto max-w-6xl">
          <SectionHeader>Reader</SectionHeader>
          <h2
            className="mb-8 font-semibold tracking-tight"
            style={{ fontSize: 'var(--ds-text-xl)' }}
          >
            Built like the feed you already use.
          </h2>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <FeatureRow key={f.title} icon={f.icon} title={f.title} body={f.body} />
            ))}
          </div>
        </div>
      </section>

      <section className="px-5 py-16 md:py-20" style={{ borderTop: '1px solid var(--ds-border)' }}>
        <div className="mx-auto grid max-w-6xl items-center gap-10 md:grid-cols-2">
          <div>
            <SectionHeader meta="REST · RSS · MCP">Agents</SectionHeader>
            <h2
              className="mb-4 font-semibold tracking-tight"
              style={{ fontSize: 'var(--ds-text-xl)' }}
            >
              Same corpus.
              <br />
              <span style={{ color: 'var(--ds-fg-dim)' }}>Machine-readable.</span>
            </h2>
            <p className="mb-6 leading-relaxed" style={{ color: 'var(--ds-fg-muted)', fontSize: 'var(--ds-text-sm)' }}>
              Search, subscribe, and pull classified grants without scraping each forum.
              Public API, per-vertical feeds, MCP tools.
            </p>
            <MarketingLink href="/api/v1" variant="secondary">
              API docs
              <ArrowRight className="h-3.5 w-3.5" />
            </MarketingLink>
          </div>
          <pre
            className="overflow-x-auto p-5 leading-relaxed"
            style={{
              backgroundColor: 'var(--ds-bg-card)',
              border: '1px solid var(--ds-border)',
              borderRadius: 'var(--ds-radius-xl)',
              fontFamily: 'var(--ds-font-mono)',
              fontSize: 'var(--ds-text-xs)',
              color: 'var(--ds-fg-muted)',
            }}
          >
            <span style={{ color: 'var(--ds-fg-dim)' }}># Search discussions</span>
            {'\n'}curl discuss.watch/api/v1/search?q=grants
            {'\n\n'}
            <span style={{ color: 'var(--ds-fg-dim)' }}># Classified grants</span>
            {'\n'}curl discuss.watch/api/v1/grants
            {'\n\n'}
            <span style={{ color: 'var(--ds-fg-dim)' }}># Subscribe</span>
            {'\n'}discuss.watch/feed/crypto.xml
          </pre>
        </div>
      </section>

      <section
        className="px-5 py-16 md:py-20"
        style={{
          borderTop: '1px solid var(--ds-border)',
          backgroundColor: 'var(--ds-bg-card)',
        }}
      >
        <div className="mx-auto max-w-xl text-center">
          <SectionHeader>Start</SectionHeader>
          <h2
            className="mb-3 font-semibold tracking-tight"
            style={{ fontSize: 'var(--ds-text-xl)' }}
          >
            Open the feed. Preferences stay in the browser.
          </h2>
          <p className="mb-7" style={{ color: 'var(--ds-fg-dim)', fontSize: 'var(--ds-text-sm)' }}>
            Free. No account. Dark or light, compact through cozy.
          </p>
          <MarketingLink href="/app" size="lg">
            Open App
            <ArrowRight className="h-4 w-4" />
          </MarketingLink>
        </div>
      </section>
    </MarketingChrome>
  );
}

function VerticalCard({
  vertical,
  title,
  count,
  blurb,
  examples,
}: {
  vertical: Vertical;
  title: string;
  count: number;
  blurb: string;
  examples: string[];
}) {
  return (
    <div
      className="p-5"
      style={{
        backgroundColor: 'var(--ds-bg-card)',
        border: '1px solid var(--ds-border)',
        borderRadius: 'var(--ds-radius-xl)',
      }}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <TickerBadge vertical={vertical} size="md">{title}</TickerBadge>
        <span
          style={{
            color: 'var(--ds-fg-dim)',
            fontFamily: 'var(--ds-font-mono)',
            fontSize: 'var(--ds-text-xs)',
          }}
        >
          {count}
        </span>
      </div>
      <p className="mb-4 leading-relaxed" style={{ color: 'var(--ds-fg-muted)', fontSize: 'var(--ds-text-sm)' }}>
        {blurb}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {examples.map((name) => (
          <TickerBadge key={name} vertical={vertical}>{name}</TickerBadge>
        ))}
      </div>
    </div>
  );
}

function FeatureRow({
  icon: Icon,
  title,
  body,
}: {
  icon: typeof Search;
  title: string;
  body: string;
}) {
  return (
    <div
      className="flex gap-3 p-4"
      style={{
        backgroundColor: 'var(--ds-bg-base)',
        border: '1px solid var(--ds-border)',
        borderRadius: 'var(--ds-radius-lg)',
      }}
    >
      <div
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md"
        style={{ backgroundColor: 'var(--ds-bg-elev)', color: 'var(--ds-fg-muted)' }}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <h3 className="font-medium" style={{ fontSize: 'var(--ds-text-sm)' }}>{title}</h3>
        <p className="mt-0.5 leading-relaxed" style={{ color: 'var(--ds-fg-dim)', fontSize: 'var(--ds-text-xs)' }}>
          {body}
        </p>
      </div>
    </div>
  );
}
