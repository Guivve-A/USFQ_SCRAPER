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
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      // Devpost
      { protocol: "https", hostname: "challengepost-s3-challengepost.netdna-ssl.com" },
      { protocol: "https", hostname: "*.devpost.com" },
      { protocol: "https", hostname: "devpost.com" },
      // AWS / CloudFront (Devpost, Eventbrite, many others)
      { protocol: "https", hostname: "*.cloudfront.net" },
      { protocol: "https", hostname: "*.amazonaws.com" },
      // MLH
      { protocol: "https", hostname: "mlh.io" },
      { protocol: "https", hostname: "*.mlh.io" },
      // Eventbrite
      { protocol: "https", hostname: "img.evbuc.com" },
      { protocol: "https", hostname: "*.eventbrite.com" },
      // GDG / Google
      { protocol: "https", hostname: "gdg.community.dev" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "secure.meetupstatic.com" },
      { protocol: "https", hostname: "*.bevyhq.com" },
      // Lablab
      { protocol: "https", hostname: "lablab.ai" },
      { protocol: "https", hostname: "*.lablab.ai" },
      // Google Cloud Storage (GDG / Lablab assets)
      { protocol: "https", hostname: "storage.googleapis.com" },
      // Cloudinary (used by multiple platforms)
      { protocol: "https", hostname: "res.cloudinary.com" },
      // Contentful CDN
      { protocol: "https", hostname: "images.ctfassets.net" },
      // Generic image hosts
      { protocol: "https", hostname: "i.imgur.com" },
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
