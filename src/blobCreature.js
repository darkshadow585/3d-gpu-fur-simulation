import * as THREE from 'three';
import {
  playMochiBoopSound,
  playMochiGiggleSound,
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
  playBubblePopSound,
  playRoyalFanfareSound,
  playSpearClashSound,
  playSoldierCheerSound,
  playMagicSpellSound,
  playCameraShutterSound,
  playGuitarConcertSound,
  playDholBeatSound,
  playCloneUniqueSound,
  playBallKickSound,
  playScoldShockSound,
  playHologramProjectSound,
  playChalkBoardWriteSound,
  playVivaMedalSound,
  playVivaRoastBuzzerSound,
  getActiveVocalEnvelope,
  setGlobalEmotionPitchMultiplier
} from './soundEffects.js';
import { createEmotionEngine } from './emotionEngine.js';

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
  let onFriendsMischiefCallback = options.onFriendsMischief || null;
  let onWetShakeCallback = options.onWetShake || null;
  let onCloneClickCallback = options.onCloneClick || null;
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

    // 3D Heart Pupil inside the eye for 'love' emotion ("love me ho to bahut cute akhe ho")
    const heartShape = new THREE.Shape();
    heartShape.moveTo(0, 0.015);
    heartShape.bezierCurveTo(0, 0.032, -0.028, 0.045, -0.042, 0.025);
    heartShape.bezierCurveTo(-0.058, 0.002, -0.032, -0.028, 0, -0.052);
    heartShape.bezierCurveTo(0.032, -0.028, 0.058, 0.002, 0.042, 0.025);
    heartShape.bezierCurveTo(0.028, 0.045, 0, 0.032, 0, 0.015);

    const heartPupilGeo = new THREE.ShapeGeometry(heartShape, 12);
    const heartPupilMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color('#ff4d94'),
      side: THREE.DoubleSide
    });
    const heartPupil = new THREE.Mesh(heartPupilGeo, heartPupilMat);
    heartPupil.position.set(0, -0.005, 0.116);
    heartPupil.visible = false;
    eyePivot.add(heartPupil);

    // Extra kawaii sparkle star catchlights for 'love' eyes
    const sparkleGeo = new THREE.SphereGeometry(0.018, 10, 8);
    sparkleGeo.scale(1.0, 1.0, 0.3);
    const sparkle1 = new THREE.Mesh(sparkleGeo, highlightMat);
    sparkle1.position.set(side * 0.052, 0.045, 0.115);
    sparkle1.visible = false;
    eyePivot.add(sparkle1);

    // Glossy 3D Anime Watery Tear Pool + Cheek Tear Stream + Big Teardrops outside fur ("aansu iske sahi se banao")
    const tearMat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#bae6fd'),
      emissive: new THREE.Color('#38bdf8'),
      emissiveIntensity: 0.72,
      roughness: 0.02,
      metalness: 0.05,
      transmission: 0.45,
      transparent: true,
      opacity: 0.96,
      clearcoat: 1.0
    });

    // Big shimmering welling pool along lower eyelid (pushed forward to z=0.145 so fur never hides it)
    const tearPoolGeo = new THREE.SphereGeometry(0.064, 18, 14);
    tearPoolGeo.scale(2.45, 0.78, 0.96);
    const tearPool = new THREE.Mesh(tearPoolGeo, tearMat);
    tearPool.position.set(0, -0.095, 0.145);
    tearPool.visible = false;
    eyePivot.add(tearPool);

    // Glistening white highlight bead on the welling tear pool
    const poolGlint = new THREE.Mesh(new THREE.SphereGeometry(0.022, 10, 8), highlightMat);
    poolGlint.scale.set(1.6, 0.6, 0.5);
    poolGlint.position.set(-side * 0.04, 0.015, 0.05);
    tearPool.add(poolGlint);

    // Continuous 3D anime cheek tear ribbon outside the fur shells (z = 1.13)
    const streamGeo = new THREE.CylinderGeometry(0.026, 0.042, 0.44, 12);
    streamGeo.scale(1.0, 1.0, 0.55);
    const tearStream = new THREE.Mesh(streamGeo, tearMat);
    tearStream.position.set(side * 0.34, -0.14, 1.13);
    tearStream.rotation.z = side * 0.14;
    tearStream.rotation.x = 0.16;
    tearStream.visible = false;
    faceGroup.add(tearStream);

    // 3 Oversized 3D Anime Teardrops per eye with specular highlight dots rolling outside the fur!
    const tearDrops = [];
    for (let t = 0; t < 3; t++) {
      const dropGroup = new THREE.Group();
      const dropGeo = new THREE.SphereGeometry(0.058, 16, 14);
      dropGeo.scale(0.88, 1.55, 0.85);
      const dropMesh = new THREE.Mesh(dropGeo, tearMat);
      dropGroup.add(dropMesh);

      // Tiny white anime highlight on each falling teardrop
      const dropGlint = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 8), highlightMat);
      dropGlint.position.set(-side * 0.016, 0.022, 0.046);
      dropGroup.add(dropGlint);

      // Ground splash ring when the teardrop hits the floor
      const splashGeo = new THREE.RingGeometry(0.03, 0.068, 18);
      const splashMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color('#7dd3fc'),
        transparent: true,
        opacity: 0.85,
        side: THREE.DoubleSide
      });
      const splashMesh = new THREE.Mesh(splashGeo, splashMat);
      splashMesh.rotation.x = -Math.PI * 0.5;
      splashMesh.visible = false;
      faceGroup.add(splashMesh);

      dropGroup.visible = false;
      faceGroup.add(dropGroup);
      tearDrops.push({
        mesh: dropGroup,
        splashMesh,
        splashMat,
        phase: (t / 3) + (side > 0 ? 0.16 : 0.0),
        side
      });
    }

    faceGroup.add(eyePivot);
    eyes.push({
      pivot: eyePivot,
      basePos: eyePivot.position.clone(),
      eyeball,
      iris,
      catchlightMain,
      catchlightSub,
      heartPupil,
      sparkle1,
      tearPool,
      tearStream,
      tearDrops,
      side
    });
  }

  // Floating 3D Hearts around Mochi's head when in 'love' mode
  const floatingHeartsGroup = new THREE.Group();
  floatingHeartsGroup.name = 'FloatingLoveHearts';
  root.add(floatingHeartsGroup);

  const floatHeartShape = new THREE.Shape();
  floatHeartShape.moveTo(0, 0.03);
  floatHeartShape.bezierCurveTo(0, 0.065, -0.055, 0.09, -0.085, 0.05);
  floatHeartShape.bezierCurveTo(-0.115, 0.005, -0.065, -0.055, 0, -0.105);
  floatHeartShape.bezierCurveTo(0.065, -0.055, 0.115, 0.005, 0.085, 0.05);
  floatHeartShape.bezierCurveTo(0.055, 0.09, 0, 0.065, 0, 0.03);

  const floatHeartGeo = new THREE.ExtrudeGeometry(floatHeartShape, {
    depth: 0.025,
    bevelEnabled: true,
    bevelSegments: 3,
    steps: 1,
    bevelSize: 0.012,
    bevelThickness: 0.012
  });
  floatHeartGeo.center();

  const floatHeartMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#ff2e8b'),
    emissive: new THREE.Color('#ff1476'),
    emissiveIntensity: 0.45,
    roughness: 0.25,
    metalness: 0.1
  });

  const floatingHearts = [];
  for (let h = 0; h < 6; h++) {
    const hMesh = new THREE.Mesh(floatHeartGeo, floatHeartMat);
    hMesh.visible = false;
    floatingHeartsGroup.add(hMesh);
    floatingHearts.push({
      mesh: hMesh,
      angleOffset: (h / 6) * Math.PI * 2,
      speed: 1.6 + (h % 3) * 0.35,
      radius: 0.95 + (h % 2) * 0.22,
      phase: h * 0.18
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
    cheekMesh.scale.set(0.001, 0.001, 0.001);
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

  // =========================================================================
  // 2. 3D DRESS-UP & ACCESSORIES (Crown, Party Hat, Bowtie, Cool Sunglasses)
  // =========================================================================
  const accessoriesGroup = new THREE.Group();
  accessoriesGroup.name = 'MochiAccessories';
  root.add(accessoriesGroup);

  // (A) Cute Royal Gold Crown with Ruby/Sapphire Gems ("Crown lagao" / "Taj pehno")
  const crownGroup = new THREE.Group();
  crownGroup.position.set(0, 0.96, 0.06);
  crownGroup.rotation.x = -0.08;
  crownGroup.visible = false;
  const goldMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#fbbf24'),
    emissive: new THREE.Color('#b45309'),
    emissiveIntensity: 0.2,
    roughness: 0.18,
    metalness: 0.88
  });
  const crownBase = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.24, 0.14, 24), goldMat);
  crownGroup.add(crownBase);

  const rubyMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#ff1e56'),
    emissive: new THREE.Color('#be123c'),
    emissiveIntensity: 0.35,
    roughness: 0.05,
    clearcoat: 1.0
  });
  const cyanGemMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#38bdf8'),
    emissive: new THREE.Color('#0284c7'),
    emissiveIntensity: 0.35,
    roughness: 0.05,
    clearcoat: 1.0
  });

  const spikeCount = 6;
  for (let i = 0; i < spikeCount; i++) {
    const ang = (i / spikeCount) * Math.PI * 2;
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.18, 12), goldMat);
    spike.position.set(Math.sin(ang) * 0.24, 0.15, Math.cos(ang) * 0.24);
    crownGroup.add(spike);

    const pearl = new THREE.Mesh(new THREE.SphereGeometry(0.032, 12, 10), i % 2 === 0 ? rubyMat : cyanGemMat);
    pearl.position.set(Math.sin(ang) * 0.24, 0.24, Math.cos(ang) * 0.24);
    crownGroup.add(pearl);

    const rimGem = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 10), i % 2 === 0 ? cyanGemMat : rubyMat);
    rimGem.position.set(Math.sin(ang) * 0.265, 0.0, Math.cos(ang) * 0.265);
    crownGroup.add(rimGem);
  }
  accessoriesGroup.add(crownGroup);

  // (B) Colorful Festive Party Hat ("Party hat pehno" / "Topi lagao")
  const partyHatGroup = new THREE.Group();
  partyHatGroup.position.set(0, 1.02, 0.05);
  partyHatGroup.rotation.z = -0.1;
  partyHatGroup.visible = false;
  const hatConeMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#ec4899'),
    roughness: 0.35,
    metalness: 0.1
  });
  const hatCone = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.56, 24), hatConeMat);
  hatCone.position.y = 0.16;
  partyHatGroup.add(hatCone);

  const pomMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#fef08a'),
    emissive: new THREE.Color('#facc15'),
    emissiveIntensity: 0.25,
    roughness: 0.9
  });
  const pomPom = new THREE.Mesh(new THREE.SphereGeometry(0.085, 16, 14), pomMat);
  pomPom.position.y = 0.45;
  partyHatGroup.add(pomPom);

  const hatTrim = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.038, 12, 24), pomMat);
  hatTrim.rotation.x = Math.PI * 0.5;
  hatTrim.position.y = -0.11;
  partyHatGroup.add(hatTrim);
  accessoriesGroup.add(partyHatGroup);

  // (C) Cute Red Silk Bowtie ("Bowtie pehno" / "Tie lagao")
  const bowtieGroup = new THREE.Group();
  bowtieGroup.position.set(0, -0.24, 1.02);
  bowtieGroup.rotation.x = 0.12;
  bowtieGroup.visible = false;
  const bowMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#f43f5e'),
    emissive: new THREE.Color('#9f1239'),
    emissiveIntensity: 0.2,
    roughness: 0.35
  });
  const bowKnot = new THREE.Mesh(new THREE.SphereGeometry(0.065, 14, 12), bowMat);
  bowKnot.scale.set(1.0, 1.1, 0.75);
  bowtieGroup.add(bowKnot);

  for (const side of [-1, 1]) {
    const wingGeo = new THREE.ConeGeometry(0.14, 0.24, 16);
    const wing = new THREE.Mesh(wingGeo, bowMat);
    wing.rotation.z = side * Math.PI * 0.5;
    wing.scale.set(1.0, 1.0, 0.48);
    wing.position.set(side * 0.13, 0, -0.01);
    bowtieGroup.add(wing);
  }
  accessoriesGroup.add(bowtieGroup);

  // (D) Cool Stylish Sunglasses ("Chashma pehno" / "Sunglasses lagao")
  const glassesGroup = new THREE.Group();
  glassesGroup.position.set(0, 0.18, 1.04);
  glassesGroup.visible = false;
  const frameMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#ff2e93'),
    roughness: 0.2,
    metalness: 0.3
  });
  const lensMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#090d16'),
    roughness: 0.05,
    metalness: 0.85,
    clearcoat: 1.0
  });

  // Bridge between lenses
  const bridge = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.24, 10), frameMat);
  bridge.rotation.z = Math.PI * 0.5;
  bridge.position.set(0, 0.04, 0.02);
  glassesGroup.add(bridge);

  for (const side of [-1, 1]) {
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.185, 0.028, 12, 24), frameMat);
    rim.position.set(side * 0.31, 0, 0);
    rim.rotation.y = side * 0.18;
    glassesGroup.add(rim);

    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.175, 24), lensMat);
    lens.position.set(side * 0.31, 0, 0.008);
    lens.rotation.y = side * 0.18;
    glassesGroup.add(lens);

    // Glossy lens shine bar
    const shine = new THREE.Mesh(
      new THREE.PlaneGeometry(0.04, 0.18),
      new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.55 })
    );
    shine.position.set(side * 0.31 - 0.05, 0.02, 0.016);
    shine.rotation.y = side * 0.18;
    shine.rotation.z = -0.45;
    glassesGroup.add(shine);
  }
  accessoriesGroup.add(glassesGroup);

  // (E) Funny Handlebar Mustache ("Moochh lagao" / Selfie Funny Prop)
  const mustacheGroup = new THREE.Group();
  mustacheGroup.position.set(0, 0.052, 1.08);
  mustacheGroup.visible = false;
  const mustacheMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#27171c'),
    roughness: 0.55,
    metalness: 0.08
  });
  for (const side of [-1, 1]) {
    const mainCurl = new THREE.Mesh(
      new THREE.TorusGeometry(0.11, 0.036, 12, 24, Math.PI * 0.85),
      mustacheMat
    );
    mainCurl.position.set(side * 0.105, -0.01, 0);
    mainCurl.rotation.z = side > 0 ? Math.PI * 0.12 : Math.PI * 0.03;
    mainCurl.scale.set(1.15, 0.78, 0.65);
    mustacheGroup.add(mainCurl);

    const tipCurl = new THREE.Mesh(
      new THREE.SphereGeometry(0.032, 10, 8),
      mustacheMat
    );
    tipCurl.position.set(side * 0.215, 0.025, 0.01);
    mustacheGroup.add(tipCurl);
  }
  accessoriesGroup.add(mustacheGroup);

  // =========================================================================
  // 3. INTERACTIVE WEATHER: 3D RAIN & CUTE UMBRELLA ("Baarish kar do" / "Chhata")
  // =========================================================================
  const umbrellaGroup = new THREE.Group();
  umbrellaGroup.name = 'CuteUmbrella';
  umbrellaGroup.position.set(0.68, 0.55, 0.35);
  umbrellaGroup.rotation.z = -0.14;
  umbrellaGroup.rotation.x = 0.08;
  umbrellaGroup.visible = false;
  root.add(umbrellaGroup);

  const shaftMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#fef08a'),
    roughness: 0.25,
    metalness: 0.6
  });
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 1.45, 12), shaftMat);
  shaft.position.y = 0.22;
  umbrellaGroup.add(shaft);

  // Curved J-hook umbrella handle
  const handleHook = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.025, 10, 18, Math.PI), rubyMat);
  handleHook.rotation.x = Math.PI;
  handleHook.position.set(-0.075, -0.5, 0);
  umbrellaGroup.add(handleHook);

  // Colorful pastel dome canopy
  const canopyMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#38bdf8'),
    emissive: new THREE.Color('#0284c7'),
    emissiveIntensity: 0.18,
    roughness: 0.3,
    side: THREE.DoubleSide
  });
  const canopyGeo = new THREE.SphereGeometry(0.88, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.44);
  const canopy = new THREE.Mesh(canopyGeo, canopyMat);
  canopy.position.y = 0.12;
  umbrellaGroup.add(canopy);

  const topTip = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.14, 12), shaftMat);
  topTip.position.y = 1.04;
  umbrellaGroup.add(topTip);

  // 3D Raindrop Particle System (World-relative around Mochi)
  const rainContainer = new THREE.Group();
  rainContainer.name = 'RainWeatherSystem';
  rainContainer.visible = false;

  const RAIN_COUNT = 120;
  const rainDropGeo = new THREE.CylinderGeometry(0.008, 0.016, 0.26, 6);
  const rainDropMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color('#bae6fd'),
    transparent: true,
    opacity: 0.72
  });
  const rainDrops = [];
  for (let r = 0; r < RAIN_COUNT; r++) {
    const rMesh = new THREE.Mesh(rainDropGeo, rainDropMat);
    const rx = (Math.random() - 0.5) * 4.8;
    const ry = Math.random() * 3.8 - 1.0;
    const rz = (Math.random() - 0.5) * 3.6;
    rMesh.position.set(rx, ry, rz);
    rainContainer.add(rMesh);
    rainDrops.push({
      mesh: rMesh,
      baseX: rx,
      baseZ: rz,
      speed: 4.2 + Math.random() * 2.2,
      phase: Math.random()
    });
  }

  // =========================================================================
  // 4. PEEK-A-BOO PAWS ("Chhup jao" / "Peek-a-boo!")
  // =========================================================================
  const peekPawsGroup = new THREE.Group();
  peekPawsGroup.name = 'PeekABooPaws';
  faceGroup.add(peekPawsGroup);

  const pawPadMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff94b8') });
  const peekPaws = [];
  for (const side of [-1, 1]) {
    const pawGroup = new THREE.Group();
    const pawGeo = new THREE.SphereGeometry(0.21, 20, 16);
    pawGeo.scale(1.15, 0.92, 0.68);
    const pawMesh = new THREE.Mesh(pawGeo, skinMaterial);
    pawGroup.add(pawMesh);

    // Cute pink toe beans on the paw!
    const mainBean = new THREE.Mesh(new THREE.SphereGeometry(0.065, 12, 10), pawPadMat);
    mainBean.scale.set(1.2, 0.9, 0.4);
    mainBean.position.set(0, -0.02, -0.12);
    pawGroup.add(mainBean);

    for (let b = -1; b <= 1; b++) {
      const toeBean = new THREE.Mesh(new THREE.SphereGeometry(0.032, 10, 8), pawPadMat);
      toeBean.scale.set(1.0, 1.1, 0.4);
      toeBean.position.set(b * 0.065, 0.065 - Math.abs(b) * 0.018, -0.12);
      pawGroup.add(toeBean);
    }

    pawGroup.position.set(side * 0.85, -0.18, 0.55);
    pawGroup.visible = false;
    peekPawsGroup.add(pawGroup);
    peekPaws.push({ group: pawGroup, side, progress: 0.0 });
  }

  // =========================================================================
  // 5. 3D STRAWBERRY SHORTCAKE TREAT ("Khana khilao" / "Cake khao" / Key F)
  // =========================================================================
  const treatGroup = new THREE.Group();
  treatGroup.name = 'StrawberryCakeTreat';
  treatGroup.position.set(0, -0.12, 1.32);
  treatGroup.visible = false;
  root.add(treatGroup);

  const cakeSpongeMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#fef3c7'),
    roughness: 0.65
  });
  const cakeFrostingMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#fff1f2'),
    roughness: 0.35
  });
  const pinkJamMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#fb7185'),
    roughness: 0.3
  });
  const berryRedMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#e11d48'),
    emissive: new THREE.Color('#9f1239'),
    emissiveIntensity: 0.25,
    roughness: 0.15,
    clearcoat: 1.0
  });
  const leafGreenMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#22c55e'),
    roughness: 0.4
  });

  // Cute pastel plate
  const plateMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.28, 0.22, 0.03, 24),
    new THREE.MeshStandardMaterial({ color: '#f8fafc', roughness: 0.2 })
  );
  plateMesh.position.y = -0.12;
  treatGroup.add(plateMesh);

  const cakeBodyGroup = new THREE.Group();
  treatGroup.add(cakeBodyGroup);

  const spongeBase = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.21, 0.16, 24), cakeSpongeMat);
  spongeBase.position.y = -0.02;
  cakeBodyGroup.add(spongeBase);

  const jamLayer = new THREE.Mesh(new THREE.CylinderGeometry(0.215, 0.215, 0.035, 24), pinkJamMat);
  jamLayer.position.y = -0.01;
  cakeBodyGroup.add(jamLayer);

  const frostingTop = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.215, 0.06, 24), cakeFrostingMat);
  frostingTop.position.y = 0.06;
  cakeBodyGroup.add(frostingTop);

  // Whipped cream puffs around top rim
  for (let c = 0; c < 6; c++) {
    const ang = (c / 6) * Math.PI * 2;
    const creamPuff = new THREE.Mesh(new THREE.SphereGeometry(0.042, 12, 10), cakeFrostingMat);
    creamPuff.position.set(Math.cos(ang) * 0.14, 0.1, Math.sin(ang) * 0.14);
    cakeBodyGroup.add(creamPuff);
  }

  // Glossy 3D Strawberry on top
  const berryMesh = new THREE.Mesh(new THREE.ConeGeometry(0.068, 0.13, 16), berryRedMat);
  berryMesh.position.y = 0.15;
  cakeBodyGroup.add(berryMesh);

  const berryLeaf = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.01, 0.02, 6), leafGreenMat);
  berryLeaf.position.y = 0.095;
  cakeBodyGroup.add(berryLeaf);

  // =========================================================================
  // 6. 3D SALON HAIR DRYER ("Hair dryer chalao" / "Baal sukhao" / Key D)
  // =========================================================================
  const dryerGroup = new THREE.Group();
  dryerGroup.name = 'SalonHairDryer';
  dryerGroup.position.set(1.15, 0.35, 0.75);
  dryerGroup.visible = false;
  root.add(dryerGroup);

  const dryerPinkMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#f472b6'),
    roughness: 0.2,
    metalness: 0.25,
    clearcoat: 0.8
  });
  const dryerNozzleMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#38bdf8'),
    roughness: 0.25,
    metalness: 0.5
  });

  // Dryer barrel pointing toward Mochi
  const dryerBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.34, 20), dryerPinkMat);
  dryerBarrel.rotation.z = Math.PI * 0.5;
  dryerGroup.add(dryerBarrel);

  // Dryer concentrator nozzle facing Mochi (-X)
  const dryerNozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.11, 0.12, 18), dryerNozzleMat);
  dryerNozzle.rotation.z = Math.PI * 0.5;
  dryerNozzle.position.x = -0.21;
  dryerGroup.add(dryerNozzle);

  // Dryer handle
  const dryerHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.042, 0.28, 14), dryerPinkMat);
  dryerHandle.position.set(0.06, -0.2, 0);
  dryerHandle.rotation.z = 0.22;
  dryerGroup.add(dryerHandle);

  // 3 Animated Air-Wave Rings shooting out of the nozzle toward Mochi's fur!
  const dryerAirRings = [];
  const airRingGeo = new THREE.RingGeometry(0.06, 0.095, 20);
  for (let w = 0; w < 3; w++) {
    const airMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color('#7dd3fc'),
      transparent: true,
      opacity: 0.65,
      side: THREE.DoubleSide
    });
    const rMesh = new THREE.Mesh(airRingGeo, airMat);
    rMesh.rotation.y = Math.PI * 0.5;
    dryerGroup.add(rMesh);
    dryerAirRings.push({ mesh: rMesh, mat: airMat, phase: w / 3 });
  }

  // =========================================================================
  // 7. 3D FLOATING IRIDESCENT SOAP BUBBLES ("Bubbles udao" / Key V / Tap to Pop!)
  // =========================================================================
  const bubblesContainer = new THREE.Group();
  bubblesContainer.name = 'FloatingSoapBubbles';
  bubblesContainer.visible = false;

  const BUBBLE_COUNT = 14;
  const bubbleGeo = new THREE.SphereGeometry(0.145, 20, 16);
  const bubbleGlintGeo = new THREE.SphereGeometry(0.032, 10, 8);
  const bubbleColors = ['#38bdf8', '#f472b6', '#a78bfa', '#4ade80', '#fde047'];
  const bubbleItems = [];

  for (let b = 0; b < BUBBLE_COUNT; b++) {
    const bCol = bubbleColors[b % bubbleColors.length];
    const bMat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#e0f2fe'),
      emissive: new THREE.Color(bCol),
      emissiveIntensity: 0.45,
      roughness: 0.03,
      metalness: 0.1,
      transmission: 0.72,
      transparent: true,
      opacity: 0.68,
      clearcoat: 1.0
    });
    const bMesh = new THREE.Mesh(bubbleGeo, bMat);
    bMesh.userData.bubbleIndex = b;

    const bGlint = new THREE.Mesh(bubbleGlintGeo, highlightMat);
    bGlint.position.set(-0.05, 0.06, 0.12);
    bMesh.add(bGlint);

    const angle = (b / BUBBLE_COUNT) * Math.PI * 2;
    const radius = 1.05 + (b % 3) * 0.48;
    bMesh.position.set(Math.cos(angle) * radius, (b % 5) * 0.45 - 0.6, Math.sin(angle) * radius * 0.7 + 0.35);
    bubblesContainer.add(bMesh);

    bubbleItems.push({
      mesh: bMesh,
      angle,
      radius,
      yOffset: (b / BUBBLE_COUNT) * 2.6 - 0.8,
      speed: 0.55 + (b % 4) * 0.18,
      scale: 0.65 + (b % 3) * 0.25,
      poppedTimer: 0.0
    });
  }

  // =========================================================================
  // 1. MINI FRIEND CLONES ("Chintu, Pintu, Golu, Molu, Bholu" + 3D Play Ball + Scold Line-Up!)
  // =========================================================================
  const friendsContainer = new THREE.Group();
  friendsContainer.name = 'MochiMiniFriends';
  friendsContainer.visible = false;

  const miniBodyGeo = createOrganicBlobGeometry(44, 32);
  // Each clone has a distinct playful interaction on click and rotating cute voice lines!
  const FRIEND_CONFIGS = [
    {
      name: 'Chintu',
      title: 'Somersault Champ',
      interactionType: 'somersault',
      baseColor: '#d97706',
      tipColor: '#fef08a',
      blushColor: '#fb7185',
      offsetX: -1.92,
      offsetZ: 0.15,
      scale: 0.33,
      yaw: 0.42,
      phaseOffset: 0.0,
      replies: [
        'Yuhu! Main Chintu hoon! Dekho meri hawa me double somersault kalabazi! Kyaaa!',
        'Hehehe! Chintu sabse tez bhaagta hai! Ball idhar pass karo na!',
        'Oye hoye! Dekha Chintu ka front flip? Olympic gold medal pakka!'
      ]
    },
    {
      name: 'Pintu',
      title: 'Tornado Spinner',
      interactionType: 'tornado_spin',
      baseColor: '#2563eb',
      tipColor: '#a5f3fc',
      blushColor: '#f472b6',
      offsetX: 1.92,
      offsetZ: 0.15,
      scale: 0.34,
      yaw: -0.42,
      phaseOffset: 1.5,
      replies: [
        'Weeee! Main Pintu hoon! Dekho mera super-fast helicopter tornado spin! Chakkar aa gaya!',
        'Haha! Pintu ko pakadna mushkil hi nahi namumkin hai! Ghoom-ghoom-ghoom!',
        'Yay! Dekho main lattu ki tarah gol-gol ghoom ke ball kick karta hoon!'
      ]
    },
    {
      name: 'Golu',
      title: 'Belly Bouncer',
      interactionType: 'belly_bounce',
      baseColor: '#15803d',
      tipColor: '#bbf7d0',
      blushColor: '#fda4af',
      offsetX: -1.18,
      offsetZ: 1.18,
      scale: 0.29,
      yaw: 0.28,
      phaseOffset: 3.1,
      replies: [
        'Boing-boing! Main Golu-Molu sa Golu hoon! Dekho mera cute jelly tummy bounce!',
        'Hehehe! Gudgudi mat karo, mera gol-matol pet rasgulle jaisa uchhal raha hai!',
        'Aww! Main chhota Golu hoon par ball ko sabse door kick karta hoon!'
      ]
    },
    {
      name: 'Molu',
      title: 'Cartwheel Acrobat',
      interactionType: 'cartwheel',
      baseColor: '#7e22ce',
      tipColor: '#f5d0fe',
      blushColor: '#ff5c93',
      offsetX: 1.18,
      offsetZ: 1.18,
      scale: 0.31,
      yaw: -0.28,
      phaseOffset: 4.6,
      replies: [
        'Ta-da! Main Molu hoon! Dekho meri side-to-side cartwheel roll! Kaisi lagi?',
        'Kyaaa! Molu ki barrel roll dekh ke sab taali bajate hain! Hee-hee!',
        'Oho! Ball mere paas aayi! Dekho mera stylish cartwheel pass!'
      ]
    },
    {
      name: 'Bholu',
      title: 'Backflip Rascal',
      interactionType: 'backflip',
      baseColor: '#db2777',
      tipColor: '#fbcfe8',
      blushColor: '#ff1e74',
      offsetX: 0.0,
      offsetZ: 1.42,
      scale: 0.33,
      yaw: 0.0,
      phaseOffset: 2.3,
      replies: [
        'Hihihi! Naam Bholu hai par main sabse bada shararti hoon! Dekho mera backflip!',
        'Yay! Bholu ki ulto-pulto backflip! Ab ball meri baari hai!',
        'Aww! Main sabse pyara Bholu clone hoon, mujhe daatna mat warna aankhen badi kar lunga!'
      ]
    }
  ];

  // Shared materials for clone shocked "O" mouths (when scolded!)
  const cloneShockMouthMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#2b0922') });
  const cloneShockTongueMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff6b9d') });

  const miniFriends = [];
  for (let i = 0; i < FRIEND_CONFIGS.length; i++) {
    const cfg = FRIEND_CONFIGS[i];
    const fGroup = new THREE.Group();
    fGroup.name = `MiniFriend_${cfg.name}`;
    fGroup.userData.cloneIndex = i;

    const fSkinMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(cfg.baseColor),
      roughness: 0.65,
      metalness: 0.04
    });
    const fBody = new THREE.Mesh(miniBodyGeo, fSkinMat);
    fBody.castShadow = true;
    fBody.receiveShadow = true;
    fBody.userData.cloneIndex = i;
    fGroup.add(fBody);

    for (let sh = 1; sh <= 4; sh++) {
      const frac = sh / 4;
      const shellCol = new THREE.Color(cfg.baseColor).lerp(new THREE.Color(cfg.tipColor), frac);
      const shMat = new THREE.MeshStandardMaterial({
        color: shellCol,
        emissive: shellCol,
        emissiveIntensity: 0.12 * frac,
        roughness: 0.85,
        transparent: true,
        opacity: 0.52 * (1.0 - frac * 0.55),
        depthWrite: false
      });
      const shMesh = new THREE.Mesh(miniBodyGeo, shMat);
      shMesh.userData.cloneIndex = i;
      const sFactor = 1.0 + frac * 0.14;
      shMesh.scale.set(sFactor, sFactor, sFactor);
      fGroup.add(shMesh);
    }

    const fEyes = [];
    for (const side of [-1, 1]) {
      const fEyePivot = new THREE.Group();
      fEyePivot.position.set(side * 0.31, 0.16, 0.94);
      fEyePivot.rotation.y = side * 0.22;
      fEyePivot.rotation.x = -0.06;

      const fEyeballGeo = new THREE.SphereGeometry(0.175, 20, 16);
      fEyeballGeo.scale(0.96, 1.08, 0.68);
      const fEyeball = new THREE.Mesh(fEyeballGeo, eyeMaterial);
      fEyeball.userData.cloneIndex = i;
      fEyePivot.add(fEyeball);

      const fCatchGeo = new THREE.SphereGeometry(0.052, 12, 10);
      fCatchGeo.scale(1.0, 1.18, 0.32);
      const fCatch = new THREE.Mesh(fCatchGeo, highlightMat);
      fCatch.position.set(-side * 0.042, 0.052, 0.115);
      fEyePivot.add(fCatch);

      const fSubCatchGeo = new THREE.SphereGeometry(0.026, 10, 8);
      fSubCatchGeo.scale(1.0, 1.0, 0.32);
      const fSubCatch = new THREE.Mesh(fSubCatchGeo, warmHighlightMat);
      fSubCatch.position.set(side * 0.048, -0.052, 0.112);
      fEyePivot.add(fSubCatch);

      fGroup.add(fEyePivot);
      fEyes.push(fEyePivot);
    }

    const fBlushMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(cfg.blushColor),
      transparent: true,
      opacity: 0.65,
      depthWrite: false
    });
    for (const side of [-1, 1]) {
      const fBlushGeo = new THREE.SphereGeometry(0.13, 14, 10);
      fBlushGeo.scale(1.4, 0.75, 0.35);
      const fBlush = new THREE.Mesh(fBlushGeo, fBlushMat);
      fBlush.position.set(side * 0.49, 0.0, 0.97);
      fBlush.rotation.y = side * 0.34;
      fGroup.add(fBlush);
    }

    const fNose = new THREE.Mesh(noseGeo, noseMat);
    fNose.position.set(0, 0.075, 1.06);
    fGroup.add(fNose);

    const fMouth = mouthGroup.clone();
    fMouth.position.set(0, 0.035, 1.055);
    const fSmileArcs = [...fMouth.children];

    // Add 3D Shocked/Wide-Open "O" Mouth inside fMouth ("muh and akhe badi karake")
    const fOpenMouth = new THREE.Group();
    fOpenMouth.position.set(0, -0.055, 0.025);
    fOpenMouth.visible = false;

    const cavityGeo = new THREE.SphereGeometry(0.085, 16, 14);
    cavityGeo.scale(1.15, 1.38, 0.45);
    const cavityMesh = new THREE.Mesh(cavityGeo, cloneShockMouthMat);
    fOpenMouth.add(cavityMesh);

    const tongueGeo = new THREE.SphereGeometry(0.052, 12, 10);
    tongueGeo.scale(1.1, 0.72, 0.48);
    const tongueMesh = new THREE.Mesh(tongueGeo, cloneShockTongueMat);
    tongueMesh.position.set(0, -0.038, 0.018);
    fOpenMouth.add(tongueMesh);

    fMouth.add(fOpenMouth);
    fGroup.add(fMouth);

    fGroup.scale.set(0.001, 0.001, 0.001);
    friendsContainer.add(fGroup);
    miniFriends.push({
      group: fGroup,
      eyes: fEyes,
      mouth: fMouth,
      smileArcs: fSmileArcs,
      openMouth: fOpenMouth,
      cfg,
      spawnProgress: 0.0,
      runOffsetX: cfg.offsetX * 0.5,
      runOffsetZ: cfg.offsetZ * 0.5,
      boostTimer: 0.0,
      boostDuration: 1.5,
      activeTrick: cfg.interactionType,
      replyCursor: 0
    });
  }

  // =========================================================================
  // 1B. 3D COLORFUL PLAY BALL FOR MOCHI CLONES ("isme ball bhi banao")
  // =========================================================================
  const cloneBallGroup = new THREE.Group();
  cloneBallGroup.name = 'MochiClonesPlayBall';
  const cloneBallMesh = new THREE.Group();
  cloneBallMesh.userData.isCloneBall = true;

  const ballRadius = 0.24;
  const ballCoreMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#ffffff'),
    roughness: 0.15,
    metalness: 0.05,
    clearcoat: 0.9
  });
  const ballCore = new THREE.Mesh(new THREE.SphereGeometry(ballRadius, 28, 24), ballCoreMat);
  ballCore.castShadow = true;
  ballCore.receiveShadow = true;
  ballCore.userData.isCloneBall = true;
  cloneBallMesh.add(ballCore);

  // Colorful intersecting beach/soccer stripes (Coral Pink, Electric Cyan, Sunny Gold)
  const ballBandColors = ['#ff2a85', '#00bbf9', '#fee440'];
  for (let b = 0; b < 3; b++) {
    const bandMat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(ballBandColors[b]),
      emissive: new THREE.Color(ballBandColors[b]),
      emissiveIntensity: 0.18,
      roughness: 0.18,
      clearcoat: 0.85
    });
    const band = new THREE.Mesh(new THREE.TorusGeometry(ballRadius * 0.985, 0.042, 12, 32), bandMat);
    band.userData.isCloneBall = true;
    if (b === 0) band.rotation.x = Math.PI * 0.5;
    if (b === 1) band.rotation.y = Math.PI * 0.5;
    cloneBallMesh.add(band);
  }
  cloneBallGroup.add(cloneBallMesh);

  // Soft ground shadow under the bouncing 3D ball
  const ballShadowMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color('#0f172a'),
    transparent: true,
    opacity: 0.28,
    depthWrite: false
  });
  const cloneBallShadow = new THREE.Mesh(new THREE.CircleGeometry(ballRadius * 1.05, 24), ballShadowMat);
  cloneBallShadow.rotation.x = -Math.PI * 0.5;
  cloneBallGroup.add(cloneBallShadow);
  friendsContainer.add(cloneBallGroup);

  // =========================================================================
  // 4C. CUTE MINI ROYAL SOLDIERS ("भाला सैनिक" — King Mode & Duel/Fight)
  // =========================================================================
  const soldiersContainer = new THREE.Group();
  soldiersContainer.name = 'MochiRoyalSoldiers';
  soldiersContainer.visible = false;

  const SOLDIER_CONFIGS = [
    {
      name: 'Veer',
      side: -1, // Left Front
      baseColor: '#be123c', // Crimson Armor
      tipColor: '#fda4af',
      blushColor: '#ff70a6',
      helmetColor: '#fbbf24',
      plumeColor: '#ef4444',
      offsetX: -1.45,
      offsetZ: 0.28,
      scale: 0.32,
      yaw: 0.38,
      phaseOffset: 0.0
    },
    {
      name: 'Sheru',
      side: -1, // Left Rear
      baseColor: '#1d4ed8', // Royal Blue Armor
      tipColor: '#93c5fd',
      blushColor: '#f472b6',
      helmetColor: '#fbbf24',
      plumeColor: '#3b82f6',
      offsetX: -1.90,
      offsetZ: -0.22,
      scale: 0.30,
      yaw: 0.28,
      phaseOffset: 1.2
    },
    {
      name: 'Bahadur',
      side: 1, // Right Front
      baseColor: '#047857', // Emerald Armor
      tipColor: '#6ee7b7',
      blushColor: '#fb7185',
      helmetColor: '#fbbf24',
      plumeColor: '#10b981',
      offsetX: 1.45,
      offsetZ: 0.28,
      scale: 0.32,
      yaw: -0.38,
      phaseOffset: 2.4
    },
    {
      name: 'Toofan',
      side: 1, // Right Rear
      baseColor: '#6d28d9', // Royal Purple Armor
      tipColor: '#c4b5fd',
      blushColor: '#f472b6',
      helmetColor: '#fbbf24',
      plumeColor: '#8b5cf6',
      offsetX: 1.90,
      offsetZ: -0.22,
      scale: 0.30,
      yaw: -0.28,
      phaseOffset: 3.6
    }
  ];

  const silverBladeMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#f1f5f9'),
    roughness: 0.12,
    metalness: 0.95
  });
  const woodShaftMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#78350f'),
    roughness: 0.72,
    metalness: 0.05
  });
  const redTasselMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#ef4444'),
    roughness: 0.6
  });

  const royalSoldiers = [];
  for (let i = 0; i < SOLDIER_CONFIGS.length; i++) {
    const cfg = SOLDIER_CONFIGS[i];
    const sGroup = new THREE.Group();
    sGroup.name = `RoyalSoldier_${cfg.name}`;

    // Body
    const sSkinMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(cfg.baseColor),
      roughness: 0.65,
      metalness: 0.08
    });
    const sBody = new THREE.Mesh(miniBodyGeo, sSkinMat);
    sBody.castShadow = true;
    sBody.receiveShadow = true;
    sGroup.add(sBody);

    // Fluffy shells
    for (let sh = 1; sh <= 3; sh++) {
      const frac = sh / 3;
      const shellCol = new THREE.Color(cfg.baseColor).lerp(new THREE.Color(cfg.tipColor), frac);
      const shMat = new THREE.MeshStandardMaterial({
        color: shellCol,
        emissive: shellCol,
        emissiveIntensity: 0.14 * frac,
        roughness: 0.85,
        transparent: true,
        opacity: 0.55 * (1.0 - frac * 0.5),
        depthWrite: false
      });
      const shMesh = new THREE.Mesh(miniBodyGeo, shMat);
      const sFactor = 1.0 + frac * 0.13;
      shMesh.scale.set(sFactor, sFactor, sFactor);
      sGroup.add(shMesh);
    }

    // Kawaii Eyes
    const sEyes = [];
    for (const side of [-1, 1]) {
      const sEyePivot = new THREE.Group();
      sEyePivot.position.set(side * 0.31, 0.16, 0.94);
      sEyePivot.rotation.y = side * 0.22;
      sEyePivot.rotation.x = -0.06;

      const sEyeballGeo = new THREE.SphereGeometry(0.175, 18, 14);
      sEyeballGeo.scale(0.96, 1.08, 0.68);
      const sEyeball = new THREE.Mesh(sEyeballGeo, eyeMaterial);
      sEyePivot.add(sEyeball);

      const sCatch = new THREE.Mesh(new THREE.SphereGeometry(0.052, 12, 10), highlightMat);
      sCatch.position.set(-side * 0.042, 0.052, 0.115);
      sEyePivot.add(sCatch);

      sGroup.add(sEyePivot);
      sEyes.push(sEyePivot);
    }

    // Blush
    const sBlushMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(cfg.blushColor),
      transparent: true,
      opacity: 0.72,
      depthWrite: false
    });
    for (const side of [-1, 1]) {
      const sBlush = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 8), sBlushMat);
      sBlush.scale.set(1.4, 0.75, 0.35);
      sBlush.position.set(side * 0.49, 0.0, 0.97);
      sBlush.rotation.y = side * 0.34;
      sGroup.add(sBlush);
    }

    // Nose & Mouth
    const sNose = new THREE.Mesh(noseGeo, noseMat);
    sNose.position.set(0, 0.075, 1.06);
    sGroup.add(sNose);

    const sMouth = mouthGroup.clone();
    sMouth.position.set(0, 0.035, 1.055);
    sGroup.add(sMouth);

    // =======================================================================
    // Golden Soldier Helmet with Plumed Crest
    // =======================================================================
    const helmetGroup = new THREE.Group();
    helmetGroup.position.set(0, 0.42, 0.06);

    const helmetDome = new THREE.Mesh(
      new THREE.SphereGeometry(0.48, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.62),
      goldMat
    );
    helmetGroup.add(helmetDome);

    const helmetRim = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.035, 8, 24), goldMat);
    helmetRim.position.set(0, -0.06, 0);
    helmetRim.rotation.x = Math.PI / 2;
    helmetGroup.add(helmetRim);

    // Feather Plume on Top
    const plumeMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(cfg.plumeColor),
      roughness: 0.45
    });
    const plume = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.34, 10), plumeMat);
    plume.position.set(0, 0.38, -0.04);
    plume.rotation.z = -0.15;
    helmetGroup.add(plume);

    sGroup.add(helmetGroup);

    // =======================================================================
    // Royal Spear ("भाला" held in hand)
    // =======================================================================
    const spearPivot = new THREE.Group();
    spearPivot.position.set(0.42 * cfg.side, -0.08, 0.45);

    // Spear Shaft
    const spearShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 1.48, 12), woodShaftMat);
    spearShaft.position.set(0, 0.48, 0);
    spearPivot.add(spearShaft);

    // Spear Collar (Gold)
    const spearCollar = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, 0.045, 12), goldMat);
    spearCollar.position.set(0, 1.18, 0);
    spearPivot.add(spearCollar);

    // Silk Tassel
    const spearTassel = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.14, 8), redTasselMat);
    spearTassel.position.set(0, 1.14, 0);
    spearTassel.rotation.x = Math.PI;
    spearPivot.add(spearTassel);

    // Spearhead Blade (Shiny Silver Diamond Cone)
    const spearHead = new THREE.Mesh(new THREE.ConeGeometry(0.082, 0.32, 4), silverBladeMat);
    spearHead.position.set(0, 1.34, 0);
    spearHead.rotation.y = Math.PI / 4;
    spearPivot.add(spearHead);

    // Little cute soldier hand gripping the spear
    const handPaw = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), sSkinMat);
    handPaw.position.set(0, 0.15, 0);
    spearPivot.add(handPaw);

    sGroup.add(spearPivot);

    // =======================================================================
    // Royal Buckler Shield ("ढाल" on opposite side)
    // =======================================================================
    const shieldPivot = new THREE.Group();
    shieldPivot.position.set(-0.44 * cfg.side, -0.08, 0.45);

    const shieldPlateMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(cfg.baseColor),
      roughness: 0.35,
      metalness: 0.45
    });
    const shieldPlate = new THREE.Mesh(new THREE.CylinderGeometry(0.20, 0.20, 0.025, 24), shieldPlateMat);
    shieldPlate.rotation.x = Math.PI / 2;
    shieldPivot.add(shieldPlate);

    const shieldRim = new THREE.Mesh(new THREE.TorusGeometry(0.20, 0.025, 8, 24), goldMat);
    shieldPivot.add(shieldRim);

    const shieldBoss = new THREE.Mesh(new THREE.SphereGeometry(0.055, 12, 10), goldMat);
    shieldBoss.position.set(0, 0, 0.025);
    shieldPivot.add(shieldBoss);

    // Left hand paw gripping shield
    const shieldPaw = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), sSkinMat);
    shieldPaw.position.set(0, 0, -0.04);
    shieldPivot.add(shieldPaw);

    sGroup.add(shieldPivot);

    sGroup.scale.set(0.001, 0.001, 0.001);
    soldiersContainer.add(sGroup);

    royalSoldiers.push({
      group: sGroup,
      eyes: sEyes,
      mouth: sMouth,
      spearPivot,
      shieldPivot,
      cfg,
      spawnProgress: 0.0,
      currentX: cfg.offsetX,
      currentZ: cfg.offsetZ
    });
  }

  // Spark burst particles for spear clashing during duel
  const clashSparksGroup = new THREE.Group();
  clashSparksGroup.name = 'ClashSparks';
  soldiersContainer.add(clashSparksGroup);

  const sparkGeo = new THREE.OctahedronGeometry(0.048);
  const sparkMeshes = [];
  for (let sp = 0; sp < 14; sp++) {
    const sm = new THREE.Mesh(sparkGeo, new THREE.MeshBasicMaterial({
      color: new THREE.Color('#fef08a'),
      transparent: true,
      opacity: 0.0
    }));
    clashSparksGroup.add(sm);
    sparkMeshes.push({ mesh: sm, vel: new THREE.Vector3(), life: 0.0 });
  }

  function triggerClashSpark(x, y, z) {
    for (let k = 0; k < sparkMeshes.length; k++) {
      const sp = sparkMeshes[k];
      sp.mesh.position.set(x + (Math.random() - 0.5) * 0.18, y + (Math.random() - 0.5) * 0.18, z + (Math.random() - 0.5) * 0.18);
      sp.vel.set((Math.random() - 0.5) * 2.2, Math.random() * 1.8 + 0.6, (Math.random() - 0.5) * 2.2);
      sp.life = 0.28;
      sp.mesh.material.opacity = 1.0;
      sp.mesh.scale.setScalar(Math.random() * 0.7 + 0.7);
    }
  }

  // =========================================================================
  // 8. 3D MAGIC WAND, LEVITATION HALO & ORBITING BUTTERFLIES ("Jadoo dikhao" / "Magic")
  // =========================================================================
  const magicWandGroup = new THREE.Group();
  magicWandGroup.name = 'MagicStarWand';
  magicWandGroup.position.set(0.96, 0.05, 0.52);
  magicWandGroup.rotation.set(0.35, -0.2, -0.38);
  magicWandGroup.visible = false;
  root.add(magicWandGroup);

  const wandStickMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#f472b6'),
    emissive: new THREE.Color('#be185d'),
    emissiveIntensity: 0.2,
    roughness: 0.22,
    metalness: 0.45
  });
  const wandStick = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.038, 0.76, 16), wandStickMat);
  wandStick.position.y = 0.12;
  magicWandGroup.add(wandStick);

  // Golden collar rings on wand
  for (const ry of [-0.22, 0.05, 0.42]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.038, 0.012, 10, 20), goldMat);
    ring.rotation.x = Math.PI * 0.5;
    ring.position.y = ry;
    magicWandGroup.add(ring);
  }

  // 5-Pointed 3D Extruded Star Tip at top of wand
  const starShape = new THREE.Shape();
  const starPts = 5;
  const outerR = 0.17;
  const innerR = 0.078;
  for (let i = 0; i < starPts * 2; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const ang = (i / (starPts * 2)) * Math.PI * 2 - Math.PI * 0.5;
    const sx = Math.cos(ang) * r;
    const sy = Math.sin(ang) * r;
    if (i === 0) starShape.moveTo(sx, sy);
    else starShape.lineTo(sx, sy);
  }
  starShape.closePath();

  const starGeo = new THREE.ExtrudeGeometry(starShape, {
    depth: 0.045,
    bevelEnabled: true,
    bevelThickness: 0.018,
    bevelSize: 0.015,
    bevelSegments: 3
  });
  starGeo.center();
  const wandStarMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#fde047'),
    emissive: new THREE.Color('#f59e0b'),
    emissiveIntensity: 0.65,
    roughness: 0.12,
    metalness: 0.75,
    clearcoat: 1.0
  });
  const wandStarMesh = new THREE.Mesh(starGeo, wandStarMat);
  wandStarMesh.position.y = 0.56;
  magicWandGroup.add(wandStarMesh);

  // Glowing Levitation Aura Ring beneath Mochi during Magic Mode
  const magicAuraRing = new THREE.Group();
  magicAuraRing.position.set(0, -0.82, 0);
  magicAuraRing.visible = false;
  root.add(magicAuraRing);

  const auraTorusMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color('#f472b6'),
    transparent: true,
    opacity: 0.75
  });
  const auraTorus = new THREE.Mesh(new THREE.TorusGeometry(0.92, 0.022, 12, 48), auraTorusMat);
  auraTorus.rotation.x = Math.PI * 0.5;
  magicAuraRing.add(auraTorus);

  for (let g = 0; g < 6; g++) {
    const gem = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.055),
      new THREE.MeshBasicMaterial({ color: g % 2 === 0 ? '#fde047' : '#38bdf8' })
    );
    const ga = (g / 6) * Math.PI * 2;
    gem.position.set(Math.cos(ga) * 0.92, 0, Math.sin(ga) * 0.92);
    magicAuraRing.add(gem);
  }

  // 3D Orbiting Butterflies Container (World-relative around Mochi)
  const butterfliesContainer = new THREE.Group();
  butterfliesContainer.name = 'MagicButterflies';
  butterfliesContainer.visible = false;

  const butterflyColors = ['#f472b6', '#38bdf8', '#fde047', '#a78bfa', '#4ade80', '#fb7185', '#60a5fa'];
  const butterflies = [];

  const upperWingGeo = new THREE.CircleGeometry(0.11, 16);
  upperWingGeo.scale(1.25, 0.88, 1.0);
  const lowerWingGeo = new THREE.CircleGeometry(0.075, 14);
  lowerWingGeo.scale(1.1, 0.82, 1.0);
  const bfBodyGeo = new THREE.CapsuleGeometry(0.016, 0.11, 6, 8);

  for (let b = 0; b < 7; b++) {
    const bfGroup = new THREE.Group();
    const wingCol = new THREE.Color(butterflyColors[b % butterflyColors.length]);
    const wingMat = new THREE.MeshStandardMaterial({
      color: wingCol,
      emissive: wingCol,
      emissiveIntensity: 0.42,
      roughness: 0.25,
      side: THREE.DoubleSide
    });
    const bfBody = new THREE.Mesh(
      bfBodyGeo,
      new THREE.MeshStandardMaterial({ color: '#1e1b4b', roughness: 0.4 })
    );
    bfBody.rotation.x = Math.PI * 0.5;
    bfGroup.add(bfBody);

    const leftWingPivot = new THREE.Group();
    const uWingL = new THREE.Mesh(upperWingGeo, wingMat);
    uWingL.position.set(-0.08, 0.02, 0.02);
    const lWingL = new THREE.Mesh(lowerWingGeo, wingMat);
    lWingL.position.set(-0.06, -0.01, -0.04);
    leftWingPivot.add(uWingL, lWingL);
    bfGroup.add(leftWingPivot);

    const rightWingPivot = new THREE.Group();
    const uWingR = new THREE.Mesh(upperWingGeo, wingMat);
    uWingR.position.set(0.08, 0.02, 0.02);
    const lWingR = new THREE.Mesh(lowerWingGeo, wingMat);
    lWingR.position.set(0.06, -0.01, -0.04);
    rightWingPivot.add(uWingR, lWingR);
    bfGroup.add(rightWingPivot);

    butterfliesContainer.add(bfGroup);
    butterflies.push({
      group: bfGroup,
      leftWingPivot,
      rightWingPivot,
      angle: (b / 7) * Math.PI * 2,
      radius: 1.25 + (b % 3) * 0.35,
      heightOffset: -0.25 + (b % 4) * 0.38,
      speed: 1.25 + (b % 3) * 0.25,
      phase: b * 0.9
    });
  }

  // =========================================================================
  // 9. 3D SELFIE CAMERA POSE & STUDIO FLASH ("Selfie lete hain" / "Photo khicho")
  // =========================================================================
  const selfieCameraGroup = new THREE.Group();
  selfieCameraGroup.name = 'SelfieVintageCamera';
  selfieCameraGroup.position.set(0.74, 0.05, 1.22);
  selfieCameraGroup.rotation.set(-0.08, -0.45, 0.08);
  selfieCameraGroup.visible = false;
  root.add(selfieCameraGroup);

  const camBodyMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#2dd4bf'),
    roughness: 0.2,
    metalness: 0.15,
    clearcoat: 0.85
  });
  const camSilverMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#f1f5f9'),
    roughness: 0.18,
    metalness: 0.85
  });
  const camMainBox = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.26, 0.16), camBodyMat);
  selfieCameraGroup.add(camMainBox);

  const camTopPlate = new THREE.Mesh(new THREE.BoxGeometry(0.385, 0.065, 0.165), camSilverMat);
  camTopPlate.position.y = 0.11;
  selfieCameraGroup.add(camTopPlate);

  // Red shutter button on top
  const shutterBtn = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.04, 14), rubyMat);
  shutterBtn.position.set(0.11, 0.155, 0);
  selfieCameraGroup.add(shutterBtn);

  // Multi-element optical camera lens pointing toward Mochi / viewer
  const camLensBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.105, 0.12, 24), camSilverMat);
  camLensBarrel.rotation.x = Math.PI * 0.5;
  camLensBarrel.position.set(0, -0.01, -0.11);
  selfieCameraGroup.add(camLensBarrel);

  const camLensGlass = new THREE.Mesh(new THREE.CircleGeometry(0.082, 24), lensMat);
  camLensGlass.rotation.y = Math.PI;
  camLensGlass.position.set(0, -0.01, -0.172);
  selfieCameraGroup.add(camLensGlass);

  // Flash window & bright studio flash burst star
  const flashBurstMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color('#ffffff'),
    transparent: true,
    opacity: 0.0,
    side: THREE.DoubleSide
  });
  const flashBurstMesh = new THREE.Mesh(new THREE.CircleGeometry(0.42, 16), flashBurstMat);
  flashBurstMesh.position.set(-0.11, 0.08, -0.12);
  selfieCameraGroup.add(flashBurstMesh);

  // Instant Polaroid Photo Frame popping out of camera bottom!
  const polaroidFrameGroup = new THREE.Group();
  polaroidFrameGroup.position.set(0, -0.18, 0.04);
  const polaroidCardMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.3, metalness: 0.05 });
  const polaroidCard = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.26, 0.012), polaroidCardMat);
  polaroidFrameGroup.add(polaroidCard);
  const polaroidPicMat = new THREE.MeshBasicMaterial({ color: '#ff85b3' });
  const polaroidPic = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 0.17), polaroidPicMat);
  polaroidPic.position.set(0, 0.025, 0.008);
  polaroidFrameGroup.add(polaroidPic);
  selfieCameraGroup.add(polaroidFrameGroup);

  // Cute 3D Peace-Sign / V-Sign Model Paw raised on the left side during Selfie Pose!
  const peaceSignPawGroup = new THREE.Group();
  peaceSignPawGroup.position.set(-0.76, 0.18, 0.92);
  peaceSignPawGroup.rotation.set(0.15, 0.25, -0.28);
  peaceSignPawGroup.visible = false;
  const selfiePawFurMat = new THREE.MeshStandardMaterial({ color: '#ff9ebb', roughness: 0.45, metalness: 0.05 });
  const selfiePawPadMat = new THREE.MeshStandardMaterial({ color: '#ff477e', roughness: 0.35, metalness: 0.08 });
  const pawPalm = new THREE.Mesh(new THREE.SphereGeometry(0.13, 18, 16), selfiePawFurMat);
  pawPalm.scale.set(1.0, 0.88, 0.72);
  peaceSignPawGroup.add(pawPalm);
  const pawCenterPad = new THREE.Mesh(new THREE.SphereGeometry(0.055, 14, 12), selfiePawPadMat);
  pawCenterPad.position.set(0, -0.01, 0.085);
  pawCenterPad.scale.set(1.1, 0.9, 0.45);
  peaceSignPawGroup.add(pawCenterPad);
  for (const fSide of [-1, 1]) {
    const vFinger = new THREE.Mesh(new THREE.CapsuleGeometry(0.036, 0.14, 10, 12), selfiePawFurMat);
    vFinger.position.set(fSide * 0.058, 0.13, 0.01);
    vFinger.rotation.z = -fSide * 0.28;
    peaceSignPawGroup.add(vFinger);
  }
  root.add(peaceSignPawGroup);

  // Oversized Star-Shaped Party Glasses (Funny 3D Prop for Selfie Camera!)
  const starGlassesGroup = new THREE.Group();
  starGlassesGroup.position.set(0, 0.17, 1.07);
  starGlassesGroup.visible = false;
  const starFrameMat = new THREE.MeshStandardMaterial({
    color: '#ff007f',
    roughness: 0.18,
    metalness: 0.75,
    emissive: '#ff1493',
    emissiveIntensity: 0.25
  });
  const starLensMat = new THREE.MeshPhysicalMaterial({
    color: '#00f5d4',
    roughness: 0.08,
    metalness: 0.35,
    transmission: 0.45,
    transparent: true,
    opacity: 0.85
  });
  const starBridge = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.26, 12), starFrameMat);
  starBridge.rotation.z = Math.PI * 0.5;
  starGlassesGroup.add(starBridge);
  for (const side of [-1, 1]) {
    const sEyeGroup = new THREE.Group();
    sEyeGroup.position.set(side * 0.34, 0, 0);
    for (let pt = 0; pt < 5; pt++) {
      const pAng = (pt / 5) * Math.PI * 2 + Math.PI * 0.5;
      const rayCone = new THREE.Mesh(new THREE.ConeGeometry(0.095, 0.18, 4), starFrameMat);
      rayCone.position.set(Math.cos(pAng) * 0.17, Math.sin(pAng) * 0.17, 0);
      rayCone.rotation.z = pAng - Math.PI * 0.5;
      rayCone.scale.set(1.0, 1.0, 0.28);
      sEyeGroup.add(rayCone);
    }
    const rimTorus = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.032, 12, 24), starFrameMat);
    sEyeGroup.add(rimTorus);
    const sLens = new THREE.Mesh(new THREE.CylinderGeometry(0.155, 0.155, 0.018, 20), starLensMat);
    sLens.rotation.x = Math.PI * 0.5;
    sEyeGroup.add(sLens);
    starGlassesGroup.add(sEyeGroup);
  }
  root.add(starGlassesGroup);

  // =========================================================================
  // 10. 3D MUSICAL CONCERT: ROCKSTAR GUITAR, PUNJABI DHOL & MUSIC NOTES
  // =========================================================================
  const guitarGroup = new THREE.Group();
  guitarGroup.name = 'RockstarGuitar';
  guitarGroup.position.set(0.06, -0.18, 1.08);
  guitarGroup.rotation.set(0.12, 0.08, -0.45);
  guitarGroup.visible = false;
  root.add(guitarGroup);

  const guitarBodyMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#e11d48'),
    emissive: new THREE.Color('#881337'),
    emissiveIntensity: 0.18,
    roughness: 0.15,
    metalness: 0.2,
    clearcoat: 1.0
  });
  const guitarWoodMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#fde68a'),
    roughness: 0.35,
    metalness: 0.1
  });
  const lowerBout = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.09, 24), guitarBodyMat);
  lowerBout.rotation.x = Math.PI * 0.5;
  lowerBout.position.set(-0.12, -0.06, 0);
  guitarGroup.add(lowerBout);

  const upperBout = new THREE.Mesh(new THREE.CylinderGeometry(0.20, 0.20, 0.09, 24), guitarBodyMat);
  upperBout.rotation.x = Math.PI * 0.5;
  upperBout.position.set(0.12, 0.06, 0);
  guitarGroup.add(upperBout);

  const soundHole = new THREE.Mesh(
    new THREE.CircleGeometry(0.085, 20),
    new THREE.MeshBasicMaterial({ color: '#1e1b4b' })
  );
  soundHole.position.set(0.05, 0.02, 0.048);
  guitarGroup.add(soundHole);

  const soundHoleRing = new THREE.Mesh(new THREE.RingGeometry(0.085, 0.105, 24), goldMat);
  soundHoleRing.position.set(0.05, 0.02, 0.049);
  guitarGroup.add(soundHoleRing);

  const guitarNeck = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.065, 0.04), guitarWoodMat);
  guitarNeck.position.set(0.52, 0.24, 0.01);
  guitarNeck.rotation.z = 0.42;
  guitarGroup.add(guitarNeck);

  const guitarHeadstock = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.09, 0.045), guitarBodyMat);
  guitarHeadstock.position.set(0.85, 0.39, 0.01);
  guitarHeadstock.rotation.z = 0.32;
  guitarGroup.add(guitarHeadstock);

  // Festive Punjabi Dhol Drum ("Dhol bajao" / "Bhangra")
  const dholGroup = new THREE.Group();
  dholGroup.name = 'FestivePunjabiDhol';
  dholGroup.position.set(0.0, -0.22, 1.14);
  dholGroup.rotation.set(0.08, 0.0, 0.06);
  dholGroup.visible = false;
  root.add(dholGroup);

  const dholWoodMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#b45309'),
    roughness: 0.32,
    metalness: 0.25
  });
  const dholSkinMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#fef3c7'),
    roughness: 0.45
  });
  // Barrel-shaped Dhol body (2 joined frustums)
  const dholLeftHalf = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.27, 0.34, 24), dholWoodMat);
  dholLeftHalf.rotation.z = Math.PI * 0.5;
  dholLeftHalf.position.x = -0.17;
  dholGroup.add(dholLeftHalf);

  const dholRightHalf = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.22, 0.34, 24), dholWoodMat);
  dholRightHalf.rotation.z = Math.PI * 0.5;
  dholRightHalf.position.x = 0.17;
  dholGroup.add(dholRightHalf);

  // Golden & ruby festive bands around the Dhol
  for (const bx of [-0.33, -0.12, 0.0, 0.12, 0.33]) {
    const rBand = new THREE.Mesh(
      new THREE.TorusGeometry(Math.abs(bx) > 0.25 ? 0.225 : 0.268, 0.016, 10, 24),
      bx === 0 ? rubyMat : goldMat
    );
    rBand.rotation.y = Math.PI * 0.5;
    rBand.position.x = bx;
    dholGroup.add(rBand);
  }

  // Drumheads on both ends
  for (const side of [-1, 1]) {
    const headDisk = new THREE.Mesh(new THREE.CylinderGeometry(0.218, 0.218, 0.015, 24), dholSkinMat);
    headDisk.rotation.z = Math.PI * 0.5;
    headDisk.position.x = side * 0.342;
    dholGroup.add(headDisk);
  }

  // Animated Dhol sticks (Dagga & Tilli)
  const dholSticks = [];
  for (const side of [-1, 1]) {
    const stickPivot = new THREE.Group();
    stickPivot.position.set(side * 0.42, 0.18, 0.08);
    const stickShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.018, 0.28, 10), guitarWoodMat);
    stickShaft.position.y = -0.1;
    stickPivot.add(stickShaft);
    if (side < 0) {
      // Curved bass Dagga beater head
      const beater = new THREE.Mesh(new THREE.SphereGeometry(0.036, 10, 8), rubyMat);
      beater.position.set(0.02, -0.24, 0);
      stickPivot.add(beater);
    }
    dholGroup.add(stickPivot);
    dholSticks.push({ pivot: stickPivot, side });
  }

  // 3D Floating Musical Notes around Mochi during Guitar or Dhol concert
  const musicNotesGroup = new THREE.Group();
  musicNotesGroup.name = 'ConcertMusicNotes';
  musicNotesGroup.visible = false;
  root.add(musicNotesGroup);

  const noteColors = ['#fde047', '#38bdf8', '#f472b6', '#4ade80'];
  const musicNotes = [];
  for (let n = 0; n < 8; n++) {
    const nGroup = new THREE.Group();
    const nMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(noteColors[n % noteColors.length]),
      emissive: new THREE.Color(noteColors[n % noteColors.length]),
      emissiveIntensity: 0.5,
      roughness: 0.2
    });
    const noteHead = new THREE.Mesh(new THREE.SphereGeometry(0.048, 12, 10), nMat);
    noteHead.scale.set(1.25, 0.9, 0.7);
    nGroup.add(noteHead);

    const noteStem = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.16, 8), nMat);
    noteStem.position.set(0.045, 0.08, 0);
    nGroup.add(noteStem);

    const noteFlag = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.03, 0.012), nMat);
    noteFlag.position.set(0.07, 0.145, 0);
    noteFlag.rotation.z = -0.35;
    nGroup.add(noteFlag);

    musicNotesGroup.add(nGroup);
    musicNotes.push({
      group: nGroup,
      angle: (n / 8) * Math.PI * 2,
      radius: 1.15 + (n % 3) * 0.22,
      phase: n / 8
    });
  }

  // =========================================================================
  // 22. 3D HOLOGRAM EXPLAINER PROJECTOR (Context-Triggered for Complex Topics)
  // =========================================================================
  const hologramContainer = new THREE.Group();
  hologramContainer.name = 'MochiHologramProjector';
  hologramContainer.visible = false;

  // Sci-Fi Holographic Emitter Pad on floor/air beside Mochi
  const holoPadGroup = new THREE.Group();
  hologramContainer.add(holoPadGroup);

  const holoBaseMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#0f172a'),
    metalness: 0.85,
    roughness: 0.2
  });
  const holoCyanGlowMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color('#06b6d4'),
    transparent: true,
    opacity: 0.88,
    blending: THREE.AdditiveBlending
  });
  const holoVioletGlowMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color('#a855f7'),
    transparent: true,
    opacity: 0.78,
    blending: THREE.AdditiveBlending
  });
  const holoAmberGlowMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color('#f59e0b'),
    transparent: true,
    opacity: 0.88,
    blending: THREE.AdditiveBlending
  });

  const holoPadDisc = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.48, 0.06, 32), holoBaseMat);
  holoPadDisc.position.y = -0.62;
  holoPadGroup.add(holoPadDisc);

  const holoEmitterRing = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.018, 12, 36), holoCyanGlowMat);
  holoEmitterRing.rotation.x = Math.PI * 0.5;
  holoEmitterRing.position.y = -0.58;
  holoPadGroup.add(holoEmitterRing);

  // Volumetric Hologram Beam Cone
  const holoBeamMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color('#06b6d4'),
    transparent: true,
    opacity: 0.16,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  const holoBeamCone = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.32, 1.25, 28, 1, true), holoBeamMat);
  holoBeamCone.position.y = 0.04;
  holoPadGroup.add(holoBeamCone);

  // Floating Hologram Header Label (Dynamic CanvasTexture)
  const holoLabelCanvas = typeof document !== 'undefined' ? document.createElement('canvas') : null;
  if (holoLabelCanvas) {
    holoLabelCanvas.width = 512;
    holoLabelCanvas.height = 160;
  }
  const holoLabelTex = holoLabelCanvas ? new THREE.CanvasTexture(holoLabelCanvas) : null;
  const holoLabelMat = new THREE.MeshBasicMaterial({
    map: holoLabelTex,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false
  });
  const holoLabelMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.28, 0.40), holoLabelMat);
  holoLabelMesh.position.set(0, 0.86, 0);
  hologramContainer.add(holoLabelMesh);

  function renderHoloLabel(titleText, formulaText) {
    if (!holoLabelCanvas || !holoLabelTex) return;
    const ctx = holoLabelCanvas.getContext('2d');
    ctx.clearRect(0, 0, 512, 160);
    ctx.fillStyle = 'rgba(8, 22, 44, 0.82)';
    ctx.strokeStyle = '#06b6d4';
    ctx.lineWidth = 4;
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(10, 12, 492, 136, 22);
    } else {
      ctx.rect(10, 12, 492, 136);
    }
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 28px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(String(titleText || 'TOPPER HOLOGRAM').toUpperCase(), 256, 62);

    ctx.fillStyle = '#fde047';
    ctx.font = 'bold 26px monospace';
    ctx.fillText(String(formulaText || 'IQ 200 · EXPLAINER'), 256, 114);
    holoLabelTex.needsUpdate = true;
  }

  // Sub-models for the 5 Hologram Scientific Domains
  const holoModelsRoot = new THREE.Group();
  holoModelsRoot.position.y = 0.14;
  hologramContainer.add(holoModelsRoot);

  // Model A: Black Hole & Relativistic Accretion Disk ('black_hole')
  const blackHoleModel = new THREE.Group();
  const bhCore = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 28, 24),
    new THREE.MeshBasicMaterial({ color: '#020617' })
  );
  blackHoleModel.add(bhCore);
  const bhPhotonRing = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.018, 16, 48), holoCyanGlowMat);
  blackHoleModel.add(bhPhotonRing);
  const bhAccretionDisk = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.075, 14, 56), holoAmberGlowMat);
  bhAccretionDisk.rotation.x = Math.PI * 0.38;
  bhAccretionDisk.scale.z = 0.25;
  blackHoleModel.add(bhAccretionDisk);
  const bhOuterDisk = new THREE.Mesh(new THREE.TorusGeometry(0.56, 0.032, 12, 56), holoVioletGlowMat);
  bhOuterDisk.rotation.x = Math.PI * 0.38;
  blackHoleModel.add(bhOuterDisk);
  holoModelsRoot.add(blackHoleModel);

  // Model B: Quantum Atom & Electron Superposition Orbits ('quantum_atom')
  const quantumAtomModel = new THREE.Group();
  const atomNucleus = new THREE.Group();
  for (let n = 0; n < 6; n++) {
    const nucSphere = new THREE.Mesh(
      new THREE.SphereGeometry(0.068, 14, 12),
      n % 2 === 0 ? holoAmberGlowMat : holoVioletGlowMat
    );
    nucSphere.position.set(
      Math.cos(n * 1.1) * 0.045,
      Math.sin(n * 1.7) * 0.045,
      Math.cos(n * 2.3) * 0.045
    );
    atomNucleus.add(nucSphere);
  }
  quantumAtomModel.add(atomNucleus);
  const atomElectrons = [];
  for (let r = 0; r < 3; r++) {
    const orbitPivot = new THREE.Group();
    orbitPivot.rotation.z = (r * Math.PI) / 3;
    orbitPivot.rotation.x = 0.45;
    const orbitRing = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.01, 10, 48), holoCyanGlowMat);
    orbitPivot.add(orbitRing);
    const electronMesh = new THREE.Mesh(new THREE.SphereGeometry(0.042, 12, 10), holoAmberGlowMat);
    orbitPivot.add(electronMesh);
    quantumAtomModel.add(orbitPivot);
    atomElectrons.push({ mesh: electronMesh, speed: 3.4 + r * 0.7, phase: r * 2.1 });
  }
  holoModelsRoot.add(quantumAtomModel);

  // Model C: Rotating DNA Double Helix ('dna_helix')
  const dnaHelixModel = new THREE.Group();
  for (let k = 0; k < 10; k++) {
    const y = (k - 4.5) * 0.095;
    const angle = k * 0.62;
    const r = 0.26;
    const x1 = Math.cos(angle) * r;
    const z1 = Math.sin(angle) * r;
    const x2 = Math.cos(angle + Math.PI) * r;
    const z2 = Math.sin(angle + Math.PI) * r;

    const s1 = new THREE.Mesh(new THREE.SphereGeometry(0.038, 10, 10), holoCyanGlowMat);
    s1.position.set(x1, y, z1);
    dnaHelixModel.add(s1);

    const s2 = new THREE.Mesh(new THREE.SphereGeometry(0.038, 10, 10), holoVioletGlowMat);
    s2.position.set(x2, y, z2);
    dnaHelixModel.add(s2);

    const rung = new THREE.Mesh(
      new THREE.CylinderGeometry(0.012, 0.012, r * 2, 8),
      k % 2 === 0 ? holoAmberGlowMat : holoCyanGlowMat
    );
    rung.position.set(0, y, 0);
    rung.rotation.z = Math.PI * 0.5;
    rung.rotation.y = -angle;
    dnaHelixModel.add(rung);
  }
  holoModelsRoot.add(dnaHelixModel);

  // Model D: Solar System & Planetary Orbits ('solar_system')
  const solarSystemModel = new THREE.Group();
  const sunMesh = new THREE.Mesh(new THREE.SphereGeometry(0.15, 20, 18), holoAmberGlowMat);
  solarSystemModel.add(sunMesh);
  const solarPlanets = [];
  const planetRadii = [0.26, 0.38, 0.52];
  const planetSizes = [0.036, 0.052, 0.044];
  for (let p = 0; p < 3; p++) {
    const pRing = new THREE.Mesh(new THREE.TorusGeometry(planetRadii[p], 0.006, 8, 44), holoCyanGlowMat);
    pRing.rotation.x = Math.PI * 0.5;
    solarSystemModel.add(pRing);
    const pPivot = new THREE.Group();
    const pMesh = new THREE.Mesh(
      new THREE.SphereGeometry(planetSizes[p], 14, 12),
      p === 1 ? holoCyanGlowMat : holoVioletGlowMat
    );
    pMesh.position.x = planetRadii[p];
    if (p === 2) {
      const saturnRing = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.01, 8, 24), holoAmberGlowMat);
      saturnRing.rotation.x = 1.1;
      pMesh.add(saturnRing);
    }
    pPivot.add(pMesh);
    solarSystemModel.add(pPivot);
    solarPlanets.push({ pivot: pPivot, speed: 2.4 - p * 0.55, phase: p * 1.8 });
  }
  holoModelsRoot.add(solarSystemModel);

  // Model E: Neural Network & Polyhedron Math Matrix ('neural_net')
  const neuralNetModel = new THREE.Group();
  const wirePoly = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.36, 1),
    new THREE.MeshBasicMaterial({
      color: '#06b6d4',
      wireframe: true,
      transparent: true,
      opacity: 0.72
    })
  );
  neuralNetModel.add(wirePoly);
  const innerCorePoly = new THREE.Mesh(new THREE.OctahedronGeometry(0.18, 0), holoVioletGlowMat);
  neuralNetModel.add(innerCorePoly);
  holoModelsRoot.add(neuralNetModel);

  // =========================================================================
  // 23. TOPPER VS. BACKBENCHER 3D CLASSROOM BLACKBOARD VIVA & GOLD MEDAL
  // =========================================================================
  const blackboardContainer = new THREE.Group();
  blackboardContainer.name = 'TopperBlackboardViva';
  blackboardContainer.visible = false;

  const boardWoodMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#8b5a2b'),
    roughness: 0.55,
    metalness: 0.1
  });
  const boardFrameMesh = new THREE.Mesh(new THREE.BoxGeometry(1.96, 1.32, 0.08), boardWoodMat);
  blackboardContainer.add(boardFrameMesh);

  // Chalk Tray at bottom of 3D Blackboard
  const chalkTrayMesh = new THREE.Mesh(new THREE.BoxGeometry(1.98, 0.06, 0.16), boardWoodMat);
  chalkTrayMesh.position.set(0, -0.64, 0.05);
  blackboardContainer.add(chalkTrayMesh);

  // 3D Colored Chalk sticks resting on the tray
  const chalkColors = ['#ffffff', '#fde047', '#f472b6'];
  for (let c = 0; c < 3; c++) {
    const chalkMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.018, 0.018, 0.14, 10),
      new THREE.MeshStandardMaterial({ color: chalkColors[c], roughness: 0.8 })
    );
    chalkMesh.rotation.z = Math.PI * 0.5 + (c - 1) * 0.08;
    chalkMesh.position.set(-0.45 + c * 0.42, -0.595, 0.08);
    blackboardContainer.add(chalkMesh);
  }

  // Dynamic CanvasTexture for the Green Chalkboard Surface
  const boardCanvas = typeof document !== 'undefined' ? document.createElement('canvas') : null;
  if (boardCanvas) {
    boardCanvas.width = 1024;
    boardCanvas.height = 680;
  }
  const boardTex = boardCanvas ? new THREE.CanvasTexture(boardCanvas) : null;
  const boardSurfaceMat = new THREE.MeshStandardMaterial({
    map: boardTex,
    roughness: 0.78,
    metalness: 0.04
  });
  const boardSurfaceMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.82, 1.18), boardSurfaceMat);
  boardSurfaceMesh.position.z = 0.045;
  blackboardContainer.add(boardSurfaceMesh);

  // Spinning 3D Gold Medal above the Blackboard when User answers right!
  const vivaMedalGroup = new THREE.Group();
  vivaMedalGroup.position.set(0, 0.86, 0.08);
  vivaMedalGroup.visible = false;
  const medalDisc = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.03, 28), goldMat);
  medalDisc.rotation.x = Math.PI * 0.5;
  vivaMedalGroup.add(medalDisc);
  const medalRibbon = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.18, 0.018), rubyMat);
  medalRibbon.position.set(0, 0.16, -0.01);
  vivaMedalGroup.add(medalRibbon);
  blackboardContainer.add(vivaMedalGroup);

  // 3D Teacher's Pointer Stick attached to Mochi's right side during Viva!
  const pointerStickGroup = new THREE.Group();
  pointerStickGroup.name = 'TopperPointerStick';
  pointerStickGroup.position.set(0.95, 0.05, 0.52);
  pointerStickGroup.visible = false;
  const pointerShaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.012, 0.024, 0.92, 12),
    boardWoodMat
  );
  pointerShaft.position.y = 0.38;
  pointerShaft.rotation.z = -0.55;
  pointerStickGroup.add(pointerShaft);
  const pointerTip = new THREE.Mesh(new THREE.SphereGeometry(0.028, 10, 10), rubyMat);
  pointerTip.position.set(0.44, 0.72, 0);
  pointerStickGroup.add(pointerTip);
  root.add(pointerStickGroup);

  function wrapChalkText(ctx, text, x, y, maxWidth, lineHeight) {
    const words = String(text || '').split(' ');
    let line = '';
    let curY = y;
    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + ' ';
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && n > 0) {
        ctx.fillText(line.trim(), x, curY);
        line = words[n] + ' ';
        curY += lineHeight;
      } else {
        line = testLine;
      }
    }
    if (line.trim()) {
      ctx.fillText(line.trim(), x, curY);
      curY += lineHeight;
    }
    return curY;
  }

  function renderBlackboardChalk(vivaData = {}) {
    if (!boardCanvas || !boardTex) return;
    const ctx = boardCanvas.getContext('2d');
    // Deep classroom chalkboard slate green
    ctx.fillStyle = '#143326';
    ctx.fillRect(0, 0, 1024, 680);

    // Subtle chalk dust border line
    ctx.strokeStyle = 'rgba(248, 250, 252, 0.32)';
    ctx.lineWidth = 4;
    ctx.strokeRect(24, 24, 976, 632);

    // Header Bar: Scoreboard
    ctx.fillStyle = '#fde047';
    ctx.font = 'bold 34px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('🎓 SARARATI TOPPER VIVA', 48, 76);

    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 30px monospace';
    ctx.textAlign = 'right';
    const mScore = vivaData.mochiScore ?? 1;
    const uScore = vivaData.userScore ?? 0;
    ctx.fillText(`Mochi: ${mScore}  |  You: ${uScore}`, 972, 76);

    // Divider line
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(44, 100);
    ctx.lineTo(980, 100);
    ctx.stroke();

    // Question text
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 34px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'left';
    const qText = vivaData.question || 'Ready for Topper Mochi Viva Challenge?';
    let nextY = wrapChalkText(ctx, `Q: ${qText}`, 52, 162, 920, 46);

    // Options A / B / C
    const options = Array.isArray(vivaData.options) ? vivaData.options : [];
    ctx.font = 'bold 30px "Plus Jakarta Sans", sans-serif';
    nextY += 18;
    for (let i = 0; i < options.length; i++) {
      const optText = options[i];
      const isCorrectOpt = vivaData.status && vivaData.status !== 'asking' && i === vivaData.correctIndex;
      ctx.fillStyle = isCorrectOpt ? '#4ade80' : '#fef08a';
      ctx.fillText(optText, 68, nextY + i * 54);
    }

    // Bottom status banner (Asking / Correct Medal / Savage Roast)
    ctx.textAlign = 'center';
    ctx.font = 'bold 30px "Plus Jakarta Sans", sans-serif';
    if (vivaData.status === 'correct') {
      ctx.fillStyle = '#4ade80';
      ctx.fillText('🏆 SHABASH! GOLD MEDAL POINT! (+1)', 512, 618);
    } else if (vivaData.status === 'wrong') {
      ctx.fillStyle = '#fb7185';
      ctx.fillText(`😜 BACKBENCHER ROASTED! Ans: ${vivaData.answerSummary || ''}`, 512, 618);
    } else {
      ctx.fillStyle = '#94a3b8';
      ctx.fillText('🎙️ Speak your answer or click Option A / B / C below!', 512, 618);
    }

    boardTex.needsUpdate = true;
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
    friendsVisible: false,
    friendsTimer: 0.0,
    friendsActiveTime: 0.0,
    friendsMischiefTriggered: false,
    friendsRunningWild: false,
    awaitingFriendDismissConfirm: false,
    clonesOnlyMode: false,
    clonesScolded: false,
    clonesScoldedTimer: 0.0,
    lastCloneUtpatSoundTime: 0.0,
    ballState: {
      x: 0.0,
      y: 0.24,
      z: 0.65,
      vx: 0.95,
      vy: 1.4,
      vz: -0.45,
      targetCloneIdx: 0,
      kickCooldown: 0.0
    },
    soldiersVisible: false,
    soldiersTimer: 0.0,
    soldiersActiveTime: 0.0,
    soldiersState: 'guarding',
    soldiersFightTimer: 0.0,
    soldiersPlayTimer: 0.0,
    lastClashSoundTime: 0,
    selfieComboIndex: 0,
    accessories: {
      crown: false,
      party_hat: false,
      bowtie: false,
      sunglasses: false,
      mustache: false,
      star_glasses: false
    },
    weatherMode: 'clear',
    isRaining: false,
    hasUmbrella: false,
    umbrellaScale: 0.0,
    wetness: 0.0,
    rainTimer: 0.0,
    bubblesActive: false,
    bubblesTimer: 0.0,
    dryerActive: false,
    magicActive: false,
    magicTimer: 0.0,
    selfieFlashTimer: 0.0,
    hologramActive: false,
    hologramType: 'black_hole',
    hologramTimer: 0.0,
    hologramScale: 0.0,
    blackboardActive: false,
    blackboardTimer: 0.0,
    blackboardScale: 0.0,
    vivaMedalVisible: false,
    prevPosition: new THREE.Vector3(),
    velocity: new THREE.Vector3(),
    angularVelocity: new THREE.Vector3(),
    targetLook: new THREE.Vector2(0, 0),
    currentLook: new THREE.Vector2(0, 0)
  };

  // Emotion Summation Master Engine
  const emotionEngine = createEmotionEngine();

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
    const targetCenterY = targetWorldPos.y + 0.94 * s;

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

  let lastSfxTime = 0;
  function canPlaySfx(minGapMs = 65) {
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (now - lastSfxTime < minGapMs) return false;
    lastSfxTime = now;
    return true;
  }

  function triggerBoop(silent = false) {
    animState.boopImpulse = 1.0;
    animState.boopPhase = 0.0;
    emotionEngine.feedStimulus('boop', 1.0);
    if (!silent && canPlaySfx(90)) {
      playMochiBoopSound(1.0);
    }
  }

  function triggerTickle(intensity = 0.5) {
    if (animState.isPouting) return;
    animState.isTickled = true;
    animState.tickleTimer = 1.5;
    animState.tickleIntensity = Math.min(1.4, animState.tickleIntensity + intensity);
    emotionEngine.feedStimulus('tickle', intensity);
  }

  function trigger5SecTickle() {
    if (animState.isPouting) return;
    animState.isTickled = true;
    animState.tickleTimer = 2.5;
    animState.tickleIntensity = 1.8;
    animState.boopImpulse = 0.65;
    emotionEngine.feedStimulus('tickle', 1.6);
  }

  function setCheekPuff(progress) {
    if (animState.isPouting) return;
    animState.targetCheekPuff = Math.max(0.0, Math.min(1.0, progress));
  }

  function trigger10SecPout() {
    animState.isPouting = true;
    animState.poutHoldTimer = 3.0;
    animState.targetCheekPuff = 1.0;
    animState.isTickled = false;
    animState.tickleTimer = 0.0;
    animState.boopImpulse = 0.45;
    emotionEngine.feedStimulus('tease', 1.8);
  }

  function summonFriends(duration = 60.0) {
    animState.friendsVisible = true;
    animState.friendsTimer = duration;
    animState.friendsActiveTime = 0.0;
    animState.friendsMischiefTriggered = false;
    animState.friendsRunningWild = false;
    animState.awaitingFriendDismissConfirm = false;
    friendsContainer.visible = true;
    animState.boopImpulse = 0.75;
    emotionEngine.feedStimulus('friends_mischief', 1.2);
    if (canPlaySfx(80)) {
      playFriendsSpawnSound();
    }
  }

  function dismissFriends() {
    animState.friendsVisible = false;
    animState.friendsTimer = 0.0;
    animState.friendsRunningWild = false;
    animState.awaitingFriendDismissConfirm = false;
    emotionEngine.feedStimulus('pet', 0.6);
    if (canPlaySfx(80)) {
      playDeflatePopSound();
    }
  }

  function calmFriendsAndKeep() {
    if (animState.friendsVisible) {
      animState.friendsTimer = 90.0;
      animState.friendsRunningWild = false;
      animState.awaitingFriendDismissConfirm = false;
      animState.boopImpulse = 0.55;
      emotionEngine.feedStimulus('praise', 0.8);
      if (canPlaySfx(80)) {
        playAccessoryEquipSound();
      }
    }
  }

  function summonSoldiers(duration = 90.0) {
    animState.soldiersVisible = true;
    animState.soldiersTimer = duration;
    animState.soldiersActiveTime = 0.0;
    animState.soldiersState = 'guarding';
    animState.soldiersFightTimer = 0.0;
    animState.soldiersPlayTimer = 0.0;
    soldiersContainer.visible = true;

    // Equip Royal Golden Crown on Mochi King!
    animState.accessories.crown = true;
    animState.accessories.party_hat = false;
    crownGroup.visible = true;
    partyHatGroup.visible = false;

    animState.boopImpulse = 0.85;
    emotionEngine.feedStimulus('praise', 1.5);
    playRoyalFanfareSound();
  }

  function triggerSoldiersFight(duration = 14.0) {
    if (!animState.soldiersVisible) {
      summonSoldiers(duration + 40.0);
    }
    animState.soldiersState = 'fighting';
    animState.soldiersFightTimer = 4.8; // Comical duel for 4.8s then playful celebration
    animState.soldiersPlayTimer = 9.2;
    animState.boopImpulse = 0.65;
    playSpearClashSound();
  }

  function dismissSoldiers() {
    animState.soldiersVisible = false;
    animState.soldiersTimer = 0.0;
    animState.soldiersState = 'guarding';
    animState.soldiersFightTimer = 0.0;
    animState.soldiersPlayTimer = 0.0;
    if (canPlaySfx(80)) {
      playDeflatePopSound();
    }
  }

  function toggleAccessory(item, state = undefined) {
    const key = String(item || '').toLowerCase().trim();
    if (key === 'remove_all' || key === 'none' || key === 'clear') {
      animState.accessories.crown = false;
      animState.accessories.party_hat = false;
      animState.accessories.bowtie = false;
      animState.accessories.sunglasses = false;
      animState.accessories.mustache = false;
      animState.accessories.star_glasses = false;
    } else if (key.includes('crown') || key.includes('taj')) {
      const next = state !== undefined ? Boolean(state) : !animState.accessories.crown;
      animState.accessories.crown = next;
      if (next) animState.accessories.party_hat = false;
    } else if (key.includes('hat') || key.includes('topi') || key.includes('party')) {
      const next = state !== undefined ? Boolean(state) : !animState.accessories.party_hat;
      animState.accessories.party_hat = next;
      if (next) animState.accessories.crown = false;
    } else if (key.includes('bow') || key.includes('tie')) {
      animState.accessories.bowtie = state !== undefined ? Boolean(state) : !animState.accessories.bowtie;
    } else if (key.includes('star_glass') || key.includes('funky') || key.includes('star_shade')) {
      const next = state !== undefined ? Boolean(state) : !animState.accessories.star_glasses;
      animState.accessories.star_glasses = next;
      if (next) animState.accessories.sunglasses = false;
    } else if (key.includes('glass') || key.includes('chashma') || key.includes('goggles') || key.includes('shades')) {
      const next = state !== undefined ? Boolean(state) : !animState.accessories.sunglasses;
      animState.accessories.sunglasses = next;
      if (next) animState.accessories.star_glasses = false;
    } else if (key.includes('mustache') || key.includes('mooch') || key.includes('muchh') || key.includes('funny')) {
      animState.accessories.mustache = state !== undefined ? Boolean(state) : !animState.accessories.mustache;
    }

    crownGroup.visible = animState.accessories.crown;
    partyHatGroup.visible = animState.accessories.party_hat;
    bowtieGroup.visible = animState.accessories.bowtie;
    glassesGroup.visible = animState.accessories.sunglasses;
    mustacheGroup.visible = animState.accessories.mustache;
    starGlassesGroup.visible = animState.accessories.star_glasses;
    animState.boopImpulse = 0.55;
    if (canPlaySfx(80)) {
      playAccessoryEquipSound();
    }
    return animState.accessories;
  }

  // Dedicated "Mochi Clones Only" mode (selected from the top bar next to AR View):
  // Hides the Big Mochi (`root.visible = false`) and lets all 5 small Mochi clones roam and play with the 3D ball!
  function setClonesOnlyMode(active) {
    const isClones = Boolean(active);
    animState.clonesOnlyMode = isClones;
    root.visible = !isClones;
    if (isClones) {
      animState.friendsVisible = true;
      animState.friendsTimer = 0.0; // Infinite duration while in Mochi Clones view!
      animState.friendsRunningWild = true;
      animState.friendsMischiefTriggered = true;
      animState.clonesScolded = false;
      animState.clonesScoldedTimer = 0.0;
      friendsContainer.visible = true;
      animState.ballState.x = 0.0;
      animState.ballState.y = 0.85;
      animState.ballState.z = 0.55;
      animState.ballState.vx = 1.1;
      animState.ballState.vy = 1.8;
      animState.ballState.vz = -0.35;
      for (const mf of miniFriends) {
        mf.spawnProgress = Math.max(mf.spawnProgress, 0.25);
      }
      if (canPlaySfx(80)) {
        playFriendsSpawnSound();
      }
    } else {
      animState.friendsVisible = false;
      animState.friendsRunningWild = false;
      animState.clonesScolded = false;
      animState.clonesScoldedTimer = 0.0;
      animState.friendsTimer = 0.0;
    }
  }

  // Scold the 5 clones ("agar mai inhe dat do to sidhe line me kahde ho jaye muh and akhe badi karake"):
  // Immediately lines up all 5 clones in a straight row facing the viewer with huge wide eyes & wide-open shocked mouths!
  function scoldClonesLineUp(duration = 14.0) {
    if (!animState.friendsVisible) {
      summonFriends(60.0);
    }
    animState.clonesScolded = true;
    animState.clonesScoldedTimer = duration;
    animState.friendsRunningWild = false;
    animState.awaitingFriendDismissConfirm = false;
    for (const mf of miniFriends) {
      mf.boostTimer = 0.0;
    }
    // Roll the ball gently to the front-right corner and stop it
    animState.ballState.vx = 0.0;
    animState.ballState.vz = 0.0;
    animState.ballState.vy = 0.5;
    playScoldShockSound();
    return true;
  }

  function releaseClonesToPlay() {
    if (!animState.friendsVisible) {
      summonFriends(60.0);
    }
    animState.clonesScolded = false;
    animState.clonesScoldedTimer = 0.0;
    animState.friendsRunningWild = true;
    animState.ballState.vy = 1.9;
    animState.ballState.vx = (Math.random() - 0.5) * 2.2;
    animState.ballState.vz = (Math.random() - 0.5) * 1.4;
    playBallKickSound(1.2);
    return true;
  }

  function triggerCloneInteraction(cloneIdx) {
    const idx = Math.abs(Number(cloneIdx) || 0) % miniFriends.length;
    const mf = miniFriends[idx];
    if (!mf) return null;

    // Clicking a clone wakes it up for a playful trick (and releases scold mode if clicked)
    animState.clonesScolded = false;
    animState.clonesScoldedTimer = 0.0;
    mf.boostDuration = 1.55;
    mf.boostTimer = mf.boostDuration;
    mf.activeTrick = mf.cfg.interactionType;

    // Also kick the 3D ball playfully toward another clone!
    const nextIdx = (idx + 1 + Math.floor(Math.random() * 3)) % miniFriends.length;
    const targetClone = miniFriends[nextIdx];
    if (targetClone) {
      const dx = (targetClone.runOffsetX || targetClone.cfg.offsetX) - animState.ballState.x;
      const dz = (targetClone.runOffsetZ || targetClone.cfg.offsetZ) - animState.ballState.z;
      animState.ballState.vx = dx * 1.55;
      animState.ballState.vz = dz * 1.55;
      animState.ballState.vy = 2.1;
      animState.ballState.targetCloneIdx = nextIdx;
    }

    playCloneUniqueSound(idx);

    const replies = mf.cfg.replies || [];
    const reply = replies.length > 0 ? replies[mf.replyCursor % replies.length] : `Yay! Main ${mf.cfg.name} hoon!`;
    mf.replyCursor = (mf.replyCursor + 1) % Math.max(1, replies.length);

    const cloneInfo = {
      index: idx,
      name: mf.cfg.name,
      title: mf.cfg.title,
      interactionType: mf.cfg.interactionType,
      reply
    };
    if (typeof onCloneClickCallback === 'function') {
      onCloneClickCallback(cloneInfo);
    }
    return cloneInfo;
  }

  function clickCloneMesh(hitObject) {
    if (!hitObject || !animState.friendsVisible) return false;
    let target = hitObject;
    while (target) {
      if (target.userData?.isCloneBall) {
        // User clicked the 3D Play Ball directly — bounce it high and pass to a random clone!
        animState.clonesScolded = false;
        const randIdx = Math.floor(Math.random() * miniFriends.length);
        const dest = miniFriends[randIdx];
        animState.ballState.vx = ((dest?.runOffsetX || 0) - animState.ballState.x) * 1.8 + (Math.random() - 0.5) * 1.2;
        animState.ballState.vz = ((dest?.runOffsetZ || 0) - animState.ballState.z) * 1.8 + (Math.random() - 0.5) * 1.0;
        animState.ballState.vy = 2.65;
        animState.ballState.targetCloneIdx = randIdx;
        playBallKickSound(1.3);
        return { type: 'ball' };
      }
      if (target.userData?.cloneIndex !== undefined) {
        const info = triggerCloneInteraction(target.userData.cloneIndex);
        return info || true;
      }
      target = target.parent;
    }
    return false;
  }

  // =========================================================================
  // CONTEXT-TRIGGERED 3D HOLOGRAM EXPLAINER & 3D BLACKBOARD VIVA API
  function showHologram() {
    animState.hologramActive = false;
    animState.hologramTimer = 0.0;
    hologramContainer.visible = false;
    return false;
  }

  function hideHologram() {
    animState.hologramActive = false;
    animState.hologramTimer = 0.0;
    hologramContainer.visible = false;
  }

  function updateBlackboardViva(vivaData = {}) {
    animState.blackboardActive = true;
    animState.blackboardTimer = vivaData.duration || 90.0;
    animState.vivaMedalVisible = (vivaData.status === 'correct');
    blackboardContainer.visible = true;
    pointerStickGroup.visible = true;
    vivaMedalGroup.visible = animState.vivaMedalVisible;

    // Equip topper glasses while Mochi conducts the Viva!
    animState.accessories.sunglasses = true;
    glassesGroup.visible = true;
    animState.boopImpulse = 0.65;
    emotionEngine.feedStimulus('topper_swag', 1.4);

    renderBlackboardChalk(vivaData);

    if (canPlaySfx(60)) {
      if (vivaData.status === 'correct') {
        playVivaMedalSound();
      } else if (vivaData.status === 'wrong') {
        playVivaRoastBuzzerSound();
      } else {
        playChalkBoardWriteSound();
      }
    }
    return true;
  }

  function hideBlackboardViva() {
    animState.blackboardActive = false;
    animState.blackboardTimer = 0.0;
    animState.vivaMedalVisible = false;
    pointerStickGroup.visible = false;
    vivaMedalGroup.visible = false;
  }

  function setWeatherState(weatherMode) {
    const mode = String(weatherMode || '').toLowerCase().trim();
    if (mode === 'rain') {
      animState.weatherMode = 'rain';
      animState.isRaining = true;
      animState.hasUmbrella = false;
      animState.rainTimer = 18.0;
      rainContainer.visible = true;
      emotionEngine.feedStimulus('rain_wet', 1.0);
      if (canPlaySfx(80)) playWeatherSound('rain');
    } else if (mode === 'umbrella') {
      animState.weatherMode = 'umbrella';
      animState.hasUmbrella = true;
      umbrellaGroup.visible = true;
      animState.boopImpulse = 0.55;
      emotionEngine.feedStimulus('umbrella', 1.0);
      if (canPlaySfx(80)) playWeatherSound('umbrella');
    } else if (mode === 'rain_with_umbrella') {
      animState.weatherMode = 'umbrella';
      animState.isRaining = true;
      animState.hasUmbrella = true;
      animState.rainTimer = 18.0;
      rainContainer.visible = true;
      umbrellaGroup.visible = true;
      animState.boopImpulse = 0.55;
      emotionEngine.feedStimulus('umbrella', 0.8);
      if (canPlaySfx(80)) playWeatherSound('umbrella');
    } else if (mode === 'clear' || mode === 'stop_rain' || mode === 'sunny') {
      const wasWet = animState.wetness > 0.2 || animState.isRaining;
      animState.weatherMode = 'clear';
      animState.isRaining = false;
      animState.hasUmbrella = false;
      animState.rainTimer = 0.0;
      rainContainer.visible = false;
      emotionEngine.feedStimulus('hair_dryer', 0.6);
      if (wasWet) {
        playAction('shake_fur', 2.2);
        if (typeof onWetShakeCallback === 'function') {
          onWetShakeCallback();
        }
      } else if (canPlaySfx(80)) {
        playMochiBoopSound(1.1);
      }
    }
  }

  function spawnBubbles(duration = 16.0) {
    animState.bubblesActive = true;
    animState.bubblesTimer = duration;
    bubblesContainer.visible = true;
    for (const b of bubbleItems) {
      b.poppedTimer = 0.0;
      b.mesh.visible = true;
    }
    animState.boopImpulse = 0.65;
    emotionEngine.feedStimulus('bubbles', 1.0);
    if (canPlaySfx(80)) {
      playBubbleSpawnSound();
    }
  }

  function popBubbleMesh(hitObject) {
    if (!hitObject) return false;
    let target = hitObject;
    while (target && target.userData?.bubbleIndex === undefined && target.parent) {
      target = target.parent;
    }
    const idx = target?.userData?.bubbleIndex;
    if (idx !== undefined && bubbleItems[idx] && bubbleItems[idx].poppedTimer <= 0) {
      bubbleItems[idx].poppedTimer = 1.6;
      bubbleItems[idx].mesh.visible = false;
      emotionEngine.feedStimulus('pop_bubble', 1.0);
      playBubblePopSound(0.95 + (idx % 4) * 0.14);
      animState.boopImpulse = Math.max(animState.boopImpulse, 0.55);
      return true;
    }
    return false;
  }

  function stopAction() {
    animState.activeAction = null;
    animState.actionTimer = 0.0;
    animState.dryerActive = false;
    animState.magicActive = false;
    animState.magicTimer = 0.0;
    treatGroup.visible = false;
    dryerGroup.visible = false;
    magicWandGroup.visible = false;
    magicAuraRing.visible = false;
    butterfliesContainer.visible = false;
    selfieCameraGroup.visible = false;
    peaceSignPawGroup.visible = false;
    guitarGroup.visible = false;
    dholGroup.visible = false;
    musicNotesGroup.visible = false;
    animState.boopImpulse = 0.25;
    if (canPlaySfx(80)) {
      playMochiBoopSound(0.95);
    }
  }

  function playAction(action, duration = 3.5) {
    if (action === 'stop') {
      stopAction();
      return;
    }
    if (action === 'summon_friends' || action === 'friends') {
      summonFriends(60.0);
      animState.activeAction = 'love';
      animState.actionTimer = 3.2;
      return;
    }
    if (action === 'dismiss_friends') {
      dismissFriends();
      return;
    }
    if (action === 'keep_friends' || action === 'play_ball' || action === 'release_clones') {
      if (animState.clonesScolded) {
        releaseClonesToPlay();
      } else {
        calmFriendsAndKeep();
      }
      return;
    }
    if (action === 'scold_clones' || action === 'line_up_clones') {
      scoldClonesLineUp(14.0);
      return;
    }
    if (action === 'bubbles') {
      spawnBubbles(16.0);
      return;
    }
    if (action === 'king_mode' || action === 'king') {
      summonSoldiers(90.0);
      animState.activeAction = 'love';
      animState.actionTimer = 3.5;
      return;
    }
    if (action === 'soldiers_fight' || action === 'fight') {
      triggerSoldiersFight(14.0);
      animState.activeAction = 'happy_jump';
      animState.actionTimer = 4.5;
      return;
    }
    if (action === 'dismiss_soldiers') {
      dismissSoldiers();
      return;
    }

    const safeDuration = Number.isFinite(duration) && duration > 0 ? Math.min(duration, 8.0) : 4.2;
    animState.activeAction = action;
    animState.actionTimer = safeDuration;

    switch (action) {
      case 'magic':
      case 'butterflies':
        animState.activeAction = 'magic';
        animState.actionTimer = 6.5;
        animState.magicActive = true;
        animState.magicTimer = 6.5;
        animState.boopImpulse = 0.75;
        magicWandGroup.visible = true;
        magicAuraRing.visible = true;
        butterfliesContainer.visible = true;
        emotionEngine.feedStimulus('play', 1.5);
        if (canPlaySfx(80)) playMagicSpellSound();
        break;
      case 'selfie': {
        animState.activeAction = 'selfie';
        animState.actionTimer = 4.8;
        animState.selfieFlashTimer = 0.95;
        animState.boopImpulse = 0.74;
        selfieCameraGroup.visible = true;
        peaceSignPawGroup.visible = true;
        // Cycle through hilarious 3D Selfie Prop Outfits (Oversized Star Glasses + Party Hat + Mustache, or Shades + Crown + Mustache)
        const combo = animState.selfieComboIndex % 2;
        animState.selfieComboIndex += 1;
        if (combo === 0) {
          animState.accessories.star_glasses = true;
          animState.accessories.sunglasses = false;
          animState.accessories.party_hat = true;
          animState.accessories.crown = false;
          animState.accessories.bowtie = true;
          animState.accessories.mustache = true;
        } else {
          animState.accessories.star_glasses = false;
          animState.accessories.sunglasses = true;
          animState.accessories.party_hat = false;
          animState.accessories.crown = true;
          animState.accessories.bowtie = true;
          animState.accessories.mustache = true;
        }
        starGlassesGroup.visible = animState.accessories.star_glasses;
        glassesGroup.visible = animState.accessories.sunglasses;
        partyHatGroup.visible = animState.accessories.party_hat;
        crownGroup.visible = animState.accessories.crown;
        bowtieGroup.visible = animState.accessories.bowtie;
        mustacheGroup.visible = animState.accessories.mustache;
        emotionEngine.feedStimulus('praise', 1.5);
        if (canPlaySfx(80)) playCameraShutterSound();
        break;
      }
      case 'guitar':
      case 'concert':
        animState.activeAction = 'guitar';
        animState.actionTimer = 5.2;
        animState.boopImpulse = 0.85;
        guitarGroup.visible = true;
        dholGroup.visible = false;
        musicNotesGroup.visible = true;
        emotionEngine.feedStimulus('dance', 1.5);
        if (canPlaySfx(80)) playGuitarConcertSound();
        break;
      case 'dhol':
        animState.activeAction = 'dhol';
        animState.actionTimer = 5.2;
        animState.boopImpulse = 0.92;
        dholGroup.visible = true;
        guitarGroup.visible = false;
        musicNotesGroup.visible = true;
        emotionEngine.feedStimulus('dance', 1.6);
        if (canPlaySfx(80)) playDholBeatSound();
        break;
      case 'dance':
        animState.boopImpulse = 0.85;
        animState.isPouting = false;
        animState.targetCheekPuff = 0.0;
        emotionEngine.feedStimulus('dance', 1.2);
        if (canPlaySfx(80)) playDanceMusicBeat();
        break;
      case 'cry':
        animState.boopImpulse = 0.0;
        animState.isPouting = false;
        animState.targetCheekPuff = 0.0;
        emotionEngine.feedStimulus('cry_release', 1.4);
        if (canPlaySfx(80)) playCrySound();
        break;
      case 'laugh':
        trigger5SecTickle();
        emotionEngine.feedStimulus('tickle', 1.3);
        if (canPlaySfx(80)) playMochiGiggleSound();
        break;
      case 'pout':
        trigger10SecPout();
        emotionEngine.feedStimulus('tease', 1.5);
        if (canPlaySfx(80)) playCutePoutSound();
        break;
      case 'sleep':
        animState.boopImpulse = 0.0;
        animState.targetCheekPuff = 0.0;
        animState.isPouting = false;
        emotionEngine.feedStimulus('sleep', 1.2);
        if (canPlaySfx(80)) playSleepSound();
        break;
      case 'love':
        animState.boopImpulse = 0.8;
        animState.isPouting = false;
        animState.targetCheekPuff = 0.0;
        emotionEngine.feedStimulus('praise', 1.4);
        if (canPlaySfx(80)) playLoveKissSound();
        break;
      case 'peekaboo':
        animState.boopImpulse = 0.55;
        animState.isPouting = false;
        animState.targetCheekPuff = 0.0;
        emotionEngine.feedStimulus('play', 1.2);
        if (canPlaySfx(80)) playPeekabooSound();
        break;
      case 'shake_fur':
        animState.boopImpulse = 0.75;
        animState.angularVelocity.y += 28.0;
        animState.wetness = 0.0;
        emotionEngine.feedStimulus('hair_dryer', 0.5);
        if (canPlaySfx(80)) playFurShakeSound();
        break;
      case 'happy_jump':
        animState.boopImpulse = 0.9;
        emotionEngine.feedStimulus('play', 1.3);
        if (canPlaySfx(80)) playHappyJumpSound();
        break;
      case 'feed':
        animState.actionTimer = 3.8;
        animState.boopImpulse = 0.55;
        animState.isPouting = false;
        animState.targetCheekPuff = 0.0;
        treatGroup.visible = true;
        emotionEngine.feedStimulus('feed', 1.5);
        if (canPlaySfx(80)) playFeedTreatSound();
        break;
      case 'hair_dryer':
        animState.actionTimer = 3.6;
        animState.dryerActive = true;
        animState.wetness = 0.0;
        animState.isRaining = false;
        rainContainer.visible = false;
        dryerGroup.visible = true;
        emotionEngine.feedStimulus('hair_dryer', 1.4);
        if (canPlaySfx(80)) playHairDryerSound();
        break;
    }
  }

  function update(dt, pointerNDC, cameraPos = null, isARMode = false) {
    const safeDt = Math.min(Math.max(dt, 0.001), 0.05);
    animState.time += safeDt;

    // Step emotion summation master engine
    emotionEngine.step(safeDt);
    if (animState.isPetting) {
      emotionEngine.feedStimulus('pet', safeDt * 2.2);
    }
    if (animState.isRaining && !animState.hasUmbrella) {
      emotionEngine.feedStimulus('rain_wet', safeDt * 0.45);
    }
    const emState = emotionEngine.getState();
    setGlobalEmotionPitchMultiplier(emState.cutePitchMultiplier);

    if (faceViewerHoldTimer > 0) {
      faceViewerHoldTimer = Math.max(0, faceViewerHoldTimer - safeDt);
    }

    const isDirectInteraction = animState.isPetting || animState.isPouting || animState.cheekPuff > 0.04 || faceViewerHoldTimer > 0;
    if (isDirectInteraction) {
      animState.targetLook.set(0, 0);
    } else if (pointerNDC) {
      animState.targetLook.set(pointerNDC.x * 0.05, pointerNDC.y * 0.035);
    }
    animState.currentLook.lerp(animState.targetLook, Math.min(1.0, safeDt * 8.0));

    if (animState.boopImpulse > 0.001) {
      animState.boopPhase += safeDt * 14.0;
      animState.boopImpulse *= Math.exp(-safeDt * 3.6);
    } else {
      animState.boopImpulse = 0.0;
    }

    let hop = 0.0;
    if (isPlacing) {
      placeProgress += safeDt * 3.4;
      if (placeProgress >= 1.0) {
        placeProgress = 1.0;
        isPlacing = false;
        anchorPos.copy(targetAnchorPos);
        triggerBoop();
      } else {
        const p = placeProgress;
        anchorPos.lerpVectors(startAnchorPos, targetAnchorPos, p);
        hop = Math.sin(p * Math.PI) * placeHopHeight;
      }
    }

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

    if (animState.tickleTimer > 0) {
      animState.tickleTimer -= safeDt;
      animState.isTickled = true;
      animState.tickleIntensity *= Math.exp(-safeDt * 2.0);
    } else {
      animState.isTickled = false;
      animState.tickleIntensity = 0.0;
    }

    if (animState.isPouting) {
      animState.targetCheekPuff = 1.0;
      if (animState.poutHoldTimer > 0) {
        animState.poutHoldTimer -= safeDt;
        if (animState.poutHoldTimer <= 0) {
          animState.poutHoldTimer = 0.0;
          animState.isPouting = false;
          animState.targetCheekPuff = 0.0;
          animState.boopImpulse = 0.35;
          if (typeof onPoutDeflateCallback === 'function') {
            onPoutDeflateCallback();
          }
        }
      }
    }

    if (animState.actionTimer > 0) {
      animState.actionTimer -= safeDt;
      if (animState.actionTimer <= 0) {
        animState.actionTimer = 0.0;
        animState.activeAction = null;
        animState.dryerActive = false;
      }
    } else if (animState.activeAction !== null) {
      animState.activeAction = null;
      animState.dryerActive = false;
    }

    const act = animState.activeAction;
    const s = animState.baseScale;

    let actHop = 0.0;
    let actSway = 0.0;
    let actTilt = 0.0;
    let actSquash = 0.0;
    let actDroopX = 0.0;
    let actLeanZ = 0.0;
    let actYawOffset = 0.0;

    if (act === 'dance') {
      const fade = Math.min(1.0, animState.actionTimer / 0.6);
      const dTime = animState.time * 11.5;
      actHop = Math.abs(Math.sin(dTime)) * 0.15 * s * fade;
      actSway = Math.sin(dTime * 0.5) * 0.16 * s * fade;
      actTilt = Math.sin(dTime * 0.5) * 0.28 * fade;
      actSquash = Math.sin(dTime) * 0.11 * fade;
    } else if (act === 'cry') {
      actHop = -0.06 * s;
      actSway = Math.sin(animState.time * 36.0) * 0.018 * s;
      actDroopX = 0.10 + Math.sin(animState.time * 8.0) * 0.03;
      actSquash = -0.07 + Math.sin(animState.time * 8.0) * 0.025;
    } else if (act === 'sleep') {
      actHop = -0.04 * s + Math.sin(animState.time * 1.5) * 0.02 * s;
      actTilt = 0.12;
      actSquash = Math.sin(animState.time * 1.5) * 0.05;
    } else if (act === 'love') {
      actHop = Math.abs(Math.sin(animState.time * 10.0)) * 0.085 * s;
      actLeanZ = 0.09 * s;
      actTilt = Math.sin(animState.time * 4.5) * 0.11;
    } else if (act === 'peekaboo') {
      const isPopPhase = animState.actionTimer < 0.85;
      actHop = isPopPhase ? 0.12 * s : -0.05 * s;
      actSquash = isPopPhase ? 0.08 : -0.06;
      actTilt = Math.sin(animState.time * 6.0) * 0.08;
    } else if (act === 'shake_fur') {
      actYawOffset = Math.sin(animState.time * 38.0) * 0.36;
      actTilt = Math.cos(animState.time * 32.0) * 0.14;
    } else if (act === 'feed') {
      // Mochi leans forward in 3 excited bites and chews happily!
      const elapsedFeed = 3.8 - animState.actionTimer;
      const biteWave = Math.max(0.0, Math.sin(elapsedFeed * 6.8));
      actDroopX = 0.12 * biteWave;
      actLeanZ = 0.11 * biteWave * s;
      actHop = Math.abs(Math.sin(elapsedFeed * 9.0)) * 0.055 * s;
      actSquash = Math.sin(elapsedFeed * 14.0) * 0.045;
    } else if (act === 'hair_dryer') {
      // Mochi sways happily in the warm hair dryer breeze as her fur puffs up!
      actSway = Math.sin(animState.time * 9.0) * 0.06 * s;
      actYawOffset = Math.sin(animState.time * 7.5) * 0.14;
      actSquash = 0.05 + Math.sin(animState.time * 12.0) * 0.03;
    } else if (act === 'magic') {
      // Smooth anti-gravity levitation & gentle fairy sway!
      const magicFade = Math.min(1.0, animState.actionTimer / 0.8);
      actHop = (0.36 + Math.sin(animState.time * 3.4) * 0.10) * s * magicFade;
      actSway = Math.sin(animState.time * 2.2) * 0.08 * s * magicFade;
      actTilt = Math.cos(animState.time * 2.2) * 0.09 * magicFade;
    } else if (act === 'selfie') {
      // Playful peace-sign head tilt & model pose!
      actTilt = -0.18 + Math.sin(animState.time * 4.0) * 0.05;
      actYawOffset = 0.14;
      actHop = Math.abs(Math.sin(animState.time * 6.5)) * 0.05 * s;
    } else if (act === 'guitar' || act === 'dhol') {
      // Energetic concert rock / Bhangra bounce!
      const beatFreq = act === 'dhol' ? 14.0 : 11.5;
      actHop = Math.abs(Math.sin(animState.time * beatFreq)) * 0.16 * s;
      actSway = Math.sin(animState.time * (beatFreq * 0.5)) * 0.14 * s;
      actTilt = Math.sin(animState.time * (beatFreq * 0.5)) * 0.22;
      actSquash = Math.sin(animState.time * beatFreq) * 0.09;
    }

    // Update 3D Magic Wand, Levitation Aura Ring & Orbiting Butterflies
    if (act === 'magic') {
      magicWandGroup.visible = true;
      magicAuraRing.visible = true;
      butterfliesContainer.visible = true;
      butterfliesContainer.position.copy(anchorPos);

      magicWandGroup.rotation.z = -0.38 + Math.sin(animState.time * 6.5) * 0.28;
      magicWandGroup.rotation.x = 0.35 + Math.cos(animState.time * 5.0) * 0.18;
      wandStarMesh.rotation.z = animState.time * 4.5;
      magicAuraRing.rotation.y = animState.time * 2.8;
      const auraPulse = 0.92 + Math.sin(animState.time * 6.0) * 0.12;
      magicAuraRing.scale.setScalar(auraPulse);

      for (let i = 0; i < butterflies.length; i++) {
        const bf = butterflies[i];
        const bAngle = bf.angle + animState.time * bf.speed;
        const bx = Math.cos(bAngle) * bf.radius * s;
        const by = (bf.heightOffset + 0.35 + Math.sin(animState.time * 3.8 + bf.phase) * 0.28) * s;
        const bz = Math.sin(bAngle) * bf.radius * 0.8 * s + 0.2 * s;
        bf.group.position.set(bx, by, bz);
        bf.group.rotation.y = -bAngle + Math.PI * 0.5;
        bf.group.scale.setScalar(s);

        const flap = Math.sin(animState.time * 18.0 + bf.phase) * 0.78;
        bf.leftWingPivot.rotation.z = flap;
        bf.rightWingPivot.rotation.z = -flap;
      }
    } else {
      magicWandGroup.visible = false;
      magicAuraRing.visible = false;
      butterfliesContainer.visible = false;
    }

    // Update 3D Selfie Camera, Peace-Sign Model Paw, Polaroid Print & Flash Burst
    if (act === 'selfie') {
      selfieCameraGroup.visible = true;
      peaceSignPawGroup.visible = true;
      selfieCameraGroup.position.y = 0.05 + Math.sin(animState.time * 5.5) * 0.03;
      peaceSignPawGroup.position.y = 0.18 + Math.sin(animState.time * 7.5) * 0.045;
      peaceSignPawGroup.rotation.z = -0.28 + Math.sin(animState.time * 6.5) * 0.12;
      // Polaroid instant photo slides out smoothly after the shutter flash!
      const elapsedSelfie = 4.8 - animState.actionTimer;
      const slideOut = Math.min(1.0, Math.max(0.0, (elapsedSelfie - 0.35) * 1.4));
      polaroidFrameGroup.position.y = -0.06 - slideOut * 0.22;
      polaroidFrameGroup.scale.setScalar(0.001 + slideOut * 0.999);
      if (animState.selfieFlashTimer > 0) {
        animState.selfieFlashTimer = Math.max(0, animState.selfieFlashTimer - safeDt);
        const flashWave = Math.sin((animState.selfieFlashTimer / 0.95) * Math.PI);
        flashBurstMat.opacity = Math.min(0.96, flashWave * 1.4);
        flashBurstMesh.scale.setScalar(0.6 + flashWave * 2.6);
      } else {
        flashBurstMat.opacity = 0.0;
      }
    } else {
      selfieCameraGroup.visible = false;
      peaceSignPawGroup.visible = false;
      flashBurstMat.opacity = 0.0;
    }

    // Update 3D Rockstar Guitar, Festive Dhol & Floating Musical Notes
    if (act === 'guitar' || act === 'dhol') {
      guitarGroup.visible = act === 'guitar';
      dholGroup.visible = act === 'dhol';
      musicNotesGroup.visible = true;

      if (act === 'guitar') {
        guitarGroup.rotation.z = -0.45 + Math.sin(animState.time * 12.0) * 0.12;
      } else if (act === 'dhol') {
        dholGroup.rotation.z = 0.06 + Math.sin(animState.time * 14.0) * 0.09;
        for (const st of dholSticks) {
          st.pivot.rotation.z = st.side * (0.25 + Math.sin(animState.time * 18.0 + (st.side > 0 ? 0 : Math.PI)) * 0.45);
        }
      }

      for (let n = 0; n < musicNotes.length; n++) {
        const mn = musicNotes[n];
        const nCycle = (animState.time * 0.65 + mn.phase) % 1.0;
        const nAng = mn.angle + animState.time * 1.4;
        mn.group.position.set(
          Math.cos(nAng) * mn.radius,
          -0.25 + nCycle * 1.55,
          Math.sin(nAng) * mn.radius * 0.65 + 0.35
        );
        mn.group.rotation.y = Math.sin(animState.time * 4.0 + n) * 0.4;
        const nScale = Math.sin(nCycle * Math.PI) * 1.15;
        mn.group.scale.setScalar(Math.max(0.001, nScale));
      }
    } else {
      guitarGroup.visible = false;
      dholGroup.visible = false;
      musicNotesGroup.visible = false;
    }

    // Update 3D Strawberry Cake Treat during 'feed'
    if (act === 'feed') {
      treatGroup.visible = true;
      const elapsedFeed = 3.8 - animState.actionTimer;
      const remainFrac = Math.max(0.0, 1.0 - elapsedFeed / 3.1);
      cakeBodyGroup.scale.setScalar(Math.max(0.001, remainFrac));
      treatGroup.position.set(0, -0.10 + Math.sin(animState.time * 6.0) * 0.025, 1.32);
      treatGroup.rotation.y = Math.sin(animState.time * 3.0) * 0.2;
    } else {
      treatGroup.visible = false;
    }

    // Update 3D Salon Hair Dryer & Air Wave Rings during 'hair_dryer'
    if (act === 'hair_dryer') {
      dryerGroup.visible = true;
      animState.dryerActive = true;
      dryerGroup.position.set(
        1.12 + Math.sin(animState.time * 4.5) * 0.08,
        0.25 + Math.sin(animState.time * 3.2) * 0.22,
        0.78 + Math.cos(animState.time * 2.8) * 0.15
      );
      dryerGroup.rotation.z = Math.sin(animState.time * 5.0) * 0.12;
      for (const ring of dryerAirRings) {
        const wProg = (animState.time * 3.2 + ring.phase) % 1.0;
        ring.mesh.position.set(-0.26 - wProg * 0.78, 0, 0);
        ring.mesh.scale.setScalar(1.0 + wProg * 2.2);
        ring.mat.opacity = (1.0 - wProg) * 0.65;
      }
    } else {
      dryerGroup.visible = false;
      animState.dryerActive = false;
    }

    // Update 3D Floating Iridescent Soap Bubbles
    if (animState.bubblesActive) {
      if (animState.bubblesTimer > 0) {
        animState.bubblesTimer -= safeDt;
        if (animState.bubblesTimer <= 0) {
          animState.bubblesActive = false;
          bubblesContainer.visible = false;
        }
      }
      bubblesContainer.visible = animState.bubblesActive;
      bubblesContainer.position.copy(anchorPos);
      for (let i = 0; i < bubbleItems.length; i++) {
        const b = bubbleItems[i];
        if (b.poppedTimer > 0) {
          b.poppedTimer -= safeDt;
          if (b.poppedTimer <= 0) {
            b.mesh.visible = true;
            b.yOffset = -0.8;
          }
          continue;
        }
        b.yOffset += b.speed * safeDt;
        if (b.yOffset > 1.8) {
          b.yOffset = -0.85;
        }
        const bAngle = b.angle + animState.time * 0.45;
        const bx = Math.cos(bAngle) * b.radius * s + Math.sin(animState.time * 2.2 + i) * 0.12 * s;
        const by = b.yOffset * s;
        const bz = Math.sin(bAngle) * b.radius * 0.75 * s + 0.35 * s;
        b.mesh.position.set(bx, by, bz);
        const wobble = b.scale * s * (1.0 + Math.sin(animState.time * 5.5 + i) * 0.08);
        b.mesh.scale.setScalar(wobble);

        // Auto-pop if Mochi jumps high right into a bubble!
        if (animState.boopImpulse > 0.5 && Math.hypot(bx, by - 0.3 * s, bz) < 0.72 * s) {
          b.poppedTimer = 1.8;
          b.mesh.visible = false;
          playBubblePopSound(1.0 + (i % 3) * 0.15);
        }
      }
    } else {
      bubblesContainer.visible = false;
    }

    // When Chintu, Pintu, Golu, Molu are running wild, Mochi turns its head left & right watching them!
    let watchingFriendsYaw = 0.0;
    if (animState.friendsVisible && animState.friendsRunningWild && animState.friendsActiveTime < 12.5) {
      watchingFriendsYaw = Math.sin(animState.time * 3.8) * 0.36;
      animState.currentLook.x = Math.sin(animState.time * 3.8) * 0.25;
    }

    const puffLerpSpeed = animState.targetCheekPuff > animState.cheekPuff ? 2.6 : 3.8;
    animState.cheekPuff += (animState.targetCheekPuff - animState.cheekPuff) * Math.min(1.0, safeDt * puffLerpSpeed);
    const puff = animState.cheekPuff;
    const tickle = animState.tickleIntensity;

    const tickleWiggle = Math.sin(animState.time * 28.0) * 0.07 * tickle;
    const tickleSquash = Math.sin(animState.time * 22.0) * 0.08 * tickle;

    const sfxVol = getActiveVocalEnvelope();
    const liveVol = animState.isSpeaking ? Math.min(1.0, animState.speechVolume * 1.5) : 0.0;
    const targetVol = Math.max(liveVol, sfxVol);
    animState.smoothSpeechVolume += (targetVol - animState.smoothSpeechVolume) * Math.min(1.0, safeDt * 12.0);
    const talkVol = animState.smoothSpeechVolume;

    const talkNod = Math.sin(animState.time * 6.5) * 0.042 * talkVol;
    const talkTilt = Math.sin(animState.time * 3.25) * 0.032 * talkVol;
    const listenTilt = (animState.isListening && !animState.isSpeaking && puff < 0.1) ? 0.08 : 0.0;
    const talkBounce = (Math.sin(animState.time * 6.5) * 0.018 + 0.012) * talkVol * s;
    const talkSquash = Math.sin(animState.time * 6.5) * 0.025 * talkVol;

    const breath = Math.sin(animState.time * 2.3) * 0.035;
    const bodyLookScale = (isPlaced || isARMode) ? (faceViewerHoldTimer > 0 ? 0.0 : 0.06) : 0.06;
    const swayX = (Math.sin(animState.time * 1.35) * 0.05 + animState.currentLook.x * 0.12 * bodyLookScale + tickleWiggle) * s + actSway;
    const jumpY =
      (Math.sin(animState.time * 2.3) * 0.045 +
        Math.abs(Math.sin(animState.boopPhase)) * animState.boopImpulse * 0.32) *
        s + talkBounce + (Math.abs(Math.sin(animState.time * 15.0)) * 0.025 * tickle) * s + actHop;

    const wetDroop = animState.wetness * 0.06;
    const squash =
      1.0 +
      breath +
      talkSquash +
      tickleSquash +
      actSquash -
      wetDroop +
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

    const bodyPuffX = 1.0 + puff * 0.18 + (act === 'hair_dryer' ? 0.06 : 0.0);
    const bodyPuffZ = 1.0 + puff * 0.15 + (act === 'hair_dryer' ? 0.06 : 0.0);
    const bodyPuffY = 1.0 - puff * 0.03 + (act === 'hair_dryer' ? 0.05 : 0.0);
    root.scale.set(
      (1.0 / Math.sqrt(squash)) * s * bodyPuffX,
      squash * s * bodyPuffY,
      (1.0 / Math.sqrt(squash)) * s * bodyPuffZ
    );

    const lookScale = isDirectInteraction ? 0.0 : bodyLookScale;
    root.rotation.y = facingYaw + watchingFriendsYaw + actYawOffset + animState.currentLook.x * 0.14 * lookScale + Math.sin(animState.time * 0.9) * 0.02 * (isDirectInteraction ? 0.0 : 1.0);
    root.rotation.x = facingPitch - animState.currentLook.y * 0.1 * lookScale + Math.cos(animState.time * 1.8) * 0.015 * (isDirectInteraction ? 0.0 : 1.0) + talkNod - puff * 0.035 + actDroopX;
    root.rotation.z = -(swayX / s) * 0.18 * (isDirectInteraction ? 0.2 : 1.0) + talkTilt + listenTilt + actTilt;

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

    // Update Peek-a-Boo Paws ("Chhup jao" -> paws move over eyes, then open for "Peek-a-boo!")
    const isHidingEyes = act === 'peekaboo' && animState.actionTimer > 0.75;
    for (const pw of peekPaws) {
      const targetP = isHidingEyes ? 1.0 : 0.0;
      pw.progress += (targetP - pw.progress) * Math.min(1.0, safeDt * 12.0);
      if (pw.progress > 0.01) {
        pw.group.visible = true;
        const p = pw.progress;
        pw.group.position.set(
          pw.side * (0.85 * (1.0 - p) + 0.28 * p),
          -0.18 * (1.0 - p) + 0.17 * p,
          0.55 * (1.0 - p) + 1.08 * p
        );
        pw.group.rotation.z = -pw.side * 0.35 * p;
        pw.group.rotation.y = pw.side * 0.22 * p;
        pw.group.scale.setScalar(0.3 + 0.7 * p);
      } else {
        pw.group.visible = false;
      }
    }

    // Update Weather (3D Rain + Umbrella + Wet Fur Weight)
    if (animState.isRaining) {
      if (animState.rainTimer > 0) {
        animState.rainTimer -= safeDt;
        if (animState.rainTimer <= 0) {
          setWeatherState('clear');
        }
      }
      if (!animState.hasUmbrella) {
        animState.wetness = Math.min(1.0, animState.wetness + safeDt * 0.35);
      } else {
        animState.wetness = Math.max(0.0, animState.wetness - safeDt * 0.5);
      }

      rainContainer.visible = true;
      rainContainer.position.copy(anchorPos);
      for (const rd of rainDrops) {
        let ry = rd.mesh.position.y - rd.speed * safeDt * s;
        if (animState.hasUmbrella && Math.hypot(rd.baseX, rd.baseZ) < 0.95 && ry < 1.15 * s && ry > 0.4 * s) {
          ry = -1.1 * s;
        }
        if (ry < -1.0 * s) {
          ry = 2.6 * s;
        }
        rd.mesh.position.set(rd.baseX * s, ry, rd.baseZ * s);
        rd.mesh.scale.setScalar(s);
      }
    } else {
      rainContainer.visible = false;
      animState.wetness = Math.max(0.0, animState.wetness - safeDt * 0.6);
    }

    // Smoothly pop open / close 3D Umbrella
    const targetUmb = animState.hasUmbrella ? 1.0 : 0.0;
    animState.umbrellaScale += (targetUmb - animState.umbrellaScale) * Math.min(1.0, safeDt * 9.0);
    if (animState.umbrellaScale > 0.01) {
      umbrellaGroup.visible = true;
      umbrellaGroup.scale.setScalar(animState.umbrellaScale);
      umbrellaGroup.rotation.z = -0.14 + Math.sin(animState.time * 2.5) * 0.04;
    } else {
      umbrellaGroup.visible = false;
    }

    // Blinking and expressive eyes
    animState.blinkTimer += safeDt;
    let blinkScaleY = 1.0;
    let eyeScaleX = 1.0;
    if (animState.blinkTimer > animState.nextBlink) {
      const blinkProgress = (animState.blinkTimer - animState.nextBlink) / 0.16;
      if (blinkProgress < 1.0) {
        blinkScaleY = Math.max(0.08, Math.abs(Math.cos(blinkProgress * Math.PI)));
      } else {
        animState.blinkTimer = 0;
        animState.nextBlink = 2.4 + Math.random() * 2.5;
      }
    }
    if (animState.boopImpulse > 0.25 && act !== 'love' && act !== 'cry') {
      blinkScaleY = Math.min(blinkScaleY, 0.18);
    }

    if (act === 'sleep' || isHidingEyes) {
      blinkScaleY = 0.04;
    } else if (act === 'cry') {
      blinkScaleY = 0.82 + Math.sin(animState.time * 24.0) * 0.06;
      eyeScaleX = 1.06;
    } else if (act === 'love' || (act === 'feed' && animState.actionTimer < 1.2)) {
      const heartPulse = 1.0 + Math.sin(animState.time * 10.0) * 0.06;
      blinkScaleY = 1.24 * heartPulse;
      eyeScaleX = 1.20 * heartPulse;
    } else if (act === 'dance' || act === 'laugh' || tickle > 0.08) {
      blinkScaleY = Math.min(blinkScaleY, Math.max(0.12, 0.5 - tickle * 0.5));
    } else if (puff > 0.1) {
      blinkScaleY = Math.min(blinkScaleY, 0.42);
    } else if (talkVol > 0.06) {
      const smileSquint = Math.max(0.32, 1.0 - talkVol * 0.68);
      blinkScaleY = Math.min(blinkScaleY, smileSquint);
    } else if (animState.isListening && !animState.isSpeaking) {
      blinkScaleY = Math.min(1.15, blinkScaleY * 1.06);
    }

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

    for (const b of blushMeshes) {
      const loveBoost = (act === 'love' || act === 'feed' || emState.affection > 0.7) ? (0.35 + (emState.affection - 0.7) * 0.4) : 0.0;
      const puffScaleX = 1.4 * (1.0 + puff * 1.25 + tickle * 0.25 + loveBoost);
      const puffScaleY = 0.75 * (1.0 + puff * 1.35 + tickle * 0.2 + loveBoost);
      const puffScaleZ = 0.35 * (1.0 + puff * 1.75 + tickle * 0.35 + loveBoost);
      b.mesh.scale.set(puffScaleX, puffScaleY, puffScaleZ);
      b.mesh.position.set(
        b.side * (0.49 + puff * 0.14),
        puff * 0.04,
        0.96 + puff * 0.09
      );
    }

    if (act === 'love' || act === 'feed' || emState.affection > 0.75) {
      blushMat.color.set('#ff1e74');
      blushMat.opacity = Math.min(0.98, 0.75 + emState.affection * 0.23);
      irisMaterial.color.set('#6b21a8');
    } else if (act === 'cry' || emState.sorrow > 0.5) {
      blushMat.color.set('#ff80ab');
      blushMat.opacity = Math.min(0.85, 0.55 + emState.sorrow * 0.3);
      irisMaterial.color.set('#1e3a8a');
    } else {
      blushMat.color.set('#ff5c93');
      const emBlush = 0.48 + emState.affection * 0.25 + emState.joy * 0.15 + talkVol * 0.2 + tickle * 0.35 + puff * 0.4;
      blushMat.opacity = Math.min(0.96, emBlush);
      irisMaterial.color.set('#3d285c');
    }

    if (mouthGroup) {
      if (act === 'cry') {
        mouthGroup.scale.set(0.85, -0.68 + Math.sin(animState.time * 18.0) * 0.12, 1.0);
        mouthGroup.position.set(0, 0.015, 1.045);
      } else if (act === 'feed') {
        // Happy chewing mouth motion!
        const chew = Math.abs(Math.sin(animState.time * 16.0));
        mouthGroup.scale.set(1.25 + chew * 0.35, 0.65 + chew * 0.95, 1.0);
        mouthGroup.position.set(0, 0.032 - chew * 0.015, 1.055);
      } else if (act === 'love') {
        mouthGroup.scale.set(1.32, 0.85 + Math.sin(animState.time * 9.0) * 0.12, 1.0);
        mouthGroup.position.set(0, 0.038, 1.055);
      } else if (puff > 0.05) {
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

    const isCrying = act === 'cry';
    const isLoving = act === 'love' || (act === 'feed' && animState.actionTimer < 1.3);

    for (const eye of eyes) {
      // Cute one-eye model wink when striking a 3D Selfie Pose!
      const eyeWinkY = (act === 'selfie' && eye.side === 1) ? 0.12 : blinkScaleY;
      eye.pivot.scale.set(eyeScaleX, eyeWinkY, 1.0);

      const cryShimmerX = isCrying ? Math.sin(animState.time * 32.0 + eye.side) * 0.014 : 0.0;
      const cryShimmerY = isCrying ? Math.cos(animState.time * 28.0) * 0.014 : 0.0;
      const eyeLookOffsetX = puff > 0.08 ? -eye.side * 0.02 : -eye.side * 0.042 + animState.currentLook.x * 0.028;

      eye.catchlightMain.position.x = eyeLookOffsetX + cryShimmerX;
      eye.catchlightMain.position.y = 0.052 + animState.currentLook.y * 0.025 + cryShimmerY;
      const catchScale = isLoving ? 1.35 : (isCrying ? 1.32 : 1.0);
      eye.catchlightMain.scale.set(catchScale, 1.18 * catchScale, 0.32);

      eye.heartPupil.visible = isLoving;
      eye.sparkle1.visible = isLoving || isCrying;
      if (isLoving) {
        const beat = 1.15 + Math.sin(animState.time * 12.0) * 0.22;
        eye.heartPupil.scale.set(beat, beat, 1.0);
      }

      // Expressive 3D Anime Tear Pool & Cheek Tear Stream outside the fur shells!
      eye.tearPool.visible = isCrying;
      if (eye.tearStream) {
        eye.tearStream.visible = isCrying;
      }
      if (isCrying) {
        const poolPulse = 1.0 + Math.sin(animState.time * 15.0 + eye.side) * 0.22;
        eye.tearPool.scale.set(2.45 * poolPulse, 0.82 * poolPulse, 0.96);
        if (eye.tearStream) {
          const streamWobble = 1.0 + Math.sin(animState.time * 18.0 + eye.side) * 0.16;
          eye.tearStream.scale.set(streamWobble, 1.0, 0.65);
          eye.tearStream.position.set(
            eye.side * (0.34 + Math.sin(animState.time * 12.0) * 0.015),
            -0.14,
            1.14
          );
        }
      }

      // 3 Oversized Glossy Teardrops per eye rolling clearly outside the 64 fur shells + Ground Splash Rings
      for (const td of eye.tearDrops) {
        td.mesh.visible = isCrying;
        if (isCrying) {
          const tCycle = (animState.time * 1.35 + td.phase) % 1.0;
          const startX = td.side * 0.34;
          const startY = 0.05;
          // Positioned at z = 1.15 so teardrops roll OUTSIDE the fur shell radius!
          const startZ = 1.15;

          const fallY = startY - tCycle * 0.86;
          const curveX = startX + td.side * Math.sin(tCycle * Math.PI * 0.85) * 0.14;
          const curveZ = startZ + Math.sin(tCycle * Math.PI * 0.65) * 0.06 - tCycle * 0.09;

          td.mesh.position.set(curveX, fallY, curveZ);
          const dropScale = Math.sin(tCycle * Math.PI) * 1.35;
          td.mesh.scale.set(0.92 * dropScale, 1.55 * dropScale, 0.92 * dropScale);

          // Ground splash ring when teardrop lands at bottom of cheek/ground
          if (td.splashMesh) {
            if (tCycle > 0.72) {
              td.splashMesh.visible = true;
              const sProg = (tCycle - 0.72) / 0.28;
              td.splashMesh.position.set(curveX, -0.88, curveZ);
              td.splashMesh.scale.setScalar(0.5 + sProg * 2.2);
              td.splashMat.opacity = (1.0 - sProg) * 0.85;
            } else {
              td.splashMesh.visible = false;
            }
          }
        } else if (td.splashMesh) {
          td.splashMesh.visible = false;
        }
      }
    }

    for (const fh of floatingHearts) {
      fh.mesh.visible = isLoving;
      if (isLoving) {
        const hCycle = (animState.time * 0.65 + fh.phase) % 1.0;
        const angle = fh.angleOffset + animState.time * fh.speed;
        const r = fh.radius * (0.85 + 0.25 * Math.sin(hCycle * Math.PI));
        fh.mesh.position.set(
          Math.cos(angle) * r,
          -0.2 + hCycle * 1.45,
          Math.sin(angle) * r * 0.65 + 0.25
        );
        fh.mesh.rotation.y = Math.sin(animState.time * 3.0 + fh.phase) * 0.45;
        fh.mesh.rotation.z = Math.cos(animState.time * 2.5 + fh.phase) * 0.25;
        const hScale = Math.sin(hCycle * Math.PI) * 1.15;
        fh.mesh.scale.setScalar(Math.max(0.001, hScale));
      }
    }

    // =========================================================================
    // UPDATE 5 MINI MOCHI CLONES + 3D PLAY BALL + SCOLDED STRAIGHT LINE-UP!
    // =========================================================================
    if (animState.clonesOnlyMode) {
      root.visible = false;
      animState.friendsVisible = true;
      if (!animState.clonesScolded) {
        animState.friendsRunningWild = true;
      }
    }

    if (animState.clonesScolded && animState.clonesScoldedTimer > 0) {
      animState.clonesScoldedTimer -= safeDt;
      if (animState.clonesScoldedTimer <= 0) {
        animState.clonesScoldedTimer = 0.0;
        animState.clonesScolded = false;
        if (animState.clonesOnlyMode) {
          animState.friendsRunningWild = true;
        }
      }
    }

    if (animState.friendsVisible) {
      animState.friendsActiveTime += safeDt;

      if (!animState.clonesOnlyMode && !animState.clonesScolded && animState.friendsActiveTime >= 4.5 && !animState.friendsMischiefTriggered) {
        animState.friendsMischiefTriggered = true;
        animState.friendsRunningWild = true;
        animState.awaitingFriendDismissConfirm = true;
        if (typeof onFriendsMischiefCallback === 'function') {
          onFriendsMischiefCallback();
        }
      }

      if (!animState.clonesOnlyMode && animState.friendsTimer > 0) {
        animState.friendsTimer -= safeDt;
        if (animState.friendsTimer <= 0) {
          animState.friendsTimer = 0.0;
          animState.friendsVisible = false;
        }
      }
    }

    const isScolded = animState.clonesScolded;
    const isUtpatOnly = animState.clonesOnlyMode;
    const cloneScaleMult = isUtpatOnly ? 1.25 : 1.0;
    const cosYaw = Math.cos(facingYaw);
    const sinYaw = Math.sin(facingYaw);

    let anyFriendVisible = false;
    for (let i = 0; i < miniFriends.length; i++) {
      const mf = miniFriends[i];
      const targetSpawn = animState.friendsVisible ? 1.0 : 0.0;
      mf.spawnProgress += (targetSpawn - mf.spawnProgress) * Math.min(1.0, safeDt * 6.5);

      if (mf.boostTimer > 0) {
        mf.boostTimer = Math.max(0, mf.boostTimer - safeDt);
      }

      if (mf.spawnProgress > 0.01) {
        anyFriendVisible = true;
        mf.group.visible = true;
        const cfg = mf.cfg;
        const p = mf.spawnProgress;
        const friendScale = cfg.scale * cloneScaleMult * s * p;
        const fTime = animState.time * 4.2 + cfg.phaseOffset;

        let targetX = cfg.offsetX;
        let targetZ = cfg.offsetZ;

        if (isScolded) {
          // SCOLDED POSE ("agar mai inhe dat do to sidhe line me kahde ho jaye muh and akhe badi karake"):
          // All 5 clones snap into a neat straight horizontal row facing the viewer!
          targetX = (i - 2) * (isUtpatOnly ? 0.94 : 0.78);
          targetZ = isUtpatOnly ? 0.42 : 1.25;
          mf.runOffsetX += (targetX - mf.runOffsetX) * Math.min(1.0, safeDt * 9.5);
          mf.runOffsetZ += (targetZ - mf.runOffsetZ) * Math.min(1.0, safeDt * 9.5);
        } else if (isUtpatOnly) {
          // Smooth roaming & chasing the 3D ball across the stage (with natural pauses, NO constant jumping!)
          const isChasingBall = (animState.ballState.targetCloneIdx === i);
          if (isChasingBall) {
            targetX = Math.max(-2.1, Math.min(2.1, animState.ballState.x));
            targetZ = Math.max(-1.15, Math.min(1.25, animState.ballState.z));
          } else {
            const speedA = 0.85 + i * 0.18;
            const speedB = 0.68 + (4 - i) * 0.15;
            const phase = cfg.phaseOffset + i * 1.25;
            targetX = Math.sin(animState.time * speedA + phase) * 1.72 + Math.cos(animState.time * 0.55 - i) * 0.35;
            targetZ = Math.cos(animState.time * speedB + phase * 0.8) * 0.98 + Math.sin(animState.time * 0.75 + i) * 0.25;
          }
          const prevX = mf.runOffsetX;
          const prevZ = mf.runOffsetZ;
          mf.runOffsetX += (targetX - mf.runOffsetX) * Math.min(1.0, safeDt * 3.4);
          mf.runOffsetZ += (targetZ - mf.runOffsetZ) * Math.min(1.0, safeDt * 3.4);
          mf.moveSpeed = Math.hypot(mf.runOffsetX - prevX, mf.runOffsetZ - prevZ) / Math.max(0.001, safeDt);
        } else {
          const isRunning = animState.friendsRunningWild;
          const targetRunX = isRunning ? cfg.offsetX + Math.sin(animState.time * (1.4 + i * 0.25) + cfg.phaseOffset) * 0.48 : cfg.offsetX;
          const targetRunZ = isRunning ? cfg.offsetZ + Math.cos(animState.time * (1.2 + i * 0.22) + cfg.phaseOffset) * 0.34 : cfg.offsetZ;
          const prevX = mf.runOffsetX;
          const prevZ = mf.runOffsetZ;
          mf.runOffsetX += (targetRunX - mf.runOffsetX) * Math.min(1.0, safeDt * 3.8);
          mf.runOffsetZ += (targetRunZ - mf.runOffsetZ) * Math.min(1.0, safeDt * 3.8);
          mf.moveSpeed = Math.hypot(mf.runOffsetX - prevX, mf.runOffsetZ - prevZ) / Math.max(0.001, safeDt);
        }

        // Compute distinct playful click interaction (Somersault, Tornado Spin, Belly Bounce, Cartwheel, Backflip)
        let trickHop = 0.0;
        let trickRotX = 0.0;
        let trickRotY = 0.0;
        let trickRotZ = 0.0;
        let trickSquash = 1.0;

        if (mf.boostTimer > 0 && !isScolded) {
          const prog = 1.0 - (mf.boostTimer / Math.max(0.1, mf.boostDuration || 1.55));
          const arc = Math.sin(prog * Math.PI);
          if (mf.activeTrick === 'somersault') {
            // Chintu: High leap + full 720-degree front somersault!
            trickHop = arc * 0.88;
            trickRotX = prog * Math.PI * 4.0;
          } else if (mf.activeTrick === 'tornado_spin') {
            // Pintu: Helicopter star leap + rapid 1080-degree spin!
            trickHop = arc * 0.76;
            trickRotY = prog * Math.PI * 6.0;
            trickRotZ = Math.sin(prog * Math.PI * 4.0) * 0.32;
          } else if (mf.activeTrick === 'belly_bounce') {
            // Golu: Elastic triple jelly belly-bounce!
            trickHop = Math.abs(Math.sin(prog * Math.PI * 3.0)) * 0.65;
            trickSquash = 1.0 + Math.cos(prog * Math.PI * 6.0) * 0.32;
          } else if (mf.activeTrick === 'cartwheel') {
            // Molu: Sideways 360-degree cartwheel barrel roll!
            trickHop = arc * 0.68;
            trickRotZ = prog * Math.PI * 2.0;
          } else if (mf.activeTrick === 'backflip') {
            // Bholu: Snappy backflip with happy wiggle!
            trickHop = arc * 0.85;
            trickRotX = -prog * Math.PI * 2.0;
          }
        }

        // Gentle ground waddle when moving — NO constant non-stop jumping ("aur har time kudate na rahe")!
        const walkStep = isScolded
          ? 0.0
          : Math.abs(Math.sin(animState.time * 7.2 + cfg.phaseOffset)) * Math.min(0.038, (mf.moveSpeed || 0) * 0.024);
        const fHop = (walkStep + trickHop) * s * p;

        // Tiny nervous shiver when scolded in a line; gentle waddle sway when walking
        const shiverX = isScolded ? Math.sin(animState.time * 38.0 + i) * 0.012 * s : 0.0;
        const fSquash = isScolded
          ? 1.05
          : trickSquash * (1.0 + Math.sin(animState.time * 7.2 + cfg.phaseOffset) * 0.035);

        const localX = mf.runOffsetX * s * p + shiverX;
        const localZ = mf.runOffsetZ * s * p;
        const worldOffsetX = localX * cosYaw + localZ * sinYaw;
        const worldOffsetZ = -localX * sinYaw + localZ * cosYaw;

        const groundY = anchorPos.y - 0.94 * s + 0.94 * friendScale;
        mf.group.position.set(
          anchorPos.x + worldOffsetX,
          groundY + fHop,
          anchorPos.z + worldOffsetZ
        );

        mf.group.scale.set(
          (1.0 / Math.sqrt(fSquash)) * friendScale,
          fSquash * friendScale,
          (1.0 / Math.sqrt(fSquash)) * friendScale
        );

        if (isScolded) {
          // Face straight toward the camera at attention!
          mf.group.rotation.y = facingYaw;
          mf.group.rotation.x = facingPitch;
          mf.group.rotation.z = Math.sin(animState.time * 32.0 + i) * 0.025;
        } else {
          // Face toward the ball or walking direction smoothly
          const dxBall = animState.ballState.x - mf.runOffsetX;
          const dzBall = animState.ballState.z - mf.runOffsetZ;
          const lookBallYaw = Math.atan2(dxBall, dzBall) * 0.45;
          mf.group.rotation.y = facingYaw + lookBallYaw + trickRotY;
          mf.group.rotation.z = Math.sin(animState.time * 7.2 + cfg.phaseOffset) * 0.09 + trickRotZ;
          mf.group.rotation.x = facingPitch + talkNod * 0.5 + trickRotX;
        }

        // Facial expression: When scolded -> HUGE wide eyes & BIG open "O" mouth ("muh and akhe badi karake")!
        if (isScolded) {
          for (const fEye of mf.eyes) {
            fEye.scale.set(1.62, 1.72 * Math.max(0.85, blinkScaleY), 1.35);
          }
          if (mf.smileArcs) {
            for (const arc of mf.smileArcs) arc.visible = false;
          }
          if (mf.openMouth) {
            mf.openMouth.visible = true;
            const pulse = 1.0 + Math.sin(animState.time * 18.0 + i) * 0.08;
            mf.openMouth.scale.set(1.62 * pulse, 1.85 * pulse, 1.25);
          }
        } else {
          const isExcited = mf.boostTimer > 0;
          for (const fEye of mf.eyes) {
            const eyeScale = isExcited ? 1.22 : 1.0;
            fEye.scale.set(eyeScale, eyeScale * blinkScaleY, eyeScale);
          }
          if (mf.smileArcs) {
            for (const arc of mf.smileArcs) arc.visible = !isExcited;
          }
          if (mf.openMouth) {
            mf.openMouth.visible = isExcited;
            if (isExcited) {
              mf.openMouth.scale.set(1.25, 1.35, 1.1);
            }
          }
        }
      } else {
        mf.group.visible = false;
      }
    }

    // Update 3D Play Ball physics & clone passing ("isme ball bhi banao")
    if (anyFriendVisible) {
      cloneBallGroup.visible = true;
      const bState = animState.ballState;
      if (bState.kickCooldown > 0) {
        bState.kickCooldown = Math.max(0, bState.kickCooldown - safeDt);
      }

      if (isScolded) {
        // When scolded, the ball rests quietly to the side while clones stand in a line
        const restX = 1.45;
        const restZ = 0.95;
        bState.x += (restX - bState.x) * Math.min(1.0, safeDt * 4.0);
        bState.z += (restZ - bState.z) * Math.min(1.0, safeDt * 4.0);
        bState.y = Math.max(ballRadius, bState.y - safeDt * 3.5);
        bState.vx = 0;
        bState.vy = 0;
        bState.vz = 0;
      } else {
        // Gravity + bounce + floor rolling
        bState.vy -= 5.8 * safeDt;
        bState.x += bState.vx * safeDt;
        bState.y += bState.vy * safeDt;
        bState.z += bState.vz * safeDt;

        // Floor bounce
        if (bState.y <= ballRadius) {
          bState.y = ballRadius;
          if (Math.abs(bState.vy) > 0.45) {
            bState.vy = Math.abs(bState.vy) * 0.68;
          } else {
            bState.vy = 0.0;
          }
          bState.vx *= Math.pow(0.92, safeDt * 60);
          bState.vz *= Math.pow(0.92, safeDt * 60);
        }

        // Soft stage bounds
        const maxBoundX = isUtpatOnly ? 2.05 : 2.15;
        const maxBoundZ = 1.35;
        const minBoundZ = isUtpatOnly ? -1.05 : -0.45;
        if (bState.x > maxBoundX) { bState.x = maxBoundX; bState.vx = -Math.abs(bState.vx) * 0.85; }
        if (bState.x < -maxBoundX) { bState.x = -maxBoundX; bState.vx = Math.abs(bState.vx) * 0.85; }
        if (bState.z > maxBoundZ) { bState.z = maxBoundZ; bState.vz = -Math.abs(bState.vz) * 0.85; }
        if (bState.z < minBoundZ) { bState.z = minBoundZ; bState.vz = Math.abs(bState.vz) * 0.85; }

        // Check if any clone is close enough to kick/pass the ball to another clone!
        if (bState.kickCooldown <= 0) {
          for (let i = 0; i < miniFriends.length; i++) {
            const mf = miniFriends[i];
            if (mf.spawnProgress < 0.7) continue;
            const dist = Math.hypot(bState.x - mf.runOffsetX, bState.z - mf.runOffsetZ);
            if (dist < 0.52 && bState.y < 0.65) {
              const nextTarget = (i + 1 + Math.floor(Math.random() * (miniFriends.length - 1))) % miniFriends.length;
              const receiver = miniFriends[nextTarget];
              const rx = receiver ? receiver.runOffsetX : 0.0;
              const rz = receiver ? receiver.runOffsetZ : 0.5;
              const passDx = rx - bState.x;
              const passDz = rz - bState.z;
              bState.vx = passDx * 1.45 + (Math.random() - 0.5) * 0.45;
              bState.vz = passDz * 1.45 + (Math.random() - 0.5) * 0.45;
              bState.vy = 1.75 + Math.random() * 0.65;
              bState.targetCloneIdx = nextTarget;
              bState.kickCooldown = 0.65;
              if (canPlaySfx(240)) {
                playBallKickSound(0.95 + i * 0.08);
              }
              break;
            }
          }
        }

        // If ball almost stops, give it a gentle nudge toward a clone so play continues smoothly
        if (Math.hypot(bState.vx, bState.vz) < 0.15 && bState.y <= ballRadius + 0.02 && bState.kickCooldown <= 0) {
          const nextIdx = (bState.targetCloneIdx + 1) % miniFriends.length;
          const dest = miniFriends[nextIdx];
          if (dest) {
            bState.vx = (dest.runOffsetX - bState.x) * 1.25;
            bState.vz = (dest.runOffsetZ - bState.z) * 1.25;
            bState.vy = 1.35;
            bState.targetCloneIdx = nextIdx;
            bState.kickCooldown = 0.7;
          }
        }

        // Realistic rolling rotation
        cloneBallMesh.rotation.z -= bState.vx * safeDt * 3.8;
        cloneBallMesh.rotation.x += bState.vz * safeDt * 3.8;
      }

      const ballScale = (isUtpatOnly ? 1.18 : 0.95) * s;
      const worldBallX = (bState.x * cosYaw + bState.z * sinYaw) * s;
      const worldBallZ = (-bState.x * sinYaw + bState.z * cosYaw) * s;
      const floorY = anchorPos.y - 0.94 * s;

      cloneBallMesh.position.set(
        anchorPos.x + worldBallX,
        floorY + bState.y * ballScale,
        anchorPos.z + worldBallZ
      );
      cloneBallMesh.scale.setScalar(ballScale);

      cloneBallShadow.position.set(
        anchorPos.x + worldBallX,
        floorY + 0.012,
        anchorPos.z + worldBallZ
      );
      const heightRatio = Math.max(0.0, Math.min(1.0, (bState.y - ballRadius) / 1.5));
      cloneBallShadow.scale.setScalar(ballScale * (1.0 - heightRatio * 0.45));
      ballShadowMat.opacity = 0.28 * (1.0 - heightRatio * 0.6);
    } else {
      cloneBallGroup.visible = false;
    }

    friendsContainer.visible = anyFriendVisible;

    // =========================================================================
    // UPDATE CUTE MINI ROYAL SOLDIERS ("भाला सैनिक" — King Mode & Duel/Fight)
    // =========================================================================
    if (animState.soldiersVisible) {
      animState.soldiersActiveTime += safeDt;

      if (animState.soldiersTimer > 0) {
        animState.soldiersTimer -= safeDt;
        if (animState.soldiersTimer <= 0) {
          animState.soldiersTimer = 0.0;
          animState.soldiersVisible = false;
        }
      }

      if (animState.soldiersState === 'fighting') {
        animState.soldiersFightTimer -= safeDt;
        if (animState.soldiersFightTimer <= 0) {
          animState.soldiersState = 'playing';
          animState.soldiersPlayTimer = 9.2;
          playSoldierCheerSound();
        }
      } else if (animState.soldiersState === 'playing') {
        animState.soldiersPlayTimer -= safeDt;
        if (animState.soldiersPlayTimer <= 0) {
          animState.soldiersState = 'guarding';
        }
      }
    }

    // Update Spark Particles
    for (let k = 0; k < sparkMeshes.length; k++) {
      const sp = sparkMeshes[k];
      if (sp.life > 0) {
        sp.life -= safeDt;
        sp.mesh.position.addScaledVector(sp.vel, safeDt);
        sp.vel.y -= safeDt * 4.8;
        sp.mesh.material.opacity = Math.max(0.0, sp.life / 0.28);
      } else {
        sp.mesh.material.opacity = 0.0;
      }
    }

    let anySoldierVisible = false;
    for (let i = 0; i < royalSoldiers.length; i++) {
      const ms = royalSoldiers[i];
      const targetSpawn = animState.soldiersVisible ? 1.0 : 0.0;
      ms.spawnProgress += (targetSpawn - ms.spawnProgress) * Math.min(1.0, safeDt * 6.5);

      if (ms.spawnProgress > 0.01) {
        anySoldierVisible = true;
        ms.group.visible = true;
        const cfg = ms.cfg;
        const p = ms.spawnProgress;
        const soldierScale = cfg.scale * s * p;
        const fTime = animState.time * 5.2 + cfg.phaseOffset;

        let targetX = cfg.offsetX;
        let targetZ = cfg.offsetZ;
        let targetYaw = cfg.yaw;
        let spearTiltX = 0.08;
        let spearTiltZ = 0.05;
        let hopAmp = 0.08;
        let hopFreq = fTime;
        let flipAngle = 0.0;

        if (animState.soldiersState === 'fighting') {
          const isFront = (i === 0 || i === 2);
          const clashX = isFront ? 0.38 : 0.48;
          targetX = cfg.side * clashX;
          targetZ = isFront ? 0.35 : -0.15;
          targetYaw = cfg.side < 0 ? Math.PI * 0.48 : -Math.PI * 0.48;

          const joustSpeed = 16.0;
          const thrust = Math.sin(animState.time * joustSpeed + cfg.phaseOffset);
          spearTiltX = 1.35 + thrust * 0.18;
          spearTiltZ = (cfg.side < 0 ? 0.15 : -0.15) * thrust;

          if (i === 0 && thrust > 0.88 && animState.time - (animState.lastClashSoundTime || 0) > 0.22) {
            animState.lastClashSoundTime = animState.time;
            playSpearClashSound();
            triggerClashSpark(anchorPos.x, anchorPos.y - 0.25 * s, anchorPos.z + (isFront ? 0.35 : -0.15) * s);
          }

          hopAmp = 0.16;
          hopFreq = animState.time * 12.0;
        } else if (animState.soldiersState === 'playing') {
          targetX = cfg.offsetX * 0.72 + Math.sin(animState.time * 3.5 + cfg.phaseOffset) * 0.25;
          targetZ = cfg.offsetZ + Math.cos(animState.time * 3.0 + cfg.phaseOffset) * 0.20;
          targetYaw = cfg.yaw + Math.sin(animState.time * 4.0 + cfg.phaseOffset) * 0.8;

          spearTiltX = -0.35 + Math.sin(animState.time * 8.0 + cfg.phaseOffset) * 0.25;
          spearTiltZ = Math.sin(animState.time * 6.0 + cfg.phaseOffset) * 0.35;

          hopAmp = 0.30;
          hopFreq = animState.time * 9.5;
          flipAngle = Math.sin(hopFreq + cfg.phaseOffset) > 0.5 ? ((animState.time * 7.0) % (Math.PI * 2)) : 0.0;
        }

        ms.currentX += (targetX - ms.currentX) * Math.min(1.0, safeDt * 5.5);
        ms.currentZ += (targetZ - ms.currentZ) * Math.min(1.0, safeDt * 5.5);

        const fHop = Math.abs(Math.sin(hopFreq + cfg.phaseOffset)) * hopAmp * s * p;
        const fSquash = 1.0 + Math.sin(hopFreq * 2.0) * 0.12;

        const cosYaw = Math.cos(facingYaw);
        const sinYaw = Math.sin(facingYaw);
        const localX = ms.currentX * s * p;
        const localZ = ms.currentZ * s * p;
        const worldOffsetX = localX * cosYaw + localZ * sinYaw;
        const worldOffsetZ = -localX * sinYaw + localZ * cosYaw;

        const groundY = anchorPos.y - 0.94 * s + 0.94 * soldierScale;
        ms.group.position.set(
          anchorPos.x + worldOffsetX,
          groundY + fHop,
          anchorPos.z + worldOffsetZ
        );

        ms.group.scale.set(
          (1.0 / Math.sqrt(fSquash)) * soldierScale,
          fSquash * soldierScale,
          (1.0 / Math.sqrt(fSquash)) * soldierScale
        );

        ms.group.rotation.y = facingYaw + targetYaw + Math.sin(fTime * 0.5) * 0.08;
        ms.group.rotation.x = facingPitch + flipAngle;

        if (ms.spearPivot) {
          ms.spearPivot.rotation.x = spearTiltX;
          ms.spearPivot.rotation.z = spearTiltZ;
        }

        if (ms.shieldPivot) {
          ms.shieldPivot.rotation.y = (cfg.side < 0 ? -0.25 : 0.25) + Math.sin(fTime * 0.8) * 0.12;
          ms.shieldPivot.rotation.x = (animState.soldiersState === 'fighting' ? 0.35 : 0.0);
        }

        for (const fEye of ms.eyes) {
          fEye.scale.y = blinkScaleY;
        }
      } else {
        ms.group.visible = false;
      }
    }
    soldiersContainer.visible = anySoldierVisible;

    // =========================================================================
    // UPDATE 3D HOLOGRAM EXPLAINER PROJECTOR (Rotating 3D Scientific Models)
    // =========================================================================
    if (animState.hologramActive) {
      if (animState.hologramTimer > 0) {
        animState.hologramTimer -= safeDt;
        if (animState.hologramTimer <= 0) {
          animState.hologramTimer = 0.0;
          animState.hologramActive = false;
        }
      }
    }
    const targetHoloScale = (animState.hologramActive && !animState.clonesOnlyMode) ? 1.0 : 0.0;
    animState.hologramScale += (targetHoloScale - animState.hologramScale) * Math.min(1.0, safeDt * 7.5);

    if (animState.hologramScale > 0.01) {
      hologramContainer.visible = true;
      const hs = animState.hologramScale * s;
      const cosYaw = Math.cos(facingYaw);
      const sinYaw = Math.sin(facingYaw);
      const localHX = -1.78 * s;
      const localHZ = 0.36 * s;
      const worldHX = localHX * cosYaw + localHZ * sinYaw;
      const worldHZ = -localHX * sinYaw + localHZ * cosYaw;

      hologramContainer.position.set(
        anchorPos.x + worldHX,
        anchorPos.y - 0.12 * s + Math.sin(animState.time * 2.8) * 0.04 * s,
        anchorPos.z + worldHZ
      );
      hologramContainer.scale.setScalar(hs);
      hologramContainer.rotation.y = facingYaw + 0.24;

      holoModelsRoot.rotation.y = animState.time * 1.15;
      holoModelsRoot.position.y = 0.14 + Math.sin(animState.time * 3.4) * 0.035;
      holoBeamMat.opacity = 0.13 + Math.sin(animState.time * 8.0) * 0.04;

      if (blackHoleModel.visible) {
        bhAccretionDisk.rotation.z = animState.time * 2.6;
        bhOuterDisk.rotation.z = -animState.time * 1.8;
      }
      if (quantumAtomModel.visible) {
        for (const el of atomElectrons) {
          const ang = animState.time * el.speed + el.phase;
          el.mesh.position.set(Math.cos(ang) * 0.46, Math.sin(ang) * 0.46, 0);
        }
      }
      if (dnaHelixModel.visible) {
        dnaHelixModel.rotation.y = animState.time * 1.6;
      }
      if (solarSystemModel.visible) {
        for (const pl of solarPlanets) {
          pl.pivot.rotation.y = animState.time * pl.speed + pl.phase;
        }
      }
      if (neuralNetModel.visible) {
        wirePoly.rotation.x = animState.time * 0.9;
        wirePoly.rotation.y = animState.time * 1.3;
        innerCorePoly.rotation.y = -animState.time * 2.1;
      }
    } else {
      hologramContainer.visible = false;
    }

    // =========================================================================
    // UPDATE 3D CLASSROOM BLACKBOARD VIVA & GOLD MEDAL
    // =========================================================================
    if (animState.blackboardActive) {
      if (animState.blackboardTimer > 0) {
        animState.blackboardTimer -= safeDt;
        if (animState.blackboardTimer <= 0) {
          animState.blackboardTimer = 0.0;
          animState.blackboardActive = false;
          pointerStickGroup.visible = false;
        }
      }
    }
    const targetBoardScale = (animState.blackboardActive && !animState.clonesOnlyMode) ? 1.0 : 0.0;
    animState.blackboardScale += (targetBoardScale - animState.blackboardScale) * Math.min(1.0, safeDt * 7.0);

    if (animState.blackboardScale > 0.01) {
      blackboardContainer.visible = true;
      const bs = animState.blackboardScale * s;
      const cosYaw = Math.cos(facingYaw);
      const sinYaw = Math.sin(facingYaw);
      const localBX = 1.96 * s;
      const localBZ = 0.25 * s;
      const worldBX = localBX * cosYaw + localBZ * sinYaw;
      const worldBZ = -localBX * sinYaw + localBZ * cosYaw;

      blackboardContainer.position.set(
        anchorPos.x + worldBX,
        anchorPos.y + 0.16 * s + Math.sin(animState.time * 2.2) * 0.03 * s,
        anchorPos.z + worldBZ
      );
      blackboardContainer.scale.setScalar(bs);
      blackboardContainer.rotation.y = facingYaw - 0.26;

      if (pointerStickGroup.visible) {
        pointerStickGroup.rotation.z = Math.sin(animState.time * 5.5) * 0.18;
        pointerStickGroup.rotation.x = Math.cos(animState.time * 4.0) * 0.12;
      }
      if (vivaMedalGroup.visible) {
        vivaMedalGroup.rotation.y = animState.time * 3.2;
        vivaMedalGroup.position.y = 0.86 + Math.abs(Math.sin(animState.time * 5.0)) * 0.08;
      }
    } else {
      blackboardContainer.visible = false;
      pointerStickGroup.visible = false;
    }
  }

  return {
    root,
    group: root,
    friendsContainer,
    soldiersContainer,
    rainContainer,
    bubblesContainer,
    butterfliesContainer,
    hologramContainer,
    blackboardContainer,
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
    summonFriends,
    dismissFriends,
    calmFriendsAndKeep,
    setClonesOnlyMode,
    scoldClonesLineUp,
    releaseClonesToPlay,
    triggerCloneInteraction,
    clickCloneMesh,
    isClonesOnlyMode: () => animState.clonesOnlyMode,
    isClonesScolded: () => animState.clonesScolded,
    showHologram,
    hideHologram,
    updateBlackboardViva,
    hideBlackboardViva,
    summonSoldiers,
    triggerSoldiersFight,
    dismissSoldiers,
    toggleAccessory,
    setWeatherState,
    spawnBubbles,
    popBubbleMesh,
    stopAction,
    playAction,
    isPouting: () => animState.isPouting,
    isTickled: () => animState.isTickled,
    getPoutHoldTime: () => animState.poutHoldTimer,
    setOnPoutDeflate: (cb) => { onPoutDeflateCallback = cb; },
    setOnFriendsMischief: (cb) => { onFriendsMischiefCallback = cb; },
    setOnWetShake: (cb) => { onWetShakeCallback = cb; },
    setOnCloneClick: (cb) => { onCloneClickCallback = cb; },
    placeAt,
    resetPlacement,
    isPlaced: () => isPlaced,
    getAnchorPosition: () => anchorPos,
    emotionEngine,
    getEmotionEngine: () => emotionEngine,
    feedEmotionStimulus: (type, intensity) => emotionEngine.feedStimulus(type, intensity),
    update
  };
}

