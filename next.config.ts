import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  experimental: {
    // Use system TLS certificates for Turbopack's font fetching.
    // Turbopack uses rustls by default which doesn't use the system cert store,
    // causing Google Fonts fetch failures in containerized build environments (Railway/Nixpacks).
    turbopackUseSystemTlsCerts: true,
  },
};

export default nextConfig;
