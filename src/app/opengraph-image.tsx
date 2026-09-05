import { ImageResponse } from "next/og";

export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OG() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background: "#0a0a0a",
          color: "#ffffff",
          fontFamily: "Arial, Helvetica, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 16,
              background: "#ffffff",
              color: "#0a0a0a",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 38,
              fontWeight: "bold",
            }}
          >
            R
          </div>
          <div style={{ fontSize: 34, fontWeight: "bold", letterSpacing: -1 }}>repllyer</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", marginTop: 28, fontSize: 62, fontWeight: "bold", lineHeight: 1.05, letterSpacing: -2 }}>
          <div>AI customer care</div>
          <div>that actually helps.</div>
        </div>
        <div style={{ marginTop: 20, fontSize: 26, color: "#a1a1aa" }}>
          Human takeover • Priority sorting • Action scripts • 180 msgs free
        </div>
      </div>
    ),
    { ...size }
  );
}
