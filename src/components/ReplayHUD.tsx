import React from 'react';
import { FastForward } from 'lucide-react';
import { ReplayCameraMode } from '../game/replaySystem';

interface ReplayHUDProps {
  mantraWord: 'SUPER' | 'HOT';
  cameraMode?: ReplayCameraMode;
  onToggleCamera?: () => void;
  onSkipReplay: () => void;
}

export const ReplayHUD: React.FC<ReplayHUDProps> = ({
  mantraWord,
  onSkipReplay,
}) => {
  return (
    <div className="absolute inset-0 pointer-events-none z-40 flex flex-col justify-between p-6 select-none font-sans overflow-hidden">
      {/* Top Banner — Iconic Level Clear Mantra */}
      <div className="flex flex-col items-center justify-center pt-16">
        {/* Animated SUPER / HOT Word Pulse */}
        <div className="text-6xl sm:text-8xl font-black tracking-tighter uppercase leading-none drop-shadow-[0_10px_20px_rgba(239,68,68,0.5)] animate-pulse">
          {mantraWord === 'SUPER' ? (
            <span className="text-slate-950 bg-white px-6 py-2 border-4 border-slate-950 shadow-2xl">
              SUPER
            </span>
          ) : (
            <span className="text-white bg-red-600 px-6 py-2 border-4 border-white shadow-2xl shadow-red-600/50">
              HOT
            </span>
          )}
        </div>
      </div>

      {/* Bottom Control — Next Level Button */}
      <div className="flex justify-end pointer-events-auto pb-4">
        <button
          onClick={onSkipReplay}
          className="px-6 py-3.5 bg-red-600 hover:bg-red-700 text-white text-xs font-black uppercase tracking-widest rounded-lg shadow-2xl shadow-red-600/40 flex items-center gap-2.5 transition-all active:scale-95 cursor-pointer"
        >
          <FastForward className="w-4 h-4 fill-current" />
          <span>PRÓXIMA FASE [ESPAÇO]</span>
        </button>
      </div>
    </div>
  );
};
