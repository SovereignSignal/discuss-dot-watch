'use client';

import { Forum, KeywordAlert, Bookmark } from '@/types';
import { StorageQuota } from '@/lib/storage';
import { ConfigExportImport } from '@/components/ConfigExportImport';
import { EmailPreferences } from '@/components/EmailPreferences';
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
        style={{ color: isDark ? '#e4e4e7' : '#18181b' }}
      >
        Settings
      </h2>
      <div className="max-w-2xl space-y-6">
        <section className="pb-6 border-b" style={{ borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }}>
          <h3 className="text-[13px] font-medium mb-2" style={{ color: isDark ? '#e5e5e5' : '#374151' }}>About</h3>
          <p className="text-[13px]" style={{ color: isDark ? '#52525b' : '#6b7280' }}>
            discuss.watch — Unified view of Discourse forums across crypto, AI, and open source communities.
          </p>
        </section>

        <section className="pb-6 border-b" style={{ borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }}>
          <h3 className="text-[13px] font-medium mb-2" style={{ color: isDark ? '#e5e5e5' : '#374151' }}>Data</h3>
          <p className="text-[13px] mb-2" style={{ color: isDark ? '#52525b' : '#6b7280' }}>
            All data stored locally in your browser.
          </p>
          {quota && (
            <p className="text-[11px]" style={{ color: isDark ? '#3f3f46' : '#9ca3af' }}>
              {(quota.used / 1024).toFixed(1)}KB used
            </p>
          )}
        </section>

        <section className="pb-6 border-b" style={{ borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }}>
          <h3 className="text-[13px] font-medium mb-3" style={{ color: isDark ? '#e5e5e5' : '#374151' }}>Import / Export</h3>
          <ConfigExportImport
            forums={forums}
            alerts={alerts}
            bookmarks={bookmarks}
            onImport={onImport}
            isDark={isDark}
          />
        </section>

        <section className="pb-6 border-b" style={{ borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }}>
          <h3 className="text-[13px] font-medium mb-3" style={{ color: isDark ? '#e5e5e5' : '#374151' }}>Email Preferences</h3>
          <EmailPreferences isDark={isDark} />
        </section>

        <section className="pb-6 border-b" style={{ borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }}>
          <h3 className="text-[13px] font-medium mb-3" style={{ color: isDark ? '#e5e5e5' : '#374151' }}>Keyboard Shortcuts</h3>
          <KeyboardShortcuts isDark={isDark} />
        </section>

        <section>
          <button
            onClick={onResetOnboarding}
            className="px-3 py-1.5 rounded-md text-[12px] font-medium transition-colors"
            style={{
              backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
              color: isDark ? '#e5e5e5' : '#374151'
            }}
          >
            Show Onboarding
          </button>
        </section>
      </div>
    </div>
  );
}
