import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Fixture reports are read from disk at request time; make sure they ship with
  // the server bundle (Vercel / `next start`).
  outputFileTracingIncludes: {
    "/**": ["./lab_reports/**/*.md"],
  },
  poweredByHeader: false,
};

export default nextConfig;
