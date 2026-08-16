import React from "react";
import { Composition } from "remotion";
import { DURATION, FPS, HEIGHT, WIDTH } from "./constants";
import { Reel } from "./Reel";

export const Root: React.FC = () => {
  return (
    <>
      <Composition
        id="Reel"
        component={Reel}
        durationInFrames={DURATION}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
    </>
  );
};
