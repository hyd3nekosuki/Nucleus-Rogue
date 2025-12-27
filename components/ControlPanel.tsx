
import React, { useState, useEffect } from 'react';

interface ControlPanelProps {
  combo: number;
  isTimeStopped: boolean;
  lastComboTime: number;
  description?: string;
}

const ControlPanel: React.FC<ControlPanelProps> = ({ combo, isTimeStopped, lastComboTime, description }) => {
  const [gaugeValue, setGaugeValue] = useState(0);
  const showCombo = combo > 0;

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
        // Window is 8000ms. 100 units / 8000ms = 0.0125 units/ms.
        // Step: 50ms * 0.0125 = 0.625 units.
        const next = prev - 0.625;
        return next > 0 ? next : 0;
      });
    }, 50);

    return () => clearInterval(depletionInterval);
  }, [showCombo, gaugeValue, isTimeStopped]);

  return (
    <div className={`border-b border-gray-800 bg-black/60 min-h-[80px] md:min-h-[90px] flex flex-col relative overflow-hidden p-3 font-mono transition-colors duration-500`}>
      
      <div className="relative z-10 w-full h-full flex flex-col justify-start">
        {showCombo ? (
          /* CHAIN COMBO TERMINAL VIEW */
          <div className="animate-fade-in w-full">
               {/* CHAIN TEXT (TOP) - Same size as description */}
               <div className="text-[#00ff41] text-[11px] md:text-xs font-bold leading-tight animate-pulse drop-shadow-[0_0_2px_#00ff41] mb-3">
                  <span className="opacity-60 mr-2 select-none font-bold">&gt;</span>
                  CHAIN x{combo} ACTIVE
                  <span className="inline-block w-1.5 h-3 bg-[#00ff41] ml-1 align-middle animate-[pulse_0.6s_infinite]"></span>
               </div>

               {/* DEPLETION BAR (BOTTOM) */}
               <div className="h-2 bg-black rounded-sm border border-[#00ff41]/30 overflow-hidden relative shadow-[inset_0_0_5px_rgba(0,0,0,1)]">
                  <div 
                      className="h-full bg-[#00ff41] transition-all duration-100 ease-linear shadow-[0_0_15px_#00ff41]"
                      style={{ width: `${gaugeValue}%` }}
                  >
                      {/* Scanline pattern on the bar */}
                      <div className="w-full h-full bg-[linear-gradient(90deg,transparent_0%,rgba(255,255,255,0.1)_50%,transparent_100%)] animate-[spin_4s_linear_infinite]"></div>
                  </div>
               </div>
          </div>
        ) : (
          /* DESCRIPTION TERMINAL VIEW */
          <div className="text-[#00ff41] text-[11px] md:text-xs leading-tight animate-pulse drop-shadow-[0_0_2px_#00ff41] pt-0">
             <span className="opacity-60 mr-2 select-none font-bold">&gt;</span>
             {description || "Analyzing atomic structure..."}
             {/* Retro cursor */}
             <span className="inline-block w-1.5 h-3 bg-[#00ff41] ml-1 align-middle animate-[pulse_0.6s_infinite]"></span>
          </div>
        )}
      </div>

      {/* CRT Scanline effect (Consistent across both views) */}
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.1)_50%),linear-gradient(90deg,rgba(0,255,65,0.03),rgba(0,255,65,0.01),rgba(0,255,65,0.03))] bg-[length:100%_3px,2px_100%] opacity-40"></div>
      
      {/* Subtle green vignette */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_60%,rgba(0,255,65,0.05)_100%)]"></div>
    </div>
  );
};

export default ControlPanel;
