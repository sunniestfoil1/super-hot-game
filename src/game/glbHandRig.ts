import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import handBonesData from './handSkeletonBones.json';

export interface FingerCurlValues {
  thumb: number;   // 0 (aberto/relaxado) a 1 (totalmente fechado/flexionado)
  index: number;
  middle: number;
  ring: number;
  pinky: number;
}

export interface GlbRiggedHand {
  model: THREE.Group;
  skinnedMesh: THREE.SkinnedMesh | null;
  skeleton: THREE.Skeleton | null;
  bones: Map<string, THREE.Bone>;
  isLeft: boolean;
}

const BONE_DIGIT_MAP: Record<string, keyof FingerCurlValues> = {
  // Index
  Finger_Index1_04: 'index',
  Finger_Index2_05: 'index',
  Finger_Index3_06: 'index',
  Finger_Index_end_07: 'index',
  // Middle
  Finger_Middle1_08: 'middle',
  Finger_Middle2_09: 'middle',
  Finger_Middle3_010: 'middle',
  Finger_Middle_end_011: 'middle',
  // Ring
  Finger_Ring1_012: 'ring',
  Finger_Ring2_013: 'ring',
  Finger_Ring3_014: 'ring',
  Finger_Ring_end_015: 'ring',
  // Pinky
  Finger_Pinky1_016: 'pinky',
  Finger_Pinky2_017: 'pinky',
  Finger_Pinky3_018: 'pinky',
  Finger_Pinky_end_019: 'pinky',
  // Thumb
  Finger_Thumb1_020: 'thumb',
  Finger_Thumb2_021: 'thumb',
  Finger_Thumb3_022: 'thumb',
  Finger_Thumb_end_023: 'thumb',
};

// Tactical hand material — dark slate charcoal com resposta especular e leitura de forma
const tacticalHandMaterial = new THREE.MeshStandardMaterial({
  color: 0x22252c,
  roughness: 0.45,
  metalness: 0.35,
  emissive: 0x0c0e12,
  emissiveIntensity: 0.25,
  flatShading: false,
});

let cachedGltfScene: THREE.Group | null = null;
let loaderPromise: Promise<THREE.Group> | null = null;

export function loadGlbHandTemplate(): Promise<THREE.Group> {
  if (cachedGltfScene) return Promise.resolve(cachedGltfScene);
  if (loaderPromise) return loaderPromise;

  const loader = new GLTFLoader();
  loaderPromise = new Promise((resolve, reject) => {
    loader.load(
      '/models/the_hand.glb',
      (gltf) => {
        cachedGltfScene = gltf.scene;
        resolve(gltf.scene);
      },
      undefined,
      (err) => reject(err)
    );
  });
  return loaderPromise;
}

/**
 * Instantiates an articulated GLB Hand with individual anatomical finger joints
 */
export function createRiggedGlbHand(template: THREE.Group, isLeft: boolean): GlbRiggedHand {
  const cloned = SkeletonUtils.clone(template) as THREE.Group;

  const bonesMap = new Map<string, THREE.Bone>();
  let skinnedMesh: THREE.SkinnedMesh | null = null;

  cloned.traverse((child) => {
    if ((child as THREE.SkinnedMesh).isSkinnedMesh) {
      skinnedMesh = child as THREE.SkinnedMesh;
      skinnedMesh.material = tacticalHandMaterial;
      skinnedMesh.castShadow = true;
      skinnedMesh.receiveShadow = true;
      skinnedMesh.frustumCulled = false; // Prevent premature culling in first-person camera
    }
    if ((child as THREE.Bone).isBone || child.name.includes('Finger') || child.name.includes('Hand') || child.name.includes('Root')) {
      bonesMap.set(child.name, child as THREE.Bone);
    }
  });

  // Scale:
  // FBX coordinates are ~120 units. With FBX 0.01 scale, it is 1.2 units in Three.js.
  // 0.18 scale brings it to ~0.20m (realistic human hand size in meters).
  const scale = 0.18;
  if (isLeft) {
    cloned.scale.set(scale, scale, -scale);
  } else {
    cloned.scale.set(scale, scale, scale);
  }

  // Fingers in the model point along +X.
  // Rotate around Y by +PI/2 so fingers face forward (-Z relative to camera)
  cloned.rotation.set(0, Math.PI / 2, isLeft ? -0.15 : 0.15);
  cloned.position.set(0, 0, 0);

  const maybeSkeleton = skinnedMesh ? (skinnedMesh as THREE.SkinnedMesh).skeleton ?? null : null;

  return {
    model: cloned,
    skinnedMesh,
    skeleton: maybeSkeleton,
    bones: bonesMap,
    isLeft,
  };
}

/**
 * Applies exact anatomical curl/pose to each finger joint using the author's keyframes
 */
export function setHandFingerCurls(hand: GlbRiggedHand, curls: FingerCurlValues) {
  const boneData = handBonesData as Record<string, { start: number[]; end: number[] }>;

  hand.bones.forEach((bone, name) => {
    const data = boneData[name];
    if (!data) return;

    const digit = BONE_DIGIT_MAP[name];
    const curl = digit ? curls[digit] ?? 0 : 0;

    const startQ = new THREE.Quaternion(...data.start);
    const endQ = new THREE.Quaternion(...data.end);

    // Smooth slerp from open posture (start) to clenched fist (end)
    bone.quaternion.copy(startQ).slerp(endQ, THREE.MathUtils.clamp(curl, 0, 1));
  });
}
