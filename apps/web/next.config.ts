import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["@prisma/client"],
  experimental: {
    serverActions: {
      // Contract PDFs upload through a server action; default limit is 1 MB.
      bodySizeLimit: "15mb",
    },
  },
};

export default nextConfig;
