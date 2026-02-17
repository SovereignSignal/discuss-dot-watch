import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'discuss.watch — Delegate Dashboard',
  description: 'Delegate activity monitoring for Discourse governance forums.',
};

export default function TenantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
