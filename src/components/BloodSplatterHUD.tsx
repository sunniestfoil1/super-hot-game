/**
 * BloodSplatterHUD — sangue no visor como tinta escorrendo
 * Ciclo: impacto → escorre pra baixo → fade → limpa
 */

import React, { useEffect, useRef, useState } from 'react';

interface InkStreak {
  id: number;
  x: number;          // 0–100 (% viewBox)
  y: number;
  length: number;     // comprimento atual do risco
  maxLength: number;
  width: number;
  opacity: number;
  dripSpeed: number;
  fadeDelay: number;  // ms antes de começar a sumir
  wobble: number;
  color: string;
}

interface BloodSplatterHUDProps {
  active: boolean;
  onComplete?: () => void;
}

let streakId = 0;

function spawnInk(): InkStreak[] {
  const streaks: InkStreak[] = [];
  const colors = ['#7a0508', '#9a0a0e', '#5c0305', '#b01018', '#4a0204'];

  // Impacto espalhado (não só centro) — manchas iniciais
  for (let i = 0; i < 10; i++) {
    streaks.push({
      id: ++streakId,
      x: 12 + Math.random() * 76,
      y: 8 + Math.random() * 42,
      length: 2 + Math.random() * 4,
      maxLength: 18 + Math.random() * 38,
      width: 1.2 + Math.random() * 2.8,
      opacity: 0.75 + Math.random() * 0.25,
      dripSpeed: 12 + Math.random() * 22,
      fadeDelay: 400 + Math.random() * 900,
      wobble: (Math.random() - 0.5) * 0.35,
      color: colors[i % colors.length],
    });
  }

  // Filetes longos tipo tinta no vidro
  for (let i = 0; i < 8; i++) {
    streaks.push({
      id: ++streakId,
      x: 8 + Math.random() * 84,
      y: 5 + Math.random() * 30,
      length: 4 + Math.random() * 8,
      maxLength: 35 + Math.random() * 50,
      width: 0.6 + Math.random() * 1.4,
      opacity: 0.55 + Math.random() * 0.35,
      dripSpeed: 18 + Math.random() * 28,
      fadeDelay: 600 + Math.random() * 1200,
      wobble: (Math.random() - 0.5) * 0.5,
      color: colors[(i + 2) % colors.length],
    });
  }

  // Gotas gordas no meio-baixo (splash)
  for (let i = 0; i < 6; i++) {
    streaks.push({
      id: ++streakId,
      x: 20 + Math.random() * 60,
      y: 20 + Math.random() * 35,
      length: 3 + Math.random() * 5,
      maxLength: 10 + Math.random() * 16,
      width: 2.5 + Math.random() * 4,
      opacity: 0.85 + Math.random() * 0.15,
      dripSpeed: 8 + Math.random() * 12,
      fadeDelay: 300 + Math.random() * 600,
      wobble: (Math.random() - 0.5) * 0.2,
      color: colors[i % colors.length],
    });
  }

  return streaks;
}

export const BloodSplatterHUD: React.FC<BloodSplatterHUDProps> = ({ active, onComplete }) => {
  const [streaks, setStreaks] = useState<InkStreak[]>([]);
  const [masterOpacity, setMasterOpacity] = useState(0);
  const frameRef = useRef(0);
  const streaksRef = useRef<InkStreak[]>([]);
  const startRef = useRef(0);
  const lastRef = useRef(0);
  const runningRef = useRef(false);
  const lastRenderRef = useRef(0);

  useEffect(() => {
    if (!active) {
      // Se desliga no meio (cancel), fade rápido e limpa
      if (runningRef.current) {
        cancelAnimationFrame(frameRef.current);
        runningRef.current = false;
        setMasterOpacity(0);
        setStreaks([]);
        streaksRef.current = [];
      }
      return;
    }

    if (runningRef.current) return;
    runningRef.current = true;

    const born = spawnInk();
    streaksRef.current = born;
    setStreaks(born);
    setMasterOpacity(1);
    startRef.current = performance.now();
    lastRef.current = startRef.current;
    lastRenderRef.current = startRef.current;

    const TOTAL_MS = 3200;
    const FADE_START = 1600;
    const RENDER_INTERVAL = 50; // throttle React re-render to ~20fps

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - lastRef.current) / 1000);
      lastRef.current = now;
      const elapsed = now - startRef.current;

      streaksRef.current = streaksRef.current.map((s) => {
        const growing = s.length < s.maxLength;
        const nextLen = growing ? Math.min(s.maxLength, s.length + s.dripSpeed * dt) : s.length;
        const ageFade =
          elapsed > s.fadeDelay
            ? Math.max(0, s.opacity * (1 - (elapsed - s.fadeDelay) / (TOTAL_MS - s.fadeDelay)))
            : s.opacity;
        return {
          ...s,
          length: nextLen,
          y: s.y + (growing ? s.dripSpeed * dt * 0.15 : s.dripSpeed * dt * 0.08),
          x: s.x + s.wobble * dt * 2,
          opacity: ageFade,
        };
      });

      if (now - lastRenderRef.current >= RENDER_INTERVAL) {
        lastRenderRef.current = now;
        setStreaks([...streaksRef.current]);
      }

      if (elapsed > FADE_START) {
        const nextMaster = Math.max(0, 1 - (elapsed - FADE_START) / (TOTAL_MS - FADE_START));
        if (Math.abs(nextMaster - masterOpacity) > 0.01) {
          setMasterOpacity(nextMaster);
        }
      }

      if (elapsed < TOTAL_MS) {
        frameRef.current = requestAnimationFrame(tick);
      } else {
        runningRef.current = false;
        setStreaks([]);
        setMasterOpacity(0);
        streaksRef.current = [];
        onComplete?.();
      }
    };

    frameRef.current = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frameRef.current);
      runningRef.current = false;
    };
  }, [active, onComplete]);

  if (streaks.length === 0 || masterOpacity <= 0.01) return null;

  return (
    <div
      className="absolute inset-0 pointer-events-none overflow-hidden z-30"
      style={{ opacity: masterOpacity }}
    >
      <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0">
        <defs>
          <filter id="inkSoft" x="-10%" y="-10%" width="120%" height="120%">
            <feGaussianBlur stdDeviation="0.25" />
          </filter>
        </defs>
        {streaks.map((s) => (
          <g key={s.id} opacity={s.opacity}>
            {/* corpo do filete escorrendo */}
            <rect
              x={s.x - s.width * 0.5}
              y={s.y}
              width={s.width}
              height={s.length}
              rx={s.width * 0.45}
              fill={s.color}
              filter="url(#inkSoft)"
            />
            {/* gota na ponta */}
            <ellipse
              cx={s.x}
              cy={s.y + s.length}
              rx={s.width * 0.75}
              ry={s.width * 1.1}
              fill={s.color}
            />
          </g>
        ))}
      </svg>
    </div>
  );
};
