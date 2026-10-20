# Mochi-Puff 3D Interactive Showcases & Clean Live Audio Control

This plan resolves the unintended offline browser TTS voice firing when turning off the microphone or using Gemini 3.8 Live, and expands Mochi-Puff's 3D world with three new multi-part interactive experiences: **Magic Wand, Levitation & Butterflies**, **3D Selfie Camera Pose & Funny Props**, and **3D Musical Concert with Guitar & Dhol**.

## User Review & Critical Decisions

> [!IMPORTANT]
> Below is a summary of your confirmed choices from our questions, along with the root-cause explanation of why offline TTS played when turning off the microphone.

- **Confirmed Decision 1 — 3 New Interactive 3D Experiences**:
  1. **3D Magic Wand, Levitation & Butterflies**: Mochi-Puff holds a glowing star-tipped 3D magic wand, levitates gently above the ground with a sparkle ring, and summons fluttering 3D colorful butterflies that orbit around the scene.
  2. **3D Selfie Camera Pose & Funny Props**: Mochi-Puff strikes playful peace-sign / wink poses with a 3D vintage camera prop, triggering a crisp studio camera flash effect, Polaroid-style frame animation, and quick-swap funny 3D props (starry party glasses, bow-tie, and comedy mustache).
  3. **3D Musical Concert with Guitar & Dhol**: Mochi-Puff rocks out with a procedural 3D acoustic/electric guitar or traditional festive Dhol drum, accompanied by floating 3D musical notes, rhythmic body bounce, and synthesized Web Audio beats.
- **Confirmed Decision 2 — Strict Silence of Offline Browser TTS (`speechSynthesis`)**:
  - **Why Offline TTS Played When Stopping the Mic**: When you clicked Mochi-Puff to turn off the microphone, `disconnectLiveAPI()` set `isConnected = false` and called `recognition.stop()`. In browsers, calling `recognition.stop()` immediately flushes buffered speech and fires one final `onresult` event. Because `isConnected` had just been set to `false`, the fallback handler assumed Gemini Live was offline and triggered `window.speechSynthesis` (offline browser TTS) right after you turned the mic off. Additionally, instant keyword matches were calling `speakCuteCartoonVoice` even while Gemini Live was active.
  - **Chosen Fix**: Immediately abort and ignore any `SpeechRecognition` results, in-flight audio requests, or `speechSynthesis` utterances whenever `userWantsListening` is `false` or when Gemini 3.8 Live is actively connected, ensuring 100% silence on mic stop and pure Gemini 3.8 Live voice during sessions.

---

## 1. Overview & Core Concept

- **What It Does**: Enhances Mochi-Puff as an expressive, touch-and-voice interactive 3D companion. Clicking Mochi-Puff cleanly toggles the microphone ON and OFF without any stray offline TTS voice speaking after stopping. While talking or using the scene dock, users can trigger magical spells, selfie photo shoots, and musical concerts via voice commands (in Hindi, Hinglish, or English) or direct UI controls.
- **Target Audience / Persona**: Users who want a lifelike, responsive 3D virtual pet and companion that reacts instantaneously to voice commands and touch with Pixar-inspired procedural 3D props and zero audio overlap.
- **Key Value**: Eliminates jarring robotic browser TTS interruptions when disconnecting the mic and brings rich 3D visual variety to play sessions.

---

## 2. User Experience & Visual Design

- **Key User Flows**:
  1. **Click-to-Talk & Instant Silence on Stop**:
     - Click Mochi-Puff once → Mochi boops happily, opens the microphone, and connects to Gemini 3.8 Live.
     - Speak naturally in Hindi or English (e.g., *"Mochi jadoo dikhao"*, *"Selfie lete hain"*, *"Dhol bajao"*).
     - Click Mochi-Puff again → All audio streams, WebSockets, SpeechRecognition callbacks, and browser TTS queues are immediately cancelled and gated so no delayed voice ever plays after stopping.
  2. **Magic Wand, Levitation & Butterflies Flow**:
     - Triggered by voice (*"magic"*, *"jadoo"*, *"wand"*, *"butterfly"*, *"titli"*, *"fly"*) or the bottom scene dock.
     - Mochi-Puff equips a golden star-tipped wand in its right hand, floats upward in a smooth anti-gravity hover, and spawns 6–8 multi-wing 3D butterflies with animated flapping wings and glowing fairy dust trails.
  3. **3D Selfie Camera Pose & Funny Props Flow**:
     - Triggered by voice (*"selfie"*, *"photo"*, *"camera"*, *"pose"*, *"chashma"*, *"mustache"*) or the bottom scene dock.
     - Mochi-Puff tilts its head into a cute model pose, equips funny 3D props (oversized star glasses, dapper bow-tie, or curly mustache), raises a 3D toy camera, and triggers a soft studio flash with a shutter sound effect.
  4. **3D Musical Concert (Guitar & Dhol) Flow**:
     - Triggered by voice (*"music"*, *"concert"*, *"guitar"*, *"dhol"*, *"bhangra"*, *"song"*) or the bottom scene dock.
     - Mochi-Puff holds a composite 3D guitar or festive Indian Dhol slung across its body, strumming/drumming in sync with procedural Web Audio melodies and rising 3D musical note geometries.
- **Visual Identity & Theme**:
  - *Aesthetic Direction*: Tactile, studio-lit 3D toy showcase with a clean, unobstructed central viewport and a compact bottom control dock.
  - *Color Palette & Mood*: Warm pastel studio environment (`--background` soft cream/sky gradients), iridescent gold and magenta accents for magic spells, warm wood and brass PBR finishes for the guitar and Dhol, and glossy polycarbonate/metal materials for the camera and props.
  - *Typography & Hierarchy*: Clean geometric UI labels (`Plus Jakarta Sans` / `DM Sans`) in the collapsible bottom dock with single-line button affordances (`whitespace-nowrap`).
- **Interactive Feedback & Motion**:
  - Frame-rate independent spring physics and exponential damping (`THREE.MathUtils.damp`) for levitation height, butterfly wing flapping (`Math.sin(t * 14)`), and rhythmic concert head-bopping.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Strict Audio State Gate on Mic Stop & Live Sessions**
  - *Chosen Approach*: Introduce a session token (`activeSessionId`) and strict state checks (`if (!userWantsListening) return;`) inside `recognition.onresult`, `handleUserMessage`, `handleAudioUtterance`, and `speakCuteCartoonVoice`. Furthermore, when Gemini 3.8 Live (`isConnected`) is active, `speakCuteCartoonVoice` will never invoke `window.speechSynthesis`, allowing Gemini 3.8 Live's native audio stream to be the sole voice.
  - *Why*: Guarantees that stopping the microphone silences Mochi-Puff immediately with zero trailing sentences from `window.speechSynthesis`, and prevents two voices from speaking simultaneously.
  - *Alternatives Considered*: Letting `recognition.stop()` finish processing its last buffer—rejected because users expect clicking Mochi-Puff a second time to act as an immediate mute/stop switch.

- **Decision 2: Procedural Multi-Part 3D Props & Web Audio Synthesis**
  - *Chosen Approach*: Construct the Magic Wand, Butterflies, Selfie Camera, Funny Props, Guitar, Dhol, and Floating Musical Notes as composite `THREE.Group` hierarchies using PBR materials (`MeshStandardMaterial` / `MeshPhysicalMaterial`) and synthesize shutter clicks, magic chimes, guitar chords, and Dhol beats via the Web Audio API.
  - *Why*: Ensures zero external asset loading delays, zero 404 errors, and 60fps responsiveness synchronized with Mochi-Puff's body deformations.

---

## 4. Technical Architecture & Data Strategy *(Technical Reference)*

- **Architecture & Component Diagram**:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        USER INTERACTION LAYER                           │
│   [ Click on 3D Mochi-Puff ]          [ Bottom Scene Dock Buttons ]     │
└───────────────┬─────────────────────────────────────────┬───────────────┘
                │                                         │
                ▼                                         ▼
┌───────────────────────────────────────┐ ┌───────────────────────────────┐
│     VOICE & SESSION CONTROLLER        │ │   3D ACTION & PROP ENGINE     │
│  • Click Toggle (Connect / Disconnect)│ │  • Magic Wand + Butterflies   │
│  • Session Token Gate (Stops late TTS)│ │  • Selfie Pose + Funny Props  │
│  • Gemini 3.8 Live WebSocket Stream   │ │  • Concert (Guitar & Dhol)    │
│  • Silence Offline TTS when Live/Off  │ │  • Procedural Web Audio SFX   │
└───────────────┬───────────────────────┘ └───────────────┬───────────────┘
                │                                         │
                └───────────────────┬─────────────────────┘
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                     THREE.JS SCENE & ANIMATION LOOP                     │
│  • Composite 3D Prop Groups attached to Mochi-Puff Root & Scene         │
│  • Spring Kinematics, Levitation Bobbing & Particle Orbits              │
└─────────────────────────────────────────────────────────────────────────┘
```

- **Data Model & State**:
  - `userWantsListening` & `sessionGenerationId`: Incremented on every connect/disconnect toggle so any asynchronous callback from an older session is immediately discarded.
  - `creature.animState`: Extended with `magicMode` (`wandActive`, `levitationWeight`, `butterfliesVisible`), `selfieMode` (`cameraActive`, `flashIntensity`, `funnyPropType`), and `concertMode` (`instrument`: `'guitar' | 'dhol' | null`, `beatPhase`).
- **Interactive Component & State Mapping**:
  - **Mochi-Puff 3D Click Handler**: Toggles `connectLiveAPI()` / `disconnectLiveAPI()`, increments `sessionGenerationId`, cancels `speechSynthesis`, and aborts `SpeechRecognition` (`recognition.abort()`) so no trailing `onresult` event fires.
  - **Voice Command & Tool Router**: Maps both Gemini 3.8 Live tool calls (`trigger_creature_action`) and instant voice keywords (`magic`, `jadoo`, `butterfly`, `selfie`, `photo`, `guitar`, `dhol`, `concert`) to the new 3D animations and procedural sound effects.
  - **Bottom Dock Quick-Action Controls**: Adds one-click interactive buttons for **Magic Spell**, **Selfie Pose**, and **Music Concert** so users can also trigger the new 3D showcases directly with a single tap.
