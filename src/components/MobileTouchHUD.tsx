import React, { useRef, useEffect, useState } from 'react';
import { WeaponType } from '../game/types';
import { Crosshair, Zap, RotateCcw, Sliders, Pause } from 'lucide-react';

interface MobileTouchHUDProps {
  weaponType: WeaponType | null;
  ammo: number;
  canCatchWeapon: boolean;
  canHotswitchEnemy: boolean;
  hotswitchCooldown: number;
  touchSensitivity: number;
  onTouchSensitivityChange: (val: number) => void;
  onMoveKeysChange: (keys: { w: boolean; s: boolean; a: boolean; d: boolean }) => void;
  onLookDelta: (dx: number, dy: number) => void;
  onFire: () => void;
  onThrow: () => void;
  onCatchWeapon: () => void;
  onHotswitch: () => void;
  onPause: () => void;
}

export const MobileTouchHUD: React.FC<MobileTouchHUDProps> = ({
  weaponType,
  canCatchWeapon,
  canHotswitchEnemy,
  hotswitchCooldown,
  touchSensitivity,
  onTouchSensitivityChange,
  onMoveKeysChange,
  onLookDelta,
  onFire,
  onThrow,
  onCatchWeapon,
  onHotswitch,
  onPause,
}) => {
  const [isPortrait, setIsPortrait] = useState(false);
  const [showSensModal, setShowSensModal] = useState(false);

  // Joystick touch tracking
  const joystickTouchId = useRef<number | null>(null);
  const joystickCenter = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const [joystickPos, setJoystickPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Look zone touch tracking
  const lookTouchId = useRef<number | null>(null);
  const lastLookPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Orientation check
  useEffect(() => {
    const checkOrientation = () => {
      setIsPortrait(window.innerHeight > window.innerWidth);
    };
    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);
    return () => {
      window.removeEventListener('resize', checkOrientation);
      window.removeEventListener('orientationchange', checkOrientation);
    };
  }, []);

  // Handle Joystick Touch Events
  const handleJoystickStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (joystickTouchId.current !== null) return;
    const touch = e.changedTouches[0];
    joystickTouchId.current = touch.identifier;
    const rect = e.currentTarget.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    joystickCenter.current = { x: cx, y: cy };
    updateJoystick(touch.clientX, touch.clientY);
  };

  const handleJoystickMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (joystickTouchId.current === null) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier === joystickTouchId.current) {
        updateJoystick(touch.clientX, touch.clientY);
        break;
      }
    }
  };

  const handleJoystickEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    if (joystickTouchId.current === null) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === joystickTouchId.current) {
        joystickTouchId.current = null;
        setJoystickPos({ x: 0, y: 0 });
        onMoveKeysChange({ w: false, s: false, a: false, d: false });
        break;
      }
    }
  };

  const updateJoystick = (clientX: number, clientY: number) => {
    const dx = clientX - joystickCenter.current.x;
    const dy = clientY - joystickCenter.current.y;
    const maxRadius = 50;
    const dist = Math.hypot(dx, dy);
    const angle = Math.atan2(dy, dx);
    const clampedDist = Math.min(dist, maxRadius);
    const nx = Math.cos(angle) * clampedDist;
    const ny = Math.sin(angle) * clampedDist;

    setJoystickPos({ x: nx, y: ny });

    const normX = nx / maxRadius;
    const normY = ny / maxRadius;
    const threshold = 0.25;

    onMoveKeysChange({
      w: normY < -threshold,
      s: normY > threshold,
      a: normX < -threshold,
      d: normX > threshold,
    });
  };

  // Handle Look Drag Zone
  const handleLookStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (lookTouchId.current !== null) return;
    const touch = e.changedTouches[0];
    lookTouchId.current = touch.identifier;
    lastLookPos.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleLookMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (lookTouchId.current === null) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier === lookTouchId.current) {
        const dx = (touch.clientX - lastLookPos.current.x) * touchSensitivity;
        const dy = (touch.clientY - lastLookPos.current.y) * touchSensitivity;
        lastLookPos.current = { x: touch.clientX, y: touch.clientY };
        onLookDelta(dx, dy);
        break;
      }
    }
  };

  const handleLookEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    if (lookTouchId.current === null) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === lookTouchId.current) {
        lookTouchId.current = null;
        break;
      }
    }
  };

  // Determine Portuguese throw button label
  const getThrowLabel = () => {
    if (weaponType === 'pistol') return 'LANÇAR PISTOLA';
    if (weaponType === 'shotgun') return 'LANÇAR ESCOPETA';
    if (weaponType === 'rifle') return 'LANÇAR UZI';
    if (weaponType === 'bottle') return 'LANÇAR GARRAFA';
    if (weaponType === 'knife') return 'LANÇAR FACA';
    if (weaponType === 'ashtray') return 'LANÇAR CINZEIRO';
    return 'SOCO';
  };

  return (
    <>
      {/* Landscape Orientation Warning Overlay */}
      {isPortrait && (
        <div className="fixed inset-0 z-50 bg-slate-950 text-white flex flex-col items-center justify-center p-8 text-center pointer-events-auto">
          <div className="w-16 h-16 bg-red-600 rounded-full flex items-center justify-center mb-6 animate-pulse">
            <RotateCcw className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-2xl font-black uppercase tracking-tight mb-2">
            GIRE O DISPOSITIVO
          </h2>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-widest max-w-xs">
            ESTE JOGO FOI PROJETADO PARA SER JOGADO EM MODO PAISAGEM (TELA DEITADA).
          </p>
        </div>
      )}

      {/* Main Touch Controls Overlay */}
      <div className="absolute inset-0 pointer-events-none select-none z-30 overflow-hidden font-sans">
        {/* Top-Left Mobile Pause Button */}
        <div className="absolute top-4 left-4 pointer-events-auto flex items-center gap-2">
          <button
            onClick={onPause}
            className="px-3.5 py-2 bg-slate-950/85 border border-red-600/80 text-white text-[11px] font-black uppercase tracking-wider rounded-md flex items-center gap-1.5 shadow-xl active:scale-95 touch-none"
          >
            <Pause className="w-4 h-4 text-red-500 fill-red-500" />
            PAUSA
          </button>
        </div>

        {/* Top-Right Touch Sensitivity Button */}
        <div className="absolute top-4 right-4 pointer-events-auto flex items-center gap-2">
          <button
            onClick={() => setShowSensModal((prev) => !prev)}
            className="px-3 py-2 bg-slate-950/80 border border-slate-700 text-white text-[11px] font-black uppercase tracking-wider rounded-md flex items-center gap-1.5 shadow-lg active:scale-95 touch-none"
          >
            <Sliders className="w-3.5 h-3.5 text-red-500" />
            SENSIBILIDADE
          </button>
        </div>

        {/* Sensitivity Modal */}
        {showSensModal && (
          <div className="absolute top-16 right-4 z-40 bg-slate-950 border border-slate-700 p-4 rounded-lg text-white pointer-events-auto max-w-xs w-full shadow-2xl">
            <div className="flex justify-between items-center text-xs font-black uppercase tracking-wider mb-3">
              <span>SENSIBILIDADE DO TOQUE</span>
              <button onClick={() => setShowSensModal(false)} className="text-slate-400">X</button>
            </div>
            <input
              type="range"
              min={0.5}
              max={3.0}
              step={0.1}
              value={touchSensitivity}
              onChange={(e) => onTouchSensitivityChange(Number(e.target.value))}
              className="w-full accent-red-600 cursor-pointer"
            />
            <div className="text-right text-[10px] font-mono text-slate-400 mt-1">
              {touchSensitivity.toFixed(1)}x
            </div>
          </div>
        )}

        {/* Bottom-Left Joystick Area */}
        <div
          onTouchStart={handleJoystickStart}
          onTouchMove={handleJoystickMove}
          onTouchEnd={handleJoystickEnd}
          onTouchCancel={handleJoystickEnd}
          className="absolute bottom-6 left-6 w-36 h-36 rounded-full border-2 border-slate-400/40 bg-slate-950/20 backdrop-blur-sm pointer-events-auto flex items-center justify-center touch-none"
        >
          {/* Inner Joystick Stick */}
          <div
            className="w-14 h-14 rounded-full bg-red-600/80 border-2 border-white/80 shadow-lg pointer-events-none transition-transform duration-75"
            style={{
              transform: `translate(${joystickPos.x}px, ${joystickPos.y}px)`,
            }}
          />
        </div>

        {/* Right Half Camera Look Touch Zone */}
        <div
          onTouchStart={handleLookStart}
          onTouchMove={handleLookMove}
          onTouchEnd={handleLookEnd}
          onTouchCancel={handleLookEnd}
          className="absolute top-16 right-0 bottom-32 left-1/2 pointer-events-auto touch-none"
        />

        {/* Bottom-Right Action Buttons */}
        <div className="absolute bottom-6 right-6 pointer-events-auto flex flex-col items-end gap-3 touch-none">
          {/* Hotswitch Button */}
          {canHotswitchEnemy && hotswitchCooldown <= 0 && (
            <button
              onClick={onHotswitch}
              className="px-6 py-3 bg-red-600 border border-white text-white text-xs font-black uppercase tracking-widest rounded shadow-xl active:scale-95"
            >
              HOTSWITCH [F]
            </button>
          )}

          {/* Catch Weapon Button */}
          {canCatchWeapon && (
            <button
              onClick={onCatchWeapon}
              className="px-6 py-3 bg-slate-900 border border-amber-400 text-amber-400 text-xs font-black uppercase tracking-widest rounded shadow-xl active:scale-95 flex items-center gap-2"
            >
              <Zap className="w-4 h-4" /> PEGAR [E]
            </button>
          )}

          <div className="flex items-center gap-3">
            {/* Throw Button */}
            {weaponType !== null && (
              <button
                onClick={onThrow}
                className="px-5 py-4 bg-slate-900/90 border border-slate-700 text-white text-xs font-black uppercase tracking-wider rounded shadow-xl active:scale-95"
              >
                {getThrowLabel()}
              </button>
            )}

            {/* Main Fire / Attack Button */}
            <button
              onClick={onFire}
              className="w-20 h-20 rounded-full bg-red-600 border-2 border-white text-white font-black text-xs uppercase tracking-wider flex flex-col items-center justify-center shadow-2xl active:scale-95"
            >
              <Crosshair className="w-6 h-6 mb-0.5" />
              <span>{weaponType !== null ? 'ATIRAR' : 'SOCO'}</span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
};
