'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowUpRight, ExternalLink } from 'lucide-react';
import type { GovernanceSnapshot, VotingPowerEntry, FeedEvent, AnticaptureProposal, TreasuryPoint } from '@/lib/delegates/anticaptureClient';

// Per-DAO identity + brand accent — each ecosystem dashboard wears its own colour.
const DAO: Record<string, { name: string; token: string; accent: string; glow: string }> = {
  uni: { name: 'Uniswap', token: 'UNI', accent: '#FF007A', glow: 'rgba(255,0,122,0.18)' },
  aave: { name: 'Aave', token: 'AAVE', accent: '#B6509E', glow: 'rgba(182,80,158,0.18)' },
  ens: { name: 'ENS', token: 'ENS', accent: '#5298FF', glow: 'rgba(82,152,255,0.18)' },
  comp: { name: 'Compound', token: 'COMP', accent: '#00D395', glow: 'rgba(0,211,149,0.16)' },
  gtc: { name: 'Gitcoin', token: 'GTC', accent: '#02E2AC', glow: 'rgba(2,226,172,0.16)' },
  scr: { name: 'Scroll', token: 'SCR', accent: '#EBC28E', glow: 'rgba(235,194,142,0.18)' },
  nouns: { name: 'Nouns', token: 'NOUNS', accent: '#D63A3A', glow: 'rgba(214,58,58,0.16)' },
  lil_nouns: { name: 'Lil Nouns', token: 'LIL', accent: '#E7A23B', glow: 'rgba(231,162,59,0.16)' },
  fluid: { name: 'Fluid', token: 'FLUID', accent: '#2F6BFF', glow: 'rgba(47,107,255,0.16)' },
  obol: { name: 'Obol', token: 'OBOL', accent: '#F26B5E', glow: 'rgba(242,107,94,0.16)' },
  shu: { name: 'Shutter', token: 'SHU', accent: '#1B3A2E', glow: 'rgba(86,196,150,0.16)' },
};
const ORDER = ['uni', 'aave', 'ens', 'comp', 'gtc', 'scr', 'nouns', 'fluid', 'lil_nouns', 'obol', 'shu'];

const fmtUsd = (n: number) => (!isFinite(n) ? '—' : n >= 1e9 ? `$${(n / 1e9).toFixed(2)}B` : n >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `$${(n / 1e3).toFixed(0)}K` : `$${n.toFixed(0)}`);
function fmtTok(raw: string) {
  let n = Number(raw);
  if (!isFinite(n)) return raw;
  if (n > 1e15) n = n / 1e18;
  return n >= 1e9 ? `${(n / 1e9).toFixed(2)}B` : n >= 1e6 ? `${(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}K` : n.toLocaleString(undefined, { maximumFractionDigits: 1 });
}
const short = (a: string) => (a && a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a);
function ago(s: number) {
  const d = Math.max(0, Date.now() / 1000 - s);
  return d < 3600 ? `${Math.floor(d / 60)}m` : d < 86400 ? `${Math.floor(d / 3600)}h` : `${Math.floor(d / 86400)}d`;
}
const REL: Record<string, string> = { HIGH: '#ef4444', MEDIUM: '#f59e0b', LOW: '#71717a' };

/** SVG area chart of the treasury series. */
function TreasuryChart({ points, accent }: { points: TreasuryPoint[]; accent: string }) {
  const { line, area } = useMemo(() => {
    const pts = [...points].sort((a, b) => a.date - b.date);
    if (pts.length < 2) return { line: '', area: '' };
    const W = 640, H = 150, P = 4;
    const xs = pts.map((p) => p.date), ys = pts.map((p) => p.value);
    const xmin = Math.min(...xs), xmax = Math.max(...xs), ymin = Math.min(...ys), ymax = Math.max(...ys);
    const x = (v: number) => P + ((v - xmin) / (xmax - xmin || 1)) * (W - 2 * P);
    const y = (v: number) => P + (1 - (v - ymin) / (ymax - ymin || 1)) * (H - 2 * P);
    const d = pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.date).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
    return { line: d, area: `${d} L${(W - P).toFixed(1)},${H} L${P},${H} Z` };
  }, [points]);
  if (!line) return null;
  return (
    <svg viewBox="0 0 640 150" preserveAspectRatio="none" className="w-full h-28">
      <defs>
        <linearGradient id="tg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={accent} stopOpacity="0.35" />
          <stop offset="100%" stopColor={accent} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#tg)" />
      <path d={line} fill="none" stroke={accent} strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export default function DaoGovernancePage() {
  const params = useParams<{ dao: string }>();
  const id = (params?.dao || 'uni').toLowerCase();
  const theme = DAO[id] || { name: id.toUpperCase(), token: id.toUpperCase(), accent: '#a1a1aa', glow: 'rgba(161,161,170,0.14)' };

  const [snap, setSnap] = useState<GovernanceSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = localStorage.getItem('discuss-watch-theme');
    document.documentElement.classList.toggle('light', t === 'light');
    document.documentElement.classList.toggle('dark', t !== 'light');
  }, []);

  useEffect(() => {
    setLoading(true); setError(null); setSnap(null);
    fetch(`/api/anticapture/${id}`)
      .then((r) => r.json())
      .then((d) => { if (d.error) setError(d.error); else if (d.configured === false) setError('Set ANTICAPTURE_API_KEY to enable.'); else setSnap(d); })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [id]);

  const treasuryNow = snap?.treasury?.length ? snap.treasury.reduce((a, b) => (b.date > a.date ? b : a)) : null;
  const totalVp = snap?.votingPowers?.reduce((s, v) => s + (Number(v.votingPower) > 1e15 ? Number(v.votingPower) / 1e18 : Number(v.votingPower)), 0) || 0;
  const topVp = snap?.votingPowers?.[0] ? (Number(snap.votingPowers[0].votingPower) > 1e15 ? Number(snap.votingPowers[0].votingPower) / 1e18 : Number(snap.votingPowers[0].votingPower)) : 0;
  const maxBar = snap?.votingPowers?.[0]?.votingPower ? Number(snap.votingPowers[0].votingPower) : 1;

  return (
    <div className="min-h-screen relative overflow-x-hidden" style={{ backgroundColor: 'var(--ds-bg-base)', color: 'var(--ds-fg)' }}>
      <style>{`@keyframes rise{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}.rise{animation:rise .5s cubic-bezier(.2,.7,.2,1) both}`}</style>
      {/* atmosphere */}
      <div aria-hidden className="pointer-events-none fixed inset-0" style={{ background: `radial-gradient(60% 40% at 75% -5%, ${theme.glow}, transparent 70%)` }} />
      <div aria-hidden className="pointer-events-none fixed inset-0 opacity-[0.035]" style={{ backgroundImage: 'linear-gradient(var(--ds-fg) 1px, transparent 1px), linear-gradient(90deg, var(--ds-fg) 1px, transparent 1px)', backgroundSize: '48px 48px' }} />

      <div className="relative max-w-6xl mx-auto px-6 pb-20">
        {/* nav */}
        <header className="flex items-center justify-between py-5">
          <div className="flex items-center gap-3">
            <Link href="/app" className="text-lg">👁️‍🗨️</Link>
            <span className="text-sm" style={{ color: 'var(--ds-fg-dim)' }}>discuss.watch</span>
            <span style={{ color: 'var(--ds-border)' }}>/</span>
            <span className="text-sm font-medium">governance</span>
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto">
            {ORDER.map((d) => (
              <Link key={d} href={`/governance/${d}`}
                className="px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap"
                style={d === id ? { backgroundColor: theme.accent, color: '#fff' } : { color: 'var(--ds-fg-muted)' }}>
                {DAO[d]?.token || d}
              </Link>
            ))}
          </div>
        </header>

        {/* hero */}
        <section className="rise pt-10 pb-8">
          <div className="flex items-baseline gap-3 mb-1">
            <h1 className="text-5xl md:text-6xl font-bold tracking-tight">{theme.name}</h1>
            <span className="text-sm font-mono px-2 py-0.5 rounded" style={{ backgroundColor: 'var(--ds-bg-subtle)', color: theme.accent, fontFamily: 'var(--ds-font-mono)' }}>${theme.token}</span>
          </div>
          <p style={{ color: 'var(--ds-fg-dim)' }}>On-chain governance · live analytics via Anticapture</p>
        </section>

        {error && <div className="rise rounded-xl p-6" style={{ backgroundColor: 'var(--ds-bg-card)', border: '1px solid var(--ds-error)' }}><span style={{ color: 'var(--ds-error)' }}>{error}</span></div>}
        {loading && <div className="py-24 text-center text-sm" style={{ color: 'var(--ds-fg-dim)' }}>Loading {theme.name} governance…</div>}

        {snap && !loading && (
          <>
            {/* metric strip */}
            <section className="rise grid grid-cols-2 md:grid-cols-4 gap-px rounded-xl overflow-hidden mb-6" style={{ backgroundColor: 'var(--ds-border)', animationDelay: '.05s' }}>
              {[
                { k: 'Treasury', v: treasuryNow ? fmtUsd(treasuryNow.value) : '—', s: treasuryNow ? `as of ${ago(treasuryNow.date)} ago` : '' },
                { k: 'Top delegates VP', v: fmtTok(String(totalVp)), s: `across ${snap.votingPowers.length}` },
                { k: 'Largest delegate', v: fmtTok(String(topVp)), s: totalVp ? `${((topVp / totalVp) * 100).toFixed(1)}% of tracked` : '' },
                { k: 'Proposals', v: String(snap.proposals.length), s: `${snap.feedEvents.length} recent events` },
              ].map((m) => (
                <div key={m.k} className="p-5" style={{ backgroundColor: 'var(--ds-bg-card)' }}>
                  <div className="text-[11px] uppercase tracking-wider mb-2" style={{ color: 'var(--ds-fg-dim)' }}>{m.k}</div>
                  <div className="text-2xl font-bold" style={{ fontFamily: 'var(--ds-font-mono)' }}>{m.v}</div>
                  <div className="text-xs mt-1" style={{ color: 'var(--ds-fg-dim)' }}>{m.s}</div>
                </div>
              ))}
            </section>

            {/* treasury chart */}
            <section className="rise rounded-xl p-6 mb-6" style={{ backgroundColor: 'var(--ds-bg-card)', border: '1px solid var(--ds-border)', animationDelay: '.1s' }}>
              <div className="flex items-end justify-between mb-3">
                <div>
                  <div className="text-[11px] uppercase tracking-wider" style={{ color: 'var(--ds-fg-dim)' }}>Total treasury · 90 days</div>
                  <div className="text-4xl font-bold mt-1" style={{ fontFamily: 'var(--ds-font-mono)' }}>{treasuryNow ? fmtUsd(treasuryNow.value) : '—'}</div>
                </div>
              </div>
              <TreasuryChart points={snap.treasury} accent={theme.accent} />
            </section>

            <div className="grid lg:grid-cols-2 gap-6">
              {/* delegates */}
              <section className="rise rounded-xl p-6" style={{ backgroundColor: 'var(--ds-bg-card)', border: '1px solid var(--ds-border)', animationDelay: '.15s' }}>
                <h2 className="text-[11px] uppercase tracking-wider mb-4" style={{ color: 'var(--ds-fg-dim)' }}>Delegates by voting power</h2>
                <ul className="space-y-3">
                  {snap.votingPowers.slice(0, 12).map((v: VotingPowerEntry, i) => {
                    const pct = Math.max(2, (Number(v.votingPower) / maxBar) * 100);
                    return (
                      <li key={v.accountId}>
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="flex items-center gap-2 min-w-0">
                            <span className="w-4 text-right tabular-nums" style={{ color: 'var(--ds-fg-dim)', fontFamily: 'var(--ds-font-mono)' }}>{i + 1}</span>
                            <a href={`https://etherscan.io/address/${v.accountId}`} target="_blank" rel="noopener noreferrer" className="font-mono hover:underline" style={{ fontFamily: 'var(--ds-font-mono)' }}>{short(v.accountId)}</a>
                          </span>
                          <span className="flex items-center gap-3 flex-shrink-0">
                            <span className="font-semibold" style={{ fontFamily: 'var(--ds-font-mono)' }}>{fmtTok(v.votingPower)}</span>
                            <span className="text-xs tabular-nums" style={{ color: 'var(--ds-fg-dim)' }}>{v.votesCount}v · {v.delegationsCount}d</span>
                          </span>
                        </div>
                        <div className="h-1 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--ds-bg-subtle)' }}>
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${theme.accent}, ${theme.accent}88)` }} />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>

              {/* events */}
              <section className="rise rounded-xl p-6" style={{ backgroundColor: 'var(--ds-bg-card)', border: '1px solid var(--ds-border)', animationDelay: '.2s' }}>
                <h2 className="text-[11px] uppercase tracking-wider mb-4" style={{ color: 'var(--ds-fg-dim)' }}>Governance events</h2>
                <ul className="space-y-2.5">
                  {snap.feedEvents.slice(0, 12).map((e: FeedEvent) => (
                    <li key={`${e.txHash}-${e.logIndex}`} className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2.5 min-w-0">
                        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: REL[e.relevance] || REL.LOW }} />
                        <span className="font-medium">{e.type}</span>
                        <span className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: 'var(--ds-bg-subtle)', color: 'var(--ds-fg-dim)' }}>{e.relevance.toLowerCase()}</span>
                      </span>
                      <a href={`https://etherscan.io/tx/${e.txHash}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs flex-shrink-0 hover:opacity-70" style={{ color: 'var(--ds-fg-dim)' }}>
                        {ago(e.timestamp)} ago <ExternalLink className="w-3 h-3" />
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            </div>

            {/* proposals */}
            <section className="rise rounded-xl p-6 mt-6" style={{ backgroundColor: 'var(--ds-bg-card)', border: '1px solid var(--ds-border)', animationDelay: '.25s' }}>
              <h2 className="text-[11px] uppercase tracking-wider mb-4" style={{ color: 'var(--ds-fg-dim)' }}>Recent proposals</h2>
              <ul className="divide-y" style={{ borderColor: 'var(--ds-border-subtle)' }}>
                {snap.proposals.slice(0, 8).map((p: AnticaptureProposal) => (
                  <li key={p.id} className="py-3 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{p.title}</div>
                      <div className="text-xs mt-0.5" style={{ color: 'var(--ds-fg-dim)', fontFamily: 'var(--ds-font-mono)' }}>#{p.id} · {short(p.proposerAccountId)}</div>
                    </div>
                    {p.txHash && (
                      <a href={`https://etherscan.io/tx/${p.txHash}`} target="_blank" rel="noopener noreferrer" className="flex-shrink-0" style={{ color: theme.accent }}>
                        <ArrowUpRight className="w-4 h-4" />
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
