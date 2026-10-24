# Mochi-Puff Live Search Accuracy & Natural Voice Turn-Taking Upgrade

This upgrade resolves Mochi-Puff's unsolicited news announcements, prevents contradictory live cricket/match answers, adds ChatGPT-style spoken search acknowledgments (*"हाँ, मैं खोज रही हूँ..."*), and introduces warm human-like listener backchanneling (*"हाँ"*, *"हम्म"*, *"अच्छा"*, *"ठीक है"*, soft chuckle) during conversations.

## User Review & Critical Decisions

> [!IMPORTANT]
> The following recommended defaults are locked in for this plan based on your request to proceed directly:

- **Confirmed Decision 1 (Strict On-Demand Search Triggering)**: Pre-loaded breaking news headlines will be completely removed from Mochi's startup system prompt, and automatic mid-sentence search triggers on casual words (*"आज"*, *"अभी"*, *"क्या"*) will be replaced with strict intent detection so Mochi **never** talks about news unless explicitly asked.
- **Confirmed Decision 2 (Single-Source Date-Stamped Live Sports & News Verification)**: When asked about live cricket matches (*"अभी किसका मैच चल रहा है?"*, *"आज किसका मैच है?"*) or real-time updates, Mochi will first speak a brief searching cue (*"हाँ, मैं खोज रही हूँ..."*) and wait for the date-verified Tavily + live sports schedule result before answering—eliminating premature guesses and self-contradictions across turns.
- **Confirmed Decision 3 (Active Listener Backchanneling)**: During user speech pauses, Mochi will naturally offer short, warm acknowledgments (*"हाँ"*, *"हम्म"*, *"अच्छा"*, *"ठीक है"*, or a light laugh when appropriate) instead of staying completely silent or interrupting with a full answer prematurely.

---

## 1. Overview & Core Concept

- **What It Does**: Transforms Mochi-Puff into a disciplined, natural real-time Hindi/Hinglish voice companion that listens attentively with human-like backchannels and delivers consistent, date-verified live answers via Tavily only when asked.
- **Target Audience / Persona**: Users conversing with Mochi-Puff in Hindi/Hinglish who want both an emotionally expressive 3D companion and dependable, contradiction-free live information (such as today's cricket matches, scores, and recent AI/tech updates).
- **Key Value**: Eliminates unprompted news interruptions and conflicting sports/news answers while making real-time voice turn-taking feel genuinely attentive and human.

---

## 2. User Experience & Visual Design

- **Key User Flows**:
  1. **Casual Conversation & Active Backchanneling**: As the user speaks or tells a story with brief pauses, Mochi's ears and eyes respond attentively and Mochi softly interjects natural listener cues (*"हम्म..."*, *"हाँ..."*, *"अच्छा!"*, *"ठीक है"*) without hijacking the turn.
  2. **Explicit Live Search & Match Inquiry**: When the user asks a real-time question (e.g., *"अभी किसका मैच चल रहा है?"*), Mochi immediately acknowledges with *"हाँ, मैं खोज रही हूँ..."* (or *"हम्म, देख रही हूँ..."*), shifts into a cool focused visual mood, fetches date-verified live data for today's exact IST date, and speaks one clear, consistent answer.
  3. **Follow-Up Consistency**: If the user asks a follow-up (*"पक्का?"* or *"आज कोई मैच है या नहीं?"*), Mochi references the cached verified match/news context for the session rather than guessing a different team or series.
- **Visual Identity & Theme**:
  - *Aesthetic Direction*: Tactile 3D interactive plush character viewport (`w-full h-full`) with floating frosted-glass HUD controls (`bg-black/40 backdrop-blur-sm border border-white/10`).
  - *Color Palette & Mood*: Dynamic Three-Point Studio Lighting and fur tint transitions managed by the Mood Engine—shifting smoothly between Warm Story/Playful tones (amber/rose key lighting) and Cool Fact/Search tones (crisp sky/indigo rim lighting).
  - *Typography & Hierarchy*: Clean geometric display and body typography (`Plus Jakarta Sans` / `DM Sans`) on semantic DOM overlays with zero-pill inline status text.
- **Interactive Feedback & Motion**: Smooth damping on 3D fur/lighting transitions ($\le 200\text{ms}$ response initiation), subtle searching aura while Tavily queries are in flight, and expressive mouth/blink synchronization during backchannels.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Removing Pre-Loaded News from the Live System Instruction**
  - *Chosen Approach*: Remove automatic injection of top RSS headlines from the Gemini Live session setup prompt and rely strictly on explicit tool calls / verified search intent.
  - *Why*: Having breaking news headlines inside the system prompt caused the model to spontaneously bring up news topics during unrelated casual chats.
  - *Alternatives Considered*: Telling the model via prompt rules to ignore the pre-loaded headlines unless asked—passed over because conversational models still leak pre-loaded context when conversations lull.
- **Decision 2: Date-Anchored Tavily Search + Session Fact Cache for Cricket & Live Events**
  - *Chosen Approach*: Enrich live sports/match queries with the exact current IST date (`DD Month YYYY`), explicitly filter out stale articles from other months/series, and cache the verified result in session memory for follow-up turns.
  - *Why*: Words like *"आज किसका मैच है"* previously stripped down to `"match"`, returning mixed results from past/future series (West Indies, South Africa, New Zealand) and causing Mochi to contradict itself on every turn.
- **Decision 3: Coordinated Search Acknowledgment Instead of Mid-Speech Interruption**
  - *Chosen Approach*: Trigger search only after a complete explicit question or tool call, immediately uttering a natural searching phrase (*"हाँ, मैं खोज रही हूँ..."*) while suppressing ungrounded model guesses until Tavily returns.
  - *Why*: Previously, the Live model started guessing an answer from training data and was then abruptly cut off mid-sentence by the background search injector with a different answer.

---

## 4. Technical Architecture & Data Strategy *(Technical Reference)*

- **Architecture & Component Diagram**:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                   Browser Client (3D Viewport & Voice Engine)           │
│                                                                         │
│  ┌──────────────────────┐    ┌──────────────────────┐                   │
│  │ Mic VAD & Pause      │───▶│ Active Backchannel   │ ("हाँ", "हम्म",   │
│  │ Detector             │    │ & Turn Controller    │  "अच्छा", laugh)  │
│  └──────────┬───────────┘    └──────────┬───────────┘                   │
│             │                           │                               │
│             ▼                           ▼                               │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │ Strict Explicit Search Gate & Session Fact Cache                  │  │
│  │  • Blocks casual/unasked news triggers                            │  │
│  │  • Speaks "हाँ, मैं खोज रही हूँ..." when real search starts        │  │
│  │  • Locks verified match/news facts across follow-up turns         │  │
│  └──────────────────────────────┬────────────────────────────────────┘  │
└─────────────────────────────────┼───────────────────────────────────────┘
                                  │ WebSocket (/live) & REST (/api/search)
                                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                     Server Proxy & Grounding Engine                     │
│                                                                         │
│  ┌──────────────────────────────┐    ┌───────────────────────────────┐  │
│  │ Date-Anchored Query Builder  │───▶│ Tavily Live Search +          │  │
│  │ (Injects exact IST Date &    │    │ Verified Sports/News Filter   │  │
│  │  cricket/live intent terms)  │    │ (GEMINI_API_KEY + Tavily Key) │  │
│  └──────────────────────────────┘    └───────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

- **Data Model & State**:
  - **Session Fact Cache**: Stores `{ normalizedTopic, verifiedSummary, fetchedAt, currentDateIST }` in client/server memory so follow-up questions about today's match or a recent update use the exact same verified facts without contradicting the previous turn.
  - **Conversation Turn State**: Tracks `userSpeaking`, `pauseDurationMs`, `searchInFlight`, and `activeMood` (`warm`, `cool`, `playful`, `neutral`).
- **Interactive Component & State Mapping**:
  - **Startup & Idle State**: Connects to `/live` without any pre-loaded news headlines in the system instruction; Mochi greets naturally and stays focused on the user's topic.
  - **User Pause / Backchannel Handler**: When the user pauses briefly mid-story without asking a factual question, the turn instructions guide Mochi to respond with short, warm listener cues (*"हम्म"*, *"हाँ"*, *"अच्छा"*, *"ठीक है"*, or a soft laugh) instead of launching into unrequested topics.
  - **Explicit Search & Match Handler**: When `search_live_web` is invoked or an explicit live query completes, Mochi speaks *"हाँ, मैं खोज रही हूँ..."*, queries `/api/search` with today's exact IST date and sports/news constraints, updates the 3D mood lighting to cool/focused, and delivers a single verified Hindi/Hinglish answer.
