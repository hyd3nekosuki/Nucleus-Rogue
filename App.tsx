import React, { useRef, useMemo, useCallback } from 'react';
// Triggering Vite reload to resolve potential HMR hang
import { GRID_WIDTH, GRID_HEIGHT, APP_VERSION, LOG_MESSAGES, getLogMessages } from './constants';
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
import { useOverrideValidator } from './hooks/useOverrideValidator';
import { useGameEventListener } from './hooks/useGameEventListener';
import { useGameUIState } from './hooks/ui/useGameUIState';
import { useKeyboardControls } from './hooks/input/useKeyboardControls';

function App() {
  // --- Refs ---
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // --- Logic Layer Setup ---
  const engine = useNucleusCoordinator();
  const { gameState } = engine;
  
  // --- UI/View Layer Setup ---
  const ui = useGameUIState(engine, scrollRef, containerRef);
  
  // Compute override result based on the real input state
  const activeOverrideResult = useOverrideValidator(ui.loadInputValue, gameState);
  
  // Local style calculation for the Cite Research input field
  const inputStyles = useMemo(() => {
    let borderClass = ui.isLoadError ? 'border-red-500' : 'border-gray-700';
    let shadowClass = '';
    if (activeOverrideResult?.isReachable) {
      borderClass = 'border-yellow-400';
      shadowClass = 'shadow-[0_0_15px_rgba(250,204,21,0.5)]';
    } else if (activeOverrideResult) {
      borderClass = 'border-red-400';
    }
    return { borderClass, shadowClass };
  }, [ui.isLoadError, activeOverrideResult]);

  // --- Audio & Speech Layer ---
  const logMessages = useMemo(() => getLogMessages(gameState.language), [gameState.language]);

  const { isMuted, toggleMute, bpm, primaryMode } = useAudioEngine(
      gameState.hp, 
      gameState.gameOver, 
      gameState.currentNuclide.decayModes,
      ui.isSoundTestActive,
      ui.setLastKick,
      gameState.lastEvent // SEイベント検知のために追加
  );
  
  const { triggerOverride: activeTTSTrigger } = useTTS(gameState.currentNuclide, gameState.gameOver, ui.isVoiceMuted);

  // --- Resonance Detection for Secret Mechanic ---
  const handleEngraveWithResonance = useCallback(() => {
    const now = Date.now();
    // Calculate timing relative to kick
    const beatMs = (60 / bpm) * 1000;
    const nextKick = ui.lastKickTime + beatMs;
    const diff = Math.min(Math.abs(now - ui.lastKickTime), Math.abs(now - nextKick));
    
    // Just window: +/- 100ms
    const isResonating = diff < 100; 
    engine.handleEngraveCurrent(isResonating);
  }, [engine, ui.lastKickTime, bpm]);

  // --- Listeners & Controls ---
  useKeyboardControls(engine, ui, toggleMute);
  useGameEventListener({
    onShake: engine.triggerShake,
    onFlash: engine.triggerFlash,
    onTTS: activeTTSTrigger
  });

  return (
    <div ref={containerRef} tabIndex={0} 
      className={`min-h-screen bg-dark-bg text-gray-200 font-mono flex flex-col md:flex-row overflow-hidden relative outline-none ${engine.isScreenShaking ? (engine.shakeIntensity === 'light' ? 'animate-shake-light' : 'animate-shake') : ''}`}>
      <div className={`pointer-events-none fixed inset-0 z-[100] ${engine.flashColor} mix-blend-screen transition-opacity duration-500 ${engine.isFlashBang ? 'opacity-100' : 'opacity-0'}`}></div>
      
      {ui.showTable && (
        <PeriodicTable 
            unlocked={gameState.unlockedElements} 
            unlockedGroups={gameState.unlockedGroups} 
            decayStats={gameState.decayStats} 
            reactionStats={gameState.reactionStats} 
            disabledSkills={gameState.disabledSkills} 
            onToggleSkill={engine.handleToggleHiddenSkill} 
            maxCombo={gameState.maxCombo} 
            reincarnations={gameState.reincarnations}
            onClose={() => ui.setShowTable(false)} 
            canTransmute={ui.transmutationReady} 
            onSelectElement={ui.handleTransmuteWrapper}
            saveCode={ui.saveCode}
            recordTime={gameState.recordTime}
            achievementTimes={gameState.achievementTimes}
            elapsedTime={gameState.elapsedTime}
            hasPerformedActiveReincarnation={gameState.hasPerformedActiveReincarnation}
        />
      )}

      {/* Side Panel */}
      <div className="order-2 md:order-1 w-full md:w-80 lg:w-96 bg-panel-bg border-r border-gray-800 flex flex-col h-auto md:h-screen overflow-y-auto z-20 select-none">
          <div className="hidden md:flex pt-2 pb-1.5 px-6 items-center border-b border-gray-800 shrink-0">
             <h1 className="text-lg font-black text-neon-blue tracking-tighter italic drop-shadow-[0_0_10px_rgba(0,243,255,0.5)]">NUCLEUS<span className="text-white text-[9px] not-italic font-normal tracking-widest ml-1 opacity-70">ROGUE</span></h1>
          </div>
          
          <InfoPanel 
            nuclide={gameState.currentNuclide} hp={gameState.hp} maxHp={gameState.maxHp} energyPoints={gameState.energyPoints} turn={gameState.turn} score={gameState.score} 
            onDecay={engine.handleDecayAction} disabled={gameState.gameOver || gameState.loadingData || gameState.isTimeStopped} playerLevel={gameState.playerLevel}
            isNucleosynthesisReady={ui.isNucleosynthesisReady} isNucleosynthesisEnabled={ui.isNucleosynthesisEnabled} transmutationReady={ui.transmutationReady} energyPointsAvailable={ui.energyPointsAvailable}
            onStabilize={engine.handleStabilize} onShowTable={() => { ui.setShowTable(true); engine.handleOpenMastery(); }} onUltimateSynthesis={engine.handleUltimateSynthesis} onForceDecay={engine.handleForceUnknownDecay}
            language={gameState.language}
          />
          
          <ControlPanel 
            z={gameState.currentNuclide.z} a={gameState.currentNuclide.a}
            combo={gameState.combo} comboOrigin={gameState.comboOrigin} isTimeStopped={gameState.isTimeStopped} lastComboTime={gameState.lastComboTime} description={gameState.currentNuclide.description}
            activeEvent={gameState.activeEvent} tutorialMessage={gameState.tutorialMessage} bpm={bpm} lastKickTime={ui.lastKickTime}
          />
          
          <div className="flex border-b border-gray-800 bg-gray-900/30">
             <button onClick={() => ui.setActiveTab('structure')} className={`flex-1 py-1.5 text-[10px] uppercase tracking-widest font-bold transition-all border-b-2 ${ui.activeTab === 'structure' ? 'border-neon-blue text-neon-blue bg-gray-800/50' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>Structure</button>
             <button onClick={() => ui.setActiveTab('history')} className={`flex-1 py-1.5 text-[10px] uppercase tracking-widest font-bold transition-all border-b-2 ${ui.activeTab === 'history' ? 'border-neon-green text-neon-green bg-gray-800/50' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>History</button>
          </div>

          <div className="p-4 border-b border-gray-800 shrink-0 h-80 flex flex-col items-center justify-center overflow-hidden">
             {ui.activeTab === 'structure' ? (
                <NucleusVisualizer 
                    z={gameState.currentNuclide.z} 
                    a={gameState.currentNuclide.a} 
                    symbol={gameState.currentNuclide.symbol} 
                    decayModes={gameState.currentNuclide.decayModes} 
                    lastDecayEvent={engine.lastDecayEvent} 
                    isTimeStopped={gameState.isTimeStopped}
                    onClick={handleEngraveWithResonance}
                    isEngraved={gameState.evolutionHistory[`${gameState.currentNuclide.z}-${gameState.currentNuclide.a}`]?.isEngraved}
                />
             ) : (
                <EvolutionMap 
                    history={ui.sortedHistory} 
                    currentNuclide={gameState.currentNuclide} 
                    turn={gameState.turn} 
                    combo={gameState.combo} 
                    comboOrigin={gameState.comboOrigin} 
                />
             )}
          </div>

          <div ref={scrollRef} className="flex-1 p-4 font-mono text-xs overflow-y-auto flex flex-col justify-start scroll-smooth select-none">
              <MessageLog messages={gameState.messages} turn={gameState.turn} />
          </div>

          <div className="p-4 border-t border-gray-800 shrink-0 bg-black/20">
              <div className="text-[9px] text-gray-500 uppercase tracking-widest mb-1 font-bold flex justify-between">
                <span>Cite Research</span>
                {activeOverrideResult?.isReachable && <span className="text-yellow-400 animate-pulse">RESONANCE ESTABLISHED</span>}
              </div>
              <div className="flex gap-1">
                  <input 
                      type="text" value={ui.loadInputValue} onChange={(e) => ui.setLoadInputValue(e.target.value)} placeholder="Paste Password..."
                      className={`flex-1 bg-black/40 border ${inputStyles.borderClass} ${inputStyles.shadowClass} rounded px-2 py-1 text-[10px] font-mono outline-none transition-all focus:border-neon-blue`}
                  />
                  <button onClick={ui.handleLoadData} className="px-2 py-1 bg-neon-blue/20 border border-neon-blue/50 text-neon-blue rounded text-[9px] font-bold uppercase hover:bg-neon-blue hover:text-black transition-all">Load</button>
              </div>
          </div>

          <SidebarFooter 
            version={APP_VERSION} isMuted={isMuted} toggleMute={toggleMute} bpm={bpm} primaryMode={primaryMode} isVoiceMuted={ui.isVoiceMuted} onToggleVoice={ui.toggleVoiceMute}
            language={gameState.language} onToggleLanguage={() => engine.setLanguage(gameState.language === 'en' ? 'jp' : 'en')}
          />
      </div>

      {/* Main Game Area */}
      <div className={`order-1 md:order-2 flex-1 flex flex-col items-center justify-start p-2 md:p-4 relative z-10 overflow-y-auto ${ui.showTable ? 'touch-none' : ''}`}>
         <HealthBar 
            hp={gameState.hp} maxHp={gameState.maxHp} nuclide={gameState.currentNuclide} onToggleTimeStop={engine.handleToggleTimeStop} isTimeStopped={gameState.isTimeStopped} level={gameState.playerLevel} barrierCharges={gameState.magicBarrierCharges} isSoundTestActive={ui.isSoundTestActive} onHPChange={engine.setHP} 
            language={gameState.language}
         />
         <div className="relative bg-panel-bg p-2 rounded-xl border border-gray-800 shadow-2xl w-full max-w-[95vw] md:w-auto overflow-hidden select-none">
            {gameState.isTimeStopped && (
              <div className="absolute inset-0 z-[60] bg-neon-blue/10 backdrop-blur-[2px] flex items-center justify-center pointer-events-none">
                <div className="flex flex-col items-center">
                  <div className="text-4xl md:text-6xl font-black italic text-neon-blue animate-pulse drop-shadow(0 0 20px #00f3ff) uppercase tracking-tighter">Frozen Time</div>
                  <div className="text-xl md:text-2xl font-mono text-neon-blue mt-2 drop-shadow(0 0 10px #00f3ff) opacity-80">{(gameState.elapsedTime / 1000).toFixed(2)}s</div>
                </div>
              </div>
            )}
            {(gameState.tutorialMessage === logMessages.TUTORIAL.OGANESSON_CONGRATS || gameState.tutorialMessage === logMessages.TUTORIAL.ALL_ELEMENTS_COMPLETE) && gameState.recordTime !== undefined && (
              <div className="absolute inset-0 z-[60] bg-yellow-400/10 backdrop-blur-[4px] flex items-center justify-center pointer-events-none">
                <div key={gameState.tutorialMessage} className="flex flex-col items-center animate-fade-in">
                  <div className="text-xs md:text-sm font-bold text-yellow-400 uppercase tracking-[0.3em] mb-2 drop-shadow-[0_0_5px_rgba(250,204,21,0.5)]">Achievement Unlocked</div>
                  <div className="text-3xl md:text-5xl font-black italic text-white drop-shadow-[0_0_20px_rgba(255,255,255,0.8)] uppercase tracking-tighter text-center px-4">
                    {gameState.tutorialMessage === logMessages.TUTORIAL.ALL_ELEMENTS_COMPLETE ? 'Periodic Table Completed' : 'FAR BEYOND BOUNDARY'}
                  </div>
                  <div className="mt-6 flex flex-col items-center">
                    <div className="text-[10px] text-yellow-400/70 uppercase tracking-widest font-bold">Completion Time</div>
                    <div className="text-4xl md:text-6xl font-mono text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.5)]">
                      {(gameState.recordTime / 1000).toFixed(2)}s
                    </div>
                  </div>
                  <div className="mt-8 text-[9px] text-white/40 uppercase tracking-[0.2em] animate-pulse">
                    Take any action to continue
                  </div>
                </div>
              </div>
            )}
            <Grid 
                width={GRID_WIDTH} height={GRID_HEIGHT} gameState={gameState} 
                onCellClick={engine.handleCellClick} 
                finalCombo={engine.finalCombo} overrideResult={activeOverrideResult} 
            />
            <GridStatusFooter gameState={gameState} />
            <GameOverOverlay isVisible={gameState.gameOver} reason={gameState.gameOverReason} nuclide={gameState.currentNuclide} onRestart={(rnd) => { ui.closeSoundTest(); engine.restartGame(rnd); }} isSoundTestActive={ui.isSoundTestActive} onToggleSoundTest={ui.toggleSoundTest} language={gameState.language} />
         </div>
      </div>
    </div>
  );
}

export default App;