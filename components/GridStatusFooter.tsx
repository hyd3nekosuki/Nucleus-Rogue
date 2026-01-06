import React from 'react';
import { GameState, EntityType } from '../types';
import { getNuclideDataSync } from '../services/nuclideService';
import { getSymbol } from '../constants';

interface Props {
  gameState: GameState;
}

const GridStatusFooter: React.FC<Props> = ({ gameState }) => {
  // 1. Calculate Grid Totals
  const gridTotals = gameState.gridEntities.reduce((acc, entity) => {
    if (entity.type === EntityType.PROTON) acc.p++;
    else if (entity.type === EntityType.NEUTRON) acc.n++;
    else if (entity.type === EntityType.ENEMY_ELECTRON) acc.e++;
    else if (entity.type === EntityType.ENEMY_POSITRON) acc.pos++;
    return acc;
  }, { p: 0, n: 0, e: 0, pos: 0 });

  // 2. Predict Result of Full Grid Absorption
  const expectedZ = gameState.currentNuclide.z + gridTotals.p - gridTotals.e + gridTotals.pos;
  const expectedA = gameState.currentNuclide.a + gridTotals.p + gridTotals.n;
  const expectedData = getNuclideDataSync(expectedZ, expectedA);
  const predictionStr = (expectedData.exists && expectedZ >= 0 && expectedZ <= 118) ? `${getSymbol(expectedZ)}${expectedA}` : "Fail";

  // 3. Determine Active Streak Status
  const activeStreakType = gameState.consecutiveProtons > 0 ? 'p' : gameState.consecutiveNeutrons > 0 ? 'n' : gameState.consecutiveElectrons > 0 ? 'e-' : null;
  const activeStreakCount = activeStreakType === 'p' ? gameState.consecutiveProtons : activeStreakType === 'n' ? gameState.consecutiveNeutrons : activeStreakType === 'e-' ? gameState.consecutiveElectrons : 0;

  return (
    <div className="mt-1 flex flex-wrap justify-center gap-x-8 gap-y-1 text-[10px] font-mono text-gray-400 group relative cursor-help py-1 select-none">
        {/* Legend / Hover Help */}
        <div className="flex items-center gap-2 group-hover:opacity-10 transition-opacity duration-300">
            <div className="w-3 h-3 bg-neon-red rounded-full shadow-[0_0_8px_#ff0055]"></div>
            <span className="text-white font-light">p: (Z+1, A+1)</span>
        </div>
        <div className="flex items-center gap-2 group-hover:opacity-10 transition-opacity duration-300">
            <div className="w-3 h-3 bg-neon-blue rounded-full shadow-[0_0_8px_#00f3ff]"></div>
            <span className="text-white font-light">n: (Z, A+1)</span>
        </div>
        <div className="flex items-center gap-2 group-hover:opacity-10 transition-opacity duration-300">
            <div className="w-2 h-2 bg-yellow-400 rounded-full shadow-[0_0_5px_#facc15]"></div>
            <span className="text-white font-light">e-: (Z-1, A)</span>
        </div>

        {/* Dynamic Statistics Overlay (Shown on Hover) */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-1 group-hover:translate-y-0 pointer-events-none whitespace-nowrap px-1 text-[11px] md:text-xs">
            {/* Predictive Analysis (Level 6+) */}
            {gameState.playerLevel >= 6 && (
                <>
                    <span className={`font-black mr-3 ${predictionStr === 'Fail' ? 'text-neon-red' : 'text-neon-green'} drop-shadow-[0_0_5px_currentColor]`}>→{predictionStr === 'Fail' ? 'fail' : predictionStr}</span>
                    <span className="mr-3 text-gray-700 font-black">|</span>
                </>
            )}
            
            {/* Grid Particle Counts */}
            <span className="text-gray-500 font-black tracking-normal mr-2 italic">GRID:</span>
            <div className="flex items-center gap-2">
                <span className="text-neon-red/80 font-bold">p={gridTotals.p}</span>
                <span className="text-neon-blue/80 font-bold">n={gridTotals.n}</span>
                <span className="text-yellow-400/80 font-bold">e-={gridTotals.e}</span>
                <span className="text-neon-purple/80 font-bold">e+={gridTotals.pos}</span>
            </div>

            {/* Streak Counter */}
            {activeStreakType && (
                <>
                    <span className="mx-2 text-gray-700 font-black">|</span>
                    <span className="text-neon-purple font-black tracking-normal mr-2 italic">STREAK:</span>
                    <span className={`font-bold ${activeStreakType === 'p' ? 'text-neon-red' : activeStreakType === 'n' ? 'text-neon-blue' : 'text-yellow-400'}`}>
                        {activeStreakType === 'p' ? 'p' : activeStreakType === 'n' ? 'n' : 'e-'}={activeStreakCount}
                    </span>
                </>
            )}
        </div>
    </div>
  );
};

export default GridStatusFooter;