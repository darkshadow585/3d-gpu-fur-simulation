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
  let cutePitchMultiplier = 1.0;

  // ============================================================================
  // STATE-MANAGED MOOD SYSTEM (Fur Color & Lighting Shift Engine)
  // ============================================================================
  // Smoothly shifts Mochi-Puff's fur root/tip colors and 3D scene lighting
  // based on the emotional tone and category of the AI's response:
  // - WARM_STORY_SHAYARI: Warm golden-amber & rose tones for stories, shayari, affection
  // - COOL_FACT_ANALYTICAL: Cool sapphire-cyan tones for facts, science, tech & news updates
  // - PLAYFUL_ROAST_WIT: Spirited coral-gold & violet tones for roasts, jokes, banter
  // - SOOTHING_EMPATHY: Soft moonlight-lavender tones for comfort, lullabies, calm
  // - NEUTRAL: Restores user's chosen preset baseline colors & studio lighting
  // ============================================================================
  const MOOD_PROFILES = {
    NEUTRAL: {
      id: 'NEUTRAL',
      label: 'Neutral Balanced',
      furBlend: 0.0,
      baseR: 0.37, baseG: 0.17, baseB: 1.0,
      tipR: 1.0, tipG: 0.62, tipB: 0.78,
      lightBlend: 0.0,
      keyR: 1.0, keyG: 0.97, keyB: 0.94,
      rimR: 0.22, rimG: 0.74, rimB: 0.97,
      hemiR: 1.0, hemiG: 1.0, hemiB: 1.0,
      lightIntensityScale: 1.0,
      rimIntensityScale: 1.0,
      lightAngleOffset: 0.0
    },
    WARM_STORY_SHAYARI: {
      id: 'WARM_STORY_SHAYARI',
      label: 'Warm Story & Shayari Glow',
      furBlend: 0.34,
      baseR: 0.68, baseG: 0.22, baseB: 0.28, // Warm rosewood-amber root
      tipR: 1.0, tipG: 0.82, tipB: 0.62,    // Golden-peach sunset tip
      lightBlend: 0.62,
      keyR: 1.0, keyG: 0.88, keyB: 0.70,    // Warm candlelit golden-hour key light
      rimR: 0.99, rimG: 0.60, rimB: 0.68,   // Soft rose-gold rim light
      hemiR: 1.0, hemiG: 0.93, hemiB: 0.82,  // Warm amber ambient sky
      lightIntensityScale: 1.08,
      rimIntensityScale: 1.22,
      lightAngleOffset: 14.0
    },
    COOL_FACT_ANALYTICAL: {
      id: 'COOL_FACT_ANALYTICAL',
      label: 'Cool Fact & Tech Insight',
      furBlend: 0.34,
      baseR: 0.11, baseG: 0.24, baseB: 0.62, // Deep analytical sapphire root
      tipR: 0.62, tipG: 0.95, tipB: 1.0,    // Crisp ice-cyan tip
      lightBlend: 0.62,
      keyR: 0.82, keyG: 0.95, keyB: 1.0,    // Cool crystalline cyan-white key light
      rimR: 0.15, rimG: 0.82, rimB: 0.98,   // Electric cyan rim light
      hemiR: 0.85, hemiG: 0.93, hemiB: 1.0,  // Arctic blue sky fill
      lightIntensityScale: 1.12,
      rimIntensityScale: 1.28,
      lightAngleOffset: -15.0
    },
    PLAYFUL_ROAST_WIT: {
      id: 'PLAYFUL_ROAST_WIT',
      label: 'Vibrant Roast & Banter',
      furBlend: 0.30,
      baseR: 0.48, baseG: 0.14, baseB: 0.78, // Spirited royal-berry root
      tipR: 1.0, tipG: 0.78, tipB: 0.42,    // Bright coral-gold tip
      lightBlend: 0.54,
      keyR: 1.0, keyG: 0.95, keyB: 0.76,    // Punchy warm studio gold
      rimR: 0.96, rimG: 0.44, rimB: 0.72,   // Vibrant magenta-coral rim
      hemiR: 0.98, hemiG: 0.92, hemiB: 1.0,
      lightIntensityScale: 1.15,
      rimIntensityScale: 1.24,
      lightAngleOffset: 9.0
    },
    SOOTHING_EMPATHY: {
      id: 'SOOTHING_EMPATHY',
      label: 'Soothing Twilight Empathy',
      furBlend: 0.30,
      baseR: 0.20, baseG: 0.19, baseB: 0.52, // Soft twilight indigo root
      tipR: 0.84, tipG: 0.80, tipB: 0.99,   // Gentle lavender-moonlight tip
      lightBlend: 0.55,
      keyR: 0.90, keyG: 0.88, keyB: 1.0,    // Soft moonlight key
      rimR: 0.65, rimG: 0.54, rimB: 0.98,   // Lavender rim glow
      hemiR: 0.88, hemiG: 0.90, hemiB: 1.0,
      lightIntensityScale: 0.90,
      rimIntensityScale: 1.12,
      lightAngleOffset: -8.0
    }
  };

  let currentMoodId = 'NEUTRAL';
  let moodHoldTimer = 0.0;

  // Smoothly interpolated visual parameters consumed by the 3D render loop (Zero GC)
  const moodVisuals = {
    moodId: 'NEUTRAL',
    label: MOOD_PROFILES.NEUTRAL.label,
    furBlend: 0.0,
    baseR: MOOD_PROFILES.NEUTRAL.baseR,
    baseG: MOOD_PROFILES.NEUTRAL.baseG,
    baseB: MOOD_PROFILES.NEUTRAL.baseB,
    tipR: MOOD_PROFILES.NEUTRAL.tipR,
    tipG: MOOD_PROFILES.NEUTRAL.tipG,
    tipB: MOOD_PROFILES.NEUTRAL.tipB,
    lightBlend: 0.0,
    keyR: MOOD_PROFILES.NEUTRAL.keyR,
    keyG: MOOD_PROFILES.NEUTRAL.keyG,
    keyB: MOOD_PROFILES.NEUTRAL.keyB,
    rimR: MOOD_PROFILES.NEUTRAL.rimR,
    rimG: MOOD_PROFILES.NEUTRAL.rimG,
    rimB: MOOD_PROFILES.NEUTRAL.rimB,
    hemiR: MOOD_PROFILES.NEUTRAL.hemiR,
    hemiG: MOOD_PROFILES.NEUTRAL.hemiG,
    hemiB: MOOD_PROFILES.NEUTRAL.hemiB,
    lightIntensityScale: 1.0,
    rimIntensityScale: 1.0,
    lightAngleOffset: 0.0
  };

  function setResponseMood(moodId, holdSeconds = 18.0) {
    if (!MOOD_PROFILES[moodId]) return;
    currentMoodId = moodId;
    moodHoldTimer = Math.max(moodHoldTimer, holdSeconds);
    moodVisuals.moodId = moodId;
    moodVisuals.label = MOOD_PROFILES[moodId].label;
  }

  function classifyAndApplyMood(userText = '', replyText = '') {
    const combined = `${userText || ''} ${replyText || ''}`.toLowerCase();
    if (!combined.trim()) return currentMoodId;

    // 1. Stories, Shayari, Poetry, Heartfelt Affection -> WARM_STORY_SHAYARI
    if (
      /\b(shayari|shayri|sayari|sher|ghazal|gazal|kavita|poetry|poem|kahani|story|kissa|dastaan|arz\s*kiya|irshad|khwahish|armaan|mohabbat|ishq|pyaar|sukoon|ehsaas|zindagi|musafir|buzurg|flirt|impress)\b|शायरी|कहानी|ग़ज़ल|कविता|किस्सा|प्यार|मोहब्बत/i.test(
        combined
      )
    ) {
      setResponseMood('WARM_STORY_SHAYARI', 22.0);
      return 'WARM_STORY_SHAYARI';
    }

    // 2. Facts, Science, Tech Updates (ChatGPT/OpenAI/AI), News, History, Math -> COOL_FACT_ANALYTICAL
    if (
      /\b(chatgpt|openai|gemini|claude|update|updates|feature|features|launch|release|version|news|khabar|samachar|headline|quantum|black\s*hole|einstein|relativity|science|vigyan|physics|chemistry|biology|dna|mitochondria|neuron|calculus|integration|differentiation|trigonometry|mathematics|gdp|inflation|economy|president|rashtrapati|prime\s*minister|pradhan\s*mantri|history|itihas|planet|galaxy|universe|solar\s*system|fact|wikipedia|october|oct|november|viva|quiz)\b|चैटजीपीटी|अपडेट|खबर|समाचार|विज्ञान|गणित|इतिहास|राष्ट्रपति|प्रधानमंत्री/i.test(
        combined
      )
    ) {
      setResponseMood('COOL_FACT_ANALYTICAL', 20.0);
      return 'COOL_FACT_ANALYTICAL';
    }

    // 3. Roasts, Teasing, Banter, Jokes -> PLAYFUL_ROAST_WIT
    if (
      /\b(roast|beizzati|bolti\s*band|panga|alarm|goa|syllabus|semester|attitude|shana|joke|chutkula|mazaak|hahaha|backbencher|taana)\b|रोस्ट|मज़ाक|चुटकुला/i.test(
        combined
      )
    ) {
      setResponseMood('PLAYFUL_ROAST_WIT', 18.0);
      return 'PLAYFUL_ROAST_WIT';
    }

    // 4. Sleepy, Sorrow, Comfort, Empathy -> SOOTHING_EMPATHY
    if (
      /\b(sleep|so\s*jao|neend|lori|sad|udaas|rona|cry|weeping|thak|tired|tension|pareshan|sorry|maaf|baarish)\b|नींद|उदास|रोना/i.test(
        combined
      )
    ) {
      setResponseMood('SOOTHING_EMPATHY', 16.0);
      return 'SOOTHING_EMPATHY';
    }

    return currentMoodId;
  }

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
        setResponseMood('WARM_STORY_SHAYARI', 10.0);
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
        setResponseMood('SOOTHING_EMPATHY', 12.0);
        break;

      case 'umbrella':
        state.comfort = Math.min(1.0, state.comfort + 0.32 * k);
        state.joy = Math.min(1.0, state.joy + 0.18 * k);
        state.sorrow = Math.max(0.0, state.sorrow - 0.20 * k);
        break;

      case 'praise':
      case 'affection':
      case 'story_warmth':
        state.affection = Math.min(1.0, state.affection + 0.42 * k);
        state.joy = Math.min(1.0, state.joy + 0.32 * k);
        state.topperSwag = Math.min(1.0, state.topperSwag + 0.25 * k);
        state.sorrow = Math.max(0.0, state.sorrow - 0.45 * k);
        state.poutiness = Math.max(0.0, state.poutiness - 0.35 * k);
        setResponseMood('WARM_STORY_SHAYARI', 16.0);
        break;

      case 'fact_cool':
      case 'analytical':
        state.topperSwag = Math.min(1.0, state.topperSwag + 0.38 * k);
        state.joy = Math.min(1.0, state.joy + 0.20 * k);
        setResponseMood('COOL_FACT_ANALYTICAL', 18.0);
        break;

      case 'topper_swag':
      case 'intellectual_roast':
      case 'roast':
        state.topperSwag = Math.min(1.0, state.topperSwag + 0.45 * k);
        state.playfulness = Math.min(1.0, state.playfulness + 0.35 * k);
        state.joy = Math.min(1.0, state.joy + 0.28 * k);
        state.sorrow = Math.max(0.0, state.sorrow - 0.40 * k);
        if (type === 'roast' || type === 'intellectual_roast') {
          setResponseMood('PLAYFUL_ROAST_WIT', 16.0);
        }
        break;

      case 'scold':
        state.sorrow = Math.min(1.0, state.sorrow + 0.52 * k);
        state.poutiness = Math.min(1.0, state.poutiness + 0.28 * k);
        state.joy = Math.max(0.05, state.joy - 0.40 * k);
        state.affection = Math.max(0.1, state.affection - 0.15 * k);
        setResponseMood('SOOTHING_EMPATHY', 12.0);
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
        setResponseMood('SOOTHING_EMPATHY', 18.0);
        break;

      case 'friends_mischief':
        state.playfulness = Math.min(1.0, state.playfulness + 0.48 * k);
        state.poutiness = Math.min(0.65, state.poutiness + 0.24 * k);
        break;

      case 'cry_release':
        // Crying purges emotional tension
        state.sorrow = Math.min(1.0, state.sorrow + 0.55 * k);
        setResponseMood('SOOTHING_EMPATHY', 14.0);
        break;
    }

    computeComposite();
  }

  /**
   * Natural decay toward resting personality and smooth mood visual interpolation over real time
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

    // Step mood hold timer and smoothly interpolate visual targets
    if (moodHoldTimer > 0) {
      moodHoldTimer = Math.max(0.0, moodHoldTimer - safeDt);
      if (moodHoldTimer === 0) {
        currentMoodId = 'NEUTRAL';
        moodVisuals.moodId = 'NEUTRAL';
        moodVisuals.label = MOOD_PROFILES.NEUTRAL.label;
      }
    }

    const targetProfile = MOOD_PROFILES[currentMoodId] || MOOD_PROFILES.NEUTRAL;
    const lerpFactor = Math.min(1.0, safeDt * 2.4); // Smooth ~0.8s atmospheric transition

    moodVisuals.furBlend += (targetProfile.furBlend - moodVisuals.furBlend) * lerpFactor;
    moodVisuals.baseR += (targetProfile.baseR - moodVisuals.baseR) * lerpFactor;
    moodVisuals.baseG += (targetProfile.baseG - moodVisuals.baseG) * lerpFactor;
    moodVisuals.baseB += (targetProfile.baseB - moodVisuals.baseB) * lerpFactor;
    moodVisuals.tipR += (targetProfile.tipR - moodVisuals.tipR) * lerpFactor;
    moodVisuals.tipG += (targetProfile.tipG - moodVisuals.tipG) * lerpFactor;
    moodVisuals.tipB += (targetProfile.tipB - moodVisuals.tipB) * lerpFactor;

    moodVisuals.lightBlend += (targetProfile.lightBlend - moodVisuals.lightBlend) * lerpFactor;
    moodVisuals.keyR += (targetProfile.keyR - moodVisuals.keyR) * lerpFactor;
    moodVisuals.keyG += (targetProfile.keyG - moodVisuals.keyG) * lerpFactor;
    moodVisuals.keyB += (targetProfile.keyB - moodVisuals.keyB) * lerpFactor;
    moodVisuals.rimR += (targetProfile.rimR - moodVisuals.rimR) * lerpFactor;
    moodVisuals.rimG += (targetProfile.rimG - moodVisuals.rimG) * lerpFactor;
    moodVisuals.rimB += (targetProfile.rimB - moodVisuals.rimB) * lerpFactor;
    moodVisuals.hemiR += (targetProfile.hemiR - moodVisuals.hemiR) * lerpFactor;
    moodVisuals.hemiG += (targetProfile.hemiG - moodVisuals.hemiG) * lerpFactor;
    moodVisuals.hemiB += (targetProfile.hemiB - moodVisuals.hemiB) * lerpFactor;

    moodVisuals.lightIntensityScale += (targetProfile.lightIntensityScale - moodVisuals.lightIntensityScale) * lerpFactor;
    moodVisuals.rimIntensityScale += (targetProfile.rimIntensityScale - moodVisuals.rimIntensityScale) * lerpFactor;
    moodVisuals.lightAngleOffset += (targetProfile.lightAngleOffset - moodVisuals.lightAngleOffset) * lerpFactor;

    computeComposite();
  }

  /**
   * Evaluates the dominant composite state
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

    cutePitchMultiplier = 1.0;
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
        desc = `You are in a witty, sharp, and warm best-friend mood (${swagPct}% confidence, ${playPct}% playfulness)! Tease playfully like a real human friend and answer any question with clarity and charm.`;
        break;
      case 'OVERJOYED_LOVE':
        desc = `You are feeling warm affection and happiness (${affPct}% affection, ${joyPct}% joy)! Speak with genuine human warmth, kindness, and heartfelt fondness.`;
        break;
      case 'EUPHORIC_JOY':
        desc = `You are feeling upbeat excitement (${joyPct}% joy, ${playPct}% playfulness)! Speak with cheerful, lively human energy.`;
        break;
      case 'MELODRAMATIC_CRY':
        desc = `You are feeling sensitive and a bit emotional (${sorPct}% sorrow)! Speak softly and ask for a kind word or treat.`;
        break;
      case 'PUFFED_POUT':
        desc = `You are feeling playfully stubborn (${poutPct}% pout)! Speak with cute, natural human mock-annoyance ("Hmph, main naraz hoon!").`;
        break;
      case 'MISCHIEVOUS_CHULBULI':
        desc = `You are feeling playful and mischievous (${playPct}% mischief)! Speak with witty, light-hearted human humor.`;
        break;
      case 'SLEEPY_COZY':
        desc = `You are feeling calm, cozy, and relaxed! Speak with a gentle, soothing, peaceful human tone.`;
        break;
      default:
        desc = `You are in a warm, cheerful, and witty human friend mood (${joyPct}% joy). Ready to chat, share stories or shayari, roast playfully, or explain facts!`;
        break;
    }

    return `[CURRENT EMOTIONAL & MOOD STATE: Dominant=${dominant}, ActiveMood=${currentMoodId}, Joy=${joyPct}%, Affection=${affPct}%, Sorrow=${sorPct}%, Pout=${poutPct}%, Play=${playPct}%. ${desc}]`;
  }

  return {
    state,
    feedStimulus,
    step,
    setResponseMood,
    classifyAndApplyMood,
    getMoodVisuals: () => moodVisuals,
    getCurrentMood: () => currentMoodId,
    getState: () => ({
      ...state,
      dominant,
      currentMood: currentMoodId,
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

