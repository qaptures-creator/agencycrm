import React from "react";
import { Img, staticFile } from "remotion";
import { HEIGHT, WIDTH } from "../constants";

/**
 * Renders one of the four supplied designs edge-to-edge at full composition
 * size. `object-fit: cover` with the source already authored at 1080x1350
 * means this is a 1:1 passthrough — no cropping of logos/text/coaches.
 */
export const SceneImage: React.FC<{
  src: string;
  style?: React.CSSProperties;
}> = ({ src, style }) => {
  return (
    <Img
      src={staticFile(src)}
      style={{
        width: WIDTH,
        height: HEIGHT,
        objectFit: "cover",
        display: "block",
        ...style,
      }}
    />
  );
};
