/** @type {import('next').NextConfig} */
const nextConfig = {
  // async rewrites() {
  //   return [
  //     {
  //       source: '/api/:path*',
  //       destination: 'http://84.46.246.92:1230/:path*', // backend base URL
  //     },
  //   ];
  // },

  webpack(config) {
    // Find the existing rule handling SVGs
    const fileLoaderRule = config.module.rules.find(
      (rule) => rule.test && rule.test.test && rule.test.test('.svg')
    );

    // Exclude SVG from the existing rule
    fileLoaderRule.exclude = /\.svg$/;

    // Add SVGR loader for SVG imports as React components
    config.module.rules.push({
      test: /\.svg$/,
      use: ['@svgr/webpack'],
    });

    return config;
  },
};

export default nextConfig;
