'use client';

import { Forum, KeywordAlert, Bookmark } from '@/types';
import { StorageQuota } from '@/lib/storage';
import { ConfigExportImport } from '@/components/ConfigExportImport';
import { KeyboardShortcuts } from '@/components/KeyboardShortcuts';
import { c } from '@/lib/theme';

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
  const t = c(isDark);

  return (
    <div className="flex-1 p-6 overflow-y-auto">
      <h2
        className="text-[15px] font-semibold mb-6"
        style={{ color: t.fgSecondary }}
      >
        Settings
      </h2>
      <div className="max-w-2xl space-y-6">
        <section className="pb-6 border-b" style={{ borderColor: t.borderSubtle }}>
          <h3 className="text-[13px] font-medium mb-2" style={{ color: t.fgSecondary }}>About</h3>
          <p className="text-[13px]" style={{ color: t.fgMuted }}>
            discuss.watch — Unified view of Discourse forums across crypto, AI, and open source communities.
          </p>
        </section>

        <section className="pb-6 border-b" style={{ borderColor: t.borderSubtle }}>
          <h3 className="text-[13px] font-medium mb-2" style={{ color: t.fgSecondary }}>Data</h3>
          <p className="text-[13px] mb-2" style={{ color: t.fgMuted }}>
            All data stored locally in your browser.
          </p>
          {quota && (
            <p className="text-[11px]" style={{ color: t.fgDim }}>
              {(quota.used / 1024).toFixed(1)}KB used
            </p>
          )}
        </section>

        <section className="pb-6 border-b" style={{ borderColor: t.borderSubtle }}>
          <h3 className="text-[13px] font-medium mb-3" style={{ color: t.fgSecondary }}>Import / Export</h3>
          <ConfigExportImport
            forums={forums}
            alerts={alerts}
            bookmarks={bookmarks}
            onImport={onImport}
            isDark={isDark}
          />
        </section>

        <section className="pb-6 border-b" style={{ borderColor: t.borderSubtle }}>
          <h3 className="text-[13px] font-medium mb-3" style={{ color: t.fgSecondary }}>Keyboard Shortcuts</h3>
          <KeyboardShortcuts isDark={isDark} />
        </section>

        <section>
          <button
            onClick={onResetOnboarding}
            className="px-3 py-1.5 rounded-md text-[12px] font-medium transition-colors"
            style={{
              backgroundColor: t.bgActive,
              color: t.fgSecondary,
            }}
          >
            Show Onboarding
          </button>
        </section>
      </div>
    </div>
  );
}
