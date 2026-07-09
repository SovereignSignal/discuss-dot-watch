'use client';

import { useEffect, useState } from 'react';

export interface GrantChip {
  /** 'grant' (funding opportunity) or 'role' (paid position/seat).
   *  Optional for wire compat — a missing value means 'grant'. */
  cls?: 'grant' | 'role';
  confidence: number;
  kind?: string;
  program?: string;
  amount?: string;
  deadline?: string; // calendar date, YYYY-MM-DD
  /** Deadline falls within the next 30 days (computed once at fetch time —
   *  render code can't call Date.now() under the React Compiler). */
  dueSoon?: boolean;
}

/**
 * refId -> grant chip data for the reader's reason chips. One fetch per mount;
 * the endpoint is module- and CDN-cached server-side. Failure degrades to an
 * empty map (rows simply render without a grant chip).
 */
export function useGrantChips(): Record<string, GrantChip> {
  const [chips, setChips] = useState<Record<string, GrantChip>>({});

  useEffect(() => {
    let cancelled = false;
    // include=roles is the post-roles-lane contract; bundles without it
    // (pre-deploy, CDN-cached) keep receiving grants-only payloads.
    fetch('/api/grants-chips?include=roles')
      .then(res => (res.ok ? res.json() : null))
      .then((data: { chips?: Record<string, GrantChip> } | null) => {
        if (cancelled || !data?.chips) return;
        const now = Date.now();
        const DAY_MS = 24 * 60 * 60 * 1000;
        const augmented: Record<string, GrantChip> = {};
        for (const [refId, chip] of Object.entries(data.chips)) {
          let dueSoon = false;
          if (chip.deadline) {
            // Calendar date -> local midnight; "due" holds through the deadline day.
            const t = new Date(`${chip.deadline.slice(0, 10)}T00:00:00`).getTime();
            dueSoon = !Number.isNaN(t) && t + DAY_MS > now && t - now < 30 * DAY_MS;
          }
          augmented[refId] = { ...chip, dueSoon };
        }
        setChips(augmented);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return chips;
}
