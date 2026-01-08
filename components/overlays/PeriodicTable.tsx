import React, { useState } from 'react';
import { getSymbol, SKILL_METADATA } from '../../constants';
import { DecayMode } from '../../types';
import { getElementGridPosition, getElementCategoryInfo } from '../../utils/periodicTableUtils';

interface Props {
    unlocked: number[];
    unlockedGroups: string[];
    decayStats: Record<string, number>;
    reactionStats: Record<string, number>;
    disabledSkills: string[];
    onToggleSkill: (skillName: string) => void;
    maxCombo: number;
    reincarnations?: number;
    onClose: () => void;
    canTransmute?: boolean;
    onSelectElement?: (z: number) => void;
    saveCode: string;
}

const PeriodicTable: React.FC<Props> = ({ 
    unlocked, 
    unlockedGroups, 
    decayStats,
    reactionStats,
    disabledSkills,
    onToggleSkill,
    maxCombo, 
    reincarnations = 0,
    onClose, 
    canTransmute, 
    onSelectElement,
    saveCode
}) => {
    const [copyFeedback, setCopyFeedback] = useState(false);
    const [selectedInfo, setSelectedInfo] = useState<string | null>(null);

    const renderPeriodicTable = () => {
        const elements = [];
        for (let z = 0; z <= 118; z++) {
            const isUnlocked = unlocked.includes(z);
            const { r, c } = getElementGridPosition(z);
            const style = getElementCategoryInfo(z);
            const isTarget = canTransmute && isUnlocked;
            const isGroupMastered = unlockedGroups.includes(style.name);
            
            const masteryEffect = isGroupMastered 
                ? "border-yellow-400/80 shadow-[0_6px_20px_rgba(0,0,0,0.8),0_2px_10px_rgba(250,204,21,0.3)] z-10 -translate-y-1 brightness-110" 
                : "translate-y-0 opacity-80";
            
            const finalClass = isUnlocked 
                ? `${style.class} ${masteryEffect} scale-100 hover:scale-110 hover:z-20 cursor-help ${isTarget ? 'ring-2 ring-yellow-400 animate-pulse !cursor-pointer shadow-[0_0_20px_rgba(250,204,21,0.6)]' : ''}`
                : "bg-gray-900 border-gray-800 text-gray-700 scale-95 opacity-40 cursor-pointer hover:bg-gray-800";
            
            const hintMsg = isTarget ? `Click to Transmute to ${style.name}!` : (isUnlocked ? `${style.name} (Z=${z})${isGroupMastered ? ' 👑' : ''}` : `Undiscovered (Z=${z})`);
            
            elements.push(
                <div key={z} 
                    className={`relative border flex flex-col items-center justify-center p-0.5 md:p-1 rounded text-[8px] md:text-sm lg:text-xl transition-all duration-500 ${finalClass}`}
                    style={{ gridRow: r, gridColumn: c, aspectRatio: '1/1' }}
                    onClick={() => {
                        setSelectedInfo(hintMsg);
                        if (isTarget && onSelectElement) onSelectElement(z);
                    }}
                    title={hintMsg}>
                    {z === 0 && isUnlocked && (
                        <div className="absolute -top-1 -right-1 md:top-0 md:right-0 md:p-0.5 text-[7px] md:text-10px lg:text-xs leading-none z-20 pointer-events-none drop-shadow-sm animate-pulse">👑</div>
                    )}
                    {isGroupMastered && isUnlocked && z !== 0 && (
                         <div className="absolute -top-0.5 -right-0.5 text-[6px] md:text-[8px] opacity-40 group-hover:opacity-100 transition-opacity">👑</div>
                    )}
                    <div className="font-bold leading-none">{getSymbol(z)}</div>
                    <div className="text-[6px] md:text-[10px] lg:text-sm opacity-50">{z}</div>
                </div>
            );
        }
        return (
            <div className="grid gap-0.5 md:gap-1 lg:gap-1.5 p-2 bg-[#0a0a12] rounded border border-gray-800 overflow-x-auto overscroll-contain min-w-[300px] mb-4 touch-pan-x"
                style={{ gridTemplateColumns: 'repeat(18, minmax(18px, 1fr))', gridTemplateRows: 'repeat(11, minmax(18px, 1fr))' }}>
                {elements}
                <div className="col-start-3 row-start-7 flex items-center justify-center text-gray-700 text-[8px] md:text-xs lg:text-sm font-mono pointer-events-none">57-71</div>
                <div className="col-start-3 row-start-8 flex items-center justify-center text-gray-700 text-[8px] md:text-xs lg:text-sm font-mono pointer-events-none">89-103</div>
            </div>
        );
    };

    const handleCopy = () => {
        if (!saveCode) return;
        navigator.clipboard.writeText(saveCode).then(() => {
            setCopyFeedback(true);
            setTimeout(() => setCopyFeedback(false), 2000);
        });
    };

    const displayLegendItems = SKILL_METADATA.filter(skill => unlockedGroups.includes(skill.name));
    const discoveredCount = unlocked.filter(z => z > 0).length;

    const statsStr = [
        { l: 'α', v: decayStats[DecayMode.ALPHA] || 0 },
        { l: 'β-', v: decayStats[DecayMode.BETA_MINUS] || 0 },
        { l: 'β+', v: decayStats[DecayMode.BETA_PLUS] || 0 },
        { l: 'EC', v: decayStats[DecayMode.ELECTRON_CAPTURE] || 0 },
        { l: 'SF', v: decayStats[DecayMode.SPONTANEOUS_FISSION] || 0 },
        { l: 'n', v: decayStats[DecayMode.NEUTRON_EMISSION] || 0 },
        { l: 'p', v: decayStats[DecayMode.PROTON_EMISSION] || 0 },
        { l: 'γ', v: decayStats[DecayMode.GAMMA] || 0 },
    ].map(s => `${s.l}:${s.v}`).join(' ');

    const reactionStr = [
        { l: '(n,γ)', v: reactionStats["(n,γ)"] || 0 },
        { l: '(n,p)', v: reactionStats["(n,p)"] || 0 },
        { l: '(n,2n)', v: reactionStats["(n,2n)"] || 0 },
        { l: '(n,α)', v: reactionStats["(n,α)"] || 0 },
        { l: '(n,f)', v: reactionStats["(n,fission)"] || 0 },
    ].map(s => `${s.l}:${s.v}`).join(' ');

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-2 md:p-4 animate-fade-in touch-none">
            <div className="relative bg-[#13131f] border border-gray-700 rounded-xl p-4 md:p-6 max-w-[98vw] w-full lg:w-[1200px] h-full max-h-[96vh] overflow-y-auto overscroll-contain flex flex-col shadow-2xl touch-auto pb-32 md:pb-20">
                <button 
                    onClick={onClose}
                    className="fixed top-6 right-6 md:top-8 md:right-8 px-4 py-2 bg-red-900/80 hover:bg-red-700 text-white rounded border border-red-800 transition-colors uppercase text-xs font-bold z-40 shadow-xl"
                >
                    Close [X]
                </button>
                <div className="flex flex-col justify-start items-start mb-4 shrink-0 gap-2 mr-20">
                    <div>
                        <h2 className="text-xl md:text-2xl font-bold text-white tracking-widest uppercase">
                            <span className="text-neon-blue">Periodic Table</span>
                        </h2>
                        {canTransmute ? (
                             <div className="mt-1 px-3 py-1 bg-yellow-400/20 border border-yellow-400/50 rounded text-yellow-400 font-black text-xs md:text-sm animate-bounce tracking-tight">
                                ✨ READY FOR REPLICATION ✨
                             </div>
                        ) : (
                            <div className="text-[10px] md:text-xs text-gray-400 mt-0.5 flex flex-wrap gap-x-2 items-center">
                                <span>Found: <span className="text-neon-green font-bold">{discoveredCount}</span> / 118</span>
                                <span className="opacity-30">|</span>
                                <span>Titles: <span className="text-yellow-400 font-bold">{unlockedGroups.length}</span></span>
                                <span className="opacity-30">|</span>
                                <span>Reborn: <span className="text-neon-purple font-bold">{reincarnations}</span></span>
                                <span className="opacity-30">|</span>
                                <span>Best Chain: <span className="text-neon-blue font-black">{maxCombo}</span></span>
                                <span className="opacity-30">|</span>
                                <span className="text-gray-500 font-mono">{statsStr}</span>
                                <span className="opacity-30">|</span>
                                <span className="text-neon-blue/70 font-mono">{reactionStr}</span>
                            </div>
                        )}
                        <div className="mt-2 min-h-[1.5rem] flex items-center">
                            {selectedInfo && (
                                <div className="text-[10px] md:text-xs text-neon-blue font-bold tracking-wider">
                                    {selectedInfo}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="shrink-0 mb-6">
                    {renderPeriodicTable()}
                </div>

                {displayLegendItems.length > 0 && (
                  <div className="mt-2 border-t border-gray-800/50 pt-4 pb-4 shrink-0">
                    <h3 className="text-[10px] text-gray-500 uppercase tracking-[0.2em] mb-3 font-bold">Unlocked Skills</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 text-[9px] font-bold uppercase tracking-wider">
                        {displayLegendItems.map(item => {
                            const isDisabled = disabledSkills.includes(item.name);
                            return (
                                <div key={item.name} onClick={() => onToggleSkill(item.name)}
                                    className={`px-2 py-2 rounded border flex items-center justify-center relative transition-all duration-300 min-h-[40px] text-center cursor-pointer hover:brightness-125 active:scale-95 ${item.class} ${isDisabled ? 'grayscale opacity-40 shadow-none border-gray-600' : ''}`}>
                                    <span className="absolute -top-2 left-0.5 text-base drop-shadow-md z-20">{item.icon}</span>
                                    <span className="truncate w-full block px-1">{item.name}</span>
                                    {isDisabled && <span className="ml-1 opacity-60 text-[7px] shrink-0">(OFF)</span>}
                                </div>
                            );
                        })}
                    </div>
                  </div>
                )}

                <div className="mt-4 border-t border-gray-800 pt-6 shrink-0">
                    <h3 className="text-[10px] text-gray-500 uppercase tracking-[0.3em] mb-2 font-bold flex items-center gap-2">
                        research password
                        {copyFeedback && <span className="text-neon-green text-[8px] animate-pulse">COPIED TO CLIPBOARD!</span>}
                    </h3>
                    <div 
                        onClick={handleCopy}
                        className="bg-black/60 border border-gray-800 p-3 rounded-lg cursor-pointer hover:border-neon-blue/50 transition-all group relative overflow-hidden mb-8"
                    >
                        <div className="text-[10px] md:text-xs font-mono text-gray-400 break-all transition-colors group-hover:text-neon-blue max-h-24 overflow-y-auto pr-2">
                            {saveCode}
                        </div>
                        <div className="absolute inset-0 bg-neon-blue/5 opacity-0 group-hover:opacity-100 flex items-center justify-center pointer-events-none">
                            <span className="text-neon-blue font-bold uppercase tracking-widest text-[10px] bg-black/80 px-4 py-2 rounded-full border border-neon-blue/30 shadow-2xl">Click Window to Copy Full Code</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PeriodicTable;
