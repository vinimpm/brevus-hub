/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // Não empacotar no bundler do Next: Prisma e a stack de embeddings self-hosted
    // (onnxruntime/sharp são binários nativos).
    serverComponentsExternalPackages: [
      '@prisma/client',
      'prisma',
      '@xenova/transformers',
      'onnxruntime-node',
      'sharp',
      'bullmq',
      'ioredis',
      '@anthropic-ai/sdk',
    ],
  },
};

module.exports = nextConfig;
