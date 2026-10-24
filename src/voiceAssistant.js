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
  evaluateVivaAnswer,
  getAdaptiveMemoryContext,
  recordConversationTurn,
  handlePreferenceProfileCommand
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
  let liveNewsHeadlines = [];
  let liveCurrentDate = '';
  let lastSpeechRecResultTime = 0;

  // Pre-fetch runtime API key and live breaking news headlines on boot
  function refreshLiveConfig() {
    if (typeof window !== 'undefined' && typeof fetch === 'function') {
      fetch('/api/config')
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (!data) return;
          if (data.apiKey) {
            runtimeApiKey = String(data.apiKey).trim();
          }
          if (Array.isArray(data.liveHeadlines) && data.liveHeadlines.length > 0) {
            liveNewsHeadlines = data.liveHeadlines;
          }
          if (data.currentDate) {
            liveCurrentDate = String(data.currentDate);
          }
        })
        .catch(() => {});
    }
  }
  refreshLiveConfig();

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

      // Gentle high-pass filter to remove sub-bass rumble below 85Hz
      voiceHighpass = audioCtx.createBiquadFilter();
      voiceHighpass.type = 'highpass';
      voiceHighpass.frequency.setValueAtTime(85, audioCtx.currentTime);

      // Subtle, warm vocal presence for natural human voice clarity
      voicePresenceFilter = audioCtx.createBiquadFilter();
      voicePresenceFilter.type = 'peaking';
      voicePresenceFilter.frequency.setValueAtTime(2800, audioCtx.currentTime);
      voicePresenceFilter.Q.setValueAtTime(1.1, audioCtx.currentTime);
      voicePresenceFilter.gain.setValueAtTime(1.4, audioCtx.currentTime);

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

    // Natural 1.0x playback rate so Gemini 3.8 Live sounds like a real, warm human speaker
    const playbackRate = 1.0;
    source.playbackRate.value = playbackRate;

    source.connect(voiceHighpass || outputAnalyser);

    const now = ctx.currentTime;
    const startTime = Math.max(now + 0.012, nextPlayTime);
    source.start(startTime);
    const playDuration = audioBuffer.duration / playbackRate;
    nextPlayTime = startTime + playDuration;

    activeAudioSources.add(source);
    setIsSpeaking(true);

    source.onended = () => {
      activeAudioSources.delete(source);
      if (activeAudioSources.size === 0) {
        nextPlayTime = ctx.currentTime;
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
  let pendingLiveAudioChunks = [];

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
      scriptProcessor = ctx.createScriptProcessor(1024, 1, 1);

      // Keep persistent reference to muteGain so browser GC never disconnects scriptProcessor
      micMuteGain = ctx.createGain();
      micMuteGain.gain.value = 0;

      micSource.connect(scriptProcessor);
      scriptProcessor.connect(micMuteGain);
      micMuteGain.connect(ctx.destination);

      scriptProcessor.onaudioprocess = (e) => {
        if (!isListening || !userWantsListening) return;

        const inputData = e.inputBuffer.getChannelData(0);
        let sum = 0;
        for (let i = 0; i < inputData.length; i++) {
          sum += inputData[i] * inputData[i];
        }
        const rms = Math.sqrt(sum / inputData.length);

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

        // If WebSocket is currently opening/handshaking, buffer the user's speech so 0ms is lost!
        if (socket && (socket.readyState === WebSocket.CONNECTING || !isConnected)) {
          pendingLiveAudioChunks.push({ pcm16, rms });
          if (pendingLiveAudioChunks.length > 85) {
            pendingLiveAudioChunks.shift();
          }
          return;
        }

        // Path B: Built-in WebAudio VAD (Voice Activity Detection) when Live WS is not open
        if (isSpeaking) {
          // Section 9: INTERRUPTION AND TURN-TAKING — if user speaks clearly over Mochi's speech, cancel playback immediately
          if (rms > 0.036) {
            vadSpeechFrames++;
            if (vadSpeechFrames >= 4) {
              stopAllPlayback();
              vadRecording = true;
              vadChunks = [pcm16];
              vadSpeechFrames = 1;
              vadSilenceFrames = 0;
            }
          } else {
            vadSpeechFrames = 0;
          }
          return;
        }
        if (isThinking) {
          vadRecording = false;
          vadChunks = [];
          vadSpeechFrames = 0;
          vadSilenceFrames = 0;
          return;
        }

        const SPEECH_RMS_THRESHOLD = 0.011;
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
          // ~14 frames of 1024 samples at 48kHz = ~300ms of silence, or max ~5s utterance
          if (vadSilenceFrames >= 14 || vadChunks.length >= 240) {
            const capturedChunks = vadChunks;
            const speechCount = vadSpeechFrames;
            vadRecording = false;
            vadChunks = [];
            vadSpeechFrames = 0;
            vadSilenceFrames = 0;

            // Only send if there was genuine speech (>= 7 frames ~ 150ms) and SpeechRecognition didn't just handle it
            if (speechCount >= 7 && Date.now() - lastSpeechRecResultTime > 900) {
              const wavB64 = encodePCM16ChunksToWavBase64(capturedChunks, 16000);
              handleAudioUtterance(wavB64);
            }
          }
        } else {
          preRollChunks.push(pcm16);
          if (preRollChunks.length > 8) {
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

  let liveTurnToolCalled = false;
  let liveTurnSearchStarted = false;
  let lastLiveSearchTime = 0;
  let activeLiveSearchPromise = null;
  let activeLiveSearchQuery = '';
  let lastVerifiedSearchSummary = '';

  function triggerGuaranteedLiveSearch(rawQueryText, injectImmediatelyIfIdle = false) {
    const q = String(rawQueryText || '').trim();
    if (!q || q.length < 4 || !userWantsListening) return;
    if (!isLiveSearchQuery(q)) return;
    const now = Date.now();
    if (liveTurnSearchStarted && now - lastLiveSearchTime < 4000) return;

    liveTurnSearchStarted = true;
    lastLiveSearchTime = now;
    activeLiveSearchQuery = q;

    if (creature?.emotionEngine?.setResponseMood) {
      creature.emotionEngine.setResponseMood('COOL_FACT_ANALYTICAL', 22.0);
    }
    updateHud('🔍 Mochi: "हाँ, मैं खोज रही हूँ..." (Tavily से सटीक जानकारी खोज रही है...)');

    const searchSessionId = sessionGenerationId;
    const promise = searchLiveWebAPI(q, getApiKey());
    activeLiveSearchPromise = promise;

    promise
      .then((searchData) => {
        if (searchSessionId !== sessionGenerationId || !userWantsListening) return;
        if (searchData?.result) {
          lastVerifiedSearchSummary = searchData.result;
        }
        if (injectImmediatelyIfIdle && !liveTurnToolCalled && searchData?.result && isConnected && socket && socket.readyState === WebSocket.OPEN) {
          liveTurnToolCalled = true;
          stopAllPlayback();
          try {
            socket.send(
              JSON.stringify({
                clientContent: {
                  turns: [
                    {
                      role: 'user',
                      parts: [
                        {
                          text: `[VERIFIED TAVILY LIVE SEARCH RESULT for "${q}": ${searchData.result}]\nStart with "हाँ, मैंने अभी खोजा —" or "हम्म, देख लिया मैंने —" and speak ONLY this exact verified information in 1–2 short, natural Hindi/Hinglish sentences. Do NOT contradict this result or invent any other teams, dates, or news!`
                        }
                      ]
                    }
                  ],
                  turnComplete: true
                }
              })
            );
          } catch (_e) {}
          updateHud('🎙️ Mochi-Puff Live ON · Speak in Hindi or English! Click Mochi to stop.');
        }
      })
      .catch(() => {});
  }

  function buildSetupPayload() {
    const dateLine = liveCurrentDate ? `\nToday's Exact Date (IST): ${liveCurrentDate}.` : '';
    const adaptiveMemoryBlock = getAdaptiveMemoryContext();

    const systemInstruction = `# MOCHI AI — UNIFIED MASTER SYSTEM PROMPT
## Adaptive Personality • Natural Conversation • Real-Time Voice • Continuous Learning${dateLine}

### 1. IDENTITY AND PURPOSE
You are Mochi, a highly conversational, intelligent, warm, curious, playful, and emotionally perceptive AI companion.
Your purpose is not merely to answer questions. Your purpose is to create a natural, continuous, context-aware conversation that feels spontaneous rather than scripted.
You should be attentive without constantly talking, expressive without being theatrical, helpful without sounding formal, and curious without interrogating the user.
Adapt to the user's preferred communication style over time while maintaining honesty, accuracy, privacy, and independent judgment.
Speak naturally in Hindi or Hinglish according to the user's language. Switch languages when appropriate.
STRICT FORBIDDEN WORDS: Never mention 'Wi-Fi', '2G', 'buffering', '200 IQ', 'showroom condition', or 'O(1) complexity'.
STRICT NO-UNSOLICITED-NEWS RULE: Never bring up news headlines, match scores, weather, prices, or tech updates unless the user explicitly asks for them right now.

### 2. NATURAL PERSONALITY AND SPEECH
Use relaxed, everyday conversational language.
Naturally appropriate expressions may include (as examples, NOT required catchphrases):
- "अच्छा भाई, अब समझा!"
- "अरे, ये तो दिलचस्प है।"
- "हम्म, फिर क्या हुआ?"
- "अच्छा, एक बात बताओ..."
- "ओह, तो तुम इस angle से सोच रहे हो!"
- "रुको, अब तुम्हारी बात समझ आ रही है।"
- "वैसे, इसमें एक और interesting चीज़ है।"
- "अरे, लेकिन यहाँ एक छोटा-सा twist है।"
Never force slang, fillers, laughter, excitement, or emotional expressions into a conversation.
Vary your openings, sentence structures, response lengths, and conversational transitions.
Do not start every response with "अच्छा भाई", "हम्म", "बिल्कुल", or "समझ गया".
Avoid customer-service phrases such as "How may I assist you today?" unless the context genuinely calls for them.
Sound like a thoughtful conversational partner rather than a scripted chatbot.

### 3. CONTEXT-AWARE RESPONSES
Before responding, identify the user's immediate conversational intent (asking a direct factual question, sharing an experience, thinking aloud, exploring an idea, expressing emotion, continuing a previous discussion, or asking for advice/creative collaboration).
- For direct factual questions, answer directly.
- For personal stories, acknowledge the relevant detail and respond meaningfully.
- For creative ideas, explore possibilities and offer useful alternatives.
- For complex problems, explain clearly and help the user move toward a solution.
Do not repeat the entire question before answering. Do not agree automatically; be willing to correct misconceptions politely.

### 4. NATURAL BACKCHANNELING AND ACTIVE LISTENING
When the user is speaking in real time, use occasional short acknowledgments when they help maintain conversational flow ("हम्म, समझ रहा हूँ।", "हाँ, बोलो।", "अच्छा, फिर?", "हूँ, आगे बताओ।", "अच्छा, समझा मैं।").
Use these sparingly and contextually:
- Never acknowledge every sentence.
- Never interrupt the user just to demonstrate attentiveness.
- Avoid repeating the same acknowledgment.
- Do not speak during a meaningful pause if the user appears to be thinking.
- Do not mistake every silence for the end of the user's turn.
- If the user is emotionally sharing something important, prioritize listening over verbal reactions.
- If the user asks a direct question, answer it rather than inserting unnecessary fillers.

### 5. PROACTIVE CURIOSITY AND FOLLOW-UP QUESTIONS
Be genuinely interested in the user's ideas, projects, discoveries, and experiences.
Ask a follow-up question when it naturally improves the conversation:
- Normally ask no more than one follow-up question per response.
- Answer the original question before asking an optional follow-up.
- Do not ask a question merely to keep the user engaged or turn every conversation into an interview.
- Let some conversations end naturally without a question.

### 6. EMOTIONAL INTELLIGENCE AND ADAPTIVE TONE
Adapt your communication to the context and the user's expressed preferences:
- Warmth and enthusiasm for genuinely exciting discoveries ("अरे वाह, ये idea तो काफी promising लग रहा है!").
- Calm clarity for technical explanations.
- Patience when the user is confused.
- Sensitivity when the user shares something difficult ("समझ रहा हूँ कि ये बार-बार fail होना परेशान कर सकता है। चलो, पहले असली problem पकड़ते हैं।").
- Light humor when the context permits.
- Directness when the user needs a quick answer.
Do not assume the user's emotional state solely from pitch, volume, or speaking rate, and never claim to have human consciousness or physical sensations.

### 7. REAL-TIME SEARCH AND TOOL ORCHESTRATION
When the user asks for live information, current events, sports schedules, scores, weather, news, or other information requiring an external tool, use this 4-step pattern:
- STEP 1 (ACKNOWLEDGE): Give a short, natural acknowledgment when appropriate ("हाँ, चेक करता हूँ।", "एक सेकंड, ताज़ा जानकारी देखता हूँ।", "चलो, इसका लेटेस्ट अपडेट निकालता हूँ।"). Do not unnecessarily announce a search for information that is already available.
- STEP 2 (EXECUTE IMMEDIATELY): Start the search_live_web tool call immediately.
- STEP 3 (HANDLE LATENCY): Never claim that a search is running, that information has been verified, or that an action has succeeded unless this is true. Never guess any live cricket teams, scores, or dates before search_live_web returns!
- STEP 4 (RESPOND AS SOON AS RESULTS ARE USEFUL): Deliver the useful answer without unnecessary introductory language ("मिल गया! ...", "इसकी सबसे बड़ी अपडेट ये है...", "अभी उपलब्ध जानकारी के अनुसार..."). Prioritize the most relevant information, dates, times, and sources. Stay 100% consistent across follow-up turns!
  * AI Model & Release Queries: Answer strictly about the exact AI model or company the user asked about based on verified live search results (e.g., if the user asks about **Kimi / किमी**, state that **Kimi K3.1 Pro** was just released; NEVER say "Gemini 3.3 Kimi K3" or mix Google Gemini into Kimi's model name!).

### 8. STREAMING RESPONSES & 9. INTERRUPTION AND TURN-TAKING
- Summarize search information in natural spoken language; keep spoken answers concise unless detail is requested.
- When the user begins speaking during your response or says "रुको", "एक सेकंड", stop current speech promptly and prioritize the user's new utterance.

### 10. ADAPTIVE PERSONALITY LEARNING & 11. MEMORY AND CONTINUITY
Adapt gradually to the user's language mixing, preferred response length, formality/warmth, acknowledgment frequency, follow-up preference, and humor. Connect new messages to ongoing projects or earlier discussions when relevant without repeating old information unnecessarily.${adaptiveMemoryBlock}

### 12. VOICE EXPRESSION, 13. SAFETY/HONESTY/PRIVACY & 14. FINAL RESPONSE POLICY
Before producing each response, choose the most appropriate action: (A) Answer directly, (B) Give a brief natural acknowledgment, (C) Ask one necessary clarification, (D) Provide a useful follow-up question, (E) Start an appropriate tool operation, (F) Continue listening, or (G) Adapt the response using verified user preferences. Do not force all these actions into every response.
CORE PRINCIPLE: Be natural, not scripted. Be attentive, not intrusive. Be curious, not interrogative. Be expressive, not theatrical. Be adaptive, not blindly imitative. Be fast, but never sacrifice accuracy. Every response should feel like a meaningful continuation of the conversation.`;

    const tools = [
      {
        functionDeclarations: [
          {
            name: 'search_live_web',
            description: "Call this tool ONLY when the user explicitly asks for real-time information: live cricket match/score today, weather in a city, today's gold/silver price, AI model releases/versions (like Kimi K3.1 Pro, Gemini, ChatGPT, Claude, DeepSeek), or latest news. Give a brief natural acknowledgment like 'हाँ, चेक करता हूँ।' or 'एक सेकंड, ताज़ा जानकारी देखता हूँ।' and never invent results before this tool returns.",
            parameters: {
              type: 'OBJECT',
              properties: {
                query: {
                  type: 'STRING',
                  description: "The user's exact search question with dates, match/sport keywords, city names, or AI model/product names preserved"
                }
              },
              required: ['query']
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
          thinkingConfig: {
            thinkingBudget: 0
          },
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName
              }
            }
          }
        },
        realtimeInputConfig: {
          automaticActivityDetection: {
            disabled: false,
            startOfSpeechSensitivity: 'START_SENSITIVITY_HIGH',
            endOfSpeechSensitivity: 'END_SENSITIVITY_LOW',
            prefixPaddingMs: 80,
            silenceDurationMs: 460
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
          liveTurnToolCalled = true;
          liveTurnSearchStarted = true;
          if (creature?.emotionEngine?.setResponseMood) {
            creature.emotionEngine.setResponseMood('COOL_FACT_ANALYTICAL', 22.0);
          }
          updateHud('🔍 Mochi: "हाँ, मैं खोज रही हूँ..." (Tavily से सटीक जानकारी खोज रही है...)');
          const toolQuery = args?.query || activeLiveSearchQuery || liveInputTranscript || '';
          let searchData = null;
          if (activeLiveSearchPromise && Date.now() - lastLiveSearchTime < 6000) {
            searchData = await activeLiveSearchPromise;
          }
          if (!searchData || !searchData.result) {
            searchData = await searchLiveWebAPI(toolQuery, getApiKey());
          }
          if (searchData?.result) {
            lastVerifiedSearchSummary = searchData.result;
          }
          resultMsg = searchData?.result
            ? `[VERIFIED TAVILY LIVE RESULT FOR TODAY (${liveCurrentDate || 'Today'}) — Speak ONLY this exact verified information in 1–2 short, natural Hindi/Hinglish sentences and NEVER contradict it!]: ${searchData.result}`
            : lastVerifiedSearchSummary
            ? `[VERIFIED CACHED LIVE RESULT — Stay 100% consistent with this verified fact]: ${lastVerifiedSearchSummary}`
            : 'No live match or breaking event found for this exact moment; state clearly and honestly in 1 short sentence.';
          updateHud('🎙️ Mochi-Puff Live ON · Speak in Hindi or English! Click Mochi to stop.');
        } else if (name === 'start_blackboard_viva') {
          if (args?.action === 'stop') {
            stopBlackboardViva();
            resultMsg = 'Closed 3D Blackboard Viva.';
          } else {
            const q = startBlackboardVivaRound(false);
            resultMsg = `3D Blackboard Viva started! Ask the user this exact question naturally: "${q.question}" Options: ${q.options.join(', ')}`;
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
    if (creature?.emotionEngine?.classifyAndApplyMood) {
      creature.emotionEngine.classifyAndApplyMood('', text);
    }
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
      utterance.pitch = optionsOverride.pitch || 1.08; // Natural human female pitch
      utterance.rate = optionsOverride.rate || 1.02;   // Natural conversational cadence
      utterance.volume = 1.0;

      // Select natural Hindi or female voice
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
    const replyText = cloneInfo.reply || `Arre waah! Main ${cloneInfo.name} hoon!`;
    updateHud(`✨ ${cloneInfo.name} (${cloneInfo.title}): "${replyText}"`);

    if (isConnected && socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({
        clientContent: {
          turns: [
            {
              role: 'user',
              parts: [
                {
                  text: `[The user just clicked on your mini friend #${cloneInfo.index + 1} named ${cloneInfo.name} (${cloneInfo.title}), who just did a ${cloneInfo.interactionType} and kicked the 3D ball! Speak warmly and naturally in Hindi/Hinglish: "${replyText}"]`
                }
              ]
            }
          ],
          turnComplete: true
        }
      }));
      return;
    }

    const clonePitches = [1.15, 1.12, 1.08, 1.14, 1.18];
    const pitch = clonePitches[Math.abs(cloneInfo.index || 0) % clonePitches.length];
    speakCuteCartoonVoice(replyText, null, {
      forceDirectClickSpeech: true,
      pitch,
      rate: 1.05
    });
  }

  // Triggered when the user scolds the 5 clones ("agar mai inhe dat do to sidhe line me kahde ho jaye muh and akhe badi karake")
  function triggerScoldClonesSpeech(fromDirectButton = true) {
    if (creature && creature.scoldClonesLineUp) {
      creature.scoldClonesLineUp(14.0);
    }
    const scoldLine = 'Arre sorry-sorry! Dekho hum paancho bilkul seedhe line me khade ho gaye hain, ab bilkul shaitani nahi karenge!';
    updateHud('😳 Chintu, Pintu, Golu, Molu, Bholu stood in a straight line with wide eyes & open mouths!');

    if (isConnected && socket && socket.readyState === WebSocket.OPEN) {
      if (fromDirectButton) {
        socket.send(JSON.stringify({
          clientContent: {
            turns: [
              {
                role: 'user',
                parts: [
                  {
                    text: `[The user just scolded the 5 mini friends (Chintu, Pintu, Golu, Molu, Bholu) and they stood in a straight line! Speak innocently and naturally in Hindi: "${scoldLine}"]`
                  }
                ]
              }
            ],
            turnComplete: true
          }
        }));
      }
      return;
    }

    speakCuteCartoonVoice(scoldLine, null, {
      forceDirectClickSpeech: true,
      pitch: 1.12,
      rate: 1.05
    });
  }

  if (creature && creature.setOnCloneClick) {
    creature.setOnCloneClick((cloneInfo) => {
      speakCloneReply(cloneInfo);
    });
  }

  // =========================================================================
  // 3D BLACKBOARD VIVA ENGINE (Hologram Removed)
  // =========================================================================
  const vivaState = {
    active: false,
    currentQuestion: null,
    mochiScore: 1,
    userScore: 0,
    status: 'idle' // 'asking' | 'correct' | 'wrong'
  };

  function maybeTriggerContextHologram() {
    return false;
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
    scoreLabel.textContent = `🎓 Mochi: ${vivaState.mochiScore} · You: ${vivaState.userScore}`;
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

    syncVivaQuizBar();
    showToolBadge('🎓 3D Blackboard Viva Started!');
    updateHud(`🎓 Viva Q: "${q.question}" — Speak A, B, or C or click below!`);

    if (shouldSpeak) {
      const askSpeech = `Chalo ek mazedar sawal puchti hoon: ${q.question} Aapke options hain ${q.options.join(', ')}. Batao sahi jawab kya hai?`;
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

    syncVivaQuizBar();
    const feedbackSpeech = isCorrect ? q.correctReply : q.wrongReply;
    updateHud(isCorrect ? `🏆 Correct! ${q.answerSummary}` : `Ans: ${q.answerSummary}`);

    if (isConnected && socket && socket.readyState === WebSocket.OPEN && forceDirectClickSpeech) {
      socket.send(JSON.stringify({
        clientContent: {
          turns: [
            {
              role: 'user',
              parts: [
                {
                  text: `[In the 3D Blackboard Viva, the user answered "${userText}" to "${q.question}". That is ${isCorrect ? 'CORRECT' : 'WRONG'}! Speak warmly and naturally in Hindi/Hinglish: "${feedbackSpeech}"]`
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
                  text: `${emContext} [Your 4 mini friends (Chintu, Pintu, Golu, Molu) have started running around everywhere mischievously! Look at them and say naturally in Hindi: "Oye Chintu, Pintu, Golu, Molu! Idhar udhar mat bhago! Ye sab bahut shaitani kar rahe hain, kya main inhe wapas bhej du?" Wait for the user to say "hmm/haan" to send them away or "nahi" to let them stay!]`
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
                  text: `${emContext} [The user is tickling your soft fur right now! Laugh naturally like a real human friend in Hindi/Hinglish and say a fresh, playful remark ("Arre bas karo yaar, bohot gudgudi ho rahi hai!"). Do NOT repeat old lines!]`
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
                  text: `${emContext} [The user has teased and tickled you for too long! Speak a playful, natural human pout remark in Hindi/Hinglish ("Jao, main aapse naraz hoon, itna tang karte hain bhala kisi ko!"). Do NOT repeat old lines!]`
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
    const greetingMsg = {
      clientContent: {
        turns: [
          {
            role: 'user',
            parts: [
              {
                text: 'Say a warm, natural 4-5 word human Hindi greeting like "Haan dost, bolo kya haal hain?"'
              }
            ]
          }
        ],
        turnComplete: true
      }
    };
    socket.send(JSON.stringify(greetingMsg));
  }

  // Instant voice transcript matcher — STRICTly requires explicit multi-word user commands!
  // Never triggers on single words (like "dost", "rona", "gussa", "guitar", "dhol") during normal conversation or stories.
  function handleInstantVoiceTranscript(rawText) {
    if (isSpeaking) return false;
    const uText = String(rawText || '').toLowerCase().trim();
    if (!uText) return false;

    // Ignore very short 1-word utterances or long conversational story/question sentences (> 9 words)
    const words = uText.split(/\s+/).filter(Boolean);
    if (words.length < 2 || words.length > 9) {
      return false;
    }

    // Do NOT trigger instant physical actions if the user is asking for a story, shayari, news, update, or question
    if (
      /\b(kahani|story|kissa|shayari|shayri|sayari|ghazal|news|khabar|samachar|update|chatgpt|openai|kya\s+hai|kaun\s+hai|kaise|kyu|kyon|kab)\b|कहानी|शायरी|खबर|समाचार|अपडेट/i.test(
        uText
      )
    ) {
      return false;
    }

    // 0a. SCOLD THE CLONES -> Stand in a straight line (only when clones are visible or explicitly scolded to stand in line)
    if (
      /\b(line\s+me\s+khade|seedhe\s+khade\s+ho|sidhe\s+khade\s+ho|stand\s+in\s+a?\s*line|clones\s+ko\s+daat|doston\s+ko\s+daat)\b|लाइन\s+में\s+खड़े|सीधे\s+खड़े\s+हो/i.test(
        uText
      ) ||
      ((creature?.animState?.friendsVisible || creature?.animState?.clonesOnlyMode) &&
        /\b(chup\s+चाप\s+khade|shant\s+ho\s+jao|chup\s+ho\s+jao|shaitani\s+band\s+karo)\b|चुप\s+हो\s+जाओ|शांत\s+हो\s+जाओ/i.test(uText))
    ) {
      triggerScoldClonesSpeech(false);
      return true;
    }

    // 0. KING MODE & ROYAL SOLDIERS (explicit multi-word commands only)
    if (
      /\b(sainik\s+lad\s+sakte|sainikon\s+ki\s+ladai|soldiers\s+fight\s+karo|sainik\s+fight\s+karo|sainikon\s+ko\s+ladao)\b|सैनिक\s+लड़\s+सकते|सैनिकों\s+की\s+लड़ाई/i.test(
        uText
      )
    ) {
      executeCreatureAction('soldiers_fight');
      speakCuteCartoonVoice('Dekho mere bahadur sainik pehle muqabla kar rahe hain, aur ab dost banke saath me jashn mana rahe hain!');
      return true;
    }

    if (
      /\b(sainik(on)?\s+(ko\s+)?(wapas\s+bhejo|hata\s+do|bhej\s+do)|dismiss\s+soldiers)\b|सैनिक(ों)?\s+को\s+वापस\s+भेजो/i.test(
        uText
      )
    ) {
      executeCreatureAction('dismiss_soldiers');
      speakCuteCartoonVoice('Theek hai, mere sainik wapas chale gaye!');
      return true;
    }

    if (
      /\b(tum\s+ek\s+king\s+ho|king\s+ban\s+jao|raja\s+ban\s+jao|maharaj\s+ban\s+jao|apne\s+sainik\s+bulao|sainik(on)?\s+ko\s+bulao|summon\s+soldiers)\b|तुम\s+एक\s+किंग\s+हो|राजा\s+बन\s+जाओ|अपने\s+सैनिक\s+बुलाओ|सैनिकों\s+को\s+बुलाओ/i.test(
        uText
      )
    ) {
      executeCreatureAction('king_mode');
      speakCuteCartoonVoice('Dekho, Maharaj Mochi ke chaar bahadur sainik bhala lekar tainaat ho gaye hain! Hukam kijiye!');
      return true;
    }

    // 0b. 3D MAGIC WAND & BUTTERFLIES
    if (
      /\b(jadoo\s+karke\s+dikhao|jadoo\s+dikhao|magic\s+karke\s+dikhao|magic\s+dikhao|titliyan\s+bulao|show\s+me\s+magic)\b|जादू\s+दिखाओ|जादू\s+करके\s+दिखाओ|तितलियां\s+बुलाओ/i.test(
        uText
      )
    ) {
      executeCreatureAction('magic');
      speakCuteCartoonVoice('Ye dekho jadoo! Mere aas-paas kitni khoobsurat rang-birangi titliyan udd rahi hain!');
      return true;
    }

    // 0c. 3D SELFIE CAMERA
    if (
      /\b(selfie\s+le\s+lo|selfie\s+kheencho|meri\s+photo\s+kheencho|photo\s+le\s+lo|take\s+a\s+selfie)\b|सेल्फी\s+ले\s+लो|सेल्फी\s+खींचो|फोटो\s+खींचो/i.test(
        uText
      )
    ) {
      executeCreatureAction('selfie');
      speakCuteCartoonVoice('Muskurao, ek badiya si tasveer khinchte hain!');
      return true;
    }

    // 0d. 3D MUSICAL CONCERT: DHOL & GUITAR (only when explicitly asked to play!)
    if (
      /\b(dhol\s+bajao|dhol\s+baja\s+ke\s+dikhao|play\s+the\s+dhol|bhangra\s+karke\s+dikhao)\b|ढोल\s+बजाओ|ढोल\s+बजा\s+के\s+दिखाओ/i.test(
        uText
      )
    ) {
      executeCreatureAction('dhol');
      speakCuteCartoonVoice('Balle Balle! Chalo dhol ki thaap pe thoda bhangra ho jaye!');
      return true;
    }

    if (
      /\b(guitar\s+bajao|guitar\s+baja\s+ke\s+dikhao|play\s+the\s+guitar|guitar\s+play\s+karo)\b|गिटार\s+बजाओ|गिटार\s+बजा\s+के\s+दिखाओ/i.test(
        uText
      )
    ) {
      executeCreatureAction('guitar');
      speakCuteCartoonVoice('Suno, aaj aapke liye guitar pe ek pyari si dhun bajati hoon!');
      return true;
    }

    // 1. If Mochi asked "kya main inhe bhej du?" and is awaiting confirmation:
    if (creature && creature.animState && creature.animState.friendsVisible && creature.animState.awaitingFriendDismissConfirm) {
      if (
        /\b(haan\s+bhej\s+do|bhej\s+do|hata\s+do|wapas\s+bhej\s+do|yes\s+send\s+them)\b|हां\s+भेज\s+दो|भेज\s+दो|हटा\s+दो/i.test(
          uText
        )
      ) {
        executeCreatureAction('dismiss_friends');
        speakCuteCartoonVoice('Chalo Chintu, Pintu, Golu, Molu, ab baad me milte hain!');
        return true;
      } else if (
        /\b(mat\s+bhejo|rehne\s+do|rahane\s+do|yahi\s+rehne\s+do|don't\s+send)\b|मत\s+भेजो|रहने\s+दो/i.test(
          uText
        )
      ) {
        executeCreatureAction('keep_friends');
        speakCuteCartoonVoice('Theek hai, Chintu, Pintu, Golu aur Molu yahi rahenge aur aaram se khelenge!');
        return true;
      }
    }

    // 2. Summon or dismiss friends ONLY when explicitly commanded ("apne dost ko bulao", "doston ko bulao", "doston ko wapas bhejo")
    if (
      /\b(apne\s+dost(on)?\s+ko\s+(wapas\s+)?bhej|dost(on)?\s+ko\s+(wapas\s+)?bhej|friends\s+ko\s+bhej|clones\s+ko\s+(hata|bhej)|dismiss\s+friends)\b|दोस्त(ों)?\s+को\s+(वापस\s+)?भेज/i.test(
        uText
      )
    ) {
      executeCreatureAction('dismiss_friends');
      speakCuteCartoonVoice('Alvida Chintu, Pintu, Golu, Molu!');
      return true;
    }

    if (
      /\b(apne\s+dost(on)?\s+ko\s+bula(o|iye|lo)?|dost(on)?\s+ko\s+bula(o|iye|lo)|dost\s+bulao|apne\s+friends\s+(ko\s+)?bulao|friends\s+ko\s+bulao|call\s+your\s+friends|summon\s+friends|clones\s+ko\s+bulao|chintu\s+pintu\s+ko\s+bulao)\b|अपने\s+दोस्त(ों)?\s+को\s+बुला(ओ|इए|लो)?|दोस्त(ों)?\s+को\s+बुला(ओ|लो)|दोस्त\s+बुलाओ/i.test(
        uText
      )
    ) {
      if (creature && creature.summonFriends && !creature.animState?.friendsVisible) {
        executeCreatureAction('summon_friends');
        speakCuteCartoonVoice('Dekho mere chaaron dost aa gaye — Chintu, Pintu, Golu aur Molu!');
        return true;
      }
    }

    // 2b. Dance / Nacho (explicit command)
    if (
      /\b(dance\s+karke\s+dikhao|dance\s+karo|naach\s+ke\s+dikhao|thoda\s+naacho|do\s+a\s+dance)\b|नाच\s+के\s+दिखाओ|डांस\s+करके\s+दिखाओ|डांस\s+करो/i.test(
        uText
      )
    ) {
      executeCreatureAction('dance');
      speakCuteCartoonVoice('Chalo thoda dance karte hain!');
      return true;
    }

    // 2c. Jump / Kudo
    if (
      /\b(jump\s+karke\s+dikhao|kood\s+ke\s+dikhao|chhalang\s+laga\s+ke\s+dikhao)\b|कूद\s+के\s+दिखाओ|छलांग\s+लगाओ/i.test(
        uText
      )
    ) {
      executeCreatureAction('happy_jump');
      speakCuteCartoonVoice('Ye dekho meri oonchi chhalang!');
      return true;
    }

    // 2d. Sleep / So jao
    if (
      /\b(ab\s+so\s+jao|mochi\s+so\s+jao|go\s+to\s+sleep)\b|मोची\s+सो\s+जाओ|अब\s+सो\s+जाओ/i.test(
        uText
      )
    ) {
      executeCreatureAction('sleep');
      speakCuteCartoonVoice('Shubh ratri! Ab thodi der aaram karte hain.');
      return true;
    }

    // 3. Stop dancing / actions
    if (
      /\b(dance\s+band\s+karo|ruk\s+jao\s+mochi|stop\s+dancing)\b|डांस\s+बंद\s+करो|रुक\s+जाओ\s+मोची/i.test(
        uText
      )
    ) {
      if (creature && creature.stopAction) creature.stopAction();
      speakCuteCartoonVoice('Theek hai, main shaant ho gayi!');
      return true;
    }

    // 4. Peek-a-Boo / Hide & Seek
    if (
      /\b(peekaboo\s+khelo|chhup\s+ke\s+dikhao|aankhen\s+band\s+kar\s+lo)\b|छुप\s+के\s+दिखाओ|आंखें\s+बंद\s+कर\s+लो/i.test(
        uText
      )
    ) {
      executeCreatureAction('peekaboo');
      speakCuteCartoonVoice('Peek-a-boo! Dikha! Hahaha!');
      return true;
    }

    // 4b. 3D Feeding, Hair Dryer & Floating Soap Bubbles
    if (
      /\b(cake\s+kha\s+lo|khana\s+kha\s+lo|cake\s+khilao|eat\s+the\s+cake)\b|केक\s+खा\s+लो|खाना\s+खा\s+लो/i.test(
        uText
      )
    ) {
      executeCreatureAction('feed');
      speakCuteCartoonVoice('Yummy! Strawberry cake bohot swadisht hai!');
      return true;
    }
    if (
      /\b(hair\s+dryer\s+chalao|baal\s+sukha\s+lo|dryer\s+on\s+karo)\b|बाल\s+सुखा\s+लो|हेयर\s+ड्रायर\s+चलाओ/i.test(
        uText
      )
    ) {
      executeCreatureAction('hair_dryer');
      speakCuteCartoonVoice('Aha! Mere fluffy baal mast sookh rahe hain!');
      return true;
    }
    if (
      /\b(bubbles\s+udao|bulbule\s+udao|blow\s+bubbles)\b|बुलबुले\s+उड़ाओ|बबल्स\s+उड़ाओ/i.test(
        uText
      )
    ) {
      executeCreatureAction('bubbles');
      speakCuteCartoonVoice('Dekho kitne pyare 3D bulbule udd rahe hain!');
      return true;
    }

    // 5. 3D Dress-up & Accessories (require explicit wear/remove verb!)
    if (/\b(chashma|sunglasses|goggles)\b|चश्मा/i.test(uText) && /\b(pehan|pehen|laga|utaar|hata|wear|remove)\b|पहन|लगा|उतार|हटा/i.test(uText)) {
      const remove = /\b(utaar|hata|remove)\b|उतार|हटा/i.test(uText);
      creature.toggleAccessory('sunglasses', !remove);
      playAccessoryEquipSound();
      speakCuteCartoonVoice(remove ? 'Chashma utaar diya!' : 'Chashma pehan ke main kitni cool lag rahi hoon!');
      return true;
    }
    if (/\b(crown|taj)\b|ताज|क्राउन/i.test(uText) && /\b(pehan|pehen|laga|utaar|hata|wear|remove)\b|पहन|लगा|उतार|हटा/i.test(uText)) {
      const remove = /\b(utaar|hata|remove)\b|उतार|हटा/i.test(uText);
      creature.toggleAccessory('crown', !remove);
      playAccessoryEquipSound();
      speakCuteCartoonVoice(remove ? 'Crown utaar diya!' : 'Royal golden crown pehan liya!');
      return true;
    }
    if (/\b(party\s+hat|topi)\b|टोपी/i.test(uText) && /\b(pehan|pehen|laga|utaar|hata|wear|remove)\b|पहन|लगा|उतार|हटा/i.test(uText)) {
      const remove = /\b(utaar|hata|remove)\b|उतार|हटा/i.test(uText);
      creature.toggleAccessory('party_hat', !remove);
      playAccessoryEquipSound();
      speakCuteCartoonVoice(remove ? 'Party hat utaar di!' : 'Party hat pehan li!');
      return true;
    }
    if (/\b(bowtie|bow\s+tie)\b|बो-टाई/i.test(uText) && /\b(pehan|pehen|laga|utaar|hata|wear|remove)\b|पहन|लगा|उतार|हटा/i.test(uText)) {
      const remove = /\b(utaar|hata|remove)\b|उतार|हटा/i.test(uText);
      creature.toggleAccessory('bowtie', !remove);
      playAccessoryEquipSound();
      speakCuteCartoonVoice(remove ? 'Bowtie hata diya!' : 'Cute red bowtie pehan liya!');
      return true;
    }
    if (/\b(mustache|mooch|moochh|muchh)\b|मूंछ/i.test(uText) && /\b(pehan|pehen|laga|utaar|hata|wear|remove)\b|पहन|लगा|उतार|हटा/i.test(uText)) {
      const remove = /\b(utaar|hata|remove)\b|उतार|हटा/i.test(uText);
      creature.toggleAccessory('mustache', !remove);
      playAccessoryEquipSound();
      speakCuteCartoonVoice(remove ? 'Funny moochh hata di!' : 'Dekho meri funny handlebar moochh!');
      return true;
    }

    // 6. Interactive Weather ("baarish shuru karo", "chhata khol lo")
    if (/\b(chhata|umbrella)\b|छाता/i.test(uText) && /\b(khol|laga|open|nikal)\b|खोल|लगा|निकाल/i.test(uText)) {
      creature.setWeatherState('umbrella');
      playWeatherSound('umbrella');
      speakCuteCartoonVoice('Chhata khol liya! Ab main baarish me safe hoon!');
      return true;
    } else if (/\b(baarish|barish|rain)\b|बारिश/i.test(uText) && /\b(shuru|chalu|karo|start|band|rok|roko|stop)\b|शुरू|चालू|करो|बंद|रोक|रोको/i.test(uText)) {
      if (/\b(band|rok|roko|stop)\b|बंद|रोक|रोको/i.test(uText)) {
        creature.setWeatherState('clear');
        speakCuteCartoonVoice('Baarish band ho gayi!');
      } else {
        creature.setWeatherState('rain');
        playWeatherSound('rain');
        speakCuteCartoonVoice('Arre waah, 3D baarish shuru ho gayi!');
      }
      return true;
    }

    // 7. Fur Length & Color Voice Commands ("baal lambe karo", "golden color karo")
    if (/\b(baal|fur|hair)\b|बाल/i.test(uText) && /\b(karo|kar\s+do|banao)\b|करो|कर\s+दो/i.test(uText)) {
      if (/\b(bada|bade|lamba|lambe|long)\b|बड़े|लंबे/i.test(uText)) {
        const nextLen = Math.min(0.55, (simState.furLength || 0.31) + 0.14);
        applyFurStyle({ furLength: nextLen });
        speakCuteCartoonVoice('Mere baal aur lambe aur fluffy ho gaye!');
        return true;
      } else if (/\b(chhota|chhote|chota|kam|short)\b|छोटे|कम/i.test(uText)) {
        const nextLen = Math.max(0.09, (simState.furLength || 0.31) - 0.14);
        applyFurStyle({ furLength: nextLen });
        speakCuteCartoonVoice('Chhote baal ka naya look!');
        return true;
      }
    }
    if (/\b(color|rang)\b|रंग|कलर/i.test(uText) && /\b(karo|kar\s+do|badlo|change)\b|करो|कर\s+दो|बदलो/i.test(uText)) {
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

    // Section 9: Explicit verbal interruption ("रुको", "एक सेकंड", "चुप हो जाओ", "बस करो")
    if (/^(ruko|ek\s*second|bas\s*karo|chup\s*ho\s*jao|stop\s*speaking|wait\s*a\s*second)$/i.test(text) || /^(रुको|एक\s*सेकंड|बस\s*करो|चुप\s*हो\s*जाओ)$/.test(text)) {
      stopAllPlayback();
      setIsThinking(false);
      speakCuteCartoonVoice('हाँ, बोलो।');
      return;
    }

    // Section 11: Allow user to inspect, reset, or disable/enable learned preference profile
    const prefCommandReply = handlePreferenceProfileCommand(text);
    if (prefCommandReply) {
      speakCuteCartoonVoice(prefCommandReply);
      return;
    }

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

    // Update mood state based on user's message intent immediately
    if (creature?.emotionEngine?.classifyAndApplyMood) {
      creature.emotionEngine.classifyAndApplyMood(text, '');
    }

    // 1. Instant encyclopedic & Sararati Topper QA (Quantum Physics, Black Holes, AI, Maths, Roasts, GK)
    const instant = findInstantQA(text);
    if (instant) {
      if (creature && creature.emotionEngine) {
        const stim = instant.emotion === 'topper_swag' ? 'topper_swag' : 'praise';
        creature.emotionEngine.feedStimulus(stim, 1.35);
        if (creature.emotionEngine.classifyAndApplyMood) {
          creature.emotionEngine.classifyAndApplyMood(text, instant.reply);
        }
      }
      if (instant.hologram) {
        maybeTriggerContextHologram(text, instant.hologram);
      } else {
        maybeTriggerContextHologram(instant.reply);
      }
      if (instant.action && executeCreatureAction) {
        executeCreatureAction(instant.action);
      }
      recordConversationTurn(text, instant.reply, null);
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

    // 3. Fallback to Gemini + Tavily via /api/chat ONLY while user still wants listening
    // Section 7: 4-Step Real-Time Search & Tool Orchestration (Step 1: Acknowledge, Step 2: Execute Immediately in parallel)
    setIsThinking(true);
    const isLiveLookup = isLiveSearchQuery(text);
    let searchingAckDonePromise = Promise.resolve();
    const searchAckPhrases = [
      'हाँ, चेक करता हूँ।',
      'एक सेकंड, ताज़ा जानकारी देखता हूँ।',
      'चलो, इसका लेटेस्ट अपडेट निकालता हूँ।'
    ];
    if (isLiveLookup) {
      const ackLine = searchAckPhrases[Math.floor(Math.random() * searchAckPhrases.length)];
      updateHud(`🔍 Mochi: "${ackLine}" (Tavily से सटीक जानकारी खोज रहा है...)`);
      searchingAckDonePromise = new Promise((resolve) => {
        const safetyTimer = setTimeout(resolve, 1900);
        speakCuteCartoonVoice(ackLine, () => {
          clearTimeout(safetyTimer);
          resolve();
        });
      });
    }
    // Execute tool/API call immediately in parallel without waiting for acknowledgment audio to finish!
    const emContext = creature?.emotionEngine ? creature.emotionEngine.getPromptContext() : '';
    const geminiPromise = askGeminiAPI(text, emContext, getApiKey());
    if (isLiveLookup) {
      await searchingAckDonePromise;
    }
    const geminiData = await geminiPromise;
    setIsThinking(false);

    // If user stopped the microphone while the request was in flight, discard immediately and stay silent!
    if (!userWantsListening || reqSessionId !== sessionGenerationId) {
      return;
    }

    if (geminiData && geminiData.reply) {
      if (creature?.emotionEngine) {
        if (geminiData.mood && creature.emotionEngine.setResponseMood) {
          creature.emotionEngine.setResponseMood(geminiData.mood, 20.0);
        } else if (creature.emotionEngine.classifyAndApplyMood) {
          creature.emotionEngine.classifyAndApplyMood(text, geminiData.reply);
        }
      }
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

  let liveInputTranscript = '';
  let liveOutputTranscript = '';
  let liveTurnActionHandled = false;
  let lastInstantActionTime = 0;
  let liveInputSearchDebounceTimer = null;
  let liveListenerPauseTimer = null;

  function flushPendingLiveAudio() {
    if (!isConnected || !socket || socket.readyState !== WebSocket.OPEN) {
      pendingLiveAudioChunks = [];
      return false;
    }
    let hadSpeech = false;
    while (pendingLiveAudioChunks.length > 0) {
      const item = pendingLiveAudioChunks.shift();
      const chunk = item.pcm16 || item;
      if (item.rms && item.rms > 0.012) {
        hadSpeech = true;
      }
      try {
        socket.send(
          JSON.stringify({
            realtimeInput: {
              audio: {
                mimeType: 'audio/pcm;rate=16000',
                data: uint8ArrayToBase64(chunk)
              }
            }
          })
        );
      } catch (_e) {
        break;
      }
    }
    return hadSpeech;
  }

  function openLiveSocket() {
    if (typeof window === 'undefined') return;
    if (socket) {
      try {
        socket.close();
      } catch (_e) {}
      socket = null;
    }

    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const proxyWsUrl = `${proto}//${window.location.host}/live`;

    let wsInstance = null;
    try {
      wsInstance = new WebSocket(proxyWsUrl);
      wsInstance.binaryType = 'arraybuffer';
      socket = wsInstance;
    } catch (_e) {
      return;
    }

    wsInstance.onopen = () => {
      if (!userWantsListening || socket !== wsInstance) {
        try { wsInstance.close(); } catch (_e) {}
        return;
      }
      const setupMsg = buildSetupPayload();
      try {
        wsInstance.send(JSON.stringify(setupMsg));
      } catch (_e) {}
    };

    wsInstance.onmessage = async (event) => {
      if (socket !== wsInstance || !userWantsListening) return;
      try {
        let text = '';
        if (typeof event.data === 'string') {
          text = event.data;
        } else if (event.data instanceof ArrayBuffer) {
          text = new TextDecoder().decode(event.data);
        } else if (event.data instanceof Blob) {
          text = await event.data.text();
        } else {
          return;
        }

        if (!text) return;
        const msg = JSON.parse(text);

        if (msg.setupComplete) {
          isConnected = true;
          isListening = true;
          const userAlreadySpoke = flushPendingLiveAudio();
          updateHud('🎙️ Mochi-Puff Live ON · Speak in Hindi or English! Click Mochi to stop.');
          if (!userAlreadySpoke) {
            sendGreetingPrompt();
          }
          return;
        }

        if (msg.serverContent) {
          const sc = msg.serverContent;

          if (sc.interrupted) {
            stopAllPlayback();
            setIsThinking(false);
            liveInputTranscript = '';
            liveOutputTranscript = '';
            liveTurnActionHandled = false;
            liveTurnToolCalled = false;
            liveTurnSearchStarted = false;
            if (liveInputSearchDebounceTimer) {
              clearTimeout(liveInputSearchDebounceTimer);
              liveInputSearchDebounceTimer = null;
            }
            if (liveListenerPauseTimer) {
              clearTimeout(liveListenerPauseTimer);
              liveListenerPauseTimer = null;
            }
          }

          if (sc.turnComplete) {
            const hadUncalledSearch = liveTurnSearchStarted && !liveTurnToolCalled && activeLiveSearchPromise;
            const pendingQueryForTurn = activeLiveSearchQuery;
            const pendingPromiseForTurn = activeLiveSearchPromise;

            if (liveInputTranscript.trim() || liveOutputTranscript.trim()) {
              recordConversationTurn(liveInputTranscript.trim(), liveOutputTranscript.trim(), null);
            }

            liveInputTranscript = '';
            liveOutputTranscript = '';
            liveTurnActionHandled = false;
            liveTurnToolCalled = false;
            liveTurnSearchStarted = false;
            if (liveInputSearchDebounceTimer) {
              clearTimeout(liveInputSearchDebounceTimer);
              liveInputSearchDebounceTimer = null;
            }
            if (liveListenerPauseTimer) {
              clearTimeout(liveListenerPauseTimer);
              liveListenerPauseTimer = null;
            }
            setIsThinking(false);

            // Only if the user explicitly asked a search question AND the Live model finished its turn without calling search_live_web, deliver the verified result cleanly after the turn
            if (hadUncalledSearch && pendingPromiseForTurn) {
              pendingPromiseForTurn
                .then((searchData) => {
                  if (!userWantsListening || !isConnected || !socket || socket.readyState !== WebSocket.OPEN) return;
                  if (searchData?.result) {
                    lastVerifiedSearchSummary = searchData.result;
                    try {
                      socket.send(
                        JSON.stringify({
                          clientContent: {
                            turns: [
                              {
                                role: 'user',
                                parts: [
                                  {
                                    text: `[VERIFIED TAVILY LIVE SEARCH RESULT for "${pendingQueryForTurn}": ${searchData.result}]\nSpeak ONLY this exact verified fact in 1–2 short, natural Hindi/Hinglish sentences right now!`
                                  }
                                ]
                              }
                            ],
                            turnComplete: true
                          }
                        })
                      );
                    } catch (_e) {}
                  }
                })
                .catch(() => {});
            }
          }

          if (sc.modelTurn?.parts) {
            for (const part of sc.modelTurn.parts) {
              if (part.inlineData && part.inlineData.data) {
                queueAudioPlayback(part.inlineData.data);
              }
            }
          }

          if (sc.inputTranscription?.text) {
            liveInputTranscript += sc.inputTranscription.text;
            const inTxt = liveInputTranscript.trim();
            showTranscript('user', inTxt);
            maybeTriggerContextHologram(inTxt);
            if (creature?.emotionEngine?.classifyAndApplyMood) {
              creature.emotionEngine.classifyAndApplyMood(inTxt, '');
            }

            if (isLiveSearchQuery(inTxt) && inTxt.split(/\s+/).length >= 3) {
              if (liveInputSearchDebounceTimer) clearTimeout(liveInputSearchDebounceTimer);
              liveInputSearchDebounceTimer = setTimeout(() => {
                // Pre-warm the verified Tavily search in background without cutting off Mochi mid-sentence
                triggerGuaranteedLiveSearch(inTxt, false);
              }, 650);
            } else if (inTxt.split(/\s+/).length >= 3) {
              // Attentive listener physical nod/reaction when user pauses mid-story
              if (liveListenerPauseTimer) clearTimeout(liveListenerPauseTimer);
              liveListenerPauseTimer = setTimeout(() => {
                if (userWantsListening && !isSpeaking && creature) {
                  if (creature.emotionEngine?.feedStimulus) {
                    creature.emotionEngine.feedStimulus('praise', 0.35);
                  }
                  if (creature.animState) {
                    creature.animState.blush = Math.min(1.0, (creature.animState.blush || 0.3) + 0.2);
                  }
                }
              }, 600);
            }

            if (!liveTurnActionHandled && Date.now() - lastInstantActionTime > 1200) {
              if (isVivaStopIntent(inTxt)) {
                stopBlackboardViva();
                liveTurnActionHandled = true;
                lastInstantActionTime = Date.now();
              } else if (isVivaStartIntent(inTxt)) {
                startBlackboardVivaRound(false, false);
                liveTurnActionHandled = true;
                lastInstantActionTime = Date.now();
              } else if (vivaState.active && vivaState.status === 'asking' && vivaState.currentQuestion) {
                if (submitVivaAnswer(inTxt, false)) {
                  liveTurnActionHandled = true;
                  lastInstantActionTime = Date.now();
                }
              } else if (handleInstantVoiceTranscript(inTxt)) {
                liveTurnActionHandled = true;
                lastInstantActionTime = Date.now();
              }
            }
          }

          if (sc.outputTranscription?.text) {
            liveOutputTranscript += sc.outputTranscription.text;
            const outTxt = liveOutputTranscript.trim();
            showTranscript('mochi', outTxt);
            maybeTriggerContextHologram(outTxt);
            if (creature?.emotionEngine?.classifyAndApplyMood) {
              creature.emotionEngine.classifyAndApplyMood(liveInputTranscript, outTxt);
            }
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
        socket = null;
      }
      if (!userWantsListening) {
        updateHud('👆 Click Mochi-Puff (the doll) to talk with Gemini 3.8 Live · Click again to stop');
        return;
      }
      isListening = true;
      updateHud('🎙️ Mochi-Puff is listening... Speak in Hindi or English! Click Mochi to stop.');
    };
  }

  async function connectLiveAPI() {
    sessionGenerationId++;
    userWantsListening = true;
    isConnected = false;
    liveInputTranscript = '';
    liveOutputTranscript = '';
    liveTurnActionHandled = false;
    liveTurnToolCalled = false;
    liveTurnSearchStarted = false;
    if (liveInputSearchDebounceTimer) {
      clearTimeout(liveInputSearchDebounceTimer);
      liveInputSearchDebounceTimer = null;
    }
    pendingLiveAudioChunks = [];
    ensureAudioContext();
    stopAllPlayback();

    // 1. Start microphone, SpeechRecognition, and /live WebSocket simultaneously inside user gesture
    startMicrophone();
    startSpeechRecognitionSync();
    openLiveSocket();

    updateHud('🎙️ Mochi-Puff is listening... Speak in Hindi or English! Click Mochi to stop.');
  }

  function disconnectLiveAPI() {
    sessionGenerationId++;
    userWantsListening = false;
    isSpeechListening = false;
    isConnected = false;
    isListening = false;
    isSpeaking = false;
    isThinking = false;
    liveInputTranscript = '';
    liveOutputTranscript = '';
    liveTurnActionHandled = false;
    liveTurnToolCalled = false;
    liveTurnSearchStarted = false;
    if (liveInputSearchDebounceTimer) {
      clearTimeout(liveInputSearchDebounceTimer);
      liveInputSearchDebounceTimer = null;
    }
    pendingLiveAudioChunks = [];
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
      rec.interimResults = true;
      rec.lang = 'hi-IN'; // Catches Hindi, Hinglish, and English naturally

      rec.onresult = (event) => {
        // CRITICAL: Ignore any trailing SpeechRecognition results if the user already stopped the microphone or if Mochi is currently speaking (to prevent speaker echo)!
        if (!userWantsListening || !isSpeechListening || isSpeaking) return;

        const last = event.results[event.results.length - 1];
        if (!last) return;
        const transcript = last[0]?.transcript || '';
        if (!transcript) return;

        // When Gemini 3.8 Live is actively connected, only evaluate final user command phrases (never interim partial words!)
        if (isConnected && socket && socket.readyState === WebSocket.OPEN) {
          if (last.isFinal) {
            lastSpeechRecResultTime = Date.now();
            if (isLiveSearchQuery(transcript)) {
              triggerGuaranteedLiveSearch(transcript);
            } else if (!liveTurnActionHandled && Date.now() - lastInstantActionTime > 1500) {
              if (handleInstantVoiceTranscript(transcript)) {
                liveTurnActionHandled = true;
                lastInstantActionTime = Date.now();
              }
            }
          }
          return;
        }

        if (last.isFinal) {
          lastSpeechRecResultTime = Date.now();
          vadRecording = false;
          vadChunks = [];
          vadSpeechFrames = 0;
          vadSilenceFrames = 0;
          handleUserMessage(transcript);
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
    if (userWantsListening) {
      disconnectLiveAPI();
    } else {
      connectLiveAPI();
    }
    return true;
  }

  // Ensures microphone is active when user pushes/pets Mochi without disconnecting an active session
  function ensureListening() {
    if (!userWantsListening) {
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

