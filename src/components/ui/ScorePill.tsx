'use client';

export interface ScorePillProps {
  score: number;
  /** sm (default) for tables, md for hero placements. */
  size?: 'sm' | 'md';
  className?: string;
}

function rangeColor(score: number): { fg: string; bg: string; border: string } {
  if (score >= 60) return { fg: 'var(--ds-success)', bg: 'rgba(16,185,129,0.15)', border: 'rgba(16,185,129,0.33)' };
  if (score >= 30) return { fg: 'var(--ds-warn)',    bg: 'rgba(245,158,11,0.15)', border: 'rgba(245,158,11,0.33)' };
  return                  { fg: 'var(--ds-error)',   bg: 'rgba(239,68,68,0.15)',  border: 'rgba(239,68,68,0.33)'  };
}

/**
 * Governance score pill — three color ranges (≥60 green, ≥30 amber, <30 red).
 * Always font-mono with tabular-nums for column alignment.
 */
export function ScorePill({ score, size = 'sm', className }: ScorePillProps) {
  const { fg, bg, border } = rangeColor(score);
  const fontSize = size === 'md' ? 'var(--ds-text-sm)' : 'var(--ds-text-xs)';
  const padding = size === 'md' ? '3px 10px' : '2px 8px';
  return (
    <span
      className={className}
      style={{
        display: 'inline-flex',
        fontSize,
        fontWeight: 700,
        padding,
        borderRadius: 'var(--ds-radius-full)',
        background: bg,
        border: `1px solid ${border}`,
        color: fg,
        fontFamily: 'var(--ds-font-mono)',
        fontVariantNumeric: 'tabular-nums',
        lineHeight: 1.2,
      }}
    >
      {score}
    </span>
  );
}
