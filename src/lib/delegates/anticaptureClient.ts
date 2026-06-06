/**
 * Anticapture governance-analytics client (POC).
 *
 * Anticapture (by Blockful) exposes DAO governance, treasury, delegation, and
 * voting analytics. They gave us a dev MCP gateway + token; a fixed REST API
 * base + production key arrive after Friday's walkthrough.
 *
 * POC TRANSPORT: this talks to the Anticapture **MCP gateway** over HTTP
 * (JSON-RPC: initialize -> notifications/initialized -> tools/call), because
 * that's the only interface reachable with the dev token today. The public
 * methods below are transport-stable — when the REST base lands, only the
 * private `callTool`/`session` internals get swapped (REST `GET /{dao}/...`),
 * not the callers.
 *
 * Gated on ANTICAPTURE_API_KEY, like the GitHub client's GITHUB_TOKEN: if the
 * key is absent the client reports unconfigured and callers skip it.
 */

const MCP_URL = process.env.ANTICAPTURE_MCP_URL || 'https://mcp.anticapture.com/mcp';

function apiKey(): string {
  return process.env.ANTICAPTURE_API_KEY || '';
}

export function isAnticaptureConfigured(): boolean {
  return apiKey().length > 0;
}

/** Governance params + feature flags for a configured DAO (from the `daos` tool). */
export interface AnticaptureDao {
  id: string;
  chainId: number;
  quorum: string;
  proposalThreshold: string;
  supportsOffchainData: boolean;
  [key: string]: unknown;
}

/** A delegate / account ranked by voting power (from `votingPowers`). */
export interface VotingPowerEntry {
  accountId: string;
  votingPower: string;
  votesCount: number;
  proposalsCount: number;
  delegationsCount: number;
  variation?: { absoluteChange: string; percentageChange: string };
  label?: string; // Arkham/ENS label, enriched via getAddress
  isContract?: boolean;
}

/** An off-chain (Snapshot) proposal (from `offchainProposals`). */
export interface OffchainProposal {
  id: string;
  title: string;
  author: string;
  spaceId?: string;
  discussion?: string; // link to the governance-forum thread
  [key: string]: unknown;
}

/** A single on-chain vote (from `votesByProposalId`). support: "1"=for "0"=against "2"=abstain. */
export interface ProposalVote {
  voterAddress: string;
  support: string;
  votingPower: string;
  reason?: string;
}

/** An active delegate who did NOT vote on a proposal (from `proposalNonVoters`). */
export interface ProposalNonVoter {
  voter: string;
  votingPower: string;
  lastVoteTimestamp?: number;
}

/** Delegate-accountability for one proposal: who voted, who missed. */
export interface ProposalAccountability {
  proposalId: string;
  proposalTitle: string;
  votes: ProposalVote[];
  nonVoters: ProposalNonVoter[];
}

/** An address label (from getAddress). */
export interface AddressLabel {
  label?: string;
  isContract?: boolean;
}

/** An on-chain governance event (from `feedEvents`). */
export interface FeedEvent {
  txHash: string;
  logIndex: number;
  type: string;
  value: string;
  timestamp: number;
  relevance: 'HIGH' | 'MEDIUM' | 'LOW' | string;
  metadata?: Record<string, unknown>;
}

/** A point in a DAO's total-treasury time series (USD). */
export interface TreasuryPoint {
  date: number;
  value: number;
}

/** An on-chain governance proposal (from `proposals`). */
export interface AnticaptureProposal {
  id: string;
  daoId: string;
  title: string;
  proposerAccountId: string;
  txHash?: string;
  startBlock?: number;
  endBlock?: number;
  [key: string]: unknown;
}

/** Combined per-DAO governance snapshot — one MCP session powers all panels. */
export interface GovernanceSnapshot {
  dao: string;
  votingPowers: VotingPowerEntry[];
  feedEvents: FeedEvent[];
  treasury: TreasuryPoint[];
  proposals: AnticaptureProposal[];
  offchainProposals: OffchainProposal[];
  accountability: ProposalAccountability | null;
}

export type TreasuryWindow = '7d' | '30d' | '90d' | '180d' | '365d';

interface RpcResult {
  sessionId: string | null;
  data: { result?: { content?: { type: string; text: string }[]; isError?: boolean }; error?: unknown } | null;
}

/** POST a JSON-RPC message to the MCP gateway; parse the (SSE-framed) reply. */
async function post(sessionId: string | null, payload: unknown): Promise<RpcResult> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey()}`,
    'Content-Type': 'application/json',
    Accept: 'application/json, text/event-stream',
    'User-Agent': 'discuss.watch/1.0',
  };
  if (sessionId) headers['Mcp-Session-Id'] = sessionId;

  const res = await fetch(MCP_URL, { method: 'POST', headers, body: JSON.stringify(payload) });
  const sid = res.headers.get('mcp-session-id') || sessionId;
  const text = await res.text();

  // Streamable-HTTP replies are SSE frames: lines of `data: {json}`.
  let data: RpcResult['data'] = null;
  for (const line of text.split('\n')) {
    const t = line.trim();
    const json = t.startsWith('data:') ? t.slice(5).trim() : t.startsWith('{') ? t : '';
    if (!json) continue;
    try {
      data = JSON.parse(json);
    } catch {
      /* skip non-JSON frames */
    }
  }
  if (!res.ok && !data) {
    throw new Error(`Anticapture MCP HTTP ${res.status}`);
  }
  return { sessionId: sid, data };
}

/** Open an MCP session (initialize + initialized handshake). */
async function openSession(): Promise<string> {
  const init = await post(null, {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2025-06-18',
      capabilities: {},
      clientInfo: { name: 'discuss.watch', version: '1.0' },
    },
  });
  if (!init.sessionId) throw new Error('Anticapture: no MCP session id returned');
  await post(init.sessionId, { jsonrpc: '2.0', method: 'notifications/initialized', params: {} });
  return init.sessionId;
}

/** Invoke a tool and return its parsed JSON payload. */
async function callTool<T = unknown>(sessionId: string, name: string, args: Record<string, unknown>): Promise<T> {
  const r = await post(sessionId, {
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/call',
    params: { name, arguments: args },
  });
  if (!r.data || r.data.error) {
    throw new Error(`Anticapture ${name}: ${JSON.stringify(r.data?.error ?? 'no response')}`);
  }
  const content = r.data.result?.content;
  const textPart = content?.[0]?.text ?? '';
  if (r.data.result?.isError) {
    throw new Error(`Anticapture ${name}: ${textPart.slice(0, 200)}`);
  }
  return (textPart ? (JSON.parse(textPart) as T) : (r.data.result as T));
}

/** List every DAO Anticapture supports (note: DAO ids are lowercase in tool args). */
export async function getDaos(): Promise<AnticaptureDao[]> {
  const sid = await openSession();
  // `daos` returns the same { items, totalCount } envelope as the other tools.
  const raw = await callTool<ItemsEnvelope<AnticaptureDao> | AnticaptureDao[]>(sid, 'daos', {});
  if (Array.isArray(raw)) return raw;
  return raw?.items ?? [];
}

interface ItemsEnvelope<T> {
  items: T[];
  totalCount?: number;
}

/** Run a tool call, logging (not swallowing-silently) failures and returning a fallback. */
async function safeCall<T>(label: string, fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    console.error(`[anticapture] ${label} failed:`, e instanceof Error ? e.message : e);
    return fallback;
  }
}

/**
 * One round-trip snapshot of a DAO's governance state — the shape the
 * per-tenant dashboard panels (Shape A) and the governance-event feed (Shape C)
 * consume. `dao` must be the lowercase id (e.g. "uni", "aave", "ens").
 */
export async function getGovernanceSnapshot(
  dao: string,
  opts: { topDelegates?: number; treasuryWindow?: TreasuryWindow } = {},
): Promise<GovernanceSnapshot> {
  const sid = await openSession();
  const id = dao.toLowerCase();
  // Sequential: a streamable-HTTP MCP session handles one request at a time.
  const vp = await safeCall(`votingPowers(${id})`, () => callTool<ItemsEnvelope<VotingPowerEntry>>(sid, 'votingPowers', { dao: id, params: {} }), { items: [] });
  const fe = await safeCall(`feedEvents(${id})`, () => callTool<ItemsEnvelope<FeedEvent>>(sid, 'feedEvents', { dao: id, params: {} }), { items: [] });
  const tre = await safeCall(`getTotalTreasury(${id})`, () => callTool<ItemsEnvelope<TreasuryPoint>>(sid, 'getTotalTreasury', { dao: id, params: { days: opts.treasuryWindow ?? '90d' } }), { items: [] });
  const prop = await safeCall<ItemsEnvelope<AnticaptureProposal> | AnticaptureProposal[]>(`proposals(${id})`, () => callTool(sid, 'proposals', { dao: id, params: {} }), { items: [] });
  const off = await safeCall(`offchainProposals(${id})`, () => callTool<ItemsEnvelope<OffchainProposal>>(sid, 'offchainProposals', { dao: id, params: { limit: 6, lean: true } }), { items: [] });
  const proposals = Array.isArray(prop) ? prop : prop.items || [];

  // Delegate accountability for the most recent on-chain proposal.
  let accountability: ProposalAccountability | null = null;
  const latest = proposals[0];
  if (latest?.id) {
    const pid = String(latest.id);
    const votes = await safeCall(`votesByProposalId(${id},${pid})`, () => callTool<ItemsEnvelope<ProposalVote>>(sid, 'votesByProposalId', { dao: id, id: pid, params: { limit: 200 } }), { items: [] });
    const nonV = await safeCall(`proposalNonVoters(${id},${pid})`, () => callTool<ItemsEnvelope<ProposalNonVoter>>(sid, 'proposalNonVoters', { dao: id, id: pid, params: { limit: 12, orderDirection: 'desc' } }), { items: [] });
    accountability = { proposalId: pid, proposalTitle: latest.title, votes: votes.items, nonVoters: nonV.items };
  }

  return {
    dao: id,
    votingPowers: vp.items.slice(0, opts.topDelegates ?? 25),
    feedEvents: fe.items,
    treasury: tre.items,
    proposals,
    offchainProposals: off.items,
    accountability,
  };
}

/** getAddress response shape (single-address Arkham/ENS lookup). */
interface AddressInfo {
  isContract?: boolean;
  arkham?: { label?: string | null } | null;
  ens?: string | null;
}

/**
 * Resolve human labels (Arkham entity or ENS) for a set of addresses — one
 * `getAddress` call each, fanned out within a single session because the batch
 * `getAddresses` tool currently 400s on the dev gateway (a Friday/Blockful
 * question). Capped to keep first-paint latency bounded; the route caches it.
 */
export async function getDelegateLabels(addresses: string[]): Promise<Record<string, AddressLabel>> {
  const out: Record<string, AddressLabel> = {};
  if (!isAnticaptureConfigured() || addresses.length === 0) return out;
  const sid = await openSession();
  for (const addr of addresses.slice(0, 12)) {
    const a = addr.toLowerCase();
    const info = await safeCall<AddressInfo | null>(`getAddress(${a})`, () => callTool(sid, 'getAddress', { address: a }), null);
    if (info) out[a] = { label: info.arkham?.label || info.ens || undefined, isContract: info.isContract };
  }
  return out;
}
