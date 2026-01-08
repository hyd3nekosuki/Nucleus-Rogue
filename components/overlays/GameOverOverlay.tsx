import React from 'react';
import { NuclideData, DecayMode } from '../../types';
import { formatDecayModes } from '../../services/nuclideService';

interface GameOverOverlayProps {
    isVisible: boolean;
    reason?: string;
    nuclide: NuclideData;
    onRestart: (random: boolean) => void;
    isSoundTestActive: boolean;
    onToggleSoundTest: () => void;
}

const formatPreciseHalfLife = (seconds: number): string => {
    if (seconds === Infinity) return "Stable";
    
    // Handle 'V' flag (mapped to 1e-9) or extremely short/unmeasured measurements
    if (seconds <= 1e-9) return "< 1 ns";

    // Use scientific notation for very fast decays (less than 1ms but greater than 1ns)
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

const GameOverOverlay: React.FC<GameOverOverlayProps> = ({ 
    isVisible, reason, nuclide, onRestart, isSoundTestActive, onToggleSoundTest 
}) => {
    if (!isVisible) return null;

    const isTransformFail = reason === "TRANSFORMATION_FAILED";
    const isCollapse = reason === "NUCLEUS COLLAPSE";
    
    let title = "RADIOACTIVE DECAY";
    if (isTransformFail) title = "TRANSFORMATION FAILED";
    if (isCollapse) title = "NUCLEUS COLLAPSE";

    // Use precise formatting for Game Over screen, regardless of the simplified text used in-game
    const preciseHalfLife = formatPreciseHalfLife(nuclide.halfLifeSeconds);

    return (
        <div 
            onClick={() => isSoundTestActive && onToggleSoundTest()}
            className={`absolute inset-0 bg-[#050508]/95 flex flex-col items-center justify-center rounded-xl z-30 p-6 text-center shadow-[0_0_50px_rgba(0,0,0,1)] backdrop-blur-md border border-neon-blue/20 overflow-hidden transition-all duration-700 ${isSoundTestActive ? 'opacity-30 cursor-pointer' : 'opacity-100'}`}
        >
            {/* CRT Scanline Overlay for Cyberpunk feel */}
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.1)_50%),linear-gradient(90deg,rgba(0,243,255,0.02),rgba(0,243,255,0.01),rgba(0,243,255,0.02))] bg-[length:100%_3px,2px_100%] opacity-50"></div>
            
            {/* Title with strong glow */}
            <div className={`text-white text-3xl md:text-4xl font-black mb-2 tracking-tighter drop-shadow-[0_0_15px_rgba(255,255,255,0.5)] uppercase italic transition-opacity ${isSoundTestActive ? 'opacity-0' : 'opacity-100'}`}>
                {title}
            </div>

            <p className={`mb-4 text-gray-400 text-lg relative z-10 transition-opacity ${isSoundTestActive ? 'opacity-0' : 'opacity-100'}`}>
                {isTransformFail ? (
                    <>
                        <span className="font-bold text-neon-blue">{nuclide.name}</span> does not exist or is outside the drip lines.
                    </>
                ) : isCollapse ? (
                    <>
                        Accretion reached an <span className="font-bold text-neon-blue">impossible configuration</span>.
                    </>
                ) : (
                    <>
                        You were <span className="font-bold text-neon-blue">{nuclide.name}</span>
                    </>
                )}
            </p>
            
            {!isTransformFail && (
                <div className={`mb-6 bg-black/60 p-4 rounded-lg border border-neon-blue/30 w-full max-w-sm shadow-[inset_0_0_20px_rgba(0,243,255,0.1)] relative z-10 transition-opacity ${isSoundTestActive ? 'opacity-0' : 'opacity-100'}`}>
                    <h3 className="text-[10px] text-neon-blue uppercase tracking-[0.3em] mb-3 border-b border-neon-blue/20 pb-1 font-black">diagnostics result</h3>
                    <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-sm font-mono text-left">
                        <div className="text-gray-500">Half-Life:</div>
                        <div className="text-white font-bold text-right drop-shadow-[0_0_5px_white]">{preciseHalfLife}</div>
                        
                        <div className="text-gray-500">Mode:</div>
                        <div className="text-neon-green font-bold text-right break-words text-xs leading-tight flex items-center justify-end h-full drop-shadow-[0_0_5px_#00ff9d]">
                            {formatDecayModes(nuclide)}
                        </div>

                        <div className="text-gray-500">Protons (Z):</div>
                        <div className="text-white text-right font-bold">{nuclide.z}</div>

                        <div className="text-gray-500">Mass (A):</div>
                        <div className="text-white text-right font-bold">{nuclide.a}</div>
                    </div>
                </div>
            )}
            
            {isTransformFail && (
                <div className={`mb-8 p-3 bg-black/40 rounded border border-neon-blue/20 relative z-10 transition-opacity ${isSoundTestActive ? 'opacity-0' : 'opacity-100'}`}>
                    <p className="text-[10px] text-gray-500 mb-1 uppercase tracking-widest font-bold">External Reference:</p>
                    <a 
                        href="https://www-nds.iaea.org/relnsd/vcharthtml/VChartHTML.html" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-neon-blue hover:text-white underline text-sm break-all font-mono transition-colors"
                    >
                        IAEA Chart of Nuclides
                    </a>
                </div>
            )}

            <div className={`flex flex-col gap-3 w-full max-w-[250px] relative z-10 transition-opacity ${isSoundTestActive ? 'opacity-0 pointer-events-none' : 'opacity-100 pointer-events-auto'}`}>
                <button 
                    onClick={(e) => { e.stopPropagation(); onRestart(true); }}
                    className="w-full px-6 py-3 bg-neon-purple text-white font-black text-sm md:text-base uppercase tracking-[0.2em] rounded shadow-[0_0_30px_rgba(188,19,254,0.3)] hover:bg-white hover:text-neon-purple hover:scale-105 transition-all duration-300 border border-white/20"
                >
                    Random generation
                </button>

                <button 
                    onClick={(e) => { e.stopPropagation(); onRestart(false); }}
                    className="w-full px-6 py-3 bg-transparent text-neon-blue border border-neon-blue font-black text-sm md:text-base uppercase tracking-[0.2em] rounded shadow-[0_0_20px_rgba(0,243,255,0.2)] hover:bg-neon-blue hover:text-black hover:scale-105 transition-all duration-300"
                >
                    Restart from H-1
                </button>
            </div>

            {/* Sound Test Icon (Bottom Right - Small version for Mobile compatibility) */}
            <button 
                onClick={(e) => { e.stopPropagation(); onToggleSoundTest(); }}
                className={`absolute bottom-3 right-3 w-8 h-8 flex items-center justify-center bg-black/60 text-yellow-400 border border-yellow-400 rounded-full shadow-[0_0_10px_rgba(250,204,21,0.2)] hover:bg-yellow-400 hover:text-black hover:scale-110 transition-all duration-300 z-40 ${isSoundTestActive ? 'opacity-30 pointer-events-none' : 'opacity-100'}`}
                title="Sound Test Mode"
            >
                <span className="text-base font-bold">♪</span>
            </button>
            
            {/* Background decorative corner marks */}
            <div className="absolute top-4 left-4 w-4 h-4 border-t-2 border-l-2 border-neon-blue/30"></div>
            <div className="absolute top-4 right-4 w-4 h-4 border-t-2 border-r-2 border-neon-blue/30"></div>
            <div className="absolute bottom-4 left-4 h-4 border-b-2 border-l-2 border-neon-blue/30 w-4"></div>
            <div className="absolute bottom-4 right-4 w-4 h-4 border-b-2 border-r-2 border-neon-blue/30"></div>
        </div>
    );
};

export default GameOverOverlay;