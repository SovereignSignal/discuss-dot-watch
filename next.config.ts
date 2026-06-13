import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  // Note: the former experimental.turbopackUseSystemTlsCerts (a workaround for
  // Turbopack fetching Google Fonts over rustls in containers) was removed — fonts
  // are self-hosted via next/font (geist), so no external font fetch happens, and
  // the option no longer exists in Next 16.2+.
};

export default nextConfig;
