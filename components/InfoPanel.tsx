
import React from 'react';
import { NuclideData, DecayMode } from '../types';
import { formatDecayModes } from '../services/nuclideService';

interface InfoPanelProps {
  nuclide: NuclideData;
  hp: number;
  maxHp: number;
  turn: number;
  score: number;
  energyPoints: number;
  onDecay?: (mode: DecayMode) => void;
  disabled?: boolean;
}

const InfoPanel: React.FC<InfoPanelProps> = ({ 
  nuclide, 
  hp, 
  maxHp, 
  turn, 
  score, 
  energyPoints,
  onDecay,
  disabled = false
}) => {

  // Significant Figures Score Formatter (4 digits)
  const formatScore = (val: number): string => {
    if (val < 1000000) return val.toLocaleString();
    
    const units = [
      { v: 1e21, s: "Z" }, // Zetta
      { v: 1e18, s: "E" }, // Exa
      { v: 1e15, s: "P" }, // Peta
      { v: 1e12, s: "T" }, // Tera
      { v: 1e9,  s: "G" }, // Giga
      { v: 1e6,  s: "M" }, // Mega
    ];

    for (const unit of units) {
      if (val >= unit.v) {
        const scaled = val / unit.v;
        return Number(scaled.toPrecision(4)).toString() + " " + unit.s;
      }
    }
    return val.toLocaleString();
  };

  const handleDecayClick = () => {
    if (nuclide.isStable || !onDecay || disabled) return;
    const primaryMode = nuclide.decayModes.find(m => m !== DecayMode.STABLE && m !== DecayMode.UNKNOWN) || (nuclide.decayModes.includes(DecayMode.UNKNOWN) ? DecayMode.UNKNOWN : null);
    if (primaryMode) {
      onDecay(primaryMode);
    }
  };
  
  return (
    <div className="px-6 pb-4 pt-0.5 border-b border-gray-800">
      
      <div className="flex justify-between items-end mb-4 gap-2">
          {/* Score - Left aligned */}
          <div className="flex-[2] min-w-0">
            <div className="text-gray-500 text-[10px] md:text-xs uppercase tracking-widest truncate">Score</div>
            <div className="text-base md:text-lg lg:text-xl text-neon-purple font-mono font-bold leading-tight break-all">
                {formatScore(score)}
            </div>
          </div>

          {/* E-Points - Energy Display */}
          <div className="flex-1 text-center px-1">
            <div className="text-gray-500 text-[10px] uppercase tracking-widest truncate">E</div>
            <div className={`text-lg md:text-xl text-yellow-400 font-mono font-bold leading-none drop-shadow-[0_0_8px_rgba(250,204,21,0.4)] ${energyPoints > 0 ? 'animate-pulse' : 'opacity-40'}`}>
              {energyPoints}<span className="text-[8px] ml-0.5">MeV</span>
            </div>
          </div>
          
          {/* Nuclear Info - Right aligned group */}
          <div className="flex gap-3 items-end shrink-0">
              <div className="text-right">
                <div className="text-gray-500 text-[10px] uppercase tracking-tighter">Z</div>
                <div className="text-lg md:text-xl text-neon-red font-mono font-bold leading-none">
                  {nuclide.z}
                </div>
              </div>

              <div className="text-right">
                 <div className="text-[10px] md:text-xs text-gray-500 uppercase tracking-tighter">A</div>
                 <div className="text-lg md:text-xl text-white font-mono leading-none font-bold">
                    {nuclide.a}
                 </div>
              </div>
          </div>
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm mb-4">
          <div className="bg-black/40 p-2 rounded border border-gray-800">
              <div className="text-gray-500 text-[10px] uppercase">Half-Life</div>
              <div className="text-white truncate">{nuclide.halfLifeText}</div>
          </div>
          <button 
            onClick={handleDecayClick}
            disabled={nuclide.isStable || disabled}
            className={`bg-black/40 p-2 rounded border text-left flex flex-col transition-all duration-200 
                ${nuclide.isStable || disabled 
                    ? 'border-gray-800 cursor-default opacity-80' 
                    : 'border-neon-green/40 hover:bg-neon-green/10 active:scale-95 cursor-pointer shadow-[0_0_10px_rgba(0,255,157,0.15)]'}`}
          >
              <div className="text-gray-500 text-[10px] uppercase flex justify-between">
                <span>Decay Modes</span>
                {!nuclide.isStable && !disabled && <span className="text-neon-green animate-pulse">●</span>}
              </div>
              <div className={`text-xs truncate font-bold ${nuclide.isStable ? 'text-neon-green/50' : 'text-neon-green'}`}>
                  {formatDecayModes(nuclide)}
              </div>
          </button>
      </div>
      
      <div className="text-xs text-gray-400 italic border-l-2 border-gray-700 pl-2">
          "{nuclide.description}"
      </div>

    </div>
  );
};

export default InfoPanel;
