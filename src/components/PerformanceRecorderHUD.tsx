import React, { useEffect, useState, useRef } from 'react';
import {
  performanceRecorder,
  TelemetryFrame,
  PerformanceReport,
  downloadJsonReport,
  downloadCsvReport,
} from '../game/performanceRecorder';
import { Disc, Download, FileText, X, AlertTriangle, Activity, BarChart2, Clock, ShieldCheck, Zap } from 'lucide-react';

interface PerformanceRecorderHUDProps {
  webglRenderer?: string;
  graphicsPreset?: string;
  onToggleRecording?: () => void;
}

export const PerformanceRecorderHUD: React.FC<PerformanceRecorderHUDProps> = ({
  graphicsPreset = 'DESCONHECIDO',
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [currentFrame, setCurrentFrame] = useState<TelemetryFrame | null>(null);
  const [reportModal, setReportModal] = useState<PerformanceReport | null>(null);
  const [autoDownload30s, setAutoDownload30s] = useState(true);
  const [nextAutoDownloadSec, setNextAutoDownloadSec] = useState(30);

  const [savedCrashReport, setSavedCrashReport] = useState<PerformanceReport | null>(() => {
    return performanceRecorder.hasSavedCrashLog() ? performanceRecorder.getSavedCrashLog() : null;
  });

  const lastAutoDownloadTimeRef = useRef<number>(0);

  // Inscrever-se nas atualizações do gravador
  useEffect(() => {
    const unsubscribe = performanceRecorder.subscribe((recording, frame) => {
      setIsRecording(recording);
      if (frame) setCurrentFrame(frame);
    });
    return unsubscribe;
  }, []);

  // Timer para Auto-Download a cada 30 segundos de gravação ativa
  useEffect(() => {
    if (!isRecording || !autoDownload30s) {
      setNextAutoDownloadSec(30);
      return;
    }

    lastAutoDownloadTimeRef.current = Date.now();

    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - lastAutoDownloadTimeRef.current) / 1000);
      const remaining = Math.max(0, 30 - elapsed);
      setNextAutoDownloadSec(remaining);

      if (remaining === 0) {
        lastAutoDownloadTimeRef.current = Date.now();
        setNextAutoDownloadSec(30);
        // Gera e dispara o auto-download do relatório parcial em JSON
        const report = performanceRecorder.generateReportInternal(undefined, graphicsPreset);
        if (report) {
          console.log('[PERFORMANCE RECORDER] ⏱️ Auto-Download de 30 segundos acionado!');
          downloadJsonReport(report);
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isRecording, autoDownload30s, graphicsPreset]);

  // Listener para Tecla F8
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F8') {
        e.preventDefault();
        if (performanceRecorder.getIsRecording()) {
          const report = performanceRecorder.stopRecording(undefined, graphicsPreset);
          if (report) {
            setReportModal(report);
            downloadJsonReport(report);
          }
        } else {
          performanceRecorder.startRecording();
          setReportModal(null);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [graphicsPreset]);

  const handleStopRecording = () => {
    const report = performanceRecorder.stopRecording(undefined, graphicsPreset);
    if (report) {
      setReportModal(report);
      downloadJsonReport(report);
    }
  };

  return (
    <>
      {/* 0. Banner de Recuperação de Crash (Se o jogo travou na sessão anterior) */}
      {!isRecording && savedCrashReport && !reportModal && (
        <div className="fixed top-3 left-4 z-50 flex items-center gap-3 bg-amber-950/90 border border-amber-500/70 text-amber-200 px-4 py-2.5 rounded-lg shadow-2xl backdrop-blur-md">
          <AlertTriangle className="w-5 h-5 text-amber-400 animate-pulse shrink-0" />
          <div className="text-xs">
            <div className="font-black uppercase tracking-wider text-amber-300">
              LOG DE CRASH RECUPERADO (F8 CAIXA PRETA)
            </div>
            <div className="text-[10px] text-amber-200/80">
              O gravador salvou os dados da sessão anterior no cache antes de travar.
            </div>
          </div>
          <button
            onClick={() => {
              downloadJsonReport(savedCrashReport);
              setReportModal(savedCrashReport);
              performanceRecorder.clearSavedCrashLog();
              setSavedCrashReport(null);
            }}
            className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-[10px] uppercase rounded shadow cursor-pointer transition-colors whitespace-nowrap"
          >
            BAIXAR LOG DO CRASH
          </button>
          <button
            onClick={() => {
              performanceRecorder.clearSavedCrashLog();
              setSavedCrashReport(null);
            }}
            className="text-amber-400/70 hover:text-white text-xs px-1 font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* 1. Barra Status de Gravação Ativa (Overlay Superior Central) */}
      {isRecording && currentFrame && (
        <div className="fixed top-3 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-zinc-950/90 border border-red-500/80 px-4 py-2 rounded-full shadow-2xl backdrop-blur-md">
          <div className="flex items-center gap-2 text-red-400 font-bold text-xs tracking-wider uppercase">
            <Disc className="w-4 h-4 text-red-500 animate-spin" />
            <span>● REC</span>
            <span className="text-white font-mono">
              [ {Math.floor(currentFrame.timeMs / 1000).toString().padStart(2, '0')}s ]
            </span>
          </div>

          <div className="h-4 w-px bg-zinc-700" />

          <div className="flex items-center gap-3 text-[11px] font-mono text-gray-200">
            <div>
              <span className="text-gray-400">FPS:</span>{' '}
              <span className={`font-bold ${currentFrame.fps < 30 ? 'text-red-400' : 'text-green-400'}`}>
                {currentFrame.fps}
              </span>
            </div>
            <div>
              <span className="text-gray-400">Calls:</span>{' '}
              <span className="text-yellow-300 font-semibold">{currentFrame.drawCalls}</span>
            </div>
            <div>
              <span className="text-gray-400">Tris:</span>{' '}
              <span className="text-cyan-300">{(currentFrame.triangles / 1000).toFixed(1)}k</span>
            </div>
            {currentFrame.usedHeapMB > 0 && (
              <div>
                <span className="text-gray-400">Mem:</span>{' '}
                <span className="text-purple-300">{currentFrame.usedHeapMB}MB</span>
              </div>
            )}
          </div>

          <div className="h-4 w-px bg-zinc-700" />

          {/* Toggle Auto-Download 30s */}
          <button
            onClick={() => setAutoDownload30s(!autoDownload30s)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-bold tracking-wider transition-colors ${
              autoDownload30s
                ? 'bg-emerald-950/90 text-emerald-300 border border-emerald-500/50'
                : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
            }`}
            title="Auto-baixar JSON a cada 30 segundos previne perda de relatórios em caso de travamento do navegador"
          >
            <Clock className="w-3 h-3 text-emerald-400" />
            <span>AUTO-JSON ({nextAutoDownloadSec}s)</span>
          </button>

          <button
            onClick={handleStopRecording}
            className="ml-1 px-3 py-1 bg-red-600 hover:bg-red-500 text-white font-bold text-xs rounded transition-colors"
            title="Parar Gravação e Baixar Relatório (F8)"
          >
            PARAR (F8)
          </button>
        </div>
      )}

      {/* 2. Modal do Relatório de Diagnóstico Completo (Caixa Preta) */}
      {reportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-3xl bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl p-6 text-white overflow-hidden max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-red-500/20 text-red-400 rounded-lg border border-red-500/30">
                  <Activity className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-lg font-bold tracking-tight uppercase">Diagnóstico de Desempenho (Caixa Preta)</h2>
                  <p className="text-xs text-zinc-400">Relatório Completo de Telemetria de Renderização, Memória & Engine</p>
                </div>
              </div>
              <button
                onClick={() => setReportModal(null)}
                className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Conteúdo com Scroll */}
            <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
              {/* Resumo da Sessão */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="bg-zinc-800/80 p-3 rounded-lg border border-zinc-700/50">
                  <span className="text-[11px] text-zinc-400 block uppercase">FPS Médio / 1% Low</span>
                  <div className="text-base font-bold font-mono text-green-400">
                    {reportModal.meta.avgFps} <span className="text-xs text-zinc-400">/ {reportModal.meta.percentile1LowFps} FPS</span>
                  </div>
                </div>

                <div className="bg-zinc-800/80 p-3 rounded-lg border border-zinc-700/50">
                  <span className="text-[11px] text-zinc-400 block uppercase">Spikes (&lt;30FPS)</span>
                  <div className={`text-base font-bold font-mono ${reportModal.meta.lagSpikesCount > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                    {reportModal.meta.lagSpikesCount} <span className="text-xs text-zinc-400">frames</span>
                  </div>
                </div>

                <div className="bg-zinc-800/80 p-3 rounded-lg border border-zinc-700/50">
                  <span className="text-[11px] text-zinc-400 block uppercase">Draw Calls Máx</span>
                  <div className="text-base font-bold font-mono text-yellow-400">
                    {reportModal.meta.maxDrawCalls}
                  </div>
                </div>

                <div className="bg-zinc-800/80 p-3 rounded-lg border border-zinc-700/50">
                  <span className="text-[11px] text-zinc-400 block uppercase">Pico Memória JS</span>
                  <div className="text-base font-bold font-mono text-purple-400">
                    {reportModal.meta.peakHeapMB > 0 ? `${reportModal.meta.peakHeapMB} MB` : 'N/D'}
                  </div>
                </div>
              </div>

              {/* Diagnósticos da IA */}
              <div className="bg-zinc-800/50 border border-zinc-700/60 rounded-lg p-4 space-y-2">
                <h3 className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-2">
                  <BarChart2 className="w-4 h-4 text-red-400" />
                  Análise Diagnóstica Automática
                </h3>

                <div className="space-y-2 text-xs">
                  {reportModal.diagnostics.map((diag, i) => (
                    <div key={i} className="p-2.5 rounded bg-zinc-900/80 border border-zinc-800 text-zinc-200 flex items-start gap-2">
                      <span className="mt-0.5">{diag.startsWith('🔴') ? '🔴' : diag.startsWith('⚠️') ? '⚠️' : '🟢'}</span>
                      <span className="leading-relaxed">{diag.replace(/^[🔴⚠️🟢🟡💥🔫⚡]\s*/, '')}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Especificações do Hardware & WebGL Context */}
              <div className="text-[11px] text-zinc-400 bg-zinc-950/80 p-3 rounded border border-zinc-800 grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div><strong className="text-zinc-300">GPU Vendedor:</strong> {reportModal.meta.webglVendor}</div>
                <div><strong className="text-zinc-300">GPU Renderer:</strong> {reportModal.meta.webglRenderer}</div>
                <div><strong className="text-zinc-300">Max Texture Size:</strong> {reportModal.meta.maxTextureSize}px</div>
                <div><strong className="text-zinc-300">Resolução Tela:</strong> {reportModal.meta.screenResolution} (DPR: {reportModal.meta.devicePixelRatio})</div>
                <div><strong className="text-zinc-300">CPU Cores / RAM:</strong> {reportModal.meta.hardwareConcurrency} Cores {reportModal.meta.deviceMemoryGB ? ` / ${reportModal.meta.deviceMemoryGB}GB RAM` : ''}</div>
                <div><strong className="text-zinc-300">Extensões WebGL:</strong> {reportModal.meta.supportedExtensionsCount} ativas</div>
                <div><strong className="text-zinc-300">Preset Gráfico:</strong> {reportModal.meta.graphicsPreset}</div>
                <div><strong className="text-zinc-300">Total Gravado:</strong> {reportModal.meta.durationSeconds}s ({reportModal.meta.totalFrames} frames)</div>
              </div>
            </div>

            {/* Footer Botões */}
            <div className="pt-4 border-t border-zinc-800 flex flex-wrap items-center justify-between gap-3">
              <div className="flex gap-2">
                <button
                  onClick={() => downloadJsonReport(reportModal)}
                  className="flex items-center gap-2 px-3.5 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-lg transition-colors shadow"
                >
                  <Download className="w-4 h-4" />
                  BAIXAR JSON COMPLETO (DIAG NÓSTICO IA)
                </button>

                <button
                  onClick={() => downloadCsvReport(reportModal)}
                  className="flex items-center gap-2 px-3.5 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold rounded-lg transition-colors border border-zinc-700"
                >
                  <FileText className="w-4 h-4" />
                  BAIXAR CSV (EXCEL)
                </button>
              </div>

              <button
                onClick={() => setReportModal(null)}
                className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white text-xs font-semibold rounded-lg transition-colors"
              >
                FECHAR
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
