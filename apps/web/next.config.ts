import type { NextConfig } from "next";

const R2_IMG = process.env.R2_PUBLIC_BASE_URL ?? "";
const DEV = process.env.NODE_ENV === "development";
// Next.js dev server requires both unsafe-eval (webpack HMR) and unsafe-inline
// (app-router bootstrap scripts). Neither is needed in production builds.
const DEV_SCRIPT = DEV ? " 'unsafe-inline' 'unsafe-eval'" : "";

const BASE_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

function csp(scriptSrc: string) {
  return {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://rsms.me",
      "font-src 'self' https://fonts.gstatic.com https://rsms.me",
      scriptSrc,
      "frame-src https://js.stripe.com https://hooks.stripe.com",
      `img-src 'self' data: blob: https: ${R2_IMG}`,
      "connect-src 'self' https://api.stripe.com",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  };
}

// Public campaign pages — strict, no Stripe needed
const publicHeaders = [
  ...BASE_HEADERS,
  csp(`script-src 'self'${DEV_SCRIPT}`),
];

// Authenticated admin pages — allow Stripe.js, no framing
const adminHeaders = [
  ...BASE_HEADERS,
  { key: "X-Frame-Options", value: "DENY" },
  csp(`script-src 'self' https://js.stripe.com${DEV_SCRIPT}`),
];

// Puck page editor — needs unsafe-inline + unsafe-eval for builder runtime
const editorHeaders = [
  ...BASE_HEADERS,
  { key: "X-Frame-Options", value: "DENY" },
  csp("script-src 'self' 'unsafe-inline' 'unsafe-eval'"),
];

const nextConfig: NextConfig = {
  transpilePackages: [
    "@twinaholic/react",
    "@twinaholic/tokens",
    "@twinaholic/semantics",
    "@twinaholic/primitives",
    "@twinaholic/contracts",
    "@primitive/campaign-domain",
    "@measured/puck",
  ],
  serverExternalPackages: [
    "postgres",
    "@aws-sdk/client-s3",
    "@aws-sdk/s3-request-presigner",
    "stripe",
  ],
  typedRoutes: true,
  async headers() {
    return [
      // Public campaign pages (matched first, may be overridden below)
      { source: "/:orgSlug/:campaignSlug/:path*", headers: publicHeaders },

      // Admin API routes
      { source: "/api/:path*", headers: adminHeaders },

      // Admin UI routes (actual URL paths — route group (admin) is not in the URL)
      { source: "/dashboard", headers: adminHeaders },
      { source: "/campaigns/:path*", headers: adminHeaders },
      { source: "/settings/:path*", headers: adminHeaders },
      { source: "/media/:path*", headers: adminHeaders },
      { source: "/org/:path*", headers: adminHeaders },

      // Puck page editor — must come LAST so its CSP wins over the /campaigns/:path* rule above
      { source: "/campaigns/:slug/compose/:pageId", headers: editorHeaders },
    ];
  },
};

export default nextConfig;
