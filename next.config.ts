import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Product photographs uploaded from the admin console live in Supabase
    // Storage. Only that project's public bucket is allowed, so the image
    // optimiser can't be pointed at arbitrary hosts.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "ksybwitrncqfktgiaxcx.supabase.co",
        pathname: "/storage/v1/object/public/product-images/**",
      },
    ],
  },
};

export default nextConfig;
