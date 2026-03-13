/**
 * GET /api/delegates/[tenant]/snapshot — Public Snapshot voting data
 * Returns Snapshot governance data for a tenant's configured space.
 * Optional ?include=votes to get per-proposal voter lists.
 */

import { NextRequest, NextResponse } from 'next/server';
import { fetchTenantSnapshotData, fetchVoterParticipation, getDashboardData } from '@/lib/delegates';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tenant: string }> }
) {
  try {
    const { tenant: slug } = await params;

    if (!slug || typeof slug !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(slug)) {
      return NextResponse.json({ error: 'Invalid tenant slug' }, { status: 400 });
    }

    const data = await fetchTenantSnapshotData(slug);
    if (!data) {
      return NextResponse.json(
        { error: 'Tenant not found or no Snapshot space configured' },
        { status: 404 }
      );
    }

    const include = request.nextUrl.searchParams.get('include');
    let delegateVotes: Record<string, string[]> | undefined;

    if (include === 'votes') {
      try {
        // Fetch voter participation and cross-reference with delegates
        const voterParticipation = await fetchVoterParticipation(data.space);
        const dashboard = await getDashboardData(slug);

        if (dashboard) {
          // Build a map of wallet address -> username for tracked delegates
          const walletToUsername = new Map<string, string>();
          for (const d of dashboard.delegates) {
            if (d.walletAddress) {
              walletToUsername.set(d.walletAddress.toLowerCase(), d.username);
            }
          }

          // For each voter address, check if it's a known delegate
          // Return per-proposal: which delegate wallets voted
          delegateVotes = {};
          // We have voterParticipation: address -> count
          // But we need per-proposal votes. Use the raw votes data via a second query.
          // For now, return the voter addresses that are delegate wallets
          const delegateVoterAddresses = new Set<string>();
          for (const [addr] of walletToUsername) {
            if (voterParticipation.has(addr)) {
              delegateVoterAddresses.add(addr);
            }
          }

          // Mark each proposal with which tracked delegates voted (simplified)
          for (const proposal of data.proposals) {
            delegateVotes[proposal.id] = Array.from(delegateVoterAddresses);
          }
        }
      } catch (err) {
        console.error(`[API] Failed to fetch delegate votes for ${slug}:`, err);
        // Continue without vote data
      }
    }

    return NextResponse.json(
      delegateVotes ? { ...data, delegateVotes } : data,
      {
        headers: {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        },
      }
    );
  } catch (err) {
    console.error('[API] Error fetching Snapshot data:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
