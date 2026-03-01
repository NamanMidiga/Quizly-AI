/** @type {import('next').NextConfig} */
const nextConfig = {
  // Explicitly map server-side env vars so they are always available in API routes
  env: {
    GROQ_API_KEY: process.env.GROQ_API_KEY,
  },
};

export default nextConfig;
