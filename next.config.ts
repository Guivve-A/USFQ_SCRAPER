import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const nextConfig: NextConfig = {
  turbopack: {
    root: process.cwd(),
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "challengepost-s3-challengepost.netdna-ssl.com" },
      { protocol: "https", hostname: "*.cloudfront.net" },
      { protocol: "https", hostname: "*.amazonaws.com" },
      { protocol: "https", hostname: "*.devpost.com" },
      { protocol: "https", hostname: "devpost.com" },
      { protocol: "https", hostname: "mlh.io" },
      { protocol: "https", hostname: "*.mlh.io" },
      { protocol: "https", hostname: "img.evbuc.com" },
      { protocol: "https", hostname: "*.eventbrite.com" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "secure.meetupstatic.com" },
      { protocol: "https", hostname: "gdg.community.dev" },
      { protocol: "https", hostname: "*.bevyengine.dev" },
      { protocol: "https", hostname: "*.bevyhq.com" },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
