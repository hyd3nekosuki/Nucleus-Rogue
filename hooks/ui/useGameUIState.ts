
import { useState, useEffect, useCallback, useMemo, RefObject } from 'react';
import { useNucleusCoordinator } from '../../engine/useNucleusCoordinator';
import { MAGIC_NUMBERS } from '../../constants/physics';
import { STABILIZE_COST, NUCLEOSYNTHESIS_COST } from '../../constants/economy';
import { HistoryEntry } from '../../types';

/**
 * Hook to manage the presentation layer state and derived view logic.
 * Encapsulates all calculations for button states, styles, and DOM interactions.
 */
export const useGameUIState = (
  engine: ReturnType<typeof useNucleusCoordinator>,
  scrollRef: RefObject<HTMLDivElement | null>,
  containerRef: RefObject<HTMLDivElement | null>
) => {
  const { gameState, evolutionHistory } = engine;

  // --- Base UI State ---
  const [showTable, setShowTable] = useState(false);
  const [saveCode, setSaveCode] = useState("");
  const [loadInputValue, setLoadInputValue] = useState("");
  const [isLoadError, setIsLoadError] = useState(false);
  const [activeTab, setActiveTab] = useState<'history' | 'structure'>('structure');
  const [isVoiceMuted, setIsVoiceMuted] = useState(true);
  const [isSoundTestActive, setIsSoundTestActive] = useState(false);
  const [lastKickTime, setLastKickTime] = useState(0);

  // --- Derived View Logic ---
  
  const isNucleosynthesisEnabled = !gameState.disabledSkills.includes("Nucleosynthesis");
  const isTransmutationEnabled = !gameState.disabledSkills.includes("Exp. Replicate");
  
  const isNucleosynthesisReady = gameState.energyPoints >= NUCLEOSYNTHESIS_COST && 
                                gameState.playerLevel >= 5 && 
                                isNucleosynthesisEnabled;

  const transmutationReady = MAGIC_NUMBERS.includes(gameState.currentNuclide.z) && 
                            MAGIC_NUMBERS.includes(gameState.currentNuclide.a - gameState.currentNuclide.z) && 
                            gameState.isTimeStopped && 
                            gameState.playerLevel >= 4 && 
                            isTransmutationEnabled;

  const energyCost = isNucleosynthesisReady ? NUCLEOSYNTHESIS_COST : STABILIZE_COST;
  const energyPointsAvailable = gameState.energyPoints >= energyCost;

  const sortedHistory = useMemo(() => {
    return (Object.values(evolutionHistory) as HistoryEntry[]).sort((a, b) => a.lastTurn - b.lastTurn);
  }, [evolutionHistory]);

  // --- Callbacks ---

  const handleLoadData = useCallback(async () => {
    // Calling the integrated facade: handleLoad
    const success = await engine.handleLoad(loadInputValue);
    if (success) {
      setLoadInputValue("");
      setIsLoadError(false);
    } else {
      setIsLoadError(true);
      setTimeout(() => setIsLoadError(false), 2000);
    }
  }, [engine, loadInputValue]);

  const handleTransmuteWrapper = useCallback((z: number) => {
    engine.handleTransmute(z);
    setShowTable(false);
  }, [engine]);

  const setLastKick = useCallback(() => {
    setLastKickTime(Date.now());
  }, []);

  const toggleVoiceMute = useCallback(() => setIsVoiceMuted(prev => !prev), []);
  const toggleSoundTest = useCallback(() => setIsSoundTestActive(prev => !prev), []);
  const closeSoundTest = useCallback(() => setIsSoundTestActive(false), []);

  // --- DOM Effects ---

  // Focus management
  useEffect(() => {
    if (containerRef.current) containerRef.current.focus();
  }, [containerRef]);

  // Message log scroll synchronization
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [gameState.messages, scrollRef]);

  // Body overflow management
  useEffect(() => {
    if (showTable) {
        document.body.style.overflow = 'hidden';
        engine.generateSaveCode().then(code => setSaveCode(code));
    } else {
        document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [showTable, engine]);

  return {
    // States
    showTable, setShowTable,
    saveCode,
    loadInputValue, setLoadInputValue,
    activeTab, setActiveTab,
    isVoiceMuted, toggleVoiceMute,
    isSoundTestActive, toggleSoundTest, closeSoundTest,
    lastKickTime, setLastKick,
    isLoadError,
    // Derived values
    isNucleosynthesisReady,
    isNucleosynthesisEnabled,
    transmutationReady,
    energyPointsAvailable,
    sortedHistory,
    // Handlers
    handleLoadData,
    handleTransmuteWrapper
  };
};
