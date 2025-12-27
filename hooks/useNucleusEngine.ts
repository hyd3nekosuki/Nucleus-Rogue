
import { useState, useEffect, useCallback, useRef } from 'react';
import { GameState, EntityType, DecayMode, VisualEffect } from '../types';
import { GRID_WIDTH, GRID_HEIGHT, INITIAL_HP, INITIAL_NUCLIDE, MAGIC_NUMBERS } from '../constants';
import { getNuclideDataSync, getValidAsForZ } from '../services/nuclideService';
import { getRandomKnownNuclideCoordinates } from '../data/staticNuclides';
import { generateEntities, calculateMoveResult } from '../utils/gameLogic';
import { processUnlocks } from '../utils/unlockSystem';
import { calculateDecayEffects, getDecayDeltas } from '../utils/decaySystem';

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

export const useNucleusEngine = (triggerTTS: (text: string) => void) => {
    const [gameState, setGameState] = useState<GameState>(getInitialState());
    const [evolutionHistory, setEvolutionHistory] = useState<HistoryEntry[]>([]);
    
    // UI Feedback States
    const [isScreenShaking, setIsScreenShaking] = useState(false);
    const [isFlashBang, setIsFlashBang] = useState(false);
    const [flashColor, setFlashColor] = useState('bg-neon-blue');
    const [lastDecayEvent, setLastDecayEvent] = useState<{mode: DecayMode, timestamp: number} | null>(null);
    const [finalCombo, setFinalCombo] = useState<{count: number, id: number} | null>(null);

    const moveIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const moveQueueRef = useRef<{dx: number, dy: number}[]>([]);
    const continuousDirRef = useRef<{dx: number, dy: number} | null>(null);

    // Initial Setup
    useEffect(() => {
        const initialEntities = generateEntities(5, [], gameState.playerPos, 0);
        setGameState(prev => ({ ...prev, gridEntities: initialEntities }));
        setEvolutionHistory([{
            turn: 0, name: INITIAL_NUCLIDE.name, symbol: INITIAL_NUCLIDE.symbol,
            z: INITIAL_NUCLIDE.z, a: INITIAL_NUCLIDE.a, method: "Origin"
        }]);
    }, []);

    // Effects cleanup
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

    // Combo Timer
    useEffect(() => {
        if (gameState.combo === 0 || gameState.gameOver || gameState.isTimeStopped) return;
        const interval = setInterval(() => {
            const now = Date.now();
            if (now - gameState.lastComboTime > COMBO_WINDOW_MS) {
                setGameState(prev => {
                    if (prev.combo === 0) return prev;
                    let inversionMatched = false;
                    if (prev.comboStartNuclide && prev.currentNuclide.z === prev.comboStartNuclide.z && prev.currentNuclide.a === prev.comboStartNuclide.a) {
                        if (!prev.disabledSkills.includes("Temporal Inversion")) inversionMatched = true;
                    }
                    if (inversionMatched) {
                        const unlockResult = processUnlocks(prev.unlockedElements, prev.unlockedGroups, prev.currentNuclide.z, prev.currentNuclide.a, false, false, false, true, prev.comboScore);
                        if (prev.combo >= 2) setFinalCombo({ count: prev.combo, id: Date.now() });
                        return { 
                            ...prev, score: prev.score + unlockResult.scoreBonus, unlockedGroups: unlockResult.updatedGroups,
                            messages: [...prev.messages, ...unlockResult.messages].slice(-5), combo: 0, comboScore: 0, comboStartNuclide: undefined 
                        };
                    }
                    if (prev.combo >= 2) setFinalCombo({ count: prev.combo, id: Date.now() });
                    return { ...prev, combo: 0, comboScore: 0, comboStartNuclide: undefined };
                });
            }
        }, 1000);
        return () => clearInterval(interval);
    }, [gameState.combo, gameState.lastComboTime, gameState.gameOver, gameState.isTimeStopped]);

    // Stability (HP) Decay Timer
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
                        if (prev.unlockedGroups.includes("Temporal Inversion") && !prev.disabledSkills.includes("Temporal Inversion") && prev.energyPoints >= 5) {
                            return {
                                ...prev, hp: prev.maxHp, energyPoints: prev.energyPoints - 5,
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
        if (moveIntervalRef.current) { clearInterval(moveIntervalRef.current); moveIntervalRef.current = null; }
        moveQueueRef.current = [];
        continuousDirRef.current = null;
    }, []);

    const moveStep = useCallback((dx: number, dy: number) => {
        setGameState(prev => {
            if (prev.gameOver || prev.loadingData || prev.isTimeStopped) { stopAutoMove(); return prev; }
            const result = calculateMoveResult(prev, dx, dy, COULOMB_BARRIER_THRESHOLD, ENERGY_EVOLUTION_TURNS, prev.playerLevel);
            if (!result.moved) { if (continuousDirRef.current) stopAutoMove(); return prev; }
            const nextState = { ...result.state };
            if (nextState.gameOver) nextState.energyPoints = 0;
            if (result.inducedDecayMode && result.inducedReactionLabel) {
                setLastDecayEvent({ mode: result.inducedDecayMode, timestamp: Date.now() });
                nextState.reactionStats = { ...nextState.reactionStats, [result.inducedReactionLabel]: (nextState.reactionStats[result.inducedReactionLabel] || 0) + 1 };
                if (result.shouldShake) { setIsScreenShaking(true); setTimeout(() => setIsScreenShaking(false), 300); }
                if (result.shouldFlash) { setFlashColor('bg-neon-blue'); setIsFlashBang(true); setTimeout(() => setIsFlashBang(false), 500); }
                if (result.additionalEffects) nextState.effects = [...nextState.effects, ...result.additionalEffects];
            }
            if (nextState.currentNuclide.z !== prev.currentNuclide.z || nextState.currentNuclide.a !== prev.currentNuclide.a) {
                  if (!result.inducedDecayMode) setLastDecayEvent(null);
                  const targetEntity = prev.gridEntities.find(e => e.position.x === nextState.playerPos.x && e.position.y === nextState.playerPos.y);
                  let method = "Transmutation";
                  if (result.isPpFusion) { method = "fusion"; triggerTTS("Nuclear Fusion"); }
                  else if (result.isPositronAbsorption) { method = "Positron capture"; }
                  else if (targetEntity) {
                      if (targetEntity.type === EntityType.PROTON) method = "Proton Capture";
                      else if (targetEntity.type === EntityType.NEUTRON) method = "Neutron Capture";
                      else if (targetEntity.type === EntityType.ENEMY_ELECTRON) method = "Electron Capture";
                  }
                  if (result.inducedDecayMode) method = result.inducedDecayMode === DecayMode.SPONTANEOUS_FISSION ? "Neutron-induced fission" : `Induced ${result.inducedDecayMode.replace(/_/g, ' ')}`;
                  setEvolutionHistory(h => [...h, { turn: nextState.turn, name: nextState.currentNuclide.name, symbol: nextState.currentNuclide.symbol, z: nextState.currentNuclide.z, a: nextState.currentNuclide.a, method }]);
                  if (nextState.combo === 0 && !nextState.currentNuclide.isStable) nextState.comboStartNuclide = { z: prev.currentNuclide.z, a: prev.currentNuclide.a };
                  const scoreDiff = nextState.score - prev.score;
                  nextState.comboScore = (nextState.combo === 0) ? scoreDiff : prev.comboScore + scoreDiff;
                  if (nextState.currentNuclide.isStable && prev.combo > 0) {
                      let inversionMatched = false;
                      if (prev.comboStartNuclide && nextState.currentNuclide.z === prev.comboStartNuclide.z && nextState.currentNuclide.a === prev.comboStartNuclide.a) {
                          if (!prev.disabledSkills.includes("Temporal Inversion")) inversionMatched = true;
                      }
                      if (inversionMatched) {
                          const unlockResult = processUnlocks(nextState.unlockedElements, nextState.unlockedGroups, nextState.currentNuclide.z, nextState.currentNuclide.a, false, false, false, true, nextState.comboScore, false, false, false, false, false, nextState.decayStats[DecayMode.BETA_PLUS], nextState.decayStats[DecayMode.BETA_MINUS]);
                          nextState.score += unlockResult.scoreBonus; nextState.unlockedGroups = unlockResult.updatedGroups; nextState.messages = [...nextState.messages, ...unlockResult.messages].slice(-5);
                      }
                      if (prev.combo >= 2) setFinalCombo({ count: prev.combo, id: Date.now() });
                      nextState.combo = 0; nextState.comboScore = 0; nextState.comboStartNuclide = undefined;
                  }
            }
            if (nextState.hp <= 0 && !nextState.gameOver) {
                if (nextState.unlockedGroups.includes("Temporal Inversion") && !nextState.disabledSkills.includes("Temporal Inversion") && nextState.energyPoints >= 5) {
                    nextState.hp = nextState.maxHp; nextState.energyPoints -= 5; nextState.messages = [...nextState.messages, "⏱ AUTO-STABILIZATION: Temporal Inversion triggered!"].slice(-5);
                    nextState.effects = [...nextState.effects, { id: Math.random().toString(36).substr(2, 9), type: DecayMode.STABILIZE_ZAP, position: { ...nextState.playerPos }, timestamp: Date.now() }];
                } else {
                    nextState.gameOver = true; nextState.gameOverReason = nextState.gameOverReason || "PARTICLE_COLLISION"; nextState.combo = 0; nextState.comboScore = 0; nextState.comboStartNuclide = undefined;
                }
            }
            return nextState;
        });
    }, [stopAutoMove, triggerTTS]);

    const handleStabilize = useCallback(() => {
        if (gameState.playerLevel < 2) return;
        setGameState(prev => {
            const isSynth = prev.energyPoints >= NUCLEOSYNTHESIS_COST && prev.playerLevel >= 5 && !prev.disabledSkills.includes("Nucleosynthesis");
            const cost = isSynth ? NUCLEOSYNTHESIS_COST : STABILIZE_COST;
            if (prev.energyPoints < cost) return { ...prev, messages: [...prev.messages, `⚠️ Not enough energy! Need ${cost}E.`].slice(-5) };
            const now = Date.now();
            const effectType = isSynth ? DecayMode.NUCLEOSYNTHESIS_ZAP : DecayMode.STABILIZE_ZAP;
            const zapEffect: VisualEffect = { id: Math.random().toString(36).substr(2, 9), type: effectType, position: { ...prev.playerPos }, timestamp: now };
            if (isSynth) {
                const nextZ = prev.currentNuclide.z + 1;
                if (nextZ > 118) return { ...prev, messages: [...prev.messages, "⚠️ Oganesson limit reached!"].slice(-5) };
                const validAs = getValidAsForZ(nextZ);
                if (validAs.length === 0) return { ...prev, messages: [...prev.messages, "⚠️ Synthesis failed: Unstable zone."].slice(-5) };
                const randomA = validAs[Math.floor(Math.random() * validAs.length)];
                const newData = getNuclideDataSync(nextZ, randomA);
                if (newData.exists) {
                    const unlockResult = processUnlocks(prev.unlockedElements, prev.unlockedGroups, nextZ, randomA, false, false, true);
                    triggerTTS("Nucleosynthesis Complete");
                    setFlashColor('bg-white'); setIsFlashBang(true); setTimeout(() => setIsFlashBang(false), 800);
                    setEvolutionHistory(h => [...h, { turn: prev.turn, name: newData.name, symbol: newData.symbol, z: newData.z, a: newData.a, method: "Nucleosynthesis" }]);
                    const synthBonus = nextZ * 10000;
                    return {
                        ...prev, currentNuclide: newData, hp: prev.maxHp, energyPoints: prev.energyPoints - NUCLEOSYNTHESIS_COST,
                        score: prev.score + synthBonus + unlockResult.scoreBonus, effects: [...prev.effects, zapEffect],
                        unlockedElements: unlockResult.updatedElements, unlockedGroups: unlockResult.updatedGroups,
                        messages: [...prev.messages, `🌟 NUCLEOSYNTHESIS: Synthesized ${newData.name}! (+${synthBonus.toLocaleString()} PTS)`, ...unlockResult.messages].slice(-5),
                        isTimeStopped: false, consecutiveProtons: 0, consecutiveNeutrons: 0, consecutiveElectrons: 0, lastConsumedType: null
                    };
                }
                return prev;
            } else {
                return { ...prev, hp: prev.maxHp, energyPoints: prev.energyPoints - STABILIZE_COST, effects: [...prev.effects, zapEffect], messages: [...prev.messages, `🔬 Stabilization: HP Recovered.`].slice(-5) };
            }
        });
    }, [gameState.playerLevel, triggerTTS]);

    const handleDecayAction = useCallback((mode: DecayMode) => {
        stopAutoMove(); if (gameState.gameOver || gameState.loadingData || gameState.isTimeStopped) return;
        const currentTime = Date.now();
        let actualMode = mode;
        if (mode === DecayMode.UNKNOWN) {
            const candidates = [DecayMode.ALPHA, DecayMode.BETA_MINUS, DecayMode.BETA_PLUS, DecayMode.PROTON_EMISSION, DecayMode.NEUTRON_EMISSION, DecayMode.SPONTANEOUS_FISSION, DecayMode.GAMMA];
            let found = false, attempts = 0;
            while (!found && attempts < 50) {
                attempts++; const rnd = candidates[Math.floor(Math.random() * candidates.length)];
                if (rnd === DecayMode.GAMMA) { actualMode = rnd; found = true; break; }
                const deltas = getDecayDeltas(rnd);
                if (getNuclideDataSync(gameState.currentNuclide.z + deltas.dZ, gameState.currentNuclide.a + deltas.dA).exists) { actualMode = rnd; found = true; }
            }
            if (!found) return;
        }
        const isPairUnlocked = gameState.unlockedGroups.includes("Pair anihilation");
        const isPairEnabled = !gameState.disabledSkills.includes("Pair anihilation");
        const isNeutronStarUnlocked = gameState.unlockedGroups.includes("Neutronization");
        const isNeutronStarEnabled = !gameState.disabledSkills.includes("Neutronization");
        const annihilationEnabled = actualMode === DecayMode.BETA_MINUS ? true : (isPairUnlocked && isPairEnabled);
        const fissionEnabled = !gameState.disabledSkills.includes("Fission");
        const decayResult = calculateDecayEffects(actualMode, gameState, currentTime, annihilationEnabled, fissionEnabled, isNeutronStarUnlocked && isNeutronStarEnabled);
        if (decayResult.dZ === 0 && decayResult.dA === 0 && decayResult.trigger === "") return; 
        const visualMode = (actualMode === DecayMode.SPONTANEOUS_FISSION && !fissionEnabled) ? DecayMode.ALPHA : actualMode;
        setLastDecayEvent({ mode: visualMode, timestamp: currentTime });
        if (decayResult.shouldShake) { setIsScreenShaking(true); setTimeout(() => setIsScreenShaking(false), 300); }
        if (decayResult.shouldFlash) { setFlashColor(visualMode === DecayMode.SPONTANEOUS_FISSION ? 'bg-yellow-400' : 'bg-neon-blue'); setIsFlashBang(true); setTimeout(() => setIsFlashBang(false), 500); }
        if (decayResult.speechOverride) triggerTTS(decayResult.speechOverride);
        setGameState(prev => {
            const newData = getNuclideDataSync(prev.currentNuclide.z + decayResult.dZ, prev.currentNuclide.a + decayResult.dA);
            if (!newData.exists) return { ...prev, gameOver: true, energyPoints: 0, gameOverReason: "TRANSFORMATION_FAILED", combo: 0, comboScore: 0, comboStartNuclide: undefined }; 
            let rawCombo = (currentTime - prev.lastComboTime <= COMBO_WINDOW_MS) ? prev.combo + 1 : 1;
            let nextComboStartNuclide = (rawCombo === 1) ? { z: prev.currentNuclide.z, a: prev.currentNuclide.a } : prev.comboStartNuclide;
            const scoreIncrease = ((newData.a * 10 + (newData.isStable ? 100 : 10) + decayResult.actionBonusScore) * rawCombo);
            let nextComboScore = (rawCombo === 1) ? scoreIncrease : prev.comboScore + scoreIncrease;
            let inversionMatched = false;
            if (newData.isStable && nextComboStartNuclide && newData.z === nextComboStartNuclide.z && newData.a === nextComboStartNuclide.a) { if (!prev.disabledSkills.includes("Temporal Inversion")) inversionMatched = true; }
            const nextBetaPlusCount = prev.decayStats[DecayMode.BETA_PLUS] + (actualMode === DecayMode.BETA_PLUS ? 1 : 0);
            const nextBetaMinusCount = prev.decayStats[DecayMode.BETA_MINUS] + (actualMode === DecayMode.BETA_MINUS ? 1 : 0);
            const unlockResult = processUnlocks(prev.unlockedElements, prev.unlockedGroups, newData.z, newData.a, false, decayResult.isAnnihilation, false, inversionMatched, nextComboScore, false, false, false, false, false, nextBetaPlusCount, nextBetaMinusCount);
            let finalComboCount = rawCombo;
            if (newData.isStable) { if (rawCombo >= 2) setFinalCombo({ count: rawCombo, id: Date.now() }); finalComboCount = 0; }
            const nextPlayerPos = decayResult.newPosition || prev.playerPos;
            let nextLevel = prev.playerLevel, nextMastered = prev.masteredDecays;
            const isNewMastery = !prev.masteredDecays.includes(actualMode) && nextLevel < 5;
            let levelUpMessages: string[] = [];
            if (isNewMastery) {
                nextLevel += 1; nextMastered = [...prev.masteredDecays, actualMode]; triggerTTS("Mastery Level Up !");
                if (nextLevel === 1) levelUpMessages.push("☢️ MASTERY Lv 1: Magic shells protect against capture!");
                if (nextLevel === 2) levelUpMessages.push("☢️ MASTERY Lv 2: Use [🔬] to convert energy into stability.");
                if (nextLevel === 3) levelUpMessages.push("☢️ MASTERY Lv 3: Magic N-shells can freeze time.");
                if (nextLevel === 4) levelUpMessages.push("☢️ MASTERY Lv 4: [🔮] Exp. Replicate unlocked.");
                if (nextLevel === 5) levelUpMessages.push("☢️ MASTERY Lv 5: Nucleosynthesis [🌟] unlocked.");
            }
            if (newData.z !== prev.currentNuclide.z || newData.a !== prev.currentNuclide.a) setEvolutionHistory(h => [...h, { turn: prev.turn, name: newData.name, symbol: newData.symbol, z: newData.z, a: newData.a, method: decayResult.trigger }]);
            const nextStateCandidate = { 
                ...prev, currentNuclide: newData, playerPos: nextPlayerPos, energyPoints: prev.energyPoints + (decayResult.energyBonus || 0),
                unlockedElements: unlockResult.updatedElements, unlockedGroups: unlockResult.updatedGroups, gridEntities: decayResult.newGridEntities, 
                effects: [...prev.effects, { id: Math.random().toString(36).substr(2, 9), type: actualMode, position: { ...prev.playerPos }, timestamp: currentTime }, ...decayResult.additionalEffects],
                score: prev.score + scoreIncrease + unlockResult.scoreBonus, hp: Math.min(prev.maxHp, prev.hp + (newData.isStable ? 10 : 0)), 
                messages: [...prev.messages, (decayResult.dZ !== 0 || decayResult.dA !== 0) ? `${decayResult.trigger} into ${newData.name}.` : decayResult.trigger, ...levelUpMessages, ...unlockResult.messages, ...decayResult.extraMessages].slice(-5), 
                combo: finalComboCount, maxCombo: Math.max(prev.maxCombo, rawCombo), lastComboTime: currentTime, playerLevel: nextLevel, masteredDecays: nextMastered,
                comboScore: (newData.isStable) ? 0 : nextComboScore, comboStartNuclide: (newData.isStable) ? undefined : nextComboStartNuclide,
                consecutiveProtons: 0, consecutiveNeutrons: 0, consecutiveElectrons: 0, lastConsumedType: null, decayStats: { ...prev.decayStats, [actualMode]: (prev.decayStats[actualMode] || 0) + 1 }
            };
            if (nextStateCandidate.hp <= 0 && !nextStateCandidate.gameOver) {
                if (nextStateCandidate.unlockedGroups.includes("Temporal Inversion") && !nextStateCandidate.disabledSkills.includes("Temporal Inversion") && nextStateCandidate.energyPoints >= 5) {
                    nextStateCandidate.hp = nextStateCandidate.maxHp; nextStateCandidate.energyPoints -= 5; nextStateCandidate.messages = [...nextStateCandidate.messages, "⏱ AUTO-STABILIZATION: Temporal Inversion triggered!"].slice(-5);
                    nextStateCandidate.effects = [...nextStateCandidate.effects, { id: Math.random().toString(36).substr(2, 9), type: DecayMode.STABILIZE_ZAP, position: { ...nextStateCandidate.playerPos }, timestamp: Date.now() }];
                } else { nextStateCandidate.gameOver = true; nextStateCandidate.gameOverReason = "TRANSFORMATION_SHOCK"; nextStateCandidate.combo = 0; }
            }
            return nextStateCandidate;
        });
    }, [gameState.disabledSkills, gameState.gameOver, gameState.loadingData, gameState.isTimeStopped, triggerTTS, gameState.unlockedGroups]);

    const handlePlayerInteract = useCallback(() => {
        stopAutoMove(); if (gameState.gameOver || gameState.loadingData || gameState.isTimeStopped) return;
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
                return { ...prev, isTimeStopped: nextState, effects: [], messages: [...prev.messages, nextState ? "✨ FROZEN TIME: Locked by neutron shell." : "✨ TIME RESTORED."].slice(-5) };
            });
        }
    }, [gameState.playerLevel, gameState.currentNuclide.a, gameState.currentNuclide.z, stopAutoMove]);

    const handleTransmute = useCallback((selectedZ: number) => {
        if (gameState.playerLevel < 4 || gameState.disabledSkills.includes("Exp. Replicate")) return; 
        const validAs = getValidAsForZ(selectedZ); if (validAs.length === 0) return;
        const randomA = validAs[Math.floor(Math.random() * validAs.length)];
        const newData = getNuclideDataSync(selectedZ, randomA);
        if (newData.exists) {
            const unlockResult = processUnlocks(gameState.unlockedElements, gameState.unlockedGroups, selectedZ, randomA, true);
            setLastDecayEvent(null);
            setEvolutionHistory(h => [...h, { turn: gameState.turn, name: newData.name, symbol: newData.symbol, z: gameState.currentNuclide.z, a: gameState.currentNuclide.a, method: "Transmutation" }]);
            setGameState(prev => ({
                ...prev, currentNuclide: newData, unlockedElements: unlockResult.updatedElements, unlockedGroups: unlockResult.updatedGroups,
                score: prev.score + 500000 + unlockResult.scoreBonus, messages: [...prev.messages, `🔮 EXP. REPLICATE: ${newData.name}!`, ...unlockResult.messages].slice(-5),
                isTimeStopped: false, combo: 0, comboScore: 0, comboStartNuclide: undefined, consecutiveProtons: 0, consecutiveNeutrons: 0, consecutiveElectrons: 0, lastConsumedType: null
            }));
            triggerTTS("Nuclear Transmutation"); setFlashColor('bg-neon-blue'); setIsFlashBang(true); setTimeout(() => setIsFlashBang(false), 800);
        }
    }, [gameState, triggerTTS]);

    const handleToggleHiddenSkill = useCallback((skillName: string) => {
        setGameState(prev => {
            const isDisabled = prev.disabledSkills.includes(skillName);
            const nextDisabled = isDisabled ? prev.disabledSkills.filter(s => s !== skillName) : [...prev.disabledSkills, skillName];
            return { ...prev, disabledSkills: nextDisabled, messages: [...prev.messages, `⚙️ Skill ${skillName} ${isDisabled ? 'ENABLED' : 'DISABLED'}`].slice(-5) };
        });
    }, []);

    const restartGame = (randomStart: boolean = false) => {
        const currentTitles = gameState.unlockedElements;
        const currentGroups = gameState.unlockedGroups;
        const currentDisabledSkills = gameState.disabledSkills;
        const currentMaxCombo = randomStart ? gameState.maxCombo : 0;
        const newState = getInitialState();
        let startNuclide = INITIAL_NUCLIDE;
        if (randomStart) {
            let coords = getRandomKnownNuclideCoordinates(); 
            if (coords) { const data = getNuclideDataSync(coords.z, coords.a); if (data.exists) startNuclide = data; }
        }
        let nextUnlockedElements = randomStart ? [...currentTitles] : [];
        let nextUnlockedGroups = randomStart ? [...currentGroups] : [];
        const unlockResult = processUnlocks(nextUnlockedElements, nextUnlockedGroups, startNuclide.z, startNuclide.a);
        setLastDecayEvent(null); setFinalCombo(null);
        setEvolutionHistory([{ turn: 0, name: startNuclide.name, symbol: startNuclide.symbol, z: startNuclide.z, a: startNuclide.a, method: "Origin" }]);
        setGameState({
            ...newState, disabledSkills: currentDisabledSkills, score: unlockResult.scoreBonus, currentNuclide: startNuclide,
            gridEntities: generateEntities(5, [], newState.playerPos, 0), unlockedElements: unlockResult.updatedElements,
            unlockedGroups: unlockResult.updatedGroups, maxCombo: currentMaxCombo,
            messages: [`Journey begins with ${startNuclide.name}.`, ...unlockResult.messages]
        });
    };

    const handleCellClick = useCallback((x: number, y: number) => {
        if (x === gameState.playerPos.x && y === gameState.playerPos.y) { handlePlayerInteract(); return; }
        stopAutoMove(); if (gameState.gameOver || gameState.loadingData || gameState.isTimeStopped) return;
        const dx = x - gameState.playerPos.x, dy = y - gameState.playerPos.y;
        const adx = Math.abs(dx), ady = Math.abs(dy);
        if (adx === 1 && ady === 1) { moveStep(dx, dy); return; }
        const path: {dx: number, dy: number}[] = [];
        for (let i = 0; i < adx; i++) path.push({dx: dx > 0 ? 1 : -1, dy: 0});
        for (let i = 0; i < ady; i++) path.push({dx: 0, dy: dy > 0 ? 1 : -1});
        if (path.length > 0) {
            stopAutoMove(); moveQueueRef.current = path;
            if (moveIntervalRef.current) clearInterval(moveIntervalRef.current);
            moveIntervalRef.current = setInterval(() => {
                if (moveQueueRef.current.length > 0) { const step = moveQueueRef.current.shift(); if (step) moveStep(step.dx, step.dy); }
                else stopAutoMove();
            }, 100);
        }
    }, [gameState, handlePlayerInteract, stopAutoMove, moveStep]);

    return {
        gameState, evolutionHistory, isScreenShaking, isFlashBang, flashColor, lastDecayEvent, finalCombo,
        moveStep, handleStabilize, handleDecayAction, handlePlayerInteract, handleToggleTimeStop,
        handleTransmute, handleToggleHiddenSkill, restartGame, handleCellClick, stopAutoMove
    };
};
