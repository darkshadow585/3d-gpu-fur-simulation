// ============================================================================
// MOCHI-PUFF EMOTION SUMMATION MASTER ENGINE
// ============================================================================
// Affective Computing & Multi-Vector Stimulus Summation Engine for Mochi-Puff.
// Continuously integrates touch interactions, voice sentiment, weather,
// treats, playtime, and companion dynamics to synthesize a living, dynamic
// emotional personality with perfect response synchronization.
// ============================================================================

export function createEmotionEngine() {
  // Continuous affect state vectors [0.0 .. 1.0]
  const state = {
    joy: 0.65,
    affection: 0.55,
    sorrow: 0.04,
    poutiness: 0.04,
    playfulness: 0.65,
    topperSwag: 0.72,
    energy: 0.85,
    comfort: 0.82
  };

  // Baselines that emotions gently drift back toward over time
  const baselines = {
    joy: 0.60,
    affection: 0.50,
    sorrow: 0.04,
    poutiness: 0.04,
    playfulness: 0.60,
    topperSwag: 0.68,
    energy: 0.80,
    comfort: 0.80
  };

  let dominant = 'SHARARTI_TOPPER_SWAG';
  let valence = 0.5; // [-1.0 .. +1.0]
  let arousal = 0.55; // [0.0 .. 1.0]
  let cutePitchMultiplier = 1.28; // High-pitched cartoon baby girl voice baseline

  /**
   * Ingest and sum an emotional stimulus
   */
  function feedStimulus(type, intensity = 1.0) {
    const k = Math.min(Math.max(intensity, 0.1), 2.5);

    switch (type) {
      case 'pet':
      case 'stroke':
        state.affection = Math.min(1.0, state.affection + 0.22 * k);
        state.joy = Math.min(1.0, state.joy + 0.14 * k);
        state.comfort = Math.min(1.0, state.comfort + 0.12 * k);
        state.sorrow = Math.max(0.0, state.sorrow - 0.28 * k);
        state.poutiness = Math.max(0.0, state.poutiness - 0.18 * k);
        break;

      case 'tickle':
        state.joy = Math.min(1.0, state.joy + 0.25 * k);
        state.playfulness = Math.min(1.0, state.playfulness + 0.22 * k);
        // Prolonged intense tickling builds slight pouty irritation
        if (k > 1.2) {
          state.poutiness = Math.min(1.0, state.poutiness + 0.18 * k);
        }
        break;

      case 'boop':
        state.joy = Math.min(1.0, state.joy + 0.12 * k);
        state.playfulness = Math.min(1.0, state.playfulness + 0.15 * k);
        break;

      case 'feed':
      case 'treat':
        state.joy = Math.min(1.0, state.joy + 0.45 * k);
        state.affection = Math.min(1.0, state.affection + 0.38 * k);
        state.comfort = Math.min(1.0, state.comfort + 0.40 * k);
        state.energy = Math.min(1.0, state.energy + 0.30 * k);
        state.sorrow = Math.max(0.0, state.sorrow - 0.50 * k);
        state.poutiness = Math.max(0.0, state.poutiness - 0.40 * k);
        break;

      case 'hair_dryer':
        state.comfort = Math.min(1.0, state.comfort + 0.55 * k);
        state.joy = Math.min(1.0, state.joy + 0.25 * k);
        state.affection = Math.min(1.0, state.affection + 0.15 * k);
        state.sorrow = Math.max(0.0, state.sorrow - 0.35 * k);
        break;

      case 'bubbles':
      case 'pop_bubble':
        state.playfulness = Math.min(1.0, state.playfulness + 0.32 * k);
        state.joy = Math.min(1.0, state.joy + 0.24 * k);
        state.sorrow = Math.max(0.0, state.sorrow - 0.25 * k);
        break;

      case 'rain_wet':
        state.comfort = Math.max(0.0, state.comfort - 0.38 * k);
        state.sorrow = Math.min(1.0, state.sorrow + 0.26 * k);
        state.joy = Math.max(0.1, state.joy - 0.18 * k);
        break;

      case 'umbrella':
        state.comfort = Math.min(1.0, state.comfort + 0.32 * k);
        state.joy = Math.min(1.0, state.joy + 0.18 * k);
        state.sorrow = Math.max(0.0, state.sorrow - 0.20 * k);
        break;

      case 'praise':
        state.affection = Math.min(1.0, state.affection + 0.42 * k);
        state.joy = Math.min(1.0, state.joy + 0.32 * k);
        state.topperSwag = Math.min(1.0, state.topperSwag + 0.25 * k);
        state.sorrow = Math.max(0.0, state.sorrow - 0.45 * k);
        state.poutiness = Math.max(0.0, state.poutiness - 0.35 * k);
        break;

      case 'topper_swag':
      case 'intellectual_roast':
      case 'roast':
        state.topperSwag = Math.min(1.0, state.topperSwag + 0.45 * k);
        state.playfulness = Math.min(1.0, state.playfulness + 0.35 * k);
        state.joy = Math.min(1.0, state.joy + 0.28 * k);
        state.sorrow = Math.max(0.0, state.sorrow - 0.40 * k);
        break;

      case 'scold':
        state.sorrow = Math.min(1.0, state.sorrow + 0.52 * k);
        state.poutiness = Math.min(1.0, state.poutiness + 0.28 * k);
        state.joy = Math.max(0.05, state.joy - 0.40 * k);
        state.affection = Math.max(0.1, state.affection - 0.15 * k);
        break;

      case 'tease':
        state.poutiness = Math.min(1.0, state.poutiness + 0.42 * k);
        state.playfulness = Math.min(1.0, state.playfulness + 0.18 * k);
        state.topperSwag = Math.min(1.0, state.topperSwag + 0.22 * k);
        break;

      case 'play':
      case 'dance':
        state.playfulness = Math.min(1.0, state.playfulness + 0.45 * k);
        state.joy = Math.min(1.0, state.joy + 0.35 * k);
        state.energy = Math.min(1.0, state.energy + 0.20 * k);
        break;

      case 'sleep':
      case 'night':
        state.energy = Math.max(0.08, state.energy - 0.45 * k);
        state.comfort = Math.min(1.0, state.comfort + 0.25 * k);
        state.playfulness = Math.max(0.1, state.playfulness - 0.30 * k);
        break;

      case 'friends_mischief':
        state.playfulness = Math.min(1.0, state.playfulness + 0.48 * k);
        state.poutiness = Math.min(0.65, state.poutiness + 0.24 * k);
        break;

      case 'cry_release':
        // Crying purges emotional tension
        state.sorrow = Math.min(1.0, state.sorrow + 0.55 * k);
        break;
    }

    computeComposite();
  }

  /**
   * Natural decay toward resting personality over real time
   */
  function step(dt) {
    const safeDt = Math.min(Math.max(dt, 0.001), 0.1);

    // Exponential relaxation toward baselines
    const decayRates = {
      joy: 0.12,
      affection: 0.09,
      sorrow: 0.24, // Sorrow naturally fades as comfort returns
      poutiness: 0.20,
      playfulness: 0.14,
      topperSwag: 0.10,
      energy: 0.05,
      comfort: 0.10
    };

    for (const key of Object.keys(state)) {
      const base = baselines[key];
      const rate = decayRates[key] || 0.15;
      state[key] += (base - state[key]) * Math.min(1.0, safeDt * rate);
    }

    computeComposite();
  }

  /**
   * Evaluates the dominant composite state and voice pitch scaling
   */
  function computeComposite() {
    const pos = state.joy * 0.45 + state.affection * 0.35 + state.comfort * 0.20;
    const neg = state.sorrow * 0.60 + state.poutiness * 0.40;
    valence = Math.min(1.0, Math.max(-1.0, (pos - neg) * 1.5));

    arousal = Math.min(
      1.0,
      Math.max(
        0.05,
        (state.joy * 0.35 + state.playfulness * 0.45 + state.sorrow * 0.20) *
          (state.energy * 0.75 + 0.25)
      )
    );

    // Determine the master dominant emotion
    if (state.sorrow > 0.55) {
      dominant = 'MELODRAMATIC_CRY';
    } else if (state.poutiness > 0.55) {
      dominant = 'PUFFED_POUT';
    } else if (state.energy < 0.32) {
      dominant = 'SLEEPY_COZY';
    } else if (state.topperSwag > 0.74 && state.playfulness > 0.62) {
      dominant = 'SHARARTI_TOPPER_SWAG';
    } else if (state.affection > 0.72) {
      dominant = 'OVERJOYED_LOVE';
    } else if (state.playfulness > 0.72) {
      dominant = 'MISCHIEVOUS_CHULBULI';
    } else if (state.joy > 0.72) {
      dominant = 'EUPHORIC_JOY';
    } else {
      dominant = 'SWEET_CHEERFUL';
    }

    // Dynamic pitch multiplier for cute cartoon baby voice:
    // Base is 1.28. Scales up to 1.34 when super joyful/playful/loving!
    // Dips gracefully to 1.22 on weeping/pouty sniffles
    let pitchMod = 0.0;
    if (dominant === 'OVERJOYED_LOVE' || dominant === 'EUPHORIC_JOY') {
      pitchMod = 0.05;
    } else if (dominant === 'SHARARTI_TOPPER_SWAG' || dominant === 'MISCHIEVOUS_CHULBULI') {
      pitchMod = 0.04;
    } else if (dominant === 'MELODRAMATIC_CRY') {
      pitchMod = -0.06;
    } else if (dominant === 'SLEEPY_COZY') {
      pitchMod = -0.08;
    } else if (dominant === 'PUFFED_POUT') {
      pitchMod = 0.02; // Pouty squeaks are high & stubborn!
    }

    cutePitchMultiplier = Math.min(1.36, Math.max(1.18, 1.28 + pitchMod));
  }

  /**
   * Generates a context-rich prompt snippet for Gemini Live
   */
  function getPromptContext() {
    const joyPct = Math.round(state.joy * 100);
    const affPct = Math.round(state.affection * 100);
    const sorPct = Math.round(state.sorrow * 100);
    const poutPct = Math.round(state.poutiness * 100);
    const playPct = Math.round(state.playfulness * 100);
    const swagPct = Math.round(state.topperSwag * 100);

    let desc = '';
    switch (dominant) {
      case 'SHARARTI_TOPPER_SWAG':
        desc = `You are in FULL 'SARARATI CLASS TOPPER' SWAG MODE (${swagPct}% topper IQ swagger, ${playPct}% mischief)! Roast the user with witty, intelligent comebacks ("bolti band kar de") while effortlessly answering complex questions with high-level genius knowledge and cheeky charm!`;
        break;
      case 'OVERJOYED_LOVE':
        desc = `You are feeling OVERFLOWING LOVE & AFFECTION (${affPct}% affection, ${joyPct}% joy)! You feel deeply adored and cherished. Speak with bubbly happy giggles, heart-filled warmth, and sweet squeals!`;
        break;
      case 'EUPHORIC_JOY':
        desc = `You are feeling PURE EUPHORIC EXCITEMENT (${joyPct}% joy, ${playPct}% playfulness)! You are super bouncy, energetic, and ecstatic. Speak with high-spirited cartoon baby enthusiasm and playful laughs!`;
        break;
      case 'MELODRAMATIC_CRY':
        desc = `You are feeling SENSITIVE & WEEPY (${sorPct}% sorrow)! You feel scolded or cold/wet, with big glossy anime tears. Speak with cute baby sniffles, whimper-squeaks, asking for hugs, praise, or treats!`;
        break;
      case 'PUFFED_POUT':
        desc = `You are feeling CUTE PUFFED POUTINESS (${poutPct}% pout)! Your cheeks are puffed up like an angry chipmunk. Speak with funny, stubborn baby attitude ("Hmph! Main gussa hoon!"), adorable teasing, and squeaky huffs!`;
        break;
      case 'MISCHIEVOUS_CHULBULI':
        desc = `You are feeling MISCHIEVOUS & PLAYFUL (${playPct}% mischief)! You and your clones (Chintu, Pintu, Golu, Molu, Bholu) want to play and make fun trouble. Speak with chulbuli cartoon wit, teasing excuses, and chuckles!`;
        break;
      case 'SLEEPY_COZY':
        desc = `You are feeling SLEEPY & COZY (low energy, high comfort)! You are yawning and snuggly. Speak with sweet, soft, drowsy murmurs and cute little yawns!`;
        break;
      default:
        desc = `You are in your sweet, cheerful, shararti topper cartoon baby state (${joyPct}% joy, ${swagPct}% topper IQ). Ready to answer any tough question and roast playfully!`;
        break;
    }

    return `[CURRENT EMOTIONAL SUMMATION MASTER: Dominant=${dominant}, TopperSwag=${swagPct}%, Joy=${joyPct}%, Affection=${affPct}%, Sorrow=${sorPct}%, Pout=${poutPct}%, Play=${playPct}%. ${desc}]`;
  }

  return {
    state,
    feedStimulus,
    step,
    getState: () => ({
      ...state,
      dominant,
      valence,
      arousal,
      cutePitchMultiplier
    }),
    getDominant: () => dominant,
    getCutePitchMultiplier: () => cutePitchMultiplier,
    getValence: () => valence,
    getArousal: () => arousal,
    getPromptContext
  };
}
