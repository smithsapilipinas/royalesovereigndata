/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow large file uploads (500MB)
  serverExternalPackages: ['gun', 'gun-eth', 'liboqs-node'],

  experimental: {
    serverActions: {
      bodySizeLimit: '500mb',
    },
  },

  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'gateway.pinata.cloud',
        pathname: '/ipfs/**',
      },
      {
        protocol: 'https',
        hostname: 'ipfs.io',
        pathname: '/ipfs/**',
      },
      {
        protocol: 'https',
        hostname: 'cloudflare-ipfs.com',
        pathname: '/ipfs/**',
      },
      {
        protocol: 'https',
        hostname: '*.mypinata.cloud',
        pathname: '/ipfs/**',
      },
    ],
  },

  // Required for Gun.js WebSocket support
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
      };
    }

    // Handle Gun.js
    config.externals = config.externals || [];
    if (isServer) {
      config.externals.push('gun', 'gun/sea');
    }

    return config;
  },

  async headers() {
    return [
      {
        // CORS headers for API routes
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST, PUT, DELETE, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization, X-Wallet-Address' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
