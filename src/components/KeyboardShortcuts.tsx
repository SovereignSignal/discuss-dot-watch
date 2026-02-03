'use client';

import { Keyboard } from 'lucide-react';

const SHORTCUTS = [
  { keys: ['j', '↓'], description: 'Next discussion' },
  { keys: ['k', '↑'], description: 'Previous discussion' },
  { keys: ['Enter'], description: 'Open discussion' },
  { keys: ['b'], description: 'Toggle bookmark' },
  { keys: ['r'], description: 'Mark as read' },
  { keys: ['/'], description: 'Focus search' },
  { keys: ['Esc'], description: 'Clear focus' },
];

export function KeyboardShortcuts() {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 theme-text-secondary text-sm mb-2">
        <Keyboard className="w-4 h-4" />
        <span>Keyboard Shortcuts</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {SHORTCUTS.map(({ keys, description }) => (
          <div key={description} className="flex items-center gap-2 text-sm">
            <div className="flex items-center gap-1">
              {keys.map((key, i) => (
                <span key={i}>
                  <kbd className="px-1.5 py-0.5 bg-neutral-700 theme-text-secondary rounded text-xs font-mono">
                    {key}
                  </kbd>
                  {i < keys.length - 1 && <span className="theme-text-muted mx-0.5">/</span>}
                </span>
              ))}
            </div>
            <span className="theme-text-muted">{description}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
