'use client';

import { useState } from 'react';
import { Bell, X, Plus } from 'lucide-react';
import { KeywordAlert } from '@/types';
import { sanitizeKeyword } from '@/lib/sanitize';
import { Chip } from './ui/Chip';

interface AlertsStripProps {
  alerts: KeywordAlert[];
  onAddAlert: (keyword: string) => void;
  onRemoveAlert: (id: string) => void;
  onToggleAlert: (id: string) => void;
  activeKeywordFilter: string | null;
  onKeywordFilterChange: (filter: string | null) => void;
}

/**
 * Horizontal keyword alerts strip — replaces the right-sidebar alerts column.
 * Lives above the feed (between BriefsStrip and the discussion list).
 *
 * Each alert is a Chip:
 *   - Click → toggles filter (feed shows only matching topics)
 *   - Hover → reveals X button to delete
 *   - Disabled alerts render at half opacity, click reactivates
 *
 * Empty state: just the "+ keyword" input.
 */
export function AlertsStrip({
  alerts,
  onAddAlert,
  onRemoveAlert,
  onToggleAlert,
  activeKeywordFilter,
  onKeywordFilterChange,
}: AlertsStripProps) {
  const [adding, setAdding] = useState(false);
  const [newKeyword, setNewKeyword] = useState('');

  const submit = () => {
    const sanitized = sanitizeKeyword(newKeyword);
    if (!sanitized) return;
    onAddAlert(sanitized);
    setNewKeyword('');
    setAdding(false);
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '10px 20px',
        background: 'var(--ds-bg-base)',
        borderBottom: `1px solid var(--ds-border-subtle)`,
        flexWrap: 'wrap',
      }}
    >
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 5,
          fontFamily: 'var(--ds-font-mono)',
          fontSize: 'var(--ds-text-xs)',
          color: 'var(--ds-fg-dim)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}
      >
        <Bell size={11} /> Alerts
      </span>

      {alerts.length === 0 && !adding && (
        <span style={{ fontSize: 'var(--ds-text-xs)', color: 'var(--ds-fg-dim)' }}>
          No alerts set
        </span>
      )}

      {alerts.map((a) => {
        const isActive = activeKeywordFilter === a.keyword;
        return (
          <span
            key={a.id}
            style={{ position: 'relative', display: 'inline-flex' }}
            className="group"
          >
            <Chip
              active={isActive}
              vertical="ai"
              onClick={() => {
                if (!a.isEnabled) {
                  onToggleAlert(a.id);
                  return;
                }
                onKeywordFilterChange(isActive ? null : a.keyword);
              }}
              style={{ opacity: a.isEnabled ? 1 : 0.5, paddingRight: 24 }}
              title={a.isEnabled ? (isActive ? 'Filtering by this keyword' : 'Click to filter') : 'Click to enable'}
            >
              {a.keyword}
            </Chip>
            <button
              onClick={(e) => { e.stopPropagation(); onRemoveAlert(a.id); }}
              className="opacity-0 group-hover:opacity-100 transition-opacity"
              title="Remove alert"
              style={{
                position: 'absolute',
                right: 6,
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'transparent',
                border: 'none',
                color: 'var(--ds-fg-dim)',
                cursor: 'pointer',
                padding: 2,
                display: 'inline-flex',
                alignItems: 'center',
              }}
            >
              <X size={11} />
            </button>
          </span>
        );
      })}

      {activeKeywordFilter !== null && (
        <button
          onClick={() => onKeywordFilterChange(null)}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--ds-fg-dim)',
            fontSize: 'var(--ds-text-xs)',
            cursor: 'pointer',
            padding: '0 4px',
          }}
        >
          Clear filter
        </button>
      )}

      {adding ? (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <input
            autoFocus
            type="text"
            value={newKeyword}
            onChange={(e) => setNewKeyword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit();
              if (e.key === 'Escape') { setAdding(false); setNewKeyword(''); }
            }}
            onBlur={() => { if (!newKeyword.trim()) setAdding(false); }}
            placeholder="keyword..."
            maxLength={100}
            style={{
              background: 'var(--ds-bg-elev)',
              border: `1px solid var(--ds-border)`,
              borderRadius: 'var(--ds-radius-full)',
              color: 'var(--ds-fg)',
              fontSize: 'var(--ds-text-xs)',
              padding: '3px 10px',
              outline: 'none',
              width: 110,
              fontFamily: 'var(--ds-font-sans)',
            }}
          />
        </span>
      ) : (
        <Chip variant="dashed" onClick={() => setAdding(true)}>
          <Plus size={11} /> keyword
        </Chip>
      )}
    </div>
  );
}
