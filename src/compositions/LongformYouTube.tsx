import {
  AbsoluteFill,
  OffthreadVideo,
  Sequence,
  staticFile,
  useVideoConfig,
} from "remotion";
import type { Caption } from "@remotion/captions";
import { CaptionOverlay } from "../components/CaptionOverlay";
import { LogoWatermark } from "../components/LogoWatermark";
import { SectionCard } from "../components/SectionCard";

export type LongformYouTubeProps = {
  videoSrc: string;
  captionsFile: string;
  /** Pre-loaded captions — when provided, skips the per-frame fetch in CaptionOverlay */
  captionsData?: Caption[];
  sections: Array<{
    title: string;
    subtitle?: string;
    startMs: number;
    endMs: number;
  }>;
  durationMs: number;
};

const SECTION_CARD_FRAMES = 105; // 3.5s at 30fps — matches SectionCard's own durationInFrames expectation

export const LongformYouTube: React.FC<LongformYouTubeProps> = ({
  videoSrc,
  captionsFile,
  captionsData,
  sections,
  durationMs,
}) => {
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <OffthreadVideo
        src={staticFile(videoSrc)}
        style={{ width: "100%", height: "100%", objectFit: "cover" }}
      />

      {sections.map((section, i) => (
        <Sequence
          key={i}
          from={Math.round((section.startMs / 1000) * fps)}
          durationInFrames={SECTION_CARD_FRAMES}
          layout="none"
        >
          <SectionCard title={section.title} subtitle={section.subtitle} />
        </Sequence>
      ))}

      <CaptionOverlay
        captionsFile={captionsFile}
        captionsData={captionsData}
        startOffsetMs={0}
        endOffsetMs={durationMs}
        bottomPadding={60}
      />
      <LogoWatermark />
    </AbsoluteFill>
  );
};
