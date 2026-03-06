/**
 * Embeddable governance widget page
 * Rendered in an iframe — lightweight, minimal chrome, no navigation.
 * URL: /[tenant]/embed
 */

import { notFound } from 'next/navigation';
import { getDashboardData, fetchTenantSnapshotData } from '@/lib/delegates';
import { initializeDelegateSchema } from '@/lib/delegates';

export const dynamic = 'force-dynamic';

export default async function EmbedPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;

  if (!slug || !/^[a-zA-Z0-9_-]{1,100}$/.test(slug)) {
    notFound();
  }

  await initializeDelegateSchema();

  const [dashboard, snapshot] = await Promise.allSettled([
    getDashboardData(slug, { trackedOnly: false }),
    fetchTenantSnapshotData(slug),
  ]);

  const dashData = dashboard.status === 'fulfilled' ? dashboard.value : null;
  const snapData = snapshot.status === 'fulfilled' ? snapshot.value : null;

  if (!dashData) {
    notFound();
  }

  const branding = dashData.tenant.branding;
  const accent = branding?.accentColor || '#3b82f6';
  const s = dashData.summary;

  return (
    <html>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{dashData.tenant.name} — Governance Widget</title>
        <style dangerouslySetInnerHTML={{ __html: `
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #09090b;
            color: #fafafa;
            padding: 16px;
            font-size: 13px;
          }
          .widget {
            border: 1px solid #27272a;
            border-radius: 12px;
            padding: 16px;
            background: #18181b;
          }
          .header {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 12px;
          }
          .header h2 {
            font-size: 14px;
            font-weight: 600;
          }
          .badge {
            font-size: 10px;
            padding: 2px 6px;
            border-radius: 4px;
            background: ${accent}22;
            color: ${accent};
            border: 1px solid ${accent}44;
          }
          .stats {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 8px;
            margin-bottom: 12px;
          }
          .stat {
            padding: 8px;
            border-radius: 8px;
            background: rgba(255,255,255,0.04);
          }
          .stat-value {
            font-size: 20px;
            font-weight: 700;
            color: ${accent};
          }
          .stat-label {
            font-size: 11px;
            color: #a1a1aa;
            margin-top: 2px;
          }
          .footer {
            text-align: center;
            padding-top: 8px;
            border-top: 1px solid #27272a;
          }
          .footer a {
            color: #a1a1aa;
            text-decoration: none;
            font-size: 11px;
          }
          .footer a:hover { color: #fafafa; }
        `}} />
      </head>
      <body>
        <div className="widget">
          <div className="header">
            <h2>{dashData.tenant.name}</h2>
            <span className="badge">Governance</span>
          </div>

          <div className="stats">
            <div className="stat">
              <div className="stat-value">{s.totalDelegates}</div>
              <div className="stat-label">Contributors</div>
            </div>
            <div className="stat">
              <div className="stat-value">{s.delegatesPostedLast30Days}</div>
              <div className="stat-label">Active (30d)</div>
            </div>
            {snapData && (
              <>
                <div className="stat">
                  <div className="stat-value">{snapData.activeProposals}</div>
                  <div className="stat-label">Active Proposals</div>
                </div>
                <div className="stat">
                  <div className="stat-value">{snapData.avgVoterParticipation}</div>
                  <div className="stat-label">Avg Voters</div>
                </div>
              </>
            )}
          </div>

          <div className="footer">
            <a
              href={`https://discuss.watch/${dashData.tenant.slug}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Powered by discuss.watch
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
