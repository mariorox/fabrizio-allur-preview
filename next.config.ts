import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the Turbopack workspace root to this project folder.
  // Without this, Next 16 infers the parent directory as the root and
  // fails to resolve packages like `tailwindcss` from node_modules.
  turbopack: {
    root: __dirname,
  },
  serverExternalPackages: ["better-sqlite3", "sharp"],
  // Permite acessar os recursos de dev via túnel (Cloudflare) — senão o
  // JS de cliente não hidrata quando aberto por outro domínio.
  allowedDevOrigins: ["*.trycloudflare.com"],
};

export default nextConfig;
