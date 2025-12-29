import React, { useState, useEffect, useMemo } from 'react';

interface ControlPanelProps {
  combo: number;
  isTimeStopped: boolean;
  lastComboTime: number;
  description?: string;
  activeEvent?: { type: string; color: string; timestamp: number };
}

const ControlPanel: React.FC<ControlPanelProps> = ({ combo, isTimeStopped, lastComboTime, description, activeEvent }) => {
  const [gaugeValue, setGaugeValue] = useState(0);
  const showCombo = combo > 0;

  // Track event visibility (within 1s)
  const isEventVisible = useMemo(() => {
    if (!activeEvent) return false;
    return Date.now() - activeEvent.timestamp < 1000;
  }, [activeEvent]);

  // Dynamic text color based on event or default
  const signalColor = activeEvent && isEventVisible ? activeEvent.color : "#00ff41";

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
    if (!isEventVisible || !activeEvent) return null;

    // Define different paths for different event types
    let d = "M0 50 L20 50 L25 20 L30 80 L35 50 L60 50 L65 10 L70 90 L75 50 L100 50"; // Standard ECG
    if (activeEvent.type === "INVERSION") {
        d = "M0 50 L20 50 L25 80 L30 20 L35 50 L60 50 L65 90 L70 10 L75 50 L100 50"; // Inverted peaks
    } else if (activeEvent.type === "NEUTRON_STORM") {
        d = "M0 50 L10 50 L15 60 L20 40 L25 70 L30 30 L35 80 L40 20 L45 90 L50 10 L55 50 L100 50"; // Noisy spikes
    } else if (activeEvent.type === "PROTON_BURST") {
        d = "M0 50 L30 50 L35 10 L45 10 L50 50 L80 50 L85 10 L95 10 L100 50"; // Blocky bursts
    }

    return (
      <svg 
        className="absolute inset-0 w-full h-full opacity-30 pointer-events-none" 
        viewBox="0 0 100 100" 
        preserveAspectRatio="none"
      >
        <path 
          d={d} 
          fill="none" 
          stroke={activeEvent.color} 
          strokeWidth="1" 
          className="animate-ecg-draw"
        />
      </svg>
    );
  };

  return (
    <div 
        className={`border-b border-gray-800 bg-black/60 min-h-[80px] md:min-h-[90px] flex flex-col relative overflow-hidden p-3 font-mono transition-colors duration-500 select-none touch-none`}
        style={{ borderColor: activeEvent && isEventVisible ? activeEvent.color : undefined }}
    >
      
      {/* Background ECG Signal */}
      {renderECG()}

      <div className="relative z-10 w-full h-full flex flex-col justify-start pointer-events-none">
        {showCombo ? (
          /* CHAIN COMBO TERMINAL VIEW */
          <div className="animate-fade-in w-full">
               <div 
                  className="text-[11px] md:text-xs font-bold leading-tight animate-pulse drop-shadow-[0_0_2px_currentColor] mb-3"
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
                  className="h-2 bg-black rounded-sm border overflow-hidden relative shadow-[inset_0_0_5px_rgba(0,0,0,1)]"
                  style={{ borderColor: `${signalColor}44` }}
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
          /* DESCRIPTION TERMINAL VIEW */
          <div 
            className="text-[11px] md:text-xs leading-tight animate-pulse drop-shadow-[0_0_2px_currentColor] pt-0"
            style={{ color: signalColor }}
          >
             <span className="opacity-60 mr-2 select-none font-bold">&gt;</span>
             {activeEvent && isEventVisible ? `SIGNAL DETECTED: ${activeEvent.type}` : (description || "Accessing IAEA database...")}
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
            background: `radial-gradient(circle at center, transparent 60%, ${signalColor}0D 100%)` 
        }}
      ></div>
    </div>
  );
};

export default ControlPanel;