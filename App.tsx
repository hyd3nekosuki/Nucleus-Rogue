import React, { useState, useEffect, useRef, useMemo } from 'react';
import { DecayMode, HistoryEntry } from './types';

import { GRID_WIDTH, GRID_HEIGHT, APP_VERSION } from './constants/gameConfig';
import { MAGIC_NUMBERS } from './constants/physics';

import Grid from './components/game/Grid';
import HealthBar from './components/game/HealthBar';
import NucleusVisualizer from './components/game/NucleusVisualizer';
import InfoPanel from './components/layout/InfoPanel';
import ControlPanel from './components/layout/ControlPanel';
import SidebarFooter from './components/layout/SidebarFooter';
import GridStatusFooter from './components/layout/GridStatusFooter';
import MessageLog from './components/layout/MessageLog';
import PeriodicTable from './components/overlays/PeriodicTable';
import GameOverOverlay from './components/overlays/GameOverOverlay';
import EvolutionMap from './components/overlays/EvolutionMap';
import { useTTS } from './hooks/useTTS';
import { useNucleusCoordinator } from './engine/useNucleusCoordinator';
import { useAudioEngine } from './services/audio/useAudioEngine';
import { useCheatEngine } from './hooks/useCheatEngine';

//const STABILIZE_COST = 5;
//const NUCLEOSYNTHESIS_COST = 200;
import { STABILIZE_COST, NUCLEOSYNTHESIS_COST } from './constants/economy';

function App() {
  const [showTable, setShowTable] = useState(false);
  const [saveCode, setSaveCode] = useState("");
  const [loadInputValue, setLoadInputValue] = useState("");
  const [isLoadError, setIsLoadError] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<'history' | 'structure'>('structure');
  const [isVoiceMuted, setIsVoiceMuted] = useState(true);
  const [isSoundTestActive, setIsSoundTestActive] = useState(false);
  const [lastKickTime, setLastKickTime] = useState(0);

  // --- TTS Bridging Logic ---
  const ttsTriggerRef = useRef<(text: string) => void>(() => {});
  const engine = useNucleusCoordinator((text) => ttsTriggerRef.current(text));
  const { gameState, evolutionHistory, isScreenShaking, isFlashBang, flashColor, lastDecayEvent, finalCombo } = engine;
  
  // --- Cheat Engine Real-time Feedback (Step 4) ---
  const cheatResult = useCheatEngine(loadInputValue, gameState);
  
  // --- Audio Logic with Dynamic Resonance ---
  const { isMuted, toggleMute, bpm, primaryMode } = useAudioEngine(
      gameState.hp, 
      gameState.gameOver, 
      gameState.currentNuclide.decayModes,
      isSoundTestActive,
      () => setLastKickTime(Date.now())
  );
  
  const { triggerOverride: activeTTSTrigger } = useTTS(gameState.currentNuclide, gameState.gameOver, isVoiceMuted);

  useEffect(() => {
    ttsTriggerRef.current = activeTTSTrigger;
  }, [activeTTSTrigger]);

  // Convert the discovery record into a sorted list for the map visualization
  // Fix: Explicitly cast to HistoryEntry[] to avoid "unknown" type inference errors in Object.values
  const sortedHistory = useMemo(() => {
    return (Object.values(evolutionHistory) as HistoryEntry[]).sort((a, b) => a.firstTurn - b.firstTurn);
  }, [evolutionHistory]);

  // Scroll Lock for Periodic Table
  useEffect(() => {
    if (showTable) {
        document.body.style.overflow = 'hidden';
        // Generate save code when opening table
        engine.generateSaveCode().then(code => setSaveCode(code));
    } else {
        document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [showTable, engine]);

  useEffect(() => {
    if (containerRef.current) containerRef.current.focus();
  }, []);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [gameState.messages]);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'Spacebar'].includes(e.key)) {
        if (document.activeElement?.tagName !== 'INPUT') e.preventDefault();
      }
      if (document.activeElement?.tagName === 'INPUT') return;

      engine.stopAutoMove();
      switch(e.key) {
        case 'ArrowUp': case 'w': engine.moveStep(0, -1); break;
        case 'ArrowDown': case 's': engine.moveStep(0, 1); break;
        case 'ArrowLeft': case 'a': engine.moveStep(-1, 0); break;
        case 'ArrowRight': case 'd': engine.moveStep(1, 0); break;
        case 'Enter': case ' ': case 'Spacebar': engine.handlePlayerInteract(); break;
        case 'm': toggleMute(); break;
        case 'v': setIsVoiceMuted(!isVoiceMuted); break;
        case 'Escape': if (isSoundTestActive) setIsSoundTestActive(false); break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [engine, toggleMute, isVoiceMuted, isSoundTestActive]);

  const handleLoadData = async () => {
    const success = await engine.loadSaveCode(loadInputValue);
    if (success) {
      setLoadInputValue("");
      setIsLoadError(false);
    } else {
      setIsLoadError(true);
      setTimeout(() => setIsLoadError(false), 2000);
    }
  };

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
  const currentDescription = gameState.currentNuclide.description;

  // Determine input field styling based on validation (Cheat Engine Feedback)
  let inputBorderClass = isLoadError ? 'border-red-500' : 'border-gray-700';
  let inputShadowClass = '';
  if (cheatResult?.isReachable) {
      inputBorderClass = 'border-yellow-400';
      inputShadowClass = 'shadow-[0_0_15px_rgba(250,204,21,0.5)]';
  } else if (cheatResult) {
      // Command recognized but unreachable
      inputBorderClass = 'border-red-400';
  }

  return (
    <div ref={containerRef} tabIndex={0} 
      className={`min-h-screen bg-dark-bg text-gray-200 font-mono flex flex-col md:flex-row overflow-hidden relative outline-none ${isScreenShaking ? 'animate-shake' : ''}`}>
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
            reincarnations={gameState.reincarnations}
            onClose={() => setShowTable(false)} 
            canTransmute={transmutationReady} 
            onSelectElement={handleTransmuteWrapper}
            saveCode={saveCode}
        />
      )}

      {/* Side Panel */}
      <div className="order-2 md:order-1 w-full md:w-80 lg:w-96 bg-panel-bg border-r border-gray-800 flex flex-col h-auto md:h-screen overflow-y-auto z-20 select-none">
          <div className="hidden md:flex pt-2 pb-1.5 px-6 items-center border-b border-gray-800 shrink-0">
             <h1 className="text-lg font-black text-neon-blue tracking-tighter italic drop-shadow-[0_0_10px_rgba(0,243,255,0.5)]">NUCLEUS<span className="text-white text-[9px] not-italic font-normal tracking-widest ml-1 opacity-70">ROGUE</span></h1>
          </div>
          
          <InfoPanel 
            nuclide={gameState.currentNuclide} hp={gameState.hp} maxHp={gameState.maxHp} energyPoints={gameState.energyPoints} turn={gameState.turn} score={gameState.score} 
            // Fix: Corrected playerLevel to gameState.playerLevel
            onDecay={engine.handleDecayAction} disabled={gameState.gameOver || gameState.loadingData || gameState.isTimeStopped} playerLevel={gameState.playerLevel}
            isNucleosynthesisReady={isNucleosynthesisReady} isNucleosynthesisEnabled={isNucleosynthesisEnabled} transmutationReady={transmutationReady} energyPointsAvailable={energyPointsAvailable}
            onStabilize={engine.handleStabilize} onShowTable={() => setShowTable(true)} onUltimateSynthesis={engine.handleUltimateSynthesis} onForceDecay={engine.handleForceUnknownDecay}
          />
          
          <ControlPanel 
            combo={gameState.combo} isTimeStopped={gameState.isTimeStopped} lastComboTime={gameState.lastComboTime} description={currentDescription}
            activeEvent={gameState.activeEvent} tutorialMessage={gameState.tutorialMessage} bpm={bpm} lastKickTime={lastKickTime}
          />
          
          <div className="flex border-b border-gray-800 bg-gray-900/30">
             <button onClick={() => setActiveTab('structure')} className={`flex-1 py-2 text-[10px] uppercase tracking-widest font-bold transition-all border-b-2 ${activeTab === 'structure' ? 'border-neon-blue text-neon-blue bg-gray-800/50' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>Structure</button>
             <button onClick={() => setActiveTab('history')} className={`flex-1 py-2 text-[10px] uppercase tracking-widest font-bold transition-all border-b-2 ${activeTab === 'history' ? 'border-neon-green text-neon-green bg-gray-800/50' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>History</button>
          </div>

          <div className="p-4 border-b border-gray-800 shrink-0 h-64 flex flex-col items-center justify-center overflow-hidden">
             {activeTab === 'structure' ? <NucleusVisualizer z={gameState.currentNuclide.z} a={gameState.currentNuclide.a} symbol={gameState.currentNuclide.symbol} decayModes={gameState.currentNuclide.decayModes} lastDecayEvent={lastDecayEvent} isTimeStopped={gameState.isTimeStopped} /> : <EvolutionMap history={sortedHistory} currentNuclide={gameState.currentNuclide} turn={gameState.turn} />}
          </div>

          <div ref={scrollRef} className="flex-1 p-4 font-mono text-xs overflow-y-auto flex flex-col justify-start scroll-smooth select-none">
              <MessageLog messages={gameState.messages} turn={gameState.turn} />
          </div>

          <div className="p-4 border-t border-gray-800 shrink-0 bg-black/20">
              <div className="text-[9px] text-gray-500 uppercase tracking-widest mb-1 font-bold flex justify-between">
                <span>Cite Research</span>
                {cheatResult?.isReachable && <span className="text-yellow-400 animate-pulse">RESONANCE ESTABLISHED</span>}
              </div>
              <div className="flex gap-1">
                  <input 
                      type="text" value={loadInputValue} onChange={(e) => setLoadInputValue(e.target.value)} placeholder="Paste Password..."
                      className={`flex-1 bg-black/40 border ${inputBorderClass} ${inputShadowClass} rounded px-2 py-1 text-[10px] font-mono outline-none transition-all focus:border-neon-blue`}
                  />
                  <button onClick={handleLoadData} className="px-2 py-1 bg-neon-blue/20 border border-neon-blue/50 text-neon-blue rounded text-[9px] font-bold uppercase hover:bg-neon-blue hover:text-black transition-all">Load</button>
              </div>
          </div>

          <SidebarFooter 
            version={APP_VERSION}
            isMuted={isMuted}
            toggleMute={toggleMute}
            bpm={bpm}
            primaryMode={primaryMode}
            isVoiceMuted={isVoiceMuted}
            onToggleVoice={() => setIsVoiceMuted(!isVoiceMuted)}
          />
      </div>

      {/* Main Game Area */}
      <div className={`order-1 md:order-2 flex-1 flex flex-col items-center justify-start p-2 md:p-4 relative z-10 overflow-y-auto ${showTable ? 'touch-none' : ''}`}>
         <HealthBar hp={gameState.hp} maxHp={gameState.maxHp} nuclide={gameState.currentNuclide} onToggleTimeStop={engine.handleToggleTimeStop} isTimeStopped={gameState.isTimeStopped} level={gameState.playerLevel} barrierCharges={gameState.magicBarrierCharges} isSoundTestActive={isSoundTestActive} onHPChange={engine.setHP} />
         <div className="relative bg-panel-bg p-2 rounded-xl border border-gray-800 shadow-2xl w-full max-w-[95vw] md:w-auto overflow-hidden select-none">
            {gameState.isTimeStopped && <div className="absolute inset-0 z-[60] bg-neon-blue/10 backdrop-blur-[2px] flex items-center justify-center pointer-events-none"><div className="text-4xl md:text-6xl font-black italic text-neon-blue animate-pulse drop-shadow(0 0 20px #00f3ff) uppercase tracking-tighter">Frozen Time</div></div>}
            <Grid width={GRID_WIDTH} height={GRID_HEIGHT} gameState={gameState} onCellClick={engine.handleCellClick} finalCombo={finalCombo} cheatResult={cheatResult} />
            <GridStatusFooter gameState={gameState} />
            <GameOverOverlay isVisible={gameState.gameOver} reason={gameState.gameOverReason} nuclide={gameState.currentNuclide} onRestart={(rnd) => { setIsSoundTestActive(false); engine.restartGame(rnd); }} isSoundTestActive={isSoundTestActive} onToggleSoundTest={() => setIsSoundTestActive(!isSoundTestActive)} />
         </div>
      </div>
    </div>
  );
}

export default App;