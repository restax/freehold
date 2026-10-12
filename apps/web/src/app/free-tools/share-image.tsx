import { ImageResponse } from "next/og";

export const shareImageSize = { width: 1200, height: 630 };

/** The one share image for /free-tools and every page under it. */
export function freeToolsShareImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "64px 72px",
        background: "linear-gradient(135deg, #0b4d31 0%, #063523 100%)",
        color: "#ffffff",
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 14,
            background: "#17804f",
            border: "2px solid rgba(255,255,255,0.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 34,
            fontWeight: 700,
          }}
        >
          F
        </div>
        <div style={{ fontSize: 38, WebkitTextStroke: "1.5px #ffffff" }}>Freehold</div>
      </div>

      <div style={{ display: "flex", flexDirection: "column" }}>
        <div
          style={{
            fontSize: 168,
            lineHeight: 1,
            letterSpacing: -2,
            whiteSpace: "nowrap",
            color: "#6fe3a1",
            WebkitTextStroke: "5px #6fe3a1",
          }}
        >
          FREE TOOLS
        </div>
        <div style={{ marginTop: 32, fontSize: 40, maxWidth: 980, lineHeight: 1.25 }}>
          Spreadsheets, agreements and guides for new transaction coordinators
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
        <div
          style={{
            display: "flex",
            padding: "10px 26px",
            borderRadius: 999,
            background: "rgba(255,255,255,0.14)",
            border: "2px solid rgba(255,255,255,0.3)",
            fontSize: 30,
            fontWeight: 700,
          }}
        >
          freeholdtc.dev/free-tools
        </div>
        <div style={{ fontSize: 30, color: "rgba(255,255,255,0.8)" }}>
          No signup. No email gate.
        </div>
      </div>
    </div>,
    shareImageSize,
  );
}
