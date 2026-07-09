/**
 * Realms (SPL Governance) client — on-chain Solana DAO proposals as an
 * external source, mirroring the Snapshot client's contract.
 *
 * Reads proposals via @solana/spl-governance over plain RPC:
 *   governances-by-realm (1 getProgramAccounts) → proposals-per-governance
 * (1 gPA each). Works on the free public RPC, which rate-limits
 * getProgramAccounts per ~10s window — hence the deliberate pacing:
 *   - all gPA calls are serialized through one module-level queue with a
 *     fixed inter-call delay,
 *   - governance pubkeys cache for 24h (they almost never change),
 *   - per-DAO results cache for ~45min with per-DAO jitter so the 8 DAOs
 *     never expire in the same refresh cycle,
 *   - a failed refresh serves the last good result rather than erroring.
 * Set SOLANA_RPC_URL (e.g. a free-tier Helius endpoint) to lift the limits.
 *
 * Trust note: proposal names and descriptions are attacker-influenced
 * on-chain strings; descriptionLink is free text on several forks (Jito
 * stores HTML paragraphs in it, not URLs) — always stripped, never linked.
 * Vote tallies are voter-weight units (VSR-scaled), NOT token counts, so
 * they surface only as For/Against percentages.
 */

import { Connection, PublicKey } from '@solana/web3.js';
import {
  getGovernanceAccounts,
  Governance,
  Proposal,
  ProposalState,
  pubkeyFilter,
} from '@solana/spl-governance';
import { DiscussionTopic, SourceType } from '@/types';
import { hashStringToNumber, stripHtml, truncateText } from './sourceClientUtils';

export interface RealmsDaoConfig {
  /** Matches ExternalSource.realmsDaoId, e.g. 'pyth'. */
  id: string;
  name: string;
  /** app.realms.today registry symbol — used in deep links. */
  symbol: string;
  programId: string;
  realmId: string;
  /** Custom governance UI base (defaults to app.realms.today/dao/{symbol}). */
  uiBase?: string;
}

/** Active Realms DAOs — IDs verified against app.realms.today's
 *  mainnet-beta registry on 2026-07-09. */
export const REALMS_DAOS: RealmsDaoConfig[] = [
  { id: 'pyth', name: 'Pyth Governance', symbol: 'PYTH', programId: 'pytGY6tWRgGinSCvRLnSv4fHfBTMoiDGiCsesmHWM6U', realmId: '4ct8XU5tKbMNRphWy4rePsS9kBqPhDdvZoGpmprPaug4' },
  { id: 'jito', name: 'Jito DAO', symbol: 'Jito', programId: 'jtogvBNH3WBSWDYD5FJfQP2ZxNTuf82zL8GkEhPeaJx', realmId: 'jjCAwuuNpJCNMLAanpwgJZ6cdXzLPXe2GfD6TaDQBXt', uiBase: 'https://gov.jito.network/dao/Jito' },
  { id: 'marinade', name: 'Marinade DAO', symbol: 'MNDE', programId: 'GovMaiHfpVPw8BAM1mbdzgmSZYDw2tdP32J2fapoQoYs', realmId: '899YG3yk4F66ZgbNWLHriZHTXSKk9e1kvsKEquW7L6Mo' },
  { id: 'bonk', name: 'BonkDAO', symbol: 'Bonk', programId: 'GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw', realmId: '84pGFuy1Y27ApK67ApethaPvexeDWA66zNV8gm38TVeQ' },
  { id: 'orca', name: 'Orca DAO', symbol: 'ORCA', programId: 'J9uWvULFL47gtCPvgR3oN7W357iehn5WF2Vn9MJvcSxz', realmId: '66Du7mXgS2KMQBUk6m9h3TszMjqZqdWhsG3Duuf69VNW' },
  { id: 'drift', name: 'Drift DAO', symbol: 'DRIFT', programId: 'dgov7NC8iaumWw3k8TkmLDybvZBCmd1qwxgLAGAsWxf', realmId: 'FVVXu18aNUqyFCfq8sGktPM62mqJAGaenv4z6UGUs5em' },
  { id: 'parcl', name: 'Parcl DAO', symbol: 'Parcl', programId: 'Di9ZVJeJrRZdQEWzAFYmfjukjR5dUQb7KMaDmv34rNJg', realmId: '9Waj7NNTzEhyHf1j1F36xgtnXaLoAxVBFhf6VxE9fgaf' },
  { id: 'metaplex', name: 'Metaplex DAO', symbol: 'Metaplex', programId: 'AEauWRrpn9Cs6GXujzdp1YhMmv2288kBt3SdEcPYEerr', realmId: 'DA5G7QQbFioZ6K33wQcH8fVdgFcnaDjLD7DLQkapZg5X' },
];

export function getRealmsDao(id: string): RealmsDaoConfig | undefined {
  return REALMS_DAOS.find((d) => d.id === id);
}

// ── RPC plumbing ─────────────────────────────────────────────────────

const RPC_DELAY_MS = 4_000;          // free public RPC limits gPA per ~10s window
const RPC_TIMEOUT_MS = 20_000;       // web3.js has NO default request timeout
const GOV_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const POSTS_CACHE_TTL_MS = 45 * 60 * 1000;
const PROPOSAL_WINDOW_MS = 180 * 24 * 60 * 60 * 1000; // ~6 months of voting activity
const MAX_PROPOSALS_PER_DAO = 15;

/** Kill switch: set REALMS_DISABLED=true to skip all Realms fetching. */
export function isRealmsEnabled(): boolean {
  return process.env.REALMS_DISABLED !== 'true';
}

// Serialize every outgoing RPC request through one queue with a fixed
// inter-request delay. This throttles at the TRANSPORT because
// spl-governance's getGovernanceAccounts fans out into one
// getProgramAccounts HTTP request per account type internally (8 for
// Governance, 2 for Proposal) — pacing around the library call would let
// those bursts through and 429 the free public RPC.
let rpcQueue: Promise<unknown> = Promise.resolve();

function enqueueRpc<T>(fn: () => Promise<T>): Promise<T> {
  const run = rpcQueue.then(fn);
  // Pace after BOTH success and failure — a rejected call must not let the
  // next one fire immediately into the same rate-limit window.
  rpcQueue = run.then(() => {}, () => {}).then(
    () => new Promise((r) => setTimeout(r, RPC_DELAY_MS)),
  );
  return run;
}

let connection: Connection | null = null;

function getConnection(): Connection {
  if (!connection) {
    connection = new Connection(
      process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
      {
        commitment: 'confirmed',
        // Route every RPC POST through the pacing queue and bound it with a
        // timeout so a hung RPC can never stall the whole refresh loop.
        fetch: ((input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) =>
          enqueueRpc(() => fetch(input, { ...init, signal: AbortSignal.timeout(RPC_TIMEOUT_MS) }))) as typeof fetch,
      },
    );
  }
  return connection;
}

const govCache = new Map<string, { at: number; govs: PublicKey[] }>();
const postsCache = new Map<string, { at: number; posts: DiscussionTopic[] }>();

async function getGovernancePubkeys(dao: RealmsDaoConfig): Promise<PublicKey[]> {
  const cached = govCache.get(dao.realmId);
  if (cached && Date.now() - cached.at < GOV_CACHE_TTL_MS) return cached.govs;

  const filter = pubkeyFilter(1, new PublicKey(dao.realmId));
  // Pacing happens at the Connection's fetch — no wrapper needed here.
  const govs = await getGovernanceAccounts(getConnection(), new PublicKey(dao.programId), Governance, filter ? [filter] : []);
  const pubkeys = govs.map((g) => g.pubkey);
  govCache.set(dao.realmId, { at: Date.now(), govs: pubkeys });
  return pubkeys;
}

// ── Proposal → DiscussionTopic ───────────────────────────────────────

function stateLabel(state: ProposalState): string {
  switch (state) {
    case ProposalState.Draft: return 'draft';
    case ProposalState.SigningOff: return 'signing-off';
    case ProposalState.Voting: return 'voting';
    case ProposalState.Succeeded: return 'succeeded';
    case ProposalState.Executing:
    case ProposalState.ExecutingWithErrors: return 'executing';
    case ProposalState.Completed: return 'completed';
    case ProposalState.Cancelled: return 'cancelled';
    case ProposalState.Defeated: return 'defeated';
    case ProposalState.Vetoed: return 'vetoed';
    default: return 'unknown';
  }
}

const TERMINAL_STATES = new Set<ProposalState>([
  ProposalState.Completed,
  ProposalState.Cancelled,
  ProposalState.Defeated,
  ProposalState.Vetoed,
]);

// Only proposals the DAO's own process has advanced get surfaced. Draft is
// a single-actor state (any token holder can create one — unvetted,
// attacker-influenceable text) and Cancelled is noise.
const SURFACED_STATES = new Set<ProposalState>([
  ProposalState.SigningOff,
  ProposalState.Voting,
  ProposalState.Succeeded,
  ProposalState.Executing,
  ProposalState.ExecutingWithErrors,
  ProposalState.Completed,
  ProposalState.Defeated,
  ProposalState.Vetoed,
]);

interface ParsedProposal {
  pubkey: string;
  name: string;
  state: ProposalState;
  draftAtMs: number;
  bumpedAtMs: number;
  description: string;
  votePct: string; // '' when no votes
}

function toBnMs(v: unknown): number | null {
  // spl-governance timestamps are BN seconds (or null for unreached stages).
  // Upper-bounded (year 2100): a garbage on-chain value like i64-max would
  // survive Number() as finite, then THROW in Date#toISOString and poison
  // the whole DAO's fetch. Out-of-range reads as missing instead.
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 && n < 4102444800 ? n * 1000 : null;
}

function parseProposal(pubkey: PublicKey, account: InstanceType<typeof Proposal>): ParsedProposal | null {
  const name = (account.name || '').trim();
  if (!name) return null;
  const draftAtMs = toBnMs(account.draftAt);
  if (!draftAtMs) return null;

  let votePct = '';
  try {
    const yes = BigInt(account.getYesVoteCount().toString());
    const no = BigInt(account.getNoVoteCount().toString());
    const total = yes + no;
    if (total > BigInt(0)) {
      const yesPct = Number((yes * BigInt(1000)) / total) / 10;
      votePct = `For ${yesPct.toFixed(1)}% · Against ${(100 - yesPct).toFixed(1)}%`;
    }
  } catch {
    // Vote layout drift on a fork — the proposal is still worth listing.
  }

  return {
    pubkey: pubkey.toBase58(),
    name,
    state: account.state,
    draftAtMs,
    bumpedAtMs: toBnMs(account.votingCompletedAt) ?? toBnMs(account.votingAt) ?? draftAtMs,
    // On several forks descriptionLink holds prose/HTML, not a URL — treat
    // as untrusted text, never as a link.
    description: truncateText(stripHtml(account.descriptionLink || ''), 180),
    votePct,
  };
}

function toTopic(dao: RealmsDaoConfig, p: ParsedProposal): DiscussionTopic {
  const label = stateLabel(p.state);
  const uiBase = dao.uiBase || `https://app.realms.today/dao/${encodeURIComponent(dao.symbol)}`;
  const excerptHead = p.votePct ? `[${label.toUpperCase()}] ${p.votePct}` : `[${label.toUpperCase()}]`;
  return {
    id: hashStringToNumber(p.pubkey),
    refId: `realms:${dao.id}:${p.pubkey}`,
    protocol: dao.name,
    title: p.name,
    slug: p.pubkey,
    tags: [label],
    postsCount: 1,
    views: 0,
    replyCount: 0,
    likeCount: 0,
    categoryId: 0,
    pinned: p.state === ProposalState.Voting,
    visible: true,
    closed: TERMINAL_STATES.has(p.state),
    archived: false,
    createdAt: new Date(p.draftAtMs).toISOString(),
    bumpedAt: new Date(p.bumpedAtMs).toISOString(),
    forumUrl: uiBase,
    excerpt: p.description ? `${excerptHead} — ${p.description}` : excerptHead,
    sourceType: 'realms' as SourceType,
    externalUrl: `${uiBase}/proposal/${p.pubkey}`,
  };
}

// ── Main entry ───────────────────────────────────────────────────────

const inflight = new Map<string, Promise<void>>();
const lastError = new Map<string, string>();

/** Does the actual paced RPC work and fills postsCache. Minutes-slow on a
 *  cold cache by design (every request rides the 4s pacing queue). */
async function refreshDao(dao: RealmsDaoConfig): Promise<void> {
  const governances = await getGovernancePubkeys(dao);
  const parsed: ParsedProposal[] = [];
  for (const gov of governances) {
    const filter = pubkeyFilter(1, gov);
    const proposals = await getGovernanceAccounts(getConnection(), new PublicKey(dao.programId), Proposal, filter ? [filter] : []);
    for (const p of proposals) {
      const row = parseProposal(p.pubkey, p.account);
      if (row) parsed.push(row);
    }
  }

  const cutoff = Date.now() - PROPOSAL_WINDOW_MS;
  // Recency by last voting activity (the same field the sort uses) so a
  // long-running proposal that concluded recently isn't dropped for having
  // an old draft date.
  const posts = parsed
    .filter((p) => SURFACED_STATES.has(p.state) && (p.state === ProposalState.Voting || p.bumpedAtMs >= cutoff))
    .sort((a, b) => b.bumpedAtMs - a.bumpedAtMs)
    .slice(0, MAX_PROPOSALS_PER_DAO)
    .map((p) => toTopic(dao, p));

  postsCache.set(dao.id, { at: Date.now(), posts });
  lastError.delete(dao.id);
}

/**
 * Fetch recent proposals for one Realms DAO — NEVER blocks the caller on
 * RPC. Fresh cache serves directly; an expired/missing cache kicks a
 * deduplicated background refresh (all RPC rides the pacing queue) and
 * serves whatever exists now. A cold start therefore returns empty for a
 * cycle or two while the queue fills — the refresh loop must not stall for
 * the ~10 minutes a full cold fill takes on the free public RPC. The last
 * refresh error is surfaced alongside stale/empty results so forum health
 * tracks a persistently failing source.
 */
export async function fetchRealmsProposals(
  daoId: string,
): Promise<{ posts: DiscussionTopic[]; error?: string }> {
  const dao = getRealmsDao(daoId);
  if (!dao) return { posts: [], error: `Unknown Realms DAO: ${daoId}` };

  const cached = postsCache.get(dao.id);
  const daoIndex = REALMS_DAOS.findIndex((d) => d.id === dao.id);
  // Stagger expiries by at least the ~15-min refresh cadence so the DAOs
  // land in different refresh ticks instead of all expiring together.
  const ttl = POSTS_CACHE_TTL_MS + daoIndex * 15 * 60 * 1000;
  if (cached && Date.now() - cached.at < ttl) {
    return { posts: cached.posts };
  }

  if (!inflight.has(dao.id)) {
    const run = refreshDao(dao)
      .catch((error) => {
        const message = error instanceof Error ? error.message : 'Realms RPC error';
        lastError.set(dao.id, message);
        console.error(`[Realms] ${dao.id} refresh failed:`, message);
      })
      .finally(() => inflight.delete(dao.id));
    inflight.set(dao.id, run);
  }

  // Stale-if-refreshing: last good result beats an empty forum card.
  return { posts: cached?.posts ?? [], error: lastError.get(dao.id) };
}
