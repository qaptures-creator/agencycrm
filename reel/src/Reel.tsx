import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { HEIGHT, TRANSITIONS, WIDTH } from "./constants";
import { TransitionLayer } from "./components/Transition";
import { SceneOne } from "./scenes/SceneOne";
import { SceneTwo } from "./scenes/SceneTwo";
import { SceneThree } from "./scenes/SceneThree";
import { SceneFour } from "./scenes/SceneFour";

const useTransitionProgress = (t: { start: number; end: number }) => {
  const frame = useCurrentFrame();
  return interpolate(frame, [t.start, t.end], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
};

export const Reel: React.FC = () => {
  const oneToTwo = useTransitionProgress(TRANSITIONS.oneToTwo);
  const twoToThree = useTransitionProgress(TRANSITIONS.twoToThree);
  const threeToFour = useTransitionProgress(TRANSITIONS.threeToFour);

  return (
    <AbsoluteFill style={{ width: WIDTH, height: HEIGHT, backgroundColor: "#000" }}>
      {/* Base layer: Scene 1 plays underneath everything. */}
      <SceneOne />

      {/* Masked upward slide + crossfade into Scene 2. */}
      <TransitionLayer type="maskedSlide" progress={oneToTwo}>
        <SceneTwo />
      </TransitionLayer>

      {/* Quick horizontal reveal into Scene 3. */}
      <TransitionLayer type="horizontalReveal" progress={twoToThree}>
        <SceneThree />
      </TransitionLayer>

      {/* Crossfade + subtle scale into Scene 4. */}
      <TransitionLayer type="crossfadeScale" progress={threeToFour}>
        <SceneFour />
      </TransitionLayer>
    </AbsoluteFill>
  );
};
