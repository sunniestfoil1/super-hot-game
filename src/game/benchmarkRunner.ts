import * as THREE from 'three';
import { Enemy } from './types';
import { performanceRecorder, downloadJsonReport, PerformanceReport } from './performanceRecorder';
import { executeEnemyFullShatter } from './enemyDestructionController';
import { spawnEnemyEntity, preloadEnemyClips } from './enemyFactory';

export type BenchmarkTechnique = 'CLASSIC_32_MESHES' | 'GPU_INSTANCED_MESH' | 'PREBAKED_GPU_PARTICLES';

export interface BenchmarkStep {
  technique: BenchmarkTechnique;
  techniqueName: string;
  enemiesCount: number;
  durationSec: number;
  tag: string;
}

export interface BenchmarkStatus {
  active: boolean;
  currentStepIndex: number;
  totalSteps: number;
  currentStep: BenchmarkStep | null;
  secondsRemainingInStep: number;
  completedReport: PerformanceReport | null;
}

const sharedBenchEnemyMat = new THREE.MeshStandardMaterial({
  color: 0xff0022,
  emissive: 0xff0033,
  emissiveIntensity: 1.5,
});

class BenchmarkRunnerManager {
  private active = false;
  private currentStepIndex = 0;
  private stepStartTime = 0;
  private isWaitingCooldown = false;
  private cooldownEndTime = 0;

  private listeners: Set<(status: BenchmarkStatus) => void> = new Set();
  private completedReport: PerformanceReport | null = null;

  private steps: BenchmarkStep[] = [
    // TÉCNICA 1: Sem Otimização (32 Meshes Individuais por Inimigo)
    { technique: 'CLASSIC_32_MESHES', techniqueName: '1/3 Sem Otimização (32 Meshes Individuais)', enemiesCount: 1, durationSec: 5, tag: 'classic_1enemy' },
    { technique: 'CLASSIC_32_MESHES', techniqueName: '1/3 Sem Otimização (32 Meshes Individuais)', enemiesCount: 2, durationSec: 5, tag: 'classic_2enemies' },
    { technique: 'CLASSIC_32_MESHES', techniqueName: '1/3 Sem Otimização (32 Meshes Individuais)', enemiesCount: 3, durationSec: 5, tag: 'classic_3enemies' },

    // TÉCNICA 2: GPU InstancedMesh + Float32Array
    { technique: 'GPU_INSTANCED_MESH', techniqueName: '2/3 GPU InstancedMesh (1 Draw Call)', enemiesCount: 1, durationSec: 5, tag: 'instanced_1enemy' },
    { technique: 'GPU_INSTANCED_MESH', techniqueName: '2/3 GPU InstancedMesh (1 Draw Call)', enemiesCount: 2, durationSec: 5, tag: 'instanced_2enemies' },
    { technique: 'GPU_INSTANCED_MESH', techniqueName: '2/3 GPU InstancedMesh (1 Draw Call)', enemiesCount: 3, durationSec: 5, tag: 'instanced_3enemies' },

    // TÉCNICA 3: Animação Pré-Calculada (Pre-baked GPU Curves)
    { technique: 'PREBAKED_GPU_PARTICLES', techniqueName: '3/3 Animação Pré-Calculada (GPU Pre-baked)', enemiesCount: 1, durationSec: 5, tag: 'prebaked_1enemy' },
    { technique: 'PREBAKED_GPU_PARTICLES', techniqueName: '3/3 Animação Pré-Calculada (GPU Pre-baked)', enemiesCount: 2, durationSec: 5, tag: 'prebaked_2enemies' },
    { technique: 'PREBAKED_GPU_PARTICLES', techniqueName: '3/3 Animação Pré-Calculada (GPU Pre-baked)', enemiesCount: 3, durationSec: 5, tag: 'prebaked_3enemies' },
  ];

  public subscribe(cb: (status: BenchmarkStatus) => void) {
    this.listeners.add(cb);
    this.notify();
    return () => { this.listeners.delete(cb); };
  }

  private notify() {
    const currentStep = this.steps[this.currentStepIndex] || null;
    const now = Date.now();
    let secondsRemaining = 0;

    if (this.isWaitingCooldown) {
      secondsRemaining = Math.max(0, Math.ceil((this.cooldownEndTime - now) / 1000));
    } else if (currentStep) {
      const elapsedSec = (now - this.stepStartTime) / 1000;
      secondsRemaining = Math.max(0, Math.ceil(currentStep.durationSec - elapsedSec));
    }

    const status: BenchmarkStatus = {
      active: this.active,
      currentStepIndex: this.currentStepIndex,
      totalSteps: this.steps.length,
      currentStep: this.isWaitingCooldown ? { ...currentStep, techniqueName: `Pausa de Limpeza (6s)` } : currentStep,
      secondsRemainingInStep: secondsRemaining,
      completedReport: this.completedReport,
    };

    this.listeners.forEach((cb) => cb(status));
  }

  public getIsActive(): boolean {
    return this.active;
  }

  public async startBenchmark(scene: THREE.Scene, enemiesArray: Enemy[], glassShardsArray: any[]) {
    this.active = true;
    this.currentStepIndex = 0;
    this.isWaitingCooldown = false;
    this.completedReport = null;

    // Pré-carrega todas as animações FBX antes de ligar o cronômetro para evitar travamento de download
    await preloadEnemyClips();

    // Inicia gravação da telemetria (Caixa Preta F8 / F12)
    performanceRecorder.startRecording();
    console.log('%c[BENCHMARK] Bateria de Testes Automática Iniciada!', 'color: #00ff88; font-weight: bold; font-size: 16px;');

    this.executeCurrentStep(scene, enemiesArray, glassShardsArray);
  }

  private async executeCurrentStep(scene: THREE.Scene, enemiesArray: Enemy[], glassShardsArray: any[]) {
    if (this.currentStepIndex >= this.steps.length) {
      this.finishBenchmark();
      return;
    }

    const step = this.steps[this.currentStepIndex];
    this.stepStartTime = Date.now();
    this.notify();

    console.log(`%c[BENCHMARK STEP ${this.currentStepIndex + 1}/${this.steps.length}] ${step.techniqueName} | Inimigos: ${step.enemiesCount}`, 'color: #00e5ff; font-weight: bold;');

    // Limpa cena para o teste
    enemiesArray.forEach((e) => scene.remove(e.root));
    enemiesArray.length = 0;

    // Posições estratégicas alinhadas à câmera fixa do player
    const positions: Array<{ x: number; y: number; z: number }> = [];
    if (step.enemiesCount === 1) {
      positions.push({ x: 0, y: 0, z: 7 });
    } else if (step.enemiesCount === 2) {
      positions.push({ x: -1.8, y: 0, z: 7 }, { x: 1.8, y: 0, z: 7 });
    } else {
      positions.push({ x: -2.8, y: 0, z: 7 }, { x: 0, y: 0, z: 7 }, { x: 2.8, y: 0, z: 7 });
    }

    // Spawna inimigos estáticos e estoura imediatamente para capturar a explosão de particulas de 32 meshes
    for (let idx = 0; idx < positions.length; idx++) {
      const p = positions[idx];
      const enemyCfg = { id: `bench-${idx}`, pos: [p.x, p.y, p.z] as [number, number, number], yaw: 0, weapon: 'pistol' as const };
      const e = await spawnEnemyEntity(scene, enemyCfg, idx, sharedBenchEnemyMat);
      enemiesArray.push(e);

      // Dispara a explosão de estilhaços
      setTimeout(() => {
        executeEnemyFullShatter(
          {
            scene,
            enemy: e,
            dtFactor: 1.0,
            glassShards: glassShardsArray,
          },
          new THREE.Vector3(0, 0, -1)
        );
      }, 100);
    }
  }

  public updateTick(scene: THREE.Scene, enemiesArray: Enemy[], glassShardsArray: any[]) {
    if (!this.active) return;

    const now = Date.now();
    if (this.isWaitingCooldown) {
      if (now >= this.cooldownEndTime) {
        this.isWaitingCooldown = false;
        this.currentStepIndex++;
        this.executeCurrentStep(scene, enemiesArray, glassShardsArray);
      } else {
        this.notify();
      }
      return;
    }

    const currentStep = this.steps[this.currentStepIndex];
    if (!currentStep) return;

    const elapsedSec = (now - this.stepStartTime) / 1000;
    if (elapsedSec >= currentStep.durationSec) {
      // Se acabou uma técnica completa (a cada 3 steps), entra em pausa de 6 segundos para limpeza
      if ((this.currentStepIndex + 1) % 3 === 0 && this.currentStepIndex + 1 < this.steps.length) {
        this.isWaitingCooldown = true;
        this.cooldownEndTime = now + 6000;
        console.log('%c[BENCHMARK PAUSA 6s] Aguardando limpeza de estilhaços para a próxima técnica...', 'color: #ffaa00; font-weight: bold;');
      } else {
        this.currentStepIndex++;
        this.executeCurrentStep(scene, enemiesArray, glassShardsArray);
      }
    }
    this.notify();
  }

  private finishBenchmark() {
    this.active = false;
    console.log('%c[BENCHMARK FINALIZADO] Baixando relatório JSON completo...', 'color: #00ff88; font-weight: bold; font-size: 16px;');

    const report = performanceRecorder.stopRecording(undefined, 'BENCHMARK_SUITE_ULTRA');
    if (report) {
      this.completedReport = report;
      downloadJsonReport(report);
    }
    this.notify();
  }

  public cancelBenchmark() {
    if (!this.active) return;
    this.active = false;
    performanceRecorder.stopRecording();
    this.notify();
  }
}

export const benchmarkRunner = new BenchmarkRunnerManager();
