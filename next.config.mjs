/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
    ],
  },
  // Disable Turbopack for build (emoji in folder name causes Turbopack panic)
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
