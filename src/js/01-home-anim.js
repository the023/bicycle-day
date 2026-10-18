/* ════════════════════════ home-screen logo animation (T6) ════════════════════════
   Rendered through the same FS_SCENE/FS_SHOW shaders onto a small canvas inside #home-art.
   Timeline (pure function of the home clock t, seeded per page load; ?homeseed=<n> fixes it, ?hometime=<s> fixes the clock):
     0..HOME_INTRO s : the logo with little effects + sparse subtle glitches (display pass), rising slightly
     then alternating STRONG (5-15 s, 1-2 geometry effects + 1 colour effect, different each time) and CALM (5-15 s, close to the plain logo),
     every change eased by smoothstep over HOME_EASE s. No strobe: flashes are slow (<1 Hz) and in the display pass only.
   Strengths below are the gentle levels, scaled by homeBase(t) / the strong envelope. */
const HOME_INTRO = 12;
const HOME_EASE = 2;
const HOME_CALM = 0.5;             // calm-phase level (fraction of the gentle strengths)
const HOME_WARP = 0.14;           // gentle warp strength
const HOME_HUE_SPEED = 0.07;      // hue sway speed (rad/s); the hue swings back and forth, it never runs away
const HOME_PAL = 0.08;            // palette blend
const HOME_BREATH = 0.08;        // breath
const HOME_ABER = 0.1;          // aberration (param)
const HOME_ZOOM_WOB = 0.02;       // tiny zoom wobble factor
const HOME_FB = 0.02;            // weak feedback trails
const HOME_ANCHOR = 0.06;        // faint source anchor
const HOME_ROTT = 0.0;            // very slow rotation (kept 0 to stay readable)

