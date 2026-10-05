import * as THREE from 'three';

export interface GameStateRef {
  dtFactor: number;
  pos?: THREE.Vector3 | { x: number; y: number; z: number };
  yaw?: number;
  pitch?: number;
  equippedWeapon?: string;
  enemies?: any[];
  bullets?: any[];
  glassShards?: any[];
  airborneWeapons?: any[];
  droppedWeapons?: any[];
  // Timings da CPU por subsistema (ms)
  physicsMs?: number;
  renderMs?: number;
  audioMs?: number;
}

export interface TelemetryFrame {
  timeMs: number;
  frame: number;
  dtMs: number;
  fps: number;
  dtFactor: number;
  // Timing por Subsistema da CPU (ms)
  physicsMs: number;
  renderMs: number;
  audioMs: number;
  longTasksCount: number;
  maxLongTaskMs: number;
  // WebGL Render Stats
  drawCalls: number;
  triangles: number;
  points: number;
  lines: number;
  geometries: number;
  textures: number;
  programs: number;
  // Heap Memory Stats & Variabilidade
  usedHeapMB: number;
  totalHeapMB: number;
  heapLimitMB: number;
  heapDeltaMB: number;
  // Entities Breakdown
  enemies: number;
  enemiesAlive: number;
  enemiesDissolving: number;
  bullets: number;
  shards: number;
  weapons: number;
  // Player Diagnostics
  playerPos?: { x: number; y: number; z: number };
  playerYaw?: number;
  playerPitch?: number;
  activeWeapon?: string;
  // Anomalies
  isSpike: boolean; // dtMs > 33.3ms (<30 FPS)
  isMicroStutter: boolean; // dtMs > 16.6ms (<60 FPS)
}

export interface PerformanceReportMeta {
  date: string;
  userAgent: string;
  screenResolution: string;
  devicePixelRatio: number;
  webglVendor: string;
  webglRenderer: string;
  maxTextureSize: number;
  maxViewportDims: string;
  supportedExtensionsCount: number;
  hardwareConcurrency: number;
  deviceMemoryGB?: number;
  graphicsPreset: string;
  totalFrames: number;
  durationSeconds: number;
  avgFps: number;
  minFps: number;
  maxFps: number;
  percentile1LowFps: number;
  percentile99FrameTimeMs: number;
  avgPhysicsMs: number;
  avgRenderMs: number;
  avgAudioMs: number;
  totalLongTasksCount: number;
  maxSingleTaskDurationMs: number;
  lagSpikesCount: number;
  microStuttersCount: number;
  avgDrawCalls: number;
  maxDrawCalls: number;
  maxTriangles: number;
  peakHeapMB: number;
}

export interface PerformanceReport {
  meta: PerformanceReportMeta;
  diagnostics: string[];
  frames: TelemetryFrame[];
}

declare global {
  interface Window {
    __SUPERHOT_TELEMETRY__?: {
      isRecording: () => boolean;
      startRecording: () => void;
      stopRecording: (renderer?: THREE.WebGLRenderer, graphicsPreset?: string) => PerformanceReport | null;
      getLatestFrame: () => TelemetryFrame | null;
      exportJson: () => void;
      hasSavedCrashLog: () => boolean;
      getSavedCrashLog: () => PerformanceReport | null;
      clearSavedCrashLog: () => void;
    };
  }
}

class PerformanceRecorder {
  private isRecording = false;
  private frames: TelemetryFrame[] = [];
  private startTime = 0;
  private frameCount = 0;
  private listeners: Set<(recording: boolean, frame?: TelemetryFrame) => void> = new Set();
  private latestFrame: TelemetryFrame | null = null;
  private lastAutoFlushTime = 0;
  private currentPreset = 'DESCONHECIDO';
  private cachedRenderer?: THREE.WebGLRenderer;

  // Long Task API Monitor
  private longTaskEntries: Array<{ duration: number; startTime: number }> = [];
  private observer?: PerformanceObserver;
  private prevHeapMB = 0;

  constructor() {
    this.initLongTaskObserver();
    this.exposeGlobalWindow();
  }

  private initLongTaskObserver() {
    if (typeof window !== 'undefined' && 'PerformanceObserver' in window) {
      try {
        this.observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            this.longTaskEntries.push({
              duration: Math.round(entry.duration * 10) / 10,
              startTime: Math.round(entry.startTime),
            });
          }
        });
        this.observer.observe({ entryTypes: ['longtask'] });
      } catch { /* LongTask not supported */ }
    }
  }

  private exposeGlobalWindow() {
    if (typeof window !== 'undefined') {
      window.__SUPERHOT_TELEMETRY__ = {
        isRecording: () => this.isRecording,
        startRecording: () => this.startRecording(),
        stopRecording: (renderer, preset) => this.stopRecording(renderer || this.cachedRenderer, preset),
        getLatestFrame: () => this.getLatestFrame(),
        exportJson: () => {
          const r = this.generateReportInternal(this.cachedRenderer, this.currentPreset);
          if (r) downloadJsonReport(r);
        },
        hasSavedCrashLog: () => this.hasSavedCrashLog(),
        getSavedCrashLog: () => this.getSavedCrashLog(),
        clearSavedCrashLog: () => this.clearSavedCrashLog(),
      };
    }
  }

  public subscribe(cb: (recording: boolean, frame?: TelemetryFrame) => void) {
    this.listeners.add(cb);
    cb(this.isRecording, this.latestFrame || undefined);
    return () => {
      this.listeners.delete(cb);
    };
  }

  private notify() {
    this.listeners.forEach((cb) => cb(this.isRecording, this.latestFrame || undefined));
  }

  public getIsRecording(): boolean {
    return this.isRecording;
  }

  public getLatestFrame(): TelemetryFrame | null {
    return this.latestFrame;
  }

  public hasSavedCrashLog(): boolean {
    try {
      return !!localStorage.getItem('webhot_crash_blackbox_log');
    } catch {
      return false;
    }
  }

  public getSavedCrashLog(): PerformanceReport | null {
    try {
      const raw = localStorage.getItem('webhot_crash_blackbox_log');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  public clearSavedCrashLog() {
    try {
      localStorage.removeItem('webhot_crash_blackbox_log');
    } catch { /* ignore */ }
  }

  public startRecording() {
    this.isRecording = true;
    this.frames = [];
    this.longTaskEntries = [];
    this.startTime = performance.now();
    this.frameCount = 0;
    this.latestFrame = null;
    this.lastAutoFlushTime = performance.now();
    this.prevHeapMB = 0;
    this.notify();
    console.log('[PERFORMANCE RECORDER] Telemetria Extrema Ativada (LongTasks + Timing Profiler + Heap Trace)');
  }

  public recordFrame(renderer: THREE.WebGLRenderer, state: GameStateRef, rawDtSeconds: number) {
    this.cachedRenderer = renderer;
    if (!this.isRecording) return;

    this.frameCount++;
    const now = performance.now();
    const timeMs = Math.round(now - this.startTime);
    const dtMs = Math.round(rawDtSeconds * 1000 * 10) / 10;
    const fps = rawDtSeconds > 0 ? Math.min(240, Math.round(1 / rawDtSeconds)) : 60;

    // WebGL Three.js render metrics
    const info = renderer.info;
    const drawCalls = info.render.calls;
    const triangles = info.render.triangles;
    const points = info.render.points || 0;
    const lines = info.render.lines || 0;
    const geometries = info.memory.geometries;
    const textures = info.memory.textures;
    const programs = info.programs?.length || 0;

    // CPU JS Heap Memory
    let usedHeapMB = 0;
    let totalHeapMB = 0;
    let heapLimitMB = 0;

    const perfMem = (performance as unknown as { memory?: { usedJSHeapSize: number; totalJSHeapSize: number; jsHeapSizeLimit: number } }).memory;
    if (perfMem) {
      usedHeapMB = Math.round((perfMem.usedJSHeapSize / (1024 * 1024)) * 10) / 10;
      totalHeapMB = Math.round((perfMem.totalJSHeapSize / (1024 * 1024)) * 10) / 10;
      heapLimitMB = Math.round((perfMem.jsHeapSizeLimit / (1024 * 1024)) * 10) / 10;
    }

    const heapDeltaMB = this.prevHeapMB > 0 ? Math.round((usedHeapMB - this.prevHeapMB) * 10) / 10 : 0;
    this.prevHeapMB = usedHeapMB;

    // LongTasks associadas a este frame
    const recentLongTasks = this.longTaskEntries.filter((lt) => lt.startTime >= now - dtMs - 50);
    const longTasksCount = recentLongTasks.length;
    const maxLongTaskMs = recentLongTasks.length > 0 ? Math.max(...recentLongTasks.map((t) => t.duration)) : 0;

    // Enemies detailed state breakdown
    const rawEnemies = state.enemies || [];
    const totalEnemies = rawEnemies.length;
    let enemiesAlive = 0;
    let enemiesDissolving = 0;

    for (let i = 0; i < rawEnemies.length; i++) {
      const e = rawEnemies[i];
      if (e?.isDissolving || e?.matrixDissolveActive) {
        enemiesDissolving++;
      } else if (e?.isAlive !== false) {
        enemiesAlive++;
      }
    }

    const bullets = state.bullets?.length || 0;
    const shards = state.glassShards?.length || 0;
    const weapons = (state.airborneWeapons?.length || 0) + (state.droppedWeapons?.length || 0);

    // Player metrics
    let playerPos: { x: number; y: number; z: number } | undefined = undefined;
    if (state.pos) {
      playerPos = {
        x: Math.round(state.pos.x * 100) / 100,
        y: Math.round(state.pos.y * 100) / 100,
        z: Math.round(state.pos.z * 100) / 100,
      };
    }

    const isSpike = rawDtSeconds > 0.0333; // <30 FPS
    const isMicroStutter = rawDtSeconds > 0.01667; // <60 FPS

    const frameData: TelemetryFrame = {
      timeMs,
      frame: this.frameCount,
      dtMs,
      fps,
      dtFactor: Math.round(state.dtFactor * 100) / 100,
      physicsMs: Math.round((state.physicsMs || 0) * 100) / 100,
      renderMs: Math.round((state.renderMs || 0) * 100) / 100,
      audioMs: Math.round((state.audioMs || 0) * 100) / 100,
      longTasksCount,
      maxLongTaskMs,
      drawCalls,
      triangles,
      points,
      lines,
      geometries,
      textures,
      programs,
      usedHeapMB,
      totalHeapMB,
      heapLimitMB,
      heapDeltaMB,
      enemies: totalEnemies,
      enemiesAlive,
      enemiesDissolving,
      bullets,
      shards,
      weapons,
      playerPos,
      playerYaw: state.yaw !== undefined ? Math.round(state.yaw * 100) / 100 : undefined,
      playerPitch: state.pitch !== undefined ? Math.round(state.pitch * 100) / 100 : undefined,
      activeWeapon: state.equippedWeapon,
      isSpike,
      isMicroStutter,
    };

    if (this.frames.length < 20000) {
      this.frames.push(frameData);
    }
    this.latestFrame = frameData;
    this.notify();

    // Auto-save a cada 1s para resguardo no cache
    if (now - this.lastAutoFlushTime > 1000) {
      this.lastAutoFlushTime = now;
      try {
        const report = this.generateReportInternal(renderer, this.currentPreset);
        if (report) {
          localStorage.setItem('webhot_crash_blackbox_log', JSON.stringify(report));
        }
      } catch { /* ignore quota */ }
    }
  }

  public generateReportInternal(renderer?: THREE.WebGLRenderer, graphicsPreset = 'DESCONHECIDO'): PerformanceReport | null {
    if (this.frames.length === 0) return null;

    const endTime = performance.now();
    const durationSeconds = Math.round(((endTime - this.startTime) / 1000) * 10) / 10;

    const fpsList = this.frames.map((f) => f.fps);
    const dtMsList = [...this.frames.map((f) => f.dtMs)].sort((a, b) => a - b);
    const drawCallsList = this.frames.map((f) => f.drawCalls);
    const trianglesList = this.frames.map((f) => f.triangles);
    const heapList = this.frames.map((f) => f.usedHeapMB);

    const physicsMsList = this.frames.map((f) => f.physicsMs);
    const renderMsList = this.frames.map((f) => f.renderMs);
    const audioMsList = this.frames.map((f) => f.audioMs);

    const avgFps = Math.round(fpsList.reduce((a, b) => a + b, 0) / fpsList.length);
    const minFps = Math.min(...fpsList);
    const maxFps = Math.max(...fpsList);

    const avgPhysicsMs = Math.round((physicsMsList.reduce((a, b) => a + b, 0) / physicsMsList.length) * 100) / 100;
    const avgRenderMs = Math.round((renderMsList.reduce((a, b) => a + b, 0) / renderMsList.length) * 100) / 100;
    const avgAudioMs = Math.round((audioMsList.reduce((a, b) => a + b, 0) / audioMsList.length) * 100) / 100;

    const totalLongTasksCount = this.longTaskEntries.length;
    const maxSingleTaskDurationMs = totalLongTasksCount > 0 ? Math.max(...this.longTaskEntries.map((t) => t.duration)) : 0;

    // Percentis
    const p99Index = Math.floor(dtMsList.length * 0.99);
    const percentile99FrameTimeMs = dtMsList[p99Index] || dtMsList[dtMsList.length - 1] || 16.6;
    const percentile1LowFps = percentile99FrameTimeMs > 0 ? Math.round(1000 / percentile99FrameTimeMs) : minFps;

    const lagSpikesCount = this.frames.filter((f) => f.isSpike).length;
    const microStuttersCount = this.frames.filter((f) => f.isMicroStutter).length;

    const avgDrawCalls = Math.round(drawCallsList.reduce((a, b) => a + b, 0) / drawCallsList.length);
    const maxDrawCalls = Math.max(...drawCallsList);
    const maxTriangles = Math.max(...trianglesList);
    const peakHeapMB = Math.max(...heapList);

    let webglVendor = 'Desconhecido';
    let webglRenderer = 'Desconhecido';
    let maxTextureSize = 0;
    let maxViewportDims = 'N/A';
    let supportedExtensionsCount = 0;

    const activeRenderer = renderer || this.cachedRenderer;
    const targetGl = activeRenderer ? activeRenderer.getContext() : null;
    if (targetGl) {
      try {
        const debugInfo = targetGl.getExtension('WEBGL_debug_renderer_info');
        if (debugInfo) {
          webglVendor = targetGl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) || 'Genérico';
          webglRenderer = targetGl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || 'WebGL Genérico';
        }
        maxTextureSize = targetGl.getParameter(targetGl.MAX_TEXTURE_SIZE) || 0;
        const dims = targetGl.getParameter(targetGl.MAX_VIEWPORT_DIMS);
        if (dims) maxViewportDims = `${dims[0]}x${dims[1]}`;
        const exts = targetGl.getSupportedExtensions();
        if (exts) supportedExtensionsCount = exts.length;
      } catch { /* ignore */ }
    }

    const meta: PerformanceReportMeta = {
      date: new Date().toISOString(),
      userAgent: navigator.userAgent,
      screenResolution: `${window.innerWidth}x${window.innerHeight}`,
      devicePixelRatio: window.devicePixelRatio || 1,
      webglVendor,
      webglRenderer,
      maxTextureSize,
      maxViewportDims,
      supportedExtensionsCount,
      hardwareConcurrency: navigator.hardwareConcurrency || 4,
      deviceMemoryGB: (navigator as any).deviceMemory,
      graphicsPreset,
      totalFrames: this.frames.length,
      durationSeconds,
      avgFps,
      minFps,
      maxFps,
      percentile1LowFps,
      percentile99FrameTimeMs,
      avgPhysicsMs,
      avgRenderMs,
      avgAudioMs,
      totalLongTasksCount,
      maxSingleTaskDurationMs,
      lagSpikesCount,
      microStuttersCount,
      avgDrawCalls,
      maxDrawCalls,
      maxTriangles,
      peakHeapMB,
    };

    const diagnostics: string[] = [];
    if (totalLongTasksCount > 0) {
      diagnostics.push(`🔴 LongTask Bloqueante: Ocorreram ${totalLongTasksCount} tarefas na Thread Principal com duração > 50ms (Maior travamento: ${maxSingleTaskDurationMs}ms).`);
    } else {
      diagnostics.push('🟢 Thread Principal Fluida: Nenhum bloqueio de LongTask (>50ms) registrado.');
    }

    if (avgPhysicsMs > 8.0) {
      diagnostics.push(`⚠️ Carga Eleva de Física (Média: ${avgPhysicsMs}ms/frame): Considere simplificar colisões de malhas.`);
    } else {
      diagnostics.push(`🟢 Loop de Física Otimizado (Média: ${avgPhysicsMs}ms/frame).`);
    }

    if (avgRenderMs > 12.0) {
      diagnostics.push(`⚠️ Carga de Renderização WebGL Alta (Média: ${avgRenderMs}ms/frame): Ajuste resolução ou passes de bloom.`);
    }

    return {
      meta,
      diagnostics,
      frames: [...this.frames],
    };
  }

  public stopRecording(renderer?: THREE.WebGLRenderer, graphicsPreset = 'DESCONHECIDO'): PerformanceReport | null {
    if (!this.isRecording) return null;

    this.isRecording = false;
    const report = this.generateReportInternal(renderer || this.cachedRenderer, graphicsPreset);
    this.latestFrame = null;
    this.notify();

    if (report) {
      try {
        localStorage.setItem('webhot_crash_blackbox_log', JSON.stringify(report));
      } catch { /* ignore */ }
    }

    console.log('[PERFORMANCE RECORDER] Relatório Extremo Gerado:', report);
    return report;
  }
}

export const performanceRecorder = new PerformanceRecorder();

export function downloadJsonReport(report: PerformanceReport) {
  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(report, null, 2));
  const downloadAnchor = document.createElement('a');
  const filename = `superhot_telemetry_diagnostic_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  downloadAnchor.setAttribute('href', dataStr);
  downloadAnchor.setAttribute('download', filename);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

export function downloadCsvReport(report: PerformanceReport) {
  const headers = [
    'TimeMs',
    'Frame',
    'DtMs',
    'FPS',
    'PhysicsMs',
    'RenderMs',
    'AudioMs',
    'LongTasks',
    'DrawCalls',
    'Triangles',
    'Geometries',
    'Textures',
    'Programs',
    'UsedHeapMB',
    'HeapDeltaMB',
    'Enemies',
    'Bullets',
    'Shards',
    'IsLagSpike',
    'IsMicroStutter',
  ];

  const rows = report.frames.map((f) => [
    f.timeMs,
    f.frame,
    f.dtMs,
    f.fps,
    f.physicsMs,
    f.renderMs,
    f.audioMs,
    f.longTasksCount,
    f.drawCalls,
    f.triangles,
    f.geometries,
    f.textures,
    f.programs,
    f.usedHeapMB,
    f.heapDeltaMB,
    f.enemies,
    f.bullets,
    f.shards,
    f.isSpike ? 1 : 0,
    f.isMicroStutter ? 1 : 0,
  ]);

  const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
  const downloadAnchor = document.createElement('a');
  const filename = `superhot_telemetry_diagnostic_${new Date().toISOString().replace(/[:.]/g, '-')}.csv`;
  downloadAnchor.setAttribute('href', encodeURI(csvContent));
  downloadAnchor.setAttribute('download', filename);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}
