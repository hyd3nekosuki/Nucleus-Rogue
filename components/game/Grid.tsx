// Added React import to provide access to React namespace (FC, CSSProperties)
import React, { memo } from 'react';
import { GameState, EntityType, DecayMode, Position } from '../../types';
import { OverrideValidationResult } from '../../hooks/useOverrideValidator';
import { DripLineService } from '../../engine/dripLineService';
import { TITLES } from '../../constants';
import { getSymbol } from '../../constants/atomicData';

interface GridProps {
  width: number;
  height: number;
  gameState: GameState;
  onCellClick: (x: number, y: number) => void;
  onFissionAnimationComplete?: () => void;
  finalCombo?: { count: number, id: number } | null;
  overrideResult?: OverrideValidationResult | null;
}

const Grid: React.FC<GridProps> = ({ width, height, gameState, onCellClick, onFissionAnimationComplete, finalCombo, overrideResult }) => {
  const cells = [];
  const componentStartTime = React.useRef<number>(Date.now());

  // Handle fission animation completion
  React.useEffect(() => {
    if (gameState.isAnimatingFission && gameState.pendingFission?.result.chainReactionPath) {
      const path = gameState.pendingFission.result.chainReactionPath;
      const segmentDuration = 200; // ms per segment
      const duration = Math.max(50, (path.length - 1) * segmentDuration + 800); // Dynamic duration based on path length
      
      const timer = setTimeout(() => {
        onFissionAnimationComplete?.();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [gameState.isAnimatingFission, gameState.pendingFission, onFissionAnimationComplete]);

  // Determine if Daredevil (Hard Mode) is active
  const isDaredevilActive = gameState.unlockedGroups.includes(TITLES.DEMON_CORE) && !gameState.disabledSkills.includes(TITLES.DEMON_CORE);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const isPlayer = x === gameState.playerPos.x && y === gameState.playerPos.y;
      const isTarget = gameState.targetPos && gameState.targetPos.x === x && gameState.targetPos.y === y;
      const dx = Math.abs(x - gameState.playerPos.x);
      const dy = Math.abs(y - gameState.playerPos.y);
      const isAdjacent = (dx <= 1 && dy <= 1) && !(dx === 0 && dy === 0);
      
      // Prioritize rendering ANOTHER_NUCLIDE and ANTI_NUCLIDE over other particles
      const cellEntities = gameState.gridEntities.filter(e => e.position.x === x && e.position.y === y);
      let entity = cellEntities.find(e => e.type === EntityType.ANOTHER_NUCLIDE || e.type === EntityType.ANTI_NUCLIDE) 
                || cellEntities[cellEntities.length - 1];
      
      const now = Date.now();
      const activeEffects = gameState.effects.filter(e => 
        e.position.x === x && 
        e.position.y === y && 
        // Show effect if it hasn't been played yet, OR if it was created in this specific mount session
        (!e.isPlayed || e.timestamp >= componentStartTime.current) && 
        (now - e.timestamp < 1000)
      );

      let content = null;
      let bgClass = "bg-gray-900/50";
      let borderClass = "border-gray-800";

      // Override Highlighting - Shows a yellow glow around particles required for current input
      const isConsumedByOverride = entity && overrideResult?.idsToConsume?.includes(entity.id);

      if (isPlayer) {
          const isNeutron = gameState.currentNuclide.z === 0;
          const isUnknownDecay = gameState.currentNuclide.decayModes.includes(DecayMode.UNKNOWN);
          const hue = (gameState.currentNuclide.z * 10) % 360;
          const isUnstable = !gameState.currentNuclide.isStable;
          
          let bgStyle = isNeutron ? '#ffffff' : `hsl(${hue}, 70%, 50%)`;
          let textStyle = isNeutron ? '#000000' : '#fff';
          let shadowStyle = isNeutron ? '0 0 20px #ffffff' : undefined;
          let borderStyle = undefined;

          if (isUnknownDecay) {
              bgStyle = '#000000';
              textStyle = '#a855f7'; 
              shadowStyle = '0 0 25px #000000, inset 0 0 10px #581c87';
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
                style={{ backgroundColor: bgStyle, color: textStyle, boxShadow: shadowStyle, border: borderStyle }}
              >
                 <span className="z-10 relative top-[1px]">{gameState.currentNuclide.symbol}</span>
                 <div className={`absolute top-[2px] left-[3px] text-[7px] font-mono leading-none font-normal z-20 ${isNeutron && !isUnknownDecay && !gameState.isTimeStopped ? 'text-black font-bold' : 'text-white'} drop-shadow-md opacity-90`}>{gameState.currentNuclide.a}</div>
                 <div className={`absolute bottom-[2px] left-[3px] text-[7px] font-mono leading-none font-normal z-20 ${isNeutron && !isUnknownDecay && !gameState.isTimeStopped ? 'text-black font-bold' : 'text-white'} drop-shadow-md opacity-90`}>{gameState.currentNuclide.z}</div>
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
                    <div className={`${auraClass} ${isConsumedByOverride ? 'animate-pulse' : ''}`}>
                      {entity.isHighEnergy && <div className={`absolute inset-[-6px] border-2 ${protonRingColor} rounded-full ${gameState.isTimeStopped ? '' : 'animate-pulse'} opacity-60 shadow-[0_0_10px_currentColor]`}></div>}
                      <div className={`w-3 h-3 bg-neon-red rounded-full shadow-[0_0_8px_#ff0055] ${isConsumedByOverride ? 'ring-2 ring-yellow-400 shadow-[0_0_15px_gold]' : ''}`}></div>
                    </div>
                  );
                  break;
              case EntityType.NEUTRON:
                  content = (
                    <div className={`${auraClass} ${isConsumedByOverride ? 'animate-pulse' : ''}`}>
                      {entity.isHighEnergy && <div className={`absolute inset-[-6px] border-2 ${neutronRingColor} rounded-full ${gameState.isTimeStopped ? '' : 'animate-pulse'} opacity-60 shadow-[0_0_10px_currentColor]`}></div>}
                      <div className={`w-3 h-3 bg-neon-blue rounded-full shadow-[0_0_8px_#00f3ff] ${isConsumedByOverride ? 'ring-2 ring-yellow-400 shadow-[0_0_15px_gold]' : ''}`}></div>
                    </div>
                  );
                  break;
              case EntityType.ENEMY_ELECTRON:
                  content = (
                    <div className={`${auraClass} ${isConsumedByOverride ? 'animate-pulse' : ''}`}>
                      {entity.isHighEnergy && <div className={`absolute inset-[-5px] border ${electronRingColor} rounded-full ${gameState.isTimeStopped ? '' : 'animate-[ping_1.5s_cubic-bezier(0,0,0.2,1)_infinite]'} opacity-75`}></div>}
                      <div className={`w-2 h-2 bg-yellow-400 rounded-full ${isConsumedByOverride ? 'ring-2 ring-yellow-400 shadow-[0_0_15px_gold]' : ''}`}></div>
                    </div>
                  );
                  break;
              case EntityType.ENEMY_POSITRON:
                  content = (
                    <div className={`relative flex items-center justify-center ${isConsumedByOverride ? 'animate-pulse' : ''}`}>
                        <div className={`absolute inset-[-6px] border ${positronRingColor} rounded-full ${gameState.isTimeStopped ? '' : 'animate-pulse'} opacity-50`}></div>
                        <div className={`w-2 h-2 bg-neon-purple rounded-full shadow-[0_0_10px_#bc13fe] ${isConsumedByOverride ? 'ring-2 ring-yellow-400 shadow-[0_0_15px_gold]' : ''}`}></div>
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
              case EntityType.ANOTHER_NUCLIDE:
                  const ez = entity.z || 0;
                  const ea = entity.a || 0;
                  const ehue = (ez * 10) % 360;
                  const eBgStyle = ez === 0 ? '#ffffff' : `hsl(${ehue}, 80%, 80%)`;
                  // Distinction by affiliation: Circle for Friend (Round), Soft Square for Enemy (rounded-md)
                  const shapeClass = entity.isFriendly ? 'rounded-full' : 'rounded-md';
                  content = (
                    <div 
                        className={`relative w-full h-full ${shapeClass} flex items-center justify-center text-xs font-bold border border-black/20 shadow-[0_0_12px_rgba(0,0,0,0.4)] animate-pulse transition-all duration-300`}
                        style={{ backgroundColor: eBgStyle, color: '#000000' }}
                    >
                        <span className="z-10 relative top-[1px]">{getSymbol(ez)}</span>
                        <div className="absolute top-[2px] left-[3px] text-[7px] font-mono leading-none font-normal z-20 opacity-90">{ea}</div>
                        <div className="absolute bottom-[2px] left-[3px] text-[7px] font-mono leading-none font-normal z-20 opacity-90">{ez}</div>
                        <div className={`absolute inset-[-4px] border-2 border-dashed border-black/10 ${shapeClass} ${gameState.isTimeStopped ? '' : 'animate-[spin_8s_linear_infinite]'}`}></div>
                    </div>
                  );
                  break;
          }
      }

      const isInteractable = (isPlayer || isAdjacent) && !gameState.isTimeStopped;
      if (isAdjacent && !gameState.isTimeStopped) bgClass = "bg-gray-800/30 hover:bg-gray-700/50";

      if (!isDaredevilActive && entity && !gameState.isTimeStopped) {
          let pZ = gameState.currentNuclide.z;
          let pA = gameState.currentNuclide.a;
          switch(entity.type) {
              case EntityType.PROTON: pZ++; pA++; break;
              case EntityType.NEUTRON: pA++; break;
              case EntityType.ENEMY_ELECTRON: pZ--; break;
              case EntityType.ENEMY_POSITRON: pZ++; break;
              case EntityType.ANTI_NUCLIDE: pZ = -1; pA = -1; break;
          }
          if (DripLineService.isBeyondDripLine(pZ, pA)) bgClass += " bg-danger-hatch";
      }

      if (isConsumedByOverride) {
          bgClass = "bg-yellow-400/10";
          borderClass = "border-yellow-400/50";
      }

      cells.push(
        <div key={`${x}-${y}`} className={`relative w-full aspect-square md:w-10 md:h-10 border ${borderClass} ${bgClass} flex items-center justify-center grid-cell-anim ${isInteractable ? 'cursor-pointer' : ''}`} onClick={() => onCellClick(x, y)}>
            {content}
            {isTarget && <div className="target-mark"></div>}
            {activeEffects.map(ef => {
                let typeClass = "effect-base effect-generic";
                let style: React.CSSProperties = { animationPlayState: gameState.isTimeStopped ? 'paused' : 'running' };
                switch(ef.type) {
                    case DecayMode.ALPHA: typeClass = "effect-base effect-alpha"; break;
                    case DecayMode.BETA_MINUS: typeClass = "effect-base effect-beta-minus"; break;
                    case DecayMode.BETA_PLUS: typeClass = "effect-base effect-beta-plus"; break;
                    case DecayMode.SPONTANEOUS_FISSION: typeClass = "effect-base effect-fission"; break;
                    case DecayMode.PROTON_EMISSION: typeClass = "effect-base effect-beta-plus"; break;
                    case DecayMode.TWO_PROTON_EMISSION: typeClass = "effect-base effect-2p"; break;
                    case DecayMode.NEUTRON_EMISSION: typeClass = "effect-base effect-generic"; break;
                    case DecayMode.ELECTRON_CAPTURE: typeClass = "effect-base effect-capture"; break;
                    case DecayMode.GAMMA_RAY_H: typeClass = "effect-base effect-gamma-h"; break;
                    case DecayMode.GAMMA_RAY_V: typeClass = "effect-base effect-gamma-v"; break;
                    case DecayMode.STABILIZE_ZAP: typeClass = "effect-stabilize-zap"; break;
                    case DecayMode.NUCLEOSYNTHESIS_ZAP: typeClass = "effect-nucleosynthesis-zap"; break; 
                    case DecayMode.GAMMA_RAY_DIAG_TL_BR: typeClass = "effect-base effect-gamma-h"; style = { ...style, transform: 'translate(-50%, -50%) rotate(45deg)' }; break;
                    case DecayMode.GAMMA_RAY_DIAG_TR_BL: typeClass = "effect-base effect-gamma-h"; style = { ...style, transform: 'translate(-50%, -50%) rotate(-45deg)' }; break;
                    case DecayMode.GAMMA_RAY_RIGHT: typeClass = "effect-gamma-h"; style = { ...style, position: 'absolute', top: '50%', left: '50%', transform: 'translateY(-50%)', transformOrigin: 'left' }; break;
                    case DecayMode.GAMMA_RAY_LEFT: typeClass = "effect-gamma-h"; style = { ...style, position: 'absolute', top: '50%', right: '50%', transform: 'translateY(-50%)', transformOrigin: 'right' }; break;
                    case DecayMode.GAMMA_RAY_DOWN: typeClass = "effect-gamma-v"; style = { ...style, position: 'absolute', top: '50%', left: '50%', transform: 'translateX(-50%)', transformOrigin: 'top' }; break;
                    case DecayMode.GAMMA_RAY_UP: typeClass = "effect-gamma-v"; style = { ...style, position: 'absolute', bottom: '50%', left: '50%', transform: 'translateX(-50%)', transformOrigin: 'bottom' }; break;
                }
                return <div key={ef.id} className={typeClass} style={style}></div>
            })}
        </div>
      );
    }
  }

  const renderResonanceLine = (pos: Position, id: string) => {
    const x1 = ((pos.x + 0.5) / width) * 100;
    const y1 = ((pos.y + 0.5) / height) * 100;
    const x2 = ((gameState.playerPos.x + 0.5) / width) * 100;
    const y2 = ((gameState.playerPos.y + 0.5) / height) * 100;
    return (
        <g key={`resonance-${id}`}>
            <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(250, 204, 21, 0.1)" strokeWidth="0.1" />
            <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(250, 204, 21, 0.4)" strokeWidth="0.2" strokeDasharray="0.4 0.6" className="animate-resonance-flow" />
            {[0, 1, 2].map(i => (
                <circle key={`${id}-p-${i}`} r="0.2" fill="#facc15" style={{ filter: 'blur(0.5px)' }}>
                    <animate attributeName="cx" from={x1} to={x2} dur="1s" begin={`${i * 0.33}s`} repeatCount="indefinite" />
                    <animate attributeName="cy" from={y1} to={y2} dur="1s" begin={`${i * 0.33}s`} repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0;1;0.5;0" dur="1s" begin={`${i * 0.33}s`} repeatCount="indefinite" />
                    <animate attributeName="r" values="0.1;0.3;0.1" dur="1s" begin={`${i * 0.33}s`} repeatCount="indefinite" />
                </circle>
            ))}
        </g>
    );
  };

  const renderChainReactionPath = (path: Position[], isAnimating: boolean = false, isPersistent: boolean = false) => {
    if (!path || path.length < 2) return null;
    
    const lines = [];
    const eventId = gameState.lastEvent?.id || 0;
    
    // Sequential drawing parameters
    const segmentDuration = 0.2; // Time to draw one segment
    const totalSegments = path.length - 1;
    const drawTime = totalSegments * segmentDuration;
    const holdTime = 0.6;
    const fadeTime = 0.4;
    const totalDurNum = drawTime + holdTime + fadeTime;
    const totalDur = isAnimating ? `${totalDurNum}s` : (isPersistent ? "2s" : "3s");
    
    for (let i = 0; i < path.length - 1; i++) {
        const p1 = path[i];
        const p2 = path[i+1];
        const x1 = ((p1.x + 0.5) / width) * 100;
        const y1 = ((p1.y + 0.5) / height) * 100;
        const x2 = ((p2.x + 0.5) / width) * 100;
        const y2 = ((p2.y + 0.5) / height) * 100;
        
        const delay = isAnimating ? i * segmentDuration : 0;
        
        // Calculate keyTimes for opacity to handle sequential appearance and global fade out
        const t1 = delay / totalDurNum;
        const t2 = Math.min(1, (delay + 0.05) / totalDurNum);
        const t3 = Math.max(t2, (totalDurNum - fadeTime) / totalDurNum);
        const keyTimes = isAnimating ? `0; ${t1}; ${t2}; ${t3}; 1` : "0; 0.1; 0.8; 1";
        const opacityValues = isAnimating ? "0; 0; 1; 1; 0" : (isPersistent ? "0.8; 0.8; 0.6; 0.4" : "1; 1; 0.5; 0");
        
        // Slightly jagged path for "lightning" feel without being "scribbly"
        const seed = (p1.x * 13 + p1.y * 7 + p2.x * 17 + p2.y * 19 + eventId + (isPersistent ? 100 : 0));
        const jitter = 0.4; 
        const midX = x1 + (x2 - x1) * 0.5 + Math.sin(seed) * jitter;
        const midY = y1 + (y2 - y1) * 0.5 + Math.cos(seed) * jitter;
        const pathData = `M ${x1} ${y1} L ${midX} ${midY} L ${x2} ${y2}`;
        
        lines.push(
            <g key={`chain-${isAnimating ? 'anim' : (isPersistent ? 'persist' : 'last')}-${eventId}-${i}`}>
                {/* 1. Deep Glow Layer - Provides the atmospheric energy aura */}
                <path 
                    d={pathData}
                    fill="none"
                    stroke="#0066ff" strokeWidth={isPersistent ? "1.5" : "2.0"} strokeLinecap="round"
                    style={{ opacity: 0, filter: 'blur(1.5px)' }}
                >
                    <animate attributeName="opacity" values={isAnimating ? `0;0;0.5;0.5;0` : (isPersistent ? "0.4;0.4;0.2;0.1" : "0.6;0.6;0.3;0")} keyTimes={keyTimes} dur={totalDur} begin="0s" fill="freeze" />
                </path>

                {/* 2. Plasma Beam Layer - The main colored energy path */}
                <path 
                    d={pathData}
                    fill="none"
                    stroke="#00f3ff" strokeWidth={isPersistent ? "0.6" : "0.8"} strokeLinecap="round"
                    style={{ opacity: 0, filter: 'url(#fissionGlow)' }}
                >
                    <animate attributeName="opacity" values={opacityValues} keyTimes={keyTimes} dur={totalDur} begin="0s" fill="freeze" />
                    <animate attributeName="stroke-width" values={isPersistent ? "0.6;1.0;0.6" : "0.8;1.4;0.8"} dur="0.3s" begin={`${delay}s`} repeatCount="indefinite" />
                </path>
                
                {/* 3. High-Energy Core - Sharp white center for intensity */}
                <path 
                    d={pathData}
                    fill="none"
                    stroke="#fff" strokeWidth={isPersistent ? "0.2" : "0.3"} strokeLinecap="round"
                    strokeDasharray={isAnimating ? "200 200" : (isPersistent ? "2 1" : "1 0.5")} 
                    style={{ opacity: 0, filter: 'url(#impactGlow)' }}
                >
                    <animate attributeName="opacity" values={opacityValues} keyTimes={keyTimes} dur={totalDur} begin="0s" fill="freeze" />
                    {isAnimating ? (
                        <animate attributeName="stroke-dashoffset" from="200" to="0" dur={`${segmentDuration}s`} begin={`${delay}s`} fill="freeze" />
                    ) : (
                        <animate attributeName="stroke-dashoffset" from="3" to="0" dur="0.5s" repeatCount="indefinite" />
                    )}
                </path>

                {/* Traveling Neutron Trail - Only during active animation */}
                {isAnimating && [0, 1, 2].map(j => (
                    <circle key={`neutron-${i}-${j}`} r={0.4 - j * 0.1} fill="#00f3ff" style={{ filter: 'drop-shadow(0 0 1px #fff)' }}>
                        <animate attributeName="cx" from={x1} to={x2} dur={`${segmentDuration}s`} begin={`${delay + j * 0.05}s`} fill="freeze" />
                        <animate attributeName="cy" from={y1} to={y2} dur={`${segmentDuration}s`} begin={`${delay + j * 0.05}s`} fill="freeze" />
                        <animate attributeName="opacity" values="0;1;1;0" dur={`${segmentDuration}s`} begin={`${delay + j * 0.05}s`} fill="freeze" />
                    </circle>
                ))}

                {/* Impact Node - Pulse at the fission site */}
                <circle cx={x2} cy={y2} r={isPersistent ? "1.5" : "2.5"} fill="#fff" style={{ opacity: 0, filter: 'drop-shadow(0 0 5px #00f3ff)' }}>
                    <animate attributeName="opacity" values={isPersistent ? "0;0.6;0.4" : "0;1;0"} dur="0.5s" begin={`${isAnimating ? delay + segmentDuration : 0}s`} fill="freeze" />
                    <animate attributeName="r" values={isPersistent ? "1;2;1" : "1.5;4;1.5"} dur="0.5s" begin={`${isAnimating ? delay + segmentDuration : 0}s`} fill="freeze" />
                </circle>
            </g>
        );
    }
    return lines;
  };

  return (
    <div className={`relative transition-all touch-none ${gameState.isTimeStopped ? 'grayscale-[0.4] contrast-125' : ''}`}>
        <div className="grid gap-0.5 select-none" style={{ gridTemplateColumns: `repeat(${width}, minmax(0, 1fr))` }}>{cells}</div>
        
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full pointer-events-none z-50 overflow-visible" style={{ mixBlendMode: 'screen' }}>
            <defs>
                <filter id="fissionGlow" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="0.4" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
                <filter id="impactGlow" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="0.6" result="blur" />
                    <feFlood floodColor="#fbbf24" result="color" />
                    <feComposite in="color" in2="blur" operator="in" result="glow" />
                    <feMerge>
                        <feMergeNode in="glow" />
                        <feMergeNode in="SourceGraphic" />
                    </feMerge>
                </filter>
            </defs>
            {overrideResult?.isReachable && overrideResult.idsToConsume?.map(id => {
                const ent = gameState.gridEntities.find(e => e.id === id);
                return ent ? renderResonanceLine(ent.position, id) : null;
            })}
            {gameState.isAnimatingFission && gameState.pendingFission?.result.chainReactionPath && renderChainReactionPath(gameState.pendingFission.result.chainReactionPath, true)}
            {gameState.lastEvent?.chainReactionPath && renderChainReactionPath(gameState.lastEvent.chainReactionPath)}
            {gameState.persistentPath && renderChainReactionPath(gameState.persistentPath, false, true)}
        </svg>
        
        {finalCombo && !gameState.isTimeStopped && (
            <div key={finalCombo.id} className="anim-combo-small absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-50 text-center whitespace-nowrap">
                <div className="text-3xl md:text-4xl font-black italic drop-shadow-lg tracking-tighter text-gray-200">CHAIN x{finalCombo.count}</div>
                <div className="text-white font-bold tracking-widest text-xs md:text-sm mt-1 uppercase opacity-80">Chain Complete</div>
            </div>
        )}
    </div>
  );
};

export default memo(Grid, (prevProps, nextProps) => {
  const p = prevProps.gameState;
  const n = nextProps.gameState;

  return (
    prevProps.width === nextProps.width &&
    prevProps.height === nextProps.height &&
    prevProps.onCellClick === nextProps.onCellClick &&
    prevProps.finalCombo === nextProps.finalCombo &&
    prevProps.overrideResult === nextProps.overrideResult &&
    p.playerPos.x === n.playerPos.x &&
    p.playerPos.y === n.playerPos.y &&
    p.targetPos?.x === n.targetPos?.x &&
    p.targetPos?.y === n.targetPos?.y &&
    p.gridEntities === n.gridEntities &&
    p.effects === n.effects &&
    p.currentNuclide === n.currentNuclide &&
    p.isTimeStopped === n.isTimeStopped &&
    p.magicBarrierCharges === n.magicBarrierCharges &&
    p.unlockedGroups === n.unlockedGroups &&
    p.disabledSkills === n.disabledSkills &&
    p.isAnimatingFission === n.isAnimatingFission &&
    p.pendingFission === n.pendingFission &&
    p.lastEvent === n.lastEvent &&
    p.persistentPath === n.persistentPath
  );
});