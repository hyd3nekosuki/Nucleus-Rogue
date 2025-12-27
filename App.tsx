
import React, { useState, useEffect, useRef } from 'react';
import { DecayMode } from './types';
import { GRID_WIDTH, GRID_HEIGHT, MAGIC_NUMBERS, APP_VERSION } from './constants';
import Grid from './components/Grid';
import InfoPanel from './components/InfoPanel';
import ControlPanel from './components/ControlPanel';
import PeriodicTable from './components/PeriodicTable';
import HealthBar from './components/HealthBar';
import GameOverOverlay from './components/GameOverOverlay';
import NucleusVisualizer from './components/NucleusVisualizer';
import TrefoilIndicator from './components/TrefoilIndicator';
import EvolutionMap from './components/EvolutionMap';
import { useTTS } from './hooks/useTTS';
import { useNucleusEngine } from './hooks/useNucleusEngine';

const STABILIZE_COST = 5;
const NUCLEOSYNTHESIS_COST = 200;

function App() {
  const [showTable, setShowTable] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<'history' | 'structure'>('structure');

  // Core Hooks
  const { triggerOverride } = useTTS({ name: 'INIT' } as any, false); // Initial TTS instance
  const engine = useNucleusEngine(triggerOverride);
  const { gameState, evolutionHistory, isScreenShaking, isFlashBang, flashColor, lastDecayEvent, finalCombo } = engine;

  // Actual TTS linked to state
  const { triggerOverride: engineTTS } = useTTS(gameState.currentNuclide, gameState.gameOver);

  useEffect(() => {
    if (containerRef.current) containerRef.current.focus();
  }, []);

  // Auto-scroll messages: Newest is at top, so scroll to top
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [gameState.messages]);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'Spacebar'].includes(e.key)) e.preventDefault();
      engine.stopAutoMove();
      switch(e.key) {
        case 'ArrowUp': case 'w': engine.moveStep(0, -1); break;
        case 'ArrowDown': case 's': engine.moveStep(0, 1); break;
        case 'ArrowLeft': case 'a': engine.moveStep(-1, 0); break;
        case 'ArrowRight': case 'd': engine.moveStep(1, 0); break;
        case 'Enter': case ' ': case 'Spacebar': engine.handlePlayerInteract(); break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [engine]);

  const isNucleosynthesisEnabled = !gameState.disabledSkills.includes("Nucleosynthesis");
  const isTransmutationEnabled = !gameState.disabledSkills.includes("Exp. Replicate");
  const isNucleosynthesisReady = gameState.energyPoints >= NUCLEOSYNTHESIS_COST && gameState.playerLevel >= 5 && isNucleosynthesisEnabled;
  const transmutationReady = MAGIC_NUMBERS.includes(gameState.currentNuclide.z) && MAGIC_NUMBERS.includes(gameState.currentNuclide.a - gameState.currentNuclide.z) && gameState.isTimeStopped && gameState.playerLevel >= 4 && isTransmutationEnabled;

  const handleTransmuteWrapper = (z: number) => {
    engine.handleTransmute(z);
    setShowTable(false);
  };

  const energyCost = isNucleosynthesisReady ? NUCLEOSYNTHESIS_COST : STABILIZE_COST;
  const energyPointsAvailable = gameState.energyPoints >= energyCost;

  return (
    <div ref={containerRef} tabIndex={0} className={`min-h-screen bg-dark-bg text-gray-200 font-mono flex flex-col md:flex-row overflow-hidden relative outline-none ${isScreenShaking ? 'animate-shake' : ''}`}>
      <div className={`pointer-events-none fixed inset-0 z-[100] ${flashColor} mix-blend-screen transition-opacity duration-500 ${isFlashBang ? 'opacity-100' : 'opacity-0'}`}></div>
      
      {showTable && (
        <PeriodicTable 
            unlocked={gameState.unlockedElements} 
            unlockedGroups={gameState.unlockedGroups} 
            decayStats={gameState.decayStats} 
            reactionStats={gameState.reactionStats} 
            disabledSkills={gameState.disabledSkills} 
            onToggleSkill={engine.handleToggleHiddenSkill} 
            maxCombo={gameState.maxCombo} 
            onClose={() => setShowTable(false)} 
            canTransmute={transmutationReady} 
            onSelectElement={handleTransmuteWrapper} 
        />
      )}

      {/* Side Panel */}
      <div className="order-2 md:order-1 w-full md:w-80 lg:w-96 bg-panel-bg border-r border-gray-800 flex flex-col h-auto md:h-screen overflow-y-auto z-20">
          <div className="hidden md:flex pt-2 pb-1.5 px-6 items-center justify-center border-b border-gray-800 shrink-0">
             <h1 className="text-lg font-black text-neon-blue tracking-tighter italic drop-shadow-[0_0_10px_rgba(0,243,255,0.5)]">NUCLEUS<span className="text-white text-[9px] not-italic font-normal tracking-widest ml-1 opacity-70">ROGUE</span></h1>
          </div>
          
          <InfoPanel 
            nuclide={gameState.currentNuclide} 
            hp={gameState.hp} 
            maxHp={gameState.maxHp} 
            energyPoints={gameState.energyPoints} 
            turn={gameState.turn} 
            score={gameState.score} 
            onDecay={engine.handleDecayAction}
            disabled={gameState.gameOver || gameState.loadingData || gameState.isTimeStopped}
            // Props for action dock
            playerLevel={gameState.playerLevel}
            isNucleosynthesisReady={isNucleosynthesisReady}
            transmutationReady={transmutationReady}
            energyPointsAvailable={energyPointsAvailable}
            onStabilize={engine.handleStabilize}
            onShowTable={() => setShowTable(true)}
            onUltimateSynthesis={engine.handleUltimateSynthesis}
          />
          
          <ControlPanel 
            combo={gameState.combo} 
            isTimeStopped={gameState.isTimeStopped} 
            lastComboTime={gameState.lastComboTime} 
            description={gameState.currentNuclide.description}
          />
          
          <div className="flex border-b border-gray-800 bg-gray-900/30">
             <button onClick={() => setActiveTab('structure')} className={`flex-1 py-2 text-[10px] uppercase tracking-widest font-bold transition-all border-b-2 ${activeTab === 'structure' ? 'border-neon-blue text-neon-blue bg-gray-800/50' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>Structure</button>
             <button onClick={() => setActiveTab('history')} className={`flex-1 py-2 text-[10px] uppercase tracking-widest font-bold transition-all border-b-2 ${activeTab === 'history' ? 'border-neon-green text-neon-green bg-gray-800/50' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>History</button>
          </div>

          <div className="p-4 border-b border-gray-800 shrink-0 h-64 flex flex-col items-center justify-center overflow-hidden">
             {activeTab === 'structure' ? <NucleusVisualizer z={gameState.currentNuclide.z} a={gameState.currentNuclide.a} symbol={gameState.currentNuclide.symbol} decayModes={gameState.currentNuclide.decayModes} lastDecayEvent={lastDecayEvent} isTimeStopped={gameState.isTimeStopped} /> : <EvolutionMap history={evolutionHistory} currentNuclide={gameState.currentNuclide} />}
          </div>

          {/* Message Log: Newest at top using .slice().reverse() */}
          <div ref={scrollRef} className="flex-1 p-4 font-mono text-xs overflow-y-auto flex flex-col justify-start scroll-smooth">
              {[...gameState.messages].reverse().map((msg, i) => {
                  // msg[0] is newest, so turn is turn - i
                  const msgTurn = gameState.turn - i;
                  return (
                    <div key={i} className={`mb-1 border-b border-gray-800 pb-1 last:border-0 opacity-80 ${msg.includes('✨') || msg.includes('☢️') || msg.includes('⚛️') || msg.includes('⏱') ? 'text-neon-blue font-bold animate-pulse' : ''}`}>
                        <span className="text-neon-purple mr-2">[{msgTurn > 0 ? msgTurn : 0}]</span>{msg}
                    </div>
                  );
              })}
          </div>

          <div className="p-4 bg-black/40 border-t border-gray-800 shrink-0 flex justify-between items-center text-[10px] text-gray-500">
                <div className="flex flex-col"><span className="font-bold uppercase">v{APP_VERSION}</span><a href="https://www-nds.iaea.org/relnsd/vcharthtml/VChartHTML.html" target="_blank" rel="noopener noreferrer" className="hover:text-neon-blue underline transition-colors">Data: IAEA Chart</a></div>
                <div className="text-right italic">Nucleus Rogue</div>
          </div>
      </div>

      {/* Main Game Area */}
      <div className="order-1 md:order-2 flex-1 flex flex-col items-center justify-start p-2 md:p-4 relative z-10 overflow-y-auto">
         <HealthBar hp={gameState.hp} maxHp={gameState.maxHp} nuclide={gameState.currentNuclide} onToggleTimeStop={engine.handleToggleTimeStop} isTimeStopped={gameState.isTimeStopped} level={gameState.playerLevel} />
         
         <div className="relative bg-panel-bg p-2 rounded-xl border border-gray-800 shadow-2xl w-full max-w-[95vw] md:w-auto overflow-hidden">
            {gameState.isTimeStopped && <div className="absolute inset-0 z-[60] bg-neon-blue/10 backdrop-blur-[2px] flex items-center justify-center pointer-events-none"><div className="text-4xl md:text-6xl font-black italic text-neon-blue animate-pulse drop-shadow(0 0 20px #00f3ff) uppercase tracking-tighter">Frozen Time</div></div>}
            
            <Grid width={GRID_WIDTH} height={GRID_HEIGHT} gameState={gameState} onCellClick={engine.handleCellClick} finalCombo={finalCombo} />
            
            <div className="mt-1 flex flex-wrap justify-center gap-x-8 gap-y-1 text-[10px] font-mono text-gray-400 group relative cursor-help py-1">
                <div className="flex items-center gap-2 group-hover:opacity-10 transition-opacity duration-300">
                    <div className="w-3 h-3 bg-neon-red rounded-full shadow-[0_0_8px_#ff0055]"></div>
                    <span className="text-white font-light">p: (Z+1, A+1)</span>
                </div>
                <div className="flex items-center gap-2 group-hover:opacity-10 transition-opacity duration-300">
                    <div className="w-3 h-3 bg-neon-blue rounded-full shadow-[0_0_8px_#00f3ff]"></div>
                    <span className="text-white font-light">n: (Z, A+1)</span>
                </div>
                <div className="flex items-center gap-2 group-hover:opacity-10 transition-opacity duration-300">
                    <div className="w-2 h-2 bg-yellow-400 rounded-full shadow-[0_0_5px_#facc15]"></div>
                    <span className="text-white font-light">e-: (Z-1, A)</span>
                </div>
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-1 group-hover:translate-y-0 pointer-events-none">
                    <span className="text-neon-purple font-black tracking-widest mr-3 italic">STREAK:</span>
                    <div className="flex items-center gap-4">
                        <span className="text-neon-red font-bold">p: {gameState.consecutiveProtons}</span>
                        <span className="text-neon-blue font-bold">n: {gameState.consecutiveNeutrons}</span>
                        <span className="text-yellow-400 font-bold">e: {gameState.consecutiveElectrons}</span>
                    </div>
                </div>
            </div>
            
            <GameOverOverlay isVisible={gameState.gameOver} reason={gameState.gameOverReason} nuclide={gameState.currentNuclide} onRestart={engine.restartGame} />
         </div>
      </div>
    </div>
  );
}

export default App;
