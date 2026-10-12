import { freeToolsShareImage, shareImageSize } from "../share-image";

export const alt = "FREE TOOLS";
export const size = shareImageSize;
export const contentType = "image/png";

export default function Image() {
  return freeToolsShareImage();
}
