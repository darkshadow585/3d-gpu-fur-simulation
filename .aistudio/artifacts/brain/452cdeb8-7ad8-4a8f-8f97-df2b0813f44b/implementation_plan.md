# Mochi-Puff 3D — Expressive Anime Tears, Interactive Play Props & Mobile 60 FPS Optimization

This plan upgrades Mochi-Puff's 3D crying tears so they render clearly outside the volumetric fur shells with splash droplets, introduces three new interactive 3D play systems (Feeding Treats, Salon Blow-Dryer, and Floating Soap Bubbles), resolves the microphone permission error in the preview iframe, and adds automatic Mobile 60 FPS GPU scaling.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> Since you asked us to choose the best combination of features, tear styling, and mobile optimizations, we have selected the highest-impact options below. Click **Proceed** to build all of them, or let us know if you want any adjustments.

- **Confirmed Decision 1 — 3D Anime Tears Over Fur ("Aansu Sahi Se Banao")**: Big, high-gloss 3D anime teardrops and watery eye-rim pools positioned outside the fur shell envelope (`z > 1.08`) so they never get buried inside the fur, complete with ground splash droplets when tears fall.
- **Confirmed Decision 2 — New Cool Interactive Features**:
  1. **3D Feeding & Treats ("Cake khilao" / Key `F`)**: Spawns a 3D Strawberry Shortcake that Mochi happily munches with chewing animations, *"Nom-nom!"* vocal sounds, and happy heart bursts.
  2. **3D Hair Salon Blow-Dryer ("Dryer chalao" / Key `D`)**: Spawns a 3D pastel Hair Dryer that blows directional wind waves across Mochi's GPU fur, drying wet fur and puffing up her fluffiness.
  3. **Interactive Floating Soap Bubbles ("Bubbles udao" / Key `V`)**: Spawns iridescent 3D soap bubbles floating around Mochi and her mini friends (**Chintu, Pintu, Golu, Molu**) that pop with cute chimes when tapped or jumped into.
- **Confirmed Decision 3 — Mobile 60 FPS Smooth Engine & Mic Permission Fix**: Automatic mobile GPU tiering (adaptive shell/strand counts, capped mobile DPR, dynamic touch-drag boost, and background tab suspension) plus iframe microphone permission configuration with graceful zero-error fallback.

---

## 1. Overview & Core Concept

- **What It Does**: Transforms Mochi-Puff into a complete, ultra-responsive 3D virtual pet experience on both desktop and mobile—featuring visible, expressive 3D anime tears, interactive feeding, hair-dryer grooming, bubble popping, and a 60 FPS mobile rendering pipeline.
- **Target Audience / Persona**: Users interacting with Mochi-Puff via voice (Hindi/Hinglish/English), touch gestures on mobile phones, or mouse/keyboard on desktop.
- **Key Value**: Eliminates the microphone permission error, makes crying emotions visually unmistakable over dense 3D fur, adds playful toy/care interactions, and guarantees buttery-smooth 60 FPS touch interaction on mobile devices.

---

## 2. User Experience & Visual Design

- **Key User Flows**:
  1. **Expressive Crying Flow (`"Cry"` / Scolding / Key `2`)**: Mochi's eyes well up with shimmering cyan-tinted tear pools; oversized, glossy 3D teardrops roll down the outside of her furry cheeks in curved arcs and burst into tiny splash rings at her feet.
  2. **3D Treat Feeding Flow (`"Khana khilao"` / `"Cake khao"` / Key `F`)**: A 3D Strawberry Shortcake with a red berry on top appears in front of Mochi. Mochi leans down, takes 3 animated bites as the cake shrinks piece by piece, plays high-pitched *"Nom-nom-nom! Yummy!"* sounds, and finishes with a happy jump.
  3. **3D Salon Blow-Dryer Flow (`"Hair dryer chalao"` / `"Baal sukhao"` / Key `D`)**: A 3D pastel Salon Hair Dryer orbits gently near Mochi, projecting animated air-ring waves that push her GPU fur strands dynamically, dry any rain wetness, and make her fur extra fluffy.
  4. **Floating Soap Bubbles Flow (`"Bubbles udao"` / Key `V`)**: Translucent rainbow-tinted 3D soap bubbles float upward around Mochi and her clones; tapping any bubble on mobile/desktop (or Mochi jumping into one) pops it with a high-pitched *"Pop! Hehe!"* giggle.
  5. **Zero-Error Voice & Touch Flow**: Clicking Mochi requests microphone access cleanly with iframe permissions enabled; if the browser or device blocks microphone access, Mochi still boops, giggles, and responds to touch/keyboard without logging any console errors.

- **Visual Identity & Theme**:
  - *Aesthetic Direction*: Tactile kawaii 3D plush toy studio with physically based eye/tear refraction (`MeshPhysicalMaterial` with clearcoat and transmission) and soft glassmorphic floating controls.
  - *Color Palette & Mood*:
    - `--background`: Deep studio radial canvas (`#0f0c1b` to `#1e1b4b`) and bright nature/highrise presets.
    - `--primary`: Sakura Mochi pink (`#ff5c93`) and electric violet (`#7c3aed`).
    - `--accent`: Glossy sky-cyan (`#38bdf8`) for refractive 3D tears and soap bubbles; warm cream (`#fff7ed`) & strawberry red (`#f43f5e`) for 3D cake treats.
  - *Typography & Hierarchy*: Clean `Google Sans` / `Plus Jakarta Sans` UI controls with single-line labels (`whitespace-nowrap`), adhering to the 15% mobile sticky cap so the 3D viewport remains unobstructed.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1 — Exterior Surface Offset for 3D Tears**:
  - *Chosen Approach*: Offset teardrop trajectories to `z = 1.10..1.16` in local head space with enlarged geometry (`1.8x` scale), bright specular catchlights, and a cheek-stream trail + ground splash particles.
  - *Why*: Mochi's 64 fur shells extend outward from the base skin mesh by up to `0.31` units; placing tears close to the skin (`z ≈ 0.99`) caused the fur shells to occlude them. Pushing tears onto the outer fur surface makes them crystal-clear from every camera angle.

- **Decision 2 — Automatic Mobile 60 FPS GPU Scaling**:
  - *Chosen Approach*: Detect mobile/touch devices at startup and during resize, automatically scaling shell layers (`24` shells vs `64`), instanced hair strands (`16,000` vs `60,000`), clamping mobile DPR to `1.25`, and applying a temporary resolution step-down during active touch-drag gestures.
  - *Why*: Full 64-shell + 60k-strand GPGPU passes can bottleneck mobile integrated GPUs; adaptive scaling preserves the lush fluffy look while keeping touch rotation and petting locked at 60 FPS.

- **Decision 3 — Iframe Microphone Permission + Non-Throwing Fallback**:
  - *Chosen Approach*: Add `"microphone"` to `requestFramePermissions` in application metadata and replace `console.error` in microphone/socket catch blocks with silent state transitions and friendly HUD hints.
  - *Why*: Prevents browser permission denials from triggering runtime error overlays while allowing users with microphones to talk seamlessly.

---

## 4. Technical Architecture & Data Strategy *(Technical Reference)*

### Architecture & Component Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                   3D Viewport & Input Controller (main)                 │
│  • Pointer / Touch Raycaster (Body, Mini Friends, Pop-able 3D Bubbles)  │
│  • Mobile 60 FPS Governor (Auto GPU Tier, Touch-Drag DPR Boost, Pause)  │
└───────────────┬─────────────────────────────────────────┬───────────────┘
                │                                         │
                ▼                                         ▼
┌───────────────────────────────────────┐ ┌───────────────────────────────┐
│     Mochi-Puff 3D Creature Engine     │ │  Voice & Sound Synth Engine   │
│  • Outer-Fur 3D Anime Tears & Splash  │ │  • Iframe Mic Permission Safe │
│  • 3D Strawberry Cake Feeding System  │ │  • Gemini Live Tool Handlers  │
│  • 3D Salon Hair Dryer + Wind Waves   │ │  • Formant 'Mochi' Vocal SFX  │
│  • Iridescent 3D Soap Bubble Spawner  │ │    (Nom-Nom, Dryer, Bubble)   │
└───────────────────────────────────────┘ └───────────────────────────────┘
```

### Interactive Component & State Mapping

| Interactive Feature | Trigger (Voice / Touch / Key) | 3D State Mutation & Visual Response | Audio & Physics Coupling |
| :--- | :--- | :--- | :--- |
| **3D Anime Tears (`cry`)** | Voice *"Rona mat"* / Scolding / Key `2` | Welling lower-eyelid tear pools + 6 oversized glossy droplets rolling outside fur (`z = 1.12`) + cheek tear ribbons + ground splash rings | Plays two-stage baby whimper + water-drop plinks |
| **3D Treat Feeding (`feed`)** | Voice *"Khana khilao"*, *"Cake khao"* / Key `F` | Spawns 3D Strawberry Cake at `z = 1.35`; Mochi leans forward in 3 bite cycles; cake scales down per bite; floating hearts burst at end | Plays *"Nom-nom-nom!"* chewing squeaks + happy giggle |
| **3D Hair Dryer (`hair_dryer`)** | Voice *"Dryer chalao"*, *"Baal sukhao"* / Key `D` | Spawns 3D Salon Dryer + animated wind rings; clears `wetness` to `0`; boosts `uWindStrength` and fluffs `uFurLength` | Plays warm air whoosh + happy fluffy Mochi chirp |
| **3D Soap Bubbles (`bubbles`)** | Voice *"Bubbles udao"* / Key `V` / Tap bubble in 3D | Spawns 18 iridescent 3D bubbles rising around Mochi & friends; raycast tap or Mochi hop pops individual bubbles | Plays high-pitched *"Pop!"* plink + Mochi giggle |
| **Mobile 60 FPS Governor** | Automatic on Mobile / Touch-drag / Tab visibility | Sets mobile strand/shell budget, lowers DPR during active touch-orbit, pauses loop when tab hidden | Zero-GC typed-array updates in render loop |
