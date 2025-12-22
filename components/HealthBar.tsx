
import React from 'react';
import { NuclideData, DecayMode } from '../types';
import { MAGIC_NUMBERS } from '../constants';

interface HealthBarProps {
    hp: number;
    maxHp: number;
    nuclide: NuclideData;
    onToggleTimeStop?: () => void;
    isTimeStopped?: boolean;
    level: number; // Mastery Level
}

const HealthBar: React.FC<HealthBarProps> = ({ hp, maxHp, nuclide, onToggleTimeStop, isTimeStopped, level }) => {
    const hpPercent = (hp / maxHp) * 100;
    const protonNumber = nuclide.z;
    const neutronNumber = nuclide.a - nuclide.z;
    
    // Magic Shell logic depends on Level 1
    const isMagicZ = level >= 1 && MAGIC_NUMBERS.includes(protonNumber);
    const isMagicN = level >= 1 && MAGIC_NUMBERS.includes(neutronNumber);
    
    // Time stop depends on Level 3
    const canUseTimeStop = level >= 3 && isMagicN;
    const isDoubleMagic = isMagicZ && isMagicN;
    
    let hpColor = "bg-neon-green";
    if (hpPercent < 50) hpColor = "bg-yellow-500";
    if (hpPercent < 20) hpColor = "bg-neon-red";

    const getDecayDisplay = () => {
        if (nuclide.z === 0 && nuclide.a === 4) return `[${nuclide.halfLifeText}, Unknown]`;
        if (nuclide.isStable) return `[${nuclide.halfLifeText}]`;
        
        const modes = nuclide.decayModes
          .filter(m => m !== DecayMode.STABLE && m !== DecayMode.UNKNOWN)
          .map(m => {
              switch(m) {
                  case DecayMode.ALPHA: return "α";
                  case DecayMode.BETA_MINUS: return "β-";
                  case DecayMode.BETA_PLUS: return "β+";
                  case DecayMode.ELECTRON_CAPTURE: return "EC";
                  case DecayMode.SPONTANEOUS_FISSION: return "SF";
                  case DecayMode.PROTON_EMISSION: return "p";
                  case DecayMode.NEUTRON_EMISSION: return "n";
                  default: return "";
              }
          })
          .join(", ");
        
        return modes ? `[${nuclide.halfLifeText}, ${modes}]` : `[${nuclide.halfLifeText}]`;
    };

    const getMagicLabel = () => {
        if (isTimeStopped) return '⏸ Frozen Time';
        if (isDoubleMagic) return '✨ DOUBLE MAGIC SHELL ACTIVE';
        if (isMagicZ && !isMagicN) return '✨ MAGIC PROTON SHELL ACTIVE';
        if (isMagicN) return '✨ MAGIC NEUTRON SHELL ACTIVE';
        return '';
    };

    return (
        <div 
            onClick={canUseTimeStop ? onToggleTimeStop : undefined}
            className={`w-full max-w-[95vw] md:w-[450px] mb-3 relative z-30 mt-0 md:mt-0 p-1 rounded-lg transition-all 
                ${(isMagicZ || isMagicN) ? (isTimeStopped ? 'bg-neon-blue/20 ring-2 ring-neon-blue shadow-[0_0_20px_#00f3ff] cursor-pointer' : 
                   canUseTimeStop ? 'bg-gray-800/30 hover:bg-neon-blue/10 ring-1 ring-neon-blue/40 shadow-[0_0_10px_#00f3ff44] cursor-pointer animate-pulse' : 
                   'bg-gray-800/20 ring-1 ring-gray-700/40 cursor-default') : 'bg-transparent'}`}
        >
            <div className="flex justify-between items-end mb-1 px-1">
                <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                        <span className="text-neon-blue font-bold text-sm md:text-base">{nuclide.name}</span>
                        <span className="text-xs text-gray-500 font-mono">{getDecayDisplay()}</span>
                    </div>
                    {(isMagicZ || isMagicN) && (
                        <span className={`text-[10px] font-black uppercase tracking-tighter -mt-1 drop-shadow-[0_0_5px_#00f3ff] ${isDoubleMagic ? 'text-yellow-400' : 'text-neon-blue'}`}>
                            {getMagicLabel()}
                        </span>
                    )}
                </div>
                <div className={`font-mono font-bold text-sm text-right ${hpPercent < 30 ? "text-neon-red animate-pulse" : "text-neon-green"}`}>
                    {Math.round(hp)}% {isTimeStopped ? 'FROZEN' : 'STABILITY'}
                </div>
            </div>
            <div className="h-4 md:h-5 bg-gray-900/80 rounded border border-gray-700 overflow-hidden relative shadow-lg">
                <div className="absolute inset-0 opacity-20 bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.1)_25%,rgba(255,255,255,0.1)_50%,transparent_50%,transparent_75%,rgba(255,255,255,0.1)_75%,rgba(255,255,255,0.1)_100%)] bg-[length:10px_10px]"></div>
                <div 
                    className={`h-full transition-all duration-300 ease-out ${isTimeStopped ? 'bg-white shadow-[0_0_15px_white]' : hpColor} shadow-[0_0_20px_currentColor] relative`} 
                    style={{ width: `${hpPercent}%` }}
                >
                    <div className="absolute inset-0 bg-gradient-to-b from-white/30 to-transparent"></div>
                </div>
            </div>
        </div>
    );
};

export default HealthBar;
