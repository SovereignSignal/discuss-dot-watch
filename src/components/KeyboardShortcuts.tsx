'use client';

import { Keyboard } from 'lucide-react';
import { c } from '@/lib/theme';

const SHORTCUTS = [
  { keys: ['j', '↓'], description: 'Next discussion' },
  { keys: ['k', '↑'], description: 'Previous discussion' },
  { keys: ['Enter'], description: 'Open discussion' },
  { keys: ['b'], description: 'Toggle bookmark' },
  { keys: ['r'], description: 'Mark as read' },
  { keys: ['/'], description: 'Focus search' },
  { keys: ['Esc'], description: 'Clear focus' },
];

export function KeyboardShortcuts({ isDark = true }: { isDark?: boolean }) {
  const t = c(isDark);
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm mb-2" style={{ color: t.fgMuted }}>
        <Keyboard className="w-4 h-4" />
        <span>Keyboard Shortcuts</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {SHORTCUTS.map(({ keys, description }) => (
          <div key={description} className="flex items-center gap-2 text-sm">
            <div className="flex items-center gap-1">
              {keys.map((key, i) => (
                <span key={i}>
                  <kbd className="px-1.5 py-0.5 rounded text-xs font-mono"
                    style={{ backgroundColor: t.bgCard, color: t.fgSecondary, border: `1px solid ${t.border}` }}>
                    {key}
                  </kbd>
                  {i < keys.length - 1 && <span className="mx-0.5" style={{ color: t.fgDim }}>/</span>}
                </span>
              ))}
            </div>
            <span style={{ color: t.fgDim }}>{description}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
