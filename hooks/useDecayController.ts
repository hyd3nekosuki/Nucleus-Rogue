
// Added React import to provide access to React namespace
import React, { useCallback } from 'react';
import { GameState, DecayMode, HistoryEntry } from '../types';
import { 
    COMBO_WINDOW_MS, MAGIC_NUMBERS, MAX_ENERGY 
} from '../constants';
import { getNuclideDataSync } from '../services/nuclideService';
import { calculateDecayEffects, getDecayDeltas } from '../utils/decaySystem';
import { isTemporalInversionEligible, calculateComboCompletionBonus } from '../utils/scoreLogic';
import { processUnlocks } from '../utils/unlockSystem';

export const useDecayController = (
    gameState: GameState,
    setGameState: React.Dispatch<React.SetStateAction<GameState>>,
    setEvolutionHistory: React.Dispatch<React.SetStateAction<Record<string, HistoryEntry>>>,
    triggerTTS: (text: string) => void,
    triggerShake: () => void,
    triggerFlash: (color: string) => void,
    setLastDecayEvent: (val: { mode: DecayMode; timestamp: number } | null) => void,
    setFinalCombo: (val: { count: number; id: number } | null) => void,
    stopAutoMove: () => void
) => {

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
                const deltas = getDecayDeltas(rnd);
                if (rnd === DecayMode.GAMMA || getNuclideDataSync(gameState.currentNuclide.z + deltas.dZ, gameState.currentNuclide.a + deltas.dA).exists) { 
                    actualMode = rnd; 
                    found = true; 
                    break; 
                }
            }
            if (!found) return;
        }

        const decayResult = calculateDecayEffects(
            actualMode, 
            gameState.currentNuclide,
            gameState.playerPos,
            gameState.gridEntities,
            currentTime, 
            !gameState.disabledSkills.includes("Pair annihilation"), 
            !gameState.disabledSkills.includes("Fission"), 
            gameState.unlockedGroups.includes("Neutronization") && !gameState.disabledSkills.includes("Neutronization")
        );

        if (decayResult.dZ === 0 && decayResult.dA === 0 && decayResult.trigger === "") return; 
        
        setLastDecayEvent({ 
            mode: (actualMode === DecayMode.SPONTANEOUS_FISSION && gameState.disabledSkills.includes("Fission")) ? DecayMode.ALPHA : actualMode, 
            timestamp: currentTime 
        });
        
        if (decayResult.shouldShake) triggerShake();
        if (decayResult.shouldFlash) triggerFlash(actualMode === DecayMode.SPONTANEOUS_FISSION ? 'bg-yellow-400' : 'bg-neon-blue');
        
        if (decayResult.speechOverride) triggerTTS(decayResult.speechOverride);

        setGameState(prev => {
            const newData = getNuclideDataSync(prev.currentNuclide.z + decayResult.dZ, prev.currentNuclide.a + decayResult.dA);
            if (!newData.exists) return { ...prev, gameOver: true, energyPoints: 0, gameOverReason: "TRANSFORMATION_FAILED", combo: 0, comboScore: 0, comboStartNuclide: undefined }; 

            let rawCombo = (currentTime - prev.lastComboTime <= COMBO_WINDOW_MS) ? prev.combo + 1 : 1;
            let nextComboStartNuclide = (rawCombo === 1) ? { z: prev.currentNuclide.z, a: prev.currentNuclide.a } : prev.comboStartNuclide;
            
            const scoreIncrease = ((newData.a * 10 + (newData.isStable ? 100 : 10) + decayResult.actionBonusScore) * rawCombo);
            let nextComboScore = (rawCombo === 1) ? scoreIncrease : prev.comboScore + scoreIncrease;
            
            const inversionEligible = isTemporalInversionEligible(newData.z, newData.a, nextComboStartNuclide, prev.unlockedGroups, prev.disabledSkills);
            const unlockResult = processUnlocks(prev.unlockedElements, prev.unlockedGroups, newData.z, newData.a, false, !!decayResult.isAnnihilation, false, inversionEligible, nextComboScore, false, false, false, false, false, prev.decayStats[DecayMode.BETA_PLUS] + (actualMode === DecayMode.BETA_PLUS ? 1 : 0), prev.decayStats[DecayMode.BETA_MINUS] + (actualMode === DecayMode.BETA_MINUS ? 1 : 0));
            
            let finalComboCount = rawCombo, finalScoreBonus = 0;
            if (newData.isStable) { 
                if (rawCombo >= 2) setFinalCombo({ count: rawCombo, id: Date.now() }); 
                finalComboCount = 0; 
                finalScoreBonus = calculateComboCompletionBonus(nextComboScore, inversionEligible); 
            }
            
            let nextLevel = prev.playerLevel, nextMastered = prev.masteredDecays;
            if (!prev.masteredDecays.includes(actualMode) && nextLevel < 6) { 
                nextLevel += 1; 
                nextMastered = [...prev.masteredDecays, actualMode]; 
                triggerTTS("Mastery Level Up !"); 
            }
            
            const nextTurn = prev.turn + 1;
            if (newData.z !== prev.currentNuclide.z || newData.a !== prev.currentNuclide.a) {
                setEvolutionHistory(h => ({
                    ...h,
                    [`${newData.z}-${newData.a}`]: { 
                        turn: nextTurn, 
                        name: newData.name, 
                        symbol: newData.symbol, 
                        z: newData.z, 
                        a: newData.a, 
                        method: decayResult.trigger,
                        pz: prev.currentNuclide.z,
                        pa: prev.currentNuclide.a
                    }
                }));
            }
            
            const nextState = { 
                ...prev, 
                currentNuclide: newData, 
                playerPos: decayResult.newPosition || prev.playerPos, 
                energyPoints: Math.min(MAX_ENERGY, prev.energyPoints + (decayResult.energyBonus || 0)), 
                turn: nextTurn, 
                tutorialMessage: prev.tutorialMessage === "Decay to be stable" ? null : prev.tutorialMessage, 
                hasSeenDecayTutorial: prev.tutorialMessage === "Decay to be stable" ? true : prev.hasSeenDecayTutorial, 
                unlockedElements: unlockResult.updatedElements, 
                unlockedGroups: unlockResult.updatedGroups, 
                gridEntities: decayResult.newGridEntities, 
                effects: [...prev.effects, { id: Math.random().toString(36).substr(2, 9), type: actualMode, position: { ...prev.playerPos }, timestamp: currentTime }, ...decayResult.additionalEffects], 
                score: prev.score + scoreIncrease + finalScoreBonus + unlockResult.scoreBonus, 
                hp: Math.min(prev.maxHp, prev.hp + (newData.isStable ? 10 : 0)), 
                messages: [...prev.messages, (decayResult.dZ !== 0 || decayResult.dA !== 0) ? `${decayResult.trigger} into ${newData.name}.` : decayResult.trigger, ...unlockResult.messages, ...decayResult.extraMessages].slice(-10), 
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
                decayStats: { ...prev.decayStats, [actualMode]: (prev.decayStats[actualMode] || 0) + 1 }, 
                magicBarrierCharges: (nextLevel >= 1 && MAGIC_NUMBERS.includes(newData.z) && prev.magicBarrierCharges === 0) ? 3 : prev.magicBarrierCharges 
            };

            if (nextState.hp <= 0 && !nextState.gameOver) {
                if (nextState.unlockedGroups.includes("Temporal Inversion") && !nextState.disabledSkills.includes("Temporal Inversion") && nextState.energyPoints >= 5) {
                    nextState.hp = nextState.maxHp; 
                    nextState.energyPoints -= 5; 
                    nextState.messages = [...nextState.messages, "⏱ AUTO-STABILIZATION: Temporal Inversion triggered!"].slice(-10);
                    nextState.effects = [...nextState.effects, { id: Math.random().toString(36).substr(2, 9), type: DecayMode.STABILIZE_ZAP, position: { ...nextState.playerPos }, timestamp: Date.now() }];
                } else { 
                    nextState.gameOver = true; 
                    nextState.gameOverReason = "TRANSFORMATION_SHOCK"; 
                    nextState.combo = 0; 
                }
            }
            return nextState;
        });
    }, [gameState.gameOver, gameState.loadingData, gameState.isTimeStopped, gameState.currentNuclide, gameState.disabledSkills, gameState.unlockedGroups, stopAutoMove, setGameState, setEvolutionHistory, triggerTTS, triggerShake, triggerFlash, setLastDecayEvent, setFinalCombo, gameState.playerPos, gameState.gridEntities]);

    const handlePlayerInteract = useCallback(() => {
        stopAutoMove(); 
        if (gameState.gameOver || gameState.loadingData || gameState.isTimeStopped) return;
        if (gameState.currentNuclide.isStable) return;
        
        let activeMode = gameState.currentNuclide.decayModes.find(m => m !== DecayMode.STABLE && m !== DecayMode.UNKNOWN) 
                        || (gameState.currentNuclide.decayModes.includes(DecayMode.UNKNOWN) ? DecayMode.UNKNOWN : null);
        
        if (activeMode) handleDecayAction(activeMode);
    }, [gameState.gameOver, gameState.loadingData, gameState.isTimeStopped, gameState.currentNuclide, stopAutoMove, handleDecayAction]);

    return {
        handleDecayAction,
        handlePlayerInteract
    };
};
