import Link from 'next/link';
import { corpusSources } from '@/lib/corpusPolicy';
import { searchCorpus, corpusStatus, type CorpusSearchItem } from '@/lib/corpusStore';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'First-post corpus | discuss.watch' };
const PILOT_SOURCES=corpusSources();
export default async function CorpusPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const q = typeof params.q === 'string' ? params.q.slice(0, 200) : '';
  const source = typeof params.source === 'string' && PILOT_SOURCES.some(s => s.key === params.source) ? params.source : '';
  let items: CorpusSearchItem[] = [];
  let configured = false;
  let failure = false;
  let coverage: Array<{ source: string; status: string; cutoff: string; asOf: string; fetched: number; discovered: number }> = [];
  try {
    const [search, status] = await Promise.all([searchCorpus(q, source), corpusStatus()]);
    items = search.items; configured = search.configured;
    const seen = new Set<string>();
    coverage = status.jobs.filter(job => {
      const key = String(job.source_key);
      if (seen.has(key)) return false;
      seen.add(key); return true;
    }).map(job => ({ source: String(job.source_key), status: String(job.status),
      cutoff: new Date(job.cutoff).toISOString().slice(0, 10), asOf: new Date(job.as_of).toISOString().slice(0, 10),
      fetched: Number(job.fetched), discovered: Number(job.discovered) }));
  } catch { failure = true; }
  return <main className="min-h-screen px-5 py-8" style={{ background: 'var(--ds-bg-base)', color: 'var(--ds-fg)' }}>
    <div className="max-w-4xl mx-auto">
      <Link href="/app" className="text-sm underline" style={{ color: 'var(--ds-fg-muted)' }}>Back to discussions</Link>
      <h1 className="text-2xl font-semibold mt-6">First-post corpus</h1>
      <p className="mt-2 text-sm" style={{ color: 'var(--ds-fg-muted)' }}>Search stored first-post text and titles from completed or partial bounded source runs. Coverage is limited to the runs below; a result is not evidence of a currently open opportunity.</p>
      <form method="get" className="flex flex-wrap gap-3 my-6">
        <input name="q" defaultValue={q} maxLength={200} placeholder="Search a phrase inside a post" aria-label="Search corpus" className="border rounded-md p-3 flex-1 min-w-48" style={{ borderColor: 'var(--ds-border)', background: 'var(--ds-bg-card)' }} />
        <select name="source" defaultValue={source} aria-label="Forum" className="border rounded-md p-3" style={{ borderColor: 'var(--ds-border)', background: 'var(--ds-bg-card)' }}>
          <option value="">All registered forum sources</option>{PILOT_SOURCES.map(s => <option key={s.key} value={s.key}>{s.name}</option>)}
        </select>
        <button type="submit" className="border rounded-md px-5 py-3" style={{ borderColor: 'var(--ds-border)' }}>Search</button>
      </form>
      {coverage.length > 0 && <section className="mb-6 border rounded-lg p-4" style={{ borderColor: 'var(--ds-border)' }}>
        <h2 className="font-medium">Latest run per source</h2>
        {coverage.map(c => <p key={c.source} className="text-xs mt-2" style={{ color: 'var(--ds-fg-muted)' }}>{c.source}: {c.status}. {c.fetched}/{c.discovered} bodies. Created {c.cutoff} through {c.asOf}.</p>)}
      </section>}
      {failure ? <p role="alert">Corpus search is temporarily unavailable.</p> : !configured ? <p>The bounded corpus has not been initialized.</p> : items.length === 0 ? <p>No stored documents match this query. This does not mean the source forum has no matches.</p> : <section className="space-y-3">
        <p className="text-xs" style={{ color: 'var(--ds-fg-muted)' }}>Showing up to 25 results. Historical classifications are review-only and send no alerts.</p>
        {items.map(item => <article key={item.topicId} className="border rounded-lg p-5" style={{ borderColor: 'var(--ds-border)', background: 'var(--ds-bg-card)' }}>
          <a href={item.url} target="_blank" rel="noreferrer" className="font-semibold underline">{item.title}</a>
          <p className="text-xs my-2" style={{ color: 'var(--ds-fg-muted)' }}>{item.source} · Posted {item.createdAt.slice(0, 10)} · Body retrieved {item.fetchedAt.slice(0, 10)} · {item.bodyCharacters.toLocaleString()} characters{item.truncated ? ' (truncated)' : ''}</p>
          <p className="text-sm whitespace-pre-wrap">{item.excerpt}{item.bodyCharacters > item.excerpt.length ? '…' : ''}</p>
          {item.classifications.map((c, i) => <p key={`${c.lane}-${i}`} className="text-xs mt-3" style={{ color: 'var(--ds-fg-muted)' }}>{c.lane} preview: {String(c.result.kind)} · {String(c.result.availability)} · {c.model} · review required</p>)}
        </article>)}
      </section>}
    </div>
  </main>;
}
