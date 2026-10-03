/** Read-only source audit. No secrets, database writes, refreshes or model calls.
 * Run: node --import tsx scripts/audit-sources.mjs
 * Results: audit-results/batch4.json and batch4.md (no full post bodies).
 */
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

export const BATCH = [
  'Tezos Agora', 'Stacks', 'Algorand', 'Internet Computer', 'Decentraland',
  'The Graph', 'SafeDAO', 'Pocket Network', 'Radworks', 'Livepeer',
  'UMA Protocol', 'Index Coop', 'Across Protocol', 'Pyth Network', 'Morpho',
  'Euler Finance', 'Venus Protocol', 'Balancer', 'PancakeSwap', 'dYdX',
];
const APP = 'https://www.discuss.watch';
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const nextAllowed = new Map();
const DAY = 86400000;

export function checkedUrl(value, origin) {
  const u = new URL(value, origin);
  if (u.protocol !== 'https:' || u.origin !== new URL(origin).origin || u.username || u.password) {
    throw new Error('Only same-origin public HTTPS GETs are allowed');
  }
  return u;
}
export function feedPath(surface) {
  const slug = encodeURIComponent(surface.slug);
  if (surface.type === 'tag') return `/tag/${slug}${surface.tagId ? `/${surface.tagId}` : ''}.rss`;
  return `/c/${surface.parentSlug ? `${encodeURIComponent(surface.parentSlug)}/` : ''}${slug}/${surface.id}.rss`;
}
export function categoryRows(data) {
  const byId = new Map();
  function visit(items, parent) {
    for (const item of items ?? []) {
      if (!Number.isInteger(item.id)) continue;
      byId.set(item.id, {
        id: item.id, name: item.name, slug: item.slug,
        parentId: item.parent_category_id ?? parent ?? null,
        childIds: item.subcategory_ids ?? [], topicCount: item.topic_count ?? null,
      });
      visit(item.subcategory_list, item.id);
      visit(item.subcategories, item.id);
    }
  }
  visit(data?.category_list?.categories ?? data?.categories);
  for (const row of byId.values()) {
    for (const id of row.childIds) if (byId.has(id)) byId.get(id).parentId ??= row.id;
  }
  return [...byId.values()];
}
export function topicWindow(topics, now) {
  const regular = topics.filter(t => !t.pinned && t.visible !== false);
  const dates = regular.map(t => Date.parse(t.created_at)).filter(Number.isFinite);
  const bumped = regular.map(t => Date.parse(t.bumped_at)).filter(Number.isFinite);
  return {
    count: topics.length, regularCount: regular.length,
    distinctIds: new Set(topics.map(t => t.id)).size,
    oldestCreated: dates.length ? new Date(Math.min(...dates)).toISOString() : null,
    newestCreated: dates.length ? new Date(Math.max(...dates)).toISOString() : null,
    newestActivity: bumped.length ? new Date(Math.max(...bumped)).toISOString() : null,
    within180Days: dates.filter(d => d >= now - 180 * DAY && d <= now).length,
    bodyExcerpts: regular.filter(t => typeof t.excerpt === 'string' && t.excerpt.length > 0).length,
  };
}
export function parseFeed(text) {
  if (!/<rss\b/i.test(text) || !/<channel\b/i.test(text)) return { validRss: false, itemCount: null, sample: [] };
  const blocks = text.match(/<item\b[^>]*>[\s\S]*?<\/item>/gi) ?? [];
  const field = (block, tag) => (block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'))?.[1] ?? '')
    .replace(/^<!\[CDATA\[|\]\]>$/g, '').replace(/&amp;/g, '&').trim();
  return { validRss: true, itemCount: blocks.length, sample: blocks.slice(0, 3).map(b => ({ title: field(b, 'title'), url: field(b, 'link'), publishedAt: field(b, 'pubDate') })) };
}

async function get(origin, path) {
  const started = Date.now();
  const meta = { url: new URL(path, origin).href, checkedAt: new Date().toISOString() };
  try {
    let url = checkedUrl(path, origin);
    for (let hop = 0; hop <= 3; hop++) {
      const slot = Math.max(Date.now(), nextAllowed.get(url.origin) ?? 0);
      nextAllowed.set(url.origin, slot + 1100);
      await pause(Math.max(0, slot - Date.now()));
      const response = await fetch(url, {
        headers: { 'User-Agent': 'discuss.watch-source-audit/1.0', Accept: 'application/json, application/rss+xml, text/xml;q=0.9' },
        redirect: 'manual', signal: AbortSignal.timeout(15000),
      });
      Object.assign(meta, { status: response.status, contentType: response.headers.get('content-type'), finalUrl: url.href });
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get('location');
        meta.redirectTo = location;
        await response.body?.cancel();
        if (!location || hop === 3) throw new Error('Redirect limit or missing Location');
        url = checkedUrl(new URL(location, url).href, origin);
        continue;
      }
      if (!response.ok) {
        meta.retryAfter = response.headers.get('retry-after');
        await response.body?.cancel();
        return { meta: { ...meta, error: `HTTP ${response.status}`, durationMs: Date.now() - started } };
      }
      const reader = response.body?.getReader();
      let bytes = 0;
      const chunks = [];
      if (reader) {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          bytes += value.byteLength;
          if (bytes > 4_000_000) { await reader.cancel(); throw new Error('Response exceeds 4 MB audit cap'); }
          chunks.push(Buffer.from(value));
        }
      }
      const text = Buffer.concat(chunks).toString('utf8');
      Object.assign(meta, { bytes, sha256: createHash('sha256').update(text).digest('hex'), durationMs: Date.now() - started });
      let json;
      if (meta.contentType?.includes('json')) {
        try { json = JSON.parse(text); } catch { meta.error = 'Malformed JSON'; }
      }
      return { meta, json, text };
    }
  } catch (error) { meta.error = String(error.message ?? error); }
  return { meta: { ...meta, durationMs: Date.now() - started } };
}
async function auditForum(preset, getSignalSurfaces, now, classifications) {
  const origin = new URL(preset.url).origin;
  const latest = await get(origin, '/latest.json');
  const topics = latest.json?.topic_list?.topics;
  const record = { name: preset.name, origin, transport: { ...latest.meta, validTopicList: Array.isArray(topics) }, databaseVerified: false };
  record.window = topicWindow(Array.isArray(topics) ? topics : [], now);
  const categories = await get(origin, '/categories.json?include_subcategories=true');
  record.categoryProbe = categories.meta;
  record.categories = categoryRows(categories.json);
  record.unresolvedChildIds = [...new Set(record.categories.flatMap(c => c.childIds))].filter(id => !record.categories.some(c => c.id === id));
  if (record.unresolvedChildIds.length) {
    const site = await get(origin, '/site.json');
    record.siteProbe = site.meta;
    const extra = categoryRows(site.json);
    record.categories = [...new Map([...record.categories, ...extra].map(c => [c.id, c])).values()];
    record.unresolvedChildIds = [...new Set(record.categories.flatMap(c => c.childIds))].filter(id => !record.categories.some(c => c.id === id));
  }
  record.configuredSurfaces = getSignalSurfaces(preset);
  const configuredIds = new Set(record.configuredSurfaces.filter(s => s.type === 'category').map(s => s.id));
  record.candidateCategories = record.categories.filter(c => /grant|bount|rfp|funding|hiring|jobs|finding.people|vacanc|infinity/i.test(`${c.name} ${c.slug}`));
  const candidates = record.candidateCategories.filter(c => !configuredIds.has(c.id)).slice(0, 2).map(c => ({
    type: 'category', id: c.id, slug: c.slug, parentSlug: record.categories.find(p => p.id === c.parentId)?.slug,
    lane: 'unassigned', candidateOnly: true,
  }));
  record.surfaceProbes = [];
  for (const surface of [...record.configuredSurfaces, ...candidates].slice(0, 8)) {
    const feed = await get(origin, feedPath(surface));
    record.surfaceProbes.push({ surface, ...feed.meta, ...parseFeed(feed.text ?? '') });
  }
  // Two creation-ordered pages prove pagination behavior, not 180-day completeness.
  const first = await get(origin, '/latest.json?order=created&ascending=false&page=0');
  const second = await get(origin, '/latest.json?order=created&ascending=false&page=1');
  const a = first.json?.topic_list?.topics ?? [], b = second.json?.topic_list?.topics ?? [];
  record.pagination = {
    probes: [first.meta, second.meta], page0: topicWindow(a, now), page1: topicWindow(b, now),
    repeatedRegularIds: b.filter(t => !t.pinned && a.some(x => !x.pinned && x.id === t.id)).map(t => t.id),
    sampleOnly: true,
  };
  const sample = (Array.isArray(topics) ? topics : []).find(t => !t.pinned && t.visible !== false);
  if (sample) {
    const detail = await get(origin, `/t/${sample.id}.json`);
    const post = detail.json?.post_stream?.posts?.find(p => p.post_number === 1);
    record.sample = { id: sample.id, title: sample.title, createdAt: sample.created_at, bumpedAt: sample.bumped_at,
      detailProbe: detail.meta, firstPostPresent: !!post,
      firstPostTextChars: typeof post?.cooked === 'string' ? post.cooked.replace(/<[^>]*>/g, '').length : 0 };
  }
  const query = new URLSearchParams({ forum: origin, dateRange: 'all', limit: '100' });
  const app = await get(APP, `/api/discussions?${query}`);
  const appTopics = app.json?.topics ?? [];
  record.app = { ...app.meta, total: app.json?.meta?.total ?? null,
    sourceIdsInFeed: (topics ?? []).filter(t => appTopics.some(x => x.id === t.id && x.forumUrl?.replace(/\/$/, '') === origin)).map(t => t.id),
    sampleFound: !!sample && appTopics.some(t => t.id === sample.id && t.forumUrl?.replace(/\/$/, '') === origin) };
  record.classificationSample = classifications.filter(item => item.forumUrl?.replace(/\/$/, '') === origin).slice(0, 3)
    .map(i => ({ id: i.id, refId: i.refId, title: i.title, classification: i.classification, signal: i.signal, firstSeenAt: i.firstSeenAt }));
  record.classificationSampleScope = 'Only the 100 most recent wire records and 100 ROLE records; no match does not prove absence';
  console.log(`AUDIT_SOURCE ${JSON.stringify(record)}`);
  return record;
}
export async function main() {
  const { FORUM_CATEGORIES, getSignalSurfaces } = await import('../src/lib/forumPresets.ts');
  const presets = FORUM_CATEGORIES.flatMap(c => c.forums);
  const now = Date.now();
  const classified = await get(APP, '/api/v1/grants?classification=all&limit=100');
  const roles = await get(APP, '/api/v1/grants?classification=ROLE&limit=100');
  const classifications = [...(classified.json?.items ?? []), ...(roles.json?.items ?? [])];
  const report = { checkedAt: new Date(now).toISOString(), commit: process.env.GITHUB_SHA ?? null,
    cutoff180Days: new Date(now - 180 * DAY).toISOString(), mode: 'read-only-bounded-sample',
    classificationProbes: [classified.meta, roles.meta], sources: [], priorReleaseTagProbes: [] };
  for (const name of BATCH) {
    const preset = presets.find(p => p.name === name);
    if (!preset) throw new Error(`Missing registry source: ${name}`);
    report.sources.push(await auditForum(preset, getSignalSurfaces, now, classifications));
  }
  for (const name of ['CoW Protocol', 'Near Protocol']) {
    const preset = presets.find(p => p.name === name);
    for (const surface of getSignalSurfaces(preset).filter(s => s.type === 'tag')) {
      const feed = await get(new URL(preset.url).origin, feedPath(surface));
      report.priorReleaseTagProbes.push({ name, surface, ...feed.meta, ...parseFeed(feed.text ?? '') });
    }
  }
  const cell = value => String(value ?? '').replace(/[\r\n|]/g, ' ');
  const rows = report.sources.map(s => `| ${cell(s.name)} | ${s.transport.status ?? 'error'} / ${s.transport.validTopicList} | ${s.window.count} | ${s.categories.length} | ${s.app.sourceIdsInFeed.length} | ${s.sample?.firstPostPresent ?? false} |`);
  const markdown = ['# Source Audit: Batch 4', `Checked: ${report.checkedAt}`, '',
    'Read-only sample. HTTP success does not establish database persistence, complete history, or correct classification.', '',
    '| Source | HTTP / valid topic JSON | Latest topics | Categories discovered | Source IDs in app feed | Sample first post |',
    '|---|---|---|---|---|---|', ...rows, '', 'Raw evidence: batch4.json. No full post bodies or secrets retained.'].join('\n');
  await mkdir('audit-results', { recursive: true });
  await writeFile('audit-results/batch4.json', JSON.stringify(report, null, 2));
  await writeFile('audit-results/batch4.md', markdown);
  console.log(markdown);
  console.log(`AUDIT_PRIOR_TAGS ${JSON.stringify(report.priorReleaseTagProbes)}`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => { console.error(error); process.exitCode = 1; });
}
