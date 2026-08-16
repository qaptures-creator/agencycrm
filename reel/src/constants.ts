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

// Approximate star-row bounding boxes, expressed as a fraction of the
// 1080x1350 canvas (x, y = top-left; w, h = size), estimated from the
// supplied screenshots. These are ESTIMATES ONLY — run `npm run calibrate`
// once the real source images are in /public/assets to auto-detect the
// exact gold star-icon bounds by colour thresholding, then paste the
// results back in here.
export const STAR_REGIONS = {
  // "ANOTHER 5 STAR EXPERIENCE" — row under the headline, above CTA area.
  scene1: { x: 0.083, y: 0.788, w: 0.29, h: 0.034 },
  // Small "4.5 ★★★★★" row inside the white review card, next to the rating.
  scene2: { x: 0.255, y: 0.475, w: 0.165, h: 0.024 },
  // "THANK YOU" stars, above the "BOOK YOUR JOURNEY TODAY" button.
  scene4: { x: 0.083, y: 0.845, w: 0.29, h: 0.034 },
};

// Background colour sampled near each star row, used to matte the row
// during the pop-in so the pre-baked static stars don't "ghost" behind the
// animated ones. Re-check with the real asset (see calibrate script).
// Scene 2 — the white review-card panel (rating, quote, name) as it sits
// over the darkened photo.
export const REVIEW_CARD_REGION = { x: 0.0, y: 0.585, w: 1.0, h: 0.33 };

export const STAR_MATTE_COLOR = {
  scene1: "#171716",
  scene2: "#ffffff",
  scene4: "#171716",
};

// Scene 3 — the three benefit icon+label cells ("Comfortable seating",
// "Air conditioned vehicles", "USB charging points"), as one combined row.
export const ICON_ROW_REGION = { x: 0.05, y: 0.535, w: 0.9, h: 0.045 };
export const ICON_ROW_MATTE = "#0c0c0c";

// Scene 4 — "THANK YOU" headline and the CTA button block.
export const THANK_YOU_TEXT_REGION = { x: 0.08, y: 0.695, w: 0.62, h: 0.07 };
export const CTA_REGION = { x: 0.08, y: 0.87, w: 0.56, h: 0.06 };
export const SCENE4_MATTE = "#141412";
