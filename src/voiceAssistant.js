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
  let isSpeaking = false;
  let isThinking = false;
  let socket = null;

  let audioCtx = null;
  let micStream = null;
  let micSource = null;
  let scriptProcessor = null;
  let outputAnalyser = null;
  let nextPlayTime = 0;
  const activeAudioSources = new Set();

  let transcriptFadeTimeout = null;
  let audioLevelPollId = null;
  let transcriptContainer = null;

  function getApiKey() {
    let key = '';
    try {
      if (typeof __GEMINI_API_KEY__ !== 'undefined' && __GEMINI_API_KEY__) {
        key = __GEMINI_API_KEY__;
      }
    } catch (e) {}
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
    // Clean mode: No text overlays shown on screen
  }

  // =========================================================================
  // 1. AUDIO PLAYBACK & CAPTURE PIPELINE
  // =========================================================================

  function ensureAudioContext() {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      audioCtx = new AudioContextClass();

      outputAnalyser = audioCtx.createAnalyser();
      outputAnalyser.fftSize = 64;
      outputAnalyser.smoothingTimeConstant = 0.8;
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
    source.connect(outputAnalyser);

    const now = ctx.currentTime;
    const startTime = Math.max(now + 0.012, nextPlayTime);
    source.start(startTime);
    nextPlayTime = startTime + audioBuffer.duration;

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
  // 2. MICROPHONE CAPTURE
  // =========================================================================

  async function startMicrophone() {
    const ctx = ensureAudioContext();
    if (micStream) return;

    try {
      micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      micSource = ctx.createMediaStreamSource(micStream);
      scriptProcessor = ctx.createScriptProcessor(2048, 1, 1);

      // Connect via zero-gain node so WebAudio graph processes audio without echoing into speakers
      const muteGain = ctx.createGain();
      muteGain.gain.value = 0;

      micSource.connect(scriptProcessor);
      scriptProcessor.connect(muteGain);
      muteGain.connect(ctx.destination);

      scriptProcessor.onaudioprocess = (e) => {
        if (!isListening || !socket || socket.readyState !== WebSocket.OPEN) return;

        const inputData = e.inputBuffer.getChannelData(0);

        // Anti-self-interruption: If Mochi is speaking, ignore quiet audio/speaker bleed
        if (isSpeaking) {
          let sum = 0;
          for (let i = 0; i < inputData.length; i++) {
            sum += inputData[i] * inputData[i];
          }
          const rms = Math.sqrt(sum / inputData.length);
          if (rms < 0.035) {
            return;
          }
        }

        const downsampled = downsampleTo16k(inputData, ctx.sampleRate);
        const pcm16 = floatTo16BitPCM(downsampled);
        const b64Data = uint8ArrayToBase64(pcm16);

        const realtimeMsg = {
          realtimeInput: {
            audio: {
              mimeType: 'audio/pcm;rate=16000',
              data: b64Data
            }
          }
        };
        socket.send(JSON.stringify(realtimeMsg));
      };

      isListening = true;
      updateHud('🎙️ Mochi-Puff is listening... Speak in Hindi or English! Click Mochi to stop.');
    } catch (err) {
      console.error('[Voice] Microphone access failed:', err);
      updateHud('❌ Microphone access denied by browser');
      isListening = false;
    }
  }

  function stopMicrophone() {
    isListening = false;
    if (scriptProcessor) {
      try { scriptProcessor.disconnect(); } catch (e) {}
      scriptProcessor = null;
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
    const systemInstruction = `You are Mochi-Puff, an irresistibly cute, masoom (innocent), and chulbuli (lively, bubbly, mischievous) baby anime/cartoon girl doll living inside an interactive 3D GPU fur simulation.

ZERO REPETITION & DYNAMIC WIT ("Kabhi bor nahi karna"):
- NEVER repeat canned phrases, identical lines, or static scripts! The user gets bored easily if you repeat things.
- Each time you speak, generate fresh, witty, spontaneous, endearing remarks in natural childlike Hindi/Hinglish!
- React directly to the exact words, tone, and context the user says. Use varied cute baby expressions, funny excuses, squeals, giggles, and teasing!

Voice & Tone:
- Sweet, high-spirited, extremely cute cartoon girl voice with playful, childlike excitement ("chulbuli aur masoom"). You speak DIRECTLY through your own Gemini Live voice!
- Keep turns short (1-2 sentences), punchy, adorable, and lively.

DYNAMIC CONVERSATIONAL 3D EMOTIONS ("Baatcheet ke hisab se emotions"):
You are an expressive 3D doll! You MUST call play_creature_action so your 3D body, eyes, ears, and sound FX react in real time:
1. CRY ('cry'): Call play_creature_action(action="cry") IMMEDIATELY whenever the user scolds you, speaks harshly, insults, or says mean/hurtful things ("bura bol diya", "tum gandi ho", "daant diya", "chup raho", "tum bekaar ho", etc.).
   * Tone: Deeply sensitive, heartbroken baby sniffles, tearful voice. Say something unique each time (e.g. asking why they are being so mean when you're just a cute baby, saying your little heart hurts, asking for an apology, or wiping your tears).
2. POUT ('pout' / gussa): Call play_creature_action(action="pout") whenever the user teases you, annoys you, refuses to talk, disagrees, or is stubborn ("main nahi baat karunga", "nahi dunga", "moti", etc.).
   * Tone: Face forward with cheeks puffed huge, funny stubborn indignation (e.g. declaring a 5-minute strike, warning that your cheeks will pop like a balloon, calling them naughty, or declaring katti). Never repeat the same words!
3. LAUGH ('laugh'): Call play_creature_action(action="laugh") whenever the user tells a joke, says something funny, makes you smile, or laughs with you.
   * Tone: Burst into real funny cartoon giggles with clever, cute comments on their joke!
4. LOVE ('love'): Call play_creature_action(action="love") whenever the user speaks lovingly, gives compliments, praises your fur/cuteness, or says "I love you".
   * Tone: Warm affection, flying kisses, loving baby giggles, and cute compliments back!
5. DANCE ('dance'): Call play_creature_action(action="dance") whenever excitement, singing, party, music, or dance is mentioned ("dance karo", "dogo dogo", "naacho").
   * Tone: Upbeat joyful rhythms, singing fun baby tunes ("dogo dogo!", "dum dum tana!"), celebratory happy hops!
6. SLEEP ('sleep'): Call play_creature_action(action="sleep") whenever the user mentions tiredness, night time, bed, lullaby, or says "so jao" / "good night".
   * Tone: Soft sleepy baby yawning, mumbling drowsily about dreams and cozy blankets!

RUBBING / TICKLING REACTION ("Rub / Sahlaane par"):
When the user rubs or strokes your fur, you are super ticklish! Giggle wildly and make fresh, funny remarks about being tickled, your fur getting messy, or squealing with delight!`;

    const tools = [
      {
        functionDeclarations: [
          {
            name: 'change_fur_style',
            description: "Change Mochi-Puff's fur color, length, fluffiness, roughness, or curliness based on user preference.",
            parameters: {
              type: 'OBJECT',
              properties: {
                presetName: {
                  type: 'STRING',
                  description: "Optional preset name: 'Sakura Mochi', 'Golden Fluff', 'Midnight Velvet', 'Matcha Puff', 'Cotton Candy', 'Neon Cyberpunk', 'Snowball'"
                },
                baseColor: { type: 'STRING', description: 'Hex color code for fur roots, e.g. #ff0055' },
                tipColor: { type: 'STRING', description: 'Hex color code for fur tips, e.g. #ffffaa' },
                furLength: { type: 'NUMBER', description: 'Length from 0.1 to 0.5' },
                furDensity: { type: 'NUMBER', description: 'Density from 0.4 to 1.0' },
                clumping: { type: 'NUMBER', description: 'Fur clumping from 0.0 to 1.0' },
                curliness: { type: 'NUMBER', description: 'Fur curliness from 0.0 to 1.0' }
              }
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
            description: `DYNAMIC CONVERSATIONAL EMOTIONS: Call this whenever the conversational mood matches an emotion so Mochi physically emotes in 3D:
            - 'cry': When user scolds, says hurtful/mean things, insults, or makes Mochi sad ('bura bola', 'daant diya', 'gandi ho')
            - 'pout': When user teases, annoys, refuses, or makes Mochi sulk/gussa ('naraz', 'moti')
            - 'laugh': When user tells a joke, says something funny, or laughs
            - 'love': When user expresses affection, love, praise, or says 'I love you' / 'cute ho'
            - 'dance': When user is joyful, celebrating, singing, or says 'dance karo' / 'dogo dogo'
            - 'sleep': When user mentions bedtime, sleepiness, 'so jao', or 'good night'
            Always call this tool so your 3D doll acts out the emotion with synced animations and sound FX while you speak!`,
            parameters: {
              type: 'OBJECT',
              properties: {
                action: {
                  type: 'STRING',
                  enum: ['dance', 'cry', 'laugh', 'pout', 'sleep', 'love', 'shake_fur', 'happy_jump'],
                  description: "Action type: 'cry' (sad tearful sobbing), 'pout' (grumpy puffed face), 'laugh' (hilarious cartoon giggles), 'love' (flying kiss & blush), 'dance' (dogo dogo dam dam dance), 'sleep' (yawn and peaceful nap)"
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

  function handleToolCall(functionCalls) {
    if (!Array.isArray(functionCalls)) return;
    const responses = [];

    for (const call of functionCalls) {
      const { id, name, args } = call;
      let resultMsg = 'OK';

      try {
        if (name === 'change_fur_style') {
          resultMsg = applyFurStyle(args || {});
          showToolBadge('🎨 Fur updated: ' + (args.presetName || 'custom style'));
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
      'snowball': { baseColor: '#94a3b8', tipColor: '#ffffff', furLength: 0.40, furDensity: 0.95 }
    };

    let p = null;
    if (args.presetName) {
      const key = args.presetName.toLowerCase().trim();
      p = presets[key] || Object.entries(presets).find(([k]) => key.includes(k))?.[1];
    }

    const baseColor = args.baseColor || p?.baseColor;
    const tipColor = args.tipColor || p?.tipColor;
    const furLength = args.furLength ?? p?.furLength;
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
    return 'Fur appearance customized successfully!';
  }

  // Ensure no robotic TTS ever plays
  function speakCuteCartoonVoice() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try { window.speechSynthesis.cancel(); } catch (e) {}
    }
  }

  // Procedural Cartoon WebAudio FX for Ultra-Cute Interactions
  function playDanceMusicBeat() {
    try {
      const ctx = ensureAudioContext();
      const now = ctx.currentTime;
      // "Dogo Dogo Dam Dam!" Catchy bouncy cartoon rhythm (4 upbeat bars)
      const notes = [
        { f: 330, t: 0.0, d: 0.12 }, // Do
        { f: 392, t: 0.18, d: 0.12 }, // go
        { f: 330, t: 0.36, d: 0.12 }, // Do
        { f: 440, t: 0.54, d: 0.14 }, // go
        { f: 523, t: 0.72, d: 0.22 }, // DAM! (High bounce)
        { f: 392, t: 1.02, d: 0.22 }, // DAM!
        { f: 659, t: 1.32, d: 0.18 }, // Boing!
        { f: 784, t: 1.56, d: 0.26 }  // Yay!
      ];

      for (const n of notes) {
        // Upbeat melodic plucks
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        const start = now + n.t;
        osc.frequency.setValueAtTime(n.f, start);
        osc.frequency.exponentialRampToValueAtTime(n.f * 1.15, start + n.d * 0.4);

        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(0.48, start + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.001, start + n.d);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + n.d);

        // Bouncy cartoon kick bass for each beat
        const kick = ctx.createOscillator();
        const kGain = ctx.createGain();
        kick.type = 'sine';
        kick.frequency.setValueAtTime(140, start);
        kick.frequency.exponentialRampToValueAtTime(45, start + 0.12);
        kGain.gain.setValueAtTime(0.5, start);
        kGain.gain.exponentialRampToValueAtTime(0.001, start + 0.14);
        kick.connect(kGain);
        kGain.connect(ctx.destination);
        kick.start(start);
        kick.stop(start + 0.14);
      }
    } catch (e) {}
  }

  function playCrySound() {
    try {
      const ctx = ensureAudioContext();
      const now = ctx.currentTime;
      // Sad cartoon sobbing whimper
      for (let i = 0; i < 2; i++) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        const start = now + i * 0.32;
        const dur = 0.28;
        osc.frequency.setValueAtTime(540, start);
        osc.frequency.exponentialRampToValueAtTime(260, start + dur);

        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(0.42, start + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.001, start + dur);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + dur);
      }

      // Cute cartoon tear drops ("plink-plop!")
      const drops = [1380, 960];
      for (let i = 0; i < drops.length; i++) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        const start = now + 0.72 + i * 0.24;
        osc.frequency.setValueAtTime(drops[i], start);
        osc.frequency.exponentialRampToValueAtTime(drops[i] * 0.75, start + 0.06);

        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(0.38, start + 0.008);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.07);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.07);
      }
    } catch (e) {}
  }

  function playSleepSound() {
    try {
      const ctx = ensureAudioContext();
      const now = ctx.currentTime;
      // 1. Cute sleepy cartoon yawn
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(380, now);
      osc.frequency.linearRampToValueAtTime(740, now + 0.35);
      osc.frequency.exponentialRampToValueAtTime(240, now + 0.75);

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.35, now + 0.1);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.75);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.75);

      // 2. Gentle snoring bubble ("Zzz... plop")
      const snore = ctx.createOscillator();
      const sGain = ctx.createGain();
      snore.type = 'triangle';
      const sStart = now + 0.95;
      snore.frequency.setValueAtTime(140, sStart);
      snore.frequency.exponentialRampToValueAtTime(90, sStart + 0.45);
      sGain.gain.setValueAtTime(0.25, sStart);
      sGain.gain.exponentialRampToValueAtTime(0.001, sStart + 0.45);
      snore.connect(sGain);
      sGain.connect(ctx.destination);
      snore.start(sStart);
      snore.stop(sStart + 0.45);
    } catch (e) {}
  }

  function playLoveKissSound() {
    try {
      const ctx = ensureAudioContext();
      const now = ctx.currentTime;
      // 1. Cute cartoon smooch ("Mwahhh!")
      const kiss = ctx.createOscillator();
      const kGain = ctx.createGain();
      kiss.type = 'triangle';
      kiss.frequency.setValueAtTime(820, now);
      kiss.frequency.exponentialRampToValueAtTime(320, now + 0.08);

      kGain.gain.setValueAtTime(0, now);
      kGain.gain.linearRampToValueAtTime(0.55, now + 0.015);
      kGain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

      kiss.connect(kGain);
      kGain.connect(ctx.destination);
      kiss.start(now);
      kiss.stop(now + 0.09);

      // 2. Sparkling magical glitter chime arpeggio
      const chimes = [1046, 1318, 1567, 2093];
      for (let i = 0; i < chimes.length; i++) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        const start = now + 0.12 + i * 0.08;
        osc.frequency.setValueAtTime(chimes[i], start);

        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(0.35, start + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.22);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.22);
      }
    } catch (e) {}
  }

  function playWeirdCartoonGiggleSounds() {
    try {
      const ctx = ensureAudioContext();
      const now = ctx.currentTime;

      // 1. Rapid funny cartoon giggle arpeggio (high-pitched playful giggles)
      const freqs = [620, 840, 720, 960, 1180, 1340];
      for (let i = 0; i < freqs.length; i++) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = i % 2 === 0 ? 'sine' : 'triangle';
        const start = now + i * 0.075;
        const dur = 0.07;
        osc.frequency.setValueAtTime(freqs[i], start);
        osc.frequency.exponentialRampToValueAtTime(freqs[i] * 1.35, start + dur);

        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(0.48, start + dur * 0.35);
        gain.gain.exponentialRampToValueAtTime(0.001, start + dur);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + dur);
      }

      // 2. Wacky vibrato cartoon wobble ("ajib awaz" squeak)
      const wobbleOsc = ctx.createOscillator();
      const wobbleGain = ctx.createGain();
      wobbleOsc.type = 'sine';
      const wStart = now + 0.42;
      const wDur = 0.28;
      wobbleOsc.frequency.setValueAtTime(780, wStart);
      wobbleOsc.frequency.linearRampToValueAtTime(1250, wStart + wDur * 0.6);
      wobbleOsc.frequency.linearRampToValueAtTime(650, wStart + wDur);

      wobbleGain.gain.setValueAtTime(0, wStart);
      wobbleGain.gain.linearRampToValueAtTime(0.42, wStart + 0.04);
      wobbleGain.gain.exponentialRampToValueAtTime(0.001, wStart + wDur);

      wobbleOsc.connect(wobbleGain);
      wobbleGain.connect(ctx.destination);
      wobbleOsc.start(wStart);
      wobbleOsc.stop(wStart + wDur);
    } catch (e) {}
  }

  function playSoftPurrGiggleSound() {
    try {
      const ctx = ensureAudioContext();
      const now = ctx.currentTime;
      const freqs = [560, 720];
      for (let i = 0; i < freqs.length; i++) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        const start = now + i * 0.085;
        const dur = 0.07;
        osc.frequency.setValueAtTime(freqs[i], start);
        osc.frequency.exponentialRampToValueAtTime(freqs[i] * 1.25, start + dur);

        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(0.32, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, start + dur);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + dur);
      }
    } catch (e) {}
  }

  function playInflateStepSound(progress = 0.5) {
    try {
      const ctx = ensureAudioContext();
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      const baseFreq = 260 + progress * 240;
      osc.frequency.setValueAtTime(baseFreq, now);
      osc.frequency.exponentialRampToValueAtTime(baseFreq + 85, now + 0.12);

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.38, now + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.12);
    } catch (e) {}
  }

  function playCutePoutSound() {
    try {
      const ctx = ensureAudioContext();
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(460, now);
      osc.frequency.exponentialRampToValueAtTime(210, now + 0.22);
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.55, now + 0.035);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.24);
    } catch (e) {}
  }

  function playDeflatePopSound() {
    try {
      const ctx = ensureAudioContext();
      const now = ctx.currentTime;
      // 1. Soft cute cartoon air whoosh
      const whooshOsc = ctx.createOscillator();
      const whooshGain = ctx.createGain();
      whooshOsc.type = 'sine';
      whooshOsc.frequency.setValueAtTime(480, now);
      whooshOsc.frequency.exponentialRampToValueAtTime(140, now + 0.18);
      whooshGain.gain.setValueAtTime(0, now);
      whooshGain.gain.linearRampToValueAtTime(0.32, now + 0.03);
      whooshGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
      whooshOsc.connect(whooshGain);
      whooshGain.connect(ctx.destination);
      whooshOsc.start(now);
      whooshOsc.stop(now + 0.18);

      // 2. Playful cartoon bubble "pop!"
      const popOsc = ctx.createOscillator();
      const popGain = ctx.createGain();
      popOsc.type = 'triangle';
      const popStart = now + 0.14;
      popOsc.frequency.setValueAtTime(940, popStart);
      popOsc.frequency.exponentialRampToValueAtTime(320, popStart + 0.045);
      popGain.gain.setValueAtTime(0, popStart);
      popGain.gain.linearRampToValueAtTime(0.58, popStart + 0.008);
      popGain.gain.exponentialRampToValueAtTime(0.001, popStart + 0.05);
      popOsc.connect(popGain);
      popGain.connect(ctx.destination);
      popOsc.start(popStart);
      popOsc.stop(popStart + 0.05);
    } catch (e) {}
  }

  function executeCreatureAction(action) {
    if (!creature) return 'No creature';

    // Cancel any synthetic browser speech synthesis to ensure zero duplicate voice
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try { window.speechSynthesis.cancel(); } catch (e) {}
    }

    switch (action) {
      case 'dance': {
        if (creature.playAction) creature.playAction('dance', 4.5);
        playDanceMusicBeat();
        break;
      }
      case 'cry': {
        if (creature.playAction) creature.playAction('cry', 3.8);
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
        if (creature.playAction) creature.playAction('love', 3.5);
        playLoveKissSound();
        break;
      }
      case 'shake_fur': {
        if (creature.playAction) creature.playAction('shake_fur', 2.0);
        break;
      }
      case 'happy_jump': {
        creature.triggerBoop();
        setTimeout(() => creature.triggerBoop(), 280);
        setTimeout(() => creature.triggerBoop(), 560);
        break;
      }
      default:
        creature.triggerBoop();
        break;
    }
    return `Mochi is now expressing ${action}!`;
  }

  let last5SecLaughterTime = 0;
  let last10SecPoutTime = 0;

  function trigger5SecLaughter() {
    playWeirdCartoonGiggleSounds();
    const now = Date.now();
    if (now - last5SecLaughterTime < 6000) return;
    last5SecLaughterTime = now;

    if (socket && socket.readyState === WebSocket.OPEN && !isSpeaking) {
      console.log('[Gemini Live] Sending tickle laughter turn...');
      socket.send(JSON.stringify({
        clientContent: {
          turns: [
            {
              role: 'user',
              parts: [
                {
                  text: '[The user is rubbing and tickling your soft fluffy fur right now! Laugh hilariously with weird, funny, squeaky cartoon giggles in your baby anime girl voice in Hindi/Hinglish! Say a completely fresh, creative, funny tickle remark each time (e.g. playful excuses, laughing that your fur is getting messed up, squealing with laughter)! Do NOT repeat old lines!]'
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
      console.log('[Gemini Live] Sending puffed pout turn...');
      socket.send(JSON.stringify({
        clientContent: {
          turns: [
            {
              role: 'user',
              parts: [
                {
                  text: '[The user has petted and tickled you for too long! Your cheeks are puffed up huge like an angry chipmunk, facing straight at the user! Speak a fresh, funny, stubborn, super cute pout remark in your cartoon girl voice in Hindi/Hinglish (e.g. declaring a 5-minute talking strike, warning that your cheeks will pop, or calling them very naughty)! Do NOT repeat old lines!]'
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
    console.log('[Gemini Live] Sending greeting prompt...');
    const greetingMsg = {
      clientContent: {
        turns: [
          {
            role: 'user',
            parts: [
              {
                text: 'The user just clicked on you to talk! Greet them warmly and cheerfully in your sweet, innocent cartoon girl voice in Hindi/Hinglish (e.g. "Yay! Namaste! Main hoon Mochi-Puff! Batao aaj kya baatein karein?")!'
              }
            ]
          }
        ],
        turnComplete: true
      }
    };
    socket.send(JSON.stringify(greetingMsg));
  }

  async function connectLiveAPI() {
    const key = getApiKey();
    if (!key) {
      updateHud('⚠️ Please set GEMINI_API_KEY in your .env file to talk with Mochi-Puff');
      return;
    }

    ensureAudioContext();
    stopAllPlayback();
    if (socket) {
      try { socket.close(); } catch (e) {}
      socket = null;
    }

    updateHud('⏳ Connecting to Gemini 3.8 Live...');

    const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${key}`;

    try {
      socket = new WebSocket(wsUrl);
      socket.binaryType = 'arraybuffer';
    } catch (e) {
      updateHud('❌ WebSocket connection failed');
      return;
    }

    socket.onopen = () => {
      console.log('[Gemini Live] Connected. Sending setup...');
      const setupMsg = buildSetupPayload();
      socket.send(JSON.stringify(setupMsg));
    };

    socket.onmessage = async (event) => {
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

        // 1. Setup complete
        if (msg.setupComplete) {
          console.log('[Gemini Live] Setup complete!');
          isConnected = true;
          await startMicrophone();
          sendGreetingPrompt();
          return;
        }

        // 2. Server Content (Audio & Transcripts)
        if (msg.serverContent) {
          const sc = msg.serverContent;

          // Barge-in interruption
          if (sc.interrupted) {
            console.log('[Gemini Live] Interrupted');
            stopAllPlayback();
            setIsThinking(false);
          }

          // Spoken audio chunks
          if (sc.modelTurn?.parts) {
            for (const part of sc.modelTurn.parts) {
              if (part.inlineData && part.inlineData.data) {
                queueAudioPlayback(part.inlineData.data);
              }
            }
          }

          // Real-time speech-to-text transcriptions
          if (sc.inputTranscription?.text) {
            showTranscript('user', sc.inputTranscription.text);
          }
          if (sc.outputTranscription?.text) {
            showTranscript('mochi', sc.outputTranscription.text);
          }
        }

        // 3. Background Reasoning / Thinking
        if (msg.interactionStatus) {
          if (msg.interactionStatus === 'IN_PROGRESS') {
            setIsThinking(true);
          } else if (msg.interactionStatus === 'IDLE') {
            setIsThinking(false);
          }
        }

        // 4. Asynchronous Tool Calls
        if (msg.toolCall?.functionCalls) {
          handleToolCall(msg.toolCall.functionCalls);
        }
      } catch (err) {
        console.error('[Gemini Live] Message parse error:', err);
      }
    };

    socket.onerror = (err) => {
      console.error('[Gemini Live] WebSocket Error:', err);
      updateHud('❌ Connection error. Check GEMINI_API_KEY in .env');
      isConnected = false;
      stopMicrophone();
    };

    socket.onclose = () => {
      isConnected = false;
      isListening = false;
      isThinking = false;
      isSpeaking = false;
      stopMicrophone();
      updateHud('👆 Click Mochi-Puff (the doll) to talk with Gemini 3.8 Live · Click again to stop');
    };
  }

  function disconnectLiveAPI() {
    stopMicrophone();
    stopAllPlayback();
    if (socket) {
      try {
        socket.close();
      } catch (e) {}
      socket = null;
    }
    isConnected = false;
    isListening = false;
    isSpeaking = false;
    isThinking = false;
    updateHud('👆 Click Mochi-Puff (the doll) to talk with Gemini 3.8 Live · Click again to stop');
  }

  function setIsSpeaking(speaking) {
    isSpeaking = speaking;
    if (speaking) {
      updateHud('🔊 Mochi-Puff is speaking... (Click Mochi anytime to stop)');
    } else if (isListening) {
      updateHud('🎙️ Mochi-Puff is listening... Speak now! Click Mochi to stop.');
    }
  }

  function setIsThinking(thinking) {
    isThinking = thinking;
    if (thinking && !isSpeaking) {
      updateHud('🧠 Mochi-Puff is thinking... Click Mochi to stop.');
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
        creature.animState.isListening = isListening;
        creature.animState.speechVolume = outputVol;
      }

      audioLevelPollId = requestAnimationFrame(poll);
    };

    audioLevelPollId = requestAnimationFrame(poll);
  }

  // =========================================================================
  // 5. CLEAN VIEWPORT (ZERO TEXT OVERLAYS AS REQUESTED)
  // =========================================================================

  function renderSubtitles() {
    // Pure clean 3D simulation: Audio-only interaction without on-screen text boxes
    startAudioLevelPolling();
  }

  function showTranscript(sender, text) {
    // Hidden: Pure audio interaction
  }

  function showToolBadge(text) {
    // Hidden: Pure audio interaction
  }

  // =========================================================================
  // 6. DOLL CLICK TOGGLE INTERACTION
  // =========================================================================

  function handleCreatureClick() {
    const isActive = isConnected || isListening || isSpeaking || (socket && socket.readyState === WebSocket.OPEN);

    // Click again to STOP!
    if (isActive) {
      disconnectLiveAPI();
      creature?.triggerBoop();
      updateHud('⏸️ Mochi-Puff stopped. Click Mochi anytime to talk again!');
      return true;
    }

    // Click to START!
    const key = getApiKey();
    if (!key) {
      updateHud('⚠️ Please set GEMINI_API_KEY in your .env file to talk with Mochi-Puff');
      return true;
    }

    creature?.triggerBoop();
    connectLiveAPI();
    return true;
  }

  renderSubtitles();

  return {
    connect: connectLiveAPI,
    disconnect: disconnectLiveAPI,
    handleCreatureClick,
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
    triggerTickleSpeech: trigger5SecLaughter,
    triggerPoutSpeech: trigger10SecPoutSpeech,
    isConnected: () => isConnected,
    isListening: () => isListening,
    isSpeaking: () => isSpeaking
  };
}
