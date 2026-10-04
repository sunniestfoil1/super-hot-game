import * as THREE from 'three';

export type GameStatus = 'menu' | 'playing' | 'cleared' | 'gameover';

export type WeaponType = 'pistol' | 'shotgun' | 'rifle';

export interface Bullet {
  id: string;
  mesh: THREE.Mesh;
  trailMesh: THREE.Line | THREE.Mesh;
  position: THREE.Vector3;
  direction: THREE.Vector3;
  speed: number;
  isEnemy: boolean;
  life: number;
  prevPosition: THREE.Vector3;
}

export interface Enemy {
  id: string;
  root: THREE.Group;
  // Anatomical Crystal Body Parts
  head: THREE.Mesh;
  neck: THREE.Mesh;
  chest: THREE.Mesh;
  waist: THREE.Mesh;
  leftUpperArm: THREE.Mesh;
  leftForearm: THREE.Mesh;
  rightUpperArm: THREE.Mesh;
  rightForearm: THREE.Mesh;
  leftThigh: THREE.Mesh;
  leftCalf: THREE.Mesh;
  rightThigh: THREE.Mesh;
  rightCalf: THREE.Mesh;
  gunMesh: THREE.Group | null;
  position: THREE.Vector3;
  rotationY: number;
  state: 'idle' | 'walking' | 'aiming' | 'shooting' | 'stunned' | 'stumbling';
  aimTimer: number;
  shootCooldown: number;
  walkSpeed: number;
  alive: boolean;
  hasWeapon: boolean;
  weaponType?: WeaponType;
  punchHitsReceived: number; // 2 punches to shatter
  tacticalRole: 'frontal' | 'flank_left' | 'flank_right';
  dodgeCooldown: number;
  dodgeVel: THREE.Vector3;
  // Human Senses & Reaction System
  targetRotationY: number;
  reactionTime: number; // Human reaction delay (e.g. 0.45s - 0.75s)
  reactionTimer: number; // Accumulates while player is in sight
  spottedPlayer: boolean;
  alertState: 'calm' | 'alerted' | 'engaging';
  headYaw: number;
  headPitch: number;
  alertSoundTimer: number; // Alerted by gunshot/missed bullet sound
  lastHeardPos: THREE.Vector3 | null;
  punchAttackTimer: number; // Enemy melee punch attack timer
  walkCycle: number; // Continuous walk cycle phase in gameDt
  legShattered: boolean;
  stumbleTimer: number;
  stunTimer: number;
  boxCycle: number;
  isBoxing: boolean;
  mixer: THREE.AnimationMixer | null;
  boxingClip: THREE.AnimationClip | null;
  punchClip: THREE.AnimationClip | null;
  sillyDanceClip: THREE.AnimationClip | null;
  rifleFireClip: THREE.AnimationClip | null;
  rifleAimIdleClip: THREE.AnimationClip | null;
  rifleRunClip: THREE.AnimationClip | null;
  walkingClip: THREE.AnimationClip | null;
  walkingBackwardsClip: THREE.AnimationClip | null;
  currentAction: THREE.AnimationAction | null;
}

export interface WallRunState {
  isWallRunning: boolean;
  side: 'left' | 'right' | 'none';
  wallNormal: THREE.Vector3;
  wallDirection: THREE.Vector3;
  tiltAngle: number;
  timeOnWall: number;
}

export interface GlassShard {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  rotVelocity: THREE.Vector3;
  life: number;
}

export interface AirborneWeapon {
  id: string;
  group: THREE.Group;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  angularVelocity: THREE.Vector3;
  type: WeaponType;
  ammo: number;
  life: number;
  isThrownByPlayer: boolean;
  canCatch: boolean;
}

export interface DroppedWeapon {
  id: string;
  group: THREE.Group;
  position: THREE.Vector3;
  type: WeaponType;
  ammo: number;
}

export interface LevelConfig {
  id: string;
  name: string;
  subtitle: string;
  playerSpawn: [number, number, number];
  playerYaw: number;
  initialWeapon: WeaponType | null;
  initialAmmo: number;
  enemies: {
    pos: [number, number, number];
    yaw: number;
    hasWeapon?: boolean;
    weaponType?: WeaponType;
    role?: 'frontal' | 'flank_left' | 'flank_right';
  }[];
  pickups: {
    pos: [number, number, number];
    type: WeaponType;
    ammo: number;
  }[];
  structures: {
    type: 'wall' | 'pillar' | 'obstacle' | 'arch' | 'glass' | 'metal';
    pos: [number, number, number];
    size: [number, number, number];
  }[];
}
