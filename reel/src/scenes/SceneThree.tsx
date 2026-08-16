import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { ASSETS, HEIGHT, ICON_ROW_MATTE, ICON_ROW_REGION, SCENE_BOUNDS, WIDTH } from "../constants";
import { SceneImage } from "../components/SceneImage";
import { CellPop } from "../components/CellPop";

// Modern Fleet image — slow downward camera settle (exterior -> interior),
// with the three benefit icons emphasised one after another.
export const SceneThree: React.FC = () => {
  const frame = useCurrentFrame();
  const { start, end } = SCENE_BOUNDS.scene3;
  const local = frame - start;
  const duration = end - start;

  const scale = interpolate(local, [0, duration], [1.03, 1.0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const translateY = interpolate(local, [0, duration], [-15, 0], {
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
          transform: `scale(${scale}) translateY(${translateY}px)`,
        }}
      >
        <SceneImage src={ASSETS.scene3} />
        <CellPop
          src={ASSETS.scene3}
          region={ICON_ROW_REGION}
          matteColor={ICON_ROW_MATTE}
          startFrame={10}
          count={3}
          popDurationFrames={9}
          staggerFrames={6}
          scaleFrom={0.88}
        />
      </div>
    </div>
  );
};
