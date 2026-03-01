/** @type {import('next').NextConfig} */
const nextConfig = {
  // Explicitly map server-side env vars so they are always available in API routes
  env: {
    GROQ_API_KEY: process.env.GROQ_API_KEY,
  },
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
