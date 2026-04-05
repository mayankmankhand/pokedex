import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // Apply security headers to all routes
        source: "/(.*)",
        headers: [
          {
            // Prevent MIME-type sniffing (e.g. treating a text file as JS)
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            // Block this site from being embedded in iframes (clickjacking protection)
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            // Control how much referrer info is sent with outgoing requests
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            // Disable access to device features the app does not use
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
