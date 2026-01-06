import React from 'react';

interface SidebarFooterProps {
  version: string;
  isMuted: boolean;
  toggleMute: () => void;
  bpm: number;
  primaryMode: string;
  isVoiceMuted: boolean;
  onToggleVoice: () => void;
}

const SidebarFooter: React.FC<SidebarFooterProps> = ({
  version,
  isMuted,
  toggleMute,
  bpm,
  primaryMode,
  isVoiceMuted,
  onToggleVoice
}) => {
  return (
    <div className="p-4 bg-black/40 border-t border-gray-800 shrink-0 flex justify-between items-center text-[10px] text-gray-500">
      <div className="flex flex-col">
        <span className="font-bold uppercase">v{version}</span>
        <div className="flex gap-2">
          <a 
            href="https://www-nds.iaea.org/relnsd/vcharthtml/VChartHTML.html" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="hover:text-neon-blue underline transition-colors"
          >
            IAEA Data
          </a>
          {!isMuted && (
            <span className="text-neon-blue animate-pulse font-bold tracking-tighter">
              BPM:{bpm} RES:{primaryMode.slice(0,3)}
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className="italic">Nucleus Rogue</div>
        <div className="flex gap-1.5 ml-1">
          <button 
            onClick={(e) => { e.stopPropagation(); onToggleVoice(); }} 
            className={`w-5 h-5 rounded border flex items-center justify-center transition-all active:scale-90 ${
              isVoiceMuted ? 'border-gray-700 text-gray-600' : 'border-neon-purple text-neon-purple shadow-[0_0_5px_#bc13fe]'
            }`} 
            title="Toggle Voice (V)"
          >
            <span className="text-[8px] font-bold">V</span>
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); toggleMute(); }} 
            className={`w-5 h-5 rounded border flex items-center justify-center transition-all active:scale-90 ${
              isMuted ? 'border-gray-700 text-gray-600' : 'border-neon-blue text-neon-blue shadow-[0_0_5px_#00f3ff]'
            }`} 
            title="Toggle BGM (M)"
          >
            <span className="text-[8px] font-bold">M</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default SidebarFooter;