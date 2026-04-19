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
import { OutroCard } from "./OutroCard";

const SECTION_CARD_FRAMES = 105; // 3.5s at 30fps
const VIDEO_FRAMES = 7560; // 252000ms at 30fps
const OUTRO_FRAMES = 90;   // 3s at 30fps

const SECTIONS = [
  { title: "€31B Problem", subtitle: "Europe's Compliance Crisis", startMs: 0 },
  { title: "What NIS2 Actually Requires", subtitle: "49 Requirements Explained", startMs: 20990 },
  { title: "The Consulting Playbook", subtitle: "How the Bill Gets Inflated", startMs: 54320 },
  { title: "What We Built", subtitle: "Free. No Consultants.", startMs: 129300 },
  { title: "Who It's For", subtitle: "160,000 EU Companies", startMs: 176030 },
];

export const HalvingEuropes: React.FC<{ captionsData?: Caption[] }> = ({ captionsData }) => {
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <OffthreadVideo
        src={staticFile("halving-Europes-31b-bill.mp4")}
        style={{ width: "100%", height: "100%", objectFit: "cover" }}
      />

      {SECTIONS.map((section, i) => (
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
        captionsFile="captions-halving-europes.json"
        captionsData={captionsData}
        startOffsetMs={0}
        endOffsetMs={252000}
        bottomPadding={60}
      />
      <LogoWatermark />

      <Sequence from={VIDEO_FRAMES} durationInFrames={OUTRO_FRAMES} layout="none">
        <OutroCard />
      </Sequence>
    </AbsoluteFill>
  );
};
