import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export interface PistolInstance {
  root: THREE.Group;
  slide: THREE.Object3D | null;
  trigger: THREE.Object3D | null;
  slideRest: THREE.Vector3;
  triggerRestRot: THREE.Euler;
}

let template: THREE.Group | null = null;
let loadPromise: Promise<THREE.Group> | null = null;

const PISTOL_URL = '/models/pistol.glb';
/** Sketchfab units → ~0.28m barrel length in first-person */
const PISTOL_SCALE = 0.012;

export function loadPistolTemplate(): Promise<THREE.Group> {
  if (template) return Promise.resolve(template);
  if (loadPromise) return loadPromise;

  const loader = new GLTFLoader();
  loadPromise = new Promise((resolve, reject) => {
    loader.load(
      PISTOL_URL,
      (gltf) => {
        template = gltf.scene;
        resolve(template);
      },
      undefined,
      (err) => {
        loadPromise = null;
        reject(err);
      }
    );
  });
  return loadPromise;
}

function prepareMeshes(root: THREE.Object3D) {
  root.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      const mesh = child as THREE.Mesh;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;
      // Sem environment map, metalness alto = silhueta preta. Mantém texturas oficiais.
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      mats.forEach((m) => {
        const mat = m as THREE.MeshStandardMaterial;
        if (mat.isMeshStandardMaterial) {
          mat.metalness = Math.min(mat.metalness ?? 1, 0.45);
          mat.roughness = Math.max(mat.roughness ?? 0.4, 0.4);
          mat.envMapIntensity = 0.8;
          mat.needsUpdate = true;
        }
      });
    }
  });
}

export function createPistolInstance(): PistolInstance | null {
  if (!template) return null;

  const cloned = template.clone(true);
  prepareMeshes(cloned);

  // Barrel points -Z (camera forward). Model length is along +Z.
  cloned.rotation.set(0, Math.PI, 0);
  cloned.scale.setScalar(PISTOL_SCALE);
  cloned.position.set(0, -0.04, 0.04);

  const found = { slide: null as THREE.Object3D | null, trigger: null as THREE.Object3D | null };
  cloned.traverse((o) => {
    if (o.name === 'slide') found.slide = o;
    if (o.name === 'trigger') found.trigger = o;
  });

  // Sketchfab nodes bake transforms into .matrix with matrixAutoUpdate=false.
  // Decompose so we can animate position/rotation every frame.
  for (const part of [found.slide, found.trigger]) {
    if (!part) continue;
    part.matrix.decompose(part.position, part.quaternion, part.scale);
    part.matrixAutoUpdate = true;
  }

  const root = new THREE.Group();
  root.name = 'weapon-pistol';
  root.add(cloned);

  return {
    root,
    slide: found.slide,
    trigger: found.trigger,
    slideRest: found.slide ? found.slide.position.clone() : new THREE.Vector3(),
    triggerRestRot: found.trigger
      ? new THREE.Euler().setFromQuaternion(found.trigger.quaternion.clone())
      : new THREE.Euler(),
  };
}

/** Drive official slide + trigger from recoil amount (0→1-ish). */
export function applyPistolRecoil(pistol: PistolInstance, recoil: number) {
  const t = Math.min(1, Math.max(0, recoil * 4));
  if (pistol.slide) {
    // Slide kicks rearward along local +Z of the part
    pistol.slide.position.set(
      pistol.slideRest.x,
      pistol.slideRest.y,
      pistol.slideRest.z + t * 4.5
    );
  }
  if (pistol.trigger) {
    pistol.trigger.rotation.set(
      pistol.triggerRestRot.x + t * 0.45,
      pistol.triggerRestRot.y,
      pistol.triggerRestRot.z
    );
  }
}

export function createPistolWorldMesh(): THREE.Group | null {
  const inst = createPistolInstance();
  if (!inst) return null;
  inst.root.scale.setScalar(1);
  // World/dropped size: child already has PISTOL_SCALE
  return inst.root;
}
