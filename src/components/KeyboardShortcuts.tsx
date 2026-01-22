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
      <div className="flex items-center gap-2 text-gray-400 text-sm mb-2">
        <Keyboard className="w-4 h-4" />
        <span>Keyboard Shortcuts</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {SHORTCUTS.map(({ keys, description }) => (
          <div key={description} className="flex items-center gap-2 text-sm">
            <div className="flex items-center gap-1">
              {keys.map((key, i) => (
                <span key={i}>
                  <kbd className="px-1.5 py-0.5 bg-gray-700 text-gray-300 rounded text-xs font-mono">
                    {key}
                  </kbd>
                  {i < keys.length - 1 && <span className="text-gray-600 mx-0.5">/</span>}
                </span>
              ))}
            </div>
            <span className="text-gray-500">{description}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
