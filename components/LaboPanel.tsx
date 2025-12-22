
import React from 'react';

interface Props {
    energyPoints: number;
    onClose: () => void;
    onStabilize: () => void;
}

const LaboPanel: React.FC<Props> = ({ energyPoints, onClose, onStabilize }) => {
    const COST = 5;
    const canAfford = energyPoints >= COST;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 animate-fade-in">
            <div className="relative bg-[#13131f] border border-gray-700 rounded-xl p-6 md:p-8 max-w-[95vw] w-full lg:w-[450px] shadow-2xl overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-yellow-400 via-orange-500 to-yellow-400"></div>
                
                <button 
                    onClick={onClose}
                    className="absolute top-6 right-6 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded border border-gray-700 transition-colors uppercase text-xs font-bold z-20 shadow-lg"
                >
                    Close [X]
                </button>

                <div className="mb-8">
                    <h2 className="text-3xl font-black text-white tracking-widest uppercase italic">
                        <span className="text-yellow-400">🔬 Nuclear</span> Labo
                    </h2>
                    <div className="mt-6 flex flex-col items-center gap-4 bg-black/50 border border-yellow-500/20 p-6 rounded-xl">
                        <div className="flex flex-col items-center">
                            <span className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Available Energy</span>
                            <span className="text-5xl text-yellow-400 font-mono font-bold drop-shadow-[0_0_15px_rgba(250,204,21,0.5)]">
                                {energyPoints} <span className="text-2xl">E</span>
                            </span>
                        </div>
                        <p className="text-xs text-gray-400 text-center italic leading-relaxed px-4">
                            Harvest energy from Alpha decays to trigger immediate nuclear stabilization.
                        </p>
                    </div>
                </div>

                <div className="flex flex-col gap-4">
                    <button
                        onClick={() => canAfford && onStabilize()}
                        disabled={!canAfford}
                        className={`flex flex-col items-center justify-center p-6 rounded-xl border-2 transition-all duration-300 group 
                            ${canAfford 
                                ? 'bg-yellow-400/10 border-yellow-400/50 hover:bg-yellow-400/20 hover:border-yellow-400 hover:scale-[1.02] shadow-[0_0_30px_rgba(250,204,21,0.1)]' 
                                : 'bg-black/20 border-gray-800 opacity-50 cursor-not-allowed'}`}
                    >
                        <div className="text-5xl mb-3 transform group-hover:scale-110 transition-transform">💉</div>
                        <h3 className={`text-xl font-black uppercase tracking-widest ${canAfford ? 'text-white' : 'text-gray-500'}`}>
                            Stabilize
                        </h3>
                        <p className="text-[10px] text-gray-400 mt-2 font-bold uppercase tracking-tighter">
                            Full HP Recovery
                        </p>
                        <div className={`mt-4 px-4 py-1 rounded-full font-mono font-black ${canAfford ? 'bg-yellow-400 text-black' : 'bg-gray-800 text-gray-600'}`}>
                            COST: {COST} E
                        </div>
                    </button>
                </div>

                <div className="mt-8 text-center">
                    <p className="text-[9px] text-gray-600 uppercase tracking-[0.2em]">
                        Advanced Research Laboratory • Phase 1.3.4
                    </p>
                </div>
            </div>
        </div>
    );
};

export default LaboPanel;
