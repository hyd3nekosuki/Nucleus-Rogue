// Added React import to provide access to React namespace (FC, CSSProperties)
import React from 'react';
import { GameState, EntityType, DecayMode } from '../../types';
import { CheatValidationResult } from '../../hooks/useCheatEngine';
import { DripLineService } from '../../engine/dripLineService';
import { TITLES } from '../../constants';

interface GridProps {
  width: number;
  height: number;
  gameState: GameState;
  onCellClick: (x: number, y: number) => void;
  finalCombo?: { count: number, id: number } | null;
  cheatResult?: CheatValidationResult | null;
}

const Grid: React.FC<GridProps> = ({ width, height, gameState, onCellClick, finalCombo, cheatResult }) => {
  const cells = [];

  // Determine if Daredevil (Hard Mode) is active
  const isDaredevilActive = gameState.unlockedGroups.includes(TITLES.DAREDEVIL) && !gameState.disabledSkills.includes(TITLES.DAREDEVIL);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const isPlayer = x === gameState.playerPos.x && y === gameState.playerPos.y;
      const isTarget = gameState.targetPos && gameState.targetPos.x === x && gameState.targetPos.y === y;
      const dx = Math.abs(x - gameState.playerPos.x);
      const dy = Math.abs(y - gameState.playerPos.y);
      // Support diagonal adjacency: dx <= 1 AND dy <= 1
      const isAdjacent = (dx <= 1 && dy <= 1) && !(dx === 0 && dy === 0);
      
      // FIX: Replaced findLast with a manual loop for backwards compatibility
      // Use logic equivalent to findLast to show the entity that was added most recently (rendered on top logic)
      let entity = undefined;
      for (let i = gameState.gridEntities.length - 1; i >= 0; i--) {
        const e = gameState.gridEntities[i];
        if (e.position.x === x && e.position.y === y) {
          entity = e;
          break;
        }
      }
      
      // Check for effects on this specific cell
      const activeEffects = gameState.effects.filter(e => e.position.x === x && e.position.y === y);

      let content = null;
      let bgClass = "bg-gray-900/50";
      let borderClass = "border-gray-800";

      // Cheat Highlighting (Step 4)
      const isConsumedByCheat = entity && cheatResult?.idsToConsume?.includes(entity.id);

      if (isPlayer) {
          // Player visual depends on Z (Color shift)
          const isNeutron = gameState.currentNuclide.z === 0;
          const isUnknownDecay = gameState.currentNuclide.decayModes.includes(DecayMode.UNKNOWN);
          
          const hue = (gameState.currentNuclide.z * 10) % 360;
          const isUnstable = !gameState.currentNuclide.isStable;
          
          // Style determination
          let bgStyle = isNeutron ? '#ffffff' : `hsl(${hue}, 70%, 50%)`;
          let textStyle = isNeutron ? '#000000' : '#fff';
          let shadowStyle = isNeutron ? '0 0 20px #ffffff' : undefined;
          let borderStyle = undefined;

          if (isUnknownDecay) {
              bgStyle = '#000000';
              textStyle = '#a855f7'; // Neon purple text
              shadowStyle = '0 0 25px #000000, inset 0 0 10px #581c87'; // Deep black shadow + purple inset
              borderStyle = '1px solid #581c87';
          }

          if (gameState.isTimeStopped) {
              bgStyle = '#fff';
              textStyle = '#00f3ff';
              shadowStyle = '0 0 30px #00f3ff';
          }

          content = (
              <div 
                className={`relative w-full h-full rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${isUnstable && !gameState.isTimeStopped ? 'animate-pulse' : ''} ${!isNeutron && !isUnknownDecay && !gameState.isTimeStopped ? 'shadow-[0_0_15px_rgba(0,255,157,0.5)]' : ''}`}
                style={{
                    backgroundColor: bgStyle,
                    color: textStyle,
                    boxShadow: shadowStyle,
                    border: borderStyle
                }}
              >
                 <span className="z-10 relative top-[1px]">{gameState.currentNuclide.symbol}</span>
                 
                 {/* Mass Number (A) - Top Left */}
                 <div className={`absolute top-[2px] left-[3px] text-[7px] font-mono leading-none font-normal z-20 ${isNeutron && !isUnknownDecay && !gameState.isTimeStopped ? 'text-black font-bold' : 'text-white'} drop-shadow-md opacity-90`}>
                    {gameState.currentNuclide.a}
                 </div>
                 
                 {/* Atomic Number (Z) - Bottom Left */}
                 <div className={`absolute bottom-[2px] left-[3px] text-[7px] font-mono leading-none font-normal z-20 ${isNeutron && !isUnknownDecay && !gameState.isTimeStopped ? 'text-black font-bold' : 'text-white'} drop-shadow-md opacity-90`}>
                    {gameState.currentNuclide.z}
                 </div>
                 
                 {/* Orbitals ring visual effect - CONDITIONED ON BARRIER */}
                 {(gameState.magicBarrierCharges > 0 || isNeutron || isUnknownDecay) && (
                    <div className={`absolute inset-[-4px] border ${isNeutron && !isUnknownDecay ? 'border-gray-400' : (isUnknownDecay ? 'border-purple-500/50' : 'border-white/30')} rounded-full ${gameState.isTimeStopped ? '' : 'animate-[spin_4s_linear_infinite]'}`}></div>
                 )}
              </div>
          );
      } else if (entity) {
          const auraClass = entity.isHighEnergy ? "relative flex items-center justify-center" : "";
          const protonRingColor = "border-neon-red";
          const neutronRingColor = "border-neon-blue";
          const electronRingColor = "border-yellow-400";
          const positronRingColor = "border-neon-purple";
          
          switch(entity.type) {
              case EntityType.PROTON:
                  content = (
                    <div className={`${auraClass} ${isConsumedByCheat ? 'animate-pulse' : ''}`}>
                      {entity.isHighEnergy && (
                        <div className={`absolute inset-[-6px] border-2 ${protonRingColor} rounded-full ${gameState.isTimeStopped ? '' : 'animate-pulse'} opacity-60 shadow-[0_0_10px_currentColor]`}></div>
                      )}
                      <div className={`w-3 h-3 bg-neon-red rounded-full shadow-[0_0_8px_#ff0055] ${isConsumedByCheat ? 'ring-2 ring-yellow-400 shadow-[0_0_15px_gold]' : ''}`}></div>
                    </div>
                  );
                  break;
              case EntityType.NEUTRON:
                  content = (
                    <div className={`${auraClass} ${isConsumedByCheat ? 'animate-pulse' : ''}`}>
                      {entity.isHighEnergy && (
                        <div className={`absolute inset-[-6px] border-2 ${neutronRingColor} rounded-full ${gameState.isTimeStopped ? '' : 'animate-pulse'} opacity-60 shadow-[0_0_10px_currentColor]`}></div>
                      )}
                      <div className={`w-3 h-3 bg-neon-blue rounded-full shadow-[0_0_8px_#00f3ff] ${isConsumedByCheat ? 'ring-2 ring-yellow-400 shadow-[0_0_15px_gold]' : ''}`}></div>
                    </div>
                  );
                  break;
              case EntityType.ENEMY_ELECTRON:
                  content = (
                    <div className={`${auraClass} ${isConsumedByCheat ? 'animate-pulse' : ''}`}>
                      {entity.isHighEnergy && (
                        <div className={`absolute inset-[-5px] border ${electronRingColor} rounded-full ${gameState.isTimeStopped ? '' : 'animate-[ping_1.5s_cubic-bezier(0,0,0.2,1)_infinite]'} opacity-75`}></div>
                      )}
                      <div className={`w-2 h-2 bg-yellow-400 rounded-full ${isConsumedByCheat ? 'ring-2 ring-yellow-400 shadow-[0_0_15px_gold]' : ''}`}></div>
                    </div>
                  );
                  break;
              case EntityType.ENEMY_POSITRON:
                  content = (
                    <div className={`relative flex items-center justify-center ${isConsumedByCheat ? 'animate-pulse' : ''}`}>
                        <div className={`absolute inset-[-6px] border ${positronRingColor} rounded-full ${gameState.isTimeStopped ? '' : 'animate-pulse'} opacity-50`}></div>
                        <div className={`w-2 h-2 bg-neon-purple rounded-full shadow-[0_0_10px_#bc13fe] ${isConsumedByCheat ? 'ring-2 ring-yellow-400 shadow-[0_0_15px_gold]' : ''}`}></div>
                    </div>
                  );
                  break;
              case EntityType.ANTI_NUCLIDE:
                  content = (
                    <div className="relative w-full h-full rounded-full flex items-center justify-center bg-black shadow-[inset_0_0_10px_#bc13fe,0_0_15px_black] border border-neon-purple/30 animate-pulse">
                        <div className="absolute inset-[-2px] border border-black rounded-full animate-ping opacity-20"></div>
                        <div className="text-[10px] text-neon-purple font-black">X</div>
                    </div>
                  );
                  break;
          }
      }

      // Visual helper for movement
      const isInteractable = (isPlayer || isAdjacent) && !gameState.isTimeStopped;
      if (isAdjacent && !gameState.isTimeStopped) {
          bgClass = "bg-gray-800/30 hover:bg-gray-700/50";
      }

      // 1. Grid Drip Line Danger Sensing (Normal Mode only)
      // Visual feedback: Highlight cells that lead to non-existence
      // REVISION: Adjacency requirement removed to scan entire board.
      if (!isDaredevilActive && entity && !gameState.isTimeStopped) {
          let pZ = gameState.currentNuclide.z;
          let pA = gameState.currentNuclide.a;
          
          switch(entity.type) {
              case EntityType.PROTON: pZ++; pA++; break;
              case EntityType.NEUTRON: pA++; break;
              case EntityType.ENEMY_ELECTRON: pZ--; break;
              case EntityType.ENEMY_POSITRON: pZ++; break;
              case EntityType.ANTI_NUCLIDE: pZ = -1; pA = -1; break; // Immediate danger
          }
          
          if (DripLineService.isBeyondDripLine(pZ, pA)) {
              bgClass += " bg-danger-hatch";
          }
      }

      // Highlight cell if consumed by cheat
      if (isConsumedByCheat) {
          bgClass = "bg-yellow-400/10";
          borderClass = "border-yellow-400/50";
      }

      cells.push(
        <div 
            key={`${x}-${y}`} 
            className={`relative w-full aspect-square md:w-10 md:h-10 border ${borderClass} ${bgClass} flex items-center justify-center grid-cell-anim ${isInteractable ? 'cursor-pointer' : ''}`}
            onClick={() => onCellClick(x, y)}
            title={isPlayer ? "Click to Decay (if unstable)" : (isAdjacent ? "Click to Move" : undefined)}
        >
            {content}
            {isTarget && <div className="target-mark"></div>}
            
            {/* Render Effects */}
            {!gameState.isTimeStopped && activeEffects.map(ef => {
                let typeClass = "effect-base effect-generic";
                let style: React.CSSProperties = {};

                switch(ef.type) {
                    case DecayMode.ALPHA: typeClass = "effect-base effect-alpha"; break;
                    case DecayMode.BETA_MINUS: typeClass = "effect-base effect-beta-minus"; break;
                    case DecayMode.BETA_PLUS: typeClass = "effect-base effect-beta-plus"; break;
                    case DecayMode.SPONTANEOUS_FISSION: typeClass = "effect-base effect-fission"; break;
                    case DecayMode.PROTON_EMISSION: typeClass = "effect-base effect-beta-plus"; break;
                    case DecayMode.NEUTRON_EMISSION: typeClass = "effect-base effect-generic"; break;
                    case DecayMode.ELECTRON_CAPTURE: typeClass = "effect-base effect-capture"; break;
                    case DecayMode.GAMMA_RAY_H: typeClass = "effect-base effect-gamma-h"; break;
                    case DecayMode.GAMMA_RAY_V: typeClass = "effect-base effect-gamma-v"; break;
                    case DecayMode.STABILIZE_ZAP: typeClass = "effect-stabilize-zap"; break;
                    case DecayMode.NUCLEOSYNTHESIS_ZAP: typeClass = "effect-nucleosynthesis-zap"; break; 
                    
                    // Diagonal Lasers
                    case DecayMode.GAMMA_RAY_DIAG_TL_BR: 
                        typeClass = "effect-base effect-gamma-h"; 
                        style = { transform: 'translate(-50%, -50%) rotate(45deg)' }; 
                        break;
                    case DecayMode.GAMMA_RAY_DIAG_TR_BL: 
                        typeClass = "effect-base effect-gamma-h"; 
                        style = { transform: 'translate(-50%, -50%) rotate(-45deg)' }; 
                        break;
                        
                    // Uni-directional Lasers
                    case DecayMode.GAMMA_RAY_RIGHT: 
                        typeClass = "effect-gamma-h"; 
                        style = { position: 'absolute', top: '50%', left: '50%', transform: 'translateY(-50%)', transformOrigin: 'left' };
                        break;
                    case DecayMode.GAMMA_RAY_LEFT: 
                        typeClass = "effect-gamma-h";
                        style = { position: 'absolute', top: '50%', right: '50%', transform: 'translateY(-50%)', transformOrigin: 'right' };
                        break;
                    case DecayMode.GAMMA_RAY_DOWN: 
                        typeClass = "effect-gamma-v";
                        style = { position: 'absolute', top: '50%', left: '50%', transform: 'translateX(-50%)', transformOrigin: 'top' };
                        break;
                    case DecayMode.GAMMA_RAY_UP: 
                        typeClass = "effect-gamma-v";
                        style = { position: 'absolute', bottom: '50%', left: '50%', transform: 'translateX(-50%)', transformOrigin: 'bottom' };
                        break;
                }
                return <div key={ef.id} className={typeClass} style={style}></div>
            })}
        </div>
      );
    }
  }

  // Define Combo Visual Properties based on Count
  let comboClass = "anim-combo-small";
  let comboTextColor = "text-gray-200";
  let comboTextSize = "text-3xl md:text-4xl";
  let comboShadow = "0 0 10px rgba(255,255,255,0.5)";
  let comboLabel = "Chain Complete";
  let isRainbow = false;

  if (finalCombo) {
      if (finalCombo.count >= 20) {
          comboClass = "anim-combo-extreme";
          comboTextColor = "text-rainbow-anim"; 
          comboTextSize = "text-6xl md:text-8xl";
          comboShadow = "0 0 40px rgba(255,255,255,0.6)";
          comboLabel = "GODLIKE CHAIN!";
          isRainbow = true;
      } else if (finalCombo.count >= 10) {
          comboClass = "anim-combo-large";
          comboTextColor = "text-yellow-400"; 
          comboTextSize = "text-5xl md:text-7xl";
          comboShadow = "0 0 30px rgba(250, 204, 21, 0.8)";
          comboLabel = "LEGENDARY CHAIN!";
      } else if (finalCombo.count >= 5) {
          comboClass = "anim-combo-medium";
          comboTextColor = "text-neon-blue"; 
          comboTextSize = "text-4xl md:text-6xl";
          comboShadow = "0 0 20px #00f3ff";
          comboLabel = "HYPER CHAIN!";
      }
  }

  return (
    <div className={`relative transition-all touch-none ${gameState.isTimeStopped ? 'grayscale-[0.4] contrast-125' : ''}`}>
        <div 
            className="grid gap-0.5 select-none" 
            style={{ gridTemplateColumns: `repeat(${width}, minmax(0, 1fr))` }}
        >
        {cells}
        </div>

        {/* Quantum Resonance Lines for Transmutation Cheat (Step 4 UI Enhancement) */}
        {cheatResult?.isReachable && cheatResult.idsToConsume && (
            <svg className="absolute inset-0 w-full h-full pointer-events-none z-40 overflow-visible" style={{ mixBlendMode: 'screen' }}>
                <defs>
                    <linearGradient id="resonanceGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="rgba(250, 204, 21, 0)" />
                        <stop offset="50%" stopColor="rgba(250, 204, 21, 0.5)" />
                        <stop offset="100%" stopColor="rgba(250, 204, 21, 0)" />
                    </linearGradient>
                </defs>
                {cheatResult.idsToConsume.map(id => {
                    const ent = gameState.gridEntities.find(e => e.id === id);
                    if (!ent) return null;
                    
                    // Calculate relative centers (percentages for simplicity in CSS grid)
                    const x1 = ((ent.position.x + 0.5) / width) * 100;
                    const y1 = ((ent.position.y + 0.5) / height) * 100;
                    const x2 = ((gameState.playerPos.x + 0.5) / width) * 100;
                    const y2 = ((gameState.playerPos.y + 0.5) / height) * 100;

                    return (
                        <g key={`resonance-${id}`}>
                            {/* Static Background Connection Line */}
                            <line 
                                x1={`${x1}%`} y1={`${y1}%`} x2={`${x2}%`} y2={`${y2}%`} 
                                stroke="rgba(250, 204, 21, 0.1)" 
                                strokeWidth="1" 
                            />
                            {/* Flowing Dash Line towards Player */}
                            <line 
                                x1={`${x1}%`} y1={`${y1}%`} x2={`${x2}%`} y2={`${y2}%`} 
                                stroke="rgba(250, 204, 21, 0.4)" 
                                strokeWidth="2" 
                                strokeDasharray="4 6"
                                className="animate-resonance-flow"
                            />
                            {/* Staggered Suction Particles (3 dots per line) */}
                            {[0, 1, 2].map(i => (
                                <circle key={`${id}-p-${i}`} r="2" fill="#facc15" style={{ filter: 'blur(0.5px)' }}>
                                    <animate 
                                        attributeName="cx" from={`${x1}%`} to={`${x2}%`} 
                                        dur="1s" begin={`${i * 0.33}s`} repeatCount="indefinite" 
                                    />
                                    <animate 
                                        attributeName="cy" from={`${y1}%`} to={`${y2}%`} 
                                        dur="1s" begin={`${i * 0.33}s`} repeatCount="indefinite" 
                                    />
                                    <animate 
                                        attributeName="opacity" values="0;1;0.5;0" 
                                        dur="1s" begin={`${i * 0.33}s`} repeatCount="indefinite" 
                                    />
                                    <animate 
                                        attributeName="r" values="1;3;1" 
                                        dur="1s" begin={`${i * 0.33}s`} repeatCount="indefinite" 
                                    />
                                </circle>
                            ))}
                        </g>
                    );
                })}
            </svg>
        )}
        
        {/* FINAL COMBO POPUP OVERLAY */}
        {finalCombo && !gameState.isTimeStopped && (
            <div key={finalCombo.id} className={`${comboClass} absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-50 text-center whitespace-nowrap`}>
                <div 
                    className={`${comboTextSize} font-black italic drop-shadow-lg tracking-tighter ${isRainbow ? 'text-rainbow-anim' : ''}`} 
                    style={{ 
                        color: isRainbow ? 'transparent' : (comboTextColor === 'text-yellow-400' ? '#facc15' : (comboTextColor === 'text-neon-blue' ? '#00f3ff' : '#e5e7eb')), 
                        textShadow: comboShadow 
                    }}
                >
                    CHAIN x{finalCombo.count}
                </div>
                <div className="text-white font-bold tracking-widest text-xs md:text-sm mt-1 uppercase opacity-80">
                    {comboLabel}
                </div>
            </div>
        )}
    </div>
  );
};

export default Grid;