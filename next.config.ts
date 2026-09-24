import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Ask Chrome for its view of the connection with every request, so the
  // server can send Data Saver pages to slow phones up front.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Accept-CH", value: "ECT, Downlink, Save-Data" },
          // On a first visit Chrome hasn't been asked yet; this makes it retry
          // once with the hints, so even the very first page can be light.
          { key: "Critical-CH", value: "ECT, Save-Data" },
        ],
      },
    ];
  },
  images: {
    // 35 is Data Saver's compressed product photo (src/lib/dataSaver.ts).
    qualities: [35, 75],
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
