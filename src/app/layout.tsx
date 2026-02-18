import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { AuthProvider } from "@/components/AuthProvider";
import { DataSyncProvider } from "@/components/DataSyncProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "discuss.watch – Unified Forum Feed",
  description: "All your forums, one feed. Aggregate discussions from crypto, AI, and open source communities.",
  icons: {
    icon: "/icon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${GeistSans.variable} ${GeistMono.variable} antialiased`}
      >
        <AuthProvider>
          <DataSyncProvider>
            {children}
          </DataSyncProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
