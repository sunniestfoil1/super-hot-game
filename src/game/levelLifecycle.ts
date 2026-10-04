import * as THREE from 'three';
import { Bullet, Enemy, GlassShard, AirborneWeapon, DroppedWeapon, LevelConfig } from './types';
import { buildLevelEnvironment } from './levelBuilder';
import { spawnEnemyEntity } from './enemyFactory';
import { spawnFloorWeapon } from './weaponSpawner';

interface LevelResetParams {
  scene: THREE.Scene;
  worldGroup: THREE.Group;
  camera: THREE.PerspectiveCamera;
  config: LevelConfig;
  playerPos: THREE.Vector3;
  bullets: Bullet[];
  enemies: Enemy[];
  glassShards: GlassShard[];
  airborneWeapons: AirborneWeapon[];
  droppedWeapons: DroppedWeapon[];
  enemyActiveMat: THREE.Material;
}

export const resetLevelEntities = async (params: LevelResetParams): Promise<THREE.Box3[]> => {
  const {
    scene,
    worldGroup,
    camera,
    config,
    playerPos,
    bullets,
    enemies,
    glassShards,
    airborneWeapons,
    droppedWeapons,
    enemyActiveMat,
  } = params;

  camera.rotation.set(0, 0, 0);
  camera.position.copy(playerPos);

  // Clean entities from scene
  bullets.forEach((b) => {
    scene.remove(b.mesh);
    scene.remove(b.trailMesh);
  });
  bullets.length = 0;

  enemies.forEach((e) => scene.remove(e.root));
  enemies.length = 0;

  glassShards.forEach((g) => scene.remove(g.mesh));
  glassShards.length = 0;

  airborneWeapons.forEach((w) => scene.remove(w.group));
  airborneWeapons.length = 0;

  droppedWeapons.forEach((d) => scene.remove(d.group));
  droppedWeapons.length = 0;

  // Build Environment
  const wallBoxes = await buildLevelEnvironment(worldGroup, config);

  // Spawn Enemies
  const enemyPromises = config.enemies.map((enemyCfg, idx) => spawnEnemyEntity(scene, enemyCfg, idx, enemyActiveMat));
  const spawnedEnemies = await Promise.all(enemyPromises);
  spawnedEnemies.forEach((enemy) => enemies.push(enemy));

  // Floor Pickups
  config.pickups.forEach((p, idx) => {
    const dw = spawnFloorWeapon(scene, new THREE.Vector3(...p.pos), p.type, p.ammo, `pickup-${idx}`);
    droppedWeapons.push(dw);
  });

  return wallBoxes;
};
