import type { NextConfig } from "next";
import { withOpinlyConfig } from "@opinly/next";

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

export default withOpinlyConfig({
  blogPath: "/blog",
  imagesPath: "/images",
  companyName: "Freehold",
  cdnNamespace: "ivPVMe4XPTqZivN_AnEoh",
  siteUrl: "https://freeholdtc.dev",
})(nextConfig);
