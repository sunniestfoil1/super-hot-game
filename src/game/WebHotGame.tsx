import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { Bullet, Enemy, GlassShard, AirborneWeapon, DroppedWeapon, WeaponType } from './types';
import { LEVELS } from './levels';
import { superhotSound } from '../audio/SuperhotAudio';
import { GameHUD } from '../components/GameHUD';
import { BloodSplatterHUD } from '../components/BloodSplatterHUD';
import { createEnemyMaterials, applyEnemyMaterial } from './geometryLoader';
import { executeEnemyLimbShatter, executeEnemyFullShatter } from './enemyDestructionController';
import { resetLevelEntities } from './levelLifecycle';
import { animatePlayerArms } from './firstPersonArms';
import { initThreeScene } from './sceneSetup';
import { spawnFloorWeapon, disarmEnemyWeapon } from './weaponSpawner';
import { firePlayerGuns } from './playerCombat';
import { executePlayerThrowAction } from './playerThrowController';
import { useGameInputs } from './useGameInputs';
import { runGamePhysicsTick } from './gameLoop';
import { executePlayerPunchAction } from './meleeCombat';
import { executeHotswitchAction } from './hotswitchController';
import { attemptCatchMidAirWeapon } from './weaponCatchController';
import { EmoteType } from './emoteAnimations';
import { EmoteWheelHUD } from '../components/EmoteWheelHUD';
import { triggerEmoteBySlot, updateEmoteTick, cancelEmote } from './emoteController';
import { startLevelClearMantra } from './levelMantraController';
import { createInitialGameState } from './gameStateFactory';

export const WebHotGame: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);

  // React state for HUD
  const [currentLevelIndex, setCurrentLevelIndex] = useState(0);
  const [gameState, setGameState] = useState<'menu' | 'playing' | 'cleared' | 'gameover'>('menu');
  const [activeEmoteDisplay, setActiveEmoteDisplay] = useState<EmoteType>('none');
  const [currentWeapon, setCurrentWeapon] = useState<WeaponType | null>('pistol');
  const [ammo, setAmmo] = useState(3);
  const [enemiesRemaining, setEnemiesRemaining] = useState(2);
  const [totalEnemies, setTotalEnemies] = useState(2);
  const [dtFactorDisplay, setDtFactorDisplay] = useState(0.03);
  const [isPointerLocked, setIsPointerLocked] = useState(false);
  const [canCatchWeaponId, setCanCatchWeaponId] = useState<string | null>(null);
  const [canPunchEnemy, setCanPunchEnemy] = useState(false);
  const [canHotswitchEnemy, setCanHotswitchEnemy] = useState(false);
  const [hotswitchCooldownDisplay, setHotswitchCooldownDisplay] = useState(0);
  const [devMode, setDevMode] = useState(false);
  const [godMode, setGodMode] = useState(false);
  const [infiniteAmmo, setInfiniteAmmo] = useState(false);
  const [mantraWord, setMantraWord] = useState<'SUPER' | 'HOT'>('SUPER');
  const [showKillBanner, setShowKillBanner] = useState(false);
  const [deathWhiteout, setDeathWhiteout] = useState(0);
  const [bloodSplatterActive, setBloodSplatterActive] = useState(false);
  const [emoteWheelOpen, setEmoteWheelOpen] = useState(false);
  const [mouseSens, setMouseSens] = useState(1.0);
  const [volume, setVolume] = useState(1.0);
  const mouseSensRef = useRef(1.0);
  const mantraIntervalRef = useRef<number | null>(null);
  // Ref para loadLevel evitar dependência circular com triggerLevelClear
  const loadLevelRef = useRef<(idx: number) => void>(() => {});

  const materialsRef = useRef(createEnemyMaterials());
  const enemyActiveMat = materialsRef.current.activeMat;
  const enemyStunnedMat = materialsRef.current.stunnedMat;

  // High performance state reference for 60+ FPS game loop
  const stateRef = useRef(createInitialGameState());

  const threeRef = useRef<ReturnType<typeof initThreeScene> | null>(null);

  // Spawn Floor Weapon
  const spawnDroppedWeapon = useCallback((pos: THREE.Vector3, type: WeaponType, ammoCount: number, id: string) => {
    if (!threeRef.current) return;
    stateRef.current.droppedWeapons.push(spawnFloorWeapon(threeRef.current.scene, pos, type, ammoCount, id));
  }, []);

  // Disarm Enemy
  const disarmEnemy = useCallback((enemy: Enemy, upwardForce = 4.2) => {
    if (!threeRef.current) return;
    const aw = disarmEnemyWeapon(threeRef.current.scene, enemy, upwardForce, stateRef.current.dtFactor);
    if (aw) stateRef.current.airborneWeapons.push(aw);
  }, []);

  // Shatter Limb
  const shatterLimb = useCallback((enemy: Enemy, isLeft: boolean) => {
    if (!threeRef.current) return;
    executeEnemyLimbShatter(
      {
        scene: threeRef.current.scene,
        enemy,
        dtFactor: stateRef.current.dtFactor,
        glassShards: stateRef.current.glassShards,
      },
      isLeft
    );
    stateRef.current.actionKickTimer = 0.25;
  }, []);

  // Level Clear — SUPER/HOT 3x → branco → próximo mapa (sem clique)
  const triggerLevelClear = useCallback(() => {
    const s = stateRef.current;
    if (s.gameState === 'cleared') return;
    s.gameState = 'cleared';
    s.targetDtFactor = 1.0;
    s.dtFactor = 1.0;
    startLevelClearMantra({
      onSetGameState: (st) => setGameState(st),
      onSetMantraWord: (w) => setMantraWord(w),
      onAutoAdvance: () => {
        // Tela branca cobrindo o load do próximo mapa
        setDeathWhiteout(1.0);
        // Prepara e monta o próximo nível sob o branco
        requestAnimationFrame(() => {
          loadLevelRef.current(stateRef.current.levelIndex + 1);
          // Mantém branco um instante enquanto a cena estabiliza
          setTimeout(() => setDeathWhiteout(0), 420);
        });
      },
      intervalRef: mantraIntervalRef,
    });
  }, []);

  // Shatter Complete Enemy
  const shatterEnemy = useCallback((enemy: Enemy, hitDirection: THREE.Vector3) => {
    if (!threeRef.current) return;
    executeEnemyFullShatter(
      {
        scene: threeRef.current.scene,
        enemy,
        dtFactor: stateRef.current.dtFactor,
        glassShards: stateRef.current.glassShards,
        onDisarm: (e) => disarmEnemy(e, 3.5),
        onClearCheck: () => {
          const remaining = stateRef.current.enemies.filter((e) => e.alive).length;
          setEnemiesRemaining(remaining);
          if (remaining === 0) triggerLevelClear();
        },
      },
      hitDirection
    );
    stateRef.current.actionKickTimer = 0.3;
  }, [disarmEnemy, triggerLevelClear]);

  // Game Over
  const triggerGameOver = useCallback(() => {
    const s = stateRef.current;
    if (s.gameState === 'gameover') return;
    s.gameState = 'gameover';
    s.vel.set(0, 0, 0);
    s.dtFactor = 0;
    s.targetDtFactor = 0;
    s.deathFade = 1.0;
    setDeathWhiteout(1.0);
    setGameState('gameover');
    superhotSound.playPlayerHit();
    if (document.pointerLockElement) document.exitPointerLock();
    setTimeout(() => setDeathWhiteout(0), 450);
  }, []);

  // HOTSWITCH: Transfere a consciência para o corpo do inimigo mirado
  const executeHotswitch = useCallback(() => {
    const s = stateRef.current;
    if (s.gameState !== 'playing' || s.hotswitchCooldown > 0 || !threeRef.current) return;

    const { camera, scene } = threeRef.current;
    executeHotswitchAction({
      camera,
      scene,
      enemies: s.enemies,
      playerPos: s.pos,
      glassShards: s.glassShards,
      disarmEnemy,
      onSuccess: (targetEnemy) => {
        s.pos.copy(targetEnemy.position);
        s.pos.y = 1.7;
        s.vel.set(0, 0, 0);
        s.yaw = targetEnemy.rotationY;
        s.pitch = 0;
        camera.position.copy(s.pos);
        s.currentWeapon = null;
        s.ammo = 0;
        setCurrentWeapon(null);
        setAmmo(0);
        setDeathWhiteout(0.65);
        setTimeout(() => setDeathWhiteout(0), 180);
        s.hotswitchCooldown = 6.0;
        s.actionKickTimer = 0.45;
        const remaining = s.enemies.filter((e) => e.alive).length;
        setEnemiesRemaining(remaining);
        if (remaining === 0) triggerLevelClear();
      },
    });
  }, [disarmEnemy, triggerLevelClear]);

  // Load Level Config
  const loadLevel = useCallback(async (levelIdx: number) => {
    const s = stateRef.current;
    s.levelIndex = levelIdx;
    const config = LEVELS[levelIdx % LEVELS.length];

    s.gameState = 'playing';
    s.currentWeapon = config.initialWeapon;
    s.ammo = config.initialAmmo;
    s.pos.set(...config.playerSpawn);
    s.vel.set(0, 0, 0);
    s.yaw = config.playerYaw;
    s.pitch = 0;
    s.dtFactor = 0.03;
    s.targetDtFactor = 0.03;
    s.shootCooldown = 0;
    s.punchProgress = 0;
    s.isPunching = false;
    s.currentEmote = 'none';
    s.emoteProgress = 0;
    s.deathFade = 0;
    setDeathWhiteout(0);
    s.wallRun.isWallRunning = false;
    s.wallRun.tiltAngle = 0;

    setCurrentLevelIndex(levelIdx);
    setGameState('playing');
    setActiveEmoteDisplay('none');
    setCurrentWeapon(config.initialWeapon);
    setAmmo(config.initialAmmo);
    setEnemiesRemaining(config.enemies.length);
    setTotalEnemies(config.enemies.length);

    if (mantraIntervalRef.current) {
      clearTimeout(mantraIntervalRef.current);
      mantraIntervalRef.current = null;
    }
    superhotSound.stopMantra();



    if (!threeRef.current) return;
    const { scene, worldGroup, camera } = threeRef.current;

    s.wallBoxes = await resetLevelEntities({
      scene,
      worldGroup,
      camera,
      config,
      playerPos: s.pos,
      bullets: s.bullets,
      enemies: s.enemies,
      glassShards: s.glassShards,
      airborneWeapons: s.airborneWeapons,
      droppedWeapons: s.droppedWeapons,
      enemyActiveMat,
    });
  }, [enemyActiveMat]);

  // Sincroniza loadLevelRef sempre que loadLevel muda
  React.useEffect(() => {
    loadLevelRef.current = loadLevel;
  }, [loadLevel]);

  // Player Punch
  const executePunch = useCallback(() => {
    const s = stateRef.current;
    if (s.currentWeapon !== null || s.isPunching || !threeRef.current) return;

    executePlayerPunchAction({
      camera: threeRef.current.camera,
      dtFactor: s.dtFactor,
      enemies: s.enemies,
      punchComboIndex: s.punchComboIndex,
      enemyStunnedMat,
      applyEnemyMaterial,
      disarmEnemy,
      shatterEnemy,
      onPunchStart: (type, nextIdx) => {
        s.punchType = type;
        s.punchComboIndex = nextIdx;
        s.isPunching = true;
        s.punchProgress = 1.0;
        s.actionKickTimer = type === 'uppercut' ? 0.35 : 0.22;
      },
    });
  }, [disarmEnemy, enemyStunnedMat, shatterEnemy]);

  // Catch Weapon Mid-Air
  const attemptCatchAirborneWeapon = useCallback(() => {
    const s = stateRef.current;
    if (!threeRef.current) return false;
    const { camera, scene } = threeRef.current;

    return attemptCatchMidAirWeapon({
      camera,
      scene,
      airborneWeapons: s.airborneWeapons,
      onCaught: (type, ammo) => {
        s.currentWeapon = type;
        s.ammo = ammo;
        setCurrentWeapon(type);
        setAmmo(ammo);
        s.actionKickTimer = 0.25;
        setCanCatchWeaponId(null);
      },
    });
  }, []);

  // Fire Player Weapon — cancela emote no tiro
  const firePlayerWeapon = useCallback(() => {
    const s = stateRef.current;
    if (s.currentEmote !== 'none') {
      cancelEmote(s, (em) => {
        setActiveEmoteDisplay(em);
        setBloodSplatterActive(false);
      });
    }
    if (s.currentWeapon === null) {
      executePunch();
      return;
    }
    if (!threeRef.current) return;

    firePlayerGuns({
      currentWeapon: s.currentWeapon,
      ammo: s.ammo,
      shootCooldown: s.shootCooldown,
      infiniteAmmo,
      camera: threeRef.current.camera,
      scene: threeRef.current.scene,
      muzzleFlash: threeRef.current.muzzleFlash,
      dtFactor: s.dtFactor,
      bullets: s.bullets,
      enemies: s.enemies,
      onAmmoChange: (newAmmo) => {
        s.ammo = newAmmo;
        setAmmo(newAmmo);
      },
      onActionKick: (kick) => {
        s.actionKickTimer = kick;
      },
      onRecoil: (recoil) => {
        s.recoilAmount = recoil;
      },
      onCooldownChange: (cd) => {
        s.shootCooldown = cd;
      },
    });
  }, [executePunch, infiniteAmmo]);

  // Throw Weapon — também cancela emote
  const throwPlayerWeapon = useCallback(() => {
    const s = stateRef.current;
    if (s.currentEmote !== 'none') {
      cancelEmote(s, (em) => {
        setActiveEmoteDisplay(em);
        setBloodSplatterActive(false);
      });
    }
    if (s.currentWeapon === null || !threeRef.current) return;
    executePlayerThrowAction({
      camera: threeRef.current.camera,
      scene: threeRef.current.scene,
      currentWeapon: s.currentWeapon,
      ammo: s.ammo,
      dtFactor: s.dtFactor,
      airborneWeapons: s.airborneWeapons,
      onDisarmed: () => {
        s.currentWeapon = null;
        s.ammo = 0;
        setCurrentWeapon(null);
        setAmmo(0);
        s.actionKickTimer = 0.35;
      },
    });
  }, []);

  // Input Listeners Hook (Decoupled cleanly)
  useGameInputs({
    container: containerRef.current,
    gameState,
    keys: stateRef.current.keys,
    currentWeapon,
    onWallJump: () => {
      const s = stateRef.current;
      if (s.wallRun.isWallRunning) {
        s.vel.copy(s.wallRun.wallNormal).multiplyScalar(7.5);
        s.vel.y = 5.8;
        s.wallRun.isWallRunning = false;
        s.actionKickTimer = 0.35;
        superhotSound.playWeaponCatch();
      }
    },
    onCatchWeapon: attemptCatchAirborneWeapon,
    onHotswitch: executeHotswitch,
    onRestartLevel: () => loadLevel(stateRef.current.levelIndex),
    onToggleDev: () => setDevMode((prev) => !prev),
    onTriggerEmote: (slot) => {
      const s = stateRef.current;
      triggerEmoteBySlot(slot as 1 | 2 | 3 | 4 | 5, s, (newEmote) => {
        setActiveEmoteDisplay(newEmote);
        setEmoteWheelOpen(false);
      });
    },
    onEmoteWheelOpen: (open) => setEmoteWheelOpen((prev) => (prev === open ? prev : open)),
    onFire: firePlayerWeapon,
    onThrow: throwPlayerWeapon,
    onMouseMove: (deltaX, deltaY) => {
      const sensitivity = 0.0022 * mouseSensRef.current;
      stateRef.current.yaw -= deltaX * sensitivity;
      stateRef.current.pitch -= deltaY * sensitivity;
      stateRef.current.pitch = Math.max(-1.48, Math.min(1.48, stateRef.current.pitch));
      const deltaMagnitude = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
      stateRef.current.mouseDeltaMag = Math.min(0.20, stateRef.current.mouseDeltaMag + deltaMagnitude * 0.012);
    },
    onPointerLockStateChange: (isLocked) => setIsPointerLocked(isLocked),
  });

  // Main Three.js Setup & Animation Loop
  useEffect(() => {
    if (!containerRef.current) return;
    const sceneSetup = initThreeScene(containerRef.current);
    threeRef.current = sceneSetup;

    let lastTime = performance.now();
    let frameCounter = 0;
    let animId = 0;
    let cancelled = false;

    const loop = (currentTime: number) => {
      const rawDt = Math.min((currentTime - lastTime) / 1000, 0.05);
      lastTime = currentTime;
      frameCounter++;

      const s = stateRef.current;
      s.emoteProgress = updateEmoteTick(rawDt, s, () => {
        setActiveEmoteDisplay('none');
      });

      // Sangue na fase 3 — olhos descem na lente / esmaga
      if (
        s.currentEmote === 'arranca_olho' &&
        s.emoteProgress > 0.72 &&
        s.emoteProgress < 0.78
      ) {
        setBloodSplatterActive(true);
      }

      runGamePhysicsTick({
        rawDt,
        currentTime,
        frameCounter,
        state: s,
        sceneSetup,
        godMode,
        enemyActiveMat,
        enemyStunnedMat,
        applyEnemyMaterial,
        disarmEnemy,
        shatterEnemy,
        shatterLimb,
        spawnDroppedWeapon,
        triggerGameOver,
        onWeaponPickup: (type, ammoCount) => {
          setCurrentWeapon(type);
          setAmmo(ammoCount);
        },
        onCanPunchChange: (canPunch) => setCanPunchEnemy(canPunch),
        onCanHotswitchChange: (canHotswitch) => setCanHotswitchEnemy(canHotswitch),
        onDtFactorChange: (dt) => setDtFactorDisplay(dt),
        onHotswitchCooldownChange: (cd) => setHotswitchCooldownDisplay(cd),
      });

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);

    const onResize = () => {
      if (!containerRef.current || !threeRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      threeRef.current.camera.aspect = w / h;
      threeRef.current.camera.updateProjectionMatrix();
      threeRef.current.renderer.setSize(w, h);
      threeRef.current.onResize(w, h);
    };

    // Pausar loop e áudio quando a aba perde o foco
    const onVisibilityChange = () => {
      if (document.hidden) {
        cancelAnimationFrame(animId);
        superhotSound.stopAll();
      } else {
        lastTime = performance.now();
        animId = requestAnimationFrame(loop);
        superhotSound.resumeAmbient();
      }
    };

    window.addEventListener('resize', onResize);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      cancelled = true;
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      if (threeRef.current) {
        const { renderer, scene } = threeRef.current;
        scene.traverse((obj) => {
          const mesh = obj as THREE.Mesh;
          if (mesh.isMesh) {
            mesh.geometry?.dispose();
            const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
            mats.forEach((m) => {
              if (!m) return;
              for (const key of Object.keys(m)) {
                const value = (m as unknown as Record<string, THREE.Texture | undefined>)[key];
                if (value instanceof THREE.Texture) value.dispose();
              }
              m.dispose();
            });
          }
          if ((obj as THREE.Line).isLine) {
            (obj as THREE.Line).geometry?.dispose();
            const line = obj as THREE.Line;
            const lineMats = Array.isArray(line.material) ? line.material : [line.material];
            lineMats.forEach((lm) => lm?.dispose?.());
          }
        });
        renderer.dispose();
        renderer.domElement.remove();
        threeRef.current = null;
      }
    };
  }, [disarmEnemy, enemyActiveMat, enemyStunnedMat, godMode, loadLevel, shatterEnemy, shatterLimb, spawnDroppedWeapon, triggerGameOver]);

  const currentLevelConfig = LEVELS[currentLevelIndex % LEVELS.length];

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden select-none">
      <div ref={containerRef} className="w-full h-full cursor-crosshair" />

      {/* Gotas de sangue no visor — emote arranca_olho fase 3 */}
      <BloodSplatterHUD
        active={bloodSplatterActive}
        onComplete={() => setBloodSplatterActive(false)}
      />

      {/* Screen Whiteout Flash on Death */}
      {deathWhiteout > 0 && (
        <div
          className="absolute inset-0 z-50 pointer-events-none transition-opacity duration-300 ease-out bg-white"
          style={{ opacity: deathWhiteout }}
        />
      )}

      <GameHUD
        levelName={currentLevelConfig.name}
        levelSubtitle={currentLevelConfig.subtitle}
        weaponType={currentWeapon}
        ammo={ammo}
        enemiesRemaining={enemiesRemaining}
        totalEnemies={totalEnemies}
        dtFactor={dtFactorDisplay}
        gameState={gameState}
        isPointerLocked={isPointerLocked}
        mantraWord={mantraWord}
        showKillBanner={showKillBanner}
        canCatchWeapon={canCatchWeaponId !== null}
        canPunchEnemy={canPunchEnemy}
        canHotswitchEnemy={canHotswitchEnemy}
        hotswitchCooldown={hotswitchCooldownDisplay}
        devMode={devMode}
        godMode={godMode}
        infiniteAmmo={infiniteAmmo}
        mouseSens={mouseSens}
        volume={volume}
        onMouseSensChange={(v) => {
          setMouseSens(v);
          mouseSensRef.current = v;
        }}
        onVolumeChange={(v) => {
          setVolume(v);
          superhotSound.setMasterVolume(v);
        }}
        onToggleDev={() => setDevMode((prev) => !prev)}
        onToggleGodMode={() => setGodMode((prev) => !prev)}
        onToggleInfiniteAmmo={() => setInfiniteAmmo((prev) => !prev)}
        onSelectLevel={(idx) => loadLevel(idx)}
        onSpawnWeapon={(type) => {
          const s = stateRef.current;
          s.currentWeapon = type;
          s.ammo = type === 'shotgun' ? 2 : type === 'rifle' ? 12 : 4;
          setCurrentWeapon(s.currentWeapon);
          setAmmo(s.ammo);
        }}
        onStartGame={() => {
          loadLevel(0);
          containerRef.current?.requestPointerLock();
          if (threeRef.current?.mountWeaponModels) {
            threeRef.current.mountWeaponModels();
          }
          if (threeRef.current?.ensurePostProcessing) {
            threeRef.current.ensurePostProcessing();
          }
        }}
        onRestart={() => loadLevel(currentLevelIndex)}
        onNextLevel={() => loadLevel(currentLevelIndex + 1)}
        onLockPointer={() => containerRef.current?.requestPointerLock()}
      />

      {/* Roleta de emotes — feedback visual enquanto o emote estiver ativo */}
      {gameState === 'playing' && activeEmoteDisplay !== 'none' && (
        <EmoteWheelHUD currentEmote={activeEmoteDisplay} wheelOpen={true} onSelectEmote={slot => {
          const s = stateRef.current;
          triggerEmoteBySlot(slot, s, (newEmote) => {
            setActiveEmoteDisplay(newEmote);
            setEmoteWheelOpen(false);
          });
        }} />
      )}
    </div>
  );
};
