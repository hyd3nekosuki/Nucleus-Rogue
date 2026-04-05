
import React from 'react';
import { NuclideData, Language } from '../../types';
import { formatDecayModes } from '../../services/nuclideService';
import { REASON } from '../../constants/gameOverReason';
import { formatPreciseHalfLife } from '../../utils/scientificFormatters';
import { REASON_METADATA } from '../../data/gameOverMetadata';

interface GameOverOverlayProps {
    isVisible: boolean;
    reason?: string;
    nuclide: NuclideData;
    onRestart: (random: boolean) => void;
    isSoundTestActive: boolean;
    onToggleSoundTest: () => void;
    language: Language;
}

/**
 * Internal sub-component to display nuclide statistics.
 */
const NuclideDiagnostics: React.FC<{ nuclide: NuclideData; halfLife: string; isSoundTestActive: boolean; isNothingness: boolean; language: Language }> = ({ nuclide, halfLife, isSoundTestActive, isNothingness, language }) => (
    <div className={`mb-6 bg-black/60 p-4 rounded-lg border border-neon-blue/30 w-full max-sm shadow-[inset_0_0_20px_rgba(0,243,255,0.1)] relative z-10 transition-opacity ${isSoundTestActive ? 'opacity-0' : 'opacity-100'}`}>
        <h3 className="text-[10px] text-neon-blue uppercase tracking-[0.3em] mb-3 border-b border-neon-blue/20 pb-1 font-black">diagnostics result</h3>
        <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-sm font-mono text-left">
            <div className="text-gray-500">Half-Life:</div>
            <div className="text-white font-bold text-right drop-shadow-[0_0_5px_white]">{isNothingness ? "NULL" : halfLife}</div>
            
            <div className="text-gray-500">Mode:</div>
            <div className="text-neon-green font-bold text-right break-words text-xs leading-tight flex items-center justify-end h-full drop-shadow-[0_0_5px_#00ff9d]">
                {isNothingness ? "ANNIHILATED" : formatDecayModes(nuclide, true, language)}
            </div>

            <div className="text-gray-500">Protons (Z):</div>
            <div className={`text-right font-bold ${isNothingness ? 'text-neon-red animate-pulse' : 'text-white'}`}>{isNothingness ? 0 : nuclide.z}</div>

            <div className="text-gray-500">Mass (A):</div>
            <div className={`text-right font-bold ${isNothingness ? 'text-neon-purple animate-pulse' : 'text-white'}`}>{isNothingness ? 0 : nuclide.a}</div>
        </div>
    </div>
);

const GameOverOverlay: React.FC<GameOverOverlayProps> = ({ 
    isVisible, reason = REASON.UNKNOWN, nuclide, onRestart, isSoundTestActive, onToggleSoundTest, language 
}) => {
    if (!isVisible) return null;

    const meta = REASON_METADATA[reason] || REASON_METADATA["DEFAULT"];
    const isCriticalFail = [REASON.DECAY_FAILED, REASON.TRANSFORMATION_FAILED, REASON.FATAL_CAPTURE].includes(reason);
    const isNothingness = reason === REASON.NOTHINGNESS;
    const preciseHalfLife = formatPreciseHalfLife(nuclide.halfLifeSeconds);

    return (
        <div 
            onClick={() => isSoundTestActive && onToggleSoundTest()}
            className={`absolute inset-0 bg-[#050508]/95 flex flex-col items-center justify-center rounded-xl z-30 p-6 text-center shadow-[0_0_50px_rgba(0,0,0,1)] backdrop-blur-md border border-neon-blue/20 overflow-hidden transition-all duration-700 ${isSoundTestActive ? 'opacity-30 cursor-pointer' : 'opacity-100'}`}
        >
            {/* CRT Scanline Overlay */}
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.1)_50%),linear-gradient(90deg,rgba(0,243,255,0.02),rgba(0,243,255,0.01),rgba(0,243,255,0.02))] bg-[length:100%_3px,2px_100%] opacity-50"></div>
            
            {/* Title */}
            <div className={`text-white text-3xl md:text-4xl font-black mb-2 tracking-tighter drop-shadow-[0_0_15px_rgba(255,255,255,0.5)] uppercase italic transition-opacity ${isSoundTestActive ? 'opacity-0' : 'opacity-100'} ${isNothingness ? 'text-neon-purple' : ''}`}>
                {meta.title(language)}
            </div>

            {/* Description Message */}
            <p className={`mb-4 text-gray-400 text-lg relative z-10 transition-opacity ${isSoundTestActive ? 'opacity-0' : 'opacity-100'}`}>
                {meta.getDescription(nuclide.name, language)}
            </p>
            
            {/* Diagnostics Stats */}
            {!isCriticalFail && (
                <NuclideDiagnostics nuclide={nuclide} halfLife={preciseHalfLife} isSoundTestActive={isSoundTestActive} isNothingness={isNothingness} language={language} />
            )}
            
            {/* External Reference for Failures */}
            {(isCriticalFail || isNothingness) && (
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

            {/* Action Buttons */}
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

            {/* Sound Test Icon */}
            <button 
                onClick={(e) => { e.stopPropagation(); onToggleSoundTest(); }}
                className={`absolute bottom-3 right-3 w-8 h-8 flex items-center justify-center bg-black/60 text-yellow-400 border border-yellow-400 rounded-full shadow-[0_0_10px_rgba(250,204,21,0.2)] hover:bg-yellow-400 hover:text-black hover:scale-110 transition-all duration-300 z-40 ${isSoundTestActive ? 'opacity-30 pointer-events-none' : 'opacity-100'}`}
                title="Sound Test Mode"
            >
                <span className="text-base font-bold">♪</span>
            </button>
            
            {/* Decorative corners */}
            <div className="absolute top-4 left-4 w-4 h-4 border-t-2 border-l-2 border-neon-blue/30"></div>
            <div className="absolute top-4 right-4 w-4 h-4 border-t-2 border-r-2 border-neon-blue/30"></div>
            <div className="absolute bottom-4 left-4 h-4 border-b-2 border-l-2 border-neon-blue/30 w-4"></div>
            <div className="absolute bottom-4 right-4 w-4 h-4 border-b-2 border-r-2 border-neon-blue/30"></div>
        </div>
    );
};

export default GameOverOverlay;
