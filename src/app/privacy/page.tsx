import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy - discuss.watch',
  description: 'Privacy Policy for discuss.watch',
};

export default function PrivacyPage() {
  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: '48px 24px', color: '#e4e4e7' }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>Privacy Policy</h1>
      <p style={{ color: '#a1a1aa', marginBottom: 32 }}>Last updated: February 27, 2026</p>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>1. Information We Collect</h2>
        <p style={{ lineHeight: 1.7, color: '#a1a1aa' }}>
          <strong style={{ color: '#e4e4e7' }}>Account data:</strong> When you sign in via Privy, we store your
          Privy DID (decentralized identifier), email address (if provided), and wallet address (if provided).
        </p>
        <p style={{ lineHeight: 1.7, color: '#a1a1aa', marginTop: 8 }}>
          <strong style={{ color: '#e4e4e7' }}>User preferences:</strong> Forum selections, keyword alerts,
          bookmarks, read/unread state, theme preference, onboarding status, and email digest settings.
        </p>
        <p style={{ lineHeight: 1.7, color: '#a1a1aa', marginTop: 8 }}>
          <strong style={{ color: '#e4e4e7' }}>Usage data:</strong> We do not use third-party analytics trackers.
          Standard server logs may record IP addresses and request metadata for operational purposes.
        </p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>2. How We Use Your Information</h2>
        <p style={{ lineHeight: 1.7, color: '#a1a1aa' }}>
          Your data is used to: provide personalized forum feeds, send email digests and keyword alert
          notifications, sync your preferences across devices, and improve the Service. We do not sell,
          rent, or share your personal information with third parties for marketing purposes.
        </p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>3. Third-Party Services</h2>
        <p style={{ lineHeight: 1.7, color: '#a1a1aa' }}>
          We use the following third-party services that may process your data:
        </p>
        <ul style={{ lineHeight: 1.7, color: '#a1a1aa', paddingLeft: 24, marginTop: 8 }}>
          <li><strong style={{ color: '#e4e4e7' }}>Privy</strong> — handles authentication and stores auth credentials</li>
          <li><strong style={{ color: '#e4e4e7' }}>Anthropic (Claude)</strong> — generates AI summaries for digests (no personal data is sent)</li>
          <li><strong style={{ color: '#e4e4e7' }}>Resend</strong> — delivers email digests to your email address</li>
          <li><strong style={{ color: '#e4e4e7' }}>Railway</strong> — hosts our infrastructure (database, application server)</li>
        </ul>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>4. Data Storage & Security</h2>
        <p style={{ lineHeight: 1.7, color: '#a1a1aa' }}>
          Data is stored in PostgreSQL (hosted on Railway) and Redis (for caching). Sensitive credentials
          (API keys for delegate monitoring) are encrypted with AES-256-GCM. All connections use TLS.
          Non-authenticated users store preferences in browser localStorage only.
        </p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>5. Data Retention</h2>
        <p style={{ lineHeight: 1.7, color: '#a1a1aa' }}>
          Account data is retained for as long as your account exists. Read state entries older than 90 days
          may be periodically cleaned up. Forum discussion data from public APIs is cached for up to 15 minutes
          and stored in our database for historical analysis.
        </p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>6. Your Rights</h2>
        <p style={{ lineHeight: 1.7, color: '#a1a1aa' }}>
          You may request access to, correction of, or deletion of your personal data by contacting us.
          You can delete your bookmarks, alerts, and read state at any time through the Service. To
          delete your account entirely, contact us at the email below.
        </p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>7. Cookies</h2>
        <p style={{ lineHeight: 1.7, color: '#a1a1aa' }}>
          We use browser localStorage (not cookies) to store preferences and session state. Privy may
          set cookies for authentication purposes.
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
