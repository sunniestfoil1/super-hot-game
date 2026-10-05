import * as THREE from 'three';
import { Enemy, GlassShard } from './types';
import { spawnEnemyShatterShards, spawnLimbShatterShards } from './shatterEffect';
import { spawnEnemyEmissiveDissolveGhost } from './emissiveDissolveEffect';
import { superhotSound } from '../audio/SuperhotAudio';

export interface EnemyDestructionParams {
  scene: THREE.Scene;
  enemy: Enemy;
  dtFactor: number;
  glassShards: GlassShard[];
  onDisarm?: (enemy: Enemy) => void;
  onClearCheck?: () => void;
}

export function executeEnemyLimbShatter(params: EnemyDestructionParams, isLeft: boolean) {
  const { scene, enemy, dtFactor, glassShards } = params;
  if (!enemy.alive) return;

  enemy.legShattered = true;
  enemy.state = 'stumbling';
  enemy.stumbleTimer = 1.8;

  if (isLeft) {
    enemy.root.remove(enemy.leftCalf);
  } else {
    enemy.root.remove(enemy.rightCalf);
  }

  enemy.leftThigh.rotation.x = isLeft ? 0.95 : -0.2;
  enemy.rightThigh.rotation.x = !isLeft ? 0.95 : -0.2;
  enemy.chest.position.y = 0.95;

  superhotSound.playPunchImpact(dtFactor);

  const shards = spawnLimbShatterShards(scene, enemy);
  glassShards.push(...shards);
}

export function executeEnemyFullShatter(
  params: EnemyDestructionParams,
  hitDirection: THREE.Vector3
) {
  const { scene, enemy, dtFactor, glassShards, onDisarm, onClearCheck } = params;
  if (!enemy.alive) return;

  enemy.alive = false;

  // Spawns Matrix Emissive Dissolve Silhouette Ghost
  spawnEnemyEmissiveDissolveGhost(scene, enemy);

  scene.remove(enemy.root);

  superhotSound.playGlassShatter(dtFactor);

  if (enemy.hasWeapon && onDisarm) {
    onDisarm(enemy);
  }

  const shards = spawnEnemyShatterShards(scene, enemy, hitDirection);
  glassShards.push(...shards);

  if (onClearCheck) {
    onClearCheck();
  }
}
