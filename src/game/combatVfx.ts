import * as THREE from 'three';

export interface CombatVfxParticle {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
  scaleStart: number;
  scaleEnd: number;
  type: 'flash' | 'spark' | 'dust' | 'decal';
}

const activeVfxParticles: CombatVfxParticle[] = [];

// Shared singletons to prevent WebGL shader compilation stutters during gunfire
const flashGeo = new THREE.IcosahedronGeometry(0.12, 1);
const sharedFlashMat = new THREE.MeshBasicMaterial({
  color: 0xffffff,
  transparent: true,
  opacity: 0.95,
  depthWrite: false,
});

const sparkGeo = new THREE.BoxGeometry(0.02, 0.02, 0.08);
const sharedSparkMat = new THREE.MeshBasicMaterial({
  color: 0xff3322,
  transparent: true,
  opacity: 0.9,
  depthWrite: false,
});

const dustGeo = new THREE.DodecahedronGeometry(0.04, 0);
const sharedDustMat = new THREE.MeshBasicMaterial({
  color: 0xcccccc,
  transparent: true,
  opacity: 0.6,
  depthWrite: false,
});

const sharedMuzzleLight = new THREE.PointLight(0xfff0dd, 0, 4.0);
let lightAddedToScene = false;

/**
 * Dispara um Muzzle Flash com núcleo branco cintilante e fagulhas usando materiais singletons
 */
export const spawnMuzzleFlashVfx = (
  scene: THREE.Scene,
  position: THREE.Vector3,
  direction: THREE.Vector3
) => {
  if (!lightAddedToScene) {
    lightAddedToScene = true;
    scene.add(sharedMuzzleLight);
  }

  // 1. Núcleo Flash irregular rápido
  const flashMesh = new THREE.Mesh(flashGeo, sharedFlashMat);
  flashMesh.position.copy(position).addScaledVector(direction, 0.1);
  flashMesh.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
  flashMesh.scale.set(1.4, 0.8, 1.8);
  scene.add(flashMesh);

  activeVfxParticles.push({
    mesh: flashMesh,
    velocity: direction.clone().multiplyScalar(0.5),
    life: 0.04,
    maxLife: 0.04,
    scaleStart: 1.4,
    scaleEnd: 0.1,
    type: 'flash',
  });

  // 2. Partículas minúsculas de disparo (Fagulhas intensas)
  for (let i = 0; i < 6; i++) {
    const sMesh = new THREE.Mesh(sparkGeo, sharedSparkMat);
    sMesh.position.copy(position);
    const pDir = direction.clone().add(new THREE.Vector3(
      (Math.random() - 0.5) * 0.5,
      (Math.random() - 0.5) * 0.5,
      (Math.random() - 0.5) * 0.5
    )).normalize();
    sMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), pDir);
    scene.add(sMesh);

    activeVfxParticles.push({
      mesh: sMesh,
      velocity: pDir.multiplyScalar(6.0 + Math.random() * 4.5),
      life: 0.12 + Math.random() * 0.08,
      maxLife: 0.18,
      scaleStart: 1.2,
      scaleEnd: 0.1,
      type: 'spark',
    });
  }

  // 3. Luz pontual reutilizável sem recompilação de shader
  sharedMuzzleLight.position.copy(position);
  sharedMuzzleLight.intensity = 5.0;
  setTimeout(() => {
    sharedMuzzleLight.intensity = 0;
  }, 40);
};

/**
 * Cria o efeito de Impacto do Projétil sem clonagem ou destruição de materiais
 */
export const spawnBulletImpactVfx = (
  scene: THREE.Scene,
  position: THREE.Vector3,
  normal: THREE.Vector3
) => {
  // Flash branco de impacto
  const iFlash = new THREE.Mesh(flashGeo, sharedFlashMat);
  iFlash.position.copy(position).addScaledVector(normal, 0.05);
  iFlash.scale.setScalar(0.9);
  scene.add(iFlash);

  activeVfxParticles.push({
    mesh: iFlash,
    velocity: normal.clone().multiplyScalar(0.3),
    life: 0.06,
    maxLife: 0.06,
    scaleStart: 1.0,
    scaleEnd: 0.05,
    type: 'flash',
  });

  // Fagulhas e Poeira de concreto (6 partículas)
  for (let i = 0; i < 6; i++) {
    const isDust = i % 2 === 0;
    const mesh = new THREE.Mesh(isDust ? dustGeo : sparkGeo, isDust ? sharedDustMat : sharedSparkMat);
    mesh.position.copy(position);

    const outDir = normal.clone().add(new THREE.Vector3(
      (Math.random() - 0.5) * 0.85,
      (Math.random() - 0.5) * 0.85,
      (Math.random() - 0.5) * 0.85
    )).normalize();

    scene.add(mesh);

    activeVfxParticles.push({
      mesh,
      velocity: outDir.multiplyScalar((isDust ? 1.8 : 5.0) + Math.random() * 2.5),
      life: 0.18 + Math.random() * 0.15,
      maxLife: 0.32,
      scaleStart: 1.2,
      scaleEnd: 0.0,
      type: isDust ? 'dust' : 'spark',
    });
  }
};

/**
 * Atualiza todas as partículas de combate por tick da física
 */
export const updateCombatVfx = (scene: THREE.Scene, gameDt: number) => {
  for (let i = activeVfxParticles.length - 1; i >= 0; i--) {
    const p = activeVfxParticles[i];
    p.life -= gameDt;

    if (p.life <= 0) {
      scene.remove(p.mesh);
      activeVfxParticles.splice(i, 1);
      continue;
    }

    p.mesh.position.addScaledVector(p.velocity, gameDt);
    const progress = 1 - (p.life / p.maxLife);
    const curScale = THREE.MathUtils.lerp(p.scaleStart, p.scaleEnd, progress);
    p.mesh.scale.setScalar(curScale);
  }
};
