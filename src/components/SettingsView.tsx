'use client';

import { Forum, KeywordAlert, Bookmark } from '@/types';
import { StorageQuota } from '@/lib/storage';
import { ConfigExportImport } from '@/components/ConfigExportImport';
import { KeyboardShortcuts } from '@/components/KeyboardShortcuts';

interface SettingsViewProps {
  forums: Forum[];
  alerts: KeywordAlert[];
  bookmarks: Bookmark[];
  quota: StorageQuota | null;
  onImport: (data: {
    forums?: Forum[];
    alerts?: KeywordAlert[];
    bookmarks?: Bookmark[];
  }) => void;
  onResetOnboarding: () => void;
  isDark: boolean;
}

export function SettingsView({
  forums,
  alerts,
  bookmarks,
  quota,
  onImport,
  onResetOnboarding,
  isDark,
}: SettingsViewProps) {
  return (
    <div className="flex-1 p-6 overflow-y-auto">
      <h2
        className="text-[15px] font-semibold mb-6"
        style={{ color: 'var(--ds-fg)' }}
      >
        Settings
      </h2>
      <div className="max-w-2xl space-y-6">
        <section className="pb-6 border-b" style={{ borderColor: 'var(--ds-border-subtle)' }}>
          <h3 className="text-[13px] font-medium mb-2" style={{ color: 'var(--ds-fg)' }}>About</h3>
          <p className="text-[13px]" style={{ color: 'var(--ds-fg-muted)' }}>
            discuss.watch — Unified view of Discourse forums across crypto, AI, and open source communities.
          </p>
        </section>

        <section className="pb-6 border-b" style={{ borderColor: 'var(--ds-border-subtle)' }}>
          <h3 className="text-[13px] font-medium mb-2" style={{ color: 'var(--ds-fg)' }}>Data</h3>
          <p className="text-[13px] mb-2" style={{ color: 'var(--ds-fg-muted)' }}>
            All data stored locally in your browser.
          </p>
          {quota && (
            <p className="text-[11px]" style={{ color: 'var(--ds-fg-dim)' }}>
              {(quota.used / 1024).toFixed(1)}KB used
            </p>
          )}
        </section>

        <section className="pb-6 border-b" style={{ borderColor: 'var(--ds-border-subtle)' }}>
          <h3 className="text-[13px] font-medium mb-3" style={{ color: 'var(--ds-fg)' }}>Import / Export</h3>
          <ConfigExportImport
            forums={forums}
            alerts={alerts}
            bookmarks={bookmarks}
            onImport={onImport}
            isDark={isDark}
          />
        </section>

        <section className="pb-6 border-b" style={{ borderColor: 'var(--ds-border-subtle)' }}>
          <h3 className="text-[13px] font-medium mb-3" style={{ color: 'var(--ds-fg)' }}>Keyboard Shortcuts</h3>
          <KeyboardShortcuts isDark={isDark} />
        </section>

        <section>
          <button
            onClick={onResetOnboarding}
            className="px-3 py-1.5 rounded-md text-[12px] font-medium transition-colors"
            style={{
              backgroundColor: 'var(--ds-bg-elev)',
              color: 'var(--ds-fg)',
            }}
          >
            Show Onboarding
          </button>
        </section>
      </div>
    </div>
  );
}
