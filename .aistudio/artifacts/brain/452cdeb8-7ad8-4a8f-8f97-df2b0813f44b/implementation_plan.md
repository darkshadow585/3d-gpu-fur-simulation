# Mochi-Puff: 3D Hologram Explainer & Topper Blackboard Viva Plan

This update elevates Mochi-Puff's **"Sararati Class Topper"** experience by adding two context-aware 3D interactive features: an automatic **3D Hologram Explainer Projector** that materializes rotating 3D models beside Mochi when she explains complex topics, and a **Topper vs. Backbencher 3D Blackboard Viva Quiz** where Mochi challenges the user to rapid-fire questions, roasts wrong answers, and awards 3D Gold Medals.

## User Review & Critical Decisions

> [!IMPORTANT]
> Both features are designed to trigger **automatically based on conversation context** (voice or text) without cluttering the viewport with permanent menus, while also supporting natural voice commands like *"Viva lo"*, *"Quiz khelo"*, or asking about complex topics (*Black Holes, Quantum Physics, DNA, AI, Solar System, Calculus*).

- **Confirmed Feature 1 — 3D Hologram Projector for Complex Topics**: Automatically spawns a glowing sci-fi holographic projector pad and an animated 3D topic model (*Black Hole & Accretion Disk, Quantum Atom Orbits, DNA Double Helix, Solar System Orbits, or Neural Network Nodes*) whenever a complex science, tech, space, or math topic is discussed.
- **Confirmed Feature 2 — Topper vs. Backbencher 3D Blackboard Quiz**: Automatically deploys a floating 3D classroom blackboard with dynamic canvas-textured chalk text, live score tracking, and 3D Gold Medal / Dunce Hat props when the user asks for a quiz, test, viva, riddle, or challenge.
- **Confirmed Trigger Mode — Context-Driven Automatic Activation**: Triggered seamlessly from spoken/typed conversation context, Gemini Live tool calls, and instant keyword detection.

---

## 1. Overview & Core Concept

- **What It Does**:
  1. **3D Hologram Explainer Projector**: When Mochi answers a complex question (e.g., Quantum Mechanics, Black Holes, DNA, Neural Networks, Space, or Math), she puts on her topper glasses, activates a glowing cyan/magenta holographic emitter beside her, and projects a rotating 3D scientific model while delivering her signature *Roast + High-IQ Explanation + Bolti-Band Comeback*.
  2. **Topper vs. Backbencher 3D Blackboard Viva**: When the user challenges Mochi or asks for a test/quiz/paheli (*"Mera viva lo"*, *"Quiz khelo"*, *"Challenge"*), a 3D wooden-framed green classroom blackboard floats down beside Mochi with a 3D wooden pointer stick in her paw. She asks a tricky question written in chalk on the 3D board, listens to the user's spoken answer, roasts them hilariously if they miss or awards a spinning 3D Gold Medal if they pass!
- **Target Audience / Persona**: Users interacting with Mochi-Puff in Hindi/Hinglish or English who want a deeply entertaining, visually magical 3D companion that feels like a mischievous genius classmate.
- **Key Value**: Transforms verbal explanations and witty banter into tangible, spatial 3D visual spectacles synchronized with Mochi's voice and emotions.

---

## 2. User Experience & Visual Design

- **Key User Flows**:
  1. **Context-Triggered 3D Hologram Flow**:
     - The user asks a complex question (e.g., *"Black hole kya hota hai?"*, *"Explain DNA"*, *"Quantum physics batao"*).
     - Mochi's context detector classifies the topic domain (`black_hole`, `quantum_atom`, `dna_helix`, `solar_system`, `neural_net`, `math_geometry`).
     - A sleek 3D holographic base disc rises beside Mochi with a volumetric light beam and floating rotating 3D geometry (e.g., a dark singularity sphere with a glowing orange/cyan particle accretion ring for Black Holes, or a twisting double-helix ladder for DNA).
     - Mochi points toward the hologram while speaking her witty topper explanation and roast; the hologram smoothly dissolves 12 seconds after she finishes speaking.
  2. **Context-Triggered 3D Blackboard Viva Flow**:
     - The user says *"Mera test lo"*, *"Quiz pucho"*, *"Viva start karo"*, or *"Paheli pucho"*.
     - A 3D classroom blackboard with a chalk tray and scoreboard (`Topper Mochi vs. Backbencher You`) glides into the 3D scene; Mochi equips her topper spectacles and holds a 3D teacher's pointer stick.
     - The current question and hints render crisp chalk typography onto the 3D blackboard surface, accompanied by a lightweight, non-obtrusive DOM answer bar at the bottom for one-tap or voice answering.
     - **Correct Answer**: Mochi acts shocked (*"Oho! Tukka lag gaya!"*), increments the user's score on the 3D board, and spawns a spinning 3D Gold Medal above the user's score.
     - **Wrong Answer**: Mochi laughs mischievously, roasts the user's backbencher brain, writes the correct formula/fact on the 3D blackboard, and does her `topper_flex` animation.

- **Visual Identity & Theme**:
  - **Aesthetic Direction**: Tactile 3D toy-studio realism blended with luminous holographic sci-fi projections and nostalgic classroom chalk textures.
  - **Color Palette & Mood**:
    - *Hologram Palette*: Electric Cyan (`#06B6D4`), Bioluminescent Violet (`#A855F7`), Accretion Amber (`#F59E0B`) with additive blending (`THREE.AdditiveBlending`) and scanline shimmer.
    - *Blackboard Palette*: Deep Slate Chalkboard Green (`#143326`), Warm Oak Wood Frame (`#8B5A2B`), Crisp Chalk White (`#F8FAFC`), and Gold Medal Metallic (`#FACC15`).
  - **Typography & Hierarchy**:
    - 3D Blackboard dynamic canvas texture uses clean chalk-style display lettering with tabular numerals (`tabular-nums`) for the live score counter.
    - Floating HUD notifications use a translucent dark frosted surface (`bg-black/45 backdrop-blur-md border border-white/10`) that never blocks Mochi-Puff at the center of the viewport.
  - **Interactive Feedback & Motion**:
    - Spring-damped scale-in and hover bobbing on both the 3D Hologram and 3D Blackboard.
    - WebAudio procedural sound effects: sci-fi hologram hum & chime on projection spawn, chalk-writing scratch sound when a new viva question appears, and fanfare/buzzer chimes on quiz answers.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Procedural Three.js Geometry + Dynamic Canvas Textures vs. External GLTF Assets**
  - *Chosen Approach*: Build all 5 hologram scientific models and the 3D classroom blackboard procedurally using Three.js primitives, instanced particles, and HTML5 `CanvasTexture` for live chalk text.
  - *Why*: Guarantees zero network loading delay, instant context-driven spawning within a single animation frame, and dynamic real-time text updates on the 3D blackboard for any question.
  - *Alternatives Considered*: Loading external `.glb` models, which adds network latency and cannot dynamically render arbitrary chalk text or custom equations.

- **Decision 2: Seamless Automatic Context Triggering with Dual Voice + Click Answer Support**
  - *Chosen Approach*: Automatically detect topic categories from the conversation transcript (both in Gemini Live via tool declarations and in the local/REST knowledge engine) to spawn the matching 3D Hologram or 3D Blackboard Viva state machine. During an active Viva question, the user can answer naturally by voice OR click a subtle floating choice bar if their mic is off.
  - *Why*: Respects the user's preference for automatic context-driven activation while ensuring the quiz remains 100% playable even if the user pauses their microphone.

---

## 4. Technical Architecture & Data Strategy *(Technical Reference)*

- **Architecture & Component Diagram**:

```
┌───────────────────────────────────────────────────────────────────────────┐
│                    Conversation & Context Router                          │
│  (Voice Transcript / Gemini Live Tool Calls / Knowledge Engine Matcher)   │
└───────────────────┬───────────────────────────────────┬───────────────────┘
                    │                                   │
     [Complex Science/Tech/Math Topic]       [Quiz / Viva / Challenge Intent]
                    ▼                                   ▼
┌───────────────────────────────────────┐ ┌─────────────────────────────────┐
│     3D Hologram Explainer System      │ │   3D Blackboard Viva Engine     │
│  • Hologram Emitter Pad & Beam        │ │  • 3D Framed Chalkboard Mesh    │
│  • Procedural 3D Sub-Models:          │ │  • Dynamic CanvasTexture Chalk  │
│    - Black Hole + Accretion Ring      │ │  • 3D Pointer Stick & Gold Medal│
│    - Quantum Atom + Electron Orbits   │ │  • Viva State Machine:          │
│    - Rotating DNA Double Helix        │ │    IDLE → QUESTION → EVALUATE   │
│    - Solar System Planetary Orbits    │ │  • Voice + Click Answer Handler │
│    - Neural Network Synapse Graph     │ └─────────────────┬───────────────┘
└───────────────────┬───────────────────┘                   │
                    └───────────────────┬───────────────────┘
                                        ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                Mochi-Puff 3D Creature & Emotion Engine                    │
│  • Equips Topper Glasses / Pointer Stick • Triggers 'topper_flex' Swag    │
│  • Synchronizes High-Pitched Cartoon Voice & WebAudio SFX                 │
└───────────────────────────────────────────────────────────────────────────┘
```

- **Data Model & State**:
  - `hologramState`: `{ active: boolean, topicType: 'black_hole' | 'quantum_atom' | 'dna_helix' | 'solar_system' | 'neural_net', timer: number, progress: number }`
  - `vivaQuizState`: `{ active: boolean, currentQuestion: object, userScore: number, mochiScore: number, roundStatus: 'asking' | 'correct' | 'wrong', timer: number }`
- **Interactive Component & State Mapping**:
  - **Automatic Topic Detection**: Whenever a user query or Gemini response touches Quantum Physics, Black Holes/Relativity, DNA/Biology, AI/Coding, Space/Astronomy, or Calculus/Math, `showHologram(topicType, duration)` is invoked on the 3D creature controller.
  - **Viva Quiz Lifecycle**:
    - Saying *"quiz"*, *"viva"*, *"test lo"*, *"sawal pucho"*, or *"challenge"* transitions `vivaQuizState` to `asking`, lowers the 3D Blackboard into view, renders the chalk question + options on the 3D board texture, and speaks the question in Mochi's topper voice.
    - The next user utterance (or option click) is evaluated against the active question's answer patterns:
      - **Match**: Increments `userScore`, updates the 3D chalkboard texture, triggers a spinning 3D Gold Medal animation, and speaks a surprised-yet-cheeky topper praise line.
      - **Miss**: Increments `mochiScore`, displays the solution on the 3D chalkboard, triggers `topper_flex`, and speaks a witty roast explaining the real concept.
    - Saying *"stop quiz"* or *"band karo"* smoothly retracts the 3D blackboard back into idle state.
