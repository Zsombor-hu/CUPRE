import type { NextConfig } from "next";

const isTest = process.env.APP_ENV === "test";

const nextConfig: NextConfig = {
  /* config options here */
  distDir: isTest ? ".next-test" : ".next",
  cacheComponents: true,
  partialPrefetching: true,
  // A CUPRÉ képek magasabb minőségben (90) mennek ki, hogy a látvány megegyezzen az eredeti prototípussal
  images: {
    qualities: [75, 90],
  },
  experimental: {
    // Két root layout van ((main) és (shop)), ezért az ismeretlen URL-ekre global-not-found.tsx felel
    globalNotFound: true,
  },
};

export default nextConfig;
