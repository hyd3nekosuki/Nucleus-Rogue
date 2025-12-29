import React, { useState, useEffect } from 'react';

interface ControlPanelProps {
  combo: number;
  isTimeStopped: boolean;
  lastComboTime: number;
  description?: string;
  activeEvent?: { type: string; color: string; timestamp: number };
}

const ControlPanel: React.FC<ControlPanelProps> = ({ combo, isTimeStopped, lastComboTime, description, activeEvent }) => {
  const [gaugeValue, setGaugeValue] = useState(0);
  const [isSignalVisible, setIsSignalVisible] = useState(false);
  const [isEventColorActive, setIsEventColorActive] = useState(false);
  const showCombo = combo > 0;

  // Handle visual event timing
  useEffect(() => {
    if (activeEvent) {
      setIsSignalVisible(true);
      setIsEventColorActive(true);
      
      // Color resets to green after 500ms
      const colorTimer = setTimeout(() => setIsEventColorActive(false), 500);
      // Background signal disappears after 1000ms
      const signalTimer = setTimeout(() => setIsSignalVisible(false), 1000);
      
      return () => {
        clearTimeout(colorTimer);
        clearTimeout(signalTimer);
      };
    }
  }, [activeEvent]);

  // Dynamic text color based on event activity (500ms) or default green (#00ff41)
  const signalColor = (activeEvent && isEventColorActive) ? activeEvent.color : "#00ff41";

  // Sync gauge when combo starts or increments
  useEffect(() => {
    if (combo > 0) {
      setGaugeValue(100);
    } else {
      setGaugeValue(0);
    }
  }, [combo, lastComboTime]);

  // Handle gauge depletion over time (8000ms window)
  useEffect(() => {
    if (!showCombo || gaugeValue <= 0 || isTimeStopped) return;
    
    const depletionInterval = setInterval(() => {
      setGaugeValue(prev => {
        const next = prev - 0.625;
        return next > 0 ? next : 0;
      });
    }, 50);

    return () => clearInterval(depletionInterval);
  }, [showCombo, gaugeValue, isTimeStopped]);

  // SVG ECG Wave Generator
  const renderECG = () => {
    if (!isSignalVisible || !activeEvent) return null;

    // Define different paths for different event types to create a "noise signal" look
    let d = "M0 50 L20 50 L25 20 L30 80 L35 50 L60 50 L65 10 L70 90 L75 50 L100 50"; // Standard ECG
    if (activeEvent.type === "INVERSION") {
        d = "M0 50 L10 50 L12 80 L15 20 L18 50 L40 50 L45 80 L50 20 L55 50 L80 50 L85 80 L90 20 L100 50"; // Inverted peaks
    } else if (activeEvent.type === "NEUTRON_STORM") {
        d = "M0 50 L5 60 L10 40 L15 70 L20 30 L25 80 L30 20 L35 90 L40 10 L45 75 L50 25 L55 65 L60 35 L65 85 L70 15 L75 55 L80 45 L100 50"; // High noise spikes
    } else if (activeEvent.type === "PROTON_BURST") {
        d = "M0 50 L10 50 L10 10 L30 10 L30 50 L50 50 L50 10 L70 10 L70 50 L90 50 L90 10 L100 10"; // Blocky pulse waves
    } else if (activeEvent.type === "ELECTRON_FLUCTUATION") {
        d = "M0 50 Q 25 10, 50 50 T 100 50 M0 50 Q 25 90, 50 50 T 100 50"; // Fluctuating sine-like noise
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

  return (
    <div 
        className="border-b border-gray-800 bg-black/60 min-h-[80px] md:min-h-[90px] flex flex-col relative overflow-hidden p-3 font-mono transition-colors duration-500 select-none touch-none"
    >
      
      {/* Background ECG Signal */}
      {renderECG()}

      <div className="relative z-10 w-full h-full flex flex-col justify-start pointer-events-none">
        {showCombo ? (
          /* CHAIN COMBO TERMINAL VIEW */
          <div className="animate-fade-in w-full">
               <div 
                  className="text-[11px] md:text-xs font-bold leading-tight animate-pulse drop-shadow-[0_0_2px_currentColor] mb-3 transition-colors duration-300"
                  style={{ color: signalColor }}
               >
                  <span className="opacity-60 mr-2 select-none font-bold">&gt;</span>
                  CHAIN x{combo} ACTIVE
                  <span 
                    className="inline-block w-1.5 h-3 ml-1 align-middle animate-[pulse_0.6s_infinite]"
                    style={{ backgroundColor: signalColor }}
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
          /* DESCRIPTION TERMINAL VIEW - MAINTAINS ORIGINAL TEXT */
          <div 
            className="text-[11px] md:text-xs leading-tight drop-shadow-[0_0_2px_currentColor] pt-0 transition-colors duration-300"
            style={{ color: signalColor }}
          >
             <span className="opacity-60 mr-2 select-none font-bold">&gt;</span>
             {description || "Accessing IAEA database..."}
             <span 
                className="inline-block w-1.5 h-3 ml-1 align-middle animate-[pulse_0.6s_infinite]"
                style={{ backgroundColor: signalColor }}
             ></span>
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