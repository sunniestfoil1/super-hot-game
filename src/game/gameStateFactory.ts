import * as THREE from 'three';
import { Bullet, Enemy, GlassShard, AirborneWeapon, DroppedWeapon, WeaponType, GameMode } from './types';
import { EmoteType } from './emoteAnimations';

export function createInitialGameState() {
  return {
    gameState: 'menu' as 'menu' | 'playing' | 'cleared' | 'gameover',
    gameMode: 'campaign' as GameMode,
    levelIndex: 0,
    endlessKills: 0,
    endlessTime: 0,
    bestEndlessKills: Number(localStorage.getItem('webhot_best_kills') || 0),
    bestEndlessTime: Number(localStorage.getItem('webhot_best_time') || 0),
    currentWeapon: 'pistol' as WeaponType | null,
    ammo: 3,
    dtFactor: 0.03,
    targetDtFactor: 0.03,
    actionKickTimer: 0,
    clearSlowTimer: 0,
    constructProgress: 1.0, // Instantly realistic, zero pre-match cartoon sketch filter
    mouseDeltaMag: 0,
    hotswitchCooldown: 0,
    targetedEnemyId: null as string | null,
    pos: new THREE.Vector3(0, 1.7, 12),
    vel: new THREE.Vector3(0, 0, 0),
    yaw: 0,
    pitch: 0,
    isGrounded: true,
    wallRun: {
      isWallRunning: false,
      side: 'none' as 'left' | 'right' | 'none',
      wallNormal: new THREE.Vector3(),
      wallTangent: new THREE.Vector3(),
      tiltAngle: 0,
      timeOnWall: 0,
    },
    keys: { w: false, s: false, a: false, d: false, space: false, e: false },
    shootCooldown: 0,
    recoilAmount: 0,
    punchProgress: 0,
    isPunching: false,
    punchComboIndex: 0,
    punchType: 'jab' as 'jab' | 'cross' | 'hook' | 'uppercut',
    currentEmote: 'none' as EmoteType,
    emoteProgress: 0,
    emoteTimer: 0,
    emoteDuration: 0,
    deathFade: 0,
    bullets: [] as Bullet[],
    enemies: [] as Enemy[],
    glassShards: [] as GlassShard[],
    airborneWeapons: [] as AirborneWeapon[],
    droppedWeapons: [] as DroppedWeapon[],
    wallBoxes: [] as THREE.Box3[],
  };
}

