import * as THREE from 'three';

export interface GameStateRef {
  dtFactor: number;
  enemies?: any[];
  bullets?: any[];
  glassShards?: any[];
  airborneWeapons?: any[];
  droppedWeapons?: any[];
}

export interface TelemetryFrame {
  timeMs: number;
  frame: number;
  dtMs: number;
  fps: number;
  dtFactor: number;
  drawCalls: number;
  triangles: number;
  geometries: number;
  textures: number;
  usedHeapMB: number;
  totalHeapMB: number;
  heapLimitMB: number;
  enemies: number;
  bullets: number;
  shards: number;
  weapons: number;
  isSpike: boolean;
}

export interface PerformanceReportMeta {
  date: string;
  userAgent: string;
  screenResolution: string;
  devicePixelRatio: number;
  webglRenderer: string;
  graphicsPreset: string;
  totalFrames: number;
  durationSeconds: number;
  avgFps: number;
  minFps: number;
  maxFps: number;
  lagSpikesCount: number;
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

class PerformanceRecorder {
  private isRecording = false;
  private frames: TelemetryFrame[] = [];
  private startTime = 0;
  private frameCount = 0;
  private listeners: Set<(recording: boolean, frame?: TelemetryFrame) => void> = new Set();
  private latestFrame: TelemetryFrame | null = null;

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

  public startRecording() {
    this.isRecording = true;
    this.frames = [];
    this.startTime = performance.now();
    this.frameCount = 0;
    this.latestFrame = null;
    this.notify();
    console.log('[PERFORMANCE RECORDER] Gravação iniciada (F8)');
  }

  public recordFrame(renderer: THREE.WebGLRenderer, state: GameStateRef, rawDtSeconds: number) {
    if (!this.isRecording) return;

    this.frameCount++;
    const now = performance.now();
    const timeMs = Math.round(now - this.startTime);
    const dtMs = Math.round(rawDtSeconds * 1000 * 10) / 10;
    const fps = rawDtSeconds > 0 ? Math.min(240, Math.round(1 / rawDtSeconds)) : 60;

    // GPU Three.js Telemetry
    const info = renderer.info;
    const drawCalls = info.render.calls;
    const triangles = info.render.triangles;
    const geometries = info.memory.geometries;
    const textures = info.memory.textures;

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

    // Entity counts
    const enemies = state.enemies?.length || 0;
    const bullets = state.bullets?.length || 0;
    const shards = state.glassShards?.length || 0;
    const weapons = (state.airborneWeapons?.length || 0) + (state.droppedWeapons?.length || 0);

    const isSpike = rawDtSeconds > 0.0333; // FPS < 30

    const frameData: TelemetryFrame = {
      timeMs,
      frame: this.frameCount,
      dtMs,
      fps,
      dtFactor: Math.round(state.dtFactor * 100) / 100,
      drawCalls,
      triangles,
      geometries,
      textures,
      usedHeapMB,
      totalHeapMB,
      heapLimitMB,
      enemies,
      bullets,
      shards,
      weapons,
      isSpike,
    };

    // Buffer limit: max 10,000 frames (~3 minutos) para não inflar a memória durante o teste
    if (this.frames.length < 10000) {
      this.frames.push(frameData);
    }
    this.latestFrame = frameData;
    this.notify();
  }

  public stopRecording(renderer?: THREE.WebGLRenderer, graphicsPreset = 'DESCONHECIDO'): PerformanceReport | null {
    if (!this.isRecording) return null;

    this.isRecording = false;
    const endTime = performance.now();
    const durationSeconds = Math.round(((endTime - this.startTime) / 1000) * 10) / 10;

    if (this.frames.length === 0) {
      this.notify();
      return null;
    }

    // Calcular estatísticas
    const fpsList = this.frames.map((f) => f.fps);
    const drawCallsList = this.frames.map((f) => f.drawCalls);
    const trianglesList = this.frames.map((f) => f.triangles);
    const heapList = this.frames.map((f) => f.usedHeapMB);

    const avgFps = Math.round(fpsList.reduce((a, b) => a + b, 0) / fpsList.length);
    const minFps = Math.min(...fpsList);
    const maxFps = Math.max(...fpsList);
    const lagSpikesCount = this.frames.filter((f) => f.isSpike).length;

    const avgDrawCalls = Math.round(drawCallsList.reduce((a, b) => a + b, 0) / drawCallsList.length);
    const maxDrawCalls = Math.max(...drawCallsList);
    const maxTriangles = Math.max(...trianglesList);
    const peakHeapMB = Math.max(...heapList);

    // Obter informações da GPU WebGL se disponível
    let webglRenderer = 'Desconhecido';
    if (renderer) {
      const gl = renderer.getContext();
      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
      if (debugInfo) {
        webglRenderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || 'WebGL Genérico';
      }
    }

    const meta: PerformanceReportMeta = {
      date: new Date().toISOString(),
      userAgent: navigator.userAgent,
      screenResolution: `${window.innerWidth}x${window.innerHeight}`,
      devicePixelRatio: window.devicePixelRatio || 1,
      webglRenderer,
      graphicsPreset,
      totalFrames: this.frames.length,
      durationSeconds,
      avgFps,
      minFps,
      maxFps,
      lagSpikesCount,
      avgDrawCalls,
      maxDrawCalls,
      maxTriangles,
      peakHeapMB,
    };

    // Diagnósticos automáticos
    const diagnostics: string[] = [];

    if (lagSpikesCount === 0) {
      diagnostics.push('🟢 Excelente desempenho! Nenhum engasgo crítico (< 30 FPS) foi detectado durante a sessão.');
    } else {
      const percentSpikes = Math.round((lagSpikesCount / this.frames.length) * 100);
      diagnostics.push(`🔴 Atenção: Ocorreram ${lagSpikesCount} engasgos (${percentSpikes}% dos frames apresentaram queda abaixo de 30 FPS).`);
    }

    if (maxDrawCalls > 120) {
      diagnostics.push(`⚠️ Alto volume de Draw Calls: Pico de ${maxDrawCalls} chamadas por segundo. Recomenda-se reduzir o número de objetos individuais ou usar InstancedMesh.`);
    } else if (maxDrawCalls > 60) {
      diagnostics.push(`🟡 Draw Calls moderadas (${maxDrawCalls} máx). Desempenho aceitável para GPUs dedicadas, mas pode travar em mobile.`);
    } else {
      diagnostics.push(`🟢 Draw Calls otimizadas (Média: ${avgDrawCalls}, Máx: ${maxDrawCalls}).`);
    }

    if (maxTriangles > 150000) {
      diagnostics.push(`⚠️ Alta contagem de Polígonos: Pico de ${maxTriangles.toLocaleString()} triângulos renderizados na tela.`);
    }

    if (peakHeapMB > 450) {
      diagnostics.push(`⚠️ Uso elevado de Memória JS Heap: Pico de ${peakHeapMB} MB. Verifique se o Coletor de Lixo (GC) está causando pequenas travadas periódicas.`);
    }

    // Verificar se os engasgos coincidem com estilhaços ou balas
    const spikeFrames = this.frames.filter((f) => f.isSpike);
    if (spikeFrames.length > 0) {
      const maxShardsInSpike = Math.max(...spikeFrames.map((f) => f.shards));
      const maxBulletsInSpike = Math.max(...spikeFrames.map((f) => f.bullets));

      if (maxShardsInSpike > 20) {
        diagnostics.push(`💥 Gargalo de Estilhaços: Em momentos de queda de FPS, havia até ${maxShardsInSpike} estilhaços de vidro ativos na cena.`);
      }
      if (maxBulletsInSpike > 15) {
        diagnostics.push(`🔫 Gargalo de Projéteis: Havia até ${maxBulletsInSpike} projéteis simultâneos voando durante os engasgos.`);
      }
    }

    const report: PerformanceReport = {
      meta,
      diagnostics,
      frames: [...this.frames],
    };

    this.latestFrame = null;
    this.notify();

    console.log('[PERFORMANCE RECORDER] Relatório de Desempenho gerado:', report);
    return report;
  }
}

export const performanceRecorder = new PerformanceRecorder();

/**
 * Dispara o download automático do relatório em formato JSON
 */
export function downloadJsonReport(report: PerformanceReport) {
  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(report, null, 2));
  const downloadAnchor = document.createElement('a');
  const filename = `superhot_performance_log_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  downloadAnchor.setAttribute('href', dataStr);
  downloadAnchor.setAttribute('download', filename);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

/**
 * Dispara o download automático do relatório em formato CSV
 */
export function downloadCsvReport(report: PerformanceReport) {
  const headers = [
    'TimeMs',
    'Frame',
    'DtMs',
    'FPS',
    'DtFactor',
    'DrawCalls',
    'Triangles',
    'Geometries',
    'Textures',
    'UsedHeapMB',
    'TotalHeapMB',
    'Enemies',
    'Bullets',
    'Shards',
    'Weapons',
    'IsLagSpike',
  ];

  const rows = report.frames.map((f) => [
    f.timeMs,
    f.frame,
    f.dtMs,
    f.fps,
    f.dtFactor,
    f.drawCalls,
    f.triangles,
    f.geometries,
    f.textures,
    f.usedHeapMB,
    f.totalHeapMB,
    f.enemies,
    f.bullets,
    f.shards,
    f.weapons,
    f.isSpike ? 1 : 0,
  ]);

  const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
  const downloadAnchor = document.createElement('a');
  const filename = `superhot_performance_log_${new Date().toISOString().replace(/[:.]/g, '-')}.csv`;
  downloadAnchor.setAttribute('href', encodeURI(csvContent));
  downloadAnchor.setAttribute('download', filename);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}
