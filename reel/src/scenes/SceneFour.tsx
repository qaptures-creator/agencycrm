import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import {
  ASSETS,
  CTA_REGION,
  FINAL_FADE_END,
  FINAL_FADE_START,
  HEIGHT,
  SCENE4_MATTE,
  SCENE_BOUNDS,
  STAR_MATTE_COLOR,
  STAR_REGIONS,
  THANK_YOU_TEXT_REGION,
  WIDTH,
} from "../constants";
import { SceneImage } from "../components/SceneImage";
import { CellPop } from "../components/CellPop";
import { SequentialStarPop } from "../components/StarAnimation";

// Thank You image — gentle zoom-in toward the coach that settles, stars
// glow in softly, "THANK YOU" gets a subtle scale-up, then the CTA rises
// into view. Ends with a fade to dark navy/black at 4.85s.
export const SceneFour: React.FC = () => {
  const frame = useCurrentFrame();
  const { start } = SCENE_BOUNDS.scene4;
  const local = frame - start;

  const scale = interpolate(local, [0, 18], [1.06, 1.0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const finalFade = interpolate(frame, [FINAL_FADE_START, FINAL_FADE_END], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div style={{ position: "absolute", inset: 0, width: WIDTH, height: HEIGHT, overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          width: WIDTH,
          height: HEIGHT,
          transform: `scale(${scale})`,
        }}
      >
        <SceneImage src={ASSETS.scene4} />
        <SequentialStarPop
          src={ASSETS.scene4}
          region={STAR_REGIONS.scene4}
          matteColor={STAR_MATTE_COLOR.scene4}
          startFrame={14}
          popDurationFrames={7}
          staggerFrames={3}
          glow
        />
        <CellPop
          src={ASSETS.scene4}
          region={THANK_YOU_TEXT_REGION}
          matteColor={SCENE4_MATTE}
          startFrame={4}
          count={1}
          popDurationFrames={12}
          scaleFrom={0.98}
        />
        <CellPop
          src={ASSETS.scene4}
          region={CTA_REGION}
          matteColor={SCENE4_MATTE}
          startFrame={6}
          count={1}
          popDurationFrames={12}
          scaleFrom={0.97}
          extraTransform={(p) => `translateY(${interpolate(p, [0, 1], [14, 0])}px)`}
        />
      </div>
      <div
        style={{
          position: "absolute",
          inset: 0,
          width: WIDTH,
          height: HEIGHT,
          background: "#050b16",
          opacity: finalFade,
          pointerEvents: "none",
        }}
      />
    </div>
  );
};
