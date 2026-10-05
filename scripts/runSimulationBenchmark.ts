import * as THREE from 'three';
import { shardPool, spawnEnemyShatterShards } from '../src/game/shatterEffect';
import { updateBulletsAndCollisions } from '../src/game/bulletPhysics';
import { createBulletMesh, createBulletTrail } from '../src/game/bulletVisuals';
import { updateEnemyAi } from '../src/game/enemyAi';
import { updateAirborneWeapons } from '../src/game/weaponPhysics';
import { updateCombatVfx, spawnMuzzleFlashVfx } from '../src/game/combatVfx';
import { Enemy, Bullet, GlassShard, AirborneWeapon } from '../src/game/types';
import { performance } from 'perf_hooks';

interface SimulationReport {
  scenario: string;
  totalTicks: number;
  totalDurationMs: number;
  avgTickMs: number;
  physicsMs: number;
  aiMs: number;
  bulletMs: number;
  shardsMs: number;
  vfxMs: number;
  heapDeltaMb: number;
  status: 'PASS' | 'FAIL';
}

function createDummyEnemy(id: string, x: number, z: number): Enemy {
  const root = new THREE.Group();
  root.position.set(x, 0, z);

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2), new THREE.MeshBasicMaterial());
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.12), new THREE.MeshBasicMaterial());
  const chest = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.6, 0.2), new THREE.MeshBasicMaterial());
  const waist = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.3, 0.2), new THREE.MeshBasicMaterial());
  const leftUpperArm = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.4, 0.1), new THREE.MeshBasicMaterial());
  const leftForearm = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.34, 0.1), new THREE.MeshBasicMaterial());
  const rightUpperArm = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.4, 0.1), new THREE.MeshBasicMaterial());
  const rightForearm = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.34, 0.1), new THREE.MeshBasicMaterial());
  const leftThigh = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.45, 0.12), new THREE.MeshBasicMaterial());
  const rightThigh = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.45, 0.12), new THREE.MeshBasicMaterial());
  const leftCalf = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.45, 0.1), new THREE.MeshBasicMaterial());
  const rightCalf = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.45, 0.1), new THREE.MeshBasicMaterial());

  root.add(head, neck, chest, waist, leftUpperArm, leftForearm, rightUpperArm, rightForearm, leftThigh, rightThigh, leftCalf, rightCalf);

  return {
    id,
    position: new THREE.Vector3(x, 0, z),
    rotationY: 0,
    alive: true,
    legShattered: false,
    state: 'idle',
    shootCooldown: 0,
    stumbleTimer: 0,
    stunTimer: 0,
    hasWeapon: true,
    weaponType: 'pistol',
    root,
    head,
    neck,
    chest,
    waist,
    leftUpperArm,
    leftForearm,
    rightUpperArm,
    rightForearm,
    leftThigh,
    rightThigh,
    leftCalf,
    rightCalf,
  } as unknown as Enemy;
}

export async function runSimulationSuite(): Promise<SimulationReport[]> {
  const reports: SimulationReport[] = [];
  const scene = new THREE.Scene();
  const dummyMat = new THREE.MeshBasicMaterial();

  // Wall Boxes for spatial collision simulation
  const wallBoxes: THREE.Box3[] = [
    new THREE.Box3(new THREE.Vector3(-20, 0, -20), new THREE.Vector3(20, 0.1, 20)), // Floor
    new THREE.Box3(new THREE.Vector3(-10, 0, -10), new THREE.Vector3(-9.5, 4, 10)), // West Wall
    new THREE.Box3(new THREE.Vector3(9.5, 0, -10), new THREE.Vector3(10, 4, 10)),  // East Wall
    new THREE.Box3(new THREE.Vector3(-10, 0, -10), new THREE.Vector3(10, 4, -9.5)), // South Wall
    new THREE.Box3(new THREE.Vector3(-10, 0, 9.5), new THREE.Vector3(10, 4, 10)),  // North Wall
  ];

  const scenarios = [
    { name: '1 Enemy + 32 Shards Burst', enemiesCount: 1, shardsPerEnemy: 32, bulletCount: 10, ticks: 1000 },
    { name: '2 Enemies + 64 Shards Parallel', enemiesCount: 2, shardsPerEnemy: 32, bulletCount: 25, ticks: 1000 },
    { name: '3 Enemies + 96 Shards Max Load', enemiesCount: 3, shardsPerEnemy: 32, bulletCount: 50, ticks: 1000 },
  ];

  for (const sc of scenarios) {
    if (typeof global.gc === 'function') {
      global.gc();
    }
    const initialHeap = process.memoryUsage().heapUsed;
    const startOverall = performance.now();

    let accumulatedPhysics = 0;
    let accumulatedAi = 0;
    let accumulatedBullets = 0;
    let accumulatedShards = 0;
    let accumulatedVfx = 0;

    const enemies: Enemy[] = [];
    for (let i = 0; i < sc.enemiesCount; i++) {
      enemies.push(createDummyEnemy(`enemy_${i}`, (i - 1) * 3, 5 + i * 2));
    }

    const bullets: Bullet[] = [];
    for (let i = 0; i < sc.bulletCount; i++) {
      const pos = new THREE.Vector3((Math.random() - 0.5) * 10, 1.2, (Math.random() - 0.5) * 10);
      const dir = new THREE.Vector3((Math.random() - 0.5), 0, (Math.random() - 0.5)).normalize();
      const bMesh = createBulletMesh(pos, dir);
      const trail = createBulletTrail();
      scene.add(bMesh, trail);

      bullets.push({
        id: `bullet_${i}`,
        mesh: bMesh,
        trailMesh: trail,
        position: pos,
        prevPosition: pos.clone(),
        direction: dir,
        speed: 15.0,
        isEnemy: i % 2 === 0,
        life: 3.0,
      });
    }

    const glassShards: GlassShard[] = [];
    // Trigger enemy shatters to spawn 32 shards per enemy
    for (const enemy of enemies) {
      const shards = spawnEnemyShatterShards(scene, enemy, new THREE.Vector3(0, 0, -1));
      glassShards.push(...shards);
    }

    const dt = 0.01667;
    const gameDt = dt * 0.5;

    for (let t = 0; t < sc.ticks; t++) {
      // 1. AI Loop
      const tAiStart = performance.now();
      for (const enemy of enemies) {
        updateEnemyAi({
          enemy,
          gameDt,
          rawDt: dt,
          currentTime: t * dt,
          playerPos: new THREE.Vector3(0, 1.6, 0),
          playerVel: new THREE.Vector3(0, 0, 0),
          camDir: new THREE.Vector3(0, 0, -1),
          wallBoxes,
          gameState: 'playing',
          dtFactor: 0.5,
          enemyActiveMat: dummyMat,
          applyEnemyMaterial: () => {},
          bullets,
          scene,
          onPlayerHit: () => {},
        });
      }
      accumulatedAi += performance.now() - tAiStart;

      // 2. Bullet Physics Loop
      const tBulletStart = performance.now();
      updateBulletsAndCollisions({
        bullets,
        enemies,
        airborneWeapons: [],
        playerPos: new THREE.Vector3(0, 1.6, 0),
        gameDt,
        dtFactor: 0.5,
        gameState: 'playing',
        wallBoxes,
        scene,
        godMode: false,
        shatterLimb: () => {},
        shatterEnemy: () => {},
        onPlayerHit: () => {},
      });
      accumulatedBullets += performance.now() - tBulletStart;

      // 3. Glass Shards Loop
      const tShardsStart = performance.now();
      for (let i = glassShards.length - 1; i >= 0; i--) {
        const shard = glassShards[i];
        shard.velocity.y -= 9.8 * gameDt;
        shard.mesh.position.addScaledVector(shard.velocity, gameDt);
        shard.mesh.rotation.x += shard.rotVelocity.x * gameDt;
        shard.mesh.rotation.y += shard.rotVelocity.y * gameDt;
        shard.mesh.rotation.z += shard.rotVelocity.z * gameDt;
        shard.life -= gameDt;

        if (shard.mesh.position.y <= 0.08) {
          shard.mesh.position.y = 0.08;
          shard.velocity.y = Math.abs(shard.velocity.y) > 0.8 ? -shard.velocity.y * 0.25 : 0;
          shard.velocity.x *= 0.95;
          shard.velocity.z *= 0.95;
        }

        if (shard.life <= 0) {
          shardPool.recycleShard(shard);
          glassShards.splice(i, 1);
        }
      }
      accumulatedShards += performance.now() - tShardsStart;

      // 4. Combat VFX Loop
      const tVfxStart = performance.now();
      updateCombatVfx(scene, gameDt);
      accumulatedVfx += performance.now() - tVfxStart;
    }

    const totalDurationMs = performance.now() - startOverall;
    const finalHeap = process.memoryUsage().heapUsed;
    const heapDeltaMb = Math.max(0, (finalHeap - initialHeap) / (1024 * 1024));

    reports.push({
      scenario: sc.name,
      totalTicks: sc.ticks,
      totalDurationMs: parseFloat(totalDurationMs.toFixed(2)),
      avgTickMs: parseFloat((totalDurationMs / sc.ticks).toFixed(4)),
      physicsMs: parseFloat((accumulatedBullets + accumulatedShards).toFixed(2)),
      aiMs: parseFloat(accumulatedAi.toFixed(2)),
      bulletMs: parseFloat(accumulatedBullets.toFixed(2)),
      shardsMs: parseFloat(accumulatedShards.toFixed(2)),
      vfxMs: parseFloat(accumulatedVfx.toFixed(2)),
      heapDeltaMb: parseFloat(heapDeltaMb.toFixed(3)),
      status: totalDurationMs < sc.ticks * 5.0 ? 'PASS' : 'FAIL',
    });
  }

  return reports;
}

if (process.argv[1]?.includes('runSimulationBenchmark')) {
  runSimulationSuite().then((reports) => {
    console.log('\n==================================================');
    console.log('🧪 HEADLESS ENGINE PERFORMANCE BENCHMARK REPORT');
    console.log('==================================================');
    console.table(reports);
    console.log(JSON.stringify(reports, null, 2));
  });
}
