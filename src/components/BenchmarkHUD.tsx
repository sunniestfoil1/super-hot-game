import React, { useEffect, useState } from 'react';
import { benchmarkRunner, BenchmarkStatus } from '../game/benchmarkRunner';
import { downloadJsonReport } from '../game/performanceRecorder';
import { Activity, Disc, Download, X, CheckCircle2, ShieldCheck, Flame, Zap } from 'lucide-react';

export const BenchmarkHUD: React.FC = () => {
  const [status, setStatus] = useState<BenchmarkStatus>({
    active: false,
    currentStepIndex: 0,
    totalSteps: 9,
    currentStep: null,
    secondsRemainingInStep: 0,
    completedReport: null,
  });

  useEffect(() => {
    const unsubscribe = benchmarkRunner.subscribe((st) => {
      setStatus(st);
    });
    return unsubscribe;
  }, []);

  if (!status.active && !status.completedReport) {
    return null;
  }

  return (
    <>
      {/* 1. Banner Superior de Benchmark Ativo */}
      {status.active && status.currentStep && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 bg-emerald-950/95 border border-emerald-500/80 px-6 py-3 rounded-full shadow-2xl backdrop-blur-md animate-pulse text-white">
          <div className="flex items-center gap-2 text-emerald-400 font-black text-sm uppercase tracking-wider">
            <Disc className="w-5 h-5 text-emerald-400 animate-spin" />
            <span>TESTE AUTOMÁTICO</span>
          </div>

          <div className="h-5 w-px bg-emerald-800" />

          <div className="flex flex-col text-left">
            <div className="text-xs font-black uppercase text-emerald-200">
              {status.currentStep.techniqueName}
            </div>
            <div className="text-[11px] font-mono text-emerald-300/80">
              Fase {status.currentStepIndex + 1} de {status.totalSteps} | Inimigos: {status.currentStep.enemiesCount}
            </div>
          </div>

          <div className="h-5 w-px bg-emerald-800" />

          <div className="font-mono font-bold text-lg text-yellow-300">
            {status.secondsRemainingInStep}s
          </div>

          <button
            onClick={() => benchmarkRunner.cancelBenchmark()}
            className="px-3 py-1 bg-red-600 hover:bg-red-500 text-white font-bold text-xs rounded transition-colors"
          >
            CANCELAR
          </button>
        </div>
      )}

      {/* 2. Modal de Conclusão do Benchmark */}
      {status.completedReport && !status.active && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-xl bg-zinc-900 border border-emerald-500/50 rounded-xl shadow-2xl p-6 text-white text-center space-y-5">
            <div className="w-16 h-16 bg-emerald-500/20 border border-emerald-500/40 rounded-full flex items-center justify-center mx-auto text-emerald-400">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <div>
              <h2 className="text-2xl font-black uppercase tracking-tight text-emerald-400">
                BATERIA DE TESTES CONCLUÍDA!
              </h2>
              <p className="mt-1 text-xs text-zinc-300">
                O arquivo de telemetria JSON com todas as métricas comparativas foi salvo automaticamente.
              </p>
            </div>

            <div className="bg-zinc-950 p-4 rounded-lg border border-zinc-800 text-left font-mono text-xs space-y-1.5 text-zinc-300">
              <div><strong className="text-emerald-400">Duração Total:</strong> {status.completedReport.meta.durationSeconds}s</div>
              <div><strong className="text-emerald-400">Frames Gravados:</strong> {status.completedReport.meta.totalFrames} frames</div>
              <div><strong className="text-emerald-400">FPS Médio Geral:</strong> {status.completedReport.meta.avgFps} FPS</div>
              <div><strong className="text-emerald-400">1% Low FPS:</strong> {status.completedReport.meta.percentile1LowFps} FPS</div>
            </div>

            <div className="flex gap-3 justify-center pt-2">
              <button
                onClick={() => downloadJsonReport(status.completedReport!)}
                className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wider rounded-lg transition-colors shadow-lg shadow-emerald-600/30"
              >
                <Download className="w-4 h-4" />
                BAIXAR JSON NOVAMENTE
              </button>

              <button
                onClick={() => benchmarkRunner.cancelBenchmark()}
                className="px-5 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs uppercase tracking-wider rounded-lg transition-colors border border-zinc-700"
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
