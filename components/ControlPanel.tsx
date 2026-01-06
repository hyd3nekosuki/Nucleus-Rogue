
import React, { useState, useEffect } from 'react';
// Fix: Import COMBO_WINDOW_MS from constants instead of the engine hook
import { COMBO_WINDOW_MS } from '../constants';

interface ControlPanelProps {
  combo: number;
  isTimeStopped: boolean;
  lastComboTime: number;
  description?: string;
  activeEvent?: { type: string; color: string; timestamp: number };
  tutorialMessage: string | null;
  bpm: number;
  lastKickTime: number;
}

const ControlPanel: React.FC<ControlPanelProps> = ({ combo, isTimeStopped, lastComboTime, description, activeEvent, tutorialMessage, bpm, lastKickTime }) => {
  const [gaugeValue, setGaugeValue] = useState(0);
  const [isSignalVisible, setIsSignalVisible] = useState(false);
  const [isEventColorActive, setIsEventColorActive] = useState(false);
  const [isCursorLit, setIsCursorLit] = useState(false);
  const showCombo = combo > 0;

  // BPM Timing calculations
  const beatDuration = 60 / (bpm || 132); 
  const fourBeatDuration = beatDuration * 4; // 4-beat cycle for pulse

  // Handle visual event timing
  useEffect(() => {
    if (activeEvent) {
      setIsSignalVisible(true);
      setIsEventColorActive(true);
      
      // Color resets after 500ms
      const colorTimer = setTimeout(() => setIsEventColorActive(false), 500);
      // Background signal disappears after 1000ms
      const signalTimer = setTimeout(() => setIsSignalVisible(false), 1000);
      
      return () => {
        clearTimeout(colorTimer);
        clearTimeout(signalTimer);
      };
    }
  }, [activeEvent]);

  // BGMのキック音（lastKickTime更新）に同期してカーソルを点灯させる
  useEffect(() => {
    if (lastKickTime > 0) {
        setIsCursorLit(true);
        // 120ms後に消灯（音楽的なキックのキレに合わせる）
        const timer = setTimeout(() => setIsCursorLit(false), 120);
        return () => clearTimeout(timer);
    }
  }, [lastKickTime]);

  // Dynamic text and border color based on event activity or default green
  const signalColor = (activeEvent && isEventColorActive) ? activeEvent.color : "#00ff9d";

  // Absolute time based gauge synchronization
  useEffect(() => {
    if (!showCombo || isTimeStopped) {
        if (!showCombo) setGaugeValue(0);
        return;
    }
    
    const updateGauge = () => {
        const now = Date.now();
        const elapsed = now - lastComboTime;
        const remainingPct = Math.max(0, 100 - (elapsed / COMBO_WINDOW_MS) * 100);
        setGaugeValue(remainingPct);
    };

    updateGauge(); // Initial sync
    const interval = setInterval(updateGauge, 50); // High precision updates

    return () => clearInterval(interval);
  }, [showCombo, lastComboTime, isTimeStopped]);

  // SVG ECG Wave Generator
  const renderECG = () => {
    if (!isSignalVisible || !activeEvent) return null;

    let d = "M0 50 L20 50 L25 20 L30 80 L35 50 L60 50 L65 10 L70 90 L75 50 L100 50"; 
    if (activeEvent.type === "INVERSION") {
        d = "M0 50 L10 50 L12 80 L15 20 L18 50 L40 50 L45 80 L50 20 L55 50 L80 50 L85 80 L90 20 L100 50"; 
    } else if (activeEvent.type === "NEUTRON_STORM") {
        d = "M0 50 L5 60 L10 40 L15 70 L20 30 L25 80 L30 20 L35 90 L40 10 L45 75 L50 25 L55 65 L60 35 L65 85 L70 15 L75 55 L80 45 L100 50"; 
    } else if (activeEvent.type === "PROTON_BURST") {
        d = "M0 50 L10 50 L10 10 L30 10 L30 50 L50 50 L50 10 L70 10 L70 50 L90 50 L90 10 L100 10"; 
    } else if (activeEvent.type === "ELECTRON_FLUCTUATION") {
        d = "M0 50 Q 25 10, 50 50 T 100 50 M0 50 Q 25 90, 50 50 T 100 50"; 
    }

    return (
      <svg 
        className="absolute inset-0 w-full h-full opacity-40 pointer-events-none" 
        viewBox="0 0 100 100" 
        preserveAspectRatio="none"
      >
        <path 
          d={d} 
          fill="none" 
          stroke={activeEvent.color} 
          strokeWidth="0.6" 
          className="animate-ecg-draw"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  };

  // カーソルの表示スタイル
  const cursorStyle: React.CSSProperties = {
    opacity: (isTimeStopped || isCursorLit) ? 1 : 0,
    transition: isCursorLit ? 'none' : 'opacity 120ms linear'
  };

  return (
    <div className="bg-black/60 mx-2 min-h-[80px] md:min-h-[90px] flex flex-col relative overflow-hidden p-3 font-mono select-none touch-none rounded-lg border border-gray-800">
      
      {/* BACKGROUND PULSING BORDER LAYER - Synchronized to 4-beat cycle and event colors */}
      <div 
        className="absolute inset-0 border-2 rounded-lg pointer-events-none transition-colors duration-300 z-20"
        style={{ 
          borderColor: signalColor,
          color: signalColor,
          animation: !isTimeStopped ? `bpm-border-pulse ${fourBeatDuration}s infinite ease-in-out` : 'none' 
        }}
      />
      
      {/* Background ECG Signal */}
      {renderECG()}

      {/* STATIC TEXT LAYER (Content does not scale) */}
      <div className="relative z-10 w-full h-full flex flex-col justify-center pointer-events-none">
        {tutorialMessage ? (
          <div className="animate-fade-in w-full text-center">
             <div className="text-base md:text-xl font-bold text-white drop-shadow-[0_0_8px_#00f3ff] uppercase tracking-tighter leading-tight font-mono">
                {tutorialMessage}
                <span 
                  className="inline-block w-2 h-4 ml-2 align-middle bg-neon-blue"
                  style={cursorStyle}
                ></span>
             </div>
          </div>
        ) : showCombo ? (
          <div className="animate-fade-in w-full h-full flex flex-col justify-start">
               <div 
                  className="text-[11px] md:text-xs font-bold leading-tight drop-shadow-[0_0_2px_currentColor] mb-3 transition-colors duration-300"
                  style={{ color: signalColor }}
               >
                  <span className="opacity-60 mr-2 select-none font-bold">&gt;</span>
                  CHAIN x{combo} ACTIVE
                  <span 
                    className="inline-block w-1.5 h-3 ml-1 align-middle"
                    style={{ 
                      backgroundColor: signalColor,
                      ...cursorStyle
                    }}
                  ></span>
               </div>

               <div 
                  className="h-2 bg-black rounded-sm border border-gray-800 overflow-hidden relative shadow-[inset_0_0_5px_rgba(0,0,0,1)] transition-colors duration-300"
                >
                  <div 
                      className="h-full transition-all duration-100 ease-linear shadow-[0_0_15px_currentColor]"
                      style={{ width: `${gaugeValue}%`, backgroundColor: signalColor }}
                  >
                      <div className="w-full h-full bg-[linear-gradient(90deg,transparent_0%,rgba(255,255,255,0.1)_50%,transparent_100%)] animate-[spin_4s_linear_infinite]"></div>
                  </div>
               </div>
          </div>
        ) : (
          <div 
            className="text-[11px] md:text-xs leading-tight drop-shadow-[0_0_2px_currentColor] pt-0 transition-colors duration-300 h-full flex items-start"
            style={{ color: signalColor }}
          >
             <span className="opacity-60 mr-2 select-none font-bold mt-0.5">&gt;</span>
             <span>
               {description || "Accessing IAEA database..."}
               <span 
                  className="inline-block w-1.5 h-3 ml-1 align-middle"
                  style={{ 
                    backgroundColor: signalColor,
                    ...cursorStyle
                  }}
               ></span>
             </span>
          </div>
        )}
      </div>

      {/* CRT Scanline effect */}
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.1)_50%),linear-gradient(90deg,rgba(0,255,65,0.03),rgba(0,255,65,0.01),rgba(0,255,65,0.03))] bg-[length:100%_3px,2px_100%] opacity-40"></div>
      
      {/* Subtle vignette */}
      <div 
        className="pointer-events-none absolute inset-0 transition-opacity duration-500"
        style={{ 
            background: `radial-gradient(circle at center, transparent 60%, ${signalColor}15 100%)` 
        }}
      ></div>
    </div>
  );
};

export default ControlPanel;
