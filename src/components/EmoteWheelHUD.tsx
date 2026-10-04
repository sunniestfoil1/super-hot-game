import React from 'react';
import { EmoteType } from '../game/emoteAnimations';

interface EmoteWheelHUDProps {
  currentEmote: EmoteType;
  wheelOpen: boolean;
  onSelectEmote?: (slot: 1 | 2 | 3 | 4 | 5) => void;
}

export interface EmoteItem {
  slot: 1 | 2 | 3 | 4 | 5;
  id: EmoteType;
  name: string;
  subname: string;
  ammo: string;
  emoji: string;
}

export const EMOTE_LIST: EmoteItem[] = [
  { slot: 1, id: '67',           name: '67 MEME',       subname: 'Palmas pra cima',   ammo: '67/67',  emoji: '🤲' },
  { slot: 2, id: 'amostradinho', name: 'AMOSTRADINHO',  subname: 'Combo de socos',    ammo: '100/100',emoji: '🥊' },
  { slot: 3, id: 'dolorido',     name: 'DOLORIDO',      subname: 'Tremor e alívio',   ammo: '1/1',    emoji: '✊' },
  { slot: 4, id: 'pose_v',       name: 'POSE V',        subname: 'Anime peace sign',  ammo: '2/2',    emoji: '✌️' },
  { slot: 5, id: 'arranca_olho', name: 'ARRANCA OLHO',  subname: 'Pega e esmaga',     ammo: '∞',      emoji: '👁️' },
];

/**
 * Creates an SVG arc path between two angles (in degrees, 0 = top / 12 o'clock)
 */
function describeArc(
  x: number,
  y: number,
  innerRadius: number,
  outerRadius: number,
  startAngle: number,
  endAngle: number
): string {
  const toRad = (deg: number) => ((deg - 90) * Math.PI) / 180;
  const startRad = toRad(startAngle);
  const endRad = toRad(endAngle);

  const x1 = x + outerRadius * Math.cos(startRad);
  const y1 = y + outerRadius * Math.sin(startRad);
  const x2 = x + outerRadius * Math.cos(endRad);
  const y2 = y + outerRadius * Math.sin(endRad);

  const x3 = x + innerRadius * Math.cos(endRad);
  const y3 = y + innerRadius * Math.sin(endRad);
  const x4 = x + innerRadius * Math.cos(startRad);
  const y4 = y + innerRadius * Math.sin(startRad);

  const largeArcFlag = endAngle - startAngle <= 180 ? 0 : 1;

  return [
    `M ${x1} ${y1}`,
    `A ${outerRadius} ${outerRadius} 0 ${largeArcFlag} 1 ${x2} ${y2}`,
    `L ${x3} ${y3}`,
    `A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${x4} ${y4}`,
    'Z',
  ].join(' ');
}

export const EmoteWheelHUD: React.FC<EmoteWheelHUDProps> = ({ currentEmote, onSelectEmote }) => {
  const activeItem = EMOTE_LIST.find((e) => e.id === currentEmote) || null;

  // Circular wheel sectors configuration
  const center = 140;
  const innerR = 76;
  const outerR = 132;
  const numSlices = 5;
  const sliceDeg = 360 / numSlices; // 72 deg each
  const gap = 3;

  return (
    <aside
      aria-label="Roleta de Emotes GTA V"
      className="absolute bottom-6 right-6 z-40 pointer-events-auto select-none flex flex-col items-center"
    >
      <div className="relative w-[280px] h-[280px] filter drop-shadow-[0_12px_24px_rgba(0,0,0,0.7)]">
        <svg viewBox="0 0 280 280" className="w-full h-full">
          <defs>
            {/* Dark tactical inner gradient */}
            <radialGradient id="gtaWheelCenter" cx="50%" cy="50%" r="50%">
              <stop offset="65%" stopColor="#090a0f" stopOpacity="0.92" />
              <stop offset="100%" stopColor="#1e222d" stopOpacity="0.95" />
            </radialGradient>
            {/* Subtle glow filter */}
            <filter id="glowActive" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#38bdf8" floodOpacity="0.8" />
            </filter>
          </defs>

          {/* Outer Ring Accent Line */}
          <circle cx={center} cy={center} r={outerR + 2} fill="none" stroke="#334155" strokeWidth="1" opacity="0.6" />

          {/* 4 GTA V Style Wheel Slices */}
          {EMOTE_LIST.map((item, idx) => {
            // Angles centered at: 0° (Top), 90° (Right), 180° (Bottom), 270° (Left)
            const midAngle = idx * sliceDeg;
            const startAngle = midAngle - sliceDeg / 2 + gap / 2;
            const endAngle = midAngle + sliceDeg / 2 - gap / 2;
            const isSelected = currentEmote === item.id;

            const pathData = describeArc(center, center, innerR, outerR, startAngle, endAngle);

            // Icon position (mid-radius along slice angle)
            const iconR = (innerR + outerR) / 2;
            const iconRad = ((midAngle - 90) * Math.PI) / 180;
            const iconX = center + iconR * Math.cos(iconRad);
            const iconY = center + iconR * Math.sin(iconRad);

            return (
              <g key={item.slot} className="transition-all duration-200">
                <path
                  d={pathData}
                  fill={isSelected ? '#d1d5db' : '#272b33'}
                  stroke={isSelected ? '#38bdf8' : '#111317'}
                  strokeWidth={isSelected ? '2.5' : '1.5'}
                  className="transition-colors duration-200 cursor-pointer"
                  onClick={() => onSelectEmote?.(item.slot)}
                />

                {/* Blue GTA-Style Top Accent Bar if Selected */}
                {isSelected && (
                  <path
                    d={describeArc(center, center, outerR - 3, outerR, startAngle, endAngle)}
                    fill="#0284c7"
                  />
                )}

                {/* Slot Number Badge */}
                <circle
                  cx={iconX - 22}
                  cy={iconY - 14}
                  r="7"
                  fill={isSelected ? '#0f172a' : '#1e293b'}
                  stroke={isSelected ? '#38bdf8' : '#475569'}
                  strokeWidth="1"
                />
                <text
                  x={iconX - 22}
                  y={iconY - 11}
                  textAnchor="middle"
                  fontSize="8"
                  fontWeight="900"
                  fontFamily="monospace"
                  fill={isSelected ? '#38bdf8' : '#94a3b8'}
                >
                  {item.slot}
                </text>

                {/* Emoji Icon */}
                <text
                  x={iconX}
                  y={iconY + 6}
                  textAnchor="middle"
                  fontSize="22"
                  className="select-none"
                  style={{ filter: isSelected ? 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))' : 'none' }}
                >
                  {item.emoji}
                </text>

                {/* Ammo / Counter text like GTA */}
                <text
                  x={iconX}
                  y={iconY + 22}
                  textAnchor="middle"
                  fontSize="8"
                  fontWeight="bold"
                  fontFamily="monospace"
                  fill={isSelected ? '#0f172a' : '#94a3b8'}
                  letterSpacing="0.5"
                >
                  {item.ammo}
                </text>
              </g>
            );
          })}

          {/* Center Circular Hub */}
          <circle cx={center} cy={center} r={innerR - 2} fill="url(#gtaWheelCenter)" stroke="#334155" strokeWidth="1.5" />

          {/* Center Info Display (GTA V Title & Pagination Style) */}
          <g>
            <text
              x={center}
              y={center - 18}
              textAnchor="middle"
              fontSize="9"
              fontWeight="900"
              fontFamily="monospace"
              fill={activeItem ? '#38bdf8' : '#64748b'}
              letterSpacing="1.5"
            >
              {activeItem ? activeItem.name : 'ROLETA EMOTES'}
            </text>

            {/* Pagination < 2 / 2 > Style */}
            <text
              x={center}
              y={center + 2}
              textAnchor="middle"
              fontSize="12"
              fontWeight="800"
              fontFamily="monospace"
              fill="#f8fafc"
              letterSpacing="1"
            >
              {activeItem ? `‹ ${activeItem.slot} / 5 ›` : '‹ [1 - 5] ›'}
            </text>

            <text
              x={center}
              y={center + 18}
              textAnchor="middle"
              fontSize="8"
              fontWeight="bold"
              fontFamily="sans-serif"
              fill="#94a3b8"
            >
              {activeItem ? activeItem.subname : 'PRESSIONE 1, 2, 3, 4, 5'}
            </text>
          </g>
        </svg>
      </div>
    </aside>
  );
};
