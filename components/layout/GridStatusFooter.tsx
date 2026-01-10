import React, { useState } from 'react';
import { GameState, EntityType } from '../../types';
import { getNuclideDataSync } from '../../services/nuclideService';
import { getSymbol } from '../../constants';
import { calculateReincarnationTargets } from '../../engine/particleEngine';

interface Props {
  gameState: GameState;
}

const GridStatusFooter: React.FC<Props> = ({ gameState }) => {
  const [showStats, setShowStats] = useState(false);

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

  const pool = gameState.reincarnationPool;

  // 4. Calculate Reincarnation Target for Display
  const isDaredevilActive = gameState.unlockedGroups.includes("Daredevil") && !gameState.disabledSkills.includes("Daredevil");
  const reincResult = calculateReincarnationTargets(
    gameState.currentNuclide,
    gameState.reincarnationPool,
    gameState.evolutionHistory,
    isDaredevilActive
  );

  const toggleDisplay = () => setShowStats(!showStats);

  return (
    <div 
      onClick={toggleDisplay}
      className="mt-1 relative h-7 w-full flex items-center justify-center cursor-pointer select-none overflow-hidden"
    >
        {/* State A: Legend / Default View */}
        <div className={`absolute inset-0 flex flex-wrap justify-center items-center gap-x-8 gap-y-1 transition-all duration-300 ${showStats ? 'opacity-0 -translate-y-2 pointer-events-none' : 'opacity-100 translate-y-0'}`}>
            <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-neon-red rounded-full shadow-[0_0_8px_#ff0055]"></div>
                <span className="text-white font-mono text-[10px] font-light">p: (Z+1, A+1)</span>
            </div>
            <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-neon-blue rounded-full shadow-[0_0_8px_#00f3ff]"></div>
                <span className="text-white font-mono text-[10px] font-light">n: (Z, A+1)</span>
            </div>
            <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-yellow-400 rounded-full shadow-[0_0_5px_#facc15]"></div>
                <span className="text-white font-mono text-[10px] font-light">e-: (Z-1, A)</span>
            </div>
        </div>

        {/* State B: Dynamic Statistics Overlay (Hidden Parameters) */}
        <div className={`absolute inset-0 flex items-center justify-center transition-all duration-300 whitespace-nowrap px-1 text-[11px] md:text-xs font-mono ${!showStats ? 'opacity-0 translate-y-2 pointer-events-none' : 'opacity-100 translate-y-0'}`}>
            {/* Predictive Analysis (Level 6+) */}
            {gameState.playerLevel >= 6 && (
                <>
                    <span className={`font-black mr-3 ${predictionStr === 'Fail' ? 'text-neon-red' : 'text-neon-green'} drop-shadow-[0_0_5px_currentColor]`}>→{predictionStr === 'Fail' ? 'fail' : predictionStr}</span>
                    <span className="mr-3 text-gray-700 font-black">|</span>
                </>
            )}

            {/* Grid Particle Counts */}
            <span className="text-gray-500 font-black tracking-normal mr-0.5 italic">grid:</span>
            <div className="flex items-center gap-1.5 mr-1">
                <span className="text-neon-red font-bold">{gridTotals.p}</span>
                <span className="text-neon-blue font-bold">{gridTotals.n}</span>
                <span className="text-yellow-400 font-bold">{gridTotals.e}</span>
                <span className="text-neon-purple font-bold">{gridTotals.pos}</span>
            </div>

            <span className="mr-4 text-gray-700 font-black">|</span>

            {/* Reincarnation Pool */}
            <span className="text-gray-500 font-black tracking-normal mr-0.5 italic">pool:</span>
            <div className="flex items-center gap-1.5 mr-1">
                <span className="text-neon-red font-bold">{pool.p}</span>
                <span className="text-neon-blue font-bold">{pool.n}</span>
                <span className="text-yellow-400 font-bold">{pool.e}</span>
                {reincResult && (
                  <span 
                    className={`ml-2 text-[10px] font-bold animate-pulse ${isDaredevilActive ? 'text-neon-red drop-shadow-[0_0_5px_#ff0055]' : 'text-neon-green drop-shadow-[0_0_5px_#00ff9d]'}`}
                    title={`Reincarnation Target: ${reincResult.nuclide.name}`}
                  >
                    ♻️ {reincResult.nuclide.symbol}{reincResult.nuclide.a}
                  </span>
                )}
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