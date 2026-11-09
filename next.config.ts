import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  experimental: {
    // One 404 page for URLs that match no route at all (app/global-not-found.tsx).
    globalNotFound: true,
  },
  async redirects() {
    return [
      // One address per page: English lives at the root, so /en/... and www move there.
      { source: "/en", destination: "/", permanent: true },
      { source: "/en/:path*", destination: "/:path*", permanent: true },
      { source: "/:path*", has: [{ type: "host", value: "www\.ittsuiworks\.com" }], destination: "https://ittsuiworks.com/:path*", permanent: true },
    ];
  },
};

export default nextConfig;
