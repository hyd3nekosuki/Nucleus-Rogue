
import React, { useCallback } from 'react';
import { GameState, DecayMode, HistoryEntry, EntityType, VisualEffect } from '../types';
import { 
    INITIAL_NUCLIDE, MAGIC_NUMBERS, BONUS_SCORES, HISTORY_METHODS,
    STABILIZE_COST, NUCLEOSYNTHESIS_COST, FORCE_DECAY_COST, MAX_ENERGY 
} from '../constants';
import { getNuclideDataSync, getValidAsForZ } from '../services/nuclideService';
import { getRandomKnownNuclideCoordinates } from '../data/staticNuclides';
import { generateEntities } from '../utils/gameLogic';
import { processUnlocks } from '../utils/unlockSystem';
import { getInitialState } from '../utils/initialState';

export const useSkillController = (
    gameState: GameState,
    setGameState: React.Dispatch<React.SetStateAction<GameState>>,
    setEvolutionHistory: React.Dispatch<React.SetStateAction<Record<string, HistoryEntry>>>, // Legacy unused
    triggerTTS: (text: string) => void,
    triggerFlash: (color: string, duration?: number) => void,
    stopAutoMove: () => void,
    handleDecayAction: (mode: DecayMode) => void,
    setLastDecayEvent: (val: { mode: DecayMode; timestamp: number } | null) => void,
    setFinalCombo: (val: { count: number; id: number } | null) => void,
    resetVisuals: () => void
) => {

    const handleStabilize = useCallback(() => {
        if (gameState.playerLevel < 2) return;
        setGameState(prev => {
            const isSynth = prev.energyPoints >= NUCLEOSYNTHESIS_COST && prev.playerLevel >= 5 && !prev.disabledSkills.includes("Nucleosynthesis");
            const cost = isSynth ? NUCLEOSYNTHESIS_COST : STABILIZE_COST;
            if (prev.energyPoints < cost) return { ...prev, messages: [...prev.messages, `⚠️ Not enough energy! Need ${cost}E.`].slice(-10) };
            const now = Date.now();
            const effectType = isSynth ? DecayMode.NUCLEOSYNTHESIS_ZAP : DecayMode.STABILIZE_ZAP;
            const zapEffect: VisualEffect = { id: Math.random().toString(36).substr(2, 9), type: effectType, position: { ...prev.playerPos }, timestamp: now };
            if (isSynth) {
                const nextZ = prev.currentNuclide.z + 1;
                if (nextZ > 118) return { ...prev, messages: [...prev.messages, "⚠️ Oganesson limit reached!"].slice(-10) };
                const validAs = getValidAsForZ(nextZ);
                if (validAs.length === 0) return { ...prev, messages: [...prev.messages, "⚠️ Synthesis failed: Unstable zone."].slice(-10) };
                const randomA = validAs[Math.floor(Math.random() * validAs.length)];
                const newData = getNuclideDataSync(nextZ, randomA);
                if (newData.exists) {
                    const nextTurn = prev.turn + 1;
                    const unlockResult = processUnlocks(prev.unlockedElements, prev.unlockedGroups, nextZ, randomA, false, false, true);
                    triggerTTS("Nucleosynthesis"); triggerFlash('bg-white', 800);
                    
                    const newEntry: HistoryEntry = { 
                        turn: nextTurn, 
                        name: newData.name, 
                        symbol: newData.symbol, 
                        z: newData.z, 
                        a: newData.a, 
                        method: HISTORY_METHODS.NUCLEOSYNTHESIS,
                        pz: prev.currentNuclide.z,
                        pa: prev.currentNuclide.a
                    };

                    return { 
                        ...prev, 
                        currentNuclide: newData, 
                        evolutionHistory: { ...prev.evolutionHistory, [`${newData.z}-${newData.a}`]: newEntry },
                        hp: prev.maxHp, 
                        energyPoints: Math.min(MAX_ENERGY, Math.max(0, prev.energyPoints - NUCLEOSYNTHESIS_COST)), 
                        turn: nextTurn, 
                        tutorialMessage: prev.tutorialMessage === "Capture particle to transform" ? null : prev.tutorialMessage, 
                        hasSeenCaptureTutorial: true, 
                        score: prev.score + nextZ * 10000 + unlockResult.scoreBonus, 
                        effects: [...prev.effects, zapEffect], 
                        unlockedElements: unlockResult.updatedElements, 
                        unlockedGroups: unlockResult.updatedGroups, 
                        messages: [...prev.messages, `🌟 NUCLEOSYNTHESIS: Synthesized ${newData.name}! (+${(nextZ * 10000).toLocaleString()} PTS)`, ...unlockResult.messages].slice(-10), 
                        isTimeStopped: false, 
                        consecutiveProtons: 0, consecutiveNeutrons: 0, consecutiveElectrons: 0, lastConsumedType: null 
                    };
                }
                return prev;
            } else {
                return { ...prev, hp: prev.maxHp, energyPoints: Math.min(MAX_ENERGY, Math.max(0, prev.energyPoints - STABILIZE_COST)), effects: [...prev.effects, zapEffect], messages: [...prev.messages, `🔬 Stabilization: HP Recovered.`].slice(-10) };
            }
        });
    }, [gameState.playerLevel, triggerTTS, triggerFlash, setGameState]);

    const handleUltimateSynthesis = useCallback(() => {
        if (gameState.playerLevel < 5 || gameState.disabledSkills.includes("Nucleosynthesis")) return;
        setGameState(prev => {
            if (prev.isTimeStopped) return { ...prev, messages: [...prev.messages, "⚠️ System Error: Spacetime stabilization prevents accretion."].slice(-10) };
            let absorbedP = 0, absorbedN = 0, absorbedE = 0, absorbedPos = 0;
            prev.gridEntities.forEach(e => { if (e.type === EntityType.PROTON) absorbedP++; else if (e.type === EntityType.NEUTRON) absorbedN++; else if (e.type === EntityType.ENEMY_ELECTRON) absorbedE++; else if (e.type === EntityType.ENEMY_POSITRON) absorbedPos++; });
            const totalAbsorbed = absorbedP + absorbedN + absorbedE + absorbedPos;
            if (totalAbsorbed === 0) return prev;
            const nextZ = prev.currentNuclide.z + absorbedP - absorbedE + absorbedPos;
            const nextA = prev.currentNuclide.a + absorbedP + absorbedN;
            triggerFlash('bg-white', 800);
            const newData = getNuclideDataSync(nextZ, nextA);
            if (!newData.exists || nextZ < 0 || nextZ > 118) return { ...prev, gameOver: true, gameOverReason: "NUCLEUS COLLAPSE", gridEntities: [], energyPoints: 0, tutorialMessage: null, messages: [...prev.messages, "⚠️ NUCLEUS COLLAPSE: Impossible configuration reached!"].slice(-10) };
            const nextTurn = prev.turn + 1;
            const synthBonus = totalAbsorbed * 50000;
            const unlockResult = processUnlocks(prev.unlockedElements, prev.unlockedGroups, nextZ, nextA, false, false, true);
            
            const newEntry: HistoryEntry = { 
                turn: nextTurn, 
                name: newData.name, 
                symbol: newData.symbol, 
                z: newData.z, 
                a: newData.a, 
                method: HISTORY_METHODS.R_PROCESS,
                pz: prev.currentNuclide.z,
                pa: prev.currentNuclide.a
            };

            triggerTTS("r-process nucleosynthesis");
            return { 
                ...prev, 
                currentNuclide: newData, 
                evolutionHistory: { ...prev.evolutionHistory, [`${newData.z}-${newData.a}`]: newEntry },
                hp: prev.maxHp, 
                turn: nextTurn, 
                gridEntities: [], 
                tutorialMessage: prev.tutorialMessage === "Capture particle to transform" ? null : prev.tutorialMessage, 
                hasSeenCaptureTutorial: true, 
                score: prev.score + synthBonus + unlockResult.scoreBonus, 
                unlockedElements: unlockResult.updatedElements, 
                unlockedGroups: unlockResult.updatedGroups, 
                playerLevel: 0, 
                masteredDecays: [], 
                messages: [...prev.messages, `🌌 r-process nucleosynthesis: Absorbed ${totalAbsorbed} particles into ${newData.name}! (+${synthBonus.toLocaleString()} PTS)`, "⚠️ MASTERY CONSUMED: Level reset to 0. Cosmic knowledge lost."].slice(-10), 
                combo: 0,
                consecutiveProtons: 0, 
                consecutiveNeutrons: 0, 
                consecutiveElectrons: 0, 
                lastConsumedType: null 
            };
        });
    }, [gameState.playerLevel, triggerTTS, triggerFlash, setGameState]);

    const handleToggleTimeStop = useCallback(() => {
        if (gameState.playerLevel < 3) return; 
        const neutronNumber = gameState.currentNuclide.a - gameState.currentNuclide.z;
        if (MAGIC_NUMBERS.includes(neutronNumber)) {
            setGameState(prev => {
                const nextState = !prev.isTimeStopped;
                if (nextState) stopAutoMove();
                setFinalCombo(null);
                return { ...prev, isTimeStopped: nextState, effects: [], messages: [...prev.messages, nextState ? "✨ FROZEN TIME: Locked by neutron shell." : "✨ TIME RESTORED."].slice(-10) };
            });
        }
    }, [gameState.playerLevel, gameState.currentNuclide.a, gameState.currentNuclide.z, stopAutoMove, setFinalCombo, setGameState]);

    const handleTransmute = useCallback((selectedZ: number) => {
        if (gameState.playerLevel < 4 || gameState.disabledSkills.includes("Exp. Replicate")) return; 
        const validAs = getValidAsForZ(selectedZ); if (validAs.length === 0) return;
        const randomA = validAs[Math.floor(Math.random() * validAs.length)];
        const newData = getNuclideDataSync(selectedZ, randomA);
        if (newData.exists) {
            setGameState(prev => {
                const nextTurn = prev.turn + 1;
                const unlockResult = processUnlocks(prev.unlockedElements, prev.unlockedGroups, selectedZ, randomA, true);
                setLastDecayEvent(null);
                
                const newEntry: HistoryEntry = { 
                    turn: nextTurn, 
                    name: newData.name, 
                    symbol: newData.symbol, 
                    z: newData.z, 
                    a: newData.a, 
                    method: HISTORY_METHODS.EXP_REPLICATE,
                    pz: prev.currentNuclide.z,
                    pa: prev.currentNuclide.a
                };

                triggerTTS("Experimental Replicate"); triggerFlash('bg-neon-blue', 800);
                return { 
                    ...prev, 
                    currentNuclide: newData, 
                    evolutionHistory: { ...prev.evolutionHistory, [`${newData.z}-${newData.a}`]: newEntry },
                    turn: nextTurn, 
                    tutorialMessage: prev.tutorialMessage === "Capture particle to transform" ? null : prev.tutorialMessage, 
                    hasSeenCaptureTutorial: true, 
                    unlockedElements: unlockResult.updatedElements, 
                    unlockedGroups: unlockResult.updatedGroups, 
                    score: prev.score + BONUS_SCORES.EXP_REPLICATE_ACTION + unlockResult.scoreBonus, 
                    messages: [...prev.messages, `🔮 EXP. REPLICATE: ${newData.name}!`, ...unlockResult.messages].slice(-10), 
                    isTimeStopped: false, 
                    combo: 0, 
                    consecutiveProtons: 0, 
                    consecutiveNeutrons: 0, 
                    consecutiveElectrons: 0, 
                    lastConsumedType: null, 
                    magicBarrierCharges: (prev.playerLevel >= 1 && MAGIC_NUMBERS.includes(newData.z) && prev.magicBarrierCharges === 0) ? 3 : prev.magicBarrierCharges 
                };
            });
        }
    }, [gameState.playerLevel, triggerTTS, triggerFlash, setGameState, setLastDecayEvent]);

    const handleToggleHiddenSkill = useCallback((skillName: string) => {
        setGameState(prev => {
            const isDisabled = prev.disabledSkills.includes(skillName);
            const nextDisabled = isDisabled ? prev.disabledSkills.filter(s => s !== skillName) : [...prev.disabledSkills, skillName];
            return { ...prev, disabledSkills: nextDisabled, messages: [...prev.messages, `⚙️ Skill ${skillName} ${isDisabled ? 'ENABLED' : 'DISABLED'}`].slice(-10) };
        });
    }, [setGameState]);

    const restartGame = useCallback((randomStart: boolean = false) => {
        setGameState(prev => {
            const currentTitles = prev.unlockedElements;
            const currentGroups = prev.unlockedGroups;
            const currentMaxCombo = randomStart ? prev.maxCombo : 0;
            const currentReincarnations = prev.reincarnations;
            const currentSeenCapture = prev.hasSeenCaptureTutorial;
            const currentSeenDecay = prev.hasSeenDecayTutorial;
            const newState = getInitialState();
            
            let startNuclide = INITIAL_NUCLIDE;
            if (randomStart) {
                let coords = getRandomKnownNuclideCoordinates(); 
                if (coords) { const data = getNuclideDataSync(coords.z, coords.a); if (data.exists) startNuclide = data; }
            }
            
            let unlockResult = randomStart 
                ? processUnlocks([...currentTitles], [...currentGroups], startNuclide.z, startNuclide.a) 
                : { updatedElements: [] as number[], updatedGroups: [] as string[], scoreBonus: 0, messages: [] as string[] };
            
            resetVisuals();
            
            const originEntry: HistoryEntry = { 
                turn: 0, 
                name: startNuclide.name, 
                symbol: startNuclide.symbol, 
                z: startNuclide.z, 
                a: startNuclide.a, 
                method: HISTORY_METHODS.ORIGIN,
                pz: null,
                pa: null
            };

            return { 
                ...newState, 
                evolutionHistory: { [`${startNuclide.z}-${startNuclide.a}`]: originEntry },
                disabledSkills: randomStart ? prev.disabledSkills : [], 
                score: unlockResult.scoreBonus, 
                currentNuclide: startNuclide, 
                gridEntities: generateEntities(5, [], newState.playerPos, 0), 
                unlockedElements: unlockResult.updatedElements, 
                unlockedGroups: unlockResult.updatedGroups, 
                maxCombo: currentMaxCombo, 
                reincarnations: randomStart ? currentReincarnations + 1 : 0, 
                hasSeenCaptureTutorial: randomStart ? currentSeenCapture : false, 
                hasSeenDecayTutorial: randomStart ? currentSeenDecay : false, 
                tutorialMessage: (randomStart && currentSeenCapture) ? null : "Capture particle to transform", 
                messages: [`Journey begins with ${startNuclide.name}.`, ...unlockResult.messages].slice(-10) 
            };
        });
    }, [setGameState, resetVisuals]);

    const handleForceUnknownDecay = useCallback(() => {
        if (gameState.playerLevel < 6 || !gameState.currentNuclide.isStable || gameState.energyPoints < FORCE_DECAY_COST || gameState.gameOver || gameState.isTimeStopped) return;
        setGameState(prev => ({ ...prev, energyPoints: Math.max(0, prev.energyPoints - FORCE_DECAY_COST), messages: [...prev.messages, "⚠️ ANOMALY: Forced decay triggered!"].slice(-10) }));
        handleDecayAction(DecayMode.UNKNOWN);
    }, [gameState.playerLevel, gameState.currentNuclide.isStable, gameState.energyPoints, gameState.gameOver, gameState.isTimeStopped, handleDecayAction, setGameState]);

    return {
        handleStabilize,
        handleUltimateSynthesis,
        handleToggleTimeStop,
        handleTransmute,
        handleToggleHiddenSkill,
        restartGame,
        handleForceUnknownDecay
    };
};
