import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { ASSETS, HEIGHT, REVIEW_CARD_REGION, SCENE_BOUNDS, STAR_REGIONS, WIDTH } from "../constants";
import { SceneImage } from "../components/SceneImage";
import { CellPop } from "../components/CellPop";
import { StarShimmer } from "../components/StarAnimation";

// Review card image — background dims slightly, the card floats up/in
// (scale + fade + small upward move) over the coach photo, then a single
// soft shimmer sweeps the star row.
export const SceneTwo: React.FC = () => {
  const frame = useCurrentFrame();
  const { start } = SCENE_BOUNDS.scene2;
  const local = frame - start;

  const darken = interpolate(local, [0, 15], [0.4, 0.15], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div style={{ position: "absolute", inset: 0, width: WIDTH, height: HEIGHT, overflow: "hidden" }}>
      <SceneImage src={ASSETS.scene2} />
      <div
        style={{
          position: "absolute",
          inset: 0,
          width: WIDTH,
          height: HEIGHT,
          background: "#000",
          opacity: darken,
          pointerEvents: "none",
        }}
      />
      <CellPop
        src={ASSETS.scene2}
        region={REVIEW_CARD_REGION}
        matteColor="#ffffff"
        startFrame={0}
        count={1}
        popDurationFrames={16}
        scaleFrom={0.96}
        extraTransform={(p) => `translateY(${interpolate(p, [0, 1], [20, 0])}px)`}
      />
      <StarShimmer region={STAR_REGIONS.scene2} startFrame={22} durationFrames={14} />
    </div>
  );
};
