// Shared brand identity + formatters for the governance-terminal pages
// (/governance/[dao] and /governance/[dao]/[address]). Leading-underscore name
// keeps it out of Next's route table.

/** Per-DAO identity + brand accent — each ecosystem dashboard wears its own colour. */
export const DAO: Record<string, { name: string; token: string; accent: string; glow: string }> = {
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

/** Display order of the DAO switcher pills. */
export const ORDER = ['uni', 'aave', 'ens', 'comp', 'gtc', 'scr', 'nouns', 'fluid', 'lil_nouns', 'obol', 'shu'];

/** Brand for a DAO id, with a neutral fallback for unknown ids. */
export function daoTheme(id: string) {
  return DAO[id] || { name: id.toUpperCase(), token: id.toUpperCase(), accent: '#a1a1aa', glow: 'rgba(161,161,170,0.14)' };
}

/** Block-explorer base per DAO — most are Ethereum mainnet; Scroll lives on Scroll. */
const EXPLORER: Record<string, string> = {
  scr: 'https://scrollscan.com',
};
function explorerBase(daoId: string): string {
  return EXPLORER[daoId] || 'https://etherscan.io';
}
export const explorerTx = (daoId: string, hash: string) => `${explorerBase(daoId)}/tx/${hash}`;
export const explorerAddress = (daoId: string, addr: string) => `${explorerBase(daoId)}/address/${addr}`;

export const fmtUsd = (n: number) =>
  !isFinite(n) ? '—' : n >= 1e9 ? `$${(n / 1e9).toFixed(2)}B` : n >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `$${(n / 1e3).toFixed(0)}K` : `$${n.toFixed(0)}`;

/** Format a token amount; values in 1e18 base units are scaled to whole tokens. */
export function fmtTok(raw: string | number) {
  let n = Number(raw);
  if (!isFinite(n)) return String(raw);
  if (n > 1e15) n = n / 1e18;
  return n >= 1e9 ? `${(n / 1e9).toFixed(2)}B` : n >= 1e6 ? `${(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}K` : n.toLocaleString(undefined, { maximumFractionDigits: 1 });
}

/** Normalize voting power (1e18 base units → whole tokens) to a number. */
export const vpNum = (raw: string | number) => {
  const n = Number(raw);
  return !isFinite(n) ? 0 : n > 1e15 ? n / 1e18 : n;
};

export const short = (a: string) => (a && a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a);

/** Compact relative age from a unix-seconds timestamp. */
export function ago(s: number) {
  const d = Math.max(0, Date.now() / 1000 - s);
  return d < 3600 ? `${Math.floor(d / 60)}m` : d < 86400 ? `${Math.floor(d / 3600)}h` : `${Math.floor(d / 86400)}d`;
}

/** `ago` for a unix timestamp that may arrive as a string. */
export const agoTs = (ts: string | number | undefined) => (ts == null ? '' : ago(Number(ts)));

/** Governor vote support codes → display label + colour. */
export const SUPPORT: Record<string, { label: string; color: string }> = {
  '1': { label: 'For', color: '#22c55e' },
  '0': { label: 'Against', color: '#ef4444' },
  '2': { label: 'Abstain', color: '#a1a1aa' },
};

/** Proposal lifecycle status → colour. */
export const STATUS_COLOR: Record<string, string> = {
  EXECUTED: '#22c55e',
  ACTIVE: '#3b82f6',
  QUEUED: '#f59e0b',
  PENDING: '#f59e0b',
  DEFEATED: '#ef4444',
  CANCELED: '#71717a',
  EXPIRED: '#71717a',
};
