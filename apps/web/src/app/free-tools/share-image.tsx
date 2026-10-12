import { shareImage, shareImageSize } from "@/lib/share-image";

export { shareImageSize };

/** The one share image for /free-tools and every page under it. */
export function freeToolsShareImage() {
  return shareImage({
    lines: ["FREE"],
    accent: "TOOLS",
    fontSize: 184,
    logo: false,
  });
}
