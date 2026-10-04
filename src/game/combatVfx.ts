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

const flashGeo = new THREE.IcosahedronGeometry(0.12, 1);
const flashMat = new THREE.MeshBasicMaterial({
  color: 0xffffff,
  transparent: true,
  opacity: 0.95,
  depthWrite: false,
});

const sparkGeo = new THREE.BoxGeometry(0.02, 0.02, 0.08);
const sparkMat = new THREE.MeshBasicMaterial({
  color: 0xff3322,
  transparent: true,
  opacity: 0.9,
  depthWrite: false,
});

const dustGeo = new THREE.DodecahedronGeometry(0.04, 0);
const dustMat = new THREE.MeshBasicMaterial({
  color: 0xcccccc,
  transparent: true,
  opacity: 0.6,
  depthWrite: false,
});

/**
 * Dispara um Muzzle Flash com núcleo branco cintilante, fagulhas e iluminação pontual instantânea
 */
export const spawnMuzzleFlashVfx = (
  scene: THREE.Scene,
  position: THREE.Vector3,
  direction: THREE.Vector3
) => {
  // 1. Núcleo Flash irregular rápido
  const flashMesh = new THREE.Mesh(flashGeo, flashMat.clone());
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

  // 2. Partículas minúsculas de disparo (Fagulhas)
  for (let i = 0; i < 4; i++) {
    const sMesh = new THREE.Mesh(sparkGeo, sparkMat.clone());
    sMesh.position.copy(position);
    const pDir = direction.clone().add(new THREE.Vector3(
      (Math.random() - 0.5) * 0.4,
      (Math.random() - 0.5) * 0.4,
      (Math.random() - 0.5) * 0.4
    )).normalize();
    sMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), pDir);
    scene.add(sMesh);

    activeVfxParticles.push({
      mesh: sMesh,
      velocity: pDir.multiplyScalar(6.0 + Math.random() * 4.0),
      life: 0.08 + Math.random() * 0.05,
      maxLife: 0.12,
      scaleStart: 1.0,
      scaleEnd: 0.1,
      type: 'spark',
    });
  }

  // 3. Luz pontual instantânea (1 frame) na parede/superfície próxima
  const flashLight = new THREE.PointLight(0xfff0dd, 4.0, 3.5);
  flashLight.position.copy(position);
  scene.add(flashLight);
  setTimeout(() => {
    scene.remove(flashLight);
  }, 35);
};

/**
 * Cria o efeito de Impacto do Projétil: Flash branco -> Glow Vermelho -> Poeira e Fragmentos
 */
export const spawnBulletImpactVfx = (
  scene: THREE.Scene,
  position: THREE.Vector3,
  normal: THREE.Vector3
) => {
  // Flash branco de impacto
  const iFlash = new THREE.Mesh(flashGeo, flashMat.clone());
  iFlash.position.copy(position).addScaledVector(normal, 0.05);
  iFlash.scale.setScalar(0.8);
  scene.add(iFlash);

  activeVfxParticles.push({
    mesh: iFlash,
    velocity: normal.clone().multiplyScalar(0.2),
    life: 0.05,
    maxLife: 0.05,
    scaleStart: 0.9,
    scaleEnd: 0.05,
    type: 'flash',
  });

  // Fagulhas e Poeira de concreto/parede
  for (let i = 0; i < 6; i++) {
    const isDust = i % 2 === 0;
    const mesh = new THREE.Mesh(isDust ? dustGeo : sparkGeo, isDust ? dustMat.clone() : sparkMat.clone());
    mesh.position.copy(position);

    const outDir = normal.clone().add(new THREE.Vector3(
      (Math.random() - 0.5) * 0.8,
      (Math.random() - 0.5) * 0.8,
      (Math.random() - 0.5) * 0.8
    )).normalize();

    scene.add(mesh);

    activeVfxParticles.push({
      mesh,
      velocity: outDir.multiplyScalar((isDust ? 1.5 : 4.5) + Math.random() * 2.0),
      life: 0.15 + Math.random() * 0.15,
      maxLife: 0.3,
      scaleStart: 1.0,
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

    const t = Math.max(0, p.life / p.maxLife);
    p.mesh.position.addScaledVector(p.velocity, gameDt);
    p.velocity.multiplyScalar(Math.max(0, 1 - 3.5 * gameDt));

    const s = THREE.MathUtils.lerp(p.scaleEnd, p.scaleStart, t);
    p.mesh.scale.setScalar(s);

    const mat = p.mesh.material as THREE.MeshBasicMaterial;
    if (mat && mat.transparent) {
      mat.opacity = t;
    }
  }
};
