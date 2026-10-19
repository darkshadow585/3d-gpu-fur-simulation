import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { createBlobCreature } from './blobCreature.js';
import { createGPUFurPhysics } from './gpuPhysics.js';
import { createGPUFurSystem } from './furSystem.js';
import { createMinimalUI, FUR_PRESETS } from './ui.js';
import { createEnvironmentManager } from './environments.js';
import { createVoiceAssistant } from './voiceAssistant.js';
import { playMochiBoopSound } from './soundEffects.js';

const container = document.getElementById('canvas-container');
const uiContainer = document.getElementById('ui-root');
const hudHint = document.getElementById('hud-hint');

if (hudHint) {
  hudHint.textContent = '👆 Click Mochi-Puff (the doll) to talk with Gemini 3.8 Live · Click again to stop';
}

const urlSearchParams = new URLSearchParams(window.location.search);
const forceWebGL = urlSearchParams.get('gpuFur') === '0' || urlSearchParams.get('mode') === 'webgl';
const isMobileDevice =
  window.matchMedia('(max-width: 768px)').matches ||
  ('ontouchstart' in window && window.innerWidth <= 920);
const initialGpuFur = !forceWebGL && !isMobileDevice;

// Initial state from our Sakura Mochi preset + Studio environment (WebGPU Fur mode on Desktop, Mobile 60 FPS tier on phones)
const simState = {
  ...FUR_PRESETS[0],
  keyColor: '#fff7ed',
  lightAngle: -74,
  lightIntensity: 1.35,
  rimIntensity: 1.35,
  windStrength: 0.95,
  environment: 'studio',
  gpuFurEnabled: initialGpuFur,
  isMobileTier: isMobileDevice
};

// 1. Initialize WebGL2 Renderer with alpha: true so the soft CSS radial studio or AR camera backdrop shines through
const renderer = new THREE.WebGLRenderer({
  antialias: !isMobileDevice,
  powerPreference: 'high-performance',
  alpha: true
});
const maxDeviceDPR = isMobileDevice ? 1.25 : 2.0;
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxDeviceDPR));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
container.appendChild(renderer.domElement);

// 2. Scene & Camera
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  42,
  window.innerWidth / window.innerHeight,
  0.1,
  80
);
camera.position.set(0.0, 0.45, 6.4);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.minDistance = 2.6;
controls.maxDistance = 15.0;
controls.maxPolarAngle = Math.PI * 0.62;
controls.target.set(0, 0.05, 0);

// 3. Synchronized 3-Point Studio Lighting Rig
const keyLight = new THREE.DirectionalLight('#fff7ed', simState.lightIntensity * 1.4);
keyLight.castShadow = true;
const shadowMapRes = isMobileDevice ? 512 : 1024;
keyLight.shadow.mapSize.set(shadowMapRes, shadowMapRes);
keyLight.shadow.bias = -0.0005;
keyLight.shadow.radius = 2.5;
keyLight.shadow.camera.left = -2.2;
keyLight.shadow.camera.right = 2.2;
keyLight.shadow.camera.top = 2.2;
keyLight.shadow.camera.bottom = -2.2;
keyLight.shadow.camera.near = 0.5;
keyLight.shadow.camera.far = 10.0;
keyLight.shadow.camera.updateProjectionMatrix();
scene.add(keyLight);

const rimLight = new THREE.DirectionalLight('#c4b5fd', simState.rimIntensity * 1.2);
rimLight.position.set(-2.4, 1.8, -3.2);
scene.add(rimLight);

const hemiLight = new THREE.HemisphereLight('#f5d0fe', '#1e1b4b', 0.85);
scene.add(hemiLight);

// 4. Create Stylized Blob Creature ("Mochi-Puff") + Hybrid GPU Fur + GPGPU Physics
const creature = createBlobCreature();
scene.add(creature.root);
if (creature.friendsContainer) {
  scene.add(creature.friendsContainer);
}
if (creature.rainContainer) {
  scene.add(creature.rainContainer);
}
if (creature.bubblesContainer) {
  scene.add(creature.bubblesContainer);
}

const gpuPhysics = createGPUFurPhysics(renderer);
// Automatic WebGL fallback if GPGPU ping-pong physics is unsupported by the device/browser
if (simState.gpuFurEnabled && !gpuPhysics.isGPGPUActive) {
  simState.gpuFurEnabled = false;
}
const furSystem = createGPUFurSystem(creature.bodyGeometry, simState);

// Attach both the 64-layer GPU shells and 60,000 instanced hair strands to creature root
creature.root.add(furSystem.shellMesh);
creature.root.add(furSystem.strandMesh);

// Initialize multi-environment manager (Studio, Sunny Meadow, Cozy Highrise, AR Camera)
const envManager = createEnvironmentManager({
  scene,
  renderer,
  container,
  keyLight,
  rimLight,
  hemiLight,
  furSystem,
  camera
});

// Helper to synchronize Key Light angle, color & intensity between scene lights and GLSL uniforms
function updateLightingFromState() {
  const rad = (simState.lightAngle * Math.PI) / 180.0;
  const lx = Math.sin(rad) * 2.8;
  const ly = 2.1;
  const lz = Math.cos(rad) * 2.8;

  keyLight.position.set(lx, ly, lz);
  keyLight.intensity = simState.lightIntensity * 1.35;
  rimLight.intensity = simState.rimIntensity * 1.15;
  if (simState.keyColor) {
    keyLight.color.set(simState.keyColor);
    furSystem.sharedUniforms.uKeyLightColor.value.set(simState.keyColor);
  }

  furSystem.sharedUniforms.uKeyLightDir.value.set(lx, ly, lz).normalize();
  furSystem.sharedUniforms.uKeyLightIntensity.value = simState.lightIntensity;
  furSystem.sharedUniforms.uRimIntensity.value = simState.rimIntensity;

  // Match under-skin color to darkened base root color so skin blends seamlessly
  creature.skinMaterial.color.set(simState.baseColor).multiplyScalar(0.55);
}

// Helper to center the camera & OrbitControls point-of-focus on Mochi-Puff with appropriate framing across environments
function applyCameraFramingForEnvironment(envId) {
  const isDesk = envId === 'highrise';
  const isAR = envId === 'ar';
  const s = (isDesk || isAR) ? 0.25 : 1.0;
  // In Cozy Desk view, place Mochi slightly forward (+Z) and slightly left (-X) so its fur never intersects the keyboard
  const deskX = isDesk ? -0.14 : 0.0;
  const deskZ = isDesk ? 0.42 : 0.0;
  creature.setEnvironmentScale(s, deskX, deskZ);

  const isMobile = window.matchMedia('(max-width: 768px)').matches;
  const aspect = window.innerWidth / Math.max(1, window.innerHeight);
  const mobileZoomOut = isMobile
    ? Math.max(1.45, Math.min(1.95, 0.82 / Math.max(0.42, aspect)))
    : 1.0;

  if (isAR) {
    // In AR mode, Mochi is rendered at 1/4 size (s = 0.25) while keeping camera at full room distance
    // so Mochi looks miniature in the real room instead of filling the view
    const targetY = -0.94 * (1.0 - s) + 0.05 * s;
    controls.target.set(0.0, targetY, 0.0);
    camera.position.set(0.0, 0.35, 6.2 * mobileZoomOut);
    controls.minDistance = 1.4;
    controls.maxDistance = 14.0 * mobileZoomOut;
    controls.update();
  } else {
    // At scale s, Mochi-Puff's baseY is -0.94 * (1 - s), and its visual center is baseY + 0.05 * s
    const targetY = -0.94 * (1.0 - s) + 0.05 * s;
    controls.target.set(deskX, targetY, deskZ);
    camera.position.set(deskX, targetY + 0.40 * s, deskZ + 6.4 * s * mobileZoomOut);
    controls.minDistance = 2.6 * s;
    controls.maxDistance = 15.0 * s * mobileZoomOut;
    controls.update();
  }
}

function applyEnvironmentPreset(envId) {
  const prevEnv = simState.environment;
  simState.environment = envId;

  // When switching from AR mode to another view, reset Mochi's position to its original spot
  if (typeof creature !== 'undefined' && creature.resetPlacement) {
    if ((prevEnv === 'ar' && envId !== 'ar') || (envId !== 'ar' && creature.isPlaced && creature.isPlaced())) {
      creature.resetPlacement(false);
    }
  }

  const envPreset = envManager.setEnvironment(envId);
  const u = furSystem.sharedUniforms;
  if (envPreset) {
    if (envPreset.keyColor !== undefined) {
      simState.keyColor = envPreset.keyColor;
    }
    simState.lightAngle = envPreset.lightAngle;
    simState.lightIntensity = envPreset.lightIntensity;
    simState.rimIntensity = envPreset.rimIntensity;
    simState.windStrength = envPreset.windStrength;
    u.uWindStrength.value = envPreset.windStrength;
  }
  applyCameraFramingForEnvironment(envId);
  updateLightingFromState();
  if (hudHint) {
    if (envId === 'ar') {
      hudHint.textContent = 'AR Active: Tap screen to place Mochi · Click Mochi to talk/stop · Drag to orbit';
    } else {
      hudHint.textContent = '👆 Click Mochi-Puff (the doll) to talk with Gemini 3.8 Live · Click again to stop';
    }
  }
}

const ALLOWED_ENV_IDS = new Set(['studio', 'meadow', 'highrise', 'ar']);
const urlEnvParam = new URLSearchParams(window.location.search).get('env');
const initialEnvId = urlEnvParam && ALLOWED_ENV_IDS.has(urlEnvParam) ? urlEnvParam : simState.environment;
applyEnvironmentPreset(initialEnvId);

// 5. Build Minimalist UI Controls
const ui = createMinimalUI(uiContainer, simState, (key, value) => {
  const u = furSystem.sharedUniforms;
  switch (key) {
    case 'environment': {
      applyEnvironmentPreset(value);
      ui.syncUI();
      break;
    }
    case 'toggleGPUFur': {
      const enabled = Boolean(value);
      simState.gpuFurEnabled = enabled;
      furSystem.setGPUFurEnabled(enabled);
      ui.setGPUFurEnabled(enabled);
      if (hudHint) {
        hudHint.textContent = enabled
          ? 'WebGPU Fur ON (Default) · 64 Volumetric Shells + 60,000 3D Strands + GPGPU Verlet Physics'
          : 'WebGL Mode ON · Lightweight Analytical WebGL Fur · Toggle WebGPU Fur anytime';
      }
      break;
    }
    case 'arToggleMirror': {
      const mirrored = envManager.toggleMirror();
      ui.setMirrorLabel(mirrored);
      break;
    }
    case 'arFlipCamera':
      envManager.flipCamera();
      break;
    case 'furLength':
      u.uFurLength.value = value;
      break;
    case 'furDensity':
      furSystem.updateDensity(value);
      break;
    case 'clumping':
      u.uClumping.value = value;
      break;
    case 'curliness':
      u.uCurliness.value = value;
      break;
    case 'baseColor':
      u.uBaseColor.value.set(value);
      creature.skinMaterial.color.set(value).multiplyScalar(0.55);
      break;
    case 'tipColor':
      u.uTipColor.value.set(value);
      break;
    case 'roughness':
      u.uRoughness.value = value;
      break;
    case 'specular':
      u.uSpecular.value = value;
      break;
    case 'keyColor':
    case 'lightAngle':
    case 'lightIntensity':
    case 'rimIntensity':
      updateLightingFromState();
      break;
    case 'windStrength':
      u.uWindStrength.value = value;
      break;
    case 'toggleRecordMode': {
      isRecordMode = Boolean(value);
      if (isRecordMode) {
        currentDPR = 1.0;
        renderer.setPixelRatio(1.0);
        document.body.classList.add('record-mode');
        furSystem.updateDensity(0.48);
        if (hudHint) {
          hudHint.textContent = 'Record Mode ON · 1x DPR · 60 FPS Lock';
        }
      } else {
        currentDPR = targetDPR;
        renderer.setPixelRatio(targetDPR);
        document.body.classList.remove('record-mode');
        furSystem.updateDensity(simState.furDensity || 0.75);
      }
      break;
    }
    case 'setDPR': {
      targetDPR = value === '1x' ? 1.0 : (value === '1.5x' ? 1.5 : Math.min(window.devicePixelRatio || 1, 2));
      currentDPR = targetDPR;
      renderer.setPixelRatio(currentDPR);
      break;
    }
    case 'toggleAutoFPSGuard': {
      autoFPSGuard = Boolean(value);
      break;
    }
    case 'arToggleTapPlace':
      tapToPlaceEnabled = Boolean(value);
      break;
    case 'arToggleLightEst': {
      const enabled = Boolean(value);
      envManager.setLightEstimationEnabled(enabled);
      if (hudHint) {
        hudHint.textContent = enabled
          ? 'AR Light Estimation ON · Sampling webcam color temperature, key direction & brightness'
          : 'AR Light Estimation OFF · Restored neutral studio AR lighting (sliders unlocked)';
      }
      break;
    }
    case 'arResetPosition':
      creature.resetPlacement();
      envManager.resetARAnchor();
      if (hudHint) {
        hudHint.textContent = 'Mochi reset to center position · Tap screen to place on detected surface';
      }
      break;
    default:
      break;
  }
});

let tapToPlaceEnabled = true;

envManager.onARStatusChange((statusText, isLive) => {
  ui.setARStatus(statusText, isLive);
});

envManager.onPlaneDetected((planeInfo) => {
  ui.setARPlaneStatus(
    planeInfo.surfaceType,
    planeInfo.planeY,
    planeInfo.confidence,
    planeInfo.featureCount
  );
});

envManager.onLightEstimated((lightInfo) => {
  if (simState.environment !== 'ar') return;
  if (!lightInfo.isManualReset && !envManager.isLightEstimationEnabled()) return;
  simState.keyColor = lightInfo.keyColor;
  simState.lightAngle = lightInfo.lightAngle;
  simState.lightIntensity = lightInfo.lightIntensity;
  simState.rimIntensity = lightInfo.rimIntensity;
  updateLightingFromState();
  ui.setARLightStatus(lightInfo);
});

// 6. Gemini 3.8 Live Voice-to-Voice (V2V) & Reasoning Assistant
let speechVolume = 0;
let speechIsSpeaking = false;
let speechIsThinking = false;

const voiceAssistant = createVoiceAssistant({
  creature,
  furSystem,
  simState,
  applyEnvironmentPreset,
  updateLightingFromState,
  ui,
  onSpeechVolume: (volume, isSpeaking, isThinking) => {
    speechVolume = volume;
    speechIsSpeaking = isSpeaking;
    speechIsThinking = isThinking;
  }
});

// 7. Interactive 3D Pointer Raycasting for Petting, Combing & Booping
const raycaster = new THREE.Raycaster();
const pointerNDC = new THREE.Vector2(0, 0);
const pointerLocalPos = new THREE.Vector3(0, 0, 2);
const prevPointerLocalPos = new THREE.Vector3(0, 0, 2);
const pointerVelocity = new THREE.Vector3(0, 0, 0);
let isPointerOverCreature = false;
let pointerDownPos = { x: 0, y: 0 };
let boopShockwave = 0.0;

// Continuous Petting & Timing System:
// - 0s to 5s: Sweet happy purr
// - 5s: Laugh & weird cute cartoon sounds ("hase ajib ajib awaje nikale")
// - 5s to 10s: Facing straight ahead & gradual cheek inflation ("samane hi tak dheere dheere muh kaa size bada le")
// - 10s: Puffed-face pout ("mere ko nahi baat karani"), holds for 3s, then deflates back to normal!
let petStrokeActiveSeconds = 0.0;
let lastPetStrokeTimestamp = 0;
let hasTriggered5SecLaughter = false;
let hasTriggered10SecPout = false;
let lastCheekInflationSoundTime = 0;
let lastSoftGiggleTime = 0;

if (creature && creature.setOnPoutDeflate) {
  creature.setOnPoutDeflate(() => {
    hasTriggered10SecPout = false;
    hasTriggered5SecLaughter = false;
    petStrokeActiveSeconds = 0.0;
    if (voiceAssistant && voiceAssistant.playDeflatePopSound) {
      voiceAssistant.playDeflatePopSound();
    }
  });
}

function isEventOnUIOverlay(e) {
  return Boolean(
    e.target &&
    typeof e.target.closest === 'function' &&
    (e.target.closest('#ui-root') ||
      e.target.closest('#page-nav') ||
      e.target.closest('#scene-nav') ||
      e.target.closest('#mobile-controls-btn') ||
      e.target.closest('#mobile-sheet-backdrop') ||
      e.target.closest('#voice-transcript-bubble'))
  );
}

window.addEventListener('pointermove', (e) => {
  if (isEventOnUIOverlay(e)) {
    isPointerOverCreature = false;
    return;
  }
  pointerNDC.x = (e.clientX / window.innerWidth) * 2.0 - 1.0;
  pointerNDC.y = -(e.clientY / window.innerHeight) * 2.0 + 1.0;

  raycaster.setFromCamera(pointerNDC, camera);
  // Intersect ONLY creature core bodyMesh — avoids outer 64 fur shells or strands intercepting distant hovering!
  const hits = raycaster.intersectObject(creature.bodyMesh, false);
  if (hits.length > 0) {
    prevPointerLocalPos.copy(pointerLocalPos);
    pointerLocalPos.copy(hits[0].point);
    creature.root.worldToLocal(pointerLocalPos);

    if (isPointerOverCreature) {
      // Gentle, smooth pointer velocity on fur (clamped to prevent spikes)
      pointerVelocity.subVectors(pointerLocalPos, prevPointerLocalPos).multiplyScalar(6.0);
      pointerVelocity.clampLength(0.0, 1.5);

      const strokeDist = pointerLocalPos.distanceTo(prevPointerLocalPos);
      const now = performance.now();

      // Reliable rubbing stroke detection:
      // When moving/rubbing the mouse across Mochi's body
      if (strokeDist > 0.002) {
        lastPetStrokeTimestamp = now;
      }
    }
    isPointerOverCreature = true;
    container.style.cursor = 'pointer';
    if (simState.environment === 'ar') {
      envManager.updateARCursor(pointerNDC.x, pointerNDC.y, false);
    }
  } else {
    isPointerOverCreature = false;
    pointerVelocity.multiplyScalar(0.4);
    container.style.cursor = 'grab';
    if (simState.environment === 'ar' && tapToPlaceEnabled) {
      envManager.updateARCursor(pointerNDC.x, pointerNDC.y, true);
    }
  }
});

window.addEventListener('pointerdown', (e) => {
  pointerDownPos.x = e.clientX;
  pointerDownPos.y = e.clientY;
  if (isEventOnUIOverlay(e)) {
    return;
  }
  if (isPointerOverCreature) {
    controls.enabled = false;
  }
});

window.addEventListener('pointerup', (e) => {
  controls.enabled = true;
  const moveDist = Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y);
  if (moveDist < 12) {
    if (isEventOnUIOverlay(e)) {
      return;
    }
    // Verify raycast on exact click location directly against bubbles, bodyMesh, or mini friends
    pointerNDC.x = (e.clientX / window.innerWidth) * 2.0 - 1.0;
    pointerNDC.y = -(e.clientY / window.innerHeight) * 2.0 + 1.0;
    raycaster.setFromCamera(pointerNDC, camera);

    // 1. Check if user tapped/clicked a floating 3D soap bubble to POP it!
    if (creature.bubblesContainer && creature.bubblesContainer.visible && creature.popBubbleMesh) {
      const bubbleHits = raycaster.intersectObject(creature.bubblesContainer, true);
      if (bubbleHits.length > 0 && creature.popBubbleMesh(bubbleHits[0].object)) {
        boopShockwave = 0.65;
        return;
      }
    }

    const hits = raycaster.intersectObject(creature.bodyMesh, false);
    const isDollClicked = hits.length > 0 || isPointerOverCreature;

    // 2. Also check if user clicked one of the 4 mini friends (Chintu, Pintu, Golu, Molu)!
    let isFriendClicked = false;
    if (!isDollClicked && creature.friendsContainer && creature.friendsContainer.visible) {
      const friendHits = raycaster.intersectObject(creature.friendsContainer, true);
      if (friendHits.length > 0) {
        isFriendClicked = true;
      }
    }

    if (isFriendClicked) {
      // Extra high-pitched baby clone squeak + happy bounce!
      playMochiBoopSound(1.38);
      creature.triggerBoop(true);
      boopShockwave = 0.85;
    } else if (isDollClicked) {
      boopShockwave = 1.0;
      const handledVoice = voiceAssistant && voiceAssistant.handleCreatureClick();
      if (!handledVoice) {
        creature.triggerBoop();
      }
    } else if (simState.environment === 'ar' && tapToPlaceEnabled) {
      const planeHit = envManager.estimatePlaneAt(pointerNDC.x, pointerNDC.y);
      if (planeHit && planeHit.point) {
        pointerNDC.set(0, 0);
        creature.placeAt(planeHit.point, planeHit.normal, true, camera.position);
        playMochiBoopSound(1.12);
        envManager.triggerPlacementPulse(planeHit.point);
        if (hudHint) {
          hudHint.textContent = `Placed Mochi on ${planeHit.surfaceType} · Estimated Depth: ${planeHit.depth.toFixed(2)}m (${Math.round(planeHit.confidence * 100)}% conf)`;
        }
      }
    }
  }
});

// 8. Background Keyboard Shortcuts for Actions (Keys 1-9, 0, F/D/V, C/G/H/B) without UI tags
window.addEventListener('keydown', (e) => {
  if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
  const key = e.key.toLowerCase();
  const keyMap = {
    '1': 'dance',
    '2': 'cry',
    '3': 'laugh',
    '4': 'pout',
    '5': 'sleep',
    '6': 'love',
    '7': 'summon_friends',
    '8': 'peekaboo',
    'f': 'feed',
    'd': 'hair_dryer',
    'v': 'bubbles',
    '0': 'stop'
  };
  if (keyMap[key] && voiceAssistant && voiceAssistant.playAction) {
    voiceAssistant.playAction(keyMap[key]);
    return;
  }
  if (key === '9' && creature && creature.setWeatherState) {
    const cur = creature.animState?.weatherMode || 'clear';
    const next = cur === 'clear' ? 'rain' : (cur === 'rain' ? 'umbrella' : 'clear');
    creature.setWeatherState(next);
  } else if (key === 'c' && creature && creature.toggleAccessory) {
    creature.toggleAccessory('crown');
  } else if (key === 'g' && creature && creature.toggleAccessory) {
    creature.toggleAccessory('sunglasses');
  } else if (key === 'h' && creature && creature.toggleAccessory) {
    creature.toggleAccessory('party_hat');
  } else if (key === 'b' && creature && creature.toggleAccessory) {
    creature.toggleAccessory('bowtie');
  }
});

// Dynamic DPR & Mobile 60 FPS Governor (Zero GC)
let targetDPR = Math.min(window.devicePixelRatio || 1, maxDeviceDPR);
let currentDPR = targetDPR;
let isRecordMode = false;
let autoFPSGuard = isMobileDevice; // Enabled automatically on mobile for locked 60 FPS
let lowFpsFrames = 0;
let highFpsFrames = 0;

let wasMobileViewport = isMobileDevice;

// Touch-Drag Dynamic DPR Boost on Mobile: temporarily step down DPR during active touch-orbit
if (isMobileDevice) {
  controls.addEventListener('start', () => {
    if (!isRecordMode && currentDPR > 1.0) {
      renderer.setPixelRatio(Math.max(0.9, currentDPR * 0.82));
    }
  });
  controls.addEventListener('end', () => {
    if (!isRecordMode) {
      renderer.setPixelRatio(currentDPR);
    }
  });
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  const isMobileNow = window.matchMedia('(max-width: 768px)').matches;
  if (furSystem && furSystem.setMobileTier && isMobileNow !== wasMobileViewport) {
    furSystem.setMobileTier(isMobileNow);
  }
  targetDPR = Math.min(window.devicePixelRatio || 1, isMobileNow ? 1.25 : 2.0);
  currentDPR = isRecordMode ? 1.0 : targetDPR;
  renderer.setPixelRatio(currentDPR);
  renderer.setSize(window.innerWidth, window.innerHeight);

  if (isMobileNow || isMobileNow !== wasMobileViewport) {
    wasMobileViewport = isMobileNow;
    applyCameraFramingForEnvironment(simState.environment);
  }
});

// 7. Zero-GC Real-Time Render Loop
const clock = new THREE.Clock();
let elapsedTime = 0.0;
const webglInertiaDisp = new THREE.Vector3(0, 0, 0);
const webglInertiaVel = new THREE.Vector3(0, 0, 0);
const webglForceTmp = new THREE.Vector3(0, 0, 0);

function animate() {
  requestAnimationFrame(animate);

  // Pause GPU work when browser tab is hidden to save mobile battery
  if (document.hidden) {
    clock.getDelta();
    return;
  }

  const dt = Math.min(clock.getDelta(), 0.033);
  elapsedTime += dt;

  // Auto-FPS Guard: Automatically safeguards framerate on mobile or during screen recording
  if (autoFPSGuard && !isRecordMode) {
    if (dt > 0.024) { // frame dropped below ~41 FPS
      lowFpsFrames++;
      highFpsFrames = 0;
      if (lowFpsFrames > 40 && currentDPR > 0.95) {
        currentDPR = 0.95;
        renderer.setPixelRatio(currentDPR);
        lowFpsFrames = 0;
      }
    } else if (dt < 0.018) { // solid 55-60 FPS
      highFpsFrames++;
      if (highFpsFrames > 300 && currentDPR < targetDPR) {
        currentDPR = targetDPR;
        renderer.setPixelRatio(targetDPR);
        highFpsFrames = 0;
      }
    }
  }

  controls.update();

  // Decay boop shockwave
  if (boopShockwave > 0.001) {
    boopShockwave *= Math.exp(-dt * 2.8);
  } else {
    boopShockwave = 0.0;
  }

  // Decay pointer velocity smoothly
  pointerVelocity.multiplyScalar(Math.exp(-dt * 12.0));

  // --------------------------------------------------------------------------
  // Real-Time Timed Rubbing & Inflation System:
  // - 0s to 1.5s: Immediate soft happy purr & cute giggles on first touch!
  // - 1.5s to 4.5s: Hilarious weird cartoon laughter & giggles! ("Aha haha hehehe! Gudgudi ho rahi hai!")
  //   * Cheeks gradually inflate bigger and bigger looking straight forward ("samane hi tak dheere dheere muh kaa size bada le")
  // - 4.5s: Full puffed pout ("Hmph! Main gussa hoon!"), holds 3s looking forward, then deflates!
  // --------------------------------------------------------------------------
  const isActivelyStroking = isPointerOverCreature && (performance.now() - lastPetStrokeTimestamp < 450);

  if (creature && creature.animState) {
    creature.animState.isPetting = isActivelyStroking;
  }

  const isCreatureInPout = creature && creature.isPouting && creature.isPouting();

  if (isCreatureInPout) {
    // Creature is currently holding the 3-second puffed-face pout looking straight at user!
  } else if (isActivelyStroking) {
    petStrokeActiveSeconds += dt;

    if (petStrokeActiveSeconds < 1.5) {
      // Stage 1 (0 to 1.5s): Sweet immediate tickle wiggle & soft chuckles
      if (creature.triggerTickle) {
        creature.triggerTickle(0.35 * dt * 60);
      }
      if (creature.setCheekPuff) {
        creature.setCheekPuff(0.0);
      }
      const now = performance.now();
      if (now - lastSoftGiggleTime > 700) {
        lastSoftGiggleTime = now;
        if (voiceAssistant && voiceAssistant.playSoftPurrGiggleSound) {
          voiceAssistant.playSoftPurrGiggleSound();
        }
      }
    } else if (petStrokeActiveSeconds >= 1.5 && petStrokeActiveSeconds < 4.5) {
      // Stage 2: 1.5s Reached! -> Trigger weird, funny cartoon giggles & sounds!
      if (!hasTriggered5SecLaughter) {
        hasTriggered5SecLaughter = true;
        if (creature.trigger5SecTickle) {
          creature.trigger5SecTickle();
        }
        if (voiceAssistant && voiceAssistant.trigger5SecLaughter) {
          voiceAssistant.trigger5SecLaughter();
        }
      }

      // Stage 3 (2.0s to 4.5s): "samane hi tak dheere dheere muh kaa size bada le"
      if (petStrokeActiveSeconds >= 2.0) {
        const puffProgress = Math.min(1.0, Math.max(0.0, (petStrokeActiveSeconds - 2.0) / 2.5));
        if (creature.setCheekPuff) {
          creature.setCheekPuff(puffProgress);
        }

        // Periodic playful balloon inflation chirp as cheeks swell
        const now = performance.now();
        if (now - lastCheekInflationSoundTime > 850) {
          lastCheekInflationSoundTime = now;
          if (voiceAssistant && voiceAssistant.playInflateStepSound) {
            voiceAssistant.playInflateStepSound(puffProgress);
          }
        }
      }
    } else if (petStrokeActiveSeconds >= 4.5) {
      // Stage 4: 4.5s Reached! -> Full forward-facing puffed pout!
      if (!hasTriggered10SecPout) {
        hasTriggered10SecPout = true;
        if (creature.trigger10SecPout) {
          creature.trigger10SecPout(); // Holds for exactly 3 seconds!
        }
        if (voiceAssistant && voiceAssistant.trigger10SecPoutSpeech) {
          voiceAssistant.trigger10SecPoutSpeech();
        }
      }
    }
  } else {
    // If user paused or stopped petting, smoothly cool down
    if (!hasTriggered10SecPout) {
      petStrokeActiveSeconds = Math.max(0.0, petStrokeActiveSeconds - dt * 2.0);
      const puffProgress = Math.min(1.0, Math.max(0.0, (petStrokeActiveSeconds - 2.0) / 2.5));
      if (creature.setCheekPuff) {
        creature.setCheekPuff(puffProgress);
      }
      if (petStrokeActiveSeconds < 1.2) {
        hasTriggered5SecLaughter = false;
      }
    }
  }

  // Update creature breathing, eye tracking, viewer-facing AR orientation, and bounce inertia
  creature.update(dt, pointerNDC, camera.position, simState.environment === 'ar');

  // Sync cute voice animation state (speaking, listening, volume) with creature
  if (creature && creature.animState) {
    creature.animState.isSpeaking = speechIsSpeaking;
    creature.animState.isListening = voiceAssistant ? voiceAssistant.isListening() : false;
    creature.animState.speechVolume = speechVolume;
  }
  if (speechIsThinking && creature.animState && creature.animState.currentLook) {
    creature.animState.currentLook.x = Math.sin(elapsedTime * 2.8) * 0.24;
  }

  // Update active 3D / AR environment (Studio, Meadow, Cozy Highrise, AR View)
  const dryerBoost = creature.animState?.dryerActive ? 1.85 : 0.0;
  const activeWind = simState.windStrength + dryerBoost;
  envManager.update(elapsedTime, activeWind, creature.root);

  const wetness = creature.animState ? (creature.animState.wetness || 0.0) : 0.0;

  let physicsTexture = gpuPhysics.fallbackTexture;
  if (simState.gpuFurEnabled) {
    // Step GPGPU ping-pong Verlet physics texture (active when GPU Fur is toggled ON)
    physicsTexture = gpuPhysics.step({
      time: elapsedTime,
      dt,
      windStrength: activeWind,
      creatureVelocity: creature.animState.velocity,
      creatureAngularVel: creature.animState.angularVelocity,
      pointerLocalPos,
      pointerVelocity,
      pointerActive: isPointerOverCreature,
      boopShockwave
    });
  } else {
    // Lightweight WebGL analytical spring-damper inertia (Zero GPGPU RTT passes)
    // Wetness makes the fur heavier so it droops downward further in Y; Hair Dryer blows sideways waves
    const dryerWaveX = dryerBoost > 0 ? -0.55 * Math.sin(elapsedTime * 26.0) - 0.35 : 0.0;
    webglForceTmp.set(dryerWaveX, -0.32 - wetness * 0.65, 0);
    webglForceTmp.addScaledVector(creature.animState.velocity, -1.65);
    if (isPointerOverCreature) {
      webglForceTmp.addScaledVector(pointerVelocity, 0.85);
    }
    webglForceTmp.addScaledVector(webglInertiaDisp, -24.0);
    webglInertiaVel.addScaledVector(webglForceTmp, dt);
    webglInertiaVel.multiplyScalar(Math.exp(-5.5 * dt));
    webglInertiaDisp.addScaledVector(webglInertiaVel, dt);
    if (webglInertiaDisp.lengthSq() > 0.64) {
      webglInertiaDisp.normalize().multiplyScalar(0.8);
    }
  }

  // Update shared fur uniforms (including wet heavy fur clumping, glossy sheen, and Hair Dryer fluff!)
  const u = furSystem.sharedUniforms;
  u.uPhysicsTex.value = physicsTexture;
  u.uTime.value = elapsedTime;
  u.uWindStrength.value = activeWind;
  u.uPointerLocalPos.value.copy(pointerLocalPos);
  u.uPointerActive.value = isPointerOverCreature ? 1.0 : 0.0;
  u.uWebGLInertia.value.copy(webglInertiaDisp);
  u.uBoopShockwave.value = boopShockwave;
  if (u.uFurLength) {
    const dryerFluff = dryerBoost > 0 ? 1.12 : 1.0;
    u.uFurLength.value = (simState.furLength || 0.31) * dryerFluff;
  }
  if (u.uSpecular) {
    u.uSpecular.value = (simState.specular || 0.72) * (1.0 + wetness * 0.45);
  }
  if (u.uClumping) {
    u.uClumping.value = Math.min(1.0, (simState.clumping || 0.52) + wetness * 0.35);
  }

  renderer.render(scene, camera);
}

animate();

