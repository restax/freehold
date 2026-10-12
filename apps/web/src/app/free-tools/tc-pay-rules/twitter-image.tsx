import { freeToolsShareImage, shareImageSize } from "../share-image";

export const alt = "Freehold free tools for new transaction coordinators";
export const size = shareImageSize;
export const contentType = "image/png";

export default function Image() {
  return freeToolsShareImage();
}
