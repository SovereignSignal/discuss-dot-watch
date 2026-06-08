'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowUpRight, ExternalLink, MessageSquare } from 'lucide-react';
import type { GovernanceSnapshot, VotingPowerEntry, FeedEvent, AnticaptureProposal, TreasuryPoint, OffchainProposal, AddressLabel } from '@/lib/delegates/anticaptureClient';
import type { DaoForumTopic } from '@/lib/delegates/daoForums';
import { DAO, ORDER, fmtUsd, fmtTok, short, ago, vpNum, SUPPORT, STATUS_COLOR } from '../_lib';

/** The /api/anticapture/[dao] response = snapshot + the forum topics the route joins in. */
type DashboardData = GovernanceSnapshot & { forumTopics?: DaoForumTopic[] };

const REL: Record<string, string> = { HIGH: '#ef4444', MEDIUM: '#f59e0b', LOW: '#71717a' };
const labelFor = (labels: Record<string, AddressLabel>, addr: string) => labels[addr.toLowerCase()]?.label;

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

  const [snap, setSnap] = useState<DashboardData | null>(null);
  const [labels, setLabels] = useState<Record<string, AddressLabel>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = localStorage.getItem('discuss-watch-theme');
    document.documentElement.classList.toggle('light', t === 'light');
    document.documentElement.classList.toggle('dark', t !== 'light');
  }, []);

  useEffect(() => {
    setLoading(true); setError(null); setSnap(null); setLabels({});
    fetch(`/api/anticapture/${id}`)
      .then((r) => r.json())
      .then((d) => { if (d.error) setError(d.error); else if (d.configured === false) setError('Set ANTICAPTURE_API_KEY to enable.'); else setSnap(d); })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [id]);

  // Feature 1: enrich the biggest delegates (and no-shows) with Arkham/ENS labels,
  // fetched after the board paints so it never blocks first render.
  useEffect(() => {
    if (!snap?.votingPowers?.length) return;
    const top = snap.votingPowers.slice(0, 8).map((v) => v.accountId);
    const noShows = (snap.accountability?.nonVoters ?? []).slice(0, 5).map((n) => n.voter);
    const addrs = [...new Set([...top, ...noShows].map((a) => a.toLowerCase()))].slice(0, 12);
    if (!addrs.length) return;
    let cancelled = false;
    fetch(`/api/anticapture/${id}/labels?addresses=${addrs.join(',')}`)
      .then((r) => r.json())
      .then((d) => { if (!cancelled && d.labels) setLabels(d.labels); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [snap, id]);

  const treasuryNow = snap?.treasury?.length ? snap.treasury.reduce((a, b) => (b.date > a.date ? b : a)) : null;
  const totalVp = snap?.votingPowers?.reduce((s, v) => s + vpNum(v.votingPower), 0) || 0;
  const topVp = snap?.votingPowers?.[0] ? vpNum(snap.votingPowers[0].votingPower) : 0;
  const maxBar = snap?.votingPowers?.[0]?.votingPower ? Number(snap.votingPowers[0].votingPower) : 1;

  // Feature 2: turnout + vote tally for the most recent on-chain proposal.
  const acc = snap?.accountability ?? null;
  const accStats = useMemo(() => {
    if (!acc) return null;
    const tally: Record<string, number> = { '1': 0, '0': 0, '2': 0 };
    let votedVp = 0;
    for (const v of acc.votes) { tally[v.support] = (tally[v.support] || 0) + 1; votedVp += vpNum(v.votingPower); }
    const missedVp = acc.nonVoters.reduce((s, n) => s + vpNum(n.votingPower), 0);
    const turnoutPct = votedVp + missedVp > 0 ? (votedVp / (votedVp + missedVp)) * 100 : 0;
    return { tally, votedVp, missedVp, turnoutPct, votedCount: acc.votes.length, missedCount: acc.nonVoters.length };
  }, [acc]);

  const card = { backgroundColor: 'var(--ds-bg-card)', border: '1px solid var(--ds-border)' } as const;

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
                            <span className="w-4 text-right tabular-nums flex-shrink-0" style={{ color: 'var(--ds-fg-dim)', fontFamily: 'var(--ds-font-mono)' }}>{i + 1}</span>
                            <Link href={`/governance/${id}/${v.accountId}`} className="hover:underline truncate min-w-0" style={{ textDecorationColor: theme.accent }}>
                              {labelFor(labels, v.accountId)
                                ? <span className="font-medium">{labelFor(labels, v.accountId)}</span>
                                : <span style={{ fontFamily: 'var(--ds-font-mono)' }}>{short(v.accountId)}</span>}
                            </Link>
                            {labels[v.accountId.toLowerCase()]?.isContract && (
                              <span className="text-[9px] px-1 rounded uppercase tracking-wide flex-shrink-0" style={{ backgroundColor: 'var(--ds-bg-subtle)', color: 'var(--ds-fg-dim)' }}>contract</span>
                            )}
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

            {/* accountability — latest proposal turnout + no-shows */}
            {acc && accStats && (acc.votes.length > 0 || acc.nonVoters.length > 0) && (
              <section className="rise rounded-xl p-6 mt-6" style={{ ...card, animationDelay: '.22s' }}>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-[11px] uppercase tracking-wider" style={{ color: 'var(--ds-fg-dim)' }}>Latest proposal · delegate accountability</h2>
                  <span className="text-xs font-semibold tabular-nums" style={{ color: theme.accent, fontFamily: 'var(--ds-font-mono)' }}>{accStats.turnoutPct.toFixed(0)}% turnout</span>
                </div>
                <p className="text-sm font-medium mb-4">{acc.proposalTitle}</p>
                {/* turnout bar: voted VP vs idle VP */}
                <div className="h-2 rounded-full overflow-hidden mb-2" style={{ backgroundColor: 'var(--ds-bg-subtle)' }}>
                  <div className="h-full rounded-full" style={{ width: `${Math.max(1, accStats.turnoutPct)}%`, background: `linear-gradient(90deg, ${theme.accent}, ${theme.accent}88)` }} />
                </div>
                <div className="flex items-center justify-between text-xs mb-5" style={{ color: 'var(--ds-fg-dim)' }}>
                  <span>{accStats.votedCount} voted · {fmtTok(String(accStats.votedVp))} VP cast</span>
                  <span>{accStats.missedCount} no-shows · {fmtTok(String(accStats.missedVp))} VP idle</span>
                </div>
                <div className="grid sm:grid-cols-2 gap-x-8 gap-y-5">
                  <div>
                    <div className="text-[11px] uppercase tracking-wider mb-3" style={{ color: 'var(--ds-fg-dim)' }}>How they voted</div>
                    <div className="space-y-2.5">
                      {(['1', '0', '2'] as const).map((s) => (
                        <div key={s} className="flex items-center gap-2 text-sm">
                          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: SUPPORT[s].color }} />
                          <span>{SUPPORT[s].label}</span>
                          <span className="ml-auto font-semibold tabular-nums" style={{ fontFamily: 'var(--ds-font-mono)' }}>{accStats.tally[s] || 0}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] uppercase tracking-wider mb-3" style={{ color: 'var(--ds-fg-dim)' }}>Largest delegates who sat out</div>
                    {acc.nonVoters.length ? (
                      <ul className="space-y-2">
                        {acc.nonVoters.slice(0, 5).map((n) => (
                          <li key={n.voter} className="flex items-center justify-between gap-3 text-sm">
                            <Link href={`/governance/${id}/${n.voter}`} className="hover:underline truncate min-w-0" style={labelFor(labels, n.voter) ? { textDecorationColor: theme.accent } : { fontFamily: 'var(--ds-font-mono)', textDecorationColor: theme.accent }}>
                              {labelFor(labels, n.voter) || short(n.voter)}
                            </Link>
                            <span className="font-semibold tabular-nums flex-shrink-0" style={{ fontFamily: 'var(--ds-font-mono)' }}>{fmtTok(n.votingPower)}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs" style={{ color: 'var(--ds-fg-dim)' }}>Full turnout among tracked delegates.</p>
                    )}
                  </div>
                </div>
              </section>
            )}

            {/* Snapshot (off-chain) + governance-forum discussions */}
            {((snap.offchainProposals?.length ?? 0) > 0 || (snap.forumTopics?.length ?? 0) > 0) && (
              <div className="grid lg:grid-cols-2 gap-6 mt-6">
                <section className="rise rounded-xl p-6" style={{ ...card, animationDelay: '.28s' }}>
                  <h2 className="text-[11px] uppercase tracking-wider mb-4" style={{ color: 'var(--ds-fg-dim)' }}>Snapshot proposals · off-chain</h2>
                  {snap.offchainProposals?.length ? (
                    <ul className="space-y-3">
                      {snap.offchainProposals.slice(0, 6).map((p: OffchainProposal) => {
                        const sUrl = p.spaceId ? `https://snapshot.org/#/${p.spaceId}/proposal/${p.id}` : null;
                        return (
                          <li key={p.id} className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-sm font-medium truncate">{p.title}</div>
                              <div className="text-xs mt-0.5 flex items-center gap-2 flex-wrap" style={{ color: 'var(--ds-fg-dim)' }}>
                                <span style={{ fontFamily: 'var(--ds-font-mono)' }}>{short(p.author)}</span>
                                {p.discussion && <a href={p.discussion} target="_blank" rel="noopener noreferrer" className="hover:underline" style={{ color: theme.accent }}>discussion ↗</a>}
                              </div>
                            </div>
                            {sUrl && (
                              <a href={sUrl} target="_blank" rel="noopener noreferrer" className="flex-shrink-0" style={{ color: theme.accent }}>
                                <ArrowUpRight className="w-4 h-4" />
                              </a>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className="text-xs" style={{ color: 'var(--ds-fg-dim)' }}>No off-chain proposals.</p>
                  )}
                </section>

                <section className="rise rounded-xl p-6" style={{ ...card, animationDelay: '.32s' }}>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-[11px] uppercase tracking-wider" style={{ color: 'var(--ds-fg-dim)' }}>Recent forum discussions</h2>
                    <MessageSquare className="w-3.5 h-3.5" style={{ color: 'var(--ds-fg-dim)' }} />
                  </div>
                  {snap.forumTopics?.length ? (
                    <ul className="space-y-3">
                      {snap.forumTopics.slice(0, 6).map((t) => (
                        <li key={t.id}>
                          <a href={t.url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium hover:underline block truncate">{t.title}</a>
                          <div className="text-xs mt-0.5" style={{ color: 'var(--ds-fg-dim)' }}>{t.replyCount} replies · {t.views} views · {ago(new Date(t.lastPostedAt).getTime() / 1000)} ago</div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs" style={{ color: 'var(--ds-fg-dim)' }}>No governance forum mapped for this DAO yet.</p>
                  )}
                </section>
              </div>
            )}

            {/* proposals */}
            <section className="rise rounded-xl p-6 mt-6" style={{ backgroundColor: 'var(--ds-bg-card)', border: '1px solid var(--ds-border)', animationDelay: '.25s' }}>
              <h2 className="text-[11px] uppercase tracking-wider mb-4" style={{ color: 'var(--ds-fg-dim)' }}>Recent proposals</h2>
              <ul className="divide-y" style={{ borderColor: 'var(--ds-border-subtle)' }}>
                {snap.proposals.slice(0, 8).map((p: AnticaptureProposal) => {
                  const f = vpNum(p.forVotes ?? 0), ag = vpNum(p.againstVotes ?? 0), ab = vpNum(p.abstainVotes ?? 0);
                  const tot = f + ag + ab;
                  const status = String(p.status || '').toUpperCase();
                  const sc = STATUS_COLOR[status] || 'var(--ds-fg-dim)';
                  return (
                    <li key={p.id} className="py-3">
                      <div className="flex items-center justify-between gap-4">
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate">{p.title}</div>
                          <div className="text-xs mt-0.5 flex items-center gap-2 flex-wrap" style={{ color: 'var(--ds-fg-dim)' }}>
                            <span style={{ fontFamily: 'var(--ds-font-mono)' }}>#{p.id}</span>
                            {status && <span style={{ color: sc }}>{status.toLowerCase()}</span>}
                            <span style={{ fontFamily: 'var(--ds-font-mono)' }}>· {short(p.proposerAccountId)}</span>
                            {p.discussionUrl && (
                              <a href={p.discussionUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:underline" style={{ color: theme.accent }}>
                                <MessageSquare className="w-3 h-3" /> discussion
                              </a>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0">
                          {tot > 0 && <span className="text-xs tabular-nums" style={{ color: 'var(--ds-fg-dim)' }}>{Math.round((f / tot) * 100)}% for</span>}
                          {p.txHash && (
                            <a href={`https://etherscan.io/tx/${p.txHash}`} target="_blank" rel="noopener noreferrer" style={{ color: theme.accent }}>
                              <ArrowUpRight className="w-4 h-4" />
                            </a>
                          )}
                        </div>
                      </div>
                      {tot > 0 && (
                        <div className="h-1 rounded-full overflow-hidden flex mt-2" style={{ backgroundColor: 'var(--ds-bg-subtle)' }}>
                          <div style={{ width: `${(f / tot) * 100}%`, backgroundColor: SUPPORT['1'].color }} />
                          <div style={{ width: `${(ag / tot) * 100}%`, backgroundColor: SUPPORT['0'].color }} />
                          <div style={{ width: `${(ab / tot) * 100}%`, backgroundColor: SUPPORT['2'].color }} />
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
