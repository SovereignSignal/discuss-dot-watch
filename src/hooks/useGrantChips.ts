'use client';

import { useEffect, useState } from 'react';

export interface GrantChip {
  confidence: number;
  kind?: string;
  program?: string;
  amount?: string;
  deadline?: string; // ISO date
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
    fetch('/api/grants-chips')
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (!cancelled && data?.chips) setChips(data.chips);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return chips;
}
