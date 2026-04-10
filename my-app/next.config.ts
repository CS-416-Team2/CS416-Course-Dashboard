import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        //Replace IP with flask service name:port if using docker network to connect
        //Keep IP if running locally, and this is the Flask IP:Port
        destination: 'http://127.0.0.1:5000/api/:path*', // Assuming Flask returns /api/... 
      },
    ];
  },
};

export default nextConfig;
