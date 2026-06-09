import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
