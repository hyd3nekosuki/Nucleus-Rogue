
import { GoogleGenAI } from "@google/genai";
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GameState, EntityType, DecayMode, VisualEffect } from './types';
import { GRID_WIDTH, GRID_HEIGHT, INITIAL_HP, INITIAL_NUCLIDE, MAGIC_NUMBERS, APP_VERSION } from './constants';
import { getNuclideDataSync, getValidAsForZ } from './services/nuclideService';
import { getRandomKnownNuclideCoordinates } from './data/staticNuclides';
import Grid from './components/Grid';
import InfoPanel from './components/InfoPanel';
import ControlPanel from './components/ControlPanel';
import PeriodicTable from './components/PeriodicTable';
import HealthBar from './components/HealthBar';
import GameOverOverlay from './components/GameOverOverlay';
import NucleusVisualizer from './components/NucleusVisualizer';
import TrefoilIndicator from './components/TrefoilIndicator';
import EvolutionMap from './components/EvolutionMap';
import { generateEntities, calculateMoveResult } from './utils/gameLogic';
import { processUnlocks } from './utils/unlockSystem';
import { calculateDecayEffects, getDecayDeltas } from './utils/decaySystem';
import { useTTS } from './hooks/useTTS';

const COMBO_WINDOW_MS = 8000;
const ENERGY_EVOLUTION_TURNS = 60; 
const COULOMB_BARRIER_THRESHOLD = 20;
const STABILIZE_COST = 5;
const NUCLEOSYNTHESIS_COST = 200;

interface HistoryEntry {
    turn: number;
    name: string;
    symbol: string;
    z: number;
    a: number;
    method: string;
}

const getInitialState = (): GameState => ({
    turn: 0,
    score: 0,
    energyPoints: 0,
    playerPos: { x: Math.floor(GRID_WIDTH / 2), y: Math.floor(GRID_HEIGHT / 2) },
    gridEntities: [],
    currentNuclide: INITIAL_NUCLIDE,
    hp: INITIAL_HP,
    maxHp: INITIAL_HP,
    messages: ["Welcome to the Nucleus!", "Master radioactive decays to increase your Mastery Level."],
    gameOver: false,
    gameOverReason: undefined,
    loadingData: false,
    unlockedElements: [], 
    unlockedGroups: [],
    disabledSkills: [],
    effects: [],
    combo: 0,
    maxCombo: 0,
    lastComboTime: 0,
    isTimeStopped: false,
    playerLevel: 0,
    masteredDecays: [],
    comboScore: 0,
    consecutiveProtons: 0,
    consecutiveNeutrons: 0,
    consecutiveElectrons: 0,
    lastConsumedType: null,
    decayStats: {
        [DecayMode.ALPHA]: 0,
        [DecayMode.BETA_MINUS]: 0,
        [DecayMode.BETA_PLUS]: 0,
        [DecayMode.ELECTRON_CAPTURE]: 0,
        [DecayMode.SPONTANEOUS_FISSION]: 0,
        [DecayMode.NEUTRON_EMISSION]: 0,
        [DecayMode.PROTON_EMISSION]: 0,
        [DecayMode.GAMMA]: 0,
    },
    reactionStats: {
        "(n,γ)": 0,
        "(n,p)": 0,
        "(n,2n)": 0,
        "(n,α)": 0,
        "(n,fission)": 0,
    }
});

function App() {
  const [gameState, setGameState] = useState<GameState>(getInitialState());
  const [evolutionHistory, setEvolutionHistory] = useState<HistoryEntry[]>([]);
  const [showTable, setShowTable] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const [isScreenShaking, setIsScreenShaking] = useState(false);
  const [isFlashBang, setIsFlashBang] = useState(false);
  const [flashColor, setFlashColor] = useState('bg-neon-blue'); 

  const [lastDecayEvent, setLastDecayEvent] = useState<{mode: DecayMode, timestamp: number} | null>(null);
  const [finalCombo, setFinalCombo] = useState<{count: number, id: number} | null>(null);
  const [activeTab, setActiveTab] = useState<'history' | 'structure'>('structure');

  const touchStartRef = useRef<{x: number, y: number} | null>(null);
  const moveIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const moveQueueRef = useRef<{dx: number, dy: number}[]>([]);
  const continuousDirRef = useRef<{dx: number, dy: number} | null>(null);

  const { triggerOverride } = useTTS(gameState.currentNuclide, gameState.gameOver);

  const isAnnihilationEnabled = !gameState.disabledSkills.includes("Pair anihilation");
  const isTemporalEnabled = !gameState.disabledSkills.includes("Temporal Inversion");
  const isNucleosynthesisEnabled = !gameState.disabledSkills.includes("Nucleosynthesis");
  const isTransmutationEnabled = !gameState.disabledSkills.includes("Exp. Replicate");
  const isFissionEnabled = !gameState.disabledSkills.includes("Fission");

  const isNucleosynthesisReady = gameState.energyPoints >= NUCLEOSYNTHESIS_COST && gameState.playerLevel >= 5 && isNucleosynthesisEnabled;

  useEffect(() => {
    if (containerRef.current) containerRef.current.focus();
  }, []);

  useEffect(() => {
    const initialEntities = generateEntities(5, [], gameState.playerPos, 0);
    setGameState(prev => ({
        ...prev,
        gridEntities: initialEntities
    }));
    setEvolutionHistory([{
        turn: 0,
        name: INITIAL_NUCLIDE.name,
        symbol: INITIAL_NUCLIDE.symbol,
        z: INITIAL_NUCLIDE.z,
        a: INITIAL_NUCLIDE.a,
        method: "Origin"
    }]);
  }, []);

  useEffect(() => {
      if (gameState.effects.length === 0) return;
      const timer = setTimeout(() => {
          setGameState(prev => {
              const now = Date.now();
              const remainingEffects = prev.effects.filter(e => now - e.timestamp < 1000);
              if (remainingEffects.length === prev.effects.length) return prev;
              return { ...prev, effects: remainingEffects };
          });
      }, 500);
      return () => clearTimeout(timer);
  }, [gameState.effects]);

  // Combo Timer Effect
  useEffect(() => {
      if (gameState.combo === 0 || gameState.gameOver || gameState.isTimeStopped) return;
      const interval = setInterval(() => {
          const now = Date.now();
          if (now - gameState.lastComboTime > COMBO_WINDOW_MS) {
              setGameState(prev => {
                  if (prev.combo === 0) return prev;

                  // Check Temporal Inversion on natural timeout
                  let inversionMatched = false;
                  if (prev.comboStartNuclide && prev.currentNuclide.z === prev.comboStartNuclide.z && prev.currentNuclide.a === prev.comboStartNuclide.a) {
                      if (!prev.disabledSkills.includes("Temporal Inversion")) {
                          inversionMatched = true;
                      }
                  }

                  if (inversionMatched) {
                      const unlockResult = processUnlocks(prev.unlockedElements, prev.unlockedGroups, prev.currentNuclide.z, prev.currentNuclide.a, false, false, false, true, prev.comboScore);
                      if (prev.combo >= 2) setFinalCombo({ count: prev.combo, id: Date.now() });
                      return { 
                          ...prev, 
                          score: prev.score + unlockResult.scoreBonus,
                          unlockedGroups: unlockResult.updatedGroups,
                          messages: [...prev.messages, ...unlockResult.messages].slice(-5),
                          combo: 0, 
                          comboScore: 0, 
                          comboStartNuclide: undefined 
                      };
                  }

                  if (prev.combo >= 2) setFinalCombo({ count: prev.combo, id: Date.now() });
                  return { ...prev, combo: 0, comboScore: 0, comboStartNuclide: undefined };
              });
          }
      }, 1000);
      return () => clearInterval(interval);
  }, [gameState.combo, gameState.lastComboTime, gameState.gameOver, gameState.isTimeStopped]);

  useEffect(() => {
    if (gameState.gameOver) return;
    let timer: ReturnType<typeof setInterval>;
    if (!gameState.currentNuclide.isStable) {
        const hl = gameState.currentNuclide.halfLifeSeconds;
        let decayRate = 1000, damage = 1;
        if (hl > 3600) { decayRate = 2000; damage = 0; }
        else if (hl > 60) { decayRate = 1000; damage = 1; }
        else if (hl > 1) { decayRate = 500; damage = 2; }
        else { decayRate = 200; damage = 5; }

        timer = setInterval(() => {
            setGameState(prev => {
                if (prev.isTimeStopped) return prev; 
                const newHp = Math.min(prev.maxHp, Math.max(0, prev.hp - damage));
                if (newHp === 0 && !prev.gameOver) {
                    // Temporal Inversion: Auto Stabilization
                    if (prev.unlockedGroups.includes("Temporal Inversion") && !prev.disabledSkills.includes("Temporal Inversion") && prev.energyPoints >= 5) {
                        return {
                            ...prev,
                            hp: prev.maxHp,
                            energyPoints: prev.energyPoints - 5,
                            messages: [...prev.messages, "⏱ AUTO-STABILIZATION: Temporal Inversion triggered!"].slice(-5),
                            effects: [...prev.effects, { id: Math.random().toString(36).substr(2, 9), type: DecayMode.STABILIZE_ZAP, position: { ...prev.playerPos }, timestamp: Date.now() }]
                        };
                    }
                    return { ...prev, hp: 0, energyPoints: 0, gameOver: true, gameOverReason: "CRITICAL_DECAY", combo: 0, comboScore: 0, comboStartNuclide: undefined };
                }
                return { ...prev, hp: newHp };
            });
        }, decayRate);
    }
    return () => timer && clearInterval(timer);
  }, [gameState.currentNuclide, gameState.gameOver, gameState.isTimeStopped]);

  const stopAutoMove = useCallback(() => {
      if (moveIntervalRef.current) {
          clearInterval(moveIntervalRef.current);
          moveIntervalRef.current = null;
      }
      moveQueueRef.current = [];
      continuousDirRef.current = null;
  }, []);

  const handleStabilize = useCallback(() => {
    if (gameState.playerLevel < 2) return;

    setGameState(prev => {
        const isSynth = prev.energyPoints >= NUCLEOSYNTHESIS_COST && prev.playerLevel >= 5 && !prev.disabledSkills.includes("Nucleosynthesis");
        const cost = isSynth ? NUCLEOSYNTHESIS_COST : STABILIZE_COST;
        
        if (prev.energyPoints < cost) {
            return {
                ...prev,
                messages: [...prev.messages, `⚠️ Not enough energy! Need ${cost}E.`].slice(-5)
            };
        }
        
        const now = Date.now();
        const effectType = isSynth ? DecayMode.NUCLEOSYNTHESIS_ZAP : DecayMode.STABILIZE_ZAP;
        const zapEffect: VisualEffect = {
            id: Math.random().toString(36).substr(2, 9),
            type: effectType,
            position: { ...prev.playerPos },
            timestamp: now
        };

        if (isSynth) {
            const nextZ = prev.currentNuclide.z + 1;
            if (nextZ > 118) {
                return { ...prev, messages: [...prev.messages, "⚠️ Oganesson limit reached!"].slice(-5) };
            }

            const validAs = getValidAsForZ(nextZ);
            if (validAs.length === 0) {
                return { ...prev, messages: [...prev.messages, "⚠️ Synthesis failed: Unstable zone."].slice(-5) };
            }

            const randomA = validAs[Math.floor(Math.random() * validAs.length)];
            const newData = getNuclideDataSync(nextZ, randomA);
            
            if (newData.exists) {
                const unlockResult = processUnlocks(prev.unlockedElements, prev.unlockedGroups, nextZ, randomA, false, false, true);
                triggerOverride("Nucleosynthesis Complete");
                setFlashColor('bg-white'); // Nucleosynthesis is pure blinding white
                setIsFlashBang(true);
                setTimeout(() => setIsFlashBang(false), 800);

                setEvolutionHistory(h => [...h, {
                    turn: prev.turn,
                    name: newData.name,
                    symbol: newData.symbol,
                    z: newData.z,
                    a: newData.a,
                    method: "Nucleosynthesis"
                }]);
                
                // NEW FORMULA: (targetZ) * 10,000 pts
                const synthBonus = nextZ * 10000;

                return {
                    ...prev,
                    currentNuclide: newData,
                    hp: prev.maxHp,
                    energyPoints: prev.energyPoints - NUCLEOSYNTHESIS_COST,
                    score: prev.score + synthBonus + unlockResult.scoreBonus,
                    effects: [...prev.effects, zapEffect],
                    unlockedElements: unlockResult.updatedElements,
                    unlockedGroups: unlockResult.updatedGroups,
                    messages: [...prev.messages, `🌟 NUCLEOSYNTHESIS: Synthesized ${newData.name}! (+${synthBonus.toLocaleString()} PTS)`, ...unlockResult.messages].slice(-5),
                    isTimeStopped: false,
                    consecutiveProtons: 0,
                    consecutiveNeutrons: 0,
                    consecutiveElectrons: 0,
                    lastConsumedType: null
                };
            }
            return prev;
        } else {
            return {
                ...prev,
                hp: prev.maxHp,
                energyPoints: prev.energyPoints - STABILIZE_COST,
                effects: [...prev.effects, zapEffect],
                messages: [...prev.messages, `🔬 Stabilization: HP Recovered.`].slice(-5)
            };
        }
    });
  }, [gameState.playerLevel, triggerOverride]);

  const moveStep = useCallback((dx: number, dy: number) => {
      setGameState(prev => {
          if (prev.gameOver || prev.loadingData || prev.isTimeStopped) {
              stopAutoMove();
              return prev;
          }

          const result = calculateMoveResult(prev, dx, dy, COULOMB_BARRIER_THRESHOLD, ENERGY_EVOLUTION_TURNS, prev.playerLevel);
          if (!result.moved) {
              if (continuousDirRef.current) stopAutoMove();
              return prev;
          }

          const nextState = { ...result.state };
          if (nextState.gameOver) {
            nextState.energyPoints = 0;
          }

          if (result.inducedDecayMode && result.inducedReactionLabel) {
              setLastDecayEvent({ mode: result.inducedDecayMode, timestamp: Date.now() });
              
              // Increment REACTION stat for induced decay
              nextState.reactionStats = {
                  ...nextState.reactionStats,
                  [result.inducedReactionLabel]: (nextState.reactionStats[result.inducedReactionLabel] || 0) + 1
              };

              if (result.shouldShake) { setIsScreenShaking(true); setTimeout(() => setIsScreenShaking(false), 300); }
              if (result.shouldFlash) {
                  // Neutron-induced reactions use neon-blue
                  setFlashColor('bg-neon-blue');
                  setIsFlashBang(true); 
                  setTimeout(() => setIsFlashBang(false), 500); 
              }
              if (result.additionalEffects) {
                  nextState.effects = [...nextState.effects, ...result.additionalEffects];
              }
          }

          if (nextState.currentNuclide.z !== prev.currentNuclide.z || nextState.currentNuclide.a !== prev.currentNuclide.a) {
                if (!result.inducedDecayMode) setLastDecayEvent(null);
                
                const targetEntity = prev.gridEntities.find(e => e.position.x === nextState.playerPos.x && e.position.y === nextState.playerPos.y);
                let method = "Transmutation";
                
                if (result.isPpFusion) {
                    method = "fusion";
                    triggerOverride("Nuclear Fusion");
                } else if (result.isPositronAbsorption) {
                    method = "Positron capture";
                } else if (targetEntity) {
                    if (targetEntity.type === EntityType.PROTON) method = "Proton Capture";
                    else if (targetEntity.type === EntityType.NEUTRON) method = "Neutron Capture";
                    else if (targetEntity.type === EntityType.ENEMY_ELECTRON) method = "Electron Capture";
                }
                
                if (result.inducedDecayMode) {
                    if (result.inducedDecayMode === DecayMode.SPONTANEOUS_FISSION) {
                        method = "Neutron-induced fission";
                    } else {
                        method = `Induced ${result.inducedDecayMode.replace(/_/g, ' ')}`;
                    }
                }

                setEvolutionHistory(h => [...h, {
                    turn: nextState.turn,
                    name: nextState.currentNuclide.name,
                    symbol: nextState.currentNuclide.symbol,
                    z: nextState.currentNuclide.z,
                    a: nextState.currentNuclide.a,
                    method
                }]);

                // Combo Start Logic
                if (nextState.combo === 0 && !nextState.currentNuclide.isStable) {
                    nextState.comboStartNuclide = { z: prev.currentNuclide.z, a: prev.currentNuclide.a };
                }
                
                const scoreDiff = nextState.score - prev.score;
                nextState.comboScore = (nextState.combo === 0) ? scoreDiff : prev.comboScore + scoreDiff;

                // Combo End Logic (Stable)
                if (nextState.currentNuclide.isStable && prev.combo > 0) {
                    // Check Temporal Inversion
                    let inversionMatched = false;
                    if (prev.comboStartNuclide && nextState.currentNuclide.z === prev.comboStartNuclide.z && nextState.currentNuclide.a === prev.comboStartNuclide.a) {
                        if (!prev.disabledSkills.includes("Temporal Inversion")) {
                            inversionMatched = true;
                        }
                    }

                    if (inversionMatched) {
                        const unlockResult = processUnlocks(nextState.unlockedElements, nextState.unlockedGroups, nextState.currentNuclide.z, nextState.currentNuclide.a, false, false, false, true, nextState.comboScore, false, false, false, false, false, nextState.decayStats[DecayMode.BETA_PLUS], nextState.decayStats[DecayMode.BETA_MINUS]);
                        nextState.score += unlockResult.scoreBonus;
                        nextState.unlockedGroups = unlockResult.updatedGroups;
                        nextState.messages = [...nextState.messages, ...unlockResult.messages].slice(-5);
                    }

                    if (prev.combo >= 2) {
                        setFinalCombo({ count: prev.combo, id: Date.now() }); 
                    }
                    nextState.combo = 0;
                    nextState.comboScore = 0;
                    nextState.comboStartNuclide = undefined;
                }
          }

          // Temporal Inversion Check for Move Result
          if (nextState.hp <= 0 && !nextState.gameOver) {
              if (nextState.unlockedGroups.includes("Temporal Inversion") && !nextState.disabledSkills.includes("Temporal Inversion") && nextState.energyPoints >= 5) {
                  nextState.hp = nextState.maxHp;
                  nextState.energyPoints -= 5;
                  nextState.messages = [...nextState.messages, "⏱ AUTO-STABILIZATION: Temporal Inversion triggered!"].slice(-5);
                  nextState.effects = [...nextState.effects, { id: Math.random().toString(36).substr(2, 9), type: DecayMode.STABILIZE_ZAP, position: { ...nextState.playerPos }, timestamp: Date.now() }];
              } else {
                  nextState.gameOver = true;
                  nextState.gameOverReason = nextState.gameOverReason || "PARTICLE_COLLISION";
                  nextState.combo = 0;
                  nextState.comboScore = 0;
                  nextState.comboStartNuclide = undefined;
              }
          }

          return nextState;
      });
  }, [stopAutoMove, triggerOverride]);

  const startMovementLoop = useCallback(() => {
      if (moveIntervalRef.current) clearInterval(moveIntervalRef.current);
      moveIntervalRef.current = setInterval(() => {
          if (moveQueueRef.current.length > 0) {
              const step = moveQueueRef.current.shift();
              if (step) moveStep(step.dx, step.dy);
          } else if (continuousDirRef.current) {
              moveStep(continuousDirRef.current.dx, continuousDirRef.current.dy);
          } else {
              stopAutoMove();
          }
      }, 100);
  }, [moveStep, stopAutoMove]);

  const startPathMove = useCallback((path: {dx: number, dy: number}[]) => {
      stopAutoMove();
      moveQueueRef.current = path;
      startMovementLoop();
  }, [stopAutoMove, startMovementLoop]);

  const handleTouchStart = (e: React.TouchEvent) => { touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; };
  const handleTouchEnd = (e: React.TouchEvent) => {
      if (!touchStartRef.current) return;
      const touchEnd = { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
      const dx = touchEnd.x - touchStartRef.current.x, dy = touchEnd.y - touchStartRef.current.y;
      if (Math.max(Math.abs(dx), Math.abs(dy)) > 30) {
          stopAutoMove(); 
          if (Math.abs(dx) > Math.abs(dy)) { 
              continuousDirRef.current = { dx: dx > 0 ? 1 : -1, dy: 0 }; 
              moveStep(dx > 0 ? 1 : -1, 0); 
          } else { 
              continuousDirRef.current = { dx: 0, dy: dy > 0 ? 1 : -1 }; 
              moveStep(0, dy > 0 ? 1 : -1); 
          }
          startMovementLoop(); 
      }
      touchStartRef.current = null;
  };

  const handleDecayAction = useCallback((mode: DecayMode) => {
      stopAutoMove(); 
      if (gameState.gameOver || gameState.loadingData || gameState.isTimeStopped) return;
      
      const currentTime = Date.now();
      let actualMode = mode;

      if (mode === DecayMode.UNKNOWN) {
          const candidates = [DecayMode.ALPHA, DecayMode.BETA_MINUS, DecayMode.BETA_PLUS, DecayMode.PROTON_EMISSION, DecayMode.NEUTRON_EMISSION, DecayMode.SPONTANEOUS_FISSION, DecayMode.GAMMA];
          let found = false, attempts = 0;
          while (!found && attempts < 50) {
              attempts++;
              const rnd = candidates[Math.floor(Math.random() * candidates.length)];
              if (rnd === DecayMode.GAMMA) { actualMode = rnd; found = true; break; }
              const deltas = getDecayDeltas(rnd);
              if (getNuclideDataSync(gameState.currentNuclide.z + deltas.dZ, gameState.currentNuclide.a + deltas.dA).exists) { actualMode = rnd; found = true; }
          }
          if (!found) return;
      }

      // Skill Toggles check
      const isPairUnlocked = gameState.unlockedGroups.includes("Pair anihilation");
      const isPairEnabled = !gameState.disabledSkills.includes("Pair anihilation");
      
      const isNeutronStarUnlocked = gameState.unlockedGroups.includes("Neutronization");
      const isNeutronStarEnabled = !gameState.disabledSkills.includes("Neutronization");

      // NEW ANNIHILATION RULES: 
      // Beta Minus can ALWAYS annihilate. 
      // Beta Plus needs skill UNLOCKED and ON.
      const annihilationEnabled = actualMode === DecayMode.BETA_MINUS ? true : (isPairUnlocked && isPairEnabled);
      const fissionEnabled = !gameState.disabledSkills.includes("Fission");

      const decayResult = calculateDecayEffects(actualMode, gameState, currentTime, annihilationEnabled, fissionEnabled, isNeutronStarUnlocked && isNeutronStarEnabled);
      if (decayResult.dZ === 0 && decayResult.dA === 0 && decayResult.trigger === "") return; 
      
      // Map SPONTANEOUS_FISSION visuals to ALPHA if fission skill is disabled
      const visualMode = (actualMode === DecayMode.SPONTANEOUS_FISSION && !fissionEnabled) ? DecayMode.ALPHA : actualMode;
      setLastDecayEvent({ mode: visualMode, timestamp: currentTime });
      
      if (decayResult.shouldShake) { setIsScreenShaking(true); setTimeout(() => setIsScreenShaking(false), 300); }
      if (decayResult.shouldFlash) { 
          // Spontaneous fission (manual action) still uses yellow flash for distinction
          setFlashColor(visualMode === DecayMode.SPONTANEOUS_FISSION ? 'bg-yellow-400' : 'bg-neon-blue');
          setIsFlashBang(true); 
          setTimeout(() => setIsFlashBang(false), 500); 
      }
      if (decayResult.speechOverride) triggerOverride(decayResult.speechOverride);
      
      setGameState(prev => {
          const newData = getNuclideDataSync(prev.currentNuclide.z + decayResult.dZ, prev.currentNuclide.a + decayResult.dA);
          if (!newData.exists) { 
              return { ...prev, gameOver: true, energyPoints: 0, gameOverReason: "TRANSFORMATION_FAILED", combo: 0, comboScore: 0, comboStartNuclide: undefined }; 
          }
          
          let rawCombo = (currentTime - prev.lastComboTime <= COMBO_WINDOW_MS) ? prev.combo + 1 : 1;
          
          let nextComboStartNuclide = (rawCombo === 1) ? { z: prev.currentNuclide.z, a: prev.currentNuclide.a } : prev.comboStartNuclide;

          const scoreIncrease = ((newData.a * 10 + (newData.isStable ? 100 : 10) + decayResult.actionBonusScore) * rawCombo);
          let nextComboScore = (rawCombo === 1) ? scoreIncrease : prev.comboScore + scoreIncrease;

          // Check Temporal Inversion
          let inversionMatched = false;
          if (newData.isStable && nextComboStartNuclide && newData.z === nextComboStartNuclide.z && newData.a === nextComboStartNuclide.a) {
              if (!prev.disabledSkills.includes("Temporal Inversion")) {
                  inversionMatched = true;
              }
          }

          const nextBetaPlusCount = prev.decayStats[DecayMode.BETA_PLUS] + (actualMode === DecayMode.BETA_PLUS ? 1 : 0);
          const nextBetaMinusCount = prev.decayStats[DecayMode.BETA_MINUS] + (actualMode === DecayMode.BETA_MINUS ? 1 : 0);
          const unlockResult = processUnlocks(prev.unlockedElements, prev.unlockedGroups, newData.z, newData.a, false, decayResult.isAnnihilation, false, inversionMatched, nextComboScore, false, false, false, false, false, nextBetaPlusCount, nextBetaMinusCount);
          const totalScoreIncrease = scoreIncrease + unlockResult.scoreBonus;

          let finalComboCount = rawCombo;
          if (newData.isStable) {
              if (rawCombo >= 2) setFinalCombo({ count: rawCombo, id: Date.now() });
              finalComboCount = 0;
          }

          const nextEnergy = prev.energyPoints + (decayResult.energyBonus || 0);
          const nextPlayerPos = decayResult.newPosition || prev.playerPos;

          let nextLevel = prev.playerLevel;
          let nextMastered = prev.masteredDecays;
          const isNewMastery = !prev.masteredDecays.includes(actualMode) && nextLevel < 5;
          let levelUpMessages: string[] = [];

          if (isNewMastery) {
              nextLevel += 1;
              nextMastered = [...prev.masteredDecays, actualMode];
              triggerOverride("Mastery Level Up !");
              if (nextLevel === 1) levelUpMessages.push("☢️ MASTERY Lv 1: Magic shells protect against capture!");
              if (nextLevel === 2) levelUpMessages.push("☢️ MASTERY Lv 2: Use [🔬] to convert energy into stability.");
              if (nextLevel === 3) levelUpMessages.push("☢️ MASTERY Lv 3: Magic N-shells can freeze time.");
              if (nextLevel === 4) levelUpMessages.push("☢️ MASTERY Lv 4: [🔮] Exp. Replicate unlocked.");
              if (nextLevel === 5) levelUpMessages.push("☢️ MASTERY Lv 5: Nucleosynthesis [🌟] unlocked.");
          }

          if (newData.z !== prev.currentNuclide.z || newData.a !== prev.currentNuclide.a) {
            setEvolutionHistory(h => [...h, {
                turn: prev.turn,
                name: newData.name,
                symbol: newData.symbol,
                z: newData.z,
                a: newData.a,
                method: decayResult.trigger
            }]);
          }

          const hpRecoveryBonus = newData.isStable ? 10 : 0;
          let nextHp = Math.min(prev.maxHp, prev.hp + hpRecoveryBonus);

          const nextStateCandidate = { 
              ...prev, 
              currentNuclide: newData, 
              playerPos: nextPlayerPos,
              energyPoints: nextEnergy,
              unlockedElements: unlockResult.updatedElements, 
              unlockedGroups: unlockResult.updatedGroups, 
              gridEntities: decayResult.newGridEntities, 
              effects: [...prev.effects, { id: Math.random().toString(36).substr(2, 9), type: actualMode, position: { ...prev.playerPos }, timestamp: currentTime }, ...decayResult.additionalEffects],
              score: prev.score + totalScoreIncrease, 
              hp: nextHp, 
              messages: [...prev.messages, (decayResult.dZ !== 0 || decayResult.dA !== 0) ? `${decayResult.trigger} into ${newData.name}.` : decayResult.trigger, ...levelUpMessages, ...unlockResult.messages, ...decayResult.extraMessages].slice(-5), 
              combo: finalComboCount, 
              maxCombo: Math.max(prev.maxCombo, rawCombo), 
              lastComboTime: currentTime,
              playerLevel: nextLevel,
              masteredDecays: nextMastered,
              comboScore: (newData.isStable) ? 0 : nextComboScore,
              comboStartNuclide: (newData.isStable) ? undefined : nextComboStartNuclide,
              consecutiveProtons: 0,
              consecutiveNeutrons: 0,
              consecutiveElectrons: 0,
              lastConsumedType: null,
              decayStats: {
                  ...prev.decayStats,
                  [actualMode]: (prev.decayStats[actualMode] || 0) + 1
              }
          };

          // Temporal Inversion Check for Decay Action
          if (nextStateCandidate.hp <= 0 && !nextStateCandidate.gameOver) {
            if (nextStateCandidate.unlockedGroups.includes("Temporal Inversion") && !nextStateCandidate.disabledSkills.includes("Temporal Inversion") && nextStateCandidate.energyPoints >= 5) {
                nextStateCandidate.hp = nextStateCandidate.maxHp;
                nextStateCandidate.energyPoints -= 5;
                nextStateCandidate.messages = [...nextStateCandidate.messages, "⏱ AUTO-STABILIZATION: Temporal Inversion triggered!"].slice(-5);
                nextStateCandidate.effects = [...nextStateCandidate.effects, { id: Math.random().toString(36).substr(2, 9), type: DecayMode.STABILIZE_ZAP, position: { ...nextStateCandidate.playerPos }, timestamp: Date.now() }];
            } else {
                nextStateCandidate.gameOver = true;
                nextStateCandidate.gameOverReason = "TRANSFORMATION_SHOCK";
                nextStateCandidate.combo = 0;
            }
          }

          return nextStateCandidate;
      });
  }, [gameState.disabledSkills, gameState.gameOver, gameState.loadingData, gameState.isTimeStopped, triggerOverride, gameState.unlockedGroups]);

  const handlePlayerInteract = useCallback(() => {
    stopAutoMove();
    if (gameState.gameOver || gameState.loadingData || gameState.isTimeStopped) return;
    if (gameState.currentNuclide.isStable) return;
    let activeMode = gameState.currentNuclide.decayModes.find(m => m !== DecayMode.STABLE && m !== DecayMode.UNKNOWN);
    if (!activeMode && gameState.currentNuclide.decayModes.includes(DecayMode.UNKNOWN)) activeMode = DecayMode.UNKNOWN;
    if (activeMode) handleDecayAction(activeMode);
  }, [gameState, handleDecayAction, stopAutoMove]);

  const handleToggleTimeStop = useCallback(() => {
    if (gameState.playerLevel < 3) return; 
    const neutronNumber = gameState.currentNuclide.a - gameState.currentNuclide.z;
    if (MAGIC_NUMBERS.includes(neutronNumber)) {
        setGameState(prev => {
            const nextState = !prev.isTimeStopped;
            if (nextState) stopAutoMove();
            setFinalCombo(null);
            
            return {
                ...prev,
                isTimeStopped: nextState,
                effects: [], 
                messages: [...prev.messages, nextState ? "✨ FROZEN TIME: Locked by neutron shell." : "✨ TIME RESTORED."].slice(-5)
            };
        });
    }
  }, [gameState.playerLevel, gameState.currentNuclide.a, gameState.currentNuclide.z, stopAutoMove]);

  const handleTransmute = useCallback((selectedZ: number) => {
      if (gameState.playerLevel < 4 || !isTransmutationEnabled) return; 
      const validAs = getValidAsForZ(selectedZ);
      if (validAs.length === 0) return;
      const randomA = validAs[Math.floor(Math.random() * validAs.length)];
      const newData = getNuclideDataSync(selectedZ, randomA);
      
      if (newData.exists) {
          const unlockResult = processUnlocks(gameState.unlockedElements, gameState.unlockedGroups, selectedZ, randomA, true);
          setLastDecayEvent(null);
          setEvolutionHistory(h => [...h, { turn: gameState.turn, name: newData.name, symbol: newData.symbol, z: gameState.currentNuclide.z, a: gameState.currentNuclide.a, method: "Transmutation" }]);
          setGameState(prev => ({
              ...prev,
              currentNuclide: newData,
              unlockedElements: unlockResult.updatedElements,
              unlockedGroups: unlockResult.updatedGroups,
              score: prev.score + 500000 + unlockResult.scoreBonus,
              messages: [...prev.messages, `🔮 EXP. REPLICATE: ${newData.name}!`, ...unlockResult.messages].slice(-5),
              isTimeStopped: false,
              combo: 0,
              comboScore: 0,
              comboStartNuclide: undefined,
              consecutiveProtons: 0,
              consecutiveNeutrons: 0,
              consecutiveElectrons: 0,
              lastConsumedType: null
          }));
          setShowTable(false);
          triggerOverride("Nuclear Transmutation");
          setFlashColor('bg-neon-blue');
          setIsFlashBang(true);
          setTimeout(() => setIsFlashBang(false), 800);
      }
  }, [gameState, triggerOverride, isTransmutationEnabled]);

  const handleToggleHiddenSkill = useCallback((skillName: string) => {
      setGameState(prev => {
          const isDisabled = prev.disabledSkills.includes(skillName);
          const nextDisabled = isDisabled 
              ? prev.disabledSkills.filter(s => s !== skillName)
              : [...prev.disabledSkills, skillName];
          
          return {
              ...prev,
              disabledSkills: nextDisabled,
              messages: [...prev.messages, `⚙️ Skill ${skillName} ${isDisabled ? 'ENABLED' : 'DISABLED'}`].slice(-5)
          };
      });
  }, []);

  const restartGame = (randomStart: boolean = false) => {
      const currentTitles = gameState.unlockedElements;
      const currentGroups = gameState.unlockedGroups;
      const currentDisabledSkills = gameState.disabledSkills; // PERSIST: Store current skill states
      const currentMaxCombo = randomStart ? gameState.maxCombo : 0;
      const newState = getInitialState();
      
      let startNuclide = INITIAL_NUCLIDE;
      if (randomStart) {
          let coords = getRandomKnownNuclideCoordinates(); 
          if (coords) {
              const data = getNuclideDataSync(coords.z, coords.a);
              if (data.exists) startNuclide = data;
          }
      }

      let nextUnlockedElements = randomStart ? [...currentTitles] : [];
      let nextUnlockedGroups = randomStart ? [...currentGroups] : [];
      const unlockResult = processUnlocks(nextUnlockedElements, nextUnlockedGroups, startNuclide.z, startNuclide.a);
      
      setLastDecayEvent(null);
      setFinalCombo(null);
      setEvolutionHistory([{ turn: 0, name: startNuclide.name, symbol: startNuclide.symbol, z: startNuclide.z, a: startNuclide.a, method: "Origin" }]);

      setGameState({
          ...newState,
          disabledSkills: currentDisabledSkills, // PERSIST: Restore skill states
          score: unlockResult.scoreBonus,
          currentNuclide: startNuclide,
          gridEntities: generateEntities(5, [], newState.playerPos, 0),
          unlockedElements: unlockResult.updatedElements,
          unlockedGroups: unlockResult.updatedGroups,
          maxCombo: currentMaxCombo,
          messages: [`Journey begins with ${startNuclide.name}.`, ...unlockResult.messages]
      });
  };

  const handleCellClick = useCallback((x: number, y: number) => {
      if (x === gameState.playerPos.x && y === gameState.playerPos.y) { handlePlayerInteract(); return; }
      stopAutoMove();
      if (gameState.gameOver || gameState.loadingData || gameState.isTimeStopped) return;
      const path: {dx: number, dy: number}[] = [];
      const dx = x - gameState.playerPos.x, dy = y - gameState.playerPos.y;
      for (let i = 0; i < Math.abs(dx); i++) path.push({dx: dx > 0 ? 1 : -1, dy: 0});
      for (let i = 0; i < Math.abs(dy); i++) path.push({dx: 0, dy: dy > 0 ? 1 : -1});
      if (path.length > 0) startPathMove(path);
  }, [gameState, handlePlayerInteract, stopAutoMove, startPathMove]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'Spacebar'].includes(e.key)) e.preventDefault();
      stopAutoMove();
      switch(e.key) {
        case 'ArrowUp': case 'w': moveStep(0, -1); break;
        case 'ArrowDown': case 's': moveStep(0, 1); break;
        case 'ArrowLeft': case 'a': moveStep(-1, 0); break;
        case 'ArrowRight': case 'd': moveStep(1, 0); break;
        case 'Enter': 
        case ' ': 
        case 'Spacebar': 
          handlePlayerInteract(); 
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [moveStep, handlePlayerInteract, stopAutoMove]);

  const transmutationReady = MAGIC_NUMBERS.includes(gameState.currentNuclide.z) && MAGIC_NUMBERS.includes(gameState.currentNuclide.a - gameState.currentNuclide.z) && gameState.isTimeStopped && gameState.playerLevel >= 4 && isTransmutationEnabled;

  return (
    <div ref={containerRef} tabIndex={0} className={`min-h-screen bg-dark-bg text-gray-200 font-mono flex flex-col md:flex-row overflow-hidden relative outline-none ${isScreenShaking ? 'animate-shake' : ''}`}>
      <div className={`pointer-events-none fixed inset-0 z-[100] ${flashColor} mix-blend-screen transition-opacity duration-500 ${isFlashBang ? 'opacity-100' : 'opacity-0'}`}></div>
      {showTable && <PeriodicTable unlocked={gameState.unlockedElements} unlockedGroups={gameState.unlockedGroups} decayStats={gameState.decayStats} reactionStats={gameState.reactionStats} disabledSkills={gameState.disabledSkills} onToggleSkill={handleToggleHiddenSkill} maxCombo={gameState.maxCombo} onClose={() => setShowTable(false)} canTransmute={transmutationReady} onSelectElement={handleTransmute} />}
      {!showTable && (
        <div className="md:hidden absolute top-3 right-3 z-50 flex items-center gap-2">
          <TrefoilIndicator level={gameState.playerLevel} />
          {gameState.playerLevel >= 2 && (
            <button onClick={handleStabilize} disabled={gameState.energyPoints < STABILIZE_COST} className={`bg-gray-900/90 border border-yellow-400/50 px-3 py-2 rounded-lg flex items-center gap-2 backdrop-blur-md shadow-lg transition-all ${gameState.energyPoints >= STABILIZE_COST ? 'opacity-100' : 'opacity-40 grayscale'} ${isNucleosynthesisReady ? 'text-white bg-blue-600/50 ring-2 ring-neon-blue animate-pulse' : 'text-yellow-400'}`}>
                <span className="text-lg">{isNucleosynthesisReady ? '🌟' : '🔬'}</span>
            </button>
          )}
          <button onClick={() => setShowTable(true)} className={`bg-gray-900/90 text-neon-purple border border-neon-purple/50 px-3 py-2 rounded-lg flex items-center gap-2 backdrop-blur-md shadow-lg transition-all ${transmutationReady ? 'animate-pulse ring-2 ring-yellow-400 !text-yellow-400' : ''}`}>
            <span className="text-lg">{transmutationReady ? '🔮' : '🏆'}</span>
          </button>
        </div>
      )}
      <div className="order-2 md:order-1 w-full md:w-80 lg:w-96 bg-panel-bg border-r border-gray-800 flex flex-col h-auto md:h-screen overflow-y-auto z-20">
          <div className="hidden md:flex p-6 items-center justify-center border-b border-gray-800 shrink-0">
             <h1 className="text-2xl font-black text-neon-blue tracking-tighter italic drop-shadow-[0_0_10px_rgba(0,243,255,0.5)]">NUCLEUS<span className="text-white text-sm not-italic font-normal tracking-widest ml-1 opacity-80">ROGUE</span></h1>
          </div>
          {!showTable && (
            <div className="hidden md:flex p-4 border-b border-gray-800 shrink-0 justify-center gap-2 items-center">
                 <TrefoilIndicator level={gameState.playerLevel} />
                 {gameState.playerLevel >= 2 ? (
                    <button onClick={handleStabilize} disabled={gameState.energyPoints < STABILIZE_COST} className={`flex-1 py-2 rounded flex items-center justify-center gap-2 shadow-lg transition-all border ${isNucleosynthesisReady ? 'bg-blue-600/30 hover:bg-blue-500/50 text-white border-neon-blue ring-1 ring-neon-blue animate-pulse' : 'bg-gray-900/50 hover:bg-yellow-400/20 text-yellow-400 border-yellow-400/50'} ${gameState.energyPoints >= STABILIZE_COST ? 'opacity-100' : 'opacity-40 grayscale cursor-not-allowed'}`}>
                        <span className="text-lg">{isNucleosynthesisReady ? '🌟' : '🔬'}</span>
                        <span className="text-xs font-bold uppercase tracking-wider">{isNucleosynthesisReady ? 'Nucleosynthesis' : 'Stabilize'}</span>
                    </button>
                 ) : (
                    <div className="flex-1 py-2 rounded flex items-center justify-center gap-2 bg-gray-900/30 border border-gray-800 text-gray-700 cursor-not-allowed opacity-50"><span className="text-lg">🔒</span><span className="text-xs font-bold uppercase">Locked</span></div>
                 )}
                 <button onClick={() => setShowTable(true)} className={`flex-1 bg-gray-900/50 hover:bg-neon-purple/20 text-neon-purple border border-neon-purple/50 py-2 rounded flex items-center justify-center gap-2 shadow-lg transition-all ${transmutationReady ? 'animate-pulse ring-2 ring-yellow-400 !text-yellow-400 bg-yellow-400/10' : ''}`}>
                    <span className="text-lg">{transmutationReady ? '🔮' : '🏆'}</span>
                    <span className="text-xs font-bold uppercase tracking-wider">Titles</span>
                 </button>
            </div>
          )}
          <InfoPanel nuclide={gameState.currentNuclide} hp={gameState.hp} maxHp={gameState.maxHp} energyPoints={gameState.energyPoints} turn={gameState.turn} score={gameState.score} combo={gameState.combo} isTimeStopped={gameState.isTimeStopped} />
          <ControlPanel nuclide={gameState.currentNuclide} onDecay={handleDecayAction} disabled={gameState.gameOver || gameState.loadingData || gameState.isTimeStopped} />
          <div className="flex border-b border-gray-800 bg-gray-900/30">
             <button onClick={() => setActiveTab('structure')} className={`flex-1 py-2 text-[10px] uppercase tracking-widest font-bold transition-all border-b-2 ${activeTab === 'structure' ? 'border-neon-blue text-neon-blue bg-gray-800/50' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>Nuclear Structure</button>
             <button onClick={() => setActiveTab('history')} className={`flex-1 py-2 text-[10px] uppercase tracking-widest font-bold transition-all border-b-2 ${activeTab === 'history' ? 'border-neon-green text-neon-green bg-gray-800/50' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>Evolution History</button>
          </div>
          <div className="p-4 border-b border-gray-800 shrink-0 h-64 flex flex-col items-center justify-center overflow-hidden">
             {activeTab === 'structure' ? <NucleusVisualizer z={gameState.currentNuclide.z} a={gameState.currentNuclide.a} symbol={gameState.currentNuclide.symbol} decayModes={gameState.currentNuclide.decayModes} lastDecayEvent={lastDecayEvent} isTimeStopped={gameState.isTimeStopped} /> : <EvolutionMap history={evolutionHistory} currentNuclide={gameState.currentNuclide} />}
          </div>
          <div className="flex-1 p-4 font-mono text-xs overflow-y-auto flex flex-col-reverse min-h-[200px]">
              {gameState.messages.map((msg, i) => (
                  <div key={i} className={`mb-1 border-b border-gray-800 pb-1 last:border-0 opacity-80 ${msg.includes('✨') || msg.includes('☢️') || msg.includes('⚛️') || msg.includes('⏱') ? 'text-neon-blue font-bold animate-pulse' : ''}`}>
                      <span className="text-neon-purple mr-2">[{gameState.turn - i > 0 ? gameState.turn - i : 0}]</span>{msg}
                  </div>
              ))}
          </div>
          <div className="p-4 bg-black/40 border-t border-gray-800 shrink-0 flex justify-between items-center text-[10px] text-gray-500">
                <div className="flex flex-col"><span className="font-bold uppercase">v{APP_VERSION}</span><a href="https://www-nds.iaea.org/relnsd/vcharthtml/VChartHTML.html" target="_blank" rel="noopener noreferrer" className="hover:text-neon-blue underline transition-colors">Data: IAEA Chart</a></div>
                <div className="text-right italic">Nucleus Rogue</div>
          </div>
      </div>
      <div className="order-1 md:order-2 flex-1 flex flex-col items-center justify-start md:justify-center p-4 relative pt-16 md:pt-0 z-10">
         <HealthBar hp={gameState.hp} maxHp={gameState.maxHp} nuclide={gameState.currentNuclide} onToggleTimeStop={handleToggleTimeStop} isTimeStopped={gameState.isTimeStopped} level={gameState.playerLevel} />
         <div className="relative bg-panel-bg p-2 rounded-xl border border-gray-800 shadow-2xl w-full max-w-[95vw] md:w-auto overflow-hidden" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
            {gameState.isTimeStopped && <div className="absolute inset-0 z-[60] bg-neon-blue/10 backdrop-blur-[2px] flex items-center justify-center pointer-events-none"><div className="text-4xl md:text-6xl font-black italic text-neon-blue animate-pulse drop-shadow(0 0 20px #00f3ff) uppercase tracking-tighter">Frozen Time</div></div>}
            <Grid width={GRID_WIDTH} height={GRID_HEIGHT} gameState={gameState} onCellClick={handleCellClick} finalCombo={finalCombo} />
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
            <GameOverOverlay isVisible={gameState.gameOver} reason={gameState.gameOverReason} nuclide={gameState.currentNuclide} onRestart={restartGame} />
         </div>
      </div>
    </div>
  );
}

export default App;
