import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalDocument, LegalSection } from '@/components/LegalDocument';

export const metadata: Metadata = {
  title: 'Terms of Service - discuss.watch',
  description: 'Terms of Service for discuss.watch',
};

export default function TermsPage() {
  return (
    <LegalDocument kicker="Legal" title="Terms of Service" updated="August 12, 2026">
      <LegalSection title="1. Acceptance of Terms">
        <p>
          By accessing or using discuss.watch (&quot;the Service&quot;), you agree to be bound by these Terms of Service.
          If you do not agree, do not use the Service.
        </p>
      </LegalSection>

      <LegalSection title="2. Description of Service">
        <p>
          discuss.watch aggregates and displays publicly available discussions from community forums across
          crypto governance, AI/ML, and open source ecosystems. The Service provides email digests, keyword
          alerts, bookmarking, and read/unread tracking. Forum content is fetched from public APIs and displayed
          as-is; we do not host or modify user-generated forum content.
        </p>
      </LegalSection>

      <LegalSection title="3. No Accounts">
        <p>
          The Service does not require an account. Preferences such as forums, bookmarks, alerts, and
          read state are stored in your browser. Clearing site data removes them.
        </p>
      </LegalSection>

      <LegalSection title="4. Data Collection">
        <p>
          We cache publicly available forum discussions to provide the Service. We do not sell personal data.
          See our{' '}
          <Link href="/privacy" className="underline underline-offset-2" style={{ color: 'var(--ds-fg)' }}>
            Privacy Policy
          </Link>{' '}
          for details.
        </p>
      </LegalSection>

      <LegalSection title="5. Third-Party Services">
        <p>
          The Service relies on third-party providers: Anthropic Claude (AI-generated digest summaries)
          and Resend (email delivery for operator-configured briefs). Your use of these services is subject
          to their respective terms and privacy policies.
        </p>
      </LegalSection>

      <LegalSection title="6. Acceptable Use">
        <p>
          You agree not to: abuse API rate limits, attempt to access admin endpoints without authorization,
          scrape the Service for commercial purposes, or interfere with the Service&apos;s operation.
        </p>
      </LegalSection>

      <LegalSection title="7. Disclaimer">
        <p>
          The Service is provided &quot;as is&quot; without warranties of any kind. Forum content is sourced from
          third-party platforms and may be inaccurate or outdated. AI-generated summaries are for informational
          purposes only and should not be relied upon for financial or governance decisions.
        </p>
      </LegalSection>

      <LegalSection title="8. Modifications">
        <p>
          We may update these Terms at any time. Continued use of the Service after changes constitutes
          acceptance of the new Terms. Material changes will be communicated via the Service or email.
        </p>
      </LegalSection>

      <LegalSection title="9. Contact">
        <p>
          Questions about these Terms? Contact us at{' '}
          <a href="mailto:sov@sovereignsignal.com" className="underline underline-offset-2" style={{ color: 'var(--ds-fg)' }}>
            sov@sovereignsignal.com
          </a>.
        </p>
      </LegalSection>
    </LegalDocument>
  );
}
