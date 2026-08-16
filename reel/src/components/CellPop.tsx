import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig, Img, staticFile } from "remotion";
import { HEIGHT, WIDTH } from "../constants";
import type { StarRegion } from "./StarAnimation";

/**
 * Generic "reveal N equal cells of a cropped region from the source image,
 * one after another" primitive. This is the technique behind the star pop
 * (5 cells) and is reused for the Scene 3 benefit icons (3 cells) and the
 * Scene 4 headline/CTA (1 cell) — always real source pixels, never redrawn
 * artwork, matted against the surrounding flat background so the still
 * (unanimated) version underneath never shows through.
 */
export const CellPop: React.FC<{
  src: string;
  region: StarRegion;
  matteColor: string;
  startFrame: number;
  count?: number;
  popDurationFrames?: number;
  staggerFrames?: number;
  scaleFrom?: number;
  extraTransform?: (progress: number) => string;
}> = ({
  src,
  region,
  matteColor,
  startFrame,
  count = 1,
  popDurationFrames = 9,
  staggerFrames = 5,
  scaleFrom = 0.92,
  extraTransform,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const regionX = region.x * WIDTH;
  const regionY = region.y * HEIGHT;
  const regionW = region.w * WIDTH;
  const regionH = region.h * HEIGHT;
  const cellW = regionW / count;

  return (
    <div style={{ position: "absolute", inset: 0, width: WIDTH, height: HEIGHT }}>
      {Array.from({ length: count }).map((_, i) => {
        const localStart = startFrame + i * staggerFrames;
        const progress = spring({
          frame: frame - localStart,
          fps,
          durationInFrames: popDurationFrames,
          config: { damping: 200, stiffness: 110, mass: 0.6 },
        });
        const clamped = Math.max(0, Math.min(1, progress));
        const scale = interpolate(clamped, [0, 1], [scaleFrom, 1]);
        const opacity = clamped;
        const cellX = regionX + i * cellW;
        const extra = extraTransform ? extraTransform(clamped) : "";

        return (
          <React.Fragment key={i}>
            <div
              style={{
                position: "absolute",
                left: cellX,
                top: regionY,
                width: cellW,
                height: regionH,
                background: matteColor,
                opacity: 1 - opacity,
              }}
            />
            <div
              style={{
                position: "absolute",
                left: cellX,
                top: regionY,
                width: cellW,
                height: regionH,
                overflow: "hidden",
                opacity,
                transform: `scale(${scale}) ${extra}`,
                transformOrigin: "center center",
              }}
            >
              <Img
                src={staticFile(src)}
                style={{
                  position: "absolute",
                  left: -cellX,
                  top: -regionY,
                  width: WIDTH,
                  height: HEIGHT,
                  objectFit: "cover",
                }}
              />
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
};
