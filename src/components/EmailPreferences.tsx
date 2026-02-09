'use client';

import { useState, useEffect, useCallback } from 'react';
import { Mail, Bell, Flame, Sparkles, Users, Check, Loader2, Send } from 'lucide-react';
import { DigestPreferences, DigestFrequency } from '@/types';
import { useAuth } from './AuthProvider';
import { c } from '@/lib/theme';

interface EmailPreferencesProps {
  onSave?: (prefs: DigestPreferences) => void;
}

const STORAGE_KEY = 'gov-watch-digest-prefs';

export function EmailPreferences({ onSave }: EmailPreferencesProps) {
  const { user } = useAuth();
  const [prefs, setPrefs] = useState<DigestPreferences>({
    frequency: 'weekly',
    includeHotTopics: true,
    includeNewProposals: true,
    includeKeywordMatches: true,
    includeDelegateCorner: true,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [testMessage, setTestMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const isDark = typeof document !== 'undefined' ? document.documentElement.classList.contains('dark') || !document.documentElement.classList.contains('light') : true;
  const t = c(isDark);

  const privyDid = user?.id; // Privy DID from auth

  // Load preferences: from API if authenticated, localStorage otherwise
  const loadPreferences = useCallback(async () => {
    if (privyDid) {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/user/digest-preferences?privyDid=${encodeURIComponent(privyDid)}`);
        if (res.ok) {
          const data = await res.json();
          const dp = data.digestPreferences;
          if (dp) {
            setPrefs({
              frequency: dp.frequency || 'weekly',
              includeHotTopics: dp.includeHotTopics ?? true,
              includeNewProposals: dp.includeNewProposals ?? true,
              includeKeywordMatches: dp.includeKeywordMatches ?? true,
              includeDelegateCorner: dp.includeDelegateCorner ?? true,
              email: dp.digestEmail || undefined,
            });
          }
        }
      } catch {
        // Fall back to localStorage
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          try { setPrefs(prev => ({ ...prev, ...JSON.parse(saved) })); } catch {}
        }
      } finally {
        setIsLoading(false);
      }
    } else {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        try { setPrefs(prev => ({ ...prev, ...JSON.parse(saved) })); } catch {}
      }
    }
  }, [privyDid]);

  useEffect(() => {
    loadPreferences();
  }, [loadPreferences]);

  const handleFrequencyChange = (frequency: DigestFrequency) => setPrefs(prev => ({ ...prev, frequency }));
  const handleToggle = (key: keyof DigestPreferences) => {
    if (key === 'frequency' || key === 'email') return;
    setPrefs(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveMessage(null);
    try {
      // Always save to localStorage as fallback
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));

      // If authenticated, save to DB
      if (privyDid) {
        const res = await fetch('/api/user/digest-preferences', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            privyDid,
            frequency: prefs.frequency,
            digestEmail: prefs.email || null,
            includeHotTopics: prefs.includeHotTopics,
            includeNewProposals: prefs.includeNewProposals,
            includeKeywordMatches: prefs.includeKeywordMatches,
            includeDelegateCorner: prefs.includeDelegateCorner,
          }),
        });
        if (!res.ok) throw new Error('Failed to save to server');
      }

      setSaveMessage('Preferences saved!');
      onSave?.(prefs);
      setTimeout(() => setSaveMessage(null), 3000);
    } catch {
      setSaveMessage('Failed to save preferences');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSendTest = async () => {
    const email = user?.email || prefs.email;
    if (!email) { setTestMessage('No email address found'); return; }
    setIsSendingTest(true);
    setTestMessage(null);
    try {
      const response = await fetch('/api/digest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-email': email },
        body: JSON.stringify({ period: 'weekly', testEmail: email }),
      });
      const data = await response.json();
      setTestMessage(data.success ? `Test email sent to ${email}!` : (data.error || data.message || 'Failed to send'));
    } catch {
      setTestMessage('Failed to send test email');
    } finally {
      setIsSendingTest(false);
      setTimeout(() => setTestMessage(null), 5000);
    }
  };

  const userEmail = user?.email || prefs.email;

  // Build personalized preview URL
  const previewUrl = privyDid
    ? `/api/digest?format=html&period=weekly&privyDid=${encodeURIComponent(privyDid)}`
    : '/api/digest?format=html&period=weekly';

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin" style={{ color: t.fgMuted }} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-1 flex items-center gap-2" style={{ color: t.fg }}>
          <Mail className="w-5 h-5" style={{ color: t.fgMuted }} />
          Email Digests
        </h3>
        <p className="text-sm" style={{ color: t.fgDim }}>
          Get AI-powered summaries of forum activity delivered to your inbox
        </p>
      </div>

      {userEmail && (
        <div className="p-3 rounded-lg" style={{ backgroundColor: t.bgCard, border: `1px solid ${t.border}` }}>
          <div className="text-sm">
            <span style={{ color: t.fgDim }}>Sending to: </span>
            <span className="font-medium" style={{ color: t.fg }}>{userEmail}</span>
          </div>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium mb-3" style={{ color: t.fg }}>Digest Frequency</label>
        <div className="grid grid-cols-3 gap-3">
          {(['daily', 'weekly', 'never'] as DigestFrequency[]).map((freq) => {
            const isActive = prefs.frequency === freq;
            return (
              <button key={freq} onClick={() => handleFrequencyChange(freq)}
                className="p-3 rounded-lg text-sm font-medium transition-all"
                style={{
                  backgroundColor: isActive ? t.bgActiveStrong : t.bgCard,
                  border: `1px solid ${isActive ? t.borderActive : t.border}`,
                  color: isActive ? t.fg : t.fgMuted,
                }}>
                {freq === 'daily' && '📅 Daily'}
                {freq === 'weekly' && '📆 Weekly'}
                {freq === 'never' && '🔕 Never'}
              </button>
            );
          })}
        </div>
      </div>

      {prefs.frequency !== 'never' && (
        <div>
          <label className="block text-sm font-medium mb-3" style={{ color: t.fg }}>Include in Digest</label>
          <div className="space-y-3">
            <ToggleOption checked={prefs.includeHotTopics} onChange={() => handleToggle('includeHotTopics')}
              icon={<Flame className="w-4 h-4" />} label="Trending" description="Active discussions with high engagement" t={t} isDark={isDark} />
            <ToggleOption checked={prefs.includeNewProposals} onChange={() => handleToggle('includeNewProposals')}
              icon={<Sparkles className="w-4 h-4" />} label="New Conversations" description="Recently created discussions" t={t} isDark={isDark} />
            <ToggleOption checked={prefs.includeKeywordMatches} onChange={() => handleToggle('includeKeywordMatches')}
              icon={<Bell className="w-4 h-4" />} label="Keyword Matches" description="New topics matching your tracked keywords" t={t} isDark={isDark} />
            <ToggleOption checked={prefs.includeDelegateCorner} onChange={() => handleToggle('includeDelegateCorner')}
              icon={<Users className="w-4 h-4" />} label="Delegate Corner" description="Updates from active delegates" t={t} isDark={isDark} />
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-3 pt-4 border-t" style={{ borderColor: t.border }}>
        <button onClick={handleSave} disabled={isSaving}
          className="flex items-center gap-2 px-4 py-2 font-medium rounded-lg transition-colors disabled:opacity-50"
          style={{ backgroundColor: t.fg, color: isDark ? '#000000' : '#fafafa' }}>
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          Save Preferences
        </button>

        {prefs.frequency !== 'never' && userEmail && (
          <button onClick={handleSendTest} disabled={isSendingTest}
            className="flex items-center gap-2 px-4 py-2 font-medium rounded-lg transition-colors disabled:opacity-50"
            style={{ backgroundColor: t.bgCard, border: `1px solid ${t.border}`, color: t.fgMuted }}>
            {isSendingTest ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Send Test Email
          </button>
        )}
      </div>

      {saveMessage && (
        <div className="p-3 rounded-lg text-sm" style={{
          backgroundColor: saveMessage.includes('Failed') ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)',
          color: saveMessage.includes('Failed') ? '#ef4444' : '#10b981'
        }}>{saveMessage}</div>
      )}
      {testMessage && (
        <div className="p-3 rounded-lg text-sm" style={{
          backgroundColor: testMessage.includes('Failed') ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)',
          color: testMessage.includes('Failed') ? '#ef4444' : '#10b981'
        }}>{testMessage}</div>
      )}

      {prefs.frequency !== 'never' && (
        <div className="text-sm">
          <a href={previewUrl} target="_blank" rel="noopener noreferrer"
            style={{ color: t.fgMuted }} className="hover:underline">
            Preview digest email →
          </a>
        </div>
      )}
    </div>
  );
}

function ToggleOption({ checked, onChange, icon, label, description, t, isDark }: {
  checked: boolean; onChange: () => void; icon: React.ReactNode; label: string; description: string;
  t: ReturnType<typeof c>; isDark: boolean;
}) {
  return (
    <button onClick={onChange}
      className="flex items-start gap-3 w-full p-3 rounded-lg text-left transition-all"
      style={{
        backgroundColor: checked ? t.bgActiveStrong : t.bgCard,
        border: `1px solid ${checked ? t.borderActive : t.border}`,
      }}>
      <div className="mt-0.5 w-5 h-5 rounded border flex items-center justify-center"
        style={{
          backgroundColor: checked ? t.fg : 'transparent',
          borderColor: checked ? t.fg : t.border,
        }}>
        {checked && <Check className="w-3 h-3" style={{ color: isDark ? '#000000' : '#fafafa' }} />}
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span style={{ color: t.fgDim }}>{icon}</span>
          <span className="font-medium" style={{ color: t.fg }}>{label}</span>
        </div>
        <p className="text-sm mt-0.5" style={{ color: t.fgDim }}>{description}</p>
      </div>
    </button>
  );
}
