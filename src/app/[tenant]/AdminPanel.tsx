'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import {
  X,
  ArrowLeft,
  Search,
  CheckCircle2,
  Trash2,
  Plus,
  Loader2,
  Settings,
  Users,
  MessageSquare,
} from 'lucide-react';
import type { DelegateDashboard, FeaturedThread } from '@/types/delegates';
import type { c } from '@/lib/theme';
import { useAuth } from '@/components/AuthProvider';

type Tab = 'verified' | 'featured';

export default function AdminPanel({
  dashboard,
  slug,
  isDark,
  isMobile,
  featuredThreads,
  onClose,
  onUpdate,
  t,
}: {
  dashboard: DelegateDashboard;
  slug: string;
  isDark: boolean;
  isMobile: boolean;
  featuredThreads: FeaturedThread[];
  onClose: () => void;
  onUpdate: () => void;
  t: ReturnType<typeof c>;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const { getAccessToken } = useAuth();

  const [activeTab, setActiveTab] = useState<Tab>('verified');
  const [searchQuery, setSearchQuery] = useState('');

  // Verified delegates state
  const [toggleLoading, setToggleLoading] = useState<Set<string>>(new Set());
  const [localVerified, setLocalVerified] = useState<Map<string, boolean>>(() => {
    const m = new Map<string, boolean>();
    for (const d of dashboard.delegates) {
      if (d.verifiedStatus) m.set(d.username, true);
    }
    return m;
  });

  // Featured threads state
  const [newTopicId, setNewTopicId] = useState('');
  const [featuredLoading, setFeaturedLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync localVerified when dashboard changes
  useEffect(() => {
    const m = new Map<string, boolean>();
    for (const d of dashboard.delegates) {
      if (d.verifiedStatus) m.set(d.username, true);
    }
    setLocalVerified(m);
  }, [dashboard]);

  // Accessibility: Escape key, focus trap, scroll lock
  useEffect(() => {
    previousActiveElement.current = document.activeElement as HTMLElement;

    const panel = panelRef.current;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCloseRef.current();
        return;
      }
      if (e.key === 'Tab' && panel) {
        const focusable = panel.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const closeBtn = panel?.querySelector<HTMLButtonElement>('[data-close-button]');
    closeBtn?.focus();

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;
      previousActiveElement.current?.focus();
    };
  }, []);

  // Filtered contributor list
  const filteredDelegates = useMemo(() => {
    if (!searchQuery) return dashboard.delegates;
    const q = searchQuery.toLowerCase();
    return dashboard.delegates.filter(
      (d) =>
        d.displayName.toLowerCase().includes(q) ||
        d.username.toLowerCase().includes(q)
    );
  }, [dashboard.delegates, searchQuery]);

  const verifiedCount = useMemo(() => {
    let count = 0;
    for (const v of localVerified.values()) {
      if (v) count++;
    }
    return count;
  }, [localVerified]);

  async function handleToggleVerified(username: string, displayName: string, currentlyVerified: boolean) {
    const newVerified = !currentlyVerified;
    setToggleLoading((prev) => new Set(prev).add(username));
    setError(null);

    try {
      const token = await getAccessToken();
      if (!token) {
        setError('Not authenticated. Please log in.');
        return;
      }

      const res = await fetch('/api/delegates/admin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: 'upsert-delegate',
          tenantSlug: slug,
          delegate: {
            username,
            displayName,
            verifiedStatus: newVerified,
          },
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || `Failed (${res.status})`);
        return;
      }

      setLocalVerified((prev) => {
        const next = new Map(prev);
        if (newVerified) {
          next.set(username, true);
        } else {
          next.delete(username);
        }
        return next;
      });
      onUpdate();
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setToggleLoading((prev) => {
        const next = new Set(prev);
        next.delete(username);
        return next;
      });
    }
  }

  /** Fetch current tenant config from admin API to avoid overwriting fields we don't manage here. */
  async function fetchCurrentConfig(token: string): Promise<Record<string, unknown> | null> {
    try {
      const res = await fetch(`/api/delegates/admin?tenant=${slug}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return null;
      // The admin GET with ?tenant= returns { delegates }, but we need the tenant config.
      // Fall back: fetch from the super admin list endpoint.
      const listRes = await fetch('/api/delegates/admin', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!listRes.ok) return null;
      const listData = await listRes.json();
      const tenant = listData.tenants?.find((t: { slug: string }) => t.slug === slug);
      return tenant?.config ?? null;
    } catch {
      return null;
    }
  }

  async function updateFeaturedTopicIds(newIds: number[]) {
    setFeaturedLoading(true);
    setError(null);

    try {
      const token = await getAccessToken();
      if (!token) {
        setError('Not authenticated. Please log in.');
        return;
      }

      // Fetch current config to merge, so we don't overwrite other fields
      const currentConfig = await fetchCurrentConfig(token);
      const mergedConfig = { ...(currentConfig || {}), featuredTopicIds: newIds };

      const res = await fetch('/api/delegates/admin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: 'update-tenant',
          tenantSlug: slug,
          config: mergedConfig,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || `Failed (${res.status})`);
        return;
      }

      onUpdate();
      return true;
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setFeaturedLoading(false);
    }
  }

  async function handleAddFeaturedTopic() {
    const id = parseInt(newTopicId, 10);
    if (!id || id <= 0) {
      setError('Please enter a valid topic ID (positive integer).');
      return;
    }

    const currentIds = dashboard.tenant.featuredTopicIds || [];
    if (currentIds.includes(id)) {
      setError('This topic ID is already featured.');
      return;
    }
    if (currentIds.length >= 10) {
      setError('Maximum 10 featured topics allowed.');
      return;
    }

    const success = await updateFeaturedTopicIds([...currentIds, id]);
    if (success) setNewTopicId('');
  }

  async function handleRemoveFeaturedTopic(topicId: number) {
    const currentIds = dashboard.tenant.featuredTopicIds || [];
    await updateFeaturedTopicIds(currentIds.filter((id) => id !== topicId));
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        aria-hidden="true"
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.4)',
          zIndex: 40,
        }}
      />
      {/* Panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Admin settings panel"
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: '100%',
          maxWidth: isMobile ? undefined : 560,
          background: t.bg,
          borderLeft: isMobile ? undefined : `1px solid ${t.border}`,
          zIndex: 50,
          overflowY: 'auto',
          boxShadow: isMobile ? undefined : '-4px 0 24px rgba(0,0,0,0.2)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: isMobile ? '12px 16px' : '16px 20px',
            borderBottom: `1px solid ${t.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            position: 'sticky',
            top: 0,
            background: t.bg,
            zIndex: 2,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {isMobile && (
              <button
                data-close-button
                aria-label="Go back"
                onClick={onClose}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: t.fgMuted,
                  padding: 4,
                  marginRight: 2,
                }}
              >
                <ArrowLeft size={18} />
              </button>
            )}
            <Settings size={18} style={{ color: t.fgMuted }} />
            <span style={{ fontWeight: 600, fontSize: 15 }}>Admin Settings</span>
          </div>
          {!isMobile && (
            <button
              data-close-button
              aria-label="Close"
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: t.fgMuted,
                padding: 4,
              }}
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* Tabs */}
        <div
          style={{
            display: 'flex',
            borderBottom: `1px solid ${t.border}`,
            position: 'sticky',
            top: isMobile ? 50 : 57,
            background: t.bg,
            zIndex: 2,
          }}
        >
          <TabButton
            active={activeTab === 'verified'}
            onClick={() => { setActiveTab('verified'); setError(null); }}
            icon={<Users size={14} />}
            label="Verified Delegates"
            t={t}
          />
          <TabButton
            active={activeTab === 'featured'}
            onClick={() => { setActiveTab('featured'); setError(null); }}
            icon={<MessageSquare size={14} />}
            label="Featured Threads"
            t={t}
          />
        </div>

        {/* Error banner */}
        {error && (
          <div
            style={{
              margin: '12px 16px 0',
              padding: '10px 14px',
              borderRadius: 8,
              background: isDark ? 'rgba(239,68,68,0.1)' : 'rgba(239,68,68,0.08)',
              border: `1px solid ${isDark ? 'rgba(239,68,68,0.25)' : 'rgba(239,68,68,0.3)'}`,
              color: isDark ? '#fca5a5' : '#dc2626',
              fontSize: 13,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span>{error}</span>
            <button
              onClick={() => setError(null)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 2 }}
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* Tab Content */}
        <div style={{ flex: 1, overflow: 'auto' }}>
          {activeTab === 'verified' ? (
            <VerifiedDelegatesTab
              delegates={filteredDelegates}
              localVerified={localVerified}
              toggleLoading={toggleLoading}
              onToggle={handleToggleVerified}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              verifiedCount={verifiedCount}
              totalCount={dashboard.delegates.length}
              t={t}
              isMobile={isMobile}
            />
          ) : (
            <FeaturedThreadsTab
              featuredThreads={featuredThreads}
              featuredTopicIds={dashboard.tenant.featuredTopicIds || []}
              newTopicId={newTopicId}
              onNewTopicIdChange={setNewTopicId}
              onAdd={handleAddFeaturedTopic}
              onRemove={handleRemoveFeaturedTopic}
              loading={featuredLoading}
              t={t}
            />
          )}
        </div>
      </div>
    </>
  );
}

// --- Tab Button ---

function TabButton({
  active,
  onClick,
  icon,
  label,
  t,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  t: ReturnType<typeof c>;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        padding: '12px 16px',
        fontSize: 13,
        fontWeight: 500,
        border: 'none',
        borderBottom: active ? `2px solid ${t.fg}` : '2px solid transparent',
        cursor: 'pointer',
        background: 'transparent',
        color: active ? t.fg : t.fgDim,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        transition: 'color 0.15s, border-color 0.15s',
      }}
    >
      {icon}
      {label}
    </button>
  );
}

// --- Verified Delegates Tab ---

function VerifiedDelegatesTab({
  delegates,
  localVerified,
  toggleLoading,
  onToggle,
  searchQuery,
  onSearchChange,
  verifiedCount,
  totalCount,
  t,
  isMobile,
}: {
  delegates: DelegateDashboard['delegates'];
  localVerified: Map<string, boolean>;
  toggleLoading: Set<string>;
  onToggle: (username: string, displayName: string, currentlyVerified: boolean) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  verifiedCount: number;
  totalCount: number;
  t: ReturnType<typeof c>;
  isMobile: boolean;
}) {
  return (
    <div style={{ padding: isMobile ? '12px 16px' : '16px 20px' }}>
      {/* Count badge */}
      <div
        style={{
          fontSize: 12,
          color: t.fgDim,
          marginBottom: 12,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <CheckCircle2 size={13} style={{ color: '#22c55e' }} />
        {verifiedCount} of {totalCount} verified
      </div>

      {/* Search */}
      <div style={{ position: 'relative', marginBottom: 16 }}>
        <Search
          size={14}
          style={{
            position: 'absolute',
            left: 10,
            top: '50%',
            transform: 'translateY(-50%)',
            color: t.fgDim,
          }}
        />
        <input
          type="text"
          placeholder="Search contributors..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          style={{
            width: '100%',
            padding: '8px 12px 8px 32px',
            borderRadius: 8,
            border: `1px solid ${t.border}`,
            background: t.bgInput,
            color: t.fg,
            fontSize: 13,
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />
      </div>

      {/* Delegate list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {delegates.length === 0 ? (
          <div style={{ padding: 20, textAlign: 'center', color: t.fgDim, fontSize: 13 }}>
            No contributors found.
          </div>
        ) : (
          delegates.map((d) => {
            const isVerified = localVerified.get(d.username) ?? false;
            const isLoading = toggleLoading.has(d.username);
            return (
              <div
                key={d.username}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '8px 10px',
                  borderRadius: 8,
                  transition: 'background 0.1s',
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = t.bgSubtle; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
              >
                {/* Avatar */}
                {d.avatarUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={d.avatarUrl} alt="" width={28} height={28} style={{ borderRadius: '50%', flexShrink: 0 }} />
                ) : (
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      background: t.bgActive,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 12,
                      fontWeight: 600,
                      flexShrink: 0,
                    }}
                  >
                    {d.displayName?.[0] || '?'}
                  </div>
                )}

                {/* Name / username */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {d.displayName}
                  </div>
                  <div style={{ fontSize: 11, color: t.fgDim }}>@{d.username}</div>
                </div>

                {/* Toggle */}
                <button
                  onClick={() => onToggle(d.username, d.displayName, isVerified)}
                  disabled={isLoading}
                  aria-label={isVerified ? `Remove verified status from ${d.displayName}` : `Verify ${d.displayName}`}
                  style={{
                    width: 40,
                    height: 22,
                    borderRadius: 11,
                    border: 'none',
                    cursor: isLoading ? 'wait' : 'pointer',
                    background: isVerified ? '#22c55e' : t.bgActive,
                    position: 'relative',
                    transition: 'background 0.2s',
                    flexShrink: 0,
                    opacity: isLoading ? 0.6 : 1,
                  }}
                >
                  {isLoading ? (
                    <Loader2
                      size={12}
                      style={{
                        position: 'absolute',
                        top: 5,
                        left: 14,
                        animation: 'spin 1s linear infinite',
                        color: isVerified ? '#fff' : t.fgDim,
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: 16,
                        height: 16,
                        borderRadius: '50%',
                        background: '#fff',
                        position: 'absolute',
                        top: 3,
                        left: isVerified ? 21 : 3,
                        transition: 'left 0.2s',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                      }}
                    />
                  )}
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* Spin keyframe */}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// --- Featured Threads Tab ---

function FeaturedThreadsTab({
  featuredThreads,
  featuredTopicIds,
  newTopicId,
  onNewTopicIdChange,
  onAdd,
  onRemove,
  loading,
  t,
}: {
  featuredThreads: FeaturedThread[];
  featuredTopicIds: number[];
  newTopicId: string;
  onNewTopicIdChange: (v: string) => void;
  onAdd: () => void;
  onRemove: (topicId: number) => void;
  loading: boolean;
  t: ReturnType<typeof c>;
}) {
  return (
    <div style={{ padding: '16px 20px' }}>
      <div style={{ fontSize: 12, color: t.fgDim, marginBottom: 16 }}>
        {featuredTopicIds.length} of 10 slots used
      </div>

      {/* Current featured threads */}
      {featuredTopicIds.length === 0 ? (
        <div style={{ padding: 20, textAlign: 'center', color: t.fgDim, fontSize: 13 }}>
          No featured threads yet. Add a Discourse topic ID below.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
          {featuredTopicIds.map((topicId) => {
            const thread = featuredThreads.find((ft) => ft.topicId === topicId);
            return (
              <div
                key={topicId}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 12px',
                  borderRadius: 8,
                  border: `1px solid ${t.border}`,
                  background: t.bgSubtle,
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {thread?.title || `Topic #${topicId}`}
                  </div>
                  <div style={{ fontSize: 11, color: t.fgDim }}>
                    ID: {topicId}
                    {thread && ` · ${thread.replyCount} replies · ${thread.views} views`}
                  </div>
                </div>
                <button
                  onClick={() => onRemove(topicId)}
                  disabled={loading}
                  aria-label={`Remove topic ${topicId}`}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: loading ? 'wait' : 'pointer',
                    color: '#ef4444',
                    padding: 4,
                    flexShrink: 0,
                    opacity: loading ? 0.5 : 1,
                  }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Add new topic */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input
          type="number"
          placeholder="Topic ID"
          value={newTopicId}
          onChange={(e) => onNewTopicIdChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') onAdd(); }}
          min={1}
          style={{
            flex: 1,
            padding: '8px 12px',
            borderRadius: 8,
            border: `1px solid ${t.border}`,
            background: t.bgInput,
            color: t.fg,
            fontSize: 13,
            outline: 'none',
          }}
        />
        <button
          onClick={onAdd}
          disabled={loading || !newTopicId}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: '8px 14px',
            borderRadius: 8,
            border: 'none',
            background: t.fg,
            color: t.bg,
            fontSize: 13,
            fontWeight: 500,
            cursor: loading || !newTopicId ? 'not-allowed' : 'pointer',
            opacity: loading || !newTopicId ? 0.5 : 1,
          }}
        >
          {loading ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Plus size={14} />}
          Add
        </button>
      </div>

      <div style={{ fontSize: 11, color: t.fgDim, marginTop: 8 }}>
        Enter a Discourse topic ID to feature it on the dashboard overview.
      </div>
    </div>
  );
}
