import { ImageResponse } from "next/og";

export const shareImageSize = { width: 1200, height: 630 };

type ShareImage = {
  /** Lines of the headline, in white. */
  lines: string[];
  /** Final headline line, in the mint accent. */
  accent: string;
  fontSize: number;
  /** The logo mark above the headline. On by default. */
  logo?: boolean;
};

/**
 * One look for every link preview: deep green, big type, no photo. A photo
 * turns to mud at the size a feed shows it, and small type is unreadable.
 *
 * No small text: the square thumbnail in a comment thread is about a hundred
 * pixels across, so only the headline and the logo mark survive. The page
 * title and description under the preview carry the detail.
 *
 * Everything sits in the middle 630px. Facebook shows the comment-thread
 * thumbnail as a square crop of the centre, so anything nearer the edges of
 * the 1200px image is cut off there. The weight is faked with a text stroke
 * because the default image font has no bold.
 */
export function shareImage({ lines, accent, fontSize, logo = true }: ShareImage) {
  const stroke = Math.max(2, Math.round(fontSize / 34));
  const headline = {
    fontSize,
    lineHeight: 1.02,
    letterSpacing: -2,
    whiteSpace: "nowrap",
    textAlign: "center",
  } as const;

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #0b4d31 0%, #063523 100%)",
        color: "#ffffff",
        fontFamily: "sans-serif",
      }}
    >
      <div
        style={{
          width: 600,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 30,
        }}
      >
        {logo ? (
          <div
            style={{
              width: 96,
              height: 96,
              borderRadius: 24,
              background: "#17804f",
              border: "3px solid rgba(255,255,255,0.4)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 62,
              fontWeight: 700,
            }}
          >
            F
          </div>
        ) : null}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          {lines.map((line) => (
            <div key={line} style={{ ...headline, WebkitTextStroke: `${stroke}px #ffffff` }}>
              {line}
            </div>
          ))}
          <div
            style={{
              ...headline,
              color: "#6fe3a1",
              WebkitTextStroke: `${stroke}px #6fe3a1`,
            }}
          >
            {accent}
          </div>
        </div>
      </div>
    </div>,
    shareImageSize,
  );
}
