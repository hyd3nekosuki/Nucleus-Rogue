
import React from 'react';
import { getSymbol, ELEMENT_GROUPS } from '../constants';

interface Props {
    unlocked: number[];
    unlockedGroups: string[];
    disabledSkills: string[];
    onToggleSkill: (skillName: string) => void;
    maxCombo: number;
    onClose: () => void;
    canTransmute?: boolean;
    onSelectElement?: (z: number) => void;
}

const PeriodicTable: React.FC<Props> = ({ 
    unlocked, 
    unlockedGroups, 
    disabledSkills,
    onToggleSkill,
    maxCombo, 
    onClose, 
    canTransmute, 
    onSelectElement 
}) => {
    
    // --- Periodic Table Logic ---
    const getPosition = (z: number) => {
        if (z === 0) return { r: 1, c: 1 };
        let r = 1, c = 1;
        if (z === 1) { r = 1; c = 1; }
        else if (z === 2) { r = 1; c = 18; }
        else if (z >= 3 && z <= 4) { r = 2; c = z - 2; }
        else if (z >= 5 && z <= 10) { r = 2; c = z + 8; }
        else if (z >= 11 && z <= 12) { r = 3; c = z - 10; }
        else if (z >= 13 && z <= 18) { r = 3; c = z; }
        else if (z >= 19 && z <= 36) { r = 4; c = z - 18; }
        else if (z >= 37 && z <= 54) { r = 5; c = z - 36; }
        else if (z >= 55 && z <= 56) { r = 6; c = z - 54; }
        else if (z >= 57 && z <= 71) { r = 8; c = z - 54; } 
        else if (z >= 72 && z <= 86) { r = 6; c = z - 68; }
        else if (z >= 87 && z <= 88) { r = 7; c = z - 86; }
        else if (z >= 89 && z <= 103) { r = 9; c = z - 86; } 
        else if (z >= 104 && z <= 118) { r = 7; c = z - 100; }
        else { r = 10; c = 1; }
        return { r: r + 1, c };
    };

    const getCategoryStyles = (z: number) => {
        if (z === 0) return { name: "Special", class: "bg-gray-100 border-white text-gray-900 shadow-[0_0_15px_white] z-10 scale-110 font-bold" };
        if (ELEMENT_GROUPS["Noble Gas"].includes(z)) return { name: "Noble Gas", class: "bg-purple-900/40 border-purple-500/50 text-purple-300" };
        if (ELEMENT_GROUPS["Alkali Metal"].includes(z)) return { name: "Alkali Metal", class: "bg-rose-900/40 border-rose-500/50 text-rose-300" };
        if (ELEMENT_GROUPS["Alkaline Earth"].includes(z)) return { name: "Alkaline Earth", class: "bg-orange-900/40 border-orange-500/50 text-orange-300" };
        if (ELEMENT_GROUPS["Lanthanide"].includes(z)) return { name: "Lanthanide", class: "bg-pink-900/40 border-pink-500/50 text-pink-300" };
        if (ELEMENT_GROUPS["Actinide"].includes(z)) return { name: "Actinide", class: "bg-fuchsia-900/40 border-fuchsia-500/50 text-fuchsia-300" };
        if (ELEMENT_GROUPS["Halogen"].includes(z)) return { name: "Halogen", class: "bg-indigo-900/40 border-indigo-500/50 text-indigo-300" };
        if (ELEMENT_GROUPS["Metalloid"].includes(z)) return { name: "Metalloid", class: "bg-teal-900/40 border-teal-500/50 text-teal-300" };
        if (ELEMENT_GROUPS["Non-metal"].includes(z)) return { name: "Non-metal", class: "bg-blue-900/40 border-blue-500/50 text-blue-300" };
        if (ELEMENT_GROUPS["Post-Transition"].includes(z)) return { name: "Post-Transition", class: "bg-emerald-900/40 border-emerald-500/50 text-emerald-300" };
        if (ELEMENT_GROUPS["Transition"].includes(z)) return { name: "Transition", class: "bg-yellow-900/40 border-yellow-500/50 text-yellow-300" };
        return { name: "Unknown", class: "bg-gray-900 border-gray-500 text-gray-300" };
    };

    const renderPeriodicTable = () => {
        const elements = [];
        for (let z = 0; z <= 118; z++) {
            const isUnlocked = unlocked.includes(z);
            const { r, c } = getPosition(z);
            const style = getCategoryStyles(z);
            
            const isTarget = canTransmute && isUnlocked;
            const isGroupMastered = unlockedGroups.includes(style.name);

            // Mastered group effect: Golden frame + glow
            const masteryEffect = isGroupMastered 
                ? "border-yellow-400 shadow-[0_0_12px_rgba(250,204,21,0.4)] z-10" 
                : "";

            const finalClass = isUnlocked 
                ? `${style.class} ${masteryEffect} scale-100 opacity-100 hover:scale-110 hover:z-20 cursor-help ${isTarget ? 'ring-2 ring-yellow-400 animate-pulse !cursor-pointer shadow-[0_0_20px_rgba(250,204,21,0.6)]' : ''}`
                : "bg-gray-900 border-gray-800 text-gray-700 scale-95 opacity-40";
            
            elements.push(
                <div key={z} 
                    className={`relative border flex flex-col items-center justify-center p-0.5 md:p-1 rounded text-[8px] md:text-sm lg:text-xl transition-all duration-300 ${finalClass}`}
                    style={{ gridRow: r, gridColumn: c, aspectRatio: '1/1' }}
                    onClick={() => isTarget && onSelectElement && onSelectElement(z)}
                    title={isTarget ? `Click to Transmute to ${style.name}!` : (isUnlocked ? `${style.name} (Z=${z})${isGroupMastered ? ' 👑' : ''}` : `Locked (Z=${z})`)}>
                    
                    {/* Discovery Mark: Crown only for the Origin (Neutron, Z=0) */}
                    {z === 0 && isUnlocked && (
                        <div className="absolute -top-1 -right-1 md:top-0 md:right-0 md:p-0.5 text-[7px] md:text-[10px] lg:text-xs leading-none z-20 pointer-events-none drop-shadow-sm animate-pulse">👑</div>
                    )}

                    <div className="font-bold leading-none">{getSymbol(z)}</div>
                    <div className="text-[6px] md:text-[10px] lg:text-sm opacity-70">{z}</div>
                </div>
            );
        }
        return (
            <div className="grid gap-0.5 md:gap-1 lg:gap-1.5 p-2 bg-[#0a0a12] rounded border border-gray-800 overflow-x-auto min-w-[300px] mb-4"
                style={{ gridTemplateColumns: 'repeat(18, minmax(18px, 1fr))', gridTemplateRows: 'repeat(11, minmax(18px, 1fr))' }}>
                {elements}
                <div className="col-start-3 row-start-7 flex items-center justify-center text-gray-700 text-[8px] md:text-xs lg:text-sm font-mono pointer-events-none">57-71</div>
                <div className="col-start-3 row-start-8 flex items-center justify-center text-gray-700 text-[8px] md:text-xs lg:text-sm font-mono pointer-events-none">89-103</div>
            </div>
        );
    };

    // Filtered legend items containing only functional hidden skills
    const displayLegendItems: any[] = [];

    // Special hidden titles / skills - Only show functional/unlocked ones as toggles
    const hiddenSkills = [
        { name: "Pair anihilation", class: "bg-blue-500/20 border-neon-blue text-neon-blue font-bold shadow-[0_0_10px_#00f3ff]" },
        { name: "Coulomb barrier", class: "bg-red-900/20 border-neon-red text-neon-red font-bold shadow-[0_0_10px_#ff0055]" },
        { name: "Fusion", class: "bg-orange-600/20 border-orange-500 text-orange-400 font-bold shadow-[0_0_10px_#f97316]" },
        { name: "Fission", class: "bg-red-600/20 border-red-500 text-red-400 font-bold shadow-[0_0_10px_#ef4444]" },
        { name: "Transmutation", class: "bg-neon-purple/20 border-neon-purple text-neon-purple font-bold shadow-[0_0_10px_#bc13fe]" },
        { name: "Nucleosynthesis", class: "bg-blue-600/20 border-neon-blue text-white font-black shadow-[0_0_15px_#00f3ff]" },
        { name: "Temporal Inversion", class: "bg-white/10 border-white text-white font-black shadow-[0_0_15px_white]" },
        { name: "Tetraneutron", class: "bg-black border-purple-500 text-purple-300 shadow-[0_0_10px_#a855f7] font-black" }
    ];

    hiddenSkills.forEach(skill => {
        if (unlockedGroups.includes(skill.name)) {
            displayLegendItems.push(skill);
        }
    });

    const discoveredCount = unlocked.filter(z => z > 0).length;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 animate-fade-in">
            <div className="relative bg-[#13131f] border border-gray-700 rounded-xl p-4 md:p-6 max-w-[95vw] w-full lg:w-[1200px] max-h-[95vh] overflow-y-auto flex flex-col shadow-2xl">
                
                <button 
                    onClick={onClose}
                    className="absolute top-3 right-3 md:top-6 md:right-6 px-4 py-2 bg-red-900/50 hover:bg-red-700 text-white rounded border border-red-800 transition-colors uppercase text-xs font-bold z-20 shadow-lg"
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
                                ✨ READY FOR NUCLEAR TRANSMUTATION ✨
                             </div>
                        ) : (
                            <div className="text-[10px] md:text-xs text-gray-400 mt-0.5 flex flex-wrap gap-x-2 items-center">
                                <span>Found: <span className="text-neon-green font-bold">{discoveredCount}</span> / 118</span>
                                <span className="opacity-30">|</span>
                                <span>Titles: <span className="text-yellow-400 font-bold">{unlockedGroups.length}</span></span>
                                <span className="opacity-30">|</span>
                                <span>Best Chain: <span className="text-neon-blue font-black">{maxCombo}</span></span>
                            </div>
                        )}
                    </div>
                </div>

                {renderPeriodicTable()}
                
                {/* Compact legend grid showing ONLY functional/hidden skills */}
                {displayLegendItems.length > 0 && (
                  <div className="mt-2 border-t border-gray-800/50 pt-4">
                    <h3 className="text-[10px] text-gray-500 uppercase tracking-[0.2em] mb-3 font-bold">Skills</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 text-[9px] font-bold uppercase tracking-wider shrink-0">
                        {displayLegendItems.map(item => {
                            const isDisabled = disabledSkills.includes(item.name);
                            
                            // Icon mapping
                            let icon = "👑";
                            if (item.name === "Tetraneutron") icon = "🌟";
                            if (item.name === "Temporal Inversion") icon = "⏱";

                            const tooltipText = item.name === "Coulomb barrier" 
                                ? "Active: Deflects protons when Z is a magic number (Prevents transmutation)."
                                : item.name === "Fusion" 
                                ? "Active: Allows proton capture. Disabled: Prevents Z increase from protons."
                                : item.name === "Fission"
                                ? "Active: Gain massive points and energy when neutron-induced fission occurs. Disabled: Replaces fission with alpha decay (Restriction mode)."
                                : "";

                            return (
                                <div 
                                    key={item.name} 
                                    onClick={() => onToggleSkill(item.name)}
                                    title={tooltipText}
                                    className={`px-2 py-2 rounded border flex items-center justify-center relative transition-all duration-300 min-h-[32px] text-center cursor-pointer hover:brightness-125 active:scale-95
                                        ${item.class} 
                                        ${isDisabled ? 'grayscale opacity-40 shadow-none border-gray-600' : ''}
                                    `}
                                >
                                    <span className="absolute -top-2 left-0.5 text-base drop-shadow-md z-20">{icon}</span>
                                    <span className="truncate w-full block">{item.name}</span>
                                    {isDisabled && <span className="ml-1 opacity-60 text-[7px] shrink-0">(OFF)</span>}
                                </div>
                            );
                        })}
                    </div>
                  </div>
                )}
            </div>
        </div>
    );
};

export default PeriodicTable;
