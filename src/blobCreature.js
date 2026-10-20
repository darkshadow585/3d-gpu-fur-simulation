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
  // 1. MINI FRIEND CLONES ("Chintu, Pintu, Golu, Molu" — well separated + mischief!)
  // =========================================================================
  const friendsContainer = new THREE.Group();
  friendsContainer.name = 'MochiMiniFriends';
  friendsContainer.visible = false;

  const miniBodyGeo = createOrganicBlobGeometry(44, 32);
  // Placed well-separated around Mochi so they never overlap or crowd each other!
  const FRIEND_CONFIGS = [
    {
      name: 'Chintu',
      baseColor: '#d97706',
      tipColor: '#fef08a',
      blushColor: '#fb7185',
      offsetX: -1.95,
      offsetZ: 0.15,
      scale: 0.33,
      yaw: 0.42,
      phaseOffset: 0.0
    },
    {
      name: 'Pintu',
      baseColor: '#2563eb',
      tipColor: '#a5f3fc',
      blushColor: '#f472b6',
      offsetX: 1.95,
      offsetZ: 0.15,
      scale: 0.34,
      yaw: -0.42,
      phaseOffset: 1.5
    },
    {
      name: 'Golu',
      baseColor: '#15803d',
      tipColor: '#bbf7d0',
      blushColor: '#fda4af',
      offsetX: -1.18,
      offsetZ: 1.18,
      scale: 0.28,
      yaw: 0.28,
      phaseOffset: 3.1
    },
    {
      name: 'Molu',
      baseColor: '#7e22ce',
      tipColor: '#f5d0fe',
      blushColor: '#ff5c93',
      offsetX: 1.18,
      offsetZ: 1.18,
      scale: 0.29,
      yaw: -0.28,
      phaseOffset: 4.6
    }
  ];

  const miniFriends = [];
  for (let i = 0; i < FRIEND_CONFIGS.length; i++) {
    const cfg = FRIEND_CONFIGS[i];
    const fGroup = new THREE.Group();
    fGroup.name = `MiniFriend_${cfg.name}`;

    const fSkinMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(cfg.baseColor),
      roughness: 0.65,
      metalness: 0.04
    });
    const fBody = new THREE.Mesh(miniBodyGeo, fSkinMat);
    fBody.castShadow = true;
    fBody.receiveShadow = true;
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
    fGroup.add(fMouth);

    fGroup.scale.set(0.001, 0.001, 0.001);
    friendsContainer.add(fGroup);
    miniFriends.push({
      group: fGroup,
      eyes: fEyes,
      mouth: fMouth,
      cfg,
      spawnProgress: 0.0,
      runOffsetX: 0.0,
      runOffsetZ: 0.0
    });
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
    accessories: {
      crown: false,
      party_hat: false,
      bowtie: false,
      sunglasses: false
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

  function toggleAccessory(item, state = undefined) {
    const key = String(item || '').toLowerCase().trim();
    if (key === 'remove_all' || key === 'none' || key === 'clear') {
      animState.accessories.crown = false;
      animState.accessories.party_hat = false;
      animState.accessories.bowtie = false;
      animState.accessories.sunglasses = false;
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
    } else if (key.includes('glass') || key.includes('chashma') || key.includes('goggles') || key.includes('shades')) {
      animState.accessories.sunglasses = state !== undefined ? Boolean(state) : !animState.accessories.sunglasses;
    }

    crownGroup.visible = animState.accessories.crown;
    partyHatGroup.visible = animState.accessories.party_hat;
    bowtieGroup.visible = animState.accessories.bowtie;
    glassesGroup.visible = animState.accessories.sunglasses;
    animState.boopImpulse = 0.55;
    if (canPlaySfx(80)) {
      playAccessoryEquipSound();
    }
    return animState.accessories;
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
    treatGroup.visible = false;
    dryerGroup.visible = false;
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
    if (action === 'keep_friends') {
      calmFriendsAndKeep();
      return;
    }
    if (action === 'bubbles') {
      spawnBubbles(16.0);
      return;
    }

    const safeDuration = Number.isFinite(duration) && duration > 0 ? Math.min(duration, 6.0) : 3.8;
    animState.activeAction = action;
    animState.actionTimer = safeDuration;

    switch (action) {
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
      eye.pivot.scale.set(eyeScaleX, blinkScaleY, 1.0);

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
    // UPDATE MINI FRIENDS (Chintu, Pintu, Golu, Molu — spread out & running around!)
    // =========================================================================
    if (animState.friendsVisible) {
      animState.friendsActiveTime += safeDt;

      if (animState.friendsActiveTime >= 4.5 && !animState.friendsMischiefTriggered) {
        animState.friendsMischiefTriggered = true;
        animState.friendsRunningWild = true;
        animState.awaitingFriendDismissConfirm = true;
        if (typeof onFriendsMischiefCallback === 'function') {
          onFriendsMischiefCallback();
        }
      }

      if (animState.friendsTimer > 0) {
        animState.friendsTimer -= safeDt;
        if (animState.friendsTimer <= 0) {
          animState.friendsTimer = 0.0;
          animState.friendsVisible = false;
        }
      }
    }

    let anyFriendVisible = false;
    for (let i = 0; i < miniFriends.length; i++) {
      const mf = miniFriends[i];
      const targetSpawn = animState.friendsVisible ? 1.0 : 0.0;
      mf.spawnProgress += (targetSpawn - mf.spawnProgress) * Math.min(1.0, safeDt * 6.5);

      if (mf.spawnProgress > 0.01) {
        anyFriendVisible = true;
        mf.group.visible = true;
        const cfg = mf.cfg;
        const p = mf.spawnProgress;
        const friendScale = cfg.scale * s * p;
        const fTime = animState.time * 5.2 + cfg.phaseOffset;

        const isRunning = animState.friendsRunningWild;
        const targetRunX = isRunning ? Math.sin(animState.time * (2.6 + i * 0.45) + cfg.phaseOffset) * 0.62 : 0.0;
        const targetRunZ = isRunning ? Math.cos(animState.time * (2.2 + i * 0.35) + cfg.phaseOffset) * 0.42 : 0.0;
        mf.runOffsetX += (targetRunX - mf.runOffsetX) * Math.min(1.0, safeDt * 4.5);
        mf.runOffsetZ += (targetRunZ - mf.runOffsetZ) * Math.min(1.0, safeDt * 4.5);

        const isDancing = act === 'dance';
        const hopAmp = isDancing ? 0.22 : (isRunning ? 0.16 : 0.09);
        const hopFreq = isDancing ? animState.time * 11.5 : (isRunning ? animState.time * 9.5 : fTime);
        const fHop = Math.abs(Math.sin(hopFreq + cfg.phaseOffset)) * hopAmp * s * p;
        const fSway = Math.sin((isDancing ? animState.time * 5.75 : fTime * 0.5) + cfg.phaseOffset) * (isDancing ? 0.12 : 0.05) * s;
        const fSquash = 1.0 + Math.sin(hopFreq * 2.0) * (isDancing || isRunning ? 0.14 : 0.06);

        const cosYaw = Math.cos(facingYaw);
        const sinYaw = Math.sin(facingYaw);
        const localX = (cfg.offsetX + mf.runOffsetX) * s * p + fSway;
        const localZ = (cfg.offsetZ + mf.runOffsetZ) * s * p;
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

        const runTurnYaw = isRunning ? Math.cos(animState.time * (2.6 + i * 0.45) + cfg.phaseOffset) * 0.55 : 0.0;
        mf.group.rotation.y = facingYaw + cfg.yaw + runTurnYaw + Math.sin(fTime * 0.7) * 0.15;
        mf.group.rotation.z = Math.sin(fTime * 0.5) * (isDancing || isRunning ? 0.28 : 0.12);
        mf.group.rotation.x = facingPitch + talkNod * 0.8;

        for (const fEye of mf.eyes) {
          fEye.scale.y = blinkScaleY;
        }
      } else {
        mf.group.visible = false;
      }
    }
    friendsContainer.visible = anyFriendVisible;
  }

  return {
    root,
    friendsContainer,
    rainContainer,
    bubblesContainer,
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

