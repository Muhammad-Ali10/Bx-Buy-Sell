// next.config.mjs
/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack(config) {
    // Find the existing rule handling SVGs
    const fileLoaderRule = config.module.rules.find(
      (rule) => rule.test && rule.test.test && rule.test.test(".svg")
    )

    // Exclude SVG from that rule
    fileLoaderRule.exclude = /\.svg$/

    // Add a new rule for SVGR
    config.module.rules.push({
      test: /\.svg$/,
      use: ["@svgr/webpack"],
    })

    return config
  },
}

export default nextConfig
