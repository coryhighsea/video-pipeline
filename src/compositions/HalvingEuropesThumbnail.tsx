import { AbsoluteFill, Img, OffthreadVideo, staticFile } from "remotion";
import { BRAND } from "../lib/colors";

const THUMBNAIL_FRAME = 30 * 32; // ~0:32 — mid-explanation

export const HalvingEuropesThumbnail: React.FC = () => {
  return (
    <AbsoluteFill
      style={{
        background: "#08111f",
        fontFamily:
          "system-ui, -apple-system, 'Helvetica Neue', Arial, sans-serif",
        overflow: "hidden",
      }}
    >
      {/* ─── Radial glow behind text ─── */}
      <div
        style={{
          position: "absolute",
          left: -120,
          top: "50%",
          transform: "translateY(-50%)",
          width: 800,
          height: 800,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${BRAND.accent}28 0%, transparent 70%)`,
          pointerEvents: "none",
        }}
      />

      {/* ─── Video frame — right side ─── */}
      <div
        style={{
          position: "absolute",
          right: 0,
          top: 0,
          width: "60%",
          height: "100%",
          overflow: "hidden",
        }}
      >
        <OffthreadVideo
          src={staticFile("halving-Europes-31b-bill.mp4")}
          trimBefore={THUMBNAIL_FRAME}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: "center top",
          }}
        />
      </div>

      {/* ─── Gradient: dark left → transparent right ─── */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(to right, #08111f 38%, #08111fdd 54%, #08111f88 64%, transparent 78%)",
          pointerEvents: "none",
        }}
      />

      {/* ─── Bottom vignette ─── */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: "28%",
          background: "linear-gradient(to top, #08111fcc 0%, transparent 100%)",
          pointerEvents: "none",
        }}
      />

      {/* ─── Top accent bar ─── */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 5,
          background: `linear-gradient(to right, ${BRAND.accent}, ${BRAND.accentLight} 40%, transparent 70%)`,
        }}
      />

      {/* ─── Main text ─── */}
      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "flex-start",
          paddingLeft: 62,
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 0,
            maxWidth: 560,
          }}
        >
          {/* Eyebrow */}
          <div
            style={{
              color: BRAND.accentLight,
              fontSize: 20,
              fontWeight: 700,
              letterSpacing: 5,
              textTransform: "uppercase",
              marginBottom: 16,
              opacity: 0.9,
            }}
          >
            NIS2 Compliance
          </div>

          {/* "Europe's" */}
          <div
            style={{
              color: "rgba(255,255,255,0.88)",
              fontSize: 72,
              fontWeight: 800,
              lineHeight: 1,
              letterSpacing: -2,
            }}
          >
            Europe's
          </div>

          {/* "€31B" — dominant */}
          <div
            style={{
              color: BRAND.accentLight,
              fontSize: 148,
              fontWeight: 900,
              lineHeight: 0.85,
              letterSpacing: -6,
              textShadow: `0 0 80px ${BRAND.accent}55`,
            }}
          >
            €31B
          </div>

          {/* "Compliance Bill" */}
          <div
            style={{
              color: "rgba(255,255,255,0.75)",
              fontSize: 44,
              fontWeight: 700,
              lineHeight: 1.1,
              letterSpacing: -1,
              marginTop: 4,
            }}
          >
            Compliance Bill
          </div>

          {/* Divider */}
          <div
            style={{
              width: 60,
              height: 3,
              background: BRAND.accent,
              borderRadius: 2,
              marginTop: 22,
              marginBottom: 16,
              opacity: 0.7,
            }}
          />

          {/* Punch line */}
          <div
            style={{
              color: BRAND.gray,
              fontSize: 24,
              fontWeight: 500,
              letterSpacing: 0.2,
              lineHeight: 1.4,
            }}
          >
            We're cutting it in half
          </div>
        </div>
      </AbsoluteFill>

      {/* ─── Logo — bottom left ─── */}
      <div
        style={{
          position: "absolute",
          bottom: 28,
          left: 62,
          opacity: 0.55,
        }}
      >
        <Img
          src={staticFile("logo.png")}
          style={{ height: 28, width: "auto" }}
        />
      </div>
    </AbsoluteFill>
  );
};
