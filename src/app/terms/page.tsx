import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Service - discuss.watch',
  description: 'Terms of Service for discuss.watch',
};

export default function TermsPage() {
  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: '48px 24px', color: '#e4e4e7' }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>Terms of Service</h1>
      <p style={{ color: '#a1a1aa', marginBottom: 32 }}>Last updated: February 27, 2026</p>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>1. Acceptance of Terms</h2>
        <p style={{ lineHeight: 1.7, color: '#a1a1aa' }}>
          By accessing or using discuss.watch (&quot;the Service&quot;), you agree to be bound by these Terms of Service.
          If you do not agree, do not use the Service.
        </p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>2. Description of Service</h2>
        <p style={{ lineHeight: 1.7, color: '#a1a1aa' }}>
          discuss.watch aggregates and displays publicly available discussions from community forums across
          crypto governance, AI/ML, and open source ecosystems. The Service provides email digests, keyword
          alerts, bookmarking, and read/unread tracking. Forum content is fetched from public APIs and displayed
          as-is; we do not host or modify user-generated forum content.
        </p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>3. Accounts & Authentication</h2>
        <p style={{ lineHeight: 1.7, color: '#a1a1aa' }}>
          Authentication is handled by Privy. By signing in, you consent to Privy processing your authentication
          credentials (email or wallet address) subject to their privacy policy. We store your Privy DID, email
          address (if provided), and wallet address to maintain your account.
        </p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>4. Data Collection</h2>
        <p style={{ lineHeight: 1.7, color: '#a1a1aa' }}>
          We collect: email addresses (for digests), Privy DIDs (for account identity), reading behavior
          (bookmarks, read/unread state, keyword alerts), and forum preferences. This data is used solely to
          provide the Service. We do not sell personal data. See our{' '}
          <a href="/privacy" style={{ color: '#e4e4e7', textDecoration: 'underline' }}>Privacy Policy</a> for details.
        </p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>5. Third-Party Services</h2>
        <p style={{ lineHeight: 1.7, color: '#a1a1aa' }}>
          The Service relies on third-party providers: Privy (authentication), Anthropic Claude (AI-generated
          digest summaries), and Resend (email delivery). Your use of these services is subject to their
          respective terms and privacy policies.
        </p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>6. Acceptable Use</h2>
        <p style={{ lineHeight: 1.7, color: '#a1a1aa' }}>
          You agree not to: abuse API rate limits, attempt to access admin endpoints without authorization,
          scrape the Service for commercial purposes, or interfere with the Service&apos;s operation.
        </p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>7. Disclaimer</h2>
        <p style={{ lineHeight: 1.7, color: '#a1a1aa' }}>
          The Service is provided &quot;as is&quot; without warranties of any kind. Forum content is sourced from
          third-party platforms and may be inaccurate or outdated. AI-generated summaries are for informational
          purposes only and should not be relied upon for financial or governance decisions.
        </p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>8. Modifications</h2>
        <p style={{ lineHeight: 1.7, color: '#a1a1aa' }}>
          We may update these Terms at any time. Continued use of the Service after changes constitutes
          acceptance of the new Terms. Material changes will be communicated via the Service or email.
        </p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>9. Contact</h2>
        <p style={{ lineHeight: 1.7, color: '#a1a1aa' }}>
          Questions about these Terms? Contact us at{' '}
          <a href="mailto:sov@sovereignsignal.com" style={{ color: '#e4e4e7', textDecoration: 'underline' }}>
            sov@sovereignsignal.com
          </a>.
        </p>
      </section>
    </main>
  );
}
