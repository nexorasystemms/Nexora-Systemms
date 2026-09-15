import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Server Actions default to a 1MB body limit; document uploads (photographed payslips,
    // IDs, bank statements — FR-DOC-01/02) go through uploadDocument as a Server Action, so
    // this needs to match the Supabase Storage bucket's own limit (see migration 0007).
    serverActions: {
      bodySizeLimit: "25mb",
    },
  },
};

export default nextConfig;
