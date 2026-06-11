import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // linkedom does dynamic requires the bundler shouldn't trace; keep it as a
  // runtime dependency in the server bundle (used for article extraction).
  serverExternalPackages: ["linkedom"],
  images: {
    // Headshots are hotlinked from these CDNs by default; the downloader can
    // also mirror them into Supabase storage.
    remotePatterns: [
      { protocol: "https", hostname: "cdn.nba.com" },
      { protocol: "https", hostname: "a.espncdn.com" },
      { protocol: "https", hostname: "*.supabase.co" },
    ],
  },
};

export default nextConfig;
