import React from 'react';
import { Camera, FastForward, Play, Flame } from 'lucide-react';
import { ReplayCameraMode } from '../game/replaySystem';

interface ReplayHUDProps {
  mantraWord: 'SUPER' | 'HOT';
  cameraMode: ReplayCameraMode;
  onToggleCamera: () => void;
  onSkipReplay: () => void;
}

export const ReplayHUD: React.FC<ReplayHUDProps> = ({
  mantraWord,
  cameraMode,
  onToggleCamera,
  onSkipReplay,
}) => {
  return (
    <div className="absolute inset-0 pointer-events-none z-40 flex flex-col justify-between p-6 select-none font-sans overflow-hidden">
      {/* Top Banner — Cinematic Replay Header & Mantra */}
      <div className="flex flex-col items-center justify-center pt-8">
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

        {/* Live Replay Watermark */}
        <div className="mt-4 inline-flex items-center gap-2 px-4 py-1.5 bg-slate-950/90 text-white border border-red-600/70 rounded-full text-[11px] font-black uppercase tracking-widest shadow-2xl backdrop-blur-md">
          <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-ping" />
          <span>REPLAY CINEMÁTICO 1.0X (VELOCIDADE REAL)</span>
        </div>
      </div>

      {/* Bottom Control Buttons Overlay */}
      <div className="flex flex-wrap items-center justify-between gap-4 pointer-events-auto pb-4">
        {/* Camera Toggle Button */}
        <button
          onClick={onToggleCamera}
          className="px-5 py-3 bg-slate-950/90 border border-slate-700 hover:border-red-600 text-white text-xs font-black uppercase tracking-widest rounded-lg shadow-2xl flex items-center gap-2.5 transition-all active:scale-95 cursor-pointer backdrop-blur-md"
        >
          <Camera className="w-4 h-4 text-red-500" />
          <span>CÂMERA: {cameraMode === 'first_person' ? '1ª PESSOA (FPS 1X)' : '3ª PESSOA (ORBITAL)'}</span>
        </button>

        {/* Skip Replay / Next Level Button */}
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
