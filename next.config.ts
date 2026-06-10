import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow the local network IP so the HMR WebSocket connects properly.
  allowedDevOrigins: [
    '192.168.1.10',
    'localhost',
    '127.0.0.1',
  ],

  // pdf-parse uses Node.js built-ins (fs, path, canvas) — must not be bundled.
  serverExternalPackages: ['pdf-parse', 'canvas'],
};

export default nextConfig;
