import * as THREE from 'three';
import { Enemy, GlassShard } from './types';

export const createShardMaterial = () => {
  return new THREE.MeshStandardMaterial({
    color: 0xff002b,
    emissive: 0xff0033,
    emissiveIntensity: 1.6, // High-intensity bloom glow
    roughness: 0.05,
    metalness: 0.98,
    transparent: true,
    opacity: 0.95,
    flatShading: true,
  });
};

export const createMicroParticleMaterial = () => {
  return new THREE.MeshBasicMaterial({
    color: 0xff1133,
    transparent: true,
    opacity: 0.85,
  });
};

/**
 * Creates 48 high-velocity faceted red crystalline shards + 24 micro-spark particles
 */
export const spawnEnemyShatterShards = (
  scene: THREE.Scene,
  enemy: Enemy,
  hitDirection: THREE.Vector3
): GlassShard[] => {
  const shards: GlassShard[] = [];
  const shardMat = createShardMaterial();
  const microMat = createMicroParticleMaterial();

  const limbOrigins = [
    { pos: new THREE.Vector3(0, 1.65, 0), weight: 12 }, // Skull / Head
    { pos: new THREE.Vector3(0, 1.25, 0), weight: 14 }, // Chest
    { pos: new THREE.Vector3(0, 0.95, 0), weight: 8 },  // Pelvis / Core
    { pos: new THREE.Vector3(-0.3, 1.2, 0), weight: 4 }, // Left arm
    { pos: new THREE.Vector3(0.3, 1.2, 0), weight: 4 },  // Right arm
    { pos: new THREE.Vector3(-0.15, 0.5, 0), weight: 3 }, // Left leg
    { pos: new THREE.Vector3(0.15, 0.5, 0), weight: 3 },  // Right leg
  ];

  limbOrigins.forEach(({ pos: offset, weight }) => {
    const centerWorld = enemy.position.clone().add(offset);
    for (let j = 0; j < weight; j++) {
      const size = 0.06 + Math.random() * 0.16;
      const shardGeo = j % 3 === 0
        ? new THREE.TetrahedronGeometry(size)
        : j % 3 === 1
        ? new THREE.OctahedronGeometry(size)
        : new THREE.BoxGeometry(size, size, size);
      const shardMesh = new THREE.Mesh(shardGeo, shardMat);

      shardMesh.position.set(
        centerWorld.x + (Math.random() - 0.5) * 0.25,
        centerWorld.y + (Math.random() - 0.5) * 0.25,
        centerWorld.z + (Math.random() - 0.5) * 0.25
      );
      shardMesh.castShadow = true;
      scene.add(shardMesh);

      // Radial explosive blast outward from impact center
      const blastOutward = shardMesh.position.clone().sub(enemy.position).normalize();
      const vel = new THREE.Vector3(
        blastOutward.x * (3.5 + Math.random() * 4.5) + hitDirection.x * 5.0,
        2.2 + Math.random() * 4.5 + blastOutward.y * 2.5,
        blastOutward.z * (3.5 + Math.random() * 4.5) + hitDirection.z * 5.0
      );

      const rotVel = new THREE.Vector3(
        (Math.random() - 0.5) * 28,
        (Math.random() - 0.5) * 28,
        (Math.random() - 0.5) * 28
      );

      shards.push({
        mesh: shardMesh,
        velocity: vel,
        rotVelocity: rotVel,
        life: 8.0,
      });
    }

    // Micro cristal particles floating in the air
    for (let k = 0; k < 3; k++) {
      const microGeo = new THREE.TetrahedronGeometry(0.02 + Math.random() * 0.03);
      const microMesh = new THREE.Mesh(microGeo, microMat);
      microMesh.position.set(
        centerWorld.x + (Math.random() - 0.5) * 0.2,
        centerWorld.y + (Math.random() - 0.5) * 0.2,
        centerWorld.z + (Math.random() - 0.5) * 0.2
      );
      scene.add(microMesh);

      shards.push({
        mesh: microMesh,
        velocity: new THREE.Vector3((Math.random() - 0.5) * 5, 2.0 + Math.random() * 3, (Math.random() - 0.5) * 5),
        rotVelocity: new THREE.Vector3((Math.random() - 0.5) * 20, (Math.random() - 0.5) * 20, (Math.random() - 0.5) * 20),
        life: 4.5,
      });
    }
  });

  return shards;
};

/**
 * Creates 12 leg shards when a specific limb is broken
 */
export const spawnLimbShatterShards = (
  scene: THREE.Scene,
  enemy: Enemy
): GlassShard[] => {
  const shards: GlassShard[] = [];
  const shardMat = createShardMaterial();

  for (let i = 0; i < 12; i++) {
    const size = 0.08 + Math.random() * 0.12;
    const shardGeo = i % 2 === 0
      ? new THREE.TetrahedronGeometry(size)
      : new THREE.BoxGeometry(size, size, size);
    const shardMesh = new THREE.Mesh(shardGeo, shardMat);

    shardMesh.position.set(
      enemy.position.x + (Math.random() - 0.5) * 0.3,
      0.3 + Math.random() * 0.3,
      enemy.position.z + (Math.random() - 0.5) * 0.3
    );
    scene.add(shardMesh);

    shards.push({
      mesh: shardMesh,
      velocity: new THREE.Vector3((Math.random() - 0.5) * 3, 1.5 + Math.random() * 2, (Math.random() - 0.5) * 3),
      rotVelocity: new THREE.Vector3((Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12),
      life: 6.0,
    });
  }

  return shards;
};
