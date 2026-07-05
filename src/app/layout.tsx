import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { AuthProvider } from "@/components/AuthProvider";
import { DataSyncProvider } from "@/components/DataSyncProvider";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL('https://discuss.watch'),
  title: "discuss.watch – Unified Forum Feed",
  description: "All your forums, one feed. Aggregate discussions from crypto, AI, and open source communities.",
  icons: {
    icon: "/icon.svg",
  },
  openGraph: {
    title: "discuss.watch – Unified Forum Feed",
    description: "All your forums, one feed. Aggregate discussions from crypto, AI, and open source communities.",
    url: "https://discuss.watch",
    siteName: "discuss.watch",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "discuss.watch – Unified Forum Feed",
    description: "All your forums, one feed. Aggregate discussions from crypto, AI, and open source communities.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Geist variable classes live on <html>, not <body>: --ds-font-* tokens
  // are declared on html and substitute var(--font-geist-*) there, so the
  // variables must be defined at (or above) that element to resolve.
  return (
    <html
      lang="en"
      data-density="standard"
      suppressHydrationWarning
      className={`${GeistSans.variable} ${GeistMono.variable}`}
    >
      <body className="antialiased">
        {/* Apply the persisted theme class before paint so themed UI never flashes
            and the class is set before React hydrates. useTheme reads the same key. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var e=document.documentElement;var t=localStorage.getItem('discuss-watch-theme');e.classList.add(t==='light'?'light':'dark');}catch(_){document.documentElement.classList.add('dark');}})();`,
          }}
        />
        <AuthProvider>
          <DataSyncProvider>
            {children}
          </DataSyncProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
