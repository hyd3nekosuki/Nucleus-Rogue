import React, { useMemo } from 'react';
import { GameState } from '../../types/engine/state';

interface NuclearRadarProps {
  gameState: GameState;
}

/**
 * Real-time Nuclear Radar Component
 * Visualizes the player's position in the N-Z Chart of Nuclides space.
 * Only shows discovered nuclides (Fog of War).
 */
const NuclearRadar: React.FC<NuclearRadarProps> = React.memo(({ gameState }) => {
  const currentZ = gameState.currentNuclide.z;
  const currentA = gameState.currentNuclide.a;
  const currentN = currentA - currentZ;

  // Get all discovered nuclides from history
  const discovered = useMemo(() => {
    return (Object.values(gameState.evolutionHistory) as any[]).map(entry => ({
      z: entry.z,
      n: entry.a - entry.z
    }));
  }, [gameState.evolutionHistory]);

  // Radar range: +/- 12 around current position for a focused view
  const range = 12;
  const minZ = currentZ - range;
  const maxZ = currentZ + range;
  const minN = currentN - range;
  const maxN = currentN + range;

  const size = 100; // SVG internal coordinate system
  const step = size / (range * 2 + 1);

  const getPos = (z: number, n: number) => {
    const relZ = z - currentZ;
    const relN = n - currentN;
    // Standard chart orientation: Z is vertical (up), N is horizontal (right)
    return {
      x: (relN + range) * step + step / 2,
      y: (range - relZ) * step + step / 2
    };
  };

  return (
    <div className="relative w-20 h-20 md:w-28 md:h-28 bg-black/60 border border-gray-800 rounded-lg overflow-hidden shadow-[inset_0_0_15px_rgba(0,0,0,0.8)] group border-neon-blue/20">
      {/* Label */}
      <div className="absolute top-1 left-1.5 text-[7px] text-gray-500 uppercase tracking-[0.2em] font-black z-10 opacity-40 group-hover:opacity-100 transition-opacity">
        Radar N-Z
      </div>
      
      {/* SVG Radar */}
      <svg viewBox={`0 0 ${size} ${size}`} className="w-full h-full p-1">
        {/* Grid lines (Crosshair) */}
        <line x1="0" y1={size/2} x2={size} y2={size/2} stroke="rgba(0, 243, 255, 0.1)" strokeWidth="0.5" />
        <line x1={size/2} y1="0" x2={size/2} y2={size} stroke="rgba(0, 243, 255, 0.1)" strokeWidth="0.5" />
        
        {/* Scanning sweep effect */}
        <div className="absolute inset-0 pointer-events-none">
            <div className="w-full h-full animate-[spin_4s_linear_infinite] origin-center opacity-10" style={{ background: 'conic-gradient(from 0deg, transparent 0%, rgba(0, 243, 255, 0.5) 100%)' }}></div>
        </div>

        {/* Discovered points */}
        {discovered.map((p, i) => {
          if (p.z < minZ || p.z > maxZ || p.n < minN || p.n > maxN) return null;
          const pos = getPos(p.z, p.n);
          const isCurrent = p.z === currentZ && p.n === currentN;
          if (isCurrent) return null; 
          
          return (
            <circle 
              key={`radar-pt-${i}`} 
              cx={pos.x} cy={pos.y} r="1.2" 
              fill="rgba(0, 243, 255, 0.5)" 
              className="animate-pulse"
              style={{ animationDuration: `${2 + Math.random() * 2}s` }}
            />
          );
        })}

        {/* Current position marker */}
        <g className="animate-pulse">
            <circle 
              cx={size/2} cy={size/2} r="3" 
              fill="rgba(0, 243, 255, 0.2)" 
              className="animate-ping" 
              style={{ animationDuration: '3s' }}
            />
            <circle 
              cx={size/2} cy={size/2} r="2" 
              fill="#00f3ff" 
              className="drop-shadow-[0_0_5px_#00f3ff]"
            />
        </g>
      </svg>
      
      {/* Coordinates overlay */}
      <div className="absolute bottom-1 right-1.5 flex flex-col items-end pointer-events-none opacity-60">
          <div className="text-[6px] text-neon-red font-mono leading-none tracking-tighter">Z:{currentZ}</div>
          <div className="text-[6px] text-white font-mono leading-none tracking-tighter">N:{currentN}</div>
      </div>

      {/* Scanline effect */}
      <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,0.06))] bg-[length:100%_2px,3px_100%]"></div>
    </div>
  );
});

export default NuclearRadar;
