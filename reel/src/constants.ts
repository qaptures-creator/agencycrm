// Composition-wide timing constants. Keep these in sync with the brief:
// 1080x1350, 30fps, exactly 150 frames (5.00s).

export const WIDTH = 1080;
export const HEIGHT = 1350;
export const FPS = 30;
export const DURATION = 150;

// Scene boundaries (the frame each scene is considered "on screen" from/to).
// These match the brief's suggested split: 0-33 / 33-74 / 74-111 / 111-150.
export const SCENE_BOUNDS = {
  scene1: { start: 0, end: 33 },
  scene2: { start: 33, end: 74 },
  scene3: { start: 74, end: 111 },
  scene4: { start: 111, end: 150 },
} as const;

// Each transition is ~0.25s (7-8 frames at 30fps), straddling the scene
// boundary so the incoming scene is fully settled a couple of frames after
// the nominal cut point.
export const TRANSITION_FRAMES = 8;

export const TRANSITIONS = {
  oneToTwo: {
    start: SCENE_BOUNDS.scene2.start - 6, // ~frame 27 (~0.9s), matches "begin transition at ~0.85s"
    end: SCENE_BOUNDS.scene2.start + 2,
    type: "maskedSlide" as const,
  },
  twoToThree: {
    start: SCENE_BOUNDS.scene3.start - 5,
    end: SCENE_BOUNDS.scene3.start + 3,
    type: "horizontalReveal" as const,
  },
  threeToFour: {
    start: SCENE_BOUNDS.scene4.start - 5,
    end: SCENE_BOUNDS.scene4.start + 3,
    type: "crossfadeScale" as const,
  },
};

// Final fade to navy/black: starts at 4.85s and finishes exactly at 5.00s.
export const FINAL_FADE_START = Math.round(4.85 * FPS); // frame 146 (approx)
export const FINAL_FADE_END = DURATION; // frame 150

// NOTE: filenames below are what SceneImage/staticFile look for. Drop the
// real exports into public/assets using these exact names (any raster
// format works — update the extension here if you export .jpg instead).
export const ASSETS = {
  scene1: "assets/scene1-another-5-star.png",
  scene2: "assets/scene2-review-card.png",
  scene3: "assets/scene3-modern-fleet.png",
  scene4: "assets/scene4-thank-you.png",
};

// Star-row bounding boxes, expressed as a fraction of the 1080x1350
// canvas (x, y = top-left; w, h = size). Calibrated against the real
// supplied assets via `npm run calibrate` (scene1/scene2/scene4 — gold
// pixel colour thresholding) plus a small padding margin for anti-aliased
// edges. Re-run calibrate if the source images are re-exported.
export const STAR_REGIONS = {
  // "ANOTHER 5 STAR EXPERIENCE" — row under the headline.
  scene1: { x: 0.05, y: 0.812, w: 0.35, h: 0.03 },
  // Small "4.5 ★★★★★" row inside the white review card, next to the rating.
  scene2: { x: 0.235, y: 0.508, w: 0.24, h: 0.04 },
  // "THANK YOU" stars, above the "BOOK YOUR JOURNEY TODAY" button.
  scene4: { x: 0.08, y: 0.838, w: 0.33, h: 0.045 },
};

// Background colour sampled directly from the real assets near each star
// row (a few px outside the star glyphs), used to matte the row during
// the pop-in so the pre-baked static stars don't "ghost" behind the
// animated ones.
export const STAR_MATTE_COLOR = {
  scene1: "#403c33", // dark asphalt, slight warm/olive cast
  scene2: "#fefefe", // white review card
  scene4: "#1c1b18", // near-black asphalt
};

// Scene 2 — the white review-card panel (rating, quote, name) as it sits
// over the darkened photo. Calibrated by detecting the actual white-card
// bounding box in the real asset.
export const REVIEW_CARD_REGION = { x: 0.105, y: 0.393, w: 0.79, h: 0.49 };

// Scene 3 — the three benefit icon+label cells ("Comfortable seating",
// "Air conditioned vehicles", "USB charging points"), as one combined row.
// Calibrated by bounding the gold icon glyphs + white label text.
export const ICON_ROW_REGION = { x: 0.045, y: 0.538, w: 0.945, h: 0.07 };
export const ICON_ROW_MATTE = "#1a1712";

// Scene 4 — "THANK YOU" headline and the CTA button block. Calibrated by
// bounding the white headline glyphs / the gold CTA border rectangle.
export const THANK_YOU_TEXT_REGION = { x: 0.085, y: 0.698, w: 0.56, h: 0.095 };
export const CTA_REGION = { x: 0.085, y: 0.865, w: 0.51, h: 0.105 };
export const SCENE4_TEXT_MATTE = "#242119";
export const SCENE4_CTA_MATTE = "#121110";
