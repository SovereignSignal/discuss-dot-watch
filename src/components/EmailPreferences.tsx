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

  // Load preferences on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setPrefs(prev => ({ ...prev, ...parsed }));
      } catch (e) {
        console.error('Failed to parse saved preferences:', e);
      }
    }
  }, []);

  const handleFrequencyChange = (frequency: DigestFrequency) => {
    setPrefs(prev => ({ ...prev, frequency }));
  };

  const handleToggle = (key: keyof DigestPreferences) => {
    if (key === 'frequency' || key === 'email') return;
    setPrefs(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveMessage(null);

    try {
      // Save to localStorage
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
      
      // In production, also save to server
      // await fetch('/api/user/preferences', { method: 'POST', body: JSON.stringify(prefs) });
      
      setSaveMessage('Preferences saved!');
      onSave?.(prefs);
      
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (error) {
      setSaveMessage('Failed to save preferences');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSendTest = async () => {
    const email = user?.email || prefs.email;
    if (!email) {
      setTestMessage('No email address found');
      return;
    }

    setIsSendingTest(true);
    setTestMessage(null);

    try {
      const response = await fetch('/api/digest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          period: 'weekly',
          testEmail: email,
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        setTestMessage(`Test email sent to ${email}!`);
      } else {
        setTestMessage(data.message || 'Failed to send test email');
      }
    } catch (error) {
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
        <h3 className="text-lg font-semibold theme-text mb-1 flex items-center gap-2">
          <Mail className="w-5 h-5 text-indigo-500" />
          Email Digests
        </h3>
        <p className="text-sm theme-text-muted">
          Get AI-powered summaries of governance activity delivered to your inbox
        </p>
      </div>

      {/* Email address */}
      {userEmail && (
        <div className="p-3 rounded-lg" style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
          <div className="text-sm">
            <span className="theme-text-muted">Sending to: </span>
            <span className="theme-text font-medium">{userEmail}</span>
          </div>
        </div>
      )}

      {/* Frequency selection */}
      <div>
        <label className="block text-sm font-medium theme-text mb-3">Digest Frequency</label>
        <div className="grid grid-cols-3 gap-3">
          {(['daily', 'weekly', 'never'] as DigestFrequency[]).map((freq) => (
            <button
              key={freq}
              onClick={() => handleFrequencyChange(freq)}
              className={`p-3 rounded-lg border text-sm font-medium transition-all ${
                prefs.frequency === freq
                  ? 'bg-indigo-600 border-indigo-600 text-white'
                  : 'theme-text-secondary hover:border-indigo-500'
              }`}
              style={prefs.frequency !== freq ? { borderColor: 'var(--card-border)', backgroundColor: 'var(--card-bg)' } : undefined}
            >
              {freq === 'daily' && '📅 Daily'}
              {freq === 'weekly' && '📆 Weekly'}
              {freq === 'never' && '🔕 Never'}
            </button>
          ))}
        </div>
      </div>

      {/* Content preferences */}
      {prefs.frequency !== 'never' && (
        <div>
          <label className="block text-sm font-medium theme-text mb-3">Include in Digest</label>
          <div className="space-y-3">
            <ToggleOption
              checked={prefs.includeHotTopics}
              onChange={() => handleToggle('includeHotTopics')}
              icon={<Flame className="w-4 h-4 text-orange-500" />}
              label="Hot Topics"
              description="Most discussed and viewed proposals"
            />
            <ToggleOption
              checked={prefs.includeNewProposals}
              onChange={() => handleToggle('includeNewProposals')}
              icon={<Sparkles className="w-4 h-4 text-emerald-500" />}
              label="New Proposals"
              description="Recently created discussions"
            />
            <ToggleOption
              checked={prefs.includeKeywordMatches}
              onChange={() => handleToggle('includeKeywordMatches')}
              icon={<Bell className="w-4 h-4 text-sky-500" />}
              label="Keyword Alerts"
              description="Matches for your tracked keywords"
            />
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-3 pt-4 border-t" style={{ borderColor: 'var(--card-border)' }}>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 text-white font-medium rounded-lg transition-colors"
        >
          {isSaving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Check className="w-4 h-4" />
          )}
          Save Preferences
        </button>

        {prefs.frequency !== 'never' && userEmail && (
          <button
            onClick={handleSendTest}
            disabled={isSendingTest}
            className="flex items-center gap-2 px-4 py-2 font-medium rounded-lg transition-colors theme-text-secondary"
            style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--card-border)' }}
          >
            {isSendingTest ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            Send Test Email
          </button>
        )}
      </div>

      {/* Status messages */}
      {saveMessage && (
        <div className={`p-3 rounded-lg text-sm ${saveMessage.includes('Failed') ? 'bg-red-500/10 text-red-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
          {saveMessage}
        </div>
      )}
      {testMessage && (
        <div className={`p-3 rounded-lg text-sm ${testMessage.includes('Failed') ? 'bg-red-500/10 text-red-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
          {testMessage}
        </div>
      )}

      {/* Preview link */}
      {prefs.frequency !== 'never' && (
        <div className="text-sm theme-text-muted">
          <a 
            href="/api/digest?format=html&period=weekly" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-indigo-500 hover:text-indigo-400"
          >
            Preview digest email →
          </a>
        </div>
      )}
    </div>
  );
}

function ToggleOption({
  checked,
  onChange,
  icon,
  label,
  description,
}: {
  checked: boolean;
  onChange: () => void;
  icon: React.ReactNode;
  label: string;
  description: string;
}) {
  return (
    <button
      onClick={onChange}
      className="flex items-start gap-3 w-full p-3 rounded-lg text-left transition-all"
      style={{ 
        backgroundColor: checked ? 'rgba(99, 102, 241, 0.1)' : 'var(--card-bg)',
        border: `1px solid ${checked ? 'rgba(99, 102, 241, 0.3)' : 'var(--card-border)'}`,
      }}
    >
      <div className={`mt-0.5 w-5 h-5 rounded border flex items-center justify-center ${
        checked ? 'bg-indigo-600 border-indigo-600' : ''
      }`}
      style={!checked ? { borderColor: 'var(--card-border)' } : undefined}
      >
        {checked && <Check className="w-3 h-3 text-white" />}
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          {icon}
          <span className="font-medium theme-text">{label}</span>
        </div>
        <p className="text-sm theme-text-muted mt-0.5">{description}</p>
      </div>
    </button>
  );
}
