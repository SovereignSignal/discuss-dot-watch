import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy - discuss.watch',
  description: 'Privacy Policy for discuss.watch',
};

export default function PrivacyPage() {
  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: '48px 24px', color: '#e4e4e7' }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>Privacy Policy</h1>
      <p style={{ color: '#a1a1aa', marginBottom: 32 }}>Last updated: August 12, 2026</p>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>1. Information We Collect</h2>
        <p style={{ lineHeight: 1.7, color: '#a1a1aa' }}>
          <strong style={{ color: '#e4e4e7' }}>No accounts:</strong> discuss.watch does not require sign-in.
          Forum selections, keyword alerts, bookmarks, read/unread state, theme, and density preferences
          are stored in your browser (localStorage) only.
        </p>
        <p style={{ lineHeight: 1.7, color: '#a1a1aa', marginTop: 8 }}>
          <strong style={{ color: '#e4e4e7' }}>Usage data:</strong> We do not use third-party analytics trackers.
          Standard server logs may record IP addresses and request metadata for operational purposes.
        </p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>2. How We Use Your Information</h2>
        <p style={{ lineHeight: 1.7, color: '#a1a1aa' }}>
          Cached forum data is used to serve the public feed. Optional email briefs (if configured by
          operators) are generated from public forum content. We do not sell, rent, or share personal
          information with third parties for marketing purposes.
        </p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>3. Third-Party Services</h2>
        <p style={{ lineHeight: 1.7, color: '#a1a1aa' }}>
          We use the following third-party services that may process operational data:
        </p>
        <ul style={{ lineHeight: 1.7, color: '#a1a1aa', paddingLeft: 24, marginTop: 8 }}>
          <li><strong style={{ color: '#e4e4e7' }}>Anthropic (Claude)</strong> — generates AI summaries for digests (no personal data is sent)</li>
          <li><strong style={{ color: '#e4e4e7' }}>Resend</strong> — delivers operator-configured email briefs</li>
          <li><strong style={{ color: '#e4e4e7' }}>Railway</strong> — hosts our infrastructure (database, application server)</li>
        </ul>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>4. Data Storage & Security</h2>
        <p style={{ lineHeight: 1.7, color: '#a1a1aa' }}>
          Forum discussion data is cached in PostgreSQL (hosted on Railway) and Redis. Sensitive credentials
          (API keys for delegate monitoring) are encrypted with AES-256-GCM. All connections use TLS.
          Reader preferences stay in browser localStorage.
        </p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>5. Data Retention</h2>
        <p style={{ lineHeight: 1.7, color: '#a1a1aa' }}>
          Forum discussion data from public APIs is cached for up to 15 minutes and stored in our database
          for historical analysis. Browser-local preferences persist until you clear site data.
        </p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>6. Your Rights</h2>
        <p style={{ lineHeight: 1.7, color: '#a1a1aa' }}>
          You can delete bookmarks, alerts, and read state at any time through the Service or by clearing
          your browser storage. For other inquiries, contact us at the email below.
        </p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>7. Cookies</h2>
        <p style={{ lineHeight: 1.7, color: '#a1a1aa' }}>
          We use browser localStorage (not cookies) to store preferences. We do not set authentication cookies.
        </p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>8. Changes to This Policy</h2>
        <p style={{ lineHeight: 1.7, color: '#a1a1aa' }}>
          We may update this Privacy Policy from time to time. Changes will be posted on this page with
          an updated &quot;Last updated&quot; date.
        </p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>9. Contact</h2>
        <p style={{ lineHeight: 1.7, color: '#a1a1aa' }}>
          For privacy-related inquiries, contact us at{' '}
          <a href="mailto:sov@sovereignsignal.com" style={{ color: '#e4e4e7', textDecoration: 'underline' }}>
            sov@sovereignsignal.com
          </a>.
        </p>
      </section>
    </main>
  );
}
