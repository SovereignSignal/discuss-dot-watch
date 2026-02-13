'use client';

import { useEffect, useRef, useCallback } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { c } from '@/lib/theme';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning';
  onConfirm: () => void;
  onCancel: () => void;
  isDark?: boolean;
}

export function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  onConfirm,
  onCancel,
  isDark = true,
}: ConfirmDialogProps) {
  const t = c(isDark);
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  // Focus trap and keyboard handling
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      onCancel();
      return;
    }

    if (e.key === 'Tab' && dialogRef.current) {
      const focusableElements = dialogRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (e.shiftKey && document.activeElement === firstElement) {
        e.preventDefault();
        lastElement?.focus();
      } else if (!e.shiftKey && document.activeElement === lastElement) {
        e.preventDefault();
        firstElement?.focus();
      }
    }
  }, [onCancel]);

  // Manage focus when dialog opens/closes
  useEffect(() => {
    if (isOpen) {
      // Store the previously focused element
      previousActiveElement.current = document.activeElement as HTMLElement;

      // Focus the cancel button (safe default action)
      const cancelButton = dialogRef.current?.querySelector<HTMLButtonElement>('[data-cancel-button]');
      cancelButton?.focus();

      // Add keyboard listener
      document.addEventListener('keydown', handleKeyDown);

      // Prevent body scroll
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';

      // Restore focus to previous element
      if (previousActiveElement.current && !isOpen) {
        previousActiveElement.current.focus();
      }
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onCancel}
        aria-hidden="true"
      />
      <div
        ref={dialogRef}
        className="relative rounded-lg shadow-xl max-w-md w-full mx-4 p-6"
        style={{ backgroundColor: isDark ? t.bgCard : '#ffffff', border: `1px solid ${t.border}` }}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-description"
      >
        <button
          onClick={onCancel}
          className="absolute top-4 right-4 p-2 min-w-[44px] min-h-[44px] flex items-center justify-center transition-colors rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
          style={{ color: t.fgDim }}
          aria-label="Close dialog"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-start gap-4">
          <div className="p-2 rounded-lg flex-shrink-0" style={{
            backgroundColor: variant === 'danger' ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.1)',
          }} aria-hidden="true">
            <AlertTriangle className="w-6 h-6" style={{
              color: variant === 'danger' ? (isDark ? '#f87171' : '#dc2626') : (isDark ? '#fbbf24' : '#d97706'),
            }} />
          </div>
          <div className="flex-1">
            <h2
              id="confirm-dialog-title"
              className="text-lg font-semibold mb-2"
              style={{ color: t.fg }}
            >
              {title}
            </h2>
            <p id="confirm-dialog-description" className="text-sm mb-6" style={{ color: t.fgMuted }}>
              {message}
            </p>

            <div className="flex gap-3 justify-end">
              <button
                data-cancel-button
                onClick={onCancel}
                className="px-4 py-2 min-h-[44px] text-sm rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
                style={{ backgroundColor: t.bgActiveStrong, border: `1px solid ${t.border}`, color: t.fg }}
              >
                {cancelLabel}
              </button>
              <button
                onClick={onConfirm}
                className={`px-4 py-2 min-h-[44px] text-white text-sm rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 ${
                  variant === 'danger'
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : 'bg-amber-600 hover:bg-amber-700'
                }`}
              >
                {confirmLabel}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
