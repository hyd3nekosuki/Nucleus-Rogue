
import React from 'react';
import { NuclideData, DecayMode } from '../types';

interface ControlPanelProps {
  nuclide: NuclideData;
  onDecay: (mode: DecayMode) => void;
  disabled: boolean;
}

const ControlPanel: React.FC<ControlPanelProps> = ({ nuclide, onDecay, disabled }) => {
  
  // Allow UNKNOWN to be shown as a button
  const actionableModes = nuclide.decayModes.filter(m => m !== DecayMode.STABLE);

  if (actionableModes.length === 0) {
      return (
          <div className="p-4 border-b border-gray-800 text-center">
              <div className="text-gray-500 text-sm">Nuclide is stable.</div>
              <div className="text-xs text-gray-600">Gather particles to transmute.</div>
          </div>
      );
  }

  const getLabel = (mode: DecayMode) => {
      switch(mode) {
          case DecayMode.ALPHA: return "α-Decay (Emit He-4)";
          case DecayMode.BETA_MINUS: return "β- Decay (Emit e-)";
          case DecayMode.BETA_PLUS: return "β+ Decay (Emit Positron)";
          case DecayMode.ELECTRON_CAPTURE: return "Electron Capture (EC)";
          case DecayMode.SPONTANEOUS_FISSION: return "FISSION (SPLIT)";
          case DecayMode.GAMMA: return "γ-Decay (Gamma Burst)";
          case DecayMode.UNKNOWN: return "Unknown (?)";
          default: return mode.replace('_', ' ');
      }
  };

  const getColor = (mode: DecayMode) => {
      switch(mode) {
          case DecayMode.ALPHA: return "hover:bg-yellow-500 border-yellow-500 text-yellow-500";
          case DecayMode.BETA_MINUS: return "hover:bg-blue-500 border-blue-500 text-blue-500";
          case DecayMode.BETA_PLUS: return "hover:bg-neon-red border-neon-red text-neon-red";
          case DecayMode.ELECTRON_CAPTURE: return "hover:bg-teal-500 border-teal-500 text-teal-500";
          case DecayMode.SPONTANEOUS_FISSION: return "hover:bg-red-600 border-red-600 text-red-600";
          case DecayMode.GAMMA: return "hover:bg-neon-purple border-neon-purple text-neon-purple";
          case DecayMode.UNKNOWN: return "hover:bg-gray-100 border-white text-white animate-pulse shadow-[0_0_10px_rgba(255,255,255,0.3)]";
          default: return "hover:bg-gray-500 border-gray-500 text-gray-500";
      }
  };

  return (
    <div className="p-4 border-b border-gray-800">
      <h3 className="text-xs text-gray-500 mb-3 uppercase">Decay Actions (Active Skills)</h3>
      <div className="flex flex-col gap-2">
        {actionableModes.map(mode => (
            <button
                key={mode}
                onClick={() => onDecay(mode)}
                disabled={disabled}
                className={`w-full py-2 px-4 border rounded bg-transparent hover:text-black font-bold text-sm transition-colors ${getColor(mode)} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
                {getLabel(mode)}
            </button>
        ))}
      </div>
    </div>
  );
};

export default ControlPanel;
