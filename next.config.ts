import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // For now, keep server rendering for pages that haven't been converted yet
  // TODO: Enable static export once all server components are converted
  // output: 'export',
  
  // Optimize images for better performance
  images: {
    // Uncomment when ready for static export
    // unoptimized: true
    domains: [],
    formats: ['image/webp', 'image/avif'],
  },
  
  // Configure trailing slash for consistency
  trailingSlash: false,
  
  experimental: {
    // Disable missing suspense warnings for CSR bailout
    missingSuspenseWithCSRBailout: false,
  },
  
  // Redirect configuration for clean URLs
  async redirects() {
    return [
      {
        source: '/dashboard',
        destination: '/',
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
