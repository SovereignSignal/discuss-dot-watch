'use client';

import { useEffect, useState } from 'react';
import { BriefcaseBusiness, ExternalLink } from 'lucide-react';
import { roleKindLabel } from '@/lib/roleKinds';

type Opportunity = {
  id: number; title: string; organization: string | null; vertical: string | null;
  engagement: string; compensationMin: number | null; compensationMax: number | null;
  currency: string | null; deadline: string | null; url: string; applyUrl: string | null;
};
const KINDS = ['', 'full_time', 'part_time', 'contract', 'fractional', 'consulting', 'internship', 'fellowship', 'residency', 'bounty', 'council_seat', 'steward', 'election', 'service_provider'];

export function OpportunitiesView() {
  const [kind, setKind] = useState('');
  const [items, setItems] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false; setLoading(true);
    const qs = kind ? `?kind=${encodeURIComponent(kind)}` : '';
    fetch(`/api/v1/opportunities${qs}`).then(r => r.json()).then(data => {
      if (!cancelled) { setItems(data.items || []); setLoading(false); }
    }).catch(() => { if (!cancelled) { setItems([]); setLoading(false); } });
    return () => { cancelled = true; };
  }, [kind]);
  const money = (i: Opportunity) => {
    if (i.compensationMax == null) return null;
    const lo = i.compensationMin != null && i.compensationMin !== i.compensationMax ? `${i.compensationMin.toLocaleString()}–` : '';
    return `${lo}${i.compensationMax.toLocaleString()} ${i.currency || ''}`.trim();
  };
  return <section className="flex-1 overflow-y-auto"><div className="max-w-4xl mx-auto px-5 sm:px-6 py-6">
    <div className="mb-5"><h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2"><BriefcaseBusiness className="w-5 h-5"/>Opportunities</h1>
      <p className="mt-1 text-sm" style={{color:'var(--ds-fg-muted)'}}>Paid work discovered across the discuss.watch source network. Separate from funding opportunities.</p></div>
    <div className="flex gap-2 overflow-x-auto pb-3 mb-2">{KINDS.map(k => <button key={k || 'all'} onClick={()=>setKind(k)} className="px-3 py-1.5 rounded-md text-xs whitespace-nowrap" style={{background:kind===k?'var(--ds-bg-subtle)':'var(--ds-bg-elev)',color:'var(--ds-fg)'}}>{k ? roleKindLabel(k) : 'All'}</button>)}</div>
    {loading ? <p className="text-sm" style={{color:'var(--ds-fg-muted)'}}>Loading opportunities…</p> : items.length===0 ? <div className="border border-dashed rounded-lg p-8 text-center" style={{borderColor:'var(--ds-border)',color:'var(--ds-fg-muted)'}}>No current opportunities in this lane yet.</div> : <div className="space-y-2">{items.map(i => <a key={i.id} href={i.applyUrl || i.url} target="_blank" rel="noreferrer" className="block rounded-lg border p-4" style={{borderColor:'var(--ds-border)',background:'var(--ds-bg-elev)'}}>
      <div className="flex gap-3 justify-between"><div><div className="text-sm font-semibold" style={{color:'var(--ds-fg)'}}>{i.title}</div><div className="text-xs mt-1" style={{color:'var(--ds-fg-muted)'}}>{[i.organization, roleKindLabel(i.engagement), money(i), i.deadline ? `deadline ${String(i.deadline).slice(0,10)}` : null].filter(Boolean).join(' · ')}</div></div><ExternalLink className="w-4 h-4 shrink-0" style={{color:'var(--ds-fg-dim)'}}/></div>
    </a>)}</div>}
  </div></section>;
}
