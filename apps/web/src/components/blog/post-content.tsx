import { opinlyConfig } from "@opinly/next";
import { OpinlyContent } from "@opinly/react";
import type { OpinlyNode } from "@opinly/shared";

const config = {
  imagesPrefix: opinlyConfig.imagesPrefix,
  siteUrl: opinlyConfig.siteUrl,
  blogPrefix: opinlyConfig.blogPrefix,
  siteName: opinlyConfig.siteName,
};

export function PostContent({ content }: { content: OpinlyNode }) {
  return (
    <div className="prose prose-stone prose-lg max-w-none prose-headings:font-display prose-a:text-brand-700">
      <OpinlyContent content={content} config={config} />
    </div>
  );
}
