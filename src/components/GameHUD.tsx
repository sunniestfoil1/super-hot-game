import React, { useState } from 'react';
import { RotateCcw, Play, ShieldAlert, Zap, Settings, Volume2, Crosshair, Flame, Trophy, Clock, Cpu, Gauge, Monitor, Smartphone, Activity, Eye } from 'lucide-react';
import { performanceRecorder, downloadJsonReport } from '../game/performanceRecorder';
import { GameMode, GameStatus, WeaponType } from '../game/types';
import { GameSettings, QualityPreset, applyPresetToSettings, runHardwareBenchmark } from '../game/settingsManager';

interface GameHUDProps {
  levelName: string;
  levelSubtitle: string;
  gameMode: GameMode;
  endlessKills: number;
  endlessTime: number;
  bestEndlessKills: number;
  bestEndlessTime: number;
  weaponType: WeaponType | null;
  ammo: number;
  enemiesRemaining: number;
  totalEnemies: number;
  dtFactor: number;
  gameState: GameStatus;
  isPointerLocked: boolean;
  mantraWord: 'SUPER' | 'HOT';
  showKillBanner: boolean;
  canCatchWeapon: boolean;
  canPunchEnemy: boolean;
  canHotswitchEnemy: boolean;
  hotswitchCooldown: number;
  devMode: boolean;
  godMode: boolean;
  infiniteAmmo: boolean;
  gameSettings: GameSettings;
  onUpdateSettings: (newSettings: GameSettings) => void;
  onToggleDev: () => void;
  onToggleGodMode: () => void;
  onToggleInfiniteAmmo: () => void;
  onSelectLevel: (idx: number) => void;
  onSpawnWeapon: (type: WeaponType) => void;
  onStartGame: () => void;
  onStartEndlessGame: () => void;
  onStartSandboxGame: () => void;
  onStartBenchmarkGame?: () => void;
  onRestart: () => void;
  onNextLevel: () => void;
  onLockPointer: () => void;
  onExitToMenu?: () => void;
  isMobileHUD?: boolean;
  isMobilePaused?: boolean;
  onToggleMobilePause?: (paused: boolean) => void;
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 10);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms}`;
}

export const GameHUD: React.FC<GameHUDProps> = ({
  gameMode,
  endlessKills,
  endlessTime,
  bestEndlessKills,
  bestEndlessTime,
  weaponType,
  ammo,
  enemiesRemaining,
  gameState,
  isPointerLocked,
  mantraWord,
  canCatchWeapon,
  canPunchEnemy,
  canHotswitchEnemy,
  hotswitchCooldown,
  devMode,
  godMode,
  infiniteAmmo,
  gameSettings,
  onUpdateSettings,
  onToggleDev,
  onToggleGodMode,
  onToggleInfiniteAmmo,
  onSpawnWeapon,
  onStartGame,
  onStartEndlessGame,
  onStartSandboxGame,
  onStartBenchmarkGame,
  onRestart,
  onLockPointer,
  onSelectLevel,
  onExitToMenu,
  isMobileHUD,
  isMobilePaused,
  onToggleMobilePause,
}) => {
  const [showConfig, setShowConfig] = useState(false);
  const [isBenchmarking, setIsBenchmarking] = useState(false);
  const [benchmarkResultText, setBenchmarkResultText] = useState<string | null>(null);

  const maxAmmo =
    weaponType === 'shotgun'
      ? 2
      : weaponType === 'rifle'
      ? 12
      : weaponType === 'bottle' || weaponType === 'knife' || weaponType === 'ashtray'
      ? 1
      : 4;

  const handleSelectPreset = (preset: QualityPreset) => {
    const updated = applyPresetToSettings(preset, gameSettings);
    onUpdateSettings(updated);
  };

  const handleRunBenchmark = async () => {
    setIsBenchmarking(true);
    setBenchmarkResultText('TESTANDO HARDWARE (GPU / CPU)...');

    const res = await runHardwareBenchmark();
    setIsBenchmarking(false);

    const updated = {
      ...applyPresetToSettings(res.recommended, gameSettings),
      recommendedPreset: res.recommended,
    };
    onUpdateSettings(updated);
    setBenchmarkResultText(`TESTE CONCLUÍDO (${res.avgFps} FPS MÉDIO) · RECOMENDADO: ${res.recommended.toUpperCase()}`);
  };

  return (
    <div className="absolute inset-0 pointer-events-none z-20 font-sans select-none overflow-hidden">
      {/* -------- MENU -------- */}
      {gameState === 'menu' && (
        <div className="absolute inset-0 z-50 bg-[#e8e4de] flex flex-col items-center justify-center p-6 text-slate-950 pointer-events-auto">
          <div className="max-w-lg w-full text-center space-y-8">
            <div>
              <h1 className="text-7xl sm:text-8xl font-black tracking-tighter uppercase leading-none">
                WEB<span className="text-red-600">HOT</span>
              </h1>
              <p className="mt-3 text-xs font-bold text-slate-500 uppercase tracking-[0.35em]">
                O tempo só se move quando você se move
              </p>
            </div>

            <div className="flex flex-col gap-3 max-w-sm mx-auto">
              <button
                onClick={onStartGame}
                className="w-full py-4 bg-slate-950 hover:bg-slate-800 text-white font-black text-sm uppercase tracking-widest transition-colors flex items-center justify-center gap-3 cursor-pointer shadow-md"
              >
                <Play className="w-4 h-4 fill-current" />
                CAMPANHA
              </button>

              <button
                onClick={onStartEndlessGame}
                className="w-full py-4 bg-red-600 hover:bg-red-700 text-white font-black text-sm uppercase tracking-widest transition-colors flex items-center justify-center gap-3 cursor-pointer shadow-lg shadow-red-600/30"
              >
                <Flame className="w-5 h-5 fill-current animate-pulse" />
                MODO ATÉ MORRER
              </button>

              <button
                onClick={onStartSandboxGame}
                className="w-full py-4 bg-cyan-800 hover:bg-cyan-700 text-white font-black text-sm uppercase tracking-widest transition-colors flex items-center justify-center gap-3 cursor-pointer shadow-lg shadow-cyan-800/30"
              >
                <Eye className="w-5 h-5 fill-current" />
                MATE TODOS 2 (EXPLORAÇÃO)
              </button>

              {onStartBenchmarkGame && (
                <button
                  onClick={onStartBenchmarkGame}
                  className="w-full py-4 bg-emerald-700 hover:bg-emerald-600 text-white font-black text-sm uppercase tracking-widest transition-colors flex items-center justify-center gap-3 cursor-pointer shadow-lg shadow-emerald-700/30 border border-emerald-400/40"
                >
                  <Activity className="w-5 h-5 fill-current animate-pulse" />
                  🧪 BATERIA DE TESTES & BENCHMARK (5s)
                </button>
              )}

              <button
                onClick={() => setShowConfig(true)}
                className="w-full py-3 bg-transparent border-2 border-slate-950 hover:bg-slate-950 hover:text-white text-slate-950 font-black text-xs uppercase tracking-widest transition-colors flex items-center justify-center gap-2 cursor-pointer mt-2"
              >
                <Settings className="w-4 h-4" />
                CONFIGURAÇÕES DE VÍDEO & SISTEMA
              </button>
            </div>

            {bestEndlessKills > 0 && (
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/80 border border-slate-300 text-slate-700 text-[11px] font-black uppercase tracking-wider rounded-full shadow-sm">
                <Trophy className="w-3.5 h-3.5 text-amber-500" />
                RECORDE ATÉ MORRER: {bestEndlessKills} ABATES ({formatTime(bestEndlessTime)})
              </div>
            )}
          </div>
        </div>
      )}

      {/* -------- CONFIGURAÇÕES GLOBAL OVERLAY -------- */}
      {showConfig && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center p-4 text-slate-950 pointer-events-auto">
          <div className="max-w-xl w-full bg-white border border-slate-300 p-6 text-left space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto rounded-md">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h2 className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                <Settings className="w-4 h-4 text-red-600" /> CONFIGURAÇÕES DO JOGO
              </h2>
              <button
                onClick={() => setShowConfig(false)}
                className="text-xs font-bold text-slate-500 hover:text-slate-950 cursor-pointer uppercase px-2 py-1 bg-slate-100 border rounded"
              >
                VOLTAR
              </button>
            </div>

            {/* BENCHMARK DE HARDWARE */}
            <div className="p-4 bg-slate-950 text-white rounded space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider flex items-center gap-2 text-amber-400">
                  <Cpu className="w-4 h-4" /> TESTE DE DESEMPENHO (BENCHMARK)
                </span>
                <button
                  onClick={handleRunBenchmark}
                  disabled={isBenchmarking}
                  className="px-3 py-1.5 bg-red-600 hover:bg-red-700 disabled:bg-slate-700 text-white font-black text-[10px] uppercase tracking-wider rounded cursor-pointer transition-colors"
                >
                  {isBenchmarking ? 'TESTANDO...' : 'TESTAR GPU / CPU'}
                </button>
              </div>
              {benchmarkResultText && (
                <p className="text-[10px] font-mono text-slate-300 bg-slate-900 p-2 rounded">
                  {benchmarkResultText}
                </p>
              )}
            </div>

            {/* GRAVADOR DE DESEMPENHO (CAIXA PRETA F8) */}
            <div className="p-3 bg-red-950/20 border border-red-500/30 rounded flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-black uppercase tracking-wider text-red-600 flex items-center gap-1.5">
                  <Activity className="w-4 h-4" /> GRAVADOR CAIXA PRETA (F8)
                </div>
                <div className="text-[10px] text-slate-500 font-medium">
                  Grava FPS, Draw Calls, Memória JS e polígonos a cada frame para diagnóstico da IA.
                </div>
              </div>
              <button
                onClick={() => {
                  if (performanceRecorder.getIsRecording()) {
                    const report = performanceRecorder.stopRecording();
                    if (report) downloadJsonReport(report);
                  } else {
                    performanceRecorder.startRecording();
                    setShowConfig(false);
                  }
                }}
                className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white font-black text-[10px] uppercase tracking-wider rounded cursor-pointer transition-colors whitespace-nowrap"
              >
                {performanceRecorder.getIsRecording() ? 'PARAR (F8)' : 'INICIAR GRAVAÇÃO'}
              </button>
            </div>

            {/* PREDEFINIÇÕES DE QUALIDADE */}
            <div className="space-y-2">
              <span className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Gauge className="w-3.5 h-3.5" /> PREDEFINIÇÕES DE QUALIDADE GRÁFICA
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {(['basica', 'media', 'alta', 'ultra', 'ultra_max'] as QualityPreset[]).map((p) => {
                  const isSelected = gameSettings.preset === p;
                  const isRecommended = gameSettings.recommendedPreset === p;
                  return (
                    <div key={p} className="relative">
                      <button
                        onClick={() => handleSelectPreset(p)}
                        className={`w-full py-2.5 px-2 text-[10px] font-black uppercase tracking-wider border rounded cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-slate-950 text-white border-slate-950 shadow-md'
                            : 'bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        {p.replace('_', ' ')}
                      </button>
                      {isRecommended && (
                        <div className="absolute -top-2 left-1/2 -translate-x-1/2 bg-amber-500 text-slate-950 text-[8px] font-black px-1.5 py-0.5 rounded shadow tracking-tighter uppercase whitespace-nowrap animate-bounce">
                          RECOMENDADO
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* OPÇÕES DE VÍDEO DETALHADAS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-200">
              <label className="block space-y-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">Motion Blur</span>
                <button
                  onClick={() => onUpdateSettings({ ...gameSettings, motionBlurEnabled: !gameSettings.motionBlurEnabled })}
                  className={`w-full py-2 text-xs font-black uppercase border rounded cursor-pointer ${
                    gameSettings.motionBlurEnabled ? 'bg-red-600 text-white border-red-600' : 'bg-slate-100 text-slate-700 border-slate-300'
                  }`}
                >
                  {gameSettings.motionBlurEnabled ? 'ATIVADO' : 'DESATIVADO'}
                </button>
              </label>

              <label className="block space-y-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">Bloom</span>
                <button
                  onClick={() => onUpdateSettings({ ...gameSettings, bloomEnabled: !gameSettings.bloomEnabled })}
                  className={`w-full py-2 text-xs font-black uppercase border rounded cursor-pointer ${
                    gameSettings.bloomEnabled ? 'bg-slate-950 text-white border-slate-950' : 'bg-slate-100 text-slate-700 border-slate-300'
                  }`}
                >
                  {gameSettings.bloomEnabled ? 'ATIVADO' : 'DESATIVADO'}
                </button>
              </label>
            </div>

            {/* CONTROLES DE INTERFACE PC / MOBILE */}
            <div className="space-y-1 pt-2 border-t border-slate-200">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                <Monitor className="w-3.5 h-3.5" /> MODO DE INTERFACE DE CONTROLE
              </span>
              <div className="flex gap-2">
                {(['auto', 'pc', 'mobile'] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => onUpdateSettings({ ...gameSettings, interfaceMode: mode })}
                    className={`flex-1 py-2 text-[10px] font-black uppercase border rounded cursor-pointer ${
                      gameSettings.interfaceMode === mode ? 'bg-slate-950 text-white border-slate-950' : 'bg-slate-100 border-slate-300 text-slate-700'
                    }`}
                  >
                    {mode === 'auto' ? 'AUTO DETECTAR' : mode === 'pc' ? 'FORÇAR PC' : 'FORÇAR MOBILE'}
                  </button>
                ))}
              </div>
            </div>

            {/* SENSIBILIDADES */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-200">
              <label className="block space-y-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1">
                  <Crosshair className="w-3.5 h-3.5" /> SENS. MOUSE (PC)
                </span>
                <input
                  type="range"
                  min={0.4}
                  max={2.5}
                  step={0.05}
                  value={gameSettings.mouseSensitivity}
                  onChange={(e) => onUpdateSettings({ ...gameSettings, mouseSensitivity: Number(e.target.value) })}
                  className="w-full accent-red-600 cursor-pointer"
                />
                <span className="text-[10px] font-mono text-slate-400">{gameSettings.mouseSensitivity.toFixed(2)}x</span>
              </label>

              <label className="block space-y-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1">
                  <Smartphone className="w-3.5 h-3.5" /> SENS. TOQUE (MOBILE)
                </span>
                <input
                  type="range"
                  min={0.5}
                  max={3.0}
                  step={0.1}
                  value={gameSettings.touchSensitivity}
                  onChange={(e) => onUpdateSettings({ ...gameSettings, touchSensitivity: Number(e.target.value) })}
                  className="w-full accent-red-600 cursor-pointer"
                />
                <span className="text-[10px] font-mono text-slate-400">{gameSettings.touchSensitivity.toFixed(1)}x</span>
              </label>
            </div>

            {/* ÁUDIO & DEV */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-200">
              <label className="block space-y-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1">
                  <Volume2 className="w-3.5 h-3.5" /> VOLUME GERAL
                </span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={gameSettings.masterVolume}
                  onChange={(e) => onUpdateSettings({ ...gameSettings, masterVolume: Number(e.target.value) })}
                  className="w-full accent-red-600 cursor-pointer"
                />
                <span className="text-[10px] font-mono text-slate-400">{Math.round(gameSettings.masterVolume * 100)}%</span>
              </label>

              <div className="space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">DEV / TESTES</span>
                <div className="flex gap-2">
                  <button
                    onClick={onToggleGodMode}
                    className={`flex-1 py-1.5 text-[10px] font-black uppercase border cursor-pointer rounded ${
                      godMode ? 'bg-red-600 text-white border-red-600' : 'border-slate-300 text-slate-600'
                    }`}
                  >
                    DEUS {godMode ? 'ON' : 'OFF'}
                  </button>
                  <button
                    onClick={onToggleInfiniteAmmo}
                    className={`flex-1 py-1.5 text-[10px] font-black uppercase border cursor-pointer rounded ${
                      infiniteAmmo ? 'bg-slate-900 text-white border-slate-900' : 'border-slate-300 text-slate-600'
                    }`}
                  >
                    MUNIÇÃO ∞ {infiniteAmmo ? 'ON' : 'OFF'}
                  </button>
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowConfig(false)}
              className="w-full py-3 bg-slate-950 text-white font-black text-xs uppercase tracking-widest cursor-pointer hover:bg-red-600 transition-colors shadow-lg"
            >
              APLICAR E VOLTAR
            </button>
          </div>
        </div>
      )}

      {/* -------- PLAYING — HUD mínimo -------- */}
      {gameState === 'playing' && (
        <>
          {/* MODO ATÉ MORRER BANNER / CRONÔMETRO */}
          {gameMode === 'endless' ? (
            <div className="absolute top-6 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-slate-950/90 text-white px-6 py-2.5 rounded-full border border-red-600/70 shadow-2xl pointer-events-none">
              <div className="flex items-center gap-2 text-red-500 font-black text-xs uppercase tracking-wider">
                <Flame className="w-4 h-4 animate-pulse fill-red-500" /> ATÉ MORRER
              </div>
              <div className="h-4 w-px bg-slate-700" />
              <div className="flex items-center gap-1.5 font-mono text-sm font-bold text-slate-100">
                <Clock className="w-3.5 h-3.5 text-slate-400" /> {formatTime(endlessTime)}
              </div>
              <div className="h-4 w-px bg-slate-700" />
              <div className="flex items-center gap-1.5 text-xs font-black uppercase text-amber-400">
                <Trophy className="w-3.5 h-3.5" /> ABATES: {endlessKills}
              </div>
            </div>
          ) : gameMode === 'sandbox' ? (
            <div className="absolute top-6 left-6 z-40 flex items-center gap-3 bg-slate-950/90 text-white px-4 py-2.5 rounded-lg border border-cyan-500/60 shadow-2xl pointer-events-auto">
              <div className="flex items-center gap-2 text-cyan-400 font-black text-xs uppercase tracking-wider">
                <Eye className="w-4 h-4 text-cyan-400" /> MATE TODOS 2 (EXPLORAÇÃO)
              </div>
              <div className="h-4 w-px bg-slate-700" />
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-400 font-bold uppercase">MAPA:</span>
                <select
                  onChange={(e) => onSelectLevel(Number(e.target.value))}
                  className="bg-slate-900 text-white text-xs font-bold px-2 py-1 rounded border border-slate-700 outline-none cursor-pointer hover:border-cyan-500 transition-colors"
                >
                  <option value={0}>00. CONSTRUÇÃO INDUSTRIAL (GLB)</option>
                  <option value={1}>01. CORREDOR</option>
                  <option value={2}>02. ESCRITÓRIO</option>
                  <option value={3}>03. GALPÃO DE ARMAS</option>
                </select>
              </div>
            </div>
          ) : (
            <div className="absolute top-6 right-6 sm:top-10 sm:right-10 text-right">
              <div className="text-2xl font-black text-slate-900 tabular-nums leading-none">
                {enemiesRemaining}
              </div>
              <div className="w-2 h-2 bg-red-600 mt-1.5 ml-auto" />
            </div>
          )}

          {/* Crosshair */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
            <div className="w-1 h-1 rounded-full bg-slate-900/80" />
          </div>

          {/* Prompts contextuais com círculo de mira para pegar arma */}
          {canCatchWeapon && (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none flex flex-col items-center gap-2.5 z-40">
              <div className="w-11 h-11 rounded-full border-2 border-dashed border-amber-400 animate-[spin_8s_linear_infinite] flex items-center justify-center">
                <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
              </div>
              <div className="bg-slate-950/90 text-white text-[10px] font-black px-3.5 py-1.5 uppercase tracking-wider flex items-center gap-1.5 border border-amber-400/80 rounded shadow-2xl pointer-events-auto">
                <Zap className="w-3.5 h-3.5 text-amber-400 animate-pulse" /> [E] PEGAR ARMA
              </div>
            </div>
          )}
          {canHotswitchEnemy && hotswitchCooldown <= 0 && (
            <div className="absolute top-[55%] left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] font-black px-3 py-1.5 uppercase tracking-wider border border-red-600 shadow-lg">
              [F] HOTSWITCH
            </div>
          )}
          {canPunchEnemy && weaponType === null && (
            <div className="absolute top-[55%] left-1/2 -translate-x-1/2 bg-red-600 text-white text-[10px] font-black px-3 py-1.5 uppercase tracking-wider shadow-lg">
              [CLICK] SOCO
            </div>
          )}

          {/* Arma / munição — canto inferior direito */}
          <div className="absolute bottom-6 right-6 sm:bottom-10 sm:right-10 text-right">
            {weaponType !== null ? (
              <div className="text-xs font-black text-slate-900 uppercase tracking-widest">
                {weaponType === 'shotgun'
                  ? 'ESCOPETA'
                  : weaponType === 'rifle'
                  ? 'UZI'
                  : weaponType === 'bottle'
                  ? 'GARRAFA'
                  : weaponType === 'knife'
                  ? 'FACA'
                  : weaponType === 'ashtray'
                  ? 'CINZEIRO'
                  : 'PISTOLA'}
                <span className="ml-2 font-mono text-slate-500">{ammo}/{maxAmmo}</span>
              </div>
            ) : (
              <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">mãos</div>
            )}
          </div>

          {/* Pause overlay */}
          {(isMobileHUD ? !!isMobilePaused : !isPointerLocked) && (
            <div
              onClick={(e) => {
                if (e.target === e.currentTarget) {
                  if (isMobileHUD && onToggleMobilePause) {
                    onToggleMobilePause(false);
                  } else {
                    onLockPointer();
                  }
                }
              }}
              className="absolute inset-0 z-30 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm cursor-pointer pointer-events-auto"
            >
              <div
                onClick={(e) => e.stopPropagation()}
                className="bg-white px-8 py-7 text-center border border-slate-300 shadow-2xl max-w-sm w-full space-y-4 rounded"
              >
                <div className="border-b border-slate-200 pb-2">
                  <p className="text-sm font-black uppercase tracking-widest text-slate-950 flex items-center justify-center gap-2">
                    PAUSADO
                  </p>
                </div>

                <div className="flex flex-col gap-2.5">
                  <button
                    onClick={() => {
                      if (isMobileHUD && onToggleMobilePause) {
                        onToggleMobilePause(false);
                      } else {
                        onLockPointer();
                      }
                    }}
                    className="w-full py-3 bg-slate-950 hover:bg-slate-800 text-white font-black text-xs uppercase tracking-widest cursor-pointer transition-colors flex items-center justify-center gap-2 shadow"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    CONTINUAR JOGO
                  </button>

                  <button
                    onClick={() => setShowConfig(true)}
                    className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-950 font-black text-xs uppercase tracking-widest border border-slate-300 cursor-pointer transition-colors flex items-center justify-center gap-2"
                  >
                    <Settings className="w-4 h-4 text-red-600" />
                    CONFIGURAÇÕES VÍDEO & SISTEMA
                  </button>

                  <button
                    onClick={() => {
                      if (isMobileHUD && onToggleMobilePause) {
                        onToggleMobilePause(false);
                      }
                      onRestart();
                    }}
                    className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-950 font-black text-xs uppercase tracking-widest border border-slate-300 cursor-pointer transition-colors flex items-center justify-center gap-2"
                  >
                    <RotateCcw className="w-4 h-4 text-amber-600" />
                    REINICIAR FASE
                  </button>

                  {onExitToMenu && (
                    <button
                      onClick={() => {
                        if (isMobileHUD && onToggleMobilePause) {
                          onToggleMobilePause(false);
                        }
                        onExitToMenu();
                      }}
                      className="w-full py-3 bg-red-600 hover:bg-red-700 text-white font-black text-xs uppercase tracking-widest cursor-pointer transition-colors flex items-center justify-center gap-2 shadow-md shadow-red-600/20"
                    >
                      SAIR PARA O MENU PRINCIPAL
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Dev — só se aberto via P */}
          {devMode && (
            <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 bg-slate-950/95 text-white p-4 border border-slate-700 max-w-sm w-full pointer-events-auto text-xs space-y-2">
              <div className="flex justify-between font-black text-red-500 uppercase tracking-widest text-[10px]">
                Dev
                <button onClick={onToggleDev} className="text-slate-400 cursor-pointer">[P]</button>
              </div>
              <button onClick={onToggleGodMode} className="w-full py-1 border border-slate-600 cursor-pointer">
                Deus {godMode ? 'ON' : 'OFF'}
              </button>
              <button onClick={onToggleInfiniteAmmo} className="w-full py-1 border border-slate-600 cursor-pointer">
                Munição ∞ {infiniteAmmo ? 'ON' : 'OFF'}
              </button>
              <div className="flex gap-1">
                {(['pistol', 'shotgun', 'rifle', 'bottle', 'knife', 'ashtray'] as WeaponType[]).map((t) => (
                  <button key={t} onClick={() => onSpawnWeapon(t)} className="flex-1 py-1 bg-slate-800 cursor-pointer uppercase text-[9px]">
                    {t}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-3 gap-1 max-h-24 overflow-y-auto">
                {Array.from({ length: 10 }).map((_, i) => (
                  <button
                    key={i}
                    onClick={() => { onSelectLevel(i); onToggleDev(); }}
                    className="py-1 bg-slate-800 cursor-pointer text-[9px]"
                  >
                    L{i}
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* -------- CLEARED -------- */}
      {gameState === 'cleared' && (
        <div className="absolute inset-0 z-40 flex items-center justify-center pointer-events-none">
          <h1
            key={mantraWord}
            style={{ textShadow: '0 0 40px rgba(0,0,0,0.35)' }}
            className={`text-7xl sm:text-9xl md:text-[12rem] font-black tracking-tighter uppercase leading-none animate-[mantraPop_0.35s_ease-out] ${
              mantraWord === 'SUPER' ? 'text-white' : 'text-red-600'
            }`}
          >
            {mantraWord}
          </h1>
        </div>
      )}

      {/* -------- GAME OVER -------- */}
      {gameState === 'gameover' && (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-slate-950/95 pointer-events-auto text-center p-6">
          <div className="w-16 h-16 bg-red-600 text-white flex items-center justify-center mb-4 rounded-full shadow-lg shadow-red-600/40">
            <ShieldAlert className="w-9 h-9" />
          </div>
          <h2 className="text-4xl sm:text-6xl font-black text-white tracking-tighter uppercase mb-2">
            {gameMode === 'endless' ? 'SOBREVIVÊNCIA ENCERRADA' : 'ELIMINADO'}
          </h2>

          {gameMode === 'endless' && (
            <div className="my-4 p-6 bg-slate-900/90 border border-slate-800 max-w-sm w-full space-y-3 text-left rounded-lg shadow-2xl">
              <div className="flex justify-between items-center text-xs font-bold uppercase text-slate-400">
                <span>Inimigos Eliminados</span>
                <span className="text-xl font-black text-red-500">{endlessKills}</span>
              </div>
              <div className="flex justify-between items-center text-xs font-bold uppercase text-slate-400">
                <span>Tempo Sobrevivido</span>
                <span className="text-sm font-mono font-bold text-white">{formatTime(endlessTime)}</span>
              </div>
              <div className="pt-2 border-t border-slate-800 flex justify-between items-center text-xs font-bold uppercase text-amber-400">
                <span>Melhor Recorde</span>
                <span className="text-base font-black">{bestEndlessKills} ABATES</span>
              </div>
              {endlessKills >= bestEndlessKills && endlessKills > 0 && (
                <div className="mt-3 text-center bg-red-600/20 border border-red-600 text-red-400 font-black text-[11px] uppercase tracking-widest py-1.5 rounded animate-pulse">
                  🔥 NOVO RECORDE ALCANÇADO! 🔥
                </div>
              )}
            </div>
          )}

          <button
            onClick={onRestart}
            className="mt-4 px-10 py-4 bg-white text-slate-950 font-black text-xs uppercase tracking-widest cursor-pointer hover:bg-red-600 hover:text-white flex items-center gap-2 transition-colors shadow-lg"
          >
            <RotateCcw className="w-4 h-4" /> TENTAR NOVAMENTE [R]
          </button>
        </div>
      )}
    </div>
  );
};
