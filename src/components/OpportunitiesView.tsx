'use client';
import { useEffect, useState } from 'react';
import { BriefcaseBusiness, ExternalLink } from 'lucide-react';
import { roleKindLabel } from '@/lib/roleKinds';
import type { OpportunityFit } from '@/lib/opportunityFit';
import type { SourceFreshness } from '@/lib/opportunityEligibility';

type Opportunity = {
  id:number; title:string; organization:string|null; vertical:string|null; engagement:string;
  confidence:number; compensationMin:number|null; compensationMax:number|null; currency:string|null;
  deadline:string|null; topicCreatedAt:string|null; status:string; url:string; applyUrl:string|null;
  fit?:OpportunityFit; freshness?:SourceFreshness;
};
const KINDS = ['', 'full_time','part_time','contract','fractional','consulting','internship','fellowship','residency','bounty','council_seat','steward','working_group','election','service_provider','other'];
const safeLink = (value:string|null) => {
  if (!value) return undefined;
  try { const u = new URL(value); return ['https:','http:'].includes(u.protocol) ? value : undefined; } catch { return undefined; }
};
export function OpportunitiesView() {
  const [kind,setKind] = useState('');
  const [sort,setSort] = useState<'recent'|'fit'>('recent');
  const [items,setItems] = useState<Opportunity[]>([]);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState<string|null>(null);
  const [cursor,setCursor] = useState<number|null>(null);
  const [nextCursor,setNextCursor] = useState<number|null>(null);
  const [retry,setRetry] = useState(0);
  const [capped,setCapped] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    const qs = new URLSearchParams({sort,limit:'50'});
    if (kind) qs.set('kind',kind);
    if (cursor !== null && sort === 'recent') qs.set('cursor',String(cursor));
    fetch('/api/v1/opportunities?' + qs, {signal:controller.signal}).then(async response => {
      if (!response.ok) throw new Error('Request failed (' + response.status + ')');
      const data = await response.json();
      if (!Array.isArray(data.items)) throw new Error('Unexpected response');
      if (controller.signal.aborted) return;
      setItems(previous => cursor === null ? data.items : [...previous,...data.items.filter((item:Opportunity) => !previous.some(p => p.id === item.id))]);
      setNextCursor(data.meta?.nextCursor ?? null);
      setCapped(Boolean(data.meta?.candidateWindowCapped || data.meta?.shortlistTruncated));
      setError(null); setLoading(false);
    }).catch(reason => {
      if (!controller.signal.aborted) {setError(reason instanceof Error ? reason.message : 'Request failed');setLoading(false);}
    });
    return () => controller.abort();
  },[sort,kind,cursor,retry]);
  const change = (nextKind:string,nextSort:'recent'|'fit') => {
    setItems([]);setCursor(null);setNextCursor(null);setError(null);setLoading(true);setKind(nextKind);setSort(nextSort);
  };
  const money = (item:Opportunity) => {
    if (item.compensationMin === null && item.compensationMax === null) return null;
    const minimum = item.compensationMin?.toLocaleString();
    const maximum = item.compensationMax?.toLocaleString();
    const range = maximum === undefined ? minimum + '+' : minimum !== undefined && minimum !== maximum ? minimum + '–' + maximum : maximum;
    return (range + ' ' + (item.currency || '')).trim();
  };
  return <section className="flex-1 min-w-0 overflow-y-auto"><div className="max-w-4xl mx-auto px-5 sm:px-6 py-6">
    <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2"><BriefcaseBusiness className="w-5 h-5"/>Opportunities</h1>
    <p className="mt-1 mb-4 text-sm" style={{color:'var(--ds-fg-muted)'}}>Paid-work signals across the source network. Availability requires a source check before applying.</p>
    <label className="text-sm flex flex-wrap gap-2 items-center mb-3">Sort
      <select aria-label="Opportunity sort" value={sort} onChange={event => change(kind,event.target.value as 'recent'|'fit')} className="rounded-md border px-3 py-2" style={{background:'var(--ds-bg-elev)',borderColor:'var(--ds-border)',color:'var(--ds-fg)'}}>
        <option value="recent">Recent discoveries</option><option value="fit">Operations &amp; AI fit</option>
      </select>
    </label>
    {sort === 'fit' && <p className="text-xs mb-4" style={{color:'var(--ds-fg-muted)'}}>Ranks operations, practical AI, consulting, leadership, funding and partnerships. Fit is separate from classification confidence. Deadlines within seven days retain priority. Ranked over at most 500 recent candidate records.</p>}
    <div className="flex gap-2 overflow-x-auto pb-3 mb-2">{KINDS.map(k => <button key={k || 'all'} aria-pressed={kind === k} onClick={() => {if(k !== kind) change(k,sort);}} className="px-3 py-1.5 rounded-md text-xs whitespace-nowrap" style={{background:kind === k ? 'var(--ds-bg-subtle)' : 'var(--ds-bg-elev)',color:'var(--ds-fg)'}}>{k ? roleKindLabel(k) : 'All work types'}</button>)}</div>
    {error && <div role="alert" className="rounded-lg border p-4 mb-4" style={{borderColor:'var(--ds-border)'}}>The opportunity feed could not be loaded. {error}. <button className="underline" onClick={() => {setLoading(true);setRetry(n => n+1);}}>Retry</button></div>}
    {!loading && !error && items.length === 0 && <p className="border border-dashed rounded-lg p-8 text-center" style={{borderColor:'var(--ds-border)',color:'var(--ds-fg-muted)'}}>No matching opportunities in this result window.</p>}
    <div className="space-y-3">{items.map(item => <article key={item.id} className="rounded-lg border p-4" style={{borderColor:'var(--ds-border)',background:'var(--ds-bg-elev)'}}>
      <a href={safeLink(item.url)} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold flex gap-2 justify-between" style={{color:'var(--ds-fg)'}}><span className="min-w-0 break-words">{item.title}</span><ExternalLink className="w-4 h-4 shrink-0"/></a>
      <p className="text-xs mt-2" style={{color:'var(--ds-fg-muted)'}}>{[item.organization,roleKindLabel(item.engagement),money(item),item.topicCreatedAt ? 'Posted ' + item.topicCreatedAt.slice(0,10) : 'Posting date unknown',item.deadline ? 'Deadline ' + item.deadline.slice(0,10) : null,'Reported status: '+item.status+' (unverified)'].filter(Boolean).join(' · ')}</p>
      {item.freshness?.state === 'older_source' && <p className="text-xs mt-2" style={{color:'var(--ds-fg-muted)'}}>Older source ({item.freshness.ageDays} days). Confirm that applications are still accepted.</p>}
      {sort === 'fit' && item.fit && <div className="text-xs mt-3" style={{color:'var(--ds-fg-muted)'}}><strong>{item.fit.score}/100 fit</strong> · {item.confidence}% classification confidence<p className="mt-1">{item.fit.reasons.join('; ') || 'No direct match to this attention profile.'}</p>{item.fit.cautions.length > 0 && <p className="mt-1">{item.fit.cautions.join('; ')}.</p>}</div>}
      {safeLink(item.applyUrl) && <a className="text-xs underline inline-block mt-2" href={safeLink(item.applyUrl)} target="_blank" rel="noopener noreferrer">Application link</a>}
    </article>)}</div>
    {loading && <p role="status" className="text-sm my-4">Loading opportunities…</p>}
    {!loading && !error && nextCursor !== null && sort === 'recent' && <button className="border rounded px-4 py-2 mt-4" onClick={() => {setLoading(true);setCursor(nextCursor);}}>Load more</button>}
    {!loading && capped && <p className="text-xs mt-4" style={{color:'var(--ds-fg-muted)'}}>This result window is bounded. Use Recent discoveries to browse additional records.</p>}
  </div></section>;
}
