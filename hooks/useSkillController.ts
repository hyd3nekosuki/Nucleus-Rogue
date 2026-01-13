import React, { useCallback } from 'react';
import { GameState, DecayMode, NuclideData, HistoryEntry, VisualEffect, EntityType, DiscoveryContext } from '../types';

import { INITIAL_NUCLIDE } from '../constants/gameConfig';
import { MAGIC_NUMBERS } from '../constants/physics';
import { BONUS_SCORES, STABILIZE_COST, NUCLEOSYNTHESIS_COST, FORCE_DECAY_COST, MAX_ENERGY } from '../constants/economy';
import { HISTORY_METHODS } from '../constants/strings';
import { REASON } from '../constants/gameOverReason';
import { TITLES } from '../constants/titles';

import { getNuclideDataSync, getValidAsForZ } from '../services/nuclideService';
import { pickNuclideWithPriority } from '../engine/particleEngine';
import { generateEntities } from '../engine/gameLogic';
import { processUnlocks } from '../engine/unlockSystem';
import { getInitialState } from '../engine/initialState';
import { getNextTutorialMessage, calculateTutorialFlagUpdates } from '../engine/tutorialManager';
import { emitFlash, emitTTS } from '../engine/events/gameEvents';

export const useSkillController = (
    gameState: GameState,
    setGameState: React.Dispatch<React.SetStateAction<GameState>>,
    dispatchDiscovery: (nextNuclide: NuclideData, context: DiscoveryContext) => void,
    setEvolutionHistory: React.Dispatch<React.SetStateAction<Record<string, HistoryEntry>>>,
    stopAutoMove: () => void,
    handleDecayAction: (mode: DecayMode) => void,
    setLastDecayEvent: (val: { mode: DecayMode; timestamp: number } | null) => void,
    setLastFinalCombo: (val: { count: number; id: number } | null) => void,
    resetVisuals: () => void
) => {

    const handleStabilize = useCallback(() => {
        if (gameState.playerLevel < 2) return;
        setGameState(prev => {
            const isSynth = prev.energyPoints >= NUCLEOSYNTHESIS_COST && prev.playerLevel >= 5 && !prev.disabledSkills.includes(TITLES.NUCLEOSYNTHESIS);
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
                    const unlockResult = processUnlocks(prev.unlockedElements, prev.unlockedGroups, nextZ, randomA, false, false, true);
                    emitTTS("Nucleosynthesis"); 
                    emitFlash('bg-white', 800);
                    
                    dispatchDiscovery(newData, {
                        method: HISTORY_METHODS.NUCLEOSYNTHESIS,
                        pz: prev.currentNuclide.z,
                        pa: prev.currentNuclide.a,
                        addedScore: nextZ * 10000,
                        chargesUsed: 0,
                        isManualDecay: false // Transformation
                    });

                    const dripMsg = (!newData.isStable && (newData.isProtonDripLine || newData.isNeutronDripLine)) ? ["⚠️ Danger: Drip line limit"] : [];
                    const nextTurn = prev.turn + 1;
                    const nextMsg = getNextTutorialMessage(prev, 'PARTICLE_CAPTURED', { nextNuclide: newData, currentTurn: nextTurn });
                    const tutorialFlags = calculateTutorialFlagUpdates(prev, nextMsg, nextTurn, 'PARTICLE_CAPTURED');

                    return { 
                        ...prev, 
                        ...tutorialFlags,
                        hp: prev.maxHp, 
                        energyPoints: Math.min(MAX_ENERGY, Math.max(0, prev.energyPoints - NUCLEOSYNTHESIS_COST)), 
                        tutorialMessage: nextMsg, 
                        score: prev.score + nextZ * 10000 + unlockResult.scoreBonus, 
                        effects: [...prev.effects, zapEffect], 
                        unlockedElements: unlockResult.updatedElements, 
                        unlockedGroups: unlockResult.updatedGroups, 
                        messages: [...prev.messages, `🌟 NUCLEOSYNTHESIS: Synthesized ${newData.name}! (+${(nextZ * 10000).toLocaleString()} PTS)`, ...unlockResult.messages, ...dripMsg].slice(-10), 
                        isTimeStopped: false, 
                        consecutiveProtons: 0, consecutiveNeutrons: 0, consecutiveElectrons: 0, lastConsumedType: null 
                    };
                }
                return prev;
            } else {
                return { ...prev, turn: prev.turn + 1, hp: prev.maxHp, energyPoints: Math.min(MAX_ENERGY, Math.max(0, prev.energyPoints - STABILIZE_COST)), effects: [...prev.effects, zapEffect], messages: [...prev.messages, `🔬 Stabilization: HP Recovered.`].slice(-10) };
            }
        });
    }, [gameState.playerLevel, setGameState, dispatchDiscovery]);

    const handleUltimateSynthesis = useCallback(() => {
        if (gameState.playerLevel < 5 || gameState.disabledSkills.includes(TITLES.NUCLEOSYNTHESIS)) return;
        setGameState(prev => {
            if (prev.isTimeStopped) return { ...prev, messages: [...prev.messages, "⚠️ System Error: Spacetime stabilization prevents accretion."].slice(-10) };
            let absorbedP = 0, absorbedN = 0, absorbedE = 0, absorbedPos = 0;
            prev.gridEntities.forEach(e => { if (e.type === EntityType.PROTON) absorbedP++; else if (e.type === EntityType.NEUTRON) absorbedN++; else if (e.type === EntityType.ENEMY_ELECTRON) absorbedE++; else if (e.type === EntityType.ENEMY_POSITRON) absorbedPos++; });
            const totalAbsorbed = absorbedP + absorbedN + absorbedE + absorbedPos;
            if (totalAbsorbed === 0) return prev;
            const nextZ = prev.currentNuclide.z + absorbedP - absorbedE + absorbedPos;
            const nextA = prev.currentNuclide.a + absorbedP + absorbedN;
            emitFlash('bg-white', 800);
            const newData = getNuclideDataSync(nextZ, nextA);
            if (!newData.exists || nextZ < 0 || nextZ > 118) return { ...prev, gameOver: true, gameOverReason: REASON.NUCLEUS_COLLAPSE, gridEntities: [], energyPoints: 0, tutorialMessage: null, messages: [...prev.messages, "⚠️ NUCLEUS COLLAPSE: Impossible configuration reached!"].slice(-10) };
            const synthBonus = totalAbsorbed * 50000;
            const unlockResult = processUnlocks(prev.unlockedElements, prev.unlockedGroups, nextZ, nextA, false, false, true);
            
            dispatchDiscovery(newData, {
                method: HISTORY_METHODS.R_PROCESS,
                pz: prev.currentNuclide.z,
                pa: prev.currentNuclide.a,
                addedScore: synthBonus,
                chargesUsed: 0,
                isManualDecay: false // Transformation
            });

            const dripMsg = (!newData.isStable && (newData.isProtonDripLine || newData.isNeutronDripLine)) ? ["⚠️ Danger: Drip line limit"] : [];
            const nextTurn = prev.turn + 1;
            const nextMsg = getNextTutorialMessage(prev, 'PARTICLE_CAPTURED', { nextNuclide: newData, currentTurn: nextTurn });
            const tutorialFlags = calculateTutorialFlagUpdates(prev, nextMsg, nextTurn, 'PARTICLE_CAPTURED');

            emitTTS("r-process nucleosynthesis");
            return { 
                ...prev, 
                ...tutorialFlags,
                hp: prev.maxHp, 
                gridEntities: [], 
                tutorialMessage: nextMsg, 
                score: prev.score + synthBonus + unlockResult.scoreBonus, 
                unlockedElements: unlockResult.updatedElements, 
                unlockedGroups: unlockResult.updatedGroups, 
                playerLevel: 0, 
                masteredDecays: [], 
                messages: [...prev.messages, `🌌 r-process nucleosynthesis: Absorbed ${totalAbsorbed} particles into ${newData.name}! (+${synthBonus.toLocaleString()} PTS)`, ...dripMsg, "⚠️ MASTERY CONSUMED: Level reset to 0. Cosmic knowledge lost."].slice(-10), 
                combo: 0,
                consecutiveProtons: 0, 
                consecutiveNeutrons: 0, 
                consecutiveElectrons: 0, 
                lastConsumedType: null 
            };
        });
    }, [gameState.playerLevel, setGameState, dispatchDiscovery]);

    const handleToggleTimeStop = useCallback(() => {
        if (gameState.playerLevel < 3) return; 
        const neutronNumber = gameState.currentNuclide.a - gameState.currentNuclide.z;
        if (MAGIC_NUMBERS.includes(neutronNumber)) {
            setGameState(prev => {
                const nextState = !prev.isTimeStopped;
                if (nextState) stopAutoMove();
                setLastFinalCombo(null);
                return { ...prev, isTimeStopped: nextState, effects: [], messages: [...prev.messages, nextState ? "✨ FROZEN TIME: Locked by neutron shell." : "✨ TIME RESTORED."].slice(-10) };
            });
        }
    }, [gameState.playerLevel, gameState.currentNuclide.a, gameState.currentNuclide.z, stopAutoMove, setLastFinalCombo, setGameState]);

    const handleTransmute = useCallback((selectedZ: number) => {
        if (gameState.playerLevel < 4 || gameState.disabledSkills.includes(TITLES.EXP_REPLICATE)) return; 
        const validAs = getValidAsForZ(selectedZ); if (validAs.length === 0) return;
        const randomA = validAs[Math.floor(Math.random() * validAs.length)];
        const newData = getNuclideDataSync(selectedZ, randomA);
        if (newData.exists) {
            setGameState(prev => {
                const unlockResult = processUnlocks(prev.unlockedElements, prev.unlockedGroups, selectedZ, randomA, true);
                setLastDecayEvent(null);
                
                dispatchDiscovery(newData, {
                    method: HISTORY_METHODS.EXP_REPLICATE,
                    pz: prev.currentNuclide.z,
                    pa: prev.currentNuclide.a,
                    addedScore: BONUS_SCORES.EXP_REPLICATE_ACTION,
                    chargesUsed: 0,
                    isManualDecay: false // Transformation
                });

                const dripMsg = (!newData.isStable && (newData.isProtonDripLine || newData.isNeutronDripLine)) ? ["⚠️ Danger: Drip line limit"] : [];
                const nextTurn = prev.turn + 1;
                const nextMsg = getNextTutorialMessage(prev, 'PARTICLE_CAPTURED', { nextNuclide: newData, currentTurn: nextTurn });
                const tutorialFlags = calculateTutorialFlagUpdates(prev, nextMsg, nextTurn, 'PARTICLE_CAPTURED');

                emitTTS("Experimental Replicate"); 
                emitFlash('bg-neon-blue', 800);
                return { 
                    ...prev, 
                    ...tutorialFlags,
                    tutorialMessage: nextMsg, 
                    unlockedElements: unlockResult.updatedElements, 
                    unlockedGroups: unlockResult.updatedGroups, 
                    score: prev.score + BONUS_SCORES.EXP_REPLICATE_ACTION + unlockResult.scoreBonus, 
                    messages: [...prev.messages, `🔮 EXP. REPLICATE: ${newData.name}!`, ...unlockResult.messages, ...dripMsg].slice(-10), 
                    isTimeStopped: false, 
                    combo: 0, 
                    consecutiveProtons: 0, 
                    consecutiveNeutrons: 0, 
                    consecutiveElectrons: 0, 
                    lastConsumedType: null
                };
            });
        }
    }, [gameState.playerLevel, setGameState, setLastDecayEvent, dispatchDiscovery]);

    const handleToggleHiddenSkill = useCallback((skillName: string) => {
        setGameState(prev => {
            const isDisabled = prev.disabledSkills.includes(skillName);
            const nextDisabled = isDisabled ? prev.disabledSkills.filter(s => s !== skillName) : [...prev.disabledSkills, skillName];
            
            let nextEntities = [...prev.gridEntities];
            let nextMessages = [...prev.messages, `⚙️ Skill ${skillName} ${isDisabled ? 'ENABLED' : 'DISABLED'}`].slice(-10);

            // Special spawn: Demon core enabled
            if (skillName === TITLES.DAREDEVIL && isDisabled && !nextEntities.some(e => e.type === EntityType.ANTI_NUCLIDE)) {
                nextEntities = generateEntities(1, nextEntities, prev.playerPos, prev.turn, EntityType.ANTI_NUCLIDE);
                nextMessages = [...nextMessages, "🌑 DEMON CORE ACTIVE: Anti-nuclide manifestation detected."].slice(-10);
            }

            return { ...prev, gridEntities: nextEntities, disabledSkills: nextDisabled, messages: nextMessages };
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
            const isDaredevilActive = currentGroups.includes(TITLES.DAREDEVIL) && !prev.disabledSkills.includes(TITLES.DAREDEVIL);
            
            const newState = getInitialState();
            
            let startNuclide = INITIAL_NUCLIDE;
            if (randomStart) {
                let coords = pickNuclideWithPriority(currentTitles, isDaredevilActive); 
                if (coords) { 
                    const data = getNuclideDataSync(coords.z, coords.a); 
                    if (data.exists) startNuclide = data; 
                }
            }
            
            let unlockResult = randomStart 
                ? processUnlocks([...currentTitles], [...currentGroups], startNuclide.z, startNuclide.a) 
                : { updatedElements: [] as number[], updatedGroups: [] as string[], scoreBonus: 0, messages: [] as string[] };
            
            resetVisuals();
            
            const originEntry: HistoryEntry = { 
                firstTurn: 0, 
                lastTurn: 0,
                name: startNuclide.name, 
                symbol: startNuclide.symbol, 
                z: startNuclide.z, 
                a: startNuclide.a, 
                method: HISTORY_METHODS.ORIGIN,
                pz: null,
                pa: null
            };

            const nextMsg = getNextTutorialMessage(prev, 'GAME_START', { randomStart, nextNuclide: startNuclide });

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
                tutorialMessage: nextMsg, 
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