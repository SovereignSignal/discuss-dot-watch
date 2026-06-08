'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ExternalLink, MessageSquare } from 'lucide-react';
import type { DelegateActivity, DelegateHistoryItem } from '@/lib/delegates/anticaptureClient';
import { daoTheme, fmtTok, short, agoTs, vpNum, SUPPORT, STATUS_COLOR } from '../../_lib';

type DelegateData = DelegateActivity & { configured?: boolean; error?: string };

function avgTiming(seconds: number) {
  if (!seconds || seconds <= 0) return '—';
  const d = seconds / 86400;
  return d >= 1 ? `${d.toFixed(1)}d` : `${Math.round(seconds / 3600)}h`;
}

/** Compact stacked for/against/abstain outcome bar for a proposal. */
function ResultBar({ f, a, b }: { f: number; a: number; b: number }) {
  const total = f + a + b || 1;
  return (
    <div className="h-1.5 rounded-full overflow-hidden flex w-full" style={{ backgroundColor: 'var(--ds-bg-subtle)' }}>
      <div style={{ width: `${(f / total) * 100}%`, backgroundColor: SUPPORT['1'].color }} />
      <div style={{ width: `${(a / total) * 100}%`, backgroundColor: SUPPORT['0'].color }} />
      <div style={{ width: `${(b / total) * 100}%`, backgroundColor: SUPPORT['2'].color }} />
    </div>
  );
}

function HistoryRow({ item, accent }: { item: DelegateHistoryItem; accent: string }) {
  const p = item.proposal;
  const v = item.userVote;
  const sup = v ? SUPPORT[v.support] : null;
  const statusColor = STATUS_COLOR[String(p.status || '').toUpperCase()] || 'var(--ds-fg-dim)';
  return (
    <li className="flex flex-col gap-2.5 pb-4 border-b last:border-0" style={{ borderColor: 'var(--ds-border-subtle)' }}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-sm font-medium">{p.title}</div>
          <div className="text-xs mt-1 flex items-center gap-2 flex-wrap" style={{ color: 'var(--ds-fg-dim)' }}>
            <span style={{ fontFamily: 'var(--ds-font-mono)' }}>#{p.id}</span>
            <span style={{ color: statusColor }}>{String(p.status || '').toLowerCase() || '—'}</span>
            {v?.timestamp != null && <span>· voted {agoTs(v.timestamp)} ago</span>}
            {p.discussionUrl && (
              <a href={p.discussionUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:underline" style={{ color: accent }}>
                <MessageSquare className="w-3 h-3" /> discussion
              </a>
            )}
          </div>
        </div>
        <div className="flex-shrink-0 text-right">
          {sup ? (
            <span className="inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded" style={{ backgroundColor: `${sup.color}22`, color: sup.color }}>{sup.label}</span>
          ) : (
            <span className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: 'var(--ds-bg-subtle)', color: 'var(--ds-fg-dim)' }}>didn’t vote</span>
          )}
          {v && <div className="text-xs mt-1 tabular-nums" style={{ color: 'var(--ds-fg-dim)', fontFamily: 'var(--ds-font-mono)' }}>{fmtTok(v.votingPower)} VP</div>}
        </div>
      </div>
      <ResultBar f={vpNum(p.forVotes ?? 0)} a={vpNum(p.againstVotes ?? 0)} b={vpNum(p.abstainVotes ?? 0)} />
      {v?.reason ? <p className="text-xs italic" style={{ color: 'var(--ds-fg-muted)' }}>“{v.reason}”</p> : null}
    </li>
  );
}

export default function DelegatePage() {
  const params = useParams<{ dao: string; address: string }>();
  const id = (params?.dao || 'uni').toLowerCase();
  const address = (params?.address || '').toLowerCase();
  const theme = daoTheme(id);

  const [data, setData] = useState<DelegateData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = localStorage.getItem('discuss-watch-theme');
    document.documentElement.classList.toggle('light', t === 'light');
    document.documentElement.classList.toggle('dark', t !== 'light');
  }, []);

  useEffect(() => {
    setLoading(true); setError(null); setData(null);
    fetch(`/api/anticapture/${id}/delegate/${address}`)
      .then((r) => r.json())
      .then((d) => { if (d.error) setError(d.error); else if (d.configured === false) setError('Set ANTICAPTURE_API_KEY to enable.'); else setData(d); })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [id, address]);

  const name = data?.label || short(address);
  const card = { backgroundColor: 'var(--ds-bg-card)', border: '1px solid var(--ds-border)' } as const;
  const pct = data && data.totalProposals ? Math.round((data.votedProposals / data.totalProposals) * 100) : 0;

  const metrics = data
    ? [
        { k: 'Voting power', v: data.votingPower ? fmtTok(data.votingPower) : '—', s: `$${theme.token}` },
        { k: 'Participation', v: `${data.votedProposals}/${data.totalProposals}`, s: `${pct}% voted` },
        { k: 'Win rate', v: `${Math.round(data.winRate)}%`, s: 'voted with outcome' },
        { k: 'Avg timing', v: avgTiming(data.avgTimeBeforeEnd), s: 'before close' },
      ]
    : [];

  return (
    <div className="min-h-screen relative overflow-x-hidden" style={{ backgroundColor: 'var(--ds-bg-base)', color: 'var(--ds-fg)' }}>
      <style>{`@keyframes rise{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}.rise{animation:rise .5s cubic-bezier(.2,.7,.2,1) both}`}</style>
      <div aria-hidden className="pointer-events-none fixed inset-0" style={{ background: `radial-gradient(60% 40% at 75% -5%, ${theme.glow}, transparent 70%)` }} />
      <div aria-hidden className="pointer-events-none fixed inset-0 opacity-[0.035]" style={{ backgroundImage: 'linear-gradient(var(--ds-fg) 1px, transparent 1px), linear-gradient(90deg, var(--ds-fg) 1px, transparent 1px)', backgroundSize: '48px 48px' }} />

      <div className="relative max-w-5xl mx-auto px-6 pb-20">
        {/* nav */}
        <header className="flex items-center justify-between py-5">
          <div className="flex items-center gap-3 text-sm min-w-0">
            <Link href="/app" className="text-lg flex-shrink-0">👁️‍🗨️</Link>
            <span className="flex-shrink-0" style={{ color: 'var(--ds-fg-dim)' }}>discuss.watch</span>
            <span style={{ color: 'var(--ds-border)' }}>/</span>
            <Link href={`/governance/${id}`} className="hover:underline flex-shrink-0" style={{ color: 'var(--ds-fg-muted)' }}>{theme.name}</Link>
            <span style={{ color: 'var(--ds-border)' }}>/</span>
            <span className="font-medium flex-shrink-0">delegate</span>
          </div>
          <Link href={`/governance/${id}`} className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md flex-shrink-0" style={{ color: 'var(--ds-fg-muted)', border: '1px solid var(--ds-border)' }}>
            <ArrowLeft className="w-3 h-3" /> {theme.name}
          </Link>
        </header>

        {error && <div className="rise rounded-xl p-6" style={{ ...card, borderColor: 'var(--ds-error)' }}><span style={{ color: 'var(--ds-error)' }}>{error}</span></div>}
        {loading && <div className="py-24 text-center text-sm" style={{ color: 'var(--ds-fg-dim)' }}>Loading delegate record…</div>}

        {data && !loading && (
          <>
            {/* hero identity */}
            <section className="rise pt-8 pb-6">
              <div className="flex items-center gap-3 mb-1.5 flex-wrap">
                <h1 className="text-4xl md:text-5xl font-bold tracking-tight break-all">{name}</h1>
                {data.isContract && <span className="text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wide" style={{ backgroundColor: 'var(--ds-bg-subtle)', color: 'var(--ds-fg-dim)' }}>contract</span>}
              </div>
              <div className="flex items-center gap-3 text-sm flex-wrap" style={{ color: 'var(--ds-fg-dim)' }}>
                <a href={`https://etherscan.io/address/${address}`} target="_blank" rel="noopener noreferrer" className="hover:underline flex items-center gap-1" style={{ fontFamily: 'var(--ds-font-mono)' }}>
                  {short(address)} <ExternalLink className="w-3 h-3" />
                </a>
                <span>· {theme.name} delegate · governance record via Anticapture</span>
              </div>
            </section>

            {/* stat strip */}
            <section className="rise grid grid-cols-2 md:grid-cols-4 gap-px rounded-xl overflow-hidden mb-6" style={{ backgroundColor: 'var(--ds-border)', animationDelay: '.05s' }}>
              {metrics.map((m) => (
                <div key={m.k} className="p-5" style={{ backgroundColor: 'var(--ds-bg-card)' }}>
                  <div className="text-[11px] uppercase tracking-wider mb-2" style={{ color: 'var(--ds-fg-dim)' }}>{m.k}</div>
                  <div className="text-2xl font-bold" style={{ fontFamily: 'var(--ds-font-mono)' }}>{m.v}</div>
                  <div className="text-xs mt-1" style={{ color: 'var(--ds-fg-dim)' }}>{m.s}</div>
                </div>
              ))}
            </section>

            {/* voting history */}
            <section className="rise rounded-xl p-6" style={{ ...card, animationDelay: '.1s' }}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-[11px] uppercase tracking-wider" style={{ color: 'var(--ds-fg-dim)' }}>Voting history</h2>
                <span className="text-xs" style={{ color: 'var(--ds-fg-dim)' }}>{data.history.length} proposals · {Math.round(data.yesRate)}% voted “for”</span>
              </div>
              {data.neverVoted || data.history.length === 0 ? (
                <p className="text-sm" style={{ color: 'var(--ds-fg-dim)' }}>This address holds voting power but hasn’t cast an on-chain vote.</p>
              ) : (
                <ul className="space-y-4">
                  {data.history.map((h) => <HistoryRow key={h.proposal.id} item={h} accent={theme.accent} />)}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
