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

// Singleton para reutilizar materiais, geometrias e meshes de estilhaços (Object Pooling)
const sharedShardMaterial = createShardMaterial();
const sharedTetrahedronGeo = new THREE.TetrahedronGeometry(1);
const sharedBoxGeo = new THREE.BoxGeometry(1, 0.6, 0.8);

const MAX_POOL_SHARDS = 140;

class GlassShardPoolManager {
  private pool: GlassShard[] = [];
  private initialized = false;

  public initPool(scene: THREE.Scene) {
    if (this.initialized) return;
    this.initialized = true;
    for (let i = 0; i < MAX_POOL_SHARDS; i++) {
      const isTetra = i % 2 === 0;
      const geo = isTetra ? sharedTetrahedronGeo : sharedBoxGeo;
      const mesh = new THREE.Mesh(geo, sharedShardMaterial);
      mesh.visible = false;
      mesh.castShadow = true;
      scene.add(mesh);
      this.pool.push({
        mesh,
        velocity: new THREE.Vector3(),
        rotVelocity: new THREE.Vector3(),
        life: 0,
      });
    }
  }

  public obtainShard(
    scene: THREE.Scene,
    pos: THREE.Vector3,
    scale: THREE.Vector3,
    rot: THREE.Euler,
    vel: THREE.Vector3,
    rotVel: THREE.Vector3,
    life: number
  ): GlassShard {
    this.initPool(scene);
    let shard = this.pool.find((s) => !s.mesh.visible);
    if (!shard) {
      // Re-use oldest active shard if pool exhausted
      shard = this.pool[0];
    }
    shard.mesh.position.copy(pos);
    shard.mesh.scale.copy(scale);
    shard.mesh.rotation.copy(rot);
    shard.mesh.visible = true;
    shard.velocity.copy(vel);
    shard.rotVelocity.copy(rotVel);
    shard.life = life;
    return shard;
  }

  public recycleShard(shard: GlassShard) {
    shard.mesh.visible = false;
    shard.life = 0;
  }

  public clearAll() {
    this.pool.forEach((s) => {
      s.mesh.visible = false;
      s.life = 0;
    });
  }
}

export const shardPool = new GlassShardPoolManager();

/**
 * Estilhaça o corpo REAL do inimigo usando geometrias, materiais e pool de meshes pré-alocados.
 */
export const spawnEnemyShatterShards = (
  scene: THREE.Scene,
  enemy: Enemy,
  hitDirection: THREE.Vector3
): GlassShard[] => {
  shardPool.initPool(scene);
  const shards: GlassShard[] = [];
  enemy.root.updateMatrixWorld(true);

  const parts: THREE.Mesh[] = [
    enemy.head, enemy.neck, enemy.chest, enemy.waist,
    enemy.leftUpperArm, enemy.leftForearm, enemy.rightUpperArm, enemy.rightForearm,
    enemy.leftThigh, enemy.leftCalf, enemy.rightThigh, enemy.rightCalf,
  ].filter((p) => p && p.parent);

  const hitFlat = new THREE.Vector3(hitDirection.x, 0, hitDirection.z).normalize();
  const worldScale = new THREE.Vector3();

  parts.forEach((part) => {
    if (!part.geometry.boundingBox) part.geometry.computeBoundingBox();
    const bb = part.geometry.boundingBox!;
    const size = new THREE.Vector3();
    bb.getSize(size);
    part.getWorldScale(worldScale);
    const dim = Math.max(0.1, Math.min(size.x * worldScale.x, size.y * worldScale.y, size.z * worldScale.z));
    const pieces = part === enemy.head || part === enemy.chest ? 7 : 4;

    for (let j = 0; j < pieces; j++) {
      const local = new THREE.Vector3(
        bb.min.x + Math.random() * size.x,
        bb.min.y + Math.random() * size.y,
        bb.min.z + Math.random() * size.z
      );
      const worldPos = part.localToWorld(local);
      const s = dim * (0.28 + Math.random() * 0.3);
      const isTetra = j % 2 === 0;

      const scale = new THREE.Vector3(s, isTetra ? s : s * 0.6, isTetra ? s : s * 0.8);
      const rot = new THREE.Euler(Math.random() * 6, Math.random() * 6, Math.random() * 6);

      const outward = worldPos.clone().sub(enemy.position);
      outward.y = 0;
      outward.normalize();

      const vel = new THREE.Vector3(
        outward.x * (1.5 + Math.random() * 2.0) + hitFlat.x * (5.5 + Math.random() * 4.5),
        2.0 + Math.random() * 4.0,
        outward.z * (1.5 + Math.random() * 2.0) + hitFlat.z * (5.5 + Math.random() * 4.5)
      );

      const rotVel = new THREE.Vector3(
        (Math.random() - 0.5) * 18,
        (Math.random() - 0.5) * 18,
        (Math.random() - 0.5) * 18
      );

      const shard = shardPool.obtainShard(scene, worldPos, scale, rot, vel, rotVel, 9.0);
      shards.push(shard);
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
  shardPool.initPool(scene);
  const shards: GlassShard[] = [];

  for (let i = 0; i < 12; i++) {
    const size = 0.08 + Math.random() * 0.12;
    const isTetra = i % 2 === 0;
    const pos = new THREE.Vector3(
      enemy.position.x + (Math.random() - 0.5) * 0.3,
      0.3 + Math.random() * 0.3,
      enemy.position.z + (Math.random() - 0.5) * 0.3
    );
    const scale = new THREE.Vector3(size, isTetra ? size : size * 0.6, isTetra ? size : size * 0.8);
    const rot = new THREE.Euler(Math.random() * 6, Math.random() * 6, Math.random() * 6);
    const vel = new THREE.Vector3((Math.random() - 0.5) * 3, 1.5 + Math.random() * 2, (Math.random() - 0.5) * 3);
    const rotVel = new THREE.Vector3((Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12);

    const shard = shardPool.obtainShard(scene, pos, scale, rot, vel, rotVel, 6.0);
    shards.push(shard);
  }

  return shards;
};
