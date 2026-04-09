import React, { useMemo, useState } from 'react';
import { NuclideData, DecayMode, HistoryEntry, ComboOrigin, Language } from '../../types';
import { getNuclideDataSync } from '../../services/nuclideService';
import { DripLineService } from '../../engine/dripLineService';

import { LOG_MESSAGES, TITLES, getLogMessages } from '../../constants';

interface EvolutionMapProps {
    history: HistoryEntry[];
    currentNuclide: NuclideData;
    turn: number; // Current game turn
    combo: number;
    comboOrigin?: ComboOrigin;
    language: Language;
}

const EvolutionMap: React.FC<EvolutionMapProps> = React.memo(({ history, currentNuclide, turn, combo, comboOrigin, language }) => {
    const [selectedInfo, setSelectedInfo] = useState<string | null>(null);
    const [mountTurn] = useState(turn); // Store the turn value when the component was first mounted
    
    const GRID_SIZE = 7;
    const CENTER_X = 3; 
    const CENTER_Y = 3;

    const curZ = currentNuclide.z;
    const curA = currentNuclide.a;
    const curN = curA - curZ;

    const getStylesForNuclide = (z: number, a: number) => {
        const data = getNuclideDataSync(z, a);
        if (data.isStable) {
            return { color: "bg-white", textColor: "text-black", glow: "shadow-[#ffffff]" };
        }
        
        // Use the primary decay mode (decay1)
        let mainMode = data.decayModes.length > 0 ? data.decayModes[0] : DecayMode.UNKNOWN;
        
        // Map modes to primary categories for coloring (matching BGM logic)
        if (mainMode === DecayMode.TWO_NEUTRON_EMISSION) mainMode = DecayMode.NEUTRON_EMISSION;
        if (mainMode === DecayMode.DOUBLE_ELECTRON_CAPTURE) mainMode = DecayMode.ELECTRON_CAPTURE;
        if (mainMode === DecayMode.DOUBLE_BETA_MINUS) mainMode = DecayMode.BETA_MINUS;
        if (mainMode === DecayMode.DOUBLE_BETA_PLUS) mainMode = DecayMode.BETA_PLUS;
        if (mainMode === DecayMode.IT) mainMode = DecayMode.GAMMA;
        if (mainMode === DecayMode.EC_B_PLUS) mainMode = DecayMode.BETA_PLUS; // User request: EC/B+ same as B+
        if (mainMode.startsWith('B-')) mainMode = DecayMode.BETA_MINUS;
        if (mainMode.startsWith('B+')) mainMode = DecayMode.BETA_PLUS;
        if (mainMode === DecayMode.EC_ALPHA || mainMode === DecayMode.EC_PROTON || mainMode === DecayMode.EC_2PROTON || mainMode === DecayMode.EC_SF) mainMode = DecayMode.ELECTRON_CAPTURE;

        switch (mainMode) {
            case DecayMode.ALPHA:
                return { color: "bg-yellow-400", textColor: "text-black", glow: "shadow-[#facc15]" };
            case DecayMode.BETA_MINUS:
                return { color: "bg-neon-blue", textColor: "text-black", glow: "shadow-[#00f3ff]" };
            case DecayMode.BETA_PLUS:
                return { color: "bg-neon-purple", textColor: "text-white", glow: "shadow-[#bc13fe]" };
            case DecayMode.ELECTRON_CAPTURE:
                return { color: "bg-teal-500", textColor: "text-white", glow: "shadow-[#14b8a6]" };
            case DecayMode.SPONTANEOUS_FISSION:
                return { color: "bg-neon-red", textColor: "text-white", glow: "shadow-[#ff0055]" };
            case DecayMode.GAMMA:
                return { color: "bg-indigo-400", textColor: "text-white", glow: "shadow-[#818cf8]" };
            case DecayMode.PROTON_EMISSION:
            case DecayMode.TWO_PROTON_EMISSION:
                return { color: "bg-rose-500", textColor: "text-white", glow: "shadow-[#f43f5e]" };
            case DecayMode.NEUTRON_EMISSION:
                return { color: "bg-sky-300", textColor: "text-black", glow: "shadow-[#7dd3fc]" };
            default:
                return { color: "bg-gray-500", textColor: "text-white", glow: "shadow-[#9ca3af]" };
        }
    };

    const formatNuclideName = (name: string) => {
        if (!name) return "";
        return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
    };

    const { visibleNodes } = useMemo(() => {
        const vNodes: { x: number, y: number, entry: HistoryEntry, isCurrent: boolean, styles: any }[] = [];
        
        history.forEach((entry) => {
            const entN = entry.a - entry.z;
            const relZ = entry.z - curZ;
            const relN = entN - curN;

            const row = CENTER_Y - relZ;
            const col = CENTER_X + relN;

            if (row >= 0 && row < GRID_SIZE && col >= 0 && col < GRID_SIZE) {
                const isCurrent = (relZ === 0 && relN === 0);
                const styles = getStylesForNuclide(entry.z, entry.a);
                vNodes.push({
                    x: col, y: row, entry, isCurrent, styles
                });
            }
        });
        
        return { visibleNodes: vNodes };
    }, [history, curZ, curN]);

    const paths = useMemo(() => {
        if (history.length < 1) return null;
        const linePaths: React.ReactNode[] = [];
        const step = 100 / GRID_SIZE;
        const halfStep = step / 2;
        
        history.forEach((entry, i) => {
            if (entry.pz === null || entry.pa === null) return;

            const startRelN = (entry.pa - entry.pz) - curN;
            const startRelZ = entry.pz - curZ;
            const endRelN = (entry.a - entry.z) - curN;
            const endRelZ = entry.z - curZ;

            const x1_raw = CENTER_X + startRelN;
            const y1_raw = CENTER_Y - startRelZ;
            const x2_raw = CENTER_X + endRelN;
            const y2_raw = CENTER_Y - endRelZ;

            const isInExtendedWindow = (
                (x1_raw >= -1 && x1_raw <= GRID_SIZE && y1_raw >= -1 && y1_raw <= GRID_SIZE) ||
                (x2_raw >= -1 && x2_raw <= GRID_SIZE && y2_raw >= -1 && y2_raw <= GRID_SIZE)
            );

            if (!isInExtendedWindow) return;

            const x1 = x1_raw * step + halfStep;
            const y1 = y1_raw * step + halfStep;
            const x2 = x2_raw * step + halfStep;
            const y2 = y2_raw * step + halfStep;

            const ageFactor = history.length > 1 ? i / (history.length - 1) : 1;
            
            // Highlight only the absolute last movement made in the history
            const isLatest = (i === history.length - 1);

            linePaths.push(
                <g key={`path-entry-${i}`} style={{ filter: isLatest ? 'drop-shadow(0 0 4px #00f3ff)' : 'none' }}>
                    {isLatest && (
                        <line 
                            x1={`${x1}%`} y1={`${y1}%`} x2={`${x2}%`} y2={`${y2}%`}
                            stroke="rgba(0, 243, 255, 0.4)"
                            strokeWidth="8"
                            strokeLinecap="round"
                        />
                    )}
                    <line 
                        x1={`${x1}%`} y1={`${y1}%`} x2={`${x2}%`} y2={`${y2}%`}
                        stroke={isLatest ? "#00f3ff" : `rgba(255, 255, 255, ${0.15 + ageFactor * 0.45})`}
                        strokeWidth={isLatest ? "3" : (1 + ageFactor * 1.5)}
                        strokeDasharray={ageFactor < 0.2 && !isLatest ? "2 4" : "none"}
                        strokeLinecap="round"
                    />
                </g>
            );
        });
        return linePaths;
    }, [history, curZ, curN]);

    const getTooltipText = (name: string, method: string) => {
        const formattedName = formatNuclideName(name);
        const logMessages = getLogMessages(language);
        const historyLabels = logMessages.HISTORY;
        
        if (method === historyLabels.ORIGIN || method === historyLabels.UNKNOWN || method === historyLabels.EXP_REPLICATE) {
            return `${formattedName} (${method})`;
        }
        
        if (language === 'jp') {
            return `${method}により${formattedName}に変化`;
        }
        return `${formattedName} by ${method}`;
    };

    return (
        <div className="w-full h-full flex flex-col bg-[#050508] rounded-xl border border-gray-800 relative overflow-hidden shadow-inner">
            <div className="flex-1 relative">
                <div className="absolute inset-0 pointer-events-none">
                    <div className="w-full h-full bg-[radial-gradient(rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:14.28%_14.28%]"></div>
                </div>

                <div className="absolute top-5 left-0 right-0 bottom-0">
                    <div className="absolute inset-0 pointer-events-none">
                        <div 
                            className="absolute left-0 w-full h-[1px] bg-white/5"
                            style={{ top: `${(CENTER_Y + 0.5) * (100 / GRID_SIZE)}%` }}
                        ></div>
                        <div 
                            className="absolute top-0 h-full w-[1px] bg-white/5"
                            style={{ left: `${(CENTER_X + 0.5) * (100 / GRID_SIZE)}%` }}
                        ></div>
                    </div>

                    <svg className="absolute inset-0 w-full h-full pointer-events-none z-10">
                        {paths}
                    </svg>

                    <div className="grid grid-cols-7 grid-rows-7 h-full w-full relative z-20">
                        {Array.from({ length: GRID_SIZE * GRID_SIZE }).map((_, i) => {
                            const row = Math.floor(i / GRID_SIZE);
                            const col = i % GRID_SIZE;
                            const node = [...visibleNodes].reverse().find(n => n.x === col && n.y === row);
                            const isCenter = row === CENTER_Y && col === CENTER_X;

                            const relZ = CENTER_Y - row;
                            const relN = col - CENTER_X;
                            const absZ = curZ + relZ;
                            const absN = curN + relN;
                            const absA = absZ + absN;

                            const nuclideData = node ? getNuclideDataSync(absZ, absA) : null;
                            const isStable = nuclideData?.isStable || false;
                            const showBorders = node && !isStable;

                            // Edge detection
                            const hasLeftLimit = showBorders && DripLineService.isBeyondDripLine(absZ, absA - 1);
                            const hasRightLimit = showBorders && DripLineService.isBeyondDripLine(absZ, absA + 1);
                            const hasTopLimit = showBorders && DripLineService.isBeyondDripLine(absZ + 1, absA + 1);
                            const hasBottomLimit = showBorders && DripLineService.isBeyondDripLine(absZ - 1, absA - 1);
                            
                            // Cliff styles (Gradient and Shadow Glow)
                            let borderStyles = "border-white/5";
                            let cliffGradient = "";
                            let cliffShadow = "";

                            if (hasLeftLimit) {
                                borderStyles += " border-l-2 border-l-neon-red/80";
                                cliffGradient += " bg-gradient-to-r from-neon-red/20 via-transparent to-transparent";
                                cliffShadow += " inset 10px 0 15px -10px rgba(255, 0, 85, 0.6)";
                            }
                            if (hasRightLimit) {
                                borderStyles += " border-r-2 border-r-neon-blue/80";
                                cliffGradient += " bg-gradient-to-l from-neon-blue/20 via-transparent to-transparent";
                                cliffShadow += (cliffShadow ? "," : "") + " inset -10px 0 15px -10px rgba(0, 243, 255, 0.6)";
                            }
                            if (hasTopLimit) {
                                borderStyles += " border-t-2 border-t-neon-red/80";
                                cliffGradient += " bg-gradient-to-b from-neon-red/20 via-transparent to-transparent";
                                cliffShadow += (cliffShadow ? "," : "") + " inset 0 10px 15px -10px rgba(255, 0, 85, 0.6)";
                            }
                            if (hasBottomLimit) {
                                borderStyles += " border-b-2 border-b-neon-blue/80";
                                cliffGradient += " bg-gradient-to-t from-neon-blue/20 via-transparent to-transparent";
                                cliffShadow += (cliffShadow ? "," : "") + " inset 0 -10px 15px -10px rgba(0, 243, 255, 0.6)";
                            }

                            let showBeyondHatching = false;
                            if (!node) {
                                const isBeyond = DripLineService.isBeyondDripLine(absZ, absA);
                                if (isBeyond) {
                                    const isNearDiscovered = history.some(h => {
                                        const hN = h.a - h.z;
                                        return Math.abs(h.z - absZ) <= 1 && Math.abs(hN - absN) <= 1;
                                    });
                                    if (isNearDiscovered) showBeyondHatching = true;
                                }
                            }

                            // Animation only if it happened THIS turn AND this component was already mounted before that turn
                            const isNewDiscovery = node?.entry.firstTurn === turn && turn > mountTurn && turn > 0;

                            // Mark the combo origin with a feather
                            const isComboOrigin = combo > 0 && comboOrigin && absZ === comboOrigin.z && absA === comboOrigin.a;

                            return (
                                <div key={i} 
                                    className={`relative flex items-center justify-center ${borderStyles} ${cliffGradient} ${showBeyondHatching ? 'bg-[repeating-linear-gradient(45deg,transparent,transparent_2px,rgba(0,0,0,0.8)_2px,rgba(0,0,0,0.8)_4px)] opacity-80' : ''}`}
                                    style={{ boxShadow: cliffShadow }}
                                >
                                    {node ? (
                                        <div 
                                            className={`relative w-7 h-7 md:w-8 md:h-8 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:brightness-125 active:scale-90 transition-all
                                                ${node.styles.color} 
                                                ${node.isCurrent 
                                                    ? `${node.styles.glow} shadow-[0_0_15px_currentColor] scale-110 z-30 ring-2 ring-white ring-offset-1 ring-offset-black` 
                                                    : node.entry.isEngraved 
                                                        ? 'z-20 border-2 border-yellow-500 shadow-[0_0_10px_rgba(234,179,8,0.5)]' 
                                                        : 'z-20 border border-black/40 shadow-md opacity-90'
                                                }
                                                ${isNewDiscovery ? 'z-40 animate-discovery-pop' : ''}
                                            `}
                                            onClick={() => setSelectedInfo(getTooltipText(node.entry.name, node.entry.method))}
                                            title={getTooltipText(node.entry.name, node.entry.method)}
                                        >
                                            {/* 📍 Engrave Mark */}
                                            {node.entry.isEngraved && (
                                                <div className="absolute -top-1.5 -left-1 text-[8px] md:text-[10px] drop-shadow-md z-40">
                                                    📍
                                                </div>
                                            )}

                                            <span className={`text-[9px] md:text-[10px] font-black leading-none ${node.styles.textColor}`}>
                                                {node.entry.symbol}
                                            </span>
                                            <span className={`text-[6px] md:text-[7px] leading-none mt-0.5 font-bold opacity-90 ${node.styles.textColor}`}>
                                                {node.entry.a}
                                            </span>
                                            {isComboOrigin && (
                                                <div className="absolute -top-1 -right-1 md:-top-1.5 md:-right-1.5 text-[8px] md:text-[10px] drop-shadow-md animate-pulse z-40">
                                                    🪶
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        isCenter ? (
                                            <div className="w-1.5 h-1.5 bg-white/20 rounded-full animate-pulse"></div>
                                        ) : (
                                            !showBeyondHatching && absZ >= 0 && absZ <= 118 && (
                                                <div className="w-0.5 h-0.5 bg-white/10 rounded-full"></div>
                                            )
                                        )
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
            
            <div className="absolute top-1 right-2 text-[8px] text-gray-600 font-bold uppercase pointer-events-none">N →</div>
            <div className="absolute top-1 left-2 text-[8px] text-gray-600 font-bold uppercase pointer-events-none">Z ↑</div>
            
            {selectedInfo && (
                <div className="absolute top-1 left-1/2 -translate-x-1/2 text-[8px] text-neon-blue font-bold pointer-events-none text-center truncate max-w-[60%] animate-pulse">
                    {selectedInfo}
                </div>
            )}
        </div>
    );
});

export default EvolutionMap;