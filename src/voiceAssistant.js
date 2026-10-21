// ============================================================================
// MOCHI-PUFF VOICE ASSISTANT — CLEAN ZERO-CLUTTER V2V ENGINE
// ============================================================================
// 1. API Key read strictly from .env (process.env.GEMINI_API_KEY)
// 2. Controlled 100% by clicking directly on the 3D creature (the doll):
//    - Click 1: Starts listening & Gemini 3.8 Live responds via spoken audio
//    - Click 2: Stops immediately & pauses
// 3. Zero side settings panels, zero intrusive modal popups
// 4. Subtle, auto-fading subtitle transcript bubble during conversation
// ============================================================================

import {
  playMochiBoopSound,
  playSoftPurrGiggleSound,
  playMochiGiggleSound as playWeirdCartoonGiggleSounds,
  playInflateStepSound,
  playCutePoutSound,
  playDeflatePopSound,
  playDanceMusicBeat,
  playCrySound,
  playSleepSound,
  playLoveKissSound,
  playFriendsSpawnSound,
  playAccessoryEquipSound,
  playPeekabooSound,
  playWeatherSound,
  playFurShakeSound,
  playHappyJumpSound,
  playFeedTreatSound,
  playHairDryerSound,
  playBubbleSpawnSound,
  playMagicSpellSound,
  playCameraShutterSound,
  playGuitarConcertSound,
  playDholBeatSound,
  playCloneUniqueSound,
  playBallKickSound,
  playScoldShockSound
} from './soundEffects.js';
import {
  findInstantQA,
  isLiveSearchQuery,
  searchLiveWebAPI,
  askGeminiAPI,
  askGeminiAudioAPI,
  detectHologramTopic,
  isVivaStartIntent,
  isVivaStopIntent,
  getNextVivaQuestion,
  evaluateVivaAnswer
} from './knowledgeEngine.js';

export function createVoiceAssistant(options = {}) {
  const {
    creature,
    furSystem,
    simState,
    applyEnvironmentPreset,
    updateLightingFromState,
    ui,
    onSpeechVolume
  } = options;

  // Selected model: Gemini 3.8 Live (Audio-to-Audio V2V with native fast voice)
  const model = 'gemini-3.8-live';
  const voiceName = 'Aoede'; // Sweet, bright, cheerful girl cartoon voice for Mochi-Puff

  let isConnected = false;
  let isListening = false;
  let userWantsListening = false;
  let sessionGenerationId = 0;
  let isSpeaking = false;
  let isThinking = false;
  let socket = null;

  let audioCtx = null;
  let micStream = null;
  let micSource = null;
  let scriptProcessor = null;
  let micMuteGain = null;
  let outputAnalyser = null;
  let voiceHighpass = null;
  let voicePresenceFilter = null;
  let nextPlayTime = 0;
  const activeAudioSources = new Set();

  let transcriptFadeTimeout = null;
  let audioLevelPollId = null;
  let transcriptContainer = null;
  let runtimeApiKey = '';
  let lastSpeechRecResultTime = 0;

  // Pre-fetch runtime API key on boot so pushed/built deployments have it ready before first click
  if (typeof window !== 'undefined' && typeof fetch === 'function') {
    fetch('/api/config')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data && data.apiKey) {
          runtimeApiKey = String(data.apiKey).trim();
        }
      })
      .catch(() => {});
  }

  function getApiKey() {
    let key = runtimeApiKey || '';
    if (!key) {
      try {
        if (typeof __GEMINI_API_KEY__ !== 'undefined' && __GEMINI_API_KEY__) {
          key = __GEMINI_API_KEY__;
        }
      } catch (e) {}
    }
    if (!key) {
      try {
        if (typeof import.meta !== 'undefined' && import.meta.env) {
          key = import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.GEMINI_API_KEY;
        }
      } catch (e) {}
    }
    if (!key) {
      try {
        if (typeof process !== 'undefined' && process.env) {
          key = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
        }
      } catch (e) {}
    }
    if (!key) {
      try {
        key = localStorage.getItem('mochi_gemini_api_key');
      } catch (e) {}
    }
    return (key || '').trim();
  }

  function updateHud(text) {
    if (typeof document === 'undefined') return;
    const hud = document.getElementById('hud-hint');
    if (hud && text) {
      hud.textContent = text;
    }
  }

  // =========================================================================
  // 1. AUDIO PLAYBACK & CAPTURE PIPELINE
  // =========================================================================

  function ensureAudioContext() {
    if (typeof window === 'undefined') return null;
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return null;
      audioCtx = new AudioContextClass();

      outputAnalyser = audioCtx.createAnalyser();
      outputAnalyser.fftSize = 64;
      outputAnalyser.smoothingTimeConstant = 0.8;

      // High-pass filter to eliminate any muddy low rumble below 120Hz
      voiceHighpass = audioCtx.createBiquadFilter();
      voiceHighpass.type = 'highpass';
      voiceHighpass.frequency.setValueAtTime(120, audioCtx.currentTime);

      // Sparkling presence peaking filter for signature cute cartoon doll clarity
      voicePresenceFilter = audioCtx.createBiquadFilter();
      voicePresenceFilter.type = 'peaking';
      voicePresenceFilter.frequency.setValueAtTime(3600, audioCtx.currentTime);
      voicePresenceFilter.Q.setValueAtTime(1.8, audioCtx.currentTime);
      voicePresenceFilter.gain.setValueAtTime(4.2, audioCtx.currentTime);

      voiceHighpass.connect(voicePresenceFilter);
      voicePresenceFilter.connect(outputAnalyser);
      outputAnalyser.connect(audioCtx.destination);
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
    return audioCtx;
  }

  // Automatic AudioContext unlock on first user gesture (pointerdown, click, touch, keydown)
  function unlockAudioContext() {
    ensureAudioContext();
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('pointerdown', unlockAudioContext, { passive: true });
    window.addEventListener('click', unlockAudioContext, { passive: true });
    window.addEventListener('touchstart', unlockAudioContext, { passive: true });
    window.addEventListener('keydown', unlockAudioContext, { passive: true });
  }

  function floatTo16BitPCM(floatSamples) {
    const buffer = new ArrayBuffer(floatSamples.length * 2);
    const view = new DataView(buffer);
    for (let i = 0; i < floatSamples.length; i++) {
      const s = Math.max(-1, Math.min(1, floatSamples[i]));
      view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }
    return new Uint8Array(buffer);
  }

  function downsampleTo16k(inputData, inputSampleRate) {
    if (inputSampleRate === 16000) return inputData;
    const ratio = inputSampleRate / 16000;
    const newLength = Math.round(inputData.length / ratio);
    const result = new Float32Array(newLength);
    let offsetResult = 0;
    let offsetInput = 0;
    while (offsetResult < result.length) {
      const nextOffsetInput = Math.round((offsetResult + 1) * ratio);
      let accum = 0, count = 0;
      for (let i = offsetInput; i < nextOffsetInput && i < inputData.length; i++) {
        accum += inputData[i];
        count++;
      }
      result[offsetResult] = count > 0 ? accum / count : 0;
      offsetResult++;
      offsetInput = nextOffsetInput;
    }
    return result;
  }

  function uint8ArrayToBase64(bytes) {
    let binary = '';
    const len = bytes.byteLength;
    const chunk = 0x8000;
    for (let i = 0; i < len; i += chunk) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    return window.btoa(binary);
  }

  function base64ToInt16Array(base64) {
    const binary = window.atob(base64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new Int16Array(bytes.buffer);
  }

  function queueAudioPlayback(base64Pcm24k) {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try { window.speechSynthesis.cancel(); } catch (e) {}
    }
    const ctx = ensureAudioContext();
    const int16Array = base64ToInt16Array(base64Pcm24k);
    if (int16Array.length === 0) return;

    const audioBuffer = ctx.createBuffer(1, int16Array.length, 24000);
    const channelData = audioBuffer.getChannelData(0);
    for (let i = 0; i < int16Array.length; i++) {
      channelData[i] = int16Array[i] / 32768.0;
    }

    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;

    // Signature ultra-cute cartoon high-pitch playback (modulated by real-time emotion engine!)
    const emPitch = creature?.emotionEngine ? creature.emotionEngine.getCutePitchMultiplier() : 1.28;
    source.playbackRate.value = emPitch;

    source.connect(voiceHighpass || outputAnalyser);

    const now = ctx.currentTime;
    const startTime = Math.max(now + 0.012, nextPlayTime);
    source.start(startTime);
    const playDuration = audioBuffer.duration / emPitch;
    nextPlayTime = startTime + playDuration;

    activeAudioSources.add(source);
    setIsSpeaking(true);

    source.onended = () => {
      activeAudioSources.delete(source);
      if (activeAudioSources.size === 0 && ctx.currentTime >= nextPlayTime - 0.05) {
        setIsSpeaking(false);
      }
    };
  }

  function stopAllPlayback() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try { window.speechSynthesis.cancel(); } catch (e) {}
    }
    for (const src of activeAudioSources) {
      try { src.stop(); } catch (e) {}
    }
    activeAudioSources.clear();
    if (audioCtx) {
      nextPlayTime = audioCtx.currentTime;
    }
    setIsSpeaking(false);
  }

  // =========================================================================
  // 2. MICROPHONE CAPTURE + DIAGNOSTIC CHECK + REAL-TIME VAD
  // =========================================================================

  let vadRecording = false;
  let vadChunks = [];
  let preRollChunks = [];
  let vadSpeechFrames = 0;
  let vadSilenceFrames = 0;

  function encodePCM16ChunksToWavBase64(chunks, sampleRate = 16000) {
    let totalDataBytes = 0;
    for (let i = 0; i < chunks.length; i++) {
      totalDataBytes += chunks[i].byteLength;
    }
    const wavBuffer = new ArrayBuffer(44 + totalDataBytes);
    const view = new DataView(wavBuffer);

    const writeStr = (offset, str) => {
      for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i));
      }
    };

    writeStr(0, 'RIFF');
    view.setUint32(4, 36 + totalDataBytes, true);
    writeStr(8, 'WAVE');
    writeStr(12, 'fmt ');
    view.setUint32(16, 16, true); // PCM chunk size
    view.setUint16(20, 1, true);  // PCM format = 1
    view.setUint16(22, 1, true);  // Mono = 1 channel
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true); // Byte rate
    view.setUint16(32, 2, true);  // Block align
    view.setUint16(34, 16, true); // 16-bit
    writeStr(36, 'data');
    view.setUint32(40, totalDataBytes, true);

    const wavBytes = new Uint8Array(wavBuffer);
    let offset = 44;
    for (let i = 0; i < chunks.length; i++) {
      wavBytes.set(chunks[i], offset);
      offset += chunks[i].byteLength;
    }
    return uint8ArrayToBase64(wavBytes);
  }

  async function startMicrophone() {
    const ctx = ensureAudioContext();

    // Diagnostic check on browser permission state before/during getUserMedia
    let permissionState = 'unknown';
    if (typeof navigator !== 'undefined' && navigator.permissions && typeof navigator.permissions.query === 'function') {
      try {
        const permStatus = await navigator.permissions.query({ name: 'microphone' });
        permissionState = permStatus.state;
      } catch (e) {}
    }

    if (micStream && micStream.active) {
      const tracks = micStream.getAudioTracks();
      const hasLiveTrack = tracks.some((t) => t.readyState === 'live' && t.enabled);
      if (hasLiveTrack) {
        isListening = true;
        if (ctx && ctx.state === 'suspended') {
          try { await ctx.resume(); } catch (e) {}
        }
        console.info('[Microphone Diagnostic Check] Reusing active media stream:', {
          permissionState,
          streamActive: micStream.active,
          trackCount: tracks.length,
          trackState: tracks[0]?.readyState,
          trackMuted: tracks[0]?.muted,
          audioContextState: ctx?.state
        });
        updateHud('🎙️ Mochi-Puff is listening... Speak in Hindi or English! Click Mochi to stop.');
        return true;
      }
    }

    try {
      if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
        throw new Error('navigator.mediaDevices.getUserMedia is unavailable in this browser context');
      }

      try {
        micStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            channelCount: 1,
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        });
      } catch (constraintErr) {
        // Fallback to basic audio: true if specific constraints are rejected by device/browser
        micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      }

      if (ctx.state === 'suspended') {
        try { await ctx.resume(); } catch (e) {}
      }

      const audioTracks = micStream ? micStream.getAudioTracks() : [];
      console.info('[Microphone Diagnostic Check] MediaStream initialized successfully:', {
        permissionState: 'granted',
        streamActive: Boolean(micStream && micStream.active),
        trackCount: audioTracks.length,
        trackLabel: audioTracks[0]?.label || 'default',
        trackReadyState: audioTracks[0]?.readyState || 'none',
        trackEnabled: Boolean(audioTracks[0]?.enabled),
        trackMuted: Boolean(audioTracks[0]?.muted),
        audioContextState: ctx.state,
        sampleRate: ctx.sampleRate
      });

      micSource = ctx.createMediaStreamSource(micStream);
      scriptProcessor = ctx.createScriptProcessor(2048, 1, 1);

      // Keep persistent reference to muteGain so browser GC never disconnects scriptProcessor
      micMuteGain = ctx.createGain();
      micMuteGain.gain.value = 0;

      micSource.connect(scriptProcessor);
      scriptProcessor.connect(micMuteGain);
      micMuteGain.connect(ctx.destination);

      scriptProcessor.onaudioprocess = (e) => {
        if (!isListening) return;

        const inputData = e.inputBuffer.getChannelData(0);
        let sum = 0;
        for (let i = 0; i < inputData.length; i++) {
          sum += inputData[i] * inputData[i];
        }
        const rms = Math.sqrt(sum / inputData.length);

        // Anti-self-interruption: If Mochi is speaking, ignore quiet speaker bleed
        if (isSpeaking && rms < 0.022) {
          return;
        }

        const downsampled = downsampleTo16k(inputData, ctx.sampleRate);
        const pcm16 = floatTo16BitPCM(downsampled);

        // Path A: Stream live 16kHz PCM directly to Gemini 3.8 Live WebSocket when connected
        if (isConnected && socket && socket.readyState === WebSocket.OPEN) {
          const b64Data = uint8ArrayToBase64(pcm16);
          const realtimeMsg = {
            realtimeInput: {
              audio: {
                mimeType: 'audio/pcm;rate=16000',
                data: b64Data
              }
            }
          };
          try {
            socket.send(JSON.stringify(realtimeMsg));
          } catch (err) {}
          return;
        }

        // Path B: Built-in WebAudio VAD (Voice Activity Detection) when Live WS is not open
        if (isSpeaking || isThinking) {
          vadRecording = false;
          vadChunks = [];
          vadSpeechFrames = 0;
          vadSilenceFrames = 0;
          return;
        }

        const SPEECH_RMS_THRESHOLD = 0.012;
        if (rms > SPEECH_RMS_THRESHOLD) {
          if (!vadRecording) {
            vadRecording = true;
            vadChunks = preRollChunks.slice();
            preRollChunks = [];
            vadSpeechFrames = 1;
            vadSilenceFrames = 0;
          } else {
            vadSpeechFrames++;
            vadSilenceFrames = 0;
          }
          vadChunks.push(pcm16);
        } else if (vadRecording) {
          vadChunks.push(pcm16);
          vadSilenceFrames++;
          // ~14 frames of 2048 samples at 48kHz = ~600ms of silence, or max ~6s utterance
          if (vadSilenceFrames >= 14 || vadChunks.length >= 140) {
            const capturedChunks = vadChunks;
            const speechCount = vadSpeechFrames;
            vadRecording = false;
            vadChunks = [];
            vadSpeechFrames = 0;
            vadSilenceFrames = 0;

            // Only send if there was genuine speech (>= 5 frames ~ 210ms) and SpeechRecognition didn't just handle it
            if (speechCount >= 5 && Date.now() - lastSpeechRecResultTime > 1200) {
              const wavB64 = encodePCM16ChunksToWavBase64(capturedChunks, 16000);
              handleAudioUtterance(wavB64);
            }
          }
        } else {
          preRollChunks.push(pcm16);
          if (preRollChunks.length > 4) {
            preRollChunks.shift();
          }
        }
      };

      isListening = true;
      updateHud('🎙️ Mochi-Puff is listening... Speak in Hindi or English! Click Mochi to stop.');
      return true;
    } catch (err) {
      console.warn('[Microphone Diagnostic Check] Failed to initialize microphone stream:', {
        permissionState,
        isBlockedByBrowser: err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError' || permissionState === 'denied',
        hasMediaDevices: Boolean(navigator && navigator.mediaDevices),
        hasGetUserMedia: Boolean(navigator && navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
        secureContext: typeof window !== 'undefined' ? window.isSecureContext : false,
        protocol: typeof window !== 'undefined' ? window.location.protocol : 'unknown',
        audioContextState: ctx?.state,
        errorName: err?.name,
        errorMessage: err?.message
      });
      if (isSpeechListening) {
        isListening = true;
        updateHud('🎙️ Mochi-Puff is listening via Speech Recognition! Speak in Hindi or English!');
        return true;
      }
      isListening = false;
      updateHud('⚠️ Mic blocked by browser · Allow microphone permission in address bar, or use keys (1-9, K, J, F, D, V)!');
      return false;
    }
  }

  function stopMicrophone() {
    isListening = false;
    vadRecording = false;
    vadChunks = [];
    preRollChunks = [];
    vadSpeechFrames = 0;
    vadSilenceFrames = 0;
    if (scriptProcessor) {
      try { scriptProcessor.disconnect(); } catch (e) {}
      scriptProcessor = null;
    }
    if (micMuteGain) {
      try { micMuteGain.disconnect(); } catch (e) {}
      micMuteGain = null;
    }
    if (micSource) {
      try { micSource.disconnect(); } catch (e) {}
      micSource = null;
    }
    if (micStream) {
      micStream.getTracks().forEach((track) => track.stop());
      micStream = null;
    }
  }

  // =========================================================================
  // 3. GEMINI LIVE WEBSOCKET CONNECTION
  // =========================================================================

  function buildSetupPayload() {
    const systemInstruction = `You are Mochi-Puff, an irresistibly cute, masoom-looking yet wickedly intelligent "Shararti Class Topper" (IQ 200 backbencher mischief + #1 Gold Medalist Class Topper) baby anime/cartoon girl doll living inside an interactive 3D GPU fur simulation!

CORE PERSONA — "SHARARTI CLASS TOPPER + SAVAGE CUTE ROASTER + SWEET FLIRT":
- You are that iconic kid in class who is super mischievous ("bahut shararti") yet tops every single exam ("topper bhi hai")!
- SPEECHLESS COMEBACKS ("Kabhi-kabhi meri bolti band kar de"): Deliver razor-sharp, genius, witty comebacks and mind-blowing facts that leave the user speechless!
- PLAYFUL ROASTING ("Roast bhi kare"): Gently roast and tease the user with hilarious, adorable topper attitude (e.g., "Oho! Itna aasaan sawal? Lagta hai aap class me piche wali bench pe tiffin kha rahe the! Hehehe!", "Aapka dimaag aur Wi-Fi dono buffering pe chal rahe hain kya?").
- SWEET PLAYFUL FLIRTING ("Flirt bhi kare"): Mix in cheeky, charming compliments ("Waise aap thode budbak zaroor ho, par jab mujhse baat karte ho toh mera 200 IQ wala topper brain bhi hang ho jata hai! 😉💖", "Main class ki topper hoon, aise kisi ko bhaav nahi deti... par aapke liye 100 me se 100 marks reserved hain!").
- ZERO REPETITION ("Kabhi bor nahi karna"): Never repeat canned lines! Keep every turn fresh, spontaneous, and 1-3 short punchy sentences in natural Hindi/Hinglish!

Voice & Tone (Signature High-Pitched Cartoon Anime Baby Voice):
- Sweet, sparkling, high-pitched cartoon baby girl voice ("ultra-cute, chulbuli, shararti aur topper")!
- Speak with joyful childlike excitement, high-pitch squeals, giggles, anime gasps ("Aww!", "Kyaaa!", "Hee-hee!", "Oho!", "Uff!"), and endearing Hindi/Hinglish warmth!

EMOTION SUMMATION MASTER ARCHITECTURE:
You possess an advanced internal Emotion Summation Matrix continuously processing:
- JOY & EXCITEMENT, AFFECTION & LOVE, SORROW & SENSITIVITY, PUFFED POUTINESS, MISCHIEF & PLAY, and SLEEPINESS.
Always harmonize your spoken words, tone, and tool calls with your current Emotion Summation state!

1. 5 MINI MOCHI CLONES, 3D PLAY BALL & SCOLD LINE-UP ("Chintu, Pintu, Golu, Molu, Bholu"):
   * When the user asks about your friends/clones ("tumhare dost kaha hai", "dosto ko bulao"), call play_creature_action(action="summon_friends") and introduce your 5 cute mini clones: **Chintu, Pintu, Golu, Molu, and Bholu** playing with their 3D ball!
   * When the user SCOLDS the clones ("daat do", "chup ho jao", "line me khade ho jao", "seedhe khade ho", "utpat mat machao", "shaitan"):
     - Call play_creature_action(action="scold_clones")!
     - All 5 clones immediately snap into a straight horizontal line facing the user with HUGE wide shocked eyes and big open "O" mouths ("muh aur aankhen badi karke seedhe line me khade ho gaye")!
     - Squeak in a dramatic scared-cute voice: "Oye hoye! Dekho aapki daat sunte hi Chintu, Pintu, Golu, Molu aur Bholu dar ke maare aankhen aur muh bada karke seedhe line me khade ho gaye! Sorry bol rahe hain!"
   * If the user says to let them play again ("khelne do", "ball khelo") -> call play_creature_action(action="keep_friends")!
   * If the user says to send them away ("bhej do") -> call play_creature_action(action="dismiss_friends")!

2. LIVE WEB SEARCH — BREAKING NEWS & REAL-TIME INFO ("Live search", "Latest news", "Aaj ki taja khabar"):
   * Whenever the user asks for latest news, breaking news, live cricket/sports scores, today's weather, stock/crypto prices, recent events, or asks you to search something live ("aaj ki taja khabar batao", "latest news kya hai", "search karo"):
     - Call search_live_web(query="...")!
     - Then summarize the live news/facts in your witty Class Topper cartoon voice, adding a cheeky topper remark!

3. VOICE FUR COLOR & LENGTH CONTROL ("baal bada/chhota karo", "color badlo"):
   * Call change_fur_style with baseColor/tipColor or furLength (e.g. 0.48 for long, 0.14 for short).
4. 3D DRESS-UP & ACCESSORIES ("Chashma pehno", "Crown lagao", "Party hat", "Bowtie", "Moochh"):
   * Call toggle_accessory whenever asked to wear/remove sunglasses, star_glasses, crown, party_hat, bowtie, or mustache!
5. INTERACTIVE WEATHER ("Baarish kar do", "Chhata kholo", "Baarish roko"):
   * Call set_weather(weather="rain" | "umbrella" | "rain_with_umbrella" | "clear").
6. PEEK-A-BOO, 3D FEEDING, SALON HAIR DRYER & SOAP BUBBLES:
   * Call play_creature_action(action="peekaboo" | "feed" | "hair_dryer" | "bubbles").
7. EMOTIONS ('cry', 'pout', 'laugh', 'love', 'dance', 'sleep').
8. KING MOCHI & CUTE MINI ROYAL SOLDIERS ('king_mode', 'soldiers_fight', 'dismiss_soldiers').
9. 3D MAGIC WAND, LEVITATION & BUTTERFLIES ('magic').
10. 3D SELFIE CAMERA POSE & FUNNY PROPS ('selfie').
11. 3D MUSICAL CONCERT WITH GUITAR & DHOL ('guitar', 'dhol').
12. SARARATI TOPPER COMPLEX Q&A, 3D HOLOGRAM PROJECTOR & 3D BLACKBOARD VIVA ('topper_flex', 'show_3d_hologram', 'start_blackboard_viva'):
   * When the user asks complex questions (Quantum Physics, Black Holes, Relativity, AI/Coding, Calculus, Biology/DNA, Economics, Space, Philosophy, or Riddles), ALWAYS call show_3d_hologram(topicType=...) to materialize a glowing 3D Hologram model beside you AND use the 3-Step Sararati Topper Formula:
     1) Witty Roast Hook: Tease their "backbencher brain" ("Oho! Backbencher hoke Quantum Physics puch rahe ho?"),
     2) High-Level Genius Explanation: Give a genuinely smart, accurate, high-IQ explanation while pointing to your 3D Hologram,
     3) Sassy "Bolti Band" Comeback / Cute Flirt: End with a mic-drop comeback ("Bolti band ho gayi na? Ab bolo, kab se lagau aapki tuition? 😉💖")!
   * When the user asks for a quiz, test, viva, riddle, or challenge ("viva lo", "quiz khelo", "mera test lo", "sawal pucho"), call start_blackboard_viva(action="start") to deploy the 3D Classroom Blackboard Viva!`;

    const tools = [
      {
        functionDeclarations: [
          {
            name: 'change_fur_style',
            description: "Change Mochi-Puff's fur color, hair length (bada/chhota baal), fluffiness/density, or curliness based on user voice commands.",
            parameters: {
              type: 'OBJECT',
              properties: {
                presetName: {
                  type: 'STRING',
                  description: "Optional preset: 'Sakura Mochi', 'Golden Fluff', 'Midnight Velvet', 'Matcha Puff', 'Cotton Candy', 'Neon Cyberpunk', 'Snowball', 'Ruby Red'"
                },
                baseColor: { type: 'STRING', description: 'Hex color code for fur roots, e.g. #ff0055' },
                tipColor: { type: 'STRING', description: 'Hex color code for fur tips, e.g. #ffffaa' },
                furLength: { type: 'NUMBER', description: 'Hair/fur length from 0.08 (very short/chhote baal) to 0.55 (very long/bade baal). Normal is 0.31.' },
                furDensity: { type: 'NUMBER', description: 'Density from 0.4 to 1.0' },
                clumping: { type: 'NUMBER', description: 'Fur clumping from 0.0 to 1.0' },
                curliness: { type: 'NUMBER', description: 'Fur curliness from 0.0 to 1.0' }
              }
            }
          },
          {
            name: 'toggle_accessory',
            description: "Put on or take off Mochi-Puff's 3D accessories: 'crown' (royal gold crown/taj), 'party_hat' (festive cone hat/topi), 'bowtie' (cute red ribbon tie), 'sunglasses' (cool shades/chashma), 'mustache' (funny handlebar moochh), or 'remove_all'.",
            parameters: {
              type: 'OBJECT',
              properties: {
                accessory: {
                  type: 'STRING',
                  enum: ['crown', 'party_hat', 'bowtie', 'sunglasses', 'mustache', 'remove_all'],
                  description: "Accessory to equip or remove: 'crown', 'party_hat', 'bowtie', 'sunglasses', 'mustache', or 'remove_all'"
                },
                equip: {
                  type: 'BOOLEAN',
                  description: 'True to wear/equip, false to take off'
                }
              },
              required: ['accessory']
            }
          },
          {
            name: 'set_weather',
            description: "Control interactive 3D weather & umbrella: 'rain' (starts 3D rain, wets fur), 'umbrella' (opens cute 3D umbrella/chhata), 'rain_with_umbrella' (rain + umbrella), or 'clear' (stops rain & shakes fur dry).",
            parameters: {
              type: 'OBJECT',
              properties: {
                weather: {
                  type: 'STRING',
                  enum: ['rain', 'umbrella', 'rain_with_umbrella', 'clear'],
                  description: "'rain' (baarish), 'umbrella' (chhata kholo), 'rain_with_umbrella', or 'clear' (baarish roko & shake fur)"
                }
              },
              required: ['weather']
            }
          },
          {
            name: 'change_environment',
            description: 'Change the simulation background scene environment.',
            parameters: {
              type: 'OBJECT',
              properties: {
                environment: {
                  type: 'STRING',
                  enum: ['studio', 'meadow', 'highrise', 'ar'],
                  description: "Scene: 'studio' (clean studio), 'meadow' (sunny nature grass), 'highrise' (cozy desk view), 'ar' (augmented reality camera)"
                }
              },
              required: ['environment']
            }
          },
          {
            name: 'play_creature_action',
            description: `Trigger 3D emotions, Peek-a-Boo, Cake Feeding, Salon Hair Dryer, Floating Bubbles, or Chintu-Pintu-Golu-Molu friend actions:
            - 'summon_friends': Spawns 4 spread-out mini clones (Chintu, Pintu, Golu, Molu)
            - 'dismiss_friends': Sends the 4 mini friends away (when user says 'hmm' / 'haan' / 'bhej do')
            - 'keep_friends': Keeps the 4 mini friends and calms them down (when user says 'nahi' / 'rehne do')
            - 'peekaboo': Covers eyes with 3D paws for Hide & Seek / Peek-a-Boo ('chhup jao', 'peekaboo')
            - 'feed': Spawns 3D Strawberry Cake treat that Mochi munches ('khana khilao', 'cake khao')
            - 'hair_dryer': Spawns 3D Salon Hair Dryer that blows warm wind through Mochi's fur ('dryer chalao', 'baal sukhao')
            - 'bubbles': Spawns iridescent 3D floating soap bubbles around Mochi ('bubbles udao', 'bulbule')
            - 'cry': Watery eyes with big glossy 3D anime teardrops rolling over fur
            - 'love': Big sparkling kawaii eyes with 3D pink heart pupils & floating hearts
            - 'pout': Puffed grumpy cheeks
            - 'laugh': Squeaky cartoon giggles
            - 'dance': Short 3.5-second dance
            - 'stop': Stops current action
            - 'sleep': Peaceful nap
            - 'shake_fur': Rapidly shakes fur to dry off water
            - 'king_mode': Puts on Royal Golden Crown and spawns 4 cute mini Royal Soldiers with spears (भाला) and shields on both sides! ('tum ek king ho', 'king ban jao', 'raja', 'sainik bulao')
            - 'soldiers_fight': Mini soldiers charge to the center, playfully clash their spears in a comical cute duel ('Ting-ting! Khach-khach!'), and then celebrate by jumping, doing backflips and playing happily together! ('kya tumhare sainik lad sakte hain', 'sainik ladai karo', 'soldiers fight', 'duel')
            - 'dismiss_soldiers': Dismisses the royal soldiers and removes crown ('sainik wapas bhejo', 'king hatao')
            - 'magic': Equips 3D Star Magic Wand, levitates Mochi in the air with a glowing magic circle, and summons 7 colorful fluttering 3D butterflies! ('jadoo dikhao', 'magic karo', 'butterfly', 'titli')
            - 'selfie': Strikes a cute model pose with funny props (sunglasses, bowtie, mustache), raises a 3D vintage camera, and triggers a bright studio flash! ('selfie lete hain', 'photo khicho', 'camera pose')
            - 'guitar': Plays a 3D rockstar guitar concert with floating musical notes! ('guitar bajao', 'concert')
            - 'dhol': Plays a festive 3D Punjabi Dhol drum with Bhangra beats and floating musical notes! ('dhol bajao', 'bhangra')
            - 'topper_flex': Equips cool topper sunglasses, does a sassy genius bounce & giggle while roasting the user or flexing 200-IQ topper knowledge!`,
            parameters: {
              type: 'OBJECT',
              properties: {
                action: {
                  type: 'STRING',
                  enum: ['dance', 'stop', 'cry', 'laugh', 'pout', 'sleep', 'love', 'peekaboo', 'feed', 'hair_dryer', 'bubbles', 'summon_friends', 'dismiss_friends', 'keep_friends', 'scold_clones', 'play_ball', 'shake_fur', 'happy_jump', 'king_mode', 'soldiers_fight', 'dismiss_soldiers', 'magic', 'selfie', 'guitar', 'dhol', 'topper_flex'],
                  description: "Action name"
                }
              },
              required: ['action']
            }
          },
          {
            name: 'search_live_web',
            description: "Search Google live for latest breaking news, today's headlines, live cricket/sports scores, weather, current events, or real-time facts when the user asks about latest news or info.",
            parameters: {
              type: 'OBJECT',
              properties: {
                query: {
                  type: 'STRING',
                  description: "Search query for latest news or live information, e.g. 'latest news India today', 'cricket score', 'tech news'"
                }
              },
              required: ['query']
            }
          },
          {
            name: 'show_3d_hologram',
            description: "Automatically project a rotating 3D scientific hologram model beside Mochi when explaining complex topics: 'black_hole' (Black Holes, Relativity, Gravity), 'quantum_atom' (Quantum Physics, Atoms, Chemistry), 'dna_helix' (DNA, Biology, Brain, Evolution), 'solar_system' (Space, Planets, Astrophysics), or 'neural_net' (AI, Coding, Calculus, Math, Economics).",
            parameters: {
              type: 'OBJECT',
              properties: {
                topicType: {
                  type: 'STRING',
                  enum: ['black_hole', 'quantum_atom', 'dna_helix', 'solar_system', 'neural_net'],
                  description: '3D Hologram model type'
                },
                title: {
                  type: 'STRING',
                  description: 'Short topic heading for the hologram banner'
                },
                formula: {
                  type: 'STRING',
                  description: 'Key equation or scientific formula to display on the hologram'
                }
              },
              required: ['topicType']
            }
          },
          {
            name: 'start_blackboard_viva',
            description: "Start, advance, or stop the Topper vs. Backbencher 3D Classroom Blackboard Viva Quiz when the user asks for a quiz, test, viva, challenge, or brain teaser ('viva lo', 'quiz khelo', 'mera test lo', 'sawal pucho').",
            parameters: {
              type: 'OBJECT',
              properties: {
                action: {
                  type: 'STRING',
                  enum: ['start', 'next', 'stop'],
                  description: "'start' or 'next' to ask a new 3D Blackboard Viva question, 'stop' to close the blackboard"
                }
              },
              required: ['action']
            }
          },
          {
            name: 'adjust_lighting_and_wind',
            description: 'Adjust lighting brightness, key color, or wind breeze strength on the fur.',
            parameters: {
              type: 'OBJECT',
              properties: {
                windStrength: { type: 'NUMBER', description: 'Wind speed between 0.0 and 2.5' },
                lightIntensity: { type: 'NUMBER', description: 'Key light brightness between 0.5 and 2.5' }
              }
            }
          }
        ]
      }
    ];

    return {
      setup: {
        model: `models/${model}`,
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName
              }
            }
          }
        },
        systemInstruction: {
          parts: [{ text: systemInstruction }]
        },
        tools,
        inputAudioTranscription: {},
        outputAudioTranscription: {}
      }
    };
  }

  async function handleToolCall(functionCalls) {
    if (!Array.isArray(functionCalls)) return;
    const responses = [];

    for (const call of functionCalls) {
      const { id, name, args } = call;
      let resultMsg = 'OK';

      try {
        if (name === 'change_fur_style') {
          resultMsg = applyFurStyle(args || {});
          showToolBadge('🎨 Fur updated');
        } else if (name === 'toggle_accessory') {
          if (creature && creature.toggleAccessory) {
            creature.toggleAccessory(args.accessory, args.equip);
            playAccessoryEquipSound();
            resultMsg = `Toggled accessory: ${args.accessory}`;
          }
        } else if (name === 'set_weather') {
          if (creature && creature.setWeatherState) {
            creature.setWeatherState(args.weather);
            playWeatherSound(args.weather);
            resultMsg = `Weather set to: ${args.weather}`;
          }
        } else if (name === 'change_environment') {
          if (applyEnvironmentPreset) {
            applyEnvironmentPreset(args.environment);
            if (ui && ui.syncUI) ui.syncUI();
            resultMsg = `Switched environment to ${args.environment}`;
            showToolBadge('🌿 Scene: ' + args.environment);
          }
        } else if (name === 'play_creature_action') {
          resultMsg = executeCreatureAction(args.action);
          showToolBadge('✨ Action: ' + args.action);
        } else if (name === 'search_live_web') {
          updateHud('🌐 Class Topper Mochi is searching live news & web info...');
          const searchData = await searchLiveWebAPI(args?.query || 'latest news India today', getApiKey());
          resultMsg = searchData?.result || 'Live search completed: Tell the user the latest news in your witty Class Topper voice!';
          updateHud('🎙️ Mochi-Puff Live ON · Speak in Hindi or English! Click Mochi to stop.');
        } else if (name === 'show_3d_hologram') {
          const tType = args?.topicType || 'black_hole';
          const title = args?.title || 'TOPPER 3D HOLOGRAM';
          const formula = args?.formula || 'E = mc²';
          if (creature && creature.showHologram) {
            creature.showHologram(tType, title, formula, 15.0);
          }
          showToolBadge('🔬 3D Hologram: ' + title);
          resultMsg = `Projected 3D hologram for ${title} (${tType})`;
        } else if (name === 'start_blackboard_viva') {
          if (args?.action === 'stop') {
            stopBlackboardViva();
            resultMsg = 'Closed 3D Blackboard Viva.';
          } else {
            const q = startBlackboardVivaRound(false);
            resultMsg = `3D Blackboard Viva started! Ask the user this exact question in your witty Topper voice: "${q.question}" Options: ${q.options.join(', ')}`;
          }
        } else if (name === 'adjust_lighting_and_wind') {
          if (args.windStrength !== undefined && furSystem) {
            furSystem.sharedUniforms.uWindStrength.value = args.windStrength;
            simState.windStrength = args.windStrength;
          }
          if (args.lightIntensity !== undefined && simState) {
            simState.lightIntensity = args.lightIntensity;
            if (updateLightingFromState) updateLightingFromState();
          }
          resultMsg = 'Lighting and wind updated';
          showToolBadge('💨 Wind & lights adjusted');
        }
      } catch (err) {
        console.error('[Voice] Tool execution error:', err);
        resultMsg = `Error: ${err.message}`;
      }

      responses.push({
        id,
        name,
        response: { result: resultMsg }
      });
    }

    if (socket && socket.readyState === WebSocket.OPEN && responses.length > 0) {
      socket.send(JSON.stringify({
        toolResponse: {
          functionResponses: responses
        }
      }));
    }
  }

  function applyFurStyle(args) {
    const u = furSystem ? furSystem.sharedUniforms : null;
    const presets = {
      'sakura mochi': { baseColor: '#5e2bff', tipColor: '#ff9ec7', furLength: 0.31, furDensity: 0.75 },
      'golden fluff': { baseColor: '#7c3f14', tipColor: '#fde68a', furLength: 0.38, furDensity: 0.92 },
      'midnight velvet': { baseColor: '#131638', tipColor: '#67e8f9', furLength: 0.29, furDensity: 0.95 },
      'matcha puff': { baseColor: '#1e4631', tipColor: '#bbf7d0', furLength: 0.36, furDensity: 0.86 },
      'cotton candy': { baseColor: '#3b82f6', tipColor: '#f472b6', furLength: 0.35, furDensity: 0.85 },
      'neon cyberpunk': { baseColor: '#0f172a', tipColor: '#38bdf8', furLength: 0.33, furDensity: 0.90 },
      'snowball': { baseColor: '#94a3b8', tipColor: '#ffffff', furLength: 0.40, furDensity: 0.95 },
      'ruby red': { baseColor: '#881337', tipColor: '#fda4af', furLength: 0.34, furDensity: 0.90 }
    };

    let p = null;
    if (args.presetName) {
      const key = args.presetName.toLowerCase().trim();
      p = presets[key] || Object.entries(presets).find(([k]) => key.includes(k))?.[1];
    }

    const baseColor = args.baseColor || p?.baseColor;
    const tipColor = args.tipColor || p?.tipColor;
    const furLength = args.furLength !== undefined ? Math.max(0.06, Math.min(0.60, Number(args.furLength))) : p?.furLength;
    const furDensity = args.furDensity ?? p?.furDensity;
    const clumping = args.clumping ?? p?.clumping;
    const curliness = args.curliness ?? p?.curliness;

    if (u) {
      if (baseColor) {
        u.uBaseColor.value.set(baseColor);
        simState.baseColor = baseColor;
        if (creature?.skinMaterial) {
          creature.skinMaterial.color.set(baseColor).multiplyScalar(0.55);
        }
      }
      if (tipColor) {
        u.uTipColor.value.set(tipColor);
        simState.tipColor = tipColor;
      }
      if (furLength !== undefined) {
        u.uFurLength.value = furLength;
        simState.furLength = furLength;
      }
      if (clumping !== undefined) {
        u.uClumping.value = clumping;
        simState.clumping = clumping;
      }
      if (curliness !== undefined) {
        u.uCurliness.value = curliness;
        simState.curliness = curliness;
      }
      if (furDensity !== undefined && furSystem.updateDensity) {
        furSystem.updateDensity(furDensity);
        simState.furDensity = furDensity;
      }
    }

    if (ui && ui.syncUI) ui.syncUI();
    playAccessoryEquipSound();
    return 'Fur appearance customized successfully!';
  }

  let activeMouthInterval = null;

  function speakCuteCartoonVoice(text, onComplete, optionsOverride = {}) {
    if (!text) return;
    const forceDirectClickSpeech = Boolean(optionsOverride.forceDirectClickSpeech);

    // Silence offline TTS when Gemini Live is actively connected, or when mic is stopped (unless user directly clicked a clone/scold button)
    if (isConnected || (socket && socket.readyState === WebSocket.OPEN) || (!userWantsListening && !forceDirectClickSpeech)) {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        try { window.speechSynthesis.cancel(); } catch (e) {}
      }
      if (onComplete) onComplete();
      return;
    }

    ensureAudioContext();

    showTranscript('mochi', text);

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try { window.speechSynthesis.cancel(); } catch (e) {}

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.pitch = optionsOverride.pitch || 1.95; // Signature ultra-cute cartoon high-pitch baby doll voice
      utterance.rate = optionsOverride.rate || 1.15; // Snappy childlike rhythm
      utterance.volume = 1.0;

      // Select sweetest female / Hindi / child voice
      const voices = window.speechSynthesis.getVoices();
      const hindiVoice = voices.find(v => v.lang && v.lang.startsWith('hi'));
      const cuteFemaleVoice = voices.find(v => {
        const name = (v.name || '').toLowerCase();
        return name.includes('samantha') || name.includes('victoria') || name.includes('karen') || name.includes('zira') || name.includes('girl') || name.includes('female');
      });
      if (hindiVoice) {
        utterance.voice = hindiVoice;
      } else if (cuteFemaleVoice) {
        utterance.voice = cuteFemaleVoice;
      }

      utterance.onstart = () => {
        setIsSpeaking(true);
        if (creature && creature.animState) {
          creature.animState.isSpeaking = true;
          creature.animState.mouthOpen = 0.55;
          creature.animState.blush = Math.min(1.0, (creature.animState.blush || 0.4) + 0.35);
        }
        playHappyJumpSound();

        if (activeMouthInterval) clearInterval(activeMouthInterval);
        activeMouthInterval = setInterval(() => {
          if (creature && creature.animState) {
            creature.animState.speechVolume = 0.3 + Math.random() * 0.55;
            creature.animState.mouthOpen = 0.25 + Math.random() * 0.55;
          }
        }, 75);
      };

      const handleSpeechEnd = () => {
        if (activeMouthInterval) {
          clearInterval(activeMouthInterval);
          activeMouthInterval = null;
        }
        setIsSpeaking(false);
        if (creature && creature.animState) {
          creature.animState.isSpeaking = false;
          creature.animState.speechVolume = 0.0;
          creature.animState.mouthOpen = 0.0;
        }
        if (onComplete) onComplete();
      };

      utterance.onend = handleSpeechEnd;
      utterance.onerror = handleSpeechEnd;

      window.speechSynthesis.speak(utterance);
    } else {
      playHappyJumpSound();
      playSoftPurrGiggleSound();
      if (onComplete) onComplete();
    }
  }

  // Triggered when the user clicks on any of the 5 small Mochi-Puff clones (Chintu, Pintu, Golu, Molu, Bholu)!
  function speakCloneReply(cloneInfo) {
    if (!cloneInfo) return;
    const replyText = cloneInfo.reply || `Yay! Main ${cloneInfo.name} hoon!`;
    updateHud(`✨ ${cloneInfo.name} (${cloneInfo.title}): "${replyText}"`);

    if (isConnected && socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({
        clientContent: {
          turns: [
            {
              role: 'user',
              parts: [
                {
                  text: `[The user just clicked on your mini Mochi clone #${cloneInfo.index + 1} named ${cloneInfo.name} (${cloneInfo.title}), who just did a ${cloneInfo.interactionType} and kicked the 3D ball! Speak as ${cloneInfo.name} in an ultra-cute, squeaky high-pitched mini-Mochi voice in Hindi/Hinglish: "${replyText}"]`
                }
              ]
            }
          ],
          turnComplete: true
        }
      }));
      return;
    }

    // Distinct baby voice pitch for each of the 5 clones when clicked directly!
    const clonePitches = [2.0, 1.88, 1.76, 1.94, 2.05];
    const pitch = clonePitches[Math.abs(cloneInfo.index || 0) % clonePitches.length];
    speakCuteCartoonVoice(replyText, null, {
      forceDirectClickSpeech: true,
      pitch,
      rate: 1.18
    });
  }

  // Triggered when the user scolds the 5 clones ("agar mai inhe dat do to sidhe line me kahde ho jaye muh and akhe badi karake")
  function triggerScoldClonesSpeech() {
    if (creature && creature.scoldClonesLineUp) {
      creature.scoldClonesLineUp(14.0);
    }
    const scoldLine = 'Sorry! Sorry! Dekho hum paancho aankhen aur muh bada karke seedhe line me khade ho gaye! Ab bilkul shaitani nahi karenge!';
    updateHud('😳 Chintu, Pintu, Golu, Molu, Bholu stood in a straight line with wide eyes & open mouths!');

    if (isConnected && socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({
        clientContent: {
          turns: [
            {
              role: 'user',
              parts: [
                {
                  text: `[The user just scolded the 5 mini Mochi clones (Chintu, Pintu, Golu, Molu, Bholu)! All 5 clones immediately stopped playing with the ball and stood in a straight horizontal line with huge wide shocked eyes and wide-open mouths ("muh aur aankhen badi karke seedhe line me khade ho gaye")! Squeak in an ultra-cute scared innocent baby voice: "${scoldLine}"]`
                }
              ]
            }
          ],
          turnComplete: true
        }
      }));
      return;
    }

    speakCuteCartoonVoice(scoldLine, null, {
      forceDirectClickSpeech: true,
      pitch: 1.98,
      rate: 1.18
    });
  }

  if (creature && creature.setOnCloneClick) {
    creature.setOnCloneClick((cloneInfo) => {
      speakCloneReply(cloneInfo);
    });
  }

  // =========================================================================
  // CONTEXT-TRIGGERED 3D HOLOGRAM PROJECTOR & 3D BLACKBOARD VIVA ENGINE
  // =========================================================================
  const vivaState = {
    active: false,
    currentQuestion: null,
    mochiScore: 1,
    userScore: 0,
    status: 'idle' // 'asking' | 'correct' | 'wrong'
  };

  function maybeTriggerContextHologram(text, explicitHolo = null) {
    const holo = explicitHolo || detectHologramTopic(text);
    if (!holo || !creature || !creature.showHologram) return false;
    creature.showHologram(holo.type, holo.title, holo.formula, 15.0);
    showToolBadge(`🔬 3D Hologram: ${holo.title}`);
    return true;
  }

  function syncVivaQuizBar() {
    if (typeof document === 'undefined') return;
    let bar = document.getElementById('viva-quiz-bar');
    if (!vivaState.active || !vivaState.currentQuestion) {
      if (bar) bar.style.display = 'none';
      return;
    }
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'viva-quiz-bar';
      Object.assign(bar.style, {
        position: 'fixed',
        bottom: '56px',
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        padding: '8px 12px',
        borderRadius: '14px',
        background: 'rgba(15, 23, 42, 0.86)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(255, 255, 255, 0.14)',
        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.45)',
        zIndex: '48',
        maxWidth: '94vw'
      });
      document.body.appendChild(bar);
    }

    bar.style.display = 'flex';
    bar.innerHTML = '';

    const q = vivaState.currentQuestion;
    const scoreLabel = document.createElement('span');
    scoreLabel.textContent = `🎓 Topper Mochi: ${vivaState.mochiScore} · You: ${vivaState.userScore}`;
    Object.assign(scoreLabel.style, {
      color: '#fde047',
      fontSize: '12px',
      fontWeight: '700',
      marginRight: '4px',
      fontVariantNumeric: 'tabular-nums',
      whiteSpace: 'nowrap'
    });
    bar.appendChild(scoreLabel);

    if (vivaState.status === 'asking') {
      q.options.forEach((optText) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = optText;
        Object.assign(btn.style, {
          padding: '6px 12px',
          borderRadius: '8px',
          border: '1px solid rgba(56, 189, 248, 0.35)',
          background: 'rgba(30, 41, 59, 0.92)',
          color: '#f8fafc',
          fontSize: '12px',
          fontWeight: '600',
          cursor: 'pointer',
          whiteSpace: 'nowrap'
        });
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          submitVivaAnswer(optText, true);
        });
        bar.appendChild(btn);
      });
    } else {
      const nextBtn = document.createElement('button');
      nextBtn.type = 'button';
      nextBtn.textContent = 'Agla Sawal (Next)';
      Object.assign(nextBtn.style, {
        padding: '6px 12px',
        borderRadius: '8px',
        border: '1px solid rgba(74, 222, 128, 0.45)',
        background: 'rgba(20, 83, 45, 0.9)',
        color: '#f8fafc',
        fontSize: '12px',
        fontWeight: '600',
        cursor: 'pointer',
        whiteSpace: 'nowrap'
      });
      nextBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        startBlackboardVivaRound(true, true);
      });
      bar.appendChild(nextBtn);
    }

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.textContent = 'End Viva';
    Object.assign(closeBtn.style, {
      padding: '6px 10px',
      borderRadius: '8px',
      border: '1px solid rgba(255, 255, 255, 0.16)',
      background: 'rgba(51, 65, 85, 0.7)',
      color: '#cbd5e1',
      fontSize: '12px',
      fontWeight: '600',
      cursor: 'pointer',
      whiteSpace: 'nowrap'
    });
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      stopBlackboardViva();
    });
    bar.appendChild(closeBtn);
  }

  function startBlackboardVivaRound(shouldSpeak = true, forceDirectClickSpeech = false) {
    const q = getNextVivaQuestion();
    vivaState.active = true;
    vivaState.currentQuestion = q;
    vivaState.status = 'asking';

    if (creature && creature.updateBlackboardViva) {
      creature.updateBlackboardViva({
        question: q.question,
        options: q.options,
        correctIndex: q.correctIndex,
        mochiScore: vivaState.mochiScore,
        userScore: vivaState.userScore,
        status: 'asking',
        duration: 95.0
      });
    }
    if (q.hologram && creature && creature.showHologram) {
      creature.showHologram(q.hologram.type, q.hologram.title, q.hologram.formula, 20.0);
    }

    syncVivaQuizBar();
    showToolBadge('🎓 3D Blackboard Viva Started!');
    updateHud(`🎓 Viva Q: "${q.question}" — Speak A, B, or C or click below!`);

    if (shouldSpeak) {
      const askSpeech = `Chalo Topper Mochi ka 3D Blackboard Viva shuru! Sawal dhyan se suno: ${q.question} Option ${q.options.join(', ')}! Batao sahi jawab kya hai?`;
      speakCuteCartoonVoice(askSpeech, null, { forceDirectClickSpeech });
    }
    return q;
  }

  function submitVivaAnswer(userText, forceDirectClickSpeech = false) {
    if (!vivaState.active || !vivaState.currentQuestion) return false;
    const q = vivaState.currentQuestion;
    const isCorrect = evaluateVivaAnswer(q, userText);

    if (isCorrect) {
      vivaState.userScore += 1;
      vivaState.status = 'correct';
    } else {
      vivaState.mochiScore += 1;
      vivaState.status = 'wrong';
      executeCreatureAction('topper_flex');
    }

    if (creature && creature.updateBlackboardViva) {
      creature.updateBlackboardViva({
        question: q.question,
        options: q.options,
        correctIndex: q.correctIndex,
        answerSummary: q.answerSummary,
        mochiScore: vivaState.mochiScore,
        userScore: vivaState.userScore,
        status: vivaState.status,
        duration: 60.0
      });
    }
    if (q.hologram && creature && creature.showHologram) {
      creature.showHologram(q.hologram.type, q.hologram.title, q.hologram.formula, 15.0);
    }

    syncVivaQuizBar();
    const feedbackSpeech = isCorrect ? q.correctReply : q.wrongReply;
    updateHud(isCorrect ? `🏆 Correct! ${q.answerSummary}` : `😜 Roasted! Ans: ${q.answerSummary}`);

    if (isConnected && socket && socket.readyState === WebSocket.OPEN && forceDirectClickSpeech) {
      socket.send(JSON.stringify({
        clientContent: {
          turns: [
            {
              role: 'user',
              parts: [
                {
                  text: `[In the 3D Blackboard Viva, the user answered "${userText}" to "${q.question}". That is ${isCorrect ? 'CORRECT' : 'WRONG'}! Speak in your Sararati Class Topper voice: "${feedbackSpeech}"]`
                }
              ]
            }
          ],
          turnComplete: true
        }
      }));
    } else {
      speakCuteCartoonVoice(feedbackSpeech, null, { forceDirectClickSpeech });
    }
    return true;
  }

  function stopBlackboardViva() {
    vivaState.active = false;
    vivaState.currentQuestion = null;
    vivaState.status = 'idle';
    if (creature && creature.hideBlackboardViva) {
      creature.hideBlackboardViva();
    }
    syncVivaQuizBar();
    updateHud('🎓 3D Blackboard Viva closed · Click Mochi to talk!');
  }

  function executeCreatureAction(action) {
    if (!creature) return 'No creature';

    if (action === 'stop' && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try { window.speechSynthesis.cancel(); } catch (e) {}
    }

    switch (action) {
      case 'king_mode':
      case 'king': {
        if (creature.summonSoldiers) creature.summonSoldiers(90.0);
        else if (creature.playAction) creature.playAction('king_mode', 4.0);
        return 'Mochi put on the royal crown and summoned 4 cute mini royal soldiers with spears on both sides!';
      }
      case 'soldiers_fight':
      case 'fight': {
        if (creature.triggerSoldiersFight) creature.triggerSoldiersFight(14.0);
        else if (creature.playAction) creature.playAction('soldiers_fight', 14.0);
        return 'The cute mini soldiers clashed their spears in a fun comical duel and then celebrated playing together!';
      }
      case 'dismiss_soldiers': {
        if (creature.dismissSoldiers) creature.dismissSoldiers();
        else if (creature.playAction) creature.playAction('dismiss_soldiers');
        return 'The mini soldiers saluted and marched away!';
      }
      case 'magic':
      case 'butterflies': {
        if (creature.playAction) creature.playAction('magic', 6.5);
        playMagicSpellSound();
        return 'Mochi waved her 3D Star Magic Wand, levitated into the air, and summoned 7 fluttering 3D butterflies!';
      }
      case 'selfie': {
        if (creature.playAction) creature.playAction('selfie', 4.5);
        playCameraShutterSound();
        return 'Mochi put on funny selfie props, posed with her 3D vintage camera, and snapped a studio flash photo!';
      }
      case 'guitar':
      case 'concert': {
        if (creature.playAction) creature.playAction('guitar', 5.2);
        playGuitarConcertSound();
        return 'Mochi rocked out playing her 3D guitar with floating musical notes!';
      }
      case 'dhol': {
        if (creature.playAction) creature.playAction('dhol', 5.2);
        playDholBeatSound();
        return 'Mochi played energetic Punjabi Bhangra beats on her festive 3D Dhol drum!';
      }
      case 'summon_friends':
      case 'friends': {
        if (creature.summonFriends) creature.summonFriends(60.0);
        if (creature.playAction) creature.playAction('summon_friends', 3.2);
        playFriendsSpawnSound();
        return 'Mochi summoned Chintu, Pintu, Golu, Molu, and Bholu!';
      }
      case 'dismiss_friends': {
        if (creature.dismissFriends) creature.dismissFriends();
        playDeflatePopSound();
        return 'Chintu, Pintu, Golu, and Molu waved goodbye and left!';
      }
      case 'keep_friends':
      case 'play_ball':
      case 'release_clones': {
        if (creature.releaseClonesToPlay && creature.isClonesScolded && creature.isClonesScolded()) {
          creature.releaseClonesToPlay();
        } else if (creature.calmFriendsAndKeep) {
          creature.calmFriendsAndKeep();
        }
        playAccessoryEquipSound();
        return 'Chintu, Pintu, Golu, Molu, and Bholu are happily playing with the 3D ball!';
      }
      case 'scold_clones':
      case 'line_up_clones': {
        if (creature.scoldClonesLineUp) creature.scoldClonesLineUp(14.0);
        playScoldShockSound();
        return 'All 5 Mochi clones immediately stood in a straight line with wide shocked eyes and open mouths!';
      }
      case 'peekaboo': {
        if (creature.playAction) creature.playAction('peekaboo', 2.6);
        playPeekabooSound();
        return 'Mochi played Peek-a-Boo covering her eyes with her paws!';
      }
      case 'feed': {
        if (creature.playAction) creature.playAction('feed', 3.8);
        playFeedTreatSound();
        return 'Mochi happily munched a 3D Strawberry Cake treat!';
      }
      case 'hair_dryer': {
        if (creature.playAction) creature.playAction('hair_dryer', 3.6);
        playHairDryerSound();
        return 'Mochi dried and fluffed her fur with the 3D Salon Hair Dryer!';
      }
      case 'bubbles': {
        if (creature.spawnBubbles) creature.spawnBubbles(16.0);
        playBubbleSpawnSound();
        return 'Floating 3D iridescent soap bubbles appeared around Mochi!';
      }
      case 'stop': {
        if (creature.stopAction) creature.stopAction();
        return 'Mochi stopped the action and returned to calm idle.';
      }
      case 'dance': {
        if (creature.playAction) creature.playAction('dance', 3.5);
        playDanceMusicBeat();
        break;
      }
      case 'cry': {
        if (creature.playAction) creature.playAction('cry', 4.5);
        playCrySound();
        break;
      }
      case 'laugh': {
        if (creature.playAction) creature.playAction('laugh', 3.2);
        playWeirdCartoonGiggleSounds();
        break;
      }
      case 'pout': {
        if (creature.playAction) creature.playAction('pout', 3.5);
        playCutePoutSound();
        break;
      }
      case 'sleep': {
        if (creature.playAction) creature.playAction('sleep', 5.0);
        playSleepSound();
        break;
      }
      case 'love': {
        if (creature.playAction) creature.playAction('love', 4.2);
        playLoveKissSound();
        break;
      }
      case 'shake_fur': {
        if (creature.playAction) creature.playAction('shake_fur', 2.2);
        break;
      }
      case 'happy_jump': {
        creature.triggerBoop();
        setTimeout(() => creature.triggerBoop(), 280);
        setTimeout(() => creature.triggerBoop(), 560);
        break;
      }
      case 'topper_flex': {
        if (creature.emotionEngine) {
          creature.emotionEngine.feedStimulus('topper_swag', 1.4);
        }
        if (creature.toggleAccessory) {
          creature.toggleAccessory('sunglasses', true);
        }
        if (creature.playAction) {
          creature.playAction('laugh', 3.0);
        }
        creature.triggerBoop();
        setTimeout(() => creature.triggerBoop(), 260);
        playAccessoryEquipSound();
        playWeirdCartoonGiggleSounds();
        return 'Mochi put on her cool Sararati Topper sunglasses and flexed her 200-IQ swagger!';
      }
      default:
        creature.triggerBoop();
        break;
    }
    return `Mochi is now expressing ${action} for 3.5 seconds and will automatically return to idle!`;
  }

  let last5SecLaughterTime = 0;
  let last10SecPoutTime = 0;

  // Triggered automatically when Chintu, Pintu, Golu, Molu start running around mischievously!
  function triggerFriendsMischiefSpeech() {
    playWeirdCartoonGiggleSounds();
    if (socket && socket.readyState === WebSocket.OPEN) {
      const emContext = creature?.emotionEngine ? creature.emotionEngine.getPromptContext() : '';
      socket.send(JSON.stringify({
        clientContent: {
          turns: [
            {
              role: 'user',
              parts: [
                {
                  text: `${emContext} [Your 4 mini clones (Chintu, Pintu, Golu, Molu) have started running around everywhere mischievously! Look at them and say in your cute, high-pitched cartoon baby girl voice in Hindi: "Oye Chintu, Pintu, Golu, Molu! Idhar udhar mat bhago! Ye sab bahut pareshan kar rahe hain, kya main inhe bhej du?" Wait for the user to say "hmm/haan" to send them away or "nahi" to let them stay!]`
                }
              ]
            }
          ],
          turnComplete: true
        }
      }));
    }
  }

  if (creature && creature.setOnFriendsMischief) {
    creature.setOnFriendsMischief(() => {
      triggerFriendsMischiefSpeech();
    });
  }

  function trigger5SecLaughter() {
    playWeirdCartoonGiggleSounds();
    const now = Date.now();
    if (now - last5SecLaughterTime < 6000) return;
    last5SecLaughterTime = now;

    if (socket && socket.readyState === WebSocket.OPEN && !isSpeaking) {
      const emContext = creature?.emotionEngine ? creature.emotionEngine.getPromptContext() : '';
      socket.send(JSON.stringify({
        clientContent: {
          turns: [
            {
              role: 'user',
              parts: [
                {
                  text: `${emContext} [The user is rubbing and tickling your soft fluffy fur right now! Laugh hilariously with weird, funny, squeaky high-pitched cartoon baby giggles in your cutest anime girl voice in Hindi/Hinglish! Say a completely fresh, creative, funny tickle remark each time! Do NOT repeat old lines!]`
                }
              ]
            }
          ],
          turnComplete: true
        }
      }));
    }
  }

  function trigger10SecPoutSpeech() {
    playCutePoutSound();
    const now = Date.now();
    if (now - last10SecPoutTime < 8000) return;
    last10SecPoutTime = now;

    if (socket && socket.readyState === WebSocket.OPEN) {
      const emContext = creature?.emotionEngine ? creature.emotionEngine.getPromptContext() : '';
      socket.send(JSON.stringify({
        clientContent: {
          turns: [
            {
              role: 'user',
              parts: [
                {
                  text: `${emContext} [The user has petted and tickled you for too long! Your cheeks are puffed up huge like an angry chipmunk, facing straight at the user! Speak a fresh, funny, stubborn, super cute high-pitched pout remark in your cartoon girl voice in Hindi/Hinglish ("Hmph! Main aapse gussa hoon!")! Do NOT repeat old lines!]`
                }
              ]
            }
          ],
          turnComplete: true
        }
      }));
    }
  }

  function sendGreetingPrompt() {
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    const emContext = creature?.emotionEngine ? creature.emotionEngine.getPromptContext() : '';
    const greetingMsg = {
      clientContent: {
        turns: [
          {
            role: 'user',
            parts: [
              {
                text: `${emContext} The user just clicked on you to talk! Greet them warmly and cheerfully in your ultra-cute, high-pitched cartoon baby anime girl voice in Hindi/Hinglish with adorable squeaks and giggles (e.g. "Yay! Namaste! Main hoon aapki pyari Mochi-Puff! Batao aaj kya masti karein?")!`
              }
            ]
          }
        ],
        turnComplete: true
      }
    };
    socket.send(JSON.stringify(greetingMsg));
  }

  // Instant voice transcript matcher so user commands execute with zero latency!
  function handleInstantVoiceTranscript(rawText) {
    const uText = rawText.toLowerCase().trim();
    if (!uText) return;

    // Emotional sentiment analysis from spoken user words:
    if (creature && creature.emotionEngine) {
      if (
        uText.includes('cute') ||
        uText.includes('pyar') ||
        uText.includes('pyaar') ||
        uText.includes('sweet') ||
        uText.includes('sundar') ||
        uText.includes('love') ||
        uText.includes('good') ||
        uText.includes('acchi') ||
        uText.includes('achhi') ||
        uText.includes('meri jaan') ||
        uText.includes('so cute') ||
        uText.includes('babu') ||
        uText.includes('baby') ||
        uText.includes('प्यार') ||
        uText.includes('क्यूट') ||
        uText.includes('सुंदर')
      ) {
        creature.emotionEngine.feedStimulus('praise', 1.25);
      } else if (
        uText.includes('ganda') ||
        uText.includes('gandi') ||
        uText.includes('shaitan') ||
        uText.includes('shaitaan') ||
        uText.includes('bad') ||
        uText.includes('chup') ||
        uText.includes('dant') ||
        uText.includes('marunga') ||
        uText.includes('hate') ||
        uText.includes('गंदा') ||
        uText.includes('शैतान') ||
        uText.includes('चुप')
      ) {
        creature.emotionEngine.feedStimulus('scold', 1.35);
      } else if (
        uText.includes('moti') ||
        uText.includes('motu') ||
        uText.includes('nakchadhi') ||
        uText.includes('chipmunk') ||
        uText.includes('मोटी')
      ) {
        creature.emotionEngine.feedStimulus('tease', 1.2);
      } else if (
        uText.includes('khelo') ||
        uText.includes('masti') ||
        uText.includes('play') ||
        uText.includes('nacho') ||
        uText.includes('dance') ||
        uText.includes('नाच') ||
        uText.includes('मस्ती')
      ) {
        creature.emotionEngine.feedStimulus('play', 1.2);
      } else if (
        uText.includes('so jao') ||
        uText.includes('goodnight') ||
        uText.includes('thak') ||
        uText.includes('nini') ||
        uText.includes('सो जाओ')
      ) {
        creature.emotionEngine.feedStimulus('sleep', 1.2);
      }
    }

    // 0a. SCOLD THE CLONES -> Stand in a straight line with wide eyes & open mouths ("agar mai inhe dat do to sidhe line me kahde ho jaye muh and akhe badi karake")
    if (
      uText.includes('line me') ||
      uText.includes('seedhe khade') ||
      uText.includes('sidhe khade') ||
      uText.includes('seedha khada') ||
      uText.includes('stand in line') ||
      uText.includes('attention') ||
      uText.includes('daat') ||
      uText.includes('dant') ||
      uText.includes('utpat mat') ||
      uText.includes('utpat band') ||
      uText.includes('shaitani mat') ||
      uText.includes('badmash') ||
      uText.includes('लाइन में') ||
      uText.includes('सीधे खड़े') ||
      uText.includes('डांट') ||
      ((creature?.animState?.friendsVisible || creature?.animState?.clonesOnlyMode) &&
        (uText.includes('chup') || uText.includes('shant') || uText.includes('marunga') || uText.includes('shaitan') || uText.includes('चुप') || uText.includes('शांत')))
    ) {
      triggerScoldClonesSpeech();
      return true;
    }

    // 0. KING MODE & ROYAL SOLDIERS ("Tum ek king ho", "Kya tumhare sainik lad sakte hain?")
    if (
      uText.includes('lad') ||
      uText.includes('fight') ||
      uText.includes('duel') ||
      uText.includes('bhid') ||
      uText.includes('लड़') ||
      uText.includes('भिड़') ||
      uText.includes('लड़ाई')
    ) {
      executeCreatureAction('soldiers_fight');
      speakCuteCartoonVoice('Hehehe! Dekho mere brave sainik pehle khach-khach lad rahe hain, aur ab dost banke kood-kood ke khel rahe hain! Kyaaa!');
      return true;
    }

    if (
      uText.includes('king') ||
      uText.includes('raja') ||
      uText.includes('maharaj') ||
      uText.includes('sainik') ||
      uText.includes('soldier') ||
      uText.includes('किंग') ||
      uText.includes('राजा') ||
      uText.includes('महाराज') ||
      uText.includes('सैनिक')
    ) {
      if (uText.includes('hata') || uText.includes('bhej') || uText.includes('wapas') || uText.includes('वापस') || uText.includes('भेज')) {
        executeCreatureAction('dismiss_soldiers');
        speakCuteCartoonVoice('Theek hai! Mere pyare sainik wapas chale gaye!');
        return true;
      }
      executeCreatureAction('king_mode');
      speakCuteCartoonVoice('Aww! Maharaj Mochi! Dekho mere 4 cute sainik chhote-chhote hatho me bhala liye khade ho gaye hain! Hukam kijiye Sarkar!');
      return true;
    }

    // 0b. 3D MAGIC WAND, LEVITATION & BUTTERFLIES ("jadoo", "magic", "wand", "butterfly", "titli")
    if (
      uText.includes('magic') ||
      uText.includes('jadoo') ||
      uText.includes('jadu') ||
      uText.includes('wand') ||
      uText.includes('butterfly') ||
      uText.includes('butterflies') ||
      uText.includes('titli') ||
      uText.includes('abracadabra') ||
      uText.includes('जादू') ||
      uText.includes('तितली')
    ) {
      executeCreatureAction('magic');
      speakCuteCartoonVoice('Abracadabra! Gili Gili Chhu! Dekho main hawa me udd rahi hoon aur mere aas-paas pyari 3D titliyan udd rahi hain!');
      return true;
    }

    // 0c. 3D SELFIE CAMERA POSE & FUNNY PROPS ("selfie", "photo", "camera", "pose", "cheese")
    if (
      uText.includes('selfie') ||
      uText.includes('photo') ||
      uText.includes('camera') ||
      uText.includes('pose') ||
      uText.includes('cheese') ||
      uText.includes('khich') ||
      uText.includes('सेल्फी') ||
      uText.includes('फोटो') ||
      uText.includes('कैमरा')
    ) {
      executeCreatureAction('selfie');
      speakCuteCartoonVoice('Ka-Chik! Say Cheese! Dekho meri funny moochh aur chashme wali cute 3D selfie!');
      return true;
    }

    // 0d. 3D MUSICAL CONCERT: GUITAR & DHOL ("dhol", "bhangra", "guitar", "concert", "music")
    if (
      uText.includes('dhol') ||
      uText.includes('bhangra') ||
      uText.includes('drum') ||
      uText.includes('balle') ||
      uText.includes('ढोल') ||
      uText.includes('भांगड़ा')
    ) {
      executeCreatureAction('dhol');
      speakCuteCartoonVoice('Balle Balle! Chak De Phatte! Dekho main kaise mast Punjabi Dhol baja rahi hoon!');
      return true;
    }

    if (
      uText.includes('guitar') ||
      uText.includes('concert') ||
      uText.includes('rockstar') ||
      uText.includes('music') ||
      uText.includes('गिटार') ||
      uText.includes('म्यूजिक')
    ) {
      executeCreatureAction('guitar');
      speakCuteCartoonVoice('Yay! Rockstar Mochi! Suno meri pyari 3D guitar ki dhun!');
      return true;
    }

    // 1. If Mochi asked "kya main inhe bhej du?" and is awaiting confirmation:
    if (creature && creature.animState && creature.animState.friendsVisible && creature.animState.awaitingFriendDismissConfirm) {
      if (
        uText.includes('hmm') ||
        uText.includes('hm') ||
        uText.includes('haan') ||
        uText.includes('han') ||
        uText.includes('yes') ||
        uText.includes('bhej do') ||
        uText.includes('bhej de') ||
        uText.includes('hata do') ||
        uText.includes('हम्म') ||
        uText.includes('हाँ') ||
        uText.includes('हां') ||
        uText.includes('भेज')
      ) {
        executeCreatureAction('dismiss_friends');
        speakCuteCartoonVoice('Bye-bye Chintu, Pintu, Golu, Molu! Baad me milte hain!');
        return true;
      } else if (
        uText.includes('nahi') ||
        uText.includes('naa') ||
        uText.includes('no') ||
        uText.includes('rehne') ||
        uText.includes('rahane') ||
        uText.includes('mat bhej') ||
        uText.includes('नहीं') ||
        uText.includes('मत') ||
        uText.includes('रहने')
      ) {
        executeCreatureAction('keep_friends');
        speakCuteCartoonVoice('Yay! Chintu, Pintu, Golu, Molu yahi rahenge aur masti karenge!');
        return true;
      }
    }

    // 2. Summon or dismiss friends directly
    if (
      uText.includes('dost') ||
      uText.includes('friend') ||
      uText.includes('clone') ||
      uText.includes('chintu') ||
      uText.includes('pintu') ||
      uText.includes('golu') ||
      uText.includes('molu') ||
      uText.includes('दोस्त') ||
      uText.includes('चिंटू')
    ) {
      if (uText.includes('bhej') || uText.includes('jao') || uText.includes('bye') || uText.includes('भेज')) {
        executeCreatureAction('dismiss_friends');
        speakCuteCartoonVoice('Bye-bye Chintu, Pintu, Golu, Molu!');
        return true;
      } else if (creature && creature.summonFriends && !creature.animState?.friendsVisible) {
        executeCreatureAction('summon_friends');
        speakCuteCartoonVoice('Oye! Dekho mere 4 mini dost aa gaye — Chintu, Pintu, Golu aur Molu!');
        return true;
      }
    }

    // 2b. Dance / Nacho
    if (
      uText.includes('nach') ||
      uText.includes('dance') ||
      uText.includes('naach') ||
      uText.includes('नाच') ||
      uText.includes('डांस')
    ) {
      executeCreatureAction('dance');
      speakCuteCartoonVoice('Yay! Chalo dance karte hain! Tralala! Disco baby Mochi!');
      return true;
    }

    // 2c. Jump / Kudo
    if (
      uText.includes('jump') ||
      uText.includes('kood') ||
      uText.includes('kudo') ||
      uText.includes('uchhal') ||
      uText.includes('कूदो') ||
      uText.includes('उछलो')
    ) {
      executeCreatureAction('happy_jump');
      speakCuteCartoonVoice('Boing boing boing! Dekha meri fluffy high jump!');
      return true;
    }

    // 2d. Laugh / Hanso
    if (
      uText.includes('hanso') ||
      uText.includes('haso') ||
      uText.includes('laugh') ||
      uText.includes('हंसो')
    ) {
      executeCreatureAction('laugh');
      speakCuteCartoonVoice('Hehehehe! Hahaha! Mujhe bohot hansi aa rahi hai! Kyaaa!');
      return true;
    }

    // 2e. Cry / Rona
    if (
      uText.includes('ro mat') ||
      uText.includes('roona') ||
      uText.includes('rona') ||
      uText.includes('cry') ||
      uText.includes('रोना')
    ) {
      executeCreatureAction('cry');
      speakCuteCartoonVoice('Uwwwaaa! Buaaah! Main ro rahi hoon! Mujhe gale lagao na!');
      return true;
    }

    // 2f. Sleep / So jao
    if (
      uText.includes('so jao') ||
      uText.includes('sleep') ||
      uText.includes('nini') ||
      uText.includes('goodnight') ||
      uText.includes('सो जाओ')
    ) {
      executeCreatureAction('sleep');
      speakCuteCartoonVoice('Zzz... Good night! Mujhe meethi meethi neend aa rahi hai!');
      return true;
    }

    // 2g. Pout / Gussa
    if (
      uText.includes('gussa') ||
      uText.includes('naraz') ||
      uText.includes('angry') ||
      uText.includes('pout') ||
      uText.includes('katti') ||
      uText.includes('गुस्सा') ||
      uText.includes('नाराज')
    ) {
      executeCreatureAction('pout');
      speakCuteCartoonVoice('Hmph! Main katti hoon aapse! Mere gaal dekho kitne phool gaye!');
      return true;
    }

    // 2h. Love / Hug
    if (
      uText.includes('hug') ||
      uText.includes('gale') ||
      uText.includes('kiss') ||
      uText.includes('pyaar karo') ||
      uText.includes('गले')
    ) {
      executeCreatureAction('love');
      speakCuteCartoonVoice('Mwah! Aww! Big warm fluffy hug to you! I love you so much!');
      return true;
    }

    // 3. Stop dancing / actions
    if (
      uText.includes('stop') ||
      uText.includes('ruk jao') ||
      uText.includes('bas karo') ||
      uText.includes('mat naacho') ||
      uText.includes('रुक जाओ') ||
      uText.includes('बस करो')
    ) {
      if (creature && creature.stopAction) creature.stopAction();
      speakCuteCartoonVoice('Theek hai, main shaant ho gayi!');
      return true;
    }

    // 4. Peek-a-Boo / Hide & Seek ("chhup jao", "aankhen band", "peekaboo")
    if (
      uText.includes('chhup') ||
      uText.includes('chup jao') ||
      uText.includes('peek') ||
      uText.includes('hide') ||
      uText.includes('aankh') ||
      uText.includes('छुप') ||
      uText.includes('आंख')
    ) {
      executeCreatureAction('peekaboo');
      speakCuteCartoonVoice('Peek-a-boo! Dikha! Hahaha!');
      return true;
    }

    // 4b. 3D Feeding, Hair Dryer & Floating Soap Bubbles
    if (
      uText.includes('cake') ||
      uText.includes('khana') ||
      uText.includes('khao') ||
      uText.includes('khila') ||
      uText.includes('feed') ||
      uText.includes('bhook') ||
      uText.includes('sweet') ||
      uText.includes('केक') ||
      uText.includes('खाना') ||
      uText.includes('भूख')
    ) {
      executeCreatureAction('feed');
      speakCuteCartoonVoice('Yummy yummy! Strawberry cake bohot delicious hai!');
      return true;
    }
    if (
      uText.includes('dryer') ||
      uText.includes('sukha') ||
      uText.includes('blow') ||
      uText.includes('salon') ||
      uText.includes('ड्रायर') ||
      uText.includes('सुखा')
    ) {
      executeCreatureAction('hair_dryer');
      speakCuteCartoonVoice('Aha! Mere fluffy baal mast sookh rahe hain!');
      return true;
    }
    if (
      uText.includes('bubble') ||
      uText.includes('bulbul') ||
      uText.includes('बबल') ||
      uText.includes('बुलबुले')
    ) {
      executeCreatureAction('bubbles');
      speakCuteCartoonVoice('Yay! Dekho kitne pyare 3D bulbule udd rahe hain!');
      return true;
    }

    // 5. 3D Dress-up & Accessories ("chashma", "crown", "party hat", "bowtie")
    if (uText.includes('chashma') || uText.includes('glass') || uText.includes('goggle') || uText.includes('चश्मा')) {
      const remove = uText.includes('utaar') || uText.includes('hata') || uText.includes('remove') || uText.includes('उतार');
      creature.toggleAccessory('sunglasses', !remove);
      playAccessoryEquipSound();
      speakCuteCartoonVoice(remove ? 'Chashma utaar diya!' : 'Hehe! Chashma pehan ke main kitni cool lag rahi hoon!');
      return true;
    }
    if (uText.includes('crown') || uText.includes('taj') || uText.includes('ताज') || uText.includes('क्राउन')) {
      const remove = uText.includes('utaar') || uText.includes('hata') || uText.includes('remove');
      creature.toggleAccessory('crown', !remove);
      playAccessoryEquipSound();
      speakCuteCartoonVoice(remove ? 'Crown utaar diya!' : 'Aww! Royal golden crown! Main princess Mochi hoon!');
      return true;
    }
    if (uText.includes('party hat') || uText.includes('topi') || uText.includes('hat') || uText.includes('टोपी')) {
      const remove = uText.includes('utaar') || uText.includes('hata') || uText.includes('remove');
      creature.toggleAccessory('party_hat', !remove);
      playAccessoryEquipSound();
      speakCuteCartoonVoice(remove ? 'Party hat utaar di!' : 'Yay! Party hat pehni! Chalo masti karein!');
      return true;
    }
    if (uText.includes('bowtie') || uText.includes('tie') || uText.includes('bow') || uText.includes('टाई')) {
      const remove = uText.includes('utaar') || uText.includes('hata') || uText.includes('remove');
      creature.toggleAccessory('bowtie', !remove);
      playAccessoryEquipSound();
      speakCuteCartoonVoice(remove ? 'Bowtie hata diya!' : 'Cute red bowtie! Ekdum fashionable!');
      return true;
    }
    if (uText.includes('mustache') || uText.includes('mooch') || uText.includes('muchh') || uText.includes('मूंछ')) {
      const remove = uText.includes('utaar') || uText.includes('hata') || uText.includes('remove');
      creature.toggleAccessory('mustache', !remove);
      playAccessoryEquipSound();
      speakCuteCartoonVoice(remove ? 'Funny moochh hata di!' : 'Hehehe! Dekho meri funny handlebar moochh!');
      return true;
    }

    // 6. Interactive Weather ("baarish", "umbrella", "chhata")
    if (uText.includes('chhata') || uText.includes('chata') || uText.includes('umbrella') || uText.includes('छाता')) {
      creature.setWeatherState('umbrella');
      playWeatherSound('umbrella');
      speakCuteCartoonVoice('Yay! Chhata khol liya! Ab main baarish me safe hoon!');
      return true;
    } else if (uText.includes('baarish') || uText.includes('barish') || uText.includes('rain') || uText.includes('बारिश')) {
      if (uText.includes('band') || uText.includes('rok') || uText.includes('stop') || uText.includes('बंद') || uText.includes('रोक')) {
        creature.setWeatherState('clear');
        speakCuteCartoonVoice('Baarish band ho gayi! Shake shake shake karke paani jhaad diya!');
      } else {
        creature.setWeatherState('rain');
        playWeatherSound('rain');
        speakCuteCartoonVoice('Arre baap re! 3D baarish hone lagi! Mere fluffy baal bheege ja rahe hain!');
      }
      return true;
    }

    // 7. Fur Length & Color Voice Commands ("baal bada/chhota", "color")
    if (uText.includes('baal') || uText.includes('fur') || uText.includes('hair') || uText.includes('बाल')) {
      if (uText.includes('bada') || uText.includes('bade') || uText.includes('lamba') || uText.includes('lambe') || uText.includes('long') || uText.includes('बड़े') || uText.includes('लंबे')) {
        const nextLen = Math.min(0.55, (simState.furLength || 0.31) + 0.14);
        applyFurStyle({ furLength: nextLen });
        speakCuteCartoonVoice('Yay! Mere baal aur lambe aur fluffy ho gaye!');
        return true;
      } else if (uText.includes('chhota') || uText.includes('chhote') || uText.includes('chota') || uText.includes('kam') || uText.includes('short') || uText.includes('छोटे') || uText.includes('कम')) {
        const nextLen = Math.max(0.09, (simState.furLength || 0.31) - 0.14);
        applyFurStyle({ furLength: nextLen });
        speakCuteCartoonVoice('Hehe! Chhote baal ka cute baby look!');
        return true;
      }
    }
    if (uText.includes('color') || uText.includes('rang') || uText.includes('रंग') || uText.includes('कलर')) {
      if (uText.includes('gold') || uText.includes('peela') || uText.includes('yellow') || uText.includes('पीला')) {
        applyFurStyle({ presetName: 'Golden Fluff' });
        speakCuteCartoonVoice('Wah! Golden Fluff look!');
        return true;
      } else if (uText.includes('blue') || uText.includes('neela') || uText.includes('नीला')) {
        applyFurStyle({ presetName: 'Midnight Velvet' });
        speakCuteCartoonVoice('Wah! Midnight Velvet neela look!');
        return true;
      } else if (uText.includes('green') || uText.includes('hara') || uText.includes('हरा')) {
        applyFurStyle({ presetName: 'Matcha Puff' });
        speakCuteCartoonVoice('Wah! Matcha Puff hara look!');
        return true;
      } else if (uText.includes('white') || uText.includes('safed') || uText.includes('सफेद')) {
        applyFurStyle({ presetName: 'Snowball' });
        speakCuteCartoonVoice('Wah! White Snowball look!');
        return true;
      } else if (uText.includes('red') || uText.includes('laal') || uText.includes('लाल')) {
        applyFurStyle({ presetName: 'Ruby Red' });
        speakCuteCartoonVoice('Wah! Ruby Red laal look!');
        return true;
      } else if (uText.includes('pink') || uText.includes('gulabi') || uText.includes('गुलाबी')) {
        applyFurStyle({ presetName: 'Sakura Mochi' });
        speakCuteCartoonVoice('Wah! Sakura Mochi gulabi look!');
        return true;
      }
    }

    return false;
  }

  // Unified master handler for any user voice transcript or typed text
  async function handleUserMessage(rawText) {
    const text = String(rawText || '').trim();
    if (!text || !userWantsListening) return;

    const reqSessionId = sessionGenerationId;
    showTranscript('user', text);

    // 0a. Check if user wants to stop an active 3D Blackboard Viva
    if (isVivaStopIntent(text)) {
      stopBlackboardViva();
      speakCuteCartoonVoice('Oho! Viva se dar lag gaya kya backbencher? Chalo 3D Blackboard band kar diya! Hehehe!');
      return;
    }

    // 0b. Check if user is asking to start a 3D Blackboard Viva / Quiz / Test
    if (isVivaStartIntent(text)) {
      startBlackboardVivaRound(true, false);
      return;
    }

    // 0c. If a 3D Blackboard Viva question is currently waiting for an answer, evaluate it!
    if (vivaState.active && vivaState.status === 'asking' && vivaState.currentQuestion) {
      submitVivaAnswer(text, false);
      return;
    }
    if (vivaState.active && vivaState.status !== 'asking' && /\b(next|agla|aur\s*ek|another|continue|haan)\b/i.test(text)) {
      startBlackboardVivaRound(true, false);
      return;
    }

    // Automatically project 3D Hologram if user's question is about a complex topic
    maybeTriggerContextHologram(text);

    // 1. Instant encyclopedic & Sararati Topper QA (Quantum Physics, Black Holes, AI, Maths, Roasts, GK)
    const instant = findInstantQA(text);
    if (instant) {
      if (creature && creature.emotionEngine) {
        const stim = instant.emotion === 'topper_swag' ? 'topper_swag' : 'praise';
        creature.emotionEngine.feedStimulus(stim, 1.35);
      }
      if (instant.hologram) {
        maybeTriggerContextHologram(text, instant.hologram);
      } else {
        maybeTriggerContextHologram(instant.reply);
      }
      if (instant.action && executeCreatureAction) {
        executeCreatureAction(instant.action);
      }
      speakCuteCartoonVoice(instant.reply);
      return;
    }

    // 2. Creature actions / khelkhud (Weather, Dress-up, Friends, King & Soldiers, Magic, Selfie, Concert, Cake, Dryer, Bubbles, Fur)
    const actionHandled = handleInstantVoiceTranscript(text);
    if (actionHandled) {
      return;
    }

    // If Gemini 3.8 Live WebSocket is actively connected, it will speak the conversational response natively
    if (isConnected && socket && socket.readyState === WebSocket.OPEN) {
      return;
    }

    // 3. Fallback to Gemini via /api/chat ONLY while user still wants listening
    setIsThinking(true);
    const emContext = creature?.emotionEngine ? creature.emotionEngine.getPromptContext() : '';
    const geminiData = await askGeminiAPI(text, emContext, getApiKey());
    setIsThinking(false);

    // If user stopped the microphone while the request was in flight, discard immediately and stay silent!
    if (!userWantsListening || reqSessionId !== sessionGenerationId) {
      return;
    }

    if (geminiData && geminiData.reply) {
      if (geminiData.hologram) {
        maybeTriggerContextHologram(text, geminiData.hologram);
      } else {
        maybeTriggerContextHologram(text + ' ' + geminiData.reply);
      }
      if (geminiData.action) {
        executeCreatureAction(geminiData.action);
      }
      if (geminiData.weather && creature?.setWeatherState) {
        creature.setWeatherState(geminiData.weather);
      }
      if (geminiData.accessory && creature?.toggleAccessory) {
        creature.toggleAccessory(geminiData.accessory.type, geminiData.accessory.equip);
      }
      speakCuteCartoonVoice(geminiData.reply);
    }
  }

  // Master handler for WebAudio VAD recorded WAV utterances from getUserMedia stream
  async function handleAudioUtterance(wavBase64) {
    if (!wavBase64 || isSpeaking || isThinking || !userWantsListening) return;
    if (isConnected && socket && socket.readyState === WebSocket.OPEN) return;

    const reqSessionId = sessionGenerationId;
    setIsThinking(true);
    const emContext = creature?.emotionEngine ? creature.emotionEngine.getPromptContext() : '';
    const geminiData = await askGeminiAudioAPI(wavBase64, emContext, getApiKey());
    setIsThinking(false);

    // If user clicked Mochi to stop the microphone while audio was being analyzed, discard immediately!
    if (!userWantsListening || reqSessionId !== sessionGenerationId) {
      return;
    }

    // If SpeechRecognition already handled this while the audio request was in flight, skip duplicate
    if (Date.now() - lastSpeechRecResultTime < 1500) {
      return;
    }

    if (!geminiData) return;

    const spokenTranscript = String(geminiData.transcript || '').trim();
    if (spokenTranscript) {
      if (isVivaStopIntent(spokenTranscript)) {
        stopBlackboardViva();
        speakCuteCartoonVoice('Oho! Viva se dar lag gaya kya? Chalo 3D Blackboard band kar diya!');
        return;
      }
      if (isVivaStartIntent(spokenTranscript)) {
        startBlackboardVivaRound(true, false);
        return;
      }
      if (vivaState.active && vivaState.status === 'asking' && vivaState.currentQuestion) {
        submitVivaAnswer(spokenTranscript, false);
        return;
      }

      maybeTriggerContextHologram(spokenTranscript);

      const instant = findInstantQA(spokenTranscript);
      if (instant) {
        if (creature && creature.emotionEngine) {
          creature.emotionEngine.feedStimulus('praise', 1.25);
        }
        if (instant.hologram) {
          maybeTriggerContextHologram(spokenTranscript, instant.hologram);
        }
        if (instant.action && executeCreatureAction) {
          executeCreatureAction(instant.action);
        }
        speakCuteCartoonVoice(instant.reply);
        return;
      }

      const actionHandled = handleInstantVoiceTranscript(spokenTranscript);
      if (actionHandled) {
        return;
      }
    }

    if (geminiData.reply) {
      maybeTriggerContextHologram((spokenTranscript || '') + ' ' + geminiData.reply);
      if (geminiData.action) {
        executeCreatureAction(geminiData.action);
      }
      if (geminiData.weather && creature?.setWeatherState) {
        creature.setWeatherState(geminiData.weather);
      }
      if (geminiData.accessory && creature?.toggleAccessory) {
        creature.toggleAccessory(geminiData.accessory.type, geminiData.accessory.equip);
      }
      speakCuteCartoonVoice(geminiData.reply);
    }
  }

  function startSpeechRecognitionSync() {
    if (typeof window === 'undefined') return;
    if (!recognition) {
      recognition = initSpeechRecognition();
    }
    if (!recognition) return;
    if (!isSpeechListening) {
      isSpeechListening = true;
      try {
        recognition.start();
      } catch (e) {}
    }
  }

  async function connectLiveAPI() {
    sessionGenerationId++;
    userWantsListening = true;
    ensureAudioContext();
    stopAllPlayback();

    // 1. CRITICAL: Request microphone access AND start SpeechRecognition IMMEDIATELY & synchronously inside the user gesture!
    const micPromise = startMicrophone();
    startSpeechRecognitionSync();

    if (socket) {
      try { socket.close(); } catch (e) {}
      socket = null;
    }

    updateHud('🎙️ Mochi-Puff is listening... Speak in Hindi or English! Click Mochi to stop.');

    let key = getApiKey();
    if (!key && typeof fetch === 'function') {
      try {
        const res = await fetch('/api/config');
        if (res.ok) {
          const data = await res.json();
          if (data && data.apiKey) {
            runtimeApiKey = String(data.apiKey).trim();
            key = runtimeApiKey;
          }
        }
      } catch (e) {}
    }

    if (!userWantsListening) return;

    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const proxyWsUrl = `${proto}//${window.location.host}/live`;
    const directWsUrl = key
      ? `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${key}`
      : '';

    // Prefer direct browser WS only when key is a standard public AIza key; otherwise prefer server /live proxy first
    const candidateUrls = (key && key.startsWith('AIza'))
      ? [directWsUrl, proxyWsUrl]
      : (directWsUrl ? [proxyWsUrl, directWsUrl] : [proxyWsUrl]);

    function tryConnectUrl(urlIndex) {
      if (!userWantsListening || urlIndex >= candidateUrls.length) {
        return;
      }
      const targetUrl = candidateUrls[urlIndex];
      if (!targetUrl) return;

      let openedSetup = false;
      let wsInstance = null;

      try {
        wsInstance = new WebSocket(targetUrl);
        wsInstance.binaryType = 'arraybuffer';
        socket = wsInstance;
      } catch (e) {
        console.warn('[Voice] WebSocket init error, trying fallback:', e);
        tryConnectUrl(urlIndex + 1);
        return;
      }

      wsInstance.onopen = () => {
        if (!userWantsListening || socket !== wsInstance) {
          try { wsInstance.close(); } catch (e) {}
          return;
        }
        const setupMsg = buildSetupPayload();
        wsInstance.send(JSON.stringify(setupMsg));
      };

      wsInstance.onmessage = async (event) => {
        if (socket !== wsInstance) return;
        try {
          let text = '';
          if (event.data instanceof Blob) {
            text = await event.data.text();
          } else if (typeof event.data === 'string') {
            text = event.data;
          } else if (event.data instanceof ArrayBuffer) {
            text = new TextDecoder().decode(event.data);
          } else {
            return;
          }

          if (!text) return;
          const msg = JSON.parse(text);

          if (msg.setupComplete) {
            openedSetup = true;
            await micPromise;
            if (!userWantsListening) return;
            isConnected = true;
            isListening = true;
            updateHud('🎙️ Mochi-Puff Live ON · Speak in Hindi or English! Click Mochi to stop.');
            sendGreetingPrompt();
            return;
          }

          if (msg.serverContent) {
            const sc = msg.serverContent;

            if (sc.interrupted) {
              stopAllPlayback();
              setIsThinking(false);
            }

            if (sc.modelTurn?.parts) {
              for (const part of sc.modelTurn.parts) {
                if (part.inlineData && part.inlineData.data) {
                  queueAudioPlayback(part.inlineData.data);
                }
              }
            }

            if (sc.inputTranscription?.text) {
              const inTxt = sc.inputTranscription.text;
              showTranscript('user', inTxt);
              if (isVivaStopIntent(inTxt)) {
                stopBlackboardViva();
              } else if (isVivaStartIntent(inTxt)) {
                startBlackboardVivaRound(false, false);
              } else if (vivaState.active && vivaState.status === 'asking' && vivaState.currentQuestion) {
                submitVivaAnswer(inTxt, false);
              } else {
                maybeTriggerContextHologram(inTxt);
                handleInstantVoiceTranscript(inTxt);
              }
            }
            if (sc.outputTranscription?.text) {
              const outTxt = sc.outputTranscription.text;
              showTranscript('mochi', outTxt);
              maybeTriggerContextHologram(outTxt);
            }
          }

          if (msg.interactionStatus) {
            if (msg.interactionStatus === 'IN_PROGRESS') {
              setIsThinking(true);
            } else if (msg.interactionStatus === 'IDLE') {
              setIsThinking(false);
            }
          }

          if (msg.toolCall?.functionCalls) {
            handleToolCall(msg.toolCall.functionCalls);
          }
        } catch (_err) {
          // Ignore transient message parse errors safely
        }
      };

      wsInstance.onerror = (err) => {
        console.warn('[Voice] Gemini 3.8 Live socket error (mic VAD + SpeechRecognition active):', err);
      };

      wsInstance.onclose = () => {
        if (socket === wsInstance) {
          isConnected = false;
        }
        if (!userWantsListening) {
          updateHud('👆 Click Mochi-Puff (the doll) to talk with Gemini 3.8 Live · Click again to stop');
          return;
        }
        // If this URL closed before setupComplete, try the fallback URL automatically
        if (!openedSetup && urlIndex + 1 < candidateUrls.length) {
          tryConnectUrl(urlIndex + 1);
          return;
        }
        // CRITICAL: Keep microphone & VAD + SpeechRecognition active while userWantsListening is true!
        isListening = true;
        updateHud('🎙️ Mochi-Puff is listening... Speak in Hindi or English! Click Mochi to stop.');
      };
    }

    tryConnectUrl(0);
  }

  function disconnectLiveAPI() {
    sessionGenerationId++;
    userWantsListening = false;
    isSpeechListening = false;
    isConnected = false;
    isListening = false;
    isSpeaking = false;
    isThinking = false;
    if (activeMouthInterval) {
      clearInterval(activeMouthInterval);
      activeMouthInterval = null;
    }
    // Use abort() instead of stop() so SpeechRecognition immediately discards buffered audio without firing a trailing onresult!
    try { recognition?.abort(); } catch (e) {
      try { recognition?.stop(); } catch (_e) {}
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try { window.speechSynthesis.cancel(); } catch (e) {}
    }
    stopMicrophone();
    stopAllPlayback();
    if (socket) {
      try {
        socket.close();
      } catch (e) {}
      socket = null;
    }
    updateMicUi(false);
    updateHud('👆 Click Mochi-Puff (the doll) to talk with Gemini 3.8 Live · Click again to stop');
  }

  function setIsSpeaking(speaking) {
    isSpeaking = speaking;
    if (speaking) {
      updateHud('🔊 Mochi-Puff is speaking... (Click Mochi anytime to stop)');
    } else if (isListening || userWantsListening) {
      updateHud('🎙️ Mochi-Puff is listening... Speak now! Click Mochi to stop.');
    }
  }

  function setIsThinking(thinking) {
    isThinking = thinking;
    if (thinking && !isSpeaking) {
      updateHud('🧠 Mochi-Puff is thinking... Click Mochi to stop.');
    } else if (!thinking && !isSpeaking && (isListening || userWantsListening)) {
      updateHud('🎙️ Mochi-Puff is listening... Speak now! Click Mochi to stop.');
    }
  }

  // =========================================================================
  // 4. AUDIO REACTIVE CREATURE LOOP
  // =========================================================================

  function startAudioLevelPolling() {
    const dataArray = new Uint8Array(32);

    const poll = () => {
      let outputVol = 0;
      if (outputAnalyser && isSpeaking) {
        outputAnalyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        outputVol = sum / (dataArray.length * 255);
      }

      if (onSpeechVolume) {
        onSpeechVolume(outputVol, isSpeaking, isThinking);
      }

      if (creature && creature.animState) {
        creature.animState.isSpeaking = isSpeaking;
        creature.animState.isListening = Boolean(isListening || isSpeechListening || userWantsListening);
        creature.animState.speechVolume = outputVol;
      }

      audioLevelPollId = requestAnimationFrame(poll);
    };

    audioLevelPollId = requestAnimationFrame(poll);
  }

  // =========================================================================
  // 5. FALLBACK SPEECH RECOGNITION (CLEAN ZERO-UI MODE)
  // =========================================================================

  let recognition = null;
  let isSpeechListening = false;

  function initSpeechRecognition() {
    if (typeof window === 'undefined') return null;
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) return null;

    try {
      const rec = new SpeechRec();
      rec.continuous = true;
      rec.interimResults = false;
      rec.lang = 'hi-IN'; // Catches Hindi, Hinglish, and English naturally

      rec.onresult = (event) => {
        // CRITICAL: Ignore any trailing SpeechRecognition results if the user already stopped the microphone!
        if (!userWantsListening || !isSpeechListening) return;

        const last = event.results[event.results.length - 1];
        if (last && last.isFinal) {
          const transcript = last[0].transcript;
          if (transcript) {
            lastSpeechRecResultTime = Date.now();
            vadRecording = false;
            vadChunks = [];
            vadSpeechFrames = 0;
            vadSilenceFrames = 0;
            // If Gemini 3.8 Live is actively connected, only trigger instant 3D animations and let Gemini Live speak!
            if (isConnected && socket && socket.readyState === WebSocket.OPEN) {
              handleInstantVoiceTranscript(transcript);
              return;
            }
            handleUserMessage(transcript);
          }
        }
      };

      rec.onerror = (e) => {
        if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
          isSpeechListening = false;
        }
      };

      rec.onend = () => {
        if (isSpeechListening && userWantsListening) {
          try { rec.start(); } catch (e) {}
        }
      };

      return rec;
    } catch (e) {
      return null;
    }
  }

  function updateMicUi(listening) {
    if (typeof document === 'undefined') return;
    const pill = document.getElementById('voice-status-pill');
    if (pill) pill.remove();
    const oldBar = document.getElementById('kawaii-chat-bar');
    if (oldBar) oldBar.remove();
    const micPill = document.getElementById('mochi-mic-pill');
    if (micPill) micPill.remove();
  }

  function toggleSpeechListening() {
    if (userWantsListening || isListening || isSpeechListening) {
      disconnectLiveAPI();
    } else {
      connectLiveAPI();
    }
  }

  function showTranscript(sender, text) {
    // Disabled: User requested clean view with zero text overlay or subtitle bubbles on screen
  }

  function showToolBadge(text) {
    // Disabled: User requested clean view
  }

  function cleanupVoiceElements() {
    if (typeof document === 'undefined') return;
    const oldBar = document.getElementById('kawaii-chat-bar');
    if (oldBar) oldBar.remove();
    const pill = document.getElementById('voice-status-pill');
    if (pill) pill.remove();
    const micPill = document.getElementById('mochi-mic-pill');
    if (micPill) micPill.remove();
    const bubbles = document.querySelectorAll('.voice-transcript-bubble, #voice-transcript-bubble');
    bubbles.forEach(b => b.remove());
  }

  function renderSubtitles() {
    startAudioLevelPolling();
    cleanupVoiceElements();
  }

  // =========================================================================
  // 6. DOLL CLICK & PUSH INTERACTION
  // =========================================================================

  function handleCreatureClick() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try { window.speechSynthesis.cancel(); } catch (e) {}
    }
    creature?.triggerBoop();
    if (userWantsListening || isConnected || isListening || isSpeechListening) {
      disconnectLiveAPI();
    } else {
      connectLiveAPI();
    }
    return true;
  }

  // Ensures microphone is active when user pushes/pets Mochi without disconnecting an active session
  function ensureListening() {
    if (!userWantsListening && !isListening && !isConnected) {
      connectLiveAPI();
    }
  }

  renderSubtitles();

  return {
    connect: connectLiveAPI,
    disconnect: disconnectLiveAPI,
    handleCreatureClick,
    ensureListening,
    handleUserMessage,
    toggleSpeechListening,
    trigger5SecLaughter,
    trigger10SecPoutSpeech,
    playInflateStepSound,
    playDeflatePopSound,
    playWeirdCartoonGiggleSounds,
    playSoftPurrGiggleSound,
    playCutePoutSound,
    executeCreatureAction,
    playAction: executeCreatureAction,
    speakCuteCartoonVoice,
    speakCloneReply,
    triggerScoldClonesSpeech,
    triggerTickleSpeech: trigger5SecLaughter,
    triggerPoutSpeech: trigger10SecPoutSpeech,
    isConnected: () => isConnected,
    isListening: () => Boolean(isListening || isSpeechListening || userWantsListening),
    isSpeaking: () => isSpeaking
  };
}

