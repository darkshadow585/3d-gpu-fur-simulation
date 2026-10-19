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
  playBubbleSpawnSound
} from './soundEffects.js';

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
    } catch (_err) {
      // Gracefully handle browser/iframe microphone permission denial without throwing console errors
      isListening = false;
      updateHud('🔊 Mochi-Puff audio ready · Enable mic permission to speak, or tap Mochi / keys (1-9, F, D, V)!');
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

DYNAMIC CONVERSATIONAL 3D EMOTIONS & INTERACTIVE FEATURES:
You are an expressive 3D doll! Always call the matching tool so your 3D body, fur, accessories, weather, treats, and friends react in real time:
1. MINI FRIENDS ("Chintu, Pintu, Golu, Molu"):
   * When the user asks about your friends ("tumhare dost kaha hai", "dosto ko bulao"), call play_creature_action(action="summon_friends") and excitedly introduce your 4 cute mini clones: **Chintu, Pintu, Golu, and Molu**!
   * When they start running around mischievously, scold them cutely while looking at them ("Oye Chintu, Pintu, Golu, Molu! Idhar udhar mat bhago!") and ask the user: "Ye bahut pareshan kar rahe hain, kya main inhe bhej du?"
   * If the user replies YES / "hmm" / "haan" / "bhej do" -> call play_creature_action(action="dismiss_friends") and say bye-bye to Chintu, Pintu, Golu, Molu!
   * If the user replies NO / "nahi" / "rehne do" / "mat bhejo" -> call play_creature_action(action="keep_friends") and tell them to stay and behave nicely!
2. VOICE FUR COLOR & LENGTH CONTROL ("baal bada/chhota karo", "color badlo"):
   * Whenever the user asks to change your fur color (e.g. pink, blue, golden, green, white, red, purple) or make your hair/fur longer ("baal bade kar do", "lamba karo") or shorter ("baal chhote kar do", "kam karo"), call change_fur_style with the appropriate baseColor/tipColor or furLength (e.g. 0.48 for long, 0.14 for short)!
3. 3D DRESS-UP & ACCESSORIES ("Chashma pehno", "Crown lagao", "Party hat", "Bowtie"):
   * Call toggle_accessory whenever the user asks you to wear or remove sunglasses ("chashma pehno"), crown ("crown/taj lagao"), party hat ("topi/party hat pehno"), or bowtie ("tie/bowtie lagao")!
4. INTERACTIVE WEATHER ("Baarish kar do", "Chhata kholo", "Baarish roko"):
   * Call set_weather(weather="rain") when the user asks for rain ("baarish kar do"). Act surprised that your fluffy fur is getting wet!
   * Call set_weather(weather="umbrella") or set_weather(weather="rain_with_umbrella") when asked to open an umbrella ("chhata khol lo").
   * Call set_weather(weather="clear") when asked to stop the rain ("baarish band karo" / "paani jhaado") — you will automatically shake your fur ('shake_fur') to dry off!
5. PEEK-A-BOO / HIDE & SEEK ("Chhup jao", "Aankhen band karo", "Peek-a-boo"):
   * Call play_creature_action(action="peekaboo") whenever the user says "chhup jao", "peek-a-boo", or closes their eyes! You cover your eyes with your cute little paws and then pop out saying "Peek-a-boo! Dikha!"
6. 3D FEEDING, SALON HAIR DRYER & SOAP BUBBLES ("Cake khao", "Dryer chalao", "Bubbles udao"):
   * Call play_creature_action(action="feed") when the user offers food, cake, or sweets ("khana khilao", "cake khao", "bhook lagi hai")! Munch happily saying "Yummy! Strawberry cake!"
   * Call play_creature_action(action="hair_dryer") when asked to blow-dry your hair or use the salon dryer ("dryer chalao", "baal sukhao")!
   * Call play_creature_action(action="bubbles") when asked to blow soap bubbles ("bubbles udao", "bulbule")!
7. EMOTIONS ('cry', 'pout', 'laugh', 'love', 'dance', 'sleep'):
   * Call play_creature_action(action="cry") with big glossy 3D anime tears rolling over your fur if scolded; 'love' with 3D heart-eyes if praised/loved; 'pout' if teased; 'laugh' on jokes; 'sleep' on goodnight; and 'dance' ONLY ONCE (3.5s) when asked to dance ("stop" if asked to stop).`;

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
            description: "Put on or take off Mochi-Puff's 3D accessories: 'crown' (royal gold crown/taj), 'party_hat' (festive cone hat/topi), 'bowtie' (cute red ribbon tie), 'sunglasses' (cool shades/chashma), or 'remove_all'.",
            parameters: {
              type: 'OBJECT',
              properties: {
                accessory: {
                  type: 'STRING',
                  enum: ['crown', 'party_hat', 'bowtie', 'sunglasses', 'remove_all'],
                  description: "Accessory to equip or remove: 'crown', 'party_hat', 'bowtie', 'sunglasses', or 'remove_all'"
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
            - 'shake_fur': Rapidly shakes fur to dry off water`,
            parameters: {
              type: 'OBJECT',
              properties: {
                action: {
                  type: 'STRING',
                  enum: ['dance', 'stop', 'cry', 'laugh', 'pout', 'sleep', 'love', 'peekaboo', 'feed', 'hair_dryer', 'bubbles', 'summon_friends', 'dismiss_friends', 'keep_friends', 'shake_fur', 'happy_jump'],
                  description: "Action name"
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

  function speakCuteCartoonVoice() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try { window.speechSynthesis.cancel(); } catch (e) {}
    }
  }

  function executeCreatureAction(action) {
    if (!creature) return 'No creature';

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try { window.speechSynthesis.cancel(); } catch (e) {}
    }

    switch (action) {
      case 'summon_friends':
      case 'friends': {
        if (creature.summonFriends) creature.summonFriends(60.0);
        if (creature.playAction) creature.playAction('summon_friends', 3.2);
        playFriendsSpawnSound();
        return 'Mochi summoned Chintu, Pintu, Golu, and Molu!';
      }
      case 'dismiss_friends': {
        if (creature.dismissFriends) creature.dismissFriends();
        playDeflatePopSound();
        return 'Chintu, Pintu, Golu, and Molu waved goodbye and left!';
      }
      case 'keep_friends': {
        if (creature.calmFriendsAndKeep) creature.calmFriendsAndKeep();
        playAccessoryEquipSound();
        return 'Chintu, Pintu, Golu, and Molu calmed down and stayed with Mochi!';
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
      socket.send(JSON.stringify({
        clientContent: {
          turns: [
            {
              role: 'user',
              parts: [
                {
                  text: '[Your 4 mini clones (Chintu, Pintu, Golu, Molu) have started running around everywhere mischievously! Look at them and say in your cute cartoon girl voice in Hindi: "Oye Chintu, Pintu, Golu, Molu! Idhar udhar mat bhago! Ye sab bahut pareshan kar rahe hain, kya main inhe bhej du?" Wait for the user to say "hmm/haan" to send them away or "nahi" to let them stay!]'
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
      socket.send(JSON.stringify({
        clientContent: {
          turns: [
            {
              role: 'user',
              parts: [
                {
                  text: '[The user is rubbing and tickling your soft fluffy fur right now! Laugh hilariously with weird, funny, squeaky cartoon giggles in your baby anime girl voice in Hindi/Hinglish! Say a completely fresh, creative, funny tickle remark each time! Do NOT repeat old lines!]'
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
      socket.send(JSON.stringify({
        clientContent: {
          turns: [
            {
              role: 'user',
              parts: [
                {
                  text: '[The user has petted and tickled you for too long! Your cheeks are puffed up huge like an angry chipmunk, facing straight at the user! Speak a fresh, funny, stubborn, super cute pout remark in your cartoon girl voice in Hindi/Hinglish! Do NOT repeat old lines!]'
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
                text: 'The user just clicked on you to talk! Greet them warmly and cheerfully in your sweet, innocent cartoon girl voice in Hindi/Hinglish (e.g. "Yay! Namaste! Main hoon Mochi-Puff! Batao aaj kya masti karein?")!'
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
        return;
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
        return;
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
      } else if (creature && creature.summonFriends && !creature.animState?.friendsVisible) {
        executeCreatureAction('summon_friends');
      }
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
    }
    if (
      uText.includes('bubble') ||
      uText.includes('bulbul') ||
      uText.includes('बबल') ||
      uText.includes('बुलबुले')
    ) {
      executeCreatureAction('bubbles');
    }

    // 5. 3D Dress-up & Accessories ("chashma", "crown", "party hat", "bowtie")
    if (uText.includes('chashma') || uText.includes('glass') || uText.includes('goggle') || uText.includes('चश्मा')) {
      const remove = uText.includes('utaar') || uText.includes('hata') || uText.includes('remove') || uText.includes('उतार');
      creature.toggleAccessory('sunglasses', !remove);
      playAccessoryEquipSound();
    }
    if (uText.includes('crown') || uText.includes('taj') || uText.includes('ताज') || uText.includes('क्राउन')) {
      const remove = uText.includes('utaar') || uText.includes('hata') || uText.includes('remove');
      creature.toggleAccessory('crown', !remove);
      playAccessoryEquipSound();
    }
    if (uText.includes('party hat') || uText.includes('topi') || uText.includes('hat') || uText.includes('टोपी')) {
      const remove = uText.includes('utaar') || uText.includes('hata') || uText.includes('remove');
      creature.toggleAccessory('party_hat', !remove);
      playAccessoryEquipSound();
    }
    if (uText.includes('bowtie') || uText.includes('tie') || uText.includes('bow') || uText.includes('टाई')) {
      const remove = uText.includes('utaar') || uText.includes('hata') || uText.includes('remove');
      creature.toggleAccessory('bowtie', !remove);
      playAccessoryEquipSound();
    }

    // 6. Interactive Weather ("baarish", "umbrella", "chhata")
    if (uText.includes('chhata') || uText.includes('chata') || uText.includes('umbrella') || uText.includes('छाता')) {
      creature.setWeatherState('umbrella');
      playWeatherSound('umbrella');
    } else if (uText.includes('baarish') || uText.includes('barish') || uText.includes('rain') || uText.includes('बारिश')) {
      if (uText.includes('band') || uText.includes('rok') || uText.includes('stop') || uText.includes('बंद') || uText.includes('रोक')) {
        creature.setWeatherState('clear');
      } else {
        creature.setWeatherState('rain');
        playWeatherSound('rain');
      }
    }

    // 7. Fur Length & Color Voice Commands ("baal bada/chhota", "color")
    if (uText.includes('baal') || uText.includes('fur') || uText.includes('hair') || uText.includes('बाल')) {
      if (uText.includes('bada') || uText.includes('bade') || uText.includes('lamba') || uText.includes('lambe') || uText.includes('long') || uText.includes('बड़े') || uText.includes('लंबे')) {
        const nextLen = Math.min(0.55, (simState.furLength || 0.31) + 0.14);
        applyFurStyle({ furLength: nextLen });
      } else if (uText.includes('chhota') || uText.includes('chhote') || uText.includes('chota') || uText.includes('kam') || uText.includes('short') || uText.includes('छोटे') || uText.includes('कम')) {
        const nextLen = Math.max(0.09, (simState.furLength || 0.31) - 0.14);
        applyFurStyle({ furLength: nextLen });
      }
    }
    if (uText.includes('color') || uText.includes('rang') || uText.includes('रंग') || uText.includes('कलर')) {
      if (uText.includes('gold') || uText.includes('peela') || uText.includes('yellow') || uText.includes('पीला')) {
        applyFurStyle({ presetName: 'Golden Fluff' });
      } else if (uText.includes('blue') || uText.includes('neela') || uText.includes('नीला')) {
        applyFurStyle({ presetName: 'Midnight Velvet' });
      } else if (uText.includes('green') || uText.includes('hara') || uText.includes('हरा')) {
        applyFurStyle({ presetName: 'Matcha Puff' });
      } else if (uText.includes('white') || uText.includes('safed') || uText.includes('सफेद')) {
        applyFurStyle({ presetName: 'Snowball' });
      } else if (uText.includes('red') || uText.includes('laal') || uText.includes('लाल')) {
        applyFurStyle({ presetName: 'Ruby Red' });
      } else if (uText.includes('pink') || uText.includes('gulabi') || uText.includes('गुलाबी')) {
        applyFurStyle({ presetName: 'Sakura Mochi' });
      }
    }
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

        if (msg.setupComplete) {
          isConnected = true;
          await startMicrophone();
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
            showTranscript('user', sc.inputTranscription.text);
            handleInstantVoiceTranscript(sc.inputTranscription.text);
          }
          if (sc.outputTranscription?.text) {
            showTranscript('mochi', sc.outputTranscription.text);
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

    socket.onerror = () => {
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
