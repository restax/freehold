import { shareImage, shareImageSize } from "@/lib/share-image";

export const alt =
  "Freehold: every deal, every deadline, one place. AI transaction management for real estate TCs at freeholdtc.dev.";
export const size = shareImageSize;
export const contentType = "image/png";

export default function Image() {
  return shareImage({
    lines: ["Every deal,", "every deadline,"],
    accent: "one place.",
    fontSize: 80,
  });
}
