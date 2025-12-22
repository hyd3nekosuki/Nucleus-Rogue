
import React, { useMemo, useState, useEffect, useRef } from 'react';
import { EntityType, DecayMode } from '../types';
import { MAGIC_NUMBERS } from '../constants';

interface NucleusVisualizerProps {
  z: number; // Protons
  a: number; // Mass Number (Total)
  symbol: string;
  decayModes: DecayMode[];
  lastDecayEvent?: { mode: DecayMode, timestamp: number } | null;
  isTimeStopped?: boolean;
}

interface Particle {
  id: number;
  type: EntityType.PROTON | EntityType.NEUTRON;
  x: number;
  y: number;
  scale: number;
}

interface EmissionParticle {
    id: string;
    type: 'ALPHA' | 'BETA_PLUS' | 'BETA_MINUS' | 'ELECTRON' | 'NEUTRON' | 'PROTON' | 'PHOTON';
    angle: number; // radians
    startDist: number;
}

const NucleusVisualizer: React.FC<NucleusVisualizerProps> = ({ z, a, symbol, decayModes, lastDecayEvent, isTimeStopped }) => {
  const n = a - z; // Neutrons
  const [emissionParticles, setEmissionParticles] = useState<EmissionParticle[]>([]);
  
  // FIX: Initialize with the timestamp of the event that exists at mount time
  // This prevents the animation from replaying when switching tabs.
  const lastProcessedTimestamp = useRef<number>(lastDecayEvent?.timestamp || 0);

  // Magic Number Check
  const isMagicZ = MAGIC_NUMBERS.includes(z);
  const isMagicN = MAGIC_NUMBERS.includes(n);

  // Clear emissions immediately if time stops
  useEffect(() => {
      if (isTimeStopped) {
          setEmissionParticles([]);
      }
  }, [isTimeStopped]);

  // Generate particle positions using phyllotaxis (sunflower pattern)
  const particles = useMemo(() => {
    const items: Particle[] = [];
    const total = z + n;
    
    let protonsLeft = z;
    let neutronsLeft = n;
    
    const angleIncrement = Math.PI * (3 - Math.sqrt(5)); 
    
    for (let i = 0; i < total; i++) {
      const r = 6 * Math.sqrt(i + 0.5); 
      const theta = i * angleIncrement;
      
      const x = r * Math.cos(theta);
      const y = r * Math.sin(theta);

      let type = EntityType.NEUTRON;
      if (protonsLeft > 0 && neutronsLeft > 0) {
          if (Math.random() < (protonsLeft / (protonsLeft + neutronsLeft))) {
              type = EntityType.PROTON;
              protonsLeft--;
          } else {
              neutronsLeft--;
          }
      } else if (protonsLeft > 0) {
          type = EntityType.PROTON;
          protonsLeft--;
      } else {
          neutronsLeft--;
      }

      items.push({
        id: i,
        type,
        x,
        y,
        scale: 1
      });
    }
    return items;
  }, [z, a]);

  // Handle Decay Events (Trigger Animations)
  useEffect(() => {
      // Only trigger if we have a valid event AND its timestamp is strictly newer than what we've processed
      if (!lastDecayEvent || isTimeStopped || lastDecayEvent.timestamp <= lastProcessedTimestamp.current) return;
      
      lastProcessedTimestamp.current = lastDecayEvent.timestamp;
      
      const newParticles: EmissionParticle[] = [];
      const idBase = `${lastDecayEvent.timestamp}`;
      const randomAngle = Math.random() * Math.PI * 2;
      const r = Math.max(10, Math.sqrt(z + n) * 6); // Surface radius approx

      switch (lastDecayEvent.mode) {
          case DecayMode.ALPHA:
              newParticles.push({ id: `alpha-${idBase}`, type: 'ALPHA', angle: randomAngle, startDist: r });
              break;
          case DecayMode.BETA_PLUS:
              newParticles.push({ id: `pos-${idBase}`, type: 'BETA_PLUS', angle: randomAngle, startDist: r * 0.5 });
              break;
          case DecayMode.BETA_MINUS:
              newParticles.push({ id: `elec-${idBase}`, type: 'BETA_MINUS', angle: randomAngle, startDist: r * 0.5 });
              break;
          case DecayMode.ELECTRON_CAPTURE:
              newParticles.push({ id: `ec-${idBase}`, type: 'ELECTRON', angle: randomAngle, startDist: 150 });
              break;
          case DecayMode.PROTON_EMISSION:
              newParticles.push({ id: `p-${idBase}`, type: 'PROTON', angle: randomAngle, startDist: r });
              break;
          case DecayMode.GAMMA:
               newParticles.push({ id: `g-${idBase}`, type: 'PHOTON', angle: randomAngle, startDist: 0 });
              break;
          case DecayMode.SPONTANEOUS_FISSION:
          case DecayMode.NEUTRON_EMISSION:
              const count = lastDecayEvent.mode === DecayMode.SPONTANEOUS_FISSION ? 2 : 1;
              for(let i=0; i<count; i++) {
                 newParticles.push({
                    id: `n-${idBase}-${i}`,
                    type: 'NEUTRON',
                    angle: randomAngle + (i * Math.PI),
                    startDist: r
                 });
              }
              break;
      }
      
      setEmissionParticles(prev => [...prev, ...newParticles]);

      const timer = setTimeout(() => {
          setEmissionParticles(prev => prev.filter(p => !p.id.includes(idBase)));
      }, 1000);
      return () => clearTimeout(timer);

  }, [lastDecayEvent, isTimeStopped, z, n]);

  const clusterRadius = Math.max(10, Math.sqrt(z + n) * 6);
  const viewSize = Math.max(100, clusterRadius * 4 + 40);
  const halfSize = viewSize / 2;

  const renderEmissions = () => {
      return emissionParticles.map(p => {
          if (p.type === 'ALPHA') {
              return (
                  <g key={p.id} className="animate-shoot-out" style={{
                      transformBox: 'fill-box',
                      transformOrigin: 'center',
                      '--angle': `${p.angle}rad`,
                      '--start-dist': `${p.startDist}px`,
                      '--end-dist': `${halfSize * 1.5}px`
                  } as React.CSSProperties}>
                       <circle r={6} fill="none" stroke="gold" strokeWidth={1} opacity={0.5} cx={0} cy={0} />
                       <circle r={2.5} fill="#ff0055" cx={-2} cy={-2} />
                       <circle r={2.5} fill="#ff0055" cx={2} cy={2} />
                       <circle r={2.5} fill="#00f3ff" cx={-2} cy={2} />
                       <circle r={2.5} fill="#00f3ff" cx={2} cy={-2} />
                  </g>
              );
          }
          if (p.type === 'BETA_MINUS') {
               return (
                  <circle key={p.id} r={2} fill="#facc15" className="animate-shoot-out shadow-[0_0_5px_#facc15]" 
                  style={{ '--angle': `${p.angle}rad`, '--start-dist': `${p.startDist}px`, '--end-dist': `${halfSize * 1.5}px` } as React.CSSProperties} />
               );
          }
          if (p.type === 'BETA_PLUS') {
               return (
                  <circle key={p.id} r={2} fill="#bc13fe" className="animate-shoot-out shadow-[0_0_5px_#bc13fe]" 
                  style={{ '--angle': `${p.angle}rad`, '--start-dist': `${p.startDist}px`, '--end-dist': `${halfSize * 1.5}px` } as React.CSSProperties} />
               );
          }
          if (p.type === 'NEUTRON') {
               return (
                  <circle key={p.id} r={3} fill="#00f3ff" className="animate-shoot-out shadow-[0_0_5px_#00f3ff]" 
                  style={{ '--angle': `${p.angle}rad`, '--start-dist': `${p.startDist}px`, '--end-dist': `${halfSize * 1.5}px` } as React.CSSProperties} />
               );
          }
          if (p.type === 'PROTON') {
               return (
                  <circle key={p.id} r={3} fill="#ff0055" className="animate-shoot-out shadow-[0_0_5px_#ff0055]" 
                  style={{ '--angle': `${p.angle}rad`, '--start-dist': `${p.startDist}px`, '--end-dist': `${halfSize * 1.5}px` } as React.CSSProperties} />
               );
          }
          if (p.type === 'ELECTRON') {
               return (
                  <circle key={p.id} r={2} fill="#facc15" className="animate-implode shadow-[0_0_5px_#facc15]" 
                  style={{ '--angle': `${p.angle}rad`, '--start-dist': `${p.startDist}px`, '--end-dist': `0px` } as React.CSSProperties} />
               );
          }
          if (p.type === 'PHOTON') {
               return (
                   <g key={p.id} className="animate-shoot-out" style={{
                      transformBox: 'view-box',
                      transformOrigin: '0 0',
                      '--angle': `${p.angle}rad`,
                      '--start-dist': `0px`,
                      '--end-dist': `${halfSize * 2}px`
                  } as React.CSSProperties}>
                      <path d="M0,0 Q10,5 20,0 T40,0" fill="none" stroke="#bc13fe" strokeWidth="2" strokeLinecap="round" transform="scale(3, 1)" />
                  </g>
               );
          }
          return null;
      });
  };

  const auraConfig = useMemo(() => {
      let mainMode = decayModes.find(m => m !== DecayMode.STABLE && m !== DecayMode.UNKNOWN);
      if (!mainMode) mainMode = decayModes.includes(DecayMode.UNKNOWN) ? DecayMode.UNKNOWN : DecayMode.STABLE;
      
      switch (mainMode) {
          case DecayMode.STABLE:
              return { color: '#00ff9d', fill: 'url(#gradStable)', shape: 'circle', className: 'animate-[pulse_4s_ease-in-out_infinite]', stroke: 'none' };
          case DecayMode.ALPHA:
              return { color: '#fbbf24', fill: '#fbbf24', shape: 'blob', className: 'animate-[pulse_1s_cubic-bezier(0.4,0,0.6,1)_infinite]', stroke: '#f59e0b', strokeWidth: 2, strokeDasharray: '4 4' };
          case DecayMode.BETA_MINUS:
              return { color: '#00f3ff', fill: 'rgba(0, 243, 255, 0.3)', shape: 'spiky', className: 'animate-[spin_4s_linear_infinite]', stroke: '#00f3ff', strokeWidth: 2, strokeDasharray: '2 2' };
          case DecayMode.BETA_PLUS:
              return { color: '#bc13fe', fill: 'rgba(188, 19, 254, 0.3)', shape: 'spiky', className: 'animate-[spin_4s_linear_infinite_reverse]', stroke: '#bc13fe', strokeWidth: 2, strokeDasharray: '2 2' };
          case DecayMode.ELECTRON_CAPTURE:
              return { color: '#14b8a6', fill: 'none', shape: 'spiral', className: 'animate-[spin_2s_linear_infinite_reverse]', stroke: '#14b8a6', strokeWidth: 2, strokeDasharray: 'none' };
          case DecayMode.GAMMA:
              return { color: '#bc13fe', fill: 'none', shape: 'atom', className: 'animate-[spin_10s_linear_infinite]', stroke: '#e0e7ff', strokeWidth: 1.5, strokeDasharray: 'none' };
          case DecayMode.SPONTANEOUS_FISSION:
              return { color: '#ff4500', fill: 'url(#gradFlare)', shape: 'saw', className: 'animate-[spin_3s_linear_infinite]', stroke: '#ffca28', strokeWidth: 2, strokeDasharray: 'none' };
          case DecayMode.UNKNOWN:
              return { color: '#a855f7', fill: 'rgba(168, 85, 247, 0.15)', shape: 'question', className: 'animate-pulse', stroke: '#d8b4fe', strokeWidth: 2, strokeDasharray: '4 4' };
          default: 
              return { color: '#ef4444', fill: 'rgba(255, 255, 255, 0.2)', shape: 'circle', className: 'animate-pulse', stroke: '#ffffff', strokeWidth: 1 };
      }
  }, [decayModes]);

  const renderAura = () => {
      const r = clusterRadius * 1.2;
      const commonStyle = { animationPlayState: isTimeStopped ? 'paused' : 'running' } as React.CSSProperties;
      
      if (auraConfig.shape === 'saw') {
          const teeth = 12;
          const outerR = r * 1.35;
          const innerR = r * 1.05;
          let d = "";
          for(let i=0; i<teeth; i++) {
              const angleStart = (Math.PI * 2 * i) / teeth;
              const angleTip = angleStart + (Math.PI * 2 * 0.45) / teeth; 
              const x1 = innerR * Math.cos(angleStart);
              const y1 = innerR * Math.sin(angleStart);
              const x2 = outerR * Math.cos(angleTip);
              const y2 = outerR * Math.sin(angleTip);
              if (i===0) d += `M ${x1} ${y1} L ${x2} ${y2}`;
              else d += ` L ${x1} ${y1} L ${x2} ${y2}`;
          }
          d += "Z";
          
          return (
             <g>
               <path 
                  d={d}
                  fill={auraConfig.fill}
                  stroke={auraConfig.stroke}
                  strokeWidth={auraConfig.strokeWidth}
                  strokeLinejoin="bevel"
                  className={auraConfig.className}
                  style={commonStyle}
               />
               <circle r={innerR * 0.8} fill={auraConfig.color} fillOpacity="0.2" className="animate-pulse" style={commonStyle} />
             </g>
          );
      } else if (auraConfig.shape === 'question') {
          return (
             <g>
                <text x="0" y="0" dominantBaseline="central" textAnchor="middle" fontSize={r * 3} fill={auraConfig.color} className="animate-[spin_10s_linear_infinite]" style={{ ...commonStyle, filter: 'drop-shadow(0 0 5px currentColor)', opacity: 0.8 }}>⚛</text>
                <text x="0" y="0" dominantBaseline="central" textAnchor="middle" fontSize={r * 1.5} fill="#ffffff" fontWeight="bold" className="animate-pulse" style={{ ...commonStyle, filter: 'drop-shadow(0 0 4px #a855f7)' }}>?</text>
             </g>
          );
      } else if (auraConfig.shape === 'atom') {
          const orbitRx = r * 1.8;
          const orbitRy = r * 0.6;
          return (
             <g className={auraConfig.className} style={commonStyle}>
                 {[0, 60, 120].map((deg, i) => (
                    <ellipse key={i} cx={0} cy={0} rx={orbitRx} ry={orbitRy} fill="none" stroke={auraConfig.stroke} strokeWidth={auraConfig.strokeWidth} transform={`rotate(${deg})`} style={{ opacity: 0.8 }} />
                 ))}
                 <circle r={r} fill={auraConfig.color} fillOpacity="0.15" className="animate-pulse" style={commonStyle} />
             </g>
          );
      } else if (auraConfig.shape === 'spiral') {
          return (
             <g className={auraConfig.className} style={commonStyle}>
                 {[0, 120, 240].map((offsetDeg) => {
                     const points = [];
                     const steps = 40;
                     const maxR = r * 1.5;
                     const turns = 1.5; 
                     for(let i=0; i<=steps; i++) {
                         const t = i/steps;
                         const rad = t * maxR;
                         const ang = (t * Math.PI * 2 * turns) + (offsetDeg * Math.PI / 180);
                         const px = rad * Math.cos(ang);
                         const py = rad * Math.sin(ang);
                         points.push(`${px},${py}`);
                     }
                     return <path key={offsetDeg} d={`M ${points.join(' L ')}`} fill="none" stroke={auraConfig.stroke} strokeWidth={auraConfig.strokeWidth} strokeLinecap="round" style={{ opacity: 0.8 }} />;
                 })}
                 <circle r={r * 0.2} fill={auraConfig.color} fillOpacity="0.3" className="animate-pulse" style={commonStyle} />
             </g>
          );
      } else if (auraConfig.shape === 'oval') {
          return <ellipse cx={0} cy={0} rx={r * 1.3} ry={r * 0.9} fill={auraConfig.fill} stroke={auraConfig.stroke} strokeWidth={auraConfig.strokeWidth} className={auraConfig.className} style={commonStyle} />;
      } else if (auraConfig.shape === 'ring') {
           return <circle cx={0} cy={0} r={r} fill="none" stroke={auraConfig.stroke} strokeWidth={auraConfig.strokeWidth} strokeDasharray={auraConfig.strokeDasharray} className={auraConfig.className} style={commonStyle} />;
      } else {
          return <circle cx={0} cy={0} r={r} fill={auraConfig.fill} stroke={auraConfig.stroke} strokeWidth={auraConfig.strokeWidth} strokeDasharray={auraConfig.strokeDasharray} className={auraConfig.className} style={commonStyle} />;
      }
  };

  const rotationStyle = { animationPlayState: isTimeStopped ? 'paused' : 'running' } as React.CSSProperties;

  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-black/20 rounded relative overflow-hidden">
      <style>
          {`
            @keyframes shootOut {
                0% { opacity: 1; transform: rotate(var(--angle)) translateX(var(--start-dist)); }
                100% { opacity: 0; transform: rotate(var(--angle)) translateX(var(--end-dist)); }
            }
            @keyframes implode {
                0% { opacity: 0; transform: rotate(var(--angle)) translateX(var(--start-dist)) scale(2); }
                50% { opacity: 1; }
                100% { opacity: 1; transform: rotate(var(--angle)) translateX(var(--end-dist)) scale(0); }
            }
            .animate-shoot-out { animation: shootOut 0.8s cubic-bezier(0, 0, 0.2, 1) forwards; }
            .animate-implode { animation: implode 0.6s ease-in forwards; }
          `}
      </style>

      <div className="absolute inset-0 opacity-10 pointer-events-none bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-gray-700 via-transparent to-transparent"></div>

      <svg viewBox={`${-halfSize} ${-halfSize} ${viewSize} ${viewSize}`} className="w-full h-full max-w-[250px] overflow-visible" style={{ overflow: 'visible' }}>
        <defs>
            <radialGradient id="gradStable" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
                <stop offset="0%" stopColor="#00ff9d" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#00ff9d" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="gradFlare" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
                <stop offset="0%" stopColor="#ffff00" stopOpacity="0.8" />
                <stop offset="60%" stopColor="#ff4500" stopOpacity="0.5" />
                <stop offset="100%" stopColor="#ff0000" stopOpacity="0" />
            </radialGradient>
        </defs>

        <g className="mix-blend-screen">
             {renderAura()}
             {auraConfig.shape !== 'circle' && (
                 <circle cx={0} cy={0} r={clusterRadius * 1.1} fill={auraConfig.color} fillOpacity="0.2" className="animate-pulse" style={rotationStyle} />
             )}
        </g>

        <g className="animate-[spin_20s_linear_infinite]" style={rotationStyle}>
            {particles.map((p) => {
                const isMagicParticle = (p.type === EntityType.PROTON && isMagicZ) || (p.type === EntityType.NEUTRON && isMagicN);
                return (
                    <circle
                        key={p.id}
                        cx={p.x}
                        cy={p.y}
                        r={isMagicParticle ? 3 : 2.5} 
                        fill={p.type === EntityType.PROTON ? '#ff0055' : '#00f3ff'}
                        stroke={isMagicParticle ? '#ffd700' : 'rgba(0,0,0,0.5)'}
                        strokeWidth={isMagicParticle ? 1.5 : 0.5}
                        className="transition-all duration-500"
                    />
                );
            })}
        </g>
        
        <g>{renderEmissions()}</g>
      </svg>
      
      <div className="absolute bottom-2 right-2 flex flex-col text-[10px] font-mono bg-black/60 p-1.5 rounded border border-gray-700 backdrop-blur-sm z-10">
          <div className={`flex items-center gap-2 ${isMagicZ ? 'text-yellow-400 font-bold' : 'text-neon-red'}`}>
             <span className={`w-2 h-2 rounded-full ${isMagicZ ? 'bg-yellow-400' : 'bg-neon-red shadow-[0_0_5px_#ff0055]'}${isMagicZ && !isTimeStopped ? ' animate-pulse shadow-[0_0_5px_gold]' : ''}`}></span>
             <span>Protons: {z} {isMagicZ ? '★' : ''}</span>
          </div>
          <div className={`flex items-center gap-2 ${isMagicN ? 'text-yellow-400 font-bold' : 'text-neon-blue'}`}>
             <span className={`w-2 h-2 rounded-full ${isMagicN ? 'bg-yellow-400' : 'bg-neon-blue shadow-[0_0_5px_#00f3ff]'}${isMagicN && !isTimeStopped ? ' animate-pulse shadow-[0_0_5px_gold]' : ''}`}></span>
             <span>Neutrons: {n} {isMagicN ? '★' : ''}</span>
          </div>
      </div>
    </div>
  );
};

export default NucleusVisualizer;
