const nextConfig = {
  output: "standalone",
  serverExternalPackages: ["@anthropic-ai/sdk"],
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
