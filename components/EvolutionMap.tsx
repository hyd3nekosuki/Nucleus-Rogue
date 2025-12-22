import React, { useMemo } from 'react';
import { NuclideData, DecayMode } from '../types';
import { getNuclideDataSync } from '../services/nuclideService';

interface HistoryEntry {
    turn: number;
    name: string;
    symbol: string;
    z: number;
    a: number;
    method: string;
}

interface EvolutionMapProps {
    history: HistoryEntry[];
    currentNuclide: NuclideData;
}

const EvolutionMap: React.FC<EvolutionMapProps> = ({ history, currentNuclide }) => {
    const GRID_SIZE = 7;
    // 垂直方向の中心を3から2にシフト（上に1個ずらす）
    const CENTER_X = 3; 
    const CENTER_Y = 2; 

    const curZ = currentNuclide.z;
    const curN = currentNuclide.a - currentNuclide.z;

    // Helper to get base color styles and contrasting text color
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

    // Plotting logic
    const plottedNodes = useMemo(() => {
        const nodes: { x: number, y: number, entry: HistoryEntry, isCurrent: boolean, styles: any }[] = [];
        // Changed from -25 to -50 to satisfy user request
        const recentHistory = [...history].slice(-50); 

        recentHistory.forEach((entry) => {
            const entN = entry.a - entry.z;
            const relZ = entry.z - curZ;
            const relN = entN - curN;

            const row = CENTER_Y - relZ;
            const col = CENTER_X + relN;

            if (row >= 0 && row < GRID_SIZE && col >= 0 && col < GRID_SIZE) {
                const isCurrent = (relZ === 0 && relN === 0);
                const styles = getStylesForNuclide(entry.z, entry.a);

                nodes.push({
                    x: col,
                    y: row,
                    entry,
                    isCurrent,
                    styles
                });
            }
        });
        return nodes;
    }, [history, curZ, curN, currentNuclide]);

    const paths = useMemo(() => {
        if (plottedNodes.length < 2) return null;
        const linePaths: React.ReactNode[] = [];
        const step = 100 / GRID_SIZE;
        const halfStep = step / 2;
        
        for (let i = 0; i < plottedNodes.length - 1; i++) {
            const start = plottedNodes[i];
            const end = plottedNodes[i + 1];
            
            const x1 = start.x * step + halfStep;
            const y1 = start.y * step + halfStep;
            const x2 = end.x * step + halfStep;
            const y2 = end.y * step + halfStep;

            const ageFactor = i / (plottedNodes.length - 1);
            const isLatest = i === plottedNodes.length - 2;

            linePaths.push(
                <g key={`path-group-${i}`} style={{ filter: isLatest ? 'drop-shadow(0 0 4px #00f3ff)' : 'none' }}>
                    {isLatest && (
                        <line 
                            x1={`${x1}%`} y1={`${y1}%`} x2={`${x2}%`} y2={`${y2}%`}
                            stroke="rgba(0, 243, 255, 0.5)"
                            strokeWidth="8"
                            strokeLinecap="round"
                        />
                    )}
                    <line 
                        x1={`${x1}%`} y1={`${y1}%`} x2={`${x2}%`} y2={`${y2}%`}
                        stroke={isLatest ? "#00f3ff" : `rgba(255, 255, 255, ${0.2 + ageFactor * 0.5})`}
                        strokeWidth={isLatest ? "4" : (1.5 + ageFactor * 2)}
                        strokeDasharray={ageFactor < 0.1 ? "3 3" : "none"}
                        strokeLinecap="round"
                    />
                </g>
            );
        }
        return linePaths;
    }, [plottedNodes]);

    return (
        <div className="w-full h-full flex flex-col bg-[#050508] rounded-xl border border-gray-800 relative overflow-hidden shadow-inner">
            <div className="flex-1 relative">
                {/* Visual Grid Layer */}
                <div className="absolute inset-0 pointer-events-none">
                    {/* Centering crosshairs adjusted to NEW CENTER */}
                    <div 
                        className="absolute left-0 w-full h-[1px] bg-white/10 shadow-[0_0_10px_rgba(255,255,255,0.1)]"
                        style={{ top: `${(CENTER_Y + 0.5) * (100 / GRID_SIZE)}%` }}
                    ></div>
                    <div 
                        className="absolute top-0 h-full w-[1px] bg-white/10 shadow-[0_0_10px_rgba(255,255,255,0.1)]"
                        style={{ left: `${(CENTER_X + 0.5) * (100 / GRID_SIZE)}%` }}
                    ></div>
                    <div className="w-full h-full bg-[radial-gradient(#1a1a1a_1px,transparent_1px)] bg-[size:14.28%_14.28%] opacity-30"></div>
                </div>

                <svg className="absolute inset-0 w-full h-full pointer-events-none z-10">
                    {paths}
                </svg>

                <div className="grid grid-cols-7 grid-rows-7 h-full w-full relative z-20">
                    {Array.from({ length: GRID_SIZE * GRID_SIZE }).map((_, i) => {
                        const row = Math.floor(i / GRID_SIZE);
                        const col = i % GRID_SIZE;
                        const node = plottedNodes.find(n => n.x === col && n.y === row);
                        const isCenter = row === CENTER_Y && col === CENTER_X;

                        return (
                            <div 
                                key={i} 
                                className="relative flex items-center justify-center"
                            >
                                {node && (
                                    <div 
                                        className={`w-9 h-9 md:w-10 md:h-10 rounded-lg flex flex-col items-center justify-center transition-all duration-500
                                            ${node.styles.color} 
                                            ${node.isCurrent 
                                                ? `${node.styles.glow} shadow-[0_0_20px_currentColor] scale-110 z-30 animate-pulse ring-2 ring-white ring-offset-2 ring-offset-black` 
                                                : 'z-20 border border-black/40 shadow-lg'
                                            }
                                        `}
                                        title={`${node.entry.name} (${node.entry.method})`}
                                    >
                                        <span className={`text-[10px] md:text-[11px] font-black leading-none ${node.styles.textColor}`}>
                                            {node.entry.symbol}
                                        </span>
                                        <span className={`text-[7px] md:text-[8px] leading-none mt-0.5 font-bold opacity-90 ${node.styles.textColor}`}>
                                            {node.entry.a}
                                        </span>
                                    </div>
                                )}
                                {isCenter && !node && (
                                    <div className="w-2 h-2 bg-white/10 rounded-full animate-ping"></div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default EvolutionMap;