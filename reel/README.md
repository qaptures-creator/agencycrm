# NP Coaches — animated social reel

Remotion project that animates the four supplied 4:5 static designs into a
5-second, 1080x1350, 30fps social reel (Instagram feed/Reels). Output is
150 frames total, split roughly:

- Scene 1 — "Another 5 Star Experience": frames 0–33
- Scene 2 — review card: frames 33–74
- Scene 3 — "Modern Fleet": frames 74–111
- Scene 4 — "Thank You" / CTA: frames 111–150

Transitions (masked upward slide, horizontal reveal, crossfade+scale) each
straddle a scene boundary for ~0.25s. See `src/constants.ts` for the exact
frame math and `src/Reel.tsx` for how scenes/transitions are layered.

## 1. Drop in the real source images

This repo currently ships with generated **placeholder** images (solid
colour blocks) so the project runs out of the box. Replace them with the
real exports, using these **exact filenames**, in `public/assets/`:

| File | Design |
| --- | --- |
| `scene1-another-5-star.png` | "ANOTHER 5 STAR EXPERIENCE" (1/4) |
| `scene2-review-card.png` | NP Coaches Ltd review card (2/4) |
| `scene3-modern-fleet.png` | "MODERN FLEET — Built for comfort" (3/4) |
| `scene4-thank-you.png` | "THANK YOU for trusting NP Coaches" (4/4) |

Each should be exactly (or very close to) 1080×1350 — `object-fit: cover`
is used, so anything off-ratio will be center-cropped. If your exports are
`.jpg` instead of `.png`, either rename them or update the extensions in
`ASSETS` in `src/constants.ts`.

No code changes are otherwise needed — the four scene components already
point at these paths via `staticFile()`.

## 2. Calibrate the star / icon / text crop regions

Because the source designs are flat, single-layer images (stars, benefit
icons, and the "THANK YOU" text are baked into the photo, not separate
layers), the "sequential star pop", icon stagger, and text scale are done
by cropping small regions straight out of the same source image and
animating those crops in over a matching-colour matte — see the comment
at the top of `src/components/CellPop.tsx` for how this works. It reuses
the real pixels; nothing is redrawn.

The region coordinates in `src/constants.ts` (`STAR_REGIONS`,
`ICON_ROW_REGION`, `THANK_YOU_TEXT_REGION`, `CTA_REGION`) were **estimated
from the screenshots** supplied in the brief and will likely need a small
nudge once the real files are in place. Two ways to tune them:

1. **Automatic (stars only):** `npm run calibrate` scans the real
   `scene1`/`scene2`/`scene4` assets for the gold star colour and prints a
   tighter `{x, y, w, h}` box for each — paste the results into
   `STAR_REGIONS`.
2. **Manual (icons, text, CTA, or if calibrate comes back empty):** open
   `npm run dev`, scrub to the relevant scene, and nudge the `x/y/w/h`
   fractions in `constants.ts` until the matte'd region lines up exactly
   with the source artwork. Values are fractions of the 1080×1350 canvas
   (`x`/`y` = top-left, `w`/`h` = size), so e.g. `y: 0.5` is halfway down.

Also double check `STAR_MATTE_COLOR` / `ICON_ROW_MATTE` / `SCENE4_MATTE` —
they should match the flat background colour immediately behind each
region in the real asset so the pop-in reads as seamless.

## 3. Preview

```bash
npm install
npm run dev
```

Opens Remotion Studio at the `Reel` composition — scrub the timeline, or
hit play to loop the 5s reel continuously for review.

## 4. Render an MP4

```bash
npm run build
```

Outputs `out/npc-reel.mp4` (H.264, yuv420p — compatible with IG feed/Reels
upload).

## Project structure

```
src/
  constants.ts          composition timing, scene boundaries, crop regions
  Root.tsx               registers the "Reel" composition (1080x1350 @30fps, 150f)
  Reel.tsx                assembles the 4 scenes + transitions
  scenes/
    SceneOne.tsx          zoom-out + drift + sequential star pop
    SceneTwo.tsx           darken + review card float-in + star shimmer
    SceneThree.tsx         downward camera settle + icon stagger
    SceneFour.tsx           zoom-in settle + star glow + text/CTA reveal + fade to black
  components/
    SceneImage.tsx          full-bleed object-fit: cover image
    Transition.tsx           masked slide / horizontal reveal / crossfade+scale
    CellPop.tsx               generic "reveal N crops of the source image one after another"
    StarAnimation.tsx         star-specific wrappers around CellPop + shimmer sweep
scripts/
  make-placeholders.cjs    regenerates the placeholder stand-in images
  find-star-regions.ts     auto-calibration for STAR_REGIONS (npm run calibrate)
public/assets/             the 4 source images (placeholders until replaced)
```

## Sound design placeholders

No audio is wired in yet (none was supplied). The brief calls for four cues
— transition whooshes, a star tick, a review-card impact, and a CTA whoosh
— at each scene boundary. To add them: drop files into `public/audio/` and
add `<Audio src={staticFile(...)} startFrom={...} />` calls (from
`remotion`) at the transition frame numbers already defined in
`TRANSITIONS`/`FINAL_FADE_START` in `src/constants.ts`, so swapping the
soundtrack later is a one-file change.
