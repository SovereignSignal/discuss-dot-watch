'use client';

import { useState, useEffect } from 'react';
import { Mail, Bell, Flame, Sparkles, Check, Loader2, Send } from 'lucide-react';
import { DigestPreferences, DigestFrequency } from '@/types';
import { useAuth } from './AuthProvider';

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
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [testMessage, setTestMessage] = useState<string | null>(null);

  const isDark = typeof document !== 'undefined' ? document.documentElement.classList.contains('dark') || !document.documentElement.classList.contains('light') : true;
  const fg = isDark ? '#fafafa' : '#09090b';
  const fgMuted = isDark ? '#a1a1aa' : '#3f3f46';
  const fgDim = isDark ? '#71717a' : '#52525b';
  const border = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
  const cardBg = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)';
  const activeBg = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)';

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try { setPrefs(prev => ({ ...prev, ...JSON.parse(saved) })); } catch {}
    }
  }, []);

  const handleFrequencyChange = (frequency: DigestFrequency) => setPrefs(prev => ({ ...prev, frequency }));
  const handleToggle = (key: keyof DigestPreferences) => {
    if (key === 'frequency' || key === 'email') return;
    setPrefs(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveMessage(null);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
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
      setTestMessage(data.success ? `Test email sent to ${email}!` : (data.message || 'Failed to send'));
    } catch {
      setTestMessage('Failed to send test email');
    } finally {
      setIsSendingTest(false);
      setTimeout(() => setTestMessage(null), 5000);
    }
  };

  const userEmail = user?.email || prefs.email;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-1 flex items-center gap-2" style={{ color: fg }}>
          <Mail className="w-5 h-5" style={{ color: fgMuted }} />
          Email Digests
        </h3>
        <p className="text-sm" style={{ color: fgDim }}>
          Get AI-powered summaries of governance activity delivered to your inbox
        </p>
      </div>

      {userEmail && (
        <div className="p-3 rounded-lg" style={{ backgroundColor: cardBg, border: `1px solid ${border}` }}>
          <div className="text-sm">
            <span style={{ color: fgDim }}>Sending to: </span>
            <span className="font-medium" style={{ color: fg }}>{userEmail}</span>
          </div>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium mb-3" style={{ color: fg }}>Digest Frequency</label>
        <div className="grid grid-cols-3 gap-3">
          {(['daily', 'weekly', 'never'] as DigestFrequency[]).map((freq) => {
            const isActive = prefs.frequency === freq;
            return (
              <button key={freq} onClick={() => handleFrequencyChange(freq)}
                className="p-3 rounded-lg text-sm font-medium transition-all"
                style={{
                  backgroundColor: isActive ? activeBg : cardBg,
                  border: `1px solid ${isActive ? (isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)') : border}`,
                  color: isActive ? fg : fgMuted,
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
          <label className="block text-sm font-medium mb-3" style={{ color: fg }}>Include in Digest</label>
          <div className="space-y-3">
            <ToggleOption checked={prefs.includeHotTopics} onChange={() => handleToggle('includeHotTopics')}
              icon={<Flame className="w-4 h-4" />} label="Hot Topics" description="Most discussed and viewed proposals"
              fg={fg} fgDim={fgDim} border={border} cardBg={cardBg} activeBg={activeBg} isDark={isDark} />
            <ToggleOption checked={prefs.includeNewProposals} onChange={() => handleToggle('includeNewProposals')}
              icon={<Sparkles className="w-4 h-4" />} label="New Proposals" description="Recently created discussions"
              fg={fg} fgDim={fgDim} border={border} cardBg={cardBg} activeBg={activeBg} isDark={isDark} />
            <ToggleOption checked={prefs.includeKeywordMatches} onChange={() => handleToggle('includeKeywordMatches')}
              icon={<Bell className="w-4 h-4" />} label="Keyword Alerts" description="Matches for your tracked keywords"
              fg={fg} fgDim={fgDim} border={border} cardBg={cardBg} activeBg={activeBg} isDark={isDark} />
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-3 pt-4 border-t" style={{ borderColor: border }}>
        <button onClick={handleSave} disabled={isSaving}
          className="flex items-center gap-2 px-4 py-2 font-medium rounded-lg transition-colors disabled:opacity-50"
          style={{ backgroundColor: fg, color: isDark ? '#09090b' : '#fafafa' }}>
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          Save Preferences
        </button>

        {prefs.frequency !== 'never' && userEmail && (
          <button onClick={handleSendTest} disabled={isSendingTest}
            className="flex items-center gap-2 px-4 py-2 font-medium rounded-lg transition-colors disabled:opacity-50"
            style={{ backgroundColor: cardBg, border: `1px solid ${border}`, color: fgMuted }}>
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
          <a href="/api/digest?format=html&period=weekly" target="_blank" rel="noopener noreferrer"
            style={{ color: fgMuted }} className="hover:underline">
            Preview digest email →
          </a>
        </div>
      )}
    </div>
  );
}

function ToggleOption({ checked, onChange, icon, label, description, fg, fgDim, border, cardBg, activeBg, isDark }: {
  checked: boolean; onChange: () => void; icon: React.ReactNode; label: string; description: string;
  fg: string; fgDim: string; border: string; cardBg: string; activeBg: string; isDark: boolean;
}) {
  return (
    <button onClick={onChange}
      className="flex items-start gap-3 w-full p-3 rounded-lg text-left transition-all"
      style={{
        backgroundColor: checked ? activeBg : cardBg,
        border: `1px solid ${checked ? (isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)') : border}`,
      }}>
      <div className="mt-0.5 w-5 h-5 rounded border flex items-center justify-center"
        style={{
          backgroundColor: checked ? fg : 'transparent',
          borderColor: checked ? fg : border,
        }}>
        {checked && <Check className="w-3 h-3" style={{ color: isDark ? '#09090b' : '#fafafa' }} />}
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span style={{ color: fgDim }}>{icon}</span>
          <span className="font-medium" style={{ color: fg }}>{label}</span>
        </div>
        <p className="text-sm mt-0.5" style={{ color: fgDim }}>{description}</p>
      </div>
    </button>
  );
}
