// ============================================================================
// MOCHI-PUFF CUTE SOUND EFFECT SYNTHESIZER (Web Audio API — Zero External Files)
// ============================================================================
// Synthesizes cute, high-pitched formant-filtered 'Mochi' vocal chirps,
// bubbly giggles, purrs, boops, and animation sound effects on every
// user interaction and creature animation.
// ============================================================================

let sharedAudioCtx = null;
let soundEnabled = true;
let activeVocalEnvelope = 0;
let vocalDecayTimer = null;
let globalCutePitchScale = 1.20; // Signature high-pitch cartoon baby doll timbre
let globalEmotionPitchMultiplier = 1.0;

export function setGlobalEmotionPitchMultiplier(mult = 1.0) {
  globalEmotionPitchMultiplier = Math.min(1.4, Math.max(0.75, Number(mult) || 1.0));
}

function getAudioContext() {
  if (!sharedAudioCtx && typeof window !== 'undefined') {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (AudioCtx) {
      sharedAudioCtx = new AudioCtx();
    }
  }
  if (sharedAudioCtx && sharedAudioCtx.state === 'suspended') {
    sharedAudioCtx.resume().catch(() => {});
  }
  return sharedAudioCtx;
}

// Unlock Web Audio automatically on first user gesture
if (typeof window !== 'undefined') {
  const unlock = () => {
    getAudioContext();
  };
  window.addEventListener('pointerdown', unlock, { passive: true });
  window.addEventListener('keydown', unlock, { passive: true });
  window.addEventListener('touchstart', unlock, { passive: true });
}

function triggerVocalMouthBounce(intensity = 0.65, durationMs = 360) {
  activeVocalEnvelope = Math.max(activeVocalEnvelope, intensity);
  if (vocalDecayTimer) clearTimeout(vocalDecayTimer);
  vocalDecayTimer = setTimeout(() => {
    activeVocalEnvelope = 0;
  }, durationMs);
}

/**
 * Helper: Plays a single formant-filtered cute high-pitched "Mochi" syllable
 */
function playSyllable(ctx, {
  startTime,
  duration = 0.11,
  f0Start = 680,
  f0End = 920,
  formantFreq = 1650,
  gainPeak = 0.36,
  type = 'triangle',
  vibratoRate = 24,
  vibratoDepth = 18
}) {
  const pitchMult = globalCutePitchScale * globalEmotionPitchMultiplier;
  const scaledF0Start = f0Start * pitchMult;
  const scaledF0End = f0End * pitchMult;
  const scaledFormant = formantFreq * Math.pow(pitchMult, 0.7);

  const osc = ctx.createOscillator();
  const subOsc = ctx.createOscillator();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();

  osc.type = type;
  subOsc.type = 'sine';

  osc.frequency.setValueAtTime(scaledF0Start, startTime);
  osc.frequency.exponentialRampToValueAtTime(Math.max(80, scaledF0End), startTime + duration);

  subOsc.frequency.setValueAtTime(scaledF0Start * 2.0, startTime);
  subOsc.frequency.exponentialRampToValueAtTime(Math.max(160, scaledF0End * 2.0), startTime + duration);

  // Subtle vibrato for organic kawaii vocal character
  if (vibratoDepth > 0) {
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.setValueAtTime(vibratoRate, startTime);
    lfoGain.gain.setValueAtTime(vibratoDepth, startTime);
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);
    lfo.start(startTime);
    lfo.stop(startTime + duration);
  }

  // Bandpass / peaking formant filter to give a cute vowel-like "Mo-chi!" timbre
  filter.type = 'peaking';
  filter.frequency.setValueAtTime(formantFreq, startTime);
  filter.Q.setValueAtTime(3.2, startTime);
  filter.gain.setValueAtTime(8.0, startTime);

  const subGain = ctx.createGain();
  subGain.gain.setValueAtTime(0.28, startTime);

  gain.gain.setValueAtTime(0.0001, startTime);
  gain.gain.linearRampToValueAtTime(gainPeak, startTime + Math.min(0.022, duration * 0.28));
  gain.gain.exponentialRampToValueAtTime(0.0008, startTime + duration);

  osc.connect(filter);
  subOsc.connect(subGain);
  subGain.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);

  osc.start(startTime);
  subOsc.start(startTime);
  osc.stop(startTime + duration + 0.01);
  subOsc.stop(startTime + duration + 0.01);
}

/**
 * 1. Cute high-pitched "Mo-chi~!" vocal chirp / boop squeak when clicking or booping Mochi
 */
export function playMochiBoopSound(pitchMultiplier = 1.0) {
  if (!soundEnabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const p = pitchMultiplier;

    // Randomize between 3 adorable "Mo-chi!" vocal inflection patterns
    const pattern = Math.floor(Math.random() * 3);
    if (pattern === 0) {
      // "Mo-chi~!" (rising second syllable)
      playSyllable(ctx, {
        startTime: now,
        duration: 0.095,
        f0Start: 640 * p,
        f0End: 760 * p,
        formantFreq: 1350 * p,
        gainPeak: 0.38
      });
      playSyllable(ctx, {
        startTime: now + 0.105,
        duration: 0.145,
        f0Start: 820 * p,
        f0End: 1180 * p,
        formantFreq: 2150 * p,
        gainPeak: 0.42
      });
    } else if (pattern === 1) {
      // "Kyaa~!" bouncy squeak
      playSyllable(ctx, {
        startTime: now,
        duration: 0.13,
        f0Start: 720 * p,
        f0End: 1260 * p,
        formantFreq: 1950 * p,
        gainPeak: 0.4
      });
      playSyllable(ctx, {
        startTime: now + 0.14,
        duration: 0.09,
        f0Start: 1080 * p,
        f0End: 940 * p,
        formantFreq: 1800 * p,
        gainPeak: 0.32
      });
    } else {
      // Triple mini-giggle "He-he-he!"
      const notes = [740, 880, 1046];
      for (let i = 0; i < notes.length; i++) {
        playSyllable(ctx, {
          startTime: now + i * 0.075,
          duration: 0.068,
          f0Start: notes[i] * p,
          f0End: notes[i] * 1.28 * p,
          formantFreq: 2050 * p,
          gainPeak: 0.36
        });
      }
    }
    triggerVocalMouthBounce(0.75, 320);
  } catch (e) {}
}

/**
 * 2. Soft happy purr + high-pitched Mochi coo while gently petting fur
 */
export function playSoftPurrGiggleSound() {
  if (!soundEnabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const base = 580 + Math.random() * 140;

    playSyllable(ctx, {
      startTime: now,
      duration: 0.075,
      f0Start: base,
      f0End: base * 1.24,
      formantFreq: 1680,
      gainPeak: 0.26,
      type: 'sine'
    });
    playSyllable(ctx, {
      startTime: now + 0.085,
      duration: 0.085,
      f0Start: base * 1.18,
      f0End: base * 1.42,
      formantFreq: 1980,
      gainPeak: 0.28,
      type: 'sine'
    });
    triggerVocalMouthBounce(0.45, 220);
  } catch (e) {}
}

/**
 * 3. Bubbly high-pitched Mochi giggle burst ("Hehehehe~!") for tickling & laugh action
 */
export function playMochiGiggleSound() {
  if (!soundEnabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const pitches = [660, 860, 760, 980, 1180, 1360];
    for (let i = 0; i < pitches.length; i++) {
      playSyllable(ctx, {
        startTime: now + i * 0.072,
        duration: 0.066,
        f0Start: pitches[i],
        f0End: pitches[i] * 1.32,
        formantFreq: 2100,
        gainPeak: 0.42,
        type: i % 2 === 0 ? 'sine' : 'triangle'
      });
    }

    // Joyful concluding squeal
    playSyllable(ctx, {
      startTime: now + 0.45,
      duration: 0.22,
      f0Start: 840,
      f0End: 1320,
      formantFreq: 2300,
      gainPeak: 0.38,
      vibratoRate: 30,
      vibratoDepth: 28
    });
    triggerVocalMouthBounce(0.9, 700);
  } catch (e) {}
}

/**
 * 4. Cheek inflation step sound ("muh phulana")
 */
export function playInflateStepSound(progress = 0.5) {
  if (!soundEnabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const baseFreq = 320 + progress * 280;
    playSyllable(ctx, {
      startTime: now,
      duration: 0.11,
      f0Start: baseFreq,
      f0End: baseFreq + 110,
      formantFreq: 1200 + progress * 400,
      gainPeak: 0.34,
      type: 'sine',
      vibratoDepth: 6
    });
    triggerVocalMouthBounce(0.35, 140);
  } catch (e) {}
}

/**
 * 5. Cute grumpy "Hmph!" pout sound
 */
export function playCutePoutSound() {
  if (!soundEnabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    playSyllable(ctx, {
      startTime: now,
      duration: 0.22,
      f0Start: 540,
      f0End: 240,
      formantFreq: 980,
      gainPeak: 0.48,
      type: 'triangle',
      vibratoDepth: 10
    });
    triggerVocalMouthBounce(0.6, 260);
  } catch (e) {}
}

/**
 * 6. Cute cheek deflate whoosh + pop sound
 */
export function playDeflatePopSound() {
  if (!soundEnabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    playSyllable(ctx, {
      startTime: now,
      duration: 0.16,
      f0Start: 520,
      f0End: 160,
      formantFreq: 900,
      gainPeak: 0.32,
      type: 'sine',
      vibratoDepth: 0
    });
    playSyllable(ctx, {
      startTime: now + 0.14,
      duration: 0.055,
      f0Start: 980,
      f0End: 360,
      formantFreq: 1800,
      gainPeak: 0.5,
      type: 'triangle',
      vibratoDepth: 0
    });
    triggerVocalMouthBounce(0.55, 220);
  } catch (e) {}
}

/**
 * 7. Upbeat cute dance tune + Mochi happy singing notes
 */
export function playDanceMusicBeat() {
  if (!soundEnabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5, 1174.66, 1318.5];
    for (let i = 0; i < notes.length; i++) {
      const start = now + i * 0.135;
      playSyllable(ctx, {
        startTime: start,
        duration: 0.115,
        f0Start: notes[i],
        f0End: notes[i] * 1.08,
        formantFreq: 1950,
        gainPeak: 0.36,
        type: 'triangle',
        vibratoDepth: 12
      });
    }
    triggerVocalMouthBounce(0.85, 1100);
  } catch (e) {}
}

/**
 * 8. Cute baby cry whimper + teardrop plinks
 */
export function playCrySound() {
  if (!soundEnabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    for (let w = 0; w < 2; w++) {
      playSyllable(ctx, {
        startTime: now + w * 0.36,
        duration: 0.31,
        f0Start: 780 - w * 70,
        f0End: 310,
        formantFreq: 1450,
        gainPeak: 0.38,
        type: 'sine',
        vibratoRate: 18,
        vibratoDepth: 26
      });
    }
    const drops = [1380, 1020];
    for (let i = 0; i < drops.length; i++) {
      playSyllable(ctx, {
        startTime: now + 0.74 + i * 0.22,
        duration: 0.065,
        f0Start: drops[i],
        f0End: drops[i] * 0.75,
        formantFreq: 2200,
        gainPeak: 0.32,
        type: 'sine',
        vibratoDepth: 0
      });
    }
    triggerVocalMouthBounce(0.7, 950);
  } catch (e) {}
}

/**
 * 9. Cute sleepy yawn + plushie snore
 */
export function playSleepSound() {
  if (!soundEnabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    playSyllable(ctx, {
      startTime: now,
      duration: 0.65,
      f0Start: 460,
      f0End: 240,
      formantFreq: 1100,
      gainPeak: 0.32,
      type: 'sine',
      vibratoDepth: 8
    });
    playSyllable(ctx, {
      startTime: now + 0.82,
      duration: 0.38,
      f0Start: 190,
      f0End: 120,
      formantFreq: 650,
      gainPeak: 0.22,
      type: 'triangle',
      vibratoDepth: 0
    });
    triggerVocalMouthBounce(0.5, 700);
  } catch (e) {}
}

/**
 * 10. Sweet "Mwah!" kiss + twinkling heart chimes + happy Mochi coo
 */
export function playLoveKissSound() {
  if (!soundEnabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    // Kiss pop
    playSyllable(ctx, {
      startTime: now,
      duration: 0.085,
      f0Start: 920,
      f0End: 340,
      formantFreq: 1800,
      gainPeak: 0.48,
      type: 'triangle',
      vibratoDepth: 0
    });
    // Happy "Mochi~" coo
    playSyllable(ctx, {
      startTime: now + 0.11,
      duration: 0.18,
      f0Start: 740,
      f0End: 1120,
      formantFreq: 2100,
      gainPeak: 0.38,
      type: 'sine',
      vibratoDepth: 20
    });
    // Heart sparkles
    const chimes = [1046, 1318, 1567, 2093];
    for (let i = 0; i < chimes.length; i++) {
      playSyllable(ctx, {
        startTime: now + 0.22 + i * 0.075,
        duration: 0.18,
        f0Start: chimes[i],
        f0End: chimes[i] * 1.02,
        formantFreq: 2400,
        gainPeak: 0.28,
        type: 'sine',
        vibratoDepth: 0
      });
    }
    triggerVocalMouthBounce(0.75, 600);
  } catch (e) {}
}

/**
 * 11. 4 bouncy mini-Mochi pop-in chimes for Chintu, Pintu, Golu, Molu
 */
export function playFriendsSpawnSound() {
  if (!soundEnabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const notes = [587.33, 740.0, 880.0, 1174.66];
    for (let i = 0; i < notes.length; i++) {
      playSyllable(ctx, {
        startTime: now + i * 0.09,
        duration: 0.14,
        f0Start: notes[i] * 0.78,
        f0End: notes[i] * 1.32,
        formantFreq: 2200,
        gainPeak: 0.4,
        type: 'triangle',
        vibratoDepth: 15
      });
    }
    triggerVocalMouthBounce(0.8, 520);
  } catch (e) {}
}

/**
 * 12. Dress-up accessory equip/remove sparkle chime + cute squeak
 */
export function playAccessoryEquipSound() {
  if (!soundEnabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const notes = [659.25, 880, 1174.66, 1567.98];
    for (let i = 0; i < notes.length; i++) {
      playSyllable(ctx, {
        startTime: now + i * 0.055,
        duration: 0.13,
        f0Start: notes[i],
        f0End: notes[i] * 1.08,
        formantFreq: 2300,
        gainPeak: 0.32,
        type: 'sine',
        vibratoDepth: 8
      });
    }
    triggerVocalMouthBounce(0.55, 320);
  } catch (e) {}
}

/**
 * 13. Peek-a-Boo two-stage sound ("Ooh..." when hiding -> "Peek-a-boo!" squeal when popping out!)
 */
export function playPeekabooSound() {
  if (!soundEnabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    // Stage 1: Shy "Ooh~" when paws cover eyes
    playSyllable(ctx, {
      startTime: now,
      duration: 0.16,
      f0Start: 780,
      f0End: 520,
      formantFreq: 1300,
      gainPeak: 0.36,
      type: 'sine'
    });
    // Stage 2: "Peek-a-boo!" when paws open (~1.65s later)
    const popStart = now + 1.65;
    const peekNotes = [784, 987, 1318];
    for (let i = 0; i < peekNotes.length; i++) {
      playSyllable(ctx, {
        startTime: popStart + i * 0.09,
        duration: 0.12,
        f0Start: peekNotes[i],
        f0End: peekNotes[i] * 1.22,
        formantFreq: 2250,
        gainPeak: 0.42,
        type: 'triangle'
      });
    }
    triggerVocalMouthBounce(0.75, 400);
  } catch (e) {}
}

/**
 * 14. Weather sound effects (rain drops, umbrella pop, or fur shake)
 */
export function playWeatherSound(mode = 'rain') {
  if (!soundEnabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    if (mode === 'umbrella') {
      playSyllable(ctx, {
        startTime: now,
        duration: 0.15,
        f0Start: 360,
        f0End: 960,
        formantFreq: 1750,
        gainPeak: 0.42,
        type: 'triangle',
        vibratoDepth: 0
      });
    } else if (mode === 'rain') {
      const drops = [1250, 980, 1480, 1120, 1620];
      for (let i = 0; i < drops.length; i++) {
        playSyllable(ctx, {
          startTime: now + i * 0.065,
          duration: 0.055,
          f0Start: drops[i],
          f0End: drops[i] * 0.72,
          formantFreq: 2100,
          gainPeak: 0.25,
          type: 'sine',
          vibratoDepth: 0
        });
      }
      // Surprised Mochi squeak!
      playSyllable(ctx, {
        startTime: now + 0.18,
        duration: 0.14,
        f0Start: 880,
        f0End: 1160,
        formantFreq: 2050,
        gainPeak: 0.34,
        type: 'sine'
      });
    } else {
      playFurShakeSound();
    }
    triggerVocalMouthBounce(0.6, 350);
  } catch (e) {}
}

/**
 * 15. Fluffy fur shake flutter + happy chirp ("shake_fur")
 */
export function playFurShakeSound() {
  if (!soundEnabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    for (let i = 0; i < 6; i++) {
      playSyllable(ctx, {
        startTime: now + i * 0.055,
        duration: 0.048,
        f0Start: 420 + (i % 2) * 180,
        f0End: 680 + (i % 2) * 220,
        formantFreq: 1600,
        gainPeak: 0.28,
        type: 'triangle',
        vibratoDepth: 0
      });
    }
    // Happy "Phew~!" chirp at the end
    playSyllable(ctx, {
      startTime: now + 0.36,
      duration: 0.13,
      f0Start: 780,
      f0End: 1120,
      formantFreq: 2100,
      gainPeak: 0.36,
      type: 'sine'
    });
    triggerVocalMouthBounce(0.7, 480);
  } catch (e) {}
}

/**
 * 16. Happy triple jump sound ("Wheee!")
 */
export function playHappyJumpSound() {
  if (!soundEnabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const jumps = [660, 784, 987.77];
    for (let i = 0; i < jumps.length; i++) {
      playSyllable(ctx, {
        startTime: now + i * 0.26,
        duration: 0.15,
        f0Start: jumps[i],
        f0End: jumps[i] * 1.38,
        formantFreq: 2150,
        gainPeak: 0.38,
        type: 'triangle'
      });
    }
    triggerVocalMouthBounce(0.8, 820);
  } catch (e) {}
}

/**
 * 17. Cute 3D Cake Feeding sound ("Nom-nom-nom! Yummy~!")
 */
export function playFeedTreatSound() {
  if (!soundEnabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    // 3 cute "Nom! Nom! Nom!" chewing vocal syllables
    const biteTimes = [0.25, 1.15, 2.05];
    for (let b = 0; b < biteTimes.length; b++) {
      const t0 = now + biteTimes[b];
      playSyllable(ctx, {
        startTime: t0,
        duration: 0.13,
        f0Start: 540 + b * 60,
        f0End: 780 + b * 75,
        formantFreq: 1450,
        gainPeak: 0.38,
        type: 'triangle',
        vibratoDepth: 10
      });
      playSyllable(ctx, {
        startTime: t0 + 0.15,
        duration: 0.11,
        f0Start: 680 + b * 60,
        f0End: 520 + b * 50,
        formantFreq: 1250,
        gainPeak: 0.34,
        type: 'sine',
        vibratoDepth: 8
      });
    }
    // Happy "Yummy~!" chime at the end
    const endStart = now + 2.85;
    const yumNotes = [784, 987.77, 1318.5];
    for (let i = 0; i < yumNotes.length; i++) {
      playSyllable(ctx, {
        startTime: endStart + i * 0.085,
        duration: 0.14,
        f0Start: yumNotes[i],
        f0End: yumNotes[i] * 1.18,
        formantFreq: 2250,
        gainPeak: 0.38,
        type: 'sine',
        vibratoDepth: 16
      });
    }
    triggerVocalMouthBounce(0.85, 3200);
  } catch (e) {}
}

/**
 * 18. 3D Salon Hair Dryer warm breeze + fluffy Mochi chirp
 */
export function playHairDryerSound() {
  if (!soundEnabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    // Soft filtered white-noise warm air whoosh
    const bufferSize = Math.floor(ctx.sampleRate * 2.4);
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.35;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(650, now);
    filter.frequency.linearRampToValueAtTime(1150, now + 1.2);
    filter.frequency.linearRampToValueAtTime(720, now + 2.4);
    filter.Q.setValueAtTime(2.2, now);

    const nGain = ctx.createGain();
    nGain.gain.setValueAtTime(0.001, now);
    nGain.gain.linearRampToValueAtTime(0.22, now + 0.25);
    nGain.gain.setValueAtTime(0.22, now + 1.9);
    nGain.gain.exponentialRampToValueAtTime(0.001, now + 2.4);

    noise.connect(filter);
    filter.connect(nGain);
    nGain.connect(ctx.destination);
    noise.start(now);
    noise.stop(now + 2.42);

    // Happy fluffy Mochi squeak!
    playSyllable(ctx, {
      startTime: now + 0.5,
      duration: 0.16,
      f0Start: 760,
      f0End: 1180,
      formantFreq: 2150,
      gainPeak: 0.36,
      type: 'sine'
    });
    triggerVocalMouthBounce(0.65, 1800);
  } catch (e) {}
}

/**
 * 19. Floating Soap Bubbles spawn arpeggio
 */
export function playBubbleSpawnSound() {
  if (!soundEnabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const notes = [659.25, 783.99, 987.77, 1174.66, 1567.98];
    for (let i = 0; i < notes.length; i++) {
      playSyllable(ctx, {
        startTime: now + i * 0.065,
        duration: 0.09,
        f0Start: notes[i] * 0.85,
        f0End: notes[i] * 1.15,
        formantFreq: 2300,
        gainPeak: 0.3,
        type: 'sine',
        vibratoDepth: 0
      });
    }
    triggerVocalMouthBounce(0.6, 420);
  } catch (e) {}
}

/**
 * 20. Crisp Soap Bubble Pop sound ("Plink-Pop!")
 */
export function playBubblePopSound(pitch = 1.0) {
  if (!soundEnabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    playSyllable(ctx, {
      startTime: now,
      duration: 0.055,
      f0Start: 920 * pitch,
      f0End: 1860 * pitch,
      formantFreq: 2500,
      gainPeak: 0.42,
      type: 'sine',
      vibratoDepth: 0
    });
    triggerVocalMouthBounce(0.45, 150);
  } catch (e) {}
}

export function playRoyalFanfareSound() {
  if (!soundEnabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    // Cute royal trumpet arpeggio: C5 (523Hz), E5 (659Hz), G5 (784Hz), C6 (1046Hz)
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const t = now + idx * 0.085;
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq * globalCutePitchScale, t);
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.exponentialRampToValueAtTime(0.24, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.3);
    });
    triggerVocalMouthBounce(0.55, 420);
  } catch (e) {}
}

export function playSpearClashSound() {
  if (!soundEnabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    // High-pitched metallic "Ting-Clink!" clash
    const clashFreqs = [2400, 3600, 4800];
    clashFreqs.forEach((freq) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.82, now + 0.12);
      gain.gain.setValueAtTime(0.22, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.15);
    });
    triggerVocalMouthBounce(0.35, 120);
  } catch (e) {}
}

export function playSoldierCheerSound() {
  if (!soundEnabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    playSyllable(ctx, {
      startTime: now,
      duration: 0.16,
      f0Start: 720,
      f0End: 1180,
      formantFreq: 2100,
      gainPeak: 0.38,
      type: 'triangle',
      vibratoDepth: 14
    });
    setTimeout(() => {
      playSyllable(ctx, {
        startTime: ctx.currentTime,
        duration: 0.18,
        f0Start: 880,
        f0End: 1420,
        formantFreq: 2600,
        gainPeak: 0.42,
        type: 'sine',
        vibratoDepth: 20
      });
    }, 110);
    triggerVocalMouthBounce(0.65, 320);
  } catch (e) {}
}

export function playMagicSpellSound() {
  if (!soundEnabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    // Sparkling fairy harp upward glissando + wand chime
    const magicNotes = [587.33, 659.25, 783.99, 987.77, 1174.66, 1318.5, 1567.98, 2093.0];
    magicNotes.forEach((freq, i) => {
      const t = now + i * 0.055;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = i % 2 === 0 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(freq, t);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.06, t + 0.24);
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.exponentialRampToValueAtTime(0.22, t + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.3);
    });
    // Cute Mochi "Abracadabra~!" vocal coo
    playSyllable(ctx, {
      startTime: now + 0.38,
      duration: 0.2,
      f0Start: 780,
      f0End: 1320,
      formantFreq: 2350,
      gainPeak: 0.36,
      type: 'sine',
      vibratoDepth: 18
    });
    triggerVocalMouthBounce(0.75, 680);
  } catch (e) {}
}

export function playCameraShutterSound() {
  if (!soundEnabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    // Double mechanical shutter click (" Ka-Chik! ")
    const clickTimes = [0.0, 0.065];
    clickTimes.forEach((offset, idx) => {
      const t = now + offset;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(idx === 0 ? 1800 : 2600, t);
      osc.frequency.exponentialRampToValueAtTime(240, t + 0.035);
      gain.gain.setValueAtTime(0.35, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.045);
    });
    // Cute "Cheese~!" pose squeak after flash
    playSyllable(ctx, {
      startTime: now + 0.14,
      duration: 0.18,
      f0Start: 860,
      f0End: 1280,
      formantFreq: 2400,
      gainPeak: 0.38,
      type: 'sine',
      vibratoDepth: 15
    });
    triggerVocalMouthBounce(0.7, 450);
  } catch (e) {}
}

export function playGuitarConcertSound() {
  if (!soundEnabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    // Upbeat strummed guitar chords (C major -> G major -> Am -> F major -> C major)
    const chords = [
      { time: 0.0, notes: [261.63, 329.63, 392.0, 523.25] },
      { time: 0.42, notes: [196.0, 246.94, 392.0, 587.33] },
      { time: 0.84, notes: [220.0, 261.63, 329.63, 440.0] },
      { time: 1.26, notes: [174.61, 261.63, 349.23, 523.25] },
      { time: 1.68, notes: [261.63, 329.63, 392.0, 659.25] }
    ];
    chords.forEach((chord) => {
      chord.notes.forEach((freq, stringIdx) => {
        const t = now + chord.time + stringIdx * 0.022;
        const osc = ctx.createOscillator();
        const filter = ctx.createBiquadFilter();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, t);
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(2200, t);
        filter.frequency.exponentialRampToValueAtTime(650, t + 0.36);
        gain.gain.setValueAtTime(0.001, t);
        gain.gain.linearRampToValueAtTime(0.14, t + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.38);
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.4);
      });
    });
    triggerVocalMouthBounce(0.85, 2100);
  } catch (e) {}
}

export function playDholBeatSound() {
  if (!soundEnabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    // Festive Punjabi Bhangra Dhol rhythm ("Dha - Ge - Na - Tin - Na - Ka - Dhin - Dha!")
    const beats = [
      { t: 0.0, bass: true, treble: true },
      { t: 0.24, bass: false, treble: true },
      { t: 0.38, bass: true, treble: false },
      { t: 0.62, bass: true, treble: true },
      { t: 0.88, bass: false, treble: true },
      { t: 1.04, bass: true, treble: false },
      { t: 1.24, bass: true, treble: true },
      { t: 1.48, bass: true, treble: true },
      { t: 1.72, bass: false, treble: true },
      { t: 1.92, bass: true, treble: true }
    ];
    beats.forEach((b) => {
      const t = now + b.t;
      if (b.bass) {
        // Deep resonant Dagga (bass skin) thump
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(145, t);
        osc.frequency.exponentialRampToValueAtTime(58, t + 0.16);
        gain.gain.setValueAtTime(0.45, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.19);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.2);
      }
      if (b.treble) {
        // Sharp wooden Tilli slap on high-pitched skin
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = 'triangle';
        osc2.frequency.setValueAtTime(420, t);
        osc2.frequency.exponentialRampToValueAtTime(210, t + 0.065);
        gain2.gain.setValueAtTime(0.32, t);
        gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.075);
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.start(t);
        osc2.stop(t + 0.08);
      }
    });
    triggerVocalMouthBounce(0.9, 2100);
  } catch (e) {}
}

export function playPandaCuteSound(pandaIndex = 0) {
  if (!soundEnabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    // Each of the 5 pandas (Bambam, Coco, Dumpling, Pogo, Miso) has its own cute vocal melody!
    const melodies = [
      [659.25, 783.99, 1046.5, 1318.5], // Bambam: playful somersault arpeggio
      [740.0, 987.77, 1174.66, 1480.0], // Coco: sweet high-pitched heart coo
      [523.25, 659.25, 587.33, 880.0],  // Dumpling: bouncy tummy-pat rhythm
      [587.33, 880.0, 1174.66, 1760.0], // Pogo: high boing jump glissando
      [880.0, 1046.5, 659.25, 1318.5]   // Miso: cute baby "Achoo~!" squeak + giggle
    ];
    const notes = melodies[Math.abs(pandaIndex) % melodies.length];
    notes.forEach((freq, i) => {
      playSyllable(ctx, {
        startTime: now + i * 0.085,
        duration: 0.13,
        f0Start: freq * 0.92,
        f0End: freq * 1.18,
        formantFreq: 2250,
        gainPeak: 0.38,
        type: i % 2 === 0 ? 'sine' : 'triangle',
        vibratoDepth: 14
      });
    });
    triggerVocalMouthBounce(0.8, 520);
  } catch (e) {}
}

export function playCloneUniqueSound(cloneIndex = 0) {
  if (!soundEnabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    // 5 distinct high-pitched cartoon baby vocal melodies for Chintu, Pintu, Golu, Molu, Bholu!
    const cloneMelodies = [
      // 0: Chintu (Somersault champ - rapid rising heroic squeak!)
      [680, 880, 1120, 1480],
      // 1: Pintu (Tornado spinner - bubbly arpeggio!)
      [760, 960, 1240, 960, 1520],
      // 2: Golu (Belly-bouncer - bouncy playful boing-giggle!)
      [540, 820, 620, 980],
      // 3: Molu (Cartwheel star - whistling sweet chirp!)
      [840, 1180, 1020, 1420],
      // 4: Bholu (Backflip baby - excited triple giggle!)
      [720, 1040, 880, 1360]
    ];
    const notes = cloneMelodies[Math.abs(cloneIndex) % cloneMelodies.length];
    notes.forEach((freq, i) => {
      playSyllable(ctx, {
        startTime: now + i * 0.075,
        duration: 0.11,
        f0Start: freq * 0.94,
        f0End: freq * 1.22,
        formantFreq: 2300,
        gainPeak: 0.36,
        type: i % 2 === 0 ? 'sine' : 'triangle',
        vibratoDepth: 16
      });
    });
    triggerVocalMouthBounce(0.8, 460);
  } catch (e) {}
}

export function playBallKickSound(pitch = 1.0) {
  if (!soundEnabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(160 * pitch, now);
    osc.frequency.exponentialRampToValueAtTime(340 * pitch, now + 0.065);
    osc.frequency.exponentialRampToValueAtTime(120 * pitch, now + 0.14);
    gain.gain.setValueAtTime(0.26, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.16);
  } catch (e) {}
}

export function playScoldShockSound() {
  if (!soundEnabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    // Cartoon "Gasp / Attention!" chime when clones snap into a straight line with wide eyes & open mouths!
    const chord = [880, 1174.66, 1396.91];
    chord.forEach((freq, idx) => {
      playSyllable(ctx, {
        startTime: now + idx * 0.03,
        duration: 0.22,
        f0Start: freq * 0.85,
        f0End: freq * 1.25,
        formantFreq: 2500,
        gainPeak: 0.32,
        type: 'triangle',
        vibratoDepth: 22
      });
    });
    triggerVocalMouthBounce(0.85, 500);
  } catch (e) {}
}

export function playHologramProjectSound() {
  if (!soundEnabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    // Futuristic sci-fi hologram hum + shimmering crystal arpeggio
    const freqs = [440, 659.25, 880, 1318.5, 1760];
    freqs.forEach((f, idx) => {
      const t = now + idx * 0.048;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = idx % 2 === 0 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(f * 0.9, t);
      osc.frequency.exponentialRampToValueAtTime(f * 1.12, t + 0.22);
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.18, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.26);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.28);
    });
    triggerVocalMouthBounce(0.55, 380);
  } catch (e) {}
}

export function playChalkBoardWriteSound() {
  if (!soundEnabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    // Quick rhythmic chalk tap-tap-tap on blackboard
    const taps = [0.0, 0.06, 0.13, 0.19, 0.27];
    taps.forEach((offset, i) => {
      const t = now + offset;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(1400 + (i % 3) * 320, t);
      osc.frequency.exponentialRampToValueAtTime(480, t + 0.035);
      gain.gain.setValueAtTime(0.22, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.045);
    });
    triggerVocalMouthBounce(0.5, 320);
  } catch (e) {}
}

export function playVivaMedalSound() {
  if (!soundEnabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    // Bright Gold Medal victory chime (C5 -> E5 -> G5 -> B5 -> C6)
    const notes = [523.25, 659.25, 783.99, 987.77, 1046.5];
    notes.forEach((freq, idx) => {
      const t = now + idx * 0.065;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.26, t + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.34);
    });
    triggerVocalMouthBounce(0.75, 480);
  } catch (e) {}
}

export function playVivaRoastBuzzerSound() {
  if (!soundEnabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    // Playful cartoon "Wah-wah!" descend + cheeky giggle squeak
    const slides = [
      { t: 0.0, fStart: 440, fEnd: 370 },
      { t: 0.16, fStart: 370, fEnd: 260 }
    ];
    slides.forEach((s) => {
      const t = now + s.t;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(s.fStart, t);
      osc.frequency.linearRampToValueAtTime(s.fEnd, t + 0.14);
      gain.gain.setValueAtTime(0.16, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.16);
    });
    playSyllable(ctx, {
      startTime: now + 0.32,
      duration: 0.16,
      f0Start: 880,
      f0End: 1320,
      formantFreq: 2400,
      gainPeak: 0.35,
      type: 'sine',
      vibratoDepth: 18
    });
    triggerVocalMouthBounce(0.7, 500);
  } catch (e) {}
}

export function getActiveVocalEnvelope() {
  return activeVocalEnvelope;
}
