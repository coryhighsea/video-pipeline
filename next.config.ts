import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  // Pages from the old coryhisey.com portfolio site that Google may still have indexed.
  async redirects() {
    return [
      { source: "/shop", destination: "/about", permanent: true },
      { source: "/shop/:path*", destination: "/about", permanent: true },
    ];
  },
};

export default nextConfig;
