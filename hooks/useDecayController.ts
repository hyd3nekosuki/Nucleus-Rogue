
import React, { useCallback } from 'react';
import { GameState, DecayMode, NuclideData } from '../types';

import { COMBO_WINDOW_MS } from '../constants/gameConfig';
import { MAX_ENERGY, SCORE_FACTORS } from '../constants/economy';

import { getNuclideDataSync } from '../services/nuclideService';
import { calculateDecayEffects, getDecayDeltas } from '../physics/decaySystem';
import { processUnlocks } from '../engine/unlockSystem';
import { DiscoveryContext } from '../engine/stateTransitions';

export const useDecayController = (
    gameState: GameState,
    setGameState: React.Dispatch<React.SetStateAction<GameState>>,
    dispatchDiscovery: (nextNuclide: NuclideData, context: DiscoveryContext) => void,
    triggerTTS: (text: string) => void,
    triggerShake: () => void,
    triggerFlash: (color: string) => void,
    setLastDecayEvent: (val: { mode: DecayMode; timestamp: number } | null) => void,
    setLastFinalCombo: (val: { count: number; id: number } | null) => void,
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

        const isAnnihilationSkillActive = gameState.unlockedGroups.includes("Pair annihilation") && !gameState.disabledSkills.includes("Pair annihilation");

        const decayResult = calculateDecayEffects(
            actualMode, 
            gameState.currentNuclide,
            gameState.playerPos,
            gameState.gridEntities,
            currentTime, 
            isAnnihilationSkillActive, 
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

        const newData = getNuclideDataSync(gameState.currentNuclide.z + decayResult.dZ, gameState.currentNuclide.a + decayResult.dA);
        if (!newData.exists) {
            setGameState(prev => ({ ...prev, gameOver: true, energyPoints: 0, gameOverReason: "TRANSFORMATION_FAILED", combo: 0 }));
            return;
        }

        const rawCombo = (currentTime - gameState.lastComboTime <= COMBO_WINDOW_MS) ? gameState.combo + 1 : 1;
        const baseActionPoints = newData.a * SCORE_FACTORS.MASS_MULTIPLIER;
        const stabilityReward = newData.isStable ? SCORE_FACTORS.STABLE_BONUS : SCORE_FACTORS.UNSTABLE_BONUS;
        const totalBasePoints = baseActionPoints + stabilityReward + decayResult.actionBonusScore;
        const totalActionDelta = totalBasePoints * rawCombo;

        // --- Mastery Check: Priority Event Announcement ---
        if (!gameState.masteredDecays.includes(actualMode) && gameState.playerLevel < 6) {
            triggerTTS("Mastery Level Up");
        }

        // --- STEP 5: CENTRALIZED TRANSFORMATION DISPATCH ---
        dispatchDiscovery(newData, {
            method: decayResult.trigger,
            pz: gameState.currentNuclide.z,
            pa: gameState.currentNuclide.a,
            addedScore: totalBasePoints,
            chargesUsed: 0,
            inducedDecayMode: actualMode
        });

        // Update peripheral state
        setGameState(prev => {
            const unlockResult = processUnlocks(
                prev.unlockedElements, prev.unlockedGroups, newData.z, newData.a, 
                false, !!decayResult.isAnnihilation, false, false, 0, 
                false, false, false, false, false, 
                prev.decayStats[DecayMode.BETA_PLUS] + (actualMode === DecayMode.BETA_PLUS ? 1 : 0), 
                prev.decayStats[DecayMode.BETA_MINUS] + (actualMode === DecayMode.BETA_MINUS ? 1 : 0)
            );
            
            if (newData.isStable && rawCombo >= 2) setLastFinalCombo({ count: rawCombo, id: Date.now() }); 

            // Drip line warning - suppressed for stable nuclides
            const dripMsg = (!newData.isStable && (newData.isProtonDripLine || newData.isNeutronDripLine)) ? ["⚠️ Danger: Drip line limit"] : [];

            return { 
                ...prev, 
                playerPos: decayResult.newPosition || prev.playerPos, 
                energyPoints: Math.min(MAX_ENERGY, prev.energyPoints + (decayResult.energyBonus || 0)), 
                tutorialMessage: prev.tutorialMessage === "Decay to be stable" ? null : prev.tutorialMessage, 
                hasSeenDecayTutorial: prev.tutorialMessage === "Decay to be stable" ? true : prev.hasSeenDecayTutorial, 
                unlockedElements: unlockResult.updatedElements, 
                unlockedGroups: unlockResult.updatedGroups, 
                gridEntities: decayResult.newGridEntities, 
                effects: [...prev.effects, { id: Math.random().toString(36).substr(2, 9), type: actualMode, position: { ...prev.playerPos }, timestamp: currentTime }, ...decayResult.additionalEffects], 
                score: prev.score + totalActionDelta + unlockResult.scoreBonus, 
                hp: Math.min(prev.maxHp, prev.hp + (newData.isStable ? 10 : 0)), 
                messages: [...prev.messages, (decayResult.dZ !== 0 || decayResult.dA !== 0) ? `${decayResult.trigger} into ${newData.name}.` : decayResult.trigger, ...unlockResult.messages, ...dripMsg, ...decayResult.extraMessages].slice(-10), 
                combo: rawCombo,
                maxCombo: Math.max(prev.maxCombo, rawCombo),
                lastComboTime: currentTime,
                decayStats: { ...prev.decayStats, [actualMode]: (prev.decayStats[actualMode] || 0) + 1 },
                consecutiveProtons: 0, 
                consecutiveNeutrons: 0, 
                consecutiveElectrons: 0, 
                lastConsumedType: null
            };
        });
    }, [gameState.gameOver, gameState.loadingData, gameState.isTimeStopped, gameState.currentNuclide, gameState.disabledSkills, gameState.lastComboTime, gameState.combo, gameState.playerPos, gameState.gridEntities, stopAutoMove, setGameState, dispatchDiscovery, triggerTTS, triggerShake, triggerFlash, setLastDecayEvent, setLastFinalCombo]);

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
