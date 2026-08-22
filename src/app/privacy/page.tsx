import type { Metadata } from 'next';
import { LegalDocument, LegalSection } from '@/components/LegalDocument';

export const metadata: Metadata = {
  title: 'Privacy Policy - discuss.watch',
  description: 'Privacy Policy for discuss.watch',
};

export default function PrivacyPage() {
  return (
    <LegalDocument kicker="Legal" title="Privacy Policy" updated="August 12, 2026">
      <LegalSection title="1. Information We Collect">
        <p>
          <strong style={{ color: 'var(--ds-fg)' }}>No accounts:</strong> discuss.watch does not require sign-in.
          Forum selections, keyword alerts, bookmarks, read/unread state, theme, and density preferences
          are stored in your browser (localStorage) only.
        </p>
        <p>
          <strong style={{ color: 'var(--ds-fg)' }}>Usage data:</strong> We do not use third-party analytics trackers.
          Standard server logs may record IP addresses and request metadata for operational purposes.
        </p>
      </LegalSection>

      <LegalSection title="2. How We Use Your Information">
        <p>
          Cached forum data is used to serve the public feed. Optional email briefs (if configured by
          operators) are generated from public forum content. We do not sell, rent, or share personal
          information with third parties for marketing purposes.
        </p>
      </LegalSection>

      <LegalSection title="3. Third-Party Services">
        <p>We use the following third-party services that may process operational data:</p>
        <ul className="list-disc pl-5">
          <li><strong style={{ color: 'var(--ds-fg)' }}>Anthropic (Claude)</strong> — generates AI summaries for digests (no personal data is sent)</li>
          <li><strong style={{ color: 'var(--ds-fg)' }}>Resend</strong> — delivers operator-configured email briefs</li>
          <li><strong style={{ color: 'var(--ds-fg)' }}>Railway</strong> — hosts our infrastructure (database, application server)</li>
        </ul>
      </LegalSection>

      <LegalSection title="4. Data Storage &amp; Security">
        <p>
          Forum discussion data is cached in PostgreSQL (hosted on Railway) and Redis. Sensitive credentials
          (API keys for delegate monitoring) are encrypted with AES-256-GCM. All connections use TLS.
          Reader preferences stay in browser localStorage.
        </p>
      </LegalSection>

      <LegalSection title="5. Data Retention">
        <p>
          Forum discussion data from public APIs is cached for up to 15 minutes and stored in our database
          for historical analysis. Browser-local preferences persist until you clear site data.
        </p>
      </LegalSection>

      <LegalSection title="6. Your Rights">
        <p>
          You can delete bookmarks, alerts, and read state at any time through the Service or by clearing
          your browser storage. For other inquiries, contact us at the email below.
        </p>
      </LegalSection>

      <LegalSection title="7. Cookies">
        <p>
          We use browser localStorage (not cookies) to store preferences. We do not set authentication cookies.
        </p>
      </LegalSection>

      <LegalSection title="8. Changes to This Policy">
        <p>
          We may update this Privacy Policy from time to time. Changes will be posted on this page with
          an updated &quot;Last updated&quot; date.
        </p>
      </LegalSection>

      <LegalSection title="9. Contact">
        <p>
          For privacy-related inquiries, contact us at{' '}
          <a href="mailto:sov@sovereignsignal.com" className="underline underline-offset-2" style={{ color: 'var(--ds-fg)' }}>
            sov@sovereignsignal.com
          </a>.
        </p>
      </LegalSection>
    </LegalDocument>
  );
}
