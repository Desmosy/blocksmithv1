import type { NextConfig } from "next";

const streamlineSvgGlob =
  "**/node_modules/@icon-pkg/streamline-core-line-free/**/*.svg";

const SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
  {
    // HSTS — only honored over HTTPS (Vercel). 2 years + preload.
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const nextConfig: NextConfig = {
  // This repo sits inside the upstream BlockSmith checkout, so Next sees two
  // lockfiles and guesses the parent as the workspace root. Pin it here.
  outputFileTracingRoot: __dirname,
  reactStrictMode: true,
  // Don't advertise the framework/version.
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
  transpilePackages: ["@blocksmith/pulse-runtime", "@blocksmith/acme-ui-kit"],
  // instrumentation.ts is stable in Next 15 — no config flag needed
  serverExternalPackages: ["chokidar"],
  turbopack: {
    rules: {
      [streamlineSvgGlob]: {
        loaders: ["@svgr/webpack"],
        as: "*.js",
      },
    },
  },
  // Avoid stale chunk errors after cache corruption
  webpack: (config, { dev }) => {
    const streamlineSvg = /node_modules[/\\]@icon-pkg[/\\]streamline-core-line-free[/\\].*\.svg$/i;

    // Must precede Next's default SVG asset rule — node_modules SVGs are otherwise skipped.
    config.module.rules.unshift({
      test: streamlineSvg,
      use: [
        {
          loader: require.resolve("@svgr/webpack"),
          options: {
            svgo: false,
            titleProp: true,
          },
        },
      ],
    });

    const fileLoaderRule = config.module.rules.find(
      (rule: { test?: { test?: (s: string) => boolean } }) =>
        rule.test?.test?.(".svg"),
    );
    if (fileLoaderRule) {
      const prev = fileLoaderRule.exclude;
      fileLoaderRule.exclude = [
        ...(Array.isArray(prev) ? prev : prev ? [prev] : []),
        streamlineSvg,
      ];
    }

    if (dev) {
      config.watchOptions = {
        ...config.watchOptions,
        ignored: ["**/.next/**", "**/node_modules/**", "**/.blocksmith/**"],
      };
    }
    return config;
  },
};

export default nextConfig;
