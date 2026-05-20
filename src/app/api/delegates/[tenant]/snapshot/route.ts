/**
 * GET /api/delegates/[tenant]/snapshot — Public Snapshot voting data
 * Returns Snapshot governance data for a tenant's configured space.
 * Optional ?include=votes to get per-proposal voter lists.
 */

import { NextRequest, NextResponse } from 'next/server';
import { fetchTenantSnapshotData, fetchProposalVoters, getDashboardData } from '@/lib/delegates';

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
        const [proposalVoters, dashboard] = await Promise.all([
          fetchProposalVoters(data.space),
          getDashboardData(slug),
        ]);

        if (dashboard) {
          // Set of all tracked delegate wallet addresses (lowercased)
          const delegateWallets = new Set<string>();
          for (const d of dashboard.delegates) {
            if (d.walletAddress) {
              delegateWallets.add(d.walletAddress.toLowerCase());
            }
          }

          // For each proposal, return only the delegate wallets that actually
          // voted on THAT proposal (intersection of proposal voters and delegate wallets).
          delegateVotes = {};
          for (const proposal of data.proposals) {
            const voters = proposalVoters.get(proposal.id);
            if (!voters || delegateWallets.size === 0) {
              delegateVotes[proposal.id] = [];
              continue;
            }
            const matched: string[] = [];
            for (const wallet of delegateWallets) {
              if (voters.has(wallet)) matched.push(wallet);
            }
            delegateVotes[proposal.id] = matched;
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
