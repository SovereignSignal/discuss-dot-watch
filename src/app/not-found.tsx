import { MarketingChrome, MarketingLink } from '@/components/MarketingChrome';
import { EmptyState } from '@/components/ui/EmptyState';

export default function NotFound() {
  return (
    <MarketingChrome>
      <EmptyState
        title="Page not found"
        body="The page you&apos;re looking for doesn&apos;t exist or has been moved."
        action={<MarketingLink href="/">Go home</MarketingLink>}
      />
    </MarketingChrome>
  );
}
