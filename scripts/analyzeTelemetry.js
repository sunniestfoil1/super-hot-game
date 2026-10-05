import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function analyzeFile(filePath) {
  console.log('\n======================================================================');
  console.log(`🔍 ANALISANDO ARQUIVO: ${path.basename(filePath)}`);
  console.log('======================================================================');

  if (!fs.existsSync(filePath)) {
    console.error(`❌ Arquivo não encontrado: ${filePath}`);
    return;
  }

  const rawData = fs.readFileSync(filePath, 'utf8');
  let data;
  try {
    data = JSON.parse(rawData);
  } catch (err) {
    console.error(`❌ Erro ao parsear JSON: ${err.message}`);
    return;
  }

  const meta = data.meta || {};
  const frames = data.frames || [];

  console.log(`📌 DATA: ${meta.date || 'N/A'}`);
  console.log(`📌 DURAÇÃO: ${meta.durationSeconds || 0}s | TOTAL FRAMES: ${meta.totalFrames || frames.length}`);
  console.log(`📌 FPS MÉDIO: ${meta.avgFps} | MIN: ${meta.minFps} | MAX: ${meta.maxFps}`);
  console.log(`📌 1% LOW FPS: ${meta.percentile1LowFps} | 99TH FRAME TIME: ${meta.percentile99FrameTimeMs}ms`);
  console.log(`📌 LAG SPIKES (<30 FPS): ${meta.lagSpikesCount} | MICRO-STUTTERS (<60 FPS): ${meta.microStuttersCount}`);
  console.log(`📌 PICO MEMÓRIA HEAP: ${meta.peakHeapMB} MB`);

  if (meta.avgPhysicsMs !== undefined) {
    console.log('\n📊 PROFILE POR SUBSISTEMA (MÉDIAS DA CPU & GPU):');
    console.log(`   ⚙️ Loop de Física (physicsMs): ${meta.avgPhysicsMs} ms/frame`);
    console.log(`   🎨 Renderização WebGL (renderMs): ${meta.avgRenderMs} ms/frame`);
    console.log(`   🔊 Motor de Áudio (audioMs): ${meta.avgAudioMs} ms/frame`);
    console.log(`   🛑 LongTasks Bloqueantes (>50ms): ${meta.totalLongTasksCount || 0} (Maior: ${meta.maxSingleTaskDurationMs || 0}ms)`);
  }

  if (frames.length === 0) {
    console.log('⚠️ Nenhum frame gravado.');
    return;
  }

  // 1. Detectar Gaps de Tempo entre Frames (Congelamento real da Thread Principal / Crash de N segundos)
  console.log('\n----------------------------------------------------------------------');
  console.log('🚨 DETECÇÃO DE CRASHES E GAPS DE TEMPO (CONGELAMENTOS DA MAIN THREAD > 300ms)');
  console.log('----------------------------------------------------------------------');

  const timeGaps = [];
  const dtSpikes = [];
  const memorySpikes = [];

  for (let i = 0; i < frames.length; i++) {
    const f = frames[i];
    const prev = i > 0 ? frames[i - 1] : null;

    if (prev) {
      const gapMs = f.timeMs - prev.timeMs;
      if (gapMs > 300) {
        timeGaps.push({
          frameIndex: i,
          frameNum: f.frame,
          startTimeMs: prev.timeMs,
          endTimeMs: f.timeMs,
          durationSec: (gapMs / 1000).toFixed(2),
          prevFrame: prev,
          currFrame: f,
        });
      }
    }

    if (f.dtMs > 100) {
      dtSpikes.push(f);
    }

    if (prev && prev.usedHeapMB > 0 && f.usedHeapMB > 0) {
      const heapDelta = f.usedHeapMB - prev.usedHeapMB;
      if (Math.abs(heapDelta) > 10) {
        memorySpikes.push({
          frameNum: f.frame,
          timeMs: f.timeMs,
          deltaMB: heapDelta.toFixed(1),
          usedHeapMB: f.usedHeapMB,
        });
      }
    }
  }

  if (timeGaps.length === 0) {
    console.log('✅ Nenhum congelamento grave de thread (> 300ms) detectado neste log.');
  } else {
    timeGaps.forEach((g) => {
      console.log(`\n💥 CONGELAMENTO DETECTADO no Segundo ${(g.startTimeMs / 1000).toFixed(1)}s (Frame #${g.currFrame.frame})!`);
      console.log(`   ⏱️ Duração do Travamento: ${g.durationSec} SEGUNDOS (Thread principal congelou!)`);
      console.log(`   📍 Posição do Player antes do crash: X:${g.prevFrame.playerPos?.x ?? 'N/A'}, Y:${g.prevFrame.playerPos?.y ?? 'N/A'}, Z:${g.prevFrame.playerPos?.z ?? 'N/A'}`);
      console.log(`   🎮 Entidades antes do crash: Inimigos: ${g.prevFrame.enemies} (Vivos: ${g.prevFrame.enemiesAlive}, Dissolvendo: ${g.prevFrame.enemiesDissolving}), Projéteis: ${g.prevFrame.bullets}, Estilhaços: ${g.prevFrame.shards}`);
      console.log(`   🎮 Entidades após o crash: Inimigos: ${g.currFrame.enemies}, Projéteis: ${g.currFrame.bullets}, Estilhaços: ${g.currFrame.shards}`);
      console.log(`   ⏱️ Subsystems no crash: Física=${g.currFrame.physicsMs || 0}ms | Render=${g.currFrame.renderMs || 0}ms | Áudio=${g.currFrame.audioMs || 0}ms`);
      console.log(`   💾 Memória Heap: ${g.prevFrame.usedHeapMB} MB -> ${g.currFrame.usedHeapMB} MB (Variação: ${(g.currFrame.usedHeapMB - g.prevFrame.usedHeapMB).toFixed(1)} MB)`);
    });
  }

  // 2. Análise de Picos de Delta-Time (DT > 100ms)
  if (dtSpikes.length > 0) {
    console.log('\n----------------------------------------------------------------------');
    console.log(`⚠️ FRAMES COM DT ELEVADO (> 100ms / < 10 FPS): Total ${dtSpikes.length}`);
    console.log('----------------------------------------------------------------------');
    dtSpikes.slice(0, 10).forEach((f) => {
      console.log(`  Frame #${f.frame} (${(f.timeMs / 1000).toFixed(1)}s): dtMs=${f.dtMs}ms (${f.fps} FPS) | Física=${f.physicsMs}ms | Render=${f.renderMs}ms | Inimigos=${f.enemies} (Dissolvendo=${f.enemiesDissolving}) | Estilhaços=${f.shards} | Heap=${f.usedHeapMB}MB`);
    });
  }

  // 3. Análise de Variação da Coleta de Lixo (GC Spikes)
  if (memorySpikes.length > 0) {
    console.log('\n----------------------------------------------------------------------');
    console.log(`🗑️ PICOS DE ALOCAÇÃO / GC DEALLOCATION DETECTADOS (>10MB): Total ${memorySpikes.length}`);
    console.log('----------------------------------------------------------------------');
    memorySpikes.slice(0, 5).forEach((m) => {
      console.log(`  Frame #${m.frameNum} (${(m.timeMs / 1000).toFixed(1)}s): Variação de Heap = ${m.deltaMB} MB (Uso atual: ${m.usedHeapMB} MB)`);
    });
  }

  // 4. Resumo Diagnóstico da Análise Automática
  console.log('\n----------------------------------------------------------------------');
  console.log('🎯 DIAGNÓSTICO FINAL DA ANÁLISE AUTOMÁTICA');
  console.log('----------------------------------------------------------------------');

  if (timeGaps.length > 0) {
    const totalCrashTime = timeGaps.reduce((sum, g) => sum + parseFloat(g.durationSec), 0);
    console.log(`🔴 CRÍTICO: O jogo sofreu ${timeGaps.length} congelamentos graves da Thread Principal, somando ${totalCrashTime.toFixed(1)}s sem responder.`);
  } else if (meta.lagSpikesCount > 0) {
    console.log(`🟡 MODERADO: O jogo oscilou FPS em ${meta.lagSpikesCount} frames, mas a Thread Principal não congelou totalmente.`);
  } else {
    console.log(`🟢 SAUDÁVEL: Desempenho liso e contínuo durante toda a captura.`);
  }
}

const args = process.argv.slice(2);
let targetFiles = args;

if (targetFiles.length === 0) {
  const dir = process.cwd();
  targetFiles = fs.readdirSync(dir)
    .filter((f) => f.startsWith('superhot_telemetry_diagnostic') && f.endsWith('.json'))
    .map((f) => path.join(dir, f));
}

if (targetFiles.length === 0) {
  console.log('Nenhum arquivo superhot_telemetry_diagnostic*.json encontrado para análise.');
} else {
  targetFiles.forEach(analyzeFile);
}
