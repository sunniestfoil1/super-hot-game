import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

let template: THREE.Group | null = null;
let loadPromise: Promise<THREE.Group> | null = null;

const EYES_URL = '/models/procedural_eyes_for_ray_ii.glb';

export function loadEyesTemplate(): Promise<THREE.Group> {
  if (template) return Promise.resolve(template);
  if (loadPromise) return loadPromise;

  const loader = new GLTFLoader();
  loadPromise = new Promise((resolve, reject) => {
    loader.load(
      EYES_URL,
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

function findNamed(root: THREE.Object3D, name: string): THREE.Object3D | null {
  let found: THREE.Object3D | null = null;
  root.traverse((o) => {
    if (!found && o.name === name) found = o;
  });
  return found;
}

/** One eye (L or R) from procedural_eyes_for_ray_ii.glb — no sphere fallback. */
export function createEyeMesh(side: 'L' | 'R', forEnemy = false): THREE.Group | null {
  if (!template) return null;

  const src = findNamed(template, side === 'L' ? 'EyeL' : 'EyeR');
  if (!src) return null;

  const eye = src.clone(true);
  const wrap = new THREE.Group();
  wrap.name = `eye-${side}`;
  wrap.add(eye);

  // Model is large Sketchfab units — shrink to socket / palm size
  const scale = forEnemy ? 0.0045 : 0.006;
  wrap.scale.setScalar(scale);

  wrap.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      const mesh = child as THREE.Mesh;
      mesh.frustumCulled = false;
      mesh.castShadow = true;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      const clonedMats = mats.map((m) => {
        const c = m.clone();
        if (forEnemy) {
          const std = c as THREE.MeshStandardMaterial;
          if (std.emissive) {
            std.emissive = new THREE.Color(0xff2200);
            std.emissiveIntensity = 1.4;
          }
        }
        return c;
      });
      mesh.material = Array.isArray(mesh.material) ? clonedMats : clonedMats[0];
    }
  });

  return wrap;
}

export function createBothEyesForEnemy(): { left: THREE.Group; right: THREE.Group } | null {
  const left = createEyeMesh('L', true);
  const right = createEyeMesh('R', true);
  if (!left || !right) return null;
  return { left, right };
}
