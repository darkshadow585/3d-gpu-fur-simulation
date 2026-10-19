import * as THREE from 'three';

/**
 * Evaluates the anatomical follicle growth mask at a local position on the blob surface.
 * Returns a float in [0.0, 1.0]:
 * - 0.0 inside eye sockets and mouth recess (prevents hair from poking through eyes/mouth)
 * - Smoothly tapers (0.2 -> 1.0) around the eye rims, nose bridge, and paw pads
 * - Slightly longer/fluffier (1.15) on the cheek tufts, chest fluff, and ear tips
 */
export function evaluateFollicleMask(x, y, z) {
  // Left and right eye centers in local space
  const lx = x + 0.31;
  const rx = x - 0.31;
  const ey = y - 0.16;
  const ez = z - 0.88;

  const distLeftEye = Math.sqrt(lx * lx + ey * ey * 1.1 + ez * ez);
  const distRightEye = Math.sqrt(rx * rx + ey * ey * 1.1 + ez * ez);
  const minEyeDist = Math.min(distLeftEye, distRightEye);

  // Tightly match the cornea radius (r < 0.148 = 0), then transition immediately
  // into short velvety eyelash/brow fuzz (0.28 -> 1.0) so there is NO bald skin ring!
  if (minEyeDist < 0.145) {
    return 0.0;
  }
  const eyeMask = 0.28 + 0.72 * smoothstep(0.145, 0.25, minEyeDist);

  // Small mask right under the pink nose button & mouth
  const mx = x / 1.25;
  const my = (y - 0.04) * 1.4;
  const mz = z - 0.96;
  const distMouth = Math.sqrt(mx * mx + my * my + mz * mz);
  const mouthMask = 0.22 + 0.78 * smoothstep(0.065, 0.16, distMouth);

  // Bottom belly contact pad taper
  const bottomMask = smoothstep(-1.05, -0.72, y);

  // Extra fluff boost on cheeks and chest tuft
  const cheekDist = Math.min(
    Math.hypot(x + 0.56, y - 0.02, z - 0.68),
    Math.hypot(x - 0.56, y - 0.02, z - 0.68)
  );
  const cheekFluff = 1.0 + 0.22 * (1.0 - smoothstep(0.0, 0.42, cheekDist));

  return Math.max(0.0, Math.min(1.25, eyeMask * mouthMask * bottomMask * cheekFluff));
}

/**
 * Computes the biological grooming flow tangent vector on the blob surface.
 * Hairs part naturally from a crown whorl at the top of the head, sweep around
 * the eye sockets, and flow downward with a subtle cheek/belly swirl.
 */
export function evaluateGroomFlow(x, y, z, nx, ny, nz) {
  // Base gravity/growth direction from crown (0, 1.05, 0.1)
  let fx = x * 0.25;
  let fy = -0.85;
  let fz = (z - 0.15) * 0.25;

  // Sweep tangentially around the left and right eyes like real facial fur
  const eyeCenters = [
    [-0.33, 0.17, 0.86],
    [0.33, 0.17, 0.86]
  ];
  for (let i = 0; i < 2; i++) {
    const [ex, ey, ez] = eyeCenters[i];
    const dx = x - ex;
    const dy = y - ey;
    const dz = z - ez;
    const d = Math.sqrt(dx * dx + dy * dy + dz * dz) + 1e-5;
    if (d < 0.48) {
      const influence = (1.0 - d / 0.48) * 0.85;
      fx += (dx / d) * influence;
      fy += (dy / d) * influence * 0.6;
      fz += (dz / d) * influence * 0.3;
    }
  }

  // Project onto the tangent plane orthogonal to surface normal N
  const dotFN = fx * nx + fy * ny + fz * nz;
  let tx = fx - dotFN * nx;
  let ty = fy - dotFN * ny;
  let tz = fz - dotFN * nz;
  const len = Math.sqrt(tx * tx + ty * ty + tz * tz);
  if (len > 1e-5) {
    tx /= len;
    ty /= len;
    tz /= len;
  } else {
    tx = 1.0;
    ty = 0.0;
    tz = 0.0;
  }
  return [tx, ty, tz];
}

function smoothstep(edge0, edge1, x) {
  const t = Math.max(0.0, Math.min(1.0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3.0 - 2.0 * t);
}

/**
 * Sculpt a unit sphere vertex into our cute "Mochi-Puff" blob creature with
 * chubby pear cheeks, perky ears, stubby side arms, and recessed eye sockets.
 */
function sculptBlobPosition(u, v, w) {
  let x = u;
  let y = v;
  let z = w;

  // 1. Pear/Mochi silhouette: chubby lower cheeks & belly, slightly tapered crown
  const bellyWidth = 1.0 + 0.22 * Math.exp(-Math.pow((y + 0.24) / 0.55, 2.0));
  const cheekPuff = 1.0 + 0.14 * Math.exp(-Math.pow((y + 0.05) / 0.38, 2.0)) * Math.max(0, z);
  x *= bellyWidth * cheekPuff;
  z *= (0.94 + 0.12 * Math.exp(-Math.pow((y + 0.22) / 0.6, 2.0)));
  y *= 0.96;

  // Slightly flatten the base so Mochi-Puff sits cozily on the ground
  if (y < -0.55) {
    const t = (-0.55 - y) / 0.45;
    y = -0.55 - Math.tanh(t * 1.15) * 0.32;
  }

  // 2. Perky sculptural ears on top-left and top-right
  const leftEarDir = normalize3(-0.46, 0.86, 0.06);
  const rightEarDir = normalize3(0.46, 0.86, 0.06);
  const dotLEar = Math.max(0.0, u * leftEarDir[0] + v * leftEarDir[1] + w * leftEarDir[2]);
  const dotREar = Math.max(0.0, u * rightEarDir[0] + v * rightEarDir[1] + w * rightEarDir[2]);
  const earProfile = Math.pow(Math.max(dotLEar, dotREar), 14.0) * 0.44;
  x += u * earProfile * 0.75;
  y += v * earProfile * 1.15;
  z += w * earProfile * 0.55;

  // 3. Cute stubby side nubbins (little arms)
  const leftArmDir = normalize3(-0.94, -0.08, 0.28);
  const rightArmDir = normalize3(0.94, -0.08, 0.28);
  const dotLArm = Math.max(0.0, u * leftArmDir[0] + v * leftArmDir[1] + w * leftArmDir[2]);
  const dotRArm = Math.max(0.0, u * rightArmDir[0] + v * rightArmDir[1] + w * rightArmDir[2]);
  const armProfile = Math.pow(Math.max(dotLArm, dotRArm), 18.0) * 0.24;
  x += u * armProfile * 1.1;
  y += v * armProfile * 0.6;
  z += w * armProfile * 0.9;

  // 4. Subtle anatomical eye socket indentation so the glossy eyes sit nested inside the plush fur
  const lx = x + 0.33;
  const rx = x - 0.33;
  const ey = y - 0.17;
  const ez = z - 0.86;
  const dEye = Math.min(
    Math.sqrt(lx * lx + ey * ey + ez * ez),
    Math.sqrt(rx * rx + ey * ey + ez * ez)
  );
  if (dEye < 0.32) {
    const indent = (1.0 - smoothstep(0.0, 0.32, dEye)) * 0.065;
    z -= indent;
  }

  return [x, y, z];
}

function normalize3(x, y, z) {
  const l = Math.sqrt(x * x + y * y + z * z) || 1.0;
  return [x / l, y / l, z / l];
}

/**
 * Builds the continuous organic blob geometry with baked vertex attributes:
 * - `aFollicleMask`: float [0..1.25] controlling fur length & density mask
 * - `aGroomTangent`: vec3 biological fur flow direction
 */
export function createOrganicBlobGeometry(widthSegments = 96, heightSegments = 72) {
  const geom = new THREE.SphereGeometry(1.0, widthSegments, heightSegments);
  const posAttr = geom.attributes.position;
  const count = posAttr.count;

  for (let i = 0; i < count; i++) {
    const u = posAttr.getX(i);
    const v = posAttr.getY(i);
    const w = posAttr.getZ(i);
    const [sx, sy, sz] = sculptBlobPosition(u, v, w);
    posAttr.setXYZ(i, sx, sy, sz);
  }

  geom.computeVertexNormals();

  const normAttr = geom.attributes.normal;
  const follicleMaskArray = new Float32Array(count);
  const groomTangentArray = new Float32Array(count * 3);

  for (let i = 0; i < count; i++) {
    const x = posAttr.getX(i);
    const y = posAttr.getY(i);
    const z = posAttr.getZ(i);
    const nx = normAttr.getX(i);
    const ny = normAttr.getY(i);
    const nz = normAttr.getZ(i);

    follicleMaskArray[i] = evaluateFollicleMask(x, y, z);
    const [tx, ty, tz] = evaluateGroomFlow(x, y, z, nx, ny, nz);
    groomTangentArray[i * 3] = tx;
    groomTangentArray[i * 3 + 1] = ty;
    groomTangentArray[i * 3 + 2] = tz;
  }

  geom.setAttribute('aFollicleMask', new THREE.BufferAttribute(follicleMaskArray, 1));
  geom.setAttribute('aGroomTangent', new THREE.BufferAttribute(groomTangentArray, 3));

  return geom;
}

/**
 * Creates the complete Stylized Blob Creature group ("Mochi-Puff"):
 * - Base velvety under-skin mesh
 * - Multi-layered glossy 3D eyes with iris, pupil tracking, and dual catchlights
 * - Rosy translucent cheek blush patches
 * - Cute sculpted cat-like smile/mouth & nose bean
 * - Interactive boop/jump & breathing physics state
 */
export function createBlobCreature(options = {}) {
  let onPoutDeflateCallback = options.onPoutDeflate || null;
  const root = new THREE.Group();
  root.name = 'MochiPuffCreature';

  const bodyGeometry = createOrganicBlobGeometry(96, 72);

  // Under-skin velvety material (visible at roots and around eyes/mouth)
  const skinMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#4a3248'),
    roughness: 0.78,
    metalness: 0.02
  });

  const bodyMesh = new THREE.Mesh(bodyGeometry, skinMaterial);
  bodyMesh.name = 'BlobBodyMesh';
  bodyMesh.castShadow = true;
  bodyMesh.receiveShadow = true;
  root.add(bodyMesh);

  // Facial features container so eyes, blush, and nose move with head tilt
  const faceGroup = new THREE.Group();
  faceGroup.name = 'FacialFeatures';
  root.add(faceGroup);

  const eyeMaterial = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#120d1a'),
    roughness: 0.04,
    metalness: 0.05,
    clearcoat: 1.0,
    clearcoatRoughness: 0.03,
    reflectivity: 1.0
  });

  const irisMaterial = new THREE.MeshBasicMaterial({
    color: new THREE.Color('#3d285c')
  });

  const highlightMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color('#ffffff')
  });

  const warmHighlightMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color('#ffe4f2')
  });

  const eyes = [];
  const eyeSides = [-1, 1];

  for (const side of eyeSides) {
    const eyePivot = new THREE.Group();
    eyePivot.position.set(side * 0.31, 0.16, 0.94);
    eyePivot.rotation.y = side * 0.22;
    eyePivot.rotation.x = -0.06;

    // Dark glossy cornea
    const eyeballGeo = new THREE.SphereGeometry(0.17, 32, 24);
    eyeballGeo.scale(0.96, 1.08, 0.68);
    const eyeball = new THREE.Mesh(eyeballGeo, eyeMaterial);
    eyePivot.add(eyeball);

    // Warm violet-amber lower iris crescent
    const irisGeo = new THREE.SphereGeometry(0.12, 24, 16);
    irisGeo.scale(0.92, 0.95, 0.38);
    const iris = new THREE.Mesh(irisGeo, irisMaterial);
    iris.position.set(0, -0.02, 0.086);
    eyePivot.add(iris);

    // Primary large anime catchlight (top-inner)
    const catchlightMainGeo = new THREE.SphereGeometry(0.045, 16, 12);
    catchlightMainGeo.scale(1.0, 1.18, 0.32);
    const catchlightMain = new THREE.Mesh(catchlightMainGeo, highlightMat);
    catchlightMain.position.set(-side * 0.042, 0.052, 0.112);
    eyePivot.add(catchlightMain);

    // Secondary lower rim catchlight
    const catchlightSubGeo = new THREE.SphereGeometry(0.023, 14, 10);
    catchlightSubGeo.scale(1.0, 1.0, 0.32);
    const catchlightSub = new THREE.Mesh(catchlightSubGeo, warmHighlightMat);
    catchlightSub.position.set(side * 0.048, -0.052, 0.11);
    eyePivot.add(catchlightSub);

    faceGroup.add(eyePivot);
    eyes.push({
      pivot: eyePivot,
      basePos: eyePivot.position.clone(),
      catchlightMain,
      catchlightSub,
      side
    });
  }

  // Rosy glowing blush ovals nestled right below the eyes on the plush cheeks
  const blushMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color('#ff5c93'),
    transparent: true,
    opacity: 0.55,
    depthWrite: false
  });

  const blushMeshes = [];
  for (const side of eyeSides) {
    const blushGeo = new THREE.SphereGeometry(0.12, 20, 16);
    blushGeo.scale(1.4, 0.75, 0.35);
    const blush = new THREE.Mesh(blushGeo, blushMat);
    blush.position.set(side * 0.49, 0.0, 0.96);
    blush.rotation.y = side * 0.34;
    blush.rotation.z = -side * 0.1;
    faceGroup.add(blush);
    blushMeshes.push({ mesh: blush, side });
  }

  // Dedicated 3D anatomical cheek bulges for realistic gradual inflation ("muh kaa size bada le")
  const cheekBulgeMeshes = [];
  for (const side of eyeSides) {
    const cheekGeo = new THREE.SphereGeometry(0.18, 22, 18);
    cheekGeo.scale(1.25, 0.95, 0.75);
    const cheekMesh = new THREE.Mesh(cheekGeo, skinMaterial);
    cheekMesh.position.set(side * 0.46, -0.02, 0.88);
    cheekMesh.scale.set(0.001, 0.001, 0.001); // starts flush
    cheekMesh.visible = false;
    faceGroup.add(cheekMesh);
    cheekBulgeMeshes.push({ mesh: cheekMesh, side });
  }

  // Cute bright pink nose button + W-shaped cat smile positioned proudly on the muzzle surface
  const noseMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color('#ff94b8')
  });
  const noseGeo = new THREE.SphereGeometry(0.048, 18, 14);
  noseGeo.scale(1.3, 0.88, 0.75);
  const nose = new THREE.Mesh(noseGeo, noseMat);
  nose.position.set(0, 0.075, 1.05);
  faceGroup.add(nose);

  // Cute W-mouth made from two torus arcs grouped for adorable speech animation
  const mouthGroup = new THREE.Group();
  mouthGroup.name = 'MouthGroup';
  mouthGroup.position.set(0, 0.035, 1.045);
  faceGroup.add(mouthGroup);

  const mouthMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#3a102e') });
  for (const side of [-1, 1]) {
    const arcGeo = new THREE.TorusGeometry(0.046, 0.013, 10, 20, Math.PI * 0.92);
    const arc = new THREE.Mesh(arcGeo, mouthMat);
    arc.position.set(side * 0.043, 0, 0);
    arc.rotation.x = Math.PI + 0.15;
    arc.rotation.y = side * 0.14;
    mouthGroup.add(arc);
  }

  // Animation & physics state for creature motion (coupled to GPGPU fur inertia)
  const animState = {
    time: 0,
    baseScale: 1.0,
    baseX: 0.0,
    baseY: 0.0,
    baseZ: 0.0,
    blinkTimer: 0,
    nextBlink: 2.8,
    boopImpulse: 0,
    boopPhase: 0,
    isSpeaking: false,
    isListening: false,
    speechVolume: 0.0,
    smoothSpeechVolume: 0.0,
    isTickled: false,
    tickleTimer: 0.0,
    tickleIntensity: 0.0,
    isPouting: false,
    poutHoldTimer: 0.0,
    cheekPuff: 0.0,
    targetCheekPuff: 0.0,
    isPetting: false,
    activeAction: null,
    actionTimer: 0.0,
    prevPosition: new THREE.Vector3(),
    velocity: new THREE.Vector3(),
    angularVelocity: new THREE.Vector3(),
    targetLook: new THREE.Vector2(0, 0),
    currentLook: new THREE.Vector2(0, 0)
  };

  // Spatial anchor position & viewer-facing orientation for AR plane placement
  const anchorPos = new THREE.Vector3(0, 0, 0);
  const targetAnchorPos = new THREE.Vector3(0, 0, 0);
  const startAnchorPos = new THREE.Vector3(0, 0, 0);
  let isPlaced = false;
  let isPlacing = false;
  let placeProgress = 1.0;
  let placeHopHeight = 0.0;
  let facingYaw = 0.0;
  let facingPitch = 0.0;
  let targetFacingYaw = 0.0;
  let targetFacingPitch = 0.0;
  let faceViewerHoldTimer = 0.0;

  function placeAt(targetWorldPos, normal, animate = true, cameraPos = null) {
    if (!targetWorldPos) return;
    isPlaced = true;
    const s = animState.baseScale;
    // targetWorldPos is the point on the detected plane surface.
    // Mochi's paws sit flush on the plane when center Y is targetWorldPos.y + 0.94 * s
    const targetCenterY = targetWorldPos.y + 0.94 * s;

    // Reset gaze offset so Mochi looks straight at the viewer instead of toward the tap edge
    animState.targetLook.set(0, 0);
    animState.currentLook.set(0, 0);
    faceViewerHoldTimer = 1.4;

    if (cameraPos) {
      const dx = cameraPos.x - targetWorldPos.x;
      const dy = cameraPos.y - targetCenterY;
      const dz = cameraPos.z - targetWorldPos.z;
      const horizDist = Math.max(0.001, Math.hypot(dx, dz));
      targetFacingYaw = Math.atan2(dx, dz);
      targetFacingPitch = -Math.atan2(dy, horizDist) * 0.72;
      if (!animate) {
        facingYaw = targetFacingYaw;
        facingPitch = targetFacingPitch;
      }
    }

    if (animate) {
      startAnchorPos.copy(anchorPos);
      targetAnchorPos.set(targetWorldPos.x, targetCenterY, targetWorldPos.z);
      placeProgress = 0.0;
      isPlacing = true;
      placeHopHeight = Math.min(0.65, Math.max(0.18, startAnchorPos.distanceTo(targetAnchorPos) * 0.22));
      animState.boopImpulse = 0.85;
      animState.boopPhase = 0.0;
    } else {
      anchorPos.set(targetWorldPos.x, targetCenterY, targetWorldPos.z);
      targetAnchorPos.copy(anchorPos);
      isPlacing = false;
      placeProgress = 1.0;
    }
  }

  function resetPlacement(animate = true) {
    isPlaced = false;
    targetFacingYaw = 0.0;
    targetFacingPitch = 0.0;
    faceViewerHoldTimer = 0.0;
    animState.targetLook.set(0, 0);
    animState.currentLook.set(0, 0);
    const s = animState.baseScale;
    const ox = animState.baseX || 0.0;
    const oz = animState.baseZ || 0.0;
    const targetY = -0.94 + 0.94 * s;
    if (animate) {
      startAnchorPos.copy(anchorPos);
      targetAnchorPos.set(ox, targetY, oz);
      placeProgress = 0.0;
      isPlacing = true;
      placeHopHeight = Math.min(0.55, Math.max(0.18, startAnchorPos.distanceTo(targetAnchorPos) * 0.22));
      animState.boopImpulse = 0.85;
      animState.boopPhase = 0.0;
    } else {
      anchorPos.set(ox, targetY, oz);
      targetAnchorPos.set(ox, targetY, oz);
      startAnchorPos.set(ox, targetY, oz);
      facingYaw = 0.0;
      facingPitch = 0.0;
      isPlacing = false;
      placeProgress = 1.0;
      animState.boopImpulse = 0.0;
      animState.boopPhase = 0.0;
    }
  }

  function setEnvironmentScale(scale, offsetX = 0.0, offsetZ = 0.0) {
    const s = Number.isFinite(scale) && scale > 0 ? scale : 1.0;
    const ox = Number.isFinite(offsetX) ? offsetX : 0.0;
    const oz = Number.isFinite(offsetZ) ? offsetZ : 0.0;
    animState.baseScale = s;
    animState.baseX = ox;
    animState.baseY = -0.94 * (1.0 - s);
    animState.baseZ = oz;
    if (!isPlaced) {
      anchorPos.set(ox, -0.94 + 0.94 * s, oz);
      targetAnchorPos.copy(anchorPos);
      startAnchorPos.copy(anchorPos);
      facingYaw = 0.0;
      facingPitch = 0.0;
      targetFacingYaw = 0.0;
      targetFacingPitch = 0.0;
    }
  }

  function triggerBoop() {
    animState.boopImpulse = 1.0;
    animState.boopPhase = 0.0;
  }

  function triggerTickle(intensity = 0.5) {
    if (animState.isPouting) return;
    animState.isTickled = true;
    animState.tickleTimer = 1.5;
    animState.tickleIntensity = Math.min(1.4, animState.tickleIntensity + intensity);
  }

  function trigger5SecTickle() {
    if (animState.isPouting) return;
    animState.isTickled = true;
    animState.tickleTimer = 2.5;
    animState.tickleIntensity = 1.8;
    animState.boopImpulse = 0.65; // Playful happy giggly bounce
  }

  function setCheekPuff(progress) {
    if (animState.isPouting) return;
    animState.targetCheekPuff = Math.max(0.0, Math.min(1.0, progress));
  }

  function trigger10SecPout() {
    animState.isPouting = true;
    animState.poutHoldTimer = 3.0; // Holds for exactly 3 seconds as requested!
    animState.targetCheekPuff = 1.0;
    animState.isTickled = false;
    animState.tickleTimer = 0.0;
    animState.boopImpulse = 0.45; // Indignant cute puff jump
  }

  function playAction(action, duration = 3.5) {
    animState.activeAction = action;
    animState.actionTimer = duration;
    switch (action) {
      case 'dance':
        animState.boopImpulse = 0.85;
        animState.isPouting = false;
        animState.targetCheekPuff = 0.0;
        break;
      case 'cry':
        animState.boopImpulse = 0.0;
        animState.isPouting = false;
        animState.targetCheekPuff = 0.0;
        break;
      case 'laugh':
        trigger5SecTickle();
        break;
      case 'pout':
        trigger10SecPout();
        break;
      case 'sleep':
        animState.boopImpulse = 0.0;
        animState.targetCheekPuff = 0.0;
        animState.isPouting = false;
        break;
      case 'love':
        animState.boopImpulse = 0.8;
        animState.isPouting = false;
        animState.targetCheekPuff = 0.0;
        break;
      case 'shake_fur':
        animState.boopImpulse = 0.65;
        animState.angularVelocity.y += 26.0;
        break;
    }
  }

  function update(dt, pointerNDC, cameraPos = null, isARMode = false) {
    const safeDt = Math.min(Math.max(dt, 0.001), 0.05);
    animState.time += safeDt;

    if (faceViewerHoldTimer > 0) {
      faceViewerHoldTimer = Math.max(0, faceViewerHoldTimer - safeDt);
    }

    // Direct interaction check: When stroking, pouting, or cheeks puffed, face user straight on ("samane hi tak")
    const isDirectInteraction = animState.isPetting || animState.isPouting || animState.cheekPuff > 0.04 || faceViewerHoldTimer > 0;
    if (isDirectInteraction) {
      // Keep gaze and head facing strictly forward towards camera/user
      animState.targetLook.set(0, 0);
    } else if (pointerNDC) {
      // Very subtle, gentle gaze tracking when idle so Mochi stays facing the user ("samane hi tak")
      animState.targetLook.set(pointerNDC.x * 0.05, pointerNDC.y * 0.035);
    }
    animState.currentLook.lerp(animState.targetLook, Math.min(1.0, safeDt * 8.0));

    // Breathing & happy idle bobbing + boop jump impulse
    if (animState.boopImpulse > 0.001) {
      animState.boopPhase += safeDt * 14.0;
      animState.boopImpulse *= Math.exp(-safeDt * 3.6);
    } else {
      animState.boopImpulse = 0.0;
    }

    // Parabolic placement leap towards target anchor plane
    let hop = 0.0;
    if (isPlacing) {
      placeProgress += safeDt * 3.4;
      if (placeProgress >= 1.0) {
        placeProgress = 1.0;
        isPlacing = false;
        anchorPos.copy(targetAnchorPos);
        triggerBoop(); // Playful squash & fur recoil on landing
      } else {
        const p = placeProgress;
        anchorPos.lerpVectors(startAnchorPos, targetAnchorPos, p);
        hop = Math.sin(p * Math.PI) * placeHopHeight;
      }
    }

    // When placed in AR mode, keep Mochi's front face oriented directly towards the viewer (camera)
    if ((isPlaced || isARMode) && cameraPos) {
      const dx = cameraPos.x - anchorPos.x;
      const dy = cameraPos.y - anchorPos.y;
      const dz = cameraPos.z - anchorPos.z;
      const horizDist = Math.max(0.001, Math.hypot(dx, dz));
      targetFacingYaw = Math.atan2(dx, dz);
      targetFacingPitch = -Math.atan2(dy, horizDist) * 0.72;
    } else if (!isPlaced) {
      targetFacingYaw = 0.0;
      targetFacingPitch = 0.0;
    }

    const yawDiff = Math.atan2(Math.sin(targetFacingYaw - facingYaw), Math.cos(targetFacingYaw - facingYaw));
    facingYaw += yawDiff * Math.min(1.0, safeDt * 12.0);
    facingPitch += (targetFacingPitch - facingPitch) * Math.min(1.0, safeDt * 12.0);

    // Tickle decay & pout hold timer
    if (animState.tickleTimer > 0) {
      animState.tickleTimer -= safeDt;
      animState.isTickled = true;
      animState.tickleIntensity *= Math.exp(-safeDt * 2.0);
    } else {
      animState.isTickled = false;
      animState.tickleIntensity = 0.0;
    }

    // 10-Second Pout Hold Countdown (Exactly 3 seconds, then return to normal!)
    if (animState.isPouting) {
      animState.targetCheekPuff = 1.0;
      if (animState.poutHoldTimer > 0) {
        animState.poutHoldTimer -= safeDt;
        if (animState.poutHoldTimer <= 0) {
          // Exactly 3 seconds hold expired -> Deflate back to normal!
          animState.poutHoldTimer = 0.0;
          animState.isPouting = false;
          animState.targetCheekPuff = 0.0;
          animState.boopImpulse = 0.35; // Cute relief bounce
          if (typeof onPoutDeflateCallback === 'function') {
            onPoutDeflateCallback();
          }
        }
      }
    }

    // Action timer countdown
    if (animState.actionTimer > 0) {
      animState.actionTimer -= safeDt;
      if (animState.actionTimer <= 0) {
        animState.actionTimer = 0.0;
        animState.activeAction = null;
      }
    }
    const act = animState.activeAction;
    const s = animState.baseScale;

    // Action-specific animated offsets:
    let actHop = 0.0;
    let actSway = 0.0;
    let actTilt = 0.0;
    let actSquash = 0.0;
    let actDroopX = 0.0;
    let actLeanZ = 0.0;

    if (act === 'dance') {
      const dTime = animState.time * 11.5;
      actHop = Math.abs(Math.sin(dTime)) * 0.15 * s;
      actSway = Math.sin(dTime * 0.5) * 0.16 * s;
      actTilt = Math.sin(dTime * 0.5) * 0.28;
      actSquash = Math.sin(dTime) * 0.11;
    } else if (act === 'cry') {
      actHop = -0.06 * s;
      actSway = Math.sin(animState.time * 36.0) * 0.014 * s; // Sad quivering shiver
      actDroopX = 0.14; // Sad drooping head
      actSquash = -0.07;
    } else if (act === 'sleep') {
      actHop = -0.04 * s + Math.sin(animState.time * 1.5) * 0.02 * s;
      actTilt = 0.12;
      actSquash = Math.sin(animState.time * 1.5) * 0.05;
    } else if (act === 'love') {
      actHop = Math.abs(Math.sin(animState.time * 13.0)) * 0.09 * s;
      actLeanZ = 0.09 * s;
      actTilt = Math.sin(animState.time * 5.0) * 0.08;
    }

    // Smooth cheek puff interpolation ("dheere dheere muh kaa size bada le")
    const puffLerpSpeed = animState.targetCheekPuff > animState.cheekPuff ? 2.6 : 3.8;
    animState.cheekPuff += (animState.targetCheekPuff - animState.cheekPuff) * Math.min(1.0, safeDt * puffLerpSpeed);
    const puff = animState.cheekPuff;
    const tickle = animState.tickleIntensity;

    // Tickle squish & cute giggle wiggle
    const tickleWiggle = Math.sin(animState.time * 28.0) * 0.07 * tickle;
    const tickleSquash = Math.sin(animState.time * 22.0) * 0.08 * tickle;

    // Smooth conversational speech volume (replaces jerky high-frequency jolts with adorable lifelike cadence)
    const targetVol = animState.isSpeaking ? Math.min(1.0, animState.speechVolume * 1.5) : 0.0;
    animState.smoothSpeechVolume += (targetVol - animState.smoothSpeechVolume) * Math.min(1.0, safeDt * 10.0);
    const talkVol = animState.smoothSpeechVolume;

    // Cute voice motions:
    // 1. Gentle rhythmic conversational head nod while talking (sweet, expressive, Pixar-style)
    const talkNod = Math.sin(animState.time * 6.5) * 0.042 * talkVol;
    // 2. Cute subtle head sway/tilt while speaking
    const talkTilt = Math.sin(animState.time * 3.25) * 0.032 * talkVol;
    // 3. Attentive puppy head tilt when listening to user
    const listenTilt = (animState.isListening && !animState.isSpeaking && puff < 0.1) ? 0.08 : 0.0;
    // 4. Tiny soft vertical conversational bounce (soft, smooth, 0.015m)
    const talkBounce = (Math.sin(animState.time * 6.5) * 0.018 + 0.012) * talkVol * s;
    // 5. Soft vocal breathing pulse
    const talkSquash = Math.sin(animState.time * 6.5) * 0.025 * talkVol;

    const breath = Math.sin(animState.time * 2.3) * 0.035;
    const bodyLookScale = (isPlaced || isARMode) ? (faceViewerHoldTimer > 0 ? 0.0 : 0.06) : 0.06;
    const swayX = (Math.sin(animState.time * 1.35) * 0.05 + animState.currentLook.x * 0.12 * bodyLookScale + tickleWiggle) * s + actSway;
    const jumpY =
      (Math.sin(animState.time * 2.3) * 0.045 +
        Math.abs(Math.sin(animState.boopPhase)) * animState.boopImpulse * 0.32) *
        s + talkBounce + (Math.abs(Math.sin(animState.time * 15.0)) * 0.025 * tickle) * s + actHop;

    const squash =
      1.0 +
      breath +
      talkSquash +
      tickleSquash +
      actSquash +
      Math.cos(animState.boopPhase * 2.0) * animState.boopImpulse * 0.14 -
      puff * 0.03;

    const prevX = root.position.x;
    const prevY = root.position.y;
    const prevZ = root.position.z;
    const prevRotZ = root.rotation.z;
    const prevRotY = root.rotation.y;

    root.position.set(
      anchorPos.x + swayX,
      anchorPos.y + jumpY + hop,
      anchorPos.z + actLeanZ
    );

    // Body expands wider and rounder like a puffed-up hamster / mochi ("muh kaa size bada le")
    const bodyPuffX = 1.0 + puff * 0.18;
    const bodyPuffZ = 1.0 + puff * 0.15;
    const bodyPuffY = 1.0 - puff * 0.03;
    root.scale.set(
      (1.0 / Math.sqrt(squash)) * s * bodyPuffX,
      squash * s * bodyPuffY,
      (1.0 / Math.sqrt(squash)) * s * bodyPuffZ
    );

    // SAMANE HI TAK (LOOK STRAIGHT AT THE VIEWER - NO SIDEWAYS YAW TURN AT ALL!)
    const lookScale = isDirectInteraction ? 0.0 : bodyLookScale;
    root.rotation.y = facingYaw + animState.currentLook.x * 0.14 * lookScale + Math.sin(animState.time * 0.9) * 0.02 * (isDirectInteraction ? 0.0 : 1.0);
    root.rotation.x = facingPitch - animState.currentLook.y * 0.1 * lookScale + Math.cos(animState.time * 1.8) * 0.015 * (isDirectInteraction ? 0.0 : 1.0) + talkNod - puff * 0.035 + actDroopX;
    root.rotation.z = -(swayX / s) * 0.18 * (isDirectInteraction ? 0.2 : 1.0) + talkTilt + listenTilt + actTilt;

    // Compute instantaneous creature velocity & angular velocity for GPGPU fur inertia
    animState.velocity.set(
      (root.position.x - prevX) / (safeDt * s),
      (root.position.y - prevY) / (safeDt * s),
      (root.position.z - prevZ) / (safeDt * s)
    );
    animState.angularVelocity.set(
      0,
      (root.rotation.y - prevRotY) / safeDt,
      (root.rotation.z - prevRotZ) / safeDt
    );

    // Blinking and happy smiling eyes
    animState.blinkTimer += safeDt;
    let blinkScaleY = 1.0;
    if (animState.blinkTimer > animState.nextBlink) {
      const blinkProgress = (animState.blinkTimer - animState.nextBlink) / 0.16;
      if (blinkProgress < 1.0) {
        blinkScaleY = Math.max(0.08, Math.abs(Math.cos(blinkProgress * Math.PI)));
      } else {
        animState.blinkTimer = 0;
        animState.nextBlink = 2.4 + Math.random() * 2.5;
      }
    }
    if (animState.boopImpulse > 0.25) {
      blinkScaleY = Math.min(blinkScaleY, 0.18);
    }

    // Expressions:
    if (act === 'sleep') {
      blinkScaleY = 0.04; // Peaceful eyes closed in sleep
    } else if (act === 'cry') {
      blinkScaleY = 0.22; // Sad tearful eyes
    } else if (act === 'dance' || act === 'laugh' || tickle > 0.08) {
      // Laughing squint eyes!
      blinkScaleY = Math.min(blinkScaleY, Math.max(0.12, 0.5 - tickle * 0.5));
    } else if (act === 'love') {
      blinkScaleY = 1.15; // Wide loving sparkling eyes!
    } else if (puff > 0.1) {
      // Pouting chubby face: cute narrowed eyes looking straight at the user!
      blinkScaleY = Math.min(blinkScaleY, 0.42);
    } else if (talkVol > 0.06) {
      // Joyful crescent smile eye squint when talking happily!
      const smileSquint = Math.max(0.32, 1.0 - talkVol * 0.68);
      blinkScaleY = Math.min(blinkScaleY, smileSquint);
    } else if (animState.isListening && !animState.isSpeaking) {
      // Attentive wide bright eyes when listening to user
      blinkScaleY = Math.min(1.15, blinkScaleY * 1.06);
    }

    // Update anatomical 3D cheek bulges ("dheere dheere muh kaa size bada le")
    for (const c of cheekBulgeMeshes) {
      if (puff > 0.01) {
        c.mesh.visible = true;
        c.mesh.scale.set(
          0.001 + puff * 1.15,
          0.001 + puff * 0.95,
          0.001 + puff * 0.85
        );
        c.mesh.position.set(
          c.side * (0.46 + puff * 0.1),
          -0.02 + puff * 0.025,
          0.88 + puff * 0.08
        );
      } else {
        c.mesh.visible = false;
      }
    }

    // Rosy cheek blush ovals scale and push forward with the puffed cheeks
    for (const b of blushMeshes) {
      const puffScaleX = 1.4 * (1.0 + puff * 1.25 + tickle * 0.25);
      const puffScaleY = 0.75 * (1.0 + puff * 1.35 + tickle * 0.2);
      const puffScaleZ = 0.35 * (1.0 + puff * 1.75 + tickle * 0.35);
      b.mesh.scale.set(puffScaleX, puffScaleY, puffScaleZ);
      b.mesh.position.set(
        b.side * (0.49 + puff * 0.14),
        puff * 0.04,
        0.96 + puff * 0.09
      );
    }

    // Rosy cheek blush glows warmer or changes color with emotions!
    if (act === 'love') {
      blushMat.color.set('#ff206a');
      blushMat.opacity = 0.98;
    } else if (act === 'cry') {
      blushMat.color.set('#ff94b8');
      blushMat.opacity = 0.35;
    } else {
      blushMat.color.set('#ff5c93');
      blushMat.opacity = Math.min(0.96, 0.52 + talkVol * 0.3 + tickle * 0.4 + puff * 0.44);
    }

    // Cute cat mouth pulses with speech, turns into chubby upside-down pout lips, or cries!
    if (mouthGroup) {
      if (act === 'cry') {
        mouthGroup.scale.set(0.85, -0.65, 1.0);
        mouthGroup.position.set(0, 0.018, 1.045);
      } else if (act === 'love') {
        mouthGroup.scale.set(1.25, 0.65, 1.0);
        mouthGroup.position.set(0, 0.04, 1.055);
      } else if (puff > 0.05) {
        // Chubby upside-down cat pout lips pushing forward
        mouthGroup.scale.set(
          (1.0 + talkVol * 0.15) * (1.0 - puff * 0.32),
          -(1.0 + talkVol * 0.2) * (0.42 + puff * 0.65),
          1.0 + puff * 0.4
        );
        mouthGroup.position.set(0, 0.035 - puff * 0.028, 1.045 + puff * 0.05);
      } else {
        mouthGroup.scale.set(
          1.0 + talkVol * 0.28 + tickle * 0.35,
          1.0 + talkVol * 0.55 + tickle * 0.45,
          1.0
        );
        mouthGroup.position.set(0, 0.035 - talkVol * 0.016, 1.045);
      }
    }

    for (const eye of eyes) {
      eye.pivot.scale.y = blinkScaleY;
      // When pouting or interacting, eyes look straight into the user's eyes!
      const eyeLookOffsetX = puff > 0.08 ? -eye.side * 0.02 : -eye.side * 0.042 + animState.currentLook.x * 0.028;
      eye.catchlightMain.position.x = eyeLookOffsetX;
      eye.catchlightMain.position.y = 0.052 + animState.currentLook.y * 0.025;
    }
  }

  return {
    root,
    bodyMesh,
    bodyGeometry,
    skinMaterial,
    animState,
    setEnvironmentScale,
    triggerBoop,
    triggerTickle,
    trigger5SecTickle,
    setCheekPuff,
    trigger10SecPout,
    triggerPout: trigger10SecPout,
    playAction,
    isPouting: () => animState.isPouting,
    isTickled: () => animState.isTickled,
    getPoutHoldTime: () => animState.poutHoldTimer,
    setOnPoutDeflate: (cb) => { onPoutDeflateCallback = cb; },
    placeAt,
    resetPlacement,
    isPlaced: () => isPlaced,
    getAnchorPosition: () => anchorPos,
    update
  };
}
