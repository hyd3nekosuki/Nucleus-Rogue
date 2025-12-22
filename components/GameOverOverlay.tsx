
import React from 'react';
import { NuclideData, DecayMode } from '../types';

interface GameOverOverlayProps {
    isVisible: boolean;
    reason?: string;
    nuclide: NuclideData;
    onRestart: (random: boolean) => void;
}

const formatPreciseHalfLife = (seconds: number): string => {
    if (seconds === Infinity) return "Stable";
    if (seconds === 0) return "Very Short (< 1ns)";

    // Use scientific notation for very fast decays
    if (seconds < 1e-3) {
        return `${seconds.toExponential(3)} s`;
    }

    // Seconds
    if (seconds < 60) {
        return `${parseFloat(seconds.toPrecision(4))} s`;
    }
    
    // Minutes
    if (seconds < 3600) {
        return `${parseFloat((seconds / 60).toPrecision(4))} m`;
    }

    // Hours
    if (seconds < 86400) {
        return `${parseFloat((seconds / 3600).toPrecision(4))} h`;
    }

    // Days
    const YEAR = 31557600; // 365.25 days
    if (seconds < YEAR) {
        return `${parseFloat((seconds / 86400).toPrecision(4))} d`;
    }

    // Years
    const years = seconds / YEAR;
    if (years >= 1e4) {
        return `${years.toExponential(3)} y`;
    }
    return `${parseFloat(years.toPrecision(4))} y`;
};

const GameOverOverlay: React.FC<GameOverOverlayProps> = ({ isVisible, reason, nuclide, onRestart }) => {
    if (!isVisible) return null;

    const isTransformFail = reason === "TRANSFORMATION_FAILED";
    const title = isTransformFail ? "TRANSFORMATION FAILED" : "RADIOACTIVE DECAY";

    const formatDecayModes = () => {
        const modes = nuclide.decayModes.filter(m => m !== DecayMode.STABLE && m !== DecayMode.UNKNOWN);
        if (modes.length === 0) return "Stable";
        return modes.map(m => m.replace(/_/g, ' ')).join(", ");
    };

    // Use precise formatting for Game Over screen, regardless of the simplified text used in-game
    const preciseHalfLife = formatPreciseHalfLife(nuclide.halfLifeSeconds);

    return (
        <div className="absolute inset-0 bg-red-900/95 flex flex-col items-center justify-center rounded-xl z-30 p-6 text-center shadow-2xl backdrop-blur-sm">
            <div className="text-white text-3xl md:text-4xl font-black mb-2 tracking-tighter drop-shadow-lg uppercase">{title}</div>
            <p className="mb-4 text-gray-200 text-lg">
                {isTransformFail ? (
                    <>
                        <span className="font-bold text-neon-blue">{nuclide.name}</span> does not exist or is outside the drip lines.
                    </>
                ) : (
                    <>
                        You were <span className="font-bold text-neon-blue">{nuclide.name}</span>
                    </>
                )}
            </p>
            
            {!isTransformFail && (
                <div className="mb-6 bg-black/40 p-4 rounded-lg border border-red-500/30 w-full max-w-sm shadow-inner">
                    <h3 className="text-xs text-red-300 uppercase tracking-widest mb-3 border-b border-red-500/20 pb-1 font-bold">Nuclide Properties</h3>
                    <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-sm font-mono text-left">
                        <div className="text-gray-400">Half-Life:</div>
                        <div className="text-white font-bold text-right">{preciseHalfLife}</div>
                        
                        <div className="text-gray-400">Mode:</div>
                        <div className="text-neon-green font-bold text-right break-words text-xs leading-tight flex items-center justify-end h-full">
                            {formatDecayModes()}
                        </div>

                        <div className="text-gray-400">Protons (Z):</div>
                        <div className="text-white text-right">{nuclide.z}</div>

                        <div className="text-gray-400">Mass (A):</div>
                        <div className="text-white text-right">{nuclide.a}</div>
                    </div>
                </div>
            )}
            
            {isTransformFail && (
                <div className="mb-8 p-3 bg-black/40 rounded border border-white/10">
                    <p className="text-xs text-gray-400 mb-1">Evidence / Reference:</p>
                    <a 
                        href="https://www-nds.iaea.org/relnsd/vcharthtml/VChartHTML.html" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-neon-blue hover:text-white underline text-sm break-all font-mono"
                    >
                        IAEA Chart of Nuclides
                    </a>
                </div>
            )}

            <div className="flex flex-col gap-3 w-full max-w-xs">
                <button 
                    onClick={() => onRestart(true)}
                    className="w-full px-6 py-3 bg-neon-purple text-white font-bold text-sm md:text-base uppercase tracking-widest rounded shadow-[0_0_20px_rgba(188,19,254,0.4)] hover:bg-white hover:text-neon-purple hover:scale-105 transition-all duration-200 border border-white/20"
                >
                    RANDOM GENERATION
                </button>
                
                <div className="flex items-center gap-2 my-1">
                    <div className="h-px bg-white/30 flex-1"></div>
                    <span className="text-xs text-white/50 font-mono">OR</span>
                    <div className="h-px bg-white/30 flex-1"></div>
                </div>

                <button 
                    onClick={() => onRestart(false)}
                    className="w-full px-6 py-3 bg-neon-blue text-black font-bold text-sm md:text-base uppercase tracking-widest rounded shadow-[0_0_20px_rgba(0,243,255,0.4)] hover:bg-white hover:scale-105 transition-all duration-200"
                >
                    Restart from H-1
                </button>
            </div>
        </div>
    );
};

export default GameOverOverlay;
