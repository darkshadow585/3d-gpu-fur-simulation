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
  getActiveVocalEnvelope
} from './soundEffects.js';

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

    // Glossy 3D Watery Tear Pool at lower eyelid + Falling Teardrops for 'cry' ("akho se aansu aaye")
    const tearMat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#7dd3fc'),
      emissive: new THREE.Color('#38bdf8'),
      emissiveIntensity: 0.35,
      roughness: 0.02,
      metalness: 0.05,
      transmission: 0.65,
      transparent: true,
      opacity: 0.92,
      clearcoat: 1.0
    });

    const tearPoolGeo = new THREE.SphereGeometry(0.052, 16, 12);
    tearPoolGeo.scale(2.1, 0.55, 0.72);
    const tearPool = new THREE.Mesh(tearPoolGeo, tearMat);
    tearPool.position.set(0, -0.105, 0.105);
    tearPool.visible = false;
    eyePivot.add(tearPool);

    const tearDrops = [];
    for (let t = 0; t < 2; t++) {
      const dropGeo = new THREE.SphereGeometry(0.038, 14, 12);
      dropGeo.scale(0.82, 1.45, 0.72);
      const dropMesh = new THREE.Mesh(dropGeo, tearMat);
      dropMesh.visible = false;
      faceGroup.add(dropMesh);
      tearDrops.push({
        mesh: dropMesh,
        phase: t * 0.5 + (side > 0 ? 0.25 : 0.0),
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
    isRaining: false,
    hasUmbrella: false,
    umbrellaScale: 0.0,
    wetness: 0.0,
    rainTimer: 0.0,
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
    if (!silent && canPlaySfx(90)) {
      playMochiBoopSound(1.0);
    }
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
    animState.boopImpulse = 0.65;
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
    if (canPlaySfx(80)) {
      playFriendsSpawnSound();
    }
  }

  function dismissFriends() {
    animState.friendsVisible = false;
    animState.friendsTimer = 0.0;
    animState.friendsRunningWild = false;
    animState.awaitingFriendDismissConfirm = false;
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
      if (next) animState.accessories.party_hat = false; // mutually exclusive hats
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
      if (canPlaySfx(80)) playWeatherSound('rain');
    } else if (mode === 'umbrella') {
      animState.weatherMode = 'umbrella';
      animState.hasUmbrella = true;
      umbrellaGroup.visible = true;
      animState.boopImpulse = 0.55;
      if (canPlaySfx(80)) playWeatherSound('umbrella');
    } else if (mode === 'rain_with_umbrella') {
      animState.weatherMode = 'umbrella';
      animState.isRaining = true;
      animState.hasUmbrella = true;
      animState.rainTimer = 18.0;
      rainContainer.visible = true;
      umbrellaGroup.visible = true;
      animState.boopImpulse = 0.55;
      if (canPlaySfx(80)) playWeatherSound('umbrella');
    } else if (mode === 'clear' || mode === 'stop_rain' || mode === 'sunny') {
      const wasWet = animState.wetness > 0.2 || animState.isRaining;
      animState.weatherMode = 'clear';
      animState.isRaining = false;
      animState.hasUmbrella = false;
      animState.rainTimer = 0.0;
      rainContainer.visible = false;
      if (wasWet) {
        // Shake off the water drops automatically!
        playAction('shake_fur', 2.2);
        if (typeof onWetShakeCallback === 'function') {
          onWetShakeCallback();
        }
      } else if (canPlaySfx(80)) {
        playMochiBoopSound(1.1);
      }
    }
  }

  function stopAction() {
    animState.activeAction = null;
    animState.actionTimer = 0.0;
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

    const safeDuration = Number.isFinite(duration) && duration > 0 ? Math.min(duration, 6.0) : 3.5;
    animState.activeAction = action;
    animState.actionTimer = safeDuration;

    switch (action) {
      case 'dance':
        animState.boopImpulse = 0.85;
        animState.isPouting = false;
        animState.targetCheekPuff = 0.0;
        if (canPlaySfx(80)) playDanceMusicBeat();
        break;
      case 'cry':
        animState.boopImpulse = 0.0;
        animState.isPouting = false;
        animState.targetCheekPuff = 0.0;
        if (canPlaySfx(80)) playCrySound();
        break;
      case 'laugh':
        trigger5SecTickle();
        if (canPlaySfx(80)) playMochiGiggleSound();
        break;
      case 'pout':
        trigger10SecPout();
        if (canPlaySfx(80)) playCutePoutSound();
        break;
      case 'sleep':
        animState.boopImpulse = 0.0;
        animState.targetCheekPuff = 0.0;
        animState.isPouting = false;
        if (canPlaySfx(80)) playSleepSound();
        break;
      case 'love':
        animState.boopImpulse = 0.8;
        animState.isPouting = false;
        animState.targetCheekPuff = 0.0;
        if (canPlaySfx(80)) playLoveKissSound();
        break;
      case 'peekaboo':
        animState.boopImpulse = 0.55;
        animState.isPouting = false;
        animState.targetCheekPuff = 0.0;
        if (canPlaySfx(80)) playPeekabooSound();
        break;
      case 'shake_fur':
        animState.boopImpulse = 0.75;
        animState.angularVelocity.y += 28.0;
        animState.wetness = 0.0;
        if (canPlaySfx(80)) playFurShakeSound();
        break;
      case 'happy_jump':
        animState.boopImpulse = 0.9;
        if (canPlaySfx(80)) playHappyJumpSound();
        break;
    }
  }

  function update(dt, pointerNDC, cameraPos = null, isARMode = false) {
    const safeDt = Math.min(Math.max(dt, 0.001), 0.05);
    animState.time += safeDt;

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
      }
    } else if (animState.activeAction !== null) {
      animState.activeAction = null;
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
      actSway = Math.sin(animState.time * 36.0) * 0.015 * s;
      actDroopX = 0.12 + Math.sin(animState.time * 8.0) * 0.03;
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
      // Cute shy crouch while hiding eyes, then pop up on "Peek-a-boo!"
      const isPopPhase = animState.actionTimer < 0.85;
      actHop = isPopPhase ? 0.12 * s : -0.05 * s;
      actSquash = isPopPhase ? 0.08 : -0.06;
      actTilt = Math.sin(animState.time * 6.0) * 0.08;
    } else if (act === 'shake_fur') {
      actYawOffset = Math.sin(animState.time * 38.0) * 0.36;
      actTilt = Math.cos(animState.time * 32.0) * 0.14;
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

    // Wetness makes Mochi slightly droopy until Umbrella opens or fur shakes!
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

    const bodyPuffX = 1.0 + puff * 0.18;
    const bodyPuffZ = 1.0 + puff * 0.15;
    const bodyPuffY = 1.0 - puff * 0.03;
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
        // Interpolate from side arms (0.85, -0.18, 0.55) to right over the eyes (0.29, 0.17, 1.08)
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
        // If umbrella is open, block raindrops hitting the umbrella canopy!
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
      blinkScaleY = 0.78 + Math.sin(animState.time * 24.0) * 0.06;
      eyeScaleX = 1.05;
    } else if (act === 'love') {
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
      const loveBoost = act === 'love' ? 0.35 : 0.0;
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

    if (act === 'love') {
      blushMat.color.set('#ff1e74');
      blushMat.opacity = 0.96;
      irisMaterial.color.set('#6b21a8');
    } else if (act === 'cry') {
      blushMat.color.set('#ff80ab');
      blushMat.opacity = 0.65;
      irisMaterial.color.set('#1e3a8a');
    } else {
      blushMat.color.set('#ff5c93');
      blushMat.opacity = Math.min(0.96, 0.52 + talkVol * 0.3 + tickle * 0.4 + puff * 0.44);
      irisMaterial.color.set('#3d285c');
    }

    if (mouthGroup) {
      if (act === 'cry') {
        mouthGroup.scale.set(0.85, -0.68 + Math.sin(animState.time * 18.0) * 0.12, 1.0);
        mouthGroup.position.set(0, 0.015, 1.045);
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
    const isLoving = act === 'love';

    for (const eye of eyes) {
      eye.pivot.scale.set(eyeScaleX, blinkScaleY, 1.0);

      const cryShimmerX = isCrying ? Math.sin(animState.time * 32.0 + eye.side) * 0.012 : 0.0;
      const cryShimmerY = isCrying ? Math.cos(animState.time * 28.0) * 0.012 : 0.0;
      const eyeLookOffsetX = puff > 0.08 ? -eye.side * 0.02 : -eye.side * 0.042 + animState.currentLook.x * 0.028;

      eye.catchlightMain.position.x = eyeLookOffsetX + cryShimmerX;
      eye.catchlightMain.position.y = 0.052 + animState.currentLook.y * 0.025 + cryShimmerY;
      const catchScale = isLoving ? 1.35 : (isCrying ? 1.25 : 1.0);
      eye.catchlightMain.scale.set(catchScale, 1.18 * catchScale, 0.32);

      eye.heartPupil.visible = isLoving;
      eye.sparkle1.visible = isLoving || isCrying;
      if (isLoving) {
        const beat = 1.15 + Math.sin(animState.time * 12.0) * 0.22;
        eye.heartPupil.scale.set(beat, beat, 1.0);
      }

      eye.tearPool.visible = isCrying;
      if (isCrying) {
        const poolPulse = 1.0 + Math.sin(animState.time * 14.0 + eye.side) * 0.18;
        eye.tearPool.scale.set(2.1 * poolPulse, 0.65 * poolPulse, 0.75);
      }

      for (const td of eye.tearDrops) {
        td.mesh.visible = isCrying;
        if (isCrying) {
          const tCycle = (animState.time * 1.45 + td.phase) % 1.0;
          const startX = td.side * 0.33;
          const startY = 0.06;
          const startZ = 0.99;

          const fallY = startY - tCycle * 0.56;
          const curveX = startX + td.side * Math.sin(tCycle * Math.PI) * 0.08;
          const curveZ = startZ + Math.sin(tCycle * Math.PI * 0.7) * 0.04 - tCycle * 0.08;

          td.mesh.position.set(curveX, fallY, curveZ);
          const dropScale = Math.sin(tCycle * Math.PI) * 1.15;
          td.mesh.scale.set(0.82 * dropScale, 1.45 * dropScale, 0.72 * dropScale);
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

      // After 4.5 seconds, Chintu Pintu Golu Molu start running around mischievously!
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

        // Playful running around ("idhar udhar bhage") when runningWild is active!
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
    update
  };
}

