
import React, { useMemo, useState } from 'react';
import { NuclideData, DecayMode, HistoryEntry } from '../../types';
import { getNuclideDataSync } from '../../services/nuclideService';

interface EvolutionMapProps {
    history: HistoryEntry[];
    currentNuclide: NuclideData;
}

const EvolutionMap: React.FC<EvolutionMapProps> = ({ history, currentNuclide }) => {
    const [selectedInfo, setSelectedInfo] = useState<string | null>(null);
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
        
        const mainMode = data.decayModes.find(m => m !== DecayMode.STABLE && m !== DecayMode.UNKNOWN) || DecayMode.UNKNOWN;
        
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
        
        const currentEntryIdx = history.findIndex(h => h.z === curZ && h.a === curA);

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
            
            const isIncomingPath = (i === currentEntryIdx);
            const isAbsoluteLast = (i === history.length - 1);
            const isLatest = isIncomingPath || isAbsoluteLast;

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
    }, [history, curZ, curN, curA]);

    const getTooltipText = (name: string, method: string) => {
        const formattedName = formatNuclideName(name);
        if (method === "Origin" || method === "Unknown" || method === "Experimental replicate") {
            return `${formattedName} (${method})`;
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

                            return (
                                <div key={i} className="relative flex items-center justify-center">
                                    {node ? (
                                        <div 
                                            className={`w-7 h-7 md:w-8 md:h-8 rounded-lg flex flex-col items-center justify-center transition-all duration-300 cursor-pointer hover:brightness-125 active:scale-90
                                                ${node.styles.color} 
                                                ${node.isCurrent 
                                                    ? `${node.styles.glow} shadow-[0_0_20px_currentColor] scale-110 z-30 animate-pulse ring-2 ring-white ring-offset-2 ring-offset-black` 
                                                    : 'z-20 border border-black/40 shadow-md opacity-90'
                                                }
                                            `}
                                            onClick={() => setSelectedInfo(getTooltipText(node.entry.name, node.entry.method))}
                                            title={getTooltipText(node.entry.name, node.entry.method)}
                                        >
                                            <span className={`text-[9px] md:text-[10px] font-black leading-none ${node.styles.textColor}`}>
                                                {node.entry.symbol}
                                            </span>
                                            <span className={`text-[6px] md:text-[7px] leading-none mt-0.5 font-bold opacity-90 ${node.styles.textColor}`}>
                                                {node.entry.a}
                                            </span>
                                        </div>
                                    ) : (
                                        isCenter && (
                                            <div className="w-1.5 h-1.5 bg-white/20 rounded-full"></div>
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
};

export default EvolutionMap;
