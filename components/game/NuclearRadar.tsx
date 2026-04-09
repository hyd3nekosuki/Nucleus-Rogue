import React, { useMemo } from 'react';
import { GameState, DecayMode } from '../../types';
import { getNuclideDataSync } from '../../services/nuclideService';
import { DripLineService } from '../../engine/dripLineService';

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

  // Radar range: +/- 12 around current position for a focused view
  const range = 12;
  const size = 100; // SVG internal coordinate system
  const step = size / (range * 2 + 1);

  const minZ = currentZ - range;
  const maxZ = currentZ + range;
  const minN = currentN - range;
  const maxN = currentN + range;

  const getPos = (z: number, n: number) => {
    const relZ = z - currentZ;
    const relN = n - currentN;
    // Standard chart orientation: Z is vertical (up), N is horizontal (right)
    return {
      x: (relN + range) * step + step / 2,
      y: (range - relZ) * step + step / 2
    };
  };

  // Get all discovered nuclides from history with color coding
  const discovered = useMemo(() => {
    return (Object.values(gameState.evolutionHistory) as any[]).map(entry => {
      const z = entry.z;
      const a = entry.a;
      const n = a - z;
      
      const data = getNuclideDataSync(z, a);
      let color = "#ffffff"; // Stable
      
      if (!data.isStable) {
        let mainMode = data.decayModes.length > 0 ? data.decayModes[0] : DecayMode.UNKNOWN;
        
        // Normalize modes (matching EvolutionMap logic)
        if (mainMode === DecayMode.TWO_NEUTRON_EMISSION) mainMode = DecayMode.NEUTRON_EMISSION;
        if (mainMode === DecayMode.DOUBLE_ELECTRON_CAPTURE) mainMode = DecayMode.ELECTRON_CAPTURE;
        if (mainMode === DecayMode.DOUBLE_BETA_MINUS) mainMode = DecayMode.BETA_MINUS;
        if (mainMode === DecayMode.DOUBLE_BETA_PLUS) mainMode = DecayMode.BETA_PLUS;
        if (mainMode === DecayMode.IT) mainMode = DecayMode.GAMMA;
        if (mainMode === DecayMode.EC_B_PLUS) mainMode = DecayMode.BETA_PLUS;
        if (mainMode.startsWith('B-')) mainMode = DecayMode.BETA_MINUS;
        if (mainMode.startsWith('B+')) mainMode = DecayMode.BETA_PLUS;
        if (mainMode === DecayMode.EC_ALPHA || mainMode === DecayMode.EC_PROTON || mainMode === DecayMode.EC_2PROTON || mainMode === DecayMode.EC_SF) mainMode = DecayMode.ELECTRON_CAPTURE;

        switch (mainMode) {
          case DecayMode.ALPHA: color = "#facc15"; break; // yellow-400
          case DecayMode.BETA_MINUS: color = "#00f3ff"; break; // neon-blue
          case DecayMode.BETA_PLUS: color = "#bc13fe"; break; // neon-purple
          case DecayMode.ELECTRON_CAPTURE: color = "#14b8a6"; break; // teal-500
          case DecayMode.SPONTANEOUS_FISSION: color = "#ff0055"; break; // neon-red
          case DecayMode.GAMMA: color = "#818cf8"; break; // indigo-400
          case DecayMode.PROTON_EMISSION:
          case DecayMode.TWO_PROTON_EMISSION: color = "#f43f5e"; break; // rose-500
          case DecayMode.NEUTRON_EMISSION: color = "#7dd3fc"; break; // sky-300
          default: color = "#9ca3af"; // gray-500
        }
      }

      return { z, n, color };
    });
  }, [gameState.evolutionHistory]);

  // Calculate Drip Line cells to show in the radar view
  const dripLineCells = useMemo(() => {
    const cells: { x: number, y: number }[] = [];
    const historyArr = Object.values(gameState.evolutionHistory) as any[];
    
    for (let dz = -range; dz <= range; dz++) {
      for (let dn = -range; dn <= range; dn++) {
        const z = currentZ + dz;
        const n = currentN + dn;
        const a = z + n;
        
        if (DripLineService.isBeyondDripLine(z, a)) {
          // Only show drip line near discovered nuclides
          const isNearDiscovered = historyArr.some(h => {
            const hN = h.a - h.z;
            return Math.abs(h.z - z) <= 1 && Math.abs(hN - n) <= 1;
          });
          
          if (isNearDiscovered) {
            const pos = getPos(z, n);
            cells.push(pos);
          }
        }
      }
    }
    return cells;
  }, [currentZ, currentN, gameState.evolutionHistory, range, step]);

  return (
    <div className="relative w-20 h-20 md:w-28 md:h-28 bg-black border border-gray-800 rounded-lg overflow-hidden shadow-[inset_0_0_15px_rgba(0,0,0,0.8)] group border-neon-blue/20">
      {/* Label */}
      <div className="absolute top-1 left-1.5 text-[7px] text-gray-500 uppercase tracking-[0.2em] font-black z-10 opacity-40 group-hover:opacity-100 transition-opacity">
        Radar N-Z
      </div>
      
      {/* SVG Radar */}
      <svg viewBox={`0 0 ${size} ${size}`} className="w-full h-full">
        {/* Grid lines (Crosshair) */}
        <line x1="0" y1={size/2} x2={size} y2={size/2} stroke="rgba(255, 255, 255, 0.05)" strokeWidth="0.5" />
        <line x1={size/2} y1="0" x2={size/2} y2={size} stroke="rgba(255, 255, 255, 0.05)" strokeWidth="0.5" />
        
        {/* Drip Line Hatching - High visibility synchronized blinking red */}
        <g className="animate-[pulse_1s_ease-in-out_infinite]">
          {dripLineCells.map((pos, i) => (
            <rect 
              key={`drip-${i}`}
              x={pos.x - step/2}
              y={pos.y - step/2}
              width={step}
              height={step}
              fill="rgba(255, 0, 85, 0.7)"
            />
          ))}
        </g>

        {/* Discovered points */}
        {discovered.map((p, i) => {
          if (p.z < minZ || p.z > maxZ || p.n < minN || p.n > maxN) return null;
          const pos = getPos(p.z, p.n);
          const isCurrent = p.z === currentZ && p.n === currentN;
          if (isCurrent) return null; 
          
          return (
            <rect 
              key={`radar-pt-${i}`} 
              x={pos.x - step/2} 
              y={pos.y - step/2} 
              width={step} 
              height={step}
              fill={p.color}
              className="opacity-80"
            />
          );
        })}

        {/* Current position marker - Simplified Blinking Dot */}
        <rect 
          x={size/2 - step/2} 
          y={size/2 - step/2} 
          width={step} 
          height={step}
          fill="#00f3ff" 
          className="animate-[pulse_0.6s_ease-in-out_infinite]"
        />
      </svg>
      
      {/* Coordinates overlay */}
      <div className="absolute bottom-1 right-1.5 flex flex-col items-end pointer-events-none opacity-60">
          <div className="text-[6px] text-neon-red font-mono leading-none tracking-tighter">Z:{currentZ}</div>
          <div className="text-[6px] text-white font-mono leading-none tracking-tighter">N:{currentN}</div>
      </div>
    </div>
  );
});

export default NuclearRadar;
