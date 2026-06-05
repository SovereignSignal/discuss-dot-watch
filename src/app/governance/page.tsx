'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Landmark, Users, Activity, FileText, ExternalLink, Loader2 } from 'lucide-react';
import type {
  GovernanceSnapshot,
  AnticaptureDao,
  VotingPowerEntry,
  FeedEvent,
  AnticaptureProposal,
  TreasuryPoint,
} from '@/lib/delegates/anticaptureClient';

const DAO_LABELS: Record<string, string> = {
  UNI: 'Uniswap', AAVE: 'Aave', ENS: 'ENS', COMP: 'Compound', GTC: 'Gitcoin',
  SCR: 'Scroll', NOUNS: 'Nouns', LIL_NOUNS: 'Lil Nouns', FLUID: 'Fluid',
  OBOL: 'Obol', SHU: 'Shutter',
};
const label = (id: string) => DAO_LABELS[id] || id;

function fmtUsd(n: number): string {
  if (!isFinite(n)) return '—';
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}
function fmtToken(raw: string): string {
  let n = Number(raw);
  if (!isFinite(n)) return raw;
  if (n > 1e15) n = n / 1e18; // de-wei for 18-decimal governance tokens
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return n.toLocaleString(undefined, { maximumFractionDigits: 1 });
}
const shortAddr = (a: string) => (a && a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a);
function timeAgo(unixSec: number): string {
  const s = Math.max(0, Date.now() / 1000 - unixSec);
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
const RELEVANCE: Record<string, string> = { HIGH: 'var(--ds-error)', MEDIUM: 'var(--ds-warn)', LOW: 'var(--ds-fg-dim)' };

function Panel({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section
      className="rounded-xl p-5"
      style={{ backgroundColor: 'var(--ds-bg-card)', border: '1px solid var(--ds-border)' }}
    >
      <div className="flex items-center gap-2 mb-4" style={{ color: 'var(--ds-fg-muted)' }}>
        {icon}
        <h2 className="text-sm font-semibold uppercase tracking-wide">{title}</h2>
      </div>
      {children}
    </section>
  );
}

export default function GovernancePage() {
  const [daos, setDaos] = useState<AnticaptureDao[]>([]);
  const [selected, setSelected] = useState<string>('UNI');
  const [snap, setSnap] = useState<GovernanceSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [configured, setConfigured] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = localStorage.getItem('discuss-watch-theme');
    document.documentElement.classList.toggle('light', t === 'light');
    document.documentElement.classList.toggle('dark', t !== 'light');
  }, []);

  useEffect(() => {
    fetch('/api/anticapture')
      .then((r) => r.json())
      .then((d) => {
        setConfigured(d.configured !== false);
        if (Array.isArray(d.daos) && d.daos.length) setDaos(d.daos);
      })
      .catch(() => {});
  }, []);

  const loadDao = useCallback((id: string) => {
    setLoading(true);
    setError(null);
    fetch(`/api/anticapture/${id.toLowerCase()}`)
      .then((r) => r.json())
      .then((d) => {
        setConfigured(d.configured !== false);
        if (d.error) setError(d.error);
        else setSnap(d as GovernanceSnapshot);
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadDao(selected); }, [selected, loadDao]);

  const treasuryNow = snap?.treasury?.length
    ? snap.treasury.reduce((a, b) => (b.date > a.date ? b : a))
    : null;
  const pickList = (daos.length ? daos.map((d) => d.id) : Object.keys(DAO_LABELS));

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--ds-bg-base)', color: 'var(--ds-fg)' }}>
      <header
        className="sticky top-0 z-10 border-b backdrop-blur-sm"
        style={{ backgroundColor: 'color-mix(in srgb, var(--ds-bg-base) 80%, transparent)', borderColor: 'var(--ds-border)' }}
      >
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link href="/app" className="text-lg">👁️‍🗨️</Link>
            <span className="font-semibold">Governance Analytics</span>
            <span
              className="text-[10px] px-2 py-0.5 rounded-full font-medium"
              style={{ backgroundColor: 'var(--ds-bg-subtle)', color: 'var(--ds-fg-muted)' }}
            >
              via Anticapture
            </span>
          </div>
          <Link href="/app" className="text-sm" style={{ color: 'var(--ds-fg-muted)' }}>← Back to feed</Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* DAO picker */}
        <div className="flex flex-wrap gap-2 mb-8">
          {pickList.map((id) => {
            const active = id === selected;
            return (
              <button
                key={id}
                onClick={() => setSelected(id)}
                className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
                style={{
                  backgroundColor: active ? 'var(--ds-fg)' : 'var(--ds-bg-subtle)',
                  color: active ? 'var(--ds-bg-base)' : 'var(--ds-fg-muted)',
                  border: '1px solid var(--ds-border)',
                }}
              >
                {label(id)}
              </button>
            );
          })}
        </div>

        {!configured && (
          <div className="rounded-xl p-8 text-center" style={{ backgroundColor: 'var(--ds-bg-card)', border: '1px solid var(--ds-border)' }}>
            <p style={{ color: 'var(--ds-fg-muted)' }}>
              Anticapture isn&apos;t configured. Set <code>ANTICAPTURE_API_KEY</code> to enable governance analytics.
            </p>
          </div>
        )}

        {configured && loading && (
          <div className="flex items-center justify-center py-24" style={{ color: 'var(--ds-fg-muted)' }}>
            <Loader2 className="w-6 h-6 animate-spin" />
            <span className="ml-3 text-sm">Loading {label(selected)} governance data…</span>
          </div>
        )}

        {configured && error && !loading && (
          <div className="rounded-xl p-6" style={{ backgroundColor: 'var(--ds-bg-card)', border: '1px solid var(--ds-error)' }}>
            <p style={{ color: 'var(--ds-error)' }}>Couldn&apos;t load {label(selected)}: {error}</p>
          </div>
        )}

        {configured && !loading && !error && snap && (
          <div className="grid lg:grid-cols-2 gap-5">
            {/* Treasury */}
            <Panel icon={<Landmark className="w-4 h-4" />} title="Total Treasury">
              <div className="text-4xl font-bold mb-1">{treasuryNow ? fmtUsd(treasuryNow.value) : '—'}</div>
              <p className="text-sm" style={{ color: 'var(--ds-fg-dim)' }}>
                {treasuryNow ? `as of ${timeAgo(treasuryNow.date)} · ${snap.treasury.length}-point 90d series` : 'no data'}
              </p>
            </Panel>

            {/* Proposals */}
            <Panel icon={<FileText className="w-4 h-4" />} title={`Recent Proposals (${snap.proposals.length})`}>
              <ul className="space-y-2">
                {snap.proposals.slice(0, 5).map((p: AnticaptureProposal) => (
                  <li key={p.id} className="text-sm">
                    <span className="font-medium">{p.title}</span>
                    <span className="block text-xs" style={{ color: 'var(--ds-fg-dim)' }}>
                      #{p.id} · proposer {shortAddr(p.proposerAccountId)}
                    </span>
                  </li>
                ))}
                {!snap.proposals.length && <li className="text-sm" style={{ color: 'var(--ds-fg-dim)' }}>No proposals.</li>}
              </ul>
            </Panel>

            {/* Delegates */}
            <Panel icon={<Users className="w-4 h-4" />} title={`Top Delegates by Voting Power (${snap.votingPowers.length})`}>
              <ul className="space-y-2">
                {snap.votingPowers.slice(0, 8).map((v: VotingPowerEntry, i) => (
                  <li key={v.accountId} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 min-w-0">
                      <span style={{ color: 'var(--ds-fg-dim)' }}>{i + 1}.</span>
                      <span className="font-mono">{shortAddr(v.accountId)}</span>
                    </span>
                    <span className="flex items-center gap-3 flex-shrink-0">
                      <span className="font-semibold">{fmtToken(v.votingPower)}</span>
                      <span className="text-xs" style={{ color: 'var(--ds-fg-dim)' }}>{v.votesCount} votes · {v.delegationsCount} dlg</span>
                    </span>
                  </li>
                ))}
                {!snap.votingPowers.length && <li className="text-sm" style={{ color: 'var(--ds-fg-dim)' }}>No delegate data.</li>}
              </ul>
            </Panel>

            {/* Feed events */}
            <Panel icon={<Activity className="w-4 h-4" />} title={`Governance Events (${snap.feedEvents.length})`}>
              <ul className="space-y-2">
                {snap.feedEvents.slice(0, 8).map((e: FeedEvent) => (
                  <li key={`${e.txHash}-${e.logIndex}`} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 min-w-0">
                      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: RELEVANCE[e.relevance] || 'var(--ds-fg-dim)' }} />
                      <span className="font-medium">{e.type}</span>
                    </span>
                    <span className="flex items-center gap-2 flex-shrink-0 text-xs" style={{ color: 'var(--ds-fg-dim)' }}>
                      <span>{timeAgo(e.timestamp)}</span>
                      <a href={`https://etherscan.io/tx/${e.txHash}`} target="_blank" rel="noopener noreferrer" className="hover:opacity-70">
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </span>
                  </li>
                ))}
                {!snap.feedEvents.length && <li className="text-sm" style={{ color: 'var(--ds-fg-dim)' }}>No recent events.</li>}
              </ul>
            </Panel>
          </div>
        )}
      </main>
    </div>
  );
}
