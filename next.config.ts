const nextConfig = {
  output: "standalone",
  serverExternalPackages: ["@anthropic-ai/sdk", "@google/genai"],
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
