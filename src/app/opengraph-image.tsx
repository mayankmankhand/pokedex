// OG image generator - produces a 1200x630 social preview card.
// Uses Next.js file-based convention: placing this in src/app/ auto-generates
// og:image and twitter:image meta tags with correct absolute URLs.

import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt =
  "Pokedex PLM - Chat-based Product Lifecycle Management";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
          height: "100%",
          backgroundColor: "#F5F0EA",
          fontFamily: "sans-serif",
        }}
      >
        {/* Pokeball shape */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            width: 160,
            height: 160,
            borderRadius: "50%",
            border: "6px solid #1a1a1a",
            overflow: "hidden",
            marginBottom: 40,
          }}
        >
          {/* Red top half */}
          <div
            style={{
              display: "flex",
              width: "100%",
              height: "50%",
              backgroundColor: "#DC2626",
            }}
          />
          {/* Divider line with center button */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "100%",
              height: 6,
              backgroundColor: "#1a1a1a",
              position: "relative",
            }}
          >
            <div
              style={{
                display: "flex",
                width: 36,
                height: 36,
                borderRadius: "50%",
                backgroundColor: "#FFFFFF",
                border: "5px solid #1a1a1a",
                position: "absolute",
              }}
            />
          </div>
          {/* White bottom half */}
          <div
            style={{
              display: "flex",
              width: "100%",
              height: "50%",
              backgroundColor: "#FFFFFF",
            }}
          />
        </div>

        {/* Title */}
        <div
          style={{
            display: "flex",
            fontSize: 64,
            fontWeight: 700,
            color: "#1a1a1a",
            marginBottom: 16,
          }}
        >
          Pokedex PLM
        </div>

        {/* Subtitle */}
        <div
          style={{
            display: "flex",
            fontSize: 28,
            color: "#6B7280",
          }}
        >
          Chat-based Product Lifecycle Management
        </div>

        {/* URL hint */}
        <div
          style={{
            display: "flex",
            fontSize: 20,
            color: "#3D7DCA",
            marginTop: 24,
          }}
        >
          pokedex-plm.vercel.app
        </div>
      </div>
    ),
    { ...size }
  );
}
