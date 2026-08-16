import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { ASSETS, HEIGHT, SCENE_BOUNDS, STAR_MATTE_COLOR, STAR_REGIONS, WIDTH } from "../constants";
import { SceneImage } from "../components/SceneImage";
import { SequentialStarPop } from "../components/StarAnimation";

// "ANOTHER 5 STAR EXPERIENCE" — slow zoom-out with a gentle drift, five
// stars popping in quickly one after another before the transition begins.
export const SceneOne: React.FC = () => {
  const frame = useCurrentFrame();
  const { start, end } = SCENE_BOUNDS.scene1;
  const local = frame - start;
  const duration = end - start;

  const scale = interpolate(local, [0, duration], [1.05, 1.0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const driftX = interpolate(local, [0, duration], [-10, 10], {
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
          transform: `scale(${scale}) translateX(${driftX}px)`,
        }}
      >
        <SceneImage src={ASSETS.scene1} />
        {/* Nested inside the same transformed wrapper so the star crops
            stay pixel-aligned with the base image through the zoom/drift. */}
        <SequentialStarPop
          src={ASSETS.scene1}
          region={STAR_REGIONS.scene1}
          matteColor={STAR_MATTE_COLOR.scene1}
          startFrame={start + 8}
          popDurationFrames={6}
          staggerFrames={3}
        />
      </div>
    </div>
  );
};
