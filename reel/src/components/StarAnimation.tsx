import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { HEIGHT, WIDTH } from "../constants";
import { CellPop } from "./CellPop";

export type StarRegion = { x: number; y: number; w: number; h: number };

/**
 * Sequentially "pops" the five stars baked into the source photo using the
 * shared CellPop crop technique (see CellPop.tsx) — real source pixels,
 * matted against the local background so nothing double-renders.
 *
 * Used for Scene 1 (crisp pop, glow=false) and Scene 4 (soft glow, glow=true).
 */
export const SequentialStarPop: React.FC<{
  src: string;
  region: StarRegion;
  matteColor: string;
  startFrame: number;
  popDurationFrames?: number;
  staggerFrames?: number;
  glow?: boolean;
}> = ({ src, region, matteColor, startFrame, popDurationFrames = 6, staggerFrames = 3, glow = false }) => {
  const frame = useCurrentFrame();

  if (!glow) {
    return (
      <CellPop
        src={src}
        region={region}
        matteColor={matteColor}
        startFrame={startFrame}
        count={5}
        popDurationFrames={popDurationFrames}
        staggerFrames={staggerFrames}
      />
    );
  }

  // Glow variant: same pop, plus a soft gold drop-shadow that blooms in
  // after each star settles and gently fades — no hard-edged flash.
  const regionX = region.x * WIDTH;
  const regionY = region.y * HEIGHT;
  const regionW = region.w * WIDTH;
  const regionH = region.h * HEIGHT;

  return (
    <>
      <CellPop
        src={src}
        region={region}
        matteColor={matteColor}
        startFrame={startFrame}
        count={5}
        popDurationFrames={popDurationFrames}
        staggerFrames={staggerFrames}
      />
      {Array.from({ length: 5 }).map((_, i) => {
        const localStart = startFrame + i * staggerFrames + popDurationFrames;
        const glowStrength = interpolate(frame - localStart, [0, 10, 26], [0, 7, 2], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        const cellW = regionW / 5;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: regionX + i * cellW,
              top: regionY,
              width: cellW,
              height: regionH,
              boxShadow: glowStrength > 0 ? `0 0 ${glowStrength * 2}px ${glowStrength}px rgba(242,201,76,0.55)` : undefined,
              borderRadius: "50%",
              pointerEvents: "none",
            }}
          />
        );
      })}
    </>
  );
};

/** A single soft highlight sweeping once across the star row. */
export const StarShimmer: React.FC<{
  region: StarRegion;
  startFrame: number;
  durationFrames?: number;
}> = ({ region, startFrame, durationFrames = 14 }) => {
  const frame = useCurrentFrame();
  const regionX = region.x * WIDTH;
  const regionY = region.y * HEIGHT;
  const regionW = region.w * WIDTH;
  const regionH = region.h * HEIGHT;

  const progress = interpolate(frame, [startFrame, startFrame + durationFrames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const opacity = interpolate(
    frame,
    [startFrame, startFrame + durationFrames * 0.3, startFrame + durationFrames],
    [0, 0.55, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const barWidth = regionW * 0.35;
  const travel = regionW + barWidth;
  const left = regionX - barWidth + progress * travel;

  return (
    <div
      style={{
        position: "absolute",
        left,
        top: regionY - regionH * 0.6,
        width: barWidth,
        height: regionH * 2.2,
        opacity,
        background:
          "linear-gradient(75deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.9) 50%, rgba(255,255,255,0) 100%)",
        mixBlendMode: "screen",
        pointerEvents: "none",
      }}
    />
  );
};
