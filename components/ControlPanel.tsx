
import React, { useState, useEffect } from 'react';

interface ControlPanelProps {
  combo: number;
  isTimeStopped: boolean;
  lastComboTime: number;
}

const ControlPanel: React.FC<ControlPanelProps> = ({ combo, isTimeStopped, lastComboTime }) => {
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
    <div className="p-4 border-b border-gray-800 bg-black/20 min-h-[80px] flex flex-col justify-center">
      <div className="flex justify-between items-center mb-2 px-1">
          <h3 className="text-[10px] text-gray-500 uppercase tracking-[0.2em] font-bold">
            {showCombo ? "Chain Reaction" : "System Status"}
          </h3>
          {showCombo && (
            <span className="text-neon-blue font-black italic text-sm animate-pulse">
               ACTIVE
            </span>
          )}
      </div>

      {showCombo ? (
        <div className="relative">
             <div className="flex justify-between items-end mb-1 px-1">
                 <div className="text-neon-blue font-black italic text-xl tracking-tighter drop-shadow-[0_0_10px_rgba(0,243,255,0.6)]">
                    CHAIN x{combo}
                 </div>
                 <div className="text-[10px] text-gray-400 font-mono">
                    SYNC: {Math.ceil(gaugeValue)}%
                 </div>
             </div>
             
             {/* Progress Bar Container */}
             <div className="h-3 bg-gray-900 rounded border border-neon-blue/30 overflow-hidden shadow-inner relative">
                <div 
                    className="absolute inset-0 bg-neon-blue/10 animate-pulse"
                ></div>
                <div 
                    className="h-full bg-neon-blue transition-all duration-100 ease-linear shadow-[0_0_15px_#00f3ff]"
                    style={{ width: `${gaugeValue}%` }}
                >
                    <div className="w-full h-full bg-[linear-gradient(90deg,transparent_0%,rgba(255,255,255,0.4)_50%,transparent_100%)] animate-[spin_3s_linear_infinite]"></div>
                </div>
             </div>
        </div>
      ) : (
        <div className="flex items-center justify-center gap-3 py-2 border border-gray-800/50 rounded bg-black/40 opacity-60">
             <div className="w-2 h-2 bg-neon-green rounded-full animate-pulse shadow-[0_0_8px_#00ff9d]"></div>
             <span className="text-xs text-neon-green font-bold tracking-widest uppercase">System Ready</span>
        </div>
      )}
    </div>
  );
};

export default ControlPanel;
