import React, { useRef, memo } from 'react';
import { NuclideData, DecayMode } from '../../types';
import { MAGIC_NUMBERS } from '../../constants';
import { formatDecayModes } from '../../services/nuclideService';

interface HealthBarProps {
    hp: number;
    maxHp: number;
    nuclide: NuclideData;
    onToggleTimeStop?: () => void;
    isTimeStopped?: boolean;
    level: number; // Mastery Level
    barrierCharges?: number; // Remaining charges
    isSoundTestActive?: boolean;
    onHPChange?: (val: number) => void;
}

const HealthBar: React.FC<HealthBarProps> = ({ 
    hp, maxHp, nuclide, onToggleTimeStop, isTimeStopped, level, barrierCharges = 0,
    isSoundTestActive = false, onHPChange 
}) => {
    const hpPercent = (hp / maxHp) * 100;
    const roundedHp = Math.round(hp);
    const protonNumber = nuclide.z;
    const neutronNumber = nuclide.a - nuclide.z;
    const barRef = useRef<HTMLDivElement>(null);
    
    // Magic Shell check
    const isMagicZ = level >= 1 && MAGIC_NUMBERS.includes(protonNumber);
    const isMagicN = level >= 1 && MAGIC_NUMBERS.includes(neutronNumber);
    const hasBarrier = barrierCharges > 0;
    
    // Time stop depends on Level 3
    const canUseTimeStop = level >= 3 && isMagicN;
    const isDoubleMagic = isMagicZ && isMagicN;

    /**
     * Robust Color Interpolation (Lerp)
     * Maps p (0-100) to Green (100), Yellow (50), Red (0)
     */
    const getDynamicColor = (p: number) => {
        // Red: rgb(255, 0, 85)
        // Yellow: rgb(250, 204, 21)
        // Green: rgb(0, 255, 157)
        let r, g, b;
        
        if (p >= 50) {
            const f = (p - 50) / 50;
            r = Math.round(250 + (0 - 250) * f);
            g = Math.round(204 + (255 - 204) * f);
            b = Math.round(21 + (157 - 21) * f);
        } else {
            const f = p / 50;
            r = Math.round(255 + (250 - 255) * f);
            g = Math.round(0 + (204 - 0) * f);
            b = Math.round(85 + (21 - 85) * f);
        }
        return `rgb(${r}, ${g}, ${b})`;
    };

    const dynamicStatusColor = getDynamicColor(hpPercent);

    const getDecayDisplay = () => {
        const modes = formatDecayModes(nuclide, false);
        if (nuclide.isStable) return `[${nuclide.halfLifeText}]`;
        return `[${nuclide.halfLifeText}, ${modes}]`;
    };

    const getMagicLabel = () => {
        if (isSoundTestActive) return '🎚️ SOUND TEST: Adjust HP for BPM';
        if (isTimeStopped) return '⏸ Frozen Time';
        
        const zMarker = isMagicZ ? 'Z★' : '';
        const nMarker = isMagicN ? 'N★' : '';
        const magicMarkers = [zMarker, nMarker].filter(Boolean).join(' ');
        const magicIndicator = magicMarkers ? ` [${magicMarkers}]` : '';

        if (hasBarrier) {
            return `✨ MAGIC BARRIER: ${barrierCharges} CHARGES${magicIndicator}`;
        }
        
        if (isDoubleMagic) return `✨ DOUBLE MAGIC STATE${magicIndicator}`;
        if (isMagicZ) return `✨ MAGIC PROTON STATE${magicIndicator}`;
        if (isMagicN) return `✨ MAGIC NEUTRON STATE${magicIndicator}`;
        
        return '\u00A0'; 
    };

    const handleInteraction = (e: React.MouseEvent | React.TouchEvent) => {
        if (!isSoundTestActive || !onHPChange || !barRef.current) return;
        e.stopPropagation();
        const rect = barRef.current.getBoundingClientRect();
        const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
        const x = clientX - rect.left;
        const width = rect.width;
        let percentage = Math.max(0, Math.min(100, (x / width) * 100));
        onHPChange(percentage);
    };

    const isAnyMagic = isMagicZ || isMagicN || isTimeStopped || hasBarrier || isSoundTestActive;

    return (
        <div 
            onClick={isSoundTestActive ? (e) => e.stopPropagation() : (canUseTimeStop ? onToggleTimeStop : undefined)}
            className={`w-full max-w-[95vw] md:w-[450px] mb-1 relative z-30 p-1 rounded-lg transition-all select-none
                ${isAnyMagic ? (isTimeStopped ? 'bg-neon-blue/20 ring-2 ring-neon-blue shadow-[0_0_20px_#00f3ff] cursor-pointer' : 
                   canUseTimeStop ? 'bg-gray-800/30 hover:bg-neon-blue/10 ring-1 ring-neon-blue/40 shadow-[0_0_10px_#00f3ff44] cursor-pointer animate-pulse' : 
                   isSoundTestActive ? 'bg-yellow-400/10 ring-2 ring-yellow-400 shadow-[0_0_20px_rgba(250,204,21,0.3)] cursor-ew-resize' :
                   'bg-gray-800/20 ring-1 ring-gray-700/40 cursor-default') : 'bg-transparent'}`}
        >
            <div className="flex justify-between items-end mb-1 px-1">
                <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                        <span className="text-neon-blue font-bold text-sm md:text-base">{nuclide.name}</span>
                        <span className="text-xs text-gray-500 font-mono">{getDecayDisplay()}</span>
                    </div>
                  <span 
                    key={getMagicLabel()}
                    className={`text-[10px] font-black uppercase tracking-tighter -mt-1 drop-shadow-[0_0_5px_#00f3ff] min-h-[1.2em] flex items-center transition-all duration-300 ${isAnyMagic ? (isDoubleMagic || hasBarrier ? 'text-yellow-400 opacity-100' : (isSoundTestActive ? 'text-yellow-400' : 'text-neon-blue opacity-100')) : 'opacity-0'}`}>
                      {getMagicLabel()}
                  </span>
                </div>
                {/* 
                   CRITICAL FIX: Adding key={roundedHp} forces React to unmount and remount 
                   this specific text node when the value changes, effectively clearing the 
                   browser's composite rendering cache and stopping the ghosting issue.
                */}
                <div 
                    key={roundedHp}
                    className={`font-mono font-bold text-sm text-right transition-none ${hpPercent < 30 && !isSoundTestActive ? "animate-pulse" : ""}`}
                    style={{ 
                        color: dynamicStatusColor,
                        // Low stability glow to maintain high contrast during pulse transparency dips
                        textShadow: hpPercent < 30 ? `0 0 12px ${dynamicStatusColor}` : 'none'
                    }}
                >
                    {roundedHp}% {isTimeStopped ? 'FROZEN' : (isSoundTestActive ? 'FREQ' : 'STABILITY')}
                </div>
            </div>
            <div 
                ref={barRef}
                onMouseDown={handleInteraction}
                onMouseMove={(e) => e.buttons === 1 && handleInteraction(e)}
                onTouchStart={handleInteraction}
                onTouchMove={handleInteraction}
                className="h-4 md:h-5 bg-gray-900/80 rounded border border-gray-700 overflow-hidden relative shadow-lg"
            >
                <div className="absolute inset-0 opacity-20 bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.1)_25%,rgba(255,255,255,0.1)_50%,transparent_50%,transparent_75%,rgba(255,255,255,0.1)_75%,rgba(255,255,255,0.1)_100%)] bg-[length:10px_10px]"></div>
                <div 
                    className="h-full transition-all duration-300 ease-out relative shadow-[0_0_20px_currentColor]" 
                    style={{ 
                        width: `${hpPercent}%`, 
                        backgroundColor: isTimeStopped ? '#ffffff' : dynamicStatusColor,
                        color: isTimeStopped ? '#ffffff' : dynamicStatusColor
                    }}
                >
                    <div className="absolute inset-0 bg-gradient-to-b from-white/30 to-transparent"></div>
                </div>
            </div>
        </div>
    );
};

export default memo(HealthBar);