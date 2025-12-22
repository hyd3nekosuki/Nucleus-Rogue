
import React, { useState, useEffect } from 'react';
import { NuclideData } from '../types';

interface InfoPanelProps {
  nuclide: NuclideData;
  hp: number;
  maxHp: number;
  turn: number;
  score: number;
  energyPoints: number;
  combo?: number;
  isTimeStopped?: boolean;
}

const InfoPanel: React.FC<InfoPanelProps> = ({ 
  nuclide, 
  hp, 
  maxHp, 
  turn, 
  score, 
  energyPoints,
  combo = 0, 
  isTimeStopped = false 
}) => {
  const showCombo = combo > 0;
  const [gaugeValue, setGaugeValue] = useState(0);

  // Reset gauge when combo starts or increments
  useEffect(() => {
    if (combo > 0) {
      setGaugeValue(100);
    } else {
      setGaugeValue(0);
    }
  }, [combo]);

  // Handle gauge depletion over time
  useEffect(() => {
    // If combo is active, gauge > 0, and time is NOT stopped, deplete the bar
    if (!showCombo || gaugeValue <= 0 || isTimeStopped) return;
    
    const depletionInterval = setInterval(() => {
      setGaugeValue(prev => {
        // Total window is 8000ms. 100 units / 8000ms = 0.0125 units per ms.
        // At 50ms interval: 0.0125 * 50 = 0.625 units per step.
        const next = prev - 0.625;
        return next > 0 ? next : 0;
      });
    }, 50);

    return () => clearInterval(depletionInterval);
  }, [showCombo, gaugeValue, isTimeStopped]);

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
        // proposal 1: Significant Figures (4 digits)
        return Number(scaled.toPrecision(4)).toString() + " " + unit.s;
      }
    }
    return val.toLocaleString();
  };
  
  return (
    <div className="p-6 border-b border-gray-800">
      
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

      {showCombo && (
        <div className="mb-4 relative overflow-hidden bg-gray-900 rounded border border-neon-blue/30 p-2 text-center animate-pulse">
             <div className="text-neon-blue font-black italic text-lg tracking-tighter drop-shadow-[0_0_10px_rgba(0,243,255,0.8)]">
                 CHAIN COMBO {combo >= 2 ? `x${combo}` : 'START'}
             </div>
             {/* Progress Bar for Combo Timer */}
             <div className="absolute bottom-0 left-0 h-1 bg-neon-blue transition-all duration-100 ease-linear"
                  style={{ width: `${gaugeValue}%` }}
             ></div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 text-sm mb-4">
          <div className="bg-black/40 p-2 rounded border border-gray-800">
              <div className="text-gray-500 text-[10px] uppercase">Half-Life</div>
              <div className="text-white truncate">{nuclide.halfLifeText}</div>
          </div>
          <div className="bg-black/40 p-2 rounded border border-gray-800">
              <div className="text-gray-500 text-[10px] uppercase">Decay Modes</div>
              <div className="text-neon-green text-xs truncate">
                  {(nuclide.z === 0 && nuclide.a === 4) ? "Unknown" : nuclide.decayModes.join(", ")}
              </div>
          </div>
      </div>
      
      <div className="text-xs text-gray-400 italic border-l-2 border-gray-700 pl-2">
          "{nuclide.description}"
      </div>

    </div>
  );
};

export default InfoPanel;
