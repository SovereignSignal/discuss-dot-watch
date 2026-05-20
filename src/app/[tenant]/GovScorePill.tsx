'use client';

export function GovScorePill({ score, size = 'sm' }: { score: number; size?: 'sm' | 'md' }) {
  const color = score >= 60 ? '#10b981' : score >= 30 ? '#f59e0b' : '#ef4444';
  const fontSize = size === 'md' ? 12 : 11;
  const padding = size === 'md' ? '3px 10px' : '2px 8px';
  return (
    <span
      style={{
        fontSize,
        fontWeight: 700,
        padding,
        borderRadius: 9999,
        background: `${color}15`,
        border: `1px solid ${color}33`,
        color,
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      {score}
    </span>
  );
}
