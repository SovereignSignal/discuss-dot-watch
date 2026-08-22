import { MessageSquare, Eye, Clock, LayoutGrid, Newspaper, FolderOpen, Landmark, Bookmark, Sparkles } from 'lucide-react';
import { TickerBadge } from '@/components/ui/TickerBadge';
import type { Vertical } from '@/components/ui/TickerBadge';

function FilterChip({ label, active }: { label: string; active?: boolean }) {
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-1 font-medium"
      style={{
        fontSize: 'var(--ds-text-xs)',
        background: 'var(--ds-bg-elev)',
        color: active ? 'var(--ds-fg)' : 'var(--ds-fg-muted)',
        border: `1px solid ${active ? 'var(--ds-fg)' : 'var(--ds-border)'}`,
      }}
    >
      {label}
    </span>
  );
}

function ReasonChip({ label }: { label: string }) {
  return (
    <span
      className="inline-flex items-center gap-0.5 font-medium"
      style={{ fontSize: 'var(--ds-text-xs)', color: 'var(--ds-fg-dim)' }}
    >
      <Sparkles className="h-3 w-3" />
      {label}
    </span>
  );
}

function PreviewRow({
  ticker,
  vertical,
  title,
  excerpt,
  replies,
  views,
  time,
  chip,
}: {
  ticker: string;
  vertical: Vertical;
  title: string;
  excerpt: string;
  replies: number;
  views: string;
  time: string;
  chip?: string;
}) {
  return (
    <article
      className="relative overflow-hidden"
      style={{
        backgroundColor: 'var(--ds-bg-card)',
        border: '1px solid var(--ds-border)',
        borderRadius: 'var(--ds-radius-lg)',
        padding: 'var(--ds-density-item-py) var(--ds-density-item-px)',
      }}
    >
      <div className="absolute left-0 top-0 h-full w-0.5" style={{ backgroundColor: 'var(--ds-fg)' }} />
      <div className="flex items-center gap-2 flex-wrap">
        <TickerBadge vertical={vertical}>{ticker}</TickerBadge>
        {chip && <ReasonChip label={chip} />}
      </div>
      <h3
        className="mt-1 font-medium leading-snug"
        style={{ color: 'var(--ds-fg)', fontSize: 'var(--ds-density-item-title)' }}
      >
        {title}
      </h3>
      <p
        className="density-excerpt mt-0.5 line-clamp-1 leading-relaxed"
        style={{ color: 'var(--ds-fg-dim)', fontSize: 12 }}
      >
        {excerpt}
      </p>
      <div
        className="mt-1.5 flex flex-wrap items-center gap-x-3"
        style={{ color: 'var(--ds-fg-dim)', fontSize: 'var(--ds-text-xs)' }}
      >
        <span className="inline-flex items-center gap-1"><MessageSquare className="h-3 w-3" />{replies}</span>
        <span className="inline-flex items-center gap-1"><Eye className="h-3 w-3" />{views}</span>
        <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{time}</span>
      </div>
    </article>
  );
}

const NAV_ITEMS = [
  { label: 'Feed', icon: LayoutGrid, active: true },
  { label: 'Briefs', icon: Newspaper },
  { label: 'Communities', icon: FolderOpen },
  { label: 'Governance', icon: Landmark },
  { label: 'Saved', icon: Bookmark },
] as const;

const ROWS = [
  {
    ticker: 'Uniswap',
    vertical: 'crypto' as const,
    title: 'Temperature check: fee switch activation',
    excerpt: 'Should the protocol turn on the fee switch for v3 and v4 pools?',
    replies: 24,
    views: '1,847',
    time: '2h',
  },
  {
    ticker: 'EA Forum',
    vertical: 'ai' as const,
    title: 'Notes from the evals workshop last week',
    excerpt: 'Write-up of the open problems people actually argued about.',
    replies: 11,
    views: '640',
    time: '4h',
  },
  {
    ticker: 'PyTorch',
    vertical: 'ai' as const,
    title: 'RFC: native support for structured sparsity',
    excerpt: 'Looking for feedback on compiler hooks before the 2.6 branch cut.',
    replies: 18,
    views: '2,420',
    time: 'Yesterday',
    chip: 'new',
  },
  {
    ticker: 'NixOS',
    vertical: 'oss' as const,
    title: 'RFC 0182: simplified package versioning',
    excerpt: 'A compatibility window for flakes that still pin by commit hash.',
    replies: 42,
    views: '1,203',
    time: '2d',
  },
];

/**
 * Static slice of the reader chrome — same tokens, tickers, and row
 * rhythm as DiscussionItem / Sidebar so the landing preview is the app.
 */
export function HeroFeedPreview() {
  return (
    <div
      className="overflow-hidden"
      style={{
        backgroundColor: 'var(--ds-bg-card)',
        border: '1px solid var(--ds-border)',
        borderRadius: 'var(--ds-radius-xl)',
      }}
      aria-hidden
    >
      <div
        className="flex h-11 items-center justify-between px-3"
        style={{ borderBottom: '1px solid var(--ds-border)' }}
      >
        <div className="flex items-center gap-2">
          <span className="text-sm">👁️‍🗨️</span>
          <span className="font-semibold tracking-tight" style={{ fontSize: 'var(--ds-text-sm)' }}>
            discuss.watch
          </span>
        </div>
        <div
          className="inline-flex rounded-md p-0.5"
          style={{ background: 'var(--ds-bg-elev)', border: '1px solid var(--ds-border)' }}
        >
          {(['≡', '▤', '☰'] as const).map((glyph, i) => (
            <span
              key={glyph}
              className="px-1.5 py-0.5 text-[10px] font-medium rounded"
              style={{
                background: i === 1 ? 'var(--ds-bg-subtle)' : 'transparent',
                color: i === 1 ? 'var(--ds-fg)' : 'var(--ds-fg-muted)',
              }}
            >
              {glyph}
            </span>
          ))}
        </div>
      </div>

      <div className="flex min-h-0">
        <aside
          className="hidden w-40 shrink-0 flex-col py-2 md:flex"
          style={{ borderRight: '1px solid var(--ds-border)' }}
        >
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = 'active' in item && item.active;
            return (
              <div
                key={item.label}
                className="mx-1.5 flex items-center gap-2.5 rounded-md px-2.5 py-1.5"
                style={{
                  background: active ? 'var(--ds-bg-elev)' : 'transparent',
                  color: active ? 'var(--ds-fg)' : 'var(--ds-fg-muted)',
                  fontSize: 'var(--ds-text-sm)',
                }}
              >
                <Icon className="h-3.5 w-3.5" />
                {item.label}
              </div>
            );
          })}
        </aside>

        <div className="min-w-0 flex-1 p-3">
          <div className="mb-3 flex flex-wrap gap-1.5">
            <FilterChip label="All" active />
            <FilterChip label="Crypto" />
            <FilterChip label="AI" />
            <FilterChip label="OSS" />
          </div>
          <div className="space-y-2">
            {ROWS.map((row) => (
              <PreviewRow key={row.ticker} {...row} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
