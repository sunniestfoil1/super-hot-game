import React, { useState } from 'react';
import { GameStatus, WeaponType } from '../game/types';
import { RotateCcw, Play, ShieldAlert, Zap, Settings, Volume2, Crosshair } from 'lucide-react';

interface GameHUDProps {
  levelName: string;
  levelSubtitle: string;
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
  mouseSens: number;
  volume: number;
  onMouseSensChange: (v: number) => void;
  onVolumeChange: (v: number) => void;
  onToggleDev: () => void;
  onToggleGodMode: () => void;
  onToggleInfiniteAmmo: () => void;
  onSelectLevel: (idx: number) => void;
  onSpawnWeapon: (type: WeaponType) => void;
  onStartGame: () => void;
  onRestart: () => void;
  onNextLevel: () => void;
  onLockPointer: () => void;
}

export const GameHUD: React.FC<GameHUDProps> = ({
  weaponType,
  ammo,
  enemiesRemaining,
  totalEnemies,
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
  mouseSens,
  volume,
  onMouseSensChange,
  onVolumeChange,
  onToggleDev,
  onToggleGodMode,
  onToggleInfiniteAmmo,
  onSelectLevel,
  onSpawnWeapon,
  onStartGame,
  onRestart,
  onLockPointer,
}) => {
  const [showConfig, setShowConfig] = useState(false);
  const maxAmmo = weaponType === 'shotgun' ? 2 : weaponType === 'rifle' ? 12 : 4;

  return (
    <div className="absolute inset-0 pointer-events-none z-20 font-sans select-none overflow-hidden">
      {/* -------- MENU -------- */}
      {gameState === 'menu' && (
        <div className="absolute inset-0 z-50 bg-[#e8e4de] flex flex-col items-center justify-center p-6 text-slate-950 pointer-events-auto">
          {!showConfig ? (
            <div className="max-w-lg w-full text-center space-y-8">
              <div>
                <h1 className="text-7xl sm:text-8xl font-black tracking-tighter uppercase leading-none">
                  WEB<span className="text-red-600">HOT</span>
                </h1>
                <p className="mt-3 text-xs font-bold text-slate-500 uppercase tracking-[0.35em]">
                  O tempo só se move quando você se move
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <button
                  onClick={onStartGame}
                  className="w-full sm:w-auto px-14 py-4 bg-slate-950 hover:bg-red-600 text-white font-black text-sm uppercase tracking-widest transition-colors flex items-center justify-center gap-3 cursor-pointer"
                >
                  <Play className="w-4 h-4 fill-current" />
                  JOGAR
                </button>
                <button
                  onClick={() => setShowConfig(true)}
                  className="w-full sm:w-auto px-10 py-4 bg-transparent border-2 border-slate-950 hover:bg-slate-950 hover:text-white text-slate-950 font-black text-sm uppercase tracking-widest transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Settings className="w-4 h-4" />
                  CONFIG
                </button>
              </div>
            </div>
          ) : (
            <div className="max-w-md w-full bg-white border border-slate-300 p-8 text-left space-y-6 pointer-events-auto">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <h2 className="text-sm font-black uppercase tracking-widest">Configurações</h2>
                <button
                  onClick={() => setShowConfig(false)}
                  className="text-xs font-bold text-slate-500 hover:text-slate-950 cursor-pointer uppercase"
                >
                  Voltar
                </button>
              </div>

              <label className="block space-y-2">
                <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-600">
                  <Crosshair className="w-3.5 h-3.5" /> Sensibilidade do mouse
                </span>
                <input
                  type="range"
                  min={0.4}
                  max={2.5}
                  step={0.05}
                  value={mouseSens}
                  onChange={(e) => onMouseSensChange(Number(e.target.value))}
                  className="w-full accent-red-600 cursor-pointer"
                />
                <span className="text-[10px] font-mono text-slate-400">{mouseSens.toFixed(2)}x</span>
              </label>

              <label className="block space-y-2">
                <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-600">
                  <Volume2 className="w-3.5 h-3.5" /> Volume
                </span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={volume}
                  onChange={(e) => onVolumeChange(Number(e.target.value))}
                  className="w-full accent-red-600 cursor-pointer"
                />
                <span className="text-[10px] font-mono text-slate-400">{Math.round(volume * 100)}%</span>
              </label>

              <div className="pt-2 border-t border-slate-200 space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Dev</span>
                <div className="flex gap-2">
                  <button
                    onClick={onToggleGodMode}
                    className={`flex-1 py-2 text-[10px] font-black uppercase border cursor-pointer ${
                      godMode ? 'bg-red-600 text-white border-red-600' : 'border-slate-300 text-slate-600'
                    }`}
                  >
                    Deus {godMode ? 'ON' : 'OFF'}
                  </button>
                  <button
                    onClick={onToggleInfiniteAmmo}
                    className={`flex-1 py-2 text-[10px] font-black uppercase border cursor-pointer ${
                      infiniteAmmo ? 'bg-slate-900 text-white border-slate-900' : 'border-slate-300 text-slate-600'
                    }`}
                  >
                    Munição ∞ {infiniteAmmo ? 'ON' : 'OFF'}
                  </button>
                </div>
              </div>

              <button
                onClick={() => { setShowConfig(false); onStartGame(); }}
                className="w-full py-3 bg-slate-950 text-white font-black text-xs uppercase tracking-widest cursor-pointer hover:bg-red-600 transition-colors"
              >
                Salvar e jogar
              </button>
            </div>
          )}
        </div>
      )}

      {/* -------- PLAYING — HUD mínimo -------- */}
      {gameState === 'playing' && (
        <>
          {/* Contador de ameaças — canto superior direito */}
          <div className="absolute top-6 right-6 sm:top-10 sm:right-10 text-right">
            <div className="text-2xl font-black text-slate-900 tabular-nums leading-none">
              {enemiesRemaining}
            </div>
            <div className="w-2 h-2 bg-red-600 mt-1.5 ml-auto" />
          </div>

          {/* Crosshair */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
            <div className="w-1 h-1 rounded-full bg-slate-900/80" />
          </div>

          {/* Prompts contextuais só quando preciso */}
          {canCatchWeapon && (
            <div className="absolute top-[55%] left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] font-black px-3 py-1.5 uppercase tracking-wider flex items-center gap-1.5">
              <Zap className="w-3 h-3" /> [E] Pegar arma
            </div>
          )}
          {canHotswitchEnemy && hotswitchCooldown <= 0 && (
            <div className="absolute top-[55%] left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] font-black px-3 py-1.5 uppercase tracking-wider border border-red-600">
              [F] Hotswitch
            </div>
          )}
          {canPunchEnemy && weaponType === null && (
            <div className="absolute top-[55%] left-1/2 -translate-x-1/2 bg-red-600 text-white text-[10px] font-black px-3 py-1.5 uppercase tracking-wider">
              [Click] Soco
            </div>
          )}

          {/* Arma / munição — canto inferior direito */}
          <div className="absolute bottom-6 right-6 sm:bottom-10 sm:right-10 text-right">
            {weaponType !== null ? (
              <div className="text-xs font-black text-slate-900 uppercase tracking-widest">
                {weaponType === 'shotgun' ? 'ESCOPETA' : weaponType === 'rifle' ? 'UZI' : 'PISTOLA'}
                <span className="ml-2 font-mono text-slate-500">{ammo}/{maxAmmo}</span>
              </div>
            ) : (
              <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">mãos</div>
            )}
          </div>

          {/* Pause overlay */}
          {!isPointerLocked && (
            <div
              onClick={onLockPointer}
              className="absolute inset-0 z-30 flex items-center justify-center bg-slate-950/30 cursor-pointer pointer-events-auto"
            >
              <div className="bg-white px-10 py-8 text-center border border-slate-200">
                <p className="text-xs font-black uppercase tracking-widest text-slate-500 mb-4">Pausado</p>
                <button
                  onClick={onLockPointer}
                  className="px-8 py-3 bg-slate-950 text-white text-xs font-black uppercase tracking-widest cursor-pointer hover:bg-red-600"
                >
                  Continuar
                </button>
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
                {(['pistol', 'shotgun', 'rifle'] as WeaponType[]).map((t) => (
                  <button key={t} onClick={() => onSpawnWeapon(t)} className="flex-1 py-1 bg-slate-800 cursor-pointer uppercase text-[9px]">
                    {t}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-3 gap-1 max-h-24 overflow-y-auto">
                {Array.from({ length: 9 }).map((_, i) => (
                  <button
                    key={i}
                    onClick={() => { onSelectLevel(i); onToggleDev(); }}
                    className="py-1 bg-slate-800 cursor-pointer text-[9px]"
                  >
                    L{i + 1}
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* -------- CLEARED — só mantra, sem botões (avanço automático) -------- */}
      {gameState === 'cleared' && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-white pointer-events-none">
          <h1
            key={mantraWord}
            className={`text-7xl sm:text-9xl md:text-[12rem] font-black tracking-tighter uppercase leading-none animate-[mantraPop_0.35s_ease-out] ${
              mantraWord === 'SUPER' ? 'text-slate-950' : 'text-red-600'
            }`}
          >
            {mantraWord}
          </h1>
        </div>
      )}

      {/* -------- GAME OVER -------- */}
      {gameState === 'gameover' && (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-slate-950/90 pointer-events-auto text-center p-6">
          <div className="w-14 h-14 bg-red-600 text-white flex items-center justify-center mb-5">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h2 className="text-5xl sm:text-7xl font-black text-white tracking-tighter uppercase mb-2">
            Eliminado
          </h2>
          <button
            onClick={onRestart}
            className="mt-8 px-10 py-3 bg-white text-slate-950 font-black text-xs uppercase tracking-widest cursor-pointer hover:bg-red-600 hover:text-white flex items-center gap-2"
          >
            <RotateCcw className="w-4 h-4" /> Tentar de novo [R]
          </button>
        </div>
      )}
    </div>
  );
};
