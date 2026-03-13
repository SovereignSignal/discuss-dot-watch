import type { TenantBranding } from '@/types/delegates';
import { DELEGATE_ROLES } from '@/types/delegates';

// --- Sort / Filter types ---

export type SortField =
  | 'displayName'
  | 'postCount'
  | 'topicCount'
  | 'likesReceived'
  | 'daysVisited'
  | 'rationaleCount'
  | 'voteRate'
  | 'lastSeenAt'
  | 'governanceScore';
export type SortDir = 'asc' | 'desc';
export type FilterProgram = 'all' | string;
export type FilterRole = 'all' | string;
export type FilterStatus = 'all' | 'active' | 'inactive';

// --- Branding ---

export interface BrandedColorsResult {
  accent: string;
  accentBg: string;
  accentBorder: string;
  accentHover: string;
  accentBadgeBg: string;
  accentBadgeBorder: string;
}

/** Derive accent-based color tokens from branding. Returns null if no accent. */
export function brandedColors(branding?: TenantBranding): BrandedColorsResult | null {
  const accent = branding?.accentColor;
  if (!accent) return null;
  let hex = accent.replace('#', '');
  if (hex.length === 3) {
    hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  }
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return null;
  return {
    accent,
    accentBg: `rgba(${r},${g},${b},0.07)`,
    accentBorder: `rgba(${r},${g},${b},0.19)`,
    accentHover: `rgba(${r},${g},${b},0.12)`,
    accentBadgeBg: `rgba(${r},${g},${b},0.12)`,
    accentBadgeBorder: `rgba(${r},${g},${b},0.25)`,
  };
}

// --- Activity Tier ---

export function getActivityTier(postCount: number): { label: string; color: string } {
  if (postCount >= 50) return { label: 'Highly Active', color: '#10b981' };
  if (postCount >= 11) return { label: 'Active', color: '#3b82f6' };
  if (postCount >= 2) return { label: 'Low Activity', color: '#f59e0b' };
  if (postCount >= 1) return { label: 'Minimal', color: '#f97316' };
  return { label: 'Dormant', color: '#ef4444' };
}

// --- Role helpers ---

export function dashboardGetRoleColor(role: string): string {
  switch (role) {
    case 'delegate': return '#6366f1';
    case 'council_member': return '#8b5cf6';
    case 'major_stakeholder': return '#f59e0b';
    case 'contributor': return '#10b981';
    case 'grantee': return '#06b6d4';
    case 'core_team': return '#ec4899';
    case 'advisor': return '#f97316';
    default: return '#71717a';
  }
}

export function dashboardGetRoleLabel(role: string): string {
  const found = DELEGATE_ROLES.find(r => r.id === role);
  return found ? found.label : role;
}

// --- HTML text extraction ---

/** Extract plain text from HTML safely using regex stripping (avoids innerHTML XSS) */
export function extractText(html: string, maxLen: number = 120): string {
  const text = html
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
  return text.slice(0, maxLen);
}
