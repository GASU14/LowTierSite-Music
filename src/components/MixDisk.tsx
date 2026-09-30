import React from 'react';

interface MixDiskProps {
  title?: string;
  mixNumber?: number | string;
  gradient?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  isSpinning?: boolean;
}

const GRADIENTS: Record<string, { bg: string; accent: string; label: string }> = {
  emerald: {
    bg: 'from-emerald-500 via-teal-600 to-emerald-800',
    accent: '#10b981',
    label: '#064e3b',
  },
  violet: {
    bg: 'from-violet-500 via-purple-600 to-indigo-800',
    accent: '#8b5cf6',
    label: '#3b0764',
  },
  amber: {
    bg: 'from-amber-500 via-orange-600 to-yellow-800',
    accent: '#f59e0b',
    label: '#78350f',
  },
  rose: {
    bg: 'from-rose-500 via-pink-600 to-red-800',
    accent: '#f43f5e',
    label: '#881337',
  },
  cyan: {
    bg: 'from-cyan-500 via-blue-600 to-teal-800',
    accent: '#06b6d4',
    label: '#164e63',
  },
  fuchsia: {
    bg: 'from-fuchsia-500 via-purple-600 to-pink-800',
    accent: '#d946ef',
    label: '#701a75',
  },
};

export const MixDisk: React.FC<MixDiskProps> = ({
  title = 'Daily Mix',
  mixNumber = '1',
  gradient = 'emerald',
  className = '',
  size = 'md',
  isSpinning = false,
}) => {
  const theme = GRADIENTS[gradient] || GRADIENTS.emerald;
  const numStr = String(mixNumber).replace(/[^\d]/g, '') || '1';

  const sizeClasses = {
    sm: 'w-24 h-24',
    md: 'w-full aspect-square',
    lg: 'w-48 h-48 md:w-56 md:h-56',
  }[size];

  return (
    <div
      className={`relative rounded-2xl overflow-hidden flex items-center justify-center p-3 bg-gradient-to-br from-[#1c1c22] via-[#121216] to-[#0c0c0e] shadow-2xl border border-white/5 group ${sizeClasses} ${className}`}
    >
      {/* Background ambient glow matching mix theme */}
      <div
        className="absolute inset-0 opacity-25 blur-xl pointer-events-none transition-opacity duration-300 group-hover:opacity-40"
        style={{ background: `radial-gradient(circle, ${theme.accent} 0%, transparent 70%)` }}
      />

      {/* Vinyl Disc Container */}
      <div
        className={`relative w-[92%] h-[92%] rounded-full shadow-[0_10px_30px_rgba(0,0,0,0.9)] flex items-center justify-center transition-transform duration-500 group-hover:scale-105 ${
          isSpinning ? 'animate-[spin_8s_linear_infinite]' : ''
        }`}
        style={{
          background: 'radial-gradient(circle, #1a1a1f 0%, #111115 50%, #08080a 100%)',
          boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.08), 0 8px 24px rgba(0,0,0,0.85)',
        }}
      >
        {/* Concentric Vinyl Grooves */}
        <div
          className="absolute inset-0 rounded-full pointer-events-none opacity-80"
          style={{
            background: `repeating-radial-gradient(
              circle at center,
              transparent 0,
              transparent 2px,
              rgba(255, 255, 255, 0.035) 3px,
              rgba(0, 0, 0, 0.6) 4px,
              transparent 5px
            )`,
          }}
        />

        {/* Vinyl Sheen / Light Reflection (Conic Highlights) */}
        <div
          className="absolute inset-0 rounded-full pointer-events-none opacity-40 mix-blend-screen"
          style={{
            background: `conic-gradient(
              from 45deg,
              transparent 0deg,
              rgba(255, 255, 255, 0.12) 45deg,
              transparent 90deg,
              transparent 180deg,
              rgba(255, 255, 255, 0.12) 225deg,
              transparent 270deg,
              transparent 360deg
            )`,
          }}
        />

        {/* Center Label Badge */}
        <div
          className={`relative w-[44%] h-[44%] rounded-full bg-gradient-to-br ${theme.bg} flex flex-col items-center justify-center p-2 shadow-inner border border-white/20 select-none text-center`}
        >
          {/* Subtle label top banner */}
          <span className="text-[7px] md:text-[8px] font-black tracking-[0.2em] uppercase text-white/90 drop-shadow-sm">
            DAILY
          </span>
          <span className="text-xs md:text-sm lg:text-base font-black tracking-tight text-white drop-shadow">
            MIX {numStr}
          </span>
          <span className="text-[6px] md:text-[7px] font-bold text-white/75 uppercase tracking-wider mt-0.5">
            12 CST
          </span>

          {/* Center Spindle Hole */}
          <div className="absolute w-[18%] h-[18%] rounded-full bg-[#09090b] border-[1.5px] border-zinc-400/80 shadow-inner flex items-center justify-center">
            <div className="w-1 h-1 rounded-full bg-black" />
          </div>
        </div>
      </div>
    </div>
  );
};
