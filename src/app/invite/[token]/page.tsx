'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { Loader2, CheckCircle, XCircle, LogIn } from 'lucide-react';

export default function InvitePage() {
  const { token } = useParams();
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading, login, getAccessToken } = useAuth();

  const [invite, setInvite] = useState<{ tenantName: string; tenantSlug: string; isExpired: boolean; isClaimed: boolean } | null>(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Fetch invite info
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

  // Auto-claim when user is authenticated
  useEffect(() => {
    if (!isAuthenticated || !invite || invite.isExpired || invite.isClaimed || claiming || success) return;

    (async () => {
      setClaiming(true);
      try {
        const accessToken = await getAccessToken();
        if (!accessToken) {
          setError('Failed to get authentication token');
          return;
        }

        const res = await fetch(`/api/delegates/invite/${token}`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        const data = await res.json();
        if (!res.ok) {
          setError(data.error || 'Failed to claim invite');
          return;
        }

        setSuccess(true);
        setTimeout(() => router.push(data.redirectUrl || `/${invite.tenantSlug}`), 1500);
      } catch {
        setError('Failed to claim invite');
      } finally {
        setClaiming(false);
      }
    })();
  }, [isAuthenticated, invite, token, getAccessToken, router, claiming, success]);

  const isDark = typeof window !== 'undefined' && localStorage.getItem('discuss-watch-theme') !== 'light';
  const bg = isDark ? '#000000' : '#f5f5f5';
  const cardBg = isDark ? '#18181b' : '#ffffff';
  const cardBorder = isDark ? '#27272a' : 'rgba(0,0,0,0.08)';
  const textPrimary = isDark ? '#ffffff' : '#09090b';
  const textSecondary = isDark ? '#e5e5e5' : '#3f3f46';
  const textMuted = isDark ? '#a3a3a3' : '#52525b';

  if (loading || authLoading) {
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
          <p className="text-sm" style={{ color: textSecondary }}>This invite link for <strong>{invite.tenantName}</strong> has expired. Please request a new one.</p>
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

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: bg }}>
        <div className="rounded-xl p-8 max-w-md text-center" style={{ backgroundColor: cardBg, border: `1px solid ${cardBorder}` }}>
          <CheckCircle className="w-10 h-10 mx-auto mb-4" style={{ color: '#22c55e' }} />
          <h1 className="text-lg font-semibold mb-2" style={{ color: textPrimary }}>Welcome!</h1>
          <p className="text-sm" style={{ color: textSecondary }}>You&apos;re now an admin for <strong>{invite.tenantName}</strong>. Redirecting...</p>
        </div>
      </div>
    );
  }

  if (claiming) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: bg }}>
        <div className="rounded-xl p-8 max-w-md text-center" style={{ backgroundColor: cardBg, border: `1px solid ${cardBorder}` }}>
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" style={{ color: textMuted }} />
          <h1 className="text-lg font-semibold mb-2" style={{ color: textPrimary }}>Claiming invite...</h1>
        </div>
      </div>
    );
  }

  // Not authenticated — show login prompt
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: bg }}>
      <div className="rounded-xl p-8 max-w-md text-center" style={{ backgroundColor: cardBg, border: `1px solid ${cardBorder}` }}>
        <h1 className="text-lg font-semibold mb-2" style={{ color: textPrimary }}>Admin Invite</h1>
        <p className="text-sm mb-6" style={{ color: textSecondary }}>
          You&apos;ve been invited to manage <strong>{invite.tenantName}</strong> on discuss.watch. Log in to accept.
        </p>
        <button onClick={login}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg"
          style={{ backgroundColor: isDark ? '#ffffff' : '#18181b', color: isDark ? '#09090b' : '#fafafa' }}>
          <LogIn className="w-4 h-4" />
          Log in to accept
        </button>
      </div>
    </div>
  );
}
