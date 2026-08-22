import type { ReactNode } from 'react';
import { MarketingChrome } from '@/components/MarketingChrome';
import { SectionHeader } from '@/components/ui/SectionHeader';

export function LegalDocument({
  kicker,
  title,
  updated,
  children,
}: {
  kicker: string;
  title: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <MarketingChrome>
      <article
        className="legal-doc mx-auto px-5 py-12 md:py-16"
        style={{ maxWidth: 720 }}
      >
        <SectionHeader meta={updated}>{kicker}</SectionHeader>
        <h1
          className="mb-8 font-semibold tracking-tight"
          style={{ fontSize: 'clamp(1.75rem, 4vw, 2.25rem)' }}
        >
          {title}
        </h1>
        {children}
      </article>
    </MarketingChrome>
  );
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-8">
      <h2
        className="mb-3 font-semibold"
        style={{ fontSize: 'var(--ds-text-lg)', color: 'var(--ds-fg)' }}
      >
        {title}
      </h2>
      <div
        className="space-y-3 leading-relaxed"
        style={{ color: 'var(--ds-fg-muted)', fontSize: 'var(--ds-text-sm)' }}
      >
        {children}
      </div>
    </section>
  );
}
