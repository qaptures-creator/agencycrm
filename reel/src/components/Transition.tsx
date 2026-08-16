import React from "react";
import { interpolate } from "remotion";
import { HEIGHT, WIDTH } from "../constants";

export type TransitionType = "maskedSlide" | "horizontalReveal" | "crossfadeScale";

/**
 * Wraps an incoming scene and animates it on/off screen for one of the
 * three transition styles used in the brief. `progress` is 0 (transition
 * not started) -> 1 (fully settled). Restrained, no spin/flash.
 */
export const TransitionLayer: React.FC<{
  type: TransitionType;
  progress: number;
  children: React.ReactNode;
}> = ({ type, progress, children }) => {
  const p = Math.max(0, Math.min(1, progress));

  if (type === "maskedSlide") {
    // Vertical upward reveal: incoming scene wipes up from the bottom edge
    // while gently sliding + crossfading in.
    const translateY = interpolate(p, [0, 1], [36, 0]);
    const revealPercent = interpolate(p, [0, 1], [100, 0]);
    return (
      <div
        style={{
          position: "absolute",
          inset: 0,
          width: WIDTH,
          height: HEIGHT,
          opacity: interpolate(p, [0, 1], [0, 1]),
          transform: `translateY(${translateY}px)`,
          clipPath: `inset(${revealPercent}% 0 0 0)`,
        }}
      >
        {children}
      </div>
    );
  }

  if (type === "horizontalReveal") {
    // Quick left-to-right wipe.
    const revealPercent = interpolate(p, [0, 1], [100, 0]);
    return (
      <div
        style={{
          position: "absolute",
          inset: 0,
          width: WIDTH,
          height: HEIGHT,
          opacity: interpolate(p, [0, 1], [0, 1], { extrapolateRight: "clamp" }),
          clipPath: `inset(0 ${revealPercent}% 0 0)`,
        }}
      >
        {children}
      </div>
    );
  }

  // crossfadeScale: plain crossfade with a very small scale settle.
  const scale = interpolate(p, [0, 1], [1.025, 1]);
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        width: WIDTH,
        height: HEIGHT,
        opacity: p,
        transform: `scale(${scale})`,
      }}
    >
      {children}
    </div>
  );
};
