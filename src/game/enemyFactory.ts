import * as THREE from 'three';
import { Enemy, LevelConfig } from './types';
import { createGlbPartGeometry } from './geometryLoader';
import { createEyeMesh } from './eyeModel';
import { createPistolInstance } from './pistolModel';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';

const BOXING_FBX_URL = '/animations/Boxing.fbx';
const BOXING_SOCO_FBX_URL = '/animations/Boxing-soco.fbx';
const SILLY_DANCE_FBX_URL = '/animations/Silly Dancing.fbx';
const RIFLE_FIRE_FBX_URL = '/animations/Shooter Pack/rifle_fire.fbx';
const RIFLE_AIM_IDLE_FBX_URL = '/animations/Shooter Pack/rifle_aim_idle.fbx';
const RIFLE_RUN_FBX_URL = '/animations/Shooter Pack/rifle_run.fbx';
const WALKING_FBX_URL = '/animations/Shooter Pack/walking.fbx';
const WALKING_BACKWARDS_FBX_URL = '/animations/Shooter Pack/walking_backwards.fbx';

let boxingClip: THREE.AnimationClip | null = null;
let punchClip: THREE.AnimationClip | null = null;
let sillyDanceClip: THREE.AnimationClip | null = null;
let rifleFireClip: THREE.AnimationClip | null = null;
let rifleAimIdleClip: THREE.AnimationClip | null = null;
let rifleRunClip: THREE.AnimationClip | null = null;
let walkingClip: THREE.AnimationClip | null = null;
let walkingBackwardsClip: THREE.AnimationClip | null = null;
let clipsLoaded = false;
let clipsPromise: Promise<void> | null = null;

function isBoneName(name: string, keywords: string[]): boolean {
  const lower = name.toLowerCase();
  return keywords.some((k) => lower.includes(k));
}

function createClipWithTracks(
  source: THREE.AnimationClip | null,
  headKeywords: string[],
  handKeywords: string[]
): THREE.AnimationClip | null {
  if (!source) return null;

  const headTracks = source.tracks.filter((t) =>
    isBoneName(t.name || '', [...headKeywords, 'head'])
  );
  const handTracks = source.tracks.filter((t) =>
    isBoneName(t.name || '', [...handKeywords, 'hand', 'wrist', 'punch', 'fist'])
  );

  const merged = Array.from(new Set([...headTracks, ...handTracks]));
  if (merged.length === 0) return null;

  const clip = new THREE.AnimationClip(source.name || 'filtered', source.duration, merged);
  return clip;
}

function loadClips(): Promise<void> {
  if (clipsLoaded) return Promise.resolve();
  if (clipsPromise) return clipsPromise;

  const loader = new FBXLoader();
  clipsPromise = Promise.all([
    loader.loadAsync(BOXING_FBX_URL),
    loader.loadAsync(BOXING_SOCO_FBX_URL),
    loader.loadAsync(SILLY_DANCE_FBX_URL),
    loader.loadAsync(RIFLE_FIRE_FBX_URL),
    loader.loadAsync(RIFLE_AIM_IDLE_FBX_URL),
    loader.loadAsync(RIFLE_RUN_FBX_URL),
    loader.loadAsync(WALKING_FBX_URL),
    loader.loadAsync(WALKING_BACKWARDS_FBX_URL),
  ]).then(([boxingFbx, punchFbx, sillyFbx, rifleFireFbx, rifleAimIdleFbx, rifleRunFbx, walkingFbx, walkingBackwardsFbx]) => {
    boxingClip = boxingFbx.animations?.[0] ?? null;
    punchClip = punchFbx.animations?.[0] ?? null;

    const rawSilly = sillyFbx.animations?.[0] ?? null;
    if (rawSilly) {
      const headKeywords = ['head', 'neck', 'face', 'spine', 'spine_01', 'spine1', 'mixamorig:head'];
      const handKeywords = [
        'rightarm',
        'leftarm',
        'rightforearm',
        'leftforearm',
        'r_arm',
        'l_arm',
        'r_forearm',
        'l_forearm',
        'rightshoulder',
        'leftshoulder',
        'r_hand',
        'l_hand',
        'hand',
        'wrist',
        'fist',
      ];

      const headHandClip = createClipWithTracks(rawSilly, headKeywords, handKeywords);
      sillyDanceClip = headHandClip ?? rawSilly;
    }

    rifleFireClip = rifleFireFbx.animations?.[0] ?? null;
    rifleAimIdleClip = rifleAimIdleFbx.animations?.[0] ?? null;
    rifleRunClip = rifleRunFbx.animations?.[0] ?? null;
    walkingClip = walkingFbx.animations?.[0] ?? null;
    walkingBackwardsClip = walkingBackwardsFbx.animations?.[0] ?? null;

    clipsLoaded = true;
  }).catch((err) => {
    console.error('Failed to load FBX clips:', err);
  });

  return clipsPromise;
}

export const spawnEnemyEntity = async (
  scene: THREE.Scene,
  enemyCfg: LevelConfig['enemies'][0],
  idx: number,
  enemyActiveMat: THREE.Material
): Promise<Enemy> => {
  await loadClips();

  const root = new THREE.Group();
  root.position.set(...enemyCfg.pos);
  root.rotation.y = enemyCfg.yaw;

  // 1. Faceted Dissected Head (Low Poly Man GLB)
  const headGeo = createGlbPartGeometry('head', () => new THREE.IcosahedronGeometry(0.22, 0));
  const head = new THREE.Mesh(headGeo, enemyActiveMat);
  head.position.set(0, 1.65, 0);
  head.castShadow = true;

  // Official procedural eyes GLB (EyeL / EyeR) — no sphere fallback
  const eyeL = createEyeMesh('L', true);
  const eyeR = createEyeMesh('R', true);
  if (eyeL) {
    eyeL.position.set(-0.07, 0.04, 0.17);
    head.add(eyeL);
    const eyeLightL = new THREE.PointLight(0xff1100, 0.35, 0.5);
    eyeLightL.position.set(-0.07, 0.04, 0.22);
    head.add(eyeLightL);
  }
  if (eyeR) {
    eyeR.position.set(0.07, 0.04, 0.17);
    head.add(eyeR);
    const eyeLightR = new THREE.PointLight(0xff1100, 0.35, 0.5);
    eyeLightR.position.set(0.07, 0.04, 0.22);
    head.add(eyeLightR);
  }

  root.add(head);

  // 2. Neck
  const neckGeo = createGlbPartGeometry('neck', () => new THREE.CylinderGeometry(0.06, 0.08, 0.12, 6));
  const neck = new THREE.Mesh(neckGeo, enemyActiveMat);
  neck.position.set(0, 1.50, 0);
  root.add(neck);

  // 3. Angular Chest (Broad shoulders & Torso)
  const chestGeo = createGlbPartGeometry('chest', () => new THREE.BoxGeometry(0.52, 0.38, 0.26));
  const chest = new THREE.Mesh(chestGeo, enemyActiveMat);
  chest.position.set(0, 1.25, 0);
  chest.castShadow = true;
  root.add(chest);

  // 4. Tapered Waist & Pelvis
  const waistGeo = createGlbPartGeometry('waist', () => new THREE.BoxGeometry(0.38, 0.32, 0.22));
  const waist = new THREE.Mesh(waistGeo, enemyActiveMat);
  waist.position.set(0, 0.95, 0);
  waist.castShadow = true;
  root.add(waist);

  // 5. Left Arm
  const leftUpperArmGeo = createGlbPartGeometry('leftUpperArm', () => new THREE.BoxGeometry(0.12, 0.32, 0.12));
  const leftUpperArm = new THREE.Mesh(leftUpperArmGeo, enemyActiveMat);
  leftUpperArm.position.set(-0.26, 1.35, 0);
  leftUpperArm.castShadow = true;
  root.add(leftUpperArm);

  const leftForearmGeo = createGlbPartGeometry('leftForearm', () => new THREE.BoxGeometry(0.1, 0.34, 0.1));
  const leftForearm = new THREE.Mesh(leftForearmGeo, enemyActiveMat);
  leftForearm.position.set(-0.36, 1.10, 0);
  leftForearm.castShadow = true;
  root.add(leftForearm);

  // 6. Right Arm (Aiming / Guarding)
  const rightUpperArmGeo = createGlbPartGeometry('rightUpperArm', () => new THREE.BoxGeometry(0.12, 0.32, 0.12));
  const rightUpperArm = new THREE.Mesh(rightUpperArmGeo, enemyActiveMat);
  rightUpperArm.position.set(0.26, 1.35, 0);
  rightUpperArm.castShadow = true;
  root.add(rightUpperArm);

  const rightForearmGeo = createGlbPartGeometry('rightForearm', () => new THREE.BoxGeometry(0.1, 0.34, 0.1));
  const rightForearm = new THREE.Mesh(rightForearmGeo, enemyActiveMat);
  rightForearm.position.set(0.36, 1.10, 0);
  rightForearm.castShadow = true;
  root.add(rightForearm);

  // 7. Left Leg (Thigh + Calf)
  const leftThighGeo = createGlbPartGeometry('leftThigh', () => new THREE.BoxGeometry(0.16, 0.42, 0.16));
  const leftThigh = new THREE.Mesh(leftThighGeo, enemyActiveMat);
  leftThigh.position.set(-0.14, 0.82, 0);
  leftThigh.castShadow = true;
  root.add(leftThigh);

  const leftCalfGeo = createGlbPartGeometry('leftCalf', () => new THREE.BoxGeometry(0.14, 0.42, 0.14));
  const leftCalf = new THREE.Mesh(leftCalfGeo, enemyActiveMat);
  leftCalf.position.set(-0.14, 0.40, 0);
  leftCalf.castShadow = true;
  root.add(leftCalf);

  // 8. Right Leg (Thigh + Calf)
  const rightThighGeo = createGlbPartGeometry('rightThigh', () => new THREE.BoxGeometry(0.16, 0.42, 0.16));
  const rightThigh = new THREE.Mesh(rightThighGeo, enemyActiveMat);
  rightThigh.position.set(0.14, 0.82, 0);
  rightThigh.castShadow = true;
  root.add(rightThigh);

  const rightCalfGeo = createGlbPartGeometry('rightCalf', () => new THREE.BoxGeometry(0.14, 0.42, 0.14));
  const rightCalf = new THREE.Mesh(rightCalfGeo, enemyActiveMat);
  rightCalf.position.set(0.14, 0.40, 0);
  rightCalf.castShadow = true;
  root.add(rightCalf);

  // Enemy Gun — official pistol.glb on right forearm (no box)
  let gunMesh: THREE.Group | null = null;
  const hasGun = enemyCfg.hasWeapon ?? true;
  if (hasGun) {
    const pistol = createPistolInstance();
    if (pistol) {
      gunMesh = pistol.root;
      gunMesh.scale.setScalar(0.85);
      gunMesh.position.set(0, -0.18, 0.08);
      gunMesh.rotation.set(0.15, 0, 0);
      rightForearm.add(gunMesh);
    }
  }

  scene.add(root);

  const mixer = boxingClip || punchClip || sillyDanceClip ? new THREE.AnimationMixer(root) : null;

  const role = enemyCfg.role ?? (idx % 3 === 0 ? 'frontal' : idx % 3 === 1 ? 'flank_left' : 'flank_right');

  return {
    id: `enemy-${idx}`,
    root,
    head,
    neck,
    chest,
    waist,
    leftUpperArm,
    leftForearm,
    rightUpperArm,
    rightForearm,
    leftThigh,
    leftCalf,
    rightThigh,
    rightCalf,
    gunMesh,
    position: root.position,
    rotationY: enemyCfg.yaw,
    targetRotationY: enemyCfg.yaw,
    reactionTime: 0.45 + Math.random() * 0.3,
    reactionTimer: 0,
    spottedPlayer: false,
    alertState: 'calm',
    headYaw: 0,
    headPitch: 0,
    alertSoundTimer: 0,
    lastHeardPos: null,
    punchAttackTimer: 0,
    walkCycle: Math.random() * Math.PI * 2,
    state: 'idle',
    aimTimer: 0.8 + Math.random() * 0.4,
    shootCooldown: 2.0 + Math.random() * 0.8,
    walkSpeed: 2.3,
    alive: true,
    hasWeapon: hasGun,
    weaponType: enemyCfg.weaponType ?? 'pistol',
    stunTimer: 0,
    punchHitsReceived: 0,
    tacticalRole: role,
    dodgeCooldown: 0,
    dodgeVel: new THREE.Vector3(),
    legShattered: false,
    stumbleTimer: 0,
    boxCycle: Math.random() * Math.PI * 2,
    isBoxing: false,
    mixer,
    boxingClip,
    punchClip,
    sillyDanceClip,
    rifleFireClip,
    rifleAimIdleClip,
    rifleRunClip,
    walkingClip,
    walkingBackwardsClip,
    currentAction: null,
  };
};
