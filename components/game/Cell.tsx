import React, { memo } from 'react';
import { EntityType, DecayMode, GridEntity, VisualEffect, NuclideData } from '../../types';
import { DripLineService } from '../../engine/dripLineService';
import { TITLES } from '../../constants';
import { getSymbol } from '../../constants/atomicData';
import { isPositron, isElectron, isNeutron } from '../../utils/particleUtils';

interface CellProps {
  x: number;
  y: number;
  isPlayer: boolean;
  isTarget: boolean;
  isAdjacent: boolean;
  entity: GridEntity | undefined;
  activeEffects: VisualEffect[];
  isTimeStopped: boolean;
  isDaredevilActive: boolean;
  isConsumedByOverride: boolean;
  currentNuclide: NuclideData; 
  magicBarrierCharges: number;
  onCellClick: (x: number, y: number) => void;
}

const Cell: React.FC<CellProps> = ({
  x, y, isPlayer, isTarget, isAdjacent, entity, activeEffects,
  isTimeStopped, isDaredevilActive, isConsumedByOverride,
  currentNuclide, magicBarrierCharges, onCellClick
}) => {
  let content = null;
  let bgClass = "bg-gray-900/50";
  let borderClass = "border-gray-800";

  if (isPlayer) {
      const isNeutronPlayer = isNeutron(currentNuclide);
      const isElectronPlayer = isElectron(currentNuclide);
      const isPositronPlayer = isPositron(currentNuclide);
      const isUnknownDecay = currentNuclide.decayModes.includes(DecayMode.UNKNOWN);
      const hue = (currentNuclide.z * 10) % 360;
      const isUnstable = !currentNuclide.isStable;
      
      let bgStyle = isNeutronPlayer ? '#ffffff' : (isElectronPlayer ? '#facc15' : (isPositronPlayer ? '#bc13fe' : `hsl(${hue}, 70%, 50%)`));
      let textStyle = (isNeutronPlayer || isElectronPlayer || isPositronPlayer) ? '#000000' : '#fff';
      let shadowStyle = isNeutronPlayer ? '0 0 20px #ffffff' : (isElectronPlayer ? '0 0 20px #facc15' : (isPositronPlayer ? '0 0 20px #bc13fe' : undefined));
      let borderStyle = undefined;

      if (isUnknownDecay) {
          bgStyle = '#000000';
          textStyle = '#a855f7'; 
          shadowStyle = '0 0 25px #000000, inset 0 0 10px #581c87';
          borderStyle = '1px solid #581c87';
      }

      if (isTimeStopped) {
          bgStyle = '#fff';
          textStyle = '#00f3ff';
          shadowStyle = '0 0 30px #00f3ff';
      }

      content = (
          <div 
            className={`relative w-full h-full rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${isUnstable && !isTimeStopped ? 'animate-pulse' : ''} ${!isNeutronPlayer && !isElectronPlayer && !isUnknownDecay && !isTimeStopped ? 'shadow-[0_0_15px_rgba(0,255,157,0.5)]' : ''}`}
            style={{ backgroundColor: bgStyle, color: textStyle, boxShadow: shadowStyle, border: borderStyle }}
          >
             <span className="z-10 relative top-[1px]">{currentNuclide.symbol}</span>
             {!(isElectronPlayer || isPositronPlayer) && (
               <>
                 <div className={`absolute top-[2px] left-[3px] text-[7px] font-mono leading-none font-normal z-20 ${(isNeutronPlayer || isElectronPlayer) && !isUnknownDecay && !isTimeStopped ? 'text-black font-bold' : 'text-white'} drop-shadow-md opacity-90`}>{currentNuclide.a}</div>
                 <div className={`absolute bottom-[2px] left-[3px] text-[7px] font-mono leading-none font-normal z-20 ${(isNeutronPlayer || isElectronPlayer) && !isUnknownDecay && !isTimeStopped ? 'text-black font-bold' : 'text-white'} drop-shadow-md opacity-90`}>{currentNuclide.z}</div>
               </>
             )}
             {(magicBarrierCharges > 0 || isNeutronPlayer || isElectronPlayer || isUnknownDecay) && (
                <div className={`absolute inset-[-4px] border ${isNeutronPlayer && !isUnknownDecay ? 'border-gray-400' : (isElectronPlayer ? 'border-yellow-400/50' : (isUnknownDecay ? 'border-purple-500/50' : 'border-white/30'))} rounded-full ${isTimeStopped ? '' : 'animate-[spin_4s_linear_infinite]'}`}></div>
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
                  {entity.isHighEnergy && <div className={`absolute inset-[-6px] border-2 ${protonRingColor} rounded-full ${isTimeStopped ? '' : 'animate-pulse'} opacity-60 shadow-[0_0_10px_currentColor]`}></div>}
                  <div className={`w-3 h-3 bg-neon-red rounded-full shadow-[0_0_8px_#ff0055] ${isConsumedByOverride ? 'ring-2 ring-yellow-400 shadow-[0_0_15px_gold]' : ''}`}></div>
                </div>
              );
              break;
          case EntityType.NEUTRON:
              content = (
                <div className={`${auraClass} ${isConsumedByOverride ? 'animate-pulse' : ''}`}>
                  {entity.isHighEnergy && <div className={`absolute inset-[-6px] border-2 ${neutronRingColor} rounded-full ${isTimeStopped ? '' : 'animate-pulse'} opacity-60 shadow-[0_0_10px_currentColor]`}></div>}
                  <div className={`w-3 h-3 bg-neon-blue rounded-full shadow-[0_0_8px_#00f3ff] ${isConsumedByOverride ? 'ring-2 ring-yellow-400 shadow-[0_0_15px_gold]' : ''}`}></div>
                </div>
              );
              break;
          case EntityType.ENEMY_ELECTRON:
              content = (
                <div className={`${auraClass} ${isConsumedByOverride ? 'animate-pulse' : ''}`}>
                  {entity.isHighEnergy && <div className={`absolute inset-[-5px] border ${electronRingColor} rounded-full ${isTimeStopped ? '' : 'animate-[ping_1.5s_cubic-bezier(0,0,0.2,1)_infinite]'} opacity-75`}></div>}
                  <div className={`w-2 h-2 bg-yellow-400 rounded-full ${isConsumedByOverride ? 'ring-2 ring-yellow-400 shadow-[0_0_15px_gold]' : ''}`}></div>
                </div>
              );
              break;
          case EntityType.ENEMY_POSITRON:
              content = (
                <div className={`relative flex items-center justify-center ${isConsumedByOverride ? 'animate-pulse' : ''}`}>
                    <div className={`absolute inset-[-6px] border ${positronRingColor} rounded-full ${isTimeStopped ? '' : 'animate-pulse'} opacity-50`}></div>
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
              const isPositronEntity = isPositron({ z: ez, a: ea });
              const ehue = (ez * 10) % 360;
              const eBgStyle = ez === 0 ? '#ffffff' : (isPositronEntity ? '#bc13fe' : `hsl(${ehue}, 80%, 80%)`);
              const shapeClass = entity.isFriendly ? 'rounded-full' : 'rounded-md';
              content = (
                <div 
                    className={`relative w-full h-full ${shapeClass} flex items-center justify-center text-xs font-bold border border-black/20 shadow-[0_0_12px_rgba(0,0,0,0.4)] animate-pulse transition-all duration-300`}
                    style={{ backgroundColor: eBgStyle, color: '#000000' }}
                >
                    <span className="z-10 relative top-[1px]">{isPositronEntity ? "e+" : getSymbol(ez)}</span>
                    <div className="absolute top-[2px] left-[3px] text-[7px] font-mono leading-none font-normal z-20 opacity-90">{ea}</div>
                    <div className="absolute bottom-[2px] left-[3px] text-[7px] font-mono leading-none font-normal z-20 opacity-90">{ez}</div>
                    <div className={`absolute inset-[-4px] border-2 border-dashed border-black/10 ${shapeClass} ${isTimeStopped ? '' : 'animate-[spin_8s_linear_infinite]'}`}></div>
                </div>
              );
              break;
      }
  }

  const isInteractable = (isPlayer || isAdjacent) && !isTimeStopped;
  if (isAdjacent && !isTimeStopped) bgClass = "bg-gray-800/30 hover:bg-gray-700/50";

  if (!isDaredevilActive && entity && !isTimeStopped) {
      let pZ = currentNuclide.z;
      let pA = currentNuclide.a;
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

  return (
    <div className={`relative w-full h-full border ${borderClass} ${bgClass} flex items-center justify-center grid-cell-anim ${isInteractable ? 'cursor-pointer' : ''}`} onClick={() => onCellClick(x, y)}>
        {content}
        {isTarget && <div className="target-mark"></div>}
        {activeEffects.map(ef => {
            let typeClass = "effect-base effect-generic";
            let style: React.CSSProperties = { animationPlayState: isTimeStopped ? 'paused' : 'running' };
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
};

export default memo(Cell);
