import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    formats: ["image/avif", "image/webp"],
    // Sizes the viewer + thumbnails actually render at — keeps the on-demand
    // optimizer from generating tons of unused variants.
    imageSizes: [32, 64, 96, 128],
    deviceSizes: [640, 828, 1080, 1200, 1600, 1920],
  },
};

export default nextConfig;
