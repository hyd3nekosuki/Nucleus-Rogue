// Added React import to provide access to React namespace (FC, CSSProperties)
import React, { memo, useMemo, useRef } from 'react';
import { GameState, EntityType, Position } from '../../types';
import { OverrideValidationResult } from '../../hooks/useOverrideValidator';
import { TITLES } from '../../constants';
import Cell from './Cell';

interface GridProps {
  width: number;
  height: number;
  gameState: GameState;
  onCellClick: (x: number, y: number) => void;
  finalCombo?: { count: number, id: number } | null;
  overrideResult?: OverrideValidationResult | null;
}

const Grid: React.FC<GridProps> = ({ width, height, gameState, onCellClick, finalCombo, overrideResult }) => {
  const componentStartTime = useRef<number>(Date.now());

  // Determine if Daredevil (Hard Mode) is active
  const isDaredevilActive = useMemo(() => 
    gameState.unlockedGroups.includes(TITLES.DEMON_CORE) && !gameState.disabledSkills.includes(TITLES.DEMON_CORE),
    [gameState.unlockedGroups, gameState.disabledSkills]
  );

  const now = Date.now();

  const cells = useMemo(() => {
    const cellElements = [];
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const key = `${x},${y}`;
        const isPlayer = x === gameState.playerPos.x && y === gameState.playerPos.y;
        const isTarget = gameState.targetPos && gameState.targetPos.x === x && gameState.targetPos.y === y;
        const dx = Math.abs(x - gameState.playerPos.x);
        const dy = Math.abs(y - gameState.playerPos.y);
        const isAdjacent = (dx <= 1 && dy <= 1) && !(dx === 0 && dy === 0);
        
        const cellEntities = gameState.spatialIndex?.entities[key] || [];
        let entity = cellEntities.find(e => e.type === EntityType.ANOTHER_NUCLIDE || e.type === EntityType.ANTI_NUCLIDE) 
                  || cellEntities[cellEntities.length - 1];
        
        const activeEffects = (gameState.spatialIndex?.effects[key] || []).filter(e => 
          (!e.isPlayed || e.timestamp >= componentStartTime.current) && 
          (now - e.timestamp < 1000)
        );

        const isConsumedByOverride = entity && overrideResult?.idsToConsume?.includes(entity.id);

        cellElements.push(
          <Cell 
            key={key}
            x={x} y={y}
            isPlayer={isPlayer}
            isTarget={!!isTarget}
            isAdjacent={isAdjacent}
            entity={entity}
            activeEffects={activeEffects}
            isTimeStopped={gameState.isTimeStopped}
            isDaredevilActive={isDaredevilActive}
            isConsumedByOverride={!!isConsumedByOverride}
            currentNuclide={gameState.currentNuclide}
            magicBarrierCharges={gameState.magicBarrierCharges}
            onCellClick={onCellClick}
          />
        );
      }
    }
    return cellElements;
  }, [
    width, height, gameState.playerPos, gameState.targetPos, 
    gameState.spatialIndex, gameState.isTimeStopped, gameState.currentNuclide, 
    gameState.magicBarrierCharges, isDaredevilActive, overrideResult, onCellClick, now
  ]);

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
    <div className={`relative transition-all touch-none w-full aspect-square ${gameState.isTimeStopped ? 'grayscale-[0.4] contrast-125' : ''}`}>
        <div className="grid gap-0.5 select-none w-full h-full" style={{ gridTemplateColumns: `repeat(${width}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${height}, minmax(0, 1fr))` }}>{cells}</div>
        
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
                const ent = gameState.spatialIndex?.entitiesById[id];
                return ent ? renderResonanceLine(ent.position, id) : null;
            })}
            {gameState.lastEvent?.chainReactionPath && !gameState.gameOver && renderChainReactionPath(gameState.lastEvent.chainReactionPath)}
            {gameState.persistentPath && !gameState.gameOver && renderChainReactionPath(gameState.persistentPath, false, true)}
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
    p.lastEvent === n.lastEvent &&
    p.persistentPath === n.persistentPath
  );
});