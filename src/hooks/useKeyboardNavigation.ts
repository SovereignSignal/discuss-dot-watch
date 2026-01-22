'use client';

import { useCallback, useEffect, useState } from 'react';

interface UseKeyboardNavigationOptions {
  itemCount: number;
  onSelect?: (index: number) => void;
  onEscape?: () => void;
  enabled?: boolean;
}

export function useKeyboardNavigation({
  itemCount,
  onSelect,
  onEscape,
  enabled = true,
}: UseKeyboardNavigationOptions) {
  const [focusedIndex, setFocusedIndex] = useState(-1);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled || itemCount === 0) return;

      switch (event.key) {
        case 'ArrowDown':
        case 'j': // vim-style
          event.preventDefault();
          setFocusedIndex((prev) => {
            const next = prev < itemCount - 1 ? prev + 1 : prev;
            return next;
          });
          break;

        case 'ArrowUp':
        case 'k': // vim-style
          event.preventDefault();
          setFocusedIndex((prev) => {
            const next = prev > 0 ? prev - 1 : 0;
            return next;
          });
          break;

        case 'Enter':
        case ' ':
          if (focusedIndex >= 0 && onSelect) {
            event.preventDefault();
            onSelect(focusedIndex);
          }
          break;

        case 'Home':
          event.preventDefault();
          setFocusedIndex(0);
          break;

        case 'End':
          event.preventDefault();
          setFocusedIndex(itemCount - 1);
          break;

        case 'Escape':
          if (onEscape) {
            event.preventDefault();
            onEscape();
          }
          setFocusedIndex(-1);
          break;
      }
    },
    [enabled, itemCount, focusedIndex, onSelect, onEscape]
  );

  useEffect(() => {
    if (enabled) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [enabled, handleKeyDown]);

  // Compute effective focused index (clamped to valid range)
  const effectiveFocusedIndex = focusedIndex >= itemCount
    ? (itemCount > 0 ? itemCount - 1 : -1)
    : focusedIndex;

  const resetFocus = useCallback(() => setFocusedIndex(-1), []);

  return {
    focusedIndex: effectiveFocusedIndex,
    setFocusedIndex,
    resetFocus,
  };
}
