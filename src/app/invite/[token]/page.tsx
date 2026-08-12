'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';

export default function InvitePage() {
  const { token } = useParams();

  const [invite, setInvite] = useState<{ tenantName: string; tenantSlug: string; isExpired: boolean; isClaimed: boolean } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const res = await fetch(`/api/delegates/invite/${token}`);
        if (!res.ok) {
          const data = await res.json();
          setError(data.error || 'Invite not found');
          return;
        }
        setInvite(await res.json());
      } catch {
        setError('Failed to load invite');
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const bg = 'var(--ds-bg-base)';
  const cardBg = 'var(--ds-bg-card)';
  const cardBorder = 'var(--ds-border)';
  const textPrimary = 'var(--ds-fg)';
  const textSecondary = 'var(--ds-fg-muted)';
  const textMuted = 'var(--ds-fg-dim)';

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: bg }}>
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: textMuted }} />
      </div>
    );
  }

  if (error || !invite) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: bg }}>
        <div className="rounded-xl p-8 max-w-md text-center" style={{ backgroundColor: cardBg, border: `1px solid ${cardBorder}` }}>
          <XCircle className="w-10 h-10 mx-auto mb-4" style={{ color: '#ef4444' }} />
          <h1 className="text-lg font-semibold mb-2" style={{ color: textPrimary }}>Invalid Invite</h1>
          <p className="text-sm" style={{ color: textSecondary }}>{error || 'This invite link is not valid.'}</p>
        </div>
      </div>
    );
  }

  if (invite.isExpired) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: bg }}>
        <div className="rounded-xl p-8 max-w-md text-center" style={{ backgroundColor: cardBg, border: `1px solid ${cardBorder}` }}>
          <XCircle className="w-10 h-10 mx-auto mb-4" style={{ color: '#f59e0b' }} />
          <h1 className="text-lg font-semibold mb-2" style={{ color: textPrimary }}>Invite Expired</h1>
          <p className="text-sm" style={{ color: textSecondary }}>This invite link for <strong>{invite.tenantName}</strong> has expired.</p>
        </div>
      </div>
    );
  }

  if (invite.isClaimed) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: bg }}>
        <div className="rounded-xl p-8 max-w-md text-center" style={{ backgroundColor: cardBg, border: `1px solid ${cardBorder}` }}>
          <CheckCircle className="w-10 h-10 mx-auto mb-4" style={{ color: textMuted }} />
          <h1 className="text-lg font-semibold mb-2" style={{ color: textPrimary }}>Already Claimed</h1>
          <p className="text-sm" style={{ color: textSecondary }}>This invite has already been used.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: bg }}>
      <div className="rounded-xl p-8 max-w-md text-center" style={{ backgroundColor: cardBg, border: `1px solid ${cardBorder}` }}>
        <h1 className="text-lg font-semibold mb-2" style={{ color: textPrimary }}>Admin Invite</h1>
        <p className="text-sm mb-6" style={{ color: textSecondary }}>
          Tenant admin invites required user accounts, which discuss.watch no longer uses.
          Open the <strong>{invite.tenantName}</strong> dashboard directly, or sign in to the
          admin panel with the platform admin secret.
        </p>
        <div className="flex flex-col gap-2">
          <Link
            href={`/${invite.tenantSlug}`}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg"
            style={{ backgroundColor: 'var(--ds-fg)', color: 'var(--ds-bg-base)' }}
          >
            Open {invite.tenantName}
          </Link>
          <Link
            href="/admin"
            className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg"
            style={{ backgroundColor: 'var(--ds-bg-elev)', color: 'var(--ds-fg)' }}
          >
            Admin panel
          </Link>
        </div>
      </div>
    </div>
  );
}
