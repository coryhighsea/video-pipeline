import { Img, staticFile } from "remotion";

export const LogoWatermark: React.FC = () => (
  <div
    style={{
      position: "absolute",
      top: 24,
      right: 24,
      opacity: 0.8,
      zIndex: 100,
    }}
  >
    <Img src={staticFile("logo.png")} style={{ width: 120, height: "auto" }} />
  </div>
);
